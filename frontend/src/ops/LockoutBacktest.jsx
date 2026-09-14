import { useEffect, useState } from 'react'
import { BHARATI_BLIZZARDS, GUST_80KT } from '../analysis/imdClimate'
import { getBlizzardValidation } from '../api/telemetry'
import { SOP } from './decisions'

const BLOWING_SNOW_KT = 23

function lockoutBacktestRows() {
  const table = BHARATI_BLIZZARDS.map((event) => {
    const outdoor = event.wind > BLOWING_SNOW_KT
    const structural = event.wind > SOP.WIND_STRUCTURAL_KT

    return {
      id: event.id,
      clock: event.clock,
      label: event.start,
      wind: event.wind,
      hours: event.hours,
      outdoor: outdoor ? 'LOCK' : 'OPEN',
      structural: structural ? 'LOCK' : 'OPEN',
      kind: 'Table 2 blizzard',
      note: `${event.hours} h · IMD start as published`,
    }
  })

  table.unshift({
    id: GUST_80KT.id,
    clock: '2018-08-05T18:00:00+00:00',
    label: GUST_80KT.date,
    wind: GUST_80KT.wind,
    hours: null,
    outdoor: 'LOCK',
    structural: 'LOCK',
    kind: 'Annual max gust',
    note: 'Not a Table 2 blizzard. Polar night ended 16 Jul 2018.',
  })

  const outdoorHits = table.filter((row) => row.outdoor === 'LOCK').length
  const structuralHits = table.filter((row) => row.structural === 'LOCK').length

  return {
    rows: table,
    outdoorHits,
    structuralHits,
    total: table.length,
    source:
      'IMD MAUSAM 73(3) Table 2 + 5 Aug 2018 annual max. SOP: outdoor >23 kn, structural >60 kn. No hourly ramp is published — lead-time vs start is not claimed.',
  }
}

function validationSummary(events) {
  const flagged = events.filter((event) => event.event_detection === 'FLAGGED').length
  const notFlagged = events.filter(
    (event) => event.event_detection === 'NOT_FLAGGED',
  ).length
  const unknown = events.filter((event) => event.event_detection === 'UNKNOWN').length

  return { flagged, notFlagged, unknown }
}

export default function LockoutBacktest({ onReplay }) {
  const pack = lockoutBacktestRows()

  const [validation, setValidation] = useState(null)
  const [validationError, setValidationError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadValidation() {
      try {
        const data = await getBlizzardValidation()

        if (!cancelled) {
          setValidation(data)
          setValidationError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setValidationError(error.message)
        }
      }
    }

    loadValidation()

    return () => {
      cancelled = true
    }
  }, [])

  const validationEvents = validation?.events ?? []
  const summary = validationSummary(validationEvents)

  return (
    <div className="backtest-card">
      <div className="chart-legend">
        <span>SOP vs IMD BLIZZARD LOG</span>
        <b>
          {pack.outdoorHits}/{pack.total} OUTDOOR · {pack.structuralHits}/{pack.total}{' '}
          STRUCTURAL
        </b>
      </div>

      <p className="backtest-lead">
        Rule, not a trained net. Every published event already exceeds the 23 kn
        blowing-snow floor at the logged start. Three Table 2 storms plus the 80 kn
        gust hit the 60 kn structural lock.
      </p>

      <div className="backtest-table">
        {pack.rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`backtest-row ${row.structural === 'LOCK' ? 'hard' : ''}`}
            onClick={() => onReplay?.(row)}
          >
            <span>{row.label}</span>
            <b>{row.wind} kn</b>
            <em className={row.outdoor === 'LOCK' ? 'no' : ''}>{row.outdoor}</em>
            <em className={row.structural === 'LOCK' ? 'no' : ''}>
              {row.structural === 'LOCK' ? '60 kt' : '—'}
            </em>
          </button>
        ))}
      </div>

      <div className="source-note">{pack.source}</div>

      <div className="validation-section">
        <div className="chart-legend">
          <span>HISTORICAL BLIZZARD VALIDATION</span>

          {validation && (
            <b>
              {summary.flagged}/{validation.event_count} FLAGGED
            </b>
          )}
        </div>

        {validationError && (
          <p className="backtest-lead">
            Validation unavailable: {validationError}
          </p>
        )}

        {!validation && !validationError && (
          <p className="backtest-lead">
            Loading historical replay validation…
          </p>
        )}

        {validation && (
          <>
            <div className="validation-summary">
              <strong>
                {summary.flagged}/{validation.event_count}
              </strong>
              <span>historical events flagged by IF</span>
            </div>

            <div className="validation-table">
              {validationEvents.map((event) => (
                <div className="validation-row" key={event.event_id}>
                  <span>{event.event_id.replace('BLZ-', '')}</span>

                  <b>{event.observed_max_wind_kn} kt</b>

                  <em
                    className={event.if_verdict === 'ANOMALY' ? 'no' : ''}
                  >
                    {event.if_verdict}
                  </em>

                  <em>{event.sop_severity}</em>

                  <em
                    className={
                      event.sop_structural_lockout === 'LOCKED' ? 'no' : ''
                    }
                  >
                    {event.sop_structural_lockout}
                  </em>
                </div>
              ))}
            </div>

            <div className="source-note">
              {validation.disclaimer}
            </div>
          </>
        )}
      </div>
    </div>
  )
}