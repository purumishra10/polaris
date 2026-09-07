export default function MaitriStation({
    position = [0, 0, 0],
  }) {
    return (
      <group position={position}>
        <mesh position={[0, 2, 0]} castShadow>
          <boxGeometry args={[8, 3, 5]} />
          <meshStandardMaterial
            color="#687781"
            metalness={0.65}
            roughness={0.4}
          />
        </mesh>
  
        {[-3, -1, 1, 3].map((x) => (
          <mesh
            key={x}
            position={[x, 0.9, 0]}
          >
            <boxGeometry args={[0.25, 1.8, 0.25]} />
            <meshStandardMaterial
              color="#414d55"
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>
    )
  }