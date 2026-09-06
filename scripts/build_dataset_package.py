"""
Polaris Antarctic Digital Twin - Comprehensive Dataset Pipeline
Fetches, normalizes, structures, and persists all meteorological, solar, space weather,
cryosphere, structural/BIM, microgrid energy, and logistics datasets for Maitri & Bharati.
"""

import os
import json
import sqlite3
import datetime
import requests
import csv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "datasets")
ENV_DIR = os.path.join(DATA_DIR, "environment")
SPACE_DIR = os.path.join(DATA_DIR, "space_weather")
LOGISTICS_DIR = os.path.join(DATA_DIR, "sea_ice_logistics")
INFRA_DIR = os.path.join(DATA_DIR, "station_infrastructure")
GEO_DIR = os.path.join(DATA_DIR, "geospatial_hazards")
DB_DIR = os.path.join(DATA_DIR, "unified_db")

for d in [ENV_DIR, SPACE_DIR, LOGISTICS_DIR, INFRA_DIR, GEO_DIR, DB_DIR]:
    os.makedirs(d, exist_ok=True)

HEADERS = {'User-Agent': 'PolarisAntarcticDigitalTwin/1.0 (NCPOR SIH Research Engine)'}

STATIONS = {
    "MAITRI": {
        "lat": -70.7668,
        "lon": 11.7308,
        "elevation": 117,
        "name": "Maitri Research Station",
        "region": "Schirmacher Oasis, Central Dronning Maud Land",
        "proxy": "Novolazarevskaya (AT17)"
    },
    "BHARATI": {
        "lat": -69.4068,
        "lon": 76.1953,
        "elevation": 35,
        "name": "Bharati Research Station",
        "region": "Larsemann Hills, Ingrid Christensen Coast",
        "proxy": "Progress Station"
    },
    "NOVOLAZAREVSKAYA": {
        "lat": -70.7769,
        "lon": 11.8239,
        "elevation": 102,
        "name": "Novolazarevskaya Station",
        "region": "Schirmacher Oasis (Russia, ~3.5 km from Maitri)",
        "proxy": None
    },
    "PROGRESS": {
        "lat": -69.3750,
        "lon": 76.3817,
        "elevation": 65,
        "name": "Progress Station",
        "region": "Larsemann Hills (Russia, ~8 km from Bharati)",
        "proxy": None
    }
}

print("=== 1. Fetching NASA POWER Solar & Weather Datasets ===")
# Fetch multi-year NASA POWER daily energy parameters (2022 to 2024 full record)
for st_id, meta in STATIONS.items():
    print(f"Fetching NASA POWER for {st_id}...")
    url = (
        f"https://power.larc.nasa.gov/api/temporal/daily/point?"
        f"parameters=T2M,T2M_MAX,T2M_MIN,WS2M,WS10M,ALLSKY_SFC_SW_DWN,PS,RH2M&"
        f"community=RE&longitude={meta['lon']}&latitude={meta['lat']}&"
        f"start=20220101&end=20241231&format=JSON"
    )
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code == 200:
            out_file = os.path.join(ENV_DIR, f"nasa_power_daily_{st_id.lower()}.json")
            with open(out_file, 'w', encoding='utf-8') as f:
                f.write(r.text)
            print(f"  [OK] Saved {out_file} ({len(r.text)} bytes)")
        else:
            print(f"  [WARN] Failed {st_id}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  [ERROR] {st_id}: {e}")

print("\n=== 2. Fetching Open-Meteo High-Resolution Hourly Reanalysis & Forecasts ===")
# Fetch hourly data (2023 full year high resolution)
for st_id, meta in STATIONS.items():
    print(f"Fetching Open-Meteo Hourly for {st_id}...")
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={meta['lat']}&longitude={meta['lon']}&"
        f"start_date=2023-01-01&end_date=2023-12-31&"
        f"hourly=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,"
        f"wind_speed_10m,wind_direction_10m,wind_gusts_10m,direct_normal_irradiance,"
        f"diffuse_radiation,snowfall&timezone=UTC"
    )
    try:
        r = requests.get(url, headers=HEADERS, timeout=40)
        if r.status_code == 200:
            out_file = os.path.join(ENV_DIR, f"openmeteo_hourly_2023_{st_id.lower()}.json")
            with open(out_file, 'w', encoding='utf-8') as f:
                f.write(r.text)
            print(f"  [OK] Saved {out_file} ({len(r.text)} bytes)")
        else:
            print(f"  [WARN] Failed {st_id}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  [ERROR] {st_id}: {e}")

