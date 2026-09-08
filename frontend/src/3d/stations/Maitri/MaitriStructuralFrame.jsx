import InteractiveAsset from '../../components/InteractiveAsset'
import {
  steelFrame,
  steelBeam,
  floorDeck,
} from './maitriMaterials'

const BUILDING_LENGTH = 26
const BUILDING_DEPTH = 5
const FRAME_HEIGHT = 3.4
const BAY_COUNT = 9
const BAY_SPACING = BUILDING_LENGTH / BAY_COUNT

function VerticalColumn({ x, z }) {
  return (
    <mesh position={[x, FRAME_HEIGHT / 2, z]} castShadow>
      <boxGeometry args={[0.22, FRAME_HEIGHT, 0.22]} />
      <meshStandardMaterial {...steelFrame} />
    </mesh>
  )
}

function DiagonalBrace({ x, z, flip = false }) {
  const angle = flip ? -0.42 : 0.42
  return (
    <mesh
      position={[x, FRAME_HEIGHT * 0.45, z]}
      rotation={[0, 0, angle]}
      castShadow
    >
      <boxGeometry args={[0.12, FRAME_HEIGHT * 0.55, 0.12]} />
      <meshStandardMaterial {...steelFrame} />
    </mesh>
  )
}

export default function MaitriStructuralFrame() {
  const halfLen = BUILDING_LENGTH / 2
  const halfDepth = BUILDING_DEPTH / 2
  const frontZ = halfDepth + 0.15
  const rearZ = -halfDepth - 0.15

  const columnXs = Array.from({ length: BAY_COUNT + 1 }, (_, i) =>
    -halfLen + i * BAY_SPACING,
  )

  return (
    <InteractiveAsset id="STRUCTURE">
      <group>
        {/* Vertical columns — front row */}
        {columnXs.map((x) => (
          <VerticalColumn key={`f-${x}`} x={x} z={frontZ} />
        ))}

        {/* Vertical columns — rear row */}
        {columnXs.map((x) => (
          <VerticalColumn key={`r-${x}`} x={x} z={rearZ} />
        ))}

        {/* Front longitudinal beam at top */}
        <mesh position={[0, FRAME_HEIGHT, frontZ]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH + 0.4, 0.2, 0.2]} />
          <meshStandardMaterial {...steelBeam} />
        </mesh>

        {/* Rear longitudinal beam at top */}
        <mesh position={[0, FRAME_HEIGHT, rearZ]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH + 0.4, 0.2, 0.2]} />
          <meshStandardMaterial {...steelBeam} />
        </mesh>

        {/* Front lower cross beam */}
        <mesh position={[0, 0.35, frontZ]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH + 0.3, 0.18, 0.18]} />
          <meshStandardMaterial {...steelBeam} />
        </mesh>

        {/* Rear lower cross beam */}
        <mesh position={[0, 0.35, rearZ]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH + 0.3, 0.18, 0.18]} />
          <meshStandardMaterial {...steelBeam} />
        </mesh>

        {/* Transverse beams connecting front to rear at each bay */}
        {columnXs.map((x, i) => (
          <group key={`trans-${x}`}>
            <mesh position={[x, FRAME_HEIGHT, 0]} castShadow>
              <boxGeometry args={[0.18, 0.18, BUILDING_DEPTH + 0.5]} />
              <meshStandardMaterial {...steelBeam} />
            </mesh>
            <mesh position={[x, 0.35, 0]} castShadow>
              <boxGeometry args={[0.16, 0.16, BUILDING_DEPTH + 0.4]} />
              <meshStandardMaterial {...steelBeam} />
            </mesh>
            {i % 2 === 0 && (
              <DiagonalBrace x={x} z={frontZ + 0.5} flip={i % 4 === 0} />
            )}
          </group>
        ))}

        {/* Mid-height longitudinal bracing */}
        <mesh position={[0, FRAME_HEIGHT * 0.55, frontZ + 0.5]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH, 0.14, 0.14]} />
          <meshStandardMaterial {...steelFrame} />
        </mesh>
        <mesh position={[0, FRAME_HEIGHT * 0.55, rearZ - 0.5]} castShadow>
          <boxGeometry args={[BUILDING_LENGTH, 0.14, 0.14]} />
          <meshStandardMaterial {...steelFrame} />
        </mesh>

        {/* Floor platform deck */}
        <mesh position={[0, FRAME_HEIGHT - 0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[BUILDING_LENGTH + 0.2, 0.12, BUILDING_DEPTH + 0.3]} />
          <meshStandardMaterial {...floorDeck} />
        </mesh>
      </group>
    </InteractiveAsset>
  )
}

export { BUILDING_LENGTH, BUILDING_DEPTH, FRAME_HEIGHT, BAY_COUNT, BAY_SPACING }
