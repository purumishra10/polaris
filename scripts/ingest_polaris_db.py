"""Load Polaris landing files into PostgreSQL + Timescale + PostGIS + pgvector."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import numpy as np
import psycopg2
from psycopg2.extras import Json, execute_values

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "datasets"


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def connect():
    return psycopg2.connect(
        host=env("POLARIS_PGHOST", "127.0.0.1"),
        port=env("POLARIS_PGPORT", "5432"),
        user=env("POLARIS_PGUSER", "polaris"),
        password=env("POLARIS_PGPASSWORD", "polaris"),
        dbname=env("POLARIS_PGDATABASE", "polaris"),
    )


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def hashed_embed(text: str, dim: int = 384) -> list[float]:
    vec = np.zeros(dim, dtype=np.float32)
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
    n = float(np.linalg.norm(vec))
    if n:
        vec /= n
    return vec.tolist()


def iso_hour(raw: str) -> str:
    raw = raw.strip().replace(" ", "T")
    if len(raw) == 16:
        raw += ":00"
    if not raw.endswith("Z") and "+" not in raw[10:]:
        raw += "+00:00"
    return raw


def iso_day(raw: str) -> str:
    if len(raw) == 8 and raw.isdigit():
        raw = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return f"{raw}T00:00:00+00:00"


def seed_catalogs(cur):
    stations = [
        ("MAITRI", "Maitri Research Station", "India", "INDIAN_STATION",
         "Schirmacher Oasis, Dronning Maud Land", -70.76683367, 11.73078318, 117, None, None,
         "Year-round since 1989. Inland oasis. AL/03 coords."),
        ("BHARATI", "Bharati Research Station", "India", "INDIAN_STATION",
         "Larsemann Hills, Ingrid Christensen Coast", -69.40680, 76.19525, 35, None, None,
         "Year-round since 18 Mar 2012. Coastal container station. AL/02 coords."),
        ("NOVOLAZAREVSKAYA", "Novolazarevskaya Station", "Russia", "PROXY_NEIGHBOUR",
         "Schirmacher Oasis (~3.5 km from Maitri)", -70.7769, 11.8239, 102, "AT17", "MAITRI",
         "DROMLAN blue-ice runway AT17. Weather/airfield proxy, not a fuel twin."),
        ("PROGRESS", "Progress Station", "Russia", "PROXY_NEIGHBOUR",
         "Larsemann Hills (~8 km from Bharati)", -69.3750, 76.3817, 65, None, "BHARATI",
         "Skiway feeder for Bharati air. Weather/airfield proxy only."),
    ]
    for row in stations:
        cur.execute(
            """
            INSERT INTO stations (
                station_id, name, country, role, region, lat, lon, elevation_m,
                icao_code, neighbour_of, notes, geom
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s), 4326))
            ON CONFLICT (station_id) DO UPDATE SET
                name = EXCLUDED.name,
                lat = EXCLUDED.lat,
                lon = EXCLUDED.lon,
                geom = EXCLUDED.geom,
                notes = EXCLUDED.notes
            """,
            (*row, row[6], row[5]),
        )

    sources = [
        ("OPEN_METEO_REANALYSIS", "REANALYSIS", 0.90, "Open-Meteo ERA5-land style hourly archive"),
        ("NASA_POWER_API", "REANALYSIS", 0.95, "NASA POWER daily solar/weather (LST)"),
        ("NOAA_SWPC", "MEASURED", 0.95, "NOAA Space Weather Prediction Center"),
        ("IMD_BHARATI", "MEASURED", 1.00, "IMD blizzard / climate log, 37th ISEA"),
        ("UAV_ISEA", "MEASURED", 0.90, "42nd/43rd ISEA UAV melt-pond survey"),
        ("NCPOR_ADVISORY", "MEASURED", 1.00, "AL/02, AL/03, 43-ISEA, Maitri-II brief"),
        ("SYNTHETIC_ENGINE", "SYNTHETIC", 0.40, "Fuel-days / occupancy derived from specs"),
        ("ANALOG_FOREIGN", "ANALOG", 0.35, "Casey LCA or other foreign-station analog"),
        ("LOCKOUT_RULE", "RULE", 1.00, "Published ops rule, not a learned model"),
        ("OPERATOR", "OPERATOR", 1.00, "Clock / what-if toggle"),
    ]
    execute_values(
        cur,
        """
        INSERT INTO source_catalog (source_type, provenance_tag, confidence_default, description)
        VALUES %s
        ON CONFLICT (source_type) DO UPDATE SET
            provenance_tag = EXCLUDED.provenance_tag,
            confidence_default = EXCLUDED.confidence_default,
            description = EXCLUDED.description
        """,
        sources,
    )

    occupancy = [
        ("MAITRI_CURRENT", "MAITRI", "CURRENT", 25, 65, 3, 10, "AL/03 + 43-ISEA",
         "Winter 25 in all sources; summer 65 (AL/03) / 40–60 (43-ISEA). Use 65 as peak."),
        ("MAITRI_II", "MAITRI", "MAITRI_II", 40, 140, 3, 10, "Maitri-II brief 2024",
         "Planned plant. Summer wing shuts in winter."),
        ("MAITRI_MISSED_FLIGHT", "MAITRI", "MISSED_LAST_FLIGHT", 65, 65, 3, 10, "What-if",
         "Summer occupancy stuck into winter."),
        ("BHARATI_CURRENT", "BHARATI", "CURRENT", 47, 72, 3, 10, "AL/02",
         "47 main building; +25 summer camp = 72 peak."),
        ("BHARATI_MISSED_FLIGHT", "BHARATI", "MISSED_LAST_FLIGHT", 72, 72, 3, 10, "What-if",
         "Peak 72 stuck into winter."),
    ]
    cur.execute("DELETE FROM occupancy_profiles")
    execute_values(
        cur,
        """
        INSERT INTO occupancy_profiles (
            profile_id, station_id, scenario, winter_headcount, summer_headcount,
            winter_start_month, winter_end_month, source, notes
        ) VALUES %s
        """,
        occupancy,
    )

    polar = [
        ("BHARATI_DAY_2018", "BHARATI", "2017-18", "POLAR_DAY", "2017-11-20", "2018-01-22", 63,
         "IMD / MAUSAM 37th ISEA", "63 days polar day"),
        ("BHARATI_NIGHT_2018", "BHARATI", "2017-18", "POLAR_NIGHT", "2018-05-28", "2018-07-16", 49,
         "IMD / MAUSAM 37th ISEA", "49 days polar night; solar yield = 0"),
    ]
    cur.execute("DELETE FROM polar_calendar")
    execute_values(
        cur,
        """
        INSERT INTO polar_calendar (
            calendar_id, station_id, season_label, event_type, start_date, end_date,
            duration_days, source, notes
        ) VALUES %s
        """,
        polar,
    )

    rules = [
        ("OUTDOOR_GUST_23KN", "IMD gust outdoor limit", "BOTH", "OUTDOOR",
         {"parameter": "WIND_GUST_10M", "op": ">", "value": 23, "unit": "kn",
          "note": "IMD blizzard component; Open-Meteo gust is km/h, convert / 1.852"},
         "IMD blizzard definition", "Limit outdoor / vehicle ops"),
        ("BLIZZARD_EVENT", "Active IMD blizzard", "BHARATI", "OUTDOOR",
         {"event_type": "BLIZZARD", "also_lock": ["HELI"]},
         "IMD 2017-18 log", "Outdoor + heli locked while event is active"),
        ("HELI_SHIP_NEARBY", "Heli only if ship nearby", "BOTH", "HELI",
         {"requires": "ship_nearby"},
         "43-ISEA / AL", "Kamov/ship-based helicopters exist only while the voyage ship is at the barrier or Quilty Bay"),
        ("CREVASSE_OCT_NOV", "Novo–Maitri crevasse season", "MAITRI", "CONVOY",
         {"months": [10, 11], "layer": "HAZARD_CREVASSE_NOVO_MAITRI"},
         "GPR 2023-24", "Convoy caution on ice margin"),
        ("MELT_POND_DEC", "December melt-pond surge", "MAITRI", "FIELD",
         {"month": 12, "source": "UAV_ISEA"},
         "42nd/43rd ISEA UAV", "Ice-edge work restricted during surge"),
        ("POLAR_NIGHT_SOLAR_ZERO", "Polar night forces CHP-only", "BOTH", "ENERGY",
         {"solar_yield": 0},
         "IMD polar calendar", "Solar = 0; fuel-days use CHP-only"),
        ("IL76_COLD_RUNWAY", "IL-76 needs cold blue ice", "NOVOLAZAREVSKAYA", "AIR",
         {"parameter": "AIR_TEMP_2M", "op": "<", "value": -5, "unit": "degC"},
         "DROMLAN / logistics graph", "AT17 heavy landing closed if surface warmer than -5 C"),
        ("R_SCALE_RADIO", "NOAA R-scale HF / ISRO", "BOTH", "ISRO",
         {"parameter": "NOAA_R", "op": ">=", "value": 1},
         "NOAA SWPC", "Bharati radomes degraded; Maitri HF science disturbed"),
    ]
    cur.execute("DELETE FROM lockout_rules")
    execute_values(
        cur,
        """
        INSERT INTO lockout_rules (rule_id, name, applies_to, lockout_target, condition_json, source, notes)
        VALUES %s
        """,
        [(r[0], r[1], r[2], r[3], Json(r[4]), r[5], r[6]) for r in rules],
    )

    windows = [
        ("AIR_DROMLAN_CLOSE", "AIR", "MAITRI", "Late Oct", "mid-Feb", "2024-02-14", "2023-10-25",
         "Last intercontinental IL-76 typically mid-February", "43-ISEA"),
        ("SEA_INDIA_BAY_CLOSE", "SEA", "MAITRI", "Jan", "mid-Mar", "2024-03-15", "2024-01-07",
         "March 15 hard exit from India Bay / Lazarev Sea", "43-ISEA"),
        ("AIR_BHARATI_OPEN", "AIR", "BHARATI", "mid-Nov", "late Jan", "2024-01-31", "2023-11-15",
         "No direct CT–Bharati flight; feeder via Progress", "43-ISEA / AL/02"),
        ("SEA_QUILTY_OPEN", "SEA", "BHARATI", "Dec", "Feb", "2024-02-28", "2023-12-01",
         "Ship 10–16 days Cape Town to Quilty Bay", "AL/02"),
        ("HELI_SHIP_ONLY", "HELI", None, "when ship nearby", "when ship nearby", None, None,
         "No independent station helicopter", "AL/03"),
    ]
    cur.execute("DELETE FROM voyage_windows")
    execute_values(
        cur,
        """
        INSERT INTO voyage_windows (
            window_id, mode, station_id, typical_open, typical_close,
            close_date_nominal, open_date_nominal, notes, source
        ) VALUES %s
        """,
        windows,
    )

    scenarios = [
        ("BASELINE", "Baseline clock", False, 0, False, 20.0, "Published occupancy and voyage windows"),
        ("SHIP_DELAY_14D", "Ship delayed 14 days", False, 14, False, 20.0, "Fuel-days drop at both stations"),
        ("MISSED_LAST_FLIGHT", "Summer occupancy stuck", True, 0, False, 20.0, "NCPOR nightmare scenario"),
        ("MAITRI_II_WINTER", "Maitri-II winter wing", False, 0, True, 20.0, "Summer wing off, 600 kL / 750 kVA"),
        ("REPLAY_2018_08_05", "5 Aug 2018 blizzard", False, 0, False, 20.0, "IMD 80 kn night at Bharati"),
    ]
    cur.execute("DELETE FROM operator_scenarios")
    execute_values(
        cur,
        """
        INSERT INTO operator_scenarios (
            scenario_id, name, missed_last_flight, ship_delay_days, maitri_ii, indoor_setpoint_c, notes
        ) VALUES %s
        """,
        scenarios,
    )

    instruments = [
        ("MAITRI_MARA", "MAITRI", "MARA VHF radar 54.5 MHz", "NCPOR", "BL turbulence, waves, winds", None, None),
        ("MAITRI_CADI", "MAITRI", "CADI ionosonde 1–30 MHz", "NPL", "Ionosphere to ~500 km", None, None),
        ("MAITRI_GISTM", "MAITRI", "GSV-4004B GISTM", "NPL", "L-band scintillation + TEC", None, None),
        ("MAITRI_AWS", "MAITRI", "IMD Sankalp AWS", "IMD", "T, P, RH, wind", -70.76683367, 11.73078318),
        ("MAITRI_SEISMO", "MAITRI", "Seismograph pad", "NGRI", "0–500 Hz", -70.765614, 11.736328),
        ("BHARATI_ECIL", "BHARATI", "ECIL X/S/C-band radomes", "ISRO/ECIL", "EOS downlink to NRSC / NCPOR", -69.40550, 76.19850),
        ("BHARATI_AWS", "BHARATI", "IMD surface observatory", "IMD", "Synoptic 3-hourly, radiation, ozonesonde", -69.40680, 76.19525),
        ("BHARATI_GISTM", "BHARATI", "GSV-4004B GISTM", "NPL", "Scintillation + TEC", None, None),
    ]
    cur.execute("DELETE FROM instruments")
    for inst in instruments:
        lat, lon = inst[5], inst[6]
        if lat is None:
            cur.execute(
                """
                INSERT INTO instruments (instrument_id, station_id, name, owner, measures, lat, lon, source)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'NCPOR/IMD/AL')
                """,
                inst,
            )
        else:
            cur.execute(
                """
                INSERT INTO instruments (
                    instrument_id, station_id, name, owner, measures, lat, lon, geom, source
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s), 4326), 'NCPOR/IMD/AL')
                """,
                (*inst, lon, lat),
            )


def ingest_openmeteo(cur):
    mapping = [
        ("temperature_2m", "AIR_TEMP_2M", "degC"),
        ("relative_humidity_2m", "RELATIVE_HUMIDITY", "%"),
        ("dew_point_2m", "DEW_POINT_2M", "degC"),
        ("surface_pressure", "SURFACE_PRESSURE", "hPa"),
        ("wind_speed_10m", "WIND_SPEED_10M", "km/h"),
        ("wind_direction_10m", "WIND_DIRECTION_10M", "deg"),
        ("wind_gusts_10m", "WIND_GUST_10M", "km/h"),
        ("direct_normal_irradiance", "SOLAR_DNI", "W/m2"),
        ("diffuse_radiation", "SOLAR_DIFFUSE", "W/m2"),
        ("snowfall", "SNOWFALL", "cm"),
    ]
    n = 0
    for st in ["MAITRI", "BHARATI", "NOVOLAZAREVSKAYA", "PROGRESS"]:
        path = DATA / "environment" / f"openmeteo_hourly_2023_{st.lower()}.json"
        if not path.exists():
            print(f"  skip missing {path.name}")
            continue
        hourly = load_json(path).get("hourly", {})
        times = hourly.get("time", [])
        rows = []
        for i, t in enumerate(times):
            ts = iso_hour(t)
            for src_key, param, unit in mapping:
                series = hourly.get(src_key) or []
                if i >= len(series) or series[i] is None:
                    continue
                rows.append((ts, st, param, float(series[i]), unit, "OPEN_METEO_REANALYSIS", "HOURLY", 0.90, 0))
        execute_values(
            cur,
            """
            INSERT INTO station_telemetry (
                time, station_id, parameter, value, unit, source_type, cadence, confidence_score, quality_flag
            ) VALUES %s
            ON CONFLICT (station_id, parameter, source_type, time) DO NOTHING
            """,
            rows,
            page_size=5000,
        )
        n += len(rows)
        print(f"  Open-Meteo {st}: {len(rows)} rows")
    return n


def ingest_nasa(cur):
    mapping = [
        ("T2M", "DAILY_TEMP_2M", "degC"),
        ("T2M_MAX", "DAILY_TEMP_MAX", "degC"),
        ("T2M_MIN", "DAILY_TEMP_MIN", "degC"),
        ("WS2M", "DAILY_WIND_SPEED_2M", "m/s"),
        ("WS10M", "DAILY_WIND_SPEED_10M", "m/s"),
        ("ALLSKY_SFC_SW_DWN", "DAILY_SOLAR_IRRADIANCE", "kW-hr/m2/day"),
        ("PS", "DAILY_SURFACE_PRESSURE", "kPa"),
        ("RH2M", "DAILY_RELATIVE_HUMIDITY", "%"),
    ]
    n = 0
    for st in ["MAITRI", "BHARATI", "NOVOLAZAREVSKAYA", "PROGRESS"]:
        path = DATA / "environment" / f"nasa_power_daily_{st.lower()}.json"
        if not path.exists():
            continue
        params = load_json(path).get("properties", {}).get("parameter", {})
        dates = set()
        for src_key, _param, _unit in mapping:
            dates.update((params.get(src_key) or {}).keys())
        rows = []
        for date_str in sorted(dates):
            ts = iso_day(date_str)
            for src_key, param, unit in mapping:
                val = (params.get(src_key) or {}).get(date_str)
                if val is None or val == -999:
                    continue
                rows.append((ts, st, param, float(val), unit, "NASA_POWER_API", "DAILY", 0.95, 0))
        execute_values(
            cur,
            """
            INSERT INTO station_telemetry (
                time, station_id, parameter, value, unit, source_type, cadence, confidence_score, quality_flag
            ) VALUES %s
            ON CONFLICT (station_id, parameter, source_type, time) DO NOTHING
            """,
            rows,
            page_size=5000,
        )
        n += len(rows)
        print(f"  NASA POWER {st}: {len(rows)} rows")
    return n


def ingest_space_weather(cur):
    n = 0
    kp_path = DATA / "space_weather" / "planetary_k_index_1m.json"
    if kp_path.exists():
        rows = []
        for rec in load_json(kp_path):
            t = rec.get("time_tag")
            if not t:
                continue
            if "T" in t and not t.endswith("Z") and "+" not in t:
                t = t + "+00:00"
            if rec.get("kp_index") is not None:
                rows.append((t, "KP_INDEX", float(rec["kp_index"]), None, "index", "NOAA_SWPC"))
            if rec.get("estimated_kp") is not None:
                rows.append((t, "ESTIMATED_KP", float(rec["estimated_kp"]), rec.get("kp"), "index", "NOAA_SWPC"))
        execute_values(
            cur,
            """
            INSERT INTO space_weather (time, parameter, value, value_text, unit, source_type)
            VALUES %s
            ON CONFLICT (parameter, source_type, time) DO NOTHING
            """,
            rows,
            page_size=5000,
        )
        n += len(rows)
        print(f"  Kp rows: {len(rows)}")

    xray_path = DATA / "space_weather" / "solar_xray_flux_6h.json"
    if xray_path.exists():
        rows = []
        for rec in load_json(xray_path):
            t = rec.get("time_tag")
            flux = rec.get("flux")
            energy = rec.get("energy") or "unknown"
            if t is None or flux is None:
                continue
            rows.append((t, f"XRAY_FLUX_{energy}", float(flux), energy, "W/m2", "NOAA_SWPC"))
        execute_values(
            cur,
            """
            INSERT INTO space_weather (time, parameter, value, value_text, unit, source_type)
            VALUES %s
            ON CONFLICT (parameter, source_type, time) DO NOTHING
            """,
            rows,
            page_size=5000,
        )
        n += len(rows)
        print(f"  X-ray rows: {len(rows)}")

    scales_path = DATA / "space_weather" / "noaa_space_weather_scales.json"
    if scales_path.exists():
        raw = load_json(scales_path)
        rows = []
        for key, rec in raw.items():
            ds = rec.get("DateStamp")
            ts = rec.get("TimeStamp") or "00:00:00"
            if not ds:
                continue
            t = f"{ds}T{ts}+00:00"
            horizon = {"-1": "observed_prev", "0": "observed", "1": "forecast_d1",
                       "2": "forecast_d2", "3": "forecast_d3"}.get(str(key), str(key))
            for scale_name in ("R", "S", "G"):
                block = rec.get(scale_name) or {}
                scale = block.get("Scale")
                text = block.get("Text")
                val = None
                if scale not in (None, ""):
                    try:
                        val = float(scale)
                    except ValueError:
                        val = None
                rows.append((t, f"NOAA_{scale_name}_{horizon}", val, text, "scale", "NOAA_SWPC"))
        execute_values(
            cur,
            """
            INSERT INTO space_weather (time, parameter, value, value_text, unit, source_type)
            VALUES %s
            ON CONFLICT (parameter, source_type, time) DO NOTHING
            """,
            rows,
        )
        n += len(rows)
        print(f"  NOAA scale rows: {len(rows)}")
    return n


def ingest_hazards(cur):
    blizzard = load_json(DATA / "geospatial_hazards" / "bharati_blizzard_log_imd.json")
    rows = []
    for b in blizzard:
        sev = "SEVERE" if b["max_wind_kn"] >= 60 else "MODERATE"
        extra = {
            "duration_hrs": b.get("duration_hrs"),
            "max_wind_kmh": b.get("max_wind_kmh"),
            "lowest_mslp_hpa": b.get("lowest_mslp_hpa"),
        }
        rows.append((
            b["event_id"], "BHARATI", "BLIZZARD",
            iso_hour(b["start_utc"]), iso_hour(b["end_utc"]),
            b.get("duration_hrs"), sev, b.get("max_wind_kn"), "knots",
            Json(extra), b.get("notes"), "IMD_BHARATI",
        ))
    uav = load_json(DATA / "geospatial_hazards" / "maitri_cryosphere_uav_survey.json")
    pond = uav["melt_pond_dynamics_dec2022"]
    peak = max(pond, key=lambda r: r["volume_m3"])
    rows.append((
        "MELT-2022-DEC", "MAITRI", "MELT_SURGE",
        "2022-12-18T00:00:00+00:00", "2022-12-31T00:00:00+00:00",
        13 * 24, "CRITICAL", peak["volume_m3"], "m3",
        Json({"peak_date": peak["date"], "survey_area_km2": uav.get("survey_area_km2")}),
        "UAV melt-pond week: 2.3k → 29k m3", "UAV_ISEA",
    ))
    rows.append((
        "CREVASSE-OCT-NOV", "MAITRI", "CREVASSE",
        "2023-10-01T00:00:00+00:00", "2023-11-30T00:00:00+00:00",
        None, "CRITICAL", 200, "m",
        Json({"gpr_depth_m": 200, "season": "Oct-Nov"}),
        "Seasonal crevasse shear zone Novo–Maitri traverse", "NCPOR_ADVISORY",
    ))
    cur.execute("DELETE FROM hazard_events")
    execute_values(
        cur,
        """
        INSERT INTO hazard_events (
            event_id, station_id, event_type, start_time, end_time, duration_hrs,
            severity, max_metric_value, metric_unit, extra, description, source
        ) VALUES %s
        """,
        rows,
    )
    print(f"  hazard_events: {len(rows)}")

    cur.execute("DELETE FROM melt_pond_observations")
    pond_rows = [
        ("MAITRI", p["date"], p["area_m2"], p["depth_m"], p["volume_m3"],
         p["air_temp_c"], p["bed_temp_c"], p["status"], "UAV_ISEA")
        for p in pond
    ]
    execute_values(
        cur,
        """
        INSERT INTO melt_pond_observations (
            station_id, observed_on, area_m2, depth_m, volume_m3, air_temp_c, bed_temp_c, status, source
        ) VALUES %s
        """,
        pond_rows,
    )


def ingest_infra(cur):
    maitri = load_json(DATA / "station_infrastructure" / "maitri_station_engineering_spec.json")
    bharati = load_json(DATA / "station_infrastructure" / "bharati_station_engineering_spec.json")
    assets = [
        ("MAITRI_CHP_PLANT", "MAITRI", "CHP Generation Units (6x125 kVA)", "POWER_GENERATION",
         750.0, "kVA", "PLANNED", Json(maitri["maitri_ii_plant_specs"]["power_plant"])),
        ("MAITRI_FUEL_FARM", "MAITRI", "Main Bulk JET A-1 Fuel Tank Farm", "FUEL_STORAGE",
         600000.0, "liters", "PLANNED", Json(maitri["maitri_ii_plant_specs"]["fuel_farm"])),
        ("MAITRI_HELIPAD", "MAITRI", "Kamov-32 Rated Helipad & Hangar", "AVIATION",
         1.0, "pads", "PLANNED", Json(maitri["maitri_ii_plant_specs"]["aviation"])),
        ("BHARATI_CONTAINER_SHELL", "BHARATI", "134-Module Insulated Shell (U=0.135)", "BUILDING_ENVELOPE",
         134.0, "containers", "OPERATIONAL", Json(bharati["architectural_specs"])),
        ("BHARATI_RO_PLANT", "BHARATI", "Seawater Desalination RO Facility", "WATER_TREATMENT",
         10000.0, "L/day", "OPERATIONAL", Json(bharati["power_and_hvac"])),
        ("BHARATI_ISRO_RADOMES", "BHARATI", "ECIL X/S/C-band Ground Receiving Antennas", "SATELLITE_DOWNLINK",
         3.0, "radomes", "OPERATIONAL", Json(bharati["master_plan_zones"][4])),
    ]
    cur.execute("DELETE FROM infrastructure_assets")
    execute_values(
        cur,
        """
        INSERT INTO infrastructure_assets (
            asset_id, station_id, name, category, capacity_val, capacity_unit, operating_status, metadata
        ) VALUES %s
        """,
        assets,
    )
    print(f"  infrastructure_assets: {len(assets)}")


def ingest_logistics(cur):
    graph = load_json(DATA / "sea_ice_logistics" / "antarctic_multimodal_logistics_graph.json")
    cur.execute("DELETE FROM logistics_routes")
    cur.execute("DELETE FROM logistics_nodes")
    for node in graph["nodes"]:
        lat, lon = node.get("lat"), node.get("lon")
        if lat is not None and lon is not None:
            cur.execute(
                """
                INSERT INTO logistics_nodes (node_id, name, node_type, country, lat, lon, geom, metadata)
                VALUES (%s,%s,%s,%s,%s,%s, ST_SetSRID(ST_MakePoint(%s,%s), 4326), '{}'::jsonb)
                """,
                (node["node_id"], node["name"], node["type"], node.get("country"), lat, lon, lon, lat),
            )
        else:
            cur.execute(
                """
                INSERT INTO logistics_nodes (node_id, name, node_type, country, metadata)
                VALUES (%s,%s,%s,%s, '{}'::jsonb)
                """,
                (node["node_id"], node["name"], node["type"], node.get("country")),
            )
    for edge in graph["edges"]:
        dur = edge.get("duration_hours")
        if dur is None and "duration_days" in edge:
            dur = edge["duration_days"] * 24.0
        rng = edge.get("duration_range_days")
        cur.execute(
            """
            INSERT INTO logistics_routes (
                route_id, origin, destination, transport_mode, duration_hrs, duration_range_days,
                season_window, capacity_pax, capacity_cargo_t, distance_km, constraints, metadata
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                edge["route_id"], edge["origin"], edge["destination"], edge["mode"], dur,
                rng, edge.get("season_window"), edge.get("capacity_pax"),
                edge.get("capacity_cargo_tonnes"), edge.get("distance_km"),
                edge.get("constraint"), Json(edge),
            ),
        )
    print(f"  logistics nodes={len(graph['nodes'])} routes={len(graph['edges'])}")


