"""SQLite ring buffer for telemetry samples and the operator incident log.

Stdlib sqlite only. Supabase stays on the SOP citation path in sop.py.
The file lives in twin-backend/data/ and is gitignored.
"""
from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).resolve().parent / "data" / "polaris_ops.sqlite"
_SAMPLE_CAP = 2000
_DANGER_DAYS = 15.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def project_fuel(autonomy_days: float, horizon_hours: int = 24) -> dict[str, Any]:
    """Constant-burn projection. One day of autonomy is spent per 24 h."""
    days = max(0.0, float(autonomy_days))
    curve = []
    for hour in range(0, horizon_hours + 1, 4):
        curve.append(
            {
                "hour": hour,
                "autonomy_days": round(max(0.0, days - hour / 24.0), 2),
            }
        )
    ahead = max(0.0, days - horizon_hours / 24.0)
    hours_to_floor = None
    if days > _DANGER_DAYS:
        hours_to_floor = round((days - _DANGER_DAYS) * 24.0, 1)
    return {
        "horizon_hours": horizon_hours,
        "autonomy_now": round(days, 2),
        "autonomy_ahead": round(ahead, 2),
        "danger_floor_days": _DANGER_DAYS,
        "inside_danger_floor": days <= _DANGER_DAYS,
        "hours_to_15_day_floor": hours_to_floor,
        "curve": curve,
    }


