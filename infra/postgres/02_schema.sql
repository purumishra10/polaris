-- Polaris twin store
-- TimescaleDB: station_telemetry + space_weather hypertables
-- PostGIS: stations, logistics, spatial hazards
-- pgvector: knowledge_chunks for source-tagged RAG
-- pg_trgm: lexical fallback on the same chunks

CREATE TABLE IF NOT EXISTS schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stations (
    station_id     TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    country        TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('INDIAN_STATION', 'PROXY_NEIGHBOUR', 'GATEWAY')),
    region         TEXT,
    lat            DOUBLE PRECISION NOT NULL,
    lon            DOUBLE PRECISION NOT NULL,
    elevation_m    DOUBLE PRECISION,
    icao_code      TEXT,
    neighbour_of   TEXT REFERENCES stations(station_id),
    geom           GEOMETRY(Point, 4326),
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS source_catalog (
    source_type          TEXT PRIMARY KEY,
    provenance_tag       TEXT NOT NULL CHECK (
        provenance_tag IN ('MEASURED', 'REANALYSIS', 'FORECAST', 'SYNTHETIC', 'ANALOG', 'PROXY', 'RULE', 'OPERATOR')
    ),
    confidence_default   REAL NOT NULL CHECK (confidence_default BETWEEN 0 AND 1),
    description          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS station_telemetry (
    time              TIMESTAMPTZ NOT NULL,
    station_id        TEXT NOT NULL REFERENCES stations(station_id),
    parameter         TEXT NOT NULL,
    value             DOUBLE PRECISION NOT NULL,
    unit              TEXT NOT NULL,
    source_type       TEXT NOT NULL REFERENCES source_catalog(source_type),
    cadence           TEXT NOT NULL CHECK (cadence IN ('HOURLY', 'DAILY', 'MINUTE')),
    confidence_score  REAL NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    quality_flag      SMALLINT NOT NULL DEFAULT 0
);

SELECT create_hypertable(
    'station_telemetry',
    'time',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS station_telemetry_uniq
    ON station_telemetry (station_id, parameter, source_type, time);
CREATE INDEX IF NOT EXISTS station_telemetry_param_time
    ON station_telemetry (parameter, time DESC);
CREATE INDEX IF NOT EXISTS station_telemetry_station_time
    ON station_telemetry (station_id, time DESC);

CREATE TABLE IF NOT EXISTS space_weather (
    time         TIMESTAMPTZ NOT NULL,
    parameter    TEXT NOT NULL,
    value        DOUBLE PRECISION,
    value_text   TEXT,
    unit         TEXT,
    source_type  TEXT NOT NULL REFERENCES source_catalog(source_type)
);

SELECT create_hypertable(
    'space_weather',
    'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS space_weather_uniq
    ON space_weather (parameter, source_type, time);

CREATE TABLE IF NOT EXISTS occupancy_profiles (
    profile_id         TEXT PRIMARY KEY,
    station_id         TEXT NOT NULL REFERENCES stations(station_id),
    scenario           TEXT NOT NULL,
    winter_headcount   INTEGER NOT NULL,
    summer_headcount   INTEGER NOT NULL,
    winter_start_month SMALLINT NOT NULL DEFAULT 3,
    winter_end_month   SMALLINT NOT NULL DEFAULT 10,
    source             TEXT,
    notes              TEXT
);

CREATE TABLE IF NOT EXISTS polar_calendar (
    calendar_id    TEXT PRIMARY KEY,
    station_id     TEXT NOT NULL REFERENCES stations(station_id),
    season_label   TEXT NOT NULL,
    event_type     TEXT NOT NULL CHECK (event_type IN ('POLAR_DAY', 'POLAR_NIGHT')),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    duration_days  INTEGER,
    source         TEXT NOT NULL,
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS lockout_rules (
    rule_id         TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    applies_to      TEXT NOT NULL,
    lockout_target  TEXT NOT NULL,
    condition_json  JSONB NOT NULL,
    source          TEXT NOT NULL,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS voyage_windows (
    window_id             TEXT PRIMARY KEY,
    mode                  TEXT NOT NULL CHECK (mode IN ('AIR', 'SEA', 'HELI')),
    station_id            TEXT REFERENCES stations(station_id),
    typical_open          TEXT,
    typical_close         TEXT,
    close_date_nominal    DATE,
    open_date_nominal     DATE,
    notes                 TEXT,
    source                TEXT
);

CREATE TABLE IF NOT EXISTS logistics_nodes (
    node_id   TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    node_type TEXT NOT NULL,
    country   TEXT,
    lat       DOUBLE PRECISION,
    lon       DOUBLE PRECISION,
    geom      GEOMETRY(Point, 4326),
    metadata  JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS logistics_routes (
    route_id            TEXT PRIMARY KEY,
    origin              TEXT NOT NULL REFERENCES logistics_nodes(node_id),
    destination         TEXT NOT NULL REFERENCES logistics_nodes(node_id),
    transport_mode      TEXT NOT NULL,
    duration_hrs        DOUBLE PRECISION,
    duration_range_days INT[],
    season_window       TEXT,
    capacity_pax        INTEGER,
    capacity_cargo_t    DOUBLE PRECISION,
    distance_km         DOUBLE PRECISION,
    constraints         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS hazard_events (
    event_id          TEXT PRIMARY KEY,
    station_id        TEXT NOT NULL REFERENCES stations(station_id),
    event_type        TEXT NOT NULL,
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ,
    duration_hrs      DOUBLE PRECISION,
    severity          TEXT,
    max_metric_value  DOUBLE PRECISION,
    metric_unit       TEXT,
    extra             JSONB NOT NULL DEFAULT '{}'::jsonb,
    description       TEXT,
    source            TEXT
);

CREATE INDEX IF NOT EXISTS hazard_events_station_start
    ON hazard_events (station_id, start_time);

CREATE TABLE IF NOT EXISTS infrastructure_assets (
    asset_id          TEXT PRIMARY KEY,
    station_id        TEXT NOT NULL,
    name              TEXT NOT NULL,
    category          TEXT NOT NULL,
    capacity_val      DOUBLE PRECISION,
    capacity_unit     TEXT,
    operating_status  TEXT,
    geom              GEOMETRY(Geometry, 4326),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS instruments (
    instrument_id  TEXT PRIMARY KEY,
    station_id     TEXT NOT NULL REFERENCES stations(station_id),
    name           TEXT NOT NULL,
    owner          TEXT,
    measures       TEXT NOT NULL,
    lat            DOUBLE PRECISION,
    lon            DOUBLE PRECISION,
    geom           GEOMETRY(Point, 4326),
    source         TEXT
);

CREATE TABLE IF NOT EXISTS spatial_features (
    feature_id    TEXT PRIMARY KEY,
    station_id    TEXT,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    properties    JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom          GEOMETRY(Geometry, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS spatial_features_gix ON spatial_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS stations_gix ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS logistics_nodes_gix ON logistics_nodes USING GIST (geom);

CREATE TABLE IF NOT EXISTS melt_pond_observations (
    obs_id       SERIAL PRIMARY KEY,
    station_id   TEXT NOT NULL REFERENCES stations(station_id),
    observed_on  DATE NOT NULL,
    area_m2      DOUBLE PRECISION,
    depth_m      DOUBLE PRECISION,
    volume_m3    DOUBLE PRECISION,
    air_temp_c   DOUBLE PRECISION,
    bed_temp_c   DOUBLE PRECISION,
    status       TEXT,
    source       TEXT,
    UNIQUE (station_id, observed_on)
);

CREATE TABLE IF NOT EXISTS operator_scenarios (
    scenario_id          TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    missed_last_flight   BOOLEAN NOT NULL DEFAULT FALSE,
    ship_delay_days      INTEGER NOT NULL DEFAULT 0,
    maitri_ii            BOOLEAN NOT NULL DEFAULT FALSE,
    indoor_setpoint_c    REAL NOT NULL DEFAULT 20.0,
    notes                TEXT
);

CREATE TABLE IF NOT EXISTS twin_state_snapshots (
    snapshot_id  BIGSERIAL PRIMARY KEY,
    clock_utc    TIMESTAMPTZ NOT NULL,
    scenario_id  TEXT REFERENCES operator_scenarios(scenario_id),
    state        JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS twin_state_clock_idx
    ON twin_state_snapshots (clock_utc DESC);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    doc_id       TEXT PRIMARY KEY,
    collection   TEXT NOT NULL,
    title        TEXT NOT NULL,
    source_path  TEXT NOT NULL,
    provenance   TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    chunk_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id       TEXT NOT NULL REFERENCES knowledge_documents(doc_id) ON DELETE CASCADE,
    chunk_index  INTEGER NOT NULL,
    heading      TEXT,
    content      TEXT NOT NULL,
    tsv          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading, '') || ' ' || content)) STORED,
    embedding    VECTOR(384),
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_trgm
    ON knowledge_chunks USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv
    ON knowledge_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS knowledge_chunks_hnsw
    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

DROP MATERIALIZED VIEW IF EXISTS telemetry_daily;
CREATE MATERIALIZED VIEW telemetry_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    station_id,
    parameter,
    source_type,
    avg(value) AS avg_value,
    max(value) AS max_value,
    min(value) AS min_value,
    count(*)   AS n
FROM station_telemetry
GROUP BY 1, 2, 3, 4
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'telemetry_daily',
    start_offset => INTERVAL '3 years',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

INSERT INTO schema_meta(key, value) VALUES
    ('schema_version', '1.0.0'),
    ('engine', 'postgresql+timescaledb+postgis+pgvector'),
    ('embed_dim', '384')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
