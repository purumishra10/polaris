import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    RawTelemetryPayload,
    ScenarioInjectRequest,
    ControlUpdateRequest,
    ClockRequest,
    ReplayState,
    LockoutsState,
)

from physics import (
    StationPhysicsSimulator,
    NOMINAL_FUEL_LITERS,
)
from live_weather import LiveWeather, ambient_from_obs

from scenarios import ScenarioController

from clock import (
    resolve as resolve_clock,
    catalog as clock_catalog,
    replay_from_snapshot,
    live_replay_payload,
    lockouts_from_snapshot,
)


# ===========================================================================
# Application
# ===========================================================================

app = FastAPI(
    title="POLARIS Antarctic Edge Simulator",
    description=(
        "Independent on-site SCADA / IoT physical simulator "
        "for Bharati & Maitri stations"
    ),
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# Global simulator state
# ===========================================================================

simulator = StationPhysicsSimulator(
    station_id="BHARATI"
)

scenario_mgr = ScenarioController()
weather = LiveWeather()
WEATHER_POLL_SECONDS = 600.0

cached_telemetry: RawTelemetryPayload | None = None

physics_task: asyncio.Task | None = None
weather_task: asyncio.Task | None = None

clock_offset_seconds = 0.0
clock_mode = "LIVE"


# ===========================================================================
# Station helpers
# ===========================================================================

def _reset_current_station() -> None:
    """
    Restore the currently selected station to its nominal modeled profile.
    """

    simulator.reset_nominal(
        simulator.station_id
    )


def _hold_ambient() -> dict | None:
    """
    During historical replay, freeze ambient conditions to the replay
    snapshot. In normal live simulation, return None so physics can evolve.
    """

    if (
        not scenario_mgr.hold
        or not scenario_mgr.snapshot
    ):
        return None

    station_data = scenario_mgr.snapshot.get(
        "stations",
        {}
    ).get(
        simulator.station_id
    )

    if not station_data:
        return None

    return station_data.get(
        "ambient"
    )


def _tick_timestamp() -> str:
    """
    Return UTC simulator time with optional clock offset.
    """

    now = datetime.now(
        timezone.utc
    )

    if clock_offset_seconds:
        from datetime import timedelta

        now = now + timedelta(
            seconds=clock_offset_seconds
        )

    return now.isoformat()


# ===========================================================================
# Physics loop
# ===========================================================================

async def physics_tick_loop() -> None:
    global cached_telemetry

    while True:
        try:
            # Advance active scenario.
            scenario_mgr.tick()

            active_scenario = (
                scenario_mgr.active_scenario
            )

            # IMPORTANT:
            # Call _hold_ambient().
            # Do NOT pass the function object itself.
            hold_ambient = _hold_ambient()

            (
                ambient,
                thermal,
                microgrid,
                fuel,
                controls,
            ) = simulator.step(
                active_scenario=active_scenario,
                dt_seconds=2.0,
                hold_ambient=hold_ambient,
            )

            obs = weather.snapshot(simulator.station_id)
            injecting = active_scenario is not None
            live_ok = bool(obs) and not injecting
            if injecting and active_scenario == "RESUPPLY_DELAY" and obs:
                live_ok = True
            source = (
                "OPEN_METEO_FORECAST"
                if live_ok
                else ("synthetic" if injecting else simulator.weather_source)
            )
            confidence = "forecast" if live_ok else "modeled"

            cached_telemetry = RawTelemetryPayload(
                station_id=simulator.station_id,
                timestamp=_tick_timestamp(),
                source=source,
                confidence=confidence,
                scenario_id=active_scenario,

                ambient=ambient,
                thermal=thermal,
                microgrid=microgrid,
                fuel=fuel,
                controls=controls,

                replay=(
                    replay_from_snapshot(
                        scenario_mgr.snapshot,
                        simulator.station_id,
                    )
                    if (
                        scenario_mgr.hold
                        and scenario_mgr.snapshot
                    )
                    else live_replay_payload()
                ),

                lockouts=(
                    lockouts_from_snapshot(
                        scenario_mgr.snapshot,
                        simulator.station_id,
                    )
                    if (
                        scenario_mgr.hold
                        and scenario_mgr.snapshot
                    )
                    else LockoutsState()
                ),
            )

        except Exception as exc:
            print(
                f"[EDGE] Physics tick failed: {exc}"
            )

        await asyncio.sleep(2.0)


# ===========================================================================
# Startup
# ===========================================================================

async def weather_poll_loop() -> None:
    while True:
        station = simulator.station_id
        ok = await asyncio.to_thread(weather.refresh, station)
        obs = weather.snapshot(station)
        amb = ambient_from_obs(obs) if obs else None
        if ok and amb:
            simulator.set_live_ambient(amb, "OPEN_METEO_FORECAST")
        await asyncio.sleep(WEATHER_POLL_SECONDS)


@app.on_event("startup")
async def startup_event() -> None:
    global physics_task
    global weather_task

    if physics_task is None:
        physics_task = asyncio.create_task(
            physics_tick_loop()
        )

    if weather_task is None:
        weather_task = asyncio.create_task(
            weather_poll_loop()
        )

    print(
        "[EDGE] Antarctic station simulator started"
    )


# ===========================================================================
# Raw telemetry
# ===========================================================================

@app.get(
    "/edge/raw-telemetry",
    response_model=RawTelemetryPayload,
)
async def get_raw_telemetry() -> RawTelemetryPayload:

    if cached_telemetry is None:
        raise HTTPException(
            status_code=503,
            detail="Simulator initializing",
        )

    return cached_telemetry


# ===========================================================================
# Scenario injection
# ===========================================================================

@app.post("/edge/scenario/inject")
async def inject_scenario(
    payload: ScenarioInjectRequest,
):
    """
    Inject an operational scenario into the edge simulator.

    NOMINAL is a complete physical-state reset.
    """

    duration_seconds = max(
        0,
        payload.duration_seconds,
    )

    # -----------------------------------------------------------------------
    # NOMINAL
    # -----------------------------------------------------------------------

    if payload.scenario_type == "NOMINAL":

        scenario_mgr.clear()

        _reset_current_station()

        return {
            "status": "scenario_cleared",
            "scenario": "NOMINAL",
            "duration_seconds": 0,
            "remaining_ticks": 0,
        }

    # -----------------------------------------------------------------------
    # Clear replay before starting a live scenario
    # -----------------------------------------------------------------------

    scenario_mgr.clear_replay()

    # -----------------------------------------------------------------------
    # RESUPPLY DELAY
    # -----------------------------------------------------------------------

    if payload.scenario_type == "RESUPPLY_DELAY":

        # Modeled low-reserve condition.
        #
        # This is intentionally below the nominal reserve but is still
        # treated as synthetic simulation data.

        simulator.fuel_tank_liters = 26500.0

    # -----------------------------------------------------------------------
    # Trigger scenario
    # -----------------------------------------------------------------------

    remaining_ticks = max(
        1,
        duration_seconds // 2,
    )

    scenario_mgr.trigger(
        payload.scenario_type,
        duration_ticks=remaining_ticks,
    )

    return {
        "status": "scenario_injected",
        "scenario": payload.scenario_type,
        "duration_seconds": duration_seconds,
        "remaining_ticks": remaining_ticks,
    }


# ===========================================================================
# Historical replay
# ===========================================================================

def _apply_snapshot(
    snapshot,
    station_id: str,
) -> None:
    """
    Apply a historical snapshot while restoring the station-specific
    physical profile.
    """

    simulator.reset_nominal(
        station_id
    )

    scenario_mgr.trigger_replay(
        snapshot
    )

    station_data = snapshot.get(
        "stations",
        {}
    ).get(
        station_id
    )

    if not station_data:
        raise ValueError(
            f"No snapshot data for {station_id}"
        )

    ambient = station_data.get(
        "ambient",
        {}
    )

    simulator.ambient.temp_c = float(
        ambient.get(
            "temp_c",
            simulator.ambient.temp_c,
        )
    )

    simulator.ambient.wind_speed_knots = float(
        ambient.get(
            "wind_speed_knots",
            simulator.ambient.wind_speed_knots,
        )
    )

    simulator.ambient.solar_flux_w_m2 = float(
        ambient.get(
            "solar_flux_w_m2",
            simulator.ambient.solar_flux_w_m2,
        )
    )

    simulator.ambient.pressure_hpa = float(
        ambient.get(
            "pressure_hpa",
            simulator.ambient.pressure_hpa,
        )
    )


# ===========================================================================
# Clock controls
# ===========================================================================

@app.post("/edge/clock")
async def set_clock(
    payload: ClockRequest,
):
    global clock_offset_seconds
    global clock_mode

    clock_mode = payload.mode

    if payload.mode == "LIVE":

        clock_offset_seconds = 0.0

    elif payload.mode == "OFFSET":

        clock_offset_seconds = payload.offset_seconds

    else:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported clock mode: "
                f"{payload.mode}"
            ),
        )

    return {
        "status": "clock_updated",
        "mode": clock_mode,
        "offset_seconds": clock_offset_seconds,
    }


