"""Resolve a UTC clock into a full station day brief + physics hold."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BLIZZARD_PATH = ROOT / "datasets" / "geospatial_hazards" / "bharati_blizzard_log_imd.json"

BLIZZARD_TEMP_C = {
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

SPECIAL_DAYS = {
    "2018-08-05": {
        "title": "IMD annual max gust",
        "wind_kn": 80.0,
        "temp_c": -12.0,
        "temp_tag": "MODELED analog · nearby Aug blizzards -5 to -13 C",
        "wind_tag": "IMD MEASURED · MAUSAM 73(3) Table 1",
        "mslp_hpa": None,
        "citation": "IMD MAUSAM 73(3) · annual max gust 80 kn · 5 Aug 2018 · Thapliyal et al.",
        "note": "Not a Table 2 blizzard event. Polar night ended 16 Jul 2018.",
    }
}


def _parse_clock(raw: str) -> datetime:
    text = raw.strip().replace(" ", "T")
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    if "+" not in text[10:] and not text.endswith("+00:00"):
        text += "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _load_blizzards() -> list[dict[str, Any]]:
    if not BLIZZARD_PATH.exists():
        return []
    return json.loads(BLIZZARD_PATH.read_text(encoding="utf-8"))


def _iso_clock(value: str) -> str:
    text = value.replace(" ", "T")
    if text.endswith("Z"):
        return text[:-1] + "+00:00"
    if "+" not in text[10:]:
        return text + "+00:00"
    return text


def _in_span(day: date, start: tuple[int, int], end: tuple[int, int]) -> bool:
    sm, sd = start
    em, ed = end
    start_d = date(day.year, sm, sd)
    end_d = date(day.year, em, ed)
    if start_d <= end_d:
        return start_d <= day <= end_d
    return day >= start_d or day <= end_d


def polar_state(day: date) -> tuple[str, str]:
    if _in_span(day, (5, 28), (7, 16)):
        return "POLAR_NIGHT", "49-day polar night window (Bharati 28 May–16 Jul)"
    if _in_span(day, (11, 20), (1, 22)):
        return "POLAR_DAY", "63-day polar day window (Bharati 20 Nov–22 Jan)"
    if day.month in (5, 6, 7, 8, 9):
        return "WINTER_SUN", "Sun rises; not polar night"
    return "TWILIGHT", "Shoulder season daylight"


def season_of(day: date) -> str:
    return "SUMMER" if day.month in (11, 12, 1, 2) else "WINTER"


def occupancy_of(station_id: str, season: str) -> int:
    if station_id == "MAITRI":
        return 65 if season == "SUMMER" else 25
    return 72 if season == "SUMMER" else 47


def voyage_of(day: date) -> dict[str, str]:
    air = "OPEN" if _in_span(day, (10, 20), (2, 14)) else "CLOSED"
    sea = "OPEN" if _in_span(day, (11, 1), (3, 15)) else "CLOSED"
    heli = "OPEN" if sea == "OPEN" else "LOCKED"
    if air == "CLOSED" and sea == "CLOSED":
        reason = "Winter isolation. Last DROMLAN ~mid-February; ship gone ~March."
    elif air == "CLOSED":
        reason = "Air window closed; sea still open if ice allows."
    else:
        reason = "Expedition access window (DROMLAN / voyage ship)."
    return {"air": air, "sea": sea, "heli": heli, "reason": reason}


def solar_of(polar: str, season: str) -> tuple[float, str]:
    if polar == "POLAR_NIGHT":
        return 0.0, "CALENDAR · polar night solar = 0"
    if polar == "POLAR_DAY":
        return 160.0, "CALENDAR · 24 h daylight"
    if season == "WINTER":
        return 18.0, "CALENDAR · low winter sun"
    return 120.0, "CALENDAR · summer daylight"


def matching_blizzards(clock: datetime) -> list[dict[str, Any]]:
    hits = []
    for event in _load_blizzards():
        start = datetime.fromisoformat(event["start_utc"].replace(" ", "T")).replace(
            tzinfo=timezone.utc
        )
        end = datetime.fromisoformat(event["end_utc"].replace(" ", "T")).replace(
            tzinfo=timezone.utc
        )
        if start <= clock <= end + timedelta(minutes=1):
            hits.append(event)
        elif start.date() <= clock.date() <= end.date():
            hits.append(event)
    return hits


def catalog() -> list[dict[str, str]]:
    rows = [
        {
            "clock": "2018-08-05T18:00:00+00:00",
            "label": "5 AUG 2018",
            "hint": "80 kn max gust",
        }
    ]
    for event in _load_blizzards():
        rows.append(
            {
                "clock": _iso_clock(event["start_utc"]),
                "label": event["start_utc"][:10],
                "hint": f"{event['event_id']} {event['max_wind_kn']:.0f} kn",
            }
        )
    seen = set()
    out = []
    for row in rows:
        if row["label"] in seen:
            continue
        seen.add(row["label"])
        out.append(row)
    return out


def _station_hold(
    *,
    station_id: str,
    clock: datetime,
    polar: str,
    season: str,
    voyage: dict[str, str],
    special: dict[str, Any] | None,
    storms: list[dict[str, Any]],
) -> dict[str, Any]:
    solar, solar_tag = solar_of(polar, season)
    occupancy = occupancy_of(station_id, season)
    wind_kn = 22.0 if station_id == "MAITRI" else 24.0
    temp_c = -18.0 if station_id == "MAITRI" else -14.2
    wind_tag = "MODELED calendar baseline"
    temp_tag = "MODELED calendar baseline"
    mslp = None
    citation = "Calendar rules from AL/02, 43-ISEA, MAUSAM polar dates."
    note = "No IMD event on this clock. Wind/temp are seasonal holds, tagged modeled."
    hazards: list[str] = []

    bharati_event = station_id == "BHARATI" and bool(special or storms)
    if station_id == "BHARATI" and special:
        wind_kn = float(special["wind_kn"])
        temp_c = float(special["temp_c"])
        wind_tag = special["wind_tag"]
        temp_tag = special["temp_tag"]
        mslp = special.get("mslp_hpa")
        citation = special["citation"]
        note = special["note"]
        hazards.append(special["title"])
    elif station_id == "BHARATI" and storms:
        event = storms[0]
        wind_kn = float(event["max_wind_kn"])
        temp_c = float(BLIZZARD_TEMP_C.get(event["event_id"], temp_c))
        wind_tag = "IMD MEASURED · MAUSAM Table 2 peak gust"
        temp_tag = "IMD MEASURED · MAUSAM Table 2 (event mean)"
        mslp = event.get("lowest_mslp_hpa")
        citation = (
            f"{event['event_id']} · {event['start_utc']}–{event['end_utc']} · "
            f"{event['max_wind_kn']:.0f} kn · MAUSAM 73(3) Table 2"
        )
        note = event.get("notes") or "IMD blizzard event."
        hazards.append(
            f"{event['event_id']} {event['duration_hrs']} h · {event['max_wind_kn']:.0f} kn"
        )
    elif station_id == "MAITRI" and (special or storms):
        wind_tag = "NOT Bharati weather · Maitri hold"
        temp_tag = "MODELED inland winter/summer"
        citation = "Same expedition clock. Bharati hazard is not copied onto Maitri."
        note = "Maitri outdoor follows local wind, not the Bharati gust."
        hazards.append("Neighbour event at Bharati — Maitri weather independent")

    outdoor = "LOCKED" if wind_kn >= 23 else "OPEN"
    heli = "LOCKED" if voyage["heli"] == "LOCKED" or wind_kn >= 40 else "OPEN"
    convoy = "LOCKED" if wind_kn >= 50 or (outdoor == "LOCKED" and season == "WINTER") else "OPEN"

    reasons = []
    if outdoor == "LOCKED":
        reasons.append(f"Gust {wind_kn:.0f} kn ≥ 23 kn IMD blowing-snow threshold")
    if heli == "LOCKED":
        reasons.append(
            voyage["reason"] if voyage["heli"] == "LOCKED" else "Wind above heli ops"
        )
    if station_id == "MAITRI" and (special or storms):
        reasons.append("Bharati storm is not Maitri wind")

    facts = [
        {"label": "CLOCK", "value": clock.strftime("%d %b %Y  %H:%M UTC"), "tag": "OPERATOR"},
        {"label": "WIND", "value": f"{wind_kn:.0f} kn", "tag": wind_tag},
        {"label": "TEMP", "value": f"{temp_c:.1f} °C", "tag": temp_tag},
        {"label": "SOLAR", "value": f"{solar:.0f} W/m²", "tag": solar_tag},
        {"label": "POLAR", "value": polar.replace("_", " "), "tag": polar_label_safe(polar)},
        {"label": "SEASON", "value": season, "tag": "Expedition calendar"},
        {
            "label": "OCCUPANCY",
            "value": str(occupancy),
            "tag": "AL/02 · Bharati 47/72 · Maitri 25/65",
        },
        {"label": "AIR", "value": voyage["air"], "tag": "DROMLAN ~20 Oct–14 Feb"},
        {"label": "SEA", "value": voyage["sea"], "tag": "Ship Nov–mid March"},
        {"label": "HELI", "value": heli, "tag": "Kamov only while ship nearby"},
        {"label": "OUTDOOR", "value": outdoor, "tag": "IMD visibility/wind rule"},
        {"label": "CONVOY", "value": convoy, "tag": "Gale / isolation"},
        {
            "label": "HAZARD",
            "value": hazards[0] if hazards else "None catalogued",
            "tag": citation.split("·")[0].strip(),
        },
        {
            "label": "MSLP",
            "value": f"{mslp:.1f} hPa" if mslp else "—",
            "tag": "IMD Table 2" if mslp else "Not published this hour",
        },
        {"label": "ISOLATION", "value": voyage["reason"], "tag": "43-ISEA / AL windows"},
    ]

    return {
        "ambient": {
            "temp_c": temp_c,
            "wind_speed_knots": wind_kn,
            "solar_flux_w_m2": solar,
        },
        "occupancy": occupancy,
        "lockouts": {
            "outdoor": outdoor,
            "heli": heli,
            "convoy": convoy,
            "field": outdoor,
        },
        "reasons": reasons,
        "facts": facts,
        "polar": polar,
        "season": season,
        "wind_tag": wind_tag,
        "temp_tag": temp_tag,
        "citation": citation,
        "note": note,
        "bharati_event": bharati_event,
    }


def polar_label_safe(polar: str) -> str:
    labels = {
        "POLAR_NIGHT": "49-day polar night window (Bharati 28 May–16 Jul)",
        "POLAR_DAY": "63-day polar day window (Bharati 20 Nov–22 Jan)",
        "WINTER_SUN": "Sun rises; not polar night",
        "TWILIGHT": "Shoulder season daylight",
    }
    return labels.get(polar, polar)


def resolve(clock_raw: str) -> dict[str, Any]:
    clock = _parse_clock(clock_raw)
    day = clock.date()
    polar, _polar_label = polar_state(day)
    season = season_of(day)
    voyage = voyage_of(day)
    special = SPECIAL_DAYS.get(day.isoformat())
    storms = matching_blizzards(clock)

    stations = {
        sid: _station_hold(
            station_id=sid,
            clock=clock,
            polar=polar,
            season=season,
            voyage=voyage,
            special=special,
            storms=storms,
        )
        for sid in ("BHARATI", "MAITRI")
    }
    primary = stations["BHARATI"]
    return {
        "scenario_id": f"CLOCK_{day.isoformat()}",
        "clock": clock.isoformat(),
        "citation": primary["citation"],
        "source_type": "IMD_BHARATI" if primary["bharati_event"] else "CALENDAR",
        "note": primary["note"],
        "voyage": voyage,
        "stations": stations,
    }


def replay_from_snapshot(snapshot: dict[str, Any], station_id: str) -> dict[str, Any]:
    block = snapshot["stations"][station_id]
    hazards = [
        item["value"]
        for item in block.get("facts", [])
        if item.get("label") == "HAZARD"
    ]
    return {
        "active": True,
        "scenario_id": snapshot.get("scenario_id"),
        "clock": snapshot.get("clock"),
        "citation": block.get("citation") or snapshot.get("citation"),
        "source_type": snapshot.get("source_type"),
        "occupancy": block.get("occupancy"),
        "note": block.get("note") or snapshot.get("note"),
        "mode": "HISTORICAL",
        "polar": block.get("polar"),
        "season": block.get("season"),
        "voyage_air": snapshot.get("voyage", {}).get("air"),
        "voyage_sea": snapshot.get("voyage", {}).get("sea"),
        "isolation": snapshot.get("voyage", {}).get("reason"),
        "hazards": hazards,
        "facts": block.get("facts") or [],
        "wind_tag": block.get("wind_tag"),
        "temp_tag": block.get("temp_tag"),
    }


def live_replay_payload() -> dict[str, Any]:
    return {
        "active": False,
        "scenario_id": None,
        "clock": None,
        "citation": None,
        "source_type": None,
        "occupancy": None,
        "note": None,
        "mode": "LIVE",
        "polar": None,
        "season": None,
        "voyage_air": None,
        "voyage_sea": None,
        "isolation": None,
        "hazards": [],
        "facts": [],
        "wind_tag": None,
        "temp_tag": None,
    }


def lockouts_from_snapshot(snapshot: dict[str, Any] | None, station_id: str) -> dict[str, Any]:
    if not snapshot:
        return {
            "outdoor": "OPEN",
            "heli": "OPEN",
            "convoy": "OPEN",
            "field": "OPEN",
            "reasons": [],
        }
    block = snapshot["stations"][station_id]
    lockouts = dict(block.get("lockouts") or {})
    lockouts["reasons"] = list(block.get("reasons") or [])
    return lockouts
