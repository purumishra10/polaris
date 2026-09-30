import { useEffect, useRef, useState } from 'react'
import { Activity, Gauge, Radio, Satellite, Server, Wifi } from 'lucide-react'
import { checkBackendHealth, VOICE_URL } from '../api/telemetry'
import { usePolarisStore } from '../store/usePolarisStore'

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

export function formatEta(minutes) {
  const m = n(minutes)
  if (m === undefined || m >= 9000) return '—'
  if (m < 1) return `${Math.max(1, Math.round(m * 60))}s`
  if (m < 60) {
    const whole = Math.floor(m)
    const sec = Math.round((m - whole) * 60)
    return sec ? `${whole}m ${String(sec).padStart(2, '0')}s` : `${whole}m`
  }
  if (m < 60 * 48) {
    const h = Math.floor(m / 60)
    return `${h}h ${String(Math.round(m % 60)).padStart(2, '0')}m`
  }
  return `${(m / 1440).toFixed(1)} d`
}

/**
 * Locked thresholds mirror twin-backend/sop.py and lockouts.py so the operator
 * sees the same limits the rule engine evaluates.
 */
export const SOP_RULES = [
  {
    id: 'STRUCTURAL',
    label: 'Structural wind',
    source: 'sop.py · CRITICAL',
    unit: 'kt',
    limit: 60,
    dir: 'above',
    read: (t) => n(t?.ambient?.wind_speed_knots),
  },
  {
    id: 'THERMAL',
    label: 'Habitat collapse',
    source: 'sop.py · CRITICAL',
    unit: '°C',
    limit: 16,
    dir: 'below',
    floor: 25,
    read: (t) => n(t?.thermal?.internal_temp_c),
  },
  {
    id: 'FUEL_CRIT',
    label: 'Fuel critical',
    source: 'sop.py · CRITICAL',
    unit: 'd',
    limit: 15,
    dir: 'below',
    floor: 90,
    read: (t) => n(t?.fuel?.days_of_autonomy),
  },
  {
    id: 'FUEL_ADV',
    label: 'Fuel advisory',
    source: 'sop.py · ADVISORY',
    unit: 'd',
    limit: 30,
    dir: 'below',
    floor: 90,
    read: (t) => n(t?.fuel?.days_of_autonomy),
  },
  {
    id: 'OUTDOOR',
    label: 'Outdoor lockout',
    source: 'lockouts.py · IMD 23 kt',
    unit: 'kt',
    limit: 23,
    dir: 'above',
    read: (t) => n(t?.ambient?.wind_speed_knots),
  },
  {
    id: 'HELI',
    label: 'Helicopter ops',
    source: 'lockouts.py · 40 kt',
    unit: 'kt',
    limit: 40,
    dir: 'above',
    read: (t) => n(t?.ambient?.wind_speed_knots),
  },
  {
    id: 'WX_WATCH',
    label: 'Nowcast P(≥23 kt)',
    source: 'LSTM+RF · WATCH 45%',
    unit: '%',
    limit: 45,
    dir: 'above',
    read: (t) => (n(t?.forecast?.p_lockout_23) === undefined ? undefined : t.forecast.p_lockout_23 * 100),
  },
  {
    id: 'CHP',
    label: 'CHP headroom',
    source: 'plant model · capacity',
    unit: 'kVA',
    dir: 'above',
    limitFrom: (t) => n(t?.microgrid?.chp_capacity_kva) ?? 750,
    read: (t) => n(t?.microgrid?.total_load_kva),
  },
]

export function evaluateRule(rule, t) {
  const value = rule.read(t)
  const limit = rule.limitFrom ? rule.limitFrom(t) : rule.limit
  if (value === undefined) return { value, limit, fill: 0, status: 'NO DATA', margin: undefined }
  const tripped = rule.dir === 'above' ? value > limit : value < limit
  const span = rule.dir === 'above' ? limit : Math.max(1, (rule.floor ?? limit * 2) - limit)
  const margin = rule.dir === 'above' ? limit - value : value - limit
  const fill =
    rule.dir === 'above'
      ? Math.max(0, Math.min(1, value / limit))
      : Math.max(0, Math.min(1, 1 - (value - limit) / span))
  const status = tripped ? 'TRIPPED' : fill >= 0.8 ? 'NEAR' : 'OK'
  return { value, limit, fill, status, margin }
}

