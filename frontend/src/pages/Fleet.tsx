import type { ReactNode } from 'react'
import { Fuel, Gauge, Radio, Satellite, Scale, Thermometer, Wind, Zap } from 'lucide-react'
import TopNav from '../components/TopNav'
import { useShallow } from 'zustand/react/shallow'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'
import AntarcticGlobe from '../components/AntarcticGlobe'
import { GLOBE_SITES } from '../lib/stationSites'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics' | 'fleet') => void
}

type StationId = 'BHARATI' | 'MAITRI'

interface Metric {
  key: string
  label: string
  icon: ReactNode
  unit: string
  digits: number
  read: (t: any) => number | undefined
  max: (t: any) => number
  better: 'higher' | 'lower'
  magnitude?: boolean
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

const METRICS: Metric[] = [
  {
    key: 'habitat',
    label: 'Habitat',
    icon: <Thermometer size={13} />,
    unit: '°C',
    digits: 1,
    read: (t) => num(t?.thermal?.internal_temp_c),
    max: () => 25,
    better: 'higher',
  },
  {
    key: 'ambient',
    label: 'Ambient',
    icon: <Thermometer size={13} />,
    unit: '°C',
    digits: 1,
    read: (t) => num(t?.ambient?.temp_c),
    max: () => 45,
    better: 'higher',
    magnitude: true,
  },
  {
    key: 'wind',
    label: 'Wind',
    icon: <Wind size={13} />,
    unit: ' kt',
    digits: 1,
    read: (t) => num(t?.ambient?.wind_speed_knots),
    max: () => 80,
    better: 'lower',
  },
  {
    key: 'fuel',
    label: 'Fuel autonomy',
    icon: <Fuel size={13} />,
    unit: ' d',
    digits: 0,
    read: (t) => num(t?.fuel?.days_of_autonomy),
    max: () => 180,
    better: 'higher',
  },
  {
    key: 'load',
    label: 'Microgrid load',
    icon: <Zap size={13} />,
    unit: ' kVA',
    digits: 0,
    read: (t) => num(t?.microgrid?.total_load_kva),
    max: (t) => num(t?.microgrid?.chp_capacity_kva) ?? 750,
    better: 'lower',
  },
  {
    key: 'link',
    label: 'Link latency',
    icon: <Satellite size={13} />,
    unit: ' ms',
    digits: 0,
    read: (t) => num(t?.link_status?.latency_ms),
    max: () => 1000,
    better: 'lower',
  },
]

function fmt(value: number | undefined, digits: number, unit: string) {
  return value === undefined ? '—' : `${value.toFixed(digits)}${unit}`
}

function winner(metric: Metric, b: number | undefined, m: number | undefined): StationId | null {
  if (b === undefined || m === undefined) return null
  if (Math.abs(b - m) < 10 ** -metric.digits) return null
  const bharatiBetter = metric.better === 'higher' ? b > m : b < m
  return bharatiBetter ? 'BHARATI' : 'MAITRI'
}

function insights(bharati: any, maitri: any) {
  const out: { icon: ReactNode; text: string }[] = []
  const bt = num(bharati?.ambient?.temp_c)
  const mt = num(maitri?.ambient?.temp_c)
  if (bt !== undefined && mt !== undefined) {
    const d = bt - mt
    out.push({
      icon: <Thermometer size={14} />,
      text:
        Math.abs(d) < 0.1
          ? 'Both stations read the same outside temperature.'
          : `${d > 0 ? 'Bharati' : 'Maitri'} is ${Math.abs(d).toFixed(1)}°C warmer outside.`,
    })
  }
  const bf = num(bharati?.fuel?.days_of_autonomy)
  const mf = num(maitri?.fuel?.days_of_autonomy)
  if (bf !== undefined && mf !== undefined) {
    const d = Math.round(bf) - Math.round(mf)
    out.push({
      icon: <Fuel size={14} />,
      text:
        d === 0
          ? `Level on fuel: both hold about ${Math.round(bf)} days of autonomy.`
          : `${d > 0 ? 'Bharati' : 'Maitri'} has ${Math.abs(d)} more days of fuel.`,
    })
  }
  const bw = num(bharati?.ambient?.wind_speed_knots)
  const mw = num(maitri?.ambient?.wind_speed_knots)
  if (bw !== undefined && mw !== undefined) {
    const d = bw - mw
    out.push({
      icon: <Wind size={14} />,
      text:
        Math.abs(d) < 0.5
          ? 'Wind is similar at both sites.'
          : `${d > 0 ? 'Bharati' : 'Maitri'} is ${Math.abs(d).toFixed(1)} kt windier.`,
    })
  }
  const bl = num(bharati?.microgrid?.total_load_kva)
  const ml = num(maitri?.microgrid?.total_load_kva)
  if (bl !== undefined && ml !== undefined) {
    const d = bl - ml
    out.push({
      icon: <Zap size={14} />,
      text:
        Math.abs(d) < 1
          ? 'Microgrid load is matched across the fleet.'
          : `${d > 0 ? 'Bharati' : 'Maitri'} draws ${Math.abs(d).toFixed(0)} kVA more.`,
    })
  }
  return out
}

function Ring({ value, max, color, label, text }: { value?: number; max: number; color: string; label: string; text: string }) {
  const pct = value === undefined ? 0 : Math.max(0, Math.min(1, value / max))
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="-mt-11 mb-5 font-mono text-[11px] font-bold text-white">{text}</span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  )
}

