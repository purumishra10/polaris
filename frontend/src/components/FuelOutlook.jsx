export default function FuelOutlook({ days = 0, burnLph = 0 }) {
  const span = Math.max(40, Number(days) || 0, 30)
  const pct = (value) => `${Math.max(0, Math.min(100, (value / span) * 100))}%`
  const ahead = Math.max(0, (Number(days) || 0) - 1)
  const inside = (Number(days) || 0) <= 15

  return (
    <div className="mt-4 border-t border-base-800 pt-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wide text-slate-500">
        <span>24-hour fuel outlook</span>
        <span>{Number(burnLph).toFixed(0)} L/h</span>
      </div>
      <div className="relative h-2 rounded-full bg-base-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-red-500/80" style={{ width: pct(15) }} />
        <div
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-white"
          style={{ left: pct(days) }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-500">
        <span>0</span>
        <span>15-day floor</span>
        <span>{Math.round(span)} d</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {inside
          ? 'Already inside the 15-day floor. Shed science load before the next sea window.'
          : `24h ahead: ${ahead.toFixed(0)} days. The 15-day floor is ${(days - 15).toFixed(0)} days out at this burn.`}
      </p>
    </div>
  )
}
