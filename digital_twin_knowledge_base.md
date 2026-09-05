# Maitri & Bharati — Digital Twin Knowledge Base

**Use this file instead of re-reading the paper pile.** Every number below is taken from an official NCPOR/IMD document or a station-specific paper we kept. Where sources disagree, both values are listed.

**Problem:** SIH 2026 · PS 26060 · digital twin of both Indian Antarctic stations  
**Stations:** Maitri (Schirmacher Oasis, inland) and Bharati (Larsemann Hills, coastal) · ~3,098 km apart

---

## 1. Station identity

| Field | Maitri | Bharati |
|---|---|---|
| Status | Year-round since 1989 (built 1988). Replacing Dakshin Gangotri (1983–89). Past 25-year design life; Maitri-II planned. | Year-round since 18 Mar 2012 |
| Site | Ice-free rock, Schirmacher Oasis / Hills, central Dronning Maud Land | North Grovnes Island, Larsemann Hills, Ingrid Christensen Coast, between Thala Fjord and Quilty Bay |
| Official coords (planning advisory) | −70.76683367, 11.73078318 | −69.40680, 76.19525 |
| Other published coords | 70°46′00″S, 11°43′51″E (Maitri-II brief); 70°45′58″S, 11°43′56″E (43-ISEA); GPS/seismo pad 70°45′56.21″S, 11°44′10.78″E | 69°24.41′S, 76°11.72′E (43-ISEA) |
| Elevation | ~117 m | ~35 m |
| Distance to sea | ~80–100 km inland; Lazarev Ice Shelf / Indian Barrier in between | ~200 m from Quilty Bay (coastal) |
| Nearby foreign station | Novolazarevskaya (Russia) ~3.5 km; Novo airstrip (DROMLAN) | Progress (Russia); Progress airstrip |
| Oasis size | Schirmacher ~32–35 km², 1.5–3.5 km wide × ~20 km long, elevations 0–228 m (avg ~100 m), ~180 lakes | Larsemann Hills ~40 km²; elevations ~30–120 m (max 158 m, Blundell Peak) |
| Twin site box (Maitri-II) | ~2.5 km² around Priyadarshini / Zub Lake, 70°45′36.48″S, 11°44′8.23″E to 70°45′54.43″S, 11°41′59.37″E; elevations 20–165 m | North Grovnes master-plan zones (see §4) |

**Twin implication:** two different climate/logistics regimes. Maitri is an inland oasis station with katabatic SE winds and an ice-shelf approach. Bharati is a coastal container station with persistent NE winds, sea-ice dependent resupply, and an ISRO ground station on site.

---

## 2. People, buildings, energy

### Population (use these in occupancy / load models)

| Season | Maitri (current) | Maitri-II (planned) | Bharati |
|---|---|---|---|
| Winter | 25 in main building | 40 (winter section only) | 47 in main building |
| Summer | 40–60 in container modules (43-ISEA) **or** 65 (AL/03). Modules sleep 4 each. | 140 (summer + winter sections) | 47 main + 25 in emergency / summer camps = **72** (AL/02) |
| Design life | Original ~25 years (exceeded) | 40 years | Built 2011–12, still current |

AL/03’s “65 summer” and 43-ISEA’s “40–60 summer” both describe the same station at different times. For the twin, model **25 winter / ~50–65 summer** for current Maitri, and expose Maitri-II as a scenario (40 / 140).

### Maitri — current plant

- Main building on **steel stilts** (1988). Aging fuel handling, generators, waste systems (reason for Maitri-II).
- Research: atmosphere/meteorology, earth science/glaciology, human biology, biology/environment.
- Gateway to Wohlthat / Orvin / Mühlig-Hofmann ranges (~20,000 km² mapped from this base).
- Vehicles (AL/03): 14 Pisten Bully, 4 snow scooters, 1 Toyota arctic truck, 1 Tata Xenon-XT, 1 BD-50 dozer, 5 × 50 t Mantis cranes, 1 excavator, 13 trailers, 13 sledges, 2 side loaders.
- Helicopters: ship-based only, when the voyage ship is at the Indian Barrier.
- Field radius: ideally ≤ 100 km in campaign mode.
- Comms: satellite internet/phone only. Call allotment 6 min/month (summer) or 20 min/month (winter).

