import InteractiveAsset from '../../components/InteractiveAsset'
import { heightAt } from '../../environment/terrainHeight'

function PistenBully({ x, z, rotation = 0 }) {
  const y = heightAt(x, z)

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[3.4, 1.15, 6.4]} />
        <meshStandardMaterial color="#b42318" metalness={0.25} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.85, -0.6]} castShadow>
        <boxGeometry args={[2.9, 0.9, 3.1]} />
        <meshStandardMaterial color="#9e1c14" metalness={0.22} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, 0.55]}>
        <boxGeometry args={[2.5, 0.7, 1.4]} />
        <meshStandardMaterial
          color="#142430"
          metalness={0.2}
          roughness={0.15}
          emissive="#3a5060"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh position={[-1.55, 0.55, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[0.55, 0.7, 6.2]} />
        <meshStandardMaterial color="#1c1f22" roughness={0.8} />
      </mesh>
      <mesh position={[1.55, 0.55, 0]} rotation={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[0.55, 0.7, 6.2]} />
        <meshStandardMaterial color="#1c1f22" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Helipad({ x, z, radius = 7.2 }) {
  const y = heightAt(x, z) + 0.05

  return (
    <group position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 36]} />
        <meshStandardMaterial color="#d5d0c4" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[radius * 0.72, radius * 0.86, 36]} />
        <meshStandardMaterial color="#c45a24" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.3, 8]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
    </group>
  )
}

export default function OpsVehicles() {
  return (
    <group>
      <InteractiveAsset id="VEHICLES">
        <group>
          <PistenBully x={16} z={12} rotation={-0.55} />
          <PistenBully x={9} z={18} rotation={0.22} />
        </group>
      </InteractiveAsset>

      <InteractiveAsset id="SAFETY">
        <group>
          <Helipad x={-22} z={48} />
          <Helipad x={-6} z={52} radius={6.4} />
        </group>
      </InteractiveAsset>
    </group>
  )
}
