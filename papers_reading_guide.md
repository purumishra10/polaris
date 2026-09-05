# Papers Reading Guide — Maitri & Bharati Digital Twin (PS 26060)

**Use with:** [digital_twin_knowledge_base.md](digital_twin_knowledge_base.md) (numbers for code) · this file (what to read and why)

**Reading order:** Tier 1 → Tier 2 → Tier 3. Skip geology / wrong-station papers unless a judge asks.

---

## Quick map

| Tier | Read when building… | Papers |
|---|---|---|
| **1 Must** | Station objects, sensors, energy, logistics | AL/03, AL/02, Maitri-II brief, MAUSAM Bharati, 43-ISEA |
| **2 Useful** | Terrain, ice hazards, summer melt | UAV paper, GPR paper, REMA geomorph |
| **3 Optional** | Structural detail if you have library access | CSIR-SERC Maitri chapter, IStructE Bharati, Neumayer RE |
| **Skip** | Not twin state | Glacial striations, petrology, magnetic susceptibility, South Pole RE |

---

# PART A — Missing papers (we do NOT have the PDF)

Content below is recovered from abstracts, Springer, Structurae, Dlubal, NCPOR tenders, and web summaries. **Request full PDF via college library or ResearchGate.**

---

## A1. Structural Assessment of Maitri (CSIR-SERC)

| Field | Detail |
|---|---|
| **Status** | ❌ Not in repo |
| **Authors** | G. Raghava, S. G. N. Murthy (CSIR-SERC, Chennai) |
| **Where** | Book chapter in *Engineering and Communications in Antarctica*, Springer Singapore, 2021 |
| **DOI** | https://doi.org/10.1007/978-981-15-5732-3_12 |
| **Also** | ResearchGate pub. 345454439 |
| **Expedition** | XXIII ISEA — on-site assessment at Maitri |
| **Twin layer** | Structural / “why Maitri-II” narrative |

### What we know without the full PDF

- Maitri built **1988–89**; **original design life 10 years**.
- By **2003–04** it had already served **15 years** as a permanent station.
- **Structural damage was observed** → CSIR-SERC asked to assess the building.
- Two SERC scientists joined XXIII ISEA and inspected the structure on site.
- Chapter contains **assessment details + recommendations** (full text paywalled).
- Secondary reporting (EIL/SERC panels cited in news) → **replacement recommended** rather than indefinite patch repair — aligns with **Maitri-II** (2024 brief: aging, deterioration, personnel safety risk).
- Related same book: **Ch. 3** Pathak — review of engineering aspects of Dakshin Gangotri & Maitri (construction + maintenance management).

### Twin use (even without PDF)

- Show **current Maitri** as **past design life, damaged, on stilts**.
- Justify **Maitri-II scenario** in what-if UI (“replace station” vs “repair”).
- Do **not** invent crack locations or load ratings — say “assessment on file at SERC; public summary = exceeded life + damage.”

### How to get it

1. College library → Springer book *Engineering and Communications in Antarctica* (ISBN 978-981-15-5731-6), Chapter 12.
2. ResearchGate → “Request full-text” on publication 345454439 (cite PS 26060 / SIH 2026).
3. Email NCPOR Maitri ops (contacts in AL/03): yogesh@ncaor.gov.in — structural context for Maitri-II competition.

---

## A2. Bharati — Structural Engineering International (IStructE)

| Field | Detail |
|---|---|
| **Status** | ❌ Not in repo |
| **Typical title** | *The New Indian Research Station at Larsemann Hills* (or similar) |
| **DOI** | https://doi.org/10.2749/101686613X13439149157353 |
| **Journal** | Structural Engineering International, Vol. 23, No. 1 (~2013) |
| **Twin layer** | Bharati 3D mesh, loads, container structural system |

### What we recovered from Structurae, Dlubal, bof/Archello, Wicona press

