import { useEffect, useRef, useState } from 'react'

export default function LiveValue({ value, digits = 1, suffix = '' }) {
  const numeric = Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  const [shown, setShown] = useState(safe)
  const shownRef = useRef(safe)

  useEffect(() => {
    const start = shownRef.current
    const delta = safe - start
    if (Math.abs(delta) < 1e-4) {
      shownRef.current = safe
      setShown(safe)
      return undefined
    }
    const t0 = performance.now()
    const dur = 380
    let frame
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur)
      const next = start + delta * (1 - (1 - k) * (1 - k))
      shownRef.current = next
      setShown(next)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [safe])

  return (
    <>
      {shown.toFixed(digits)}
      {suffix}
    </>
  )
}
