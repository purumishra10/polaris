"""Deterministic Antarctic SOP prescription engine with Supabase citations."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from supabase import create_client, Client
from models import RawTelemetry, Risk, Severity, SOPCitation

# ----------------------------------------------------------------------------
# Supabase Client Initialization
# ----------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Polaris Warning] Supabase client init failed: {e}")

# Fallback cache in case Supabase network drops or has latency
_LOCAL_CITATION_FALLBACK = {
    "STRUCTURAL": {
        "title": "NCPOR Field Safety Regulations: Extreme Weather & Structural Lockdown",
        "clause": "Section 4.2.1",
        "path": "docs/ncpor_safety_regs_ch4.pdf",
        "action": "ACTION: Engage exterior hatch structural airlock sequence.",
        "excerpt": "When sustained gusts exceed 60 knots or horizontal visibility falls below 50 meters, the station must initiate structural lockdown. Exterior aerodynamic airlocks must be interlocked. All outdoor scientific operations, drone sorties, and vehicle convoys are prohibited."
    },
    "THERMAL": {
        "title": "Bharati Station Microgrid & CHP Thermal Maintenance Handbook",
        "clause": "Section 8.1",
        "path": "docs/bharati_chp_operations_v2.pdf",
        "action": "ACTION: Spin up Standby Auxiliary Generator.",
        "excerpt": "If internal habitat temperature drops below 16.0 degrees Celsius during active wintering while primary CHP output is capped, operators must spin up the standby auxiliary diesel generator to supply secondary hydronic loop heaters and prevent pipe freeze."
    },
    "FUEL_CRIT": {
        "title": "Protocol on Environmental Protection to the Antarctic Treaty: Annex III",
        "clause": "Section 3.4",
        "path": "docs/antarctic_treaty_annex3.pdf",
        "action": "ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde).",
        "excerpt": "When projected fuel reserves drop below 30 days of autonomy prior to seasonal sea-ice opening, the station commander must enforce Stage-1 non-vital load shedding. High-power atmospheric radar (MARA), ionosondes, and sounding arrays must be isolated."
    }
}

def fetch_citation_for_rule(rule_key: str) -> SOPCitation | None:
    """Fetch chunk metadata from Supabase with zero-downtime memory fallback."""
    if supabase:
        try:
            res = supabase.table("knowledge_chunks") \
                .select("heading, content, metadata, knowledge_documents(title, source_path)") \
                .contains("metadata", {"rule_key": rule_key}) \
                .limit(1) \
                .execute()

            if res.data and len(res.data) > 0:
                item = res.data[0]
                doc = item.get("knowledge_documents") or {}
                meta = item.get("metadata") or {}
                return SOPCitation(
                    rule_key=rule_key,
                    document_title=doc.get("title", "Official Antarctic Operations Manual"),
                    clause=item.get("heading") or meta.get("clause", "Section 4.2"),
                    source_path=doc.get("source_path", "docs/ncpor_safety.pdf"),
                    mandated_action=meta.get("action", ""),
                    excerpt=item.get("content", "")
                )
        except Exception as err:
            print(f"[Polaris DB Error] Citation query failed: {err}")

    # Fallback to offline cached definitions
    fallback = _LOCAL_CITATION_FALLBACK.get(rule_key)
    if fallback:
        return SOPCitation(
            rule_key=rule_key,
            document_title=fallback["title"],
            clause=fallback["clause"],
            source_path=fallback["path"],
            mandated_action=fallback["action"],
            excerpt=fallback["excerpt"]
        )
    return None

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
    citations: list[SOPCitation] = field(default_factory=list)  # <--- Added

    def raise_to(self, severity: Severity) -> None:
        if _RANK[severity] > _RANK[self.severity]:
            self.severity = severity

    def add(self, rule_id: str, severity: Severity, actions: list[str]) -> None:
        self.fired.append(rule_id)
        self.raise_to(severity)
        for a in actions:
            if a not in self.actions:
                self.actions.append(a)
        
        # Pull citation for the tripped rule
        citation = fetch_citation_for_rule(rule_id)
        if citation and not any(c.rule_key == rule_id for c in self.citations):
            self.citations.append(citation)

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
        citations=ev.citations if ev.severity != "NOMINAL" else [],  # <--- Added
    )