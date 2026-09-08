import { useState } from 'react'
import { Radio, Wind, Snowflake, Fuel, ShieldAlert, CheckCircle2, Zap } from 'lucide-react'
import TopNav from '../components/TopNav'
import SeverityBadge from '../components/SeverityBadge'
import { usePolarisStore } from '../store/usePolarisStore'
import { applyControl, injectScenarioSim } from '../lib/telemetrySim'
import type { ScenarioKey } from '../lib/types'
import StationScene from '../3d/StationScene'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

const SCENARIOS: { key: ScenarioKey; label: string; icon: React.ReactNode }[] = [
  { key: 'BLIZZARD_80KT', label: 'Trigger 80-Knot Blizzard', icon: <Wind size={16} /> },
  { key: 'RESUPPLY_DELAY', label: 'Simulate Sea-Ice Resupply Delay', icon: <Fuel size={16} /> },
  { key: 'POLAR_NIGHT', label: 'Initiate Polar Night Transition', icon: <Snowflake size={16} /> },
]

const ACTION_LABELS: Record<string, string> = {
  'ACTION: Engage exterior hatch structural airlock sequence': 'Lock Down Hatches',
  'ACTION: Stow external weather sensors': 'Stow Weather Sensors',
  'ACTION: Spin up Standby Auxiliary Generator': 'Start Aux Generator',
  'ACTION: Shed non-vital scientific payloads (MARA radar, ionosonde)': 'Shed Science Payloads',
  'ACTION: Isolate unoccupied summer residential modules': 'Isolate Summer Wing',
}