def ingest_spatial(cur):
    gj = load_json(DATA / "geospatial_hazards" / "antarctic_stations_spatial_features.geojson")
    cur.execute("DELETE FROM spatial_features")
    n = 0
    for feat in gj["features"]:
        props = feat.get("properties") or {}
        fid = props.get("id")
        geom = json.dumps(feat["geometry"])
        station = props.get("station")
        if station == "MAITRI_II":
            station = "MAITRI"
        cur.execute(
            """
            INSERT INTO spatial_features (feature_id, station_id, name, category, properties, geom)
            VALUES (%s,%s,%s,%s,%s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
            """,
            (fid, station, props.get("name"), props.get("category"), Json(props), geom),
        )
        n += 1
    print(f"  spatial_features: {n}")


def chunk_markdown(text: str, source: str) -> list[tuple[str, str]]:
    parts = re.split(r"\n(?=#{1,3} )", text)
    out = []
    for part in parts:
        part = part.strip()
        if len(part) < 40:
            continue
        heading = part.split("\n", 1)[0].lstrip("# ").strip()
        body = part
        if len(body) <= 1200:
            out.append((heading, body))
            continue
        step = 1050
        for i in range(0, len(body), step):
            sl = body[i:i + 1200]
            if len(sl) >= 40:
                out.append((heading, sl))
    return out