| Parameter | Value |
|---|---|
| Footprint | ~**52 m × 30 m** (Structurae); RFEM model **53.23 × 30.20 × 16.29 m** |
| Height | ~**12 m** (Structurae) / **>40 ft** (Dlubal) |
| Containers | **134 × 20-ft ISO**; corner-casting **primary structure** (not dummy infill) |
| Foundation | **85–86 GEWI / micropiles** into rock (Dlubal: 86 injection piles) |
| Steel mass | Containers **270 t** + façade **100 t** + columns **60 t**; RFEM total **~401 t** |
| Design life | **25 years** minimum |
| Wind (design) | Up to **270 km/h** (RIBAJ/Wicona); katabatic gusts cited **200 mph ULS** (Archello) |
| Build window | **~3 months** austral summer; prefab in Antwerp → Cape Town → site |
| Transport | ~**1,000 tonnes**; **5,200 km** sea leg to Larsemann Hills |
| Envelope | Double skin: container U **0.135 W/m²K**; triple glaze **0.5 W/m²K** outer |
| Analysis | **RSTAB/RFEM** (KSF Bremerhaven): 3267 nodes, 7341 members, 27 load cases, 113 combinations |
| Award | European Steel Design Award **2013** |

### Twin use

- Bharati mesh: **52×30 m** footprint, **3 levels**, container grid.
- Load story: aerodynamic outer shell + stiff container diaphragms.
- CHP on **Level 1** (from Archello/AL/02 — consistent).

### How to get it

1. University library → IStructE / Taylor & Francis via DOI above.
2. Related open conference paper (Structurae cites): IABSE 2016 — *The Container Connection of the New Indian Antarctic Research Station* (pp. 2676–2684) — good substitute if SIE paywalled.

---

## A3. Neumayer III photovoltaic feasibility (optional analog)

| Field | Detail |
|---|---|
| **Status** | ❌ Not in repo |
| **DOI** | https://doi.org/10.1016/j.seja.2022.100026 (also j.est variant cited) |
| **Twin layer** | Optional “renewable energy what-if” — **not Maitri/Bharati numbers** |

### Recovered content

- Station today: mainly **polar diesel + CHP** → **714 t CO₂/a**.
- TRNSYS simulation: PV **44 kWp** + **10 m³** thermal store + 5 CHP + 5 wind + **300 kWh** battery.
- Best case: up to **65% renewable**, **43% CO₂ cut** (10% demand growth scenario).
- PV only adds **3–7 percentage points** (limited roof/space) but still worth it economically.
- **Wind dominates** RE share at Neumayer.

### Twin use

- If you add a “future renewables” slider for Bharati/Maitri-II, cite this as **Antarctic analog only**, not measured Indian station data.

---

## A4. Turkish Antarctic hybrid RE (optional)

| Field | Detail |
|---|---|
| **Status** | ❌ Not in repo |
| **DOI** | https://doi.org/10.1016/j.est.2025.115264 |
| **Twin use** | Skip unless building a comparative dashboard of world stations |

---

# PART B — Papers we HAVE (read these)

Each entry: **what it is → twin layer → read this / skip → key numbers → file path**

---

## B1. AL/03 Planning Advisory — Maitri ⭐⭐⭐⭐⭐

| | |
|---|---|
| **File** | `AL-03 Planning Advisory - Maitri-20190807.pdf` |
| **Pages** | 5 |
| **Read time** | 15 min |
| **Twin layer** | Maitri identity, sensors, vehicles, contacts |
| **Official?** | Yes — NCPOR |

### Read this

- Page 1: coords **−70.76683367, 11.73078318**, 117 m, 100 km inland, steel stilts, **65 summer / 25 winter**.
- Page 2: DROMLAN Cape Town–Novo ~5.5 h; vehicle table (14 Pisten Bully, etc.).
- Pages 2–4: **Full instrument list** — use as Maitri sensor registry in twin.

### Skip

- §3.1 Bio-Argo floats (Southern Ocean voyage — not on-station twin).

### Key numbers for twin

