/** Compact per-asset stats. Weather is a driver chip, not an essay. */

import { fuelDecision, instrumentStatus, polarState, SOP, SOP_BY_ASSET, SOP_RULES } from '../ops/decisions'

const LOCKOUT_KT = 23
const HELI_KT = 40
const CONVOY_KT = 50
const STRUCTURAL_KT = 60
const U_BHARATI = 2.45
const U_MAITRI = 3.6

function n(v, fallback = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function pct(v) {
  const x = Number(v)
  if (!Number.isFinite(x)) return '—'
  return `${Math.round(x * 100)}%`
}

function kt(v, d = 1) {
  const x = Number(v)
  if (!Number.isFinite(x)) return '—'
  return `${x.toFixed(d)} kt`
}

function deg(v, d = 1) {
  const x = Number(v)
  if (!Number.isFinite(x)) return '—'
  return `${x.toFixed(d)} °C`
}

function toneFromStatus(status) {
  const s = String(status || 'CLEAR').toUpperCase()
  if (s === 'ACTIVE' || s === 'IMMINENT') return 'critical'
  if (s === 'WATCH') return 'advisory'
  return 'nominal'
}

function weatherHours(telemetry) {
  const h = telemetry?.weather?.hourly || telemetry?.weather?.hourly_tail || {}
  const times = h.time || []
  return times.map((t, i) => ({
    t,
    temp: n(h.temperature_2m?.[i], NaN),
    wind: n(h.wind_speed_10m?.[i], NaN),
    gust: n(h.wind_gusts_10m?.[i], NaN),
    solar: n(h.shortwave_radiation?.[i], NaN),
  }))
}

function mapHours(rows, fn) {
  return rows.map((row) => ({ t: row.t, v: fn(row) })).filter((p) => Number.isFinite(p.v))
}

function assetChart(id, station, phy, rows) {
  const loss = (row) => heatLossKw(station, phy.internal, row.temp, row.wind)
  if (id === 'FUEL' || id === 'CONTAINERS') {
    return { label: 'HEAT LOSS', unit: 'kW', color: '#e8c48a', sop: null, points: mapHours(rows, loss) }
  }
  if (id === 'MICROGRID' || id === 'THERMAL') {
    return {
      label: 'THERMAL MARGIN',
      unit: 'kW',
      color: '#64d8a0',
      sop: 0,
      points: mapHours(rows, (row) => phy.chpNow - loss(row)),
    }
  }
  if (id === 'STRUCTURE' || id === 'UTILITIES') {
    return { label: 'AIR T', unit: '°C', color: '#9fe2f8', sop: id === 'UTILITIES' ? -25 : null, points: mapHours(rows, (row) => row.temp) }
  }
  if (id === 'ROOF') {
    return { label: 'SOLAR', unit: 'W/m²', color: '#e8c48a', sop: null, points: mapHours(rows, (row) => row.solar) }
  }
  if (id === 'WATER') {
    return { label: 'AIR T', unit: '°C', color: '#9fe2f8', sop: -2, points: mapHours(rows, (row) => row.temp) }
  }
  if (id === 'VEHICLES') {
    return { label: 'GUST', unit: 'kt', color: '#ff6b7c', sop: 50, points: mapHours(rows, (row) => row.gust) }
  }
  if (id === 'SAFETY') {
    return { label: 'GUST', unit: 'kt', color: '#ff6b7c', sop: 23, points: mapHours(rows, (row) => row.gust) }
  }
  return { label: 'GUST', unit: 'kt', color: '#e8c48a', sop: 23, points: mapHours(rows, (row) => row.gust) }
}

export function openMeteoStory(telemetry) {
  const wx = telemetry?.weather || {}
  const src = String(telemetry?.source || '').toUpperCase()
  const live = src.includes('OPEN_METEO')
  return {
    live,
    provider: wx.provider || (live ? 'OPEN_METEO' : telemetry?.source || 'held'),
    modelTime: wx.model_time || telemetry?.timestamp || '—',
    neighbor: wx.neighbor_id || telemetry?.forecast?.neighbor || '—',
  }
}

function compare(now, later, unit, better = 'lower', digits = 1) {
  const a = n(now, NaN)
  const b = n(later, NaN)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { now: '—', later: '—', delta: '—', tone: 'nominal', a: 0, b: 0 }
  }
  const d = b - a
  const worse = better === 'lower' ? d > 0.15 : d < -0.15
  const betterMove = better === 'lower' ? d < -0.15 : d > 0.15
  return {
    now: `${a.toFixed(digits)} ${unit}`,
    later: `${b.toFixed(digits)} ${unit}`,
    delta: `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`,
    unit,
    a,
    b,
    tone: worse ? 'critical' : betterMove ? 'nominal' : 'advisory',
  }
}

