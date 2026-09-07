"""Create runtime tables if needed, write one TwinState, read it back, test GIS/vector."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import numpy as np
import psycopg2
from psycopg2.extras import Json, RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
CLOCK = "2018-08-05 18:00:00+00"


def hashed_embed(text: str, dim: int = 384) -> str:
    vec = np.zeros(dim, dtype=np.float32)
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
    n = float(np.linalg.norm(vec))
    if n:
        vec /= n
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def connect():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    return psycopg2.connect(
        host=os.environ.get("POLARIS_PGHOST", "127.0.0.1"),
        port=os.environ.get("POLARIS_PGPORT", "5432"),
        user=os.environ.get("POLARIS_PGUSER", "polaris"),
        password=os.environ.get("POLARIS_PGPASSWORD", "polaris"),
        dbname=os.environ.get("POLARIS_PGDATABASE", "polaris"),
    )


def main():
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SET TIME ZONE 'UTC'")

    sql = (ROOT / "infra" / "postgres" / "03_runtime_store.sql").read_text(encoding="utf-8")
    cur.execute(sql)
    print("OK created/ensured runtime store tables")

    cur.execute(
        """
        INSERT INTO hazard_events (
            event_id, station_id, event_type, start_time, end_time, duration_hrs,
            severity, max_metric_value, metric_unit, extra, description, source
        ) VALUES (
            'GUST-2018-08-05', 'BHARATI', 'BLIZZARD',
            '2018-08-05 00:00:00+00', '2018-08-06 00:00:00+00', 24,
            'CRITICAL', 80, 'knots',
            '{"note": "IMD annual max gust 80 kn on 5 Aug 2018; demo replay clock"}'::jsonb,
            'Published IMD max gust 80 kn (MAUSAM 37th ISEA). Demo clock for module 4.',
            'IMD_BHARATI'
        )
        ON CONFLICT (event_id) DO NOTHING
        """
    )

    cur.execute(
        """
        SELECT event_id FROM hazard_events
        WHERE station_id = 'BHARATI' AND event_type = 'BLIZZARD'
          AND start_time <= %s AND (end_time IS NULL OR end_time >= %s)
        """,
        (CLOCK, CLOCK),
    )
    active = [r["event_id"] for r in cur.fetchall()]
    bharati_locked = bool(active)

    cur.execute(
        """
        SELECT start_date, end_date FROM polar_calendar
        WHERE station_id = 'BHARATI' AND event_type = 'POLAR_NIGHT'
          AND start_date <= DATE %s AND end_date >= DATE %s
        """,
        (CLOCK[:10], CLOCK[:10]),
    )
    polar_night = cur.fetchone() is not None

    cur.execute(
        "SELECT winter_headcount, summer_headcount FROM occupancy_profiles WHERE profile_id = 'BHARATI_CURRENT'"
    )
    occ = cur.fetchone()
    occupancy = occ["winter_headcount"]  # August is winter

    cur.execute(
        """
        INSERT INTO computed_lockouts (
            clock_utc, station_id, scenario_id, outdoor, heli, convoy, field, isro_hf, reasons
        ) VALUES
        (%s, 'BHARATI', 'REPLAY_2018_08_05', %s, 'LOCKED', 'LOCKED', 'LOCKED', 'OK', %s),
        (%s, 'MAITRI',  'REPLAY_2018_08_05', 'OPEN', 'LOCKED', 'OPEN', 'OPEN', 'OK', %s)
        ON CONFLICT (clock_utc, station_id, scenario_id) DO UPDATE SET
            outdoor = EXCLUDED.outdoor, heli = EXCLUDED.heli, reasons = EXCLUDED.reasons
        """,
        (
            CLOCK,
            "LOCKED" if bharati_locked else "OPEN",
            Json(["IMD 80 kn 5 Aug 2018", "heli off: ship not nearby in August"]),
            CLOCK,
            Json(["heli off: ship not nearby in August", "Bharati blizzard is not Maitri weather"]),
        ),
    )

    cur.execute(
        """
        INSERT INTO fuel_day_estimates (
            clock_utc, station_id, scenario_id, occupancy, fuel_days, tank_fraction,
            polar_night, provenance, notes
        ) VALUES
        (%s, 'BHARATI', 'REPLAY_2018_08_05', %s, 41, 0.55, %s, 'SYNTHETIC',
         'Illustrative CHP-only winter burn. Not a live tank dip.'),
        (%s, 'MAITRI', 'REPLAY_2018_08_05', 25, 90, 0.70, %s, 'SYNTHETIC',
         'Anchored to Maitri-II 600 kL spec, labelled synthetic.')
        ON CONFLICT (clock_utc, station_id, scenario_id) DO UPDATE SET
            fuel_days = EXCLUDED.fuel_days, occupancy = EXCLUDED.occupancy
        """,
        (CLOCK, occupancy, polar_night, CLOCK, polar_night),
    )

    cur.execute("SELECT event_id, start_time FROM hazard_events WHERE event_type = 'BLIZZARD'")
    for ev in cur.fetchall():
        cur.execute(
            """
            INSERT INTO lockout_backtests (event_id, imd_start, rule_lock_time, lead_hours, hit_miss, notes)
            VALUES (%s, %s, NULL, NULL, 'NO_HOURLY',
                    'Open-Meteo landing pack is 2023, not 2018. Rule cannot be scored on hourly gust yet.')
            ON CONFLICT (event_id) DO UPDATE SET hit_miss = EXCLUDED.hit_miss
            """,
            (ev["event_id"], ev["start_time"]),
        )

    state = {
        "clock": CLOCK,
        "scenario": "REPLAY_2018_08_05",
        "bharati": {
            "lockouts": {"outdoor": "LOCKED", "heli": "LOCKED"},
            "fuel_days": 41,
            "occupancy": occupancy,
            "polar_night": polar_night,
            "active_events": active,
        },
        "maitri": {
            "lockouts": {"outdoor": "OPEN", "heli": "LOCKED"},
            "fuel_days": 90,
            "occupancy": 25,
        },
        "voyage": {"sea": "closed", "air": "closed", "heli": "locked", "reason": "August winter isolation"},
        "provenance": ["IMD_BHARATI", "SYNTHETIC_ENGINE", "NCPOR_ADVISORY"],
    }
    cur.execute(
        """
        INSERT INTO twin_state_snapshots (clock_utc, scenario_id, state)
        VALUES (%s, 'REPLAY_2018_08_05', %s)
        """,
        (CLOCK, Json(state)),
    )

    print("\n=== 1. Catalogs (facts we store) ===")
    cur.execute(
        """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
          AND table_name NOT LIKE 'pg_%'
          AND table_name NOT IN ('geography_columns','geometry_columns','spatial_ref_sys')
        ORDER BY 1
        """
    )
    print("tables:", [r["table_name"] for r in cur.fetchall()])

    print("\n=== 2. Clock weather (2023 pack; 2018 uses IMD event) ===")
    cur.execute(
        """
        SELECT parameter, value, unit FROM station_telemetry
        WHERE station_id='BHARATI' AND time='2023-08-05 18:00:00+00'
          AND parameter IN ('AIR_TEMP_2M','WIND_GUST_10M','SOLAR_DNI')
        ORDER BY 1
        """
    )
    for r in cur.fetchall():
        print(f"  2023-08-05 Bharati {r['parameter']}={r['value']} {r['unit']}")

    print("\n=== 3. Stored TwinState (what 3D must read) ===")
    cur.execute(
        """
        SELECT l.station_id, l.outdoor, l.heli, f.occupancy, f.fuel_days, f.polar_night, f.provenance
        FROM computed_lockouts l
        JOIN fuel_day_estimates f USING (clock_utc, station_id, scenario_id)
        WHERE l.clock_utc = %s AND l.scenario_id = 'REPLAY_2018_08_05'
        ORDER BY l.station_id
        """,
        (CLOCK,),
    )
    for r in cur.fetchall():
        print(
            f"  {r['station_id']}: outdoor={r['outdoor']} heli={r['heli']} "
            f"people={r['occupancy']} fuel_days={r['fuel_days']} "
            f"polar_night={r['polar_night']} tag={r['provenance']}"
        )

    cur.execute(
        "SELECT state FROM twin_state_snapshots WHERE clock_utc = %s ORDER BY snapshot_id DESC LIMIT 1",
        (CLOCK,),
    )
    snap = cur.fetchone()["state"]
    print("  snapshot JSON keys:", list(snap.keys()))
    print("  bharati lockouts:", snap["bharati"]["lockouts"])

    print("\n=== 4. PostGIS great-circle vs ship route ===")
    cur.execute(
        """
        SELECT round((ST_Distance(
            (SELECT geom::geography FROM stations WHERE station_id='MAITRI'),
            (SELECT geom::geography FROM stations WHERE station_id='BHARATI')
        )/1000)::numeric, 0) AS geodesic_km
        """
    )
    print(f"  geodesic={cur.fetchone()['geodesic_km']} km (ship route in docs is 3098 km / 1693 NM)")

    print("\n=== 5. pgvector retrieval ===")
    q = hashed_embed("Bharati blizzard outdoor lockout 80 knot gust IMD")
    cur.execute(
        """
        SELECT heading FROM knowledge_chunks
        ORDER BY embedding <=> %s::vector
        LIMIT 3
        """,
        (q,),
    )
    print("  nearest:", [r["heading"] for r in cur.fetchall()])

    print("\n=== 6. Backtest honesty ===")
    cur.execute("SELECT hit_miss, count(*) FROM lockout_backtests GROUP BY 1")
    print("  ", cur.fetchall())

    print("\n=== 7. Isolation windows ===")
    cur.execute(
        "SELECT window_id, mode, station_id, typical_close FROM voyage_windows ORDER BY window_id"
    )
    for r in cur.fetchall():
        print(f"  {r['window_id']}: {r['mode']} {r['station_id']} close={r['typical_close']}")

    print("\nALL CHECKS PASSED")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
