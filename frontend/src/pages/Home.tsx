import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  Radio,
  Thermometer,
  Gauge,
  ArrowRight,
  Snowflake,
  ShieldAlert,
  Zap,
  Wind,
  Layers,
  Compass,
  Satellite,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'
import BootSequence from '../components/BootSequence'
import ServicePulse from '../components/ServicePulse'
import AntarcticGlobe from '../components/AntarcticGlobe'
import { GLOBE_SITES } from '../lib/stationSites'

type StationId = 'BHARATI' | 'MAITRI'

function fmt(value: unknown, digits: number, unit: string) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : '—'
}

function average(telemetry: Record<string, any>, pick: (t: any) => unknown) {
  const values = (['BHARATI', 'MAITRI'] as const)
    .map((id) => pick(telemetry?.[id]))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
}

function StationLiveCard({
  id,
  data,
  selected,
  awaiting,
  onSelect,
}: {
  id: StationId
  data: any
  selected: boolean
  awaiting: boolean
  onSelect: () => void
}) {
  const site = GLOBE_SITES[id]
  const severity = data?.risk?.severity || 'NOMINAL'
  const windKt = data?.ambient?.wind_speed_knots
  const value = (text: string) =>
    awaiting ? <span className="inline-block h-6 w-16 animate-pulse rounded bg-white/10" /> : text

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`station-live-card group relative w-full overflow-hidden rounded-2xl border p-4 text-left backdrop-blur transition-all duration-300 ${
        selected ? 'bg-base-900/90' : 'border-base-700/80 bg-base-900/65 hover:bg-base-900/80'
      }`}
      style={{
        borderColor: selected ? `${site.color}aa` : undefined,
        boxShadow: selected ? `0 0 0 1px ${site.color}33, 0 10px 40px -12px ${site.color}66` : undefined,
      }}
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: site.color }}
      />
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: site.color, boxShadow: `0 0 12px ${site.color}` }} />
          <span className="text-sm font-bold tracking-wide text-white">{site.name.toUpperCase()}</span>
          <span className="font-mono text-[10px] text-slate-500">{site.region}</span>
        </span>
        <SeverityBadge severity={severity} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Ambient</span>
          <span className="text-2xl font-bold tabular-nums text-white">{value(fmt(data?.ambient?.temp_c, 1, '°'))}</span>
        </div>
        <div>
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
            <Wind size={10} /> Wind
          </span>
          <span className="text-lg font-bold tabular-nums text-white">{value(fmt(windKt, 0, ' kt'))}</span>
          {typeof windKt === 'number' && !awaiting && (
            <span className="block font-mono text-[9px] text-slate-500">{(windKt * 0.5144).toFixed(1)} m/s</span>
          )}
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Anomaly</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: site.color }}>
            {value(fmt(data?.risk?.anomaly_score, 3, ''))}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-base-800 pt-2 font-mono text-[10px] text-slate-400">
        <span>Fuel {fmt(data?.fuel?.days_of_autonomy, 0, ' d')}</span>
        <span>Load {fmt(data?.microgrid?.total_load_kva, 0, ' kVA')}</span>
        <span>{Math.abs(site.lat).toFixed(2)}°S {site.lon.toFixed(2)}°E</span>
      </div>
    </button>
  )
}

function OverallStat({ label, value, unit, digits }: { label: string; value: number | undefined; unit: string; digits: number }) {
  return (
    <div>
      <span className="block text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm font-bold text-white">{fmt(value, digits, unit)}</span>
    </div>
  )
}

function PanelRow({ icon, label, value, live }: { icon: ReactNode; label: string; value: string; live: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-ice-300">{icon}</span>
      <div className="flex-1">
        <p className="font-semibold text-slate-100">{label}</p>
        <p className="font-mono text-[10px] text-slate-400">{value}</p>
      </div>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
    </div>
  )
}

function FocusStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-base-700/80 bg-base-950/50 p-2.5">
      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
        <span className="text-ice-400">{icon}</span>
        {label}
      </span>
      <span className="mt-0.5 block text-base font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}

interface HomeProps {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics' | 'fleet') => void
}