function heatLossKw(station, internalC, ambientC, windKt) {
  const u = station === 'MAITRI' ? U_MAITRI : U_BHARATI
  return u * Math.max(0, internalC - ambientC) * (1 + 0.05 * Math.sqrt(Math.max(0, windKt)))
}

function projectPhysics(station, telemetry, g, temp6) {
  const load = n(telemetry?.microgrid?.total_load_kva)
  const internal = n(telemetry?.thermal?.internal_temp_c, 20)
  const chpNow = n(telemetry?.thermal?.chp_thermal_output_kw)
  const lossNow = n(telemetry?.thermal?.heat_loss_kw)
  const burnNow = n(telemetry?.fuel?.burn_rate_lph)
  const liters = n(telemetry?.fuel?.tank_level_liters)
  const daysNow = n(telemetry?.fuel?.days_of_autonomy)
  const wind6 = n(g.gust6, g.wind)
  const loss6 = heatLossKw(station, internal, temp6, wind6)
  const chp6 = load * 0.52
  const extraHeat = Math.max(0, loss6 - lossNow)
  const burn6 = burnNow + extraHeat * 0.11
  const days6 = burn6 > 0 ? liters / (burn6 * 24) : daysNow
  return {
    load,
    internal,
    chpNow,
    chp6,
    lossNow,
    loss6,
    marginNow: chpNow - lossNow,
    margin6: chp6 - loss6,
    burnNow,
    burn6,
    daysNow,
    days6,
    liters,
    u: station === 'MAITRI' ? U_MAITRI : U_BHARATI,
  }
}

function outdoorGates(telemetry) {
  const f = telemetry?.forecast || {}
  const wind = n(telemetry?.ambient?.wind_speed_knots)
  const gustNow = n(f.now_gust_kn, wind)
  const gust6 = n(f.gust_max_6h_kn, gustNow)
  const lock = telemetry?.lockouts || {}
  return {
    outdoorNow: gustNow >= LOCKOUT_KT || lock.outdoor === 'LOCKED',
    heliNow: gustNow >= HELI_KT || lock.heli === 'LOCKED',
    convoyNow: gustNow >= CONVOY_KT || lock.convoy === 'LOCKED',
    structuralNow: wind > STRUCTURAL_KT || gustNow >= STRUCTURAL_KT,
    outdoor6: gust6 >= LOCKOUT_KT || n(f.p_lockout_23) >= 0.45,
    heli6: gust6 >= HELI_KT || n(f.p_heli_40) >= 0.45,
    convoy6: gust6 >= CONVOY_KT,
    structural6: gust6 >= STRUCTURAL_KT,
    wind,
    gustNow,
    gust6,
    p23: n(f.p_lockout_23),
    p40: n(f.p_heli_40),
    status: f.status || 'CLEAR',
    model: f.model || 'off',
  }
}

function kpi(k, v, tag, tone = 'nominal') {
  return { k, v, tag, tone }
}

function meter(label, now, later) {
  return { label, now: Math.max(0, Math.min(100, now)), later: Math.max(0, Math.min(100, later)) }
}

