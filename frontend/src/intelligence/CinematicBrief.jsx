import { useEffect, useMemo, useState } from 'react'

import { usePolarisStore } from '../store/usePolarisStore'
import { getTemplate } from './subsystemCatalog'
import { assetFault } from '../ops/assetHealth'
import { buildAssetAnalysis } from './assetAnalysis'

function Spark({ points, color = '#56b9d8', sop = null, unit = '' }) {
  if (!points || points.length < 2) return null
  const vals = points.map((p) => p.v)
  if (sop != null && Number.isFinite(sop)) vals.push(sop)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const w = 220
  const h = 48
  const yOf = (v) => h - ((v - min) / span) * (h - 8) - 4
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yOf(p.v).toFixed(1)}`
    })
    .join(' ')
  const sopY = sop != null && Number.isFinite(sop) ? yOf(sop) : null
  return (
    <div className="asset-spark-wrap">
      <b>
        {max.toFixed(0)}
        {unit ? ` ${unit}` : ''}
      </b>
      <svg className="asset-spark" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-hidden>
        {sopY != null && (
          <line x1="0" y1={sopY} x2={w} y2={sopY} stroke="#ff6b7c" strokeDasharray="3 3" strokeWidth="1" />
        )}
        <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
      </svg>
      <em>{min.toFixed(0)}</em>
    </div>
  )
}

function DualMeter({ meter }) {
  return (
    <div className="asset-dual">
      <div className="brief-slot-head">
        <span>{meter.label}</span>
      </div>
      <div className="asset-dual-row">
        <div>
          <em>NOW</em>
          <div className="brief-meter">
            <div className="brief-meter-fill" style={{ width: `${Math.max(2, Math.min(100, meter.now))}%` }} />
          </div>
        </div>
        <div>
          <em>6 H</em>
          <div className="brief-meter later">
            <div className="brief-meter-fill" style={{ width: `${Math.max(2, Math.min(100, meter.later))}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MixBar({ mix, total, unit }) {
  if (!mix?.length || !total) return null
  return (
    <div className="asset-mix">
      <div className="asset-mix-bar">
        {mix.map((item) => (
          <div
            key={item.id}
            className={`asset-mix-seg ${item.tone}`}
            style={{ width: `${Math.max(3, (item.value / total) * 100)}%` }}
            title={`${item.label} ${item.value.toFixed(0)}`}
          />
        ))}
      </div>
      <div className="asset-mix-legend">
        {mix.map((item) => (
          <span key={item.id}>
            {item.label} {item.value.toFixed(0)} {unit}
          </span>
        ))}
      </div>
    </div>
  )
}

function GustLadder({ gates, marker, later, max = 70 }) {
  if (!gates?.length || marker == null) return null
  const pos = (v) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="asset-ladder">
      <div className="asset-ladder-track">
        {gates.map((g) => (
          <i key={g.label} className={g.hit ? 'hit' : ''} style={{ left: pos(g.at) }}>
            {g.label}
          </i>
        ))}
        <b className="now" style={{ left: pos(marker || 0) }} />
        <b className="later" style={{ left: pos(later || 0) }} />
      </div>
      <div className="asset-ladder-scale">
        <span>0</span>
        <span>{max} kt</span>
      </div>
    </div>
  )
}

