# DEV 2 BUILD SPEC — PolarIS Digital Twin Engine (Port 8000)

**Use this file as the sole implementation brief for Dev 2.**  
**Role:** DEV 2 — DIGITAL TWIN ENGINE, SATELLITE INGESTION & AI CORE  
**Port:** `http://localhost:8000`  
**Problem:** SIH 2026 · PS 26060 · PolarIS  
**Companion contracts:** `project_spec.txt`, `Polaris Twin Backend API Documentation.pdf`, `Polaris Mock Server API Documentation.pdf`

This document is written so another coding model can implement Dev 2 without guessing. Every design choice below is **locked**. If something is not in this file, **do not invent a product feature for it**.

---

## 0. HARD SCOPE LOCK — READ THIS FIRST

You are **only** Dev 2. You are **not** Dev 1, 3, 4, 5, or 6.

### You MUST build

A standalone FastAPI service at `polaris/twin-backend/` that:

1. Polls the Antarctica edge mock server on port **8001**.
2. Injects simulated polar satellite latency and `link_status`.
3. Scores each tick with a Scikit-learn Isolation Forest (non-LLM).
4. Applies a deterministic Antarctic SOP rules engine.
5. Streams the **canonical enriched telemetry JSON** over WebSocket.
6. Proxies operator controls, scenario inject, and station switch down to 8001.

### You MUST NOT

- Edit `polaris/station-mock-server/` (Dev 1). Consume it as a black box.
- Edit `polaris/frontend/` (Dev 3 / 4 / 5 / 6). Do not “fix” their Zustand store, 3D scene, or API client.
- Edit Postgres, Timescale, PostGIS, pgvector, ingest scripts, datasets, or paper extracts.
- Call ERA5, NASA POWER, NPDC, CDS, NOAA, Cesium, or any live satellite API.
- Use an LLM, RAG, sentence-transformers, or embeddings for anomaly detection or SOPs.
- Re-implement the physics ODE, fuel mass balance, or weather scenarios. That is Dev 1.
- Build React UI, charts, or Three.js.
- Commit secrets. Do not modify the SIH-root `.env` (it belongs to the research/Postgres stack on another machine).
- Add Docker unless asked later.
- Expand into the “eleven modules” product (lockouts GIS, voyage windows, polar calendar, ISRO/HF). Out of role.

If a teammate’s code is wrong (frontend path mismatch, local fake scenarios), **compensate on port 8000 with aliases**. Do not patch their files.

---

## 1. LOCKED DECISIONS

These were open questions. They are now closed.

| Decision | Locked choice |
|---|---|
| Scope | Strict Dev 2 closed loop only. No Postgres / ERA5 / RAG. |
| Code location | `polaris/twin-backend/` (sibling of `station-mock-server/`). |
| Root `SIH/.env` | **Do not use.** Leave it for the research DB teammate. It points at `c:/projects/polaris` and Abhilash WSL paths. |
| Dev 2 env file | Create `polaris/twin-backend/.env` and `.env.example`. |
| Python env | **Separate** venv + `requirements.txt` from Dev 1. Dev 1 must stay free of scikit-learn. |
| Isolation Forest training data | **5,000 synthetic nominal rows** generated in-repo from Dev 1 physics baseline ranges. Do not train on PolarIS weather CSVs (they lack microgrid/fuel/CHP features). |
| Feature vector | `[ambient.temp_c, ambient.wind_speed_knots, microgrid.total_load_kva, thermal.chp_thermal_output_kw, fuel.burn_rate_lph]` |
| `anomaly_score` | sklearn `IsolationForest.decision_function` (positive ≈ inlier, negative ≈ outlier). Matches Twin Backend PDF examples (`0.185` vs `-0.324`). |
| `is_anomaly` | `True` if `predict() == -1` **OR** SOP severity is not `NOMINAL`. |
| Link health | Normal polar latency is **400–800 ms** and `ONLINE`. `DEGRADED` only on edge timeout, HTTP error, or consecutive poll failures. **Do not** mark blizzard as DEGRADED (PDF crisis samples stay `ONLINE`). Optional: add +80–150 ms extra latency during blizzard **without** flipping health. |
| Station switch | Twin **always proxies** to `POST /edge/switch-station/{id}`. Edge holds one physics world. |
| Official API | Twin Backend PDF + `project_spec.txt`. |
| Frontend compatibility | Official routes **plus** aliases so current `frontend/src/api/telemetry.js` does not 404. Still **do not edit frontend**. |
| Model artifact | Commit `artifacts/isolation_forest.joblib` so teammates can run without retraining. |
| Persistence | In-memory cache only. No database. |

