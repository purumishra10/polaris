"""Polaris Digital Twin Engine — HQ backend (Dev 2, port 8000).

NCPOR-side intelligence layer: ingests Antarctica edge telemetry over a
simulated satellite link, scores it with an Isolation Forest, applies the
Antarctic SOP rule matrix, and streams enriched StationTelemetry to the UI.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import satellite
from anomaly import AnomalyScorer
from config import settings
from ingest import ConnectionManager, TwinState
from models import (
    VALID_STATIONS,
    ClockRequest,
    ControlsAckResponse,
    ControlsState,
    ControlUpdateRequest,
    ScenarioInjectRequest,
    ScenarioInjectResponse,
    StationSwitchResponse,
    StationTelemetry,
    TwinHealthResponse,
)

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("polaris.main")

scorer = AnomalyScorer(settings.isolation_forest_path)
manager = ConnectionManager()
twin = TwinState(scorer, manager)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await twin.start()
    try:
        yield
    finally:
        await twin.stop()


app = FastAPI(
    title="Polaris Digital Twin Engine",
    description="HQ / NCPOR intelligence layer for Bharati & Maitri (Dev 2, port 8000)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _require_snapshot() -> dict[str, Any]:
    snap = twin.snapshot()
    if snap is None:
        raise HTTPException(status_code=503, detail="Twin engine initializing")
    return snap


async def _edge_post(path: str, json: Any | None = None) -> dict[str, Any]:
    """POST to the edge over the simulated sat link; 502 if Antarctica is unreachable."""
    if twin.client is None:
        raise HTTPException(status_code=503, detail="Twin engine initializing")
    await satellite.satellite_delay()
    try:
        resp = await twin.client.post(path, json=json)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Edge gateway unreachable: {exc.__class__.__name__}"
        ) from exc
    if resp.status_code >= 400:
        detail: Any
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        raise HTTPException(status_code=502, detail=f"Edge rejected command: {detail}")
    try:
        return resp.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Edge returned non-JSON") from exc


def _normalise_station(station_id: str) -> str:
    key = station_id.strip().upper()
    if key not in VALID_STATIONS:
        raise HTTPException(
            status_code=400, detail=f"Valid station IDs: {list(VALID_STATIONS)}"
        )
    return key


async def _switch_station(station: str) -> StationSwitchResponse:
    data = await _edge_post(f"/edge/switch-station/{station}")
    active = str(data.get("active_station", station)).upper()
    twin.active_station = active
    return StationSwitchResponse(station_id=active)


async def _inject(payload: ScenarioInjectRequest) -> ScenarioInjectResponse:
    if payload.station_id and payload.station_id != twin.active_station:
        await _switch_station(_normalise_station(payload.station_id))
    body = {
        "scenario_type": payload.scenario_type,
        "duration_seconds": payload.duration_seconds,
    }
    await _edge_post("/edge/scenario/inject", json=body)
    return ScenarioInjectResponse(
        scenario=payload.scenario_type or "",
        duration_seconds=payload.duration_seconds,
    )


@app.post("/api/replay/2018-08-05")
async def replay_2018() -> dict[str, Any]:
    data = await _edge_post("/edge/replay/2018-08-05")
    twin.active_station = str(data.get("station_id", "BHARATI")).upper()
    return data


@app.post("/api/replay/clear")
async def replay_clear() -> dict[str, Any]:
    return await _edge_post("/edge/replay/clear")


@app.post("/api/clock")
async def set_clock(payload: ClockRequest) -> dict[str, Any]:
    data = await _edge_post(
        "/edge/clock",
        json=payload.model_dump(),
    )
    if data.get("station_id"):
        twin.active_station = str(data["station_id"]).upper()
    return data


@app.get("/api/clock/catalog")
async def clock_catalog() -> dict[str, Any]:
    if twin.client is None:
        raise HTTPException(status_code=503, detail="Twin engine initializing")
    await satellite.satellite_delay()
    try:
        resp = await twin.client.get("/edge/clock/catalog")
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"Edge catalog unreachable: {exc.__class__.__name__}"
        ) from exc


# --------------------------------------------------------------------------- #
# root + health
# --------------------------------------------------------------------------- #
@app.get("/")
async def root() -> dict[str, Any]:
    return {"service": "polaris-twin-engine", "role": "DEV2", "port": settings.api_port}


@app.get("/health", response_model=TwinHealthResponse)
async def health() -> TwinHealthResponse:
    return TwinHealthResponse(
        status="ONLINE",
        station_id=twin.active_station,
        edge_reachable=twin.edge_reachable,
        model_loaded=scorer.loaded,
        last_ingest_utc=twin.last_ingest_utc,
        connected_clients=manager.count,
        consecutive_edge_failures=twin.consecutive_edge_failures,
    )


# --------------------------------------------------------------------------- #
# official API
# --------------------------------------------------------------------------- #
@app.get("/api/telemetry", response_model=StationTelemetry)
async def get_telemetry() -> dict[str, Any]:
    return _require_snapshot()


@app.post("/api/station/controls", response_model=ControlsAckResponse)
async def station_controls(payload: ControlUpdateRequest) -> ControlsAckResponse:
    body = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not body:
        raise HTTPException(status_code=400, detail="No control fields supplied")
    data = await _edge_post("/edge/controls", json=body)
    controls = ControlsState.model_validate(data.get("controls", {}))
    return ControlsAckResponse(station_id=twin.active_station, active_controls=controls)


@app.post("/api/scenario/inject", response_model=ScenarioInjectResponse)
async def scenario_inject(payload: ScenarioInjectRequest) -> ScenarioInjectResponse:
    return await _inject(payload)


@app.post("/api/station/switch/{station_id}", response_model=StationSwitchResponse)
async def station_switch(station_id: str) -> StationSwitchResponse:
    return await _switch_station(_normalise_station(station_id))


# --------------------------------------------------------------------------- #
# compatibility aliases for the current frontend client (do not document as contract)
# --------------------------------------------------------------------------- #
@app.get("/telemetry/{station_id}", response_model=StationTelemetry, include_in_schema=False)
async def get_telemetry_alias(station_id: str) -> dict[str, Any]:
    # station_id in the JSON body is the source of truth; the path is advisory.
    return _require_snapshot()


@app.post("/scenario/inject", response_model=ScenarioInjectResponse, include_in_schema=False)
async def scenario_inject_alias(payload: ScenarioInjectRequest) -> ScenarioInjectResponse:
    return await _inject(payload)


# --------------------------------------------------------------------------- #
# WebSocket stream
# --------------------------------------------------------------------------- #
@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        snap = twin.snapshot()
        if snap is not None:
            await ws.send_json(snap)
        while True:
            # Keep the socket open; ignore any client chatter.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.debug("WebSocket closed unexpectedly", exc_info=True)
    finally:
        await manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=False)
