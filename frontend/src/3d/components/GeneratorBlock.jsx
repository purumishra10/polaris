import InteractiveAsset from './InteractiveAsset'

export default function GeneratorBlock({
  position = [0, 0, 0],
  scale = 1,
}) {
  return (
    <InteractiveAsset id="MICROGRID">
      <group position={position} scale={scale}>
        {/* Main generator housing */}
        <mesh castShadow>
          <boxGeometry args={[2.2, 2.4, 2]} />
          <meshStandardMaterial
            color="#46535c"
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>

        {/* Ventilation panel */}
        <mesh position={[0, 0.2, 1.02]}>
          <boxGeometry args={[1.4, 1.1, 0.06]} />
          <meshStandardMaterial
            color="#263138"
            metalness={0.6}
            roughness={0.5}
          />
        </mesh>

        {/* Status strip */}
        <mesh position={[0, 0.85, 1.05]}>
          <boxGeometry args={[1.1, 0.08, 0.04]} />
          <meshStandardMaterial
            color="#79c8e6"
            emissive="#1e789c"
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}