print("\n=== 3. Fetching NOAA SWPC Space Weather Feeds ===")
swpc_endpoints = {
    "planetary_k_index_1m.json": "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
    "solar_xray_flux_6h.json": "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json",
    "noaa_space_weather_scales.json": "https://services.swpc.noaa.gov/products/noaa-scales.json"
}

for fname, url in swpc_endpoints.items():
    print(f"Fetching {fname}...")
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            out_file = os.path.join(SPACE_DIR, fname)
            with open(out_file, 'w', encoding='utf-8') as f:
                f.write(r.text)
            print(f"  [OK] Saved {out_file} ({len(r.text)} bytes)")
        else:
            print(f"  [WARN] Failed {fname}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  [ERROR] {fname}: {e}")

print("\n=== 4. Building Ground Truth In-Situ & Instrument Catalogues ===")

# In-Situ Bharati 37th ISEA Complete Meteorological Series & Blizzard Log
bharati_blizzard_log = [
    {"event_id": "BLZ-2017-01", "start_utc": "2017-12-16 19:36:00", "end_utc": "2017-12-17 07:30:00", "duration_hrs": 11.9, "max_wind_kn": 73, "max_wind_kmh": 135.2, "lowest_mslp_hpa": 965.2, "notes": "Summer blizzard during early expedition setup"},
    {"event_id": "BLZ-2018-02", "start_utc": "2018-05-08 16:30:00", "end_utc": "2018-05-08 20:00:00", "duration_hrs": 3.5, "max_wind_kn": 47, "max_wind_kmh": 87.0, "lowest_mslp_hpa": 980.1, "notes": "Autumn polar night precursor"},
    {"event_id": "BLZ-2018-03", "start_utc": "2018-05-23 20:15:00", "end_utc": "2018-05-24 02:30:00", "duration_hrs": 6.3, "max_wind_kn": 48, "max_wind_kmh": 88.9, "lowest_mslp_hpa": 974.5, "notes": "Onset of polar night period"},
    {"event_id": "BLZ-2018-04", "start_utc": "2018-06-05 02:30:00", "end_utc": "2018-06-05 19:15:00", "duration_hrs": 16.8, "max_wind_kn": 50, "max_wind_kmh": 92.6, "lowest_mslp_hpa": 969.0, "notes": "Mid-winter extended gale"},
    {"event_id": "BLZ-2018-05", "start_utc": "2018-07-21 11:30:00", "end_utc": "2018-07-22 05:30:00", "duration_hrs": 18.0, "max_wind_kn": 52, "max_wind_kmh": 96.3, "lowest_mslp_hpa": 962.3, "notes": "End of polar night, heavy snow drift"},
    {"event_id": "BLZ-2018-06", "start_utc": "2018-08-09 09:50:00", "end_utc": "2018-08-10 00:30:00", "duration_hrs": 14.7, "max_wind_kn": 57, "max_wind_kmh": 105.6, "lowest_mslp_hpa": 958.0, "notes": "Deep low pressure trough"},
    {"event_id": "BLZ-2018-07", "start_utc": "2018-08-27 13:45:00", "end_utc": "2018-08-27 19:15:00", "duration_hrs": 5.5, "max_wind_kn": 46, "max_wind_kmh": 85.2, "lowest_mslp_hpa": 971.2, "notes": "Late winter gust event"},
    {"event_id": "BLZ-2018-08", "start_utc": "2018-08-30 18:15:00", "end_utc": "2018-08-31 12:15:00", "duration_hrs": 18.0, "max_wind_kn": 63, "max_wind_kmh": 116.7, "lowest_mslp_hpa": 956.4, "notes": "Annual absolute min temperature period"},
    {"event_id": "BLZ-2018-09", "start_utc": "2018-11-05 02:01:00", "end_utc": "2018-11-06 01:59:00", "duration_hrs": 24.0, "max_wind_kn": 49, "max_wind_kmh": 90.7, "lowest_mslp_hpa": 954.7, "notes": "Longest blizzard of the year (24 hrs continuous); lowest MSLP (954.7 hPa)"}
]

