import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import InteractiveAsset from '../components/InteractiveAsset'
import { usePolarisStore } from '../../store/usePolarisStore'
import {
  heightAt,
  waterLevel,
  terrainColor,
  POND,
  SEA_LEVEL,
  hash,
} from './terrainHeight'
import {
  displacedPlane,
  displacedRing,
  surfaceNormal,
  alignToNormal,
} from './terrainMesh'

const INNER_SIZE = 300
const FAR_RADIUS = 3800

/** High-detail island terrain around the station. */
function IslandField() {
  const geometry = useMemo(
    () => displacedPlane(INNER_SIZE, 220, heightAt, terrainColor),
    [],
  )
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.94} metalness={0.02} />
    </mesh>
  )
}

/** Coarse sea floor stretching to the horizon so there is never an edge. */
function FarField() {
  const geometry = useMemo(
    () =>
      displacedRing(140, FAR_RADIUS, 160, 36, heightAt, terrainColor, () => -0.15),
    [],
  )
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
    </mesh>
  )
}

/** Reflective open-water surface from the shoreline out past the fog line. */
function SeaSurface() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SEA_LEVEL + 0.02, 0]}
      receiveShadow
    >
      <ringGeometry args={[100, FAR_RADIUS, 128, 1]} />
      <meshStandardMaterial
        color="#1f4453"
        roughness={0.2}
        metalness={0.6}
        envMapIntensity={1.3}
        transparent
        opacity={0.96}
      />
    </mesh>
  )
}

function MeltPond() {
  const y = waterLevel()

  return (
    <InteractiveAsset id="WATER">
      <group position={[POND.x, y, POND.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0.22]} receiveShadow>
          <circleGeometry args={[POND.radius * 0.92, 48]} />
          <meshStandardMaterial
            color="#2f7f93"
            roughness={0.14}
            metalness={0.42}
          />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0.22]}
          position={[0, 0.04, 0]}
          scale={[0.78, 0.7, 1]}
        >
          <circleGeometry args={[POND.radius * 0.92, 40]} />
          <meshPhysicalMaterial
            color="#8fd4e2"
            roughness={0.06}
            metalness={0.15}
            transparent
            opacity={0.55}
            transmission={0.15}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0.4]} position={[3.5, 0.06, -2]}>
          <ringGeometry args={[4.2, 5.1, 28]} />
          <meshStandardMaterial
            color="#dce8ec"
            roughness={0.7}
            transparent
            opacity={0.65}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

function PackedTracks() {
  const tracks = [
    [6, 22, 0.15, 4.6, 38],
    [18, 8, 0.55, 3.2, 26],
    [-12, 14, -0.35, 3.4, 30],
  ]

  return (
    <group>
      {tracks.map(([x, z, rot, w, len], i) => {
        const y = heightAt(x, z) + 0.05
        return (
          <mesh
            key={i}
            position={[x, y, z]}
            rotation={[-Math.PI / 2, 0, rot]}
          >
            <planeGeometry args={[w, len]} />
            <meshStandardMaterial color="#4a433c" roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Boulders seated into the slope (on land only, aligned to the surface). */
function RockScatter() {
  const meshRef = useRef()
  const count = 170
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    let placed = 0
    let i = 0
    while (placed < count && i < 1400) {
      i += 1
      const angle = hash(i * 7.3) * Math.PI * 2
      const radius = 24 + Math.sqrt(hash(i * 3.1)) * 94
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 2) continue
      const surface = heightAt(x, z)
      if (surface < SEA_LEVEL + 2.2) continue

      const s = 0.45 + Math.pow(hash(i), 2.2) * 2.6
      surfaceNormal(heightAt, x, z, 0.9, normal)
      dummy.position.set(x, surface - s * 0.14, z)
      dummy.scale.set(s * 1.4, s * 0.62, s * 1.1)
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
      <meshStandardMaterial color="#4a3f36" roughness={0.97} flatShading />
    </instancedMesh>
  )
}

/** Broken sea ice drifting just off the coast. */
function PackIce() {
  const meshRef = useRef()
  const count = 110
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    for (let i = 0; i < count; i += 1) {
      const angle = hash(i * 11.7 + 1) * Math.PI * 2
      const radius = 128 + Math.pow(hash(i * 5.3 + 2), 1.6) * 260
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const w = 3 + hash(i * 2.9) * 20
      const d = 3 + hash(i * 4.1) * 15
      dummy.position.set(x, SEA_LEVEL + 0.12, z)
      dummy.scale.set(w, 0.55 + hash(i) * 0.5, d)
      dummy.rotation.set(0, hash(i * 6.7) * Math.PI, 0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e9f0f4" roughness={0.82} />
    </instancedMesh>
  )
}

function Icebergs() {
  const bergs = useMemo(() => {
    const list = []
    for (let i = 0; i < 16; i += 1) {
      const angle = hash(i * 13.1 + 5) * Math.PI * 2
      const radius = 170 + Math.pow(hash(i * 7.7 + 3), 1.4) * 1150
      const size = 10 + hash(i * 3.3) * 22 + radius * 0.012
      list.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        sx: size * (0.8 + hash(i * 1.7) * 0.7),
        sy: size * (0.35 + hash(i * 2.3) * 0.45),
        sz: size * (0.7 + hash(i * 4.9) * 0.8),
        rot: hash(i * 9.1) * Math.PI,
      })
    }
    return list
  }, [])

  return (
    <group>
      {bergs.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, SEA_LEVEL + b.sy * 0.22, b.z]}
          scale={[b.sx, b.sy, b.sz]}
          rotation={[hash(i) * 0.12, b.rot, hash(i * 2) * 0.1]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#e6edf2" roughness={0.7} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Continental ice sheet silhouetted on the horizon behind the station. */
function IceSheetHorizon() {
  const domes = useMemo(() => {
    const list = []
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17
      const angle = THREE.MathUtils.degToRad(115 + t * 235) + (hash(i * 3.7) - 0.5) * 0.12
      const radius = 850 + hash(i * 5.1) * 750
      const rx = 260 + hash(i * 2.1) * 320
      const ry = 55 + hash(i * 4.3) * 110 + (radius - 850) * 0.04
      const rz = 240 + hash(i * 6.9) * 300
      list.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, rx, ry, rz })
    }
    return list
  }, [])

  return (
    <group>
      {domes.map((d, i) => (
        <mesh
          key={i}
          position={[d.x, SEA_LEVEL - d.ry * 0.22, d.z]}
          scale={[d.rx, d.ry, d.rz]}
        >
          <sphereGeometry args={[1, 28, 18]} />
          <meshStandardMaterial color="#e6eef5" roughness={0.96} />
        </mesh>
      ))}
    </group>
  )
}

export default function BharatiGround() {
  return (
    <group
      onDoubleClick={(event) => {
        event.stopPropagation()
        const store = usePolarisStore.getState()
        store.setSelectedSubsystem(null)
        store.setCameraPreset('droneAerial')
      }}
    >
      <IslandField />
      <FarField />
      <SeaSurface />
      <MeltPond />
      <PackedTracks />
      <RockScatter />
      <PackIce />
      <Icebergs />
      <IceSheetHorizon />
    </group>
  )
}
