import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Brain, Cpu, GitCompareArrows, Lightbulb, Network, ScanSearch, Trees, Trophy } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePolarisStore } from '../store/usePolarisStore'
import { fetchModelCard } from '../api/telemetry'
import { GLOBE_SITES } from '../lib/stationSites'

const LSTM_COLOR = '#a78bfa'
const RF_COLOR = '#34d399'
const BLEND_COLOR = '#38bdf8'
const BASE_COLOR = '#64748b'
const WATCH_P = 0.45
const IMMINENT_P = 0.7
const TRACE_LIMIT = 90

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(7,11,18,0.95)',
  borderColor: '#2b3f5e',
  borderRadius: '10px',
  fontSize: '11px',
  color: '#fff',
}

const FEATURE_LABELS = {
  temp_c: 'Temperature',
  wind_kn: 'Wind',
  gust_kn: 'Gust',
  pres_hpa: 'Pressure',
  rh: 'Humidity',
  dni: 'Solar',
  snow: 'Snowfall',
  wdir_sin: 'Wind dir (sin)',
  wdir_cos: 'Wind dir (cos)',
  month: 'Month',
  hour: 'Hour',
  dP_3h: 'Δ Pressure 3h',
  dW_3h: 'Δ Wind 3h',
  dG_3h: 'Δ Gust 3h',
  dT_3h: 'Δ Temp 3h',
  gust_ma6: 'Gust 6h mean',
  pres_ma6: 'Pressure 6h mean',
  nbr_temp: 'Proxy temp',
  nbr_wind: 'Proxy wind',
  nbr_gust: 'Proxy gust',
  nbr_pres: 'Proxy pressure',
  nbr_dG_3h: 'Proxy Δ gust 3h',
  nbr_dP_3h: 'Proxy Δ pressure 3h',
  gust_minus_nbr: 'Gust − proxy',
}

const FEATURE_UNITS = {
  temp_c: '°C',
  wind_kn: 'kt',
  gust_kn: 'kt',
  pres_hpa: 'hPa',
  rh: '%',
  nbr_temp: '°C',
  nbr_wind: 'kt',
  nbr_gust: 'kt',
  nbr_pres: 'hPa',
  gust_ma6: 'kt',
  pres_ma6: 'hPa',
  dG_3h: 'kt',
  dW_3h: 'kt',
  dP_3h: 'hPa',
  dT_3h: '°C',
  nbr_dG_3h: 'kt',
  nbr_dP_3h: 'hPa',
  gust_minus_nbr: 'kt',
}

const HEADS = [
  { id: 'lock', label: 'Lockout P(≥23 kt)' },
  { id: 'wind', label: '6h max wind' },
  { id: 'temp', label: '6h min temp' },
]

const traces = { BHARATI: [], MAITRI: [] }
const cardCache = {}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const pct = (v) => (num(v) === undefined ? '—' : `${Math.round(v * 100)}%`)
const fixed = (v, d = 1, unit = '') => (num(v) === undefined ? '—' : `${v.toFixed(d)}${unit}`)

function modelColor(name) {
  if (name.startsWith('LSTM') || name === 'BiLSTM') return LSTM_COLOR
  if (name === 'RandomForest') return RF_COLOR
  if (name === 'Persistence') return BASE_COLOR
  return '#3b5b86'
}