with open(os.path.join(GEO_DIR, "bharati_blizzard_log_imd.json"), "w", encoding="utf-8") as f:
    json.dump(bharati_blizzard_log, f, indent=2)

# Cryosphere UAV Melt-Pond & Ice Mass Loss Data (42nd/43rd ISEA)
cryosphere_uav_data = {
    "survey_site": "Maitri Continental Ice-Sheet Margin (Schirmacher Oasis)",
    "survey_area_acres": 100,
    "survey_area_km2": 0.27,
    "dem_resolution_cm": 8.5,
    "supraglacial_lake_coords": {"lat": -70.772814, "lon": 11.753228},
    "melt_pond_dynamics_dec2022": [
        {"date": "2022-12-18", "area_m2": 9151, "depth_m": 0.25, "volume_m3": 2279, "air_temp_c": -2.1, "bed_temp_c": -1.2, "status": "Early Pooling"},
        {"date": "2022-12-21", "area_m2": 15420, "depth_m": 0.85, "volume_m3": 11200, "air_temp_c": 0.4, "bed_temp_c": 2.1, "status": "Rapid Expansion"},
        {"date": "2022-12-24", "area_m2": 24727, "depth_m": 1.60, "volume_m3": 29272, "air_temp_c": 1.8, "bed_temp_c": 8.0, "status": "Peak Volume (Surge)"},
        {"date": "2022-12-28", "area_m2": 18300, "depth_m": 1.10, "volume_m3": 16400, "air_temp_c": -0.8, "bed_temp_c": 3.4, "status": "Subsurface Drainage"},
        {"date": "2022-12-31", "area_m2": 11050, "depth_m": 0.45, "volume_m3": 4500, "air_temp_c": -3.5, "bed_temp_c": -0.5, "status": "Refreezing"}
    ],
    "ice_sheet_mass_loss_headline": {
        "duration": "7 days",
        "elevation_drop_m": 0.25,
        "mass_loss_kt": 13.6,
        "cryofacies_classes": ["meltwater", "frozen_meltwater", "dry_snow", "wet_snow", "bare_ice", "bedrock"]
    }
}

with open(os.path.join(GEO_DIR, "maitri_cryosphere_uav_survey.json"), "w", encoding="utf-8") as f:
    json.dump(cryosphere_uav_data, f, indent=2)

print("\n=== 5. Building Station Engineering, Microgrid & Life Support Specs ===")

# Maitri & Maitri-II Engineering Spec
maitri_infra = {
    "station_id": "MAITRI",
    "status": "Operational since 1989 (Maitri-II planned for 2029)",
    "coordinates": {"lat": -70.7668, "lon": 11.7308, "elevation_m": 117},
    "population": {"winter": 25, "summer_nominal": 50, "summer_max": 65},
    "current_station_architecture": {
        "foundation": "Elevated steel stilts on bed rock",
        "construction_year": 1988,
        "water_supply": "Priyadarshini Lake pump line (heated trace pipes)",
        "heating": "Boilers + electrical backup"
    },
    "maitri_ii_plant_specs": {
        "design_life_years": 40,
        "population_capacity": {"winter": 40, "summer": 140},
        "power_plant": {
            "num_generators": 6,
            "unit_rating_kva": 125,
            "total_capacity_kva": 750,
            "system_type": "Combined Heat & Power (CHP) with waste-heat loop",
            "specific_fuel_consumption_l_per_kwh": 0.28
        },
        "fuel_farm": {
            "fuel_type": "JET A-1 / Arctic Grade Diesel",
            "total_capacity_liters": 600000,
            "day_tanks_capacity_liters": 15000,
            "intake_method": "Automated intake from ISO tank containers",
            "distribution_lines": ["Powerhouse", "Helipad", "Workshop Garage", "Emergency Shelter"]
        },
        "aviation": {
            "helipad_rating": "Kamov Ka-32 / Mi-8 Heavy Lift",
            "hangar_capacity": "1 Helo + Ground Support Equipment"
        },
        "environmental_design_limits": {
            "max_wind_kmh": 200,
            "prevailing_wind_dir": "SE",
            "annual_mean_temp_c": -9.7,
            "extreme_min_temp_c": -44.0
        }
    }
}