const STATUS_TONE = {
  TRIPPED: { bar: '#ef4444', text: 'text-red-300', chip: 'border-red-500/50 bg-red-500/15 text-red-300' },
  NEAR: { bar: '#f59e0b', text: 'text-amber-300', chip: 'border-amber-500/50 bg-amber-500/15 text-amber-300' },
  OK: { bar: '#34d399', text: 'text-emerald-300', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  'NO DATA': { bar: '#475569', text: 'text-slate-500', chip: 'border-base-700 bg-base-900 text-slate-500' },
}

export function SopRuleMatrix({ telemetry, compact = false }) {
  const rows = SOP_RULES.map((rule) => ({ rule, ...evaluateRule(rule, telemetry) }))
  const tripped = rows.filter((r) => r.status === 'TRIPPED').length
  const near = rows.filter((r) => r.status === 'NEAR').length
  const closest = rows
    .filter((r) => r.status !== 'TRIPPED' && r.status !== 'NO DATA')
    .sort((a, b) => b.fill - a.fill)[0]

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {!compact && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
          <span className="text-slate-400">
            Live rule matrix · {rows.length} limits evaluated each packet
          </span>
          <span className="flex gap-1.5">
            <span className={`rounded border px-1.5 py-px ${STATUS_TONE.TRIPPED.chip}`}>{tripped} tripped</span>
            <span className={`rounded border px-1.5 py-px ${STATUS_TONE.NEAR.chip}`}>{near} near</span>
          </span>
        </div>
      )}
      {rows.map(({ rule, value, limit, fill, status, margin }) => {
        const tone = STATUS_TONE[status]
        const shown = value === undefined ? '—' : `${value.toFixed(rule.unit === 'kVA' ? 0 : 1)}`
        return (
          <div
            key={rule.id}
            className={`rounded-lg border border-base-800 bg-base-950/60 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
          >
            <div className="flex items-center justify-between gap-2 font-mono">
              <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-200`}>
                {rule.label}
                {!compact && <span className="ml-2 text-[9px] text-slate-500">{rule.source}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className={`${compact ? 'text-[10px]' : 'text-xs'} tabular-nums text-white`}>
                  {shown}
                  <span className="text-slate-500">
                    {' '}
                    {rule.dir === 'above' ? '/' : '≥'} {limit?.toFixed?.(0)} {rule.unit}
                  </span>
                </span>
                <span className={`rounded border px-1.5 py-px text-[9px] font-semibold ${tone.chip}`}>{status}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-800">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(2, fill * 100)}%`, background: tone.bar, boxShadow: `0 0 8px ${tone.bar}88` }}
              />
            </div>
            {!compact && margin !== undefined && status !== 'TRIPPED' && (
              <span className="mt-1 block font-mono text-[9px] text-slate-500">
                margin {Math.abs(margin).toFixed(rule.unit === 'kVA' ? 0 : 1)} {rule.unit} before trip
              </span>
            )}
          </div>
        )
      })}
      {!compact && closest && (
        <p className="pt-1 font-mono text-[10px] text-slate-400">
          Closest to a limit: <span className="text-white">{closest.rule.label}</span> at{' '}
          {Math.round(closest.fill * 100)}% of its trip point.
        </p>
      )}
    </div>
  )
}

function Signal({ label, value, unit, limit, fired, hint }) {
  return (
    <div
      className={`rounded-xl border p-3 font-mono ${
        fired ? 'border-amber-500/50 bg-amber-500/10' : 'border-base-700 bg-base-950/70'
      }`}
    >
      <span className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
        {label}
        <span className={`rounded px-1 text-[9px] ${fired ? 'bg-amber-500/20 text-amber-300' : 'text-slate-600'}`}>
          {fired ? 'FIRED' : 'quiet'}
        </span>
      </span>
      <strong className="mt-1 block text-lg tabular-nums text-white">
        {value === undefined ? '—' : value}
        <span className="ml-1 text-[10px] font-normal text-slate-500">{unit}</span>
      </strong>
      <span className="text-[9px] text-slate-500">{hint ?? `trigger ${limit}`}</span>
    </div>
  )
}

