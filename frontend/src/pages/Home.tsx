import { useState, useEffect, useRef } from 'react'
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
  CheckCircle2,
} from 'lucide-react'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'

interface HomeProps {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

export default function Home({ onNavigate }: HomeProps) {
  const { telemetry, selectedStation, setSelectedStation } = usePolarisStore()
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

  return (
    <div className="relative min-h-screen flex flex-col bg-base-950 text-white overflow-hidden">
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
      <div className="relative z-10 flex-1 flex flex-col px-4 sm:px-8 md:px-12 py-8 max-w-7xl mx-auto w-full">
        {/* Hero Header */}
        <div className="mb-10 text-center md:text-left pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ice-600/20 border border-ice-400/40 text-ice-300 text-xs font-mono font-semibold tracking-wider mb-4 shadow-glow">
            <Snowflake size={14} className="animate-spin-slow text-ice-300" />
            <span>NCPOR ANTARCTIC MISSION CONTROL</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4 leading-tight">
            POLARIS <span className="text-transparent bg-clip-text bg-gradient-to-r from-ice-300 via-ice-400 to-neon-cyan">DIGITAL TWIN</span>
          </h1>

          <p className="text-slate-300 max-w-3xl text-base sm:text-lg leading-relaxed mb-6 font-light">
            Next-generation autonomous twin and remote command center for Indian Antarctic Research Stations
            (<strong className="text-white font-medium">Bharati</strong> and <strong className="text-white font-medium">Maitri</strong>). Real-time telemetry ingestion,
            machine-learning anomaly scoring via Isolation Forest, and closed-loop satellite SOP mitigation.
          </p>

          {/* Quick Metrics Ticker */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            <div className="glass-card p-3 rounded-xl border border-ice-500/30">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Thermometer size={13} className="text-ice-400" /> HABITAT TEMP
              </span>
              <p className="text-lg font-bold text-white mt-1">
                {activeTelemetry?.thermal?.internal_temp_c?.toFixed(1) ?? '20.5'}°C
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl border border-ice-500/30">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Gauge size={13} className="text-ice-400" /> FUEL AUTONOMY
              </span>
              <p className="text-lg font-bold text-white mt-1">
                {activeTelemetry?.fuel?.days_of_autonomy?.toFixed(0) ?? '154'} DAYS
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl border border-ice-500/30">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Wind size={13} className="text-ice-400" /> WIND SPEED
              </span>
              <p className="text-lg font-bold text-white mt-1">
                {activeTelemetry?.ambient?.wind_speed_knots?.toFixed(1) ?? '22.0'} kt
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl border border-ice-500/30">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Satellite size={13} className="text-ice-400" /> SAT LATENCY
              </span>
              <p className="text-lg font-bold text-ice-300 mt-1">
                {activeTelemetry?.link_status?.latency_ms ?? 480} ms
              </p>
            </div>
          </div>
        </div>

        {/* Station Selection Banner */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase font-mono tracking-widest text-slate-400">
              ACTIVE ANTARCTIC NODES (3,100 KM SEPARATION)
            </h2>
            <span className="text-xs font-mono text-ice-400 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE TELEMETRY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bharati Station Card */}
            <div
              onClick={() => setSelectedStation('BHARATI')}
              className={`cursor-pointer rounded-2xl p-5 transition-all border ${
                selectedStation === 'BHARATI'
                  ? 'glass-panel-glow border-ice-400/80 bg-base-900/90'
                  : 'glass-card border-base-700/80 hover:border-ice-600/60 bg-base-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">BHARATI STATION</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ice-600/30 text-ice-300 border border-ice-500/40">
                      PRIMARY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">Coastal Promontory · 69°24'S, 76°11'E · Larsemann Hills</p>
                </div>
                <SeverityBadge severity={telemetry.BHARATI?.risk?.severity || 'NOMINAL'} />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-base-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">MICROGRID</span>
                  <span className="text-white font-semibold">
                    {telemetry.BHARATI?.microgrid?.total_load_kva?.toFixed(0) || '480'} kVA
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">AMBIENT</span>
                  <span className="text-white font-semibold">
                    {telemetry.BHARATI?.ambient?.temp_c?.toFixed(1) || '-16.4'}°C
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ANOMALY SCORE</span>
                  <span className="text-ice-400 font-semibold">
                    {telemetry.BHARATI?.risk?.anomaly_score?.toFixed(3) || '+0.062'}
                  </span>
                </div>
              </div>
            </div>

            {/* Maitri Station Card */}
            <div
              onClick={() => setSelectedStation('MAITRI')}
              className={`cursor-pointer rounded-2xl p-5 transition-all border ${
                selectedStation === 'MAITRI'
                  ? 'glass-panel-glow border-ice-400/80 bg-base-900/90'
                  : 'glass-card border-base-700/80 hover:border-ice-600/60 bg-base-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">MAITRI STATION</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      STANDBY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">Inland Oasis · 70°46'S, 11°44'E · Schirmacher Oasis</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-base-800 text-slate-400 border border-base-700">
                  Default: Bharati
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-base-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">STATUS</span>
                  <span className="text-amber-400 font-semibold">UNOPERATIONAL</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">LAKE</span>
                  <span className="text-slate-300 font-semibold">Priyadarshini</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">UPLINK</span>
                  <span className="text-slate-400 font-semibold">STANDBY LINK</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
              Comprehensive operational telemetry dashboard with embedded 3D spatial twin:
              fuel consumption trajectory, microgrid load breakdown (Essential vs Science vs Comfort),
              habitat thermal dissipation curves, and cryospheric weather indices.
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
              Interactive 3D digital twin viewport with subsystem hotspot pins, real-time Isolation Forest
              anomaly detection header, emergency SOP prescriptive mitigation drawer (one-click actuator execution),
              and disaster scenario injection for hackathon demonstrations.
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
  )
}
