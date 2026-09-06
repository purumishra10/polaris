# Polaris Antarctic Digital Twin — Master Dataset Repository & Data Dictionary

This repository contains the complete, curated, and normalized multi-domain dataset suite powering the Digital Twin for **Station Maitri** (*Schirmacher Oasis*) and **Station Bharati** (*Larsemann Hills*), built for SIH Problem Statement 26060.

---

## 1. Directory Structure

```
c:\projects\polaris\datasets\
│
├── environment\                     # Meteorological, Solar & Atmospheric Reanalysis
│   ├── nasa_power_daily_maitri.json            # Multi-year solar GHI, wind (2m/10m), temp, pressure, RH
│   ├── nasa_power_daily_bharati.json           # Coastal solar GHI, wind (2m/10m), temp, pressure, RH
│   ├── nasa_power_daily_novolazarevskaya.json  # Russian proxy (~3.5 km from Maitri)
│   ├── nasa_power_daily_progress.json          # Russian proxy (~8 km from Bharati)
│   ├── openmeteo_hourly_2023_maitri.json       # 8,760 hourly records (T2m, DNI, wind speed/gust, P, RH)
│   ├── openmeteo_hourly_2023_bharati.json      # 8,760 hourly records (coastal wind, blizzards, DNI)
│   ├── openmeteo_hourly_2023_novolazarevskaya.json # Hourly proxy validation series
│   └── openmeteo_hourly_2023_progress.json     # Hourly proxy validation series
│
├── space_weather\                   # Magnetosphere, Solar Radiation & HF Comms
│   ├── planetary_k_index_1m.json               # NOAA SWPC 1-min real-time planetary Kp index
│   ├── solar_xray_flux_6h.json                 # NOAA GOES-Primary high-cadence X-ray flux (solar flares)
│   └── noaa_space_weather_scales.json          # G-scale (geomagnetic), S-scale (radiation), R-scale (radio)
│
├── geospatial_hazards\              # Topography, Cryosphere, Hazard Logs & Geometries
│   ├── bharati_blizzard_log_imd.json           # IMD ground-truth log of all 9 blizzard events (2017-2018)
│   ├── maitri_cryosphere_uav_survey.json       # 42nd/43rd ISEA 8.5cm DEM, melt pond expansion & ice loss
│   └── antarctic_stations_spatial_features.geojson # GeoJSON polygons/points for buildings, zones, crevasses
│
├── station_infrastructure\          # Physical BIM, Microgrid, Fuel Farm & Thermal Envelopes
│   ├── maitri_station_engineering_spec.json    # Maitri current plant + Maitri-II 600kVA CHP / 600kL JET A1
│   └── bharati_station_engineering_spec.json   # 134-container envelope (U=0.135), CHP waste-heat, RO plant
│
├── sea_ice_logistics\               # Multimodal Logistics Graph & Maritime Windows
│   └── antarctic_multimodal_logistics_graph.json # Network graph (Cape Town - Novo - Progress - Maitri - Bharati)
│
└── unified_db\                      # High-Performance Normalized Database & CSV Snapshots
    ├── antarctic_digital_twin.db               # SQLite database with indexed tables (232,000+ rows)
    ├── station_telemetry.csv                   # Master time-series telemetry table (232,160 rows)
    ├── hazard_events.csv                       # Historical and simulated hazard events (blizzards, melt floods)
    ├── infrastructure_assets.csv               # Power plants, fuel farms, RO systems, satellite radomes
    └── logistics_routes.csv                    # Air, sea, and overland convoy edges with constraints
```

---

## 2. Master Database Schema (`antarctic_digital_twin.db`)

### `station_telemetry` Table (232,160 rows)
Primary normalized time-series table unifying in-situ observations, reanalysis, and satellite models.

| Column | Type | Description | Example Values |
|---|---|---|---|
| `id` | INTEGER PK | Auto-increment unique record ID | `1`, `2` |
| `timestamp` | TEXT | ISO-8601 UTC timestamp | `'2023-01-01 00:00'`, `'2023-08-15'` |
| `station_id` | TEXT | Target station code | `'MAITRI'`, `'BHARATI'`, `'NOVOLAZAREVSKAYA'`, `'PROGRESS'` |
| `parameter` | TEXT | Standardized parameter code | `'AIR_TEMP_2M'`, `'WIND_SPEED_10M'`, `'SOLAR_DNI'`, `'DAILY_SOLAR_IRRADIANCE'` |
| `value` | REAL | Numerical reading | `-12.4`, `45.2`, `850.5` |
| `unit` | TEXT | Engineering unit | `'degC'`, `'km/h'`, `'m/s'`, `'W/m2'`, `'kW-hr/m2/day'`, `'hPa'` |
| `source_type` | TEXT | Data lineage / provenance | `'OPEN_METEO_REANALYSIS'`, `'NASA_POWER_API'`, `'IN_SITU_AWS'` |
| `confidence_score`| REAL | Trust weighting (0.0 to 1.0) | `1.0` (sensor), `0.95` (NASA POWER), `0.90` (ERA5/Meteo), `0.40` (synthetic) |
| `quality_flag` | INTEGER | Quality control flag | `0` (Passed QC), `1` (Interpolated), `2` (Flagged anomaly) |

