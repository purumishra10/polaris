import { usePolarisStore } from '../store/usePolarisStore'
import { SOP } from './decisions'

export default function CriticalOverlay() {
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const telemetry = usePolarisStore((state) => state.telemetry[selectedStation])
  const criticalAck = usePolarisStore((state) => state.criticalAck)
  const ackCritical = usePolarisStore((state) => state.ackCritical)
  const updateControls = usePolarisStore((state) => state.updateControls)
  const setShowTelemetry = usePolarisStore((state) => state.setShowTelemetry)
  const setHudTab = usePolarisStore((state) => state.setHudTab)

  const severity = telemetry?.risk?.severity
  const actions = telemetry?.risk?.prescribed_actions ?? []
  const signature = `${selectedStation}:${actions.join('|')}`
  const locked = telemetry?.lockouts
  const wind = telemetry?.ambient?.wind_speed_knots
  const days = telemetry?.fuel?.days_of_autonomy

  if (severity !== 'CRITICAL') return null
  if (criticalAck === signature) {
    return (
      <button
        type="button"
        className="critical-bar"
        onClick={() => ackCritical(null)}
      >
        CRITICAL · {selectedStation} · {actions[0] ?? 'SOP'} · TAP TO REOPEN
      </button>
    )
  }

  const apply = async () => {
    try {
      await updateControls({
        hatch_lockdown: true,
        science_instruments_online: !actions.includes(SOP.SHED_SCIENCE)
          ? telemetry?.controls?.science_instruments_online
          : false,
        summer_wing_isolated:
          actions.includes(SOP.ISOLATE_SUMMER) ||
          actions.includes(SOP.ISOLATE_DEPRESSURIZE),
        aux_generator_active: actions.includes(SOP.AUX_GEN),
      })
    } catch {
      // Edge may be offline; overlay still acknowledges.
    }
    setShowTelemetry(true)
    setHudTab('live')
    ackCritical(signature)
  }

  return (
    <div className="critical-overlay">
      <div className="critical-card">
        <div className="critical-kicker">SOP INTERRUPT · {selectedStation}</div>
        <h2>CRITICAL</h2>
        <p>
          Wind {Number(wind ?? 0).toFixed(0)} kt · fuel {Number(days ?? 0).toFixed(0)} days ·
          outdoor {locked?.outdoor ?? '—'} · heli {locked?.heli ?? '—'}
        </p>
        <ul>
          {(actions.length ? actions : ['ACTION: Review station state against Antarctic SOP.']).map(
            (line) => (
              <li key={line}>{line}</li>
            ),
          )}
        </ul>
        <div className="critical-actions">
          <button type="button" className="critical-ack" onClick={() => ackCritical(signature)}>
            ACKNOWLEDGE
          </button>
          <button type="button" className="critical-apply" onClick={apply}>
            APPLY CONTROLS
          </button>
        </div>
      </div>
    </div>
  )
}
