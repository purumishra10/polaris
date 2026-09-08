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

export function climateLook(telemetry, station = 'BHARATI') {
  const temp = telemetry?.ambient?.temp_c ?? -14
  const wind = telemetry?.ambient?.wind_speed_knots ?? 18
  const solar = telemetry?.ambient?.solar_flux_w_m2 ?? 120
  const outdoorLocked = telemetry?.lockouts?.outdoor === 'LOCKED'

  const cold = clamp((-temp - 4) / 28)
  const gale = clamp((wind - 14) / 66)
  const dark = clamp(1 - solar / 160) * 0.62 + cold * 0.38
  const whiteout = clamp(gale * 0.75 + (outdoorLocked ? 0.2 : 0))

  const isBharati = station === 'BHARATI'
  const sunBase = isBharati ? [92, 38, 54] : [68, 42, 38]
  const sunY = lerp(sunBase[1], 5.5, dark)
  const sun = [sunBase[0], sunY, sunBase[2] * (1 - dark * 0.25)]

  const skyDay = isBharati ? '#9eb4c4' : '#a8bac6'
  const skyNight = '#0d1520'
  const skyCold = '#6a8498'
  const background = mixHex(mixHex(skyDay, skyCold, cold), skyNight, dark)

  const fogDay = isBharati ? '#b7c6d2' : '#b5c4ce'
  const fogStorm = '#8ea0ae'
  const fog = mixHex(mixHex(fogDay, fogStorm, gale), '#1c2834', dark * 0.7)

  const fogNear = lerp(isBharati ? 180 : 120, 8, whiteout)
  const fogFar = lerp(isBharati ? 540 : 320, 55, whiteout)

  return {
    temp,
    wind,
    solar,
    cold,
    gale,
    dark,
    whiteout,
    sun,
    background,
    fog,
    fogNear,
    fogFar,
    sunIntensity: lerp(isBharati ? 3.35 : 2.7, 0.18, Math.max(dark, gale * 0.55)),
    ambientIntensity: lerp(0.3, 0.08, dark),
    hemiSky: mixHex('#d7e4ee', '#3d4e5c', Math.max(dark, cold)),
    hemiGround: mixHex('#8a9aa6', '#1a2228', cold),
    fillColor: mixHex('#9eb6c8', '#4a6274', dark),
    fillIntensity: lerp(0.7, 0.18, dark),
    turbidity: lerp(2.4, 8.5, gale),
    rayleigh: lerp(0.42, 0.12, dark),
    mieCoefficient: lerp(0.005, 0.028, gale),
    vignette: lerp(0.42, 0.78, Math.max(dark, gale * 0.5)),
    bloom: lerp(0.38, 0.08, dark),
    sparkleCount: 40 + Math.round(gale * 8) * 24 + Math.round(cold * 4) * 16,
    sparkleSpeed: 0.15 + gale * 2.8,
    sparkleOpacity: 0.2 + gale * 0.55,
    snowCount:
      gale > 0.08 || cold > 0.35
        ? 200 + Math.round(gale * 10) * 180
        : 0,
  }
}

export function formatReplayClock(iso) {
  if (!iso) return 'PRESENT'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.replace('T', ' ').slice(0, 16)
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ]
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}  ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}
