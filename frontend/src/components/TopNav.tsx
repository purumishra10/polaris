import { Compass, Home } from 'lucide-react'

interface TopNavProps {
  title: string
  subtitle?: string
  onHome: () => void
  right?: React.ReactNode
}

export default function TopNav({ title, subtitle, onHome, right }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-base-700 bg-base-900/90 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onHome}
          className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-base-600 text-ice-400 hover:bg-base-800 hover:border-ice-600 transition-colors"
          title="Back to home"
        >
          <Home size={18} />
        </button>
        <Compass className="text-ice-400 shrink-0" size={20} />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold tracking-wide truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </header>
  )
}
