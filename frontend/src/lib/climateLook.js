function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255
  const ag = (pa >> 8) & 255
  const ab = pa & 255
  const br = (pb >> 16) & 255
  const bg = (pb >> 8) & 255
  const bb = pb & 255
  const r = Math.round(lerp(ar, br, t))
  const g = Math.round(lerp(ag, bg, t))
  const bch = Math.round(lerp(ab, bb, t))
  return `#${((r << 16) | (g << 8) | bch).toString(16).padStart(6, '0')}`
}

function quantize(value, step = 0.1) {
  return Math.round(value / step) * step
}

/**
 * Derive the visual climate from telemetry.
 * `drivers` lets callers pass smoothed ambient values so the scene eases
 * between states instead of snapping when a scenario is injected.
 */
export function climateLook(telemetry, station = 'BHARATI', drivers = null) {
  const temp = drivers?.temp ?? telemetry?.ambient?.temp_c ?? -14
  const wind = drivers?.wind ?? telemetry?.ambient?.wind_speed_knots ?? 18
  const solar = drivers?.solar ?? telemetry?.ambient?.solar_flux_w_m2 ?? 120
  const locked =
    drivers?.locked ?? (telemetry?.lockouts?.outdoor === 'LOCKED' ? 1 : 0)
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'
  const days = telemetry?.fuel?.days_of_autonomy ?? 999

  const cold = clamp((-temp - 4) / 28)
  const gale = clamp((wind - 14) / 66)
  // night: 0 in polar daylight, 1 when solar flux is gone (polar night)
  const night = clamp(1 - solar / 70)
  // A blizzard is a gloomy grey whiteout rather than a black night, so the
  // storm tempers how far the light drops.
  const dark = clamp(night * (1 - gale * 0.5) * 0.75 + cold * 0.25)
  const whiteout = clamp(gale * 0.75 + locked * 0.2)
  // Fuel-starvation pressure used by the resupply alarm visuals
  const scarcity = clamp((30 - days) / 18)

  const isBharati = station === 'BHARATI'
  const sunBase = isBharati ? [92, 38, 54] : [68, 42, 38]
  // Sun sinks below the horizon as the polar night sets in; during a storm it
  // stays up behind the overcast so the sky reads as grey, not sunset.
  const nightEff = clamp((night * (1 - gale * 0.6)) / 0.8)
  const sunY = lerp(sunBase[1], -6, nightEff)
  const sun = [sunBase[0], sunY, sunBase[2] * (1 - dark * 0.25)]

  const skyDay = isBharati ? '#9eb4c4' : '#a8bac6'
  const skyNight = '#04070e'
  const skyCold = '#6a8498'
  const skyStorm = '#7d8b96'
  const background = mixHex(
    mixHex(mixHex(skyDay, skyCold, cold), skyStorm, gale * 0.8),
    skyNight,
    dark,
  )

  const fogDay = isBharati ? '#b7c6d2' : '#b5c4ce'
  const fogStorm = '#8ea0ae'
  const fog = mixHex(
    mixHex(fogDay, fogStorm, gale),
    '#0b1219',
    Math.max(dark * 0.7, night * 0.85),
  )

  // Clear-day visibility runs out well past the far-field terrain so there is
  // never a hard edge; a whiteout pulls it right in around the station.
  const fogNear = lerp(isBharati ? 320 : 200, 8, whiteout)
  const fogFar = lerp(isBharati ? 2600 : 1400, 55, whiteout)

  // Sky features
  const clearSky = clamp(1 - gale * 1.3) * clamp(1 - whiteout)
  const starVisibility = night * night * clearSky
  const moon = clamp((night - 0.35) / 0.45) * clamp(1 - gale * 1.1)
  const aurora = clamp((night - 0.5) / 0.4) * clearSky

  return {
    temp,
    wind,
    solar,
    cold,
    gale,
    dark,
    night,
    whiteout,
    scarcity,
    severity,
    sun,
    sunVisible: sunY > 1.5,
    sunOpacity: clamp(1 - night * 1.25) * clamp(1 - gale * 0.6),
    background,
    fog,
    fogNear,
    fogFar,
    sunIntensity: lerp(isBharati ? 2.85 : 2.4, 0.05, Math.max(dark, gale * 0.55)),
    ambientIntensity: lerp(0.3, 0.05, dark),
    hemiSky: mixHex('#d7e4ee', '#1f2b38', Math.max(dark, cold)),
    hemiGround: mixHex('#6a5a48', '#10161b', Math.max(cold, night)),
    fillColor: mixHex('#9eb6c8', '#2f4256', dark),
    fillIntensity: lerp(0.7, 0.1, dark),
    turbidity: lerp(2.4, 11, gale),
    rayleigh: lerp(0.42, 0.06, Math.max(dark, gale * 0.6)),
    mieCoefficient: lerp(0.005, 0.04, gale),
    // Quantised so post-processing passes are not rebuilt every frame
    vignette: quantize(lerp(0.42, 0.8, Math.max(dark, gale * 0.5))),
    bloom: quantize(lerp(0.38, 0.6, night) - gale * 0.15),
    cloudOpacity: clamp(1 - night * 0.75),
    // Night sky
    starVisibility,
    moon,
    moonLight: moon * 0.55,
    aurora,
    stationGlow: clamp((night - 0.25) / 0.5) * (1 - gale * 0.3),
    // Precipitation
    sparkleCount: 40 + Math.round(gale * 8) * 24 + Math.round(cold * 4) * 16,
    sparkleSpeed: 0.15 + gale * 2.8,
    sparkleOpacity: 0.2 + gale * 0.55,
    snowCount:
      gale > 0.03 || cold > 0.3
        ? Math.round(120 + Math.pow(gale, 1.5) * 5000 + cold * 220)
        : 0,
    groundSnowCount:
      gale > 0.3 ? Math.round(((gale - 0.3) / 0.7) * 2600) : 0,
  }
}

