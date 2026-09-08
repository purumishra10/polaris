import { useMemo } from 'react'
import * as THREE from 'three'
import InteractiveAsset from '../../components/InteractiveAsset'
import { heightAt } from '../../environment/terrainHeight'
import {
  hullMetal,
  hullTrim,
  hullUnderside,
  glassDay,
  pileSteel,
} from './materials'

const LENGTH = 53.2
const HULL_BOTTOM = 5.2
const CANTILEVER_BOTTOM = 6.55

function createHullGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-8.4, HULL_BOTTOM)
  shape.lineTo(-14.7, 7.25)
  shape.lineTo(-15.1, 11.45)
  shape.lineTo(-10.8, 15.15)
  shape.lineTo(10.8, 15.15)
  shape.lineTo(15.1, 11.45)
  shape.lineTo(14.7, 7.25)
  shape.lineTo(8.4, HULL_BOTTOM)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: LENGTH,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geo.translate(0, 0, -LENGTH / 2)
  geo.rotateY(-Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

function HullShell() {
  const geometry = useMemo(() => createHullGeometry(), [])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          {...hullMetal}
          color="#c5ced4"
          metalness={0.78}
          roughness={0.32}
          clearcoat={0.22}
          clearcoatRoughness={0.48}
          flatShading
        />
      </mesh>

      <mesh position={[0, 5.05, 0]} castShadow>
        <boxGeometry args={[48.5, 0.28, 16.4]} />
        <meshStandardMaterial {...hullUnderside} />
      </mesh>

      <mesh position={[16.4, 5.72, 0]} castShadow>
        <boxGeometry args={[18, 0.22, 14.2]} />
        <meshStandardMaterial {...hullUnderside} />
      </mesh>
    </group>
  )
}

function WindowBands() {
  const bays = Array.from({ length: 18 }, (_, i) => -22.5 + i * 2.65)

  return (
    <group>
      <mesh position={[0, 12.35, 15.16]}>
        <boxGeometry args={[46, 2.55, 0.1]} />
        <meshPhysicalMaterial {...glassDay} />
      </mesh>
      <mesh position={[0, 8.85, 15.16]}>
        <boxGeometry args={[44, 2.2, 0.1]} />
        <meshPhysicalMaterial {...glassDay} />
      </mesh>
      <mesh position={[0, 12.2, -15.16]}>
        <boxGeometry args={[42, 2.35, 0.1]} />
        <meshPhysicalMaterial {...glassDay} />
      </mesh>
      <mesh position={[0, 8.7, -15.16]}>
        <boxGeometry args={[40, 2.05, 0.1]} />
        <meshPhysicalMaterial {...glassDay} />
      </mesh>

      {bays.map((x) => (
        <group key={x}>
          <mesh position={[x, 12.35, 15.24]}>
            <boxGeometry args={[0.07, 2.5, 0.05]} />
            <meshStandardMaterial color="#b7c2c8" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[x, 8.85, 15.24]}>
            <boxGeometry args={[0.07, 2.12, 0.05]} />
            <meshStandardMaterial color="#b7c2c8" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[x, 10.3, 15.2]}>
            <boxGeometry args={[0.06, 9.4, 0.04]} />
            <meshStandardMaterial {...hullTrim} />
          </mesh>
          <mesh position={[x, 10.2, -15.2]}>
            <boxGeometry args={[0.06, 8.8, 0.04]} />
            <meshStandardMaterial {...hullTrim} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 10.6, 15.22]}>
        <boxGeometry args={[46, 0.08, 0.06]} />
        <meshStandardMaterial {...hullTrim} />
      </mesh>

      <mesh position={[26.55, 10.6, 0]} rotation={[0, 0, -0.26]}>
        <boxGeometry args={[0.12, 6.4, 16]} />
        <meshPhysicalMaterial {...glassDay} emissiveIntensity={0.38} />
      </mesh>
    </group>
  )
}

function RecessedEntrance() {
  return (
    <group position={[-4.2, 0, 15.2]}>
      <mesh position={[0, 8.4, -0.7]} castShadow>
        <boxGeometry args={[3.8, 6.4, 1.6]} />
        <meshStandardMaterial color="#1c242a" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh position={[0, 7.6, 0.05]}>
        <boxGeometry args={[1.7, 3.1, 0.12]} />
        <meshStandardMaterial
          color="#101418"
          emissive="#c9a56a"
          emissiveIntensity={0.18}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh
          key={i}
          position={[0, 0.22 + i * 0.68, 4.6 - i * 0.52]}
          castShadow
        >
          <boxGeometry args={[2.4, 0.1, 0.58]} />
          <meshStandardMaterial color="#4d585f" metalness={0.6} roughness={0.42} />
        </mesh>
      ))}
      <mesh position={[-1.15, 2.7, 2.4]}>
        <boxGeometry args={[0.07, 5.4, 0.07]} />
        <meshStandardMaterial color="#111416" />
      </mesh>
      <mesh position={[1.15, 2.7, 2.4]}>
        <boxGeometry args={[0.07, 5.4, 0.07]} />
        <meshStandardMaterial color="#111416" />
      </mesh>
    </group>
  )
}

