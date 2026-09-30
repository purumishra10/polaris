import LiveValue from '../analysis/LiveValue'
import { SOP } from './decisions'
import VoyageSlider from './VoyageSlider'
import DelayForecast from './DelayForecast'

export default function FuelDecision({ decision, onResupply, delayDays, onDelay }) {
  const days = Math.max(0, decision.days ?? 0)
  const cap = 180
  const pct = Math.min(100, (days / cap) * 100)
  const tone = decision.band.toLowerCase()
  const next = decision.next
  const here = decision.forecast?.here

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
          <span>AT SHIP ETA</span>
          <b>
            {here?.inBay
              ? 'Ship in bay now'
              : here
                ? `${here.fuelAtEta.toFixed(0)} d left · ${here.shortageDays > 0 ? `SHORT ${here.shortageDays.toFixed(0)} d` : 'covers ETA'}`
                : '—'}
          </b>
        </div>
      </div>
      {onDelay && (
        <VoyageSlider
          delayDays={delayDays}
          onChange={onDelay}
          decision={decision}
        />
      )}
      <DelayForecast decision={decision} />
      {onResupply && (decision.starve || decision.band !== 'NOMINAL' || decision.missWindow) && (
        <button type="button" className="fuel-slip" onClick={onResupply}>
          INJECT RESUPPLY DELAY
        </button>
      )}
      <div className="source-note">{decision.source}</div>
    </div>
  )
}

