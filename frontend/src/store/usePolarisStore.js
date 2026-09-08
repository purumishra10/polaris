import { create } from 'zustand'
import {
  applyControls as apiApplyControls,
  injectScenario as apiInjectScenario,
  switchStation as apiSwitchStation,
  replayAug2018 as apiReplayAug2018,
  setClock as apiSetClock,
  liveNow as apiLiveNow,
  updateStationControls,
} from '../api/telemetry'
import { actionToControls } from '../lib/climateLook'

const createDefaultTelemetry = (station) => ({
  station_id: station,
  timestamp: new Date().toISOString(),
  source: 'synthetic',
  confidence: 'modeled',

  ambient: {
    temp_c: -16.4,
    wind_speed_knots: 24.2,
    solar_flux_w_m2: 145.0,
  },

  thermal: {
    internal_temp_c: 20.8,
    chp_thermal_output_kw: 380.0,
    aux_heater_kw: 0.0,
    heat_loss_kw: 185.0,
  },

  microgrid: {
    total_load_kva: 480.0,
    essential_load_kva: 250.0,
    science_load_kva: 120.0,
    comfort_load_kva: 110.0,
    chp_capacity_kva: 600.0,
  },

  fuel: {
    tank_level_liters: 512000,
    burn_rate_lph: 128.5,
    days_of_autonomy: 166.0,
  },

  controls: {
    science_instruments_online: true,
    summer_wing_isolated: false,
    hatch_lockdown: false,
    aux_generator_active: false,
  },

  link_status: {
    type: 'C-band/LEO',
    latency_ms: 480,
    health: 'ONLINE',
  },

  risk: {
    anomaly_score: 0.062,
    is_anomaly: false,
    severity: 'NOMINAL',
    prescribed_actions: [],
  },

  replay: {
    active: false,
    scenario_id: null,
    clock: null,
    citation: null,
    source_type: null,
    occupancy: null,
    note: null,
    mode: 'LIVE',
    polar: null,
    season: null,
    voyage_air: null,
    voyage_sea: null,
    isolation: null,
    hazards: [],
    facts: [],
    wind_tag: null,
    temp_tag: null,
  },

  lockouts: {
    outdoor: 'OPEN',
    heli: 'OPEN',
    convoy: 'OPEN',
    field: 'OPEN',
    reasons: [],
  },
})

