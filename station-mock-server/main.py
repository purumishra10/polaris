import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    RawTelemetryPayload,
    ScenarioInjectRequest,
    ControlUpdateRequest
)
from physics import StationPhysicsSimulator
from scenarios import ScenarioController

app = FastAPI(
    title="Antarctica Station Edge Gateway",
    description="Independent on-site SCADA / IoT physical simulator for Bharati & Maitri stations",
    version="1.0.0"
)

# Allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core simulator instances
simulator = StationPhysicsSimulator(station_id="BHARATI")
scenario_mgr = ScenarioController()
cached_telemetry: RawTelemetryPayload | None = None

@app.on_event("startup")
async def start_background_physics():
    asyncio.create_task(physics_tick_loop())

async def physics_tick_loop():
    global cached_telemetry
    while True:
        scenario_mgr.tick()
        ambient, thermal, microgrid, fuel, controls = simulator.step(
            active_scenario=scenario_mgr.active_scenario,
            dt_seconds=2.0
        )

        cached_telemetry = RawTelemetryPayload(
            station_id=simulator.station_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            source="synthetic",
            confidence="modeled",
            ambient=ambient,
            thermal=thermal,
            microgrid=microgrid,
            fuel=fuel,
            controls=controls
        )

        await asyncio.sleep(2.0)

@app.get("/edge/raw-telemetry", response_model=RawTelemetryPayload)
async def get_raw_telemetry():
    """Returns the latest physical state calculated on-site."""
    if not cached_telemetry:
        raise HTTPException(status_code=503, detail="Simulator initializing")
    return cached_telemetry

@app.post("/edge/scenario/inject")
async def inject_scenario(payload: ScenarioInjectRequest):
    """Simulates an on-site crisis scenario."""
    if payload.scenario_type == "RESUPPLY_DELAY":
        # Simulates low reserves scenario immediately
        simulator.fuel_tank_liters = 26500.0
    
    # 2 seconds per tick
    duration_ticks = payload.duration_seconds // 2
    scenario_mgr.trigger(payload.scenario_type, duration_ticks)
    
    return {
        "status": "scenario_active",
        "scenario": payload.scenario_type,
        "duration_seconds": payload.duration_seconds,
        "remaining_ticks": duration_ticks
    }

@app.post("/edge/controls")
async def apply_hardware_controls(payload: ControlUpdateRequest):
    """Executes actuator movements and load shedding sent from remote command."""
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(simulator.controls, field):
            setattr(simulator.controls, field, value)

    return {
        "status": "actuators_updated",
        "controls": simulator.controls
    }

@app.post("/edge/switch-station/{station_id}")
async def switch_station(station_id: str):
    """Switch station profile between BHARATI and MAITRI."""
    valid = ["BHARATI", "MAITRI"]
    upper_id = station_id.upper()
    if upper_id not in valid:
        raise HTTPException(status_code=400, detail=f"Valid station IDs: {valid}")
    
    simulator.station_id = upper_id
    if upper_id == "MAITRI":
        simulator.u_area_factor = 3.6  # Higher thermal losses on older station
        simulator.internal_temp_c = 18.0
    else:
        simulator.u_area_factor = 2.45
        simulator.internal_temp_c = 20.4

    return {"status": "station_switched", "active_station": simulator.station_id}

@app.get("/health")
async def health_check():
    return {
        "status": "ONLINE",
        "station_id": simulator.station_id,
        "active_scenario": scenario_mgr.active_scenario
    }