def ingest_knowledge(cur):
    docs = [
        ("KB_TWIN", "knowledge_base", "Maitri & Bharati digital twin knowledge base",
         "digital_twin_knowledge_base.md", "NCPOR_ADVISORY"),
        ("KB_PAPERS", "reading_guide", "Papers reading guide",
         "papers_reading_guide.md", "NCPOR_ADVISORY"),
        ("KB_DATASETS", "data_dictionary", "Dataset repository & data dictionary",
         "datasets/README.md", "NCPOR_ADVISORY"),
    ]
    cur.execute("DELETE FROM knowledge_chunks")
    cur.execute("DELETE FROM knowledge_documents")
    n = 0
    for doc_id, collection, title, rel, prov in docs:
        path = ROOT / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        cur.execute(
            """
            INSERT INTO knowledge_documents (doc_id, collection, title, source_path, provenance, metadata)
            VALUES (%s,%s,%s,%s,%s,%s)
            """,
            (doc_id, collection, title, rel, prov, Json({"bytes": path.stat().st_size})),
        )
        chunks = chunk_markdown(text, rel)
        rows = []
        for i, (heading, content) in enumerate(chunks):
            vec = hashed_embed(f"{heading}\n{content}")
            vec_lit = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
            rows.append((doc_id, i, heading, content, vec_lit, Json({"source": rel})))
        execute_values(
            cur,
            """
            INSERT INTO knowledge_chunks (doc_id, chunk_index, heading, content, embedding, metadata)
            VALUES %s
            """,
            rows,
            template="(%s,%s,%s,%s,%s::vector,%s)",
        )
        n += len(rows)
        print(f"  knowledge {doc_id}: {len(rows)} chunks")
    return n


