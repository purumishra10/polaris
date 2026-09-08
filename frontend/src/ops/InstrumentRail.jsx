import { INSTRUMENTS, instrumentStatus } from './decisions'
import { usePolarisStore } from '../store/usePolarisStore'

export default function InstrumentRail({ station, telemetry, polar }) {
  const list = INSTRUMENTS[station] ?? []
  const setSelectedSubsystem = usePolarisStore((state) => state.setSelectedSubsystem)
  const setHudTab = usePolarisStore((state) => state.setHudTab)

  const open = (item) => {
    if (item.kind === 'COMMS') setSelectedSubsystem('COMMUNICATIONS')
    else if (item.kind === 'OUTDOOR') setSelectedSubsystem('SAFETY')
    else setSelectedSubsystem(station === 'MAITRI' ? 'THERMAL' : 'STRUCTURE')
    setHudTab('live')
  }

  return (
    <div className="instrument-rail">
      <div className="chart-legend">
        <span>INSTRUMENTS · {station === 'MAITRI' ? 'AL/03' : 'AL/02'}</span>
        <b>
          {list.filter((item) => instrumentStatus(item, telemetry, polar).ok).length}/{list.length} GO
        </b>
      </div>
      <div className="instrument-list">
        {list.map((item) => {
          const status = instrumentStatus(item, telemetry, polar)
          return (
            <button
              key={item.id}
              type="button"
              className={status.ok ? 'inst-dot go' : 'inst-dot nogo'}
              title={`${item.name} · ${item.owner} · ${status.reason}`}
              onClick={() => open(item)}
            >
              <i />
              <span>{item.id}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
