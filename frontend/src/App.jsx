import { useState } from 'react'

import StationScene from './3d/StationScene'
import CinematicBrief from './intelligence/CinematicBrief'

import { usePolarisStore } from './store/usePolarisStore'
import {
  BHARATI_SUBSYSTEMS,
  bharatiCameraPresets,
} from './3d/stations/Bharati/bharatiAnchors'

import './App.css'

const MAITRI_SUBSYSTEMS = [
  'STRUCTURE',
  'FUEL',
  'MICROGRID',
  'COMMUNICATIONS',
  'SAFETY',
]

const CAMERA_PRESET_LABELS = {
  droneAerial: 'DRONE',
  groundVcolumns: 'V-COLUMNS',
  roofTerrace: 'ROOF',
  containerVillage: 'ISO YARD',
  radomeRidge: 'RADOME',
  meltPond: 'POND',
  undercroft: 'UNDERCROFT',
  spin360: '360°',
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

  const severity = telemetry?.risk?.severity ?? 'NOMINAL'

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

  const [showTelemetry, setShowTelemetry] = useState(true)

  const subsystems =
    selectedStation === 'BHARATI'
      ? BHARATI_SUBSYSTEMS
      : MAITRI_SUBSYSTEMS

  return (
    <main className={selectedSubsystem ? 'polaris brief-open' : 'polaris'}>
      <StationScene />

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
          <span className="status-dot" />
          SIMULATION LINK
        </div>
      </header>

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
            <strong>REMOTE TWIN</strong>
          </div>

          <div>
            <span>LINK</span>
            <strong>SIMULATED</strong>
          </div>

          <div>
            <span>DATA</span>
            <strong>STAGE</strong>
          </div>
        </div>

        <div className="eyebrow asset-eyebrow">
          ASSETS
        </div>

        <div className="asset-list">
          {subsystems.map((id) => (
            <button
              key={id}
              type="button"
              className={
                selectedSubsystem === id
                  ? 'asset-button active'
                  : 'asset-button'
              }
              onClick={() =>
                setSelectedSubsystem(
                  selectedSubsystem === id ? null : id,
                )
              }
            >
              {id}
            </button>
          ))}
        </div>
      </aside>

      {showTelemetry && !selectedSubsystem && (
        <section className="telemetry-panel">
          <div className="panel-header">
            <span>STATION STATE</span>

            <div
              className={`station-status status-${severity.toLowerCase()}`}
            >
              <span className="status-dot" />
              {severity}
            </div>
          </div>

          <div className="telemetry-grid">
            <div className="metric">
              <span>AMBIENT</span>
              <strong>
                {telemetry?.ambient?.temp_c?.toFixed(1)}°C
              </strong>
            </div>

            <div className="metric">
              <span>WIND</span>
              <strong>
                {telemetry?.ambient?.wind_speed_knots?.toFixed(0)} kt
              </strong>
            </div>

            <div className="metric">
              <span>FUEL</span>
              <strong>
                {telemetry?.fuel?.days_of_autonomy?.toFixed(0)} DAYS
              </strong>
            </div>

            <div className="metric">
              <span>MICROGRID</span>
              <strong>
                {severity}
              </strong>
            </div>
          </div>

          <div className="source-note">
            SYNTHETIC / MODELED
          </div>
        </section>
      )}

      <CinematicBrief />

      {!selectedSubsystem && (
        <button
          className="telemetry-toggle"
          onClick={() => setShowTelemetry((value) => !value)}
        >
          {showTelemetry ? 'HIDE DATA' : 'SHOW DATA'}
        </button>
      )}

      <section className="scenario-panel">
        <div className="scenario-title">
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
      </section>

      {selectedStation === 'BHARATI' && (
        <>
          <div className="orbit-hint">
            DRAG TO ORBIT 360° · RIGHT-DRAG PAN · SCROLL ZOOM · ARROWS · CLICK A PLACE
          </div>
          <div className="camera-presets">
            {Object.keys(bharatiCameraPresets).map((id) => (
              <button
                key={id}
                type="button"
                className={
                  cameraPreset === id && !selectedSubsystem
                    ? 'camera-chip active'
                    : 'camera-chip'
                }
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
          CLOCK <b>SIMULATION</b>
        </span>

        <span>
          STATION <b>{selectedStation}</b>
        </span>
      </div>
    </main>
  )
}

export default App