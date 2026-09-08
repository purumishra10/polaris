import { useState } from 'react'
import {
  Radio,
  Wind,
  Snowflake,
  Fuel,
  ShieldAlert,
  CheckCircle2,
  Zap,
  Activity,
  AlertTriangle,
  Flame,
  Check,
  RotateCcw,
  Layers,
  Send,
  Sliders,
  Cpu,
  FileText,
  BookOpen,
} from 'lucide-react'
import TopNav from '../components/TopNav'
import SeverityBadge from '../components/SeverityBadge'
import { usePolarisStore } from '../store/usePolarisStore'
import StationScene from '../3d/StationScene'
import CinematicBrief from '../intelligence/CinematicBrief'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

const SCENARIOS = [
  {
    key: 'BLIZZARD_80KT',
    label: 'Trigger 80-Knot Blizzard',
    desc: 'Ramps wind to 84+ kts, drops ambient to -36°C, triggers high heat loss',
    icon: <Wind size={16} className="text-ice-400" />,
  },
  {
    key: 'RESUPPLY_DELAY',
    label: 'Simulate Resupply Delay',
    desc: 'Simulates sea-ice blockage; drops autonomy < 15 days, triggers fuel starvation',
    icon: <Fuel size={16} className="text-amber-400" />,
  },
  {
    key: 'POLAR_NIGHT',
    label: 'Initiate Polar Night Transition',
    desc: 'Drops solar flux to 0 W/m², drops ambient to -31°C, increases base heating',
    icon: <Snowflake size={16} className="text-blue-400" />,
  },
  {
    key: 'NOMINAL',
    label: 'Reset to Nominal State',
    desc: 'Clears injected anomalies and restores standard baseline physics',
    icon: <RotateCcw size={16} className="text-emerald-400" />,
  },
]

const MITIGATION_MAP: Record<string, { label: string; actuator: string }> = {
  'ACTION: Engage exterior hatch structural airlock sequence': {
    label: 'Engage Structural Airlock Lockdown',
    actuator: 'hatch_lockdown: true',
  },
  'ACTION: Stow external weather sensors': {
    label: 'Stow Meteorological Mast Sensors',
    actuator: 'weather_mast: stowed',
  },
  'ACTION: Spin up Standby Auxiliary Generator': {
    label: 'Spin Up Auxiliary CHP Generator',
    actuator: 'aux_generator_active: true',
  },
  'ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)': {
    label: 'Shed Science Payloads (MARA Radar & Ionosonde)',
    actuator: 'science_instruments_online: false',
  },
  'ACTION: Isolate unoccupied summer residential modules': {
    label: 'Isolate Unoccupied Summer Residential Wing',
    actuator: 'summer_wing_isolated: true',
  },
  'LOCK HATCHES': {
    label: 'Engage Structural Airlock Lockdown',
    actuator: 'hatch_lockdown: true',
  },
  'RESTRICT OUTDOOR WORK': {
    label: 'Issue Station Airlock Lockdown',
    actuator: 'hatch_lockdown: true',
  },
  'ACTIVATE AUXILIARY GENERATOR': {
    label: 'Spin Up Auxiliary CHP Generator',
    actuator: 'aux_generator_active: true',
  },
  'ISOLATE NON-ESSENTIAL LOAD': {
    label: 'Isolate Summer Residential Wing',
    actuator: 'summer_wing_isolated: true',
  },
  'REVIEW FUEL RESERVE': {
    label: 'Shed Non-Vital Science Payloads',
    actuator: 'science_instruments_online: false',
  },
}

