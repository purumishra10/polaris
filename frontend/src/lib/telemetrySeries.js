const MAX_POINTS = 48

export function sampleFromTelemetry(telemetry, at = Date.now()) {
  return {
    t: at,
    temp: Number(telemetry?.ambient?.temp_c ?? 0),
    wind: Number(telemetry?.ambient?.wind_speed_knots ?? 0),
    fuel: Number(telemetry?.fuel?.days_of_autonomy ?? 0),
    load: Number(telemetry?.microgrid?.total_load_kva ?? 0),
    solar: Number(telemetry?.ambient?.solar_flux_w_m2 ?? 0),
    essential: Number(telemetry?.microgrid?.essential_load_kva ?? 0),
    science: Number(telemetry?.microgrid?.science_load_kva ?? 0),
    comfort: Number(telemetry?.microgrid?.comfort_load_kva ?? 0),
    burn: Number(telemetry?.fuel?.burn_rate_lph ?? 0),
    habitat: Number(telemetry?.thermal?.internal_temp_c ?? 0),
    tank: Number(telemetry?.fuel?.tank_level_liters ?? 0),
    heatLoss: Number(telemetry?.thermal?.heat_loss_kw ?? 0),
  }
}

export function pushSample(history, telemetry, at = Date.now()) {
  const previous = Array.isArray(history) ? history : []
  const last = previous[previous.length - 1]
  if (last && at - last.t < 900) {
    return [...previous.slice(0, -1), sampleFromTelemetry(telemetry, at)].slice(
      -MAX_POINTS,
    )
  }
  return [...previous, sampleFromTelemetry(telemetry, at)].slice(-MAX_POINTS)
}

export function seedLiveSeries(station, telemetry) {
  const now = Date.now()
  const base = sampleFromTelemetry(telemetry, now)
  const cold = station === 'MAITRI' ? 2.4 : 1.3
  const windAmp = station === 'BHARATI' ? 5 : 3.2
  return Array.from({ length: 36 }, (_, index) => {
    const k = index / 35
    const wobble = Math.sin(index / 2.8)
    const loadSwing = Math.sin(index / 1.7) * 14
    const essential = Math.max(80, base.essential + Math.sin(index / 2.4) * 8)
    const science = Math.max(20, base.science + Math.sin(index / 1.9) * 10)
    const comfort = Math.max(10, base.comfort + Math.sin(index / 1.5) * 12)
    return {
      ...base,
      t: now - (35 - index) * 10 * 60 * 1000,
      temp: base.temp + wobble * cold,
      wind: Math.max(2, base.wind + Math.sin(index / 2.1) * windAmp),
      fuel: base.fuel + (35 - index) * 0.04,
      load: essential + science + comfort,
      solar: Math.max(0, base.solar + Math.sin(k * Math.PI) * 40 - 12),
      essential,
      science,
      comfort,
      burn: Math.max(40, base.burn + Math.sin(index / 2.2) * 6 + loadSwing * 0.22),
      habitat: base.habitat + Math.sin(index / 3.1) * 0.8,
      tank: Math.max(0, base.tank + (35 - index) * 18),
      heatLoss: Math.max(40, base.heatLoss + Math.sin(index / 2.6) * 8),
    }
  })
}

export function seedStormSeries(telemetry) {
  const now = Date.now()
  const end = sampleFromTelemetry(telemetry, now)
  return Array.from({ length: 36 }, (_, index) => {
    const k = index / 35
    return {
      ...end,
      t: now - (35 - index) * 20 * 60 * 1000,
      temp: -8.4 - k * 3.6,
      wind: 16 + k * 64,
      fuel: end.fuel + (1 - k) * 1.2,
      load: 430 + k * 90,
      solar: Math.max(4, 40 * (1 - k)),
    }
  })
}

export function formatSeriesClock(t) {
  const date = new Date(t)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes(),
  ).padStart(2, '0')}`
}

export function applyLiveDrift(telemetry, now = Date.now()) {
  if (!telemetry || telemetry?.replay?.active) return telemetry

  const t = now / 1000
  const src = String(telemetry.source || '').toUpperCase()
  const liveWeather =
    Boolean(src) && src !== 'SYNTHETIC' && !src.includes('SYNTHETIC')
  // Keep Open-Meteo / NASA means, but still show sensor jitter so plots move.
  const weatherAmp = liveWeather ? 0.45 : 1

  const temp = Number(telemetry.ambient?.temp_c ?? -14)
  const wind = Number(telemetry.ambient?.wind_speed_knots ?? 18)
  const solar = Number(telemetry.ambient?.solar_flux_w_m2 ?? 80)
  const essential = Number(telemetry.microgrid?.essential_load_kva ?? 180)
  const science = Number(telemetry.microgrid?.science_load_kva ?? 120)
  const comfort = Number(telemetry.microgrid?.comfort_load_kva ?? 60)
  const tank = Number(telemetry.fuel?.tank_level_liters ?? 90000)
  const habitat = Number(telemetry.thermal?.internal_temp_c ?? 20)
  const heatLoss = Number(telemetry.thermal?.heat_loss_kw ?? 180)
  const aux = Number(telemetry.thermal?.aux_heater_kw ?? 0)

  const nextEssential = Math.max(80, essential + Math.sin(t / 6.1) * 9 + Math.sin(t / 1.9) * 3.2)
  const nextScience = Math.max(12, science + Math.sin(t / 3.7) * 11 + Math.sin(t / 1.15) * 4)
  const nextComfort = Math.max(8, comfort + Math.sin(t / 4.8) * 14 + Math.sin(t / 1.55) * 5)
  const nextLoad = nextEssential + nextScience + nextComfort
  const nextBurn = Math.max(36, nextLoad * 0.22 + aux * 0.1 + Math.sin(t / 3.4) * 4.8)
  const nextHabitat = habitat + Math.sin(t / 5.2) * 0.9 + Math.sin(t / 1.35) * 0.28

  return {
    ...telemetry,
    timestamp: new Date(now).toISOString(),
    ambient: {
      ...telemetry.ambient,
      temp_c: temp + Math.sin(t / 3.1) * 0.55 * weatherAmp + Math.sin(t / 0.85) * 0.12,
      wind_speed_knots: Math.max(
        2,
        wind + (Math.sin(t / 2.05) * 2.4 + Math.sin(t / 0.52) * 0.7) * weatherAmp,
      ),
      solar_flux_w_m2: Math.max(
        0,
        solar + (Math.sin(t / 5.5) * 18 + Math.sin(t / 1.4) * 4) * weatherAmp,
      ),
    },
    microgrid: {
      ...telemetry.microgrid,
      total_load_kva: nextLoad,
      essential_load_kva: nextEssential,
      science_load_kva: nextScience,
      comfort_load_kva: nextComfort,
    },
    fuel: {
      ...telemetry.fuel,
      burn_rate_lph: nextBurn,
      days_of_autonomy: Math.max(1, tank / (nextBurn * 24)),
    },
    thermal: {
      ...telemetry.thermal,
      internal_temp_c: nextHabitat,
      heat_loss_kw: Math.max(20, heatLoss + Math.sin(t / 2.8) * 7),
    },
  }
}
