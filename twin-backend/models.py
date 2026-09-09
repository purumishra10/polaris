"""Pydantic v2 contracts for the Polaris Digital Twin Engine.

The HQ (port 8000) schema is a strict superset of the edge (port 8001) raw
schema: it adds `link_status` and `risk`. Shapes are duplicated here on purpose
so this service never imports from station-mock-server.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


StationId = Literal["BHARATI", "MAITRI"]

Severity = Literal[
    "NOMINAL",
    "ADVISORY",
    "CRITICAL",
]

LinkHealth = Literal[
    "ONLINE",
    "DEGRADED",
]

ScenarioType = Literal[
    "BLIZZARD_80KT",
    "RESUPPLY_DELAY",
    "POLAR_NIGHT",
    "MICROGRID_FAILURE",
    "COMMUNICATION_DEGRADATION",
]


VALID_STATIONS: tuple[str, ...] = (
    "BHARATI",
    "MAITRI",
)

VALID_SCENARIOS: tuple[str, ...] = (
    "BLIZZARD_80KT",
    "RESUPPLY_DELAY",
    "POLAR_NIGHT",
    "MICROGRID_FAILURE",
    "COMMUNICATION_DEGRADATION",
)


# --------------------------------------------------------------------------- #
# Edge (raw) sub-states — pass-through
# --------------------------------------------------------------------------- #

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
    hazards: list[str] = Field(
        default_factory=list
    )
    facts: list[DayFact] = Field(
        default_factory=list
    )
    wind_tag: Optional[str] = None
    temp_tag: Optional[str] = None


class LockoutsState(BaseModel):
    outdoor: str = "OPEN"
    heli: str = "OPEN"
    convoy: str = "OPEN"
    field: str = "OPEN"
    reasons: list[str] = Field(
        default_factory=list
    )


class RawTelemetry(BaseModel):
    """Exactly what GET /edge/raw-telemetry returns."""

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
    replay: ReplayState = Field(
        default_factory=ReplayState
    )
    lockouts: LockoutsState = Field(
        default_factory=LockoutsState
    )


# --------------------------------------------------------------------------- #
# HQ enrichment
# --------------------------------------------------------------------------- #

class LinkStatus(BaseModel):
    type: str = "C-band/LEO"
    latency_ms: int
    health: LinkHealth


class SOPCitation(BaseModel):
    rule_key: str = ""
    document_title: str
    clause: str
    source_path: str
    mandated_action: str
    excerpt: str


class Risk(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    severity: Severity
    prescribed_actions: list[str] = Field(
        default_factory=list
    )
    citations: list[SOPCitation] = Field(
        default_factory=list
    )


class StationTelemetry(RawTelemetry):
    """Canonical enriched payload streamed to the frontend."""

    link_status: LinkStatus
    risk: Risk
    proactive: dict = Field(
        default_factory=dict
    )


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #

class ControlUpdateRequest(BaseModel):
    science_instruments_online: Optional[bool] = None
    summer_wing_isolated: Optional[bool] = None
    hatch_lockdown: Optional[bool] = None
    aux_generator_active: Optional[bool] = None


class ClockRequest(BaseModel):
    clock: Optional[str] = None
    live: bool = False


class ScenarioInjectRequest(BaseModel):
    """Accepts both the official body and the current frontend alias body.

    Official : {"scenario_type": "...", "duration_seconds": 60}
    Alias    : {"station_id": "BHARATI", "scenario": "..."}
    """

    scenario_type: Optional[str] = None
    scenario: Optional[str] = None
    duration_seconds: int = 120
    station_id: Optional[str] = None

    @model_validator(mode="after")
    def _normalise(
        self,
    ) -> "ScenarioInjectRequest":
        raw = (
            self.scenario_type
            or self.scenario
        )

        if not raw:
            raise ValueError(
                "scenario_type is required"
            )

        key = raw.strip().upper()

        if key not in VALID_SCENARIOS:
            raise ValueError(
                "scenario_type must be one of "
                f"{list(VALID_SCENARIOS)}"
            )

        self.scenario_type = key
        self.scenario = key

        if self.station_id:
            self.station_id = (
                self.station_id.strip().upper()
            )

        if self.duration_seconds <= 0:
            self.duration_seconds = 120

        return self


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #

class ControlsAckResponse(BaseModel):
    status: Literal[
        "acknowledged"
    ] = "acknowledged"
    station_id: str
    active_controls: ControlsState


class ScenarioInjectResponse(BaseModel):
    status: Literal[
        "scenario_injected"
    ] = "scenario_injected"
    scenario: str
    duration_seconds: int


class StationSwitchResponse(BaseModel):
    status: Literal[
        "switched"
    ] = "switched"
    station_id: str


class TwinHealthResponse(BaseModel):
    status: str
    station_id: Optional[str]
    edge_reachable: bool
    model_loaded: bool
    last_ingest_utc: Optional[str]
    connected_clients: int
    consecutive_edge_failures: int
