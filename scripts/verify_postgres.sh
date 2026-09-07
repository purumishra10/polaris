#!/usr/bin/env bash
set -euo pipefail
export HOME=/home/abhilash
export PATH="/home/abhilash/.local/share/polaris-pg/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="/home/abhilash/.local/share/polaris-pg/lib"
psql -h 127.0.0.1 -U polaris -d polaris -v ON_ERROR_STOP=1 <<'SQL'
SELECT extname, extversion FROM pg_extension ORDER BY 1;
SELECT hypertable_name, num_chunks
FROM timescaledb_information.hypertables;
CALL refresh_continuous_aggregate('telemetry_daily', NULL, NULL);
SELECT count(*) AS daily_buckets FROM telemetry_daily;
SELECT count(*) FROM station_telemetry;
SQL
