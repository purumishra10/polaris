import { useEffect, useState } from 'react'
import { Radio, Thermometer, Gauge, ArrowRight, Snowflake } from 'lucide-react'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'

interface HomeProps {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

export default function Home({ onNavigate }: HomeProps) {
  const telemetry = usePolarisStore((s) => s.telemetry)
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-base-700">
        <div className="flex items-center gap-3">
          <Snowflake className="text-ice-400" size={26} />
          <div>
            <h1 className="text-lg font-bold tracking-wide">POLARIS</h1>
            <p className="text-xs text-slate-400">Digital Twin · Indian Antarctic Research Stations</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400">NCPOR Goa · UTC {clock.toUTCString().slice(17, 25)}</p>
          <p className="text-xs text-slate-500">SIH 2026 · PS 26060</p>
        </div>
      </header>

      <main className="flex-1 px-6 sm:px-10 py-10 max-w-6xl mx-auto w-full">
        <div className="mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            Command Center <span className="text-ice-400">Home</span>
          </h2>
          <p className="text-slate-400 max-w-2xl text-sm sm:text-base">
            Remote monitoring platform for Bharati and Maitri stations — microgrid load, thermal balance,
            fuel autonomy and cryospheric anomaly detection, streamed over the satellite uplink.
          </p>
        </div>

        {/* Live station snapshot strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {(['BHARATI', 'MAITRI'] as const).map((station) => {
            const t = telemetry[station]
            return (
              <div key={station} className="rounded-xl border border-base-700 bg-base-900 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      {station === 'BHARATI' ? 'Coastal Promontory' : 'Inland Oasis'}
                    </p>
                    <h3 className="text-base font-semibold">{station}</h3>
                  </div>
                  {t ? (
                    <SeverityBadge severity={t.risk.severity} />
                  ) : (
                    <span className="text-xs text-slate-500 animate-pulse">Connecting…</span>
                  )}
                </div>
                {t ? (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Thermometer size={15} className="text-ice-400" />
                      <span>{t.thermal.internal_temp_c.toFixed(1)}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge size={15} className="text-ice-400" />
                      <span>{t.fuel.days_of_autonomy.toFixed(0)}d fuel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Radio size={15} className="text-ice-400" />
                      <span>{t.link_status.latency_ms}ms</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-5 bg-base-800 rounded animate-pulse" />
                )}
              </div>
            )
          })}
        </div>

        {/* Dashboard entry points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            id="nav-mission-control"
            onClick={() => onNavigate('mission-control')}
            className="group text-left rounded-2xl border border-base-700 bg-gradient-to-br from-base-900 to-base-850 p-6 hover:border-ice-600 hover:shadow-glow transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="h-11 w-11 rounded-xl bg-ice-600/15 border border-ice-600/40 flex items-center justify-center">
                <Radio className="text-ice-400" size={20} />
              </span>
              <ArrowRight className="text-slate-500 group-hover:text-ice-400 group-hover:translate-x-1 transition-all" size={18} />
            </div>
            <h3 className="text-lg font-semibold mb-1">Mission Control</h3>
            <p className="text-sm text-slate-400">
              3D station twin, satellite link health, anomaly alerts, prescriptive mitigation actions and
              scenario injection for pitch demos.
            </p>
          </button>

          <button
            id="nav-analytics"
            onClick={() => onNavigate('analytics')}
            className="group text-left rounded-2xl border border-base-700 bg-gradient-to-br from-base-900 to-base-850 p-6 hover:border-ice-600 hover:shadow-glow transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="h-11 w-11 rounded-xl bg-ice-600/15 border border-ice-600/40 flex items-center justify-center">
                <Gauge className="text-ice-400" size={20} />
              </span>
              <ArrowRight className="text-slate-500 group-hover:text-ice-400 group-hover:translate-x-1 transition-all" size={18} />
            </div>
            <h3 className="text-lg font-semibold mb-1">Telemetry Analytics</h3>
            <p className="text-sm text-slate-400">
              Fuel &amp; autonomy gauges, microgrid load breakdown, thermal dissipation charts and data
              integrity indicators.
            </p>
          </button>
        </div>
      </main>

      <footer className="px-6 sm:px-10 py-4 border-t border-base-700 text-xs text-slate-600 text-center">
        Polaris Command Center · Synthetic telemetry · confidence: modeled
      </footer>
    </div>
  )
}
