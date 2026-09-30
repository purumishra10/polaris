"""Quick retrieval check: does the top hit's snippet contain the expected fact?"""

import time

import knowledge
import rag

CASES = [
    ("how many containers at bharati", "134"),
    ("how many people live at bharati in winter", "47"),
    ("what is the maitri-ii power plant capacity", "750"),
    ("how far apart are the stations", "3098"),
    ("when did bharati open", "2012"),
    ("coldest temperature at bharati", "29.8"),
    ("what vehicles does maitri have", "pisten"),
    ("how much fuel does maitri-ii store", "600,000"),
    ("how many people at maitri in winter", "25"),
    ("what is the design wind speed at maitri", "200"),
    ("when did maitri open", "1989"),
    ("what communications does maitri have", "satellite"),
    ("what is the wind limit for helicopter ops", "40"),
    ("how does the nowcast blend the models", "65"),
]

if __name__ == "__main__":
    ok = 0
    t0 = time.perf_counter()
    for q, expect in CASES:
        hits = knowledge.retrieve(q, limit=3)["hits"]
        top = " ".join((h.get("snippet") or h.get("content") or "") for h in hits[:3]).lower()
        hit = expect.lower() in top
        ok += hit
        head = hits[0]["heading"][:48] if hits else "-"
        print(f"{'OK ' if hit else 'MISS'} {q!r:52} -> {head}")
    ms = (time.perf_counter() - t0) * 1000 / len(CASES)
    print(f"\n{ok}/{len(CASES)} top-3 snippets contain the fact · {ms:.1f} ms/query · {rag.stats()}")
