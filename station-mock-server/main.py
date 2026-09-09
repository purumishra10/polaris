import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    RawTelemetryPayload,
    ScenarioInjectRequest,
    ControlUpdateRequest
)
from live_weather import LiveWeather, ambient_from_obs
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
weather = LiveWeather()
cached_telemetry: RawTelemetryPayload | None = None
WEATHER_POLL_SECONDS = 600.0

@app.on_event("startup")
async def start_background_physics():
    asyncio.create_task(weather_poll_loop())
    asyncio.create_task(physics_tick_loop())

async def weather_poll_loop():
    while True:
        station = simulator.station_id
        ok = await asyncio.to_thread(weather.refresh, station)
        obs = weather.snapshot(station)
        amb = ambient_from_obs(obs) if obs else None
        if ok and amb:
            simulator.set_live_ambient(amb, "OPEN_METEO_FORECAST")
        await asyncio.sleep(WEATHER_POLL_SECONDS)

async def physics_tick_loop():
    global cached_telemetry
    while True:
        scenario_mgr.tick()
        injecting = scenario_mgr.active_scenario is not None
        ambient, thermal, microgrid, fuel, controls = simulator.step(
            active_scenario=scenario_mgr.active_scenario,
            dt_seconds=2.0
        )
        obs = weather.snapshot(simulator.station_id)
        live_ok = bool(obs) and not injecting
        if injecting and scenario_mgr.active_scenario == "RESUPPLY_DELAY" and obs:
            live_ok = True
        source = "OPEN_METEO_FORECAST" if live_ok else (
            "synthetic" if injecting else simulator.weather_source
        )
        confidence = "forecast" if live_ok else "modeled"

        cached_telemetry = RawTelemetryPayload(
            station_id=simulator.station_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            source=source,
            confidence=confidence,
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
    obs = weather.snapshot(upper_id)
    amb = ambient_from_obs(obs) if obs else None
    if not amb:
        await asyncio.to_thread(weather.refresh, upper_id)
        obs = weather.snapshot(upper_id)
        amb = ambient_from_obs(obs) if obs else None
    if amb:
        simulator.set_live_ambient(amb, "OPEN_METEO_FORECAST")

    return {"status": "station_switched", "active_station": simulator.station_id}

@app.get("/health")
async def health_check():
    obs = weather.snapshot(simulator.station_id)
    return {
        "status": "ONLINE",
        "station_id": simulator.station_id,
        "active_scenario": scenario_mgr.active_scenario,
        "weather": {
            "source": simulator.weather_source,
            "model_time": (obs or {}).get("model_time"),
            "kp": (weather.space or {}).get("kp"),
        },
    }