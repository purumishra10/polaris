import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, ArrowRightLeft, BellRing, ChevronUp, ShieldAlert, X } from 'lucide-react'
import { usePolarisStore } from '../store/usePolarisStore'
import { SOP } from './decisions'
import { SOP_RULES, evaluateRule, formatEta } from './LiveOpsAnalysis'

const CRITICAL_RULES = ['STRUCTURAL', 'THERMAL', 'FUEL_CRIT']
const HOT_STATUS = new Set(['IMMINENT', 'ACTIVE'])

const fmt = (v, digits = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—'

/**
 * Every condition that makes the station CRITICAL right now, each with its
 * live reading and the limit it broke. Codes are stable so the ack signature
 * only changes when the set of conditions changes (escalation re-alerts).
 */
function criticalConditions(t) {
  if (!t) return []
  const out = []

  for (const id of CRITICAL_RULES) {
    const rule = SOP_RULES.find((r) => r.id === id)
    const ev = evaluateRule(rule, t)
    if (ev.status === 'TRIPPED') {
      out.push({
        code: id,
        label: rule.label,
        reading: `${fmt(ev.value)} ${rule.unit}`,
        limit: `${rule.dir === 'above' ? '>' : '<'} ${rule.limit} ${rule.unit}`,
        source: rule.source,
        fill: 1,
      })
    }
  }

  const fc = t.forecast
  if (fc?.status === 'IMMINENT') {
    out.push({
      code: 'NOWCAST',
      label: 'Wind lockout imminent',
      reading: `P ${Math.round((fc.p_lockout_23 ?? 0) * 100)}% · gust ${fmt(fc.gust_max_6h_kn, 0)} kt`,
      limit: 'P ≥ 70% or gust ≥ 32 kt',
      source: `nowcast · ${fc.model ?? 'LSTM+RF'}`,
      fill: Math.min(1, fc.p_lockout_23 ?? 0),
    })
  }

  const pro = t.proactive
  if (pro && HOT_STATUS.has(pro.status) && pro.hazard && pro.hazard !== 'NONE') {
    out.push({
      code: `PRO_${pro.hazard}`,
      label: `${String(pro.hazard).replace(/_/g, ' ').toLowerCase()} ${pro.status.toLowerCase()}`,
      reading:
        pro.eta_minutes != null && pro.eta_minutes < 9000
          ? `ETA ${formatEta(pro.eta_minutes)}`
          : pro.status,
      limit: pro.confidence != null ? `confidence ${Math.round(pro.confidence * 100)}%` : 'proactive engine',
      source: 'proactive.py',
      fill: 1,
    })
  }

  if (t.risk?.severity === 'CRITICAL' && out.length === 0) {
    out.push({
      code: 'RISK',
      label: 'Rule engine CRITICAL',
      reading: `score ${fmt(t.risk.anomaly_score, 2)}`,
      limit: 'sop.py',
      source: 'risk engine',
      fill: 1,
    })
  }

  return out
}

function signatureFor(station, t, conditions) {
  const scenario = t?.replay?.scenario_id ?? t?.scenario_id ?? 'LIVE'
  return [station, scenario, conditions.map((c) => c.code).sort().join('+')].join(':')
}

export default function CriticalOverlay() {
  const selectedStation = usePolarisStore((s) => s.selectedStation)
  const bharati = usePolarisStore((s) => s.telemetry.BHARATI)
  const maitri = usePolarisStore((s) => s.telemetry.MAITRI)
  const criticalAck = usePolarisStore((s) => s.criticalAck)
  const ackCritical = usePolarisStore((s) => s.ackCritical)
  const updateControls = usePolarisStore((s) => s.updateControls)
  const setSelectedStation = usePolarisStore((s) => s.setSelectedStation)
  const setShowTelemetry = usePolarisStore((s) => s.setShowTelemetry)
  const setHudTab = usePolarisStore((s) => s.setHudTab)
  const [applying, setApplying] = useState(false)

  const telemetry = selectedStation === 'MAITRI' ? maitri : bharati
  const otherStation = selectedStation === 'MAITRI' ? 'BHARATI' : 'MAITRI'
  const otherTelemetry = selectedStation === 'MAITRI' ? bharati : maitri

  const conditions = useMemo(() => criticalConditions(telemetry), [telemetry])
  const otherConditions = useMemo(() => criticalConditions(otherTelemetry), [otherTelemetry])

  const actions = (telemetry?.risk?.prescribed_actions ?? [])
    .concat(telemetry?.proactive?.recommended_actions ?? [])
    .filter((text, i, arr) => !/isolation forest/i.test(String(text)) && arr.indexOf(text) === i)
    .slice(0, 5)

  // The interrupt is for a selected historical day (5 Aug, 11 Aug, …).
  // Live Open-Meteo data stays on the desk without the full-screen alert.
  const historical = Boolean(telemetry?.replay?.active)
  const otherHistorical = Boolean(otherTelemetry?.replay?.active)
  const isCritical = historical && conditions.length > 0
  const signature = isCritical ? signatureFor(selectedStation, telemetry, conditions) : null
  const acknowledged = Boolean(signature) && criticalAck === signature

  useEffect(() => {
    if (!isCritical || acknowledged) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') ackCritical(signature)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCritical, acknowledged, signature, ackCritical])

  const apply = async () => {
    setApplying(true)
    try {
      await updateControls({
        hatch_lockdown: true,
        science_instruments_online: actions.includes(SOP.SHED_SCIENCE)
          ? false
          : telemetry?.controls?.science_instruments_online,
        summer_wing_isolated:
          actions.includes(SOP.ISOLATE_SUMMER) || actions.includes(SOP.ISOLATE_DEPRESSURIZE),
        aux_generator_active: actions.includes(SOP.AUX_GEN),
      })
    } catch {
      // Edge may be offline; still acknowledge so the operator isn't blocked.
    }
    setApplying(false)
    setShowTelemetry(true)
    setHudTab('live')
    ackCritical(signature)
  }

  const otherChip =
    otherHistorical && otherConditions.length > 0 ? (
      <button
        type="button"
        onClick={() => setSelectedStation(otherStation)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-red-500/50 bg-red-950/85 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-red-200 shadow-[0_0_24px_rgba(239,68,68,0.35)] backdrop-blur hover:bg-red-900/90"
      >
        <span className="h-2 w-2 animate-ping rounded-full bg-red-400" />
        {otherStation} critical · {otherConditions[0].label}
        <ArrowRightLeft size={12} />
      </button>
    ) : null

  if (!isCritical) {
    return otherChip ? (
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[120] -translate-x-1/2">{otherChip}</div>
    ) : null
  }

  if (acknowledged) {
    return (
      <>
        <div className="critical-edge pointer-events-none fixed inset-0 z-[110]" />
        <div className="pointer-events-none fixed left-1/2 top-3 z-[120] flex -translate-x-1/2 flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => ackCritical(null)}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-red-500/60 bg-red-950/90 py-1.5 pl-2 pr-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.45)] backdrop-blur hover:bg-red-900"
            title="Reopen critical brief"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/25">
              <AlertOctagon size={14} className="animate-pulse text-red-300" />
            </span>
            {selectedStation} critical
            {telemetry?.replay?.clock ? ` · ${String(telemetry.replay.clock).slice(0, 10)}` : ''}
            <span className="text-red-300/80">·</span>
            <span className="normal-case tracking-normal text-red-200">
              {conditions[0].label} {conditions[0].reading}
            </span>
            {conditions.length > 1 && (
              <span className="rounded bg-red-500/30 px-1.5 py-px text-[10px]">+{conditions.length - 1}</span>
            )}
            <ChevronUp size={13} className="text-red-300" />
          </button>
          {otherChip}
        </div>
      </>
    )
  }

  const t = telemetry
  return (
    <div className="critical-edge-strong fixed inset-0 z-[120] grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(60,6,12,0.72),rgba(6,1,3,0.9))] p-4 backdrop-blur-[3px]">
      <div className="critical-card-in relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-red-500/50 bg-[linear-gradient(160deg,rgba(40,8,14,0.97),rgba(14,4,8,0.97))] shadow-[0_0_80px_-10px_rgba(239,68,68,0.55)]">
        <div className="h-1 w-full animate-pulse bg-gradient-to-r from-red-600 via-orange-400 to-red-600" />
        <button
          type="button"
          onClick={() => ackCritical(signature)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-red-300/70 hover:bg-red-500/15 hover:text-red-100"
          aria-label="Acknowledge"
        >
          <X size={16} />
        </button>

        <div className="px-6 pb-5 pt-5">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">
            <BellRing size={13} className="animate-pulse" />
            SOP interrupt · {selectedStation}
            {telemetry?.replay?.clock ? ` · ${String(telemetry.replay.clock).slice(0, 10)}` : ''}
            <span className="text-red-400/50">·</span>
            <span className="text-red-300/80">{conditions.length} condition{conditions.length > 1 ? 's' : ''}</span>
          </div>
          <h2 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-[0.18em] text-red-100">
            <ShieldAlert className="text-red-400" size={30} /> CRITICAL
          </h2>

          <div className="mt-4 space-y-2">
            {conditions.map((c) => (
              <div
                key={c.code}
                className="rounded-xl border border-red-500/30 bg-red-500/[0.07] px-3.5 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold capitalize text-red-100">{c.label}</span>
                  <span className="font-mono text-sm font-bold text-red-300">{c.reading}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-red-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                    style={{ width: `${Math.round(c.fill * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-red-300/60">
                  <span>limit {c.limit}</span>
                  <span>{c.source}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[10px]">
            {[
              ['Wind', `${fmt(t?.ambient?.wind_speed_knots, 0)} kt`],
              ['Habitat', `${fmt(t?.thermal?.internal_temp_c)}°C`],
              ['Fuel', `${fmt(t?.fuel?.days_of_autonomy, 0)} d`],
              ['Outdoor', t?.lockouts?.outdoor ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/5 bg-black/30 px-2 py-1.5">
                <div className="uppercase tracking-wider text-slate-500">{k}</div>
                <div className="mt-0.5 font-bold text-slate-100">{v}</div>
              </div>
            ))}
          </div>

          {actions.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
                Prescribed actions
              </div>
              <ol className="space-y-1 text-[13px] text-amber-100/90">
                {actions.map((line, i) => (
                  <li key={line} className="flex gap-2">
                    <span className="font-mono text-amber-400/70">{i + 1}.</span>
                    <span>{String(line).replace(/^ACTION:\s*/i, '')}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => ackCritical(signature)}
              className="rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-500/25"
            >
              Acknowledge <span className="text-red-300/60">(Esc)</span>
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={apply}
              className="rounded-xl border border-amber-400/50 bg-amber-500/20 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-60"
            >
              {applying ? 'Applying…' : 'Apply SOP controls'}
            </button>
          </div>
          {otherChip && <div className="mt-3 flex justify-center">{otherChip}</div>}
        </div>
      </div>
    </div>
  )
}