function buildFuel(telemetry, g, phy, fuelOps) {
  const starve = Boolean(fuelOps?.starve)
  const daysTone = phy.daysNow < 15 || starve ? 'critical' : phy.daysNow < 30 ? 'advisory' : 'nominal'
  return {
    blurb: 'Bulk Jet A-1 · burn follows envelope heat loss',
    call: starve ? 'Starve vs ship window' : `${phy.daysNow.toFixed(0)} d vs 30 / 15 SOP`,
    kpis: [
      kpi('TANK', `${(phy.liters / 1000).toFixed(0)} kL`, 'MODEL'),
      kpi('DAYS', `${phy.daysNow.toFixed(1)} d`, 'MODEL', daysTone),
      kpi('SHIP ETA', fuelOps?.etaDays != null ? `${Number(fuelOps.etaDays).toFixed(0)} d` : '—', 'SOP'),
      kpi(
        'GAP',
        starve ? `${Number(fuelOps.shortageDays || 0).toFixed(0)} d short` : 'covers',
        'SOP',
        starve ? 'critical' : 'nominal',
      ),
    ],
    mix: [
      { id: 'fill', label: 'STORE', value: Math.min(phy.liters, 90000), tone: 'nominal' },
      { id: 'air', label: 'HEAD', value: Math.max(0, 90000 - phy.liters), tone: 'advisory' },
    ],
    mixTotal: 90000,
    mixUnit: 'L',
    compares: [
      { label: 'LOSS', ...compare(phy.lossNow, phy.loss6, 'kW', 'lower', 0) },
      { label: 'BURN', ...compare(phy.burnNow, phy.burn6, 'L/h', 'lower', 1) },
      { label: 'DAYS', ...compare(phy.daysNow, phy.days6, 'd', 'higher', 1) },
    ],
    meters: [meter('DAYS / 90', (phy.daysNow / 90) * 100, (phy.days6 / 90) * 100)],
    sources: [
      { field: 'T / wind', origin: 'LIVE grid' },
      { field: 'Litres / burn', origin: 'MODEL mass balance' },
      { field: '6 h days', origin: 'U·A at 6 h T,gust' },
      { field: '30 / 15 d', origin: 'SOP' },
    ],
    formula: `Q = ${phy.u}·ΔT·(1+0.05√V)  ·  burn = 0.22·kVA`,
    sparkKey: 'temp',
    tone: daysTone,
    why: {
      what: '90 kL twin farm. Days = litres / (burn × 24).',
      mechanism: 'Colder / windier hours raise envelope loss, then aux burn.',
      sop: starve
        ? `STARVE ${Number(fuelOps.shortageDays || 0).toFixed(0)} d before ship · 30/15 floors`
        : '30 d advisory · 15 d critical · delay rescores ETA',
      not: 'Not a SCADA tank. 6 h is the same identity at forecast T,gust.',
    },
  }
}

