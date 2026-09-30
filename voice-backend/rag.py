"""Retrieve station knowledge for the ops agent.

Tries pgvector (same hashed embeddings as scripts/ingest_polaris_db.py) when it
is reachable. Otherwise ranks local markdown with BM25 + hashed-embedding
fusion, station/number-aware boosts, and returns a focused snippet per hit so
the LLM sees the sentence that actually answers the question.
"""

from __future__ import annotations

import hashlib
import math
import os
import re
import time
from collections import Counter
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
    ("DEMO_SCRIPT.md", "demo_script"),
]

_STOP = set(
    """a an the of to in on at for and or but is are was were be been being it its this that these those
    what whats which who whom how many much does do did can could would should will shall may might tell me
    about please give show explain there their them they we our you your i my with from by as into than then
    so if any all some more most very just also has have had not no yes up out over under between per
    when where why station stations""".split()
)

# Domain synonyms so spoken phrasing reaches the written vocabulary.
_EXPANSIONS: dict[str, tuple[str, ...]] = {
    "container": ("iso", "module", "shipping"),
    "people": ("occupancy", "crew", "beds", "winter", "complement"),
    "crew": ("occupancy", "people", "complement"),
    "staff": ("occupancy", "crew"),
    "person": ("occupancy",),
    "power": ("kva", "chp", "generator", "microgrid"),
    "generator": ("chp", "kva", "power"),
    "electricity": ("kva", "chp", "power"),
    "fuel": ("jet", "a-1", "tank", "liter", "diesel", "autonomy"),
    "diesel": ("fuel", "jet"),
    "wind": ("gust", "knot", "kn", "katabatic", "blizzard"),
    "storm": ("blizzard", "gust", "wind"),
    "blizzard": ("gust", "wind", "storm"),
    "cold": ("temperature", "minimum", "min"),
    "temperature": ("temp", "c", "climate"),
    "comm": ("c-band", "satellite", "link", "radome"),
    "internet": ("satellite", "comm", "link"),
    "ship": ("voyage", "resupply", "vessel", "sea-ice"),
    "helicopter": ("heli", "kamov", "helipad"),
    "heli": ("helicopter", "kamov", "helipad"),
    "far": ("distance", "km"),
    "distance": ("km", "nm"),
    "old": ("since", "year-round", "built", "opened"),
    "built": ("since", "opened", "designed", "year-round"),
    "location": ("coordinate", "lat", "hills", "oasis"),
    "where": ("coordinate", "hills", "oasis", "location"),
    "vehicle": ("pisten", "bully", "scooter", "fleet"),
    "water": ("ro", "melt", "pond", "osmosis"),
    "apart": ("distance", "km"),
    "open": ("since", "year-round", "commissioned"),
    "when": ("since", "year"),
    "coldest": ("lowest", "minimum", "min"),
    "hottest": ("highest", "maximum", "max"),
    "warmest": ("highest", "maximum", "max"),
    "design": ("envelope", "designed", "max"),
    "model": ("lstm", "rf", "random", "forest", "nowcast"),
    "sop": ("rule", "critical", "advisory", "threshold"),
}

_STATIONS = ("bharati", "maitri")

_local_chunks: list[dict[str, Any]] = []
_extra_docs: list[tuple[str, str, str]] = []
_df: Counter = Counter()
_avg_len = 1.0
_pg_ok: bool | None = None
_pg_retry_at = 0.0
_PG_BACKOFF_S = 300.0
_PG_DISABLED = os.getenv("POLARIS_RAG_PG", "1").strip() in {"0", "false", "off"}
_mode = "unloaded"


def _stem(tok: str) -> str:
    if len(tok) <= 3 or tok[0].isdigit():
        return tok
    if tok.endswith("ies") and len(tok) > 4:
        tok = tok[:-3] + "y"
    elif tok.endswith(("sses", "xes", "zes", "ches", "shes")):
        tok = tok[:-2]
    elif tok.endswith("s") and not tok.endswith(("ss", "us", "is")):
        tok = tok[:-1]
    if tok.endswith("ing") and len(tok) >= 7:
        tok = tok[:-3]
    elif tok.endswith("ed") and len(tok) >= 6:
        tok = tok[:-2]
    return tok


