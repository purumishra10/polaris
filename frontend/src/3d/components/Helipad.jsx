import InteractiveAsset from './InteractiveAsset'

export default function Helipad({
  position = [0, 0, 0],
}) {
  return (
    <InteractiveAsset id="SAFETY">
      <group position={position}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <cylinderGeometry args={[2.4, 2.4, 0.12, 32]} />
          <meshStandardMaterial
            color="#4e5e67"
            metalness={0.35}
            roughness={0.75}
          />
        </mesh>

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.07, 0]}
        >
          <ringGeometry args={[1.75, 1.88, 32]} />
          <meshStandardMaterial
            color="#b7dbe7"
            emissive="#24586d"
            emissiveIntensity={0.7}
          />
        </mesh>

        {/* Center landing marker */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.075, 0]}
        >
          <ringGeometry args={[0.45, 0.5, 32]} />
          <meshStandardMaterial
            color="#b7dbe7"
            emissive="#24586d"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}