export default function MissionControl({ onNavigate }: Props) {
  const {
    selectedStation,
    setSelectedStation,
    telemetry,
    linkMode,
    setLinkMode,
    executeMitigation,
    triggerScenario,
    selectedSubsystem,
    setSelectedSubsystem,
    isThermalView,
    toggleThermalView,
  } = usePolarisStore()

  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set())
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [executingAction, setExecutingAction] = useState<string | null>(null)

  const t = telemetry[selectedStation]
  const severity = t?.risk?.severity ?? 'NOMINAL'
  const isCritical = severity === 'CRITICAL'
  const isAdvisory = severity === 'ADVISORY'

  const handleExecute = async (actionText: string) => {
    setExecutingAction(actionText)
    await executeMitigation(actionText)
    setExecutedActions((prev) => new Set(prev).add(actionText))
    setExecutingAction(null)
  }

  const handleScenario = async (scenarioKey: string) => {
    setActiveScenario(scenarioKey)
    await triggerScenario(scenarioKey)
    setTimeout(() => {
      setActiveScenario(null)
    }, 4000)
  }

  const prescribedActions = t?.risk?.prescribed_actions ?? []
  const citations = t?.risk?.citations ?? []

  return (
    <div className="min-h-screen flex flex-col bg-base-950 text-white">
      {/* Persistent Navigation Header */}
      <TopNav
        currentTab="mission-control"
        onNavigate={onNavigate}
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-base-700 bg-base-900 p-0.5 text-xs font-mono">
              <button
                id="link-mode-realtime"
                onClick={() => setLinkMode('REALTIME')}
                className={`px-3 py-1 rounded transition-colors ${
                  linkMode === 'REALTIME'
                    ? 'bg-ice-600 text-white font-semibold shadow-glow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Real-Time
              </button>
              <button
                id="link-mode-stress"
                onClick={() => setLinkMode('STRESS_TEST')}
                className={`px-3 py-1 rounded transition-colors ${
                  linkMode === 'STRESS_TEST'
                    ? 'bg-ice-600 text-white font-semibold shadow-glow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stress-Test
              </button>
            </div>
          </div>
        }
      />

      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Anomaly Alert Header Banner */}
        <div
          className={`rounded-2xl border p-5 transition-all duration-300 ${
            isCritical
              ? 'bg-red-950/40 border-red-500/60 shadow-glow-red animate-pulse-red'
              : isAdvisory
              ? 'bg-amber-950/30 border-amber-500/50 shadow-glow'
              : 'bg-base-900/80 border-base-700 shadow-md'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
                  isCritical
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : isAdvisory
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}
              >
                {isCritical ? <ShieldAlert size={24} /> : isAdvisory ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-wide">
                    {isCritical ? 'CRITICAL RISK PROTOCOL ENGAGED' : isAdvisory ? 'OPERATIONAL ADVISORY ACTIVE' : 'ALL STATION SUBSYSTEMS NOMINAL'}
                  </h2>
                  <SeverityBadge severity={severity} score={t?.risk?.anomaly_score} />
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  AI Isolation Forest Decision Function:{' '}
                  <strong className={isCritical ? 'text-red-300 font-bold' : isAdvisory ? 'text-amber-300' : 'text-emerald-400'}>
                    {t?.risk?.anomaly_score !== undefined ? t.risk.anomaly_score.toFixed(4) : '+0.0620'}
                  </strong>
                  {' '}(positive ≈ inlier baseline, negative ≈ anomaly outlier)
                </p>
              </div>
            </div>

            {/* Quick Metrics Capsule */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">WIND GALE</span>
                <span className="text-white font-bold">{t?.ambient?.wind_speed_knots?.toFixed(1)} kt</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">HABITAT TEMP</span>
                <span className={`font-bold ${t?.thermal?.internal_temp_c < 16 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {t?.thermal?.internal_temp_c?.toFixed(1)}°C
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">DAYS AUTONOMY</span>
                <span className={`font-bold ${t?.fuel?.days_of_autonomy < 15 ? 'text-red-400' : 'text-white'}`}>
                  {t?.fuel?.days_of_autonomy?.toFixed(0)}d
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Spatial Twin Viewport (Dev 5 Three.js / React Three Fiber) */}
        <div className="relative w-full rounded-2xl border border-base-700 bg-base-900 overflow-hidden shadow-2xl">
          {/* Top 3D Control Bar Overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-base-700 bg-base-950/80 backdrop-blur p-0.5 text-xs font-mono">
              <button
                onClick={() => setSelectedStation('BHARATI')}
                className={`px-3 py-1 rounded font-semibold transition-all ${
                  selectedStation === 'BHARATI' ? 'bg-ice-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'
                }`}
              >
                BHARATI 3D
              </button>
              <button
                onClick={() => setSelectedStation('MAITRI')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  selectedStation === 'MAITRI' ? 'bg-ice-600 text-white shadow-glow' : 'text-slate-400 hover:text-white'
                }`}
              >
                MAITRI 3D
              </button>
            </div>

            {selectedSubsystem && (
              <div className="px-3 py-1 rounded-lg bg-ice-600/30 backdrop-blur border border-ice-400 text-xs font-mono text-ice-200 flex items-center gap-1.5">
                <span>INSPECTOR: <strong>{selectedSubsystem}</strong></span>
                <button
                  onClick={() => setSelectedSubsystem(null)}
                  className="text-slate-400 hover:text-white ml-1 font-bold"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
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
          </div>

          {/* 3D Canvas */}
          <div className="relative w-full h-[380px] sm:h-[440px]">
            <StationScene />
            <CinematicBrief />
          </div>

          {/* Bottom 3D Subsystem Selection Strip */}
          <div className="px-4 py-2 border-t border-base-800 bg-base-950/70 backdrop-blur flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-400">
              <Layers size={14} className="text-ice-400" />
              <span>INTERACTIVE 3D SUBSYSTEM PINS:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'MICROGRID', label: 'CHP Microgrid Block' },
                { id: 'FUEL', label: 'JET A1 Fuel Farm' },
                { id: 'COMMUNICATIONS', label: 'MARA Science Radome' },
                { id: 'STRUCTURE', label: 'Elevated Habitation Pods' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubsystem(selectedSubsystem === sub.id ? null : sub.id)}
                  className={`px-3 py-1 rounded-md border transition-all ${
                    selectedSubsystem === sub.id
                      ? 'bg-ice-600 text-white border-ice-400 font-semibold shadow-glow'
                      : 'bg-base-900 border-base-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Closed-Loop Command Grid: SOP Mitigations & Scenario Injections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SOP Mitigation Actions Drawer */}
          <div className="rounded-2xl border border-base-700 bg-base-900 p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={20} className="text-ice-400" />
                <div>
                  <h3 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                    Antarctic SOP Prescriptive Mitigation Drawer
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Deterministic SOP rule matrix triggered by Isolation Forest & sensor cliffs
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-base-800 border border-base-700 text-ice-300">
                {prescribedActions.length} Pending
              </span>
            </div>

            <div className="space-y-3 flex-1">
              {prescribedActions.length === 0 ? (
                <div className="h-44 rounded-xl border border-dashed border-base-700 bg-base-950/40 flex flex-col items-center justify-center text-center p-6">
                  <CheckCircle2 size={32} className="text-emerald-400/70 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No Emergency SOP Mitigations Required</p>
                  <p className="text-xs text-slate-500 font-mono mt-1 max-w-sm">
                    All environmental conditions and microgrid loads remain within nominal operating safety bounds.
                  </p>
                </div>
              ) : (
                prescribedActions.map((action, idx) => {
                  const details = MITIGATION_MAP[action] || { label: action, actuator: 'controls: updated' }
                  const isDone = executedActions.has(action)
                  const isExecuting = executingAction === action
                  
                  // Match citation from Supabase if applicable
                  const citation = citations.find((c: any) => {
                    if (!c) return false;
                    const ruleKey = (c.rule_key || '').toLowerCase();
                    const actionLower = (action || '').toLowerCase();
                    const mandated = c.mandated_action || '';

                    return (
                      (ruleKey && actionLower.includes(ruleKey)) ||
                      mandated === action ||
                      (c.rule_key === 'STRUCTURAL' && actionLower.includes('hatch')) ||
                      (c.rule_key === 'THERMAL' && actionLower.includes('auxiliary')) ||
                      (c.rule_key === 'FUEL_CRIT' && (actionLower.includes('scientific') || actionLower.includes('summer')))
                    );
                  });

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isDone
                          ? 'bg-base-950/40 border-base-800 opacity-60'
                          : 'bg-base-950/80 border-ice-500/40 shadow-glow'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="text-xs font-bold text-ice-300 font-mono tracking-wide">
                            {action}
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            Action: <strong className="text-white">{details.label}</strong>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Dispatches actuator payload: <span className="text-ice-400 font-mono">{details.actuator}</span>
                          </div>
                        </div>

                        <button
                          disabled={isDone || isExecuting}
                          onClick={() => handleExecute(action)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                              : 'bg-ice-600 hover:bg-ice-500 text-white shadow-glow'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <Check size={14} /> EXECUTED
                            </>
                          ) : isExecuting ? (
                            <span>SENDING...</span>
                          ) : (
                            <>
                              <Send size={13} /> APPROVE &amp; EXECUTE
                            </>
                          )}
                        </button>
                      </div>

                      {/* --- Authoritative SOP Citation Box (Supabase RAG) --- */}
                      {citation && (
                        <div className="mt-3 pt-2.5 border-t border-base-800/80 bg-base-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-amber-300 flex items-center gap-1.5 font-mono">
                              <BookOpen size={13} className="text-amber-400" />
                              {citation.clause}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-base-950 px-1.5 py-0.5 rounded border border-base-800">
                              {citation.source_path}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1.5">
                            <FileText size={11} className="text-slate-500" />
                            <span>{citation.document_title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 italic bg-base-950/70 p-2 rounded border border-base-800/60 leading-relaxed font-sans">
                            "{citation.excerpt}"
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Actuator States Capsule */}
            <div className="mt-4 pt-4 border-t border-base-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">HATCHES</span>
                <span className={t?.controls?.hatch_lockdown ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                  {t?.controls?.hatch_lockdown ? 'LOCKED' : 'UNLOCKED'}
                </span>
              </div>
              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">SCIENCE PAYLOAD</span>
                <span className={t?.controls?.science_instruments_online ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                  {t?.controls?.science_instruments_online ? 'ONLINE' : 'SHEDDED'}
                </span>
              </div>
              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">SUMMER WING</span>
                <span className={t?.controls?.summer_wing_isolated ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                  {t?.controls?.summer_wing_isolated ? 'ISOLATED' : 'ACTIVE'}
                </span>
              </div>
              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">AUX GENERATOR</span>
                <span className={t?.controls?.aux_generator_active ? 'text-ice-400 font-bold' : 'text-slate-400'}>
                  {t?.controls?.aux_generator_active ? 'RUNNING' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          {/* Scenario Injection Utility Tray (For Hackathon Pitch Demos) */}
          <div className="rounded-2xl border border-base-700 bg-base-900 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders size={20} className="text-ice-400" />
                  <div>
                    <h3 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                      Scenario Injection Utility Tray
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Inject stress-test anomalies to demonstrate real-time closed loop response
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-ice-600/20 text-ice-300 border border-ice-500/30">
                  Pitch Demo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {SCENARIOS.map((sc) => {
                  const isActive = activeScenario === sc.key
                  return (
                    <button
                      key={sc.key}
                      onClick={() => handleScenario(sc.key)}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        isActive
                          ? 'bg-ice-600 text-white border-ice-300 shadow-glow scale-[1.02]'
                          : 'bg-base-950/80 border-base-700 hover:border-ice-500/50 hover:bg-base-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {sc.icon}
                        <h4 className="text-xs font-bold font-mono tracking-wide">{sc.label}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{sc.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ingestion & Satellite Latency Footer Notice */}
            <div className="p-3.5 rounded-xl border border-base-800 bg-base-950/80 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>ANTARCTICA EDGE SIMULATOR:</span>
                <span className="text-ice-300 font-semibold">PORT 8001 (ODE Engine)</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>POLARIS HQ DIGITAL TWIN:</span>
                <span className="text-ice-300 font-semibold">PORT 8000 (Scikit-Learn ML)</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>SATELLITE DELAY:</span>
                <span className="text-white font-semibold">400–800 ms round trip injected</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
