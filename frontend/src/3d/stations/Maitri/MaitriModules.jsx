import InteractiveAsset from '../../components/InteractiveAsset'

import {
  panelGreyGreen,
  panelGreyGreenAlt,
  fasciaDark,
  roofPanel,
  windowGlass,
  windowFrame,
  doorPanel,
  doorHandle,
  roofEquipmentDark,
  roofEquipmentMid,
  roofVent,
  roofPipe,
} from './maitriMaterials'

import {
  BUILDING_LENGTH,
  BUILDING_DEPTH,
  FRAME_HEIGHT,
  BAY_COUNT,
  BAY_SPACING,
} from './MaitriStructuralFrame'

const BUILDING_HEIGHT = 2.7
const BUILDING_Y = FRAME_HEIGHT + BUILDING_HEIGHT / 2
const HALF_DEPTH = BUILDING_DEPTH / 2

function WindowRow({ z, y, moduleStart, moduleEnd }) {
  const count = 2
  const moduleWidth = moduleEnd - moduleStart
  const spacing = moduleWidth / (count + 1)

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const x = moduleStart + (i + 1) * spacing

        return (
          <group
            key={`${x}-${y}-${z}`}
            position={[x, y, z]}
          >
            {/* DARK GLASS */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.48, 0.62, 0.035]} />
              <meshStandardMaterial
                color="#172A31"
                metalness={0.15}
                roughness={0.18}
              />
            </mesh>

            {/* TOP FRAME */}
            <mesh position={[0, 0.35, 0.035]}>
              <boxGeometry args={[0.60, 0.06, 0.05]} />
              <meshStandardMaterial {...windowFrame} />
            </mesh>

            {/* BOTTOM FRAME */}
            <mesh position={[0, -0.35, 0.035]}>
              <boxGeometry args={[0.60, 0.06, 0.05]} />
              <meshStandardMaterial {...windowFrame} />
            </mesh>

            {/* LEFT FRAME */}
            <mesh position={[-0.27, 0, 0.035]}>
              <boxGeometry args={[0.06, 0.70, 0.05]} />
              <meshStandardMaterial {...windowFrame} />
            </mesh>

            {/* RIGHT FRAME */}
            <mesh position={[0.27, 0, 0.035]}>
              <boxGeometry args={[0.06, 0.70, 0.05]} />
              <meshStandardMaterial {...windowFrame} />
            </mesh>

            {/* CENTER MULLION */}
            <mesh position={[0, 0, 0.055]}>
              <boxGeometry args={[0.035, 0.62, 0.025]} />
              <meshStandardMaterial {...windowFrame} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

function ModuleSection({ bayIndex }) {
  const halfLen = BUILDING_LENGTH / 2
  const moduleStart = -halfLen + bayIndex * BAY_SPACING
  const moduleEnd = moduleStart + BAY_SPACING
  const centerX = (moduleStart + moduleEnd) / 2

  const panelMat =
    bayIndex % 2 === 0
      ? panelGreyGreen
      : panelGreyGreenAlt

  return (
    <group>
      {/* Front wall */}
      <mesh
        position={[centerX, BUILDING_Y, HALF_DEPTH + 0.02]}
        castShadow
      >
        <boxGeometry
          args={[
            BAY_SPACING - 0.08,
            BUILDING_HEIGHT - 0.3,
            0.08,
          ]}
        />
        <meshStandardMaterial {...panelMat} />
      </mesh>

      {/* Rear wall */}
      <mesh
        position={[centerX, BUILDING_Y, -HALF_DEPTH - 0.02]}
        castShadow
      >
        <boxGeometry
          args={[
            BAY_SPACING - 0.08,
            BUILDING_HEIGHT - 0.3,
            0.08,
          ]}
        />
        <meshStandardMaterial {...panelMat} />
      </mesh>

      {/* End caps */}
      {bayIndex === 0 && (
        <mesh
          position={[
            moduleStart - 0.04,
            BUILDING_Y,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.08,
              BUILDING_HEIGHT - 0.2,
              BUILDING_DEPTH,
            ]}
          />
          <meshStandardMaterial {...fasciaDark} />
        </mesh>
      )}

      {bayIndex === BAY_COUNT - 1 && (
        <mesh
          position={[
            moduleEnd + 0.04,
            BUILDING_Y,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.08,
              BUILDING_HEIGHT - 0.2,
              BUILDING_DEPTH,
            ]}
          />
          <meshStandardMaterial {...fasciaDark} />
        </mesh>
      )}

      {/* Module seam */}
      {bayIndex > 0 && (
        <mesh
          position={[moduleStart, BUILDING_Y, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              0.06,
              BUILDING_HEIGHT,
              BUILDING_DEPTH + 0.1,
            ]}
          />
          <meshStandardMaterial {...fasciaDark} />
        </mesh>
      )}

      {/* EXACTLY ONE ROW / TWO WINDOWS PER MODULE */}
      <WindowRow
        z={HALF_DEPTH + 0.06}
        y={BUILDING_Y + 0.05}
        moduleStart={moduleStart}
        moduleEnd={moduleEnd}
      />

      {/* Rear windows */}
      <WindowRow
        z={-HALF_DEPTH - 0.06}
        y={BUILDING_Y + 0.05}
        moduleStart={moduleStart}
        moduleEnd={moduleEnd}
      />
    </group>
  )
}

function MainEntrance() {
  const entranceX = BUILDING_LENGTH / 2 - 2.5
  const doorZ = HALF_DEPTH + 0.08

  return (
    <group
      position={[
        entranceX,
        BUILDING_Y - 0.3,
        doorZ,
      ]}
    >
      {/* Double entrance door */}
      <mesh castShadow>
        <boxGeometry args={[1.4, 2.0, 0.1]} />
        <meshStandardMaterial {...doorPanel} />
      </mesh>

      {/* Door split */}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.035, 1.9, 0.02]} />
        <meshStandardMaterial {...fasciaDark} />
      </mesh>

      {/* Handles */}
      <mesh position={[0.28, 0, 0.07]}>
        <boxGeometry args={[0.06, 0.42, 0.04]} />
        <meshStandardMaterial {...doorHandle} />
      </mesh>

      <mesh position={[-0.28, 0, 0.07]}>
        <boxGeometry args={[0.06, 0.42, 0.04]} />
        <meshStandardMaterial {...doorHandle} />
      </mesh>
    </group>
  )
}