function buildMicrogrid(telemetry, g, phy) {
  const ess = n(telemetry?.microgrid?.essential_load_kva)
  const sci = n(telemetry?.microgrid?.science_load_kva)
  const com = n(telemetry?.microgrid?.comfort_load_kva)
  const cap = n(telemetry?.microgrid?.chp_capacity_kva, 750)
  const aux = telemetry?.controls?.aux_generator_active
  const tone = phy.margin6 < 0 ? 'critical' : phy.margin6 < 20 ? 'advisory' : 'nominal'
  return {
    blurb: 'CHP block · weather hits heat margin, not kVA',
    call: `Margin ${phy.marginNow.toFixed(0)} → ${phy.margin6.toFixed(0)} kW`,
    kpis: [
      kpi('LOAD', `${phy.load.toFixed(0)} kVA`, 'MODEL'),
      kpi('CHP Q', `${phy.chpNow.toFixed(0)} kW`, 'MODEL'),
      kpi('LOSS', `${phy.lossNow.toFixed(0)} kW`, 'LIVE', phy.lossNow > phy.chpNow ? 'critical' : 'nominal'),
      kpi('AUX', aux ? 'ON' : 'STBY', 'MODEL', aux ? 'advisory' : 'nominal'),
    ],
    mix: [
      { id: 'ess', label: 'ESS', value: ess, tone: 'nominal' },
      { id: 'sci', label: 'SCI', value: sci, tone: 'advisory' },
      { id: 'com', label: 'COM', value: com, tone: 'critical' },
    ],
    mixTotal: Math.max(cap, ess + sci + com),
    mixUnit: 'kVA',
    compares: [
      { label: 'LOSS', ...compare(phy.lossNow, phy.loss6, 'kW', 'lower', 0) },
      { label: 'MARGIN', ...compare(phy.marginNow, phy.margin6, 'kW', 'higher', 0) },
    ],
    meters: [
      meter(
        'CHP / LOSS',
        (phy.chpNow / Math.max(phy.lossNow, 1)) * 50,
        (phy.chp6 / Math.max(phy.loss6, 1)) * 50,
      ),
    ],
    sources: [
      { field: 'kVA mix', origin: 'MODEL occupancy' },
      { field: 'Loss', origin: 'LIVE T,wind → U·A' },
      { field: 'CHP heat', origin: '0.52 × load' },
      { field: '16 °C floor', origin: 'SOP' },
    ],
    formula: 'margin = 0.52·kVA − U·A·ΔT·(1+0.05√V)',
    sparkKey: 'temp',
    tone,
    why: {
      what: 'CHP waste heat vs hull loss. kVA mix is modeled occupancy.',
      mechanism: '6 h T/wind change loss only. Load held.',
      sop: 'Aux if habitat < 16 °C',
      not: 'No live kVA meter. No ML load forecast.',
    },
  }
}

function buildStructure(telemetry, g, phy, tempNow, temp6) {
  const hatch = telemetry?.controls?.hatch_lockdown
  const tone = g.structuralNow || phy.internal < 16 ? 'critical' : g.gust6 > 40 ? 'advisory' : 'nominal'
  return {
    blurb: 'Elevated hull · indoor modeled, outdoor live, hatch 60 kt',
    call: hatch ? 'HATCH LOCK' : `ΔT ${(phy.internal - tempNow).toFixed(0)} K`,
    kpis: [
      kpi('IN', deg(phy.internal), 'MODEL', phy.internal < 16 ? 'critical' : 'nominal'),
      kpi('OUT', deg(tempNow), 'LIVE'),
      kpi('LOSS', `${phy.lossNow.toFixed(0)} kW`, 'LIVE'),
      kpi('HATCH', hatch ? 'LOCK' : 'OPEN', 'SOP', hatch ? 'critical' : 'nominal'),
    ],
    mix: [
      { id: 'in', label: 'HAB', value: Math.max(0, phy.internal + 40), tone: 'nominal' },
      { id: 'span', label: 'TO −40', value: Math.max(0, 60 - (phy.internal + 40)), tone: 'advisory' },
    ],
    mixTotal: 60,
    mixUnit: '°C span',
    compares: [
      { label: 'OUT T', ...compare(tempNow, temp6, '°C', 'higher') },
      { label: 'LOSS', ...compare(phy.lossNow, phy.loss6, 'kW', 'lower', 0) },
      { label: 'GUST/60', ...compare(g.gustNow, g.gust6, 'kt', 'lower') },
    ],
    meters: [meter('GUST / 60', (g.gustNow / 60) * 100, (g.gust6 / 60) * 100)],
    sources: [
      { field: 'Outdoor T', origin: 'LIVE T2m' },
      { field: 'Indoor T', origin: 'MODEL C=140' },
      { field: 'Hatch', origin: 'SOP 60 kt' },
    ],
    formula: `hatch @ 60 kt · collapse @ ${SOP.INTERNAL_TEMP_COLLAPSE_C} °C`,
    sparkKey: 'temp',
    tone,
    why: {
      what: 'Elevated hull. Indoor T is lumped capacitance.',
      mechanism: 'Outdoor T sets ΔT and loss. Hatch is 60 kt, not 23 kt.',
      sop: '60 kt hatch · 16 °C collapse',
      not: 'Not a room sensor or FEA.',
    },
  }
}

