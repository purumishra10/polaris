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
    forecast = snap.get("forecast") or {}
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

    wx = str(forecast.get("status") or "CLEAR")
    driver = str(risk.get("driver") or "")
    if not driver:
        if wx in {"WATCH", "IMMINENT"} and days_f is not None and days_f >= 30:
            driver = "nowcast"
        elif days_f is not None and days_f < 30:
            driver = "fuel"
        else:
            driver = str(risk.get("severity") or "nominal").lower()

    actions = risk.get("prescribed_actions") or []
    action_line = "; ".join(str(item) for item in actions) if actions else "none"
    p23 = forecast.get("p_lockout_23")
    p23_pct = "unknown"
    try:
        p23_pct = f"{round(float(p23) * 100)}%"
    except (TypeError, ValueError):
        pass

    block = f"""LIVE TELEMETRY (quote these numbers; do not round into fiction)
station: {snap.get("station_id")}
timestamp: {snap.get("timestamp")}
source: {snap.get("source")}  confidence: {snap.get("confidence")}
RULES: Fuel SOP (30/15 d) is independent of the 6h nowcast. Station banner ADVISORY with driver=nowcast means gust watch, NOT a short tank. Isolation Forest is not the live banner.
ambient: {_n(ambient.get("temp_c"))} C, wind {_n(ambient.get("wind_speed_knots"), 0)} kt, solar {_n(ambient.get("solar_flux_w_m2"), 0)} W/m2  [Open-Meteo]
thermal: internal {_n(thermal.get("internal_temp_c"))} C, CHP heat {_n(thermal.get("chp_thermal_output_kw"), 0)} kW, aux heater {_n(thermal.get("aux_heater_kw"), 0)} kW, heat loss {_n(thermal.get("heat_loss_kw"), 0)} kW  [MODELED plant]
microgrid: total {_n(micro.get("total_load_kva"), 0)} kVA, essential {_n(micro.get("essential_load_kva"), 0)}, science {_n(micro.get("science_load_kva"), 0)}, comfort {_n(micro.get("comfort_load_kva"), 0)}, CHP cap {_n(micro.get("chp_capacity_kva"), 0)} kVA  [MODELED]
fuel: tank {_n(fuel.get("tank_level_liters"), 0)} L ({_n(float(fuel.get("tank_level_liters") or 0) / 1000, 0)} kL), burn {_n(fuel.get("burn_rate_lph"), 0)} L/h, autonomy {_n(fuel.get("days_of_autonomy"), 0)} days, FUEL_SOP {sop}  [MODELED]
nowcast: model={forecast.get("model") or "off"} status={wx} gust_max_6h={_n(forecast.get("gust_max_6h_kn"), 0)} kt p_lockout_23={p23_pct} temp_min_6h={_n(forecast.get("temp_min_6h_c"))} C
banner: severity={risk.get("severity")} driver={driver} (nowcast=6h gust watch; fuel=30/15 floor; structural=60 kt)
prescribed_actions: {action_line}
controls: science={controls.get("science_instruments_online")} summer_wing_isolated={controls.get("summer_wing_isolated")} hatch_lockdown={controls.get("hatch_lockdown")} aux_gen={controls.get("aux_generator_active")}
lockouts: outdoor={lockouts.get("outdoor")} heli={lockouts.get("heli")} convoy={lockouts.get("convoy")} field={lockouts.get("field")}
"""
    crit = critical_conditions(snap)
    block += (
        "CRITICAL CONDITIONS: " + "; ".join(c["spoken"] for c in crit) + " (lead with these)\n"
        if crit
        else "CRITICAL CONDITIONS: none\n"
    )
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
        f"{_sop_line(fuel.get('days_of_autonomy'))} "
        f"Those tank numbers are modeled plant, not a dipstick."
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
    forecast = snap.get("forecast") or {}
    fuel = snap.get("fuel") or {}
    wx = str(forecast.get("status") or "CLEAR")
    driver = str(risk.get("driver") or "")
    banner = str(risk.get("severity") or "nominal").lower()
    nowcast_bit = ""
    if wx in {"WATCH", "IMMINENT"}:
        p23 = forecast.get("p_lockout_23")
        try:
            pct = f"{round(float(p23) * 100)} percent"
        except (TypeError, ValueError):
            pct = "unknown"
        nowcast_bit = (
            f" Six-hour nowcast is {wx.lower()}: peak gust {_n(forecast.get('gust_max_6h_kn'), 0)} knots, "
            f"chance of a 23-knot lockout {pct}. That is the weather watch, not the fuel floor."
        )
    fuel_bit = f" {_sop_line(fuel.get('days_of_autonomy'))}"
    driver_bit = ""
    if driver == "nowcast" or (not driver and wx in {"WATCH", "IMMINENT"}):
        driver_bit = f" The banner is {banner} because of that gust watch."
    elif banner != "nominal":
        driver_bit = f" Station banner is {banner}."
    return (
        f"Outside it's {_n(ambient.get('temp_c'))} degrees, wind {_n(ambient.get('wind_speed_knots'), 0)} knots. "
        f"Inside we're holding {_n(thermal.get('internal_temp_c'))} degrees — that's modeled."
        f"{nowcast_bit}{fuel_bit}{driver_bit} "
        f"Outdoor lockout is {str(lockouts.get('outdoor') or 'open').lower()}, "
        f"heli is {str(lockouts.get('heli') or 'open').lower()}."
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


def _f(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def critical_conditions(snap: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Same CRITICAL triggers the frontend SOP interrupt uses."""
    if not snap:
        return []
    out: list[dict[str, Any]] = []
    wind = _f((snap.get("ambient") or {}).get("wind_speed_knots"))
    habitat = _f((snap.get("thermal") or {}).get("internal_temp_c"))
    days = _f((snap.get("fuel") or {}).get("days_of_autonomy"))
    forecast = snap.get("forecast") or {}
    proactive = snap.get("proactive") or {}

    if wind is not None and wind > 60:
        out.append({
            "code": "STRUCTURAL",
            "subsystem": "STRUCTURE",
            "spoken": f"wind is {_n(wind, 0)} knots, over the sixty-knot structural limit",
        })
    if habitat is not None and habitat < 16:
        out.append({
            "code": "THERMAL",
            "subsystem": "THERMAL",
            "spoken": f"habitat is down to {_n(habitat)} degrees, under the sixteen-degree floor",
        })
    if days is not None and days < 15:
        out.append({
            "code": "FUEL_CRIT",
            "subsystem": "FUEL",
            "spoken": f"fuel autonomy is {_n(days, 0)} days, under the fifteen-day starve floor",
        })
    if str(forecast.get("status") or "") == "IMMINENT":
        p23 = _f(forecast.get("p_lockout_23"))
        out.append({
            "code": "NOWCAST",
            "subsystem": "STRUCTURE",
            "spoken": (
                f"the six-hour nowcast says a wind lockout is imminent, "
                f"{round((p23 or 0) * 100)} percent, gusts to {_n(forecast.get('gust_max_6h_kn'), 0)} knots"
            ),
        })
    hazard = str(proactive.get("hazard") or "")
    if str(proactive.get("status") or "") in {"IMMINENT", "ACTIVE"} and hazard and hazard != "NONE":
        eta = _f(proactive.get("eta_minutes"))
        eta_bit = ""
        if eta is not None and eta < 9000:
            eta_bit = (
                f" in about {max(1, round(eta * 60))} seconds" if eta < 1
                else f" in about {round(eta)} minutes" if eta < 120
                else f" in about {round(eta / 60)} hours"
            )
        out.append({
            "code": f"PRO_{hazard}",
            "subsystem": {"RESUPPLY": "FUEL", "MICROGRID": "MICROGRID", "COMMUNICATIONS": "COMMUNICATIONS"}.get(hazard, "STRUCTURE"),
            "spoken": f"the proactive engine has {hazard.replace('_', ' ').lower()} {str(proactive.get('status')).lower()}{eta_bit}",
        })
    if not out and str((snap.get("risk") or {}).get("severity") or "") == "CRITICAL":
        out.append({"code": "RISK", "subsystem": "STRUCTURE", "spoken": "the SOP rule engine has the station at critical"})
    return out


def status_spoken(snap: dict[str, Any] | None) -> str:
    if not snap:
        return "Twin engine is not answering, so I can't give you a live status. I still have the station notes."
    station = str(snap.get("station_id") or "the station").title()
    ambient = snap.get("ambient") or {}
    thermal = snap.get("thermal") or {}
    fuel = snap.get("fuel") or {}
    risk = snap.get("risk") or {}
    lockouts = snap.get("lockouts") or {}
    forecast = snap.get("forecast") or {}
    conditions = critical_conditions(snap)

    if conditions:
        count = len(conditions)
        head = f"{station} is critical. " + (
            f"{conditions[0]['spoken'][0].upper()}{conditions[0]['spoken'][1:]}."
            if count == 1
            else f"{count} conditions: " + "; and ".join(c["spoken"] for c in conditions[:3]) + "."
        )
        actions = [
            str(a).replace("ACTION:", "").strip().rstrip(".")
            for a in (risk.get("prescribed_actions") or [])
            if "isolation forest" not in str(a).lower()
        ][:2]
        sop = f" SOP says {', then '.join(actions).lower()}." if actions else ""
        return (
            f"{head}{sop} The critical brief is on your screen. "
            f"Outdoor is {str(lockouts.get('outdoor') or 'open').lower()}, heli {str(lockouts.get('heli') or 'open').lower()}."
        )

    severity = str(risk.get("severity") or "nominal").lower()
    wx = str(forecast.get("status") or "CLEAR")
    watch = ""
    if wx == "WATCH":
        watch = (
            f" There's a six-hour gust watch, peak {_n(forecast.get('gust_max_6h_kn'), 0)} knots, "
            f"{round((_f(forecast.get('p_lockout_23')) or 0) * 100)} percent chance of a lockout."
        )
    return (
        f"{station} is {severity}, nothing critical. "
        f"Outside {_n(ambient.get('temp_c'))} degrees, wind {_n(ambient.get('wind_speed_knots'), 0)} knots; "
        f"inside {_n(thermal.get('internal_temp_c'))}. Fuel is {_n(fuel.get('days_of_autonomy'), 0)} days."
        f"{watch} Outdoor is {str(lockouts.get('outdoor') or 'open').lower()}."
    )


_TTS_MAP = {
    "\u202f": " ", "\u00a0": " ", "\u2009": " ", "\u2007": " ",
    "\u2212": "minus ", "\u2013": " to ", "\u2014": ", ", "\u2011": "-", "\u2010": "-",
    "\u00b0C": " degrees", "\u00b0": " degrees", "\u2248": "about ", "\u00d7": " by ",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "...",
    "\u2192": " to ", "\u2265": "at least ", "\u2264": "at most ",
}


def tts_clean(text: str) -> str:
    """Normalize LLM typography so TTS doesn't read mojibake or skip symbols."""
    if not text:
        return text
    for src, dst in _TTS_MAP.items():
        text = text.replace(src, dst)
    text = re.sub(r"(?<=\d)\s*kt\b", " knots", text)
    text = re.sub(r"(?<=\d)\s*kVA\b", " kay-vah", text)
    text = re.sub(r"(?<=\d)\s*L/h\b", " liters an hour", text)
    text = re.sub(r"[*_#`|]", "", text)
    text = re.sub(r"[^\x00-\x7f]", "", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return re.sub(r"\s{2,}", " ", text).strip()


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
