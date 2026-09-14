"""Indicative replay validation for published IMD Bharati blizzard events.

IMPORTANT — READ BEFORE INTERPRETING RESULTS
=============================================
This module scores each of the 9 published IMD Bharati blizzard events
(MAUSAM 73(3), Thapliyal et al.) against the existing Isolation Forest
and deterministic SOP/lockout rules.

Limitations:
- ambient.wind_speed_knots comes from the IMD event record.
- ambient.temp_c is a repository-derived analog estimate and is NOT an
  independently published temperature observation for the wind-peak timestamp.
- microgrid.total_load_kva, thermal.chp_thermal_output_kw, and
  fuel.burn_rate_lph are SYNTHETIC / PHYSICS-MODELED nominal values.
- The Isolation Forest was trained exclusively on synthetic nominal rows.
  It has never been trained or tested on real Antarctic telemetry.
- Only 9 positive blizzard events are available and there is no non-event
  dataset, so precision / recall / F1 cannot be calculated defensibly.
- Results are therefore labelled "indicative replay validation".

What the results DO tell you:
- Whether the current IF flags the reconstructed event vectors as outliers.
- Whether the canonical operational wind thresholds trigger for each event.
- Which events exceed the 60 kt structural-lockdown threshold.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from anomaly import AnomalyScorer
from lockouts import WIND_BLOWING_SNOW_KT
from sop import WIND_STRUCTURAL_KT


log = logging.getLogger("polaris.validation")


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]

BLIZZARD_LOG_PATH = (
    ROOT
    / "datasets"
    / "geospatial_hazards"
    / "bharati_blizzard_log_imd.json"
)


# ---------------------------------------------------------------------------
# Temperature analogs
# ---------------------------------------------------------------------------
# These values already exist in the repository's historical replay data.
# They are repository-derived analog estimates, NOT independently published
# IMD temperature observations matched to the wind-peak timestamp.
# Source: station-mock-server/clock.py:BLIZZARD_TEMP_C
# ---------------------------------------------------------------------------

BLIZZARD_TEMP_C: dict[str, float] = {
    "BLZ-2017-01": -1.4,
    "BLZ-2018-02": -14.4,
    "BLZ-2018-03": -10.6,
    "BLZ-2018-04": -7.6,
    "BLZ-2018-05": -4.9,
    "BLZ-2018-06": -7.6,
    "BLZ-2018-07": -11.5,
    "BLZ-2018-08": -9.2,
    "BLZ-2018-09": -6.3,
}


# ---------------------------------------------------------------------------
# Synthetic nominal values
# ---------------------------------------------------------------------------
# These values are the centre point of the nominal synthetic distribution
# used by train_isolation_forest.py.
# ---------------------------------------------------------------------------

SYNTHETIC_LOAD_KVA = 360.0
SYNTHETIC_CHP_KW = SYNTHETIC_LOAD_KVA * 0.52
SYNTHETIC_BURN_LPH = SYNTHETIC_LOAD_KVA * 0.22


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class BlizzardValidationResult:
    event_id: str
    station_id: str
    event_start: str
    event_end: str
    duration_hrs: float

    # Historical event information
    observed_max_wind_kn: float
    estimated_temp_c: float
    observed_mslp_hpa: float | None

    # Exact five-feature vector supplied to the Isolation Forest,
    # including provenance tags for every feature.
    if_input: dict[str, Any] = field(default_factory=dict)

    # Isolation Forest output
    if_score: float = 0.0
    if_verdict: str = "UNKNOWN"
    if_model_loaded: bool = False

    # Deterministic operational rules
    sop_severity: str = "NOMINAL"
    sop_outdoor_lockout: str = "OPEN"
    sop_structural_lockout: str = "OPEN"

    # Historical event detection bookkeeping.
    #
    # IMPORTANT:
    # This is deliberately NOT TP/FN because there is no negative/non-event
    # dataset and therefore no defensible confusion matrix.
    event_detection: str = "UNKNOWN"

    provenance: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable representation."""

        return {
            "event_id": self.event_id,
            "station_id": self.station_id,
            "event_start": self.event_start,
            "event_end": self.event_end,
            "duration_hrs": self.duration_hrs,
            "observed": {
                "max_wind_kn": self.observed_max_wind_kn,
                "temp_c_estimated": self.estimated_temp_c,
                "mslp_hpa": self.observed_mslp_hpa,
            },
            "if_input": self.if_input,
            "if_output": {
                "score": self.if_score,
                "verdict": self.if_verdict,
                "model_loaded": self.if_model_loaded,
            },
            "sop_output": {
                "severity": self.sop_severity,
                "outdoor_lockout": self.sop_outdoor_lockout,
                "structural_lockout": self.sop_structural_lockout,
            },
            "validation": {
                "expected_event": "BLIZZARD",
                "event_detection": self.event_detection,
            },
            "provenance": self.provenance,
            "limitations": self.limitations,
        }


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def _load_blizzard_events() -> list[dict[str, Any]]:
    """Load the nine published Bharati blizzard events."""

    if not BLIZZARD_LOG_PATH.exists():
        log.error("Blizzard log not found: %s", BLIZZARD_LOG_PATH)
        return []

    try:
        data = json.loads(
            BLIZZARD_LOG_PATH.read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError) as exc:
        log.error("Failed to load blizzard log: %s", exc)
        return []

    if not isinstance(data, list):
        log.error("Blizzard log must contain a JSON list.")
        return []

    return data


