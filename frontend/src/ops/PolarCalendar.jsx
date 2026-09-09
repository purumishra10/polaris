export default function PolarCalendar({
  station,
  date,
  polar,
  windows,
  onNight,
  onLive,
  compact = false,
}) {
  const month = date.getUTCMonth()
  const cursor = ((month + date.getUTCDate() / 31) / 12) * 100
  const bands =
    station === 'BHARATI'
      ? [
          { left: ((11 - 1 + 19 / 31) / 12) * 100, width: 100 - ((11 - 1 + 19 / 31) / 12) * 100, tone: 'day', label: 'DAY-A' },
          { left: 0, width: (22 / 365) * 100, tone: 'day', label: 'DAY-B' },
          { left: ((5 - 1 + 27 / 31) / 12) * 100, width: (49 / 365) * 100, tone: 'night', label: 'NIGHT' },
        ]
      : [
          { left: ((11 - 1) / 12) * 100, width: 100 - ((11 - 1) / 12) * 100, tone: 'day', label: 'DAY-A' },
          { left: 0, width: ((1 + 15 / 31) / 12) * 100, tone: 'day', label: 'DAY-B' },
          { left: ((5 - 1 + 14 / 31) / 12) * 100, width: (77 / 365) * 100, tone: 'night', label: 'NIGHT' },
        ]

  return (
    <div className={compact ? 'polar-cal compact' : 'polar-cal'}>
      <div className="chart-legend">
        <span>POLAR CALENDAR</span>
        <b>
          {polar.phase} · {date.toISOString().slice(0, 10)}
        </b>
      </div>
      <div className="polar-track">
        {bands.map((band) => (
          <i
            key={band.label}
            className={`polar-band ${band.tone}`}
            style={{ left: `${band.left}%`, width: `${band.width}%` }}
          />
        ))}
        <span className="polar-cursor" style={{ left: `${cursor}%` }} />
      </div>
      <div className="polar-months">
        {'JFMAMJJASOND'.split('').map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
      </div>
      <div className="window-list">
        {windows.map((window) => (
          <div key={window.id} className={window.openNow ? 'window-chip open' : 'window-chip'}>
            <span>
              {window.id} · {window.label}
            </span>
            <b>{window.openNow ? 'OPEN' : 'CLOSED'}</b>
          </div>
        ))}
      </div>
      {!compact && (
        <>
          <div className="climate-actions">
            <button type="button" onClick={onNight}>
              JUMP POLAR NIGHT
            </button>
            <button type="button" onClick={onLive}>
              LIVE NOW
            </button>
          </div>
          <div className="source-note">
            {polar.event?.source ?? 'IMD / Maitri-II brief'} · heli only while ship is in the bay
          </div>
        </>
      )}
    </div>
  )
}