def _terms(text: str) -> list[str]:
    return [_stem(t) for t in _TOKEN.findall(text.lower()) if t not in _STOP]


def hashed_embed(text: str, dim: int = DIM) -> list[float]:
    vec = [0.0] * dim
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        digest = hashlib.md5(tok.encode("utf-8")).hexdigest()
        vec[int(digest, 16) % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    if norm:
        vec = [v / norm for v in vec]
    return vec


def _embed_local(text: str, dim: int = DIM) -> list[float]:
    """Stemmed unigram + bigram hashing; only used for the local index."""
    terms = _terms(text)
    vec = [0.0] * dim
    for gram in terms + [f"{a}_{b}" for a, b in zip(terms, terms[1:])]:
        vec[int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16) % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm else vec


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _clean_md(text: str) -> str:
    text = re.sub(r"```.*?```", lambda m: m.group(0).strip("`"), text, flags=re.S)
    text = re.sub(r"\*\*|__|`", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text


def _chunk_markdown(text: str, source: str, max_chars: int = 760) -> list[dict[str, Any]]:
    """Heading-path chunks built from paragraph/table blocks with 1-block overlap."""
    out: list[dict[str, Any]] = []
    path: list[str] = []
    blocks: list[str] = []

    def flush() -> None:
        if not blocks:
            return
        heading = " > ".join(path[-2:]) or "Notes"
        buf: list[str] = []
        size = 0
        for block in blocks:
            pieces = [block]
            if len(block) > max_chars:
                pieces = [ln for ln in block.split("\n") if ln.strip()]
            for piece in pieces:
                if size + len(piece) > max_chars and buf:
                    _emit(out, heading, "\n".join(buf), source)
                    buf = buf[-1:] if len(buf[-1]) < max_chars // 3 else []
                    size = sum(len(b) for b in buf)
                buf.append(piece)
                size += len(piece)
        if buf:
            _emit(out, heading, "\n".join(buf), source)
        blocks.clear()

    para: list[str] = []
    for line in _clean_md(text).splitlines():
        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            if para:
                blocks.append("\n".join(para).strip())
                para = []
            flush()
            level = len(m.group(1))
            path[:] = path[: level - 1] + [m.group(2).strip()[:90]]
            continue
        if not line.strip():
            if para:
                blocks.append("\n".join(para).strip())
                para = []
            continue
        if re.match(r"^\|?\s*-{3,}", line.strip()):
            continue
        para.append(line.rstrip())
    if para:
        blocks.append("\n".join(para).strip())
    flush()
    return out


def _emit(out: list[dict[str, Any]], heading: str, body: str, source: str) -> None:
    body = body.strip()
    if len(body) < 40:
        return
    terms = _terms(f"{heading} {heading} {body}")
    out.append(
        {
            "heading": heading,
            "content": body,
            "source": source,
            "terms": Counter(terms),
            "length": len(terms),
            "lower": f"{heading}\n{body}".lower(),
            "embedding": _embed_local(f"{heading}\n{body}"),
        }
    )


def add_document(text: str, source: str, heading: str = "") -> None:
    """Register an in-code document (e.g. the ops digest) for local search."""
    _extra_docs.append((text, source, heading))
    if _local_chunks:
        _load_local()


def _load_local() -> None:
    global _local_chunks, _mode, _df, _avg_len
    chunks: list[dict[str, Any]] = []
    for rel, label in _DOC_FILES:
        path = ROOT / rel
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        chunks.extend(_chunk_markdown(raw, f"{label}:{rel}"))
    for text, source, heading in _extra_docs:
        md = f"# {heading}\n\n{text}" if heading else text
        chunks.extend(_chunk_markdown(md, source, max_chars=300))
    df: Counter = Counter()
    for chunk in chunks:
        df.update(chunk["terms"].keys())
    _df = df
    _avg_len = sum(c["length"] for c in chunks) / max(1, len(chunks))
    _local_chunks = chunks
    if _mode != "pgvector":
        _mode = "local-bm25"


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
            connect_timeout=1,
        )
    except Exception:
        return None


def _search_postgres(query: str, limit: int) -> list[dict[str, Any]] | None:
    global _pg_ok, _mode, _pg_retry_at
    # A refused localhost connect costs ~2 s on Windows; don't pay it per query.
    if _PG_DISABLED or (_pg_ok is False and time.monotonic() < _pg_retry_at):
        return None
    conn = _pg_connect()
    if conn is None:
        _pg_ok = False
        _pg_retry_at = time.monotonic() + _PG_BACKOFF_S
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
        for hit in hits:
            hit["snippet"] = _focus(hit["content"], _terms(query))
        return hits[:limit]
    except Exception as exc:
        print(f"[RAG] postgres search failed: {exc}")
        _pg_ok = False
        _pg_retry_at = time.monotonic() + _PG_BACKOFF_S
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _expand(terms: list[str]) -> dict[str, float]:
    weights: dict[str, float] = {}
    for term in terms:
        weights[term] = max(weights.get(term, 0), 1.0)
        for syn in _EXPANSIONS.get(term, ()):
            s = _stem(syn)
            weights[s] = max(weights.get(s, 0), 0.45)
    return weights


def _bm25(chunk: dict[str, Any], weights: dict[str, float], n_docs: int) -> float:
    k1, b = 1.4, 0.72
    tf = chunk["terms"]
    norm = k1 * (1 - b + b * chunk["length"] / _avg_len)
    score = 0.0
    for term, w in weights.items():
        f = tf.get(term)
        if not f:
            continue
        df = _df.get(term, 0)
        idf = math.log(1 + (n_docs - df + 0.5) / (df + 0.5))
        score += w * idf * (f * (k1 + 1)) / (f + norm)
    return score


def _idf(term: str) -> float:
    n = max(1, len(_local_chunks))
    df = _df.get(term, 0)
    return math.log(1 + (n - df + 0.5) / (df + 0.5))


def _focus(content: str, q_terms: list[str], width: int = 460, counting: bool = False) -> str:
    """Densest window of sentences/rows around the query terms (rare terms weigh more)."""
    units = [u.strip() for u in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])|\n", content) if u.strip()]
    if not units:
        return content[:width]
    wanted = {t: _idf(t) for t in q_terms}
    for t in list(wanted):
        for syn in _EXPANSIONS.get(t, ()):
            wanted.setdefault(_stem(syn), _idf(_stem(syn)) * 0.5)

    def unit_score(u: str) -> float:
        terms = set(_terms(u))
        s = sum(w for t, w in wanted.items() if t in terms)
        if counting and s and re.search(r"\d", u):
            s *= 1.4
        return s

    scores = [unit_score(u) for u in units]
    best = max(range(len(units)), key=lambda i: (scores[i], -i))
    # Best unit leads so downstream truncation can never drop the answer line.
    picked = [best]
    size = len(units[best])
    for i in sorted(range(len(units)), key=lambda j: (-scores[j], abs(j - best))):
        if i == best or scores[i] <= 0 or size >= width:
            continue
        picked.append(i)
        size += len(units[i])
    rest = sorted(picked[1:])
    for i in range(best + 1, len(units)):
        if size >= width:
            break
        if i not in picked:
            rest.append(i)
            size += len(units[i])
    return " ".join([units[best]] + [units[i] for i in sorted(set(rest))])[: width + 120]


