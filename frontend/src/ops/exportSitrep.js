import { jsPDF } from 'jspdf'

import { VOICE_URL } from '../api/telemetry'
import {
  fuelDecision,
  INSTRUMENTS,
  instrumentStatus,
  opsDate,
  polarState,
  shipNearby,
  voyageState,
  voyageClock,
  windowStatus,
} from './decisions'
import { buildDayBrief } from './dayBrief'

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 12) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function sectionTitle(doc, label, y) {
  doc.setDrawColor(90, 120, 130)
  doc.setLineWidth(0.6)
  doc.line(40, y - 8, 555, y - 8)
  doc.setTextColor(232, 196, 138)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(label, 40, y)
  doc.setFont('helvetica', 'normal')
  return y + 16
}

function kv(doc, rows, y, cols = 2) {
  doc.setFontSize(9)
  const colW = cols === 2 ? 250 : 515
  rows.forEach((row, i) => {
    const col = i % cols
    const rowIndex = Math.floor(i / cols)
    const x = 40 + col * (colW + 15)
    const yy = y + rowIndex * 28
    doc.setTextColor(120, 145, 155)
    doc.setFontSize(7)
    doc.text(String(row.k).toUpperCase(), x, yy)
    doc.setTextColor(220, 236, 242)
    doc.setFontSize(10)
    doc.text(String(row.v), x, yy + 12, { maxWidth: colW - 8 })
  })
  return y + Math.ceil(rows.length / cols) * 28 + 6
}

function buildFacts(station, telemetry, delayDays, plantMode) {
  const date = opsDate(telemetry)
  const polar = polarState(station, date)
  const fuel = fuelDecision(telemetry, station, date, delayDays)
  const windows = windowStatus(station, date)
  const ship = voyageState(voyageClock(date, delayDays))
  const brief = buildDayBrief(telemetry, station, delayDays)
  const f = telemetry?.forecast || {}
  const instruments = (INSTRUMENTS[station] ?? []).map((item) => ({
    ...item,
    status: instrumentStatus(item, telemetry, polar),
  }))
  return { date, polar, fuel, windows, ship, brief, f, instruments, plantMode }
}

function localAnalysis(facts, station, telemetry) {
  const { fuel, polar, ship, f, brief } = facts
  const wind = n(telemetry?.ambient?.wind_speed_knots)
  const parts = []
  parts.push(
    `${station} is ${brief.active ? 'on a historical clock' : 'on the live Open-Meteo clock'} in ${polar.phase}. ` +
      `Ambient ${n(telemetry?.ambient?.temp_c).toFixed(1)} °C / ${wind.toFixed(0)} kt.`,
  )
  if (f.status && f.status !== 'CLEAR') {
    parts.push(
      `Nowcast ${f.model || 'LSTM+RF'} is ${f.status}: 6 h peak gust ${n(f.gust_max_6h_kn).toFixed(1)} kt, ` +
        `P(≥23 kt) ${Math.round(n(f.p_lockout_23) * 100)}%.`,
    )
  } else {
    parts.push(
      `6 h nowcast clear-ish: peak gust ${n(f.gust_max_6h_kn, wind).toFixed(1)} kt ` +
        `(LSTM gust + RF lockout blend).`,
    )
  }
  parts.push(
    `Fuel ${fuel.days.toFixed(1)} d modeled · ship ETA ${fuel.etaDays ?? '—'} d · ` +
      `at ETA ${n(fuel.fuelAtEta, fuel.days).toFixed(0)} d left` +
      (fuel.shortageDays > 0 ? ` · SHORT ${fuel.shortageDays.toFixed(0)} d before ship` : '') +
      `.`,
  )
  parts.push(
    `Voyage: ${ship.label || ship.leg}. Outdoor ${telemetry?.lockouts?.outdoor || '—'} · ` +
      `heli ${telemetry?.lockouts?.heli || '—'}.`,
  )
  const actions = telemetry?.risk?.prescribed_actions || []
  if (actions.length) {
    parts.push(`SOP: ${actions.map((a) => a.replace(/^ACTION:\s*/i, '')).join('; ')}.`)
  } else {
    parts.push('No SOP actions fired — inside published floors.')
  }
  return parts.join(' ')
}

