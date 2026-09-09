import { polarState } from './decisions'

/** Published occupancy. Plant kVA for current Maitri is not in the papers. */
export const OCCUPANCY = {
  BHARATI: { winter: 47, summer: 72, source: 'AL/02' },
  MAITRI: { winter: 25, summer: 65, source: 'AL/03 · 43-ISEA' },
  MAITRI_II: { winter: 40, summer: 140, source: 'Maitri-II brief 25 Jul 2024' },
}

function isWinter(station, date) {
  const polar = polarState(station, date)
  const month = date.getUTCMonth() + 1
  if (polar.phase === 'NIGHT') return true
  if (polar.phase === 'DAY') return false
  return month >= 4 && month <= 9
}

function burnFromLoad(loadKva, auxKw = 0) {
  return Math.max(12, loadKva * 0.22 + auxKw * 0.1)
}

function autonomy(liters, burnLph) {
  if (!burnLph) return 0
  return liters / (burnLph * 24)
}

export function occupancyNow(station, date, plantMode) {
  const winter = isWinter(station, date)
  if (station === 'MAITRI' && plantMode === 'MAITRI_II') {
    const row = OCCUPANCY.MAITRI_II
    return {
      now: winter ? row.winter : row.summer,
      winter: row.winter,
      summer: row.summer,
      source: row.source,
      winterSeason: winter,
    }
  }
  const row = OCCUPANCY[station] ?? OCCUPANCY.BHARATI
  return {
    now: winter ? row.winter : row.summer,
    winter: row.winter,
    summer: row.summer,
    source: row.source,
    winterSeason: winter,
  }
}

/**
 * Same weather. Different plant. Maitri-II numbers are planned/synthetic
 * from the 25 Jul 2024 brief. Current Maitri kVA is not published.
 */
export function applyPlantDoctrine(telemetry, station, plantMode, date) {
  if (!telemetry) return telemetry
  const occ = occupancyNow(station, date, plantMode)
  const aux = Number(telemetry.thermal?.aux_heater_kw ?? 0)

  if (station !== 'MAITRI') {
    return {
      ...telemetry,
      occupancy: occ.now,
      plant: {
        mode: 'CURRENT',
        tag: 'SYNTHETIC · occupancy AL/02',
      },
    }
  }

  if (plantMode !== 'MAITRI_II') {
    return {
      ...telemetry,
      occupancy: occ.now,
      plant: {
        mode: 'CURRENT',
        tag: 'SYNTHETIC · occupancy AL/03 · plant kVA not published',
      },
    }
  }

  const isolated = occ.winterSeason
  const essential = isolated ? 220 : 280
  const science = isolated ? 80 : 120
  const comfort = isolated ? 20 : 160
  const total = essential + science + comfort
  const tank = 600000
  const burn = burnFromLoad(total, aux)
  const days = autonomy(tank, burn)

  return {
    ...telemetry,
    occupancy: occ.now,
    plant: {
      mode: 'MAITRI_II',
      tag: 'PLANNED / SYNTHETIC plant · Maitri-II brief 25 Jul 2024',
    },
    controls: {
      ...telemetry.controls,
      summer_wing_isolated: isolated,
    },
    microgrid: {
      ...telemetry.microgrid,
      essential_load_kva: essential,
      science_load_kva: science,
      comfort_load_kva: comfort,
      total_load_kva: total,
      chp_capacity_kva: 750,
    },
    fuel: {
      ...telemetry.fuel,
      tank_level_liters: tank,
      burn_rate_lph: burn,
      days_of_autonomy: days,
    },
  }
}