function buildRoof(telemetry, g, solar) {
  const stowNow = g.gustNow >= LOCKOUT_KT || g.outdoorNow
  const tone = stowNow ? 'critical' : g.outdoor6 ? 'advisory' : 'nominal'
  return {
    blurb: 'Terrace AWS / HVAC · stow at 23 kt',
    call: stowNow ? 'STOW' : `solar ${solar.toFixed(0)} W/m²`,
    kpis: [
      kpi('SOLAR', `${solar.toFixed(0)}`, 'LIVE', solar <= 1 ? 'advisory' : 'nominal'),
      kpi('GUST', kt(g.gustNow), 'LIVE', stowNow ? 'critical' : 'nominal'),
      kpi('23 kt', `${((g.gustNow / 23) * 100).toFixed(0)}%`, 'SOP', stowNow ? 'critical' : 'nominal'),
      kpi('6h P', pct(g.p23), 'LIVE', g.p23 > 0.45 ? 'advisory' : 'nominal'),
    ],
    compares: [
      { label: 'GUST', ...compare(g.gustNow, g.gust6, 'kt', 'lower') },
      { label: 'P STOW', ...compare(g.gustNow >= 23 ? 100 : 0, g.p23 * 100, '%', 'lower', 0) },
    ],
    meters: [meter('STOW 23', (g.gustNow / 23) * 100, Math.max(g.p23 * 100, (g.gust6 / 23) * 100))],
    sources: [
      { field: 'Solar', origin: 'LIVE shortwave' },
      { field: 'Stow', origin: 'SOP 23 kt' },
      { field: 'HVAC kW', origin: 'none (catalog)' },
    ],
    formula: 'stow if gust ≥ 23 kt',
    sparkKey: 'gust',
    tone,
    why: {
      what: 'Terrace AWS / HVAC deck.',
      mechanism: 'Stow when gust hits blowing-snow gate. Solar is shortwave grid.',
      sop: '23 kt outdoor lockout',
      not: 'No BMS HVAC kW. Solar is not a hull pyranometer.',
    },
  }
}

function buildComms(telemetry, g) {
  const lat = n(telemetry?.link_status?.latency_ms)
  const health = telemetry?.link_status?.health || 'ONLINE'
  const tone = health === 'DEGRADED' || g.outdoorNow ? 'advisory' : 'nominal'
  return {
    blurb: 'C-band / radome · RTT is sat-sim, access is 23 kt',
    call: g.outdoorNow ? 'NO RIDGE WORK' : health,
    kpis: [
      kpi('PATH', telemetry?.link_status?.type || 'C-band', 'MODEL'),
      kpi('RTT', `${lat.toFixed(0)} ms`, 'MODEL'),
      kpi('LINK', health, 'MODEL', health === 'DEGRADED' ? 'advisory' : 'nominal'),
      kpi('DISH', g.outdoorNow ? 'STOW' : 'OK', 'SOP', g.outdoorNow ? 'critical' : 'nominal'),
    ],
    compares: [{ label: 'GUST', ...compare(g.gustNow, g.gust6, 'kt', 'lower') }],
    meters: [meter('ACCESS', g.outdoorNow ? 8 : 88, g.outdoor6 ? 28 : 82)],
    sources: [
      { field: 'RTT', origin: 'MODEL 400–800 ms' },
      { field: 'Dish work', origin: 'SOP 23 kt' },
      { field: 'BER / Kp', origin: 'not wired' },
    ],
    formula: 'ridge access = gust < 23 kt',
    sparkKey: 'gust',
    tone,
    why: {
      what: 'C-band / radome. RTT is the sat-sim envelope.',
      mechanism: 'Weather only gates whether techs can work the dish.',
      sop: '23 kt stow',
      not: 'Not modem BER. NOAA Kp is not wired.',
    },
  }
}