with open(os.path.join(INFRA_DIR, "maitri_station_engineering_spec.json"), "w", encoding="utf-8") as f:
    json.dump(maitri_infra, f, indent=2)

# Bharati Engineering Spec (Containerized Shell & Thermal Envelope)
bharati_infra = {
    "station_id": "BHARATI",
    "status": "Operational since 18 March 2012",
    "coordinates": {"lat": -69.4068, "lon": 76.1953, "elevation_m": 35},
    "population": {"winter": 24, "main_building_beds": 47, "emergency_summer_camp": 25, "peak_capacity": 72},
    "architectural_specs": {
        "designers": "bof architekten + IMS + m+p",
        "container_modules_count": 134,
        "cantilever_overhang_m": 6.0,
        "support_structure": "Steel V-columns on bedrock (prevents snow drift accumulation)",
        "thermal_envelope": {
            "container_wall_insulation_mm": 170,
            "wall_u_value_w_m2k": 0.135,
            "outer_triple_glazing_u_value_w_m2k": 0.50,
            "inner_double_glazing_u_value_w_m2k": 1.10,
            "design_operating_delta_t": {"outside_c": -40.0, "inside_c": 20.0, "indoor_rh_percent": 30},
            "design_max_wind_kmh": 270
        }
    },
    "power_and_hvac": {
        "generation_type": "Combined Heat & Power (CHP) units with full waste-heat recovery",
        "thermal_efficiency": "Residual CHP heat is sufficient for 100% space heating and snow-melt",
        "water_system": "Seawater Intake Pump House + Multi-Stage RO Desalination + Lake backup",
        "telemetry_link": "High-speed ECIL X/S/C-band downlink direct to NRSC Shadnagar & NCPOR"
    },
    "master_plan_zones": [
        {"zone_id": 1, "name": "Infrastructure & Living Zone", "desc": "Main building, fuel farm, workshop, summer camp"},
        {"zone_id": 2, "name": "Magnetic Silence Zone", "desc": "Upper atmospheric physics, DFM/PPM magnetometers"},
        {"zone_id": 3, "name": "Future Expansion Zone", "desc": "Reserved for modular expansion units"},
        {"zone_id": 4, "name": "Pristine Conservation Zone", "desc": "Ecological baseline, no vehicular transit"},
        {"zone_id": 5, "name": "Antenna & Earth Station Zone", "desc": "ECIL X/S-band radomes & satellite telemetry"}
    ]
}

with open(os.path.join(INFRA_DIR, "bharati_station_engineering_spec.json"), "w", encoding="utf-8") as f:
    json.dump(bharati_infra, f, indent=2)

print("\n=== 6. Building Multimodal Logistics & Sea-Ice Graph ===")

