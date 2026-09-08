import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Displace a PlaneGeometry / RingGeometry that will be rendered with
 * rotation [-PI/2, 0, 0]. That rotation maps geometry Y to world -Z, so we
 * sample the height field at (x, -y) — getting this sign wrong mirrors the
 * terrain and leaves every object placed via heightAt() floating or buried.
 */
export function displaceGeometry(geo, heightFn, colorFn, offsetFn = null) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const z = -pos.getY(i)
    let y = heightFn(x, z)
    if (offsetFn) y += offsetFn(x, z, y)
    pos.setZ(i, y)
    const [r, g, b] = colorFn(x, z, y)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

export function displacedPlane(size, segments, heightFn, colorFn) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  return displaceGeometry(geo, heightFn, colorFn)
}

export function displacedRing(
  innerRadius,
  outerRadius,
  thetaSegments,
  phiSegments,
  heightFn,
  colorFn,
  offsetFn = null,
) {
  const geo = new THREE.RingGeometry(
    innerRadius,
    outerRadius,
    thetaSegments,
    phiSegments,
  )
  return displaceGeometry(geo, heightFn, colorFn, offsetFn)
}

/** Surface normal of a height field by central differences. */
export function surfaceNormal(heightFn, x, z, eps = 0.75, out = new THREE.Vector3()) {
  const hL = heightFn(x - eps, z)
  const hR = heightFn(x + eps, z)
  const hD = heightFn(x, z - eps)
  const hU = heightFn(x, z + eps)
  return out.set(hL - hR, 2 * eps, hD - hU).normalize()
}

/** Slope in [0, 1] (0 = flat, 1 = vertical) of a height field. */
export function slopeAt(heightFn, x, z, eps = 0.75) {
  const n = surfaceNormal(heightFn, x, z, eps)
  return 1 - Math.max(0, Math.min(1, n.y))
}

const tmpQuat = new THREE.Quaternion()
const yawQuat = new THREE.Quaternion()

/** Orient `object` so its local +Y follows `normal`, then spin it by `yaw`. */
export function alignToNormal(object, normal, yaw = 0) {
  tmpQuat.setFromUnitVectors(UP, normal)
  yawQuat.setFromAxisAngle(UP, yaw)
  object.quaternion.copy(tmpQuat).multiply(yawQuat)
}
