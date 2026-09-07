import InteractiveAsset from './InteractiveAsset'
export default function Antenna({
    position = [0, 0, 0],
    scale = 1,
  }) {
    return (
        <InteractiveAsset id="COMMUNICATIONS">
      <group position={position} scale={scale}>
        {/* Mast */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.08, 2.5, 12]} />
          <meshStandardMaterial
            color="#667680"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
  
        {/* Cross arm */}
        <mesh position={[0, 2.15, 0]}>
          <boxGeometry args={[0.9, 0.06, 0.06]} />
          <meshStandardMaterial
            color="#748691"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
  
        {/* Antenna head */}
        <mesh position={[0, 2.35, 0]}>
          <sphereGeometry args={[0.15, 16, 8]} />
          <meshStandardMaterial
            color="#b8d3df"
            metalness={0.75}
            roughness={0.25}
            emissive="#16394b"
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>
      </InteractiveAsset>
    )
  }