async function fetchAiAnalysis(payload) {
  try {
    const response = await fetch(`${VOICE_URL}/api/sitrep/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const data = await response.json()
    return data?.analysis || null
  } catch {
    return null
  }
}

/**
 * Formal multi-section SITREP PDF. Tries Groq via voice-backend for the
 * analysis paragraph; falls back to a deterministic ops brief.
 */
export async function exportSitrep({ station, telemetry, delayDays = 0, plantMode }) {
  const facts = buildFacts(station, telemetry, delayDays, plantMode)
  const { date, polar, fuel, windows, ship, brief, f, instruments } = facts
  const stamp = date.toISOString().replace(/[:.]/g, '').slice(0, 15)
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'

  const local = localAnalysis(facts, station, telemetry)
  const groqText = await fetchAiAnalysis({
      station,
      clock: date.toISOString(),
      severity,
      mode: brief.active ? 'HISTORICAL' : 'LIVE',
      ambient: telemetry?.ambient,
      forecast: f,
      fuel: {
        days: fuel.days,
        band: fuel.band,
        etaDays: fuel.etaDays,
        fuelAtEta: fuel.fuelAtEta,
        shortageDays: fuel.shortageDays,
        missWindow: fuel.missWindow,
      },
      lockouts: telemetry?.lockouts,
      polar: polar.phase,
      ship: { phase: ship.phase, leg: ship.leg, label: ship.label },
      actions: telemetry?.risk?.prescribed_actions || [],
      citation: brief.citation,
      note: brief.headline,
    })
  const ai = groqText || local
  const usedGroq = Boolean(groqText)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = 595
  const pageH = 842

  // Header bar
  doc.setFillColor(5, 14, 19)
  doc.rect(0, 0, pageW, pageH, 'F')
  doc.setFillColor(18, 36, 44)
  doc.rect(0, 0, pageW, 72, 'F')
  doc.setTextColor(243, 224, 184)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('POLARIS  ·  SITUATION REPORT', 40, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(154, 181, 191)
  doc.text(`NCPOR Digital Twin  ·  ${station}`, 40, 48)
  doc.text(date.toISOString().replace('T', '  ').slice(0, 19) + ' UTC', 40, 62)
  doc.setFontSize(11)
  doc.setTextColor(
    severity === 'CRITICAL' ? 255 : severity === 'ADVISORY' ? 232 : 100,
    severity === 'CRITICAL' ? 107 : severity === 'ADVISORY' ? 196 : 216,
    severity === 'CRITICAL' ? 124 : severity === 'ADVISORY' ? 138 : 160,
  )
  doc.text(severity, 480, 40)

  let y = 96
  y = sectionTitle(doc, '1.  EXECUTIVE ANALYSIS', y)
  doc.setTextColor(120, 145, 155)
  doc.setFontSize(7)
  doc.text(usedGroq ? 'SOURCE · GROQ (voice-backend)' : 'SOURCE · LOCAL OPS BRIEF', 40, y)
  y += 12
  doc.setTextColor(201, 232, 241)
  doc.setFontSize(9)
  y = wrapText(doc, ai, 40, y, 515, 12) + 10

  y = sectionTitle(doc, '2.  DAY BRIEF', y)
  y = kv(doc, [
    { k: 'Mode', v: brief.active ? `HISTORICAL · ${brief.dateLabel}` : 'LIVE · Open-Meteo' },
    { k: 'Polar', v: polar.phase },
    { k: 'Wind', v: `${n(telemetry?.ambient?.wind_speed_knots).toFixed(1)} kt` },
    { k: 'Air T', v: `${n(telemetry?.ambient?.temp_c).toFixed(1)} °C` },
    {
      k: 'Sea / Air',
      v: windows.map((w) => `${w.id} ${w.openNow ? 'OPEN' : 'SHUT'}`).join(' · '),
    },
    { k: 'Ship', v: ship.label || ship.leg || '—' },
  ], y)

  y = sectionTitle(doc, '3.  FUEL vs RESUPPLY', y)
  y = kv(doc, [
    { k: 'Autonomy now', v: `${fuel.days.toFixed(1)} d · ${fuel.band}` },
    { k: 'Ship delay', v: delayDays ? `+${delayDays} d` : 'on calendar' },
    { k: 'ETA to bay', v: fuel.etaDays != null ? `${Number(fuel.etaDays).toFixed(0)} d` : '—' },
    { k: 'Fuel at ETA', v: fuel.fuelAtEta != null ? `${Number(fuel.fuelAtEta).toFixed(1)} d` : '—' },
    {
      k: 'Shortage',
      v: fuel.shortageDays > 0 ? `${fuel.shortageDays.toFixed(0)} d before ship` : 'covers ETA',
    },
    {
      k: 'Sea window',
      v: fuel.missWindow
        ? 'MISSED'
        : fuel.next
          ? fuel.next.open
            ? `${fuel.next.days} d to close`
            : 'closed'
          : '—',
    },
  ], y)

  y = sectionTitle(doc, '4.  6 H NOWCAST (LSTM gust + RF lockout)', y)
  y = kv(doc, [
    { k: 'Model', v: f.model || 'off' },
    { k: 'Status', v: f.status || '—' },
    { k: 'Peak gust 6 h', v: f.gust_max_6h_kn != null ? `${n(f.gust_max_6h_kn).toFixed(1)} kt` : '—' },
    { k: 'P(≥23 kt)', v: f.p_lockout_23 != null ? `${Math.round(n(f.p_lockout_23) * 100)}%` : '—' },
    { k: 'Min T 6 h', v: f.temp_min_6h_c != null ? `${n(f.temp_min_6h_c).toFixed(1)} °C` : '—' },
    { k: 'P(heli 40)', v: f.p_heli_40 != null ? `${Math.round(n(f.p_heli_40) * 100)}%` : '—' },
  ], y)

  y = sectionTitle(doc, '5.  LOCKOUTS & SOP', y)
  y = kv(doc, [
    { k: 'Outdoor', v: telemetry?.lockouts?.outdoor || '—' },
    { k: 'Heli', v: telemetry?.lockouts?.heli || '—' },
    { k: 'Convoy', v: telemetry?.lockouts?.convoy || '—' },
    { k: 'Field', v: telemetry?.lockouts?.field || '—' },
    {
      k: 'Bay heli',
      v: shipNearby(station, date) ? 'OPEN (ship in bay)' : 'LOCKED (ship away)',
    },
    { k: 'Plant', v: plantMode || telemetry?.plant?.mode || 'CURRENT' },
  ], y)

  const actions = telemetry?.risk?.prescribed_actions ?? []
  doc.setTextColor(154, 181, 191)
  doc.setFontSize(8)
  doc.text('Prescribed actions', 40, y)
  y += 12
  doc.setTextColor(201, 232, 241)
  doc.setFontSize(9)
  const actionLines = actions.length
    ? actions
    : ['None — station inside published SOP floors.']
  actionLines.forEach((action) => {
    y = wrapText(doc, `• ${action}`, 40, y, 515, 11) + 4
  })
  y += 8

  if (y > 620) {
    doc.addPage()
    doc.setFillColor(5, 14, 19)
    doc.rect(0, 0, pageW, pageH, 'F')
    y = 48
  }

  y = sectionTitle(doc, '6.  INSTRUMENTS', y)
  instruments.forEach((item) => {
    const ok = item.status.ok
    doc.setTextColor(ok ? 100 : 255, ok ? 216 : 107, ok ? 160 : 124)
    doc.setFontSize(8)
    doc.text(ok ? 'GO' : 'NO-GO', 40, y)
    doc.setTextColor(201, 232, 241)
    doc.text(`${item.name}`, 78, y)
    doc.setTextColor(120, 145, 155)
    doc.text(item.status.reason || '', 280, y, { maxWidth: 270 })
    y += 13
  })
  y += 10

  if (brief.citation) {
    y = sectionTitle(doc, '7.  CITATION', y)
    doc.setTextColor(154, 181, 191)
    doc.setFontSize(8)
    y = wrapText(doc, brief.citation, 40, y, 515, 10) + 8
  }

  doc.setTextColor(90, 110, 120)
  doc.setFontSize(7)
  doc.text(
    'Sources: AL/02, AL/03, IMD MAUSAM 73(3), 43-ISEA, sop.py, Open-Meteo, LSTM/RF nowcast. ' +
      'Fuel litres / indoor T / kVA are modeled unless tagged historical. Analysis via Groq when voice-backend is up.',
    40,
    820,
    { maxWidth: 515 },
  )

  doc.save(`POLARIS-SITREP-${station}-${stamp}Z.pdf`)
  return { ok: true, ai: usedGroq }
}
