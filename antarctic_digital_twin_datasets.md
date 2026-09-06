# Dataset Catalogue — Digital Twin for Maitri & Bharati (SIH 2026, PS 26060)

**Station coordinates** (needed for every API call below):
| Station | Latitude | Longitude | Elevation |
|---|---|---|---|
| Maitri | 70°45′52″S (-70.7667) | 11°44′03″E (11.7342) | 117 m |
| Bharati | 69°24.41′S (-69.4083) | 76°11.72′E (76.1874) | 35 m |
| Novolazarevskaya (Russia, ~3.5 km from Maitri) | 70°46′37″S (-70.7769) | 11°49′26″E (11.8239) | 102 m |

**Reality check first:** none of the Antarctic-specific sources below expose a true real-time push/streaming API. "Live" here means *scheduled polling* of a portal or a reanalysis API, not a live sensor socket. Design your twin's ingestion layer around polling, not streaming — see the Data Flow section at the end.

---

## 1. NCPOR / National Polar Data Centre (NPDC) — primary, official source
Portal: `npdc.ncpor.res.in` (registration required for full downloads) · Repository: `ramadda.npdc.ncpor.res.in` (browsable, some entries open, some gated).

| Dataset | Type | Contains | Access |
|---|---|---|---|
| AWS Data – Maitri | In-situ sensor, time series | Obs time, air temp, pressure, wind speed/direction, relative humidity. Maitri's "Sankalp" AWS record: 2006–2015, hourly, CSV + NetCDF | RAMADDA repository, direct download |
| AWS Data – Bharati | In-situ sensor, time series | Same parameter set as above, Bharati-specific record | RAMADDA repository |
| Synoptic Data – Maitri & Bharati | In-situ, human-logged | Standard synoptic weather codes (WMO format) | RAMADDA repository |
| 24-Hr Weather (per station) | Near-real-time feed | Latest day's readings, refreshed daily | NPDC "Weather & Environment" page |
| Weather Graphs – Maitri/Bharati/Himadri/Himansh | Visualization/derived | Plotted time series of the AWS parameters | NPDC "Online Plots" |
| Radiation, UV, Ozonesonde, Black Carbon, Sunphotometer, Riometer, Ionosonde, High-Speed Wind Recorder | Specialized instrument data | Atmospheric & space-weather physics — mostly Maitri (its research focus) | RAMADDA repository, some request-gated |

**How it helps the twin:** this is your ground-truth environmental layer — direct sensor readings *from the two stations themselves*, not a global model approximation. Use it to validate/calibrate whatever reanalysis or synthetic data you use elsewhere.

**Getting more than what's public:** NPDC has an explicit "submit a request for Academic and R&D purpose" path. Since this is literally NCPOR's own SIH problem statement, it's worth registering on the portal and filing a data request citing PS 26060 — likely to get a faster response than a random request.

---

## 2. Global Antarctic meteorological networks — cross-validation / gap-filling
Not station-specific, but useful where NPDC's public archive has gaps.

| Dataset | Type | Contains | Access |
|---|---|---|---|
| SCAR READER (`scar.org/library-data/data/reader`, hosted via British Antarctic Survey) | Historical archive | Long-term monthly/annual mean temp, pressure, wind for staffed Antarctic stations — includes **Novolazarevskaya** | Free web download |
| AntAWS compiled dataset (published via Copernicus ESSD) | Cleaned historical archive | Quality-controlled multi-station AWS compilation across Antarctica | Journal supplementary data, free |
| AMRC / AMRDC (`amrdc.ssec.wisc.edu`, University of Wisconsin–Madison) | Near-real-time + archive | AWS observations and satellite composite imagery, continent-wide, with live maps/plots | Free web portal |

---

## 3. Russian data (Novolazarevskaya, ~3.5 km from Maitri) — three ways to get it
Since Maitri has no year-round official companion station of its own, Novolazarevskaya is your best physical proxy for anything AWS data doesn't cover.

| Source | Type | Contains | Access |
|---|---|---|---|
| AARI Antarctic Meteorology Catalogue (`aari.aq/data/catalogue.html`) | Official Russian archive | Monthly/annual mean surface temp, pressure, wind, humidity, cloud cover for all 5 RAE stations incl. Novolazarevskaya | Free, static catalogue (legacy site, may need Wayback Machine mirror if down) |
| SCAR READER | Historical archive | Novolazarevskaya included as one of the long-record stations | Free |
| OGIMET / aviation METAR archive | Near-real-time aviation weather | Novolazarevskaya has an airstrip (ICAO **AT17**, part of the DROMLAN air network) — standard METAR/SYNOP reports are archivable via aviation-weather aggregators | Free, query by ICAO code AT17 |

