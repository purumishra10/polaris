import type { ScenarioKey, StationId, StationTelemetry } from './types'

// This module simulates the data that would normally arrive over
// ws://localhost:8000/ws/telemetry from the Dev 2 HQ backend, which in turn
// polls the Dev 1 edge server at :8001. It lets the UI run and be
// demoed standalone. Swap `startTelemetryFeed` internals for a real
// WebSocket client once the backend is live (see api/telemetry.js).

interface StationPhysicsState {
  internal_temp_c: number
  ambient_temp_c: number
  wind_speed_knots: number
  solar_flux_w_m2: number
  fuel_liters: number
  science_online: boolean
  summer_wing_isolated: boolean
  hatch_lockdown: boolean
  aux_generator_active: boolean
  chp_thermal_output_kw: number
  aux_heater_kw: number
  activeScenario: ScenarioKey | null
  scenarioTicksLeft: number
}

const initialState = (station: StationId): StationPhysicsState => ({
  internal_temp_c: 21,
  ambient_temp_c: station === 'BHARATI' ? -12 : -28,
  wind_speed_knots: station === 'BHARATI' ? 18 : 10,
  solar_flux_w_m2: 220,
  fuel_liters: 42000,
  science_online: true,
  summer_wing_isolated: false,
  hatch_lockdown: false,
  aux_generator_active: false,
  chp_thermal_output_kw: 140,
  aux_heater_kw: 20,
  activeScenario: null,
  scenarioTicksLeft: 0,
})

const state: Record<StationId, StationPhysicsState> = {
  BHARATI: initialState('BHARATI'),
  MAITRI: initialState('MAITRI'),
}

const U_AREA = 3.1
const THERMAL_CAPACITANCE = 850