---

## 2. WHAT ALREADY EXISTS (DO NOT REBUILD)

### 2.1 Dev 1 — Edge Gateway (port 8001) — READY

Path: `polaris/station-mock-server/`

| Method | Path | Role |
|---|---|---|
| GET | `/edge/raw-telemetry` | Raw physics JSON. **No** `link_status`, **no** `risk`. |
| POST | `/edge/scenario/inject` | Body: `{"scenario_type": "BLIZZARD_80KT"\|"RESUPPLY_DELAY"\|"POLAR_NIGHT", "duration_seconds": int}` |
| POST | `/edge/controls` | Partial actuator update. Keys: `science_instruments_online`, `summer_wing_isolated`, `hatch_lockdown`, `aux_generator_active` |
| POST | `/edge/switch-station/{station_id}` | `BHARATI` or `MAITRI` |
| GET | `/health` | `{status, station_id, active_scenario}` |

Physics tick: 2 seconds. Default station: `BHARATI`.  
`RESUPPLY_DELAY` immediately sets `fuel_tank_liters = 26500`.  
Run Dev 1 with: `uvicorn main:app --host 127.0.0.1 --port 8001` from `station-mock-server/`.

**Treat 8001 as Antarctica. You are NCPOR HQ in Goa.**

### 2.2 Frontend (ports 5173) — NOT YOUR CODE

- Zustand store already knows the canonical telemetry shape including `link_status` and `risk`.
- WebSocket client already targets `ws://localhost:8000/ws/telemetry`.
- REST client currently calls **non-spec** paths (see §7 aliases). Support them on 8000.
- `injectScenario` in the store currently **fakes** crises locally. Dev 3 must later wire buttons to your API. You still implement the real backend.

### 2.3 Research stack — IGNORE

`infra/postgres`, `scripts/ingest_polaris_db.py`, `datasets/`, `digital_twin_knowledge_base.md`, eleven-modules doc. Context only. Not runtime for Dev 2.

---

## 3. TARGET ARCHITECTURE

```
[Dev 1 Edge :8001]                     [Dev 2 Twin :8000]                    [Dev 3–6 UI :5173]
 raw physics JSON          httpx poll     enrich + IF + SOP      WebSocket
 GET /edge/raw-telemetry  <------------  ingest worker 2s  -------------->  /ws/telemetry
                          400–800 ms
                          fake SAT delay

 POST /edge/controls      <------------  POST /api/station/controls  <----  Approve mitigation
 POST /edge/scenario/*    <------------  POST /api/scenario/inject   <----  Pitch demo tray
 POST /edge/switch-station<------------  POST /api/station/switch/*  <----  Bharati / Maitri
 GET  /edge/raw-telemetry <------------  GET  /api/telemetry         <----  WS fallback poll
```

One process, one event loop, no extra services.

---

## 4. DIRECTORY LAYOUT (CREATE ONLY THIS)

Create everything under `polaris/twin-backend/`. Do not put files at SIH root.

```
polaris/twin-backend/
  .env.example
  .env                          # local only; gitignored via polaris/.gitignore (.env already listed)
  .gitignore                    # optional extra: .venv/, artifacts/*.pkl
  README.md                     # how to train, run, curl — keep short
  requirements.txt
  main.py                       # FastAPI app, routes, lifespan, WS
  models.py                     # Pydantic contracts
  config.py                     # env loading
  ingest.py                     # async poller + satellite delay + cache + broadcast
  satellite.py                  # latency + link_status helper
  anomaly.py                    # load joblib, score one tick
  sop.py                        # deterministic rules
  train_isolation_forest.py     # offline trainer, writes artifacts/
  artifacts/
    isolation_forest.joblib     # committed after first train
    training_meta.json          # feature order, sklearn version, n_samples, contamination
```

Do **not** import Python modules from `station-mock-server/`. Duplicate the needed Pydantic shapes in `models.py` (HQ schema is a **superset** of edge schema).

---

## 5. DEPENDENCIES

`requirements.txt`:

