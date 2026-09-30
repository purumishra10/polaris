import TopNav from '../components/TopNav'
import { usePolarisStore } from '../store/usePolarisStore'
import SeverityBadge from '../components/SeverityBadge'

interface Props {
  onNavigate: (route: 'home' | 'mission-control' | 'analytics' | 'fleet') => void
}

const ROWS = [
  {
    label: 'Severity',
    read: (t: any) => t?.risk?.severity ?? 'NOMINAL',
  },
  {
    label: 'Habitat',
    read: (t: any) => `${Number(t?.thermal?.internal_temp_c ?? 0).toFixed(1)} °C`,
  },
  {
    label: 'Ambient',
    read: (t: any) => `${Number(t?.ambient?.temp_c ?? 0).toFixed(1)} °C`,
  },
  {
    label: 'Wind',
    read: (t: any) => `${Number(t?.ambient?.wind_speed_knots ?? 0).toFixed(1)} kt`,
  },
  {
    label: 'Fuel',
    read: (t: any) => `${Number(t?.fuel?.days_of_autonomy ?? 0).toFixed(0)} days`,
  },
  {
    label: 'Load',
    read: (t: any) => `${Number(t?.microgrid?.total_load_kva ?? 0).toFixed(0)} kVA`,
  },
  {
    label: 'Link',
    read: (t: any) => `${t?.link_status?.latency_ms ?? '—'} ms`,
  },
]

function deltaLine(bharati: any, maitri: any) {
  const warm =
    Number(bharati?.ambient?.temp_c ?? 0) - Number(maitri?.ambient?.temp_c ?? 0)
  const fuel =
    Number(bharati?.fuel?.days_of_autonomy ?? 0) -
    Number(maitri?.fuel?.days_of_autonomy ?? 0)
  const warmer = warm >= 0 ? 'Bharati' : 'Maitri'
  const longer = fuel >= 0 ? 'Bharati' : 'Maitri'
  return `${warmer} is ${Math.abs(warm).toFixed(1)}°C warmer outside. ${longer} has ${Math.abs(fuel).toFixed(0)} more days of fuel.`
}

export default function Fleet({ onNavigate }: Props) {
  const { telemetry, selectedStation, setSelectedStation } = usePolarisStore()
  const bharati = telemetry.BHARATI
  const maitri = telemetry.MAITRI

  return (
    <div className="min-h-screen bg-base-950 text-white">
      <TopNav currentTab="fleet" onNavigate={onNavigate} />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-ice-300">
              Fleet overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Bharati and Maitri</h1>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-slate-400">
            One edge link is live at a time. The other column keeps the last packet received at Goa.
          </p>
        </div>

        <p className="rounded-xl border border-base-700 bg-base-900 px-4 py-3 text-sm text-slate-200">
          {deltaLine(bharati, maitri)}
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['BHARATI', 'MAITRI'] as const).map((id) => {
            const packet = telemetry[id]
            const active = selectedStation === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedStation(id)}
                className={`rounded-2xl border p-4 text-left ${
                  active
                    ? 'border-ice-400/70 bg-base-900'
                    : 'border-base-700 bg-base-900/60'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold tracking-wide">{id}</span>
                  <SeverityBadge
                    severity={(packet?.risk?.severity || 'NOMINAL') as 'NOMINAL' | 'ADVISORY' | 'CRITICAL'}
                  />
                </div>
                <dl className="space-y-2">
                  {ROWS.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <dt className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                        {row.label}
                      </dt>
                      <dd className="font-mono text-slate-100">{row.read(packet)}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
