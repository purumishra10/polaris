"""Polaris station-ops agent. Looks up live twin + knowledge, then returns speech + UI actions."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from openai import OpenAI

import briefing
import knowledge
import rag
import twin_client

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
MODEL_NAME = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")
FALLBACK_MODELS = [
    MODEL_NAME,
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-120b",
]

SUBSYSTEMS = {
    "FUEL",
    "MICROGRID",
    "STRUCTURE",
    "ROOF",
    "COMMUNICATIONS",
    "SAFETY",
    "CONTAINERS",
    "UTILITIES",
    "VEHICLES",
    "WATER",
    "THERMAL",
}

MAITRI_ONLY = {"STRUCTURE", "FUEL", "MICROGRID", "THERMAL", "COMMUNICATIONS", "SAFETY"}
BHARATI_ONLY = {"ROOF", "CONTAINERS", "UTILITIES", "VEHICLES", "WATER"}

SCENARIOS = {
    "BLIZZARD_80KT",
    "RESUPPLY_DELAY",
    "POLAR_NIGHT",
    "NOMINAL",
}

PERSONA = """You are Polar, station intelligence for PolarIS at NCPOR — a calm male ops officer in the user's ear. You watch Bharati and Maitri. You answer, then you move the desk. You are not a chatbot that only talks.

You are NOT a clinic receptionist. Never mention appointments, doctors, patients, Lumina, booking, or healthcare. Never mention SSML, speak version, XML, or how TTS works.

How you speak:
- Compact, certain, Jarvis-like: "Done. Fuel is two hundred and twenty days. I've opened the farm."
- Speak every headline number they asked for. Fuel: tank liters, kiloliters, burn, days. Weather: temp, wind, indoor. Power: loads and plant size.
- Do NOT mention satellite link, latency, C-band, or "connection" unless they asked about comms or the radome.
- Two to four short sentences. Contractions. No markdown, bullets, emoji, or shouting in caps.
- Confirm the action you took. If you opened MAP, say so. If you injected a blizzard, say the SOP is on screen.
- Never read JSON keys.

Numbers come from LIVE TELEMETRY. Don't invent tank liters, kVA, wind, or occupancy. Slight rounding is fine.

- NEVER say Maitri-II generator count is unpublished. Maitri-II is 6 CHP units x 100-125 kVA (600-750 kVA total) and ~600,000 L JET A-1 from the NCPOR brief.
- Current (legacy) Maitri generator kVA and tank liters ARE unpublished. Do not invent those.

Always attach UI actions. Talking without actions is a failure.

When STATION KNOWLEDGE is present, answer from those passages and name the source (AL/02, IMD MAUSAM, Maitri-II brief). Do not replace a knowledge answer with live weather unless they asked for live numbers.

Clock:
- August 5 / 5 Aug 2018 → replay_2018 + BHARATI + show_telemetry + STRUCTURE. Eighty-knot gust. Do not quote live wind. Do NOT inject BLIZZARD_80KT for that historical day.
- live now → live_now.

Orders:
- map / GIS / ship / ice → set_hud_tab map + show_telemetry
- calendar / polar day / windows → set_hud_tab climate
- sitrep / export pdf / situation report → export_sitrep
- blizzard (not August 5) → inject BLIZZARD_80KT
- resupply slip → RESUPPLY_DELAY
- Fuel → FUEL. Power → MICROGRID. Weather → STRUCTURE. Comms → COMMUNICATIONS.

Return ONLY JSON:
{"reply":"...","actions":[...]}