logistics_graph = {
    "nodes": [
        {"node_id": "CPT", "name": "Cape Town International / Port", "type": "Gateway Hub", "country": "South Africa"},
        {"node_id": "NOVO_AIR", "name": "Novolazarevskaya Blue Ice Runway (AT17)", "type": "Airfield (DROMLAN)", "lat": -70.82, "lon": 11.63},
        {"node_id": "PROG_AIR", "name": "Progress Skiway", "type": "Skiway (Feeder)", "lat": -69.38, "lon": 76.38},
        {"node_id": "INDIA_BAY", "name": "India Bay (Lazarev Ice Shelf Calving Edge)", "type": "Marine Fast-Ice Mooring", "lat": -69.98, "lon": 11.90},
        {"node_id": "QUILTY_BAY", "name": "Quilty Bay / Thala Fjord (Bharati Cove)", "type": "Marine Deep Anchorage", "lat": -69.41, "lon": 76.19},
        {"node_id": "MAITRI_STN", "name": "Maitri Station", "type": "Inland Station", "lat": -70.7668, "lon": 11.7308},
        {"node_id": "BHARATI_STN", "name": "Bharati Station", "type": "Coastal Station", "lat": -69.4068, "lon": 76.1953}
    ],
    "edges": [
        {
            "route_id": "LEG_AIR_01",
            "origin": "CPT", "destination": "NOVO_AIR",
            "mode": "Heavy Air Transport (Ilyushin IL-76TD)",
            "duration_hours": 5.75,
            "season_window": "Late Oct to mid-Feb",
            "capacity_pax": 60, "capacity_cargo_tonnes": 18.0,
            "constraint": "Requires blue-ice friction coefficient >= 0.35, surface temp < -5C for heavy landing"
        },
        {
            "route_id": "LEG_AIR_02",
            "origin": "NOVO_AIR", "destination": "PROG_AIR",
            "mode": "Ski-Equipped Feeder (Basler BT-67 / Twin Otter)",
            "duration_hours": 9.5,
            "season_window": "Mid-Nov to late Jan",
            "capacity_pax": 18, "capacity_cargo_tonnes": 2.5,
            "constraint": "Requires visual flight rules (VFR), en-route fuel cache availability"
        },
        {
            "route_id": "LEG_SEA_01",
            "origin": "CPT", "destination": "QUILTY_BAY",
            "mode": "Polar Class Icebreaker / Expedition Vessel (e.g. MV Vasiliy Golovnin)",
            "duration_days": 13,
            "duration_range_days": [10, 16],
            "season_window": "Dec to Feb",
            "capacity_cargo_tonnes": 4000,
            "constraint": "Sea ice concentration in Prydz Bay <= 6/10ths"
        },
        {
            "route_id": "LEG_SEA_02",
            "origin": "QUILTY_BAY", "destination": "INDIA_BAY",
            "mode": "Polar Class Icebreaker / Expedition Vessel",
            "duration_days": 6,
            "duration_range_days": [5, 7],
            "season_window": "Jan to early Mar",
            "distance_km": 3098, "distance_nm": 1693,
            "constraint": "Fast-ice edge stability at Lazarev Ice Shelf"
        },
        {
            "route_id": "LEG_SEA_03",
            "origin": "INDIA_BAY", "destination": "CPT",
            "mode": "Polar Class Icebreaker",
            "duration_days": 10,
            "duration_range_days": [8, 12],
            "season_window": "Late Feb to mid-Mar",
            "constraint": "Autumn sea-ice freezeup deadline (March 15 hard exit)"
        },
        {
            "route_id": "LEG_LAND_01",
            "origin": "INDIA_BAY", "destination": "MAITRI_STN",
            "mode": "Over-Ice Heavy Convoy (PistenBully 300 Polar + Sledges)",
            "duration_hours": 12.0,
            "distance_km": 85.0,
            "constraint": "Crevasse danger zones between Ice Shelf and Schirmacher Oasis hinge zone"
        },
        {
            "route_id": "LEG_LAND_02",
            "origin": "QUILTY_BAY", "destination": "BHARATI_STN",
            "mode": "Barge + PistenBully Shore Transfer",
            "duration_hours": 1.5,
            "distance_km": 1.2,
            "constraint": "Quilty Bay wave swell and fast-ice thickness"
        }
    ]
}

with open(os.path.join(LOGISTICS_DIR, "antarctic_multimodal_logistics_graph.json"), "w", encoding="utf-8") as f:
    json.dump(logistics_graph, f, indent=2)

print("\n=== 7. Building Geospatial Hazard & Station Geometries (GeoJSON) ===")

