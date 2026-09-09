const REPLAY_2018_08_05 = {
  scenario_id: 'REPLAY_2018_08_05',
  clock: '2018-08-05T18:00:00+00:00',
  citation:
    'IMD MAUSAM 73(3) · annual max gust 80 kn · 5 Aug 2018 · Thapliyal et al.',
  source_type: 'IMD_BHARATI',
  note:
    'Published annual max gust, not a Table 2 blizzard event. Polar night at Bharati ended 16 Jul 2018 — low winter sun, not polar night. Indoor heat and fuel-days are modeled.',
  wind_tag: '80 kn IMD annual max gust',
  temp_tag: '−12 °C modeled ambient',
  facts: [
    { label: 'GUST', value: '80 kn', tag: 'IMD annual max · 5 Aug 2018' },
    { label: 'OCCUPANCY', value: '47', tag: 'Bharati winter complement' },
    { label: 'VOYAGE', value: 'CLOSED', tag: 'DROMLAN / ship gone · heli locked' },
    { label: 'THRESHOLD', value: '23 kn', tag: 'IMD blowing-snow limit exceeded' },
  ],
  stations: {
    BHARATI: {
      ambient: { temp_c: -12.0, wind_speed_knots: 80.0, solar_flux_w_m2: 18.0 },
      occupancy: 47,
      lockouts: {
        outdoor: 'LOCKED',
        heli: 'LOCKED',
        convoy: 'LOCKED',
        field: 'LOCKED',
        reasons: [
          'IMD gust 80 kn on 5 Aug 2018',
          'Gust far above 23 kn IMD blowing-snow threshold',
          'Heli locked: ship not at Quilty Bay in August',
        ],
      },
      risk: {
        anomaly_score: -0.31,
        is_anomaly: true,
        severity: 'CRITICAL',
        prescribed_actions: [
          'ACTION: Engage exterior hatch structural airlock sequence',
          'ACTION: Stow external weather sensors',
        ],
      },
    },
    MAITRI: {
      ambient: { temp_c: -18.0, wind_speed_knots: 22.0, solar_flux_w_m2: 22.0 },
      occupancy: 25,
      lockouts: {
        outdoor: 'OPEN',
        heli: 'LOCKED',
        convoy: 'OPEN',
        field: 'OPEN',
        reasons: [
          'Same expedition clock, different weather',
          'Heli locked: shared voyage isolation',
          'Bharati 80 kn gust is not Maitri wind',
        ],
      },
      risk: {
        anomaly_score: 0.04,
        is_anomaly: false,
        severity: 'NOMINAL',
        prescribed_actions: [],
      },
    },
  },
}

export const REPLAY_PRESETS = [
  {
    clock: '2018-08-05T18:00:00+00:00',
    label: '5 AUG 2018',
    hint: '80 kn max gust · IMD Bharati',
    snapshot: REPLAY_2018_08_05,
  },
]

export function applyReplaySnapshot(baseTelemetry, snapshot, stationId) {
  const station = snapshot.stations[stationId]
  if (!station) return baseTelemetry

  return {
    ...baseTelemetry,
    station_id: stationId,
    source: snapshot.source_type,
    confidence: 'historical',
    ambient: { ...baseTelemetry.ambient, ...station.ambient },
    lockouts: station.lockouts,
    risk: station.risk ?? baseTelemetry.risk,
    replay: {
      active: true,
      scenario_id: snapshot.scenario_id,
      clock: snapshot.clock,
      citation: snapshot.citation,
      source_type: snapshot.source_type,
      occupancy: station.occupancy,
      note: snapshot.note,
      mode: 'HISTORICAL',
      facts: snapshot.facts ?? [],
      wind_tag: snapshot.wind_tag,
      temp_tag: snapshot.temp_tag,
    },
  }
}

export function clearReplay(baseTelemetry) {
  return {
    ...baseTelemetry,
    source: 'synthetic',
    confidence: 'modeled',
    replay: {
      active: false,
      scenario_id: null,
      clock: null,
      citation: null,
      source_type: null,
      occupancy: null,
      note: null,
      mode: 'LIVE',
      facts: [],
      wind_tag: null,
      temp_tag: null,
    },
    lockouts: {
      outdoor: 'OPEN',
      heli: 'OPEN',
      convoy: 'OPEN',
      field: 'OPEN',
      reasons: [],
    },
  }
}

export function findReplayPreset(clock) {
  const needle = String(clock).slice(0, 10)
  return REPLAY_PRESETS.find((preset) =>
    String(preset.clock).startsWith(needle),
  )
}
