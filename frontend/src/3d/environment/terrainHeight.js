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

  let h = 1.15 + pad * 1.35 + hills * island * (1 - pad * 0.78) + ridge - pondDip

  if (radial > 118) {
    h = SEA_LEVEL + noise(x * 0.02, z * 0.02) * 0.22
  } else if (radial > 92) {
    const t = (radial - 92) / 26
    h = h * (1 - t) + (SEA_LEVEL + 0.15) * t
  }

  return h
}

export function waterLevel() {
  return heightAt(POND.x, POND.z) + 1.55
}

export function groundY(x, z, embed = 0) {
  return heightAt(x, z) - embed
}

export function terrainColor(x, z, y) {
  if (y < SEA_LEVEL + 1.1) {
    return [0.78, 0.86, 0.9]
  }

  const snow =
    noise(x * 0.045 + 9, z * 0.045) > 0.52 ||
    Math.hypot(x - POND.x, z - POND.z) < POND.radius * 0.95

  if (snow) {
    return [0.91, 0.94, 0.95]
  }

  const grit = noise(x * 0.12, z * 0.12)
  return [0.42 + grit * 0.12, 0.36 + grit * 0.08, 0.3]
}

export { hash, noise }
