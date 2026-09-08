# Polaris Digital Twin Engine — Dev 2 (port 8000)

HQ / NCPOR intelligence layer. Polls the Antarctica edge mock server (Dev 1, port 8001) over a simulated satellite link, scores each tick with a Scikit-learn Isolation Forest, applies the Antarctic SOP rule matrix, and streams the enriched `StationTelemetry` JSON to the UI.

Spec: `../DEV2_DIGITAL_TWIN_ENGINE_BUILD.md`. This service owns **only** that scope.

## Run

Terminal A — Dev 1 edge (must be up first):

```
cd polaris/station-mock-server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

Terminal B — this service:

```
cd polaris/twin-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python train_isolation_forest.py      # only if artifacts/ is missing
uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend (Dev 3+): `cd polaris/frontend && npm run dev` → `http://localhost:5173`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/telemetry` | Latest enriched payload (503 until first ingest) |
| WS | `/ws/telemetry` | Snapshot on connect, then one JSON object per ~2 s tick |
| POST | `/api/station/controls` | Partial actuator update, proxied to `/edge/controls` |
| POST | `/api/scenario/inject` | `{"scenario_type": "BLIZZARD_80KT" \| "RESUPPLY_DELAY" \| "POLAR_NIGHT", "duration_seconds": 60}` |
| POST | `/api/station/switch/{BHARATI\|MAITRI}` | Switches the edge physics profile |
| GET | `/health` | Twin status: edge reachability, model loaded, client count |

Compatibility aliases for the current frontend client (`GET /telemetry/{id}`, `POST /scenario/inject` with `{station_id, scenario}`) are also served. They are not the team contract.

Interactive docs: `http://127.0.0.1:8000/docs`.

## Enrichment

Edge JSON passes through unchanged; the twin adds two blocks.

- `link_status` — `type: "C-band/LEO"`, `latency_ms` sampled 400–800 per hop, `health: ONLINE`. Becomes `DEGRADED` (800 ms, last good payload) only when the edge times out or errors.
- `risk` — `anomaly_score` is `IsolationForest.decision_function` (positive ≈ inlier, negative ≈ outlier); `severity` and `prescribed_actions` come from `sop.py`:

| Rule | Condition | Severity |
|---|---|---|
| STRUCTURAL | wind > 60 kt | CRITICAL |
| THERMAL | internal temp < 16 °C | CRITICAL |
| FUEL_CRIT | days of autonomy < 15 | CRITICAL |
| FUEL_ADV | 15 ≤ days < 30 | ADVISORY |
| ML_ONLY | IF outlier, no SOP rule fired | ADVISORY |

## Quick checks (curl.exe on Windows)

```
curl.exe http://127.0.0.1:8000/health
curl.exe http://127.0.0.1:8000/api/telemetry
curl.exe -X POST http://127.0.0.1:8000/api/scenario/inject -H "Content-Type: application/json" -d "{\"scenario_type\":\"BLIZZARD_80KT\",\"duration_seconds\":60}"
curl.exe -X POST http://127.0.0.1:8000/api/station/controls -H "Content-Type: application/json" -d "{\"hatch_lockdown\":true,\"science_instruments_online\":false}"
curl.exe -X POST http://127.0.0.1:8000/api/station/switch/MAITRI
```

Blizzard wind ramps +3.5 kt per edge tick from ~24 kt, so expect `CRITICAL` about 20–30 s after injection.

## Notes for teammates

- Dev 3: when the operator picks Maitri, call `POST /api/station/switch/MAITRI`. The edge runs one physics world at a time; the WS streams whichever station is active (default Bharati). Wire the scenario tray and mitigation buttons to the `/api/...` routes above.
- Dev 1: this service never imports your code and never installs scikit-learn into your environment.
- No database, no external weather APIs, no LLM. State is in-memory by design.
