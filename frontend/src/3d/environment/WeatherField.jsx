import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

let sharedFlake = null

function flakeTexture() {
  if (sharedFlake) return sharedFlake
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.25)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  sharedFlake = new THREE.CanvasTexture(canvas)
  sharedFlake.colorSpace = THREE.SRGBColorSpace
  return sharedFlake
}

/**
 * Falling / wind-blown snow. The buffer is allocated once at `maxCount`
 * and `count` simply changes the draw range, so a blizzard can ramp up
 * from a few flakes to a whiteout without re-allocating geometry.
 */
export default function WeatherField({
  gale = 0,
  cold = 0,
  count = 0,
  maxCount = 5600,
  extent = [220, 48, 180],
  floor = 0.4,
  speed = 1,
  size = 0.36,
  opacityScale = 1,
  color = '#eef5fa',
}) {
  const points = useRef()
  const material = useRef()
  const time = useRef(Math.random() * 100)

  const { positions, seeds } = useMemo(() => {
    const n = Math.max(1, maxCount)
    const pos = new Float32Array(n * 3)
    const sd = new Float32Array(n)
    const [ex, ey, ez] = extent
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * ex
      pos[i * 3 + 1] = Math.random() * ey + floor
      pos[i * 3 + 2] = (Math.random() - 0.5) * ez
      sd[i] = 0.55 + Math.random() * 1.7
    }
    return { positions: pos, seeds: sd }
  }, [maxCount, extent, floor])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [positions])

  const active = Math.min(maxCount, Math.max(0, Math.floor(count)))

  useEffect(() => {
    geometry.setDrawRange(0, active)
  }, [geometry, active])

  useFrame((_, delta) => {
    if (!points.current || active === 0) return
    const attr = points.current.geometry.attributes.position
    if (!attr) return

    const dt = Math.min(delta, 0.05)
    time.current += dt
    const t = time.current

    // Gusting: wind strength breathes instead of blowing at a constant rate
    const gust =
      0.72 +
      0.28 * Math.sin(t * 0.85) +
      0.18 * Math.sin(t * 2.6 + 1.3) +
      0.1 * Math.sin(t * 6.1 + 0.4)

    const [ex, ey, ez] = extent
    const driftX = (5 + gale * 74 * gust) * speed * dt
    const driftZ = (-2 - gale * 28 * gust) * speed * dt
    const fall = (2.4 + cold * 1.6 + gale * 6.5) * speed * dt
    const flutter = (1 - gale) * 0.35 * dt

    for (let i = 0; i < active; i += 1) {
      const seed = seeds[i]
      let x = attr.getX(i) + driftX * seed + Math.sin(t * 1.9 + i) * flutter
      let y = attr.getY(i) - fall * seed
      let z = attr.getZ(i) + driftZ * seed + Math.cos(t * 1.4 + i * 0.7) * flutter

      if (x > ex / 2) x -= ex
      if (x < -ex / 2) x += ex
      if (z > ez / 2) z -= ez
      if (z < -ez / 2) z += ez
      if (y < floor) y = ey + floor

      attr.setXYZ(i, x, y, z)
    }

    attr.needsUpdate = true

    if (material.current) {
      material.current.opacity =
        Math.min(1, 0.22 + gale * 0.62 + cold * 0.1) * opacityScale
      material.current.size = size * (1 + gale * 1.3)
    }
  })

  if (active < 20) return null

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        map={flakeTexture()}
        color={color}
        size={size}
        transparent
        opacity={0.45}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
