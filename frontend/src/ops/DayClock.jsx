import { useEffect, useMemo, useState } from 'react'

import { usePolarisStore } from '../store/usePolarisStore'
import { getClockCatalog } from '../api/telemetry'
import { DAY_PRESETS, buildDayBrief, dateToClockIso } from './dayBrief'

export default function DayClock({ compact = false }) {
  const selectedStation = usePolarisStore((s) => s.selectedStation)
  const telemetry = usePolarisStore((s) => s.telemetry[s.selectedStation])
  const delayDays = usePolarisStore((s) => s.voyageDelayDays)
  const liveNow = usePolarisStore((s) => s.liveNow)
  const setClock = usePolarisStore((s) => s.setClock)
  const replayAug2018 = usePolarisStore((s) => s.replayAug2018)

  const replayOn = Boolean(telemetry?.replay?.active)
  const [presets, setPresets] = useState(DAY_PRESETS)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState(
    () => (telemetry?.replay?.clock || new Date().toISOString()).slice(0, 10),
  )

  useEffect(() => {
    let cancelled = false
    getClockCatalog()
      .then((data) => {
        if (cancelled || !data?.presets?.length) return
        const merged = [...DAY_PRESETS]
        for (const row of data.presets) {
          if (!merged.some((p) => p.clock.slice(0, 10) === String(row.clock).slice(0, 10))) {
            merged.push({
              clock: row.clock,
              label: row.label,
              hint: row.hint || '',
              kind: 'CATALOG',
            })
          }
        }
        setPresets(merged)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (telemetry?.replay?.clock) {
      setPicker(String(telemetry.replay.clock).slice(0, 10))
    }
  }, [telemetry?.replay?.clock])

  const brief = useMemo(
    () => buildDayBrief(telemetry, selectedStation, delayDays),
    [telemetry, selectedStation, delayDays],
  )

  const goLive = async () => {
    setBusy(true)
    try {
      await liveNow()
    } finally {
      setBusy(false)
    }
  }

  const goDate = async (iso) => {
    if (!iso) return
    setBusy(true)
    try {
      const day = String(iso).slice(0, 10)
      setPicker(day)
      if (day === '2018-08-05') await replayAug2018()
      else await setClock(iso.includes('T') ? iso : dateToClockIso(day))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`day-clock ${replayOn ? 'historical' : 'live'} ${compact ? 'compact' : ''}`}>
      <div className="day-clock-head">
        <span>EXPEDITION CLOCK</span>
        <b>{replayOn ? brief.dateLabel : 'LIVE'}</b>
      </div>

      <div className="day-clock-modes">
        <button
          type="button"
          className={!replayOn ? 'on' : ''}
          disabled={busy}
          onClick={goLive}
        >
          LIVE
        </button>
        <button
          type="button"
          className={replayOn ? 'on' : ''}
          disabled={busy}
          onClick={() => goDate(picker)}
        >
          DATE
        </button>
      </div>

      <div className="day-clock-pick">
        <input
          type="date"
          value={picker}
          min="2017-01-01"
          max="2026-12-31"
          disabled={busy}
          onChange={(event) => setPicker(event.target.value)}
        />
        <button type="button" disabled={busy || !picker} onClick={() => goDate(picker)}>
          LOAD DAY
        </button>
      </div>

      <div className="day-presets">
        {presets.slice(0, compact ? 4 : 8).map((row) => (
          <button
            key={row.clock}
            type="button"
            title={row.hint}
            className={picker === row.clock.slice(0, 10) && replayOn ? 'on' : ''}
            disabled={busy}
            onClick={() => goDate(row.clock)}
          >
            {row.label}
          </button>
        ))}
      </div>

      <div className={`day-brief ${brief.severity.toLowerCase()}`}>
        <div className="day-brief-kicker">DAY BRIEF · {selectedStation}</div>
        <p>{brief.headline}</p>
        <div className="day-brief-grid">
          {brief.lines.map((row) => (
            <div key={row.k}>
              <span>{row.k}</span>
              <strong>{row.v}</strong>
              <em>{row.tag}</em>
            </div>
          ))}
        </div>
        {brief.actions.length > 0 && (
          <ul className="day-brief-actions">
            {brief.actions.map((action) => (
              <li key={action}>{action.replace(/^ACTION:\s*/i, '')}</li>
            ))}
          </ul>
        )}
        {brief.citation && <div className="source-note">{brief.citation}</div>}
      </div>
    </div>
  )
}
