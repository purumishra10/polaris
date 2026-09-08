import LiveValue from '../analysis/LiveValue'
import { SOP } from './decisions'

export default function FuelDecision({ decision, onResupply }) {
  const days = Math.max(0, decision.days ?? 0)
  const cap = 180
  const pct = Math.min(100, (days / cap) * 100)
  const tone = decision.band.toLowerCase()
  const next = decision.next

  return (
    <div className={`fuel-decision ${tone}`}>
      <div className="fuel-decision-head">
        <span>FUEL vs RESUPPLY</span>
        <b>{decision.band}</b>
      </div>
      <div className="fuel-gauge">
        <div className="fuel-track">
          <i className="fuel-fill" style={{ width: `${pct}%` }} />
          <span className="fuel-mark" style={{ left: `${(SOP.FUEL_CRITICAL_DAYS / cap) * 100}%` }}>
            15d
          </span>
          <span className="fuel-mark" style={{ left: `${(SOP.FUEL_ADVISORY_DAYS / cap) * 100}%` }}>
            30d
          </span>
        </div>
        <strong>
          <LiveValue value={days} digits={1} suffix=" days autonomy" />
        </strong>
      </div>
      <div className="fuel-windows">
        <div>
          <span>NEXT {next?.id ?? 'SEA'}</span>
          <b>
            {next
              ? next.open
                ? `${next.days} d to ${next.label} close`
                : `${next.label} closed`
              : 'No window'}
          </b>
        </div>
        <div>
          <span>DECISION</span>
          <b>
            {decision.starve
              ? 'Fuel shorter than the remaining window'
              : days < SOP.FUEL_ADVISORY_DAYS
                ? 'Below 30-day SOP floor'
                : 'Above SOP floor'}
          </b>
        </div>
      </div>
      {onResupply && (decision.starve || decision.band !== 'NOMINAL') && (
        <button type="button" className="fuel-slip" onClick={onResupply}>
          INJECT RESUPPLY DELAY
        </button>
      )}
      <div className="source-note">{decision.source}</div>
    </div>
  )
}
