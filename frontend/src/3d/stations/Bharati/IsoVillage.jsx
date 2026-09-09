import InteractiveAsset from '../../components/InteractiveAsset'
import { heightAt } from '../../environment/terrainHeight'

const ISO = [6.06, 2.59, 2.44]

function IsoBox({ x, z, color, stacked = false, rotation = 0, yOffset = 0 }) {
  const y = heightAt(x, z) + yOffset

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, ISO[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={ISO} />
        <meshStandardMaterial color={color} metalness={0.38} roughness={0.58} />
      </mesh>
      {[-2.2, -1.1, 0, 1.1, 2.2].map((rib) => (
        <mesh key={rib} position={[rib, ISO[1] / 2, 1.23]}>
          <boxGeometry args={[0.08, 2.4, 0.04]} />
          <meshStandardMaterial color="#1a2228" roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, ISO[1] / 2, 1.24]}>
        <boxGeometry args={[2.1, 2.05, 0.05]} />
        <meshStandardMaterial color="#12181c" roughness={0.4} />
      </mesh>
      {stacked && (
        <group position={[0, ISO[1], 0]}>
          <mesh position={[0, ISO[1] / 2, 0]} castShadow>
            <boxGeometry args={ISO} />
            <meshStandardMaterial color={color} metalness={0.38} roughness={0.58} />
          </mesh>
          <mesh position={[0, ISO[1] / 2, 1.24]}>
            <boxGeometry args={[5.7, 2.1, 0.04]} />
            <meshStandardMaterial color="#1a2228" />
          </mesh>
        </group>
      )}
    </group>
  )
}

export default function IsoVillage() {
  return (
    <InteractiveAsset id="CONTAINERS">
      <group>
        <IsoBox x={-31} z={-16} color="#f05a14" />
        <IsoBox x={-31} z={-19.1} color="#e84810" />
        <IsoBox x={-31} z={-22.2} color="#f2c14b" stacked />
        <IsoBox x={-38} z={-16} color="#0b5cad" />
        <IsoBox x={-38} z={-19.1} color="#f05a14" stacked />
        <IsoBox x={-24.5} z={-20.5} color="#138a6a" rotation={0.14} />
        <IsoBox x={-45} z={-14} color="#f05a14" rotation={-0.1} />
        <IsoBox x={-38} z={-24.4} color="#0b5cad" />
        <IsoBox x={-24.5} z={-16} color="#f2c14b" />
        <IsoBox x={34} z={-20} color="#f05a14" />
        <IsoBox x={34} z={-23.1} color="#f2c14b" />
        <IsoBox x={40.6} z={-20} color="#0b5cad" stacked />
        <IsoBox x={40.6} z={-23.1} color="#138a6a" />
      </group>
    </InteractiveAsset>
  )
}