```
Coords:     -70.76683367, 11.73078318
Elevation:  117 m
Capacity:   25 winter, 65 summer
Seismo/GPS: 70°45′56.21″S, 11°44′10.78″E
Instruments: MARA 54.5 MHz, CADI, GISTM, DFM/PPM/ICM, riometer 38.2 MHz,
             field mill, IMD AWS+ozonesonde, NOx, aerosol 15-bin, aethalometer
Vehicles:   14 Pisten Bully, 4 snow scooters, 1+1 trucks, dozer, 5 cranes…
```

### Contacts (for data request)

- Maitri manager: **Dr Yogesh Ray** — yogesh@ncaor.gov.in
- Logistics: **Dr Shailendra Saini** — shailendra.saini@gmail.com

---

## B2. AL/02 Planning Advisory — Bharati ⭐⭐⭐⭐⭐

| | |
|---|---|
| **File** | `AL-02PlanningAdvisory-Bharati-2023.pdf` |
| **Pages** | 4 (updated May 2023) |
| **Read time** | 15 min |
| **Twin layer** | Bharati identity, zones, comms, labs, instruments |

### Read this

- Page 1: **−69.40680, 76.19525**, 35 m; **47** year-round + **25** camps = **72** peak.
- Page 2: Ship 10–16 d from CT; air via Novo → Progress **10–12 h** feeder.
- §2.2: **Master plan zones** (infra, magnetic silence, future, pristine, antenna) — map layers.
- §3.1: **ECIL X/S + C-band to NRSC** — Bharati live-data story.
- §3.2–3.4: Magnetometers, atmospheric electricity, GISTM.

### Skip

- §4 lab equipment list unless your twin includes lab inventory UI.

### Key numbers

```
Coords:     -69.40680, 76.19525
Capacity:   47 + 25 camps = 72
Labs:       4 (EE, Life, Chemical, Earth Sciences)
Zones:      5 (see §2.2)
Comms:      High-speed satellite (ECIL/NRSC)
Vehicles:   4 Pisten Bully, 2 scooters, 1 Tata, excavator, dozer, 1 crane
```

---

## B3. Maitri-II Global Design Competition Brief ⭐⭐⭐⭐⭐

| | |
|---|---|
| **File** | `advt_092024_250724.pdf` |
| **Pages** | 25 |
| **Read time** | 45 min (skim §1–3 + Annexure-I) |
| **Twin layer** | Future Maitri energy, climate design, building program |

### Read this

- **§2.2 Climate:** mean **−9.7 °C**, Feb **−3 °C**, Jul extreme **−44 °C**, wind mean **31.5 km/h**, max **200 km/h**, SE prevailing.
- **§2.1 Site box:** ~2.5 km² around Priyadarshini Lake; elevations 20–165 m.
- **§3 Population:** **140 summer / 40 winter**; summer wing closes in winter.
- **§5.2 Wastewater:** current Maitri on lake catchment — long-term relocation / discharge to shelf ice (explains Maitri-II layout).
- **Annexure-I** (end of PDF): building list + **6×100–125 kVA CHP**, **600,000 L JET A1**, Kamov helipad, pipelines.

### Skip

- Eligibility, competition timelines, consultancy fee annexes unless writing proposal prose.

### Key numbers (energy twin)

```
CHP:        6 units × 100–125 kVA = 600–750 kVA total
Fuel farm:  600,000 L JET A1
People:     140 summer / 40 winter
Design life: 40 years
Wind design: 31.5 km/h mean, 200 km/h max, SE
```

---

## B4. MAUSAM — Bharati meteorology (37th ISEA) ⭐⭐⭐⭐⭐

| | |
|---|---|
| **File** | `ed-mausam,+10.+ROHIT+THAPLIYAL+(607-616).pdf` |
| **Journal** | MAUSAM 73(3), 607–616, 2022 |
| **DOI** | https://doi.org/10.54302/mausam.v73i3.1322 |
| **Period** | 1 Dec 2017 – 30 Nov 2018 |
| **Read time** | 30 min (Tables 1–2 + Figs 2–6) |
| **Twin layer** | Bharati environment, hazards, solar, ozone |

