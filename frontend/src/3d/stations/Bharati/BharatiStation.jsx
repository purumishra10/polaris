import StructuralPile from '../../components/StructuralPile'
import FuelTank from '../../components/FuelTank'
import Antenna from '../../components/Antenna'
import Radome from '../../components/Radome'
import GeneratorBlock from '../../components/GeneratorBlock'
import Helipad from '../../components/Helipad'
import InteractiveAsset from '../../components/InteractiveAsset'

function StationBody() {
    return (
      <InteractiveAsset id="STRUCTURE">
        <group>
  
          {/* Main aerodynamic Bharati envelope */}
          <mesh
            position={[0, 4.65, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[11.8, 2.1, 4.2]} />
            <meshStandardMaterial
              color="#687781"
              metalness={0.72}
              roughness={0.38}
            />
          </mesh>
  
          {/* Sloped lower front body */}
          <mesh
            position={[0, 3.65, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[1, 1, 1]}
            castShadow
          >
            <boxGeometry args={[4.0, 0.45, 11.4]} />
            <meshStandardMaterial
              color="#4b5962"
              metalness={0.8}
              roughness={0.32}
            />
          </mesh>
  
          {/* Dark underside */}
          <mesh
            position={[0, 3.42, 0]}
            castShadow
          >
            <boxGeometry args={[10.8, 0.22, 3.65]} />
            <meshStandardMaterial
              color="#28343a"
              metalness={0.78}
              roughness={0.4}
            />
          </mesh>
  
          {/* Upper roof */}
          <mesh
            position={[0, 5.76, 0]}
            castShadow
          >
            <boxGeometry args={[11.5, 0.18, 4.0]} />
            <meshStandardMaterial
              color="#87949b"
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
  
          {/* Front dark fascia */}
          <mesh position={[0, 4.75, 2.12]}>
            <boxGeometry args={[11.6, 1.9, 0.12]} />
            <meshStandardMaterial
              color="#303d44"
              metalness={0.65}
              roughness={0.38}
            />
          </mesh>
  
          {/* Long window band */}
          <mesh position={[0.7, 5.0, 2.2]}>
            <boxGeometry args={[8.8, 0.82, 0.06]} />
            <meshStandardMaterial
              color="#14262d"
              metalness={0.2}
              roughness={0.18}
              emissive="#39778a"
              emissiveIntensity={0.3}
            />
          </mesh>
  
          {/* Window mullions */}
          {[-3.2, -1.8, -0.4, 1.0, 2.4, 3.8].map((x) => (
            <mesh
              key={x}
              position={[x, 5.0, 2.25]}
            >
              <boxGeometry args={[0.045, 0.78, 0.035]} />
              <meshStandardMaterial
                color="#75858d"
                metalness={0.75}
                roughness={0.3}
              />
            </mesh>
          ))}
  
          {/* Lower architectural light strip */}
          <mesh position={[0, 3.53, 2.08]}>
            <boxGeometry args={[10.7, 0.07, 0.06]} />
            <meshStandardMaterial
              color="#79c8e6"
              emissive="#1e789c"
              emissiveIntensity={0.8}
            />
          </mesh>
  
        </group>
      </InteractiveAsset>
    )
  }

  function Cantilever() {
    return (
      <InteractiveAsset id="STRUCTURE">
        <group position={[0, 4.55, -2.35]}>
          {/* Projecting lower section */}
          <mesh castShadow>
            <boxGeometry args={[10.2, 1.25, 1.25]} />
            <meshStandardMaterial
              color="#697780"
              metalness={0.72}
              roughness={0.38}
            />
          </mesh>
  
          {/* Dark glazing band */}
          <mesh position={[0, 0.2, -0.66]}>
            <boxGeometry args={[8.6, 0.58, 0.06]} />
            <meshStandardMaterial
              color="#172930"
              metalness={0.2}
              roughness={0.2}
              emissive="#39778a"
              emissiveIntensity={0.3}
            />
          </mesh>
  
          {/* Window divisions */}
          {[-3.4, -2, -0.6, 0.8, 2.2, 3.6].map((x) => (
            <mesh
              key={x}
              position={[x, 0.2, -0.7]}
            >
              <boxGeometry args={[0.045, 0.54, 0.035]} />
              <meshStandardMaterial
                color="#71818a"
                metalness={0.75}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      </InteractiveAsset>
    )
  }
function VColumns() {
  const positions = [-4.5, -1.5, 1.5, 4.5]

  return (
    <InteractiveAsset id="STRUCTURE">
      <group>
        {positions.map((x) => (
          <group key={x}>
            {/* Left leg of V */}
            <mesh
              position={[x - 0.32, 2.0, 0]}
              rotation={[0, 0, -0.17]}
              castShadow
            >
              <boxGeometry args={[0.22, 3.8, 0.22]} />
              <meshStandardMaterial
                color="#3d4a52"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>

            {/* Right leg of V */}
            <mesh
              position={[x + 0.32, 2.0, 0]}
              rotation={[0, 0, 0.17]}
              castShadow
            >
              <boxGeometry args={[0.22, 3.8, 0.22]} />
              <meshStandardMaterial
                color="#3d4a52"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>

            {/* Footing */}
            <mesh
              position={[x, 0.15, 0]}
              castShadow
            >
              <boxGeometry args={[1.15, 0.3, 0.7]} />
              <meshStandardMaterial
                color="#303b42"
                metalness={0.8}
                roughness={0.4}
              />
            </mesh>
          </group>
        ))}
      </group>
    </InteractiveAsset>
  )
}

function SideStructure() {
  return (
    <InteractiveAsset id="STRUCTURE">
      <group>
        {/* Long side beams */}
        <mesh position={[0, 3.65, 2.0]}>
          <boxGeometry args={[11.5, 0.18, 0.18]} />
          <meshStandardMaterial
            color="#52616a"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>

        <mesh position={[0, 3.65, -2.0]}>
          <boxGeometry args={[11.5, 0.18, 0.18]} />
          <meshStandardMaterial
            color="#52616a"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

function Walkway() {
  return (
    <InteractiveAsset id="SAFETY">
      <group position={[0, 1.0, 3.8]}>
        <mesh castShadow>
          <boxGeometry args={[6.5, 0.2, 1.1]} />
          <meshStandardMaterial
            color="#505e67"
            metalness={0.7}
            roughness={0.42}
          />
        </mesh>

        <mesh position={[0, 0.18, 0.48]}>
          <boxGeometry args={[6.4, 0.08, 0.08]} />
          <meshStandardMaterial
            color="#79c8e6"
            emissive="#1e789c"
            emissiveIntensity={0.8}
          />
        </mesh>

        {[-2.4, 0, 2.4].map((x) => (
          <StructuralPile
            key={x}
            position={[x, -0.5, 0]}
            height={2.8}
          />
        ))}
      </group>
    </InteractiveAsset>
  )
}

export default function BharatiStation({
  position = [0, 0, 0],
}) {
  return (
    <group position={position}>
      <StationBody />
      <Cantilever />
      <VColumns />
      <SideStructure />
      <Walkway />

      {/* Communications */}
      <Antenna
        position={[-3.8, 6.15, 0]}
        scale={0.7}
      />

      <Radome
        position={[3.8, 6.0, 0]}
        scale={0.75}
      />

      {/* Fuel infrastructure */}
      <FuelTank
        position={[-7.0, 1.45, -1.8]}
        rotation={[0, 0, Math.PI / 2]}
      />

      <FuelTank
        position={[-7.0, 1.45, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />

      {/* Microgrid */}
      <GeneratorBlock
        position={[6.8, 1.3, -1.8]}
      />

      {/* Helicopter operations */}
      <Helipad
        position={[7.2, 0.08, 4.8]}
      />
    </group>
  )
}