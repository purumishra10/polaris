from pydantic import BaseModel, Field
from typing import Optional

class AmbientState(BaseModel):
    temp_c: float
    wind_speed_knots: float
    solar_flux_w_m2: float

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

class RawTelemetryPayload(BaseModel):
    station_id: str
    timestamp: str
    source: str = "synthetic"
    confidence: str = "modeled"
    ambient: AmbientState
    thermal: ThermalState
    microgrid: MicrogridState
    fuel: FuelState
    controls: ControlsState

class ScenarioInjectRequest(BaseModel):
    scenario_type: str = Field(..., description="BLIZZARD_80KT, RESUPPLY_DELAY, or POLAR_NIGHT")
    duration_seconds: int = 120

class ControlUpdateRequest(BaseModel):
    science_instruments_online: Optional[bool] = None
    summer_wing_isolated: Optional[bool] = None
    hatch_lockdown: Optional[bool] = None
    aux_generator_active: Optional[bool] = None