function StationPanel({ id, data, active, onSelect }: { id: StationId; data: any; active: boolean; onSelect: () => void }) {
  const site = GLOBE_SITES[id]
  const fuel = num(data?.fuel?.days_of_autonomy)
  const load = num(data?.microgrid?.total_load_kva)
  const cap = num(data?.microgrid?.chp_capacity_kva) ?? 750
  const latency = num(data?.link_status?.latency_ms)

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-base-900/80 p-5 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5"
      style={{
        borderColor: active ? `${site.color}b3` : 'rgba(30,45,69,0.9)',
        boxShadow: active ? `0 0 0 1px ${site.color}40, 0 24px 60px -24px ${site.color}88` : undefined,
      }}
    >
      <span
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: site.color }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: site.color, boxShadow: `0 0 12px ${site.color}` }} />
            <span className="text-lg font-black tracking-wide text-white">{site.name.toUpperCase()}</span>
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
            {site.region} · {Math.abs(site.lat).toFixed(2)}°S {site.lon.toFixed(2)}°E
          </span>
        </div>
        <SeverityBadge severity={data?.risk?.severity || 'NOMINAL'} />
      </div>

      <div className="relative mt-5 flex items-end justify-between">
        <div>
          <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">Outside</span>
          <span className="text-5xl font-black tabular-nums leading-none text-white">
            {fmt(num(data?.ambient?.temp_c), 1, '°')}
          </span>
        </div>
        <div className="text-right">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">Habitat</span>
          <span className="text-2xl font-bold tabular-nums text-emerald-300">
            {fmt(num(data?.thermal?.internal_temp_c), 1, '°C')}
          </span>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-3 gap-2 border-t border-base-800 pt-4">
        <Ring value={fuel} max={180} color={site.color} label="Fuel" text={fmt(fuel, 0, 'd')} />
        <Ring value={load} max={cap} color="#a78bfa" label="Load" text={load === undefined ? '—' : `${Math.round((load / cap) * 100)}%`} />
        <Ring
          value={latency === undefined ? undefined : 1000 - latency}
          max={1000}
          color="#34d399"
          label="Link"
          text={fmt(latency, 0, '')}
        />
      </div>

      <div className="relative mt-auto flex items-center justify-between pt-4 font-mono text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Wind size={11} /> {fmt(num(data?.ambient?.wind_speed_knots), 1, ' kt')}
        </span>
        <span className="flex items-center gap-1.5">
          <Gauge size={11} /> score {fmt(num(data?.risk?.anomaly_score), 3, '')}
        </span>
        <span className="flex items-center gap-1.5">
          <Radio size={11} /> {data?.link_status?.type ?? 'link'}
        </span>
      </div>
    </button>
  )
}