```
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
httpx>=0.27.0
pydantic>=2.6.0
python-dotenv>=1.0.0
scikit-learn>=1.4.0
joblib>=1.3.0
numpy>=1.26.0
```

Python 3.11+. Create venv inside `twin-backend/.venv`.

---

## 6. ENVIRONMENT

`polaris/twin-backend/.env.example` (and copy to `.env`):

```
POLARIS_API_HOST=127.0.0.1
POLARIS_API_PORT=8000
EDGE_BASE_URL=http://127.0.0.1:8001
POLL_INTERVAL_SECONDS=2.0
SAT_LATENCY_MIN_MS=400
SAT_LATENCY_MAX_MS=800
EDGE_TIMEOUT_SECONDS=3.0
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ISOLATION_FOREST_PATH=artifacts/isolation_forest.joblib
LOG_LEVEL=INFO
```

Do not read `SIH/.env`. Do not require `DATABASE_URL`.

---

## 7. CANONICAL JSON CONTRACT

Every WS message and `GET /api/telemetry` body **must** match this shape. Types and nesting are strict. This is the team-wide contract from `project_spec.txt`.

```json
{
  "station_id": "BHARATI",
  "timestamp": "2026-09-07T18:15:30.102Z",
  "source": "synthetic",
  "confidence": "modeled",
  "ambient": {
    "temp_c": -14.2,
    "wind_speed_knots": 24.3,
    "solar_flux_w_m2": 142.0
  },
  "thermal": {
    "internal_temp_c": 20.2,
    "chp_thermal_output_kw": 187.2,
    "aux_heater_kw": 0.0,
    "heat_loss_kw": 104.8
  },
  "microgrid": {
    "total_load_kva": 360.0,
    "essential_load_kva": 180.0,
    "science_load_kva": 120.0,
    "comfort_load_kva": 60.0,
    "chp_capacity_kva": 600.0
  },
  "fuel": {
    "tank_level_liters": 412500.0,
    "burn_rate_lph": 79.2,
    "days_of_autonomy": 217.0
  },
  "controls": {
    "science_instruments_online": true,
    "summer_wing_isolated": false,
    "hatch_lockdown": false,
    "aux_generator_active": false
  },
  "link_status": {
    "type": "C-band/LEO",
    "latency_ms": 524,
    "health": "ONLINE"
  },
  "risk": {
    "anomaly_score": 0.185,
    "is_anomaly": false,
    "severity": "NOMINAL",
    "prescribed_actions": []
  }
}
```

`station_id` is `"BHARATI"` | `"MAITRI"`.  
`link_status.health` is `"ONLINE"` | `"DEGRADED"`.  
`risk.severity` is `"NOMINAL"` | `"ADVISORY"` | `"CRITICAL"`.  
`prescribed_actions` is `string[]` (empty when nominal).

Pass through all edge fields unchanged (except you may round floats as received). **Add** `link_status` and `risk` only.

---

## 8. HTTP / WEBSOCKET API (YOUR SURFACE)

Base: `http://127.0.0.1:8000`

### 8.1 Official routes (must implement)

#### `GET /api/telemetry`

Returns the latest **enriched** payload.  
If cache is empty: `503 {"detail": "Twin engine initializing"}`.

#### `WS /ws/telemetry`

- Accept unlimited clients.
- On connect: immediately send the latest cached payload if present.
- Every successful ingest tick: broadcast the same JSON to all connected clients.
- Do not crash if a client disconnects; remove it from the set.
- Text frames, JSON object (not an array, not a string wrapper).

#### `POST /api/station/controls`

Request (all fields optional, partial updates):

```json
{
  "hatch_lockdown": true,
  "science_instruments_online": false
}
```

Behavior:

1. `POST {EDGE_BASE_URL}/edge/controls` with the same JSON.
2. Include satellite delay (same 400–800 ms) so the command “goes over the sat link.”
3. Response **exactly** (Twin Backend PDF):

```json
{
  "status": "acknowledged",
  "station_id": "BHARATI",
  "active_controls": {
    "science_instruments_online": false,
    "summer_wing_isolated": false,
    "hatch_lockdown": true,
    "aux_generator_active": false
  }
}
```

`station_id` = last known edge station.  
`active_controls` = edge response `controls` object (full four booleans).  
If edge is down: `502` with a short detail. Do not invent actuator state.

#### `POST /api/scenario/inject`

Official request:

```json
{
  "scenario_type": "BLIZZARD_80KT",
  "duration_seconds": 60
}
```

Validate `scenario_type` ∈ `{BLIZZARD_80KT, RESUPPLY_DELAY, POLAR_NIGHT}`.  
Default `duration_seconds` to `120` if omitted.  
Proxy to `POST {EDGE}/edge/scenario/inject`.  
Satellite delay before the edge call.  
Response (Twin Backend PDF):

```json
{
  "status": "scenario_injected",
  "scenario": "BLIZZARD_80KT",
  "duration_seconds": 60
}
```

Do not locally mutate physics. Edge owns the crisis.

#### `POST /api/station/switch/{station_id}`

`station_id` case-insensitive; normalize to `BHARATI` | `MAITRI`.  
Proxy to `POST {EDGE}/edge/switch-station/{STATION}`.  
Response:

```json
{
  "status": "switched",
  "station_id": "MAITRI"
}
```

Invalid id: `400`. Edge down: `502`.

#### `GET /health` (twin, not edge)

```json
{
  "status": "ONLINE",
  "station_id": "BHARATI",
  "edge_reachable": true,
  "model_loaded": true,
  "last_ingest_utc": "2026-09-07T18:15:30.102Z",
  "connected_clients": 1,
  "consecutive_edge_failures": 0
}
```

If model file missing: still boot, `model_loaded: false`, `anomaly_score: 0.0`, `is_anomaly` from SOP only. Log a warning. Prefer shipping the joblib so this is rare.

#### `GET /` (optional one-liner)

`{"service":"polaris-twin-engine","role":"DEV2","port":8000}` so judges hitting the root do not see 404.

### 8.2 Compatibility aliases (must implement, do not document as the team contract)

Current frontend `polaris/frontend/src/api/telemetry.js` is **wrong vs spec**. Support it without editing frontend:

| Frontend call | Map to |
|---|---|
| `GET /telemetry/{stationId}` | Same body as `GET /api/telemetry`. Ignore path station if it differs from active edge station; still return the live payload (`station_id` inside JSON is the source of truth). |
| `POST /scenario/inject` with `{ "station_id": "BHARATI", "scenario": "BLIZZARD_80KT" }` | Treat as official inject. `scenario` → `scenario_type`. `duration_seconds` default `120`. If `station_id` present and ≠ active, **first** proxy station switch, then inject. |

Accept **both** body shapes on `POST /api/scenario/inject` as well (`scenario` alias of `scenario_type`).

CORS: allow `CORS_ORIGINS`, methods `*`, headers `*`. Credentials may be true; if that fights `allow_origins=["*"]`, use the explicit 5173 origins from env.

---

## 9. SATELLITE INGESTION WORKER

File: `ingest.py` + `satellite.py`

### Loop (lifespan / startup)

```
while running:
    t0 = now
    latency_ms = random.randint(SAT_LATENCY_MIN_MS, SAT_LATENCY_MAX_MS)
    await asyncio.sleep(latency_ms / 1000.0)          # one-way sat delay before the GET
    GET {EDGE}/edge/raw-telemetry  timeout=EDGE_TIMEOUT_SECONDS
    # optional: second half of RTT is already represented by the sampled 400–800 ms total;
    # do NOT sleep twice. The sampled value IS the round-trip the UI should display.
    enrich payload
    cache = enriched
    broadcast to WS clients
    remaining = POLL_INTERVAL_SECONDS - elapsed
    await asyncio.sleep(max(0, remaining))
```

Display `link_status.latency_ms` as that sampled integer.

`link_status.type` is always `"C-band/LEO"` (Bharati story in the knowledge base; keep constant for both stations so the UI badge is stable).

### Failure behavior

- On timeout / connect error / non-200: increment `consecutive_edge_failures`.
- Do **not** wipe cache. Re-broadcast last good payload with:
  - `link_status.health = "DEGRADED"`
  - `link_status.latency_ms = max(previous, 800)` or `800`
- After 3 consecutive failures, keep DEGRADED until a success.
- On success: reset failure counter, health `ONLINE`, latency = sampled 400–800.

### Threading

Use `httpx.AsyncClient` shared for the process lifetime. Never `requests` in the async loop.

---

## 10. ISOLATION FOREST (NON-LLM)

### 10.1 Offline trainer — `train_isolation_forest.py`

Run from `twin-backend/`:

```
python train_isolation_forest.py
```