geojson_features = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "MAITRI_MAIN",
                "station": "MAITRI",
                "name": "Maitri Main Complex (Elevated Stilt Module)",
                "category": "BUILDING",
                "status": "OPERATIONAL",
                "elevation_m": 117
            },
            "geometry": {
                "type": "Point",
                "coordinates": [11.730783, -70.766834]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "MAITRI_PRIYADARSHINI_LAKE",
                "station": "MAITRI",
                "name": "Lake Priyadarshini (Zub Lake - Freshwater Supply)",
                "category": "WATER_RESERVOIR",
                "status": "ACTIVE_PUMP_INTAKE",
                "surface_area_ha": 35.0
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [11.7320, -70.7620],
                    [11.7420, -70.7640],
                    [11.7390, -70.7690],
                    [11.7280, -70.7680],
                    [11.7320, -70.7620]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "MAITRI_II_PROPOSED_ZONE",
                "station": "MAITRI_II",
                "name": "Maitri-II Master Plan Development Footprint",
                "category": "MASTER_PLAN",
                "status": "PLANNED_2029",
                "area_km2": 2.5
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [11.7000, -70.7580],
                    [11.7450, -70.7580],
                    [11.7450, -70.7720],
                    [11.7000, -70.7720],
                    [11.7000, -70.7580]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "BHARATI_MAIN",
                "station": "BHARATI",
                "name": "Bharati Main Building (134 Container Aerodynamic Shell)",
                "category": "BUILDING",
                "status": "OPERATIONAL",
                "elevation_m": 35
            },
            "geometry": {
                "type": "Point",
                "coordinates": [76.19525, -69.40680]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "BHARATI_ZONE_2_MAGNETIC",
                "station": "BHARATI",
                "name": "Bharati Zone 2: Magnetic Silence Sanctuary",
                "category": "SCIENCE_SANCTUARY",
                "status": "RESTRICTED_VEHICLES",
                "instruments": ["DFM Magnetometer", "PPM Magnetometer", "Field Mill"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [76.1900, -69.4040],
                    [76.1940, -69.4040],
                    [76.1940, -69.4070],
                    [76.1900, -69.4070],
                    [76.1900, -69.4040]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "BHARATI_ZONE_5_EARTH_STATION",
                "station": "BHARATI",
                "name": "Bharati Zone 5: ISRO / ECIL Earth Station Radomes",
                "category": "TELECOM_EARTH_STATION",
                "status": "OPERATIONAL",
                "bands": ["X-Band", "S-Band", "C-Band"]
            },
            "geometry": {
                "type": "Point",
                "coordinates": [76.19850, -69.40550]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "id": "HAZARD_CREVASSE_NOVO_MAITRI",
                "station": "MAITRI",
                "name": "Seasonal Crevasse Shear Zone (Novo-Maitri Traverse)",
                "category": "HAZARD_ZONE",
                "severity": "CRITICAL_OCT_NOV",
                "gpr_depth_m": 200
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [11.7500, -70.7850],
                    [11.8300, -70.7850],
                    [11.8300, -70.8100],
                    [11.7500, -70.8100],
                    [11.7500, -70.7850]
                ]]
            }
        }
    ]
}

with open(os.path.join(GEO_DIR, "antarctic_stations_spatial_features.geojson"), "w", encoding="utf-8") as f:
    json.dump(geojson_features, f, indent=2)

print("\n=== 8. Ingesting Everything into Unified SQLite Database ===")

db_path = os.path.join(DB_DIR, "antarctic_digital_twin.db")
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Create Telemetry Table
cur.execute("""
CREATE TABLE station_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    station_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    source_type TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    quality_flag INTEGER DEFAULT 0
);
""")
cur.execute("CREATE INDEX idx_telemetry_st_time ON station_telemetry(station_id, timestamp);")
cur.execute("CREATE INDEX idx_telemetry_param ON station_telemetry(parameter);")

# 2. Create Hazard Events Table
cur.execute("""
CREATE TABLE hazard_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    station_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    severity TEXT NOT NULL,
    max_metric_value REAL,
    metric_unit TEXT,
    description TEXT
);
""")

# 3. Create Infrastructure Assets Table
cur.execute("""
CREATE TABLE infrastructure_assets (
    asset_id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    capacity_val REAL,
    capacity_unit TEXT,
    operating_status TEXT,
    metadata_json TEXT
);
""")

# 4. Create Logistics Routes Table
cur.execute("""
CREATE TABLE logistics_routes (
    route_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    transport_mode TEXT NOT NULL,
    duration_hrs REAL,
    season_window TEXT,
    constraints TEXT
);
""")

