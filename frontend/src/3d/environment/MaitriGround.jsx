import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import {
  maitriHeightAt,
  maitriTerrainColor,
  maitriWaterLevel,
  MAITRI_LAKE,
  hash,
} from './maitriTerrainHeight'

function DisplacedField() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 160, 100, 80)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getY(i)
      const y = maitriHeightAt(x, z)
      pos.setZ(i, y)
      const [r, g, b] = maitriTerrainColor(x, z, y)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} />
    </mesh>
  )
}

function FrozenLake() {
  const y = maitriWaterLevel()

  return (
    <group position={[MAITRI_LAKE.x, y, MAITRI_LAKE.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0.15]} receiveShadow>
        <circleGeometry args={[MAITRI_LAKE.radius * 0.88, 40]} />
        <meshStandardMaterial
          color="#5a8a96"
          roughness={0.18}
          metalness={0.35}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0.15]}
        position={[0, 0.03, 0]}
        scale={[0.82, 0.75, 1]}
      >
        <circleGeometry args={[MAITRI_LAKE.radius * 0.88, 36]} />
        <meshPhysicalMaterial
          color="#9cc8d4"
          roughness={0.06}
          metalness={0.12}
          transparent
          opacity={0.5}
          transmission={0.12}
        />
      </mesh>
    </group>
  )
}

function ServiceTracks() {
  const tracks = [
    [0, 18, 0, 5, 36],
    [14, 0, Math.PI / 2, 4, 28],
    [-16, -6, 0.4, 3.5, 22],
    [0, -22, 0, 4.5, 18],
  ]

  return (
    <group>
      {tracks.map(([x, z, rot, w, len], i) => {
        const y = maitriHeightAt(x, z) + 0.04
        return (
          <mesh
            key={i}
            position={[x, y, z]}
            rotation={[-Math.PI / 2, 0, rot]}
          >
            <planeGeometry args={[w, len]} />
            <meshStandardMaterial color="#454038" roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}

function RockScatter() {
  const meshRef = useRef()
  const count = 65
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    let placed = 0
    let i = 0
    while (placed < count && i < 400) {
      i += 1
      const x = ((i * 53) % 180) - 90
      const z = ((i * 71) % 140) - 70
      if (Math.hypot(x, z) < 18) continue
      const surface = maitriHeightAt(x, z)
      if (surface < -0.5) continue
      const s = 0.35 + hash(i) * 1.1
      dummy.position.set(x, surface + s * 0.18, z)
      dummy.scale.set(s * 1.4, s * 0.32, s * 1.0)
      dummy.rotation.set(
        hash(i * 2) * 0.35,
        hash(i * 3) * Math.PI,
        hash(i * 5) * 0.25,
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(placed, dummy.matrix)
      placed += 1
    }
    meshRef.current.count = placed
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#635a50" roughness={0.98} flatShading />
    </instancedMesh>
  )
}

function LowRidges() {
  const ridges = [
    [-62, -48, 28, 3.5, 14],
    [58, -52, 24, 3.0, 12],
    [-55, 50, 26, 2.8, 13],
    [60, 45, 22, 2.5, 11],
  ]

  return (
    <group>
      {ridges.map(([x, z, width, height, depth], i) => {
        const y = maitriHeightAt(x, z) + height * 0.3
        return (
          <mesh
            key={i}
            position={[x, y, z]}
            scale={[width, height, depth]}
            rotation={[0, i * 0.5, 0]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#5a5248" roughness={0.98} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

export default function MaitriGround() {
  return (
    <group>
      <DisplacedField />
      <FrozenLake />
      <ServiceTracks />
      <RockScatter />
      <LowRidges />
    </group>
  )
}