function buildSafety(telemetry, g, date) {
  const polar = polarState(telemetry?.station_id || 'BHARATI', date)
  const tone = g.structuralNow ? 'critical' : g.heliNow || g.outdoorNow ? 'advisory' : 'nominal'
  return {
    blurb: 'Helipad / outdoor SOP gates',
    call: `${kt(g.gustNow)}  ·  ${g.status}`,
    kpis: [
      kpi('GUST', kt(g.gustNow), 'LIVE', tone),
      kpi('OUT 23', g.outdoorNow ? 'LOCK' : 'OPEN', 'SOP', g.outdoorNow ? 'critical' : 'nominal'),
      kpi('HELI 40', g.heliNow ? 'NO-GO' : 'GO', 'SOP', g.heliNow ? 'critical' : 'nominal'),
      kpi('P23', pct(g.p23), 'LIVE', g.p23 > 0.45 ? 'advisory' : 'nominal'),
    ],
    ladder: [
      { at: 23, label: 'OUT', hit: g.gustNow >= 23 || g.gust6 >= 23 },
      { at: 40, label: 'HELI', hit: g.gustNow >= 40 || g.gust6 >= 40 },
      { at: 50, label: 'CONVOY', hit: g.gustNow >= 50 || g.gust6 >= 50 },
      { at: 60, label: 'HATCH', hit: g.gustNow >= 60 || g.gust6 >= 60 },
    ],
    markerKt: g.gustNow,
    marker6: g.gust6,
    ladderMax: 70,
    compares: [
      { label: 'GUST', ...compare(g.gustNow, g.gust6, 'kt', 'lower') },
      { label: 'P ≥23', ...compare(g.gustNow >= 23 ? 100 : 0, g.p23 * 100, '%', 'lower', 0) },
    ],
    meters: [
      meter('OUT 23', (g.gustNow / 23) * 100, Math.max((g.gust6 / 23) * 100, g.p23 * 100)),
      meter('HELI 40', (g.gustNow / 40) * 100, (g.gust6 / 40) * 100),
    ],
    sources: [
      { field: 'Gust now', origin: 'LIVE gust_10m' },
      { field: '6 h peak', origin: 'LSTM+RF clip' },
      { field: '23/40/50/60', origin: 'SOP' },
      { field: 'Polar', origin: polar.phase },
    ],
    formula: 'lock if gust ≥ gate',
    sparkKey: 'gust',
    tone,
    why: {
      what: 'Outdoor / heli / convoy / hatch gates.',
      mechanism: 'Compare live gust and 6 h peak to 23 / 40 / 50 / 60 kt.',
      sop: '23 outdoor · 40 heli · 50 convoy · 60 hatch',
      not: 'Not a Quilty METAR. P(23) is the RF head, not 40/60.',
    },
  }
}

function buildVehicles(telemetry, g) {
  const tone = g.convoyNow || g.heliNow ? 'critical' : g.convoy6 ? 'advisory' : 'nominal'
  return {
    blurb: 'Ops fleet · no GPS · 50 / 40 kt only',
    call: g.convoyNow ? 'HOLD' : 'WEATHER GO',
    kpis: [
      kpi('GUST', kt(g.gustNow), 'LIVE'),
      kpi('CONVOY', g.convoyNow ? 'HOLD' : 'GO', 'SOP', g.convoyNow ? 'critical' : 'nominal'),
      kpi('HELI', g.heliNow ? 'NO-GO' : 'GO', 'SOP', g.heliNow ? 'critical' : 'nominal'),
      kpi('6 h', kt(g.gust6), 'LIVE'),
    ],
    compares: [{ label: 'GUST', ...compare(g.gustNow, g.gust6, 'kt', 'lower') }],
    meters: [meter('CONVOY 50', (g.gustNow / 50) * 100, (g.gust6 / 50) * 100)],
    sources: [
      { field: 'Tracks', origin: 'none' },
      { field: 'Roll / heli', origin: 'SOP 50 / 40' },
    ],
    formula: 'convoy 50 · heli 40',
    sparkKey: 'gust',
    tone,
    why: {
      what: 'PistenBully catalog. No GPS tracks.',
      mechanism: 'Roll / heli only from gust vs SOP.',
      sop: '50 kt convoy · 40 kt heli',
      not: 'Not a vehicle tracker.',
    },
  }
}

