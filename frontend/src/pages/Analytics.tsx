import { useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Fuel, Zap, Thermometer, Database } from 'lucide-react'
import TopNav from '../components/TopNav'
import { usePolarisStore } from '../store/usePolarisStore'
import type { TelemetryHistoryPoint } from '../lib/types'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

const HISTORY_LIMIT = 40

export default function Analytics({ onNavigate }: Props) {
  const { selectedStation, setSelectedStation, telemetry } = usePolarisStore()
  const t = telemetry[selectedStation]
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([])
  const tickRef = useRef(0)

  useEffect(() => {
    if (!t) return
    tickRef.current += 1
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          t: tickRef.current,
          internal_temp_c: t.thermal.internal_temp_c,
          ambient_temp_c: t.ambient.temp_c,
          total_load_kva: t.microgrid.total_load_kva,
          fuel_level: t.fuel.tank_level_liters,
        },
      ]
      return next.slice(-HISTORY_LIMIT)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.timestamp])

  // reset history when switching station so the chart doesn't mix stations
  useEffect(() => {
    setHistory([])
    tickRef.current = 0
  }, [selectedStation])

  const microgridData = t
    ? [
        {
          name: 'Load',
          Essential: t.microgrid.essential_load_kva,
          Science: t.microgrid.science_load_kva,
          Comfort: t.microgrid.comfort_load_kva,
        },
      ]
    : []

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav
        title="Telemetry Analytics"
        subtitle="Fuel · Microgrid · Thermal Dissipation"
        onHome={() => onNavigate('home')}
        right={
          <div className="flex rounded-lg border border-base-600 overflow-hidden">
            {(['BHARATI', 'MAITRI'] as const).map((st) => (
              <button
                key={st}
                id={`analytics-station-${st.toLowerCase()}`}
                onClick={() => st === 'BHARATI' && setSelectedStation(st)}
                disabled={st === 'MAITRI'}
                className={`px-3 py-1.5 text-xs font-medium ${
                  selectedStation === st ? 'bg-ice-600 text-white' : 'bg-base-800 text-slate-400'
                } ${st === 'MAITRI' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {st === 'BHARATI' ? 'Bharati' : 'Maitri'}
              </button>
            ))}
          </div>
        }
      />

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Data integrity strip */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Database size={13} className="text-ice-400" />
          <span className="px-2 py-0.5 rounded-full bg-base-800 border border-base-600">source: synthetic</span>
          <span className="px-2 py-0.5 rounded-full bg-base-800 border border-base-600">confidence: modeled</span>
        </div>

        {!t ? (
          <div className="rounded-2xl border border-base-700 bg-base-900 p-10 text-center text-slate-500 animate-pulse">
            Waiting for first telemetry frame from {selectedStation}…
          </div>
        ) : (
          <>
            {/* Fuel & autonomy hero */}
            <div className="rounded-2xl border border-base-700 bg-gradient-to-br from-base-900 to-base-850 p-6">
              <div className="flex items-center gap-2 mb-1">
                <Fuel size={18} className="text-ice-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Days of Autonomy Remaining
                </h2>
              </div>
              <div className="flex items-end gap-4 flex-wrap">
                <p className="text-5xl font-bold text-ice-400 tabular-nums">
                  {t.fuel.days_of_autonomy.toFixed(1)}
                  <span className="text-lg text-slate-500 font-normal ml-1">days</span>
                </p>
                <div className="text-sm text-slate-400 pb-2 space-y-0.5">
                  <p>
                    Tank level: <span className="text-slate-200 font-medium">{t.fuel.tank_level_liters.toLocaleString()} L</span>
                  </p>
                  <p>
                    Burn rate: <span className="text-slate-200 font-medium">{t.fuel.burn_rate_lph.toFixed(1)} L/h</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f8fe0" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#2f8fe0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" />
                    <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1c2330' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1c2330' }} width={70} />
                    <Tooltip contentStyle={{ background: '#0e1218', border: '1px solid #2a3344', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="fuel_level" stroke="#2f8fe0" fill="url(#fuelGrad)" name="Fuel (L)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Microgrid breakdown */}
              <div className="rounded-2xl border border-base-700 bg-base-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-ice-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Microgrid Load Breakdown
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Total {t.microgrid.total_load_kva} kVA against {t.microgrid.chp_capacity_kva} kVA CHP rated
                  threshold
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={microgridData} layout="vertical" barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, t.microgrid.chp_capacity_kva]}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#1c2330' }}
                      />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip contentStyle={{ background: '#0e1218', border: '1px solid #2a3344', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Essential" stackId="a" fill="#2f8fe0" />
                      <Bar dataKey="Science" stackId="a" fill="#5eb8ff" />
                      <Bar dataKey="Comfort" stackId="a" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  CHP thermal cogeneration output: {t.thermal.chp_thermal_output_kw} kW
                </p>
              </div>

              {/* Thermal dissipation */}
              <div className="rounded-2xl border border-base-700 bg-base-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Thermometer size={16} className="text-ice-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Thermal Envelope Efficiency
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Wind {t.ambient.wind_speed_knots.toFixed(0)} kt · Solar flux {t.ambient.solar_flux_w_m2} W/m² ·
                  Heat loss {t.thermal.heat_loss_kw} kW
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" />
                      <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1c2330' }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1c2330' }} width={40} />
                      <Tooltip contentStyle={{ background: '#0e1218', border: '1px solid #2a3344', borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="internal_temp_c" stroke="#5eb8ff" dot={false} name="Internal °C" strokeWidth={2} />
                      <Line type="monotone" dataKey="ambient_temp_c" stroke="#f87171" dot={false} name="Ambient °C" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
