import { useEffect } from 'react'

import { usePolarisStore } from '../store/usePolarisStore'
import {
  formatHero,
  getTemplate,
  uniqueSignals,
} from './subsystemCatalog'
import { assetFault } from '../ops/assetHealth'

function SlotVisual({ slot }) {
  if (slot.type === 'meter') {
    const pct = Math.max(
      0,
      Math.min(100, (slot.value / slot.max) * 100),
    )
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
        <p>{slot.caption}</p>
      </div>
    )
  }

  if (slot.type === 'stack') {
    return (
      <div className="brief-slot">
        <div className="brief-slot-head">
          <span>{slot.label}</span>
          <strong>
            {slot.segments
              .reduce((sum, item) => sum + item.value, 0)
              .toFixed(0)}{' '}
            / {slot.total.toFixed(0)}
          </strong>
        </div>
        <div className="brief-stack">
          {slot.segments.map((item) => (
            <div
              key={item.id}
              className={`brief-stack-seg ${item.tone}`}
              style={{
                width: `${Math.max(2, (item.value / slot.total) * 100)}%`,
              }}
              title={`${item.label} ${item.value.toFixed(0)}`}
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
        <p>{slot.caption}</p>
      </div>
    )
  }

  return (
    <div className="brief-slot">
      <div className="brief-slot-head">
        <span>{slot.label}</span>
      </div>
      <ul>
        {slot.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>{slot.caption}</p>
    </div>
  )
}

function useCinematicBrief({ bindEffects = false } = {}) {
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )
  const flyComplete = usePolarisStore((state) => state.flyComplete)
  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )
  const setSelectedSubsystem = usePolarisStore(
    (state) => state.setSelectedSubsystem,
  )
  const markFlyComplete = usePolarisStore((state) => state.markFlyComplete)

  useEffect(() => {
    if (!bindEffects || !selectedSubsystem) return undefined
    const fallback = window.setTimeout(() => {
      markFlyComplete()
    }, 1100)
    return () => window.clearTimeout(fallback)
  }, [bindEffects, selectedSubsystem, selectedStation, markFlyComplete])

  if (!selectedSubsystem) return null

  const template = getTemplate(selectedStation, selectedSubsystem)
  return {
    selectedStation,
    selectedSubsystem,
    flyComplete,
    telemetry,
    setSelectedSubsystem,
    template,
    heroes: template.heroes ?? [],
    features: template.features ?? [],
    signals: uniqueSignals(template.signals(telemetry) ?? []),
    slots: template.slots(telemetry) ?? [],
    fault: assetFault(selectedSubsystem, telemetry),
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
        <span>ESC TO CLOSE · {brief.template.sourceTag}</span>
      </div>

      {brief.flyComplete && (
        <div className="title-slam" key={`${brief.selectedSubsystem}-slam`}>
          <div className="title-slam-id">{brief.template.id}</div>
          <div className="title-slam-call">{brief.template.callsign}</div>
          <div className="title-slam-tag">{brief.template.sourceTag}</div>
        </div>
      )}
    </div>
  )
}

export function CinematicPanel({ className = '' }) {
  const brief = useCinematicBrief()
  if (!brief) return null

  return (
    <aside className={`cinematic-brief ${className}`.trim()} key={`${brief.selectedSubsystem}-brief`}>
      <div className="brief-header">
        <div>
          <div className="brief-kicker">PLACE INTELLIGENCE</div>
          <div className="brief-title">{brief.template.callsign}</div>
          <div className="brief-location">{brief.template.location}</div>
        </div>
        <button
          type="button"
          className="brief-close"
          onClick={() => brief.setSelectedSubsystem(null)}
        >
          CLOSE
        </button>
      </div>

      {brief.fault && (
        <div className={`brief-fault ${brief.fault.tone}`}>
          <div className="brief-fault-kicker">WHY THIS ASSET IS DOWN</div>
          <strong>{brief.fault.title}</strong>
          <p>{brief.fault.reason}</p>
        </div>
      )}

      <div className="brief-heroes">
        {brief.heroes.map((hero) => (
          <div key={hero.label} className="brief-hero">
            <span>
              {hero.label}
              {hero.tag ? ` · ${hero.tag}` : ''}
            </span>
            <strong>
              {formatHero(hero, brief.telemetry)}
              {hero.unit ? ` ${hero.unit}` : ''}
            </strong>
          </div>
        ))}
      </div>

      {brief.features.length > 0 && (
        <div className="brief-block">
          <div className="brief-block-title">FEATURES AT THIS PLACE</div>
          <div className="brief-features">
            {brief.features.map((feature) => (
              <div key={feature.id} className="brief-feature">
                <b>{feature.label}</b>
                <span>{feature.hint}</span>
                <em>
                  {typeof feature.pin === 'function'
                    ? feature.pin(brief.telemetry)
                    : ''}
                </em>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="brief-block">
        <div className="brief-block-title">SIGNALS</div>
        <div className="brief-signals">
          {brief.signals.map((signal) => (
            <div
              key={signal.id}
              className={`brief-signal ${signal.tone}`}
            >
              {signal.text}
            </div>
          ))}
        </div>
      </div>

      <div className="brief-block">
        <div className="brief-block-title">ANALYSIS FRAMES</div>
        {brief.slots.map((slot) => (
          <SlotVisual key={slot.label} slot={slot} />
        ))}
      </div>
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