Must:

1. Generate **exactly 5000** rows of **nominal** polar ops. No blizzard, no polar night, no fuel cliff.
2. Fit `sklearn.ensemble.IsolationForest`.
3. Write `artifacts/isolation_forest.joblib` and `artifacts/training_meta.json`.
4. Print a short sanity check: score a nominal vector (expect `predict=1`, `decision_function>0`) and a blizzard-like vector `[ -36.0, 80.0, 360.0, 187.2, 79.2 ]` (expect `predict=-1` or at least a much lower decision score). If the blizzard vector is not clearly worse, tighten the training distribution and retrain. **Do not ship a model that cannot see 80 kt wind as abnormal.**

**Hyperparameters (locked):**

```
IsolationForest(
    n_estimators=200,
    contamination=0.03,
    max_samples="auto",
    random_state=42,
    n_jobs=1,
)
```

**Nominal sampling (locked, matches Dev 1 baseline):**

Dev 1 idle Bharati-ish state: ambient ≈ -14.2 °C, wind ≈ 24 kt, load ≈ 360 kVA, CHP heat ≈ `load * 0.52`, burn ≈ `load * 0.22`.

| Feature | Distribution | Clip |
|---|---|---|
| `temp_c` | Normal(-14.2, 1.8) | [-22.0, -6.0] |
| `wind_speed_knots` | Normal(24.0, 3.5) | [12.0, 38.0] |
| `total_load_kva` | Normal(360.0, 8.0) | [330.0, 390.0] |
| `chp_thermal_output_kw` | `total_load_kva * 0.52 + N(0, 2)` | [160.0, 220.0] |
| `fuel_burn_lph` | `total_load_kva * 0.22 + N(0, 1)` | [65.0, 95.0] |

Never emit wind > 38 or load/fuel crash in training. Isolation Forest has no labels; contamination only models a thin tail of *normal* noise.

**Feature order in joblib must be stored in `training_meta.json`:**

```json
{
  "features": [
    "ambient.temp_c",
    "ambient.wind_speed_knots",
    "microgrid.total_load_kva",
    "thermal.chp_thermal_output_kw",
    "fuel.burn_rate_lph"
  ],
  "n_samples": 5000,
  "contamination": 0.03,
  "random_state": 42,
  "sklearn_version": "<filled at train time>"
}
```

No `StandardScaler` unless the blizzard sanity check fails; prefer raw features so runtime stays one `.joblib`.

### 10.2 Runtime — `anomaly.py`

- Load joblib once at startup.
- `vector = [[temp, wind, total_load, chp_heat, burn]]`
- `anomaly_score = float(model.decision_function(vector)[0])`  # round to 3 decimals
- `if_outlier = model.predict(vector)[0] == -1`

Do not retrain online.

---

## 11. SOP RULES ENGINE — `sop.py`

Deterministic. No ML inside this file. Evaluate **every** tick on the **enriched-from-edge** numbers.

### Rules (locked text — frontend shows these strings)

Evaluate independently; collect all matching actions. Severity = **max** of firing rules (`CRITICAL` > `ADVISORY` > `NOMINAL`).

| ID | Condition | Severity | Actions (append in this order) |
|---|---|---|---|
| STRUCTURAL | `ambient.wind_speed_knots > 60` | CRITICAL | `"ACTION: Engage exterior hatch structural airlock sequence."` `"ACTION: Stow external weather sensors & abort outdoor sorties."` |
| THERMAL | `thermal.internal_temp_c < 16.0` | CRITICAL | `"ACTION: Spin up Standby Auxiliary Generator."` |
| FUEL_CRIT | `fuel.days_of_autonomy < 15.0` | CRITICAL | `"ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)."` `"ACTION: Isolate and depressurize unoccupied summer modules."` |
| FUEL_ADV | `15.0 <= days_of_autonomy < 30.0` | ADVISORY | `"ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)."` `"ACTION: Isolate unoccupied summer residential modules."` |
| ML_ONLY | Isolation Forest outlier **and** no SOP rule above fired | ADVISORY | `"ACTION: Review Isolation Forest outlier against baseline polar ops."` |

Notes:

- STRUCTURAL wording matches Twin Backend PDF blizzard sample (include the period, include “abort outdoor sorties”).
- FUEL_CRIT wording matches PDF resupply sample (`days_of_autonomy: 14.9` → CRITICAL). Edge `RESUPPLY_DELAY` sets tank to 26500 L → autonomy well under 15 days at ~79 L/h.
- Deduplicate identical action strings if FUEL_CRIT and something else overlap.
- Polar night by itself (solar 0, temp -28, wind ~28) should **not** force CRITICAL unless IF + SOP say so. Likely NOMINAL or ML_ONLY ADVISORY. That is correct: polar night is planned ops, not a structural emergency.

### Merge into `risk`

```
severity = sop_severity
is_anomaly = if_outlier OR (severity != "NOMINAL")
anomaly_score = decision_function value (always from the model; 0.0 if model missing)
prescribed_actions = list of SOP strings (empty iff severity == NOMINAL and not ML_ONLY)
```

If severity is NOMINAL: `prescribed_actions = []`.

---

## 12. FASTAPI APP STRUCTURE — `main.py`

- `lifespan` context: create `httpx.AsyncClient`, load model, start ingest task, on shutdown cancel task and close client.
- Do **not** use deprecated `@app.on_event("startup")` if you can use lifespan (FastAPI 0.110+).
- CORS middleware from env.
- WebSocket connection manager: `set[WebSocket]`, lock with `asyncio.Lock` if needed; `send_json` per client; drop on `WebSocketDisconnect`.
- Keep ingest and routes thin: call `ingest`, `anomaly`, `sop`, `satellite`.

---

## 13. MERGE CONTRACTS WITH OTHER DEVS

You cannot edit their code. You **can** make 8000 a perfect neighbor.

### Dev 1 (edge)

- Never require scikit-learn on 8001.
- Never call Dev 1 internal Python APIs.
- Tolerate ~2 s tick; your poll interval is also 2 s. Cache staleness of one tick is OK.
- After `POST /api/station/controls`, next poll (~2 s) will show physics change. Do not block the HTTP response waiting for the next telemetry tick.

### Dev 3 (mission control UI)

They will:

- Connect to `ws://localhost:8000/ws/telemetry`
- Fall back to `GET /api/telemetry` (you also expose `/telemetry/{id}`)
- POST mitigations to `/api/station/controls`
- POST demos to `/api/scenario/inject`
- Show `risk.severity`, `risk.anomaly_score`, `risk.prescribed_actions`, `link_status`

You guarantee: JSON schema, CORS, WS heartbeat via regular ticks, 503 only before first successful ingest.

**Tell Dev 3 (in your README, not by editing their repo files):** when the operator clicks Maitri, they should `POST /api/station/switch/MAITRI`. Until they do, the socket still streams whichever station the edge is running (default Bharati).

### Dev 4 (dashboard cards)

They only read Zustand `telemetry`. If Dev 3 writes your WS payloads into the store, Dev 4 works. You do not build gauges.

### Dev 5 / 6 (3D / thermal shader)

They read `selectedStation`, `selectedSubsystem`, `isThermalView`, and telemetry. Out of scope.

### Git / repo

- PolarIS git root is `polaris/`. Add **only** `twin-backend/**`.
- `polaris/.gitignore` already ignores `.env`. Do not commit `.venv`.
- **Do** commit `artifacts/isolation_forest.joblib` and `training_meta.json`.

---

## 14. IMPLEMENTATION ORDER (DO THIS SEQUENCE)

Do not skip ahead to extra features.

1. Scaffold `polaris/twin-backend/` with `requirements.txt`, `.env.example`, `config.py`, `models.py`.
2. Write `train_isolation_forest.py`, generate 5000 rows, fit, save joblib, run the blizzard sanity print. Commit artifacts.
3. Implement `anomaly.py` and `sop.py` with unit-less `if __name__ == "__main__"` smoke tests or a tiny `assert` block in comments/README curls — prefer a `python -c` section in README.
4. Implement `satellite.py` + `ingest.py` (cache + WS manager stubs).
5. Implement `main.py` routes + lifespan + CORS + WS.
6. Add official endpoints, then aliases.
7. Manual acceptance tests in §15 against a **running** Dev 1 on 8001.
8. Write a short `README.md` (start commands, curl, what not to touch).

Do not start the frontend. Do not refactor Dev 1.

---

## 15. ACCEPTANCE TESTS (MUST PASS BEFORE YOU STOP)

Prereq: Dev 1 running on 8001, Dev 2 on 8000, model loaded.

