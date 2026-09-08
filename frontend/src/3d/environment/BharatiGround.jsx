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

function DisplacedField() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(520, 420, 180, 140)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getY(i)
      const y = heightAt(x, z)
      pos.setZ(i, y)
      const [r, g, b] = terrainColor(x, z, y)
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

function MeltPond() {
  const y = waterLevel()

  return (
    <InteractiveAsset id="WATER">
      <group position={[POND.x, y, POND.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0.22]} receiveShadow>
          <circleGeometry args={[POND.radius * 0.92, 48]} />
          <meshStandardMaterial
            color="#2f7f93"
            roughness={0.16}
            metalness={0.38}
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
            roughness={0.08}
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
        const y = heightAt(x, z) + 0.04
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

function RockScatter() {
  const meshRef = useRef()
  const count = 90
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    let placed = 0
    let i = 0
    while (placed < count && i < 500) {
      i += 1
      const x = ((i * 47) % 360) - 180
      const z = ((i * 89) % 280) - 140
      if (Math.hypot(x, z) < 22) continue
      const surface = heightAt(x, z)
      if (surface < SEA_LEVEL + 0.6) continue
      const s = 0.55 + hash(i) * 1.8
      dummy.position.set(x, surface + s * 0.22, z)
      dummy.scale.set(s * 1.5, s * 0.38, s * 1.1)
      dummy.rotation.set(hash(i * 2) * 0.4, hash(i * 3) * Math.PI, hash(i * 5) * 0.3)
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
      <meshStandardMaterial color="#6a5848" roughness={0.98} flatShading />
    </instancedMesh>
  )
}

function Icebergs() {
  const bergs = [
    [148, 110, 18, 9, 22],
    [162, -40, 14, 11, 16],
    [-130, 128, 20, 8, 18],
    [120, -132, 11, 7, 14],
    [-155, -80, 16, 10, 20],
    [95, 155, 9, 6, 12],
    [-90, 170, 13, 8, 15],
  ]

  return (
    <group>
      {bergs.map(([x, z, sx, sy, sz], i) => {
        const y = SEA_LEVEL + sy * 0.28
        return (
          <group key={i} position={[x, y, z]} rotation={[0, i * 0.7, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[sx, sy, sz]} />
              <meshStandardMaterial color="#e8eef2" roughness={0.72} />
            </mesh>
            <mesh position={[sx * 0.18, sy * 0.22, -sz * 0.12]} castShadow>
              <octahedronGeometry args={[Math.min(sx, sz) * 0.42, 0]} />
              <meshStandardMaterial color="#d5e4ea" roughness={0.55} />
            </mesh>
          </group>
        )
      })}
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
      <DisplacedField />
      <MeltPond />
      <PackedTracks />
      <RockScatter />
      <Icebergs />
    </group>
  )
}
