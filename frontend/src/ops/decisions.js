/** Ops decision layer. Provenance is labeled; nothing here moves the 3D scene. */

export const SOP = {
  WIND_STRUCTURAL_KT: 60,
  FUEL_CRITICAL_DAYS: 15,
  FUEL_ADVISORY_DAYS: 30,
  INTERNAL_TEMP_COLLAPSE_C: 16,
  HATCH: 'ACTION: Engage exterior hatch structural airlock sequence.',
  STOW_SENSORS: 'ACTION: Stow external weather sensors & abort outdoor sorties.',
  AUX_GEN: 'ACTION: Spin up Standby Auxiliary Generator.',
  SHED_SCIENCE: 'ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde).',
  ISOLATE_DEPRESSURIZE: 'ACTION: Isolate and depressurize unoccupied summer modules.',
  ISOLATE_SUMMER: 'ACTION: Isolate unoccupied summer residential modules.',
}

export const NODES = {
  CPT: { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  NOVO_AIR: { name: 'Novo AT17', lat: -70.82, lon: 11.63 },
  PROG_AIR: { name: 'Progress skiway', lat: -69.38, lon: 76.38 },
  INDIA_BAY: { name: 'India Bay', lat: -69.98, lon: 11.9 },
  QUILTY_BAY: { name: 'Quilty Bay', lat: -69.41, lon: 76.19 },
  MAITRI: { name: 'Maitri', lat: -70.7668, lon: 11.7308 },
  BHARATI: { name: 'Bharati', lat: -69.4068, lon: 76.1953 },
}

export const ROUTES = [
  { id: 'LEG_AIR_01', from: 'CPT', to: 'NOVO_AIR', mode: 'AIR', hours: 5.75, window: 'Late Oct–mid Feb', constraint: 'Blue ice, surface < −5 °C' },
  { id: 'LEG_AIR_02', from: 'NOVO_AIR', to: 'PROG_AIR', mode: 'AIR', hours: 9.5, window: 'Mid-Nov–late Jan', constraint: 'No direct CT–Bharati flight' },
  { id: 'LEG_SEA_01', from: 'CPT', to: 'QUILTY_BAY', mode: 'SEA', days: [10, 16], window: 'Dec–Feb', constraint: 'Prydz Bay ice ≤ 6/10' },
  { id: 'LEG_SEA_02', from: 'QUILTY_BAY', to: 'INDIA_BAY', mode: 'SEA', days: [5, 7], window: 'Jan–early Mar', constraint: 'Fast-ice at Lazarev' },
  { id: 'LEG_SEA_03', from: 'INDIA_BAY', to: 'CPT', mode: 'SEA', days: [8, 12], window: 'Late Feb–mid Mar', constraint: '15 Mar hard exit' },
  { id: 'LEG_LAND_01', from: 'INDIA_BAY', to: 'MAITRI', mode: 'CONVOY', hours: 12, window: 'Summer ops', constraint: 'Crevasse hinge zone' },
  { id: 'LEG_LAND_02', from: 'QUILTY_BAY', to: 'BHARATI', mode: 'SHORE', hours: 1.5, window: 'When ship in bay', constraint: 'Swell / fast ice' },
]

export const POLAR_EVENTS = {
  BHARATI: [
    { type: 'POLAR_DAY', start: { m: 11, d: 20 }, end: { m: 1, d: 22 }, days: 63, source: 'IMD MAUSAM 2017–18' },
    { type: 'POLAR_NIGHT', start: { m: 5, d: 28 }, end: { m: 7, d: 16 }, days: 49, source: 'IMD MAUSAM 2017–18' },
  ],
  MAITRI: [
    { type: 'POLAR_DAY', start: { m: 11, d: 1 }, end: { m: 2, d: 15 }, days: 90, source: 'Maitri-II brief (inland oasis)' },
    { type: 'POLAR_NIGHT', start: { m: 5, d: 15 }, end: { m: 7, d: 31 }, days: 77, source: 'Maitri-II brief (longer than coastal)' },
  ],
}

export const ACCESS_WINDOWS = {
  BHARATI: [
    { id: 'AIR', label: 'Progress feeder', open: { m: 11, d: 15 }, close: { m: 1, d: 31 }, source: '43-ISEA / AL/02' },
    { id: 'SEA', label: 'Quilty Bay ship', open: { m: 12, d: 1 }, close: { m: 2, d: 28 }, source: 'AL/02 10–16 d CT' },
  ],
  MAITRI: [
    { id: 'AIR', label: 'DROMLAN IL-76', open: { m: 10, d: 25 }, close: { m: 2, d: 14 }, source: '43-ISEA' },
    { id: 'SEA', label: 'India Bay ship', open: { m: 1, d: 7 }, close: { m: 3, d: 15 }, source: '43-ISEA 15 Mar hard exit' },
  ],
}

export const INSTRUMENTS = {
  MAITRI: [
    { id: 'MARA', name: 'MARA VHF 54.5 MHz', owner: 'NCPOR', kind: 'SCIENCE' },
    { id: 'CADI', name: 'CADI ionosonde', owner: 'NPL', kind: 'SCIENCE' },
    { id: 'GISTM', name: 'GSV-4004B GISTM', owner: 'NPL', kind: 'SCIENCE' },
    { id: 'MAG', name: 'DFM/PPM/ICM mag', owner: 'IIG', kind: 'SCIENCE' },
    { id: 'RIO', name: 'Imaging riometer', owner: 'IIG', kind: 'SCIENCE' },
    { id: 'FIELD', name: 'Long-wire + field mill', owner: 'IIG', kind: 'OUTDOOR' },
    { id: 'AWS', name: 'IMD Sankalp AWS', owner: 'IMD', kind: 'OUTDOOR' },
    { id: 'OZONE', name: 'Ozonesonde balloons', owner: 'IMD', kind: 'OUTDOOR' },
    { id: 'SEISMO', name: 'Seismograph pad', owner: 'NGRI', kind: 'PAD' },
    { id: 'GPS', name: 'GPS + met pack', owner: 'NGRI', kind: 'PAD' },
    { id: 'NOX', name: 'NOx analyser', owner: 'NCPOR', kind: 'SCIENCE' },
    { id: 'AERO', name: 'Aerosol spectrometer', owner: 'NCPOR', kind: 'SCIENCE' },
    { id: 'BC', name: 'Aethalometer BC', owner: 'NCPOR', kind: 'SCIENCE' },
  ],
  BHARATI: [
    { id: 'ECIL', name: 'ECIL X/S + C-band', owner: 'ISRO/ECIL', kind: 'COMMS' },
    { id: 'MAG', name: 'DFM + PPM mag', owner: 'IIG', kind: 'SCIENCE' },
    { id: 'FIELD', name: 'Long-wire + field mill', owner: 'IIG', kind: 'OUTDOOR' },
    { id: 'GISTM', name: 'GSV-4004B GISTM', owner: 'NPL', kind: 'SCIENCE' },
    { id: 'AWS', name: 'IMD observatory + ozone', owner: 'IMD', kind: 'OUTDOOR' },
  ],
}

export const MELT_POND = [
  { date: '2022-12-18', area: 9151, volume: 2279, status: 'Early pooling' },
  { date: '2022-12-21', area: 15420, volume: 11200, status: 'Rapid expansion' },
  { date: '2022-12-24', area: 24727, volume: 29272, status: 'Peak surge' },
  { date: '2022-12-28', area: 18300, volume: 16400, status: 'Drainage' },
  { date: '2022-12-31', area: 11050, volume: 4500, status: 'Refreeze' },
]

function mdToDay(m, d) {
  return m * 31 + d
}

export function opsDate(telemetry) {
  const iso = telemetry?.replay?.clock
  const date = iso ? new Date(iso) : new Date()
  if (Number.isNaN(date.getTime())) return new Date()
  return date
}

export function inMdRange(date, start, end) {
  const t = mdToDay(date.getUTCMonth() + 1, date.getUTCDate())
  const a = mdToDay(start.m, start.d)
  const b = mdToDay(end.m, end.d)
  if (a <= b) return t >= a && t <= b
  return t >= a || t <= b
}

export function polarState(station, date) {
  const events = POLAR_EVENTS[station] ?? POLAR_EVENTS.BHARATI
  const night = events.find((event) => event.type === 'POLAR_NIGHT')
  const day = events.find((event) => event.type === 'POLAR_DAY')
  if (night && inMdRange(date, night.start, night.end)) {
    return { phase: 'NIGHT', event: night }
  }
  if (day && inMdRange(date, day.start, day.end)) {
    return { phase: 'DAY', event: day }
  }
  return { phase: 'TWILIGHT', event: null }
}

export function windowStatus(station, date) {
  const access = (ACCESS_WINDOWS[station] ?? []).map((window) => ({
    ...window,
    openNow: inMdRange(date, window.open, window.close),
  }))
  access.push({
    id: 'HELI',
    label: station === 'BHARATI' ? 'Quilty Bay helo' : 'India Bay helo',
    openNow: shipNearby(station, date),
    source: 'heli OPEN only while modeled ship is in the bay',
  })
  return access
}

export function daysUntilWindowClose(station, date, mode = 'SEA') {
  const window = (ACCESS_WINDOWS[station] ?? []).find((item) => item.id === mode)
  if (!window) return null
  const year = date.getUTCFullYear()
  let close = Date.UTC(year, window.close.m - 1, window.close.d)
  const now = Date.UTC(year, date.getUTCMonth(), date.getUTCDate())
  const open = Date.UTC(year, window.open.m - 1, window.open.d)
  const wraps = window.open.m > window.close.m
  if (wraps) {
    if (date.getUTCMonth() + 1 >= window.open.m) {
      close = Date.UTC(year + 1, window.close.m - 1, window.close.d)
    }
  } else if (now > close) {
    close = Date.UTC(year + 1, window.close.m - 1, window.close.d)
  }
  const days = Math.round((close - now) / 86400000)
  const currentlyOpen = wraps
    ? date.getUTCMonth() + 1 >= window.open.m || date.getUTCMonth() + 1 <= window.close.m
    : now >= open && now <= close
  return {
    ...window,
    days,
    open: currentlyOpen,
  }
}

export function fuelDecision(telemetry, station, date) {
  const days = Number(telemetry?.fuel?.days_of_autonomy ?? 0)
  const sea = daysUntilWindowClose(station, date, 'SEA')
  const air = daysUntilWindowClose(station, date, 'AIR')
  let band = 'NOMINAL'
  if (days < SOP.FUEL_CRITICAL_DAYS) band = 'CRITICAL'
  else if (days < SOP.FUEL_ADVISORY_DAYS) band = 'ADVISORY'
  const next = [sea, air]
    .filter((item) => item && item.open)
    .sort((a, b) => a.days - b.days)[0] ?? sea
  const starve =
    next && next.open && days < next.days && days < SOP.FUEL_ADVISORY_DAYS
  return {
    days,
    band,
    sea,
    air,
    next,
    starve: Boolean(starve),
    source: 'SOP floors 30/15 d · windows AL/02 + 43-ISEA',
  }
}

export function shipNearby(station, date) {
  const month = date.getUTCMonth() + 1
  if (station === 'BHARATI') return month === 1 || month === 2
  if (station === 'MAITRI') return month === 2 || month === 3
  return false
}

export function shipTrack(date) {
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const season = month >= 11 || month <= 3
  if (!season) {
    return { ...NODES.CPT, leg: 'WINTER LAYUP', nearby: 'NONE', source: 'modeled from AL/02 voyage' }
  }
  const legs = [
    { at: 11, d: 1, node: 'CPT', name: 'Cape Town' },
    { at: 12, d: 15, node: 'QUILTY_BAY', name: 'Quilty Bay / Bharati' },
    { at: 1, d: 20, node: 'QUILTY_BAY', name: 'Quilty Bay (on station)' },
    { at: 2, d: 10, node: 'INDIA_BAY', name: 'India Bay / Maitri' },
    { at: 3, d: 1, node: 'INDIA_BAY', name: 'India Bay (loading)' },
    { at: 3, d: 15, node: 'CPT', name: 'Homeward / 15 Mar exit' },
  ]
  const stamp = month * 100 + day
  const points = legs.map((leg) => ({ ...leg, stamp: leg.at * 100 + leg.d }))
  let from = points[0]
  let to = points[1]
  for (let i = 0; i < points.length - 1; i += 1) {
    if (stamp >= points[i].stamp || (points[i].at >= 11 && month >= 11)) {
      from = points[i]
      to = points[i + 1]
    }
  }
  if (month <= 3) {
    for (let i = 0; i < points.length - 1; i += 1) {
      if (points[i].at <= 3 && stamp >= points[i].stamp) {
        from = points[i]
        to = points[i + 1]
      }
    }
  }
  const a = NODES[from.node]
  const b = NODES[to.node]
  const span = Math.max(1, to.stamp - from.stamp)
  const t = Math.min(1, Math.max(0, (stamp - from.stamp) / span))
  const nearby =
    from.node === 'QUILTY_BAY' || to.node === 'QUILTY_BAY' && t < 0.5
      ? 'BHARATI'
      : from.node === 'INDIA_BAY' || to.node === 'INDIA_BAY'
        ? 'MAITRI'
        : 'NONE'
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    leg: `${from.name} → ${to.name}`,
    nearby,
    source: 'modeled Cape Town → Bharati → Maitri → Cape Town',
  }
}

