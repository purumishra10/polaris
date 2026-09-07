#!/usr/bin/env bash
set -euo pipefail
export HOME="${HOME:-/home/abhilash}"
PREFIX="${POLARIS_PG_PREFIX:-$HOME/.local/share/polaris-pg}"
PGDATA="${POLARIS_PGDATA:-$HOME/.local/share/polaris-pgdata}"
PORT="${POLARIS_PGPORT:-5432}"
export PATH="$PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$PREFIX/lib:${LD_LIBRARY_PATH:-}"
if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "Postgres already running on :$PORT"
  exit 0
fi
pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-p $PORT" start
echo "Postgres started on 127.0.0.1:$PORT"
