#!/usr/bin/env bash
set -euo pipefail
export HOME=/home/abhilash
export PATH="/home/abhilash/.local/share/polaris-pg/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="/home/abhilash/.local/share/polaris-pg/lib"
exec python /mnt/c/projects/polaris/scripts/ingest_polaris_db.py