### Maitri-II — planned plant (use as the “future state” scenario)

Source: NCPOR Project Maitri-II brief, 25 Jul 2024.

- Dispersed structures N/W of Priyadarshini Lake, linked by roads, pipelines, cableways.
- Summer wing shuts in winter to save fuel.
- All structures except fuel farm and vehicle garage are temperature-controlled.
- **Power:** 6 generators / CHP units × 100–125 kVA = **600–750 kVA** total. Day tanks + fuel lines from the farm. Monitoring of fuel and generator status required (this is a twin subsystem).
- **Fuel farm:** ~**600,000 L JET A1**, automated intake from tank containers, lines to power house, helipad, workshop.
- Other blocks: warehouse, workshop-garage, water intake / pump house, hangar, helipad sized for **Kamov 32**.
- Design wind: station-area max **200 km/h**, prevailing **SE**, annual mean **31.5 km/h**.

Current Maitri generator kVA and fuel inventory are **not published**. Do not invent them. Anchor any synthetic energy layer to Maitri-II numbers and label it “planned / synthetic”.

### Bharati — current plant

- Architects: bof architekten (Hamburg) + IMS + m+p. Competition 2006; site infra winter 2010/11; station assembled austral summer 2011/12 (3-month window).
- **134 shipping containers** as structure and rooms; double insulated skin; aerodynamic outer shell against snow drift.
- Container walls: 170 mm rigid insulation, U = **0.135 W/m²K**. Outer triple glazing U = **0.5 W/m²K** (Wicona WICTEC 50HI); inner double glaze U = **1.1 W/m²K**. Facade designed for **−40 °C outside / +20 °C inside**, 30% indoor RH. Site winds cited up to **270 km/h**.
- Upper level overhangs **6 m** on steel V-columns (snow / drift clearance).
- Floors:
  - L2 living: 24 single/double rooms, kitchen/dining, library, gym, OT, offices, lounge
  - L1: labs, stores, technical, **CHP**, garage + workshop
  - L3: HVAC + science terrace
- Self-sufficient: CHP for electricity; waste heat heats the building; redundant critical plant on site; own freshwater treatment. Residual CHP heat “more than sufficient” to heat the whole station (Archello).
- Site modules: fuel farm, fuel station, seawater pump house, summer camp, containerized outbuildings.
- Labs (main building): Electrical/Electronics, Life Sciences, Chemical Sciences, Earth Sciences. 43-ISEA: **270 sq ft** lab with regulated power.
- Master plan zones: (1) infrastructure, (2) magnetic-silence (upper atmosphere), (3) future, (4) pristine, (5) antenna.
- Vehicles (AL/02): 4 Pisten Bully, 2 snow scooters, 1 Tata Xenon-XT, 1 BE-71 excavator, 1 BD-50, 1 × 50 t Mantis.
- Comms: **high-speed** via ECIL X/S-band data-reception + C-band link to NRSC Shadnagar (also NCPOR two-way). This is why Bharati is the better “live telemetry” story in the twin.

Published Bharati CHP kVA and fuel volume: **not in our sources**. Model from occupancy + CHP-waste-heat narrative, and mark as estimated.

---

## 3. Climate (drive the environment layer)

### Maitri / Schirmacher (Maitri-II brief + UAV 2022–23 field)

