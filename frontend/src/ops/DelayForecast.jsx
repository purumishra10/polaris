import { SOP_RULES } from './decisions'

function fmtDays(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(0)} d`
}

function fmtKm(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v < 10 ? `${v.toFixed(1)} km` : `${Math.round(v)} km`
}

function StationCol({ row, label }) {
  if (!row) {
    return (
      <div className="delay-col">
        <span>{label}</span>
        <b>NO TICK</b>
      </div>
    )
  }
  return (
    <div className={`delay-col ${row.band.toLowerCase()}`}>
      <span>{label}</span>
      <b>{row.inBay ? 'IN BAY' : fmtDays(row.etaDays)}</b>
      <em>{row.inBay ? 'resupply now' : `${fmtKm(row.etaKm)} out`}</em>
      <em>fuel now {fmtDays(row.days)}</em>
      <em>at ETA {fmtDays(row.fuelAtEta)}</em>
      <em>
        {row.shortageDays > 0
          ? `SHORT ${row.shortageDays.toFixed(0)} d before ship`
          : row.miss
            ? 'MISSES SEA WINDOW'
            : 'no empty gap'}
      </em>
      <em>heli {row.heli ? 'OPEN' : 'LOCK'}</em>
    </div>
  )
}

export default function DelayForecast({ decision }) {
  const f = decision?.forecast
  if (!f) return null
  const here = f.here
  const fired = (here?.rules || []).map((id) => SOP_RULES.find((r) => r.id === id)).filter(Boolean)
  return (
    <div className={`delay-forecast ${(here?.band || 'nominal').toLowerCase()}`}>
      <div className="chart-legend">
        <span>DELAY → FUEL</span>
        <b>{f.delayDays ? `+${f.delayDays} D` : 'ON CALENDAR'}</b>
      </div>
      <div className="delay-grid">
        <StationCol row={f.bharati} label="BHARATI" />
        <StationCol row={f.maitri} label="MAITRI" />
      </div>
      {here?.shortageDays > 0 && (
        <p className="delay-call">
          This farm empties {here.shortageDays.toFixed(0)} d before the modeled ship. SOP: essential-only.
        </p>
      )}
      {here?.miss && here?.shortageDays <= 0 && (
        <p className="delay-call">ETA is after the sea-window close. No bulk JET A-1 this call.</p>
      )}
      {fired.length > 0 && (
        <ul className="delay-sop">
          {fired.map((rule) => (
            <li key={rule.id}>
              <b>{rule.id}</b> {rule.gate} — {rule.action}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
