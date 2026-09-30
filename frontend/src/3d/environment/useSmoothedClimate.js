import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

import { usePolarisStore } from '../../store/usePolarisStore'
import { climateLook } from '../../lib/climateLook'

// Per-second easing rates. Wind picks up quickly (a blizzard "hits"),
// light fades more slowly (night "falls"), temperature sits in between.
const RATES = {
  temp: 0.8,
  wind: 1.25,
  solar: 0.55,
  locked: 2.2,
}

const EPSILON = {
  temp: 0.02,
  wind: 0.02,
  solar: 0.15,
  locked: 0.005,
}

/** Only React-rerender when the look would visibly change. */
const PUBLISH = {
  temp: 0.4,
  wind: 0.8,
  solar: 4,
  locked: 0.08,
}

function readDrivers(telemetry) {
  return {
    temp: telemetry?.ambient?.temp_c ?? -14,
    wind: telemetry?.ambient?.wind_speed_knots ?? 18,
    solar: telemetry?.ambient?.solar_flux_w_m2 ?? 120,
    locked: telemetry?.lockouts?.outdoor === 'LOCKED' ? 1 : 0,
  }
}

/**
 * Eases ambient telemetry for the scene look. Must be used inside R3F Canvas.
 * Smooths every frame in a ref; React state only updates when values move enough
 * to change lighting / snow / fog — avoids full environment re-renders at 60 Hz.
 */
export function useSmoothedClimate(station) {
  const telemetry = usePolarisStore((state) => state.telemetry[station])
  const goal = readDrivers(telemetry)
  const current = useRef({ ...goal })
  const published = useRef({ ...goal })
  const [drivers, setDrivers] = useState(() => ({ ...goal }))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const cur = current.current
    let moved = false

    for (const key of Object.keys(goal)) {
      const diff = goal[key] - cur[key]
      if (Math.abs(diff) <= EPSILON[key]) {
        if (cur[key] !== goal[key]) {
          cur[key] = goal[key]
          moved = true
        }
        continue
      }
      cur[key] += diff * (1 - Math.exp(-dt * RATES[key]))
      moved = true
    }

    if (!moved) return

    const pub = published.current
    let publish = false
    for (const key of Object.keys(cur)) {
      if (Math.abs(cur[key] - pub[key]) >= PUBLISH[key]) {
        publish = true
        break
      }
    }
    if (!publish) return

    const next = { ...cur }
    published.current = next
    setDrivers(next)
  })

  return climateLook(telemetry, station, drivers)
}