@app.get("/edge/clock/catalog")
async def get_clock_catalog():

    return {
        "presets": clock_catalog()
    }


# ===========================================================================
# Historical replay
# ===========================================================================

@app.post("/edge/replay/2018-08-05")
async def replay_august_2018():

    snapshot = resolve_clock(
        "2018-08-05T18:00:00+00:00"
    )

    _apply_snapshot(
        snapshot=snapshot,
        station_id=simulator.station_id,
    )

    return {
        "status": "replay_active",
        "scenario": snapshot.get(
            "scenario_id"
        ),
        "clock": snapshot.get(
            "clock"
        ),
        "citation": snapshot.get(
            "citation"
        ),
        "station_id": simulator.station_id,
    }


@app.post("/edge/replay/clear")
async def clear_replay():

    scenario_mgr.clear()

    _reset_current_station()

    return {
        "status": "replay_cleared",
        "station": simulator.station_id,
    }


# ===========================================================================
# Station controls
# ===========================================================================

@app.post("/edge/controls")
async def update_controls(
    payload: ControlUpdateRequest,
):
    """
    Update physical station actuator state.
    """

    simulator.controls = (
        simulator.controls.model_copy(
            update=payload.controls
        )
    )

    return {
        "status": "controls_updated",
        "station": simulator.station_id,
        "controls": simulator.controls.model_dump(),
    }


