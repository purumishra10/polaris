#!/usr/bin/env bash
set -euo pipefail
export HOME=/home/abhilash
export PATH="/home/abhilash/.local/share/polaris-pg/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="/home/abhilash/.local/share/polaris-pg/lib"
PGDATA="/home/abhilash/.local/share/polaris-pgdata"
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-p 5432" start
  sleep 1
fi
exec python /mnt/c/projects/polaris/scripts/test_polaris_db.py
