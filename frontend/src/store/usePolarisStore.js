import { create } from 'zustand'
import {
  connectTelemetrySocket,
  injectScenario as apiInjectScenario,
  switchStation as apiSwitchStation,
  setClock as apiSetClock,
  liveNow as apiLiveNow,
  updateStationControls as apiUpdateControls,
} from '../api/telemetry'
import {
  applyReplaySnapshot,
  clearReplay,
  findReplayPreset,
  REPLAY_PRESETS,
} from '../lib/replayCatalog'
import {
  pushSample,
  seedLiveSeries,
  seedStormSeries,
  applyLiveDrift,
} from '../lib/telemetrySeries'
import { SOP, applyVoyageOverlay, opsDate } from '../ops/decisions'
import { applyPlantDoctrine } from '../ops/plantDoctrine'
import { exportSitrep } from '../ops/exportSitrep'

function decorateStation(telemetry, station, plantMode, delayDays) {
  const date = opsDate(telemetry)
  return applyVoyageOverlay(
    applyPlantDoctrine(telemetry, station, plantMode, date),
    station,
    date,
    delayDays,
  )
}

function decoratePair(map, plantMode, delayDays) {
  return {
    BHARATI: decorateStation(map.BHARATI, 'BHARATI', plantMode, delayDays),
    MAITRI: decorateStation(map.MAITRI, 'MAITRI', plantMode, delayDays),
  }
}

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

  replay: {
    active: false,
    scenario_id: null,
    clock: null,
    citation: null,
    source_type: null,
    occupancy: null,
    note: null,
    mode: 'LIVE',
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

  occupancy: station === 'MAITRI' ? 25 : 47,
  plant: {
    mode: 'CURRENT',
    tag: station === 'MAITRI' ? 'SYNTHETIC · occupancy AL/03' : 'SYNTHETIC · occupancy AL/02',
  },
})

const createStationTelemetry = () => ({
  BHARATI: createTelemetry('BHARATI'),
  MAITRI: createTelemetry('MAITRI'),
})

const seedAllSeries = (telemetry, mode = 'live') => ({
  BHARATI:
    mode === 'storm'
      ? seedStormSeries(telemetry.BHARATI)
      : seedLiveSeries('BHARATI', telemetry.BHARATI),
  MAITRI:
    mode === 'storm'
      ? seedStormSeries(telemetry.MAITRI)
      : seedLiveSeries('MAITRI', telemetry.MAITRI),
})

function applyLocalScenario(scenario, current) {
  if (scenario === 'BLIZZARD_80KT') {
    return {
      ...current,
      ambient: {
        ...current.ambient,
        wind_speed_knots: 80,
        temp_c: Math.min(current.ambient.temp_c ?? -12, -12),
        solar_flux_w_m2: 12,
      },
      lockouts: {
        ...current.lockouts,
        outdoor: 'LOCKED',
        heli: 'LOCKED',
        field: 'LOCKED',
      },
      risk: {
        ...current.risk,
        is_anomaly: true,
        severity: 'CRITICAL',
        prescribed_actions: [SOP.HATCH, SOP.STOW_SENSORS],
      },
    }
  }
  if (scenario === 'RESUPPLY_DELAY') {
    return {
      ...current,
      fuel: {
        ...current.fuel,
        days_of_autonomy: 12.4,
        tank_level_liters: 26500,
      },
      controls: {
        ...current.controls,
        science_instruments_online: false,
        summer_wing_isolated: true,
      },
      risk: {
        ...current.risk,
        is_anomaly: true,
        severity: 'CRITICAL',
        prescribed_actions: [SOP.SHED_SCIENCE, SOP.ISOLATE_DEPRESSURIZE],
      },
    }
  }
  if (scenario === 'POLAR_NIGHT') {
    return {
      ...current,
      ambient: {
        ...current.ambient,
        solar_flux_w_m2: 0,
        temp_c: Math.min(current.ambient.temp_c ?? -18, -22),
      },
    }
  }
  return current
}

const initialTelemetry = createStationTelemetry()

