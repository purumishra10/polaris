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
