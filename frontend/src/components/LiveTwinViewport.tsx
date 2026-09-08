import { useEffect, useState } from 'react'
import { Flame, Layers, Maximize2, Minimize2 } from 'lucide-react'
import StationScene from '../3d/StationScene'
import {
  CinematicOverlays,
  CinematicPanel,
} from '../intelligence/CinematicBrief'
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
  const {
    selectedStation,
    setSelectedStation,
    selectedSubsystem,
    setSelectedSubsystem,
    isThermalView,
    toggleThermalView,
    telemetry,
    cameraPreset,
    setCameraPreset,
  } = usePolarisStore()

  const [fullscreen, setFullscreen] = useState(false)
  const t = telemetry[selectedStation]
  const severity = t?.risk?.severity ?? 'NOMINAL'
  const assets = selectedStation === 'BHARATI' ? BHARATI_SUBSYSTEMS : MAITRI_SUBSYSTEMS
  const presets =
    selectedStation === 'BHARATI' ? bharatiCameraPresets : maitriCameraPresets
  const meta = STATION_META[selectedStation]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedSubsystem) {
        setSelectedSubsystem(null)
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
  }, [selectedSubsystem, fullscreen, setSelectedSubsystem])

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

  return (
    <div
      className={`relative w-full overflow-hidden ${
        fullscreen
          ? `twin-live-fullscreen polaris ${selectedSubsystem ? 'brief-open' : ''}`
          : 'rounded-2xl border border-base-700 bg-base-900 shadow-2xl'
      }`}
    >
      {!fullscreen && (
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 twin-live-chrome">
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

      <div className={`flex w-full items-stretch ${fullscreen ? 'flex-1 min-h-0' : 'flex-col lg:flex-row'}`}>
        <div className={`relative min-w-0 flex-1 ${fullscreen ? 'h-full' : stageHeight}`}>
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
              <div className="topbar">
                <div className="brand">
                  <div className="brand-mark">P</div>
                  <div>
                    <div className="brand-name">POLARIS</div>
                    <div className="brand-subtitle">NCPOR DIGITAL TWIN · LIVE RENDER</div>
                  </div>
                </div>
                <div className={`top-status status-${severity.toLowerCase()}`}>
                  <span className="status-dot" />
                  {severity} · {selectedStation}
                </div>
              </div>

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
                <aside className="telemetry-panel twin-live-chrome">
                  <div className="panel-header">
                    <span>LIVE TELEMETRY</span>
                    <span className="live-badge">LIVE</span>
                  </div>
                  <div className="telemetry-grid">
                    <div className="metric">
                      <span>WIND</span>
                      <strong>{t?.ambient?.wind_speed_knots?.toFixed(1) ?? '—'} kt</strong>
                    </div>
                    <div className="metric">
                      <span>HABITAT</span>
                      <strong>{t?.thermal?.internal_temp_c?.toFixed(1) ?? '—'}°C</strong>
                    </div>
                    <div className="metric">
                      <span>LOAD</span>
                      <strong>{t?.microgrid?.total_load_kva?.toFixed(0) ?? '—'} kVA</strong>
                    </div>
                    <div className="metric">
                      <span>AUTONOMY</span>
                      <strong>{t?.fuel?.days_of_autonomy?.toFixed(0) ?? '—'} d</strong>
                    </div>
                  </div>
                  <p className="source-note">source: synthetic · confidence: modeled</p>
                </aside>
              )}

              {selectedSubsystem && <CinematicPanel className="overlay" />}

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
                <div className="orbit-hint">DRAG TO ORBIT STATION · SCROLL TO ZOOM · RMB PANS · CLICK A COMPONENT TO FOCUS</div>
              )}

              <div className="bottom-bar">
                <span>
                  POLARIS LIVE · <b>{selectedStation}</b> · ESC EXITS FULL SCREEN
                </span>
                <span>C-BAND / LEO · {t?.link_status?.latency_ms ?? 480} ms</span>
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
            </>
          )}
        </div>

        {!fullscreen && selectedSubsystem && (
          <div className="cinematic-brief-rail">
            <CinematicPanel />
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-base-800 bg-base-950/70 backdrop-blur flex flex-wrap items-center justify-between gap-3 text-xs font-mono twin-live-chrome">
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