**How it helps:** cross-checking Maitri's own AWS readings against a station 3.5 km away catches sensor drift/gaps, and AT17's METAR feed is one of the very few genuinely frequently-updated (multiple-times-daily) sources this close to Maitri.

---

## 4. Satellite & geospatial datasets — environmental + terrain layers
| Dataset | Type | Contains | Access |
|---|---|---|---|
| NSIDC Sea Ice Index | Satellite-derived, daily/monthly | Antarctic sea-ice extent & concentration, 1979–present | Free, `nsidc.org/data/seaice_index` |
| Copernicus CDS — ERA5 reanalysis | Gridded model reanalysis | Hourly temp, wind, pressure, precipitation for *any* lat/long, incl. Maitri/Bharati exact coordinates, even with no ground sensor | Free API, needs a CDS account/API key |
| Copernicus Marine Service — Antarctic sea-ice reanalysis | Satellite + model | Sea-ice extent/concentration product, API-queryable | Free, registration required |
| Quantarctica (Norwegian Polar Institute) | Static GIS package | 265+ layers: basemaps, coastlines, station locations, elevation, glaciology, geology — loads into QGIS | Free download, ~7 GB base package |
| REMA (Reference Elevation Model of Antarctica, Polar Geospatial Center) | Digital elevation model | High-resolution terrain around both stations | Free download |
| NASA POWER API | Model-derived (satellite + reanalysis) | Solar irradiance, wind, temperature, humidity by exact lat/long — the standard free source for solar/wind energy-yield modeling | Free REST API, no key needed |

**Ready-to-run NASA POWER queries** (swap dates as needed — I can't call this API myself from here, it's blocked to automated fetchers by its own robots.txt, but it works fine from your own code):
```
# Maitri
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,ALLSKY_SFC_SW_DWN,PS,RH2M&community=RE&longitude=11.7342&latitude=-70.7667&start=20260101&end=20260828&format=JSON

# Bharati
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,ALLSKY_SFC_SW_DWN,PS,RH2M&community=RE&longitude=76.1874&latitude=-69.4083&start=20260101&end=20260828&format=JSON
```
`ALLSKY_SFC_SW_DWN` = surface solar irradiance (your solar-panel yield input); `WS2M` = wind speed at 2m (wind-turbine input); these two feed the energy layer of the twin directly.

---

## 5. The gap: infrastructure, energy, logistics
Nothing above covers building layouts, generator/fuel data, or resupply schedules — NCPOR doesn't publish these. Standard, judge-expected approach for this class of hackathon problem:
- Approximate building footprints from satellite imagery (Sentinel-2 via Copernicus Open Access Hub, or ISRO **Bhuvan/MOSDAC** — Bharati already hosts an ISRO ground station, so this pairing has a natural story).
- Build a synthetic energy/logistics dataset (generator load curve, fuel burn model, summer/winter resupply cycle) anchored to real numbers you *do* have publicly: Maitri ~45 summer/25 winter population, Bharati ~46 summer/23 winter.
- State this gap explicitly in your submission rather than presenting synthetic data as real — judges expect this framing for a government-data problem statement.

---

## 6. Data flow for the twin (see accompanying diagram)
1. **Ingestion** — scheduled pollers (not live sockets): NPDC portal (manual/registered pull), ERA5/NASA POWER/Copernicus (API pull), synthetic generator (energy/logistics).
2. **Landing/raw storage** — dump as-is (CSV/NetCDF/JSON) with source + timestamp metadata.
3. **Validation & cross-check** — compare Maitri AWS vs. Novolazarevskaya proxy vs. ERA5 for the same timestamp; flag sensor gaps/outliers.
4. **Normalized store** — unified schema (station_id, timestamp, parameter, value, source, confidence) feeding a time-series DB.
5. **Twin state model** — current + short-history state per station (environment, energy, sea-ice/logistics access, terrain) that the frontend queries.
6. **Visualization/simulation layer** — 3D/GIS view (Quantarctica basemap + REMA terrain) with live-ish overlays and what-if simulation (e.g., "what if resupply is delayed 2 weeks").