class HistoryStore:
    def __init__(self, path: Path = _DB_PATH) -> None:
        self._lock = threading.RLock()
        self._sig: dict[str, tuple[str, str | None]] = {}
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._writes = 0
        self._init()

    def _init(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id TEXT NOT NULL,
                recorded_at TEXT NOT NULL,
                severity TEXT,
                scenario_id TEXT,
                wind_kt REAL,
                ambient_c REAL,
                internal_c REAL,
                load_kva REAL,
                essential_kva REAL,
                science_kva REAL,
                comfort_kva REAL,
                heat_loss_kw REAL,
                chp_kw REAL,
                fuel_l REAL,
                burn_lph REAL,
                autonomy_days REAL,
                anomaly REAL,
                link_health TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_samples_station
                ON samples(station_id, id);
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_at TEXT NOT NULL,
                station_id TEXT,
                actor TEXT NOT NULL,
                kind TEXT NOT NULL,
                message TEXT NOT NULL
            );
            """
        )
        self._conn.commit()

    def record_sample(self, snap: Any) -> None:
        risk = getattr(snap, "risk", None)
        ambient = snap.ambient
        thermal = snap.thermal
        grid = snap.microgrid
        fuel = snap.fuel
        link = snap.link_status
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO samples (
                    station_id, recorded_at, severity, scenario_id,
                    wind_kt, ambient_c, internal_c, load_kva,
                    essential_kva, science_kva, comfort_kva,
                    heat_loss_kw, chp_kw, fuel_l, burn_lph,
                    autonomy_days, anomaly, link_health
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    snap.station_id,
                    _utc_now(),
                    getattr(risk, "severity", "NOMINAL"),
                    snap.scenario_id,
                    ambient.wind_speed_knots,
                    ambient.temp_c,
                    thermal.internal_temp_c,
                    grid.total_load_kva,
                    grid.essential_load_kva,
                    grid.science_load_kva,
                    grid.comfort_load_kva,
                    thermal.heat_loss_kw,
                    thermal.chp_thermal_output_kw,
                    fuel.tank_level_liters,
                    fuel.burn_rate_lph,
                    fuel.days_of_autonomy,
                    getattr(risk, "anomaly_score", 0.0),
                    link.health,
                ),
            )
            self._writes += 1
            if self._writes % 40 == 0:
                self._prune(snap.station_id)
            self._conn.commit()

    def _prune(self, station_id: str) -> None:
        self._conn.execute(
            """
            DELETE FROM samples
            WHERE station_id = ?
              AND id NOT IN (
                SELECT id FROM samples
                WHERE station_id = ?
                ORDER BY id DESC
                LIMIT ?
              )
            """,
            (station_id, station_id, _SAMPLE_CAP),
        )

    def record_event(
        self,
        station_id: str | None,
        actor: str,
        kind: str,
        message: str,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO events (recorded_at, station_id, actor, kind, message)
                VALUES (?, ?, ?, ?, ?)
                """,
                (_utc_now(), station_id, actor, kind, message),
            )
            self._conn.execute(
                """
                DELETE FROM events
                WHERE id NOT IN (
                    SELECT id FROM events ORDER BY id DESC LIMIT 400
                )
                """
            )
            self._conn.commit()

    def observe(self, snap: Any, restored: bool = False) -> None:
        """Write one sample and emit severity / scenario transitions."""
        try:
            self.record_sample(snap)
        except Exception:
            return
        station = str(snap.station_id)
        severity = str(getattr(snap.risk, "severity", "NOMINAL"))
        scenario = snap.scenario_id
        prev = self._sig.get(station)
        if prev is None:
            self.record_event(station, "SYSTEM", "LINK", f"{station} telemetry online")
        else:
            if restored:
                self.record_event(station, "SYSTEM", "LINK", "Edge link restored")
            if prev[0] != severity:
                self.record_event(
                    station,
                    "SYSTEM",
                    "SEVERITY",
                    f"Severity {prev[0]} → {severity}",
                )
            if prev[1] != scenario:
                if scenario:
                    self.record_event(
                        station,
                        "SYSTEM",
                        "SCENARIO",
                        f"{scenario} injected",
                    )
                elif prev[1]:
                    self.record_event(
                        station,
                        "SYSTEM",
                        "SCENARIO",
                        f"{prev[1]} cleared",
                    )
        self._sig[station] = (severity, scenario)

    def note_edge_down(self, station_id: str | None) -> None:
        self.record_event(
            station_id,
            "SYSTEM",
            "LINK",
            "Edge unreachable — last good snapshot held",
        )

    def history_payload(self, station_id: str, minutes: int) -> dict[str, Any]:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT * FROM samples
                WHERE station_id = ? AND recorded_at >= ?
                ORDER BY id ASC
                LIMIT 2000
                """,
                (station_id, cutoff),
            ).fetchall()
            if not rows:
                rows = self._conn.execute(
                    """
                    SELECT * FROM samples
                    WHERE station_id = ?
                    ORDER BY id DESC
                    LIMIT 120
                    """,
                    (station_id,),
                ).fetchall()
                rows = list(reversed(rows))
        points = [_point(row) for row in rows]
        latest_days = points[-1]["autonomy_days"] if points else None
        burn = points[-1]["burn_rate_lph"] if points else None
        return {
            "station_id": station_id,
            "minutes": minutes,
            "count": len(points),
            "store": "sqlite",
            "points": points,
            "projection": (
                project_fuel(latest_days) if latest_days is not None else None
            ),
            "burn_rate_lph": burn,
        }

    def recent_events(self, limit: int = 80) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, recorded_at, station_id, actor, kind, message
                FROM events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "recorded_at": row["recorded_at"],
                "station_id": row["station_id"],
                "actor": row["actor"],
                "kind": row["kind"],
                "message": row["message"],
            }
            for row in rows
        ]


def _point(row: sqlite3.Row) -> dict[str, Any]:
    stamp = row["recorded_at"] or ""
    clock = stamp[11:19] if len(stamp) >= 19 else stamp
    return {
        "t": row["id"],
        "timeStr": clock,
        "internal_temp_c": row["internal_c"],
        "ambient_temp_c": row["ambient_c"],
        "total_load_kva": row["load_kva"],
        "essential_load": row["essential_kva"],
        "science_load": row["science_kva"],
        "comfort_load": row["comfort_kva"],
        "heat_loss_kw": row["heat_loss_kw"],
        "chp_thermal_kw": row["chp_kw"],
        "fuel_level_l": row["fuel_l"],
        "burn_rate_lph": row["burn_lph"],
        "wind_knots": row["wind_kt"],
        "autonomy_days": row["autonomy_days"],
        "severity": row["severity"],
    }


history_store = HistoryStore()
