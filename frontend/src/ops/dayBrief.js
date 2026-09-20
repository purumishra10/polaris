/** Known historical clocks + crisp day brief for the twin clock control. */

import {
  polarState,
  windowStatus,
  voyageState,
  voyageClock,
  SOP,
} from '../ops/decisions'

/** IMD MAUSAM 73(3) Table 2 + annual max — same as edge clock catalog. */
export const DAY_PRESETS = [
  {
    clock: '2018-08-05T18:00:00+00:00',
    label: '5 AUG 2018',
    hint: '80 kn annual max gust',
    kind: 'SPECIAL',
  },
  {
    clock: '2017-12-16T19:36:00+00:00',
    label: '16 DEC 2017',
    hint: 'BLZ-2017-01 · 73 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-05-08T16:30:00+00:00',
    label: '8 MAY 2018',
    hint: 'BLZ-2018-02 · 47 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-05-23T20:15:00+00:00',
    label: '23 MAY 2018',
    hint: 'BLZ-2018-03 · 48 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-06-05T02:30:00+00:00',
    label: '5 JUN 2018',
    hint: 'BLZ-2018-04 · 50 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-07-21T11:30:00+00:00',
    label: '21 JUL 2018',
    hint: 'BLZ-2018-05 · 52 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-08-09T09:50:00+00:00',
    label: '9 AUG 2018',
    hint: 'BLZ-2018-06 · 57 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-08-27T13:45:00+00:00',
    label: '27 AUG 2018',
    hint: 'BLZ-2018-07 · 46 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-08-30T18:15:00+00:00',
    label: '30 AUG 2018',
    hint: 'BLZ-2018-08 · 63 kn',
    kind: 'BLIZZARD',
  },
  {
    clock: '2018-11-05T02:01:00+00:00',
    label: '5 NOV 2018',
    hint: 'BLZ-2018-09 · 49 kn · 24 h',
    kind: 'BLIZZARD',
  },
]

function factMap(facts) {
  const out = {}
  for (const row of facts || []) {
    if (row?.label) out[row.label] = row
  }
  return out
}

/**
 * Crisp whole-day card. Prefers replay.facts from the edge clock;
 * otherwise builds from calendar + live ambient.
 */
export function buildDayBrief(telemetry, station = 'BHARATI', delayDays = 0) {
  const replay = telemetry?.replay
  const active = Boolean(replay?.active)
  const clockIso = replay?.clock || new Date().toISOString()
  const date = new Date(clockIso)
  const valid = !Number.isNaN(date.getTime())
  const day = valid ? date : new Date()
  const polar = polarState(station, day)
  const windows = windowStatus(station, day)
  const ship = voyageState(voyageClock(day, delayDays))
  const facts = factMap(replay?.facts)
  const wind = Number(telemetry?.ambient?.wind_speed_knots)
  const temp = Number(telemetry?.ambient?.temp_c)
  const outdoor = telemetry?.lockouts?.outdoor
  const heli = telemetry?.lockouts?.heli
  const heliOpen = windows.find((w) => w.id === 'HELI')?.openNow
  const forecast = telemetry?.forecast || {}
  const wx = String(forecast.status || '')
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'

  const lines = [
    {
      k: 'MODE',
      v: active ? 'HISTORICAL CLOCK' : 'LIVE NOW',
      tag: active ? replay?.source_type || 'CALENDAR' : telemetry?.source || 'OPEN_METEO',
    },
    {
      k: 'DATE',
      v: day.toISOString().slice(0, 10),
      tag: day.toUTCString().slice(0, 16),
    },
    {
      k: 'WIND',
      v: facts.WIND?.value || (Number.isFinite(wind) ? `${wind.toFixed(0)} kn` : '—'),
      tag: facts.WIND?.tag || replay?.wind_tag || 'live / hold',
    },
    {
      k: 'TEMP',
      v: facts.TEMP?.value || (Number.isFinite(temp) ? `${temp.toFixed(1)} °C` : '—'),
      tag: facts.TEMP?.tag || replay?.temp_tag || 'live / hold',
    },
    {
      k: 'POLAR',
      v: facts.POLAR?.value || polar.phase,
      tag: facts.POLAR?.tag || polar.event?.source || 'IMD / Maitri-II',
    },
    {
      k: 'SEA / AIR',
      v: (() => {
        const seaOpen = facts.SEA?.value
          ? facts.SEA.value === 'OPEN'
          : Boolean(windows.find((w) => w.id === 'SEA')?.openNow)
        const airOpen = facts.AIR?.value
          ? facts.AIR.value === 'OPEN'
          : Boolean(windows.find((w) => w.id === 'AIR')?.openNow)
        return `${seaOpen ? 'SEA OPEN' : 'SEA SHUT'} · ${airOpen ? 'AIR OPEN' : 'AIR SHUT'}`
      })(),
      tag: 'AL/02 · 43-ISEA',
    },
    {
      k: 'SHIP',
      v: ship.atBharati || ship.atMaitri ? `IN BAY · ${ship.nearby}` : ship.label || ship.leg,
      tag: ship.phase?.replace(/_/g, ' ') || 'voyage',
    },
    {
      k: 'LOCKOUTS',
      v: `OUT ${outdoor || '—'} · HELI ${heli || '—'}`,
      tag: heliOpen
        ? `SOP outdoor ${SOP.WIND_OUTDOOR_KT} / heli ${SOP.WIND_HELI_KT}`
        : 'heli OPEN only while modeled ship is in the bay',
    },
    {
      k: 'HAZARD',
      v: facts.HAZARD?.value
        || (wx === 'WATCH' || wx === 'IMMINENT'
          ? `6H NOWCAST ${wx}`
          : severity === 'NOMINAL'
            ? 'None catalogued'
            : severity),
      tag: facts.HAZARD?.tag
        || (wx === 'WATCH' || wx === 'IMMINENT'
          ? `P(≥23 kt) ${forecast.p_lockout_23 != null ? Math.round(Number(forecast.p_lockout_23) * 100) : '—'}% · not fuel SOP`
          : replay?.scenario_id || 'risk'),
    },
  ]

  const headline = active
    ? replay?.note || replay?.citation || 'Historical day hold'
    : 'Live Open-Meteo + modeled plant. Pick a date to freeze the expedition clock.'

  const actions = telemetry?.risk?.prescribed_actions || []

  return {
    active,
    clockIso: day.toISOString(),
    dateLabel: day.toISOString().slice(0, 10),
    headline,
    citation: replay?.citation || null,
    lines,
    actions: actions.slice(0, 3),
    severity,
  }
}

export function dateToClockIso(dateStr) {
  if (!dateStr) return null
  // noon UTC so the day is unambiguous for blizzard matching
  return `${dateStr}T12:00:00+00:00`
}
