function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function noise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix + iz * 57)
  const b = hash(ix + 1 + iz * 57)
  const c = hash(ix + (iz + 1) * 57)
  const d = hash(ix + 1 + (iz + 1) * 57)
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz
}

export const POND = {
  x: 26,
  z: 34,
  radius: 16,
}

export const SEA_LEVEL = -3.8

export function heightAt(x, z) {
  const radial = Math.hypot(x, z)
  const island = Math.max(0, 1 - radial / 108)
  const pad = Math.max(0, 1 - Math.hypot(x * 0.85, z) / 42)

  const pondDist = Math.hypot(x - POND.x, z - POND.z)
  const pondT = Math.max(0, 1 - pondDist / POND.radius)
  const pondDip = pondT * pondT * 2.6

  const hills =
    noise(x * 0.028, z * 0.028) * 5.8 +
    noise(x * 0.07, z * 0.07) * 1.8
  const ridge = Math.max(0, 15.5 - Math.hypot(x + 74, z + 70) * 0.2)

  // Fine surface detail so slopes read as rock / snow rather than flat shading
  const detail = (noise(x * 0.21, z * 0.21) - 0.5) * 0.35

  let h =
    1.15 + pad * 1.35 + hills * island * (1 - pad * 0.78) + ridge - pondDip + detail * (1 - pad)

  if (radial > 118) {
    // Sea floor: gentle swell right at the coast, dead flat further out so
    // the far-field sea mesh matches exactly.
    const fade = Math.max(0, 1 - (radial - 118) / 40)
    h = SEA_LEVEL - 0.35 + noise(x * 0.02, z * 0.02) * 0.22 * fade
  } else if (radial > 92) {
    const t = (radial - 92) / 26
    const s = t * t * (3 - 2 * t)
    h = h * (1 - s) + (SEA_LEVEL + 0.35) * s
  }

  return h
}

export function waterLevel() {
  return heightAt(POND.x, POND.z) + 1.55
}

export function groundY(x, z, embed = 0) {
  return heightAt(x, z) - embed
}

const WATER = [0.11, 0.24, 0.31]
const SHORE_ICE = [0.74, 0.8, 0.83]
const SNOW = [0.92, 0.95, 0.97]
const ROCK = [0.3, 0.27, 0.24]

function slopeOf(x, z) {
  const e = 0.9
  const dx = heightAt(x + e, z) - heightAt(x - e, z)
  const dz = heightAt(x, z + e) - heightAt(x, z - e)
  const ny = (2 * e) / Math.hypot(dx, 2 * e, dz)
  return 1 - ny
}

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function terrainColor(x, z, y) {
  if (y < SEA_LEVEL + 0.55) {
    const ripple = noise(x * 0.08, z * 0.08) * 0.04
    return [WATER[0] + ripple, WATER[1] + ripple, WATER[2] + ripple]
  }
  if (y < SEA_LEVEL + 1.6) {
    const t = (y - (SEA_LEVEL + 0.55)) / 1.05
    return mix3(WATER, SHORE_ICE, Math.min(1, t * 1.4))
  }

  const slope = slopeOf(x, z)
  const snowNoise = noise(x * 0.045 + 9, z * 0.045)
  const fine = noise(x * 0.16, z * 0.16)
  const nearPond = Math.hypot(x - POND.x, z - POND.z) < POND.radius * 0.95

  // Snow collects on flatter ground; steep faces stay bare rock.
  let snowAmount = nearPond
    ? 1
    : Math.max(0, Math.min(1, (snowNoise - 0.36) * 2.6)) * (1 - Math.min(1, slope * 3.2))
  snowAmount = Math.pow(snowAmount, 0.8)

  const grit = fine * 0.14
  const rock = [ROCK[0] + grit, ROCK[1] + grit * 0.7, ROCK[2] + grit * 0.5]
  const snow = [
    SNOW[0] - fine * 0.05,
    SNOW[1] - fine * 0.035,
    SNOW[2] - fine * 0.02,
  ]
  return mix3(rock, snow, snowAmount)
}

export { hash, noise }
