import { create } from 'zustand'
import { connectTelemetrySocket } from '../api/telemetry'

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

  connection: {
    status: 'SIMULATION',
    latency_ms: 0,
    last_update: null,
  },

  telemetry: createStationTelemetry(),

  setSelectedStation: (station) =>
    set((state) => ({
      selectedStation: station,
      selectedSubsystem: null,
      cameraPreset: station === 'BHARATI' ? 'droneAerial' : 'hero',
      flySource: 'preset',
      cameraTick: state.cameraTick + 1,
    })),

  setSelectedSubsystem: (subsystem) =>
    set((state) => ({
      selectedSubsystem: subsystem,
      flySource: subsystem ? 'asset' : state.flySource,
      cameraTick: subsystem ? state.cameraTick + 1 : state.cameraTick,
    })),

  setCameraPreset: (preset) =>
    set((state) => ({
      cameraPreset: preset,
      selectedSubsystem: null,
      flySource: 'preset',
      cameraTick: state.cameraTick + 1,
    })),

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

  injectScenario: (scenario) =>
    set((state) => {
      const station = state.selectedStation

      // Always start from a clean nominal state.
      // This prevents one scenario from contaminating another.
      const base = createTelemetry(station)

      if (scenario === 'NOMINAL') {
        return {
          telemetry: {
            ...state.telemetry,
            [station]: base,
          },
        }
      }

      if (scenario === 'BLIZZARD_80KT') {
        return {
          telemetry: {
            ...state.telemetry,
            [station]: {
              ...base,

              ambient: {
                ...base.ambient,
                temp_c: -27.8,
                wind_speed_knots: 80,
                solar_flux_w_m2: 0,
              },

              thermal: {
                ...base.thermal,
                aux_heater_kw: 180,
                heat_loss_kw: 390,
              },

              controls: {
                ...base.controls,
                science_instruments_online: false,
                hatch_lockdown: true,
                summer_wing_isolated: true,
                aux_generator_active: true,
              },

              link_status: {
                ...base.link_status,
                health: 'DEGRADED',
                latency_ms: 740,
              },

              risk: {
                anomaly_score: 0.98,
                is_anomaly: true,
                severity: 'CRITICAL',
                prescribed_actions: [
                  'LOCK HATCHES',
                  'RESTRICT OUTDOOR WORK',
                  'ACTIVATE AUXILIARY GENERATOR',
                ],
              },

              timestamp: new Date().toISOString(),
            },
          },
        }
      }

      if (scenario === 'RESUPPLY_DELAY') {
        return {
          telemetry: {
            ...state.telemetry,
            [station]: {
              ...base,

              fuel: {
                ...base.fuel,
                days_of_autonomy: 62,
                burn_rate_lph: 180,
              },

              controls: {
                ...base.controls,
                summer_wing_isolated: true,
              },

              risk: {
                anomaly_score: 0.71,
                is_anomaly: true,
                severity: 'ADVISORY',
                prescribed_actions: [
                  'ISOLATE NON-ESSENTIAL LOAD',
                  'REVIEW FUEL RESERVE',
                ],
              },

              timestamp: new Date().toISOString(),
            },
          },
        }
      }

      if (scenario === 'POLAR_NIGHT') {
        return {
          telemetry: {
            ...state.telemetry,
            [station]: {
              ...base,

              ambient: {
                ...base.ambient,
                temp_c: -31.5,
                solar_flux_w_m2: 0,
              },

              thermal: {
                ...base.thermal,
                aux_heater_kw: 120,
                heat_loss_kw: 340,
              },

              fuel: {
                ...base.fuel,
                days_of_autonomy: 104,
                burn_rate_lph: 165,
              },

              risk: {
                anomaly_score: 0.36,
                is_anomaly: false,
                severity: 'ADVISORY',
                prescribed_actions: [
                  'MONITOR THERMAL LOAD',
                  'PRESERVE FUEL RESERVE',
                ],
              },

              timestamp: new Date().toISOString(),
            },
          },
        }
      }

      return state
    }),

  connectTelemetry: () => {
    set({
      connection: {
        status: 'CONNECTING',
        latency_ms: 0,
        last_update: null,
      },
    })

    const socket = connectTelemetrySocket(
      (data) => {
        const station = data.station_id

        set((state) => ({
          telemetry: {
            ...state.telemetry,
            [station]: data,
          },

          connection: {
            status:
              data.link_status?.health === 'DEGRADED'
                ? 'DEGRADED'
                : 'ONLINE',

            latency_ms:
              data.link_status?.latency_ms ?? 0,

            last_update: data.timestamp,
          },
        }))
      },

      () => {
        set({
          connection: {
            status: 'OFFLINE',
            latency_ms: 0,
            last_update: null,
          },
        })
      },
    )

    return socket
  },
}))