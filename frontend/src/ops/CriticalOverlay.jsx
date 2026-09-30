import { usePolarisStore } from '../store/usePolarisStore'

import { SOP } from './decisions'

const ACK_STORAGE_KEY = 'polaris:critical-ack'

function getStoredAck() {
  try {
    return window.localStorage.getItem(ACK_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeAck(signature) {
  try {
    if (signature) {
      window.localStorage.setItem(ACK_STORAGE_KEY, signature)
    } else {
      window.localStorage.removeItem(ACK_STORAGE_KEY)
    }
  } catch {
    // localStorage may be unavailable; Zustand acknowledgement still works.
  }
}

export default function CriticalOverlay() {
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )

  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  const criticalAck = usePolarisStore(
    (state) => state.criticalAck,
  )

  const ackCritical = usePolarisStore(
    (state) => state.ackCritical,
  )

  const updateControls = usePolarisStore(
    (state) => state.updateControls,
  )

  const setShowTelemetry = usePolarisStore(
    (state) => state.setShowTelemetry,
  )

  const setHudTab = usePolarisStore(
    (state) => state.setHudTab,
  )

  const severity = telemetry?.risk?.severity

  const actions = (telemetry?.risk?.prescribed_actions ?? []).filter(
    (text) => !/isolation forest/i.test(String(text)),
  )

  /*
   * IMPORTANT:
   * Do not use telemetry.timestamp for the acknowledgement signature.
   * Live telemetry timestamps change every update, which would make
   * every packet look like a brand-new critical event.
   *
   * Replay events are identified by their stable scenario_id.
   * Live events are identified by station + current SOP actions.
   */
  const eventScenario =
    telemetry?.replay?.scenario_id ??
    telemetry?.scenario_id ??
    'LIVE'

  const signature = [
    selectedStation,
    eventScenario,
    actions.join('|'),
  ].join(':')

  const locked = telemetry?.lockouts

  const wind =
    telemetry?.ambient?.wind_speed_knots

  const days =
    telemetry?.fuel?.days_of_autonomy

  const persistedAck = getStoredAck()

  const isAcknowledged =
    criticalAck === signature ||
    persistedAck === signature

  if (severity !== 'CRITICAL') return null

  if (isAcknowledged) {
    return (
      <button
        type="button"
        className="critical-bar"
        onClick={() => {
          storeAck(null)
          ackCritical(null)
        }}
      >
        CRITICAL · {selectedStation} · {actions[0] ?? 'SOP'} · TAP TO REOPEN
      </button>
    )
  }

  const acknowledge = () => {
    // Persist first so the acknowledgement survives React/Zustand updates.
    try {
      window.localStorage.setItem(
        ACK_STORAGE_KEY,
        signature,
      )
    } catch {
      // Zustand state below still handles the current session.
    }

    ackCritical(signature)
  }

  const apply = async () => {
    try {
      await updateControls({
        hatch_lockdown: true,

        science_instruments_online:
          !actions.includes(SOP.SHED_SCIENCE)
            ? telemetry?.controls?.science_instruments_online
            : false,

        summer_wing_isolated:
          actions.includes(SOP.ISOLATE_SUMMER) ||
          actions.includes(SOP.ISOLATE_DEPRESSURIZE),

        aux_generator_active:
          actions.includes(SOP.AUX_GEN),
      })
    } catch {
      // Edge may be offline; overlay still acknowledges.
    }

    setShowTelemetry(true)
    setHudTab('live')

    try {
      window.localStorage.setItem(
        ACK_STORAGE_KEY,
        signature,
      )
    } catch {
      // Zustand acknowledgement still works for this session.
    }

    ackCritical(signature)
  }

  return (
    <div className="critical-overlay">
      <div className="critical-card">
        <div className="critical-kicker">
          SOP INTERRUPT · {selectedStation}
        </div>

        <h2>CRITICAL</h2>

        <p>
          Wind {Number(wind ?? 0).toFixed(0)} kt · fuel{' '}
          {Number(days ?? 0).toFixed(0)} days · outdoor{' '}
          {locked?.outdoor ?? '—'} · heli{' '}
          {locked?.heli ?? '—'}
        </p>

        <ul>
          {(
            actions.length
              ? actions
              : [
                  'ACTION: Review station state against Antarctic SOP.',
                ]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="critical-actions">
          <button
            type="button"
            className="critical-ack"
            onClick={acknowledge}
          >
            ACKNOWLEDGE
          </button>

          <button
            type="button"
            className="critical-apply"
            onClick={apply}
          >
            APPLY CONTROLS
          </button>
        </div>
      </div>
    </div>
  )
}