```
# 0. Twin health
curl http://127.0.0.1:8000/health
# expect model_loaded true, edge_reachable true

# 1. Enriched telemetry
curl http://127.0.0.1:8000/api/telemetry
# must include link_status AND risk
# severity NOMINAL, prescribed_actions [], is_anomaly false
# latency_ms between 400 and 800 inclusive

# 2. Blizzard
curl -X POST http://127.0.0.1:8000/api/scenario/inject ^
  -H "Content-Type: application/json" ^
  -d "{\"scenario_type\":\"BLIZZARD_80KT\",\"duration_seconds\":60}"
# wait ~20–40s for wind to ramp above 60 kt (Dev 1 ramps +3.5 kt/tick from ~24)
curl http://127.0.0.1:8000/api/telemetry
# expect severity CRITICAL, is_anomaly true, hatch/sensor ACTION strings present
# link_status.health still ONLINE

# 3. Mitigation proxy
curl -X POST http://127.0.0.1:8000/api/station/controls ^
  -H "Content-Type: application/json" ^
  -d "{\"hatch_lockdown\":true,\"science_instruments_online\":false}"
# expect status acknowledged and those two booleans true/false respectively

# 4. Resupply
curl -X POST http://127.0.0.1:8000/api/scenario/inject ^
  -H "Content-Type: application/json" ^
  -d "{\"scenario_type\":\"RESUPPLY_DELAY\",\"duration_seconds\":120}"
# wait 2–4s then GET telemetry
# days_of_autonomy < 15, severity CRITICAL, science-shed ACTION strings

# 5. Station switch
curl -X POST http://127.0.0.1:8000/api/station/switch/MAITRI
# next GET /api/telemetry station_id == MAITRI

# 6. Alias
curl http://127.0.0.1:8000/telemetry/BHARATI
# 200 JSON with risk block

# 7. WebSocket
# connect to ws://127.0.0.1:8000/ws/telemetry
# receive JSON at ~2s interval with the same schema
```

**Windows note:** PowerShell `curl` is `Invoke-WebRequest`. Prefer `curl.exe` as above.

**Kill test:** Stop Dev 1, wait two poll cycles, GET `/api/telemetry` → last payload with `link_status.health: DEGRADED`. Restart Dev 1 → returns ONLINE within a few ticks.

---

## 16. HOW TO RUN (PUT THIS IN README)

Terminal A — Dev 1 (already exists):

```
cd polaris/station-mock-server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

Terminal B — Dev 2:

```
cd polaris/twin-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python train_isolation_forest.py
uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend (not your job): `cd polaris/frontend && npm run dev` → `:5173`.

---

## 17. QUALITY BAR

- Type hints on public functions.
- Pydantic v2 models for request/response.
- No hardcoded Windows username paths.
- No `print` in the hot path; use `logging` at INFO for ingest failures and startup.
- Round `anomaly_score` to 3 decimals; leave physics floats as edge sent them.
- If edge JSON ever lacks a field, fail that tick (log + DEGRADED), do not crash the process.
- Keep files small; do not dump 5000 training rows to git (generate on the fly).

---

## 18. COPY-PASTE PROMPT FOR THE IMPLEMENTING MODEL

Use this as the user message when handing to another model:

```
Implement ONLY Dev 2 from DEV2_DIGITAL_TWIN_ENGINE_BUILD.md in this workspace.

Hard rules:
- Write code only under polaris/twin-backend/
- Do not modify station-mock-server, frontend, infra, datasets, or SIH/.env
- Follow every locked decision, JSON schema, SOP string, and endpoint in that document
- Train Isolation Forest on 5000 synthetic nominal rows; commit the .joblib
- Official API + frontend aliases both required
- No Postgres, no LLM, no UI

When done, run or document the §15 curl acceptance tests. If Dev 1 is not running, still complete the code and artifacts.
```

---

## 19. DONE DEFINITION

Dev 2 is done when:

1. `polaris/twin-backend/` exists with the files in §4.
2. `artifacts/isolation_forest.joblib` exists and blizzard vectors score worse than nominal.
3. Port 8000 serves the official API + aliases + WebSocket.
4. SOP strings match this spec / Twin Backend PDF.
5. No files outside `polaris/twin-backend/` were changed (except this build doc, which already exists).
6. README explains run order with Dev 1 on 8001.

Nothing else is in scope.
