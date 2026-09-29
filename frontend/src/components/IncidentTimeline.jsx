import { useEffect, useState } from 'react'
import { fetchIncidentLog } from '../api/telemetry'

function clock(iso) {
  if (!iso) return '--:--:--'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso).slice(11, 19)
  return date.toISOString().slice(11, 19)
}

export default function IncidentTimeline() {
  const [events, setEvents] = useState([])
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const data = await fetchIncidentLog(40)
        if (stop) return
        setEvents(data.events || [])
        setOffline(false)
      } catch {
        if (!stop) setOffline(true)
      }
    }
    load()
    const id = window.setInterval(load, 4000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <section className="rounded-2xl border border-base-700 bg-base-900/80 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">
          Incident log
        </h3>
        <span className="text-[10px] font-mono text-slate-500">
          {offline ? 'Twin log unreachable' : `${events.length} events`}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-slate-500">
          Severity changes, scenario injections, and operator controls will appear here.
        </p>
      ) : (
        <ol className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-[11px] font-mono leading-5">
              <span className="shrink-0 text-slate-500">{clock(event.recorded_at)} UTC</span>
              <span className="shrink-0 text-ice-300">{event.actor}</span>
              <span className="text-slate-200">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