# Ingest Open-Meteo Hourly into station_telemetry
print("Ingesting Open-Meteo hourly reanalysis records into SQLite...")
inserted_count = 0
for st_id in ["MAITRI", "BHARATI", "NOVOLAZAREVSKAYA", "PROGRESS"]:
    fpath = os.path.join(ENV_DIR, f"openmeteo_hourly_2023_{st_id.lower()}.json")
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    t2m = hourly.get("temperature_2m", [])
    ws = hourly.get("wind_speed_10m", [])
    wd = hourly.get("wind_direction_10m", [])
    gust = hourly.get("wind_gusts_10m", [])
    rh = hourly.get("relative_humidity_2m", [])
    ps = hourly.get("surface_pressure", [])
    dni = hourly.get("direct_normal_irradiance", [])
    
    rows = []
    for i, t in enumerate(times):
        # Temp
        if t2m and i < len(t2m) and t2m[i] is not None:
            rows.append((t, st_id, "AIR_TEMP_2M", t2m[i], "degC", "OPEN_METEO_REANALYSIS", 0.90, 0))
        # Wind Speed
        if ws and i < len(ws) and ws[i] is not None:
            rows.append((t, st_id, "WIND_SPEED_10M", ws[i], "km/h", "OPEN_METEO_REANALYSIS", 0.90, 0))
        # Wind Gust
        if gust and i < len(gust) and gust[i] is not None:
            rows.append((t, st_id, "WIND_GUST_10M", gust[i], "km/h", "OPEN_METEO_REANALYSIS", 0.90, 0))
        # RH
        if rh and i < len(rh) and rh[i] is not None:
            rows.append((t, st_id, "RELATIVE_HUMIDITY", rh[i], "%", "OPEN_METEO_REANALYSIS", 0.90, 0))
        # Pressure
        if ps and i < len(ps) and ps[i] is not None:
            rows.append((t, st_id, "SURFACE_PRESSURE", ps[i], "hPa", "OPEN_METEO_REANALYSIS", 0.90, 0))
        # Solar Irradiance
        if dni and i < len(dni) and dni[i] is not None:
            rows.append((t, st_id, "SOLAR_DNI", dni[i], "W/m2", "OPEN_METEO_REANALYSIS", 0.90, 0))

    cur.executemany("""
    INSERT INTO station_telemetry (timestamp, station_id, parameter, value, unit, source_type, confidence_score, quality_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    inserted_count += len(rows)

print(f"  -> Ingested {inserted_count} environmental telemetry records.")

# Ingest NASA POWER Daily into station_telemetry
print("Ingesting NASA POWER daily records into SQLite...")
nasa_inserted = 0
for st_id in ["MAITRI", "BHARATI", "NOVOLAZAREVSKAYA", "PROGRESS"]:
    fpath = os.path.join(ENV_DIR, f"nasa_power_daily_{st_id.lower()}.json")
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    properties = data.get("properties", {}).get("parameter", {})
    t2m = properties.get("T2M", {})
    ws2m = properties.get("WS2M", {})
    ghi = properties.get("ALLSKY_SFC_SW_DWN", {})
    ps = properties.get("PS", {})
    rh = properties.get("RH2M", {})
    
    rows = []
    for date_str, val in t2m.items():
        # format YYYYMMDD -> YYYY-MM-DD
        formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        if val is not None and val != -999:
            rows.append((formatted_date, st_id, "DAILY_TEMP_2M", val, "degC", "NASA_POWER_API", 0.95, 0))
        if ws2m.get(date_str) is not None and ws2m[date_str] != -999:
            rows.append((formatted_date, st_id, "DAILY_WIND_SPEED_2M", ws2m[date_str], "m/s", "NASA_POWER_API", 0.95, 0))
        if ghi.get(date_str) is not None and ghi[date_str] != -999:
            rows.append((formatted_date, st_id, "DAILY_SOLAR_IRRADIANCE", ghi[date_str], "kW-hr/m2/day", "NASA_POWER_API", 0.95, 0))
        if ps.get(date_str) is not None and ps[date_str] != -999:
            rows.append((formatted_date, st_id, "DAILY_SURFACE_PRESSURE", ps[date_str], "kPa", "NASA_POWER_API", 0.95, 0))
        if rh.get(date_str) is not None and rh[date_str] != -999:
            rows.append((formatted_date, st_id, "DAILY_RELATIVE_HUMIDITY", rh[date_str], "%", "NASA_POWER_API", 0.95, 0))
            
    cur.executemany("""
    INSERT INTO station_telemetry (timestamp, station_id, parameter, value, unit, source_type, confidence_score, quality_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    nasa_inserted += len(rows)

print(f"  -> Ingested {nasa_inserted} NASA POWER daily telemetry records.")

# Ingest Blizzard Log
for b in bharati_blizzard_log:
    cur.execute("""
    INSERT INTO hazard_events (event_id, station_id, event_type, start_time, end_time, severity, max_metric_value, metric_unit, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        b["event_id"], "BHARATI", "BLIZZARD", b["start_utc"], b["end_utc"],
        "SEVERE" if b["max_wind_kn"] >= 60 else "MODERATE",
        b["max_wind_kn"], "knots", b["notes"]
    ))

# Ingest Assets
assets_to_insert = [
    ("MAITRI_CHP_PLANT", "MAITRI_II", "CHP Generation Units (6x125 kVA)", "POWER_GENERATION", 750.0, "kVA", "PLANNED", json.dumps(maitri_infra["maitri_ii_plant_specs"]["power_plant"])),
    ("MAITRI_FUEL_FARM", "MAITRI_II", "Main Bulk JET A-1 Fuel Tank Farm", "FUEL_STORAGE", 600000.0, "liters", "PLANNED", json.dumps(maitri_infra["maitri_ii_plant_specs"]["fuel_farm"])),
    ("MAITRI_HELIPAD", "MAITRI_II", "Kamov-32 Rated Helipad & Hangar", "AVIATION", 1.0, "pads", "PLANNED", json.dumps(maitri_infra["maitri_ii_plant_specs"]["aviation"])),
    ("BHARATI_CONTAINER_SHELL", "BHARATI", "134-Module Insulated Shell (U=0.135)", "BUILDING_ENVELOPE", 134.0, "containers", "OPERATIONAL", json.dumps(bharati_infra["architectural_specs"])),
    ("BHARATI_RO_PLANT", "BHARATI", "Seawater Desalination RO Facility", "WATER_TREATMENT", 10000.0, "L/day", "OPERATIONAL", json.dumps(bharati_infra["power_and_hvac"])),
    ("BHARATI_ISRO_RADOMES", "BHARATI", "ECIL X/S/C-band Ground Receiving Antennas", "SATELLITE_DOWNLINK", 3.0, "radomes", "OPERATIONAL", json.dumps(bharati_infra["master_plan_zones"][4]))
]

cur.executemany("""
INSERT INTO infrastructure_assets (asset_id, station_id, name, category, capacity_val, capacity_unit, operating_status, metadata_json)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", assets_to_insert)

# Ingest Logistics Routes
for edge in logistics_graph["edges"]:
    dur_hrs = edge.get("duration_hours", 0)
    if "duration_days" in edge:
        dur_hrs = edge["duration_days"] * 24.0
    cur.execute("""
    INSERT INTO logistics_routes (route_id, origin, destination, transport_mode, duration_hrs, season_window, constraints)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        edge["route_id"], edge["origin"], edge["destination"], edge["mode"],
        dur_hrs, edge.get("season_window", "Year-round / Summer ops"), edge.get("constraint", "Standard polar operations")
    ))

conn.commit()

# Export CSV snapshots
print("Exporting CSV tables for rapid integration...")
tables = ["station_telemetry", "hazard_events", "infrastructure_assets", "logistics_routes"]
for t in tables:
    cur.execute(f"SELECT * FROM {t}")
    col_names = [d[0] for d in cur.description]
    rows = cur.fetchall()
    csv_out = os.path.join(DB_DIR, f"{t}.csv")
    with open(csv_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        writer.writerows(rows)
    print(f"  [OK] Exported {csv_out} ({len(rows)} rows)")

conn.close()

print(f"\n[SUCCESS] Unified Database created at: {db_path}")
print("=== All Antarctic Digital Twin Datasets Downloaded, Processed & Persisted! ===")

