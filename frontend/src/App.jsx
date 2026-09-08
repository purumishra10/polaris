import { useState } from 'react'
import './App.css'
import StationScene from './3d/StationScene'
import CinematicBrief from './intelligence/CinematicBrief'
import VoiceDock from './voice/VoiceDock'
import CriticalOverlay from './ops/CriticalOverlay'
import AnalysisDesk from './analysis/AnalysisDesk'
import { assetFault } from './ops/assetHealth'

import { usePolarisStore } from './store/usePolarisStore'
import { formatReplayClock } from './lib/climateLook'
import { CAMERA_HOVER_ASSET } from './analysis/imdClimate'
import { REPLAY_PRESETS } from './lib/replayCatalog'
import {
  BHARATI_SUBSYSTEMS,
  bharatiCameraPresets,
} from './3d/stations/Bharati/bharatiAnchors'
import {
  MAITRI_SUBSYSTEMS,
  maitriCameraPresets,
} from './3d/stations/Maitri/maitriAnchors'

const CAMERA_PRESET_LABELS = {
  droneAerial: 'DRONE',
  groundVcolumns: 'V-COLUMNS',
  roofTerrace: 'ROOF',
  containerVillage: 'ISO YARD',
  radomeRidge: 'RADOME',
  meltPond: 'POND',
  undercroft: 'UNDERCROFT',
  spin360: '360°',
  hero: 'HERO',
  groundAccess: 'STAIRS',
  roofTechnical: 'ROOF',
  fuelFarm: 'FUEL',
}

