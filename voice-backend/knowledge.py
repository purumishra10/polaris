"""Station knowledge the ops agent can search. Live numbers stay in telemetry."""

from __future__ import annotations

from typing import Any

import rag

DIGEST = """
POLARIS is NCPOR's digital twin of India's two Antarctic stations (SIH 2026 PS 26060).
Telemetry is synthetic/modeled unless tagged historical. Never invent unpublished kVA or tank liters.

BHARATI (coastal, Larsemann Hills, North Grovnes): 69.40680 S, 76.19525 E, ~35 m elev, ~200 m from Quilty Bay.
Year-round since 18 Mar 2012. 134 ISO containers, aerodynamic skin, V-columns, 6 m overhang.
Envelope designed -40 C outside / +20 C inside. Site winds cited up to 270 km/h.
Occupancy: 47 in main building winter; +25 emergency/summer camp = 72 (AL/02).
Floors: L2 living, L1 labs/CHP/garage, L3 HVAC + science terrace.
Comms: ECIL X/S-band data reception + C-band to NRSC Shadnagar. Best live-telemetry story.
Vehicles (AL/02): 4 Pisten Bully, 2 snow scooters, 1 Tata Xenon-XT, 1 BE-71, 1 BD-50, 1 x 50 t Mantis.
Helicopters: ship-based only.
Climate 2017-18: max +9.9 C (5 Jan 2018), min -29.8 C (29 Aug 2018). 5 Aug 2018 gust ~80 kn is the replay event.

MAITRI (inland oasis, Schirmacher): 70.76683367 S, 11.73078318 E, ~117 m, 80-100 km inland.
Year-round since 1989, replacing Dakshin Gangotri. Past 25-year design life. Maitri-II planned.
Occupancy current: ~25 winter / 40-65 summer. Maitri-II planned 40 winter / 140 summer.
Nearby: Novolazarevskaya ~3.5 km, Novo DROMLAN airstrip.
Climate: annual mean -9.7 C, July extreme -44 C, mean wind 31.5 km/h, design/max 200 km/h SE katabatic.
Comms: satellite internet/phone only. Call allotment 6 min/month summer, 20 min/month winter.
Vehicles (AL/03): 14 Pisten Bully, 4 snow scooters, 1 Toyota arctic, 1 Tata Xenon-XT, 1 BD-50, 5 x 50 t Mantis, etc.

MAITRI-II (planned, synthetic energy anchor): 6 CHP units x 100-125 kVA = 600-750 kVA.
Fuel farm ~600,000 L JET A-1. Helipad sized for Kamov 32. Summer wing isolates in winter to save fuel.
Current Maitri generator kVA and fuel inventory are NOT published. Twin energy layer is labeled planned/synthetic.

SUBSYSTEMS in the 3D twin:
FUEL = JET A-1 farm. Live: tank_level_liters, burn_rate_lph, days_of_autonomy.
MICROGRID = CHP / power house. Live: total/essential/science/comfort load kVA, CHP capacity, aux generator.
STRUCTURE = station envelope. Live: internal temp, hatch lockdown, ambient.
ROOF = terrace / HVAC. Live: solar flux, wind.
COMMUNICATIONS = radome / C-band. Live: link type, latency_ms, health.
SAFETY = helipad / lockouts. Live: wind, hatch, outdoor/heli lockouts.
CONTAINERS = ISO village. Live: summer_wing_isolated, comfort load.
UTILITIES = pipes / aux heat. Live: aux_heater_kw, heat_loss_kw.
VEHICLES = ops fleet. Live: wind go/no-go.
WATER = melt pond / RO. Live: ambient/solar season.

SOP (twin-backend/sop.py):
- wind > 60 kt → CRITICAL, hatch lockdown + stow sensors
- internal temp < 16 C → CRITICAL, spin up aux generator
- fuel days < 15 → CRITICAL, shed science + isolate summer modules
- fuel days < 30 → ADVISORY, shed science + isolate summer wing
Isolation Forest flags outliers as ADVISORY if no SOP rule fired.

SCENARIOS: BLIZZARD_80KT, RESUPPLY_DELAY (drops tank toward starve), POLAR_NIGHT, NOMINAL/clear.
CONTROLS: science_instruments_online, summer_wing_isolated, hatch_lockdown, aux_generator_active.

CLOCK / REPLAY: The only historical snapshot wired in the UI is 5 August 2018 18:00 UTC at Bharati.
IMD MAUSAM 73(3) annual max gust 80 kn (Thapliyal). Modeled ambient -12 C. Occupancy 47 winter complement.
Outdoor/heli/convoy/field LOCKED. Severity CRITICAL. Polar night at Bharati had already ended 16 Jul 2018.
Fuel days and indoor heat remain modeled. Voice command "go to August 5" or "show Aug 5th data" must fire replay_2018, not the live BLIZZARD_80KT injector.
Live now / present returns to synthetic realtime.
Stations are ~3098 km apart. Different climate and logistics regimes.
""".strip()

rag.add_document(DIGEST.replace("\n\n", "\n"), "ops-digest", "Polaris ops digest")