export function ProactiveSignals({ proactive, telemetry }) {
  const p = proactive || {}
  const f = telemetry?.forecast || {}
  const wind = n(p.wind_knots) ?? n(telemetry?.ambient?.wind_speed_knots)
  const fromNowcast = n(p.p_lockout_23) !== undefined && n(p.pressure_trend_hpa_per_min) === undefined

  if (p.hazard === 'RESUPPLY' || n(p.fuel_days) !== undefined) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Signal label="Fuel autonomy" value={n(p.fuel_days)?.toFixed(1)} unit="days" fired={(p.fuel_days ?? 99) < 30} limit="< 30 d" />
        <Signal
          label="Burn trend"
          value={n(p.fuel_trend_days_per_min)?.toFixed(4)}
          unit="d/min"
          fired={(p.fuel_trend_days_per_min ?? 0) < 0}
          hint="negative = depleting"
        />
      </div>
    )
  }

  if (fromNowcast) {
    const gust6 = n(f.gust_max_6h_kn) ?? n(p.gust_max_6h_kn)
    const ens = f.ensemble || {}
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Signal label="Gust now" value={n(f.now_gust_kn)?.toFixed(1)} unit="kt" fired={(f.now_gust_kn ?? 0) >= 23} limit="≥ 23 kt" />
        <Signal label="6h peak gust" value={gust6?.toFixed(1)} unit="kt" fired={(gust6 ?? 0) >= 23} limit="≥ 23 kt" />
        <Signal
          label="LSTM P(lock)"
          value={n(ens.lstm?.p_lockout_23) === undefined ? undefined : Math.round(ens.lstm.p_lockout_23 * 100)}
          unit="%"
          fired={(ens.lstm?.p_lockout_23 ?? 0) >= 0.45}
          limit="≥ 45%"
        />
        <Signal
          label="RF P(lock)"
          value={n(ens.rf?.p_lockout_23) === undefined ? undefined : Math.round(ens.rf.p_lockout_23 * 100)}
          unit="%"
          fired={(ens.rf?.p_lockout_23 ?? 0) >= 0.45}
          limit="≥ 45%"
        />
      </div>
    )
  }

  const pRate = n(p.pressure_trend_hpa_per_min)
  const wRate = n(p.wind_trend_kt_per_min)
  const target = n(p.predicted_wind_knots) ?? 60
  const progress = wind === undefined ? 0 : Math.max(0, Math.min(1, wind / target))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Signal label="Pressure" value={n(p.pressure_hpa)?.toFixed(1)} unit="hPa" fired={false} hint="station barometer" />
        <Signal label="Pressure trend" value={pRate?.toFixed(2)} unit="hPa/min" fired={(pRate ?? 0) <= -10} limit="≤ −10 hPa/min" />
        <Signal label="Wind trend" value={wRate?.toFixed(2)} unit="kt/min" fired={(wRate ?? 0) >= 18} limit="≥ 18 kt/min" />
        <Signal label="Wind now" value={wind?.toFixed(1)} unit="kt" fired={(wind ?? 0) >= 40} limit="≥ 40 kt" />
      </div>
      <div>
        <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
          <span>Progress to structural threshold</span>
          <span>
            {wind?.toFixed(1) ?? '—'} / {target} kt
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-base-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-amber-400 to-red-500 transition-all duration-700"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function useLiveSeries(value, key, limit = 40) {
  const store = useRef({})
  const [, setTick] = useState(0)
  useEffect(() => {
    if (n(value) === undefined) return
    const list = (store.current[key] ||= [])
    list.push(value)
    if (list.length > limit) list.shift()
    setTick((x) => x + 1)
  }, [value, key, limit])
  return store.current[key] ?? []
}