# ===========================================================================
# Station switching
# ===========================================================================

@app.post(
    "/edge/switch-station/{station_id}"
)
async def switch_station(
    station_id: str,
):

    upper_id = station_id.upper()

    if upper_id not in {
        "BHARATI",
        "MAITRI",
    }:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported station. "
                "Expected BHARATI or MAITRI."
            ),
        )

    # Clear any scenario/replay before switching.
    scenario_mgr.clear()

    # Load a completely clean nominal profile for the new station.
    simulator.reset_nominal(
        upper_id
    )

    obs = weather.snapshot(upper_id)
    amb = ambient_from_obs(obs) if obs else None
    if not amb:
        await asyncio.to_thread(weather.refresh, upper_id)
        obs = weather.snapshot(upper_id)
        amb = ambient_from_obs(obs) if obs else None
    if amb:
        simulator.set_live_ambient(amb, "OPEN_METEO_FORECAST")

    return {
        "status": "station_switched",
        "station": upper_id,
    }


# ===========================================================================
# Health
# ===========================================================================

@app.get("/health")
async def health():
    obs = weather.snapshot(simulator.station_id)

    return {
        "status": "ONLINE",
        "service": "station-mock-server",
        "station": simulator.station_id,
        "active_scenario": (
            scenario_mgr.active_scenario
        ),
        "replay_active": (
            scenario_mgr.replay_active
        ),
        "weather": {
            "source": simulator.weather_source,
            "model_time": (obs or {}).get("model_time"),
            "kp": (weather.space or {}).get("kp"),
        },
    }