import { SOP } from './decisions'

const TONE = {
  CRITICAL: 'critical',
  ADVISORY: 'advisory',
}

function n(value, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function fault(tone, title, reason) {
  return { tone, title, reason }
}

/**
 * Per-asset go/no-go for the 3D scene. Reasons are operator language,
 * not model jargon — this is what lights red on the mesh.
 */
export function assetFault(id, telemetry) {
  if (!telemetry || !id) return null

  const wind = n(telemetry.ambient?.wind_speed_knots)
  const days = n(telemetry.fuel?.days_of_autonomy, 999)
  const internal = n(telemetry.thermal?.internal_temp_c, 21)
  const load = n(telemetry.microgrid?.total_load_kva)
  const cap = n(telemetry.microgrid?.chp_capacity_kva, 750)
  const link = String(telemetry.link_status?.health ?? 'ONLINE').toUpperCase()
  const lock = telemetry.lockouts ?? {}
  const controls = telemetry.controls ?? {}
  const actions = telemetry.risk?.prescribed_actions ?? []
  const stow =
    actions.includes(SOP.STOW_SENSORS) ||
    wind > SOP.WIND_STRUCTURAL_KT ||
    lock.outdoor === 'LOCKED'

  switch (id) {
    case 'FUEL':
      if (days < SOP.FUEL_CRITICAL_DAYS) {
        return fault(
          TONE.CRITICAL,
          'FUEL STARVE',
          `${days.toFixed(0)} days of JET A-1 left — below the ${SOP.FUEL_CRITICAL_DAYS}-day SOP floor. Next ship window may close first.`,
        )
      }
      if (days < SOP.FUEL_ADVISORY_DAYS) {
        return fault(
          TONE.ADVISORY,
          'RESERVE WATCH',
          `${days.toFixed(0)} days of autonomy — under the ${SOP.FUEL_ADVISORY_DAYS}-day advisory. Shed comfort / science load.`,
        )
      }
      return null

    case 'MICROGRID':
      if (load > cap * 0.95) {
        return fault(
          TONE.CRITICAL,
          'CHP OVERLOAD',
          `Station load ${load.toFixed(0)} kVA against ${cap.toFixed(0)} kVA plant. Risk of brownout on essential bus.`,
        )
      }
      if (controls.science_instruments_online === false) {
        return fault(
          TONE.ADVISORY,
          'SCIENCE SHED',
          'Non-vital science payloads are offline to protect fuel and essential power.',
        )
      }
      if (controls.aux_generator_active) {
        return fault(
          TONE.ADVISORY,
          'STANDBY GEN ON',
          'Auxiliary generator is spinning — CHP thermal/electric margin is not enough on its own.',
        )
      }
      return null

    case 'THERMAL':
      if (internal < SOP.INTERNAL_TEMP_COLLAPSE_C) {
        return fault(
          TONE.CRITICAL,
          'THERMAL COLLAPSE',
          `Habitat ${internal.toFixed(1)} °C — below ${SOP.INTERNAL_TEMP_COLLAPSE_C} °C. Envelope loss exceeds CHP waste heat.`,
        )
      }
      if (internal < 18) {
        return fault(
          TONE.ADVISORY,
          'HEAT MARGIN THIN',
          `Internal ${internal.toFixed(1)} °C. Wind-driven loss is eating the comfort band.`,
        )
      }
      return null

    case 'STRUCTURE':
      if (wind > SOP.WIND_STRUCTURAL_KT) {
        return fault(
          TONE.CRITICAL,
          'STRUCTURAL WIND',
          `${wind.toFixed(0)} kt gust — above ${SOP.WIND_STRUCTURAL_KT} kt. Hatch lock and abort outdoor work.`,
        )
      }
      if (controls.hatch_lockdown) {
        return fault(
          TONE.ADVISORY,
          'HATCH LOCKED',
          'Exterior airlock sequence engaged. Station is in structural lockdown.',
        )
      }
      return null

    case 'ROOF':
      if (wind > SOP.WIND_STRUCTURAL_KT) {
        return fault(
          TONE.CRITICAL,
          'ROOF LOAD',
          `${wind.toFixed(0)} kt on the envelope. Sensors on the terrace should be stowed.`,
        )
      }
      if (stow) {
        return fault(
          TONE.ADVISORY,
          'EXTERIOR STOW',
          'Roof / weather sensors stowed under outdoor lockout or SOP.',
        )
      }
      return null

    case 'COMMUNICATIONS':
      if (link === 'OFFLINE') {
        return fault(
          TONE.CRITICAL,
          'UPLINK DEAD',
          'C-band / LEO health OFFLINE. HQ cannot command or confirm until the pass recovers.',
        )
      }
      if (link === 'DEGRADED') {
        return fault(
          TONE.ADVISORY,
          'UPLINK DEGRADED',
          `Link ${link} · ${n(telemetry.link_status?.latency_ms)} ms. Treat commands as delayed, not live.`,
        )
      }
      if (stow) {
        return fault(
          TONE.ADVISORY,
          'ANTENNA STOW',
          'Outdoor lockout — radome / field antennas are not in a serviceable state.',
        )
      }
      return null

    case 'SAFETY':
      if (lock.outdoor === 'LOCKED' || lock.heli === 'LOCKED') {
        return fault(
          TONE.CRITICAL,
          'ACCESS LOCKED',
          [
            lock.outdoor === 'LOCKED' ? 'Outdoor work locked.' : null,
            lock.heli === 'LOCKED' ? 'Heli ops locked.' : null,
            wind > 0 ? `Wind ${wind.toFixed(0)} kt.` : null,
          ]
            .filter(Boolean)
            .join(' '),
        )
      }
      if (controls.hatch_lockdown) {
        return fault(
          TONE.ADVISORY,
          'AIRLOCK HOLD',
          'Hatch lockdown is active. No exterior sorties.',
        )
      }
      return null

    case 'CONTAINERS':
      if (controls.summer_wing_isolated) {
        return fault(
          TONE.ADVISORY,
          'SUMMER WING ISOLATED',
          'Unoccupied modules isolated to cut comfort load and save JET A-1.',
        )
      }
      return null

    case 'UTILITIES':
      if (internal < SOP.INTERNAL_TEMP_COLLAPSE_C) {
        return fault(
          TONE.CRITICAL,
          'PLANT HEAT FAIL',
          `Utilities / CHP heat cannot hold the envelope (${internal.toFixed(1)} °C).`,
        )
      }
      if (controls.aux_generator_active) {
        return fault(
          TONE.ADVISORY,
          'UTILITIES ON STANDBY',
          'Aux generator is carrying plant load. Check CHP thermal output.',
        )
      }
      return null

    case 'VEHICLES':
      if (lock.convoy === 'LOCKED' || lock.outdoor === 'LOCKED') {
        return fault(
          TONE.CRITICAL,
          'VEHICLE HOLD',
          lock.convoy === 'LOCKED'
            ? 'Convoy / ice-edge movement locked. Crevasse or blizzard rule fired.'
            : 'Outdoor lockout — PistenBully / skiway movements are no-go.',
        )
      }
      return null

    case 'WATER':
      if (lock.field === 'LOCKED') {
        return fault(
          TONE.ADVISORY,
          'FIELD / POND HOLD',
          'Field campaigns locked. Melt-pond and lake work is no-go until outdoor clears.',
        )
      }
      return null

    default:
      return null
  }
}

export function faultColor(tone) {
  if (tone === TONE.CRITICAL) return '#ff3350'
  if (tone === TONE.ADVISORY) return '#ffb84d'
  return '#64d8a0'
}
