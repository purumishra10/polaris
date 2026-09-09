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
  return Array.from({ length: 36 }, (_, index) => {
    const k = index / 35
    const wobble = Math.sin(index / 2.8)
    return {
      ...base,
      t: now - (35 - index) * 10 * 60 * 1000,
      temp: base.temp + wobble * cold,
      wind: Math.max(2, base.wind + Math.sin(index / 2.1) * (station === 'BHARATI' ? 5 : 3.2)),
      fuel: base.fuel + (35 - index) * 0.04,
      load: base.load + Math.sin(index / 1.7) * 14,
      solar: Math.max(0, base.solar + Math.sin(k * Math.PI) * 40 - 12),
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
  const src = String(telemetry.source || '').toUpperCase()
  if (src && src !== 'SYNTHETIC' && !src.includes('SYNTHETIC')) {
    return {
      ...telemetry,
      timestamp: new Date(now).toISOString(),
    }
  }
  const t = now / 1000
  const temp = Number(telemetry.ambient?.temp_c ?? -14)
  const wind = Number(telemetry.ambient?.wind_speed_knots ?? 18)
  const solar = Number(telemetry.ambient?.solar_flux_w_m2 ?? 80)
  const load = Number(telemetry.microgrid?.total_load_kva ?? 360)
  const fuel = Number(telemetry.fuel?.days_of_autonomy ?? 200)
  const burn = Number(telemetry.fuel?.burn_rate_lph ?? 140)
  return {
    ...telemetry,
    timestamp: new Date(now).toISOString(),
    ambient: {
      ...telemetry.ambient,
      temp_c: temp + Math.sin(t / 3.1) * 0.42 + Math.sin(t / 0.85) * 0.09,
      wind_speed_knots: Math.max(
        2,
        wind + Math.sin(t / 2.05) * 2.1 + Math.sin(t / 0.52) * 0.45,
      ),
      solar_flux_w_m2: Math.max(
        0,
        solar + Math.sin(t / 5.5) * 18 + Math.sin(t / 1.4) * 4,
      ),
    },
    microgrid: {
      ...telemetry.microgrid,
      total_load_kva: Math.max(180, load + Math.sin(t / 4.2) * 14),
      essential_load_kva: Math.max(
        80,
        Number(telemetry.microgrid?.essential_load_kva ?? 250) +
          Math.sin(t / 6.1) * 4,
      ),
      science_load_kva: Math.max(
        20,
        Number(telemetry.microgrid?.science_load_kva ?? 120) +
          Math.sin(t / 3.7) * 6,
      ),
    },
    fuel: {
      ...telemetry.fuel,
      days_of_autonomy: Math.max(1, fuel - (t % 8000) * 0.00002),
      burn_rate_lph: Math.max(40, burn + Math.sin(t / 3.4) * 3.2),
    },
    thermal: {
      ...telemetry.thermal,
      internal_temp_c:
        Number(telemetry.thermal?.internal_temp_c ?? 20) +
        Math.sin(t / 7.2) * 0.12,
    },
  }
}