function Panel({ icon, title, subtitle, right, children, className = '' }) {
  return (
    <div className={`analytics-card rounded-2xl p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            <span className="text-ice-300">{icon}</span>
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 font-mono text-[10px] text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function ProbabilityDial({ label, value, color, sub }) {
  const v = Math.max(0, Math.min(1, num(value) ?? 0))
  const r = 38
  const arc = Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[150px]">
        <path d="M 12 50 A 38 38 0 0 1 88 50" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 12 50 A 38 38 0 0 1 88 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${arc * v} ${arc}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" className="fill-white font-mono" fontSize="16" fontWeight="700">
          {pct(value)}
        </text>
      </svg>
      <span className="font-mono text-[11px] font-semibold" style={{ color }}>
        {label}
      </span>
      {sub && <span className="font-mono text-[9px] text-slate-500">{sub}</span>}
    </div>
  )
}

function buildInsights({ station, card, ensemble, winner, rf, persistence, anomaly }) {
  const out = []
  const site = GLOBE_SITES[station]
  if (winner && persistence) {
    const skill = (1 - winner.gust.mae / persistence.gust.mae) * 100
    out.push(
      `${winner.name} cuts 6-hour gust error at ${site.name} to ${winner.gust.mae.toFixed(2)} kt MAE, ${skill.toFixed(0)}% better than assuming today's gust persists.`,
    )
  }
  if (winner?.lock23?.pr_auc && rf?.lock23?.pr_auc) {
    const rfBetter = rf.lock23.pr_auc >= winner.lock23.pr_auc
    out.push(
      rfBetter
        ? `RandomForest ranks lockout hours better (PR-AUC ${rf.lock23.pr_auc.toFixed(2)} vs ${winner.lock23.pr_auc.toFixed(2)}), which is why it carries ${Math.round((card?.blend?.rf ?? 0.65) * 100)}% of the blended probability.`
        : `${winner.name} ranks lockout hours better here (PR-AUC ${winner.lock23.pr_auc.toFixed(2)} vs ${rf.lock23.pr_auc.toFixed(2)}), but RF stays in the blend for calibration.`,
    )
  }
  if (num(card?.neighbor_gust_corr) !== undefined) {
    out.push(
      `${card.neighbor} gusts track ${site.name} at r = ${card.neighbor_gust_corr.toFixed(2)}, so the proxy station is an early-warning input to both models.`,
    )
  }
  if (num(card?.lock23_test_rate) !== undefined) {
    out.push(
      `In the 2024 hold-out, ${Math.round(card.lock23_test_rate * 100)}% of hours at ${site.name} had a ≥23 kt gust within 6 hours${
        card.lock23_test_rate > 0.4 ? ' — outdoor work windows are scarce.' : '.'
      }`,
    )
  }
  const pl = num(ensemble?.lstm?.p_lockout_23)
  const pr = num(ensemble?.rf?.p_lockout_23)
  if (pl !== undefined && pr !== undefined) {
    const gap = Math.abs(pl - pr) * 100
    out.push(
      gap < 10
        ? `Live: LSTM and RF agree within ${gap.toFixed(0)} points on lockout risk.`
        : `Live: models disagree by ${gap.toFixed(0)} points (${pl > pr ? 'LSTM' : 'RF'} is more cautious) — treat the blend with care.`,
    )
  }
  if (num(anomaly) !== undefined) {
    out.push(
      anomaly < 0
        ? `Isolation Forest scores the current plant+weather vector as an outlier (${anomaly.toFixed(3)}). It is trace-only; severity still follows SOP rules.`
        : `Isolation Forest sees the current vector as an inlier (${anomaly.toFixed(3)}).`,
    )
  }
  return out
}

