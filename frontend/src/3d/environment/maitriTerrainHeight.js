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

  let h = 0.15 + hills + ridgeN * 0.4 + ridgeS * 0.35 - lakeDip - padFlat

  if (radial > 95) {
    h = -0.8 + noise(x * 0.025, z * 0.025) * 0.5
  } else if (radial > 75) {
    const t = (radial - 75) / 20
    h = h * (1 - t) + (-0.5) * t
  }

  return h
}

export function maitriWaterLevel() {
  return maitriHeightAt(MAITRI_LAKE.x, MAITRI_LAKE.z) + 0.6
}

export function maitriTerrainColor(x, z, y) {
  const lakeDist = Math.hypot(x - MAITRI_LAKE.x, z - MAITRI_LAKE.z)
  if (lakeDist < MAITRI_LAKE.radius * 0.92 && y < 0.3) {
    return [0.72, 0.82, 0.86]
  }

  const snowNoise = noise(x * 0.055 + 3, z * 0.055 + 7)
  const snowPatch =
    snowNoise > 0.62 ||
    (snowNoise > 0.48 && noise(x * 0.12, z * 0.12) > 0.55)

  if (snowPatch && y > -0.2) {
    return [0.88, 0.91, 0.92]
  }

  const grit = noise(x * 0.14, z * 0.14)
  return [0.38 + grit * 0.1, 0.34 + grit * 0.07, 0.3 + grit * 0.05]
}

export { hash, noise }