export function featureAlerts(station, telemetry) {
  if (!telemetry) return []

  const wind = telemetry.ambient?.wind_speed_knots ?? 0
  const temp = telemetry.ambient?.temp_c ?? 0
  const days = telemetry.fuel?.days_of_autonomy ?? 999
  const internal = telemetry.thermal?.internal_temp_c ?? 20
  const severity = telemetry.risk?.severity ?? 'NOMINAL'
  const outdoor = telemetry.lockouts?.outdoor === 'LOCKED'
  const heli = telemetry.lockouts?.heli === 'LOCKED'
  const hatch = telemetry.controls?.hatch_lockdown
  const scienceOff = telemetry.controls?.science_instruments_online === false
  const fuelLow = days < 30
  const structural = wind >= 60 || hatch
  const gale = wind >= 23
  const freeze = temp <= -20
  const thermalRisk = internal < 16

  const ids =
    station === 'BHARATI'
      ? [
          'STRUCTURE',
          'ROOF',
          'FUEL',
          'MICROGRID',
          'COMMUNICATIONS',
          'SAFETY',
          'CONTAINERS',
          'UTILITIES',
          'VEHICLES',
          'WATER',
        ]
      : [
          'STRUCTURE',
          'FUEL',
          'MICROGRID',
          'THERMAL',
          'COMMUNICATIONS',
          'SAFETY',
        ]

  const alerts = []

  const push = (id, label, level) => {
    alerts.push({ id, label, level })
  }

  for (const id of ids) {
    if (id === 'STRUCTURE' && structural) {
      push(id, 'HULL RISK', 'CRITICAL')
    } else if (id === 'ROOF' && gale) {
      push(id, 'GALE LOAD', wind >= 60 ? 'CRITICAL' : 'ADVISORY')
    } else if (id === 'FUEL' && fuelLow) {
      push(id, 'FUEL DAYS', days < 15 ? 'CRITICAL' : 'ADVISORY')
    } else if (id === 'MICROGRID' && (thermalRisk || severity === 'CRITICAL')) {
      push(id, 'GRID STRESS', 'CRITICAL')
    } else if (id === 'THERMAL' && (thermalRisk || gale)) {
      push(id, 'HEAT LOSS', thermalRisk ? 'CRITICAL' : 'ADVISORY')
    } else if (id === 'COMMUNICATIONS' && (gale || scienceOff)) {
      push(id, 'STOW / LINK', wind >= 60 ? 'CRITICAL' : 'ADVISORY')
    } else if (id === 'SAFETY' && (outdoor || structural || heli)) {
      push(id, outdoor ? 'OUTDOOR LOCK' : 'HELI LOCK', 'CRITICAL')
    } else if (id === 'CONTAINERS' && outdoor) {
      push(id, 'SORTIE LOCK', 'CRITICAL')
    } else if (id === 'VEHICLES' && (outdoor || gale)) {
      push(id, 'CONVOY LOCK', wind >= 50 ? 'CRITICAL' : 'ADVISORY')
    } else if (id === 'WATER' && freeze) {
      push(id, 'FREEZE RISK', 'ADVISORY')
    } else if (id === 'UTILITIES' && gale) {
      push(id, 'EXPOSED RUN', 'ADVISORY')
    }
  }

  return alerts
}

export function actionToControls(action) {
  const text = String(action || '').toLowerCase()
  if (text.includes('hatch') || text.includes('airlock')) {
    return { hatch_lockdown: true }
  }
  if (text.includes('auxiliary generator') || text.includes('standby')) {
    return { aux_generator_active: true }
  }
  if (text.includes('shed') || text.includes('scientific') || text.includes('stow')) {
    return { science_instruments_online: false }
  }
  if (text.includes('isolate') || text.includes('summer')) {
    return { summer_wing_isolated: true }
  }
  return null
}

export function formatReplayClock(iso) {
  if (!iso) return 'SIMULATION'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.replace('T', ' ').slice(0, 16)
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}  ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}