function SlotVisual({ slot }) {
  if (slot.type === 'meter') {
    const pct = Math.max(0, Math.min(100, (slot.value / slot.max) * 100))
    return (
      <div className="brief-slot">
        <div className="brief-slot-head">
          <span>{slot.label}</span>
          <strong>
            {slot.value.toFixed(0)} {slot.unit}
          </strong>
        </div>
        <div className="brief-meter">
          <div className="brief-meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (slot.type === 'stack') {
    return (
      <div className="brief-slot">
        <div className="brief-slot-head">
          <span>{slot.label}</span>
          <strong>
            {slot.segments.reduce((sum, item) => sum + item.value, 0).toFixed(0)} / {slot.total.toFixed(0)}
          </strong>
        </div>
        <div className="brief-stack">
          {slot.segments.map((item) => (
            <div
              key={item.id}
              className={`brief-stack-seg ${item.tone}`}
              style={{ width: `${Math.max(2, (item.value / slot.total) * 100)}%` }}
            />
          ))}
        </div>
        <div className="brief-stack-legend">
          {slot.segments.map((item) => (
            <span key={item.id}>
              {item.label} {item.value.toFixed(0)}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return null
}

function useCinematicBrief({ bindEffects = false } = {}) {
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const selectedSubsystem = usePolarisStore((state) => state.selectedSubsystem)
  const flyComplete = usePolarisStore((state) => state.flyComplete)
  const telemetry = usePolarisStore((state) => state.telemetry[selectedStation])
  const fleet = usePolarisStore((state) => state.telemetry)
  const voyageDelayDays = usePolarisStore((state) => state.voyageDelayDays)
  const setSelectedSubsystem = usePolarisStore((state) => state.setSelectedSubsystem)
  const markFlyComplete = usePolarisStore((state) => state.markFlyComplete)

  useEffect(() => {
    if (!bindEffects || !selectedSubsystem) return undefined
    const fallback = window.setTimeout(() => markFlyComplete(), 1100)
    return () => window.clearTimeout(fallback)
  }, [bindEffects, selectedSubsystem, selectedStation, markFlyComplete])

  const analysisKey = useMemo(() => {
    if (!selectedSubsystem || !telemetry) return null
    const f = telemetry.forecast || {}
    return [
      selectedSubsystem,
      selectedStation,
      voyageDelayDays,
      Math.round(Number(telemetry.ambient?.temp_c ?? 0) * 2) / 2,
      Math.round(Number(telemetry.ambient?.wind_speed_knots ?? 0)),
      Math.round(Number(f.gust_max_6h_kn ?? 0)),
      Math.round(Number(f.p_lockout_23 ?? 0) * 20) / 20,
      Math.round(Number(telemetry.fuel?.days_of_autonomy ?? 0)),
      telemetry.risk?.severity,
      f.status,
    ].join('|')
  }, [selectedSubsystem, selectedStation, voyageDelayDays, telemetry])

  const analysis = useMemo(
    () =>
      selectedSubsystem
        ? buildAssetAnalysis(selectedSubsystem, telemetry, selectedStation, voyageDelayDays, fleet)
        : null,
    // Rebuild on quantized keys — not every 2 s telemetry object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysisKey],
  )

  if (!selectedSubsystem) return null

  const template = getTemplate(selectedStation, selectedSubsystem)
  return {
    selectedStation,
    selectedSubsystem,
    flyComplete,
    telemetry,
    setSelectedSubsystem,
    template,
    features: template.features ?? [],
    slots: template.slots(telemetry) ?? [],
    fault: assetFault(selectedSubsystem, telemetry),
    analysis,
  }
}

export function CinematicOverlays() {
  const brief = useCinematicBrief({ bindEffects: true })
  if (!brief) return null

  return (
    <div className="cinematic-overlays">
      <div className="letterbox top in">
        <span>POLARIS · {brief.selectedStation}</span>
        <span>{brief.template.callsign}</span>
      </div>
      <div className="letterbox bottom in">
        <span>{brief.template.location}</span>
        <span>ESC · {brief.analysis?.om.live ? 'LIVE WX' : 'HELD'}</span>
      </div>
      {brief.flyComplete && (
        <div className="title-slam" key={`${brief.selectedSubsystem}-slam`}>
          <div className="title-slam-id">{brief.template.id}</div>
          <div className="title-slam-call">{brief.template.callsign}</div>
          <div className="title-slam-tag">{brief.analysis?.blurb}</div>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'now', label: 'NOW' },
  { id: 'six', label: '6 H' },
  { id: 'why', label: 'WHY' },
  { id: 'plant', label: 'PLANT' },
]

export function CinematicPanel({ className = '' }) {
  const brief = useCinematicBrief()
  const [tab, setTab] = useState('now')
  if (!brief) return null
  const a = brief.analysis
  const om = a?.om
  const chart = a?.chart

  return (
    <aside className={`cinematic-brief asset-inspector ${className}`.trim()} key={`${brief.selectedSubsystem}-brief`}>
      <div className="brief-header">
        <div>
          <div className="brief-kicker">{brief.selectedStation}</div>
          <div className="brief-title">{brief.template.callsign}</div>
          <div className="brief-location">{a?.blurb}</div>
        </div>
        <button type="button" className="brief-close" onClick={() => brief.setSelectedSubsystem(null)}>
          CLOSE
        </button>
      </div>

      <div className="asset-wx">
        <span className={om?.live ? 'on' : ''}>{om?.live ? 'LIVE' : 'HELD'}</span>
        <b>{a?.wx?.tempNow?.toFixed?.(1) ?? '—'}°</b>
        <b>{a?.wx?.gustNow?.toFixed?.(1) ?? '—'} kt</b>
        <em>{om?.neighbor}</em>
      </div>

      {brief.fault && (
        <div className={`brief-fault ${brief.fault.tone}`}>
          <strong>{brief.fault.title}</strong>
        </div>
      )}

      <div className="asset-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'on' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'now' && (
        <div className="asset-tab-body">
          <div className="asset-kpi">
            {(a?.kpis || []).map((row) => (
              <div key={row.k} className={`kpi ${row.tone}`}>
                <span>{row.k}</span>
                <strong>{row.v}</strong>
                <em>{row.tag}</em>
              </div>
            ))}
          </div>
          <MixBar mix={a?.mix} total={a?.mixTotal} unit={a?.mixUnit} />
          <GustLadder gates={a?.ladder} marker={a?.markerKt} later={a?.marker6} max={a?.ladderMax} />
          {chart?.points?.length > 2 && (
            <div className="brief-slot tight">
              <div className="brief-slot-head">
                <span>
                  {chart.label} ({chart.unit})
                  {chart.sop != null ? ` · SOP ${chart.sop}` : ''}
                </span>
              </div>
              <Spark points={chart.points} color={chart.color} sop={chart.sop} unit={chart.unit} />
            </div>
          )}
          {brief.features.length > 0 && (
            <div className="brief-features compact">
              {brief.features.map((feature) => (
                <div key={feature.id} className="brief-feature">
                  <b>{feature.label}</b>
                  <em>{typeof feature.pin === 'function' ? feature.pin(brief.telemetry) : ''}</em>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'six' && (
        <div className="asset-tab-body">
          <div className={`asset-call ${a?.statusTone}`}>{a?.call}</div>
          <div className="asset-compare">
            {(a?.compares || []).map((row) => (
              <div key={row.label} className={`cmp ${row.tone}`}>
                <span>{row.label}</span>
                <b>{row.now}</b>
                <i>→</i>
                <b>{row.later}</b>
                <em>{row.delta}</em>
              </div>
            ))}
          </div>
          {(a?.meters || []).map((meter) => (
            <DualMeter key={meter.label} meter={meter} />
          ))}
          <GustLadder gates={a?.ladder} marker={a?.markerKt} later={a?.marker6} max={a?.ladderMax} />
        </div>
      )}

      {tab === 'why' && (
        <div className="asset-tab-body">
          <div className="why-form">
            <div>
              <span>ASSET</span>
              <b>{a?.why?.what || a?.blurb}</b>
            </div>
            <div>
              <span>MECHANISM</span>
              <b>{a?.why?.mechanism}</b>
            </div>
            <div>
              <span>SOP</span>
              <b>{a?.why?.sop}</b>
            </div>
            {(a?.sopRules || []).map((rule) => (
              <div key={rule.id}>
                <span>{rule.id}</span>
                <b>
                  {rule.gate} — {rule.action}
                </b>
              </div>
            ))}
            <div>
              <span>NOT</span>
              <b>{a?.why?.not}</b>
            </div>
            <div>
              <span>IDENTITY</span>
              <b>{a?.formula}</b>
            </div>
          </div>
          {chart?.points?.length > 2 && (
            <div className="brief-slot tight">
              <div className="brief-slot-head">
                <span>
                  {chart.label} ({chart.unit}) THIS PAD
                </span>
              </div>
              <Spark points={chart.points} color={chart.color} sop={chart.sop} unit={chart.unit} />
            </div>
          )}
          <div className="asset-src">
            {(a?.sources || []).map((row) => (
              <div key={row.field}>
                <span>{row.field}</span>
                <strong>{row.origin}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'plant' && (
        <div className="asset-tab-body">
          {brief.slots.map((slot) => (
            <SlotVisual key={slot.label} slot={slot} />
          ))}
        </div>
      )}
    </aside>
  )
}

export default function CinematicBrief() {
  return (
    <>
      <CinematicOverlays />
      <CinematicPanel />
    </>
  )
}
