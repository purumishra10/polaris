import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function Lighting() {
  const beacon = useRef()

  useFrame(({ clock }) => {
    if (!beacon.current) return

    beacon.current.intensity =
      1.8 + Math.sin(clock.elapsedTime * 2.5) * 0.6
  })

  return (
    <>
      <ambientLight intensity={0.35} />

      <directionalLight
        position={[12, 20, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <hemisphereLight
        skyColor="#9cc8dc"
        groundColor="#17242b"
        intensity={0.8}
      />

      {/* Station operational light */}
      <pointLight
        ref={beacon}
        position={[0, 7, 0]}
        color="#5cc8ff"
        intensity={2}
        distance={14}
      />
    </>
  )
}