export function instrumentStatus(instrument, telemetry, polar) {
  const actions = telemetry?.risk?.prescribed_actions ?? []
  const outdoor = telemetry?.lockouts?.outdoor === 'LOCKED'
  const heli = telemetry?.lockouts?.heli === 'LOCKED'
  const science = telemetry?.controls?.science_instruments_online !== false
  const wind = telemetry?.ambient?.wind_speed_knots ?? 0
  const stow = actions.includes(SOP.STOW_SENSORS) || wind > SOP.WIND_STRUCTURAL_KT || outdoor
  const shed = actions.includes(SOP.SHED_SCIENCE) || !science
  const commsDown = telemetry?.link_status?.health === 'DEGRADED' || telemetry?.link_status?.health === 'OFFLINE'

  if (instrument.kind === 'OUTDOOR' && stow) {
    return { ok: false, reason: 'Stowed / outdoor lockout' }
  }
  if (instrument.kind === 'SCIENCE' && shed) {
    return { ok: false, reason: 'Science shed (SOP fuel)' }
  }
  if (instrument.kind === 'COMMS' && commsDown) {
    return { ok: false, reason: 'Uplink degraded' }
  }
  if (instrument.id === 'OZONE' && heli) {
    return { ok: false, reason: 'Balloon ops locked with heli' }
  }
  if (polar.phase === 'NIGHT' && (instrument.id === 'AWS' || instrument.id === 'ECIL')) {
    return { ok: true, reason: 'Night — solar/UV yield 0, instrument up' }
  }
  return { ok: true, reason: 'GO' }
}

export function meltFrame(date) {
  const key = date.toISOString().slice(5, 10)
  if (date.getUTCMonth() !== 11) {
    return { ...MELT_POND[0], active: false, source: 'UAV 2022–23 · Dec only' }
  }
  let chosen = MELT_POND[0]
  for (const frame of MELT_POND) {
    if (frame.date.slice(5) <= key) chosen = frame
  }
  return { ...chosen, active: true, source: 'UAV 42nd/43rd ISEA, 8.5 cm DEM' }
}

export function iceOpen(date, basin) {
  const month = date.getUTCMonth() + 1
  if (basin === 'PRYDZ') return month === 12 || month <= 2
  if (basin === 'LAZAREV') return month >= 1 && month <= 3
  return month <= 2 || month === 12
}

export function criticalSignature(telemetry) {
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'
  if (severity !== 'CRITICAL') return null
  const actions = (telemetry?.risk?.prescribed_actions ?? []).join('|')
  return `${telemetry?.station_id ?? ''}:${actions || 'CRITICAL'}`
}

export function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}
