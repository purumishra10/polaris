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
  ReferenceLine,
} from 'recharts'
import {
  Fuel,
  Zap,
  Thermometer,
  Database,
  Wind,
  Sun,
  Flame,
  Clock,
  Activity,
  AlertTriangle,
  Info,
} from 'lucide-react'
import TopNav from '../components/TopNav'
import LiveTwinViewport from '../components/LiveTwinViewport'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics') => void
}

interface TelemetryHistoryPoint {
  t: number
  timeStr: string
  internal_temp_c: number
  ambient_temp_c: number
  total_load_kva: number
  essential_load: number
  science_load: number
  comfort_load: number
  heat_loss_kw: number
  chp_thermal_kw: number
  fuel_level_l: number
  burn_rate_lph: number
  wind_knots: number
}

const HISTORY_LIMIT = 30

export default function Analytics({ onNavigate }: Props) {
  const {
    selectedStation,
    telemetry,
  } = usePolarisStore()

  const t = telemetry[selectedStation]
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([])
  const tickRef = useRef(0)

  // Accumulate live historical telemetry data points
  useEffect(() => {
    if (!t) return
    tickRef.current += 1

    const now = new Date()
    const timeStr = `${now.getUTCMinutes().toString().padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')}`

    setHistory((prev) => {
      const nextPoint: TelemetryHistoryPoint = {
        t: tickRef.current,
        timeStr,
        internal_temp_c: Number(t.thermal.internal_temp_c.toFixed(1)),
        ambient_temp_c: Number(t.ambient.temp_c.toFixed(1)),
        total_load_kva: Number(t.microgrid.total_load_kva.toFixed(1)),
        essential_load: Number(t.microgrid.essential_load_kva.toFixed(1)),
        science_load: Number(t.microgrid.science_load_kva.toFixed(1)),
        comfort_load: Number(t.microgrid.comfort_load_kva.toFixed(1)),
        heat_loss_kw: Number(t.thermal.heat_loss_kw.toFixed(1)),
        chp_thermal_kw: Number(t.thermal.chp_thermal_output_kw.toFixed(1)),
        fuel_level_l: Math.round(t.fuel.tank_level_liters),
        burn_rate_lph: Number(t.fuel.burn_rate_lph.toFixed(1)),
        wind_knots: Number(t.ambient.wind_speed_knots.toFixed(1)),
      }
      return [...prev, nextPoint].slice(-HISTORY_LIMIT)
    })
  }, [t?.timestamp])

  // Reset history on station switch to prevent mixed plots
  useEffect(() => {
    setHistory([])
    tickRef.current = 0
  }, [selectedStation])

  const daysRemaining = t?.fuel?.days_of_autonomy ?? 150
  const tankCapacity = 600000 // Liters
  const tankPercent = Math.min(100, Math.max(0, ((t?.fuel?.tank_level_liters ?? 500000) / tankCapacity) * 100))

  return (
    <div className="min-h-screen flex flex-col bg-base-950 text-white">
      {/* Persistent Navigation Header */}
      <TopNav currentTab="analytics" onNavigate={onNavigate} />

      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Operational Status & Integrity Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-base-700 bg-base-900/70 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-ice-400 font-semibold">
              <Activity size={14} /> LIVE ANALYTICS ENGINE
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">Station: <strong className="text-white">{selectedStation}</strong></span>
            <SeverityBadge severity={t?.risk?.severity ?? 'NOMINAL'} score={t?.risk?.anomaly_score} />
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <Database size={13} className="text-ice-400" />
            <span className="px-2 py-0.5 rounded bg-base-800 border border-base-700 text-slate-300">source: synthetic</span>
            <span className="px-2 py-0.5 rounded bg-base-800 border border-base-700 text-slate-300">confidence: modeled</span>
            <span className="px-2 py-0.5 rounded bg-base-800 border border-base-700 text-ice-300">2s ODE physics clock</span>
          </div>
        </div>

        <LiveTwinViewport />

        {/* Hero Countdown & Fuel Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero Days of Autonomy Card */}
          <div className="rounded-2xl border border-base-700 bg-gradient-to-br from-base-900 via-base-900 to-base-850 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-ice-400">
                <Fuel size={20} />
                <h3 className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">
                  Fuel Autonomy Countdown
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                daysRemaining < 15
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                  : daysRemaining < 30
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {daysRemaining < 15 ? 'CRITICAL RESUPPLY' : daysRemaining < 30 ? 'RESUPPLY ADVISORY' : 'NOMINAL BUFFER'}
              </span>
            </div>

            <div className="my-4 text-center">
              <div className="text-5xl sm:text-6xl font-black tracking-tight text-white font-mono">
                {daysRemaining.toFixed(0)}
                <span className="text-2xl font-light text-ice-400 ml-2">DAYS</span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-2">
                ESTIMATED AUTONOMY UNTIL RESUPPLY DRY-RUN
              </p>
            </div>

            {/* Tank Capacity Progress Bar */}
            <div className="space-y-2 pt-4 border-t border-base-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">JET A1 Storage Level</span>
                <span className="text-white font-bold">{t?.fuel?.tank_level_liters?.toLocaleString()} / 600,000 L</span>
              </div>
              <div className="h-3 w-full bg-base-800 rounded-full overflow-hidden border border-base-700">
                <div
                  className={`h-full transition-all duration-500 ${
                    tankPercent < 20 ? 'bg-red-500' : tankPercent < 40 ? 'bg-amber-500' : 'bg-gradient-to-r from-ice-600 to-ice-400'
                  }`}
                  style={{ width: `${tankPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500 pt-1">
                <span>Burn Rate: <strong className="text-ice-300">{t?.fuel?.burn_rate_lph?.toFixed(1)} L/h</strong></span>
                <span>Capacity: <strong>{tankPercent.toFixed(1)}%</strong></span>
              </div>
            </div>
          </div>

          {/* Real-time Fuel Burn Trajectory Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-base-700 bg-base-900 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">
                  Fuel Consumption & Burn Rate Stream
                </h3>
                <p className="text-xs text-slate-400 font-mono">Live L/h burn against base load vs auxiliary heating</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-ice-400">
                  <span className="h-2 w-2 rounded-full bg-ice-400" /> Burn Rate (L/h)
                </span>
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f8fe0" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2f8fe0" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0d12', borderColor: '#2a3344', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="burn_rate_lph" stroke="#5eb8ff" strokeWidth={2} fillOpacity={1} fill="url(#burnGrad)" name="Burn Rate (L/h)" />
                  <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'High Burn Alert (180 L/h)', fill: '#ef4444', fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Microgrid Load & Cogeneration Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Microgrid Load Breakdown (Stacked Area Chart) */}
          <div className="rounded-2xl border border-base-700 bg-base-900 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-amber-400" />
                  <h3 className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">
                    Microgrid Power Load Distribution
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-mono">Essential (180kVA) · Science (120kVA) · Comfort (60-110kVA)</p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-slate-400 block">TOTAL LOAD</span>
                <span className="text-lg font-bold text-white">{t?.microgrid?.total_load_kva?.toFixed(0)} kVA</span>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="essentialGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="scienceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="comfortGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 700]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0d12', borderColor: '#2a3344', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="essential_load" stackId="1" stroke="#3b82f6" fill="url(#essentialGrad)" name="Essential (kVA)" />
                  <Area type="monotone" dataKey="science_load" stackId="1" stroke="#00f0ff" fill="url(#scienceGrad)" name="Science (kVA)" />
                  <Area type="monotone" dataKey="comfort_load" stackId="1" stroke="#818cf8" fill="url(#comfortGrad)" name="Comfort (kVA)" />
                  <ReferenceLine y={600} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'CHP Limit (600 kVA)', fill: '#ef4444', fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Thermal Balance: Internal Temp vs Ambient Dual-Line Trend */}
          <div className="rounded-2xl border border-base-700 bg-base-900 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Thermometer size={18} className="text-ice-400" />
                  <h3 className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">
                    Thermal Envelope & Temp Gradient
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-mono">Habitat Internal Temp vs Extreme Ambient Polar Cold</p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-slate-400 block">HABITAT TEMP</span>
                <span className={`text-lg font-bold ${
                  (t?.thermal?.internal_temp_c ?? 20) < 16 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  {t?.thermal?.internal_temp_c?.toFixed(1)}°C
                </span>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2330" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={[-45, 30]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0d12', borderColor: '#2a3344', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="internal_temp_c" stroke="#34d399" strokeWidth={2.5} dot={false} name="Habitat Temp (°C)" />
                  <Line type="monotone" dataKey="ambient_temp_c" stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Ambient Temp (°C)" />
                  <ReferenceLine y={16} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'SOP Critical Minimum (16°C)', fill: '#ef4444', fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Weather & Cryospheric Conditions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-base-700 bg-base-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Wind size={15} className="text-ice-400" /> ANEMOMETER
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                (t?.ambient?.wind_speed_knots ?? 20) > 60
                  ? 'bg-red-500/20 text-red-300 border border-red-500'
                  : 'bg-base-800 text-slate-400'
              }`}>
                {(t?.ambient?.wind_speed_knots ?? 20) > 60 ? 'BLIZZARD' : 'NORMAL GALE'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {t?.ambient?.wind_speed_knots?.toFixed(1)} <span className="text-sm font-normal text-ice-400">knots</span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">
              Envelope Heat Loss: <strong className="text-slate-300">{t?.thermal?.heat_loss_kw?.toFixed(1)} kW</strong>
            </p>
          </div>

          <div className="rounded-xl border border-base-700 bg-base-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Sun size={15} className="text-amber-400" /> SOLAR FLUX
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-800 text-slate-400">
                {(t?.ambient?.solar_flux_w_m2 ?? 100) < 10 ? 'POLAR NIGHT' : 'DAYLIGHT'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {t?.ambient?.solar_flux_w_m2?.toFixed(1)} <span className="text-sm font-normal text-amber-400">W/m²</span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">
              CHP Heat Recovery: <strong className="text-slate-300">{t?.thermal?.chp_thermal_output_kw?.toFixed(1)} kW</strong>
            </p>
          </div>

          <div className="rounded-xl border border-base-700 bg-base-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Flame size={15} className="text-red-400" /> AUXILIARY HEATING
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                (t?.thermal?.aux_heater_kw ?? 0) > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500'
                  : 'bg-base-800 text-slate-400'
              }`}>
                {(t?.thermal?.aux_heater_kw ?? 0) > 0 ? 'ACTIVE AUX' : 'STANDBY'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {t?.thermal?.aux_heater_kw?.toFixed(1)} <span className="text-sm font-normal text-red-400">kW</span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">
              Aux Generator: <strong className="text-slate-300">{t?.controls?.aux_generator_active ? 'ONLINE' : 'OFFLINE'}</strong>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
