import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function WeatherField({
  gale = 0,
  cold = 0,
  count = 0,
  extent = [220, 48, 180],
}) {
  const points = useRef()
  const material = useRef()

  const { positions, seeds } = useMemo(() => {
    const n = Math.max(0, count)
    const pos = new Float32Array(n * 3)
    const sd = new Float32Array(n)
    const [ex, ey, ez] = extent
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * ex
      pos[i * 3 + 1] = Math.random() * ey + 1.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * ez
      sd[i] = 0.6 + Math.random() * 1.6
    }
    return { positions: pos, seeds: sd }
  }, [count, extent])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [positions])

  useFrame((_, delta) => {
    if (!points.current) return
    const attr = points.current.geometry.attributes.position
    if (!attr) return

    const [ex, ey, ez] = extent
    const driftX = (6 + gale * 58) * delta
    const driftZ = (-2.4 - gale * 22) * delta
    const fall = (2.2 + cold * 1.4) * (1 - gale * 0.72) * delta

    for (let i = 0; i < attr.count; i += 1) {
      let x = attr.getX(i) + driftX * seeds[i]
      let y = attr.getY(i) - fall * seeds[i]
      let z = attr.getZ(i) + driftZ * seeds[i]

      if (x > ex / 2) x -= ex
      if (x < -ex / 2) x += ex
      if (z > ez / 2) z -= ez
      if (z < -ez / 2) z += ez
      if (y < 0.4) y = ey

      attr.setXYZ(i, x, y, z)
    }

    attr.needsUpdate = true

    if (material.current) {
      material.current.opacity = 0.18 + gale * 0.62 + cold * 0.12
      material.current.size = 0.22 + gale * 0.55
    }
  })

  if (count < 40) return null

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        color="#e8f2f8"
        size={0.35}
        transparent
        opacity={0.45}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
