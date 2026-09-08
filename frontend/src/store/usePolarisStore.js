import { create } from 'zustand'
import {
  connectTelemetrySocket,
  injectScenario as apiInjectScenario,
  switchStation as apiSwitchStation,
} from '../api/telemetry'

const createTelemetry = (station) => ({
  station_id: station,
  timestamp: new Date().toISOString(),
  source: 'synthetic',
  confidence: 'modeled',

  ambient: {
    temp_c: -18.4,
    wind_speed_knots: 18,
    solar_flux_w_m2: 120,
  },

  thermal: {
    internal_temp_c: 20,
    chp_thermal_output_kw: 420,
    aux_heater_kw: 0,
    heat_loss_kw: 180,
  },

  microgrid: {
    total_load_kva: 480,
    essential_load_kva: 250,
    science_load_kva: 120,
    comfort_load_kva: 110,
    chp_capacity_kva: 750,
  },

  fuel: {
    tank_level_liters: 520000,
    burn_rate_lph: 145,
    days_of_autonomy: 148,
  },

  controls: {
    science_instruments_online: true,
    summer_wing_isolated: false,
    hatch_lockdown: false,
    aux_generator_active: false,
  },

  link_status: {
    type: 'C-band/LEO',
    latency_ms: 520,
    health: 'ONLINE',
  },

  risk: {
    anomaly_score: 0.04,
    is_anomaly: false,
    severity: 'NOMINAL',
    prescribed_actions: [],
  },
})

const createStationTelemetry = () => ({
  BHARATI: createTelemetry('BHARATI'),
  MAITRI: createTelemetry('MAITRI'),
})

export const usePolarisStore = create((set) => ({
  selectedStation: 'BHARATI',
  selectedSubsystem: null,
  isThermalView: false,
  cameraPreset: 'droneAerial',
  cameraTick: 0,
  flySource: 'preset',
  flyComplete: true,

  connection: {
    status: 'SIMULATION',
    latency_ms: 0,
    last_update: null,
  },

  telemetry: createStationTelemetry(),

  setSelectedStation: async (station) => {
    if (!['BHARATI', 'MAITRI'].includes(station)) {
      console.error(`[Twin] Unknown station: ${station}`)
      return
    }

    const currentStation = usePolarisStore.getState().selectedStation

    if (station === currentStation) {
      return
    }

    set((state) => ({
      connection: {
        ...state.connection,
        status: 'SWITCHING',
      },
    }))

    try {
      await apiSwitchStation(station)

      set((state) => ({
        selectedStation: station,
        selectedSubsystem: null,
        cameraPreset:
          station === 'BHARATI' ? 'droneAerial' : 'hero',
        flySource: 'preset',
        cameraTick: state.cameraTick + 1,
        flyComplete: true,
        connection: {
          ...state.connection,
          status: 'ONLINE',
        },
      }))
    } catch (error) {
      console.error('[Twin] Station switch failed', error)

      set((state) => ({
        connection: {
          ...state.connection,
          status: 'OFFLINE',
        },
      }))
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

  setThermalView: (enabled) =>
    set({
      isThermalView: enabled,
    }),

  setTelemetry: (station, data) =>
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        [station]: {
          ...state.telemetry[station],
          ...data,
        },
      },
    })),

  updateTelemetry: (station, updater) =>
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        [station]: updater(state.telemetry[station]),
      },
    })),

  connectTelemetry: () => {
    set({
      connection: {
        status: 'CONNECTING',
        latency_ms: 0,
        last_update: null,
      },
    })

    const socket = connectTelemetrySocket({
      onTelemetry: (data) => {
        const station = data?.station_id

        if (!station) {
          console.warn(
            '[Twin WS] Telemetry missing station_id',
            data,
          )
          return
        }

        set((state) => ({
          telemetry: {
            ...state.telemetry,
            [station]: {
              ...state.telemetry[station],
              ...data,
            },
          },
          connection: {
            status:
              data.link_status?.health === 'DEGRADED'
                ? 'DEGRADED'
                : 'ONLINE',
            latency_ms: data.link_status?.latency_ms ?? 0,
            last_update: data.timestamp ?? null,
          },
        }))
      },

      onOpen: () => {
        set({
          connection: {
            status: 'ONLINE',
            latency_ms: 0,
            last_update: null,
          },
        })

        console.log('[Twin WS] Connected')
      },

      onError: () => {
        set({
          connection: {
            status: 'OFFLINE',
            latency_ms: 0,
            last_update: null,
          },
        })
      },

      onClose: () => {
        set((state) => ({
          connection: {
            ...state.connection,
            status: 'OFFLINE',
          },
        }))

        console.log('[Twin WS] Disconnected')
      },
    })

    return socket
  },

  injectScenario: async (scenario, durationSeconds = 60) => {
    if (scenario === 'NOMINAL') {
      console.warn(
        '[Twin] NOMINAL is not a backend scenario and cannot be injected.',
      )
      return
    }

    try {
      const result = await apiInjectScenario(
        scenario,
        durationSeconds,
      )

      console.log('[Twin] Scenario injected:', result)

      return result
    } catch (error) {
      console.error('[Twin] Scenario injection failed', error)
      throw error
    }
  },
}))