Allowed action objects:
{"type":"select_station","station":"BHARATI"|"MAITRI"}
{"type":"select_subsystem","subsystem":"FUEL"|"MICROGRID"|"STRUCTURE"|"ROOF"|"COMMUNICATIONS"|"SAFETY"|"CONTAINERS"|"UTILITIES"|"VEHICLES"|"WATER"|"THERMAL"}
{"type":"camera_preset","preset":"droneAerial"|"fuelFarm"|"hero"|"radomeRidge"|"meltPond"|"groundVcolumns"|"roofTerrace"|"containerVillage"|"undercroft"|"spin360"|"groundAccess"|"roofTechnical"}
{"type":"thermal_view","enabled":true|false}
{"type":"inject_scenario","scenario":"BLIZZARD_80KT"|"RESUPPLY_DELAY"|"POLAR_NIGHT"|"NOMINAL"}
{"type":"set_controls","controls":{"science_instruments_online":bool,"summer_wing_isolated":bool,"hatch_lockdown":bool,"aux_generator_active":bool}}
{"type":"live_now"}
{"type":"replay_2018"}
{"type":"set_clock","clock":"2018-08-05T18:00:00+00:00"}
{"type":"show_telemetry","enabled":true|false}
{"type":"set_hud_tab","tab":"live"|"climate"|"dossier"|"map"}
{"type":"export_sitrep"}
{"type":"close_brief"}

