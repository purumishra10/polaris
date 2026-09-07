import Container from '../../components/Container'
import StructuralPile from '../../components/StructuralPile'
import FuelTank from '../../components/FuelTank'
import Antenna from '../../components/Antenna'
import Radome from '../../components/Radome'
import GeneratorBlock from '../../components/GeneratorBlock'
import Helipad from '../../components/Helipad'
import InteractiveAsset from '../../components/InteractiveAsset'
import InteractiveAsset from '../../components/InteractiveAsset'

function StationModules() {
  const modules = []

  /*
   * Bharati is represented as a modular container architecture.
   * We intentionally use a normalized visual scale rather than
   * geographic/engineering dimensions.
   */
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = (column - 3) * 1.55
      const z = (row - 1) * 1.35

      modules.push(
        <Container
          key={`${row}-${column}`}
          position={[x, 4.72, z]}
          scale={[0.82, 0.92, 0.82]}
          accent={(row + column) % 4 === 0}
        />,
      )
    }
  }

  return <group>{modules}</group>
}

function CantileverEnd() {
  return (
    <group position={[0, 5.25, -3.0]}>
      <mesh castShadow>
        <boxGeometry args={[10, 0.5, 1.1]} />
        <meshStandardMaterial
          color="#82929c"
          metalness={0.75}
          roughness={0.35}
        />
      </mesh>

      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[9.5, 0.08, 0.95]} />
        <meshStandardMaterial
          color="#9fc6d4"
          metalness={0.5}
          roughness={0.35}
          emissive="#183f4e"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  )
}

function VColumns() {
  const positions = [
    [-4.5, 0, -1.6],
    [-1.5, 0, -1.6],
    [1.5, 0, -1.6],
    [4.5, 0, -1.6],
    [-4.5, 0, 1.6],
    [-1.5, 0, 1.6],
    [1.5, 0, 1.6],
    [4.5, 0, 1.6],
  ]

  return (
    <group>
      {positions.map(([x, , z], index) => (
        <group
          key={index}
          position={[x, 0, z]}
        >
          <StructuralPile
            position={[-0.25, 0, 0]}
            height={3.8}
          />

          <StructuralPile
            position={[0.25, 0, 0]}
            height={3.8}
          />

          <mesh
            position={[0, 2.15, 0]}
            rotation={[
              0,
              0,
              index % 2 === 0 ? -0.12 : 0.12,
            ]}
          >
            <boxGeometry args={[0.15, 3.5, 0.15]} />
            <meshStandardMaterial
              color="#3e4b54"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Walkway() {
  return (
    <group position={[0, 3.9, 3.6]}>
      <mesh castShadow>
        <boxGeometry args={[7, 0.22, 1.1]} />
        <meshStandardMaterial
          color="#56656f"
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>

      {[-2.5, 0, 2.5].map((x) => (
        <StructuralPile
          key={x}
          position={[x, 0, 0]}
          height={3.7}
        />
      ))}
    </group>
  )
}

export default function BharatiStation({
  position = [0, 0, 0],
}) {
  return (
    <group position={position}>
      <VColumns />

      <MainPlatform />

      <StationModules />

      <CantileverEnd />

      <Walkway />

      {/* Communications */}
      <Antenna
        position={[-3.7, 4.9, 0]}
        scale={0.7}
      />

      <Radome
        position={[3.7, 5.15, 0]}
        scale={0.8}
      />

      {/* Fuel infrastructure */}
      <FuelTank
        position={[-7, 1.45, -2]}
        rotation={[0, 0, Math.PI / 2]}
        scale={1}
      />

      <FuelTank
        position={[-7, 1.45, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={1}
      />

      {/* Microgrid generator */}
      <GeneratorBlock
        position={[6.5, 1.3, -2]}
      />

      {/* Helipad */}
      <Helipad
        position={[7, 0.08, 4.8]}
      />
    </group>
  )
}