export default function ModelIntelligence() {
  const { selectedStation, setSelectedStation, telemetry } = usePolarisStore(
    useShallow((s) => ({
      selectedStation: s.selectedStation,
      setSelectedStation: s.setSelectedStation,
      telemetry: s.telemetry,
    })),
  )
  const station = selectedStation === 'MAITRI' ? 'MAITRI' : 'BHARATI'
  const site = GLOBE_SITES[station]
  const packet = telemetry[station]
  const forecast = packet?.forecast || {}
  const ensemble = forecast.ensemble
  const anomaly = num(packet?.risk?.anomaly_score)

  const [card, setCard] = useState(cardCache[station] ?? null)
  const [error, setError] = useState(false)
  const [head, setHead] = useState('lock')
  const [, setTick] = useState(0)

  useEffect(() => {
    let stop = false
    setCard(cardCache[station] ?? null)
    setError(false)
    fetchModelCard(station)
      .then((data) => {
        if (stop) return
        cardCache[station] = data
        setCard(data)
      })
      .catch(() => !stop && setError(true))
    return () => {
      stop = true
    }
  }, [station])

  useEffect(() => {
    const pl = num(ensemble?.lstm?.p_lockout_23)
    const pr = num(ensemble?.rf?.p_lockout_23)
    const pf = num(forecast.p_lockout_23)
    if (pf === undefined) return
    const list = traces[station]
    const time = new Date(packet?.timestamp || Date.now()).toISOString().slice(11, 19)
    if (list.length && list[list.length - 1].time === time) return
    list.push({ time, lstm: pl, rf: pr, blend: pf })
    if (list.length > TRACE_LIMIT) list.splice(0, list.length - TRACE_LIMIT)
    setTick((n) => n + 1)
  }, [packet?.timestamp, forecast.p_lockout_23, station])

  const nowcast = card?.nowcast
  const results = nowcast?.results ?? []
  const winner = results.find((r) => r.name === nowcast?.winner)
  const rf = results.find((r) => r.name === 'RandomForest')
  const persistence = results.find((r) => r.name === 'Persistence')

  const leaderboard = useMemo(
    () =>
      [...results]
        .filter((r) => num(r?.gust?.mae) !== undefined)
        .sort((a, b) => a.gust.mae - b.gust.mae)
        .map((r) => ({
          name: r.name === nowcast?.winner ? `${r.name} ★` : r.name,
          raw: r.name,
          mae: r.gust.mae,
          rmse: r.gust.rmse,
          r2: r.gust.r2,
          skill: persistence ? (1 - r.gust.mae / persistence.gust.mae) * 100 : 0,
        })),
    [results, nowcast?.winner, persistence],
  )

  const radar = useMemo(() => {
    const keys = [
      ['precision', 'Precision'],
      ['recall', 'Recall'],
      ['f1', 'F1'],
      ['roc_auc', 'ROC-AUC'],
      ['pr_auc', 'PR-AUC'],
    ]
    return keys.map(([k, label]) => ({
      metric: label,
      LSTM: winner?.lock23?.[k] ?? 0,
      RF: rf?.lock23?.[k] ?? 0,
      Persistence: persistence?.lock23?.[k] ?? 0,
    }))
  }, [winner, rf, persistence])

  const importance = (nowcast?.rf_importance?.[head] ?? []).map((item) => ({
    ...item,
    label: FEATURE_LABELS[item.feature] ?? item.feature,
  }))

  const climate = nowcast?.climate ?? []
  const currentMonth = new Date(packet?.timestamp || Date.now()).getUTCMonth() + 1
  const ifCases = Object.entries(card?.isolation_forest?.reference_cases ?? {}).map(([id, c]) => ({
    id,
    label: id.replace(/_/g, ' '),
    score: c.score,
    verdict: c.verdict,
  }))
  const scale = [-0.1, 0.25]
  const scalePos = (s) => `${Math.max(0, Math.min(100, ((s - scale[0]) / (scale[1] - scale[0])) * 100))}%`

  const insights = buildInsights({ station, card: nowcast, ensemble, winner, rf, persistence, anomaly })
  const trace = traces[station]
  const disagreement =
    num(ensemble?.lstm?.p_lockout_23) !== undefined && num(ensemble?.rf?.p_lockout_23) !== undefined
      ? Math.abs(ensemble.lstm.p_lockout_23 - ensemble.rf.p_lockout_23)
      : undefined

  return (
    <section className="space-y-5">
      {/* Header */}
      <div
        className="relative overflow-hidden rounded-2xl border p-5"
        style={{
          borderColor: `${site.color}55`,
          background: `radial-gradient(120% 140% at 0% 0%, ${site.color}1f, transparent 55%), linear-gradient(180deg, rgba(12,18,29,0.95), rgba(7,11,18,0.95))`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ice-300">
              <Brain size={14} /> Model intelligence
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
              LSTM + Random Forest ·{' '}
              <span style={{ color: site.color }}>{site.name}</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              {nowcast?.protocol ??
                'Train 2022–2023, test on calendar 2024. LSTM owns the 6-hour gust; RandomForest heads own wind, temperature and lockout probability.'}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-base-950/70 p-1">
            {['BHARATI', 'MAITRI'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedStation(id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs font-semibold transition ${
                  station === id ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: GLOBE_SITES[id].color }} />
                {GLOBE_SITES[id].name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px]">
          {[
            ['Winner', nowcast?.winner ?? '—', LSTM_COLOR],
            ['Proxy', nowcast?.neighbor ? `${nowcast.neighbor} · r ${fixed(nowcast.neighbor_gust_corr, 2)}` : '—'],
            ['Train', nowcast?.n_train ? `${nowcast.n_train.toLocaleString()} h (2022–23)` : '—'],
            ['Test', nowcast?.n_test ? `${nowcast.n_test.toLocaleString()} h (${nowcast.holdout ?? '2024'})` : '—'],
            ['Horizon', nowcast?.horizon_h ? `${nowcast.horizon_h} h · seq ${nowcast.seq_len} h` : '—'],
            ['Lockout base rate', pct(nowcast?.lock23_test_rate)],
            ['LSTM', nowcast ? (nowcast.lstm_loaded ? 'loaded' : 'offline') : '—', nowcast?.lstm_loaded ? '#34d399' : '#f87171'],
            ['RF heads', nowcast ? (nowcast.rf_loaded ? 'loaded' : 'offline') : '—', nowcast?.rf_loaded ? '#34d399' : '#f87171'],
          ].map(([k, v, c]) => (
            <span key={k} className="rounded-lg border border-white/10 bg-base-950/60 px-2.5 py-1 text-slate-400">
              {k}: <strong style={{ color: c || '#e2e8f0' }}>{v}</strong>
            </span>
          ))}
          {error && (
            <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-300">
              Model card unavailable — is the twin engine on :8000 running?
            </span>
          )}
        </div>
      </div>

      {/* Live ensemble row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          icon={<GitCompareArrows size={14} />}
          title="Live ensemble"
          subtitle={`Blend = ${Math.round((nowcast?.blend?.rf ?? 0.65) * 100)}% RF + ${Math.round((nowcast?.blend?.lstm ?? 0.35) * 100)}% LSTM, then sensor-reconciled`}
          right={
            disagreement !== undefined && (
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] ${
                  disagreement < 0.1
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                {disagreement < 0.1 ? 'AGREE' : 'DIVERGE'} Δ{Math.round(disagreement * 100)}
              </span>
            )
          }
        >
          {ensemble ? (
            <>
              <div className="grid grid-cols-3 gap-1">
                <ProbabilityDial label="LSTM" value={ensemble.lstm?.p_lockout_23} color={LSTM_COLOR} sub="sequence" />
                <ProbabilityDial label="BLEND" value={forecast.p_lockout_23} color={BLEND_COLOR} sub={forecast.status ?? ''} />
                <ProbabilityDial label="RF" value={ensemble.rf?.p_lockout_23} color={RF_COLOR} sub="tabular" />
              </div>
              <table className="mt-4 w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                    <th className="pb-1 text-left font-normal">Next 6 h</th>
                    <th className="pb-1 text-right font-normal" style={{ color: LSTM_COLOR }}>LSTM</th>
                    <th className="pb-1 text-right font-normal" style={{ color: RF_COLOR }}>RF</th>
                    <th className="pb-1 text-right font-normal text-sky-300">Final</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  <tr className="border-t border-base-800">
                    <td className="py-1.5 text-slate-400">Max gust</td>
                    <td className="text-right">{fixed(ensemble.lstm?.gust_max_6h_kn, 1, ' kt')}</td>
                    <td className="text-right text-slate-600">—</td>
                    <td className="text-right font-bold">{fixed(forecast.gust_max_6h_kn, 1, ' kt')}</td>
                  </tr>
                  <tr className="border-t border-base-800">
                    <td className="py-1.5 text-slate-400">Max wind</td>
                    <td className="text-right">{fixed(ensemble.lstm?.wind_max_6h_kn, 1, ' kt')}</td>
                    <td className="text-right">{fixed(ensemble.rf?.wind_max_6h_kn, 1, ' kt')}</td>
                    <td className="text-right font-bold">{fixed(forecast.wind_max_6h_kn, 1, ' kt')}</td>
                  </tr>
                  <tr className="border-t border-base-800">
                    <td className="py-1.5 text-slate-400">Min temp</td>
                    <td className="text-right">{fixed(ensemble.lstm?.temp_min_6h_c, 1, '°')}</td>
                    <td className="text-right">{fixed(ensemble.rf?.temp_min_6h_c, 1, '°')}</td>
                    <td className="text-right font-bold">{fixed(forecast.temp_min_6h_c, 1, '°')}</td>
                  </tr>
                </tbody>
              </table>
              {num(ensemble.open_meteo_peak_kn) !== undefined && (
                <p className="mt-2 font-mono text-[10px] text-slate-500">
                  Open-Meteo guard: next-6h forecast peak {ensemble.open_meteo_peak_kn.toFixed(1)} kt clamps the gust within ±8 kt.
                </p>
              )}
            </>
          ) : (
            <p className="py-10 text-center font-mono text-xs text-slate-500">
              {forecast.model === 'persistence'
                ? 'Not enough hourly history yet — running on persistence.'
                : `Waiting for a ${site.name} packet with model outputs…`}
            </p>
          )}
        </Panel>

        <Panel
          icon={<Network size={14} />}
          title="Lockout probability trace"
          subtitle="This session · WATCH at 45%, IMMINENT at 70%"
          right={<span className="font-mono text-[10px] text-slate-500">{trace.length} samples</span>}
        >
          <div className="h-[250px]">
            {trace.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trace} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#1c2330" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} stroke="#334155" minTickGap={40} />
                  <YAxis
                    domain={[0, 1]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    width={40}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [pct(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={WATCH_P} stroke="#f59e0b" strokeDasharray="4 4" />
                  <ReferenceLine y={IMMINENT_P} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="lstm" name="LSTM" stroke={LSTM_COLOR} dot={false} strokeWidth={1.8} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="rf" name="RF" stroke={RF_COLOR} dot={false} strokeWidth={1.8} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="blend" name="Final" stroke={BLEND_COLOR} dot={false} strokeWidth={2.6} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
                Collecting live {site.name} forecasts…
              </div>
            )}
          </div>
        </Panel>

        <Panel icon={<ScanSearch size={14} />} title="Why the RF thinks so" subtitle="Top lockout drivers with live input values">
          {ensemble?.drivers?.length ? (
            <div className="space-y-2.5">
              {ensemble.drivers.map((d) => {
                const max = ensemble.drivers[0].importance || 1
                return (
                  <div key={d.feature}>
                    <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-300">{FEATURE_LABELS[d.feature] ?? d.feature}</span>
                      <span className="text-white">
                        {fixed(d.value, 1)} <span className="text-slate-500">{FEATURE_UNITS[d.feature] ?? ''}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-base-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.importance / max) * 100}%`, background: `linear-gradient(90deg, ${RF_COLOR}55, ${RF_COLOR})` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-slate-500">importance {(d.importance * 100).toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-10 text-center font-mono text-xs text-slate-500">RF drivers appear once the heads score a live row.</p>
          )}
        </Panel>
      </div>

      {/* Hold-out evaluation row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          icon={<Trophy size={14} />}
          title="6-hour gust leaderboard"
          subtitle={`Hold-out ${nowcast?.holdout ?? '2024'} · mean absolute error (lower is better) · skill vs persistence`}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboard} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#1c2330" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v.toFixed(1)}`} stroke="#334155" domain={[0, 'dataMax + 0.5']} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                  formatter={(v, _n, item) => [
                    `${Number(v).toFixed(2)} kt MAE · RMSE ${item.payload.rmse.toFixed(2)} · R² ${item.payload.r2.toFixed(3)} · skill ${item.payload.skill.toFixed(0)}%`,
                    item.payload.raw,
                  ]}
                />
                <Bar
                  dataKey="mae"
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                  label={{ position: 'right', fill: '#94a3b8', fontSize: 10, formatter: (v) => `${Number(v).toFixed(2)} kt` }}
                >
                  {leaderboard.map((row) => (
                    <Cell key={row.raw} fill={modelColor(row.raw)} fillOpacity={row.raw === nowcast?.winner ? 1 : 0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
            {[
              ['LSTM (live)', winner, LSTM_COLOR],
              ['Random Forest', rf, RF_COLOR],
              ['Persistence', persistence, BASE_COLOR],
            ].map(([label, r, color]) => (
              <div key={label} className="rounded-xl border border-base-700/80 bg-base-950/50 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider" style={{ color }}>
                  {label}
                </span>
                <span className="text-lg font-bold text-white">{fixed(r?.gust?.mae, 2)}</span>
                <span className="text-slate-500"> kt</span>
                <span className="block text-[10px] text-slate-500">
                  R² {fixed(r?.gust?.r2, 3)} · RMSE {fixed(r?.gust?.rmse, 2)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={<Cpu size={14} />} title="Lockout classifier skill" subtitle="P(gust ≥ 23 kt within 6 h) on the hold-out year">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="#1e2d45" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
                <Radar name="Persistence" dataKey="Persistence" stroke={BASE_COLOR} fill={BASE_COLOR} fillOpacity={0.1} isAnimationActive={false} />
                <Radar name={`LSTM (${nowcast?.winner ?? 'LSTM'})`} dataKey="LSTM" stroke={LSTM_COLOR} fill={LSTM_COLOR} fillOpacity={0.25} isAnimationActive={false} />
                <Radar name="Random Forest" dataKey="RF" stroke={RF_COLOR} fill={RF_COLOR} fillOpacity={0.25} isAnimationActive={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toFixed(3)} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-normal">Metric</th>
                <th className="text-right font-normal" style={{ color: LSTM_COLOR }}>LSTM</th>
                <th className="text-right font-normal" style={{ color: RF_COLOR }}>RF</th>
                <th className="text-right font-normal">Persist</th>
              </tr>
            </thead>
            <tbody>
              {radar.map((row) => {
                const best = Math.max(row.LSTM, row.RF, row.Persistence)
                const cell = (v) => (
                  <td className={`py-1 text-right ${v === best ? 'font-bold text-white' : 'text-slate-400'}`}>{v ? v.toFixed(3) : '—'}</td>
                )
                return (
                  <tr key={row.metric} className="border-t border-base-800">
                    <td className="py-1 text-slate-400">{row.metric}</td>
                    {cell(row.LSTM)}
                    {cell(row.RF)}
                    {cell(row.Persistence)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Explainability + IF + climate row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          icon={<Trees size={14} />}
          title="Random Forest feature importance"
          subtitle={`${site.name} heads · proxy = ${nowcast?.neighbor ?? 'neighbor'}`}
        >
          <div className="mb-3 flex gap-1">
            {HEADS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHead(h.id)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition ${
                  head === h.id ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="h-[260px]">
            {importance.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={importance} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="label" width={116} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'importance']} />
                  <Bar
                    dataKey="importance"
                    radius={[0, 5, 5, 0]}
                    isAnimationActive={false}
                    label={{ position: 'right', fill: '#94a3b8', fontSize: 10, formatter: (v) => `${(Number(v) * 100).toFixed(0)}%` }}
                  >
                    {importance.map((row) => (
                      <Cell key={row.feature} fill={row.feature.startsWith('nbr') || row.feature === 'gust_minus_nbr' ? '#fbbf24' : RF_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">No RF heads loaded.</div>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            <span className="text-amber-300">■</span> proxy-station inputs · <span className="text-emerald-300">■</span> local inputs
          </p>
        </Panel>

        <Panel
          icon={<ScanSearch size={14} />}
          title="Isolation Forest"
          subtitle={card?.isolation_forest?.role ?? 'Unsupervised anomaly trace'}
        >
          <div className="text-center">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Live decision score</span>
            <div className={`text-4xl font-black tabular-nums ${anomaly !== undefined && anomaly < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {fixed(anomaly, 3)}
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {anomaly === undefined ? '—' : anomaly < 0 ? 'outlier side of the boundary' : 'inlier side of the boundary'}
            </span>
          </div>
          <div className="relative mt-6 h-2 rounded-full bg-gradient-to-r from-amber-500/70 via-slate-600 to-emerald-500/70">
            <span className="absolute -top-1 h-4 w-px bg-white/60" style={{ left: scalePos(0) }} />
            {anomaly !== undefined && (
              <span
                className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_12px_#38bdf8]"
                style={{ left: scalePos(anomaly) }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
            <span>outlier</span>
            <span>0</span>
            <span>inlier</span>
          </div>
          <div className="mt-4 space-y-1.5">
            {ifCases.map((c) => (
              <div key={c.id} className="flex items-center justify-between font-mono text-[10px]">
                <span className="capitalize text-slate-400">{c.label}</span>
                <span className={c.verdict === 'OUTLIER' ? 'text-amber-300' : 'text-emerald-300'}>
                  {c.score.toFixed(3)} · {c.verdict.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
          {card?.isolation_forest?.training && (
            <p className="mt-3 border-t border-base-800 pt-2 font-mono text-[10px] text-slate-500">
              {card.isolation_forest.training.n_estimators} trees · {card.isolation_forest.training.n_samples?.toLocaleString()} samples · contamination{' '}
              {card.isolation_forest.training.contamination} · {card.isolation_forest.training.features?.length} features
            </p>
          )}
        </Panel>

        <Panel icon={<Network size={14} />} title={`${site.name} wind climate`} subtitle="Monthly mean wind and gust from the training archive">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={climate} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#1c2330" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} stroke="#334155" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={32} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.06)' }} formatter={(v, n) => [`${Number(v).toFixed(1)} kt`, n]} />
                <ReferenceLine y={23} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '23 kt lockout', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
                <Bar dataKey="wind" name="Wind" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {climate.map((m) => (
                    <Cell key={m.month} fill={site.color} fillOpacity={m.month_num === currentMonth ? 1 : 0.4} />
                  ))}
                </Bar>
                <Bar dataKey="gust" name="Gust" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {climate.map((m) => (
                    <Cell key={m.month} fill="#f8fafc" fillOpacity={m.month_num === currentMonth ? 0.9 : 0.25} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {card?.climate_2023 && Object.keys(card.climate_2023).length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
              <div className="rounded-lg border border-base-800 bg-base-950/50 p-2">
                <span className="block text-slate-500">Gust p95</span>
                <strong className="text-white">{fixed(card.climate_2023.gust_p95_kn, 1, ' kt')}</strong>
              </div>
              <div className="rounded-lg border border-base-800 bg-base-950/50 p-2">
                <span className="block text-slate-500">Hours ≥23 kt</span>
                <strong className="text-white">{pct(card.climate_2023.frac_gust_ge_23)}</strong>
              </div>
              <div className="rounded-lg border border-base-800 bg-base-950/50 p-2">
                <span className="block text-slate-500">Hours ≥40 kt</span>
                <strong className="text-white">{pct(card.climate_2023.frac_gust_ge_40)}</strong>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Insights */}
      <Panel icon={<Lightbulb size={14} />} title={`What the models say about ${site.name}`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {insights.map((text, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-base-700/70 bg-base-950/50 px-3.5 py-3 text-sm text-slate-200">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                style={{ background: `${site.color}22`, color: site.color }}
              >
                {i + 1}
              </span>
              {text}
            </div>
          ))}
          {!insights.length && <p className="font-mono text-xs text-slate-500">Loading model card…</p>}
        </div>
      </Panel>
    </section>
  )
}
