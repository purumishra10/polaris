import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import {
  maitriHeightAt,
  maitriTerrainColor,
  maitriWaterLevel,
  MAITRI_LAKE,
  MAITRI_ICE_EDGE,
  hash,
} from './maitriTerrainHeight'
import {
  displacedPlane,
  displacedRing,
  surfaceNormal,
  alignToNormal,
} from './terrainMesh'

const INNER_SIZE = 260
const FAR_RADIUS = 1700

function OasisField() {
  const geometry = useMemo(
    () => displacedPlane(INNER_SIZE, 200, maitriHeightAt, maitriTerrainColor),
    [],
  )
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.94} metalness={0.02} />
    </mesh>
  )
}

/** Ice sheet climbing away to the horizon; tucked under the inner field where they overlap. */
function IceSheetField() {
  const geometry = useMemo(
    () =>
      displacedRing(
        120,
        FAR_RADIUS,
        160,
        48,
        maitriHeightAt,
        maitriTerrainColor,
        (x, z) => {
          const r = Math.hypot(x, z)
          return -0.3 * Math.max(0, 1 - (r - 120) / 80)
        },
      ),
    [],
  )
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.02} />
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
          roughness={0.16}
          metalness={0.4}
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
        const y = maitriHeightAt(x, z) + 0.05
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
  const count = 120
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    let placed = 0
    let i = 0
    while (placed < count && i < 1000) {
      i += 1
      const angle = hash(i * 6.1) * Math.PI * 2
      const radius = 18 + Math.sqrt(hash(i * 2.7)) * (MAITRI_ICE_EDGE - 20)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.hypot(x - MAITRI_LAKE.x, z - MAITRI_LAKE.z) < MAITRI_LAKE.radius + 1.5) continue
      const surface = maitriHeightAt(x, z)
      if (surface < -0.4) continue

      const s = 0.3 + Math.pow(hash(i), 2) * 1.6
      surfaceNormal(maitriHeightAt, x, z, 0.8, normal)
      dummy.position.set(x, surface - s * 0.12, z)
      dummy.scale.set(s * 1.4, s * 0.6, s * 1.0)
      alignToNormal(dummy, normal, hash(i * 3) * Math.PI * 2)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(placed, dummy.matrix)
      placed += 1
    }
    meshRef.current.count = placed
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy, normal])

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#5a5046" roughness={0.97} flatShading />
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
        const y = maitriHeightAt(x, z) + height * 0.12
        return (
          <mesh
            key={i}
            position={[x, y, z]}
            scale={[width, height, depth]}
            rotation={[0, i * 0.5, 0]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#5a5248" roughness={0.98} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/** Rock peaks breaking through the ice sheet in the distance. */
function Nunataks() {
  const peaks = useMemo(() => {
    const list = []
    for (let i = 0; i < 9; i += 1) {
      const angle = hash(i * 8.3 + 2) * Math.PI * 2
      const radius = 260 + hash(i * 3.9 + 1) * 700
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const base = maitriHeightAt(x, z)
      const h = 14 + hash(i * 5.7) * 40 + radius * 0.02
      list.push({ x, z, base, sx: h * (0.9 + hash(i) * 1.1), sy: h, sz: h * (0.8 + hash(i * 2) * 1.2), rot: hash(i * 4) * Math.PI })
    }
    return list
  }, [])

  return (
    <group>
      {peaks.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, p.base - p.sy * 0.35, p.z]}
          scale={[p.sx, p.sy, p.sz]}
          rotation={[0, p.rot, 0]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3b3430" roughness={0.98} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export default function MaitriGround() {
  return (
    <group>
      <OasisField />
      <IceSheetField />
      <FrozenLake />
      <ServiceTracks />
      <RockScatter />
      <LowRidges />
      <Nunataks />
    </group>
  )
}