### `hazard_events` Table
Contains blizzard events, melt pond surge dates, and severe weather logs.

| Column | Type | Description |
|---|---|---|
| `event_id` | TEXT PK | Unique hazard event ID (e.g. `'BLZ-2018-09'`) |
| `station_id` | TEXT | Associated station (`'BHARATI'` or `'MAITRI'`) |
| `event_type` | TEXT | Hazard category (`'BLIZZARD'`, `'MELT_SURGE'`, `'CREVASSE'`) |
| `start_time` | TEXT | Start timestamp (UTC) |
| `end_time` | TEXT | End timestamp (UTC) |
| `severity` | TEXT | Severity ranking (`'MODERATE'`, `'SEVERE'`, `'CRITICAL'`) |
| `max_metric_value` | REAL | Peak observed intensity (e.g. `73.0` knots) |
| `metric_unit` | TEXT | Metric unit (`'knots'`, `'m3'`, `'kt'`) |
| `description` | TEXT | Operational impact and synoptic notes |

### `infrastructure_assets` Table
Physical assets, microgrid units, fuel tanks, and life support systems.

| Column | Type | Description |
|---|---|---|
| `asset_id` | TEXT PK | Unique asset identifier (e.g. `'MAITRI_CHP_PLANT'`) |
| `station_id` | TEXT | Station identifier (`'MAITRI_II'`, `'BHARATI'`) |
| `name` | TEXT | Human-readable asset title |
| `category` | TEXT | `'POWER_GENERATION'`, `'FUEL_STORAGE'`, `'BUILDING_ENVELOPE'`, `'WATER_TREATMENT'` |
| `capacity_val` | REAL | Numerical capacity rating (e.g. `750.0`, `600000.0`, `134.0`) |
| `capacity_unit` | TEXT | `'kVA'`, `'liters'`, `'containers'`, `'L/day'` |
| `operating_status`| TEXT | `'OPERATIONAL'`, `'PLANNED'`, `'STANDBY'`, `'MAINTENANCE'` |
| `metadata_json` | TEXT | Detailed JSON payload with thermal coefficients ($U$), SFC, and electrical parameters |

### `logistics_routes` Table
Multimodal transport edges for expedition simulation.

| Column | Type | Description |
|---|---|---|
| `route_id` | TEXT PK | Route ID (e.g. `'LEG_AIR_01'`, `'LEG_SEA_01'`, `'LEG_LAND_01'`) |
| `origin` | TEXT | Origin node (`'CPT'`, `'NOVO_AIR'`, `'QUILTY_BAY'`) |
| `destination` | TEXT | Destination node (`'NOVO_AIR'`, `'BHARATI_STN'`, `'MAITRI_STN'`) |
| `transport_mode` | TEXT | Transport vehicle (e.g. `'Ilyushin IL-76TD'`, `'Icebreaker'`, `'PistenBully 300'`) |
| `duration_hrs` | REAL | Transit duration in hours |
| `season_window` | TEXT | Operating window (e.g. `'Late Oct to mid-Feb'`, `'Dec to Feb'`) |
| `constraints` | TEXT | Polar weather / sea-ice operational limits |

---

## 3. Quickstart Query Examples

### Example 1: Compute Monthly Wind Speed & Solar Energy Yield Comparison
```sql
SELECT 
    station_id,
    substr(timestamp, 1, 7) as month,
    ROUND(AVG(CASE WHEN parameter = 'WIND_SPEED_10M' THEN value END), 2) as avg_wind_kmh,
    ROUND(MAX(CASE WHEN parameter = 'WIND_GUST_10M' THEN value END), 2) as max_gust_kmh,
    ROUND(SUM(CASE WHEN parameter = 'SOLAR_DNI' THEN value * 0.001 END), 2) as total_solar_kwh_m2
FROM station_telemetry
WHERE parameter IN ('WIND_SPEED_10M', 'WIND_GUST_10M', 'SOLAR_DNI')
GROUP BY station_id, month
ORDER BY station_id, month;
```

### Example 2: Inspect Bharati Blizzard History
```sql
SELECT event_id, start_time, end_time, severity, max_metric_value || ' ' || metric_unit as peak_intensity, description
FROM hazard_events
WHERE station_id = 'BHARATI'
ORDER BY max_metric_value DESC;
```

### Example 3: Query Station Assets & Thermal Specifications
```sql
SELECT asset_id, station_id, name, capacity_val || ' ' || capacity_unit as rated_capacity, operating_status
FROM infrastructure_assets;
```