function buildContainers(telemetry, g, phy) {
  const occ = n(telemetry?.occupancy, 47)
  const isolated = telemetry?.controls?.summer_wing_isolated
  const tone = phy.daysNow < 30 ? 'advisory' : 'nominal'
  return {
    blurb: 'ISO village · isolate on fuel days, not wind',
    call: isolated ? 'WING ISOLATED' : `${occ} pax · ${phy.daysNow.toFixed(0)} d`,
    kpis: [
      kpi('PAX', `${occ}`, 'MODEL'),
      kpi('WING', isolated ? 'OFF' : 'ON', 'MODEL', isolated ? 'advisory' : 'nominal'),
      kpi('FUEL', `${phy.daysNow.toFixed(0)} d`, 'MODEL', tone),
      kpi('WALK', g.outdoorNow ? 'LOCK' : 'OK', 'SOP', g.outdoorNow ? 'advisory' : 'nominal'),
    ],
    compares: [{ label: 'DAYS', ...compare(phy.daysNow, phy.days6, 'd', 'higher', 1) }],
    meters: [meter('ISOLATE', phy.daysNow < 30 ? 80 : 18, phy.days6 < 30 ? 84 : 18)],
    sources: [
      { field: 'Occupancy', origin: 'AL/02 slot' },
      { field: 'Isolate', origin: 'SOP fuel < 30 d' },
      { field: 'Walk', origin: 'SOP 23 kt' },
    ],
    formula: 'isolate summer if days < 30',
    sparkKey: 'temp',
    tone,
    why: {
      what: 'ISO village occupancy + summer-wing flag.',
      mechanism: 'Isolate on fuel SOP. Wind only blocks the walk.',
      sop: 'fuel < 30 d isolate summer',
      not: '134 boxes is BIM, not a live count.',
    },
  }
}

function buildUtilities(telemetry, g, tempNow, temp6) {
  const tone = temp6 < -25 ? 'advisory' : 'nominal'
  return {
    blurb: 'RO / pumps · spec only · freeze + 23 kt',
    call: g.outdoorNow ? 'NO PUMP ACCESS' : deg(tempNow),
    kpis: [
      kpi('RO', '10 kL/d', 'SOP'),
      kpi('AIR T', deg(tempNow), 'LIVE'),
      kpi('6 h T', deg(temp6), 'LIVE', tone),
      kpi('PUMPS', g.outdoorNow ? 'LOCK' : 'OK', 'SOP', g.outdoorNow ? 'critical' : 'nominal'),
    ],
    compares: [{ label: 'AIR T', ...compare(tempNow, temp6, '°C', 'higher') }],
    meters: [meter('FREEZE', (-tempNow / 40) * 100, (-temp6 / 40) * 100)],
    sources: [
      { field: 'Flow / TDS', origin: 'none' },
      { field: 'Air T', origin: 'LIVE T2m' },
      { field: 'Access', origin: 'SOP 23 kt' },
    ],
    formula: 'design −40 °C · access 23 kt',
    sparkKey: 'temp',
    tone,
    why: {
      what: 'RO spec 10 kL/d. No permeate flow.',
      mechanism: 'Freeze watch is air T. Pumps follow 23 kt.',
      sop: '−40 °C design · 23 kt access',
      not: 'No TDS / flow series.',
    },
  }
}