export const usePolarisStore = create((set) => ({
  selectedStation: 'BHARATI',
  selectedSubsystem: null,
  showTelemetry: true,
  isThermalView: false,
  cameraPreset: 'droneAerial',
  cameraTick: 0,
  flySource: 'preset',
  flyComplete: true,
  hudTab: 'live',
  hoveredSubsystem: null,
  criticalAck: null,
  voyageDelayDays: 0,
  plantMode: 'CURRENT',

  connection: {
    status: 'SIMULATION',
    latency_ms: 0,
    last_update: null,
  },

  telemetry: initialTelemetry,
  series: seedAllSeries(initialTelemetry),
  baseline: initialTelemetry,

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

  setShowTelemetry: (enabled) =>
    set({
      showTelemetry: Boolean(enabled),
    }),

  setHudTab: (tab) =>
    set({
      hudTab: tab,
    }),

  setHoveredSubsystem: (subsystem) =>
    set({
      hoveredSubsystem: subsystem,
    }),

  ackCritical: (signature) =>
    set({
      criticalAck: signature,
    }),

  tickLive: () =>
    set((state) => {
      const station = state.selectedStation
      const base = state.baseline[station] ?? state.telemetry[station]
      if (base?.replay?.active) return {}
      const drifted = decorateStation(
        applyLiveDrift(base, Date.now()),
        station,
        state.plantMode,
        state.voyageDelayDays,
      )
      return {
        telemetry: {
          ...state.telemetry,
          [station]: drifted,
        },
        series: {
          ...state.series,
          [station]: pushSample(state.series[station], drifted),
        },
      }
    }),

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
    set((state) => {
      const next = {
        ...state.telemetry[station],
        ...data,
      }
      return {
        telemetry: {
          ...state.telemetry,
          [station]: next,
        },
        baseline: {
          ...state.baseline,
          [station]: next,
        },
        series: {
          ...state.series,
          [station]: pushSample(state.series[station], next),
        },
      }
    }),

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

        set((state) => {
          const current = state.telemetry[station]
          if (current?.replay?.active) {
            return {
              connection: {
                status:
                  data.link_status?.health === 'DEGRADED'
                    ? 'DEGRADED'
                    : 'ONLINE',
                latency_ms: data.link_status?.latency_ms ?? state.connection.latency_ms,
                last_update: data.timestamp ?? null,
              },
            }
          }

          const nextBase = decorateStation(
            {
              ...(state.baseline[station] ?? current),
              ...data,
              replay: current?.replay,
            },
            station,
            state.plantMode,
            state.voyageDelayDays,
          )

          return {
            baseline: {
              ...state.baseline,
              [station]: nextBase,
            },
            connection: {
              status:
                data.link_status?.health === 'DEGRADED'
                  ? 'DEGRADED'
                  : 'ONLINE',
              latency_ms: data.link_status?.latency_ms ?? 0,
              last_update: data.timestamp ?? null,
            },
          }
        })
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
      try {
        await apiLiveNow()
      } catch {
        // Backend may not support clock API yet
      }
      set((state) => {
        const reset = decoratePair(
          {
            BHARATI: clearReplay(createTelemetry('BHARATI')),
            MAITRI: clearReplay(createTelemetry('MAITRI')),
          },
          state.plantMode,
          state.voyageDelayDays,
        )
        return {
          telemetry: reset,
          baseline: reset,
          series: seedAllSeries(reset),
          hudTab: state.hudTab,
          criticalAck: null,
        }
      })
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
      if (
        scenario === 'BLIZZARD_80KT' ||
        scenario === 'RESUPPLY_DELAY' ||
        scenario === 'POLAR_NIGHT'
      ) {
        set((state) => {
          const station = state.selectedStation
          const next = decorateStation(
            applyLocalScenario(scenario, state.telemetry[station]),
            station,
            state.plantMode,
            state.voyageDelayDays,
          )
          return {
            telemetry: {
              ...state.telemetry,
              [station]: next,
            },
            baseline: {
              ...state.baseline,
              [station]: next,
            },
            series: {
              ...state.series,
              [station]:
                scenario === 'BLIZZARD_80KT'
                  ? seedStormSeries(next)
                  : pushSample(state.series[station], next),
            },
            hudTab: 'live',
            criticalAck: null,
          }
        })
        return { local: true, scenario }
      }
      throw error
    }
  },

  replayAug2018: () => {
    const preset = REPLAY_PRESETS[0]
    set((state) => {
      const next = decoratePair(
        {
          BHARATI: applyReplaySnapshot(
            state.telemetry.BHARATI,
            preset.snapshot,
            'BHARATI',
          ),
          MAITRI: applyReplaySnapshot(
            state.telemetry.MAITRI,
            preset.snapshot,
            'MAITRI',
          ),
        },
        state.plantMode,
        state.voyageDelayDays,
      )
      return {
        selectedStation: 'BHARATI',
        selectedSubsystem: null,
        showTelemetry: true,
        hudTab: 'live',
        cameraPreset: 'droneAerial',
        flySource: 'preset',
        cameraTick: state.cameraTick + 1,
        flyComplete: true,
        telemetry: next,
        baseline: next,
        series: seedAllSeries(next, 'storm'),
        criticalAck: null,
      }
    })
  },

  setClock: async (clock) => {
    const preset = findReplayPreset(clock)

    try {
      await apiSetClock(clock)
    } catch {
      // Fall back to local replay catalog
    }

    if (preset) {
      set((state) => {
        const next = decoratePair(
          {
            BHARATI: applyReplaySnapshot(
              state.telemetry.BHARATI,
              preset.snapshot,
              'BHARATI',
            ),
            MAITRI: applyReplaySnapshot(
              state.telemetry.MAITRI,
              preset.snapshot,
              'MAITRI',
            ),
          },
          state.plantMode,
          state.voyageDelayDays,
        )
        return {
          selectedStation: 'BHARATI',
          selectedSubsystem: null,
          showTelemetry: true,
          hudTab: 'live',
          cameraPreset: 'droneAerial',
          flySource: 'preset',
          cameraTick: state.cameraTick + 1,
          flyComplete: true,
          telemetry: next,
          baseline: next,
          series: seedAllSeries(next, 'storm'),
          criticalAck: null,
        }
      })
      return preset
    }

    console.warn('[Twin] No local replay preset for clock:', clock)
    return null
  },

  liveNow: async () => {
    try {
      await apiLiveNow()
    } catch {
      // Fall back to local reset
    }

    set((state) => {
      const reset = decoratePair(
        {
          BHARATI: clearReplay(createTelemetry('BHARATI')),
          MAITRI: clearReplay(createTelemetry('MAITRI')),
        },
        state.plantMode,
        state.voyageDelayDays,
      )
      return {
        telemetry: reset,
        baseline: reset,
        series: seedAllSeries(reset),
        criticalAck: null,
      }
    })
  },

  setVoyageDelay: (days) =>
    set((state) => {
      const voyageDelayDays = Math.max(0, Math.min(21, Number(days) || 0))
      const telemetry = decoratePair(
        state.telemetry,
        state.plantMode,
        voyageDelayDays,
      )
      return {
        voyageDelayDays,
        telemetry,
        baseline: telemetry,
      }
    }),

  setPlantMode: (mode) =>
    set((state) => {
      const plantMode = mode === 'MAITRI_II' ? 'MAITRI_II' : 'CURRENT'
      let map = state.telemetry
      if (plantMode === 'CURRENT' && state.plantMode === 'MAITRI_II') {
        const fresh = createTelemetry('MAITRI')
        map = {
          ...map,
          MAITRI: {
            ...map.MAITRI,
            microgrid: fresh.microgrid,
            fuel: fresh.fuel,
            confidence: map.MAITRI?.replay?.active
              ? map.MAITRI.confidence
              : 'modeled',
          },
        }
      }
      const telemetry = decoratePair(
        map,
        plantMode,
        state.voyageDelayDays,
      )
      return {
        plantMode,
        telemetry,
        baseline: telemetry,
        series: {
          ...state.series,
          MAITRI: pushSample(state.series.MAITRI, telemetry.MAITRI),
        },
      }
    }),

  updateControls: async (controls) => {
    try {
      await apiUpdateControls(controls)
    } catch (error) {
      console.error('[Twin] Control update failed', error)
      throw error
    }
  },

  applyVoiceAction: async (action) => {
    if (!action || typeof action !== 'object') return
    const store = usePolarisStore.getState()
    const kind = action.type

    if (kind === 'select_station') {
      await store.setSelectedStation(action.station)
      return
    }
    if (kind === 'select_subsystem') {
      store.setSelectedSubsystem(action.subsystem)
      return
    }
    if (kind === 'camera_preset') {
      store.setCameraPreset(action.preset)
      return
    }
    if (kind === 'thermal_view') {
      store.setThermalView(Boolean(action.enabled))
      return
    }
    if (kind === 'inject_scenario') {
      await store.injectScenario(action.scenario)
      return
    }
    if (kind === 'set_controls') {
      await store.updateControls(action.controls ?? {})
      return
    }
    if (kind === 'live_now') {
      await store.liveNow()
      return
    }
    if (kind === 'replay_2018') {
      store.replayAug2018()
      return
    }
    if (kind === 'set_clock') {
      await store.setClock(action.clock)
      return
    }
    if (kind === 'show_telemetry') {
      store.setShowTelemetry(action.enabled !== false)
      return
    }
    if (kind === 'set_hud_tab') {
      store.setShowTelemetry(true)
      store.setHudTab(action.tab || 'live')
      return
    }
    if (kind === 'export_sitrep') {
      store.setShowTelemetry(true)
      exportSitrep({
        station: store.selectedStation,
        telemetry: store.telemetry[store.selectedStation],
        delayDays: store.voyageDelayDays,
        plantMode: store.plantMode,
      })
      return
    }
    if (kind === 'close_brief') {
      store.setSelectedSubsystem(null)
      return
    }
    if (kind === 'set_voyage_delay') {
      store.setVoyageDelay(action.days)
      store.setShowTelemetry(true)
      store.setHudTab('map')
      return
    }
    if (kind === 'set_plant_mode') {
      store.setPlantMode(action.mode)
      await store.setSelectedStation('MAITRI')
      store.setHudTab('live')
    }
  },

  applyVoiceActions: async (actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return
    const store = usePolarisStore.getState()
    for (const action of actions) {
      await store.applyVoiceAction(action)
    }
  },
}))
