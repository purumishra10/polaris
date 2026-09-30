import { usePolarisStore } from '../store/usePolarisStore'
import { MiniSpark, SOP_RULES, evaluateRule, formatEta, useLiveSeries } from '../ops/LiveOpsAnalysis'

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const fx = (v, d, unit = '') => (n(v) === undefined ? '—' : `${v.toFixed(d)}${unit}`)

const TONE = {
  TRIPPED: '#ef4444',
  NEAR: '#f59e0b',
  OK: '#34d399',
  'NO DATA': '#475569',
}

function Trend({ label, value, series, color, sub }) {
  const first = series[0]
  const last = series[series.length - 1]
  const delta = series.length > 1 ? last - first : undefined
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#57727e]">{label}</span>
        {delta !== undefined && Math.abs(delta) > 0.05 && (
          <span className={`font-mono text-[9px] ${delta > 0 ? 'text-amber-300' : 'text-sky-300'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      <strong className="block font-mono text-[16px] font-medium text-[#dcf0f6]">{value}</strong>
      {sub && <span className="block font-mono text-[8px] text-[#57727e]">{sub}</span>}
      <MiniSpark values={series} color={color} height={20} />
    </div>
  )
}

function Bar({ label, value, color }) {
  const v = n(value)
  return (
    <div className="grid grid-cols-[52px_1fr_36px] items-center gap-2 font-mono text-[10px]">
      <span style={{ color }}>{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(v ?? 0) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="absolute top-0 h-full w-px bg-amber-400/70" style={{ left: '45%' }} />
      </div>
      <span className="text-right text-[#dcf0f6]">{v === undefined ? '—' : `${Math.round(v * 100)}%`}</span>
    </div>
  )
}

export function FullscreenKpiStrip() {
  const t = usePolarisStore((s) => s.telemetry[s.selectedStation])
  const f = t?.forecast || {}
  const p = t?.proactive
  const items = [
    ['WIND', fx(t?.ambient?.wind_speed_knots, 1, ' kt')],
    ['6H GUST', fx(f.gust_max_6h_kn, 1, ' kt')],
    ['P(≥23)', n(f.p_lockout_23) === undefined ? '—' : `${Math.round(f.p_lockout_23 * 100)}%`],
    ['HABITAT', fx(t?.thermal?.internal_temp_c, 1, '°C')],
    ['AUTONOMY', fx(t?.fuel?.days_of_autonomy, 0, ' d')],
    ['LINK', t?.link_status?.latency_ms != null ? `${t.link_status.latency_ms} ms` : '—'],
  ]
  return (
    <div className="hidden items-center gap-1 xl:flex">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono">
          <span className="block text-[7px] font-bold tracking-[0.16em] text-[#66828e]">{k}</span>
          <span className="text-[12px] text-[#dcf0f6]">{v}</span>
        </div>
      ))}
      {p && p.status && p.status !== 'CLEAR' && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 font-mono text-amber-200">
          <span className="block text-[7px] font-bold tracking-[0.16em] text-amber-400/80">FORECAST</span>
          <span className="text-[12px]">
            {p.hazard} {p.status} · {formatEta(p.eta_minutes)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function FullscreenOpsPanel() {
  const station = usePolarisStore((s) => s.selectedStation)
  const t = usePolarisStore((s) => s.telemetry[s.selectedStation])
  const replayOn = Boolean(t?.replay?.active)
  const f = t?.forecast || {}
  const ens = f.ensemble || {}

  const wind = useLiveSeries(n(t?.ambient?.wind_speed_knots), `${station}-wind`)
  const gust = useLiveSeries(n(f.gust_max_6h_kn), `${station}-gust`)
  const habitat = useLiveSeries(n(t?.thermal?.internal_temp_c), `${station}-hab`)
  const load = useLiveSeries(n(t?.microgrid?.total_load_kva), `${station}-load`)

  const rules = SOP_RULES.map((rule) => ({ rule, ...evaluateRule(rule, t) }))
    .filter((r) => r.status !== 'NO DATA')
    .sort((a, b) => (b.status === 'TRIPPED') - (a.status === 'TRIPPED') || b.fill - a.fill)
    .slice(0, 5)

  const lock = t?.lockouts || {}

  return (
    <>
      <div className="panel-header">
        <span>{replayOn ? 'DAY TELEMETRY' : 'LIVE OPS ANALYSIS'}</span>
        <span className={`live-badge ${replayOn ? 'held' : ''}`}>
          {replayOn ? (t?.replay?.clock || '').slice(0, 10) || 'DATE' : 'LIVE'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Trend label="Wind now" value={fx(t?.ambient?.wind_speed_knots, 1, ' kt')} series={wind} color="#93d5ff" />
        <Trend label="6h peak gust" value={fx(f.gust_max_6h_kn, 1, ' kt')} series={gust} color="#a78bfa" />
        <Trend label="Habitat" value={fx(t?.thermal?.internal_temp_c, 1, '°C')} series={habitat} color="#34d399" sub="SOP floor 16°C" />
        <Trend label="Load · modeled" value={fx(t?.microgrid?.total_load_kva, 0, ' kVA')} series={load} color="#fbbf24" />
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#57727e]">Lockout P(≥23 kt / 6h)</span>
          <span className="font-mono text-[9px] text-[#7b98a3]">{f.status ?? 'CLEAR'} · {f.model ?? 'off'}</span>
        </div>
        <div className="space-y-1.5">
          <Bar label="LSTM" value={ens.lstm?.p_lockout_23} color="#a78bfa" />
          <Bar label="RF" value={ens.rf?.p_lockout_23} color="#34d399" />
          <Bar label="FINAL" value={f.p_lockout_23} color="#38bdf8" />
        </div>
        <p className="mt-1.5 font-mono text-[8px] text-[#57727e]">amber tick = WATCH 45% · blend 65% RF + 35% LSTM</p>
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
        <span className="mb-2 block text-[8px] font-bold uppercase tracking-[0.14em] text-[#57727e]">Closest SOP limits</span>
        <div className="space-y-1.5">
          {rules.map(({ rule, value, limit, fill, status }) => (
            <div key={rule.id}>
              <div className="flex justify-between font-mono text-[9px]">
                <span className="text-[#c9e8f1]">{rule.label}</span>
                <span style={{ color: TONE[status] }}>
                  {value?.toFixed(rule.unit === 'kVA' ? 0 : 1)} / {limit?.toFixed(0)} {rule.unit}
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, fill * 100)}%`, background: TONE[status] }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 font-mono">
        {[
          ['OUTDOOR', lock.outdoor],
          ['HELI', lock.heli],
          ['CONVOY', lock.convoy],
        ].map(([k, v]) => (
          <div
            key={k}
            className={`rounded-md border px-2 py-1.5 text-center ${
              v === 'LOCKED' ? 'border-red-500/50 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/5'
            }`}
          >
            <span className="block text-[7px] font-bold tracking-[0.14em] text-[#57727e]">{k}</span>
            <span className={`text-[10px] font-bold ${v === 'LOCKED' ? 'text-red-300' : 'text-emerald-300'}`}>{v ?? '—'}</span>
          </div>
        ))}
      </div>

      <p className="source-note">
        {replayOn
          ? 'Historical clock · use Station Analysis → LIVE for date / day brief'
          : `weather: ${t?.source ?? 'Open-Meteo'} · nowcast: ${f.model ?? 'off'} · proxy ${f.neighbor ?? '—'} · plant: modeled`}
      </p>
    </>
  )
}