| Parameter | Value | Note |
|---|---|---|
| Annual mean temperature | **−9.7 °C** | Station climate, not a single year |
| Milder month | February **−3 °C** | Brief wording |
| Extreme cold | July **−44 °C** | Extreme, not monthly mean |
| Mean wind | **31.5 km/h** (~8.8 m/s) | Annual |
| Max wind | **200 km/h** | SE prevailing |
| Light | Polar night in winter; 24 h daylight in summer | Inland oasis |
| Precipitation | Minimal, snow; meltwater streams from the ice sheet feed lakes | Priyadarshini / Zub freezes in winter |
| Dec 2022 air (UAV/AWS) | **−4.4 to +1.8 °C** | One summer month near the ice edge |
| Melt-pond bed (PSA) | **−3.4 to +8.0 °C** | Same campaign |
| AWS | IMD “Sankalp” / station AWS; public plots at `nwp.imd.gov.in/maitri_mausam.php` | Hourly T, P, RH, wind |

Katabatic flow off the polar plateau is the Maitri wind story. UAV work (42nd/43rd ISEA) at the ice-sheet frontal edge next to Maitri:

- Survey box ~100 acres / ~0.27 km²; DEM resolution 8.5 cm.
- Ice-edge elevation change **0.25 m** and **13.6 kt** mass loss in one week (abstract headline); day-to-day swings were larger (±0.28 to +1.0 m over 2–4 day pairs in late Dec 2022).
- Supraglacial lake at **70°46′22.13″S, 11°45′11.62″E**: depth 0.25–1.6 m, area 9,151–24,727 m², volume 2,279 → 29,272 m³ (peak 24 Dec 2022), then drain/refreeze.
- Cryofacies to classify in the twin’s summer terrain layer: meltwater, frozen meltwater, dry snow, wet snow, debris/bare ice, bedrock.

GPR (2023–24, Novo–Maitri ice): internal structure to ~200 m (150 MHz); bedrock roof to **250–300 m**. South of the oasis the bed is gentle (relief ≤ 30 m) for 4.5 km; a sharp bed drop limits the oasis ~1 km east of the last outcrop. Crevasses are seasonal (open Oct–Nov). Use this for a “safe / unsafe ice” overlay around Novo runway and the Maitri ice-sheet margin.

### Bharati / Larsemann (IMD, 37th ISEA, 1 Dec 2017 – 30 Nov 2018)

This is the best year-long in-situ climate series we have for either station.

| Parameter | Value |
|---|---|
| Highest temperature | **+9.9 °C** (5 Jan 2018) |
| Lowest temperature | **−29.8 °C** (29 Aug 2018) |
| Warmest month | January (mean daily max **+3.7 °C**) |
| Coldest month | September (mean daily min **−19.1 °C**) |
| Winter nuance | Jul–Aug warmer than May–Jun–Sep that year |
| Diurnal range | Larger in summer than winter |
| Mean sea-level pressure | Monthly means 978.0–994.8 hPa; extremes **954.7** (5 Nov) – **1021.0** (3 Jun) |
| Station-level pressure | 949.6–1015.4 hPa |
| Relative humidity | 28–97% (both extremes in January); otherwise arid / steady |
| Prevailing wind | **North-easterly, year-round** |
| Windiest month | May — mean **18.0 kn** (~9.3 m/s); gust >23 kn on 28 days |
| Max gust | **80 kn** (~148 km/h), 5 Aug 2018 |
| Days with gust >23 kn | **270 / 365** |
| Highest daily-mean wind | 35 kn (17 Dec 2017) |
| Blizzards | **9 events, 15 days** (3 in August; none in Jan–Apr, Sep–Oct) |
| Longest blizzard | 24 h (5–6 Nov 2018); lowest MSLP of the year during it |
| Snow | **85.0 mm** water equivalent; **122** snow days; monthly max 17.6 mm (Aug), min 0.7 mm (Jan) |
| Polar day | **63 days** — 20 Nov 2017 to first sunset 22 Jan 2018 |
| Polar night | **49 days** — 28 May to first sunrise 16 Jul 2018 |
| Solar / UV | Dumbbell curve; maxima November–December (24 h sun) |
| Aurora | 76 visual events; peaks April then September |
| Fog | Rare; one documented 9 Mar 2018 from the NW |

Blizzard log (for a hazard calendar in the twin):

