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

def citation_backend() -> str:
    """supabase when credentials are configured, otherwise the local SOP cache."""
    return "supabase" if supabase else "local"


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
    "WX_WATCH": {
        "title": "NCPOR Field Safety Regulations: Extreme Weather & Structural Lockdown",
        "clause": "Section 4.2.1 (watch / pre-lockout)",
        "path": "docs/ncpor_safety_regs_ch4.pdf",
        "action": "ACTION: Prepare outdoor stow — lockout likely within 6 h.",
        "excerpt": "When forecast or rising winds approach the 23-knot blowing-snow threshold, field parties must be recalled or held and outdoor instrument stow sequences prepared before gusts lock the station.",
    },
    "FUEL_ADV": {
        "title": "Protocol on Environmental Protection to the Antarctic Treaty: Annex III",
        "clause": "Section 3.4 (advisory)",
        "path": "docs/antarctic_treaty_annex3.pdf",
        "action": "ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde).",
        "excerpt": "When projected fuel reserves drop below 30 days of autonomy, Stage-1 load shedding applies: isolate unoccupied summer modules and drop non-vital science before the 15-day critical floor."
    },
    "FUEL_CRIT": {
        "title": "Protocol on Environmental Protection to the Antarctic Treaty: Annex III",
        "clause": "Section 3.4",
        "path": "docs/antarctic_treaty_annex3.pdf",
        "action": "ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde).",
        "excerpt": "When projected fuel reserves drop below 15 days of autonomy prior to seasonal sea-ice opening, the station commander must enforce Stage-1 non-vital load shedding. High-power atmospheric radar (MARA), ionosondes, and sounding arrays must be isolated."
    },
    "STARVE": {
        "title": "AL/02 voyage logistics / PolarIS fuel mass balance",
        "clause": "Fuel vs delayed ETA",
        "path": "docs/al02_voyage.pdf",
        "action": "ACTION: Fuel empties before the ship — shed science, isolate summer, essential-only plant.",
        "excerpt": "If modeled days of autonomy are less than days until the voyage ship is in the bay, the farm is in a fuel gap. Essential bus only until resupply or until the tank is empty."
    },
    "MISS_SEA": {
        "title": "43rd ISEA / AL/02 sea-window close",
        "clause": "15 Mar hard exit / Quilty Feb close",
        "path": "docs/43isea_al02.pdf",
        "action": "ACTION: Missed sea call — no bulk JET A-1 until the next seasonal window.",
        "excerpt": "One ship serves Bharati then Maitri. If delayed ETA is after the published sea-window close, bulk resupply is missed for that station until the next season."
    },
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
ACTION_WX_WATCH = "ACTION: Prepare outdoor stow — lockout likely within 6 h."

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

def build_risk(
    raw: RawTelemetry,
    anomaly_score: float,
    if_outlier: bool,
    forecast: dict | None = None,
) -> Risk:
    """SOP rules plus a weather WATCH. Isolation Forest does not set live severity."""
    ev = evaluate_rules(raw)
    forecast = forecast or {}
    wx_status = str(forecast.get("status") or "CLEAR")

    if (
        wx_status in {"WATCH", "IMMINENT"}
        and ev.severity == "NOMINAL"
        and raw.ambient.wind_speed_knots <= WIND_STRUCTURAL_KT
    ):
        ev.add("WX_WATCH", "ADVISORY", [ACTION_WX_WATCH])

    _ = if_outlier  # retained for traces; not used for operator severity
    is_anomaly = ev.severity != "NOMINAL"
    actions = ev.actions if ev.severity != "NOMINAL" else []
    driver = "nominal"
    if "STRUCTURAL" in ev.fired:
        driver = "structural"
    elif "THERMAL" in ev.fired:
        driver = "thermal"
    elif any(key in ev.fired for key in ("FUEL_CRIT", "FUEL_ADV", "STARVE", "MISS_SEA")):
        driver = "fuel"
    elif "WX_WATCH" in ev.fired:
        driver = "nowcast"

    score = forecast.get("p_lockout_23") if driver == "nowcast" else anomaly_score
    if score is None:
        score = anomaly_score

    return Risk(
        anomaly_score=round(float(score or 0), 3),
        is_anomaly=is_anomaly,
        severity=ev.severity,
        driver=driver,
        prescribed_actions=actions,
        citations=ev.citations if ev.severity != "NOMINAL" else [],
    )