def verify(cur):
    print("\n== verify ==")
    cur.execute("SELECT extname, extversion FROM pg_extension ORDER BY 1")
    print("extensions:", cur.fetchall())
    for table in [
        "stations", "station_telemetry", "space_weather", "hazard_events",
        "infrastructure_assets", "logistics_routes", "spatial_features",
        "knowledge_chunks", "lockout_rules", "occupancy_profiles",
    ]:
        cur.execute(f"SELECT count(*) FROM {table}")
        print(f"  {table}: {cur.fetchone()[0]}")
    cur.execute(
        """
        SELECT station_id, parameter, count(*)
        FROM station_telemetry
        GROUP BY 1, 2
        ORDER BY 1, 2
        LIMIT 12
        """
    )
    print("telemetry sample groups:", cur.fetchall())
    cur.execute(
        """
        SELECT heading
        FROM knowledge_chunks
        ORDER BY embedding <=> %s::vector
        LIMIT 3
        """,
        ("[" + ",".join(f"{x:.6f}" for x in hashed_embed("Bharati blizzard 80 knot lockout")) + "]",),
    )
    print("pgvector nearest:", [r[0] for r in cur.fetchall()])
    cur.execute(
        """
        SELECT name, ST_AsText(geom)
        FROM stations
        WHERE role = 'INDIAN_STATION'
        """
    )
    print("postgis stations:", cur.fetchall())


