/** Ops decision layer. Provenance is labeled; nothing here moves the 3D scene. */

export const SOP = {
  WIND_OUTDOOR_KT: 23,
  WIND_HELI_KT: 40,
  WIND_CONVOY_KT: 50,
  WIND_STRUCTURAL_KT: 60,
  FUEL_CRITICAL_DAYS: 15,
  FUEL_ADVISORY_DAYS: 30,
  INTERNAL_TEMP_COLLAPSE_C: 16,
  HELI_BAY_KM: 80,
  HATCH: 'ACTION: Engage exterior hatch structural airlock sequence.',
  STOW_SENSORS: 'ACTION: Stow external weather sensors & abort outdoor sorties.',
  AUX_GEN: 'ACTION: Spin up Standby Auxiliary Generator.',
  SHED_SCIENCE: 'ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde).',
  ISOLATE_DEPRESSURIZE: 'ACTION: Isolate and depressurize unoccupied summer modules.',
  ISOLATE_SUMMER: 'ACTION: Isolate unoccupied summer residential modules.',
  DELAY_WATCH: 'ACTION: Re-score fuel vs delayed ship ETA; freeze non-vital load.',
  MISS_SEA: 'ACTION: Missed sea call — no bulk JET A-1 until the next seasonal window.',
  STARVE: 'ACTION: Fuel empties before the ship — shed science, isolate summer, essential-only plant.',
  HELI_LOCK: 'ACTION: Ship-based heli locked until the vessel is inside 80 km of the bay.',
}

/** Canonical rules. If an asset had no SOP, it maps here. */
export const SOP_RULES = [
  { id: 'OUTDOOR', gate: 'gust ≥ 23 kt', action: 'Stow outdoor sensors / abort sorties', cite: 'lockouts.py · IMD blowing snow' },
  { id: 'HELI_WIND', gate: 'gust ≥ 40 kt', action: 'Heli no-go (wind)', cite: 'lockouts.py WIND_HELI_KT' },
  { id: 'CONVOY', gate: 'gust ≥ 50 kt', action: 'Hold convoy', cite: 'lockouts.py WIND_CONVOY_KT' },
  { id: 'STRUCTURAL', gate: 'wind > 60 kt', action: 'Hatch airlock', cite: 'NCPOR 4.2.1' },
  { id: 'THERMAL', gate: 'indoor < 16 °C', action: 'Spin aux gen', cite: 'CHP handbook 8.1' },
  { id: 'FUEL_ADV', gate: 'autonomy < 30 d', action: 'Shed science + isolate summer', cite: 'sop.py FUEL_ADV' },
  { id: 'FUEL_CRIT', gate: 'autonomy < 15 d', action: 'Shed science + depressurize empty modules', cite: 'sop.py FUEL_CRIT' },
  { id: 'DELAY', gate: 'ship delay > 0 and not in bay', action: 'Re-score fuel vs ETA', cite: 'AL/02 one-ship voyage' },
  { id: 'MISS_SEA', gate: 'ETA after sea-window close', action: 'No bulk resupply this window', cite: '43-ISEA 15 Mar / AL/02' },
  { id: 'STARVE', gate: 'fuel days < ETA days', action: 'Essential-only until the ship or empty', cite: 'tank / (burn×24) vs voyageState' },
  { id: 'HELI_BAY', gate: 'ship > 80 km from bay', action: 'Heli locked (no ship deck)', cite: 'Kamov is voyage-based' },
]

