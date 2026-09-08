from pydantic import BaseModel, Field
from typing import Optional

class AmbientState(BaseModel):
    temp_c: float
    wind_speed_knots: float
    solar_flux_w_m2: float
    pressure_hpa: float = 985.0

class ThermalState(BaseModel):
    internal_temp_c: float
    chp_thermal_output_kw: float
    aux_heater_kw: float
    heat_loss_kw: float

class MicrogridState(BaseModel):
    total_load_kva: float
    essential_load_kva: float
    science_load_kva: float
    comfort_load_kva: float
    chp_capacity_kva: float

class FuelState(BaseModel):
    tank_level_liters: float
    burn_rate_lph: float
    days_of_autonomy: float

class ControlsState(BaseModel):
    science_instruments_online: bool = True
    summer_wing_isolated: bool = False
    hatch_lockdown: bool = False
    aux_generator_active: bool = False

class DayFact(BaseModel):
    label: str
    value: str
    tag: str = ""


class ReplayState(BaseModel):
    active: bool = False
    scenario_id: Optional[str] = None
    clock: Optional[str] = None
    citation: Optional[str] = None
    source_type: Optional[str] = None
    occupancy: Optional[int] = None
    note: Optional[str] = None
    mode: str = "LIVE"
    polar: Optional[str] = None
    season: Optional[str] = None
    voyage_air: Optional[str] = None
    voyage_sea: Optional[str] = None
    isolation: Optional[str] = None
    hazards: list[str] = Field(default_factory=list)
    facts: list[DayFact] = Field(default_factory=list)
    wind_tag: Optional[str] = None
    temp_tag: Optional[str] = None


class LockoutsState(BaseModel):
    outdoor: str = "OPEN"
    heli: str = "OPEN"
    convoy: str = "OPEN"
    field: str = "OPEN"
    reasons: list[str] = Field(default_factory=list)


class RawTelemetryPayload(BaseModel):
    station_id: str
    timestamp: str
    source: str = "synthetic"
    confidence: str = "modeled"
    scenario_id: Optional[str] = None
    ambient: AmbientState
    thermal: ThermalState
    microgrid: MicrogridState
    fuel: FuelState
    controls: ControlsState
    replay: ReplayState = Field(default_factory=ReplayState)
    lockouts: LockoutsState = Field(default_factory=LockoutsState)

class ScenarioInjectRequest(BaseModel):
    scenario_type: str = Field(..., description="BLIZZARD_80KT, RESUPPLY_DELAY, or POLAR_NIGHT")
    duration_seconds: int = 120

class ControlUpdateRequest(BaseModel):
    science_instruments_online: Optional[bool] = None
    summer_wing_isolated: Optional[bool] = None
    hatch_lockdown: Optional[bool] = None
    aux_generator_active: Optional[bool] = None


class ClockRequest(BaseModel):
    clock: Optional[str] = None
    live: bool = False