function ButterflyRow({ metric, bharati, maitri }: { metric: Metric; bharati: any; maitri: any }) {
  const b = metric.read(bharati)
  const m = metric.read(maitri)
  const win = winner(metric, b, m)
  const width = (v: number | undefined, t: any) => {
    if (v === undefined) return 0
    const base = metric.magnitude ? Math.abs(v) : v
    return Math.max(2, Math.min(100, (base / metric.max(t)) * 100))
  }
  const bar = (id: StationId, v: number | undefined, t: any) => {
    const color = GLOBE_SITES[id].color
    const lead = win === id
    return (
      <div className={`flex items-center gap-2 ${id === 'BHARATI' ? 'flex-row-reverse' : ''}`}>
        <div className={`relative h-2.5 flex-1 overflow-hidden rounded-full bg-base-800 ${id === 'BHARATI' ? 'rotate-180' : ''}`}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${width(v, t)}%`,
              background: `linear-gradient(90deg, ${color}66, ${color})`,
              boxShadow: lead ? `0 0 12px ${color}` : undefined,
            }}
          />
        </div>
        <span className={`w-20 font-mono text-xs tabular-nums ${id === 'BHARATI' ? 'text-right' : 'text-left'} ${lead ? 'font-bold text-white' : 'text-slate-400'}`}>
          {fmt(v, metric.digits, metric.unit)}
        </span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[1fr_130px_1fr] items-center gap-3 py-2">
      {bar('BHARATI', b, bharati)}
      <span className="flex items-center justify-center gap-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="text-ice-400">{metric.icon}</span>
        {metric.label}
      </span>
      {bar('MAITRI', m, maitri)}
    </div>
  )
}

export default function Fleet({ onNavigate }: Props) {
  const { telemetry, selectedStation, setSelectedStation } = usePolarisStore(
    useShallow((s: any) => ({
      telemetry: s.telemetry,
      selectedStation: s.selectedStation,
      setSelectedStation: s.setSelectedStation,
    })),
  )
  const bharati = telemetry.BHARATI
  const maitri = telemetry.MAITRI
  const wins = METRICS.reduce(
    (acc, metric) => {
      const w = winner(metric, metric.read(bharati), metric.read(maitri))
      if (w) acc[w] += 1
      return acc
    },
    { BHARATI: 0, MAITRI: 0 } as Record<StationId, number>,
  )

  return (
    <div className="min-h-screen bg-base-950 text-white">
      <TopNav currentTab="fleet" onNavigate={onNavigate} />
      <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ice-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Fleet overview
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              <span style={{ color: GLOBE_SITES.BHARATI.color }}>Bharati</span>
              <span className="mx-3 text-slate-600">vs</span>
              <span style={{ color: GLOBE_SITES.MAITRI.color }}>Maitri</span>
            </h1>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-slate-400">
            One edge link is live at a time. The other station keeps the last packet received at Goa.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
          <StationPanel id="BHARATI" data={bharati} active={selectedStation === 'BHARATI'} onSelect={() => setSelectedStation('BHARATI')} />
          <AntarcticGlobe
            className="order-first min-h-[420px] lg:col-span-2 xl:order-none xl:col-span-1"
            selected={selectedStation}
            telemetry={telemetry}
            onSelect={setSelectedStation}
          />
          <StationPanel id="MAITRI" data={maitri} active={selectedStation === 'MAITRI'} onSelect={() => setSelectedStation('MAITRI')} />
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-base-700/80 bg-base-900/70 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                <Scale size={14} className="text-ice-400" /> Head to head
              </span>
              <span className="flex items-center gap-3 font-mono text-[11px]">
                <span style={{ color: GLOBE_SITES.BHARATI.color }}>Bharati leads {wins.BHARATI}</span>
                <span className="text-slate-600">·</span>
                <span style={{ color: GLOBE_SITES.MAITRI.color }}>Maitri leads {wins.MAITRI}</span>
              </span>
            </div>
            <div className="divide-y divide-base-800/70">
              {METRICS.map((metric) => (
                <ButterflyRow key={metric.key} metric={metric} bharati={bharati} maitri={maitri} />
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] text-slate-500">
              Glowing bar marks the better reading: warmer, calmer, more fuel, lighter load, faster link.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-base-700/80 bg-base-900/70 p-5 backdrop-blur">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              What differs right now
            </span>
            {insights(bharati, maitri).map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-base-700/70 bg-base-950/50 px-3.5 py-3 text-sm text-slate-200"
              >
                <span className="mt-0.5 text-ice-300">{item.icon}</span>
                {item.text}
              </div>
            ))}
            <div className="mt-auto flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="flex-1 rounded-xl bg-gradient-to-r from-ice-600 to-sky-500 px-3 py-2.5 text-xs font-semibold text-white shadow-glow transition hover:brightness-110"
              >
                Open analytics
              </button>
              <button
                type="button"
                onClick={() => onNavigate('mission-control')}
                className="flex-1 rounded-xl border border-base-600 px-3 py-2.5 text-xs font-semibold text-slate-100 transition hover:border-ice-400/60"
              >
                Mission control
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
