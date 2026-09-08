import InteractiveAsset from '../../components/InteractiveAsset'
import { heightAt } from '../../environment/terrainHeight'

export default function RadomeRidge() {
  const x = -74
  const z = -70
  const y = heightAt(x, z)

  return (
    <InteractiveAsset id="COMMUNICATIONS">
      <group position={[x, y, z]}>
        <mesh position={[0, 3.4, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.6, 6.8, 12]} />
          <meshStandardMaterial color="#9aa4aa" metalness={0.45} roughness={0.5} />
        </mesh>
        <mesh position={[0, 8.4, 0]} castShadow>
          <sphereGeometry args={[3.4, 28, 20]} />
          <meshStandardMaterial
            color="#e4e8ea"
            roughness={0.55}
            metalness={0.08}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}