# ---------------------------------------------------------------------------
# Core validation
# ---------------------------------------------------------------------------


def validate_blizzard_event(
    event: dict[str, Any],
    scorer: AnomalyScorer,
    station_id: str = "BHARATI",
) -> BlizzardValidationResult:
    """Score one historical blizzard event against IF and operational rules.

    IF input vector:

    1. ambient.temp_c
       Repository-derived analog estimate.
    2. ambient.wind_speed_knots
       Historical event wind from the IMD event record.
    3. microgrid.total_load_kva
       Synthetic nominal Bharati value.
    4. thermal.chp_thermal_output_kw
       Synthetic nominal Bharati value.
    5. fuel.burn_rate_lph
       Synthetic nominal Bharati value.

    The IF score is therefore indicative rather than empirical validation
    against real station telemetry.
    """

    event_id = str(event["event_id"])

    wind_kn = float(event["max_wind_kn"])

    estimated_temp_c = float(
        BLIZZARD_TEMP_C.get(event_id, -10.0)
    )

    mslp = event.get("lowest_mslp_hpa")

    # -----------------------------------------------------------------------
    # Build the exact five-feature vector expected by the Isolation Forest.
    # -----------------------------------------------------------------------

    x = np.array(
        [
            [
                estimated_temp_c,
                wind_kn,
                SYNTHETIC_LOAD_KVA,
                SYNTHETIC_CHP_KW,
                SYNTHETIC_BURN_LPH,
            ]
        ],
        dtype=float,
    )

    # -----------------------------------------------------------------------
    # Feature provenance
    # -----------------------------------------------------------------------

    if_input = {
        "ambient.temp_c": {
            "value": estimated_temp_c,
            "tag": "ESTIMATED_ANALOG",
        },
        "ambient.wind_speed_knots": {
            "value": wind_kn,
            "tag": "IMD_OBSERVED",
        },
        "microgrid.total_load_kva": {
            "value": SYNTHETIC_LOAD_KVA,
            "tag": "SYNTHETIC_NOMINAL",
        },
        "thermal.chp_thermal_output_kw": {
            "value": SYNTHETIC_CHP_KW,
            "tag": "SYNTHETIC_NOMINAL",
        },
        "fuel.burn_rate_lph": {
            "value": SYNTHETIC_BURN_LPH,
            "tag": "SYNTHETIC_NOMINAL",
        },
    }

    # -----------------------------------------------------------------------
    # Isolation Forest
    # -----------------------------------------------------------------------

    if_score = 0.0
    if_verdict = "UNKNOWN"
    model_loaded = bool(scorer.loaded)

    if model_loaded:
        raw_score = float(
            scorer._model.decision_function(x)[0]
        )

        raw_prediction = int(
            scorer._model.predict(x)[0]
        )

        if_score = round(raw_score, 4)

        if_verdict = (
            "ANOMALY"
            if raw_prediction == -1
            else "INLIER"
        )

    # -----------------------------------------------------------------------
    # Canonical operational thresholds
    # -----------------------------------------------------------------------
    # These use the same constants as the production SOP/lockout modules.
    #
    # Blowing snow / outdoor lockout: >= 23 kt
    # Structural lockdown: > 60 kt
    # -----------------------------------------------------------------------

    sop_outdoor = (
        "LOCKED"
        if wind_kn >= WIND_BLOWING_SNOW_KT
        else "OPEN"
    )

    sop_structural = (
        "LOCKED"
        if wind_kn > WIND_STRUCTURAL_KT
        else "OPEN"
    )

    # -----------------------------------------------------------------------
    # Overall severity
    # -----------------------------------------------------------------------

    if wind_kn > WIND_STRUCTURAL_KT:
        sop_severity = "CRITICAL"

    elif wind_kn >= WIND_BLOWING_SNOW_KT:
        sop_severity = "ADVISORY"

    else:
        sop_severity = "NOMINAL"

    # -----------------------------------------------------------------------
    # Historical event detection
    # -----------------------------------------------------------------------
    # This is NOT labelled TP/FN because there is no negative dataset.
    # It simply tells us whether the IF flagged this known event.
    # -----------------------------------------------------------------------

    if if_verdict == "ANOMALY":
        event_detection = "FLAGGED"

    elif if_verdict == "INLIER":
        event_detection = "NOT_FLAGGED"

    else:
        event_detection = "UNKNOWN"

    # -----------------------------------------------------------------------
    # Provenance
    # -----------------------------------------------------------------------

    provenance = [
        (
            f"wind_kn: IMD MAUSAM 73(3) event record — "
            f"{event_id}"
        ),
        (
            "temp_c: repository-derived analog estimate from "
            "BLIZZARD_TEMP_C in station-mock-server/clock.py"
        ),
        (
            "load/CHP/burn: synthetic Bharati nominal idle values "
            "from train_isolation_forest.py"
        ),
        (
            "SOP thresholds: canonical constants imported from "
            "sop.py and lockouts.py"
        ),
    ]

    # -----------------------------------------------------------------------
    # Limitations
    # -----------------------------------------------------------------------

    limitations = [
        (
            "3 of 5 IF features are physics-modeled rather than observed; "
            "this is indicative replay validation only."
        ),
        (
            "No non-event dataset exists; precision, recall and F1 "
            "cannot be calculated defensibly."
        ),
        (
            "The Isolation Forest was trained on synthetic nominal data "
            "only; empirical calibration on real Antarctic telemetry "
            "is pending."
        ),
        (
            "Hourly wind ramp data is not available in the historical "
            "event record, so lead time cannot be calculated."
        ),
        (
            "The temperature value is a repository-derived event analog "
            "and is not a measurement matched to the wind peak timestamp."
        ),
    ]

    # -----------------------------------------------------------------------
    # Result
    # -----------------------------------------------------------------------

    return BlizzardValidationResult(
        event_id=event_id,
        station_id=station_id,
        event_start=str(event["start_utc"]),
        event_end=str(event["end_utc"]),
        duration_hrs=float(event["duration_hrs"]),
        observed_max_wind_kn=wind_kn,
        estimated_temp_c=estimated_temp_c,
        observed_mslp_hpa=(
            float(mslp)
            if mslp is not None
            else None
        ),
        if_input=if_input,
        if_score=if_score,
        if_verdict=if_verdict,
        if_model_loaded=model_loaded,
        sop_severity=sop_severity,
        sop_outdoor_lockout=sop_outdoor,
        sop_structural_lockout=sop_structural,
        event_detection=event_detection,
        provenance=provenance,
        limitations=limitations,
    )


# ---------------------------------------------------------------------------
# Full historical validation
# ---------------------------------------------------------------------------


def validate_all_blizzard_events(
    scorer: AnomalyScorer,
    station_id: str = "BHARATI",
) -> list[BlizzardValidationResult]:
    """Validate all published Bharati blizzard events."""

    events = _load_blizzard_events()

    return [
        validate_blizzard_event(
            event,
            scorer,
            station_id,
        )
        for event in events
    ]


# ---------------------------------------------------------------------------
# Single-event validation
# ---------------------------------------------------------------------------


def validate_event_by_id(
    event_id: str,
    scorer: AnomalyScorer,
    station_id: str = "BHARATI",
) -> BlizzardValidationResult | None:
    """Validate a single historical event by event ID."""

    events = _load_blizzard_events()

    for event in events:
        if str(event.get("event_id")) == event_id:
            return validate_blizzard_event(
                event,
                scorer,
                station_id,
            )

    return None