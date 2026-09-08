import FuelTank from '../../components/FuelTank'
import GeneratorBlock from '../../components/GeneratorBlock'

import Antenna from '../../components/Antenna'
import Radome from '../../components/Radome'

import {
  BUILDING_Y,
  FRAME_HEIGHT,
  BUILDING_LENGTH,
} from './MaitriModules'

import {
  supportModuleGreen,
  supportModuleBlue,
  supportModuleOrange,
  supportModuleGrey,
  fuelBund,
  commsMast,
  commsArm,
} from './maitriMaterials'

function SummerCampModule({
  position,
  material = supportModuleGreen,
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.5, 2.2, 2.8]} />
        <meshStandardMaterial {...material} />
      </mesh>

      <mesh position={[0, 0.3, 1.42]}>
        <boxGeometry args={[2.8, 1.4, 0.06]} />
        <meshStandardMaterial {...supportModuleGrey} />
      </mesh>

      <mesh position={[0, 2.3, 0]} castShadow>
        <boxGeometry args={[3.6, 0.15, 2.9]} />
        <meshStandardMaterial {...supportModuleGrey} />
      </mesh>
    </group>
  )
}

function SecondaryAntenna() {
  const roofY = BUILDING_Y + 1.5

  return (
    <group position={[BUILDING_LENGTH / 2 - 4, roofY, 0]}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.6, 10]} />
        <meshStandardMaterial {...commsMast} />
      </mesh>

      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial {...commsArm} />
      </mesh>
    </group>
  )
}

function MaitriContainer({
  position,
  rotation = [0, 0, 0],
  color,
  accentColor,
}) {
  return (
    <group
      position={position}
      rotation={rotation}
    >
      {/* Main container */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.8, 2.2]} />
        <meshStandardMaterial
          color={color}
          metalness={0.32}
          roughness={0.58}
        />
      </mesh>

      {/* Front access panel */}
      <mesh position={[0, 0, 1.12]}>
        <boxGeometry args={[1.7, 0.9, 0.05]} />
        <meshStandardMaterial
          color={accentColor || color}
          metalness={0.35}
          roughness={0.52}
        />
      </mesh>

      {/* Roof lip */}
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[2.72, 0.08, 2.32]} />
        <meshStandardMaterial
          color={color}
          metalness={0.36}
          roughness={0.54}
        />
      </mesh>

      {/* Vertical corner rails */}
      {[-1.22, 1.22].map((x) => (
        <mesh
          key={`v-${x}`}
          position={[x, 0, 0]}
        >
          <boxGeometry args={[0.07, 1.86, 0.07]} />
          <meshStandardMaterial
            color="#65706D"
            metalness={0.42}
            roughness={0.55}
          />
        </mesh>
      ))}

      {/* Horizontal side rail */}
      <mesh position={[0, 0, -1.13]}>
        <boxGeometry args={[2.5, 0.06, 0.06]} />
        <meshStandardMaterial
          color="#65706D"
          metalness={0.42}
          roughness={0.55}
        />
      </mesh>
    </group>
  )
}

export default function MaitriInfrastructure() {
  const roofY = BUILDING_Y + 1.5

  return (
    <group>
      {/* Fuel farm — west side */}
      <FuelTank
        position={[-18, 1.5, -2]}
        rotation={[0, 0, Math.PI / 2]}
      />

      <FuelTank
        position={[-18, 1.5, 1.5]}
        rotation={[0, 0, Math.PI / 2]}
      />

      <FuelTank
        position={[-18, 1.5, 5]}
        rotation={[0, 0, Math.PI / 2]}
      />

      {/* Fuel containment bund */}
      <mesh position={[-18, 0.12, 1.5]} receiveShadow>
        <boxGeometry args={[4.5, 0.24, 9]} />
        <meshStandardMaterial {...fuelBund} />
      </mesh>

      {/* Generator / microgrid — east side */}
      <GeneratorBlock
        position={[16, 1.2, -1.5]}
      />

      <GeneratorBlock
        position={[16, 1.2, 2.5]}
        scale={0.85}
      />

      {/* Maitri logistics container cluster */}
      <MaitriContainer
        position={[14, 0.9, 6.0]}
        rotation={[0, -0.08, 0]}
        color="#536F80"
        accentColor="#405865"
      />

      <MaitriContainer
        position={[17.0, 0.9, 7.0]}
        rotation={[0, 0.04, 0]}
        color="#B56D3A"
        accentColor="#8F4F2B"
      />

      <MaitriContainer
        position={[14.8, 0.9, 8.1]}
        rotation={[0, 0.02, 0]}
        color="#C79B45"
        accentColor="#9D752D"
      />

      <MaitriContainer
        position={[18.8, 0.9, 8.0]}
        rotation={[0, 0.08, 0]}
        color="#536F80"
        accentColor="#405865"
      />

      {/* Summer camp / support modules */}
      <SummerCampModule
        position={[-10, 1.1, 10]}
        material={supportModuleGreen}
      />

      <SummerCampModule
        position={[8, 1.1, -9]}
        material={supportModuleBlue}
      />

      {/* Communications — rooftop */}
      <Antenna
        position={[-4, roofY, 0.5]}
        scale={1.1}
      />

      <Radome
        position={[6, roofY - 0.3, -0.8]}
        scale={0.9}
      />

      {/* Secondary antenna mast */}
      <SecondaryAntenna />

      
    </group>
  )
}