function RoofEquipment() {
  const roofY =
    FRAME_HEIGHT + BUILDING_HEIGHT + 0.1

  return (
    <group>
      {/* Main metal roof */}
      <mesh
        position={[0, roofY, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            BUILDING_LENGTH + 0.1,
            0.18,
            BUILDING_DEPTH + 0.1,
          ]}
        />
        <meshStandardMaterial {...roofPanel} />
      </mesh>

      {/* Roof service housings */}
      <mesh
        position={[-6, roofY + 0.25, -0.8]}
        castShadow
      >
        <boxGeometry args={[2.0, 0.4, 1.2]} />
        <meshStandardMaterial {...roofEquipmentDark} />
      </mesh>

      <mesh
        position={[2, roofY + 0.22, 0.5]}
        castShadow
      >
        <boxGeometry args={[1.6, 0.35, 1.0]} />
        <meshStandardMaterial {...roofEquipmentMid} />
      </mesh>

      <mesh
        position={[7, roofY + 0.2, -0.3]}
        castShadow
      >
        <boxGeometry args={[1.2, 0.3, 0.9]} />
        <meshStandardMaterial {...roofEquipmentDark} />
      </mesh>

      {/* Ventilation units */}
      {[-4, 0, 5].map((x) => (
        <mesh
          key={x}
          position={[x, roofY + 0.18, 1.2]}
          castShadow
        >
          <boxGeometry args={[0.6, 0.25, 0.5]} />
          <meshStandardMaterial {...roofVent} />
        </mesh>
      ))}

      {/* Roof pipe */}
      <mesh
        position={[4, roofY + 0.35, -1.0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry
          args={[0.08, 0.08, 2.5, 12]}
        />
        <meshStandardMaterial {...roofPipe} />
      </mesh>
    </group>
  )
}

function LowerFascia() {
  const fasciaY = FRAME_HEIGHT + 0.15

  return (
    <>
      <mesh
        position={[0, fasciaY, HALF_DEPTH + 0.04]}
        castShadow
      >
        <boxGeometry
          args={[BUILDING_LENGTH + 0.2, 0.28, 0.12]}
        />
        <meshStandardMaterial {...fasciaDark} />
      </mesh>

      <mesh
        position={[0, fasciaY, -HALF_DEPTH - 0.04]}
        castShadow
      >
        <boxGeometry
          args={[BUILDING_LENGTH + 0.2, 0.28, 0.12]}
        />
        <meshStandardMaterial {...fasciaDark} />
      </mesh>
    </>
  )
}

export default function MaitriModules() {
  return (
    <>
      <InteractiveAsset id="STRUCTURE">
        <group>
          {/* Main building volume */}
          <mesh
            position={[0, BUILDING_Y, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                BUILDING_LENGTH,
                BUILDING_HEIGHT,
                BUILDING_DEPTH,
              ]}
            />
            <meshStandardMaterial {...panelGreyGreen} />
          </mesh>

          <LowerFascia />

          {Array.from(
            { length: BAY_COUNT },
            (_, i) => (
              <ModuleSection
                key={i}
                bayIndex={i}
              />
            ),
          )}

          <MainEntrance />
        </group>
      </InteractiveAsset>

      <InteractiveAsset id="THERMAL">
        <RoofEquipment />
      </InteractiveAsset>
    </>
  )
}

export {
  BUILDING_Y,
  BUILDING_HEIGHT,
  FRAME_HEIGHT,
  BUILDING_LENGTH,
  HALF_DEPTH,
}