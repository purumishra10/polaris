"""Historical replay snapshots held on the edge physics clock."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
REPLAY_DIR = ROOT / "datasets" / "replays"

SNAPSHOTS = {
    "REPLAY_2018_08_05": REPLAY_DIR / "2018-08-05.json",
}


def load_snapshot(scenario_id: str) -> dict[str, Any]:
    path = SNAPSHOTS.get(scenario_id)
    if path is None or not path.exists():
        raise FileNotFoundError(f"Unknown replay snapshot: {scenario_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def station_block(snapshot: dict[str, Any], station_id: str) -> dict[str, Any]:
    stations = snapshot.get("stations") or {}
    block = stations.get(station_id)
    if not block:
        raise KeyError(f"Replay snapshot has no station {station_id}")
    return block


def replay_payload(snapshot: Optional[dict[str, Any]], station_id: str) -> dict[str, Any]:
    if not snapshot:
        return {
            "active": False,
            "scenario_id": None,
            "clock": None,
            "citation": None,
            "source_type": None,
            "occupancy": None,
            "note": None,
        }
    block = station_block(snapshot, station_id)
    return {
        "active": True,
        "scenario_id": snapshot.get("scenario_id"),
        "clock": snapshot.get("clock"),
        "citation": snapshot.get("citation"),
        "source_type": snapshot.get("source_type"),
        "occupancy": block.get("occupancy"),
        "note": snapshot.get("note"),
    }


def lockouts_payload(snapshot: Optional[dict[str, Any]], station_id: str) -> dict[str, Any]:
    if not snapshot:
        return {
            "outdoor": "OPEN",
            "heli": "OPEN",
            "convoy": "OPEN",
            "field": "OPEN",
            "reasons": [],
        }
    block = station_block(snapshot, station_id)
    lockouts = dict(block.get("lockouts") or {})
    lockouts["reasons"] = list(block.get("reasons") or [])
    return lockouts
