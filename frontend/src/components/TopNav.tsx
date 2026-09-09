import { useState, useEffect } from 'react'
import { Radio, Gauge, Activity, Snowflake, Flame, Satellite } from 'lucide-react'
import { usePolarisStore } from '../store/usePolarisStore'

interface TopNavProps {
  currentTab: 'home' | 'mission-control' | 'analytics'
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
  right?: React.ReactNode
}

export default function TopNav({ currentTab, onNavigate, right }: TopNavProps) {
  const {
    selectedStation,
    setSelectedStation,
    telemetry,
    connection,
    isThermalView,
    toggleThermalView,
  } = usePolarisStore()

  const [utcTime, setUtcTime] = useState(new Date().toUTCString().slice(17, 25))

  useEffect(() => {
    const id = setInterval(() => {
      setUtcTime(new Date().toUTCString().slice(17, 25))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const currentTelemetry = telemetry[selectedStation]
  const latency = connection?.latency_ms || currentTelemetry?.link_status?.latency_ms || 460
  const isWsConnected = connection?.status === 'CONNECTED_WS'

  return (
    <header className="sticky top-0 z-40 border-b border-base-700 bg-base-950/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Left: Branding & Station Switcher */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
          title="Return to Polaris Homepage"
        >
          <div className="h-8 w-8 rounded-lg bg-ice-600/20 border border-ice-500/50 flex items-center justify-center text-ice-400 group-hover:border-ice-400 group-hover:shadow-glow transition-all">
            <Snowflake size={18} className="animate-spin-slow text-ice-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-widest text-white">POLARIS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-ice-600/30 text-ice-300 font-mono font-semibold border border-ice-500/30">
                SIH PS-26060
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight">NCPOR GOA · DIGITAL TWIN</p>
          </div>
        </button>

        {/* Station Switcher */}
        <div className="hidden sm:flex items-center rounded-lg border border-base-700 bg-base-900 p-0.5 text-xs">
          <button
            id="nav-station-bharati"
            onClick={() => setSelectedStation('BHARATI')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              selectedStation === 'BHARATI'
                ? 'bg-ice-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            BHARATI
          </button>
          <button
            id="nav-station-maitri"
            onClick={() => setSelectedStation('MAITRI')}
            title="Maitri link currently unoperational (defaulting to Bharati per brief)"
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              selectedStation === 'MAITRI'
                ? 'bg-ice-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>MAITRI</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              STANDBY
            </span>
          </button>
        </div>
      </div>

      {/* Middle: Tab Navigation Buttons */}
      <nav className="flex items-center rounded-xl border border-base-700 bg-base-900/80 p-1 text-xs">
        <button
          id="tab-btn-home"
          onClick={() => onNavigate('home')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            currentTab === 'home'
              ? 'bg-gradient-to-r from-ice-700 to-ice-600 text-white font-semibold shadow-glow'
              : 'text-slate-400 hover:text-white hover:bg-base-800'
          }`}
        >
          <Snowflake size={14} className={currentTab === 'home' ? 'text-ice-300' : ''} />
          <span>Overview</span>
        </button>

        <button
          id="tab-btn-analytics"
          onClick={() => onNavigate('analytics')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            currentTab === 'analytics'
              ? 'bg-gradient-to-r from-ice-700 to-ice-600 text-white font-semibold shadow-glow'
              : 'text-slate-400 hover:text-white hover:bg-base-800'
          }`}
        >
          <Gauge size={14} className={currentTab === 'analytics' ? 'text-ice-300' : ''} />
          <span>Telemetry Analytics</span>
        </button>

        <button
          id="tab-btn-mission-control"
          onClick={() => onNavigate('mission-control')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            currentTab === 'mission-control'
              ? 'bg-gradient-to-r from-ice-700 to-ice-600 text-white font-semibold shadow-glow'
              : 'text-slate-400 hover:text-white hover:bg-base-800'
          }`}
        >
          <Activity size={14} className={currentTab === 'mission-control' ? 'text-ice-300' : ''} />
          <span>Mission Control</span>
        </button>
      </nav>

      {/* Right: Telemetry Link Badge, Thermal Shader Toggle & Clock */}
      <div className="flex items-center gap-2.5">
        {/* Thermal Infrared View Toggle */}
        <button
          onClick={toggleThermalView}
          className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all ${
            isThermalView
              ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-glow-red animate-pulse'
              : 'bg-base-900 border-base-700 text-slate-400 hover:border-ice-500/50 hover:text-ice-300'
          }`}
          title="Toggle 3D Thermal Infrared Heat View"
        >
          <Flame size={13} className={isThermalView ? 'text-red-400' : 'text-ice-400'} />
          <span className="hidden md:inline">{isThermalView ? 'THERMAL IR: ON' : 'THERMAL IR'}</span>
        </button>

        {/* Satellite Link Badge */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-base-700 bg-base-900 text-xs font-mono"
          title={`Satellite Link: ${isWsConnected ? 'Active WebSocket' : 'Fallback HTTP Polling'}`}
        >
          <Satellite size={13} className={isWsConnected ? 'text-ice-400' : 'text-amber-400'} />
          <span className="text-slate-300 hidden sm:inline">C-band</span>
          <span className="text-ice-400 font-bold">{latency}ms</span>
          <span
            className={`h-2 w-2 rounded-full ${
              isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        </div>

        {/* UTC Clock */}
        <div className="hidden lg:block text-right font-mono text-[11px] text-slate-400 border-l border-base-800 pl-3">
          <p className="text-white font-semibold leading-tight">{utcTime} UTC</p>
          <p className="text-[9px] text-slate-500">POLAR NET</p>
        </div>

        {right}
      </div>
    </header>
  )
}
