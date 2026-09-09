"""Turn live StationTelemetry into a compact briefing the LLM must quote from."""

from __future__ import annotations

import re
from typing import Any


def _n(value: Any, digits: int = 1) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "unknown"
    if digits == 0:
        return str(int(round(number)))
    return f"{number:.{digits}f}"


def format_snapshot(snap: dict[str, Any] | None, include_link: bool = False) -> str:
    if not snap:
        return "UPLINK DOWN. No live StationTelemetry. Do not invent numbers. Say the twin engine is unreachable."

    fuel = snap.get("fuel") or {}
    ambient = snap.get("ambient") or {}
    thermal = snap.get("thermal") or {}
    micro = snap.get("microgrid") or {}
    controls = snap.get("controls") or {}
    link = snap.get("link_status") or {}
    risk = snap.get("risk") or {}
    lockouts = snap.get("lockouts") or {}
    days = fuel.get("days_of_autonomy")
    try:
        days_f = float(days)
    except (TypeError, ValueError):
        days_f = None
    if days_f is None:
        sop = "unknown"
    elif days_f < 15:
        sop = "CRITICAL — below 15-day starve floor"
    elif days_f < 30:
        sop = "ADVISORY — below 30-day SOP floor"
    else:
        sop = "NOMINAL — above 30-day SOP floor"

    actions = risk.get("prescribed_actions") or []
    action_line = "; ".join(str(item) for item in actions) if actions else "none"

    block = f"""LIVE TELEMETRY (quote these numbers; do not round into fiction)
station: {snap.get("station_id")}
timestamp: {snap.get("timestamp")}
source: {snap.get("source")}  confidence: {snap.get("confidence")}
ambient: {_n(ambient.get("temp_c"))} C, wind {_n(ambient.get("wind_speed_knots"), 0)} kt, solar {_n(ambient.get("solar_flux_w_m2"), 0)} W/m2
thermal: internal {_n(thermal.get("internal_temp_c"))} C, CHP heat {_n(thermal.get("chp_thermal_output_kw"), 0)} kW, aux heater {_n(thermal.get("aux_heater_kw"), 0)} kW, heat loss {_n(thermal.get("heat_loss_kw"), 0)} kW
microgrid: total {_n(micro.get("total_load_kva"), 0)} kVA, essential {_n(micro.get("essential_load_kva"), 0)}, science {_n(micro.get("science_load_kva"), 0)}, comfort {_n(micro.get("comfort_load_kva"), 0)}, CHP cap {_n(micro.get("chp_capacity_kva"), 0)} kVA
fuel: tank {_n(fuel.get("tank_level_liters"), 0)} L ({_n(float(fuel.get("tank_level_liters") or 0) / 1000, 0)} kL), burn {_n(fuel.get("burn_rate_lph"), 0)} L/h, autonomy {_n(fuel.get("days_of_autonomy"), 0)} days, SOP {sop}
controls: science={controls.get("science_instruments_online")} summer_wing_isolated={controls.get("summer_wing_isolated")} hatch_lockdown={controls.get("hatch_lockdown")} aux_gen={controls.get("aux_generator_active")}
risk: severity={risk.get("severity")} anomaly={risk.get("is_anomaly")} score={risk.get("anomaly_score")}
prescribed_actions: {action_line}
lockouts: outdoor={lockouts.get("outdoor")} heli={lockouts.get("heli")} convoy={lockouts.get("convoy")} field={lockouts.get("field")}
"""
    if include_link:
        block += (
            f"link: {link.get('type')} latency={link.get('latency_ms')} ms "
            f"health={link.get('health')}\n"
        )
    replay = snap.get("replay") or {}
    if replay.get("active"):
        facts = replay.get("facts") or []
        fact_line = "; ".join(
            f"{item.get('label')}={item.get('value')}"
            for item in facts
            if isinstance(item, dict)
        )
        block += f"""replay: ACTIVE clock={replay.get("clock")} scenario={replay.get("scenario_id")}
citation: {replay.get("citation")}
occupancy: {replay.get("occupancy")} wind_tag={replay.get("wind_tag")} temp_tag={replay.get("temp_tag")}
facts: {fact_line or "none"}
note: {replay.get("note")}
"""
    return block


REPLAY_2018_BRIEF = (
    "Okay, I've put you on the fifth of August, 2018 at Bharati. "
    "IMD logged an eighty-knot gust that day, about minus twelve outside, "
    "forty-seven people on station. Outdoor, heli, convoy and field are all locked. "
    "It's a critical day. Fuel and indoor heat on this replay are still modeled."
)


def replay_spoken() -> str:
    return REPLAY_2018_BRIEF


def _sop_line(days: Any) -> str:
    try:
        value = float(days)
    except (TypeError, ValueError):
        return "I don't have a clean autonomy number."
    if value < 15:
        return "That's under the fifteen-day starve floor — it's critical."
    if value < 30:
        return "That's under the thirty-day SOP floor, so we're on advisory."
    return "That's comfortably above the thirty-day SOP floor."


def fuel_spoken(snap: dict[str, Any]) -> str:
    fuel = snap.get("fuel") or {}
    days = _n(fuel.get("days_of_autonomy"), 0)
    liters = _n(fuel.get("tank_level_liters"), 0)
    tank_kl = _n(float(fuel.get("tank_level_liters") or 0) / 1000, 0)
    burn = _n(fuel.get("burn_rate_lph"), 0)
    station = snap.get("station_id") or "the station"
    return (
        f"Here's the fuel farm at {station}. Tank is {liters} liters, that's about {tank_kl} kiloliters of Jet A-one. "
        f"Burn is {burn} liters an hour, so you've got about {days} days of autonomy. "
        f"{_sop_line(fuel.get('days_of_autonomy'))}"
    )


