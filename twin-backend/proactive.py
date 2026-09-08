"""Proactive hazard forecasting for the Polaris Digital Twin.

This module turns recent telemetry trends into forward-looking operational
advisories. It does not replace the existing risk/SOP engine; it complements
it by answering:

    "What is likely to happen next, and what should the operator do now?"

"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any


@dataclass
class TelemetryPoint:
    timestamp: str

    pressure_hpa: float
    wind_knots: float
    temperature_c: float

    fuel_days: float

    total_load_kva: float
    chp_thermal_kw: float
    heat_loss_kw: float

    link_health: str = "ONLINE"


class ProactiveEngine:
    """Small in-memory trend engine shared by all proactive simulations."""

    WINDOW_SIZE = 8

    def __init__(self) -> None:
        self.history: dict[str, deque[TelemetryPoint]] = {}

    def _history_for(
        self,
        station_id: str,
    ) -> deque[TelemetryPoint]:
        if station_id not in self.history:
            self.history[station_id] = deque(
                maxlen=self.WINDOW_SIZE
            )

        return self.history[station_id]

    @staticmethod
    def _rate(
        older: float,
        newer: float,
        points: int,
        interval_seconds: float = 2.0,
    ) -> float:
        """Return change per minute."""

        if points <= 0:
            return 0.0

        elapsed_minutes = (
            points * interval_seconds
        ) / 60.0

        if elapsed_minutes <= 0:
            return 0.0

        return (
            newer - older
        ) / elapsed_minutes

    @staticmethod
    def _clamp(
        value: float,
        low: float,
        high: float,
    ) -> float:
        return max(
            low,
            min(high, value),
        )

    def update(
        self,
        station_id: str,
        telemetry: Any,
        link_health: str = "ONLINE",
    ) -> dict[str, Any]:
        """Update history and calculate proactive operational state."""

        ambient = telemetry.ambient
        thermal = telemetry.thermal
        microgrid = telemetry.microgrid
        fuel = telemetry.fuel

        scenario_id = getattr(
            telemetry,
            "scenario_id",
            None,
        )

        point = TelemetryPoint(
            timestamp=telemetry.timestamp,
            pressure_hpa=float(
                ambient.pressure_hpa
            ),
            wind_knots=float(
                ambient.wind_speed_knots
            ),
            temperature_c=float(
                ambient.temp_c
            ),
            fuel_days=float(
                fuel.days_of_autonomy
            ),
            total_load_kva=float(
                microgrid.total_load_kva
            ),
            chp_thermal_kw=float(
                thermal.chp_thermal_output_kw
            ),
            heat_loss_kw=float(
                thermal.heat_loss_kw
            ),
            link_health=link_health,
        )

        history = self._history_for(
            station_id
        )

        previous = (
            history[-1]
            if history
            else None
        )

        history.append(point)

        # Not enough data for a meaningful trend yet.
        if previous is None or len(history) < 3:
            return self._nominal_state()

        first = history[0]

        pressure_rate = self._rate(
            first.pressure_hpa,
            point.pressure_hpa,
            len(history) - 1,
        )

        wind_rate = self._rate(
            first.wind_knots,
            point.wind_knots,
            len(history) - 1,
        )

        temperature_rate = self._rate(
            first.temperature_c,
            point.temperature_c,
            len(history) - 1,
        )

        # --------------------------------------------------------------
        # SCENARIO-SPECIFIC PROACTIVE STATES
        # --------------------------------------------------------------

        if scenario_id == "COMMUNICATION_DEGRADATION":
            return {
                "hazard": "COMMUNICATIONS",
                "status": "IMMINENT",
                "eta_minutes": 2.0,
                "confidence": 0.96,
                "link_health": "DEGRADED",
                "recommended_actions": [
                    "Shift command posture to edge autonomy",
                    "Continue local SOP execution",
                    "Queue non-critical HQ commands",
                    "Maintain local safety interlocks",
                ],
            }

        if scenario_id == "MICROGRID_FAILURE":
            load_ratio = (
                point.total_load_kva
                / max(
                    1.0,
                    point.chp_thermal_kw / 0.52,
                )
            )

            thermal_margin = (
                point.chp_thermal_kw
                - point.heat_loss_kw
            )

            return {
                "hazard": "MICROGRID",
                "status": (
                    "ACTIVE"
                    if (
                        load_ratio >= 1.0
                        or thermal_margin < 0
                    )
                    else "IMMINENT"
                ),
                "eta_minutes": 5.0,
                "confidence": 0.93,
                "load_ratio": round(
                    load_ratio,
                    2,
                ),
                "thermal_margin_kw": round(
                    thermal_margin,
                    1,
                ),
                "recommended_actions": [
                    "Pre-spin tertiary auxiliary generator",
                    "Isolate unoccupied station wings",
                    "Shed non-essential electrical loads",
                    "Protect life-support and essential systems",
                ],
            }

        if scenario_id == "RESUPPLY_DELAY":
            fuel_rate = self._rate(
                first.fuel_days,
                point.fuel_days,
                len(history) - 1,
            )

            return {
                "hazard": "RESUPPLY",
                "status": (
                    "IMMINENT"
                    if point.fuel_days < 30
                    else "WATCH"
                ),
                "eta_minutes": round(
                    max(
                        0.0,
                        point.fuel_days - 30.0,
                    )
                    / max(
                        abs(fuel_rate),
                        0.0001,
                    )
                    if fuel_rate < 0
                    else 9999,
                    1,
                ),
                "confidence": 0.94,
                "fuel_days": round(
                    point.fuel_days,
                    1,
                ),
                "fuel_trend_days_per_min": round(
                    fuel_rate,
                    4,
                ),
                "recommended_actions": [
                    "Recalculate resupply transit window",
                    "Shed non-vital loads early",
                    "Preserve essential life-support loads",
                    "Review fuel transfer readiness",
                ],
            }

        # --------------------------------------------------------------
        # 1. BLIZZARD / STORM FORECAST
        # --------------------------------------------------------------

        pressure_drop = (
            first.pressure_hpa
            - point.pressure_hpa
        )

        storm_signal = (
            pressure_drop >= 4.0
            or pressure_rate <= -10.0
            or wind_rate >= 18.0
            or point.wind_knots >= 40.0
        )

        if storm_signal:
            target_wind = 60.0

            if wind_rate > 0:
                seconds_to_threshold = (
                    max(
                        0.0,
                        target_wind
                        - point.wind_knots,
                    )
                    / wind_rate
                    * 60.0
                )
            else:
                seconds_to_threshold = 99999.0

            eta_minutes = self._clamp(
                seconds_to_threshold / 60.0,
                1.0,
                180.0,
            )

            confidence = self._clamp(
                0.55
                + min(
                    0.20,
                    pressure_drop / 30.0,
                )
                + min(
                    0.20,
                    max(
                        0.0,
                        wind_rate,
                    ) / 100.0,
                )
                + (
                    0.10
                    if point.wind_knots >= 40.0
                    else 0.0
                ),
                0.55,
                0.98,
            )

            if point.wind_knots >= 60.0:
                status = "ACTIVE"
            elif eta_minutes <= 10:
                status = "IMMINENT"
            else:
                status = "WATCH"

            if status == "ACTIVE":
                actions = [
                    "Maintain exterior hatch lockdown",
                    "Abort outdoor sorties",
                    "Keep external weather sensors stowed",
                    "Suspend non-essential field activity",
                ]

            elif status == "IMMINENT":
                actions = [
                    "Batten external hatches",
                    "Pre-heat fuel transfer lines",
                    "Stow external weather sensors",
                    "Suspend outdoor sorties",
                ]

            else:
                actions = [
                    "Pre-heat fuel transfer lines",
                    "Batten external hatches",
                    "Prepare external sensor stow sequence",
                    "Review field personnel accountability",
                ]

            return {
                "hazard": "BLIZZARD",
                "status": status,
                "eta_minutes": round(
                    eta_minutes,
                    1,
                ),
                "confidence": round(
                    confidence,
                    2,
                ),
                "pressure_hpa": round(
                    point.pressure_hpa,
                    1,
                ),
                "pressure_trend_hpa_per_min": round(
                    pressure_rate,
                    2,
                ),
                "wind_knots": round(
                    point.wind_knots,
                    1,
                ),
                "wind_trend_kt_per_min": round(
                    wind_rate,
                    2,
                ),
                "temperature_c": round(
                    point.temperature_c,
                    1,
                ),
                "temperature_trend_c_per_min": round(
                    temperature_rate,
                    2,
                ),
                "predicted_wind_knots": target_wind,
                "recommended_actions": actions,
            }

        # --------------------------------------------------------------
        # 2. RESUPPLY / AUTONOMY FORECAST
        # --------------------------------------------------------------

        if point.fuel_days < 45.0:
            fuel_rate = self._rate(
                first.fuel_days,
                point.fuel_days,
                len(history) - 1,
            )

            if fuel_rate < 0:
                days_to_30 = max(
                    0.0,
                    (
                        point.fuel_days
                        - 30.0
                    )
                    / abs(fuel_rate),
                )

                return {
                    "hazard": "RESUPPLY",
                    "status": (
                        "WATCH"
                        if point.fuel_days > 30
                        else "IMMINENT"
                    ),
                    "eta_minutes": round(
                        days_to_30
                        * 24
                        * 60,
                        1,
                    ),
                    "confidence": 0.88,
                    "fuel_days": round(
                        point.fuel_days,
                        1,
                    ),
                    "fuel_trend_days_per_min": round(
                        fuel_rate,
                        4,
                    ),
                    "recommended_actions": [
                        "Project next resupply transit window",
                        "Review non-vital load shedding",
                        "Preserve essential life-support loads",
                    ],
                }

        # --------------------------------------------------------------
        # 3. MICROGRID / THERMAL FORECAST
        # --------------------------------------------------------------

        capacity = max(
            1.0,
            float(
                microgrid.chp_capacity_kva
            ),
        )

        load_ratio = (
            point.total_load_kva
            / capacity
        )

        thermal_margin = (
            point.chp_thermal_kw
            - point.heat_loss_kw
        )

        if (
            load_ratio >= 0.85
            or thermal_margin <= 0
        ):
            return {
                "hazard": "MICROGRID",
                "status": "WATCH",
                "eta_minutes": 15.0,
                "confidence": 0.82,
                "load_ratio": round(
                    load_ratio,
                    2,
                ),
                "thermal_margin_kw": round(
                    thermal_margin,
                    1,
                ),
                "recommended_actions": [
                    "Pre-spin tertiary auxiliary generator",
                    "Isolate unoccupied station wings",
                    "Review non-essential electrical loads",
                ],
            }

        # --------------------------------------------------------------
        # 4. COMMUNICATION / EDGE AUTONOMY
        # --------------------------------------------------------------

        if link_health == "DEGRADED":
            return {
                "hazard": "COMMUNICATIONS",
                "status": "WATCH",
                "eta_minutes": 5.0,
                "confidence": 0.90,
                "recommended_actions": [
                    "Shift command posture to edge autonomy",
                    "Continue local SOP execution",
                    "Queue non-critical HQ commands",
                ],
            }

        return self._nominal_state()

    @staticmethod
    def _nominal_state() -> dict[str, Any]:
        return {
            "hazard": "NONE",
            "status": "CLEAR",
            "eta_minutes": None,
            "confidence": 0.0,
            "pressure_hpa": None,
            "pressure_trend_hpa_per_min": 0.0,
            "wind_knots": None,
            "wind_trend_kt_per_min": 0.0,
            "predicted_wind_knots": None,
            "recommended_actions": [],
        }