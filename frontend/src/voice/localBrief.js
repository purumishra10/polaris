import { fuelDecision, opsDate, polarState } from '../ops/decisions'
import { assetFault } from '../ops/assetHealth'

function n(value, digits = 0) {
  const next = Number(value)
  if (!Number.isFinite(next)) return 'unknown'
  return next.toFixed(digits)
}

export function localVoiceTurn(text, store) {
  const raw = String(text || '').trim()
  const lower = raw.toLowerCase()
  const station = store.selectedStation
  const telemetry = store.telemetry[station]
  const date = opsDate(telemetry)
  const polar = polarState(station, date)
  const fuel = fuelDecision(telemetry, station, date, store.voyageDelayDays)
  const actions = []

  const say = (reply, extra = []) => ({
    reply,
    actions: [...actions, ...extra],
    rag: 'local-fallback',
    sources: [
      {
        heading: 'On-desk brief (LLM off)',
        source: 'Polaris local SOP · no voice-backend',
      },
    ],
  })

  if (/blizzard|80\s*kn|storm/.test(lower)) {
    return say(
      `${station} blizzard inject. Wind goes to 80 knots. Outdoor and heli lock. STRUCTURE, ROOF and SAFETY should light red with the SOP reason.`,
      [
        { type: 'inject_scenario', scenario: 'BLIZZARD_80KT' },
        { type: 'set_hud_tab', tab: 'live' },
      ],
    )
  }
  if (/resupply|fuel starve|delay ship|ship delay|\+14/.test(lower)) {
    const days = /14/.test(lower) ? 14 : store.voyageDelayDays || 14
    return say(
      `Voyage plus ${days} days. One ship. Bharati delay is a Maitri problem. Fuel is ${n(fuel.days, 0)} days. ${fuel.missWindow ? 'That delay misses the sea window.' : 'Heli only while the ship is in the bay.'}`,
      [
        { type: 'set_voyage_delay', days },
        { type: 'set_hud_tab', tab: 'map' },
      ],
    )
  }
  if (/maitri.?ii|maitri 2|summer wing|planned plant/.test(lower)) {
    return say(
      'Maitri-II doctrine: 600 to 750 kVA, 600 kilolitres Jet A-1, summer wing shuts in winter. Same weather, different burn. Numbers are planned and synthetic from the 25 July 2024 brief.',
      [{ type: 'set_plant_mode', mode: 'MAITRI_II' }],
    )
  }
  if (/aug(ust)?\s*5|fifth of aug|2018|80 kn gust/.test(lower)) {
    return say(
      'Fifth of August 2018. IMD annual max gust 80 knots at Bharati. Not a Table 2 blizzard. Outdoor lock is the 23-knot blowing-snow rule, not a neural net.',
      [{ type: 'replay_2018' }],
    )
  }
  if (/sitrep|export|pdf/.test(lower)) {
    return say('Exporting the station sitrep PDF with source tags.', [
      { type: 'export_sitrep' },
    ])
  }
  if (/map|voyage|ship/.test(lower)) {
    return say(
      `Map desk. Polar ${polar.phase}. Ship delay ${store.voyageDelayDays} days. This heli ${fuel.thisHeli ? 'open' : 'locked'}.`,
      [{ type: 'set_hud_tab', tab: 'map' }],
    )
  }
  if (/fuel|autonomy|tank|jet/.test(lower)) {
    return say(
      `${station} fuel ${n(telemetry?.fuel?.tank_level_liters, 0)} litres, burn ${n(telemetry?.fuel?.burn_rate_lph, 0)} litres an hour, ${n(fuel.days, 0)} days autonomy, SOP ${fuel.band}. Source ${telemetry?.plant?.tag ?? telemetry?.source ?? 'synthetic'}.`,
      [
        { type: 'select_subsystem', subsystem: 'FUEL' },
        { type: 'set_hud_tab', tab: 'live' },
      ],
    )
  }
  if (/weather|wind|temp|ambient/.test(lower)) {
    return say(
      `${station} ambient ${n(telemetry?.ambient?.temp_c, 1)} C, wind ${n(telemetry?.ambient?.wind_speed_knots, 0)} knots, solar ${n(telemetry?.ambient?.solar_flux_w_m2, 0)} watts per square metre. Polar ${polar.phase}.`,
      [{ type: 'set_hud_tab', tab: 'climate' }],
    )
  }
  if (/why|broken|lock|outdoor|red/.test(lower)) {
    const ids = ['STRUCTURE', 'SAFETY', 'FUEL', 'ROOF', 'MICROGRID', 'COMMUNICATIONS']
    const hit = ids
      .map((id) => ({ id, fault: assetFault(id, telemetry) }))
      .find((item) => item.fault)
    if (hit) {
      return say(
        `${hit.id} is ${hit.fault.title}. ${hit.fault.reason}`,
        [{ type: 'select_subsystem', subsystem: hit.id }],
      )
    }
    return say(`${station} has no asset lock on the SOP board right now. Severity ${telemetry?.risk?.severity ?? 'NOMINAL'}.`)
  }

  return say(
    `${station} is ${telemetry?.risk?.severity ?? 'NOMINAL'}. Wind ${n(telemetry?.ambient?.wind_speed_knots, 0)} knots. Fuel ${n(fuel.days, 0)} days. Polar ${polar.phase}. Voice sidecar is down — this is the on-desk brief from live store numbers. Ask fuel, blizzard, Maitri-II, or fifth of August.`,
  )
}
