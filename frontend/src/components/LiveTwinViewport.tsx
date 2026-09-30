import { useEffect, useState } from 'react'
import { Flame, Layers, Maximize2, Minimize2 } from 'lucide-react'
import StationScene from '../3d/StationScene'
import {
  CinematicOverlays,
  CinematicPanel,
} from '../intelligence/CinematicBrief'
import AnalysisDesk from '../analysis/AnalysisDesk'
import FullscreenOpsPanel, { FullscreenKpiStrip } from './FullscreenOpsPanel'
import { usePolarisStore } from '../store/usePolarisStore'
import {
  BHARATI_SUBSYSTEMS,
  bharatiCameraPresets,
} from '../3d/stations/Bharati/bharatiAnchors'
import {
  MAITRI_SUBSYSTEMS,
  maitriCameraPresets,
} from '../3d/stations/Maitri/maitriAnchors'

const EMBEDDED_CHIPS = [
  { id: 'MICROGRID', label: 'CHP Microgrid Block' },
  { id: 'FUEL', label: 'JET A1 Fuel Farm' },
  { id: 'COMMUNICATIONS', label: 'MARA Science Radome' },
  { id: 'STRUCTURE', label: 'Elevated Habitation Pods' },
] as const

const SUBSYSTEM_LABELS: Record<string, string> = {
  STRUCTURE: 'Habitation Pods',
  ROOF: 'Terrace / HVAC',
  FUEL: 'JET A1 Fuel Farm',
  MICROGRID: 'CHP Microgrid',
  THERMAL: 'Thermal Plant',
  COMMUNICATIONS: 'MARA Radome',
  SAFETY: 'Helipad / Lockout',
  CONTAINERS: 'ISO Village',
  UTILITIES: 'Utilities',
  VEHICLES: 'Ops Fleet',
  WATER: 'Melt Pond',
}

const PRESET_LABELS: Record<string, string> = {
  droneAerial: 'DRONE AERIAL',
  groundVcolumns: 'V-COLUMNS',
  roofTerrace: 'ROOF TERRACE',
  containerVillage: 'ISO VILLAGE',
  radomeRidge: 'RADOME RIDGE',
  meltPond: 'MELT POND',
  undercroft: 'UNDERCROFT',
  spin360: 'SPIN 360',
  hero: 'HERO',
  groundAccess: 'GROUND ACCESS',
  roofTechnical: 'ROOF TECHNICAL',
  fuelFarm: 'FUEL FARM',
}

const STATION_META = {
  BHARATI: { lat: "69°24'S", lon: "76°11'E", site: 'Larsemann Hills' },
  MAITRI: { lat: "70°46'S", lon: "11°44'E", site: 'Schirmacher Oasis' },
} as const

interface LiveTwinViewportProps {
  compact?: boolean
}

