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

export const MAITRI_LAKE = {
  x: -38,
  z: 28,
  radius: 14,
}

export const MAITRI_FLAT_PAD = {
  x: 0,
  z: 0,
  radius: 22,
}

export function maitriHeightAt(x, z) {
  const radial = Math.hypot(x, z)

  const padDist = Math.hypot(x - MAITRI_FLAT_PAD.x, z - MAITRI_FLAT_PAD.z)
  const padT = Math.max(0, 1 - padDist / MAITRI_FLAT_PAD.radius)
  const padFlat = padT * padT * 0.35

  const lakeDist = Math.hypot(x - MAITRI_LAKE.x, z - MAITRI_LAKE.z)
  const lakeT = Math.max(0, 1 - lakeDist / MAITRI_LAKE.radius)
  const lakeDip = lakeT * lakeT * 1.8

  const hills =
    noise(x * 0.035, z * 0.035) * 2.2 +
    noise(x * 0.09, z * 0.09) * 0.8

  const ridgeN = Math.max(0, 4.5 - Math.hypot(x + 55, z + 48) * 0.06)
  const ridgeS = Math.max(0, 3.8 - Math.hypot(x - 50, z - 42) * 0.055)

  const detail = (noise(x * 0.24, z * 0.24) - 0.5) * 0.22

  let h = 0.15 + hills + ridgeN * 0.4 + ridgeS * 0.35 - lakeDip - padFlat + detail

  // Schirmacher Oasis: a rocky strip with the continental ice sheet rising
  // behind it. Past the oasis the surface becomes ice and climbs with distance.
  const iceSheet = () => {
    const rise = Math.max(0, radial - 110)
    const swell =
      noise(x * 0.012 + 4, z * 0.012) * 7 * Math.min(1, rise / 260) +
      noise(x * 0.05, z * 0.05) * 0.9
    return -0.8 + rise * 0.05 + swell
  }

  if (radial > 110) {
    h = iceSheet()
  } else if (radial > 78) {
    const t = (radial - 78) / 32
    const s = t * t * (3 - 2 * t)
    h = h * (1 - s) + iceSheet() * s
  }

  return h
}

export const MAITRI_ICE_EDGE = 96

export function maitriWaterLevel() {
  return maitriHeightAt(MAITRI_LAKE.x, MAITRI_LAKE.z) + 0.6
}

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function maitriSlope(x, z) {
  const e = 0.8
  const dx = maitriHeightAt(x + e, z) - maitriHeightAt(x - e, z)
  const dz = maitriHeightAt(x, z + e) - maitriHeightAt(x, z - e)
  return 1 - (2 * e) / Math.hypot(dx, 2 * e, dz)
}

const ICE = [0.9, 0.94, 0.97]
const OASIS_ROCK = [0.32, 0.29, 0.26]
const M_SNOW = [0.9, 0.93, 0.95]

export function maitriTerrainColor(x, z, y) {
  const radial = Math.hypot(x, z)
  const lakeDist = Math.hypot(x - MAITRI_LAKE.x, z - MAITRI_LAKE.z)
  if (lakeDist < MAITRI_LAKE.radius * 0.92 && y < 0.3) {
    return [0.72, 0.82, 0.86]
  }

  const fine = noise(x * 0.16, z * 0.16)
  const iceTint = [
    ICE[0] - fine * 0.05,
    ICE[1] - fine * 0.035,
    ICE[2] - fine * 0.015,
  ]

  // Continental ice beyond the oasis
  if (radial > MAITRI_ICE_EDGE + 30) return iceTint

  const slope = maitriSlope(x, z)
  const snowNoise = noise(x * 0.055 + 3, z * 0.055 + 7)
  let snowAmount =
    Math.max(0, Math.min(1, (snowNoise - 0.4) * 2.4)) * (1 - Math.min(1, slope * 3))

  // Blend into the ice sheet at the oasis edge
  if (radial > MAITRI_ICE_EDGE) {
    snowAmount = Math.max(snowAmount, (radial - MAITRI_ICE_EDGE) / 30)
  }

  const grit = fine * 0.12
  const rock = [OASIS_ROCK[0] + grit, OASIS_ROCK[1] + grit * 0.7, OASIS_ROCK[2] + grit * 0.5]
  const snow = [M_SNOW[0] - fine * 0.04, M_SNOW[1] - fine * 0.03, M_SNOW[2] - fine * 0.02]
  return mix3(rock, snow, Math.pow(snowAmount, 0.8))
}

export { hash, noise }
