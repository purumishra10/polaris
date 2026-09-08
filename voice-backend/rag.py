"""Retrieve station knowledge for the ops agent.

Tries pgvector (same hashed embeddings as scripts/ingest_polaris_db.py).
Falls back to local markdown chunks so voice still works without Postgres.
"""

from __future__ import annotations

import hashlib
import math
import os
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DIM = 384

_TOKEN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

_DOC_FILES = [
    ("digital_twin_knowledge_base.md", "knowledge_base"),
    ("antarctic_digital_twin_datasets.md", "datasets"),
    ("papers_reading_guide.md", "papers"),
    (os.path.join("datasets", "README.md"), "data_dictionary"),
]

_local_chunks: list[dict[str, Any]] = []
_pg_ok: bool | None = None
_mode = "unloaded"


def hashed_embed(text: str, dim: int = DIM) -> list[float]:
    vec = [0.0] * dim
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        digest = hashlib.md5(tok.encode("utf-8")).hexdigest()
        vec[int(digest, 16) % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    if norm:
        vec = [v / norm for v in vec]
    return vec


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _chunk_markdown(text: str, source: str) -> list[dict[str, Any]]:
    parts = re.split(r"(?m)^#{1,3} ", text)
    out: list[dict[str, Any]] = []
    for part in parts:
        block = part.strip()
        if len(block) < 80:
            continue
        lines = block.split("\n", 1)
        heading = lines[0].strip().replace("*", "")[:120]
        body = lines[1].strip() if len(lines) > 1 else block
        step = 1100
        for index in range(0, max(len(body), 1), step):
            sl = body[index : index + 1300].strip()
            if len(sl) < 50:
                continue
            out.append(
                {
                    "heading": heading,
                    "content": sl,
                    "source": source,
                    "embedding": hashed_embed(f"{heading}\n{sl}"),
                }
            )
    return out


def _load_local() -> None:
    global _local_chunks, _mode
    chunks: list[dict[str, Any]] = []
    for rel, label in _DOC_FILES:
        path = ROOT / rel
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        chunks.extend(_chunk_markdown(raw, f"{label}:{rel}"))
    _local_chunks = chunks
    if _mode != "pgvector":
        _mode = "local-md"


def _pg_connect():
    try:
        import psycopg2
    except ImportError:
        return None
    try:
        return psycopg2.connect(
            host=os.getenv("POLARIS_PGHOST", "127.0.0.1"),
            port=os.getenv("POLARIS_PGPORT", "5432"),
            user=os.getenv("POLARIS_PGUSER", "polaris"),
            password=os.getenv("POLARIS_PGPASSWORD", "polaris"),
            dbname=os.getenv("POLARIS_PGDATABASE", "polaris"),
            connect_timeout=2,
        )
    except Exception:
        return None


def _search_postgres(query: str, limit: int) -> list[dict[str, Any]] | None:
    global _pg_ok, _mode
    conn = _pg_connect()
    if conn is None:
        _pg_ok = False
        return None
    vec = hashed_embed(query)
    vec_lit = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
    hits: list[dict[str, Any]] = []
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT heading, content, COALESCE(metadata->>'source', doc_id),
                           1 - (embedding <=> %s::vector) AS sim
                    FROM knowledge_chunks
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_lit, vec_lit, limit),
                )
                for heading, content, source, sim in cur.fetchall():
                    hits.append(
                        {
                            "heading": heading or "Knowledge",
                            "content": (content or "")[:900],
                            "source": source or "pgvector",
                            "score": float(sim or 0),
                        }
                    )
                tokens = " ".join(_TOKEN.findall(query.lower())[:12])
                if tokens:
                    cur.execute(
                        """
                        SELECT heading, content, COALESCE(metadata->>'source', doc_id),
                               ts_rank(tsv, websearch_to_tsquery('english', %s)) AS rank
                        FROM knowledge_chunks
                        WHERE tsv @@ websearch_to_tsquery('english', %s)
                        ORDER BY rank DESC
                        LIMIT %s
                        """,
                        (tokens, tokens, limit),
                    )
                    seen = {item["content"][:80] for item in hits}
                    for heading, content, source, rank in cur.fetchall():
                        key = (content or "")[:80]
                        if key in seen:
                            continue
                        hits.append(
                            {
                                "heading": heading or "Knowledge",
                                "content": (content or "")[:900],
                                "source": source or "pgvector",
                                "score": float(rank or 0) + 0.15,
                            }
                        )
        _pg_ok = True
        _mode = "pgvector"
        hits.sort(key=lambda item: item["score"], reverse=True)
        return hits[:limit]
    except Exception as exc:
        print(f"[RAG] postgres search failed: {exc}")
        _pg_ok = False
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _search_local(query: str, limit: int) -> list[dict[str, Any]]:
    if not _local_chunks:
        _load_local()
    q_vec = hashed_embed(query)
    tokens = [tok for tok in _TOKEN.findall(query.lower()) if len(tok) > 2]
    scored: list[dict[str, Any]] = []
    for chunk in _local_chunks:
        lower = f"{chunk['heading']} {chunk['content']}".lower()
        lexical = sum(3 if tok in lower else 0 for tok in tokens)
        sim = _cosine(q_vec, chunk["embedding"])
        score = sim * 4 + lexical
        if "maitri-ii" in query.lower() and "maitri-ii" in lower:
            score += 8
        if score <= 0:
            continue
        scored.append(
            {
                "heading": chunk["heading"],
                "content": chunk["content"][:900],
                "source": chunk["source"],
                "score": score,
            }
        )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:limit]


def retrieve(query: str, limit: int = 5) -> dict[str, Any]:
    if not query.strip():
        if not _local_chunks:
            _load_local()
        top = _local_chunks[:1]
        hits = [
            {
                "heading": item["heading"],
                "content": item["content"][:900],
                "source": item["source"],
                "score": 1,
            }
            for item in top
        ]
        return {"mode": _mode, "hits": hits}

    hits = _search_postgres(query, limit)
    if not hits:
        hits = _search_local(query, limit)
    return {"mode": _mode, "hits": hits}


def format_context(hits: list[dict[str, Any]], limit_chars: int = 3800) -> str:
    parts: list[str] = []
    used = 0
    for hit in hits:
        block = (
            f"[{hit.get('source')}] {hit.get('heading')}\n{hit.get('content')}"
        )
        if used + len(block) > limit_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n\n---\n\n".join(parts)


def status() -> str:
    return _mode


_load_local()