def power_spoken(snap: dict[str, Any]) -> str:
    micro = snap.get("microgrid") or {}
    thermal = snap.get("thermal") or {}
    controls = snap.get("controls") or {}
    aux = "on" if controls.get("aux_generator_active") else "on standby"
    science = "online" if controls.get("science_instruments_online") else "shed"
    return (
        f"Power house first: total load { _n(micro.get('total_load_kva'), 0) } kay-vah "
        f"on a { _n(micro.get('chp_capacity_kva'), 0) } kay-vah plant. "
        f"Essential { _n(micro.get('essential_load_kva'), 0) }, science { _n(micro.get('science_load_kva'), 0) }, "
        f"comfort { _n(micro.get('comfort_load_kva'), 0) }. "
        f"CHP heat is { _n(thermal.get('chp_thermal_output_kw'), 0) } kilowatts, aux generator is {aux}, "
        f"science payloads are {science}."
    ).replace("  ", " ")


def weather_spoken(snap: dict[str, Any]) -> str:
    ambient = snap.get("ambient") or {}
    thermal = snap.get("thermal") or {}
    risk = snap.get("risk") or {}
    lockouts = snap.get("lockouts") or {}
    return (
        f"Outside it's { _n(ambient.get('temp_c')) } degrees, wind { _n(ambient.get('wind_speed_knots'), 0) } knots, "
        f"solar { _n(ambient.get('solar_flux_w_m2'), 0) } watts per square meter. "
        f"Inside we're holding { _n(thermal.get('internal_temp_c')) } degrees. "
        f"Risk is { str(risk.get('severity') or 'nominal').lower() }. "
        f"Outdoor lockout is { str(lockouts.get('outdoor') or 'open').lower() }, "
        f"heli is { str(lockouts.get('heli') or 'open').lower() }."
    ).replace("  ", " ")


def comms_spoken(snap: dict[str, Any]) -> str:
    link = snap.get("link_status") or {}
    return (
        f"Comms: {link.get('type') or 'the uplink'} is { str(link.get('health') or 'unknown').lower() }, "
        f"round trip about {link.get('latency_ms')} milliseconds."
    )


def safety_spoken(snap: dict[str, Any]) -> str:
    lockouts = snap.get("lockouts") or {}
    controls = snap.get("controls") or {}
    ambient = snap.get("ambient") or {}
    hatch = "locked" if controls.get("hatch_lockdown") else "open"
    return (
        f"Safety picture: outdoor { str(lockouts.get('outdoor') or 'open').lower() }, "
        f"heli { str(lockouts.get('heli') or 'open').lower() }, "
        f"convoy { str(lockouts.get('convoy') or 'open').lower() }, "
        f"field { str(lockouts.get('field') or 'open').lower() }. "
        f"Hatches are {hatch}. Wind is { _n(ambient.get('wind_speed_knots'), 0) } knots."
    )


def spoken_for_actions(snap: dict[str, Any] | None, actions: list[dict[str, Any]]) -> str | None:
    kinds = {item.get("type") for item in actions}
    tabs = [item.get("tab") for item in actions if item.get("type") == "set_hud_tab"]
    if "export_sitrep" in kinds:
        return "Situation report is downloading now. Severity, fuel, windows, and instrument go no-go are in the PDF."
    if "map" in tabs:
        return (
            "GIS is on screen. Ice is seasonal climatology, not live NSIDC. "
            "The red marker is the modeled voyage — heli is open only while that ship is in the bay."
        )
    if "climate" in tabs:
        return "I've opened the polar calendar. Air, sea, and heli windows are on the chips. Heli stays closed unless the ship is in the bay."
    if not snap:
        return None
    if "replay_2018" in kinds:
        return replay_spoken()
    if "live_now" in kinds and len(kinds) <= 2:
        return weather_spoken(snap)
    subs = [
        item.get("subsystem")
        for item in actions
        if item.get("type") == "select_subsystem"
    ]
    if "FUEL" in subs:
        return fuel_spoken(snap)
    if "MICROGRID" in subs or "THERMAL" in subs:
        return power_spoken(snap)
    if "COMMUNICATIONS" in subs:
        return comms_spoken(snap)
    if "SAFETY" in subs or "VEHICLES" in subs:
        return safety_spoken(snap)
    if "STRUCTURE" in subs or "ROOF" in subs:
        return weather_spoken(snap)
    if "WATER" in subs:
        ambient = snap.get("ambient") or {}
        return (
            f"Water side is seasonal. Ambient { _n(ambient.get('temp_c')) } degrees, "
            f"solar { _n(ambient.get('solar_flux_w_m2'), 0) } watts per square meter — "
            f"that's what drives the melt pond and RO this time of year."
        )
    if "CONTAINERS" in subs or "UTILITIES" in subs:
        return weather_spoken(snap)
    return None


def strip_link_talk(reply: str) -> str:
    if not reply:
        return reply
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", reply) if part.strip()]
    kept = [
        part
        for part in parts
        if not re.search(
            r"\b(link|uplink|c-?band|latency|connection|satellite|round trip)\b",
            part,
            re.I,
        )
    ]
    return " ".join(kept) if kept else reply
