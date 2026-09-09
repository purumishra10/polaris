import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { usePolarisStore } from '../store/usePolarisStore'
import { formatSeriesClock } from '../lib/telemetrySeries'
import {
  BHARATI_BLIZZARDS,
  BHARATI_MONTHLY,
  CLIMATE_SOURCE,
  GUST_80KT,
  MAITRI_MONTHLY,
  POLAR_WINDOWS,
  STATION_FACTS,
} from './imdClimate'
import LiveValue from './LiveValue'
import { parseMarkdown, renderInline, sectionsForStation } from './markdown'
import FuelDecision from '../ops/FuelDecision'
import PolarCalendar from '../ops/PolarCalendar'
import InstrumentRail from '../ops/InstrumentRail'
import MapDesk from '../ops/MapDesk'
import PlantToggle from '../ops/PlantToggle'
import LockoutBacktest from '../ops/LockoutBacktest.jsx'
import { exportSitrep } from '../ops/exportSitrep'
import {
  fuelDecision,
  opsDate,
  polarState,
  windowStatus,
} from '../ops/decisions'

import knowledgeMd from '@docs/digital_twin_knowledge_base.md?raw'
import datasetsMd from '@docs/antarctic_digital_twin_datasets.md?raw'
import papersMd from '@docs/papers_reading_guide.md?raw'

const TOOLTIP_STYLE = {
  background: 'rgba(6, 16, 22, 0.96)',
  border: '1px solid rgba(129, 175, 190, 0.28)',
  fontSize: 11,
  color: '#dcecf2',
}