function step(station: StationId): StationTelemetry {
  const s = state[station]

  // Scenario dynamics
  if (s.activeScenario && s.scenarioTicksLeft > 0) {
    if (s.activeScenario === 'BLIZZARD_80KT') {
      s.wind_speed_knots = Math.min(95, s.wind_speed_knots + 6)
      s.ambient_temp_c = Math.max(-42, s.ambient_temp_c - 0.6)
    } else if (s.activeScenario === 'RESUPPLY_DELAY') {
      s.fuel_liters = Math.max(500, s.fuel_liters - 900)
    } else if (s.activeScenario === 'POLAR_NIGHT') {
      s.solar_flux_w_m2 = 0
      s.ambient_temp_c = Math.max(-55, s.ambient_temp_c - 0.3)
    }
    s.scenarioTicksLeft -= 1
    if (s.scenarioTicksLeft <= 0) s.activeScenario = null
  } else {
    // gentle drift back to baseline + noise
    s.wind_speed_knots += (station === 'BHARATI' ? 18 : 10) > s.wind_speed_knots ? 0.4 : -0.4
    s.wind_speed_knots = Math.max(2, s.wind_speed_knots + (Math.random() - 0.5) * 2)
    s.ambient_temp_c += ((station === 'BHARATI' ? -12 : -28) - s.ambient_temp_c) * 0.02
    s.solar_flux_w_m2 = Math.max(0, 220 + Math.sin(Date.now() / 40000) * 180)
  }

  // Heat loss physics
  const heatLoss = U_AREA * (s.internal_temp_c - s.ambient_temp_c) * (1 + 0.05 * Math.sqrt(Math.max(0, s.wind_speed_knots)))
  s.aux_heater_kw = s.internal_temp_c < 19 ? 35 : 20
  if (s.aux_generator_active) s.aux_heater_kw += 15

  const delta = (s.chp_thermal_output_kw + s.aux_heater_kw - heatLoss) / THERMAL_CAPACITANCE
  s.internal_temp_c += delta

  // Microgrid load
  const essential = 180
  const science = s.science_online ? 120 : 0
  const comfort = s.summer_wing_isolated ? 20 : 60
  const totalLoad = essential + science + comfort
  const chpCapacity = 600

  // Fuel balance
  const burnRate = totalLoad * 0.22 + s.aux_heater_kw * 0.1
  s.fuel_liters = Math.max(0, s.fuel_liters - burnRate / 1800) // per 2s tick approx
  const daysOfAutonomy = s.fuel_liters / (burnRate * 24)

  // Link status (simulated satellite latency 400-800ms)
  const latency = 400 + Math.round(Math.random() * 400)
  const linkHealth = s.wind_speed_knots > 70 ? 'DEGRADED' : 'ONLINE'

  // SOP rule matrix
  const actions: string[] = []
  let severity: 'NOMINAL' | 'ADVISORY' | 'CRITICAL' = 'NOMINAL'

  if (s.wind_speed_knots > 60) {
    severity = 'CRITICAL'
    actions.push('ACTION: Engage exterior hatch structural airlock sequence')
    actions.push('ACTION: Stow external weather sensors')
  }
  if (s.internal_temp_c < 16) {
    severity = 'CRITICAL'
    actions.push('ACTION: Spin up Standby Auxiliary Generator')
  }
  if (daysOfAutonomy < 30) {
    severity = daysOfAutonomy < 15 ? 'CRITICAL' : severity === 'CRITICAL' ? severity : 'ADVISORY'
    actions.push('ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)')
    actions.push('ACTION: Isolate unoccupied summer residential modules')
  }

  const anomalyScore = Math.min(
    1,
    Math.max(
      0,
      (s.wind_speed_knots > 60 ? 0.4 : 0) +
        (s.internal_temp_c < 16 ? 0.4 : 0) +
        (daysOfAutonomy < 30 ? 0.3 : 0) +
        Math.random() * 0.08,
    ),
  )

  return {
    station_id: station,
    timestamp: new Date().toISOString(),
    source: 'synthetic',
    confidence: 'modeled',
    ambient: {
      temp_c: Number(s.ambient_temp_c.toFixed(1)),
      wind_speed_knots: Number(s.wind_speed_knots.toFixed(1)),
      solar_flux_w_m2: Number(s.solar_flux_w_m2.toFixed(0)),
    },
    thermal: {
      internal_temp_c: Number(s.internal_temp_c.toFixed(2)),
      chp_thermal_output_kw: Number(s.chp_thermal_output_kw.toFixed(1)),
      aux_heater_kw: Number(s.aux_heater_kw.toFixed(1)),
      heat_loss_kw: Number(heatLoss.toFixed(1)),
    },
    microgrid: {
      total_load_kva: totalLoad,
      essential_load_kva: essential,
      science_load_kva: science,
      comfort_load_kva: comfort,
      chp_capacity_kva: chpCapacity,
    },
    fuel: {
      tank_level_liters: Number(s.fuel_liters.toFixed(0)),
      burn_rate_lph: Number(burnRate.toFixed(2)),
      days_of_autonomy: Number(daysOfAutonomy.toFixed(1)),
    },
    controls: {
      science_instruments_online: s.science_online,
      summer_wing_isolated: s.summer_wing_isolated,
      hatch_lockdown: s.hatch_lockdown,
      aux_generator_active: s.aux_generator_active,
    },
    link_status: {
      type: 'C-band/LEO',
      latency_ms: latency,
      health: linkHealth,
    },
    risk: {
      anomaly_score: Number(anomalyScore.toFixed(3)),
      is_anomaly: anomalyScore > 0.5,
      severity,
      prescribed_actions: actions,
    },
  }
}

export function injectScenarioSim(station: StationId, scenario: ScenarioKey, durationSeconds = 30) {
  const s = state[station]
  s.activeScenario = scenario
  s.scenarioTicksLeft = Math.round(durationSeconds / 2)
}

export function applyControl(station: StationId, control: keyof StationPhysicsState, value: boolean) {
  const s = state[station]
  if (control === 'science_online' || control === 'summer_wing_isolated' || control === 'hatch_lockdown' || control === 'aux_generator_active') {
    ;(s[control] as boolean) = value
  }
}

type Listener = (t: StationTelemetry) => void
const listeners: Record<StationId, Set<Listener>> = { BHARATI: new Set(), MAITRI: new Set() }
let intervalHandle: ReturnType<typeof setInterval> | null = null

export function subscribeTelemetry(station: StationId, cb: Listener) {
  listeners[station].add(cb)
  if (!intervalHandle) {
    intervalHandle = setInterval(() => {
      ;(['BHARATI', 'MAITRI'] as StationId[]).forEach((st) => {
        const reading = step(st)
        listeners[st].forEach((fn) => fn(reading))
      })
    }, 2000)
  }
  // emit an immediate first reading so the UI is never blank while waiting for the first tick
  cb(step(station))
  return () => {
    listeners[station].delete(cb)
  }
}

// --- Real backend hookup (use this once Dev 2's WebSocket server is running) ---
// Import connectTelemetrySocket from '../api/telemetry' and replace subscribeTelemetry body.
