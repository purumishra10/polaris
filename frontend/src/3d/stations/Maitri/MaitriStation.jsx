import InteractiveAsset from '../../components/InteractiveAsset'
import StructuralPile from '../../components/StructuralPile'
import FuelTank from '../../components/FuelTank'
import Antenna from '../../components/Antenna'
import Radome from '../../components/Radome'
import GeneratorBlock from '../../components/GeneratorBlock'
import Helipad from '../../components/Helipad'
import { maitriAnchors } from './maitriAnchors'
function MainBuilding() {
  return (
    <InteractiveAsset id="STRUCTURE">
      <group>
        {/* Main elevated station body */}
        <mesh
          position={[0, 2.55, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[8.4, 3.0, 4.8]} />
          <meshStandardMaterial
            color="#687781"
            metalness={0.68}
            roughness={0.38}
          />
        </mesh>

        {/* Dark lower underside */}
        <mesh
          position={[0, 1.05, 0]}
          castShadow
        >
          <boxGeometry args={[8.55, 0.22, 4.95]} />
          <meshStandardMaterial
            color="#303c43"
            metalness={0.78}
            roughness={0.38}
          />
        </mesh>

        {/* Front architectural face */}
        <mesh
          position={[0, 2.55, 2.43]}
        >
          <boxGeometry args={[8.1, 2.7, 0.10]} />
          <meshStandardMaterial
            color="#26343b"
            metalness={0.55}
            roughness={0.35}
          />
        </mesh>

        {/* Continuous front window band */}
        <mesh
          position={[0, 2.85, 2.50]}
        >
          <boxGeometry args={[7.2, 0.82, 0.06]} />
          <meshStandardMaterial
            color="#142a32"
            metalness={0.2}
            roughness={0.18}
            emissive="#39778a"
            emissiveIntensity={0.35}
          />
        </mesh>

        {/* Window divisions */}
        {[-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].map((x) => (
          <mesh
            key={x}
            position={[x, 2.85, 2.54]}
          >
            <boxGeometry args={[0.045, 0.78, 0.035]} />
            <meshStandardMaterial
              color="#71818a"
              metalness={0.75}
              roughness={0.3}
            />
          </mesh>
        ))}

        {/* Smaller lower windows */}
        {[-2.7, -1.35, 0, 1.35, 2.7].map((x) => (
          <mesh
            key={`lower-${x}`}
            position={[x, 1.85, 2.51]}
          >
            <boxGeometry args={[0.8, 0.42, 0.05]} />
            <meshStandardMaterial
              color="#18282f"
              emissive="#315d6c"
              emissiveIntensity={0.25}
              metalness={0.2}
              roughness={0.25}
            />
          </mesh>
        ))}

        {/* Lower illuminated edge */}
        <mesh
          position={[0, 1.18, 2.52]}
        >
          <boxGeometry args={[7.8, 0.07, 0.06]} />
          <meshStandardMaterial
            color="#79c8e6"
            emissive="#1e789c"
            emissiveIntensity={0.9}
          />
        </mesh>

        {/* Roof slab */}
        <mesh
          position={[0, 4.10, 0]}
          castShadow
        >
          <boxGeometry args={[8.0, 0.20, 4.45]} />
          <meshStandardMaterial
            color="#53616a"
            metalness={0.72}
            roughness={0.38}
          />
        </mesh>

        {/* Roof service housings */}
        <mesh
          position={[-2.0, 4.30, -0.7]}
          castShadow
        >
          <boxGeometry args={[1.4, 0.35, 1.0]} />
          <meshStandardMaterial
            color="#3e4b53"
            metalness={0.72}
            roughness={0.4}
          />
        </mesh>

        <mesh
          position={[1.2, 4.30, -0.5]}
          castShadow
        >
          <boxGeometry args={[1.8, 0.28, 1.1]} />
          <meshStandardMaterial
            color="#46545c"
            metalness={0.72}
            roughness={0.4}
          />
        </mesh>

        {/* Roof service pipe */}
        <mesh
          position={[2.6, 4.42, 0.4]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.10, 0.10, 1.5, 16]} />
          <meshStandardMaterial
            color="#71818a"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

function SupportStructure() {
  return (
    <InteractiveAsset id="STRUCTURE">
      <group>
        {/* Front supports */}
        {[-3, -1, 1, 3].map((x) => (
          <StructuralPile
            key={`front-${x}`}
            position={[x, 0.45, -1.65]}
            height={3.8}
          />
        ))}

        {/* Rear supports */}
        {[-3, -1, 1, 3].map((x) => (
          <StructuralPile
            key={`rear-${x}`}
            position={[x, 0.45, 1.65]}
            height={3.8}
          />
        ))}

        {/* Front cross beam */}
        <mesh
          position={[0, 0.55, -1.65]}
          castShadow
        >
          <boxGeometry args={[7.2, 0.22, 0.22]} />
          <meshStandardMaterial
            color="#414d55"
            metalness={0.82}
            roughness={0.35}
          />
        </mesh>

        {/* Rear cross beam */}
        <mesh
          position={[0, 0.55, 1.65]}
          castShadow
        >
          <boxGeometry args={[7.2, 0.22, 0.22]} />
          <meshStandardMaterial
            color="#414d55"
            metalness={0.82}
            roughness={0.35}
          />
        </mesh>

        {/* Central structural beam */}
        <mesh
          position={[0, 0.75, 0]}
          castShadow
        >
          <boxGeometry args={[7.0, 0.18, 0.18]} />
          <meshStandardMaterial
            color="#37434b"
            metalness={0.82}
            roughness={0.35}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

function Walkway() {
  return (
    <InteractiveAsset id="SAFETY">
      <group position={[0, 0.95, 3.55]}>
        {/* Main access walkway */}
        <mesh castShadow>
          <boxGeometry args={[4.8, 0.18, 1.2]} />
          <meshStandardMaterial
            color="#56656e"
            metalness={0.65}
            roughness={0.45}
          />
        </mesh>

        {/* Illuminated edge */}
        <mesh position={[0, 0.14, 0.52]}>
          <boxGeometry args={[4.5, 0.07, 0.06]} />
          <meshStandardMaterial
            color="#79c8e6"
            emissive="#1e789c"
            emissiveIntensity={0.8}
          />
        </mesh>

        {/* Walkway supports */}
        {[-1.8, 0, 1.8].map((x) => (
          <StructuralPile
            key={x}
            position={[x, -0.45, 0]}
            height={1.2}
          />
        ))}
      </group>
    </InteractiveAsset>
  )
}

export default function MaitriStation({
  position = [0, 0, 0],
}) {
  return (
    <group position={position}>
      <MainBuilding />
      <SupportStructure />
      <Walkway />

      {/* Communications */}
      <Antenna
        position={[-2.8, 4.45, 0]}
        scale={0.7}
      />

      <Radome
        position={[2.6, 4.45, 0]}
        scale={0.7}
      />

      {/* Fuel infrastructure */}
      <FuelTank
        position={[-5.5, 1.45, -1.6]}
        rotation={[0, 0, Math.PI / 2]}
      />

      <FuelTank
        position={[-5.5, 1.45, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />

      {/* Microgrid / utility */}
      <GeneratorBlock
        position={[5.2, 1.3, -1.5]}
      />

      {/* Safety / flight operations */}
      <Helipad
        position={[6.5, 0.08, 3.8]}
      />
    </group>
  )
}