function buildWater(telemetry, tempNow, temp6, date) {
  const meltSeason = date.getUTCMonth() === 11
  const tone = meltSeason && tempNow > -2 ? 'advisory' : 'nominal'
  return {
    blurb: 'Melt pond · UAV 2022 volumes, live T only',
    call: meltSeason ? deg(tempNow) : 'OFF-SEASON MESH',
    kpis: [
      kpi('AIR T', deg(tempNow), 'LIVE'),
      kpi('6 h', deg(temp6), 'LIVE'),
      kpi('WINDOW', meltSeason ? 'DEC' : '—', 'SOP', meltSeason ? 'advisory' : 'nominal'),
      kpi('VOL', 'UAV ’22', 'MODEL'),
    ],
    compares: [{ label: 'AIR T', ...compare(tempNow, temp6, '°C', 'higher') }],
    meters: [meter('MELT >−2', tempNow > -2 ? 70 : 12, temp6 > -2 ? 70 : 12)],
    sources: [
      { field: 'Air T', origin: 'LIVE T2m' },
      { field: 'Volume labels', origin: 'UAV Dec 2022' },
    ],
    formula: 'melt watch T > −2 °C in Dec',
    sparkKey: 'temp',
    tone,
    why: {
      what: 'Melt pond mesh from UAV Dec 2022.',
      mechanism: 'Live T only in December. Volume labels are survey frames.',
      sop: 'Dec melt window',
      not: 'Not today’s pond gauge.',
    },
  }
}

export function buildAssetAnalysis(id, telemetry, station = 'BHARATI', delayDays = 0, fleet = null) {
  const f = telemetry?.forecast || {}
  const g = outdoorGates(telemetry)
  const om = openMeteoStory(telemetry)
  const tempNow = n(telemetry?.ambient?.temp_c)
  const temp6 = n(f.temp_min_6h_c, tempNow)
  const solar = n(telemetry?.ambient?.solar_flux_w_m2)
  const phy = projectPhysics(station, telemetry, g, temp6)
  const clock = telemetry?.replay?.clock ? new Date(telemetry.replay.clock) : new Date()
  const fuelOps = fuelDecision(telemetry, station, clock, delayDays, fleet)
  const hours = weatherHours(telemetry)

  let spec
  if (id === 'FUEL') spec = buildFuel(telemetry, g, phy, fuelOps)
  else if (id === 'MICROGRID' || id === 'THERMAL') spec = buildMicrogrid(telemetry, g, phy)
  else if (id === 'STRUCTURE') spec = buildStructure(telemetry, g, phy, tempNow, temp6)
  else if (id === 'ROOF') spec = buildRoof(telemetry, g, solar)
  else if (id === 'COMMUNICATIONS') spec = buildComms(telemetry, g)
  else if (id === 'SAFETY') spec = buildSafety(telemetry, g, clock)
  else if (id === 'VEHICLES') spec = buildVehicles(telemetry, g)
  else if (id === 'CONTAINERS') spec = buildContainers(telemetry, g, phy)
  else if (id === 'UTILITIES') spec = buildUtilities(telemetry, g, tempNow, temp6)
  else if (id === 'WATER') spec = buildWater(telemetry, tempNow, temp6, clock)
  else spec = buildSafety(telemetry, g, clock)

  const chart = assetChart(id, station, phy, hours)

  return {
    id,
    blurb: spec.blurb,
    call: spec.call,
    kpis: spec.kpis,
    mix: spec.mix,
    mixTotal: spec.mixTotal,
    mixUnit: spec.mixUnit,
    ladder: spec.ladder,
    markerKt: spec.markerKt,
    marker6: spec.marker6,
    ladderMax: spec.ladderMax,
    compares: spec.compares,
    meters: spec.meters,
    sources: spec.sources,
    formula: spec.formula,
    why: spec.why,
    sopRules: (SOP_BY_ASSET[id] || SOP_BY_ASSET.SAFETY).map((rid) => SOP_RULES.find((r) => r.id === rid)).filter(Boolean),
    chart,
    om,
    forecast: f,
    gates: g,
    wx: { tempNow, temp6, gustNow: g.gustNow, gust6: g.gust6 },
    statusTone: spec.tone || toneFromStatus(g.status),
    phy,
  }
}

export function instrumentNote(id, telemetry, station, date) {
  const polar = polarState(station, date)
  const inst = { id, kind: id === 'COMMUNICATIONS' ? 'COMMS' : 'OUTDOOR' }
  return instrumentStatus(inst, telemetry, polar)
}
