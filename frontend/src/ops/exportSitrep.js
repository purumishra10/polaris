import { jsPDF } from 'jspdf'

import { fuelDecision, opsDate, polarState, shipNearby, windowStatus } from './decisions'
import { INSTRUMENTS, instrumentStatus } from './decisions'

export function exportSitrep({ station, telemetry }) {
  const date = opsDate(telemetry)
  const polar = polarState(station, date)
  const fuel = fuelDecision(telemetry, station, date)
  const windows = windowStatus(station, date)
  const instruments = (INSTRUMENTS[station] ?? []).map((item) => ({
    ...item,
    status: instrumentStatus(item, telemetry, polar),
  }))
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const stamp = date.toISOString().replace(/[:.]/g, '').slice(0, 15)

  doc.setFillColor(5, 14, 19)
  doc.rect(0, 0, 595, 842, 'F')
  doc.setTextColor(220, 236, 242)
  doc.setFontSize(16)
  doc.text('POLARIS SITUATION REPORT', 40, 48)
  doc.setFontSize(10)
  doc.setTextColor(154, 181, 191)
  doc.text(`${station} · ${date.toISOString()} · modeled/historical as tagged`, 40, 66)

  doc.setTextColor(243, 224, 184)
  doc.setFontSize(12)
  doc.text(`SEVERITY  ${telemetry?.risk?.severity ?? 'NOMINAL'}`, 40, 96)
  doc.setTextColor(201, 232, 241)
  doc.setFontSize(10)
  const lines = [
    `Ambient ${Number(telemetry?.ambient?.temp_c ?? 0).toFixed(1)} C · wind ${Number(telemetry?.ambient?.wind_speed_knots ?? 0).toFixed(0)} kt`,
    `Fuel ${fuel.days.toFixed(1)} d autonomy · band ${fuel.band} · ${fuel.next ? `${fuel.next.days} d to ${fuel.next.label} close` : 'no sea window'}`,
    `Polar ${polar.phase} · ship ${shipNearby(station, date) ? 'IN BAY (heli possible)' : 'AWAY (heli locked)'}`,
    `Outdoor ${telemetry?.lockouts?.outdoor ?? '—'} · heli ${telemetry?.lockouts?.heli ?? '—'}`,
    `Access: ${windows.map((item) => `${item.id} ${item.openNow ? 'OPEN' : 'CLOSED'}`).join(' · ')}`,
  ]
  lines.forEach((line, index) => doc.text(line, 40, 120 + index * 16))

  doc.setTextColor(255, 107, 124)
  doc.text('SOP ACTIONS', 40, 220)
  doc.setTextColor(201, 232, 241)
  const actions = telemetry?.risk?.prescribed_actions ?? []
  ;(actions.length ? actions : ['None. Station is inside SOP floors.']).forEach((action, index) => {
    doc.text(`- ${action}`, 40, 238 + index * 14, { maxWidth: 515 })
  })

  doc.setTextColor(154, 181, 191)
  doc.text('INSTRUMENTS', 40, 330)
  instruments.forEach((item, index) => {
    doc.setTextColor(item.status.ok ? 100 : 255, item.status.ok ? 216 : 107, item.status.ok ? 160 : 124)
    doc.text(
      `${item.status.ok ? 'GO' : 'NO-GO'}  ${item.name}  (${item.status.reason})`,
      40,
      348 + index * 13,
    )
  })

  doc.setTextColor(102, 130, 142)
  doc.setFontSize(8)
  doc.text(
    'Sources: AL/02, AL/03, IMD MAUSAM 73(3), 43-ISEA, SOP sop.py. Fuel indoor heat may be modeled. Ice overlay is seasonal climatology, not live NSIDC.',
    40,
    800,
    { maxWidth: 515 },
  )

  doc.save(`POLARIS-${station}-${stamp}Z.pdf`)
}