| Start (UTC) | End | Max wind (kn) | Hours |
|---|---|---|---|
| 16 Dec 2017 19:36 | 17 Dec 07:30 | 73 | 11.9 |
| 8 May 16:30 | 8 May 20:00 | 47 | 3.5 |
| 23 May 20:15 | 24 May 02:30 | 48 | 6.3 |
| 5 Jun 02:30 | 5 Jun 19:15 | 50 | 16.8 |
| 21 Jul 11:30 | 22 Jul 05:30 | 52 | 18.0 |
| 9 Aug 09:50 | 10 Aug 00:30 | 57 | 14.7 |
| 27 Aug 13:45 | 27 Aug 19:15 | 46 | 5.5 |
| 30 Aug 18:15 | 31 Aug 12:15 | 63 | 18.0 |
| 5 Nov 02:01 | 6 Nov 01:59 | 49 | 24.0 |

**Twin implication:** Bharati is milder and wetter-coastal than Maitri, but almost every day is a high-wind day. Energy yield: 63 d polar day vs 49 d polar night — solar is a summer-only layer; winter is diesel/CHP + wind if you add turbines later.

---

## 4. Logistics (sea-ice / access layer)

| Leg | Time | Window |
|---|---|---|
| Cape Town → Novo (IL-76) | ~5.5–6 h | Late Oct / Nov – Feb |
| Novo → Progress (Basler / Twin Otter) | ~8–12 h + fuel stop | From ~mid-Nov; **no direct CT–Bharati flight** |
| Cape Town → Bharati (ship) | **10–16 days** (AL/02) or 10–12 (43-ISEA) | Nov–Mar; sea-ice limited |
| Bharati → Maitri (ship) | **5–7 days** | Same season |
| Maitri → Cape Town (ship) | **8–12 days** | Ship leaves India Bay as winter closes |
| Typical voyage | Cape Town → Bharati → Maitri → Cape Town | Route can flip with ops |

- Air access is DROMLAN, not on-demand.
- Maitri: first pax can arrive late October by air; ship ~first week of March at India Bay / Lazarev Sea.
- Bharati: first air ~mid-November; ship first/second week of January.
- Helicopters exist only while the ship is nearby.
- Stations are **3,098 km / 1,693 NM** apart — treat as two twins that share a logistics graph, not one campus.

---

## 5. Instruments the twin can pretend to “see”

These are real, named sensors. They define the observation layer even when NPDC does not stream them.

### Maitri (AL/03)

| System | What it measures | Owner |
|---|---|---|
| MARA VHF radar (54.5 MHz) | Turbulence, waves, winds, stability — BL to mesopause | NCPOR |
| CADI ionosonde (1–30 MHz) | Ionosphere to ~500 km | NPL |
| GSV-4004B GISTM | L-band scintillation + TEC | NPL |
| DFM / PPM / ICM magnetometers | Geomagnetic field | IIG |
| Imaging riometer (38.2 MHz) | Cosmic-noise absorption / space weather | IIG |
| Long-wire + field mill | Global atmospheric electricity | IIG |
| IMD AWS + ozonesonde balloons | T, P, RH; ozone/T profile | IMD |
| Seismograph | 0–500 Hz at 70°45′56.21″S, 11°44′10.78″E | NGRI |
| GPS + met pack | Crustal motion; T/P/RH at same pad | NGRI |
| NOx analyser | NO/NO₂/NOx, 15 min, LDL 0.4 ppb | NCPOR |
| Aerosol spectrometer | 15 size bins, 0.3–≥20 µm, 15 min | NCPOR |
| Aethalometer | Black carbon, 370–950 nm, 15 min | NCPOR |

Southern Ocean (voyage, not station): 4 Bio-Argo floats (33rd ISEA) — do **not** put on the station twin.

### Bharati (AL/02 + IMD)

| System | What it measures |
|---|---|
| ECIL X/S + C-band ground station | EOS data reception; C-band to NRSC / NCPOR |
| DFM + PPM magnetometers | Geomagnetic field (sited in magnetic-silence zone) |
| Long-wire + field mill | Atmospheric electricity |
| GSV-4004B GISTM | Scintillation + TEC |
| IMD surface observatory + radiation + ozonesonde | Synoptic 3-hourly; solar/UV; 32 ozonesondes in 2017–18. Ozone column minimum **15 Sep – 10 Oct**. |