### Read this

- **Table 1** — all extremes (copy into twin constants).
- **Table 2** — **9 blizzards** with start/end UTC (hazard calendar).
- **§2.6** — polar day **63 d**, polar night **49 d**.
- **§2.7** — blizzard definition (>23 kn, visibility <1000 m).
- **§3** — aurora 76 times; fog 9 Mar 2018.

### Skip

- Hindi abstract, Gondwana geology intro (§1 first paragraph).

### Key numbers (paste into Bharati env model)

```
Temp max/min:     +9.9 °C (5 Jan) / −29.8 °C (29 Aug)
Warmest/coldest:  January / September
MSLP range:       954.7 – 1021.0 hPa
Wind prevailing:  NE, all year
Windiest month:   May (18 kn mean)
Max gust:         80 kn (5 Aug 2018)
Days gust >23 kn: 270 / 365
Blizzards:        9 events, 15 days
Snow:             85 mm, 122 days
Polar day/night:  63 d / 49 d
Ozone min column: 15 Sep – 10 Oct
Aurora:           76 observations
```

---

## B5. 43-ISEA Webpage Advertisement ⭐⭐⭐⭐

| | |
|---|---|
| **File** | `43-ISEA Webpage advertisment.pdf` |
| **Pages** | 13 |
| **Read time** | 20 min (§1 area map + §2 travel + §4 infra) |
| **Twin layer** | Logistics graph, beds, comms limits |

### Read this

- **§1** — stations **3,098 km apart**; Maitri vs Bharati connectivity diagram.
- **§2** — air Nov–Feb only; last flight ~mid-Feb; ship exits India Bay late March.
- **§4.1–4.2** — beds: Maitri **25/40–60**; Bharati **47**; lab **270 sq ft** at Bharati.
- **§4.3** — internet: Bharati high-speed; Maitri satellite; **6 min/mo** summer calls, **20 min/mo** winter.

### Key numbers

```
Distance:      3098 km / 1693 NM between stations
Maitri beds:   25 winter, 40–60 summer (containers × 4)
Bharati beds:  47 main building
Ship CT→Bharati: 10–12 days
Ship Bharati→Maitri: 5–7 days
Field radius:  ≤100 km campaign mode
```

---

## B6. UAV cryosphere paper (Maitri ice edge) ⭐⭐⭐

| | |
|---|---|
| **File** | `tier2/Exploring the frozen frontier…pdf` (delete duplicate in tier3 if present) |
| **DOI** | https://doi.org/10.1080/15481603.2024.2302739 |
| **Campaign** | 42nd–43rd ISEA, Nov 2022 – Jan 2023 |
| **Read time** | 25 min (Abstract + §2 Study area + §5 Results) |
| **Twin layer** | Maitri summer terrain hazard overlay |

### Read this

- **Abstract** — ice edge −0.25 m / 13.6 kt in one week; melt pond magnitudes.
- **§2** — Schirmacher setting; supraglacial lake **70°46′22.13″S, 11°45′11.62″E**.
- **§3.2** — AWS link: `nwp.imd.gov.in/maitri_mausam.php`.
- **§5** — melt pond area/volume time series (Dec 2022 peak).

### Skip

- Long literature review on other continents.

### Key numbers

```
Survey area:   ~100 acres (~0.27 km²)
UAV height:    95 m AGL, 5 cm/px GSD
Melt pond:     depth 0.25–1.6 m; area 9,151–24,727 m²;
               volume peak 29,272 m³ (24 Dec 2022)
Cryofacies:    meltwater, frozen meltwater, dry/wet snow, debris, bedrock
AWS:           IMD near Maitri (2 m)
```

---

## B7. GPR glacier / bedrock (Novo–Maitri) ⭐⭐⭐