function App() {
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )

  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )

  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  const connection = usePolarisStore((state) => state.connection)
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'
  const replay = telemetry?.replay
  const lockouts = telemetry?.lockouts
  const facts = replay?.facts ?? []

  const setSelectedStation = usePolarisStore(
    (state) => state.setSelectedStation,
  )

  const setSelectedSubsystem = usePolarisStore(
    (state) => state.setSelectedSubsystem,
  )

  const setCameraPreset = usePolarisStore(
    (state) => state.setCameraPreset,
  )

  const cameraPreset = usePolarisStore(
    (state) => state.cameraPreset,
  )

  const injectScenario = usePolarisStore(
    (state) => state.injectScenario,
  )

  const setClock = usePolarisStore((state) => state.setClock)
  const liveNow = usePolarisStore((state) => state.liveNow)
  const replayAug2018 = usePolarisStore((state) => state.replayAug2018)
  const showTelemetry = usePolarisStore((state) => state.showTelemetry)
  const setShowTelemetry = usePolarisStore((state) => state.setShowTelemetry)
  const setHoveredSubsystem = usePolarisStore(
    (state) => state.setHoveredSubsystem,
  )
  const setHudTab = usePolarisStore((state) => state.setHudTab)
  const voyageDelayDays = usePolarisStore((state) => state.voyageDelayDays)
  const setVoyageDelay = usePolarisStore((state) => state.setVoyageDelay)
  const plantMode = usePolarisStore((state) => state.plantMode)
  const setPlantMode = usePolarisStore((state) => state.setPlantMode)

  const [clockInput, setClockInput] = useState('2018-08-05T18:00')

  const subsystems =
    selectedStation === 'BHARATI'
      ? BHARATI_SUBSYSTEMS
      : MAITRI_SUBSYSTEMS

  const linkLabel = connection?.status ?? 'SIMULATION'
  const clockLabel = replay?.active
    ? formatReplayClock(replay.clock)
    : 'PRESENT'

  const goToClock = (iso) => {
    const value = iso.includes('T') ? iso : `${iso}T18:00:00+00:00`
    setClockInput(value.slice(0, 16))
    setClock(value)
    setHudTab('live')
  }

  return (
    <main
      className={[
        'polaris',
        selectedSubsystem ? 'brief-open' : '',
        replay?.active ? 'replay-active' : '',
        showTelemetry ? '' : 'desk-collapsed',
        `severity-${severity.toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <StationScene />
      <CriticalOverlay />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            P
          </div>

          <div>
            <div className="brand-name">
              POLARIS
            </div>

            <div className="brand-subtitle">
              ANTARCTIC DIGITAL TWIN
            </div>
          </div>
        </div>

        <div className="top-status">
          <span className={`status-dot status-${linkLabel.toLowerCase()}`} />
          {linkLabel} LINK
          {connection?.latency_ms ? `  ${connection.latency_ms} ms` : ''}
          {replay?.active && (
            <button type="button" className="live-inline" onClick={() => liveNow()}>
              LIVE NOW
            </button>
          )}
        </div>
      </header>

      <div className="hud-left">
        <aside className="station-panel">
          <div className="eyebrow">
            STATION
          </div>

          <div className="station-selector">
            <button
              className={
                selectedStation === 'BHARATI'
                  ? 'station-button active'
                  : 'station-button'
              }
              onClick={() => setSelectedStation('BHARATI')}
            >
              BHARATI
            </button>

            <button
              className={
                selectedStation === 'MAITRI'
                  ? 'station-button active'
                  : 'station-button'
              }
              onClick={() => setSelectedStation('MAITRI')}
            >
              MAITRI
            </button>
          </div>

          <div className="station-info">
            <div>
              <span>MODE</span>
              <strong>{replay?.active ? 'HISTORICAL' : 'PRESENT'}</strong>
            </div>

            <div>
              <span>LINK</span>
              <strong>{linkLabel}</strong>
            </div>

            <div>
              <span>DATA</span>
              <strong>{replay?.source_type ?? telemetry?.source ?? 'LIVE'}</strong>
            </div>
          </div>

          {lockouts && (
            <div className="lockout-row">
              <span className={lockouts.outdoor === 'LOCKED' ? 'lock-chip locked' : 'lock-chip'}>
                OUTDOOR {lockouts.outdoor}
              </span>
              <span className={lockouts.heli === 'LOCKED' ? 'lock-chip locked' : 'lock-chip'}>
                HELI {lockouts.heli}
              </span>
            </div>
          )}

          <div className="eyebrow asset-eyebrow">
            ASSETS
          </div>

          <div className="asset-list">
            {subsystems.map((id) => {
              const fault = assetFault(id, telemetry)
              return (
              <button
                key={id}
                type="button"
                className={[
                  'asset-button',
                  selectedSubsystem === id ? 'active' : '',
                  fault ? `fault-${fault.tone}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={fault ? `${fault.title} — ${fault.reason}` : id}
                onMouseEnter={() => setHoveredSubsystem(id)}
                onMouseLeave={() => setHoveredSubsystem(null)}
                onClick={() =>
                  setSelectedSubsystem(
                    selectedSubsystem === id ? null : id,
                  )
                }
              >
                {id}
                {fault ? ` · ${fault.title}` : ''}
              </button>
            )
            })}
          </div>
        </aside>

        <section className="scenario-panel">
          <div className="scenario-title">
            CLOCK
          </div>

          <div className="clock-row">
            <input
              type="datetime-local"
              className="clock-input"
              value={clockInput}
              onChange={(event) => setClockInput(event.target.value)}
              title="Entered as UTC"
            />
            <button
              type="button"
              className="clock-go"
              onClick={() => goToClock(`${clockInput}:00+00:00`)}
            >
              GO
            </button>
          </div>

          <button
            type="button"
            className={`live-button ${replay?.active ? '' : 'active'}`}
            onClick={() => liveNow()}
          >
            LIVE NOW / PRESENT
          </button>

          <div className="clock-presets">
            {REPLAY_PRESETS.map((preset) => (
              <button
                key={preset.clock}
                type="button"
                title={preset.hint}
                className={
                  replay?.clock?.startsWith(String(preset.clock).slice(0, 10))
                    ? 'clock-chip active'
                    : 'clock-chip'
                }
                onClick={() => goToClock(preset.clock)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`replay-button ${replay?.active ? 'active' : ''}`}
            onClick={() => replayAug2018()}
          >
            REPLAY 5 AUG 2018 · 80 kn GUST
          </button>

          <div className="scenario-title scenario-sub">
            SCENARIO INJECTION
          </div>

          <div className="scenario-buttons">
            <button
              onClick={() => injectScenario('NOMINAL')}
            >
              NOMINAL
            </button>

            <button
              onClick={() => injectScenario('BLIZZARD_80KT')}
            >
              BLIZZARD 80KT
            </button>

            <button
              onClick={() => injectScenario('RESUPPLY_DELAY')}
            >
              RESUPPLY DELAY
            </button>

            <button
              onClick={() => injectScenario('POLAR_NIGHT')}
            >
              POLAR NIGHT
            </button>
          </div>

          <div className="scenario-title scenario-sub">
            EXPEDITION
          </div>
          <div className="scenario-buttons">
            <button
              type="button"
              className={voyageDelayDays === 14 ? 'active' : ''}
              onClick={() => {
                setVoyageDelay(voyageDelayDays === 14 ? 0 : 14)
                setShowTelemetry(true)
                setHudTab('map')
              }}
            >
              SHIP +14 D
            </button>
            <button
              type="button"
              className={plantMode === 'MAITRI_II' ? 'active' : ''}
              onClick={() => {
                const next = plantMode === 'MAITRI_II' ? 'CURRENT' : 'MAITRI_II'
                setPlantMode(next)
                if (next === 'MAITRI_II') setSelectedStation('MAITRI')
                setShowTelemetry(true)
                setHudTab('live')
              }}
            >
              MAITRI-II
            </button>
          </div>
        </section>
      </div>

      {replay?.active && (
        <section className="replay-strip">
          <div className="replay-strip-head">
            <span>HISTORICAL CLOCK</span>
            <strong>{formatReplayClock(replay.clock)} · {replay.wind_tag ?? 'IMD GUST'}</strong>
          </div>
          {facts.length > 0 && (
            <div className="replay-strip-facts">
              {facts.map((fact) => (
                <div key={fact.label} className="replay-chip">
                  <span>{fact.label}</span>
                  <b>{fact.value}</b>
                </div>
              ))}
            </div>
          )}
          {replay.citation && (
            <div className="replay-strip-cite">{replay.citation}</div>
          )}
        </section>
      )}

      <div className={`hud-right ${selectedSubsystem ? 'voice-only' : ''}`}>
        {!selectedSubsystem && (
          <>
            {showTelemetry ? (
              <AnalysisDesk />
            ) : (
              <button
                type="button"
                className="desk-reopen"
                onClick={() => setShowTelemetry(true)}
              >
                SHOW ANALYSIS
              </button>
            )}
            {showTelemetry && (
              <button
                type="button"
                className="desk-collapse"
                onClick={() => setShowTelemetry(false)}
              >
                HIDE ANALYSIS
              </button>
            )}
          </>
        )}
        <VoiceDock />
      </div>

      <CinematicBrief />

      {(selectedStation === 'BHARATI' || selectedStation === 'MAITRI') && (
        <>
          <div className="orbit-hint">
            DRAG TO ORBIT · RIGHT-DRAG PAN · SCROLL ZOOM · HOVER AN ASSET
          </div>

          <div className="camera-presets">
            {Object.keys(
              selectedStation === 'BHARATI'
                ? bharatiCameraPresets
                : maitriCameraPresets,
            ).map((id) => (
              <button
                key={id}
                type="button"
                className={
                  cameraPreset === id && !selectedSubsystem
                    ? 'camera-chip active'
                    : 'camera-chip'
                }
                onMouseEnter={() =>
                  setHoveredSubsystem(CAMERA_HOVER_ASSET[id] ?? null)
                }
                onMouseLeave={() => setHoveredSubsystem(null)}
                onClick={() => setCameraPreset(id)}
              >
                {CAMERA_PRESET_LABELS[id] ?? id}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="bottom-bar">
        <span>POLARIS / MISSION CONTROL</span>

        <span>
          CLOCK <b>{clockLabel}</b>
        </span>

        <span>
          STATION <b>{selectedStation}</b>
        </span>
      </div>
    </main>
  )
}

export default App
