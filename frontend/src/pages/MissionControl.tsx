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
  Check,
  RotateCcw,
  Send,
  Sliders,
  Cpu,
  BookOpen,
  FileText,
} from 'lucide-react'
import TopNav from '../components/TopNav'
import SeverityBadge from '../components/SeverityBadge'
import LiveTwinViewport from '../components/LiveTwinViewport'
import IncidentTimeline from '../components/IncidentTimeline'
import { useShallow } from 'zustand/react/shallow'
import { usePolarisStore } from '../store/usePolarisStore'
import { citationForAction } from '../ops/sopCite'
import {
  LinkHealthPanel,
  ProactiveSignals,
  SOP_RULES,
  SopRuleMatrix,
  evaluateRule,
  formatEta,
} from '../ops/LiveOpsAnalysis'

interface Props {
  onNavigate: (
    route: 'home' | 'mission-control' | 'analytics' | 'fleet'
  ) => void
}

const SCENARIOS = [
  {
    key: 'BLIZZARD_80KT',
    label: 'Forecast Incoming Blizzard',
    desc: 'Pressure collapse → gust acceleration → structural hazard',
    icon: <Wind size={16} className="text-ice-400" />,
  },
  {
    key: 'RESUPPLY_DELAY',
    label: 'Simulate Resupply Delay',
    desc: 'Fuel burn projection and progressive autonomy depletion',
    icon: <Fuel size={16} className="text-amber-400" />,
  },
  {
    key: 'POLAR_NIGHT',
    label: 'Initiate Polar Night Transition',
    desc: 'Drops solar flux to 0 W/m², drops ambient to -31°C, increases base heating',
    icon: <Snowflake size={16} className="text-blue-400" />,
  },
  {
    key: 'MICROGRID_FAILURE',
    label: 'Simulate CHP / Microgrid Failure',
    desc: 'Progressive generator degradation and thermal margin collapse',
    icon: <Zap size={16} className="text-red-400" />,
  },
  {
    key: 'COMMUNICATION_DEGRADATION',
    label: 'Simulate Satellite Degradation',
    desc: 'C-band/LEO latency escalation and edge autonomy transition',
    icon: <Radio size={16} className="text-orange-400" />,
  },
  {
    key: 'NOMINAL',
    label: 'Reset to Nominal State',
    desc: 'Clears injected anomalies and restores standard baseline physics',
    icon: <RotateCcw size={16} className="text-emerald-400" />,
  },
]

const MITIGATION_MAP: Record<
  string,
  { label: string; actuator: string }