def _search_local(query: str, limit: int) -> list[dict[str, Any]]:
    if not _local_chunks:
        _load_local()
    lowered = query.lower()
    q_terms = _terms(query)
    if not q_terms:
        return []
    weights = _expand(q_terms)
    for cue, extra in (
        (r"\bwhen\b", ("since", "year", "established")),
        (r"\bwhere\b", ("coordinate", "hills", "oasis", "inland", "coastal")),
    ):
        if re.search(cue, lowered):
            for syn in extra:
                weights.setdefault(_stem(syn), 0.5)
    n_docs = len(_local_chunks)
    q_vec = _embed_local(query)
    counting = bool(re.search(r"how many|how much|number of|count|capacity|size", lowered))
    named = [s for s in _STATIONS if s in lowered]
    maitri2 = bool(re.search(r"maitri[- ]?(?:ii|2)\b", lowered))

    lex_rank: list[tuple[float, int]] = []
    vec_rank: list[tuple[float, int]] = []
    for i, chunk in enumerate(_local_chunks):
        lex = _bm25(chunk, weights, n_docs)
        text = chunk["lower"]
        if named:
            has = [s for s in named if s in text]
            other = [s for s in _STATIONS if s not in named and s in text]
            lex *= 1.35 if has else 0.7
            if other and not has:
                lex *= 0.6
        if maitri2:
            lex *= 1.5 if re.search(r"maitri[- ]?ii", text) else 0.8
        if counting:
            content_terms = [t for t in q_terms if t not in _STATIONS]
            if any(
                re.search(rf"\d[\d,.]*\s*(?:[x×]\s*)?(?:\S+\s+){{0,3}}{re.escape(t)}", text)
                for t in content_terms
            ):
                lex *= 1.6
        if re.search(r"select |│|├|\binteger pk\b", text):
            lex *= 0.55
        if chunk["source"].startswith("fact-card"):
            lex *= 1.3
        elif chunk["source"].startswith("demo_script"):
            lex *= 0.6
        elif chunk["source"].startswith("data_dictionary"):
            lex *= 0.8
        lex_rank.append((lex, i))
        vec_rank.append((_cosine(q_vec, chunk["embedding"]), i))

    lex_rank.sort(reverse=True)
    vec_rank.sort(reverse=True)
    fused: dict[int, float] = {}
    for rank, (score, i) in enumerate(lex_rank[:40]):
        if score > 0:
            fused[i] = fused.get(i, 0) + 1.0 / (30 + rank) * 1.6
    for rank, (score, i) in enumerate(vec_rank[:40]):
        if score > 0.05:
            fused[i] = fused.get(i, 0) + 1.0 / (30 + rank)

    top_lex = lex_rank[0][0] if lex_rank else 0.0
    lex_by_id = {i: s for s, i in lex_rank}
    ordered = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)
    out: list[dict[str, Any]] = []
    per_heading: Counter = Counter()
    for i, fscore in ordered:
        chunk = _local_chunks[i]
        key = (chunk["source"], chunk["heading"])
        if per_heading[key] >= 2:
            continue
        per_heading[key] += 1
        confidence = lex_by_id.get(i, 0) / top_lex if top_lex else 0.0
        out.append(
            {
                "heading": chunk["heading"],
                "content": chunk["content"][:900],
                "snippet": _focus(chunk["content"], q_terms, counting=counting),
                "source": chunk["source"],
                "score": round(fscore * 100, 3),
                "confidence": round(confidence, 2),
            }
        )
        if len(out) >= limit:
            break
    return out


def retrieve(query: str, limit: int = 5) -> dict[str, Any]:
    if not _local_chunks:
        _load_local()
    if not query.strip():
        hits = [
            {
                "heading": item["heading"],
                "content": item["content"][:900],
                "snippet": item["content"][:460],
                "source": item["source"],
                "score": 1,
            }
            for item in _local_chunks[:1]
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
            f"[{hit.get('source')}] {hit.get('heading')}\n{hit.get('snippet') or hit.get('content')}"
        )
        if used + len(block) > limit_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n\n---\n\n".join(parts)


def status() -> str:
    return _mode


def stats() -> dict[str, Any]:
    return {
        "mode": _mode,
        "chunks": len(_local_chunks),
        "vocabulary": len(_df),
        "sources": sorted({c["source"] for c in _local_chunks}),
        "pgvector": {True: "up", False: "down (backoff)", None: "untried"}[_pg_ok],
    }


_load_local()

if not _PG_DISABLED:
    import threading

    threading.Thread(target=lambda: _search_postgres("warmup", 1), daemon=True).start()
