import { useEffect, useState } from 'react'
import { checkBackendHealth, VOICE_URL } from '../api/telemetry'
import { usePolarisStore } from '../store/usePolarisStore'

function Dot({ ok, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wide">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok === true
            ? 'bg-emerald-400'
            : ok === false
              ? 'bg-amber-400'
              : 'bg-slate-500'
        }`}
      />
      <span className={ok === false ? 'text-amber-200' : 'text-slate-300'}>{label}</span>
    </span>
  )
}

export default function ServicePulse() {
  const connection = usePolarisStore((s) => s.connection)
  const [twin, setTwin] = useState(null)
  const [voiceUp, setVoiceUp] = useState(null)

  useEffect(() => {
    let stop = false

    const tick = async () => {
      try {
        const health = await checkBackendHealth()
        if (!stop) setTwin(health)
      } catch {
        if (!stop) setTwin({ status: 'DOWN', edge_reachable: false, link_mode: 'DOWN' })
      }
      try {
        const response = await fetch(`${VOICE_URL}/health`)
        if (!stop) setVoiceUp(response.ok)
      } catch {
        if (!stop) setVoiceUp(false)
      }
    }

    tick()
    const id = window.setInterval(tick, 8000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  const ws = connection?.status === 'CONNECTED_WS'
  const polling = connection?.status === 'FALLBACK_POLLING'
  const edge = twin ? Boolean(twin.edge_reachable) : null
  const twinUp = twin ? twin.status === 'ONLINE' || twin.status === 'DEGRADED' : null
  const mode = twin?.link_mode

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-base-800 bg-base-950/95 px-4 py-1.5 sm:px-6">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
        Link
      </span>
      <Dot ok={edge} label="Edge" />
      <Dot ok={twinUp} label={mode === 'DEGRADED' ? 'Twin degraded' : 'Twin'} />
      <Dot ok={voiceUp} label="Voice" />
      <Dot ok={ws ? true : polling ? false : null} label={ws ? 'WS' : polling ? 'Polling' : 'WS'} />
      {twin?.citation_source && (
        <span className="text-[10px] font-mono text-slate-500">
          SOP {twin.citation_source}
        </span>
      )}
    </div>
  )
}
