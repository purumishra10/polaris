import { useMemo } from 'react'

export default function AntarcticGround() {
  const points = useMemo(() => {
    const result = []

    for (let i = 0; i < 180; i += 1) {
      result.push([
        (Math.random() - 0.5) * 80,
        0.03 + Math.random() * 0.08,
        (Math.random() - 0.5) * 80,
      ])
    }

    return result
  }, [])

  return (
    <group>
      {/* Main ice field */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100, 32, 32]} />
        <meshStandardMaterial
          color="#d7e3e7"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      {/* Subtle engineering grid */}
      <gridHelper
        args={[80, 40, '#8da1aa', '#b9c9cf']}
        position={[0, 0.045, 0]}
      />

      {/* Small ice ridges */}
      {points.map((position, index) => (
        <mesh
          key={index}
          position={position}
          scale={[
            0.2 + Math.random() * 0.5,
            0.05 + Math.random() * 0.1,
            0.2 + Math.random() * 0.5,
          ]}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#eef5f7"
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  )
}