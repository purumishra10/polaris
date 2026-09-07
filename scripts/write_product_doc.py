"""Generate Polaris SIH product specification as a Word document."""
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor


OUT = Path(__file__).resolve().parents[1] / "Polaris_Eleven_Modules_and_System.docx"

NAVY = RGBColor(0x1B, 0x3A, 0x4B)
ACCENT = RGBColor(0x1F, 0x4E, 0x79)
BODY = RGBColor(0x2D, 0x2D, 0x2D)
MUTED = RGBColor(0x5A, 0x5A, 0x5A)


def set_run(run, *, size=11, bold=False, color=BODY, italic=False, name="Calibri"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), name)


def shade_cell(cell, hex_color: str):
    tc = cell._tePr if hasattr(cell, "_tePr") else cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def add_heading_styled(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = NAVY if level == 1 else ACCENT
        run.font.name = "Calibri"
    return p


def add_body(doc, text, *, italic=False, bold=False, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    run = p.add_run(text)
    set_run(run, italic=italic, bold=bold)
    return p


def add_label_block(doc, label, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Inches(0.15)
    r1 = p.add_run(label + " ")
    set_run(r1, bold=True, color=ACCENT, size=11)
    r2 = p.add_run(text)
    set_run(r2, size=11)
    return p


MODULES = [
    {
        "n": 1,
        "title": "Operations lockouts",
        "what": (
            "Lockouts turn a weather or ice forecast into a station decision. "
            "Instead of only plotting wind speed, the twin applies published rules "
            "(IMD blizzard definition: gust above 23 kn with visibility under 1 km; "
            "heli available only while the voyage ship is nearby; crevasses open "
            "October–November on the Novo–Maitri ice) and paints the result on the "
            "3D scene: outdoor work locked, helicopter locked, ice convoy caution."
        ),
        "why": (
            "Judges and NCPOR operators do not need another anemometer chart. They "
            "need to know whether people can go outside, whether a Kamov can fly, "
            "and whether a PistenBully convoy to India Bay is safe. This module is "
            "the bridge from predictive analysis to operations."
        ),
        "example": (
            "Clock: 5 August 2018, 18:00 UTC, Bharati. Forecast and IMD log show "
            "gusts to 80 kn during an 18-hour blizzard. The twin sets outdoor = LOCKED, "
            "heli = LOCKED (ship is not at Quilty Bay in mid-winter anyway), vehicles = "
            "restricted. The Bharati mesh shows red badges on the shell and the "
            "helipad. Maitri is not in the same blizzard; its lockouts stay driven "
            "by its own wind and ice layer. A field team asking “can we sample "
            "outside tonight?” gets a no, with the rule cited, not a raw 80 kn number."
        ),
        "inputs": "Open-Meteo / POWER wind and gust; IMD blizzard calendar; ship-nearby flag; GPR crevasse season.",
        "outputs": "Per-station flags: outdoor, heli, convoy, field work. 3D badges + ops brief lines.",
    },
    {
        "n": 2,
        "title": "Fuel-days remaining",
        "what": (
            "Fuel-days estimates how many days of JET A-1 / diesel the station can "
            "run at the current (or scenario) burn rate. Burn is physics-inspired, "
            "not a black-box neural net: occupancy × heating load from outdoor "
            "temperature and wind (heat loss rises with ΔT and gust) × polar night "
            "(solar = 0, CHP-only) × generator specific fuel consumption. Maitri-II "
            "published plant is 600–750 kVA and 600,000 L JET A1. Current Maitri and "
            "Bharati tank volumes are not published, so every litre is tagged synthetic "
            "or planned."
        ),
        "why": (
            "Temperature prediction is cheap. “If this weather holds, you have 41 days "
            "of fuel, 34 if the blizzard continues” is what isolation logistics is about. "
            "Casey Station research also shows CHP coupling: less diesel-electricity "
            "can mean less waste heat and more boiler fuel — the model must not treat "
            "kilowatts as free litres."
        ),
        "example": (
            "Maitri-II winter scenario: 40 people, polar night, mean T around −20 °C, "
            "summer wing closed. The engine uses occupancy 40, heating from ΔT to +20 °C "
            "indoors, SFC about 0.28 L/kWh on the CHP spec, tank 600,000 L. Result: "
            "e.g. ~180 fuel-days (illustrative). Operator opens the summer wing (140 "
            "people) without changing weather: fuel-days drop sharply. All figures "
            "show the tag SYNTHETIC / PLANNED so nobody confuses them with a live "
            "NCPOR tank gauge."
        ),
        "inputs": "T, wind, polar-night flag, occupancy, plant spec (Maitri-II 750 kVA / 600 kL), optional indoor setpoint.",
        "outputs": "Litres/day, days remaining, 3D tank overlay, what-if deltas.",
    },
    {
        "n": 3,
        "title": "Shared voyage (one expedition, two stations)",
        "what": (
            "Maitri and Bharati are 3,098 km apart and do not share a campus. They "
            "share a calendar: Cape Town air to Novo (IL-76, ~5.5–6 h, late Oct–Feb), "
            "feeder Novo → Progress (~8–12 h), ship Cape Town → Bharati 10–16 days, "
            "Bharati → Maitri 5–7 days, heli only while the ship is nearby. The twin "
            "is one logistics graph. A delay or ice closure at Bharati is felt at Maitri."
        ),
        "why": (
            "Two independent 3D twins is what every other team will build. Indian "
            "Antarctic operations are one voyage. Casey Station LCA also found the "
            "icebreaker freight to be the largest climate lever — the ship is not a "
            "side map."
        ),
        "example": (
            "It is 20 January. Sea-ice in Prydz Bay is modelled above the 6/10ths "
            "constraint on the Cape Town–Quilty Bay leg. The operator slides "
            "“ship +14 days.” Bharati fuel-days fall because resupply is later; "
            "Maitri’s India Bay call also slips; heli stays unavailable at both "
            "ends. Isolation countdown (module 7) shortens. The 3D voyage timeline "
            "shows the sea leg red and the air window still open at Novo until mid-February."
        ),
        "inputs": "logistics_routes.csv; season windows; sea-ice / wind constraints; operator delay slider.",
        "outputs": "Air / sea / heli open or closed; ETA; coupled fuel-days at both stations.",
    },
    {
        "n": 4,
        "title": "Replay 5 August 2018 (Bharati blizzard)",
        "what": (
            "A historical clock jump to a night NCPOR and IMD already documented: "
            "maximum gust 80 kn on 5 August 2018, part of the 2017–18 MAUSAM year "
            "with nine blizzards. The twin loads environment at that timestamp, "
            "fires lockouts, and shows fuel and comms under polar-winter conditions. "
            "This is not a synthetic spike invented for the demo."
        ),
        "why": (
            "Judges can Google the paper. Trust in the twin comes from replaying "
            "ground truth, then scoring your rules against it (module 9)."
        ),
        "example": (
            "User hits “Replay IMD BLZ peak.” Clock becomes 2018-08-05. Bharati: "
            "80 kn, outdoor and heli locked, polar night (sun last rose in mid-July "
            "on that year’s table), solar = 0, CHP-only burn, fuel-days ticking "
            "down. Progress reanalysis (module 6) sits beside it so you see the "
            "neighbourhood, not a lonely hut. Caption: Source: Thapliyal et al., "
            "MAUSAM 73(3), Table 2 / station extremes."
        ),
        "inputs": "hazard_events (9 IMD blizzards); Open-Meteo/POWER at that date; polar-night calendar.",
        "outputs": "Full twin state for that night; citation on screen.",
    },
    {
        "n": 5,
        "title": "Source tags (pedigree on every number)",
        "what": (
            "Every displayed value carries a pedigree: in-situ / IMD, reanalysis "
            "(Open-Meteo, NASA POWER), forecast, synthetic (energy, occupancy "
            "tonight), planned (Maitri-II), analog (Casey litres), or proxy "
            "(Novo, Progress). Polar literature (Spasova; Farsangi) insists on "
            "interoperable, honest data spaces — not fake live sockets."
        ),
        "why": (
            "NCPOR does not publish live generator load or tank dips. Teams that "
            "claim “live digital twin of all sensors” will be questioned. Tags "
            "are the adult move and a feature, not a disclaimer buried in a slide."
        ),
        "example": (
            "Hover on Bharati air temperature: “OPEN_METEO_REANALYSIS · confidence 0.90.” "
            "Hover on fuel-days: “SYNTHETIC from Maitri-II brief (600 kL, 0.28 L/kWh) · "
            "not a live tank.” Hover on indoor −1 °C savings: “ANALOG · Casey Station "
            "LCA 2020, not Indian measured.” The ops brief repeats these tags so an "
            "expedition leader can distrust a number in one glance."
        ),
        "inputs": "confidence_score and source_type in station_telemetry; module-level flags.",
        "outputs": "Hover, legend, and exported brief footnotes.",
    },
    {
        "n": 6,
        "title": "Near-station strip (Novo and Progress)",
        "what": (
            "Indian arrivals do not land on Maitri’s doorstep. They use "
            "Novolazarevskaya blue-ice runway (ICAO AT17, ~3.5 km). Bharati air "
            "is a feeder via Progress skiway (~8 km). The strip shows neighbour "
            "weather, ΔT/Δwind versus the Indian station, and airfield "
            "open/closed. It is not a second full twin: no invented Russian fuel."
        ),
        "why": (
            "GPR work maps ice between Novo runway and the oasis; 43-ISEA draws "
            "the air chain through Novo and Progress. A neighbourhood strip "
            "proves you understand East Antarctica as a system. Menéndez (2026) "
            "calls this linking stations that share logistics."
        ),
        "example": (
            "Maitri panel: T = −18 °C. Novo proxy: T = −16 °C. ΔT = −2 °C (OK). "
            "Forecast T at AT17 is −4 °C with the IL-76 rule “surface temp < −5 °C "
            "for heavy landing” failing — Maitri air arrivals = CLOSED even if "
            "Maitri camp wind is fine. Bharati blizzard day: Progress feeder VFR "
            "likely down; strip says AIR FEEDER CLOSED. Crevasse season October: "
            "Novo–Maitri land leg = CONVOY CAUTION from GPR, not from a neural net."
        ),
        "inputs": "POWER and Open-Meteo for four stations; AT17 / Progress constraints; GPR season.",
        "outputs": "Δ weather, airfield status, ice-route caution; proxy tags.",
    },
    {
        "n": 7,
        "title": "Winter-isolation countdown",
        "what": (
            "A large, simple number: days until the last DROMLAN aircraft "
            "(typically ~mid-February) and days until the ship must leave India "
            "Bay / the coast (March freeze-up). After those dates, the wintering "
            "party is on its own until the next season. The ship-delay slider "
            "eats remaining days."
        ),
        "why": (
            "Polar stations are defined by isolation windows, not by average "
            "temperature. A countdown is instantly readable in a demo and is "
            "the calendar behind fuel-days and missed-flight (module 8)."
        ),
        "example": (
            "Clock: 1 February. Last air ~14 February → 13 days air remaining. "
            "Ship hard exit ~15 March → 42 days sea remaining. Operator delays "
            "ship 14 days: sea remaining becomes 28 days and fuel-days must "
            "cover a longer unsupplied stretch. If the clock is 20 February, "
            "air remaining is 0 — only sea (if still open) or wait until October."
        ),
        "inputs": "43-ISEA / AL air and sea windows; operator delay; current clock.",
        "outputs": "Days-to-last-air, days-to-last-sea; 0 triggers isolation state.",
    },
    {
        "n": 8,
        "title": "Missed last flight (summer occupancy stuck in winter)",
        "what": (
            "A what-if toggle: the last aircraft does not extract the summer "
            "overflow. Occupancy stays at summer levels (Maitri ~65, Bharati ~72) "
            "instead of dropping to winter (25 and 47). Fuel-days are recomputed. "
            "This is the operational nightmare: too many people, polar night, "
            "no extraction."
        ),
        "why": (
            "DROMLAN is seasonal and weather-limited. Showing the occupancy "
            "mistake as a fuel crash is more powerful than a temperature RMSE. "
            "No extra dataset required."
        ),
        "example": (
            "Baseline winter Maitri: 25 people, summer wing closed, 180 fuel-days "
            "(illustrative, synthetic). Toggle MISSED LAST FLIGHT: 65 people, "
            "summer wing still warm, heating and gensets up. Fuel-days fall to "
            "e.g. ~70. Isolation countdown is already near 0. Both station 3D "
            "views go red. Ops brief: “Extract or close summer wing; do not "
            "winter this occupancy.”"
        ),
        "inputs": "Occupancy tables; fuel-days engine; isolation countdown.",
        "outputs": "New fuel-days; occupancy strip; alert state.",
    },
    {
        "n": 9,
        "title": "2018 lockout backtest",
        "what": (
            "The lockout rules are run on historical hourly wind around each of "
            "the nine IMD blizzard start times. The twin reports how many hours "
            "before the official IMD start the rule would have locked outdoor "
            "work. This is verification, not “99% AI accuracy.”"
        ),
        "why": (
            "Nine events are too few to train a deep network. A backtest against "
            "the published log is the scientifically honest use of ML/rules and "
            "impresses people who know the MAUSAM paper."
        ),
        "example": (
            "Event BLZ-2018-09: IMD start 5 Nov 2018 02:01 UTC, 24 h, 49 kn, "
            "lowest MSLP of the year. Hourly reanalysis shows gust crossing 23 kn "
            "at 23:00 UTC on 4 Nov. Backtest table: “Rule locked outdoor 3.0 hours "
            "before IMD start.” Event 8 May (short 3.5 h blow): maybe 0.5 h lead "
            "or a miss — shown honestly. Demo line: we do not hide misses."
        ),
        "inputs": "Nine IMD events; hourly Open-Meteo  (or 2018 if available) wind/gust; lockout thresholds.",
        "outputs": "Table: event, IMD start, rule-lock time, lead hours, hit/miss.",
    },
    {
        "n": 10,
        "title": "Polar night / polar day bar",
        "what": (
            "A year-scale bar (and 3D lighting) for sunlight. Bharati, 2017–18: "
            "63 days polar day (20 Nov–22 Jan) and 49 days polar night "
            "(28 May–16 Jul). Maitri inland is longer night. Solar yield is "
            "forced to zero in night; CHP-only. The clock position on the bar "
            "is always visible."
        ),
        "why": (
            "Energy and psychology of the station change when the sun does not "
            "rise. A forecast of “GHI tomorrow” during polar night is nonsense "
            "unless the UI shows night as a first-class state."
        ),
        "example": (
            "Clock 10 June: Bharati marker sits inside the 49-day night band. "
            "3D scene is dark; PV = 0 kWh; fuel-days use CHP-only; ISRO still "
            "runs on diesel/CHP. Clock 15 December: 24 h daylight, solar layer "
            "active (still not a claim of installed Indian PV unless tagged analog)."
        ),
        "inputs": "MAUSAM polar day/night dates; clock; solar series.",
        "outputs": "Year bar, 3D illumination, solar = 0 constraint on fuel model.",
    },
    {
        "n": 11,
        "title": "ISRO / HF from NOAA space-weather scales",
        "what": (
            "Bharati hosts ECIL X/S-band reception and C-band to NRSC Shadnagar — "
            "the high-bandwidth story. NOAA G/S/R scales, planetary Kp, and GOES "
            "X-ray flux are already in the dataset. Radio blackout (R-scale) and "
            "strong geomagnetic storms degrade HF science (CADI, riometer, GISTM) "
            "and can impair the downlink. The twin shows a banner on the radomes, "
            "not a space poster."
        ),
        "why": (
            "Almost no student team will connect space weather to station "
            "operations. AL/02 and AL/03 list the instruments. This is free "
            "differentiation from data you already ingested."
        ),
        "example": (
            "GOES X-ray indicates an R2 radio blackout. Bharati 3D: radomes amber "
            "“DOWNLINK DEGRADED”; Maitri CADI/GISTM pin “HF DISTURBED.” Outdoor "
            "lockouts unchanged (this is not a blizzard). Ops brief: delay "
            "HF ionosonde campaign; expect NRSC link retries. Source: NOAA SWPC, "
            "not a local magnetometer stream unless tagged otherwise."
        ),
        "inputs": "planetary_k_index, solar_xray_flux, noaa_space_weather_scales.",
        "outputs": "R/G/S level; Bharati ISRO banner; Maitri HF science banner.",
    },
]


def main():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = title.add_run("POLARIS")
    set_run(r, size=22, bold=True, color=NAVY)
    sub = doc.add_paragraph()
    r = sub.add_run(
        "Eleven decision modules plus how the system works"
    )
    set_run(r, size=16, bold=True, color=ACCENT)
    meta = doc.add_paragraph()
    r = meta.add_run(
        "Smart India Hackathon 2026  ·  Problem statement 26060  ·  "
        "Digital twin of Indian Antarctic stations Maitri and Bharati"
    )
    set_run(r, size=11, italic=True, color=MUTED)
    add_body(
        doc,
        "This note is the product specification for the team. The 3D station view "
        "and weather/sensor forecasts are the stage. The eleven modules below are "
        "what the twin actually does: they turn predictions into expedition decisions. "
        "Numbers used in examples are from NCPOR/IMD documents or are clearly marked "
        "illustrative/synthetic.",
        space_after=12,
    )

    add_heading_styled(doc, "1. What we are building in one paragraph", 1)
    add_body(
        doc,
        "Polaris is an expedition decision twin for both Indian Antarctic stations. "
        "The operator sets a clock (today, a forecast horizon, or a historical night). "
        "The engine reads weather and sensors, looks at Novo and Progress next door, "
        "applies lockout rules, estimates fuel-days, updates the shared Cape Town–"
        "Bharati–Maitri voyage, and paints that same state on a 3D map. The operator "
        "can delay the ship, miss the last flight, or switch Maitri to the planned "
        "Maitri-II plant. Every number is tagged with its source. The system does not "
        "claim a live write-back socket to NCPOR generators; it is a spatial digital "
        "shadow with what-if control, which matches polar bandwidth reality "
        "(Maitri voice allotment is minutes per month).",
    )

    add_heading_styled(doc, "2. The eleven modules", 1)
    add_body(
        doc,
        "Each module has the same structure: what it is, why it exists, a worked "
        "example, and inputs/outputs. Examples use published events where possible "
        "(especially Bharati 5 August 2018). Fuel figures in examples are labelled "
        "illustrative because live tank dips are not public.",
    )

    for m in MODULES:
        add_heading_styled(doc, f"2.{m['n']}  Module {m['n']}: {m['title']}", 2)
        add_label_block(doc, "What it is.", m["what"])
        add_label_block(doc, "Why it is in the twin.", m["why"])
        add_label_block(doc, "Worked example.", m["example"])
        add_label_block(doc, "Inputs.", m["inputs"])
        add_label_block(doc, "Outputs.", m["outputs"])

    add_heading_styled(doc, "3. Small extras in the same application (not separate products)", 1)
    add_body(
        doc,
        "These sit on the same state object: Maitri versus Maitri-II plant toggle "
        "(600–750 kVA, 600,000 L JET A1, summer wing off in winter); occupancy strip "
        "(Maitri 25 winter / ~65 summer, Bharati 47 / 72); clickable sensor pins from "
        "AL/03 and AL/02; delayed-link / blackout banner (last state plus forecast); "
        "indoor ±1 °C slider tagged as Casey Station analog; one-page ops brief export; "
        "public versus operations chrome; field go/no-go inside 100 km; Novo–Maitri "
        "crevasse ribbon; December 2022 UAV melt-pond week; Hindi and English labels; "
        "Maitri versus Novo versus POWER disagreement band on charts.",
    )

    add_heading_styled(doc, "4. How the system works", 1)
    add_heading_styled(doc, "4.1 Loop (always in this order)", 2)
    steps = [
        "Clock. The operator (or the replay button) sets UTC time. This selects season, polar day/night, and whose voyage window is open.",
        "Sense. Read T, wind, gust, pressure, humidity, solar, Kp/X-ray at that time for Maitri, Bharati, Novolazarevskaya, and Progress. Attach source tags.",
        "Neighbourhood. Compute ΔT/Δwind versus Novo and Progress. Apply AT17 and Progress skiway constraints. Apply GPR crevasse season on the Maitri ice margin.",
        "Locate. Walk the logistics graph: air, sea, heli. Heli is off unless the ship is nearby. Isolation countdown = days to last air and last sea.",
        "Decide. Lockout rules. Fuel-days from occupancy, ΔT, wind, polar night, plant spec. Space-weather R/G/S → ISRO/HF banners. Optional toggles: ship delay, missed last flight, Maitri-II, indoor setpoint.",
        "Show. One JSON-like state object drives 3D overlays, strips, and charts. The 3D view never has a private weather source.",
        "Explain. Ops brief export with tags. Backtest table if the clock is in 2017–18 blizzard season.",
    ]
    for i, s in enumerate(steps, 1):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.left_indent = Inches(0.2)
        r = p.add_run(f"Step {i}. ")
        set_run(r, bold=True, color=ACCENT)
        r2 = p.add_run(s)
        set_run(r2)

    add_heading_styled(doc, "4.2 What is not a live stream", 2)
    add_body(
        doc,
        "NPDC and IMD are polled or historical. Energy and tonight’s headcount are "
        "synthetic unless NCPOR later provides sockets. The twin may fill gaps during "
        "comms blackout with the last state plus the forecast (digital-twin literature "
        "for polar links). UI must say LINK DELAYED when that happens.",
    )

    add_heading_styled(doc, "4.3 One state object (both stations)", 2)
    add_body(
        doc,
        "Conceptual fields: clock; for each of Maitri and Bharati: weather, lockouts, "
        "fuel_days, occupancy, solar_zero, isro_or_hf; neighbourhood (novo, progress, "
        "airfield); voyage (air, sea, heli, delay_days, days_to_last_air, days_to_last_sea); "
        "toggles (missed_last_flight, maitri_ii, indoor_setpoint); provenance[] for every "
        "number on screen. If fuel-days drop, the tank overlay drops. If outdoor is "
        "locked, the building shows locked. Two screens, one state.",
    )

    add_heading_styled(doc, "5. End-to-end example (six-minute demo story)", 1)
    add_body(
        doc,
        "This is how the eleven modules fire together. Treat fuel-days in this story "
        "as illustrative.",
        italic=True,
    )

    story = [
        (
            "0:00 — Stage.",
            "Map shows Maitri (Schirmacher) and Bharati (Larsemann), 3,098 km apart, "
            "linked by one voyage line through Cape Town, Novo, and Progress. Polar-day "
            "bar shows we are in a summer clock first, then we will jump to winter.",
        ),
        (
            "0:40 — Sense and neighbourhood.",
            "Bharati T and wind from reanalysis; Progress strip shows similar coastal "
            "wind; ΔT small. Maitri versus Novo ΔT is 1–2 °C; AT17 landing constraint "
            "shown. Tags: reanalysis / proxy.",
        ),
        (
            "1:20 — Jump to 5 August 2018.",
            "Module 4. Bharati 80 kn blizzard (IMD). Polar night bar (module 10) is "
            "in the 49-day night: solar = 0. Lockouts (module 1): outdoor and heli red. "
            "Fuel-days (module 2) begin falling on CHP-only. Progress strip (module 6): "
            "feeder closed. ISRO/HF (module 11) may be quiet that night — only light "
            "up if Kp/X-ray say so; do not fake a flare.",
        ),
        (
            "2:20 — Backtest.",
            "Module 9 table: for this event and the other eight, lead time of the "
            "gust rule versus IMD start. One miss left visible.",
        ),
        (
            "3:00 — Delay the ship.",
            "Module 3 + 7. Even in a summer clock, +14 days closes sea remaining "
            "and pulls fuel-days down at both stations. Heli stays off. Judges see "
            "two stations move together.",
        ),
        (
            "4:00 — Missed last flight.",
            "Module 8. Occupancy frozen at 65 / 72. Isolation countdown hits 0 on "
            "air. Fuel-days crash. Both meshes red. Brief says extract or shut the "
            "summer wing (Maitri-II doctrine).",
        ),
        (
            "5:00 — Pedigree and brief.",
            "Module 5. Hover tags. Export one-page ops brief: lockouts, fuel-days, "
            "voyage ETAs, isolation days, ISRO/HF, every line sourced. That is the "
            "artefact NCPOR could imagine trialling.",
        ),
    ]
    for h, t in story:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(h + " ")
        set_run(r, bold=True, color=NAVY)
        r2 = p.add_run(t)
        set_run(r2)

    add_heading_styled(doc, "6. What we are not building", 1)
    add_body(
        doc,
        "Photoreal interiors and walking avatars; a chatbot; a deep neural net trained "
        "on nine blizzards; fake live NCPOR tank or generator sockets; RFID tracking of "
        "people; full digital twins of Casey, McMurdo, or Juan Carlos I (those papers "
        "are analogs only); invented Russian fuel or occupancy for Novo and Progress.",
    )

    add_heading_styled(doc, "7. Sources behind the examples", 1)
    add_body(
        doc,
        "NCPOR AL/03 Maitri and AL/02 Bharati planning advisories; Maitri-II global "
        "design competition brief (2024) for 600–750 kVA and 600,000 L JET A1; "
        "Thapliyal et al., MAUSAM 73(3) (2022) for Bharati 2017–18 climate and nine "
        "blizzards including 80 kn on 5 August 2018 and polar day/night lengths; "
        "43rd ISEA advertisement for voyage times, 3,098 km, and comms allotment; "
        "Kashkevich et al. (2025) GPR for Novo–Maitri ice and October–November "
        "crevasses; Priya and Venkatesh (2024) UAV melt-pond magnitudes; Menéndez-Blázquez "
        "(2026) Antarctic spatial digital twins; Farsangi (2026) polar delayed-link twins; "
        "Crossin et al. (2020) Casey LCA as analog only; NOAA SWPC scales already ingested "
        "in the Polaris dataset pack.",
    )

    footer = doc.add_paragraph()
    footer.paragraph_format.space_before = Pt(18)
    r = footer.add_run(
        "Polaris team  ·  Internal product specification  ·  Not an official NCPOR document. "
        "Synthetic energy figures must stay labelled in any public demo."
    )
    set_run(r, size=9, italic=True, color=MUTED)

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
