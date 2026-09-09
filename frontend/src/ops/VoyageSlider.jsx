export default function VoyageSlider({ delayDays, onChange, decision }) {
  const value = Number(delayDays) || 0
  return (
    <div className="voyage-slider">
      <div className="chart-legend">
        <span>SHIP DELAY</span>
        <b>{value ? `+${value} DAYS` : 'ON CALENDAR'}</b>
      </div>
      <input
        type="range"
        min="0"
        max="21"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="voyage-ticks">
        <span>0</span>
        <span>+14</span>
        <span>+21</span>
      </div>
      <p>
        {decision?.missWindow
          ? 'Delayed arrival is after the sea-window close. Both stations lose that call.'
          : value
            ? `Ship is modeled ${value} days earlier on the Cape Town → Bharati → Maitri track. Heli only while the ship is in the bay.`
            : 'One ship. Delay at Bharati is a Maitri problem. Heli exists only while the voyage is in the bay.'}
      </p>
      {decision && (
        <em>
          This heli {decision.thisHeli ? 'OPEN' : 'LOCKED'} · other station{' '}
          {decision.otherHeli ? 'OPEN' : 'LOCKED'}
        </em>
      )}
    </div>
  )
}