function num(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function fmt(value, digits = 0, fallback = '—') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value.toFixed(digits)
}

function actions(telemetry) {
  return telemetry?.risk?.prescribed_actions ?? []
}

function toneFromSeverity(severity) {
  if (severity === 'CRITICAL') return 'critical'
  if (severity === 'ADVISORY') return 'advisory'
  return 'nominal'
}

function pushActionSignals(list, telemetry) {
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'
  for (const text of actions(telemetry)) {
    list.push({
      id: `sop:${text}`,
      tone: toneFromSeverity(severity),
      text,
    })
  }
}

function meter(label, value, max, unit, caption) {
  return {
    type: 'meter',
    label,
    value: num(value),
    max: Math.max(num(max), 1),
    unit,
    caption,
  }
}

function stack(label, segments, total, caption) {
  return {
    type: 'stack',
    label,
    segments,
    total: Math.max(num(total), 1),
    caption,
  }
}

function notes(label, lines, caption) {
  return {
    type: 'notes',
    label,
    lines,
    caption,
  }
}

const CATALOG = {
  FUEL: {
    id: 'FUEL',
    callsign: 'JET A-1 FARM',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'AUTONOMY',
        unit: 'DAYS',
        get: (t) => t?.fuel?.days_of_autonomy,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'TANK LEVEL',
        unit: 'kL',
        get: (t) => num(t?.fuel?.tank_level_liters) / 1000,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'BURN',
        unit: 'L/h',
        get: (t) => t?.fuel?.burn_rate_lph,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'SOP FLOOR',
        unit: 'DAYS',
        get: () => 30,
        format: () => '30',
        tag: 'SPEC',
      },
    ],
    signals(telemetry) {
      const list = []
      const days = num(telemetry?.fuel?.days_of_autonomy, 999)
      const burn = num(telemetry?.fuel?.burn_rate_lph)
      if (days < 30) {
        list.push({
          id: 'starve',
          tone: 'critical',
          text: 'FUEL STARVATION · AUTONOMY < 30 DAYS',
        })
      } else if (days < 90) {
        list.push({
          id: 'watch',
          tone: 'advisory',
          text: 'RESERVE WATCH · BELOW 90-DAY BUFFER',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'FARM ABOVE SOP STARVE THRESHOLD',
        })
      }
      if (burn > 160) {
        list.push({
          id: 'burn',
          tone: 'advisory',
          text: `BURN ELEVATED · ${fmt(burn, 0)} L/h`,
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const days = num(telemetry?.fuel?.days_of_autonomy)
      const burn = num(telemetry?.fuel?.burn_rate_lph)
      const liters = num(telemetry?.fuel?.tank_level_liters)
      const isolated = telemetry?.controls?.summer_wing_isolated
      return [
        meter(
          'AUTONOMY VS SOP',
          days,
          180,
          'd',
          `Live store days against the 30-day starve rule. Fill is ${fmt(liters / 1000, 0)} kL of the 600 kL Maitri-II published farm.`,
        ),
        notes(
          'OCCUPANCY COUPLING',
          [
            isolated
              ? 'Summer wing isolated — comfort load shed, burn should ease.'
              : 'Summer wing online — comfort load still on the farm.',
            `Current burn ${fmt(burn, 0)} L/h. Template only; mass-balance model later.`,
          ],
          'Slot B · later: missed-last-flight occupancy toggle',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Downhill bulk farm · North Grovnes',
        framing: { distance: 22, height: 10, lateral: 0.9 },
        features: [
          {
            id: 'tank-a',
            label: 'TANK A',
            hint: 'BULK JET A-1',
            position: [-52, 4.4, -28],
            pin: (t) => `${fmt(num(t?.fuel?.tank_level_liters) / 1000, 0)} kL`,
          },
          {
            id: 'tank-b',
            label: 'TANK B',
            hint: 'DAY / TRANSFER',
            position: [-47.6, 4.1, -26.6],
            pin: () => 'TRANSFER',
          },
          {
            id: 'pad',
            label: 'INTAKE PAD',
            hint: 'TANK CONTAINERS',
            position: [-49.9, 1.6, -24.4],
            pin: () => 'AUTO FILL',
          },
        ],
      },
      MAITRI: {
        location: 'Oasis tank farm · Schirmacher',
        framing: { distance: 9, height: 4.2, lateral: 1.05 },
        features: [
          {
            id: 'tank-a',
            label: 'TANK A',
            hint: 'HORIZONTAL STORE',
            position: [-5.5, 2.6, -1.6],
            pin: (t) => `${fmt(num(t?.fuel?.tank_level_liters) / 1000, 0)} kL`,
          },
          {
            id: 'tank-b',
            label: 'TANK B',
            hint: 'HORIZONTAL STORE',
            position: [-5.5, 2.6, 0],
            pin: () => 'PAIR',
          },
        ],
      },
    },
  },

  MICROGRID: {
    id: 'MICROGRID',
    callsign: 'CHP / POWER HOUSE',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'TOTAL LOAD',
        unit: 'kVA',
        get: (t) => t?.microgrid?.total_load_kva,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'CAPACITY',
        unit: 'kVA',
        get: (t) => t?.microgrid?.chp_capacity_kva,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'CHP HEAT',
        unit: 'kW',
        get: (t) => t?.thermal?.chp_thermal_output_kw,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'AUX GEN',
        unit: '',
        get: (t) => (t?.controls?.aux_generator_active ? 1 : 0),
        format: (_, t) =>
          t?.controls?.aux_generator_active ? 'ONLINE' : 'STANDBY',
      },
    ],
    signals(telemetry) {
      const list = []
      const total = num(telemetry?.microgrid?.total_load_kva)
      const cap = num(telemetry?.microgrid?.chp_capacity_kva, 750)
      if (telemetry?.controls?.aux_generator_active) {
        list.push({
          id: 'aux',
          tone: 'advisory',
          text: 'AUXILIARY GENERATOR SPUN UP',
        })
      }
      if (!telemetry?.controls?.science_instruments_online) {
        list.push({
          id: 'shed',
          tone: 'advisory',
          text: 'SCIENCE PAYLOADS SHED',
        })
      }
      if (total / cap > 0.85) {
        list.push({
          id: 'headroom',
          tone: 'advisory',
          text: 'LOAD HEADROOM UNDER 15%',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'CHP INSIDE RATED ENVELOPE',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const g = telemetry?.microgrid ?? {}
      return [
        stack(
          'LOAD STACK',
          [
            { id: 'ess', label: 'ESSENTIAL', value: num(g.essential_load_kva), tone: 'ess' },
            { id: 'sci', label: 'SCIENCE', value: num(g.science_load_kva), tone: 'sci' },
            { id: 'com', label: 'COMFORT', value: num(g.comfort_load_kva), tone: 'com' },
          ],
          num(g.chp_capacity_kva, 750),
          'Essential / science / comfort against CHP rated kVA. Template bind only.',
        ),
        meter(
          'THERMAL COGEN',
          num(telemetry?.thermal?.chp_thermal_output_kw),
          600,
          'kW',
          `Aux heater ${fmt(telemetry?.thermal?.aux_heater_kw, 0)} kW. Waste-heat narrative from Bharati CHP brief.`,
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'L1 technical / garage wing',
        framing: { distance: 16, height: 8, lateral: 1 },
        features: [
          {
            id: 'chp',
            label: 'CHP BLOCK',
            hint: 'COGEN HALL',
            position: [30, 5.2, -16],
            pin: (t) => `${fmt(t?.microgrid?.total_load_kva, 0)} kVA`,
          },
          {
            id: 'aux',
            label: 'AUX SET',
            hint: 'STANDBY',
            position: [33.4, 3.6, -16],
            pin: (t) =>
              t?.controls?.aux_generator_active ? 'LIVE' : 'STANDBY',
          },
        ],
      },
      MAITRI: {
        location: 'Power house · planned 600–750 kVA',
        framing: { distance: 8, height: 3.6, lateral: 1.1 },
        features: [
          {
            id: 'chp',
            label: 'GENERATOR',
            hint: 'UTILITY BLOCK',
            position: [5.2, 2.8, -1.5],
            pin: (t) => `${fmt(t?.microgrid?.total_load_kva, 0)} kVA`,
          },
        ],
      },
    },
  },

  STRUCTURE: {
    id: 'STRUCTURE',
    callsign: 'STATION ENVELOPE',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'INTERNAL',
        unit: '°C',
        get: (t) => t?.thermal?.internal_temp_c,
        format: (v) => fmt(v, 1),
      },
      {
        label: 'AMBIENT',
        unit: '°C',
        get: (t) => t?.ambient?.temp_c,
        format: (v) => fmt(v, 1),
      },
      {
        label: 'HEAT LOSS',
        unit: 'kW',
        get: (t) => t?.thermal?.heat_loss_kw,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'HATCH',
        unit: '',
        get: (t) => (t?.controls?.hatch_lockdown ? 1 : 0),
        format: (_, t) =>
          t?.controls?.hatch_lockdown ? 'LOCKED' : 'OPEN',
      },
    ],
    signals(telemetry) {
      const list = []
      const wind = num(telemetry?.ambient?.wind_speed_knots)
      const internal = num(telemetry?.thermal?.internal_temp_c, 20)
      if (wind > 60) {
        list.push({
          id: 'wind',
          tone: 'critical',
          text: `STRUCTURAL RISK · WIND ${fmt(wind, 0)} kt`,
        })
      }
      if (internal < 16) {
        list.push({
          id: 'thermal',
          tone: 'critical',
          text: 'THERMAL COLLAPSE · INTERNAL < 16°C',
        })
      }
      if (telemetry?.controls?.hatch_lockdown) {
        list.push({
          id: 'hatch',
          tone: 'critical',
          text: 'EXTERIOR HATCH AIRLOCK ENGAGED',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'ENVELOPE NOMINAL · DESIGN −40 / +20',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const internal = num(telemetry?.thermal?.internal_temp_c)
      const loss = num(telemetry?.thermal?.heat_loss_kw)
      const wind = num(telemetry?.ambient?.wind_speed_knots)
      return [
        meter(
          'HABITAT SETPOINT',
          internal,
          24,
          '°C',
          'Bharati facade designed −40°C outside / +20°C inside (Wicona). Template bind.',
        ),
        meter(
          'WIND-DRIVEN LOSS',
          loss,
          450,
          'kW',
          `Heat loss ${fmt(loss, 0)} kW at ${fmt(wind, 0)} kt. U-value 0.135 W/m²K is catalog, not a live FEA.`,
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Aerodynamic hull · 53 × 30 × 16 m',
        framing: { distance: 38, height: 16, lateral: 0.85 },
        features: [
          {
            id: 'hull',
            label: 'HULL',
            hint: '134 ISO CORE',
            position: [0, 12.2, 0],
            pin: (t) => `${fmt(t?.thermal?.internal_temp_c, 1)}°C`,
          },
          {
            id: 'columns',
            label: 'V-COLUMNS',
            hint: '6 m OVERHANG',
            position: [18, 5.2, 8],
            pin: () => 'DRIFT GAP',
          },
          {
            id: 'glaze',
            label: 'GLAZING',
            hint: 'U = 0.5',
            position: [0, 10.5, 15.2],
            pin: (t) => `${fmt(t?.ambient?.temp_c, 0)}°C OUT`,
          },
        ],
      },
      MAITRI: {
        location: 'Steel-stilt main building · 1988 plant',
        framing: { distance: 14, height: 6, lateral: 1 },
        features: [
          {
            id: 'hull',
            label: 'MAIN BLOCK',
            hint: 'STILTS',
            position: [0, 4.2, 0],
            pin: (t) => `${fmt(t?.thermal?.internal_temp_c, 1)}°C`,
          },
        ],
      },
    },
  },

  ROOF: {
    id: 'ROOF',
    callsign: 'TERRACE / HVAC',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'SOLAR',
        unit: 'W/m²',
        get: (t) => t?.ambient?.solar_flux_w_m2,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'AMBIENT',
        unit: '°C',
        get: (t) => t?.ambient?.temp_c,
        format: (v) => fmt(v, 1),
      },
      {
        label: 'WIND',
        unit: 'kt',
        get: (t) => t?.ambient?.wind_speed_knots,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'LEVEL',
        unit: '',
        get: () => 3,
        format: () => 'L3',
        tag: 'AL/02',
      },
    ],
    signals(telemetry) {
      const list = []
      const solar = num(telemetry?.ambient?.solar_flux_w_m2)
      if (solar <= 0) {
        list.push({
          id: 'night',
          tone: 'advisory',
          text: 'POLAR NIGHT / ZERO SOLAR ON TERRACE',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'TERRACE ILLUMINATED · HVAC PLANT ONLINE',
        })
      }
      if (num(telemetry?.ambient?.wind_speed_knots) > 60) {
        list.push({
          id: 'stow',
          tone: 'critical',
          text: 'STOW EXTERNAL WEATHER SENSORS',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const solar = num(telemetry?.ambient?.solar_flux_w_m2)
      return [
        meter(
          'SOLAR FLUX',
          solar,
          400,
          'W/m²',
          'Bharati polar day ~63 d / night ~49 d. Slot later binds the year-ring clock.',
        ),
        notes(
          'L3 PROGRAM',
          [
            'HVAC + science terrace on the aerodynamic roof.',
            'Railing, chimney stacks, and instrument masts are the click targets.',
          ],
          'Catalog from AL/02 floor program',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Roof plant · 15.6 m terrace',
        framing: { distance: 18, height: 9, lateral: 0.7 },
        features: [
          {
            id: 'plant',
            label: 'HVAC PLANT',
            hint: 'L3',
            position: [-7.5, 17.4, 0],
            pin: (t) => `${fmt(t?.ambient?.solar_flux_w_m2, 0)} W`,
          },
          {
            id: 'stack',
            label: 'STACKS',
            hint: 'EXHAUST',
            position: [-3.3, 17.8, 1.4],
            pin: () => 'CHIMNEY',
          },
          {
            id: 'rail',
            label: 'RAILING',
            hint: 'SCIENCE DECK',
            position: [-7.5, 17.0, 3.9],
            pin: () => 'TERRACE',
          },
        ],
      },
      MAITRI: {
        location: 'Roof instruments (shared with comms)',
        framing: { distance: 10, height: 5, lateral: 0.9 },
        features: [
          {
            id: 'plant',
            label: 'ROOF',
            hint: 'MAST DECK',
            position: [0, 4.8, 0],
            pin: (t) => `${fmt(t?.ambient?.solar_flux_w_m2, 0)} W`,
          },
        ],
      },
    },
  },

  COMMUNICATIONS: {
    id: 'COMMUNICATIONS',
    callsign: 'RADOME / C-BAND',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'LINK',
        unit: '',
        get: (t) => t?.link_status?.type,
        format: (v) => v || 'C-band/LEO',
      },
      {
        label: 'LATENCY',
        unit: 'ms',
        get: (t) => t?.link_status?.latency_ms,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'HEALTH',
        unit: '',
        get: (t) => t?.link_status?.health,
        format: (v) => v || 'ONLINE',
      },
      {
        label: 'PATH',
        unit: '',
        get: () => 'NRSC',
        format: () => 'SHADNAGAR',
        tag: 'AL/02',
      },
    ],
    signals(telemetry) {
      const list = []
      const health = telemetry?.link_status?.health
      if (health === 'DEGRADED') {
        list.push({
          id: 'deg',
          tone: 'advisory',
          text: 'SATELLITE LINK DEGRADED',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'C-BAND / LEO PATH NOMINAL',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const latency = num(telemetry?.link_status?.latency_ms)
      return [
        meter(
          'ROUND TRIP',
          latency,
          900,
          'ms',
          'Twin spec injects 400–800 ms polar satellite delay. Not a live modem.',
        ),
        notes(
          'ISRO / HF SLOT',
          [
            'Bharati is the ECIL X/S-band reception + C-band story.',
            'Later: NOAA R-scale / Kp banner lands in this frame.',
          ],
          'Catalog · analysis later',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Ridge radome · west of hull',
        framing: { distance: 28, height: 14, lateral: 0.85 },
        features: [
          {
            id: 'dome',
            label: 'RADOME',
            hint: 'X/S + C',
            position: [-74, 20, -70],
            pin: (t) => t?.link_status?.health || 'ONLINE',
          },
          {
            id: 'pedestal',
            label: 'PEDESTAL',
            hint: 'RIDGE',
            position: [-74, 8.2, -70],
            pin: (t) => `${fmt(t?.link_status?.latency_ms, 0)} ms`,
          },
        ],
      },
      MAITRI: {
        location: 'Roof radome + HF mast',
        framing: { distance: 8, height: 4.5, lateral: 1 },
        features: [
          {
            id: 'dome',
            label: 'RADOME',
            hint: 'SAT',
            position: [2.6, 5.6, 0],
            pin: (t) => t?.link_status?.health || 'ONLINE',
          },
          {
            id: 'mast',
            label: 'MAST',
            hint: 'HF / VHF',
            position: [-2.8, 6.2, 0],
            pin: (t) => `${fmt(t?.link_status?.latency_ms, 0)} ms`,
          },
        ],
      },
    },
  },

  SAFETY: {
    id: 'SAFETY',
    callsign: 'HELIPAD / LOCKOUT',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'WIND',
        unit: 'kt',
        get: (t) => t?.ambient?.wind_speed_knots,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'HATCH',
        unit: '',
        get: (t) => (t?.controls?.hatch_lockdown ? 1 : 0),
        format: (_, t) =>
          t?.controls?.hatch_lockdown ? 'LOCKED' : 'CLEAR',
      },
      {
        label: 'OUTDOOR',
        unit: '',
        get: (t) => num(t?.ambient?.wind_speed_knots),
        format: (v) => (v > 60 ? 'NO-GO' : 'VFR WATCH'),
      },
      {
        label: 'PADS',
        unit: '',
        get: () => 2,
        format: () => '2',
        tag: 'SCENE',
      },
    ],
    signals(telemetry) {
      const list = []
      const wind = num(telemetry?.ambient?.wind_speed_knots)
      if (telemetry?.controls?.hatch_lockdown) {
        list.push({
          id: 'lock',
          tone: 'critical',
          text: 'OUTDOOR LOCKED · HATCH SEQUENCE',
        })
      }
      if (wind > 60) {
        list.push({
          id: 'heli',
          tone: 'critical',
          text: 'HELI / CONVOY LOCKOUT · WIND > 60 kt',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'PADS CLEAR · SHIP-BASED HELI ONLY WHEN VOYAGE IN',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const wind = num(telemetry?.ambient?.wind_speed_knots)
      return [
        meter(
          'WIND VS LOCKOUT',
          wind,
          80,
          'kt',
          'SOP: wind > 60 kt → hatch lockdown + stow sensors. Rule copy, not a trained classifier.',
        ),
        notes(
          'AIR OPS',
          [
            'Bharati: two marked pads in the scene.',
            'Helicopters are ship-based when the voyage ship is at India Bay / Barrier.',
          ],
          'AL/02 · AL/03',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Seaward pads · north of hull',
        framing: { distance: 20, height: 9, lateral: 0.9 },
        features: [
          {
            id: 'pad-a',
            label: 'PAD A',
            hint: 'PRIMARY',
            position: [-22, 2.4, 48],
            pin: (t) =>
              num(t?.ambient?.wind_speed_knots) > 60 ? 'NO-GO' : 'OPEN',
          },
          {
            id: 'pad-b',
            label: 'PAD B',
            hint: 'SECONDARY',
            position: [-6, 2.3, 52],
            pin: (t) =>
              t?.controls?.hatch_lockdown ? 'LOCKED' : 'STANDBY',
          },
        ],
      },
      MAITRI: {
        location: 'Station helipad',
        framing: { distance: 8, height: 3.5, lateral: 1.1 },
        features: [
          {
            id: 'pad-a',
            label: 'PAD',
            hint: 'SHIP-BASED',
            position: [6.5, 1.4, 3.8],
            pin: (t) =>
              num(t?.ambient?.wind_speed_knots) > 60 ? 'NO-GO' : 'OPEN',
          },
        ],
      },
    },
  },

  CONTAINERS: {
    id: 'CONTAINERS',
    callsign: 'ISO VILLAGE',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'SUMMER WING',
        unit: '',
        get: (t) => (t?.controls?.summer_wing_isolated ? 0 : 1),
        format: (_, t) =>
          t?.controls?.summer_wing_isolated ? 'ISOLATED' : 'ONLINE',
      },
      {
        label: 'SCIENCE',
        unit: '',
        get: (t) => (t?.controls?.science_instruments_online ? 1 : 0),
        format: (_, t) =>
          t?.controls?.science_instruments_online ? 'LIVE' : 'SHED',
      },
      {
        label: 'COMFORT',
        unit: 'kVA',
        get: (t) => t?.microgrid?.comfort_load_kva,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'ISO',
        unit: '',
        get: () => 134,
        format: () => '134',
        tag: 'AL/02',
      },
    ],
    signals(telemetry) {
      const list = []
      if (telemetry?.controls?.summer_wing_isolated) {
        list.push({
          id: 'iso',
          tone: 'advisory',
          text: 'UNOCCUPIED MODULES ISOLATED',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'SUMMER CAMP / ISO YARD ENERGIZED',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      const isolated = telemetry?.controls?.summer_wing_isolated
      const comfort = num(telemetry?.microgrid?.comfort_load_kva)
      return [
        meter(
          'COMFORT LOAD',
          comfort,
          120,
          'kVA',
          isolated
            ? 'Wing isolated — comfort should sit near the 20 kVA winter floor (spec).'
            : 'Wing online — comfort near the 60 kVA summer floor (spec).',
        ),
        notes(
          'OCCUPANCY SLOT',
          [
            '134 shipping containers are structure and rooms.',
            'Later: missed-last-flight freezes summer occupancy into winter.',
          ],
          'AL/02 · add-on 8 later',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Leeward ISO yard + far dump',
        framing: { distance: 18, height: 8, lateral: 0.95 },
        features: [
          {
            id: 'orange',
            label: 'ORANGE ROW',
            hint: 'SUMMER CAMP',
            position: [-31, 3.4, -16],
            pin: (t) =>
              t?.controls?.summer_wing_isolated ? 'ISOLATED' : 'LIVE',
          },
          {
            id: 'stack',
            label: 'DOUBLE STACK',
            hint: 'WHITE / TAN',
            position: [-31, 5.2, -22.2],
            pin: () => '2-HIGH',
          },
          {
            id: 'blue',
            label: 'BLUE ISO',
            hint: 'STORES',
            position: [-38, 3.4, -16],
            pin: () => 'YARD',
          },
        ],
      },
      MAITRI: {
        location: 'Summer container huts',
        framing: { distance: 12, height: 5, lateral: 1 },
        features: [
          {
            id: 'orange',
            label: 'HUTS',
            hint: 'SUMMER',
            position: [0, 2.5, 0],
            pin: (t) =>
              t?.controls?.summer_wing_isolated ? 'ISOLATED' : 'LIVE',
          },
        ],
      },
    },
  },

  UTILITIES: {
    id: 'UTILITIES',
    callsign: 'PIPE / SERVICES',
    sourceTag: 'SYNTHETIC / MODELED',
    heroes: [
      {
        label: 'AUX HEAT',
        unit: 'kW',
        get: (t) => t?.thermal?.aux_heater_kw,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'HEAT LOSS',
        unit: 'kW',
        get: (t) => t?.thermal?.heat_loss_kw,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'INTERNAL',
        unit: '°C',
        get: (t) => t?.thermal?.internal_temp_c,
        format: (v) => fmt(v, 1),
      },
      {
        label: 'CHP HEAT',
        unit: 'kW',
        get: (t) => t?.thermal?.chp_thermal_output_kw,
        format: (v) => fmt(v, 0),
      },
    ],
    signals(telemetry) {
      const list = []
      const aux = num(telemetry?.thermal?.aux_heater_kw)
      const internal = num(telemetry?.thermal?.internal_temp_c, 20)
      if (aux > 0) {
        list.push({
          id: 'aux',
          tone: 'advisory',
          text: `AUX HEATERS ${fmt(aux, 0)} kW`,
        })
      }
      if (internal < 16) {
        list.push({
          id: 'collapse',
          tone: 'critical',
          text: 'SPIN UP STANDBY AUXILIARY GENERATOR',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'SERVICE RUNS NOMINAL',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots(telemetry) {
      return [
        meter(
          'AUX HEATERS',
          num(telemetry?.thermal?.aux_heater_kw),
          200,
          'kW',
          'Pipes on posts are the click target. Heat numbers come from the store, not a pipe CFD.',
        ),
        meter(
          'ENVELOPE LOSS',
          num(telemetry?.thermal?.heat_loss_kw),
          450,
          'kW',
          'Later: U-value × wind sqrt term from Dev 1 physics tick.',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Elevated utility walk · hull corner',
        framing: { distance: 14, height: 7, lateral: 1 },
        features: [
          {
            id: 'run',
            label: 'PIPE RUN',
            hint: 'SERVICES',
            position: [3, 6.2, 18],
            pin: (t) => `${fmt(t?.thermal?.aux_heater_kw, 0)} kW AUX`,
          },
          {
            id: 'posts',
            label: 'POSTS',
            hint: '4.4 m',
            position: [10, 5.4, 18],
            pin: () => 'WALKWAY',
          },
        ],
      },
      MAITRI: {
        location: 'Service corridor (shared envelope)',
        framing: { distance: 10, height: 4, lateral: 1 },
        features: [
          {
            id: 'run',
            label: 'SERVICES',
            hint: 'PLANT',
            position: [0, 2.5, 0],
            pin: (t) => `${fmt(t?.thermal?.aux_heater_kw, 0)} kW AUX`,
          },
        ],
      },
    },
  },

  VEHICLES: {
    id: 'VEHICLES',
    callsign: 'OPS FLEET',
    sourceTag: 'CATALOG / AL/02',
    heroes: [
      {
        label: 'PISTEN BULLY',
        unit: '',
        get: () => 4,
        format: () => '4',
        tag: 'AL/02',
      },
      {
        label: 'SCOOTERS',
        unit: '',
        get: () => 2,
        format: () => '2',
        tag: 'AL/02',
      },
      {
        label: 'WIND',
        unit: 'kt',
        get: (t) => t?.ambient?.wind_speed_knots,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'OUTDOOR',
        unit: '',
        get: (t) => num(t?.ambient?.wind_speed_knots),
        format: (v) => (v > 60 ? 'LOCKED' : 'FIELD OK'),
      },
    ],
    signals(telemetry) {
      const list = []
      const wind = num(telemetry?.ambient?.wind_speed_knots)
      if (wind > 60 || telemetry?.controls?.hatch_lockdown) {
        list.push({
          id: 'lock',
          tone: 'critical',
          text: 'CONVOY / OUTDOOR LOCKED',
        })
      } else {
        list.push({
          id: 'ok',
          tone: 'nominal',
          text: 'FLEET ON PAD · FIELD RADIUS ≤ 100 km',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots() {
      return [
        notes(
          'BHARATI FLEET',
          [
            '4 Pisten Bully · 2 snow scooters · 1 Tata Xenon-XT',
            '1 BE-71 excavator · 1 BD-50 · 1 × 50 t Mantis',
          ],
          'AL/02 inventory · not GPS-tracked',
        ),
        notes(
          'GO / NO-GO SLOT',
          [
            'Scene shows two red Pisten Bullys (pad + pond).',
            'Later: 43-ISEA ≤100 km traffic light from wind + crevasse season.',
          ],
          'Template',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Pad and pond tracks',
        framing: { distance: 14, height: 6, lateral: 1 },
        features: [
          {
            id: 'pb-1',
            label: 'BULLY 1',
            hint: 'PAD',
            position: [16, 3.1, 12],
            pin: () => 'PB',
          },
          {
            id: 'pb-2',
            label: 'BULLY 2',
            hint: 'POND TRACK',
            position: [9, 3.1, 18],
            pin: () => 'PB',
          },
        ],
      },
      MAITRI: {
        location: 'Vehicle park (AL/03 fleet is larger)',
        framing: { distance: 10, height: 4, lateral: 1 },
        features: [
          {
            id: 'pb-1',
            label: 'FLEET',
            hint: 'AL/03',
            position: [0, 1.6, 3],
            pin: () => '14 PB',
          },
        ],
      },
    },
  },

  WATER: {
    id: 'WATER',
    callsign: 'MELT POND / RO',
    sourceTag: 'CATALOG / UAV 2022',
    heroes: [
      {
        label: 'POND',
        unit: 'm r',
        get: () => 16,
        format: () => '16',
        tag: 'SCENE',
      },
      {
        label: 'AMBIENT',
        unit: '°C',
        get: (t) => t?.ambient?.temp_c,
        format: (v) => fmt(v, 1),
      },
      {
        label: 'SOLAR',
        unit: 'W/m²',
        get: (t) => t?.ambient?.solar_flux_w_m2,
        format: (v) => fmt(v, 0),
      },
      {
        label: 'UAV 2022',
        unit: 'm³',
        get: () => 29000,
        format: () => '29k',
        tag: 'UAV',
      },
    ],
    signals(telemetry) {
      const list = []
      const solar = num(telemetry?.ambient?.solar_flux_w_m2)
      const temp = num(telemetry?.ambient?.temp_c)
      if (solar <= 0 || temp < -20) {
        list.push({
          id: 'frozen',
          tone: 'nominal',
          text: 'POND LIKELY HARD · MELT SEASON CLOSED',
        })
      } else {
        list.push({
          id: 'melt',
          tone: 'advisory',
          text: 'MELT-SEASON WATCH · UAV VOLUME SLOT',
        })
      }
      pushActionSignals(list, telemetry)
      return list
    },
    slots() {
      return [
        notes(
          'DEC 2022 UAV',
          [
            'Ice-edge pond grew 2.3k → 29k m³ in the published survey week.',
            'This frame is catalog copy. Live volume is not in the store.',
          ],
          '43-ISEA UAV · analysis later',
        ),
        notes(
          'RO / FRESHWATER',
          [
            'Bharati treats its own freshwater; seawater pump house is a site module.',
            'No live liters in telemetry — do not fake a gauge.',
          ],
          'AL/02',
        ),
      ]
    },
    sites: {
      BHARATI: {
        location: 'Cyan melt pond · east of hull',
        framing: { distance: 22, height: 10, lateral: 0.9 },
        features: [
          {
            id: 'pond',
            label: 'POND',
            hint: 'MELT WATER',
            position: [26, 1.8, 34],
            pin: () => '16 m r',
          },
          {
            id: 'rim',
            label: 'ICE RIM',
            hint: 'UAV WEEK',
            position: [32, 1.6, 31],
            pin: () => '2.3→29k',
          },
        ],
      },
      MAITRI: {
        location: 'Priyadarshini Lake (off-mesh)',
        framing: { distance: 16, height: 6, lateral: 1 },
        features: [
          {
            id: 'pond',
            label: 'LAKE',
            hint: 'PRIYADARSHINI',
            position: [8, 0.8, 8],
            pin: () => 'OASIS',
          },
        ],
      },
    },
  },
}

export function getTemplate(station, id) {
  const entry = CATALOG[id]
  if (!entry) {
    return {
      id,
      callsign: id,
      location: station,
      sourceTag: 'SYNTHETIC / MODELED',
      framing: { distance: 16, height: 8, lateral: 0.95 },
      features: [],
      heroes: [],
      signals: () => [],
      slots: () => [],
    }
  }

  const site = entry.sites[station] ?? entry.sites.BHARATI

  return {
    id: entry.id,
    callsign: entry.callsign,
    sourceTag: entry.sourceTag,
    heroes: entry.heroes,
    signals: entry.signals,
    slots: entry.slots,
    location: site.location,
    framing: site.framing,
    features: site.features,
  }
}

export function formatHero(hero, telemetry) {
  const value = hero.get(telemetry)
  return hero.format(value, telemetry)
}

export function uniqueSignals(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    if (seen.has(item.id) || seen.has(item.text)) continue
    seen.add(item.id)
    seen.add(item.text)
    out.push(item)
  }
  return out
}
