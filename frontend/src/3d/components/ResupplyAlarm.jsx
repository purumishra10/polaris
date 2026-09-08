import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { heightAt } from '../environment/terrainHeight'

/**
 * Fuel-starvation alarm shown around the fuel farm during a resupply delay:
 * a pulsing red hazard ring, a translucent reserve envelope and a sweeping
 * beacon. `intensity` (0..1) grows as days of autonomy fall toward zero.
 */
export default function ResupplyAlarm({ station = 'BHARATI', intensity = 0 }) {
  const ring = useRef()
  const ringMat = useRef()
  const outerRing = useRef()
  const outerMat = useRef()
  const envelopeMat = useRef()
  const beacon = useRef()
  const beaconGlow = useRef()

  const isBharati = station === 'BHARATI'
  const position = isBharati
    ? [-52, heightAt(-52, -28) + 0.05, -28]
    : [-18, 0.12, 1.5]
  const scale = isBharati ? 1 : 0.42

  useFrame(({ clock }) => {
    if (intensity <= 0) return
    const t = clock.elapsedTime
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.4)
    const pulse2 = (t * 0.7) % 1

    if (ring.current && ringMat.current) {
      ring.current.scale.setScalar(1 + pulse * 0.18)
      ringMat.current.opacity = (0.3 + 0.55 * (1 - pulse)) * intensity
    }
    if (outerRing.current && outerMat.current) {
      outerRing.current.scale.setScalar(1 + pulse2 * 1.6)
      outerMat.current.opacity = (1 - pulse2) * 0.35 * intensity
    }
    if (envelopeMat.current) {
      envelopeMat.current.opacity = (0.05 + 0.08 * pulse) * intensity
    }
    if (beacon.current) {
      const angle = t * 2.4
      beacon.current.position.set(
        Math.cos(angle) * 5.2 * scale,
        2.9 * scale,
        Math.sin(angle) * 5.2 * scale,
      )
      beacon.current.intensity = (10 + 6 * pulse) * intensity * scale
    }
    if (beaconGlow.current) {
      beaconGlow.current.position.copy(beacon.current.position)
      beaconGlow.current.material.opacity = (0.5 + 0.4 * pulse) * intensity
    }
  })

  if (intensity <= 0) return null

  return (
    <group position={position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.4 * scale, 6.1 * scale, 72]} />
        <meshBasicMaterial
          ref={ringMat}
          color="#ff3b4e"
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={outerRing} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.9 * scale, 6.2 * scale, 72]} />
        <meshBasicMaterial
          ref={outerMat}
          color="#ff6b7c"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 2.3 * scale, 0]}>
        <cylinderGeometry
          args={[4.8 * scale, 5.2 * scale, 4.6 * scale, 40, 1, true]}
        />
        <meshBasicMaterial
          ref={envelopeMat}
          color="#ff3b4e"
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight ref={beacon} color="#ff3b4e" distance={30 * scale} decay={2} />
      <mesh ref={beaconGlow}>
        <sphereGeometry args={[0.28 * scale, 12, 12]} />
        <meshBasicMaterial color="#ff8090" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