export default function MissionControl({ onNavigate }: Props) {
  const { selectedStation, setSelectedStation, telemetry, linkMode, setLinkMode } = usePolarisStore()
  const [executed, setExecuted] = useState<Set<string>>(new Set())
  const [lastInjected, setLastInjected] = useState<ScenarioKey | null>(null)

  const t = telemetry[selectedStation]

  const handleExecute = (action: string) => {
    if (action.includes('Aux Generator') || action.includes('Auxiliary Generator')) {
      applyControl(selectedStation, 'aux_generator_active', true)
    }
    if (action.includes('Summer Wing') || action.includes('summer residential')) {
      applyControl(selectedStation, 'summer_wing_isolated', true)
    }
    if (action.includes('Science Payloads') || action.includes('scientific payloads')) {
      applyControl(selectedStation, 'science_online', false)
    }
    if (action.includes('Hatch') || action.includes('hatch')) {
      applyControl(selectedStation, 'hatch_lockdown', true)
    }
    setExecuted((prev) => new Set(prev).add(action))
  }

  const handleScenario = (key: ScenarioKey) => {
    injectScenarioSim(selectedStation, key, 30)
    setLastInjected(key)
    setTimeout(() => setLastInjected((cur) => (cur === key ? null : cur)), 3000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav
        title="Mission Control"
        subtitle="Alert & Mitigation · 3D Digital Twin · Live Satellite Feed"
        onHome={() => onNavigate('home')}
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-base-600 overflow-hidden text-xs">
              <button
                id="link-mode-realtime"
                onClick={() => setLinkMode('REALTIME')}
                className={`px-3 py-1.5 ${linkMode === 'REALTIME' ? 'bg-ice-600 text-white' : 'bg-base-800 text-slate-400 hover:text-slate-200'}`}
              >
                Real-time Synced
              </button>
              <button
                id="link-mode-stress"
                onClick={() => setLinkMode('STRESS_TEST')}
                className={`px-3 py-1.5 ${linkMode === 'STRESS_TEST' ? 'bg-ice-600 text-white' : 'bg-base-800 text-slate-400 hover:text-slate-200'}`}
              >
                Stress-Test
              </button>
            </div>
          </div>
        }
      />

      {/* 3D Scene — full width banner */}
      <div className="relative w-full h-[360px] border-b border-base-700">
        <StationScene />

        {/* Station switcher overlay inside the 3D view */}
        <div className="absolute top-3 left-3 flex rounded-lg border border-base-600 overflow-hidden z-10">
          {(['BHARATI', 'MAITRI'] as const).map((st) => (
            <button
              key={st}
              id={`station-tab-${st.toLowerCase()}`}
              onClick={() => st === 'BHARATI' && setSelectedStation(st)}
              disabled={st === 'MAITRI'}
              title={st === 'MAITRI' ? 'Maitri link currently unoperational' : undefined}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedStation === st ? 'bg-ice-600 text-white' : 'bg-base-800/80 text-slate-400'
              } ${st === 'MAITRI' ? 'opacity-40 cursor-not-allowed' : 'hover:text-slate-200'}`}
            >
              {st === 'BHARATI' ? 'Bharati' : 'Maitri (offline)'}
            </button>
          ))}
        </div>

        {/* Link badge overlay */}
        {t && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-base-600 bg-base-900/80 backdrop-blur text-xs z-10">
            <Radio size={14} className={t.link_status.health === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'} />
            <span className="text-slate-300">{t.link_status.type}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">{t.link_status.latency_ms}ms</span>
            <span
              className={`ml-1 px-2 py-0.5 rounded-full font-semibold ${
                t.link_status.health === 'ONLINE'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {t.link_status.health}
            </span>
          </div>
        )}
      </div>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Alert header */}
        <div className="rounded-2xl border border-base-700 bg-base-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert
                size={22}
                className={
                  t?.risk.severity === 'CRITICAL'
                    ? 'text-red-400'
                    : t?.risk.severity === 'ADVISORY'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }
              />
              <h2 className="font-semibold text-lg">Anomaly &amp; Mitigation Status</h2>
            </div>
            {t ? <SeverityBadge severity={t.risk.severity} score={t.risk.anomaly_score} /> : (
              <span className="text-xs text-slate-500 animate-pulse">Awaiting first telemetry frame…</span>
            )}
          </div>

          {t && t.risk.prescribed_actions.length > 0 ? (
            <div className="space-y-2">
              {t.risk.prescribed_actions.map((action) => {
                const done = executed.has(action)
                return (
                  <div
                    key={action}
                    className="flex items-center justify-between gap-3 rounded-lg border border-base-700 bg-base-850 px-4 py-3"
                  >
                    <p className="text-sm text-slate-300">{action}</p>
                    <button
                      onClick={() => handleExecute(action)}
                      disabled={done}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        done
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                          : 'bg-ice-600 hover:bg-ice-500 text-white'
                      }`}
                    >
                      {done ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                      {done ? 'Executed' : ACTION_LABELS[action] ?? 'Approve & Execute'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No mitigation actions prescribed — station nominal.</p>
          )}
        </div>

        {/* Scenario injection tray */}
        <div className="rounded-2xl border border-base-700 bg-base-900 p-5">
          <h2 className="font-semibold text-sm text-slate-300 mb-3 uppercase tracking-wide">
            Scenario Injection · Pitch Demo Tray
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.key}
                id={`scenario-${sc.key.toLowerCase()}`}
                onClick={() => handleScenario(sc.key)}
                className={`flex items-center gap-2 justify-center px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  lastInjected === sc.key
                    ? 'border-ice-500 bg-ice-600/20 text-ice-300'
                    : 'border-base-600 bg-base-800 hover:border-ice-600 hover:text-ice-300 text-slate-300'
                }`}
              >
                {sc.icon}
                {sc.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Posts to <code className="text-slate-400">POST /api/scenario/inject</code> in production — simulated
            locally here for offline demo.
          </p>
        </div>

        {/* Quick telemetry strip */}
        {t && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Internal Temp" value={`${t.thermal.internal_temp_c.toFixed(1)}°C`} />
            <MiniStat label="Wind Speed" value={`${t.ambient.wind_speed_knots.toFixed(0)} kt`} />
            <MiniStat label="Fuel Autonomy" value={`${t.fuel.days_of_autonomy.toFixed(0)} d`} />
            <MiniStat label="Total Load" value={`${t.microgrid.total_load_kva} kVA`} />
          </div>
        )}
      </main>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}