Do not send camera_preset together with select_subsystem.
If uplink is down: "Twin engine is not answering. I still have the station notes." Never mention a healthy connection to fill space.
"""


def _client() -> OpenAI | None:
    if GROQ_API_KEY:
        return OpenAI(base_url="https://api.groq.com/openai/v1", api_key=GROQ_API_KEY)
    try:
        return OpenAI(base_url="http://127.0.0.1:11434/v1", api_key="ollama")
    except Exception:
        return None


def _sanitize(text: str) -> str:
    if not isinstance(text, str):
        return ""
    cleaned = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t").strip()
    return cleaned[:800]


def _norm_subsystem(value: str | None) -> str | None:
    if not value:
        return None
    key = str(value).strip().upper().replace(" ", "_")
    aliases = {
        "POWER": "MICROGRID",
        "CHP": "MICROGRID",
        "GENERATOR": "MICROGRID",
        "GRID": "MICROGRID",
        "TANK": "FUEL",
        "DIESEL": "FUEL",
        "JET": "FUEL",
        "WEATHER": "STRUCTURE",
        "WIND": "STRUCTURE",
        "ENVELOPE": "STRUCTURE",
        "COMMS": "COMMUNICATIONS",
        "RADOME": "COMMUNICATIONS",
        "LINK": "COMMUNICATIONS",
        "HELIPAD": "SAFETY",
        "LOCKOUT": "SAFETY",
        "ISO": "CONTAINERS",
        "CAMP": "CONTAINERS",
        "PIPE": "UTILITIES",
        "FLEET": "VEHICLES",
        "POND": "WATER",
        "RO": "WATER",
        "HEAT": "THERMAL",
    }
    key = aliases.get(key, key)
    return key if key in SUBSYSTEMS else None


HISTORICAL_RE = re.compile(
    r"aug(?:ust)?\s*5(?:th)?|"
    r"5(?:th)?\s*(?:of\s*)?aug|"
    r"august\s+2018|"
    r"2018[-\s]?08[-\s]?05|"
    r"\breplay\b|"
    r"historical\s+(?:data|gust|clock|replay|day)|"
    r"imd\s+gust|"
    r"gust event|"
    r"fifth\s+(?:of\s+)?august",
    re.I,
)

CAMERA_PHRASES = (
    (r"drone|aerial overview|top down", "droneAerial"),
    (r"radome|c-band dish", "radomeRidge"),
    (r"melt pond|the pond", "meltPond"),
    (r"fuel farm camera|look at the tanks", "fuelFarm"),
    (r"v-?columns|stilts", "groundVcolumns"),
    (r"iso yard|container village", "containerVillage"),
    (r"undercroft", "undercroft"),
    (r"\b360\b|spin around", "spin360"),
    (r"stairs|ground access", "groundAccess"),
)


def _is_historical(text: str) -> bool:
    return bool(HISTORICAL_RE.search(text))


def keyword_actions(user_text: str) -> list[dict[str, Any]]:
    text = user_text.lower()
    actions: list[dict[str, Any]] = []

    if re.search(r"live now|back to present|exit replay|present time|leave historical", text):
        actions.append({"type": "live_now"})
        actions.append({"type": "show_telemetry", "enabled": True})
        return _dedupe(actions)

    if _is_historical(text):
        actions.append({"type": "replay_2018"})
        actions.append({"type": "select_station", "station": "BHARATI"})
        actions.append({"type": "show_telemetry", "enabled": True})
        if re.search(r"fuel|tank|autonomy", text):
            actions.append({"type": "select_subsystem", "subsystem": "FUEL"})
        elif re.search(r"heli|lockout|safety", text):
            actions.append({"type": "select_subsystem", "subsystem": "SAFETY"})
        else:
            actions.append({"type": "select_subsystem", "subsystem": "STRUCTURE"})
        return _dedupe(actions)

    if re.search(r"\bmaitri\b", text) and not re.search(r"maitri-?ii|maitri 2", text):
        if re.search(r"switch|go to|show|open|fly", text) or text.strip() in {
            "maitri",
            "switch to maitri",
        }:
            actions.append({"type": "select_station", "station": "MAITRI"})
    if re.search(r"\bbharati\b", text):
        if re.search(r"switch|go to|show|open|fly", text) or text.strip() in {
            "bharati",
            "switch to bharati",
        }:
            actions.append({"type": "select_station", "station": "BHARATI"})

    inject = bool(re.search(r"inject|run scenario|simulate|start a|fire the", text))
    if inject and re.search(r"blizzard|80\s*kn|80\s*knot", text):
        actions.append({"type": "inject_scenario", "scenario": "BLIZZARD_80KT"})
        actions.append({"type": "select_subsystem", "subsystem": "STRUCTURE"})
        return _dedupe(actions)
    if re.search(r"\bblizzard\b", text) and not _is_historical(text):
        actions.append({"type": "inject_scenario", "scenario": "BLIZZARD_80KT"})
        actions.append({"type": "select_subsystem", "subsystem": "STRUCTURE"})
        return _dedupe(actions)
    if re.search(r"resupply|fuel cliff|starve the farm", text):
        actions.append({"type": "inject_scenario", "scenario": "RESUPPLY_DELAY"})
        actions.append({"type": "select_subsystem", "subsystem": "FUEL"})
        return _dedupe(actions)
    if re.search(r"polar night", text) and not re.search(r"calendar|window|chip", text):
        actions.append({"type": "inject_scenario", "scenario": "POLAR_NIGHT"})
        actions.append({"type": "select_subsystem", "subsystem": "STRUCTURE"})
        return _dedupe(actions)
    if re.search(r"\bnominal\b|clear scenario|reset scenario|back to normal", text):
        actions.append({"type": "inject_scenario", "scenario": "NOMINAL"})
        return _dedupe(actions)

    if re.search(r"hide data|hide telemetry|close data", text):
        actions.append({"type": "show_telemetry", "enabled": False})
    elif re.search(r"show data|show telemetry|show stats|show the details|show details", text):
        actions.append({"type": "show_telemetry", "enabled": True})

    if re.search(
        r"\bmap\b|gis|ship track|where(?:'s| is) the ship|ice overlay|logistics map",
        text,
    ):
        actions.append({"type": "show_telemetry", "enabled": True})
        actions.append({"type": "set_hud_tab", "tab": "map"})
        actions.append({"type": "close_brief"})
    elif re.search(r"calendar|polar (?:day|night)|access window|open season", text):
        actions.append({"type": "show_telemetry", "enabled": True})
        actions.append({"type": "set_hud_tab", "tab": "climate"})
    elif re.search(r"dossier|knowledge base|papers guide", text):
        actions.append({"type": "show_telemetry", "enabled": True})
        actions.append({"type": "set_hud_tab", "tab": "dossier"})
    elif re.search(r"live tab|station analysis live", text):
        actions.append({"type": "show_telemetry", "enabled": True})
        actions.append({"type": "set_hud_tab", "tab": "live"})

    if re.search(r"sitrep|situation report|export pdf|download (?:the )?report", text):
        actions.append({"type": "show_telemetry", "enabled": True})
        actions.append({"type": "export_sitrep"})

    if re.search(r"close the brief|close overlay|deselect", text):
        actions.append({"type": "close_brief"})

    if re.search(r"thermal view on|heat overlay|thermal overlay", text):
        actions.append({"type": "thermal_view", "enabled": True})
    elif re.search(r"thermal view off|normal view|rgb view", text):
        actions.append({"type": "thermal_view", "enabled": False})

    for pattern, preset in CAMERA_PHRASES:
        if re.search(pattern, text):
            actions.append({"type": "camera_preset", "preset": preset})
            break

    controls: dict[str, bool] = {}
    if re.search(r"unlock hatch|open hatch|clear hatch", text):
        controls["hatch_lockdown"] = False
    elif re.search(r"lock hatch|hatch lockdown|seal hatch", text):
        controls["hatch_lockdown"] = True
    if re.search(r"shed science|science off|kill science", text):
        controls["science_instruments_online"] = False
    elif re.search(r"science on|bring science|restore science", text):
        controls["science_instruments_online"] = True
    if re.search(r"isolate summer|shut summer wing", text):
        controls["summer_wing_isolated"] = True
    elif re.search(r"restore summer|open summer wing", text):
        controls["summer_wing_isolated"] = False
    if re.search(r"start aux|spin up aux|aux generator on", text):
        controls["aux_generator_active"] = True
    elif re.search(r"stop aux|aux generator off", text):
        controls["aux_generator_active"] = False
    if controls:
        actions.append({"type": "set_controls", "controls": controls})

    subsystem = None
    if re.search(r"fuel|tank|autonomy|jet a|diesel|burn rate", text):
        subsystem = "FUEL"
    elif re.search(r"power|microgrid|chp|generator|kva|load shed|electrical", text):
        subsystem = "MICROGRID"
    elif re.search(r"thermal|heat loss|internal temp|waste heat", text):
        subsystem = "THERMAL"
    elif re.search(r"weather|wind|ambient|temperature|blizzard outside|katabatic", text):
        subsystem = "STRUCTURE"
    elif re.search(r"roof|hvac|terrace|solar", text):
        subsystem = "ROOF"
    elif re.search(r"comm|radome|c-band|latency|uplink|link status", text):
        subsystem = "COMMUNICATIONS"
    elif re.search(r"heli|helipad|lockout|safety|sortie", text):
        subsystem = "SAFETY"
    elif re.search(r"container|iso village|summer camp", text):
        subsystem = "CONTAINERS"
    elif re.search(r"pipe|utilit|aux heat", text):
        subsystem = "UTILITIES"
    elif re.search(r"vehicle|pisten|fleet|convoy", text):
        subsystem = "VEHICLES"
    elif re.search(r"water|melt pond|reverse osmosis|\bro\b", text):
        subsystem = "WATER"
    elif re.search(r"risk|alert|anomaly|sop|severity|prescrib", text):
        subsystem = "FUEL"

    if subsystem:
        actions.append({"type": "select_subsystem", "subsystem": subsystem})

    return _dedupe(actions)


ACTION_ORDER = (
    "live_now",
    "replay_2018",
    "set_clock",
    "inject_scenario",
    "set_controls",
    "select_station",
    "show_telemetry",
    "set_hud_tab",
    "export_sitrep",
    "close_brief",
    "thermal_view",
    "camera_preset",
    "select_subsystem",
)


def _sort_actions(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rank = {name: index for index, name in enumerate(ACTION_ORDER)}
    return sorted(actions, key=lambda item: rank.get(item.get("type"), 99))


def _dedupe(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for action in actions:
        key = json.dumps(action, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        out.append(action)
    return out


def sanitize_actions(actions: Any, user_text: str = "") -> list[dict[str, Any]]:
    if not isinstance(actions, list):
        return []
    clean: list[dict[str, Any]] = []
    has_subsystem = False
    for raw in actions:
        if not isinstance(raw, dict):
            continue
        kind = str(raw.get("type") or "").strip()
        if kind == "select_station":
            station = str(raw.get("station") or "").upper()
            if station in {"BHARATI", "MAITRI"}:
                clean.append({"type": "select_station", "station": station})
        elif kind == "select_subsystem":
            subsystem = _norm_subsystem(raw.get("subsystem"))
            if subsystem:
                clean.append({"type": "select_subsystem", "subsystem": subsystem})
                has_subsystem = True
        elif kind == "camera_preset":
            preset = str(raw.get("preset") or "").strip()
            if preset and not has_subsystem:
                clean.append({"type": "camera_preset", "preset": preset})
        elif kind == "thermal_view":
            clean.append({"type": "thermal_view", "enabled": bool(raw.get("enabled"))})
        elif kind == "inject_scenario":
            scenario = str(raw.get("scenario") or "").upper()
            if scenario in SCENARIOS:
                clean.append({"type": "inject_scenario", "scenario": scenario})
        elif kind == "set_controls":
            controls = raw.get("controls") if isinstance(raw.get("controls"), dict) else {}
            mentioned: dict[str, bool] = {}
            lowered = user_text.lower()
            key_map = (
                (r"hatch", "hatch_lockdown"),
                (r"science", "science_instruments_online"),
                (r"summer", "summer_wing_isolated"),
                (r"aux", "aux_generator_active"),
            )
            for pattern, key in key_map:
                if re.search(pattern, lowered) and key in controls:
                    mentioned[key] = bool(controls[key])
            if mentioned:
                clean.append({"type": "set_controls", "controls": mentioned})
        elif kind == "live_now":
            clean.append({"type": "live_now"})
        elif kind == "replay_2018":
            clean.append({"type": "replay_2018"})
        elif kind == "set_clock":
            clock = str(raw.get("clock") or "").strip()
            if "2018-08-05" in clock:
                clean.append({"type": "replay_2018"})
            elif clock:
                clean.append({"type": "set_clock", "clock": clock})
        elif kind == "show_telemetry":
            clean.append({"type": "show_telemetry", "enabled": bool(raw.get("enabled", True))})
        elif kind == "set_hud_tab":
            tab = str(raw.get("tab") or "").strip().lower()
            if tab in {"live", "climate", "dossier", "map"}:
                clean.append({"type": "set_hud_tab", "tab": tab})
        elif kind == "export_sitrep":
            clean.append({"type": "export_sitrep"})
        elif kind == "close_brief":
            clean.append({"type": "close_brief"})
    if has_subsystem:
        clean = [item for item in clean if item.get("type") != "camera_preset"]
        subsystems = [
            item.get("subsystem")
            for item in clean
            if item.get("type") == "select_subsystem"
        ]
        if any(sub in BHARATI_ONLY for sub in subsystems) and not any(
            item.get("type") == "select_station" and item.get("station") == "BHARATI"
            for item in clean
        ):
            clean.insert(0, {"type": "select_station", "station": "BHARATI"})
    if any(item.get("type") == "replay_2018" for item in clean):
        if not any(item.get("type") == "select_station" for item in clean):
            clean.insert(0, {"type": "select_station", "station": "BHARATI"})
        if not any(item.get("type") == "show_telemetry" for item in clean):
            clean.append({"type": "show_telemetry", "enabled": True})
        if not any(item.get("type") == "select_subsystem" for item in clean):
            clean.append({"type": "select_subsystem", "subsystem": "STRUCTURE"})
    return _sort_actions(_dedupe(clean))


def _merge_actions(
    primary: list[dict[str, Any]],
    fallback: list[dict[str, Any]],
    user_text: str = "",
) -> list[dict[str, Any]]:
    if primary:
        kinds = {item.get("type") for item in primary}
        extra = [item for item in fallback if item.get("type") not in kinds]
        # Keyword control patches win so the LLM cannot flip unrelated actuators.
        fb_controls = next(
            (item for item in fallback if item.get("type") == "set_controls"),
            None,
        )
        if fb_controls:
            primary = [item for item in primary if item.get("type") != "set_controls"]
            extra = [item for item in extra if item.get("type") != "set_controls"]
            extra.append(fb_controls)
        return sanitize_actions(primary + extra, user_text)
    return sanitize_actions(fallback, user_text)


def _parse_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                return None
    return None


def _fallback_reply(user_text: str, snap: dict[str, Any] | None, actions: list[dict[str, Any]]) -> str:
    if not snap:
        return "I can't see the twin right now — the engine on eight thousand isn't answering."
    kinds = {item.get("type") for item in actions}
    if "replay_2018" in kinds or "set_clock" in kinds:
        return briefing.replay_spoken()
    if "live_now" in kinds:
        return "Alright, we're back on live data."
    subsystems = [
        item.get("subsystem")
        for item in actions
        if item.get("type") == "select_subsystem"
    ]
    if "inject_scenario" in kinds:
        scenario = next(
            (
                item.get("scenario")
                for item in actions
                if item.get("type") == "inject_scenario"
            ),
            "scenario",
        )
        names = {
            "BLIZZARD_80KT": "I'm putting an eighty-knot blizzard on it. Watch the envelope.",
            "RESUPPLY_DELAY": "Okay — resupply delay is in. Keep an eye on the fuel farm.",
            "POLAR_NIGHT": "Polar night's on. Light and load will drop.",
            "NOMINAL": "Cleared. We're back to a quiet day.",
        }
        return names.get(str(scenario), "Done. Scenario's in.")
    if "set_controls" in kinds:
        return "Sent that to the edge. You should see the actuators change in a second."
    if "FUEL" in subsystems or re.search(r"fuel|tank|autonomy", user_text.lower()):
        return briefing.fuel_spoken(snap)
    if "MICROGRID" in subsystems:
        micro = snap.get("microgrid") or {}
        return (
            f"Power house is on about {briefing._n(micro.get('total_load_kva'), 0)} kay-vah, "
            f"against a {briefing._n(micro.get('chp_capacity_kva'), 0)} kay-vah plant."
        )
    if "COMMUNICATIONS" in subsystems:
        link = snap.get("link_status") or {}
        return (
            f"Link looks {str(link.get('health') or 'unknown').lower()} — "
            f"about {link.get('latency_ms')} milliseconds on the {link.get('type')}."
        )
    ambient = snap.get("ambient") or {}
    risk = snap.get("risk") or {}
    severity = str(risk.get("severity") or "nominal").lower()
    return (
        f"It's {severity} out there. About {briefing._n(ambient.get('temp_c'))} outside, "
        f"wind {briefing._n(ambient.get('wind_speed_knots'), 0)} knots, "
        f"and roughly {briefing._n((snap.get('fuel') or {}).get('days_of_autonomy'), 0)} days of fuel."
    )


def _complete(client: OpenAI, messages: list[dict[str, str]]) -> str:
    last_error = None
    tried: set[str] = set()
    for model in FALLBACK_MODELS:
        if model in tried:
            continue
        tried.add(model)
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 700,
            }
            try:
                result = client.chat.completions.create(
                    **kwargs,
                    response_format={"type": "json_object"},
                )
            except Exception:
                result = client.chat.completions.create(**kwargs)
            message = result.choices[0].message
            content = message.content
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict):
                        parts.append(str(part.get("text") or ""))
                    else:
                        parts.append(str(part))
                text = "".join(parts).strip()
            else:
                text = (content or "").strip()
            if not text:
                dumped = message.model_dump() if hasattr(message, "model_dump") else str(message)
                print(f"[Ops] empty content from {model}: {dumped}")
            return text
        except Exception as exc:
            print(f"[Ops] model {model} failed: {exc}")
            last_error = exc
            continue
    raise RuntimeError(last_error)


def _wants_comms(text: str) -> bool:
    return bool(
        re.search(r"comm|radome|c-?band|latency|uplink|link status|\bconnection\b", text.lower())
    )


KNOWLEDGE_RE = re.compile(
    r"how many|what is|what's|whats|where is|who (?:built|designed)|"
    r"tell me about|explain|why does|when (?:was|did|does)|"
    r"al/?0[23]|maitri-?ii|imd|mausam|blizzard log|"
    r"polar (?:day|night)|occupancy|containers|design wind|"
    r"paper|knowledge|dataset|dossier",
    re.I,
)

LIVE_OVERRIDE_RE = re.compile(
    r"\b(live|right now|current|tank|fuel farm|autonomy|wind now|how cold|days of fuel|fuel days)\b",
    re.I,
)


def _is_knowledge_query(text: str) -> bool:
    if LIVE_OVERRIDE_RE.search(text) and re.search(r"fuel|wind|temp|tank|load", text.lower()):
        return False
    return bool(KNOWLEDGE_RE.search(text))


async def handle_turn(
    user_text: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    user_text = _sanitize(user_text)
    routed = keyword_actions(user_text)
    knowledge_q = _is_knowledge_query(user_text)

    snap: dict[str, Any] | None = None
    uplink_error = None
    try:
        snap = await twin_client.get_telemetry()
    except twin_client.TwinUnreachable as exc:
        uplink_error = str(exc)

    live_block = briefing.format_snapshot(snap, include_link=_wants_comms(user_text))
    packed = knowledge.retrieve(user_text, limit=5)
    hits = packed.get("hits") or []
    docs = rag.format_context(hits) or knowledge.DIGEST[:1800]
    rag_mode = packed.get("mode") or "local-md"

    if knowledge_q:
        routed.append({"type": "show_telemetry", "enabled": True})
        routed.append({"type": "set_hud_tab", "tab": "dossier"})
        routed = _dedupe(routed)

    client = _client()
    parsed: dict[str, Any] | None = None
    if client and user_text:
        system = (
            f"{PERSONA}\n\n{live_block}\n\nSTATION KNOWLEDGE (RAG {rag_mode}):\n{docs[:3800]}"
        )
        if uplink_error:
            system += f"\n\nUPLINK ERROR: {uplink_error}"
        if _is_historical(user_text):
            system += (
                "\n\nHISTORICAL CARD (use these numbers, ignore live wind):\n"
                + briefing.REPLAY_2018_BRIEF
            )
        messages = [{"role": "system", "content": system}]
        for turn in (history or [])[-8:]:
            role = turn.get("role")
            content = turn.get("content")
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": str(content)[:600]})
        messages.append({"role": "user", "content": user_text})
        try:
            raw = _complete(client, messages)
            parsed = _parse_json(raw)
            if raw and not parsed:
                print(f"[Ops] unparsed LLM output: {raw[:500]}")
        except Exception as exc:
            print(f"[Ops] LLM error: {exc}")

    reply = ""
    llm_actions: list[dict[str, Any]] = []
    if parsed:
        reply = str(parsed.get("reply") or "").strip()
        llm_actions = sanitize_actions(parsed.get("actions"), user_text)
        if not reply:
            print(f"[Ops] parsed JSON without reply: {parsed}")

    actions = _merge_actions(llm_actions, routed, user_text)
    grounded = briefing.spoken_for_actions(snap, actions)
    if grounded and not knowledge_q:
        reply = grounded
    elif not reply:
        if knowledge_q:
            snippet = re.sub(r"\s+", " ", (hits[0].get("content") if hits else docs) or "")
            heading = (hits[0].get("heading") if hits else "the station notes")
            source = (hits[0].get("source") if hits else "knowledge base")
            reply = (
                f"{snippet[:280].rstrip(' .,;')}. "
                f"That's from {heading}, in {source}."
            )
        else:
            spec_question = bool(
                re.search(
                    r"how many|what is|what's|where is|design|planned|maitri-?ii|made of",
                    user_text.lower(),
                )
            )
            if spec_question:
                snippet = re.sub(r"\s+", " ", docs.split("---")[0])[:420]
                reply = snippet or _fallback_reply(user_text, snap, actions)
            else:
                reply = _fallback_reply(user_text, snap, actions)

    if not _wants_comms(user_text):
        reply = briefing.strip_link_talk(reply)

    if len(reply) > 900:
        reply = reply[:897].rsplit(" ", 1)[0] + "."

    sources = [
        {
            "heading": item.get("heading"),
            "source": item.get("source"),
            "score": round(float(item.get("score") or 0), 3),
        }
        for item in hits[:4]
    ]

    return {
        "reply": reply,
        "actions": actions,
        "sources": sources,
        "rag": rag_mode,
        "station": (snap or {}).get("station_id"),
        "uplink": "LIVE" if snap else "DOWN",
    }
