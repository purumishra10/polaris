import type { Severity } from '../lib/types'

const styles: Record<Severity, string> = {
  NOMINAL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  ADVISORY: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/50 animate-pulse-red',
}

export default function SeverityBadge({ severity, score }: { severity: Severity; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide ${styles[severity]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
      {score !== undefined && <span className="opacity-70 font-normal">· score {score.toFixed(2)}</span>}
    </span>
  )
}