function RoofPlant() {
  return (
    <InteractiveAsset id="ROOF">
      <group position={[-7.5, 15.55, 0]}>
        <mesh castShadow>
          <boxGeometry args={[16.5, 1.2, 8.4]} />
          <meshStandardMaterial color="#8b969e" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[11, 0.32, 5.8]} />
          <meshStandardMaterial color="#5c676e" metalness={0.65} roughness={0.4} />
        </mesh>
        {[-4.2, 0, 3.8].map((x) => (
          <mesh key={x} position={[x, 1.35, 1.4]}>
            <cylinderGeometry args={[0.22, 0.26, 0.9, 10]} />
            <meshStandardMaterial color="#1a1d20" roughness={0.5} />
          </mesh>
        ))}
        {[
          [-7.8, -3.9],
          [7.8, -3.9],
          [-7.8, 3.9],
          [7.8, 3.9],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.9, z]}>
            <boxGeometry args={[0.06, 1.05, 0.06]} />
            <meshStandardMaterial color="#111416" />
          </mesh>
        ))}
        <mesh position={[0, 1.4, -3.9]}>
          <boxGeometry args={[15.7, 0.05, 0.05]} />
          <meshStandardMaterial color="#111416" />
        </mesh>
        <mesh position={[0, 1.4, 3.9]}>
          <boxGeometry args={[15.7, 0.05, 0.05]} />
          <meshStandardMaterial color="#111416" />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

function PileField() {
  const xs = Array.from({ length: 11 }, (_, i) => -25 + i * 5)
  const zs = [-6.1, 6.1]

  return (
    <group>
      {xs.flatMap((x) =>
        zs.map((z) => {
          const cantilever = x > 12
          const underside = cantilever ? CANTILEVER_BOTTOM : HULL_BOTTOM
          const ground = Math.max(0.02, heightAt(x, z))
          const leg = Math.max(1.4, underside - ground)
          const y = ground + leg / 2
          const lean = 0.18

          return (
            <group key={`${x}-${z}`} position={[x, 0, z]}>
              <mesh
                position={[-0.42, y, 0]}
                rotation={[0, 0, -lean]}
                castShadow
              >
                <boxGeometry args={[0.34, leg, 0.34]} />
                <meshStandardMaterial {...pileSteel} />
              </mesh>
              <mesh
                position={[0.42, y, 0]}
                rotation={[0, 0, lean]}
                castShadow
              >
                <boxGeometry args={[0.34, leg, 0.34]} />
                <meshStandardMaterial {...pileSteel} />
              </mesh>
              <mesh position={[0, ground + 0.16, 0]} castShadow>
                <boxGeometry args={[1.45, 0.32, 0.9]} />
                <meshStandardMaterial color="#3a434a" metalness={0.6} roughness={0.5} />
              </mesh>
            </group>
          )
        }),
      )}
      <mesh position={[-24.6, 4.1, 0]} rotation={[0, 0, 0.48]} castShadow>
        <boxGeometry args={[0.3, 8.4, 0.3]} />
        <meshStandardMaterial {...pileSteel} />
      </mesh>
      <mesh position={[-24.6, 4.1, 0]} rotation={[0, 0, -0.48]} castShadow>
        <boxGeometry args={[0.3, 8.4, 0.3]} />
        <meshStandardMaterial {...pileSteel} />
      </mesh>
    </group>
  )
}

function UnderHullModules() {
  const modules = [
    [-22, -4.2, '#2a3035'],
    [-22, 0, '#1f252a'],
    [-22, 4.2, '#32383d'],
    [-16.2, -4.2, '#262c31'],
    [-16.2, 4.2, '#30363b'],
  ]

  return (
    <group>
      {modules.map(([x, z, color], i) => {
        const y = heightAt(x, z) + 1.15
        return (
          <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
            <boxGeometry args={[5.4, 2.3, 2.35]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.58} />
          </mesh>
        )
      })}
    </group>
  )
}

export default function AerodynamicHull() {
  return (
    <group>
      <InteractiveAsset id="STRUCTURE">
        <group>
          <HullShell />
          <WindowBands />
          <RecessedEntrance />
          <PileField />
          <UnderHullModules />
        </group>
      </InteractiveAsset>
      <RoofPlant />
    </group>
  )
}