function Spark({ data, dataKey, color, unit }) {
  return (
    <div className="spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, dataKey]}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.t ? formatSeriesClock(payload[0].payload.t) : label
            }
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#fill-${dataKey})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MdBlocks({ blocks }) {
  return blocks.map((block, index) => {
    if (block.type === 'p') {
      return (
        <p
          key={index}
          className="md-p"
          dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
        />
      )
    }
    if (block.type === 'ul') {
      return (
        <ul key={index} className="md-ul">
          {block.items.map((item) => (
            <li
              key={item}
              dangerouslySetInnerHTML={{ __html: renderInline(item) }}
            />
          ))}
        </ul>
      )
    }
    if (block.type === 'table') {
      return (
        <div key={index} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {block.header.map((cell) => (
                  <th key={cell}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.slice(0, 8).map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cellIndex}-${cell.slice(0, 24)}`}
                      dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.rows.length > 8 && (
            <div className="md-more">+{block.rows.length - 8} more rows in source MD</div>
          )}
        </div>
      )
    }
    if (block.type === 'code') {
      return (
        <pre key={index} className="md-code">
          {block.text}
        </pre>
      )
    }
    return null
  })
}

export default function AnalysisDesk({ onClose }) {
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const telemetry = usePolarisStore((state) => state.telemetry[selectedStation])
  const series = usePolarisStore((state) => state.series[selectedStation] ?? [])
  const injectScenario = usePolarisStore((state) => state.injectScenario)
  const replayAug2018 = usePolarisStore((state) => state.replayAug2018)
  const setClock = usePolarisStore((state) => state.setClock)
  const liveNow = usePolarisStore((state) => state.liveNow)
  const hudTab = usePolarisStore((state) => state.hudTab)
  const setHudTab = usePolarisStore((state) => state.setHudTab)
  const plantMode = usePolarisStore((state) => state.plantMode)
  const setPlantMode = usePolarisStore((state) => state.setPlantMode)
  const voyageDelayDays = usePolarisStore((state) => state.voyageDelayDays)
  const setVoyageDelay = usePolarisStore((state) => state.setVoyageDelay)

  const [openSection, setOpenSection] = useState(null)
  const [doc, setDoc] = useState('knowledge')
  const [query, setQuery] = useState('')

  const severity = telemetry?.risk?.severity ?? 'NOMINAL'
  const replay = telemetry?.replay
  const facts = STATION_FACTS[selectedStation]
  const monthly = selectedStation === 'BHARATI' ? BHARATI_MONTHLY : MAITRI_MONTHLY
  const polar = POLAR_WINDOWS[selectedStation]
  const source = selectedStation === 'BHARATI' ? CLIMATE_SOURCE.bharati : CLIMATE_SOURCE.maitri

  const loadMix = [
    { id: 'ESS', value: telemetry?.microgrid?.essential_load_kva ?? 0, fill: '#64d8a0' },
    { id: 'SCI', value: telemetry?.microgrid?.science_load_kva ?? 0, fill: '#56b9d8' },
    { id: 'COM', value: telemetry?.microgrid?.comfort_load_kva ?? 0, fill: '#e8c48a' },
  ]

  const rawDocs = useMemo(
    () => ({
      knowledge: { label: 'KNOWLEDGE BASE', md: knowledgeMd },
      datasets: { label: 'DATASETS', md: datasetsMd },
      papers: { label: 'PAPERS', md: papersMd },
    }),
    [],
  )

  const dossier = useMemo(() => {
    const parsed = parseMarkdown(rawDocs[doc].md)
    const scoped = sectionsForStation(parsed, selectedStation)
    const needle = query.trim().toLowerCase()
    if (!needle) return scoped.slice(0, 18)
    return scoped.filter((section) => {
      const hay = `${section.title} ${JSON.stringify(section.blocks)}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [doc, query, rawDocs, selectedStation])

  const chartData = series.map((point, index) => ({
    ...point,
    i: index,
    label: formatSeriesClock(point.t),
  }))

  const temp = telemetry?.ambient?.temp_c
  const wind = telemetry?.ambient?.wind_speed_knots
  const fuel = telemetry?.fuel?.days_of_autonomy
  const load = telemetry?.microgrid?.total_load_kva
  const replayOn = Boolean(replay?.active)

  const prev = series.length > 8 ? series[series.length - 9] : series[0]
  const tempDelta = prev ? (temp ?? 0) - prev.temp : 0
  const windDelta = prev ? (wind ?? 0) - prev.wind : 0
  const fuelDelta = prev ? (fuel ?? 0) - prev.fuel : 0
  const utcClock = new Date().toISOString().slice(11, 19)
  const clockDate = opsDate(telemetry)
  const polarNow = polarState(selectedStation, clockDate)
  const access = windowStatus(selectedStation, clockDate)
  const fuelOps = fuelDecision(
    telemetry,
    selectedStation,
    clockDate,
    voyageDelayDays,
  )
  const occNow = telemetry?.occupancy ?? facts.winter
  const fuelTag = telemetry?.plant?.tag ?? (replayOn ? 'MODELED' : 'SYNTHETIC')
  const src = String(telemetry?.source || '').toUpperCase()
  const climateTag = replayOn
    ? 'IMD / HISTORICAL'
    : src.includes('OPEN_METEO')
      ? 'OPEN-METEO FORECAST'
      : src.includes('NASA')
        ? 'NASA POWER'
        : src && src !== 'SYNTHETIC'
          ? src
          : 'SYNTHETIC DRIFT'

  return (
    <section className="analysis-desk">
      <div className="panel-header">
        <span>STATION ANALYSIS</span>
        <div className="desk-header-actions">
          <div className={`station-status status-${severity.toLowerCase()}`}>
            <span className="status-dot live-pulse" />
            {replayOn ? 'REPLAY' : 'LIVE'} · {severity}
          </div>
          {onClose && (
            <button type="button" className="brief-close" onClick={onClose}>
              CLOSE
            </button>
          )}
        </div>
      </div>

      <div className="desk-tabs">
        {['live', 'climate', 'map', 'dossier'].map((id) => (
          <button
            key={id}
            type="button"
            className={hudTab === id ? 'desk-tab active' : 'desk-tab'}
            onClick={() => setHudTab(id)}
          >
            {id.toUpperCase()}
          </button>
        ))}
      </div>

      {hudTab === 'live' && (
        <div className="desk-body">
          <div className="metric-row">
            <button
              type="button"
              className="metric-card live-metric"
              onClick={() => setHudTab('climate')}
            >
              <span>AMBIENT · {climateTag}</span>
              <strong>
                <LiveValue value={temp} digits={1} suffix="°C" />
              </strong>
              <em className={tempDelta >= 0 ? 'delta up' : 'delta down'}>
                {tempDelta >= 0 ? '▲' : '▼'} {Math.abs(tempDelta).toFixed(1)}
              </em>
              <Spark data={chartData} dataKey="temp" color="#56b9d8" unit="°C" />
            </button>
            <button
              type="button"
              className="metric-card live-metric"
              onClick={() => setHudTab('climate')}
            >
              <span>WIND · {climateTag}</span>
              <strong>
                <LiveValue value={wind} digits={1} suffix=" kt" />
              </strong>
              <em className={windDelta >= 0 ? 'delta up' : 'delta down'}>
                {windDelta >= 0 ? '▲' : '▼'} {Math.abs(windDelta).toFixed(1)}
              </em>
              <Spark data={chartData} dataKey="wind" color="#e8c48a" unit="kt" />
            </button>
            <button type="button" className="metric-card live-metric">
              <span>FUEL · {fuelTag}</span>
              <strong>
                <LiveValue value={fuel} digits={1} suffix=" d" />
              </strong>
              <em className={fuelDelta >= 0 ? 'delta up' : 'delta down'}>
                {fuelDelta >= 0 ? '▲' : '▼'} {Math.abs(fuelDelta).toFixed(2)}
              </em>
              <Spark data={chartData} dataKey="fuel" color="#64d8a0" unit="d" />
            </button>
            <div className="metric-card live-metric">
              <span>OCCUPANCY · {plantMode === 'MAITRI_II' ? 'MAITRI-II' : 'AL/02·AL/03'}</span>
              <strong>{occNow}</strong>
              <em>
                W {facts.winter} · S {facts.summer}
                {plantMode === 'MAITRI_II' ? ' · II 40/140' : ''}
              </em>
            </div>
          </div>

          <div className="chart-frame">
            <div className="chart-legend">
              <span>{replayOn ? 'STORM TRACE' : `LIVE TRACE · ${utcClock} UTC`}</span>
              <b>TEMP °C · WIND kt</b>
            </div>
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(129,175,190,0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#66828e', fontSize: 9 }}
                    interval={7}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="temp"
                    tick={{ fill: '#56b9d8', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <YAxis
                    yAxisId="wind"
                    orientation="right"
                    tick={{ fill: '#e8c48a', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temp"
                    stroke="#56b9d8"
                    fill="rgba(86,185,216,0.18)"
                    strokeWidth={2}
                    name="Temp °C"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="wind"
                    type="monotone"
                    dataKey="wind"
                    stroke="#e8c48a"
                    strokeWidth={2}
                    dot={false}
                    name="Wind kt"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="load-row">
            <div className="load-copy">
              <span>MICROGRID MIX</span>
              <strong>
                <LiveValue value={load} digits={0} suffix=" kVA" />
              </strong>
            </div>
            <div className="load-bars">
              {loadMix.map((item) => (
                <div key={item.id} className="load-bar">
                  <i style={{ width: `${Math.max(8, (item.value / 500) * 100)}%`, background: item.fill }} />
                  <em>
                    {item.id} {item.value.toFixed(0)}
                  </em>
                </div>
              ))}
            </div>
          </div>

          <PlantToggle
            mode={plantMode}
            station={selectedStation}
            onChange={setPlantMode}
          />

          <FuelDecision
            decision={fuelOps}
            delayDays={voyageDelayDays}
            onDelay={setVoyageDelay}
            onResupply={() => injectScenario('RESUPPLY_DELAY').catch(() => {})}
          />

          <InstrumentRail
            station={selectedStation}
            telemetry={telemetry}
            polar={polarNow}
          />

          <button
            type="button"
            className="sitrep-export"
            onClick={() =>
              exportSitrep({
                station: selectedStation,
                telemetry,
                delayDays: voyageDelayDays,
                plantMode,
              })
            }
          >
            EXPORT SITREP PDF
          </button>

          {facts && (
            <div className="fact-strip">
              <div>
                <span>SITE</span>
                <b>{facts.site}</b>
              </div>
              <div>
                <span>PLANT</span>
                <b>{facts.plant}</b>
              </div>
            </div>
          )}

          <div className="source-note">
            {replay?.active
              ? `${replay.wind_tag ?? 'HISTORICAL'} · FUEL / INDOOR MODELED`
              : `PRESENT · ${telemetry?.source ?? 'synthetic'} · click a sparkline for climate`}
          </div>
        </div>
      )}

      {hudTab === 'climate' && (
        <div className="desk-body">
          <PolarCalendar
            station={selectedStation}
            date={clockDate}
            polar={polarNow}
            windows={access}
            onNight={() => injectScenario('POLAR_NIGHT').catch(() => {})}
            onLive={() => liveNow()}
          />

          <div className="fact-strip tight">
            <div>
              <span>POLAR DAY</span>
              <b>{polar.day}</b>
            </div>
            <div>
              <span>POLAR NIGHT</span>
              <b>{polar.night}</b>
            </div>
          </div>

          <div className="chart-frame">
            <div className="chart-legend">
              <span>RECONSTRUCTED YEAR</span>
              <b>TEMP · WIND</b>
            </div>
            <div className="chart-canvas tall">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(129,175,190,0.12)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#66828e', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7d96a0', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      name === 'temp' ? `${value} °C` : `${value} kn`,
                      name === 'temp' ? 'Temp' : 'Wind',
                    ]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.tag
                        ? `${label} · ${payload[0].payload.tag}`
                        : label
                    }
                  />
                  <Area type="monotone" dataKey="temp" stroke="#56b9d8" fill="rgba(86,185,216,0.16)" name="temp" />
                  <Line type="monotone" dataKey="wind" stroke="#e8c48a" dot={false} strokeWidth={2} name="wind" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedStation === 'BHARATI' && (
            <>
              <div className="chart-frame">
                <div className="chart-legend">
                  <span>IMD BLIZZARD LOG</span>
                  <b>9 EVENTS · CLICK TO REPLAY</b>
                </div>
                <div className="chart-canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={BHARATI_BLIZZARDS} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(129,175,190,0.1)" vertical={false} />
                      <XAxis dataKey="id" hide />
                      <YAxis tick={{ fill: '#7d96a0', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [
                          name === 'wind' ? `${value} kn` : `${value} h`,
                          name === 'wind' ? 'Max wind' : 'Duration',
                        ]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.start ?? ''}
                      />
                      <Bar
                        dataKey="wind"
                        cursor="pointer"
                        onClick={(data) => {
                          const event = data?.payload ?? data
                          if (event?.clock) setClock(event.clock)
                          injectScenario('BLIZZARD_80KT').catch(() => {})
                          setHudTab('live')
                        }}
                      >
                        {BHARATI_BLIZZARDS.map((event) => (
                          <Cell
                            key={event.id}
                            fill={event.wind >= 60 ? '#ff6b7c' : '#e8c48a'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <LockoutBacktest
                onReplay={(row) => {
                  if (row.id === '2018-08-05') replayAug2018()
                  else if (row.clock) setClock(row.clock)
                  injectScenario('BLIZZARD_80KT').catch(() => {})
                  setHudTab('live')
                }}
              />

              <button
                type="button"
                className="gust-banner"
                onClick={() => {
                  replayAug2018()
                  setHudTab('live')
                }}
              >
                <span>{GUST_80KT.date}</span>
                <strong>{GUST_80KT.label}</strong>
                <em>{GUST_80KT.note}</em>
              </button>
            </>
          )}

          <div className="climate-actions">
            <button type="button" onClick={() => injectScenario('POLAR_NIGHT')}>
              POLAR NIGHT
            </button>
            <button type="button" onClick={() => injectScenario('RESUPPLY_DELAY')}>
              RESUPPLY SLIP
            </button>
            <button type="button" onClick={() => liveNow()}>
              RESET LIVE
            </button>
          </div>

          <div className="source-note">{source}</div>
        </div>
      )}

      {hudTab === 'map' && (
        <div className="desk-body">
          <MapDesk
            station={selectedStation}
            date={clockDate}
            polar={polarNow}
            windows={access}
            telemetry={telemetry}
            delayDays={voyageDelayDays}
            onDelay={setVoyageDelay}
            decision={fuelOps}
            onNight={() => injectScenario('POLAR_NIGHT').catch(() => {})}
            onLive={() => liveNow()}
          />
        </div>
      )}

      {hudTab === 'dossier' && (
        <div className="desk-body">
          <div className="desk-tabs slim">
            {Object.entries(rawDocs).map(([id, item]) => (
              <button
                key={id}
                type="button"
                className={doc === id ? 'desk-tab active' : 'desk-tab'}
                onClick={() => {
                  setDoc(id)
                  setOpenSection(null)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            className="dossier-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${selectedStation.toLowerCase()} notes`}
          />
          <div className="dossier-list">
            {dossier.map((section) => {
              const open = openSection === section.title
              return (
                <article key={section.title} className={open ? 'dossier-card open' : 'dossier-card'}>
                  <button
                    type="button"
                    className="dossier-head"
                    onClick={() => setOpenSection(open ? null : section.title)}
                  >
                    <span>{section.title}</span>
                    <b>{open ? '–' : '+'}</b>
                  </button>
                  {open && (
                    <div className="dossier-body">
                      <MdBlocks blocks={section.blocks} />
                    </div>
                  )}
                </article>
              )
            })}
            {dossier.length === 0 && (
              <p className="md-p">No matching sections in the markdown files.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
