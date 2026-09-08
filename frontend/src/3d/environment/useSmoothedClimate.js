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

function readDrivers(telemetry) {
  return {
    temp: telemetry?.ambient?.temp_c ?? -14,
    wind: telemetry?.ambient?.wind_speed_knots ?? 18,
    solar: telemetry?.ambient?.solar_flux_w_m2 ?? 120,
    locked: telemetry?.lockouts?.outdoor === 'LOCKED' ? 1 : 0,
  }
}

/**
 * Eases the ambient telemetry that drives the look of the scene so scenario
 * injections (blizzard, polar night, reset) animate in over a few seconds
 * rather than snapping. Must be used inside the R3F <Canvas>.
 */
export function useSmoothedClimate(station) {
  const telemetry = usePolarisStore((state) => state.telemetry[station])
  const goal = readDrivers(telemetry)
  const current = useRef({ ...goal })
  const [, rerender] = useState(0)

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

    if (moved) rerender((n) => n + 1)
  })

  return climateLook(telemetry, station, current.current)
}