| | |
|---|---|
| **File** | `16597-Article Text-60874-2-10-20250704.pdf` |
| **Journal** | J. Mining Institute 2025, open access |
| **Read time** | 20 min (Abstract + results near Novo/Maitri) |
| **Twin layer** | Ice thickness, crevasse seasonality, runway safety |

### Read this

- Abstract: OKO-3 → **~200 m** internal structure; Triton-M → bed **250–300 m**.
- Crevasses **seasonal**, open **Oct–Nov** near Novo runway.
- Subglacial relief south of oasis **≤30 m** over 4.5 km; sharp bed drop ~1 km east.

### Twin use

- “Safe ice route” layer for Novo airfield ↔ Maitri logistics.
- Not needed for indoor energy model.

---

## B8. Geomorphometric REMA oases ⭐⭐

| | |
|---|---|
| **File** | `2305.07523v3.pdf` |
| **Pages** | 84 (arXiv preprint) |
| **Read time** | 15 min (§2 Study areas for Schirmacher + Larsemann only) |
| **Twin layer** | GIS terrain base, slope/hydrology indices |

### Read this

- **§2.3 Schirmacher** — 1.5–3.5 km wide × ~20 km, 0–228 m, ~180 lakes, Novo + Maitri on Fig. 3.
- **§2.1 Larsemann** — ~40 km², 30–120 m elevations.

### Skip

- Full math on 17 morphometric variables unless doing GIS thesis work.
- Fildes Peninsula / Thala Hills unless expanding map.

### Twin use

- Download **REMA** + **Quantarctica** instead of re-deriving from this paper.

---

## B9. Glacial striations Schirmacher ⭐ (SKIP for twin)

| | |
|---|---|
| **File** | `tier3/1-s2.0-S1873965221001213-main.pdf` |
| **Authors** | Yogesh Ray et al., NCPOR |
| **Topic** | Palaeo ice-flow from bedrock striations, NNW–NNE, resultant **15°E** |
| **Verdict** | **Delete or ignore** — geology/palaeo, not operational twin state. Lead author is NCPOR ops (useful contact), paper content is not. |

---

# PART C — One-page cheat sheet (all Tier 1 numbers)

```
MAITRI (current)          BHARATI
─────────────────         ─────────────────
-70.7668, 11.7308         -69.4068, 76.1953
117 m inland              35 m coastal
25 / 65 beds              47 / 72 beds
Satellite comms           High-speed ECIL/NRSC
SE wind, -9.7°C mean      NE wind, +9.9 to -29.8°C (2017-18)
Steel stilts, aging       134 containers, CHP
Maitri-II: 600-750 kVA    CHP kVA unpublished
           600 kL fuel

LOGISTICS: CT→Novo 5.5h → Progress 10-12h | Ship 10-16d to Bharati | Stations 3098 km apart
```

---

# PART D — How to get missing PDFs (fastest paths)

| Paper | Fastest route |
|---|---|
| CSIR-SERC Maitri assessment | Springer book Ch.12 via library · ResearchGate 345454439 |
| Bharati IStructE | DOI 10.2749/101686613X13439149157353 via library · or IABSE 2016 substitute |
| Neumayer PV | DOI 10.1016/j.seja.2022.100026 · open summary enough for analog only |

**Email template for NCPOR / authors:**  
*“Team working on SIH 2026 PS 26060 digital twin of Maitri and Bharati — requesting structural/engineering documentation or data access for academic use.”*

---

# PART E — Suggested reading session (2 hours total)

| Minutes | Do this |
|---|---|
| 0–15 | B1 AL/03 — highlight every instrument row |
| 15–30 | B2 AL/02 — zones + ECIL comms |
| 30–50 | B3 Maitri-II brief §2–3 + Annexure-I energy |
| 50–80 | B4 MAUSAM Tables 1–2 + blizzard list |
| 80–100 | B5 43-ISEA travel + beds |
| 100–120 | B6 UAV abstract + melt pond coords (if doing terrain layer) |

After that, use **digital_twin_knowledge_base.md** for implementation — don’t re-read PDFs unless citing.
