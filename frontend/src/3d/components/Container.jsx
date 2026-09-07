export default function Container({
    position = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    accent = false,
  }) {
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.8, 0.9]} />
          <meshStandardMaterial
            color={accent ? '#b9d8e8' : '#8998a3'}
            metalness={0.65}
            roughness={0.38}
          />
        </mesh>
  
        {/* Structural seam */}
        <mesh position={[0, 0, 0.456]}>
          <boxGeometry args={[1.35, 0.58, 0.025]} />
          <meshStandardMaterial
            color="#53616b"
            metalness={0.7}
            roughness={0.4}
          />
        </mesh>
  
        {/* Small illuminated panel */}
        <mesh position={[0.45, 0.18, 0.47]}>
          <boxGeometry args={[0.22, 0.12, 0.025]} />
          <meshStandardMaterial
            color="#9bdcff"
            emissive="#3a9ac7"
            emissiveIntensity={accent ? 3 : 1}
          />
        </mesh>
      </group>
    )
  }