---

## 6. Data you can actually ingest

None of these are true push sockets. The twin **polls**.

| Source | Role | Access |
|---|---|---|
| NPDC / RAMADDA (`npdc.ncpor.res.in`, `ramadda.npdc.ncpor.res.in`) | Ground truth AWS (Maitri Sankalp 2006–2015 hourly CSV/NetCDF), Bharati AWS, synoptic, 24 h weather page, radiation/UV/ozone/BC | Register; request academic dump citing PS 26060 |
| IMD plots | Near-real daily weather graphs | `nwp.imd.gov.in/maitri_mausam.php` (and Bharati equivalent) |
| SCAR READER | Long monthly means — **Novolazarevskaya** as Maitri proxy | Free |
| OGIMET / METAR | Novo airstrip **ICAO AT17** — few-times-daily | Free |
| ERA5 (Copernicus CDS) | Hourly T/wind/P/precip at exact lat/lon | Free API + key |
| NASA POWER | Solar (`ALLSKY_SFC_SW_DWN`) + 2 m wind for energy yield | REST, no key |
| NSIDC / CMEMS | Sea-ice (Bharati ship window) | Free |
| REMA DEM + Quantarctica | Terrain / GIS base for both oases | Free |
| Sentinel-2 / Bhuvan | Building footprints (Bharati already hosts ISRO) | Free |

Ready POWER URLs (change dates):

```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,ALLSKY_SFC_SW_DWN,PS,RH2M&community=RE&longitude=11.7308&latitude=-70.7668&start=20260101&end=20260828&format=JSON
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,ALLSKY_SFC_SW_DWN,PS,RH2M&community=RE&longitude=76.1953&latitude=-69.4068&start=20260101&end=20260828&format=JSON
```

**Gaps you must say out loud in the submission:** NCPOR does not publish live generator load, fuel burn, or resupply manifests. Build a **synthetic** energy/logistics series from §2 capacities and §4 calendar, and label it synthetic.

---

## 7. Twin architecture (what to build)

```
NPDC/IMD AWS ──┐
ERA5 / POWER ───┼─► poll ingest ─► raw land ─► QC / cross-check ─► unified TS
Novo METAR ─────┤                                      │
Sea ice ────────┘                                      ▼
REMA + footprints ─► GIS / 3D scene                    twin state
Synthetic CHP/fuel/occupancy ─► energy model ──────────┘
                                                    ▼
                              UI: 3D + overlays + what-if
```

**Unified row:** `station_id, timestamp, parameter, value, unit, source, confidence`

**State objects (both stations):** environment, occupancy, energy, fuel, access (air/sea/heli), terrain/hazards (crevasse, melt pond, blizzard).

**What-ifs that the documents actually support:**

1. Resupply slip of 2 weeks in Feb (sea-ice) → fuel days-remaining from 600 kL (Maitri-II) or estimated Bharati farm.
2. Close Maitri summer wing (Maitri-II ops doctrine) → load drop.
3. Dec melt-pond growth next to Maitri (UAV magnitudes).
4. 80 kn gust / 24 h blizzard (Bharati 2018) → outdoor work + heli lockout.
5. Polar night (49 d Bharati; longer inland) → solar yield = 0, CHP-only.

**Do not** model Bio-Argo, Gondwana tectonics, spinel–quartz petrology, or magnetic fabrics of Grovnes gneiss. They do not change station state.

---

## 8. Source triage

### Kept (read these if you need the original)

