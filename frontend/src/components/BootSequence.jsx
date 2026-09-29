import { useEffect, useState } from 'react'

const LINES = [
  'POLARIS  ·  NCPOR GOA',
  'C-band / LEO handshake',
  'Edge 8001  ·  Bharati lock',
  'Twin 8000  ·  isolation forest',
  'Voice 8002  ·  polar brief',
  'Closed loop established',
]

const STORAGE_KEY = 'polaris-boot-seen'

export default function BootSequence() {
  const [visible, setVisible] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || window.sessionStorage.getItem(STORAGE_KEY) === '1') return undefined
    setVisible(true)
    const timers = LINES.map((_, index) =>
      window.setTimeout(() => setCount(index + 1), 420 * (index + 1)),
    )
    const done = window.setTimeout(() => {
      window.sessionStorage.setItem(STORAGE_KEY, '1')
      setVisible(false)
    }, 420 * LINES.length + 700)
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.clearTimeout(done)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-base-950/92 backdrop-blur-sm">
      <div className="w-[min(440px,92vw)] rounded-2xl border border-ice-500/30 bg-base-900/95 p-6 shadow-glow">
        <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.22em] text-ice-300">
          Initializing
        </p>
        <div className="space-y-1.5 font-mono text-sm text-slate-200">
          {LINES.slice(0, count).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 text-[11px] font-mono text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
