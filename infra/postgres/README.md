# Polaris database (no Docker)

One PostgreSQL 16 cluster in WSL user-space. Three extensions, four jobs:

| Extension | Job in Polaris |
|---|---|
| **TimescaleDB** | Hourly/daily telemetry + space weather hypertables, daily continuous aggregate |
| **PostGIS** | Station points, logistics nodes, crevasse/melt-pond polygons |
| **pgvector** | Knowledge chunks (rules, papers, station facts) for source-tagged RAG |
| **pg_trgm** | Lexical fallback on the same chunks |

## Why not the old SQLite pack

`datasets/unified_db/antarctic_digital_twin.db` is a landing dump: weather + 9 blizzards + 6 assets + 7 routes. It cannot do GIS, time-series rollups, or similarity search. It stays as a file snapshot. Runtime is this Postgres.

## Layout

- `infra/postgres/01_extensions.sql` — enable extensions
- `infra/postgres/02_schema.sql` — catalogs, hypertables, GIS, vectors
- `scripts/setup_postgres.sh` — conda Postgres + build Timescale + create DB
- `scripts/start_postgres.sh` — start the cluster
- `scripts/test_polaris_db.py` — create runtime tables, write one TwinState, read it back

## Bring up (WSL Ubuntu, no sudo, no Docker)

From Windows PowerShell:

```
wsl -d Ubuntu -- bash /mnt/c/projects/polaris/scripts/setup_postgres.sh
wsl -d Ubuntu -- bash -lc 'export HOME=/home/abhilash; source ~/.local/share/polaris-pg/etc/profile.d/conda.sh 2>/dev/null; export PATH=$HOME/.local/share/polaris-pg/bin:$PATH; python /mnt/c/projects/polaris/scripts/ingest_polaris_db.py'
```

Connect: `127.0.0.1:5432`  database `polaris`  user `polaris`  password `polaris` (see `.env.example`).

## What the eleven modules read

1. Lockouts — `lockout_rules` + `station_telemetry` gust + `hazard_events`
2. Fuel-days — `occupancy_profiles` + `infrastructure_assets` + polar night
3. Voyage — `logistics_nodes/routes` + `voyage_windows`
4. Replay — clock against `hazard_events` BLZ-2018-08 / BLZ-2018-09
5. Source tags — `source_catalog.provenance_tag`
6. Novo/Progress strip — neighbour stations in `stations` + same telemetry
7. Isolation countdown — `voyage_windows.close_date_nominal`
8. Missed last flight — `operator_scenarios` + occupancy profiles
9. Backtest — IMD events vs hourly gust
10. Polar night — `polar_calendar`
11. ISRO/HF — `space_weather` NOAA R/G/S + Kp + X-ray