> = {
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

export default function MissionControl({
  onNavigate,
}: Props) {
  const {
    selectedStation,
    telemetry,
    linkMode,
    setLinkMode,
    executeMitigation,
    triggerScenario,
  } = usePolarisStore(
    useShallow((s: any) => ({
      selectedStation: s.selectedStation,
      telemetry: s.telemetry,
      linkMode: s.linkMode,
      setLinkMode: s.setLinkMode,
      executeMitigation: s.executeMitigation,
      triggerScenario: s.triggerScenario,
    })),
  )

  const [executedActions, setExecutedActions] =
    useState<Set<string>>(new Set())

  const [activeScenario, setActiveScenario] =
    useState<string | null>(null)

  const [executingAction, setExecutingAction] =
    useState<string | null>(null)

  const t = telemetry[selectedStation]

  const proactive = t?.proactive

  const severity =
    t?.risk?.severity ?? 'NOMINAL'

  const isCritical =
    severity === 'CRITICAL'

  const isAdvisory =
    severity === 'ADVISORY'

  const forecastAlert =
    proactive && proactive.status && proactive.status !== 'CLEAR'
      ? `${proactive.hazard} ${proactive.status}`
      : null

  const watchOnly = !isCritical && !isAdvisory && Boolean(forecastAlert)

  const handleExecute = async (
    actionText: string
  ) => {
    setExecutingAction(actionText)

    await executeMitigation(actionText)

    setExecutedActions(
      (prev) =>
        new Set(prev).add(actionText)
    )

    setExecutingAction(null)
  }

  const handleScenario = async (
    scenarioKey: string
  ) => {
    setActiveScenario(scenarioKey)

    await triggerScenario(scenarioKey)

    setTimeout(() => {
      setActiveScenario(null)
    }, 4000)
  }

  const prescribedActions =
    t?.risk?.prescribed_actions ?? []
  const citations =
    t?.risk?.citations ?? []

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
                onClick={() =>
                  setLinkMode('REALTIME')
                }
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
                onClick={() =>
                  setLinkMode('STRESS_TEST')
                }
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
              : watchOnly
              ? 'analytics-card !border-amber-500/40'
              : 'analytics-card !border-emerald-500/30'
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
                {isCritical ? (
                  <ShieldAlert size={24} />
                ) : isAdvisory ? (
                  <AlertTriangle size={24} />
                ) : (
                  <CheckCircle2 size={24} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-wide">
                    {isCritical
                      ? 'CRITICAL RISK PROTOCOL ENGAGED'
                      : isAdvisory
                      ? 'OPERATIONAL ADVISORY ACTIVE'
                      : watchOnly
                      ? 'SUBSYSTEMS NOMINAL · FORECAST WATCH'
                      : 'ALL STATION SUBSYSTEMS NOMINAL'}
                  </h2>
                  {forecastAlert && (
                    <span className="rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                      {forecastAlert}
                    </span>
                  )}

                  <SeverityBadge
                    severity={severity}
                    score={
                      t?.risk?.anomaly_score
                    }
                  />
                </div>

                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  Severity driver:{' '}
                  <strong className="text-white uppercase">{t?.risk?.driver ?? 'nominal'}</strong>
                  {' · '}
                  {t?.risk?.driver === 'nowcast' ? 'P(≥23 kt)' : 'IF score'}{' '}
                  <strong
                    className={
                      isCritical
                        ? 'text-red-300 font-bold'
                        : isAdvisory
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }
                  >
                    {typeof t?.risk?.anomaly_score === 'number' ? t.risk.anomaly_score.toFixed(3) : '—'}
                  </strong>
                  {' · '}
                  {(() => {
                    const rows = SOP_RULES.map((r) => evaluateRule(r, t))
                    const tripped = rows.filter((r) => r.status === 'TRIPPED').length
                    const near = rows.filter((r) => r.status === 'NEAR').length
                    return `${tripped} SOP limits tripped, ${near} near`
                  })()}
                  {' · '}
                  {t?.lockouts?.outdoor === 'LOCKED' ? (
                    <span className="text-amber-300">outdoor LOCKED</span>
                  ) : (
                    <span className="text-emerald-400">outdoor open</span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Metrics Capsule */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">
                  WIND GALE
                </span>

                <span className="text-white font-bold">
                  {t?.ambient?.wind_speed_knots?.toFixed(
                    1
                  )}{' '}
                  kt
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">
                  HABITAT TEMP
                </span>

                <span
                  className={`font-bold ${
                    t?.thermal?.internal_temp_c <
                    16
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {t?.thermal?.internal_temp_c?.toFixed(
                    1
                  )}
                  °C
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-base-950/70 border border-base-700">
                <span className="text-slate-500 block text-[10px]">
                  DAYS AUTONOMY
                </span>

                <span
                  className={`font-bold ${
                    t?.fuel?.days_of_autonomy <
                    15
                      ? 'text-red-400'
                      : 'text-white'
                  }`}
                >
                  {t?.fuel?.days_of_autonomy?.toFixed(
                    0
                  )}
                  d
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Proactive Operations Intelligence */}
        {proactive &&
          proactive.status !== 'CLEAR' && (
            <div
              className={`proactive-alert analytics-card relative overflow-hidden rounded-2xl p-5 ${
                proactive.status === 'ACTIVE'
                  ? '!border-red-500/50'
                  : proactive.status === 'IMMINENT'
                  ? '!border-amber-500/50'
                  : '!border-ice-500/40'
              }`}
            >
              <span
                className={`pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl ${
                  proactive.status === 'ACTIVE'
                    ? 'bg-red-500'
                    : proactive.status === 'IMMINENT'
                    ? 'bg-amber-500'
                    : 'bg-ice-500'
                }`}
              />
              <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="flex flex-col">
                  <div className="proactive-alert__header flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-mono font-bold tracking-[0.18em] text-ice-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ice-300" />
                      PROACTIVE OPERATIONS
                    </span>
                    <strong
                      className={`text-xs font-mono px-2.5 py-1 rounded-md border ${
                        proactive.status === 'ACTIVE'
                          ? 'text-red-300 bg-red-500/20 border-red-500/40 animate-pulse'
                          : proactive.status === 'IMMINENT'
                          ? 'text-amber-300 bg-amber-500/20 border-amber-500/40'
                          : 'text-ice-300 bg-ice-500/20 border-ice-500/40'
                      }`}
                    >
                      {proactive.status}
                    </strong>
                  </div>

                  <div className="proactive-alert__hazard mt-3 text-3xl font-black tracking-wide text-white">
                    {proactive.hazard}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    Source:{' '}
                    <span className="text-slate-200">
                      {proactive.model
                        ? `${proactive.model} nowcast · proxy ${proactive.neighbor ?? '—'}`
                        : 'physics trend engine (pressure + wind rate)'}
                    </span>
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 font-mono">
                    {proactive.eta_minutes != null && (
                      <div className="rounded-xl border border-base-700 bg-base-950/70 p-3">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                          Escalation in
                        </span>
                        <strong className="text-2xl text-white tabular-nums">
                          {formatEta(proactive.eta_minutes)}
                        </strong>
                      </div>
                    )}
                    {proactive.confidence > 0 && (
                      <div className="rounded-xl border border-base-700 bg-base-950/70 p-3">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                          Confidence
                        </span>
                        <strong className="text-2xl text-white tabular-nums">
                          {Math.round(proactive.confidence * 100)}%
                        </strong>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-ice-500 to-neon-cyan transition-all duration-700"
                            style={{ width: `${Math.round(proactive.confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      Trigger signals · live
                    </span>
                    <ProactiveSignals proactive={proactive} telemetry={t} />
                  </div>
                </div>

                {proactive.recommended_actions?.length > 0 && (
                  <div className="proactive-alert__actions rounded-xl border border-base-700 bg-base-950/60 p-4">
                    <strong className="mb-3 flex items-center justify-between text-xs font-mono tracking-wide text-ice-300">
                      RECOMMENDED NOW
                      <span className="text-[10px] font-normal text-slate-500">
                        {proactive.recommended_actions.length} actions
                      </span>
                    </strong>
                    <ol className="space-y-2">
                      {proactive.recommended_actions.map((action: string, i: number) => (
                        <li
                          key={action}
                          className="flex items-center gap-3 rounded-lg border border-base-800 bg-base-900/70 px-3 py-2 text-sm text-slate-200 transition hover:border-ice-500/40"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ice-500/40 bg-ice-600/20 font-mono text-[11px] font-bold text-ice-300">
                            {i + 1}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

        <IncidentTimeline />

        <LiveTwinViewport />

        {/* Closed-Loop Command Grid: SOP Mitigations & Scenario Injections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SOP Mitigation Actions Drawer */}
          <div className="analytics-card rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert
                  size={20}
                  className="text-ice-400"
                />

                <div>
                  <h3 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                    Antarctic SOP Prescriptive Mitigation Drawer
                  </h3>

                  <p className="text-xs text-slate-400 font-mono">
                    Live SOP limits · approve actions when a rule trips
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono px-2 py-0.5 rounded bg-base-800 border border-base-700 text-ice-300">
                {prescribedActions.length}{' '}
                Pending
              </span>
            </div>

            <div className="space-y-3 flex-1">
              {prescribedActions.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 font-mono text-[11px] text-emerald-300">
                  <CheckCircle2 size={14} /> No SOP action pending — every limit below is inside its trip point.
                </div>
              )}
              {prescribedActions.length > 0 && (
                prescribedActions.map(
                  (
                    action: string,
                    idx: number
                  ) => {
                    const details =
                      MITIGATION_MAP[
                        action
                      ] || {
                        label: action,
                        actuator:
                          'controls: updated',
                      }

                    const isDone =
                      executedActions.has(
                        action
                      )

                    const isExecuting =
                      executingAction ===
                      action

                    const citation = citationForAction(action, citations)

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
                              Action:{' '}
                              <strong className="text-white">
                                {
                                   details.label
                                }
                              </strong>
                            </div>

                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              Dispatches actuator payload:{' '}
                              <span className="text-ice-400 font-mono">
                                {
                                  details.actuator
                                }
                              </span>
                            </div>
                          </div>

                          <button
                            disabled={
                              isDone ||
                              isExecuting
                            }
                            onClick={() =>
                              handleExecute(
                                action
                              )
                            }
                            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                                : 'bg-ice-600 hover:bg-ice-500 text-white shadow-glow'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <Check
                                  size={
                                    14
                                  }
                                />{' '}
                                EXECUTED
                              </>
                            ) : isExecuting ? (
                              <span>
                                SENDING...
                              </span>
                            ) : (
                              <>
                                <Send
                                  size={
                                    13
                                  }
                                />{' '}
                                APPROVE &amp;
                                EXECUTE
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
                  }
                )
              )}
              <SopRuleMatrix telemetry={t} />
            </div>

            {citations.length > 0 && (
              <div className="mt-3 rounded-lg border border-base-800 bg-base-950/50 p-3">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-wide text-slate-500">
                  Regulation provenance
                </p>
                <ul className="space-y-1">
                  {citations.map((item: any) => (
                    <li key={item.rule_key || item.clause} className="text-[11px] leading-relaxed text-slate-300">
                      <span className="text-amber-200">{item.clause}</span>
                      {' · '}
                      {item.document_title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actuator States Capsule */}
            <div className="mt-4 pt-4 border-t border-base-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">
                  HATCHES
                </span>

                <span
                  className={
                    t?.controls
                      ?.hatch_lockdown
                      ? 'text-red-400 font-bold'
                      : 'text-emerald-400'
                  }
                >
                  {t?.controls
                    ?.hatch_lockdown
                    ? 'LOCKED'
                    : 'UNLOCKED'}
                </span>
              </div>

              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">
                  SCIENCE PAYLOAD
                </span>

                <span
                  className={
                    t?.controls
                      ?.science_instruments_online
                      ? 'text-emerald-400'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {t?.controls
                    ?.science_instruments_online
                    ? 'ONLINE'
                    : 'SHEDDED'}
                </span>
              </div>

              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">
                  SUMMER WING
                </span>

                <span
                  className={
                    t?.controls
                      ?.summer_wing_isolated
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400'
                  }
                >
                  {t?.controls
                    ?.summer_wing_isolated
                    ? 'ISOLATED'
                    : 'ACTIVE'}
                </span>
              </div>

              <div className="p-2 rounded bg-base-950 border border-base-800">
                <span className="text-slate-500 block text-[9px]">
                  AUX GENERATOR
                </span>

                <span
                  className={
                    t?.controls
                      ?.aux_generator_active
                      ? 'text-ice-400 font-bold'
                      : 'text-slate-400'
                  }
                >
                  {t?.controls
                    ?.aux_generator_active
                    ? 'RUNNING'
                    : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          {/* Scenario Injection Utility Tray */}
          <div className="analytics-card rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders
                    size={20}
                    className="text-ice-400"
                  />

                  <div>
                    <h3 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                      Scenario Injection Utility Tray
                    </h3>

                    <p className="text-xs text-slate-400 font-mono">
                      Inject stress-test anomalies to demonstrate real-time closed loop response
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    t?.scenario_id && t.scenario_id !== 'NOMINAL'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-base-800 text-slate-400 border-base-700'
                  }`}
                >
                  {t?.scenario_id && t.scenario_id !== 'NOMINAL'
                    ? `ACTIVE: ${String(t.scenario_id).replace(/_/g, ' ')}`
                    : 'No injection'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {SCENARIOS.map((sc) => {
                  const isActive =
                    activeScenario ===
                    sc.key

                  return (
                    <button
                      key={sc.key}
                      onClick={() =>
                        handleScenario(
                          sc.key
                        )
                      }
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        isActive
                          ? 'bg-ice-600 text-white border-ice-300 shadow-glow scale-[1.02]'
                          : 'bg-base-950/80 border-base-700 hover:border-ice-500/50 hover:bg-base-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {sc.icon}

                        <h4 className="text-xs font-bold font-mono tracking-wide">
                          {sc.label}
                        </h4>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-snug">
                        {sc.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ingestion & Satellite Latency Footer Notice */}
            <div className="space-y-3">
              <div className="rounded-xl border border-base-800 bg-base-950/70 p-3.5 font-mono">
                <span className="mb-2 block text-[10px] uppercase tracking-wider text-slate-400">
                  Ops lockouts · live
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {(
                    [
                      ['Outdoor', t?.lockouts?.outdoor, '23 kt'],
                      ['Helicopter', t?.lockouts?.heli, '40 kt'],
                      ['Convoy', t?.lockouts?.convoy, '50 kt'],
                    ] as const
                  ).map(([label, state, limit]) => (
                    <div
                      key={label}
                      className={`rounded-lg border px-2.5 py-2 ${
                        state === 'LOCKED'
                          ? 'border-red-500/50 bg-red-500/10'
                          : 'border-emerald-500/25 bg-emerald-500/5'
                      }`}
                    >
                      <span className="block text-[9px] text-slate-500">
                        {label} · {limit}
                      </span>
                      <strong className={state === 'LOCKED' ? 'text-red-300' : 'text-emerald-300'}>
                        {state ?? '—'}
                      </strong>
                    </div>
                  ))}
                </div>
                {t?.lockouts?.reasons?.length > 0 && (
                  <p className="mt-2 text-[10px] text-slate-400">{t.lockouts.reasons.join(' · ')}</p>
                )}
              </div>
              <LinkHealthPanel telemetry={t} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}