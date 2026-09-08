"""Ops lockouts from live wind plus optional historical replay snapshot."""
from __future__ import annotations

from models import LockoutsState, RawTelemetry

WIND_BLOWING_SNOW_KT = 23.0
WIND_HELI_KT = 40.0
WIND_CONVOY_KT = 50.0


def compute_lockouts(raw: RawTelemetry) -> LockoutsState:
    """Prefer snapshot lockouts during replay; otherwise derive from wind."""
    if raw.replay and raw.replay.active and raw.lockouts:
        return raw.lockouts

    wind = raw.ambient.wind_speed_knots
    reasons: list[str] = []

    outdoor = "OPEN"
    if wind >= WIND_BLOWING_SNOW_KT:
        outdoor = "LOCKED"
        reasons.append(
            f"Gust {wind:.0f} kn ≥ {WIND_BLOWING_SNOW_KT:.0f} kn IMD blowing-snow threshold"
        )

    heli = "OPEN"
    if wind >= WIND_HELI_KT:
        heli = "LOCKED"
        reasons.append(f"Gust {wind:.0f} kn above helicopter ops")

    convoy = "OPEN"
    if wind >= WIND_CONVOY_KT:
        convoy = "LOCKED"
        reasons.append("Convoy restricted under gale")

    field = outdoor

    return LockoutsState(
        outdoor=outdoor,
        heli=heli,
        convoy=convoy,
        field=field,
        reasons=reasons,
    )
