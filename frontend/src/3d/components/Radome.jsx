import InteractiveAsset from './InteractiveAsset'
export default function Radome({
    position = [0, 0, 0],
    scale = 1,
  }) {
    return (
        <InteractiveAsset id="COMMUNICATIONS">
      <group position={position} scale={scale}>
        <mesh castShadow>
          <sphereGeometry
            args={[0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#d8e7ed"
            metalness={0.15}
            roughness={0.6}
          />
        </mesh>
  
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.76, 0.76, 0.08, 32]} />
          <meshStandardMaterial
            color="#53616b"
            metalness={0.8}
            roughness={0.35}
          />
        </mesh>
      </group>
      </InteractiveAsset>
    )
  }