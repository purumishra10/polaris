"""Deterministic Antarctic SOP prescription engine.

No ML in this file. Evaluates every tick on the raw edge numbers plus the
Isolation Forest outlier flag, and returns the `risk` block.

Severity ordering: CRITICAL > ADVISORY > NOMINAL.
Action strings are part of the frontend contract — do not reword.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from models import RawTelemetry, Risk, Severity

_RANK: dict[str, int] = {"NOMINAL": 0, "ADVISORY": 1, "CRITICAL": 2}

# Locked action strings ------------------------------------------------------
ACTION_HATCH = "ACTION: Engage exterior hatch structural airlock sequence."
ACTION_STOW_SENSORS = "ACTION: Stow external weather sensors & abort outdoor sorties."
ACTION_AUX_GEN = "ACTION: Spin up Standby Auxiliary Generator."
ACTION_SHED_SCIENCE = "ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)."
ACTION_ISOLATE_DEPRESSURIZE = "ACTION: Isolate and depressurize unoccupied summer modules."
ACTION_ISOLATE_SUMMER = "ACTION: Isolate unoccupied summer residential modules."
ACTION_REVIEW_IF = "ACTION: Review Isolation Forest outlier against baseline polar ops."

# Locked thresholds ----------------------------------------------------------
WIND_STRUCTURAL_KT = 60.0
INTERNAL_TEMP_COLLAPSE_C = 16.0
FUEL_CRITICAL_DAYS = 15.0
FUEL_ADVISORY_DAYS = 30.0


@dataclass
class SopEvaluation:
    severity: Severity = "NOMINAL"
    actions: list[str] = field(default_factory=list)
    fired: list[str] = field(default_factory=list)

    def raise_to(self, severity: Severity) -> None:
        if _RANK[severity] > _RANK[self.severity]:
            self.severity = severity

    def add(self, rule_id: str, severity: Severity, actions: list[str]) -> None:
        self.fired.append(rule_id)
        self.raise_to(severity)
        for a in actions:
            if a not in self.actions:
                self.actions.append(a)


def evaluate_rules(raw: RawTelemetry) -> SopEvaluation:
    """Apply the Antarctic emergency rule matrix (SOP rules only, no ML)."""
    ev = SopEvaluation()

    if raw.ambient.wind_speed_knots > WIND_STRUCTURAL_KT:
        ev.add("STRUCTURAL", "CRITICAL", [ACTION_HATCH, ACTION_STOW_SENSORS])

    if raw.thermal.internal_temp_c < INTERNAL_TEMP_COLLAPSE_C:
        ev.add("THERMAL", "CRITICAL", [ACTION_AUX_GEN])

    days = raw.fuel.days_of_autonomy
    if days < FUEL_CRITICAL_DAYS:
        ev.add("FUEL_CRIT", "CRITICAL", [ACTION_SHED_SCIENCE, ACTION_ISOLATE_DEPRESSURIZE])
    elif days < FUEL_ADVISORY_DAYS:
        ev.add("FUEL_ADV", "ADVISORY", [ACTION_SHED_SCIENCE, ACTION_ISOLATE_SUMMER])

    return ev


def build_risk(raw: RawTelemetry, anomaly_score: float, if_outlier: bool) -> Risk:
    """Merge SOP evaluation with the Isolation Forest result into the `risk` block."""
    ev = evaluate_rules(raw)

    if if_outlier and not ev.fired:
        ev.add("ML_ONLY", "ADVISORY", [ACTION_REVIEW_IF])

    is_anomaly = bool(if_outlier or ev.severity != "NOMINAL")
    actions = ev.actions if ev.severity != "NOMINAL" else []

    return Risk(
        anomaly_score=round(float(anomaly_score), 3),
        is_anomaly=is_anomaly,
        severity=ev.severity,
        prescribed_actions=actions,
    )