export const SOP_BY_ASSET = {
  FUEL: ['FUEL_ADV', 'FUEL_CRIT', 'STARVE', 'MISS_SEA', 'DELAY'],
  MICROGRID: ['FUEL_ADV', 'THERMAL'],
  THERMAL: ['THERMAL', 'FUEL_CRIT'],
  STRUCTURE: ['STRUCTURAL', 'THERMAL'],
  ROOF: ['OUTDOOR'],
  COMMUNICATIONS: ['OUTDOOR'],
  SAFETY: ['OUTDOOR', 'HELI_WIND', 'HELI_BAY', 'STRUCTURAL'],
  VEHICLES: ['CONVOY', 'HELI_WIND'],
  CONTAINERS: ['FUEL_ADV', 'OUTDOOR'],
  UTILITIES: ['OUTDOOR', 'THERMAL'],
  WATER: ['OUTDOOR'],
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

export function addUtcDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** Ship is this many days behind the expedition clock. */
export function voyageClock(date, delayDays = 0) {
  return addUtcDays(date, -Number(delayDays || 0))
}

export function voyageImpact(date, delayDays = 0) {
  const delay = Math.max(0, Number(delayDays) || 0)
  const clock = voyageClock(date, delay)
  const ship = shipTrack(clock)
  const bharatiSea = daysUntilWindowClose('BHARATI', date, 'SEA')
  const maitriSea = daysUntilWindowClose('MAITRI', date, 'SEA')
  const miss = (sea) =>
    Boolean(delay && sea && ((sea.open && delay > sea.days) || !sea.open))
  return {
    delayDays: delay,
    clock,
    ship,
    bharatiHeli: shipNearby('BHARATI', clock),
    maitriHeli: shipNearby('MAITRI', clock),
    bharatiSea,
    maitriSea,
    bharatiMiss: miss(bharatiSea),
    maitriMiss: miss(maitriSea),
    source: 'AL/02 voyage · 43-ISEA 15 Mar hard exit · delay is a what-if',
  }
}

export function applyVoyageOverlay(telemetry, station, date, delayDays = 0) {
  if (!telemetry) return telemetry
  const impact = voyageImpact(date, delayDays)
  const nearby = station === 'MAITRI' ? impact.maitriHeli : impact.bharatiHeli
  const missed = station === 'MAITRI' ? impact.maitriMiss : impact.bharatiMiss
  const voyage = {
    delay_days: impact.delayDays,
    heli: nearby ? 'OPEN' : 'LOCKED',
    miss_window: missed,
  }
  const reasons = [...(telemetry.lockouts?.reasons ?? [])].filter(
    (line) =>
      !String(line).startsWith('Voyage +') && !String(line).startsWith('Heli locked'),
  )
  if (!nearby) {
    reasons.push('Heli locked — modeled ship is not in the bay (Kamov is voyage-based).')
  }
  if (impact.delayDays) {
    reasons.push(
      `Voyage +${impact.delayDays} d — ship modeled ${impact.delayDays} days earlier on the Cape Town track.`,
    )
  }
  if (missed) {
    reasons.push('Delayed arrival is after the published sea-window close.')
  }
  return {
    ...telemetry,
    voyage,
    lockouts: {
      ...telemetry.lockouts,
      heli: nearby ? telemetry.lockouts?.heli ?? 'OPEN' : 'LOCKED',
      reasons,
    },
  }
}

function nNum(v, fallback = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function etaFor(ship, station) {
  if (station === 'BHARATI') {
    return {
      days: ship.daysToBharati,
      km: ship.kmToBharati,
      inBay: Boolean(ship.atBharati),
    }
  }
  return {
    days: ship.daysToMaitri,
    km: ship.kmToMaitri,
    inBay: Boolean(ship.atMaitri),
  }
}

function projectFuel(telemetry, etaDays) {
  const days = nNum(telemetry?.fuel?.days_of_autonomy)
  const burn = nNum(telemetry?.fuel?.burn_rate_lph)
  const liters = nNum(telemetry?.fuel?.tank_level_liters)
  const eta = etaDays == null ? 0 : etaDays
  const fuelAtEta = days - eta
  const shortageDays = Math.max(0, eta - days)
  const hit30In = days > SOP.FUEL_ADVISORY_DAYS ? days - SOP.FUEL_ADVISORY_DAYS : 0
  const hit15In = days > SOP.FUEL_CRITICAL_DAYS ? days - SOP.FUEL_CRITICAL_DAYS : 0
  const litersAtEta = Math.max(0, liters - burn * 24 * eta)
  return { days, burn, liters, eta, fuelAtEta, emptyIn: days, shortageDays, hit30In, hit15In, litersAtEta }
}

function stationForecast(telemetry, date, delayDays, station, ship) {
  const sea = daysUntilWindowClose(station, date, 'SEA')
  const air = daysUntilWindowClose(station, date, 'AIR')
  const eta = etaFor(ship, station)
  const fuel = projectFuel(telemetry, eta.days)
  const miss =
    eta.days == null
      ? Boolean(delayDays && sea && !sea.open)
      : Boolean(sea && ((sea.open && eta.days > sea.days) || !sea.open))
  const heli = eta.inBay || (eta.km != null && eta.km < SOP.HELI_BAY_KM)
  const rules = []
  if (delayDays > 0 && !eta.inBay) rules.push('DELAY')
  if (!heli) rules.push('HELI_BAY')
  if (miss) rules.push('MISS_SEA')
  if (fuel.shortageDays > 0) rules.push('STARVE')
  else if (fuel.fuelAtEta < SOP.FUEL_CRITICAL_DAYS) rules.push('FUEL_CRIT')
  else if (fuel.fuelAtEta < SOP.FUEL_ADVISORY_DAYS) rules.push('FUEL_ADV')
  let band = 'NOMINAL'
  if (rules.includes('STARVE') || rules.includes('FUEL_CRIT') || rules.includes('MISS_SEA')) band = 'CRITICAL'
  else if (rules.length) band = 'ADVISORY'
  const actions = [
    ...new Set(rules.map((id) => SOP_RULES.find((row) => row.id === id)?.action).filter(Boolean)),
  ]
  return {
    station,
    sea,
    air,
    etaDays: eta.days,
    etaKm: eta.km,
    inBay: eta.inBay,
    heli,
    miss,
    band,
    rules,
    actions,
    ...fuel,
  }
}

export function resupplyForecast(date, delayDays, fleet = {}, focus = 'BHARATI') {
  const delay = Math.max(0, Number(delayDays) || 0)
  const clock = voyageClock(date, delay)
  const ship = voyageState(clock)
  const bharatiTick = fleet.BHARATI
  const maitriTick = fleet.MAITRI
  const bharati = bharatiTick ? stationForecast(bharatiTick, date, delay, 'BHARATI', ship) : null
  const maitri = maitriTick ? stationForecast(maitriTick, date, delay, 'MAITRI', ship) : null
  const here = focus === 'MAITRI' ? maitri : bharati
  return { delayDays: delay, ship, bharati, maitri, here }
}

export function fuelDecision(telemetry, station, date, delayDays = 0, fleet = null) {
  const map = { ...(fleet || {}), [station]: telemetry }
  const forecast = resupplyForecast(date, delayDays, map, station)
  const here = forecast.here
  const days = nNum(telemetry?.fuel?.days_of_autonomy)
  let band = here?.band || 'NOMINAL'
  if (days < SOP.FUEL_CRITICAL_DAYS) band = 'CRITICAL'
  else if (days < SOP.FUEL_ADVISORY_DAYS && band === 'NOMINAL') band = 'ADVISORY'
  const next = [here?.sea, here?.air]
    .filter((item) => item && item.open)
    .sort((a, b) => a.days - b.days)[0] ?? here?.sea
  return {
    days,
    band,
    sea: here?.sea,
    air: here?.air,
    next,
    starve: Boolean((here?.shortageDays || 0) > 0 || here?.miss),
    delayDays: forecast.delayDays,
    missWindow: Boolean(here?.miss),
    otherHeli: station === 'BHARATI' ? forecast.maitri?.heli : forecast.bharati?.heli,
    thisHeli: Boolean(here?.heli),
    forecast,
    actions: here?.actions || [],
    shortageDays: here?.shortageDays || 0,
    fuelAtEta: here?.fuelAtEta,
    etaDays: here?.etaDays,
    source:
      forecast.delayDays > 0
        ? `SOP 30/15 · +${forecast.delayDays} d delay · fuel at ETA ${here?.fuelAtEta?.toFixed?.(0) ?? '—'} d`
        : 'SOP 30/15 d · AL/02 + 43-ISEA',
  }
}

/** Great-circle km. Voyage is AL/02 / 43-ISEA calendar, not AIS. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const s =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)))
}

function nodeKm(a, b) {
  return haversineKm(NODES[a].lat, NODES[a].lon, NODES[b].lat, NODES[b].lon)
}

/** Open-ocean hinge so CT↔Prydz never clips India / Madagascar. */
export const SEA_VIA = { name: 'Southern Ocean', lat: -56.4, lon: 44.8 }

export function lerpGreatCircle(a, b, t) {
  const clamp = Math.min(1, Math.max(0, t))
  const lat1 = (a.lat * Math.PI) / 180
  const lon1 = (a.lon * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const lon2 = (b.lon * Math.PI) / 180
  const d = 2 * Math.asin(
    Math.min(
      1,
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2
          + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    ),
  )
  if (d < 1e-8) return { lat: a.lat, lon: a.lon }
  const u = Math.sin((1 - clamp) * d) / Math.sin(d)
  const v = Math.sin(clamp * d) / Math.sin(d)
  const x = u * Math.cos(lat1) * Math.cos(lon1) + v * Math.cos(lat2) * Math.cos(lon2)
  const y = u * Math.cos(lat1) * Math.sin(lon1) + v * Math.cos(lat2) * Math.sin(lon2)
  const z = u * Math.sin(lat1) + v * Math.sin(lat2)
  return {
    lat: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI,
    lon: (Math.atan2(y, x) * 180) / Math.PI,
  }
}

function steamBharatiPoint(t) {
  if (t < 0.5) return lerpGreatCircle(NODES.CPT, SEA_VIA, t * 2)
  return lerpGreatCircle(SEA_VIA, NODES.QUILTY_BAY, (t - 0.5) * 2)
}

function steamHomePoint(t) {
  if (t < 0.5) return lerpGreatCircle(NODES.INDIA_BAY, SEA_VIA, t * 2)
  return lerpGreatCircle(SEA_VIA, NODES.CPT, (t - 0.5) * 2)
}

function steamMaitriPoint(t) {
  return lerpGreatCircle(NODES.QUILTY_BAY, NODES.INDIA_BAY, t)
}

/** Days since 1 Nov of the current expedition season (Nov–Mar). */
export function seasonDay(date) {
  const month = date.getUTCMonth() + 1
  const year = date.getUTCFullYear()
  const startYear = month >= 11 ? year : year - 1
  const start = Date.UTC(startYear, 10, 1)
  const now = Date.UTC(year, date.getUTCMonth(), date.getUTCDate())
  return Math.round((now - start) / 86400000)
}

/**
 * One ship. Waypoints in days from 1 Nov.
 * Sea times: CT–Quilty ~13 d (AL/02 10–16), Quilty–India Bay ~6 d, India Bay–CT ~10 d.
 * Stay windows from 43-ISEA / AL/02 (Bharati Dec–Feb, Maitri Jan–15 Mar).
 */
export const VOYAGE_WAYPOINTS = [
  { day: 0, node: 'CPT', name: 'Cape Town', phase: 'STEAM_BHARATI' },
  { day: 44, node: 'QUILTY_BAY', name: 'Quilty Bay / Bharati', phase: 'AT_BHARATI' },
  { day: 81, node: 'QUILTY_BAY', name: 'Quilty Bay (depart)', phase: 'STEAM_MAITRI' },
  { day: 87, node: 'INDIA_BAY', name: 'India Bay / Maitri', phase: 'AT_MAITRI' },
  { day: 121, node: 'INDIA_BAY', name: 'India Bay (depart)', phase: 'STEAM_HOME' },
  { day: 135, node: 'CPT', name: 'Cape Town / 15 Mar exit', phase: 'LAYUP' },
]

const PHASE_LABEL = {
  LAYUP: 'Winter layup · Cape Town',
  STEAM_BHARATI: 'Steaming Cape Town → Bharati',
  AT_BHARATI: 'On station · Quilty Bay / Bharati',
  STEAM_MAITRI: 'Steaming Bharati → Maitri',
  AT_MAITRI: 'On station · India Bay / Maitri',
  STEAM_HOME: 'Homeward · Maitri → Cape Town',
}

function pathKmTo(fromIdx, tOnLeg, targetNode) {
  let km = 0
  const pts = VOYAGE_WAYPOINTS
  const a = pts[fromIdx]
  const b = pts[fromIdx + 1]
  if (!b) return 0
  const hitNow = a.node === targetNode && tOnLeg < 0.02
  if (hitNow) return 0
  if (b.node === targetNode) {
    km += (1 - tOnLeg) * nodeKm(a.node, b.node)
    return km
  }
  km += (1 - tOnLeg) * nodeKm(a.node, b.node)
  for (let i = fromIdx + 1; i < pts.length - 1; i += 1) {
    if (pts[i].node === targetNode) return km
    km += nodeKm(pts[i].node, pts[i + 1].node)
    if (pts[i + 1].node === targetNode) return km
  }
  return null
}

function pathDaysTo(fromIdx, day, targetNode) {
  const pts = VOYAGE_WAYPOINTS
  for (let i = fromIdx; i < pts.length; i += 1) {
    if (pts[i].node === targetNode && pts[i].day >= day - 0.01) {
      return Math.max(0, pts[i].day - day)
    }
  }
  return null
}

export function voyageState(date) {
  const month = date.getUTCMonth() + 1
  const day = seasonDay(date)
  const pts = VOYAGE_WAYPOINTS
  const inSeason = month >= 11 || month <= 3
  if (!inSeason || day < 0 || day >= pts[pts.length - 1].day) {
    const bharatiKm = nodeKm('CPT', 'QUILTY_BAY')
    const maitriKm = bharatiKm + nodeKm('QUILTY_BAY', 'INDIA_BAY')
    const year = date.getUTCFullYear()
    const nextSail = Date.UTC(month >= 11 ? year + 1 : year, 10, 1)
    const now = Date.UTC(year, date.getUTCMonth(), date.getUTCDate())
    const daysToSail = Math.max(0, Math.round((nextSail - now) / 86400000))
    return {
      ...SEA_VIA,
      phase: 'LAYUP',
      label: PHASE_LABEL.LAYUP,
      leg: 'Cape Town layup · next track (mid-ocean)',
      fromName: 'Cape Town',
      toName: 'Quilty Bay',
      t: 0.5,
      remainingKm: bharatiKm,
      remainingDays: daysToSail,
      kmToBharati: bharatiKm,
      daysToBharati: daysToSail + 44,
      kmToMaitri: maitriKm,
      daysToMaitri: daysToSail + 87,
      nearby: 'NONE',
      atBharati: false,
      atMaitri: false,
      parked: true,
      source: 'AL/02 · 43-ISEA · next 1 Nov sail · great-circle km, not AIS',
    }
  }

  let idx = 0
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (day >= pts[i].day) idx = i
  }
  const from = pts[idx]
  const to = pts[idx + 1]
  const span = Math.max(1, to.day - from.day)
  const t = Math.min(1, Math.max(0, (day - from.day) / span))
  const parked = from.node === to.node
  const phase = from.phase
  let point
  if (parked) {
    point = { lat: NODES[from.node].lat, lon: NODES[from.node].lon }
  } else if (phase === 'STEAM_BHARATI') {
    point = steamBharatiPoint(t)
  } else if (phase === 'STEAM_MAITRI') {
    point = steamMaitriPoint(t)
  } else if (phase === 'STEAM_HOME') {
    point = steamHomePoint(t)
  } else {
    point = lerpGreatCircle(NODES[from.node], NODES[to.node], t)
  }
  const lat = point.lat
  const lon = point.lon
  const legKm = parked ? 0 : nodeKm(from.node, to.node)
  const remainingKm = parked ? 0 : (1 - t) * legKm
  const remainingDays = Math.max(0, to.day - day)
  const atBharati = phase === 'AT_BHARATI'
  const atMaitri = phase === 'AT_MAITRI'
  const kmToBharati = atBharati
    ? 0
    : phase === 'STEAM_BHARATI'
      ? pathKmTo(idx, t, 'QUILTY_BAY')
      : null
  const kmToMaitri = atMaitri
    ? 0
    : phase === 'STEAM_BHARATI' || phase === 'AT_BHARATI' || phase === 'STEAM_MAITRI'
      ? pathKmTo(idx, t, 'INDIA_BAY')
      : null
  const daysToBharati = atBharati
    ? 0
    : phase === 'STEAM_BHARATI'
      ? pathDaysTo(idx, day, 'QUILTY_BAY')
      : null
  const daysToMaitri = atMaitri
    ? 0
    : phase === 'STEAM_BHARATI' || phase === 'AT_BHARATI' || phase === 'STEAM_MAITRI'
      ? pathDaysTo(idx, day, 'INDIA_BAY')
      : null

  return {
    lat,
    lon,
    phase,
    label: PHASE_LABEL[phase] || phase,
    leg: parked ? from.name : `${from.name} → ${to.name}`,
    fromName: from.name,
    toName: to.name,
    t,
    remainingKm,
    remainingDays,
    legKm,
    kmToBharati,
    daysToBharati,
    kmToMaitri,
    daysToMaitri,
    nearby: atBharati ? 'BHARATI' : atMaitri ? 'MAITRI' : 'NONE',
    atBharati,
    atMaitri,
    parked,
    source: 'AL/02 10–16 d CT–Quilty · 43-ISEA 15 Mar exit · great-circle km',
  }
}

export function shipNearby(station, date) {
  const v = voyageState(date)
  if (station === 'BHARATI') return v.atBharati || (v.kmToBharati != null && v.kmToBharati < 80)
  if (station === 'MAITRI') return v.atMaitri || (v.kmToMaitri != null && v.kmToMaitri < 80)
  return false
}

export function shipTrack(date) {
  const v = voyageState(date)
  return {
    lat: v.lat,
    lon: v.lon,
    leg: v.leg,
    nearby: v.nearby,
    source: v.source,
    ...v,
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