export const usePolarisStore = create((set, get) => ({
  selectedStation: 'BHARATI',
  selectedSubsystem: null,
  isThermalView: false,
  linkMode: 'REALTIME', // 'REALTIME' | 'STRESS_TEST'
  cameraPreset: 'droneAerial',
  cameraTick: 0,
  flySource: 'preset',
  flyComplete: true,

  connection: {
    status: 'CONNECTING',
    latency_ms: 480,
    last_update: null,
  },

  telemetry: {
    BHARATI: createDefaultTelemetry('BHARATI'),
    MAITRI: createDefaultTelemetry('MAITRI'),
  },

  setSelectedStation: async (station) => {
    if (!['BHARATI', 'MAITRI'].includes(station)) {
      console.error(`[Twin] Unknown station: ${station}`)
      return
    }

    set((state) => ({
      selectedStation: station,
      selectedSubsystem: null,
      cameraPreset: station === 'BHARATI' ? 'droneAerial' : 'hero',
      flySource: 'preset',
      cameraTick: state.cameraTick + 1,
      flyComplete: true,
    }))

    try {
      await apiSwitchStation(station)
    } catch {
      // Backend may be offline or in fallback mode
    }
  },

  setSelectedSubsystem: (subsystem) =>
    set((state) => ({
      selectedSubsystem: subsystem,
      flySource: subsystem ? 'asset' : state.flySource,
      cameraTick: subsystem ? state.cameraTick + 1 : state.cameraTick,
      flyComplete: !subsystem,
    })),

  setCameraPreset: (preset) =>
    set((state) => ({
      cameraPreset: preset,
      selectedSubsystem: null,
      flySource: 'preset',
      cameraTick: state.cameraTick + 1,
      flyComplete: true,
    })),

  markFlyComplete: () =>
    set({
      flyComplete: true,
    }),

  setThermalView: (enabled) => set({ isThermalView: enabled }),

  toggleThermalView: () =>
    set((state) => ({ isThermalView: !state.isThermalView })),

  setLinkMode: (mode) => set({ linkMode: mode }),

  setConnectionStatus: (conn) =>
    set((state) => ({
      connection: {
        ...state.connection,
        ...conn,
        last_update: new Date().toISOString(),
      },
    })),

  // Called whenever live telemetry arrives from WebSocket or polling
  setTelemetryPacket: (packet) => {
    if (!packet || !packet.station_id) return
    const station = packet.station_id
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        [station]: {
          ...state.telemetry[station],
          ...packet,
          timestamp: packet.timestamp || new Date().toISOString(),
        },
      },
      connection: {
        ...state.connection,
        latency_ms: packet.link_status?.latency_ms || state.connection.latency_ms,
        last_update: new Date().toISOString(),
      },
    }))
  },

  // Apply station mitigation controls
  executeMitigation: async (actionText) => {
    const station = get().selectedStation

    const patch = {}
    if (actionText.includes('Hatch') || actionText.includes('hatch')) {
      patch.hatch_lockdown = true
    }
    if (actionText.includes('Science') || actionText.includes('scientific')) {
      patch.science_instruments_online = false
    }
    if (actionText.includes('Summer') || actionText.includes('summer')) {
      patch.summer_wing_isolated = true
    }
    if (actionText.includes('Generator') || actionText.includes('auxiliary')) {
      patch.aux_generator_active = true
    }

    // Optimistic update
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        [station]: {
          ...state.telemetry[station],
          controls: {
            ...state.telemetry[station].controls,
            ...patch,
          },
        },
      },
    }))

    try {
      await apiApplyControls(patch)
    } catch (err) {
      console.warn(
        'Backend controls POST failed, operating in optimistic mode:',
        err,
      )
    }
  },

  // Inject pitch demo scenario
  triggerScenario: async (scenarioKey) => {
    const station = get().selectedStation
    const base = createDefaultTelemetry(station)

    try {
      if (scenarioKey !== 'NOMINAL') {
        await apiInjectScenario(scenarioKey, 60)
      }
    } catch (err) {
      console.warn(
        'Backend scenario POST failed, applying local simulation:',
        err,
      )
    }

    if (scenarioKey === 'BLIZZARD_80KT') {
      set((state) => ({
        telemetry: {
          ...state.telemetry,
          [station]: {
            ...state.telemetry[station],
            ambient: {
              temp_c: -36.5,
              wind_speed_knots: 84.0,
              solar_flux_w_m2: 15.0,
            },
            thermal: {
              ...state.telemetry[station].thermal,
              internal_temp_c: 14.8,
              heat_loss_kw: 410.0,
              aux_heater_kw: 140.0,
            },
            fuel: {
              ...state.telemetry[station].fuel,
              burn_rate_lph: 195.0,
              days_of_autonomy: 109.0,
            },
            risk: {
              anomaly_score: -0.38,
              is_anomaly: true,
              severity: 'CRITICAL',
              prescribed_actions: [
                'ACTION: Engage exterior hatch structural airlock sequence',
                'ACTION: Stow external weather sensors',
                'ACTION: Spin up Standby Auxiliary Generator',
              ],
            },
          },
        },
      }))
    } else if (scenarioKey === 'RESUPPLY_DELAY') {
      set((state) => ({
        telemetry: {
          ...state.telemetry,
          [station]: {
            ...state.telemetry[station],
            fuel: {
              tank_level_liters: 48000,
              burn_rate_lph: 145.0,
              days_of_autonomy: 13.8,
            },
            risk: {
              anomaly_score: -0.22,
              is_anomaly: true,
              severity: 'CRITICAL',
              prescribed_actions: [
                'ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)',
                'ACTION: Isolate unoccupied summer residential modules',
              ],
            },
          },
        },
      }))
    } else if (scenarioKey === 'POLAR_NIGHT') {
      set((state) => ({
        telemetry: {
          ...state.telemetry,
          [station]: {
            ...state.telemetry[station],
            ambient: {
              temp_c: -28.0,
              wind_speed_knots: 32.0,
              solar_flux_w_m2: 0.0,
            },
            thermal: {
              ...state.telemetry[station].thermal,
              aux_heater_kw: 90.0,
              heat_loss_kw: 290.0,
            },
            risk: {
              anomaly_score: -0.08,
              is_anomaly: false,
              severity: 'ADVISORY',
              prescribed_actions: [
                'ACTION: Isolate unoccupied summer residential modules',
              ],
            },
          },
        },
      }))
    } else if (scenarioKey === 'NOMINAL') {
      set((state) => ({
        telemetry: {
          ...state.telemetry,
          [station]: base,
        },
      }))
    }
  },

  injectScenario: async (scenario, durationSeconds = 60) => {
    if (scenario === 'NOMINAL') {
      try {
        await apiLiveNow()
      } catch (error) {
        console.warn('[Twin] Live now failed during NOMINAL reset', error)
      }
      return get().triggerScenario('NOMINAL')
    }

    try {
      return await apiInjectScenario(scenario, durationSeconds)
    } catch (error) {
      console.error('[Twin] Scenario injection failed', error)
      throw error
    }
  },

  replayAug2018: async () => {
    try {
      const result = await apiReplayAug2018()
      set((state) => ({
        selectedStation: 'BHARATI',
        selectedSubsystem: null,
        cameraPreset: 'droneAerial',
        flySource: 'preset',
        cameraTick: state.cameraTick + 1,
        flyComplete: true,
      }))
      console.log('[Twin] Replay 2018-08-05:', result)
      return result
    } catch (error) {
      console.error('[Twin] Replay failed', error)
      throw error
    }
  },

  setClock: async (clock) => {
    try {
      const result = await apiSetClock(clock)
      console.log('[Twin] Clock set:', result)
      return result
    } catch (error) {
      console.error('[Twin] Clock set failed', error)
      throw error
    }
  },

  liveNow: async () => {
    try {
      const result = await apiLiveNow()
      console.log('[Twin] Live now:', result)
      return result
    } catch (error) {
      console.error('[Twin] Live now failed', error)
      throw error
    }
  },

  executeAction: async (action) => {
    const controls = actionToControls(action)
    if (!controls) {
      console.warn('[Twin] No actuator mapping for', action)
      return
    }
    try {
      const result = await updateStationControls(controls)
      console.log('[Twin] Controls updated:', result)
      return result
    } catch (error) {
      console.error('[Twin] Control update failed', error)
      throw error
    }
  },
}))
