-- Runtime store: what the twin computes and keeps (not raw landing data).

CREATE TABLE IF NOT EXISTS computed_lockouts (
    clock_utc     TIMESTAMPTZ NOT NULL,
    station_id    TEXT NOT NULL REFERENCES stations(station_id),
    scenario_id   TEXT NOT NULL REFERENCES operator_scenarios(scenario_id),
    outdoor       TEXT NOT NULL CHECK (outdoor IN ('OPEN', 'LIMITED', 'LOCKED')),
    heli          TEXT NOT NULL CHECK (heli IN ('OPEN', 'LOCKED')),
    convoy        TEXT NOT NULL CHECK (convoy IN ('OPEN', 'CAUTION', 'LOCKED')),
    field         TEXT NOT NULL CHECK (field IN ('OPEN', 'RESTRICTED', 'LOCKED')),
    isro_hf       TEXT NOT NULL CHECK (isro_hf IN ('OK', 'DEGRADED')),
    reasons       JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (clock_utc, station_id, scenario_id)
);

CREATE TABLE IF NOT EXISTS fuel_day_estimates (
    clock_utc      TIMESTAMPTZ NOT NULL,
    station_id     TEXT NOT NULL REFERENCES stations(station_id),
    scenario_id    TEXT NOT NULL REFERENCES operator_scenarios(scenario_id),
    occupancy      INTEGER NOT NULL,
    fuel_days      REAL,
    tank_fraction  REAL,
    polar_night    BOOLEAN NOT NULL,
    provenance     TEXT NOT NULL DEFAULT 'SYNTHETIC',
    notes          TEXT,
    PRIMARY KEY (clock_utc, station_id, scenario_id)
);

CREATE TABLE IF NOT EXISTS lockout_backtests (
    event_id        TEXT PRIMARY KEY REFERENCES hazard_events(event_id),
    imd_start       TIMESTAMPTZ NOT NULL,
    rule_lock_time  TIMESTAMPTZ,
    lead_hours      REAL,
    hit_miss        TEXT NOT NULL CHECK (hit_miss IN ('HIT', 'MISS', 'NO_HOURLY')),
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS computed_lockouts_clock_idx
    ON computed_lockouts (clock_utc DESC);
CREATE INDEX IF NOT EXISTS fuel_day_estimates_clock_idx
    ON fuel_day_estimates (clock_utc DESC);

INSERT INTO schema_meta(key, value) VALUES
    ('schema_version', '1.1.0'),
    ('runtime_store', 'computed_lockouts,fuel_day_estimates,lockout_backtests,twin_state_snapshots')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