export default function LiveTwinViewport({ compact = false }: LiveTwinViewportProps) {
  const selectedStation = usePolarisStore((s) => s.selectedStation)
  const setSelectedStation = usePolarisStore((s) => s.setSelectedStation)
  const selectedSubsystem = usePolarisStore((s) => s.selectedSubsystem)
  const setSelectedSubsystem = usePolarisStore((s) => s.setSelectedSubsystem)
  const isThermalView = usePolarisStore((s) => s.isThermalView)
  const toggleThermalView = usePolarisStore((s) => s.toggleThermalView)
  const cameraPreset = usePolarisStore((s) => s.cameraPreset)
  const setCameraPreset = usePolarisStore((s) => s.setCameraPreset)
  const severity = usePolarisStore(
    (s) => s.telemetry[s.selectedStation]?.risk?.severity ?? 'NOMINAL',
  )
  const latencyMs = usePolarisStore(
    (s) => s.telemetry[s.selectedStation]?.link_status?.latency_ms,
  )
  const scenarioId = usePolarisStore(
    (s) => s.telemetry[s.selectedStation]?.scenario_id,
  )

  const [fullscreen, setFullscreen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const assets = selectedStation === 'BHARATI' ? BHARATI_SUBSYSTEMS : MAITRI_SUBSYSTEMS
  const presets =
    selectedStation === 'BHARATI' ? bharatiCameraPresets : maitriCameraPresets
  const meta = STATION_META[selectedStation]
  const showLeftRail = Boolean(selectedSubsystem) || analysisOpen
  const analysisVisible = analysisOpen && !selectedSubsystem

  const toggleAnalysis = () => {
    if (analysisOpen && !selectedSubsystem) {
      setAnalysisOpen(false)
      return
    }
    setAnalysisOpen(true)
    if (selectedSubsystem) setSelectedSubsystem(null)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedSubsystem) {
        setSelectedSubsystem(null)
        event.preventDefault()
        return
      }
      if (analysisOpen) {
        setAnalysisOpen(false)
        event.preventDefault()
        return
      }
      if (fullscreen) {
        setFullscreen(false)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSubsystem, analysisOpen, fullscreen, setSelectedSubsystem])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = fullscreen ? 'hidden' : previous
    return () => {
      document.body.style.overflow = previous
    }
  }, [fullscreen])

  const stageHeight = compact
    ? 'h-[280px] sm:h-[320px]'
    : 'h-[420px] sm:h-[500px] lg:h-[580px]'

  const analysisButton = (
    <button
      type="button"
      className={`station-analysis-btn ${analysisVisible ? 'active' : ''}`}
      onClick={toggleAnalysis}
    >
      STATION ANALYSIS
    </button>
  )

  return (
    <div
      className={`relative w-full overflow-hidden ${
        fullscreen
          ? `twin-live-fullscreen polaris ${selectedSubsystem ? 'brief-open' : ''} ${showLeftRail ? 'rail-open' : ''}`
          : `rounded-2xl border border-base-700 bg-base-900 shadow-2xl ${showLeftRail ? 'rail-open' : ''}`
      }`}
    >
      {fullscreen && (
        <div className="topbar">
          <div className="topbar-left">
            <div className="brand">
              <div className="brand-mark">P</div>
              <div>
                <div className="brand-name">POLARIS</div>
                <div className="brand-subtitle">NCPOR DIGITAL TWIN · LIVE RENDER</div>
              </div>
            </div>
            {analysisButton}
          </div>
          <FullscreenKpiStrip />
          <div className="topbar-right">
            <div className={`top-status status-${severity.toLowerCase()}`}>
              <span className="status-dot" />
              {severity} · {selectedStation}
            </div>
            <button
              type="button"
              className="twin-exit-fullscreen twin-live-chrome"
              onClick={() => setFullscreen(false)}
              title="Exit full screen"
            >
              <Minimize2 size={14} />
              EXIT FULL SCREEN
            </button>
          </div>
        </div>
      )}

      <div
        className={`twin-stage-row ${
          fullscreen ? 'flex-1 min-h-0' : stageHeight
        }`}
      >
        {showLeftRail && (
          <aside className={`twin-left-rail ${selectedSubsystem ? 'inspector-wide' : ''}`}>
            {selectedSubsystem ? (
              <CinematicPanel />
            ) : (
              <AnalysisDesk onClose={() => setAnalysisOpen(false)} />
            )}
          </aside>
        )}

        <div className="twin-stage">
          {!fullscreen && (
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 twin-live-chrome">
              {analysisButton}
              <div className="flex rounded-lg border border-base-700 bg-base-950/80 backdrop-blur p-0.5 text-xs font-mono">
                <button
                  onClick={() => setSelectedStation('BHARATI')}
                  className={`px-3 py-1 rounded font-semibold transition-all ${
                    selectedStation === 'BHARATI'
                      ? 'bg-ice-600 text-white shadow-glow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  BHARATI 3D
                </button>
                <button
                  onClick={() => setSelectedStation('MAITRI')}
                  className={`px-3 py-1 rounded font-medium transition-all ${
                    selectedStation === 'MAITRI'
                      ? 'bg-ice-600 text-white shadow-glow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MAITRI 3D
                </button>
              </div>
              {selectedSubsystem && (
                <div className="px-3 py-1 rounded-lg bg-ice-600/30 backdrop-blur border border-ice-400 text-xs font-mono text-ice-200 flex items-center gap-1.5">
                  <span>
                    INSPECTOR: <strong>{selectedSubsystem}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedSubsystem(null)}
                    className="text-slate-400 hover:text-white ml-1 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {!fullscreen && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 twin-live-chrome">
              <button
                onClick={toggleThermalView}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all backdrop-blur ${
                  isThermalView
                    ? 'bg-red-500/40 border border-red-500 text-red-200 shadow-glow-red'
                    : 'bg-base-950/80 border border-base-700 text-slate-300 hover:border-ice-400'
                }`}
              >
                <Flame size={14} className={isThermalView ? 'text-red-400' : 'text-ice-400'} />
                <span>{isThermalView ? 'THERMAL INFRARED: ON' : 'THERMAL VIEW'}</span>
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all backdrop-blur bg-base-950/80 border border-ice-500/50 text-ice-200 hover:border-ice-300 hover:text-white"
                title="Open live render full screen"
              >
                <Maximize2 size={14} />
                <span>FULL SCREEN</span>
              </button>
            </div>
          )}

          <StationScene />
          <CinematicOverlays />

          {fullscreen && (
            <>
              <aside className="station-panel twin-live-chrome">
                <div className="eyebrow">STATION</div>
                <div className="station-selector">
                  <button
                    className={`station-button ${selectedStation === 'BHARATI' ? 'active' : ''}`}
                    onClick={() => setSelectedStation('BHARATI')}
                  >
                    BHARATI
                  </button>
                  <button
                    className={`station-button ${selectedStation === 'MAITRI' ? 'active' : ''}`}
                    onClick={() => setSelectedStation('MAITRI')}
                  >
                    MAITRI
                  </button>
                </div>
                <div className="station-info">
                  <div>
                    <span>LAT</span>
                    <strong>{meta.lat}</strong>
                  </div>
                  <div>
                    <span>LON</span>
                    <strong>{meta.lon}</strong>
                  </div>
                  <div>
                    <span>SITE</span>
                    <strong>{meta.site}</strong>
                  </div>
                </div>
                <div className="eyebrow asset-eyebrow">INTERACTIVE ASSETS</div>
                <div className="asset-list">
                  {assets.map((id) => (
                    <button
                      key={id}
                      className={`asset-button ${selectedSubsystem === id ? 'active' : ''}`}
                      onClick={() =>
                        setSelectedSubsystem(selectedSubsystem === id ? null : id)
                      }
                    >
                      {SUBSYSTEM_LABELS[id] ?? id}
                    </button>
                  ))}
                </div>
              </aside>

              {!selectedSubsystem && (
                <aside className="telemetry-panel fs-ops-panel twin-live-chrome">
                  <FullscreenOpsPanel />
                </aside>
              )}

              <button
                type="button"
                className={`telemetry-toggle twin-live-chrome ${isThermalView ? 'active' : ''}`}
                onClick={toggleThermalView}
              >
                {isThermalView ? 'THERMAL IR: ON' : 'THERMAL VIEW'}
              </button>

              <div className="camera-presets twin-live-chrome">
                {Object.keys(presets).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`camera-chip ${cameraPreset === preset && !selectedSubsystem ? 'active' : ''}`}
                    onClick={() => setCameraPreset(preset)}
                  >
                    {PRESET_LABELS[preset] ?? preset}
                  </button>
                ))}
              </div>

              {!selectedSubsystem && (
                <div className="orbit-hint">
                  DRAG TO ORBIT STATION · SCROLL TO ZOOM · RMB PANS · CLICK A COMPONENT TO FOCUS
                </div>
              )}

              <div className="bottom-bar">
                <span>
                  POLARIS LIVE · <b>{selectedStation}</b> · ESC EXITS FULL SCREEN
                </span>
                <span>
                  {scenarioId && scenarioId !== 'NOMINAL' ? (
                    <b className="text-amber-300">SCENARIO {String(scenarioId).replace(/_/g, ' ')} · </b>
                  ) : null}
                  C-BAND / LEO · {latencyMs ?? '—'} ms
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="twin-pin-bar px-4 py-2 border-t border-base-800 bg-base-950/70 backdrop-blur flex flex-wrap items-center justify-between gap-3 text-xs font-mono twin-live-chrome">
        <div className="flex items-center gap-2 text-slate-400">
          <Layers size={14} className="text-ice-400" />
          <span>INTERACTIVE 3D SUBSYSTEM PINS:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(fullscreen ? assets : EMBEDDED_CHIPS).map((item) => {
            const id = typeof item === 'string' ? item : item.id
            const label = typeof item === 'string' ? SUBSYSTEM_LABELS[item] ?? item : item.label
            return (
              <button
                key={id}
                onClick={() => setSelectedSubsystem(selectedSubsystem === id ? null : id)}
                className={`px-3 py-1 rounded-md border transition-all ${
                  selectedSubsystem === id
                    ? 'bg-ice-600 text-white border-ice-400 font-semibold shadow-glow'
                    : 'bg-base-900 border-base-700 text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
