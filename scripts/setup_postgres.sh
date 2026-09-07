#!/usr/bin/env bash
# Install and start Polaris Postgres in WSL user space (no Docker, no sudo).
# TimescaleDB is built from source against conda PostgreSQL 16.
set -euo pipefail
export HOME="${HOME:-/home/abhilash}"
PREFIX="${POLARIS_PG_PREFIX:-$HOME/.local/share/polaris-pg}"
PGDATA="${POLARIS_PGDATA:-$HOME/.local/share/polaris-pgdata}"
TS_SRC="${POLARIS_TS_SRC:-$HOME/.local/src/timescaledb}"
CONDA_SH="${HOME}/miniconda3/etc/profile.d/conda.sh"
PORT="${POLARIS_PGPORT:-5432}"
DB_NAME="${POLARIS_PGDATABASE:-polaris}"
DB_USER="${POLARIS_PGUSER:-polaris}"
DB_PASS="${POLARIS_PGPASSWORD:-polaris}"

if [[ ! -f "$CONDA_SH" ]]; then
  echo "Miniconda not found at $CONDA_SH" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONDA_SH"

if [[ ! -x "$PREFIX/bin/postgres" ]]; then
  echo "==> Creating conda env with PostgreSQL 16, PostGIS, pgvector"
  conda create -y -p "$PREFIX" -c conda-forge \
    python=3.11 \
    postgresql=16 \
    postgis \
    pgvector \
    psycopg2 \
    numpy \
    cmake \
    ninja \
    make \
    gcc_linux-64 \
    gxx_linux-64 \
    binutils \
    pkg-config \
    git \
    openssl
fi

export PATH="$PREFIX/bin:$PATH"
export LD_LIBRARY_PATH="$PREFIX/lib:${LD_LIBRARY_PATH:-}"
hash -r
PG_CONFIG="$PREFIX/bin/pg_config"
if [[ ! -x "$PG_CONFIG" ]]; then
  echo "pg_config missing in $PREFIX" >&2
  exit 1
fi

TS_SO="$("$PG_CONFIG" --pkglibdir)/timescaledb.so"
if [[ ! -f "$TS_SO" ]]; then
  echo "==> Building TimescaleDB from source into conda PostgreSQL"
  mkdir -p "$(dirname "$TS_SRC")"
  if [[ ! -d "$TS_SRC/.git" ]]; then
    git clone --depth 1 --branch 2.21.2 https://github.com/timescale/timescaledb.git "$TS_SRC" \
      || git clone --depth 1 https://github.com/timescale/timescaledb.git "$TS_SRC"
  fi
  rm -rf "$TS_SRC/build"
  cmake -S "$TS_SRC" -B "$TS_SRC/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DPG_CONFIG="$PG_CONFIG" \
    -DREGRESS_CHECKS=OFF \
    -DWARNINGS_AS_ERRORS=OFF \
    -DSEND_TELEMETRY_DEFAULT=OFF
  cmake --build "$TS_SRC/build" --parallel "$(nproc)"
  cmake --install "$TS_SRC/build"
fi

mkdir -p "$PGDATA"
if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  echo "==> initdb"
  initdb -D "$PGDATA" --auth=trust --username="$DB_USER" --encoding=UTF8 --locale=C
fi

CONF="$PGDATA/postgresql.conf"
HBA="$PGDATA/pg_hba.conf"

python - "$CONF" "$PORT" <<'PY'
from pathlib import Path
import sys
conf = Path(sys.argv[1])
port = sys.argv[2]
text = conf.read_text(encoding="utf-8")
replacements = {
    "listen_addresses": "listen_addresses = '*'",
    "port": f"port = {port}",
    "shared_preload_libraries": "shared_preload_libraries = 'timescaledb'",
    "max_locks_per_transaction": "max_locks_per_transaction = 256",
}
lines = []
seen = set()
for line in text.splitlines():
    key = line.lstrip("# ").split("=", 1)[0].strip() if "=" in line else ""
    if key in replacements and key not in seen:
        lines.append(replacements[key])
        seen.add(key)
    else:
        lines.append(line)
for key, val in replacements.items():
    if key not in seen:
        lines.append(val)
conf.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

cat > "$HBA" <<EOF
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF

if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "==> Postgres already running"
else
  echo "==> Starting Postgres on :$PORT"
  pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -o "-p $PORT" start
fi

if ! psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' SUPERUSER;"
fi
psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -c "ALTER ROLE ${DB_USER} WITH LOGIN SUPERUSER PASSWORD '${DB_PASS}';"

if psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "==> Recreating database ${DB_NAME}"
  psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"
  dropdb -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$DB_NAME"
fi
createdb -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$DB_NAME"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Windows checkout via WSL
if [[ ! -d "$REPO/infra/postgres" ]]; then
  REPO="/mnt/c/projects/polaris"
fi

psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$REPO/infra/postgres/01_extensions.sql"
psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$REPO/infra/postgres/02_schema.sql"

echo "==> Extensions:"
psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
echo "Postgres is up at 127.0.0.1:${PORT} db=${DB_NAME} user=${DB_USER}"
