import * as THREE from 'three'
import InteractiveAsset from '../../components/InteractiveAsset'
import { heightAt } from '../../environment/terrainHeight'

function PipeRun({ from, to, color = '#c9b48a' }) {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const dir = end.clone().sub(start)
  const length = dir.length()
  const position = start.clone().add(end).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  )

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.14, 0.14, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.45} roughness={0.5} />
    </mesh>
  )
}

export default function ElevatedUtility() {
  const posts = [
    [10, 18],
    [3, 18],
    [-4, 18],
    [10, 24],
    [3, 24],
  ]

  return (
    <group>
      <InteractiveAsset id="UTILITIES">
        <group>
          {posts.map(([x, z]) => {
            const ground = heightAt(x, z)
            const top = ground + 4.4
            return (
              <mesh key={`${x}-${z}`} position={[x, ground + 2.2, z]} castShadow>
                <boxGeometry args={[0.18, 4.4, 0.18]} />
                <meshStandardMaterial color="#8a7a62" metalness={0.4} roughness={0.6} />
              </mesh>
            )
          })}
          <PipeRun
            from={[10, heightAt(10, 18) + 4.4, 18]}
            to={[-4, heightAt(-4, 18) + 4.4, 18]}
          />
          <PipeRun
            from={[10, heightAt(10, 24) + 4.4, 24]}
            to={[-4, heightAt(-4, 24) + 4.4, 24]}
          />
          <PipeRun
            from={[10, heightAt(10, 18) + 4.4, 18]}
            to={[10, heightAt(10, 24) + 4.4, 24]}
            color="#b7a27a"
          />
        </group>
      </InteractiveAsset>

      <InteractiveAsset id="FUEL">
        <group position={[-52, heightAt(-52, -28), -28]}>
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[1.8, 1.8, 3.4, 20]} />
            <meshStandardMaterial color="#c8b48a" metalness={0.55} roughness={0.42} />
          </mesh>
          <mesh position={[4.4, 1.5, 1.4]} castShadow>
            <cylinderGeometry args={[1.5, 1.5, 3, 18]} />
            <meshStandardMaterial color="#b9a67c" metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[2.1, 0.2, 3.6]}>
            <boxGeometry args={[7.2, 0.4, 3.6]} />
            <meshStandardMaterial color="#3a4348" roughness={0.8} />
          </mesh>
        </group>
      </InteractiveAsset>

      <InteractiveAsset id="MICROGRID">
        <group position={[30, heightAt(30, -16), -16]}>
          <mesh position={[0, 2.1, 0]} castShadow>
            <boxGeometry args={[5.2, 4.2, 3.4]} />
            <meshStandardMaterial color="#6d7780" metalness={0.45} roughness={0.5} />
          </mesh>
          <mesh position={[0, 4.45, 0]}>
            <boxGeometry args={[4.4, 0.5, 2.8]} />
            <meshStandardMaterial color="#4d575e" />
          </mesh>
          <mesh position={[3.4, 1.4, 0]} castShadow>
            <boxGeometry args={[1.6, 2.8, 1.6]} />
            <meshStandardMaterial color="#8a5a22" metalness={0.3} roughness={0.55} />
          </mesh>
        </group>
      </InteractiveAsset>
    </group>
  )
}
