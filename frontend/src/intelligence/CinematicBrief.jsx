import { useEffect } from 'react'

import { usePolarisStore } from '../store/usePolarisStore'
import {
  formatHero,
  getTemplate,
  uniqueSignals,
} from './subsystemCatalog'

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

export default function CinematicBrief() {
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
    if (!selectedSubsystem) return undefined
    const fallback = window.setTimeout(() => {
      markFlyComplete()
    }, 1100)
    return () => window.clearTimeout(fallback)
  }, [selectedSubsystem, selectedStation, markFlyComplete])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setSelectedSubsystem(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelectedSubsystem])

  if (!selectedSubsystem) return null

  const template = getTemplate(selectedStation, selectedSubsystem)
  const heroes = template.heroes ?? []
  const features = template.features ?? []
  const signals = uniqueSignals(template.signals(telemetry) ?? [])
  const slots = template.slots(telemetry) ?? []

  return (
    <>
      <div className="letterbox top in">
        <span>
          POLARIS · {selectedStation}
        </span>
        <span>{template.callsign}</span>
      </div>

      <div className="letterbox bottom in">
        <span>{template.location}</span>
        <span>ESC TO EXIT · {template.sourceTag}</span>
      </div>

      {flyComplete && (
        <div className="title-slam" key={`${selectedSubsystem}-slam`}>
          <div className="title-slam-id">{template.id}</div>
          <div className="title-slam-call">{template.callsign}</div>
          <div className="title-slam-tag">{template.sourceTag}</div>
        </div>
      )}

      {flyComplete && (
        <aside className="cinematic-brief" key={`${selectedSubsystem}-brief`}>
          <div className="brief-header">
            <div>
              <div className="brief-kicker">PLACE INTELLIGENCE</div>
              <div className="brief-title">{template.callsign}</div>
              <div className="brief-location">{template.location}</div>
            </div>
            <button
              type="button"
              className="brief-close"
              onClick={() => setSelectedSubsystem(null)}
            >
              CLOSE
            </button>
          </div>

          <div className="brief-heroes">
            {heroes.map((hero) => (
              <div key={hero.label} className="brief-hero">
                <span>
                  {hero.label}
                  {hero.tag ? ` · ${hero.tag}` : ''}
                </span>
                <strong>
                  {formatHero(hero, telemetry)}
                  {hero.unit ? ` ${hero.unit}` : ''}
                </strong>
              </div>
            ))}
          </div>

          {features.length > 0 && (
            <div className="brief-block">
              <div className="brief-block-title">FEATURES AT THIS PLACE</div>
              <div className="brief-features">
                {features.map((feature) => (
                  <div key={feature.id} className="brief-feature">
                    <b>{feature.label}</b>
                    <span>{feature.hint}</span>
                    <em>
                      {typeof feature.pin === 'function'
                        ? feature.pin(telemetry)
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
              {signals.map((signal) => (
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
            {slots.map((slot) => (
              <SlotVisual key={slot.label} slot={slot} />
            ))}
          </div>
        </aside>
      )}
    </>
  )
}