export function MiniSpark({ values, color = '#38bdf8', height = 28 }) {
  if (values.length < 2) return <div style={{ height }} />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - lo) / span) * 24 - 2}`).join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ height }} className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polyline points={`0,28 ${pts} 100,28`} fill={color} opacity="0.12" stroke="none" />
    </svg>
  )
}

function useServiceHealth() {
  const [state, setState] = useState({ twin: null, voice: null })
  useEffect(() => {
    let stop = false
    const tick = async () => {
      let twin = null
      let voice = null
      try {
        twin = await checkBackendHealth()
      } catch {
        twin = { status: 'DOWN', edge_reachable: false }
      }
      try {
        voice = (await fetch(`${VOICE_URL}/health`)).ok
      } catch {
        voice = false
      }
      if (!stop) setState({ twin, voice })
    }
    tick()
    const id = window.setInterval(tick, 8000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])
  return state
}

export function LinkHealthPanel({ telemetry }) {
  const connection = usePolarisStore((s) => s.connection)
  const { twin, voice } = useServiceHealth()
  const latency = n(telemetry?.link_status?.latency_ms)
  const series = useLiveSeries(latency, telemetry?.station_id ?? 'x')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const last = connection?.last_update ? new Date(connection.last_update).getTime() : undefined
  const age = last ? Math.max(0, (now - last) / 1000) : undefined
  const avg = series.length ? series.reduce((a, b) => a + b, 0) / series.length : undefined
  const jitter =
    series.length > 1 ? Math.sqrt(series.reduce((a, b) => a + (b - (avg ?? 0)) ** 2, 0) / series.length) : undefined
  const health = telemetry?.link_status?.health ?? '—'
  const ws = connection?.status === 'CONNECTED_WS'

  const services = [
    { label: 'Edge :8001', ok: twin ? Boolean(twin.edge_reachable) : null, icon: <Server size={11} /> },
    { label: 'Twin :8000', ok: twin ? twin.status === 'ONLINE' || twin.status === 'DEGRADED' : null, icon: <Activity size={11} /> },
    { label: 'Voice :8002', ok: voice, icon: <Radio size={11} /> },
    { label: ws ? 'WebSocket' : 'Polling', ok: ws ? true : connection?.status === 'FALLBACK_POLLING' ? false : null, icon: <Wifi size={11} /> },
  ]

  return (
    <div className="rounded-xl border border-base-800 bg-base-950/70 p-3.5 font-mono">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <Satellite size={12} className="text-ice-400" /> Satellite link · live
        </span>
        <span
          className={`rounded border px-1.5 py-px text-[9px] ${
            health === 'ONLINE'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/50 bg-amber-500/15 text-amber-300'
          }`}
        >
          {health}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        <div>
          <span className="block text-slate-500">Latency</span>
          <strong className="text-sm text-white">{latency ?? '—'}</strong>
          <span className="text-slate-500"> ms</span>
        </div>
        <div>
          <span className="block text-slate-500">Avg</span>
          <strong className="text-sm text-white">{avg ? Math.round(avg) : '—'}</strong>
          <span className="text-slate-500"> ms</span>
        </div>
        <div>
          <span className="block text-slate-500">Jitter</span>
          <strong className="text-sm text-white">{jitter !== undefined ? Math.round(jitter) : '—'}</strong>
          <span className="text-slate-500"> ms</span>
        </div>
        <div>
          <span className="block text-slate-500">Packet age</span>
          <strong className={`text-sm ${age !== undefined && age > 10 ? 'text-amber-300' : 'text-white'}`}>
            {age !== undefined ? age.toFixed(0) : '—'}
          </strong>
          <span className="text-slate-500"> s</span>
        </div>
      </div>
      <MiniSpark values={series} color="#5eb8ff" />
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        {services.map((s) => (
          <span
            key={s.label}
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 ${
              s.ok === true
                ? 'border-emerald-500/30 text-emerald-300'
                : s.ok === false
                ? 'border-amber-500/40 text-amber-300'
                : 'border-base-700 text-slate-500'
            }`}
          >
            {s.icon}
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1 rounded border border-base-700 px-1.5 py-0.5 text-slate-400">
          <Gauge size={11} /> {telemetry?.link_status?.type ?? 'C-band/LEO'}
        </span>
      </div>
    </div>
  )
}
