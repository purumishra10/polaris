export default function StructuralPile({
    position = [0, 0, 0],
    height = 2.4,
  }) {
    return (
      <mesh position={[position[0], height / 2, position[2]]}>
        <boxGeometry args={[0.28, height, 0.28]} />
        <meshStandardMaterial
          color="#46515b"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
    )
  }