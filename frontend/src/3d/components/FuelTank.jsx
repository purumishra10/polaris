import InteractiveAsset from './InteractiveAsset'
export default function FuelTank({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
  }) {
    return (
        <InteractiveAsset id="FUEL">
      <group position={position} rotation={rotation} scale={scale}>
        <mesh castShadow>
          <cylinderGeometry args={[0.7, 0.7, 2.8, 32]} />
          <meshStandardMaterial
            color="#65727c"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
  
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.7, 0.035, 8, 32]} />
          <meshStandardMaterial
            color="#9bb0bc"
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
  
        <mesh position={[0, 1.43, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 16]} />
          <meshStandardMaterial
            color="#303940"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>
      </InteractiveAsset>
    )
  }