def main():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        print("Seeding catalogs...")
        seed_catalogs(cur)
        conn.commit()
        print("Ingesting Open-Meteo...")
        ingest_openmeteo(cur)
        conn.commit()
        print("Ingesting NASA POWER...")
        ingest_nasa(cur)
        conn.commit()
        print("Ingesting space weather...")
        ingest_space_weather(cur)
        conn.commit()
        print("Ingesting hazards / UAV...")
        ingest_hazards(cur)
        conn.commit()
        print("Ingesting infrastructure...")
        ingest_infra(cur)
        conn.commit()
        print("Ingesting logistics...")
        ingest_logistics(cur)
        conn.commit()
        print("Ingesting PostGIS features...")
        ingest_spatial(cur)
        conn.commit()
        print("Ingesting knowledge + pgvector...")
        ingest_knowledge(cur)
        conn.commit()
        print("Refreshing daily aggregate...")
        conn.commit()
        conn.autocommit = True
        try:
            cur.execute("CALL refresh_continuous_aggregate('telemetry_daily', NULL, NULL);")
        except Exception as exc:
            print(f"  (skip continuous aggregate refresh: {exc})")
        conn.autocommit = False
        verify(cur)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
    print("\nPolaris database load complete.")


if __name__ == "__main__":
    main()