export default function Home({ onNavigate }: HomeProps) {
  const { telemetry, selectedStation, setSelectedStation, connection } = usePolarisStore(
    useShallow((s: any) => ({
      telemetry: s.telemetry,
      selectedStation: s.selectedStation,
      setSelectedStation: s.setSelectedStation,
      connection: s.connection,
    })),
  )
  const [clock, setClock] = useState(new Date())
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const layer = parallaxRef.current
    if (!layer) return

    const pointer = { x: 0, y: 0 }
    let scrollY = window.scrollY
    let frame = 0

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const apply = () => {
      frame = 0
      if (prefersReducedMotion) {
        layer.style.transform = 'translate3d(0, 0, 0) scale(1.12)'
        return
      }
      const x = pointer.x * 36
      const y = scrollY * 0.38 + pointer.y * 22
      layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.18)`
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(apply)
    }

    const onScroll = () => {
      scrollY = window.scrollY
      schedule()
    }

    const onPointer = (event: PointerEvent) => {
      pointer.x = event.clientX / window.innerWidth - 0.5
      pointer.y = event.clientY / window.innerHeight - 0.5
      schedule()
    }

    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const activeTelemetry = telemetry[selectedStation]
  const awaitingLink = !connection?.last_update
  const metric = (value: string) =>
    awaitingLink ? (
      <span className="mt-1 inline-block h-6 w-20 animate-pulse rounded bg-white/10" />
    ) : (
      value
    )

  return (
    <div className="relative min-h-screen flex flex-col bg-base-950 text-white overflow-hidden">
      <BootSequence />
      {/* Parallax Antarctic background — image tracks pointer and scroll behind the UI */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          ref={parallaxRef}
          className="absolute -inset-[10%] bg-cover bg-center bg-no-repeat will-change-transform"
          style={{
            backgroundImage: `url('/antarctica-bg.jpg')`,
            transform: 'translate3d(0, 0, 0) scale(1.18)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-base-950/70 via-base-950/58 to-base-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(3,5,8,0.72)_100%)]" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col max-w-[1480px] mx-auto w-full">
        <ServicePulse />
        <div className="px-4 sm:px-6 lg:px-8 py-6">
        <section className="mb-10 grid grid-cols-1 gap-5 pt-2 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)_minmax(0,290px)]">
          {/* Left: title + live station cards */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ice-400/40 bg-ice-600/20 px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] text-ice-300 shadow-glow">
                <Snowflake size={12} className="animate-spin-slow text-ice-300" />
                NCPOR ANTARCTIC MISSION CONTROL
              </div>
              <h1 className="hero-title text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
                <span className="block text-white">ANTARCTICA</span>
                <span className="block bg-gradient-to-r from-ice-300 via-sky-300 to-neon-cyan bg-clip-text text-transparent">
                  CONNECTED
                </span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                POLARIS digital twin for <strong className="font-medium text-white">Bharati</strong> and{' '}
                <strong className="font-medium text-white">Maitri</strong>: live telemetry, anomaly scoring and
                SOP-cited mitigation, commanded from Goa.
              </p>
            </div>

            {(['MAITRI', 'BHARATI'] as const).map((id) => (
              <StationLiveCard
                key={id}
                id={id}
                data={telemetry[id]}
                selected={selectedStation === id}
                awaiting={awaitingLink}
                onSelect={() => setSelectedStation(id)}
              />
            ))}

            <div className="rounded-2xl border border-base-700/80 bg-base-900/70 p-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <Layers size={12} className="text-ice-400" /> Antarctic overall
                </span>
                <span className="rounded border border-ice-500/30 bg-ice-600/15 px-1.5 py-px font-mono text-[9px] text-ice-300">
                  Twin average
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <OverallStat label="Avg temp" value={average(telemetry, (t) => t?.ambient?.temp_c)} unit="°C" digits={1} />
                <OverallStat label="Avg wind" value={average(telemetry, (t) => t?.ambient?.wind_speed_knots)} unit=" kt" digits={1} />
                <OverallStat label="Fuel days" value={average(telemetry, (t) => t?.fuel?.days_of_autonomy)} unit="" digits={0} />
              </div>
            </div>
          </div>

          {/* Center: globe */}
          <AntarcticGlobe
            className="min-h-[460px] lg:min-h-[640px]"
            selected={selectedStation}
            telemetry={telemetry}
            onSelect={setSelectedStation}
          />

          {/* Right: twin station panel */}
          <aside className="flex flex-col gap-4 lg:col-span-2 xl:col-span-1">
            <div className="rounded-2xl border border-base-700/80 bg-base-900/75 p-4 backdrop-blur">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ice-500/40 bg-ice-600/20 text-ice-300">
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Twin Stations</p>
                  <p className="text-[11px] text-slate-400">Two points. One mission.</p>
                </div>
              </div>
              <div className="space-y-2">
                {(['BHARATI', 'MAITRI'] as const).map((id) => {
                  const site = GLOBE_SITES[id]
                  const t = telemetry[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedStation(id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                        selectedStation === id
                          ? 'border-white/25 bg-white/[0.06]'
                          : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="h-2 w-2 rounded-full" style={{ background: site.color, boxShadow: `0 0 10px ${site.color}` }} />
                        {site.name} (India)
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                        {Math.abs(site.lat).toFixed(2)}°S, {site.lon.toFixed(2)}°E · {fmt(t?.ambient?.temp_c, 1, '°C')} ·{' '}
                        {fmt(t?.ambient?.wind_speed_knots, 0, ' kt')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 space-y-2.5 border-t border-base-800 pt-3 text-xs">
                <PanelRow icon={<Satellite size={14} />} label="Satellite link" value={awaitingLink ? 'Acquiring…' : 'Live'} live={!awaitingLink} />
                <PanelRow icon={<Radio size={14} />} label="Data flow" value={awaitingLink ? 'Waiting for twin' : 'Active · twin engine'} live={!awaitingLink} />
                <PanelRow icon={<ShieldAlert size={14} />} label="Global insights" value="Anomaly scoring" live />
              </div>
            </div>

            <div className="rounded-2xl border border-base-700/80 bg-base-900/75 p-4 backdrop-blur">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ice-300">
                {GLOBE_SITES[selectedStation as 'BHARATI' | 'MAITRI']?.name ?? 'Station'} · focus
              </p>
              <div className="grid grid-cols-2 gap-2">
                <FocusStat icon={<Thermometer size={12} />} label="Habitat" value={metric(fmt(activeTelemetry?.thermal?.internal_temp_c, 1, '°C'))} />
                <FocusStat icon={<Gauge size={12} />} label="Fuel autonomy" value={metric(fmt(activeTelemetry?.fuel?.days_of_autonomy, 0, ' d'))} />
                <FocusStat icon={<Zap size={12} />} label="Microgrid" value={metric(fmt(activeTelemetry?.microgrid?.total_load_kva, 0, ' kVA'))} />
                <FocusStat icon={<Satellite size={12} />} label="Sat latency" value={metric(fmt(activeTelemetry?.link_status?.latency_ms, 0, ' ms'))} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('fleet')}
                  className="flex-1 rounded-lg bg-gradient-to-r from-ice-600 to-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-glow transition hover:brightness-110"
                >
                  Compare stations
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('polaris:briefing'))}
                  className="flex-1 rounded-lg border border-base-600 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-ice-400/60"
                >
                  Daily briefing
                </button>
              </div>
            </div>
          </aside>
        </section>

        {/* Primary Tab Entry Cards (Telemetry Analytics & Mission Control) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Card 1: Telemetry Analytics */}
          <div
            id="home-cta-analytics"
            onClick={() => onNavigate('analytics')}
            className="group cursor-pointer rounded-2xl glass-panel-glow p-6 transition-all duration-300 hover:scale-[1.02] hover:border-ice-400 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-ice-500/10 rounded-full blur-2xl group-hover:bg-ice-400/20 transition-all pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-ice-600/20 border border-ice-500/40 flex items-center justify-center text-ice-300 group-hover:shadow-glow group-hover:border-ice-300 transition-all">
                <Gauge size={24} />
              </div>
              <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-ice-400 group-hover:text-white transition-colors">
                ENTER ANALYTICS <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-ice-300 transition-colors">
              Telemetry Analytics Tab
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Fuel, microgrid, and thermal traces with a playback scrubber and a 24-hour autonomy outlook.
            </p>

            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">Days of Autonomy</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">Microgrid 600kVA</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">3D Subsystem Sync</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">Thermal IR</span>
            </div>
          </div>

          {/* Card 2: Mission Control */}
          <div
            id="home-cta-mission-control"
            onClick={() => onNavigate('mission-control')}
            className="group cursor-pointer rounded-2xl glass-panel-glow p-6 transition-all duration-300 hover:scale-[1.02] hover:border-ice-400 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-all pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-ice-600/20 border border-ice-500/40 flex items-center justify-center text-ice-300 group-hover:shadow-glow group-hover:border-ice-300 transition-all">
                <Radio size={24} />
              </div>
              <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-ice-400 group-hover:text-white transition-colors">
                LAUNCH MISSION CONTROL <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-ice-300 transition-colors">
              Mission Control State Tab
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Live station twin, SOP actions tied to the regulation text, and a log of what the operator approved.
            </p>

            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">3D Station Twin</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">Isolation Forest ML</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">One-Click SOP Mitigations</span>
              <span className="px-2 py-1 rounded bg-base-900 border border-base-700">Scenario Injection</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto pt-6 border-t border-base-800 text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <div>POLARIS DIGITAL TWIN PLATFORM · NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH (NCPOR)</div>
          <div className="flex items-center gap-3">
            <span>source: synthetic</span>
            <span>·</span>
            <span>confidence: modeled</span>
            <span>·</span>
            <span>SIH 2026</span>
          </div>
        </footer>
        </div>
      </div>
    </div>
  )
}