| File | Why it stays |
|---|---|
| `AL-03 Planning Advisory - Maitri-20190807.pdf` | Official Maitri coords, capacity, vehicle list, instrument inventory |
| `AL-02PlanningAdvisory-Bharati-2023.pdf` | Official Bharati coords, 47+25 capacity, zones, labs, vehicles, ISRO/ECIL |
| `advt_092024_250724.pdf` | Maitri climate design values + Maitri-II energy/fuel/building program |
| `ed-mausam,+10.+ROHIT+THAPLIYAL+(607-616).pdf` | Only full-year Bharati met/ozone/blizzard table |
| `43-ISEA Webpage advertisment.pdf` | Voyage times, air chain, summer vs winter beds, comms, 100 km field radius |
| `16597-Article Text-60874-2-10-20250704.pdf` | Ice thickness / crevasse / Novo runway context for Maitri |
| `2305.07523v3.pdf` | REMA-based oasis terrain (Schirmacher + Larsemann) |
| UAV cryosphere PDF (one copy) | Maitri ice-edge / melt-pond magnitudes and AWS pointer |

### Dropped (facts already pulled, or irrelevant to the twin)

| Item | Verdict |
|---|---|
| South Pole PV/wind techno-economic (arXiv 2306.13552) | Wrong station. Only transferable line: a 170 kW Antarctic hybrid cut diesel ~95% in that study; Princess Elisabeth is 100% RE (132 kW); Casey ~30 kW PV. Not used as our energy model. |
| pv-magazine South Pole news | Same story, thinner than the paper |
| Petrology of Larsemann Hills (spinel+quartz) | Bedrock metamorphism ~527 Ma. No twin state. |
| Past glacial striations, Schirmacher | Palaeo ice-flow (NNW–NNE). Not current ops. |
| Magnetic susceptibility, Bharati promontory | Rock magnetism for surveys. Not station ops. (Zone-2 “magnetic silence” from AL/02 is the only bit we kept.) |
| Archello / RIBAJ HTML dumps | Building facts copied into §2. HTML is not a source of record. |
| 43-ISEA duplicate ads, incomplete `.crdownload` | Junk / unfinished downloads |
| DRDO PPT (MOF / ML water uptake) | Unrelated to Antarctica |
| Download scripts and tier-2/3 fetch reports | One-shot tooling |
| Bio-Argo / Southern Ocean floats | Voyage science, not station twin |

### Still missing (do not block the twin; request if you get library access)

- CSIR-SERC structural assessment of **current** Maitri (aging fabric).
- Structural Engineering International paper on Bharati (more engineering than RIBAJ).
- Neumayer-III / Turkish-station RE papers — optional analogs only.

---

## 9. Conflicts and confidence

| Topic | Conflict | What to use |
|---|---|---|
| Maitri summer beds | AL/03 = 65; 43-ISEA = 40–60 containers | Range 40–65; winter is 25 in all sources |
| Maitri longitude | Several official strings differ by ~100–200 m | AL/03 decimal for APIs; show ISEA DMS on the map label |
| Distance to coast | AL/03 ~100 km; 43-ISEA ~80 km to ice-shelf edge | “80–100 km inland” |
| Bharati summer overflow | AL/02 +25 camps; 43-ISEA mentions only 47 in the main building | 47 year-round; 72 peak if camps are open |
| Maitri July −44 °C | Brief does not say mean vs extreme | Treat as **extreme**, not monthly mean |
| Bharati max wind | IMD year = 80 kn; RIBAJ design = 270 km/h | 80 kn is observed; 270 km/h is the envelope the skin was designed for |

---

## 10. Implementation checklist

1. Two station objects with the identity table in §1.
2. Occupancy calendar: Nov–Feb high, Mar–Oct winter complement.
3. Poll ERA5 + POWER daily; overlay IMD/NPDC when a CSV exists.
4. Cross-check Maitri AWS vs Novo AT17 vs ERA5.
5. Synthetic energy: Maitri-II 600–750 kVA + 600 kL JET A1; Bharati CHP + waste-heat heating.
6. Access graph: CT air/sea windows from §4; lock heli unless “ship nearby”.
7. Terrain: REMA + oasis DEMs; Maitri melt-pond + crevasse overlays in summer.
8. Every synthetic series carries `source=synthetic` and `confidence=low`.