# One headline fact per card so BM25 can pin short spoken questions to the
# exact number. Every value is restated from DIGEST / the knowledge base.
FACT_CARDS: list[tuple[str, str, str]] = [
    ("Bharati containers and structure", "AL/02 · IStructE",
     "Bharati is built from 134 ISO 20-foot shipping containers that form both structure and rooms, "
     "wrapped in an aerodynamic insulated skin on V-columns with a 6 m overhang."),
    ("When Bharati opened", "NCPOR · AL/02",
     "Bharati has operated year-round since 18 March 2012. It was commissioned in 2012 in the Larsemann Hills."),
    ("When Maitri opened", "NCPOR · AL/03",
     "Maitri has operated year-round since 1989, replacing Dakshin Gangotri. It is past its 25-year design life; Maitri-II is planned."),
    ("Bharati occupancy crew people", "AL/02",
     "Bharati holds 47 people in the main building in winter; with 25 more in the emergency and summer camp the peak is 72."),
    ("Maitri occupancy crew people", "AL/03",
     "Maitri holds about 25 people in winter and 40 to 65 in summer. Maitri-II is planned for 40 winter and 140 summer."),
    ("Distance between Bharati and Maitri", "43-ISEA",
     "Bharati and Maitri are about 3098 km (1693 nautical miles) apart, in different climate and logistics regimes."),
    ("Bharati location coordinates", "AL/02",
     "Bharati is at 69.4068 S, 76.1953 E, about 35 m elevation on North Grovnes in the Larsemann Hills, about 200 m from Quilty Bay."),
    ("Maitri location coordinates", "AL/03",
     "Maitri is at 70.7668 S, 11.7308 E, about 117 m elevation in the Schirmacher Oasis, 80 to 100 km inland. Novolazarevskaya is 3.5 km away."),
    ("Bharati climate extremes coldest hottest temperature gust", "IMD MAUSAM 73(3)",
     "At Bharati the 2017-18 maximum was +9.9 C on 5 Jan 2018 and the minimum -29.8 C on 29 Aug 2018. The peak gust was about 80 knots on 5 Aug 2018."),
    ("Maitri climate temperature wind design", "Maitri-II brief",
     "Maitri's annual mean is -9.7 C with a July extreme of -44 C. Mean wind is 31.5 km/h; the design maximum is 200 km/h from the SE katabatic."),
    ("Bharati design wind envelope", "AL/02 · IStructE",
     "Bharati's envelope is designed for -40 C outside and +20 C inside; site winds are cited up to 270 km/h."),
    ("Maitri-II power plant capacity generators", "Maitri-II brief",
     "Maitri-II plans 6 CHP units of 100 to 125 kVA each, 600 to 750 kVA in total. The summer wing isolates in winter to save fuel."),
    ("Maitri-II fuel farm storage", "Maitri-II brief",
     "Maitri-II plans a fuel farm of about 600,000 liters of JET A-1 and a helipad sized for the Kamov 32."),
    ("Maitri current generator and fuel", "NCPOR",
     "The current Maitri generator kVA and tank inventory are not published; the twin labels that energy layer as synthetic."),
    ("Bharati vehicles fleet", "AL/02",
     "Bharati vehicles: 4 Pisten Bully, 2 snow scooters, 1 Tata Xenon-XT, 1 BE-71, 1 BD-50 and one 50 t Mantis crane. Helicopters are ship-based only."),
    ("Maitri vehicles fleet", "AL/03",
     "Maitri vehicles: 14 Pisten Bully, 4 snow scooters, 1 Toyota arctic truck, 1 Tata Xenon-XT, 1 BD-50 and 5 Mantis cranes of 50 t."),
    ("Bharati communications", "AL/02",
     "Bharati has ECIL X/S-band data reception and a C-band link to NRSC Shadnagar."),
    ("Maitri communications", "AL/03",
     "Maitri has satellite internet and phone only; the personal call allotment is 6 minutes a month in summer and 20 in winter."),
    ("Wind lockout limits outdoor helicopter convoy", "twin-backend lockouts.py",
     "Wind lockouts: outdoor work locks above 23 knots, helicopter ops lock above 40 knots, and convoys lock above 50 knots. "
     "Heli is also locked whenever the ship is away, because the Kamov is ship-based."),
    ("SOP thresholds critical advisory rules", "twin-backend sop.py",
     "Wind over 60 knots is CRITICAL (hatch lockdown, stow sensors). Habitat under 16 C is CRITICAL (aux generator). "
     "Fuel under 15 days is CRITICAL and under 30 days is ADVISORY (shed science, isolate summer wing). Outdoor lockout is 23 knots, heli 40, convoy 50."),
    ("Nowcast models LSTM random forest", "twin-backend nowcast.py",
     "The 6-hour nowcast blends a Random Forest (65 percent) with an LSTM (35 percent) for the chance of a 23-knot lockout. "
     "WATCH starts at 45 percent and IMMINENT at 70 percent or a 32-knot gust."),
]

for _title, _src, _text in FACT_CARDS:
    rag.add_document(_text, f"fact-card:{_src}", _title)


def retrieve(query: str, limit: int = 5) -> dict[str, Any]:
    packed = rag.retrieve(query, limit=limit)
    hits = packed.get("hits") or []
    if not hits:
        hits = [
            {
                "heading": "Polaris ops digest",
                "content": DIGEST[:900],
                "source": "ops-digest",
                "score": 1,
            }
        ]
    packed["hits"] = hits[:limit]
    return packed


def search(query: str, limit: int = 4) -> str:
    packed = retrieve(query, limit=limit)
    context = rag.format_context(packed.get("hits") or [], limit_chars=3800)
    if context:
        return context
    return DIGEST[:1800]
