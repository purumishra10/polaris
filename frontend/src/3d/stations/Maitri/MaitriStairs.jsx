import InteractiveAsset from '../../components/InteractiveAsset'

import {
  walkwaySteel,
  stairSteel,
  stairTread,
  railingSteel,
  steelFrame,
  steelBeam,
} from './maitriMaterials'

import {
  FRAME_HEIGHT,
  BUILDING_LENGTH,
  HALF_DEPTH,
} from './MaitriModules'

const ENTRANCE_X = BUILDING_LENGTH / 2 - 2.5
const PLATFORM_Y = FRAME_HEIGHT

// Front entrance landing
const LANDING_Z = HALF_DEPTH + 1.45

// Stairs descend away from the building
const STAIR_LENGTH = 4.4
const STAIR_TOP_Z = LANDING_Z + 0.75

function Railing({
  start,
  end,
  y,
  z,
}) {
  const length = Math.abs(end - start)
  const centerX = (start + end) / 2

  const postCount = Math.max(
    2,
    Math.floor(length / 1.2) + 1,
  )

  return (
    <group>
      {/* Top rail */}
      <mesh
        position={[
          centerX,
          y + 0.55,
          z,
        ]}
      >
        <boxGeometry args={[length, 0.06, 0.06]} />
        <meshStandardMaterial {...railingSteel} />
      </mesh>

      {/* Vertical posts */}
      {Array.from(
        { length: postCount },
        (_, i) => {
          const x =
            start +
            (i / (postCount - 1)) *
              (end - start)

          return (
            <mesh
              key={i}
              position={[
                x,
                y + 0.28,
                z,
              ]}
            >
              <boxGeometry args={[0.06, 0.56, 0.06]} />
              <meshStandardMaterial {...railingSteel} />
            </mesh>
          )
        },
      )}
    </group>
  )
}

function StairStep({
  x,
  y,
  z,
  width = 1.8,
}) {
  return (
    <group position={[x, y, z]}>
      {/* Light stair frame */}
      <mesh
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[width, 0.14, 0.55]}
        />
        <meshStandardMaterial {...stairSteel} />
      </mesh>

      {/* Dark grated tread */}
      <mesh
        position={[0, 0.08, 0]}
        castShadow
      >
        <boxGeometry
          args={[width - 0.08, 0.025, 0.48]}
        />
        <meshStandardMaterial {...stairTread} />
      </mesh>
    </group>
  )
}

function GratedBridge() {
  const bridgeWidth = 2.8
  const bridgeLength = 6.5

  const bridgeZ =
    STAIR_TOP_Z +
    STAIR_LENGTH +
    bridgeLength / 2 -
    0.25

  return (
    <group>
      {/* Main grated access bridge */}
      <mesh
        position={[
          ENTRANCE_X,
          0.22,
          bridgeZ,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            bridgeWidth,
            0.14,
            bridgeLength,
          ]}
        />
        <meshStandardMaterial {...walkwaySteel} />
      </mesh>

      {/* Longitudinal edge beams */}
      {[
        -bridgeWidth / 2,
        bridgeWidth / 2,
      ].map((x) => (
        <mesh
          key={x}
          position={[
            ENTRANCE_X + x,
            0.31,
            bridgeZ,
          ]}
        >
          <boxGeometry
            args={[
              0.08,
              0.18,
              bridgeLength,
            ]}
          />
          <meshStandardMaterial {...stairSteel} />
        </mesh>
      ))}

      {/* Visible grate cross-bars */}
      {Array.from(
        { length: 18 },
        (_, i) => {
          const z =
            STAIR_TOP_Z +
            STAIR_LENGTH +
            0.2 +
            i * 0.35

          return (
            <mesh
              key={i}
              position={[
                ENTRANCE_X,
                0.305,
                z,
              ]}
            >
              <boxGeometry
                args={[
                  bridgeWidth,
                  0.025,
                  0.035,
                ]}
              />
              <meshStandardMaterial {...stairTread} />
            </mesh>
          )
        },
      )}

      {/* Bridge rails */}
      {[
        -bridgeWidth / 2,
        bridgeWidth / 2,
      ].map((x) => (
        <group key={x}>
          {/* Top rail */}
          <mesh
            position={[
              ENTRANCE_X + x,
              0.85,
              bridgeZ,
            ]}
          >
            <boxGeometry
              args={[
                0.06,
                0.06,
                bridgeLength,
              ]}
            />
            <meshStandardMaterial {...railingSteel} />
          </mesh>

          {/* Rail posts */}
          {Array.from(
            { length: 7 },
            (_, i) => {
              const z =
                STAIR_TOP_Z +
                STAIR_LENGTH +
                i * 1.0

              return (
                <mesh
                  key={i}
                  position={[
                    ENTRANCE_X + x,
                    0.55,
                    z,
                  ]}
                >
                  <boxGeometry
                    args={[
                      0.06,
                      0.55,
                      0.06,
                    ]}
                  />
                  <meshStandardMaterial {...railingSteel} />
                </mesh>
              )
            },
          )}
        </group>
      ))}
    </group>
  )
}

export default function MaitriStairs() {
  const stepCount = 8

  const stepRise =
    PLATFORM_Y / stepCount

  const stepRun =
    STAIR_LENGTH / stepCount

  const stairTopY =
    PLATFORM_Y - stepRise / 2

  return (
    <InteractiveAsset id="SAFETY">
      <group>

        {/* =========================================
            ENTRANCE LANDING
        ========================================= */}

        <mesh
          position={[
            ENTRANCE_X,
            PLATFORM_Y + 0.08,
            LANDING_Z,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[3.0, 0.16, 2.0]}
          />
          <meshStandardMaterial {...walkwaySteel} />
        </mesh>

        {/* RED structural landing supports */}
        {[-1.1, 1.1].map((dx) => (
          <mesh
            key={dx}
            position={[
              ENTRANCE_X + dx,
              PLATFORM_Y / 2,
              LANDING_Z,
            ]}
            castShadow
          >
            <boxGeometry
              args={[
                0.18,
                PLATFORM_Y,
                0.18,
              ]}
            />
            <meshStandardMaterial {...steelFrame} />
          </mesh>
        ))}

        {/* RED landing front beam */}
        <mesh
          position={[
            ENTRANCE_X,
            PLATFORM_Y - 0.12,
            LANDING_Z + 0.85,
          ]}
          castShadow
        >
          <boxGeometry
            args={[3.0, 0.18, 0.18]}
          />
          <meshStandardMaterial {...steelBeam} />
        </mesh>

        {/* RED diagonal landing braces */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[
              ENTRANCE_X + side * 1.1,
              PLATFORM_Y * 0.43,
              LANDING_Z + 0.55,
            ]}
            rotation={[
              0.55,
              0,
              side * 0.35,
            ]}
            castShadow
          >
            <boxGeometry
              args={[0.12, PLATFORM_Y * 0.72, 0.12]}
            />
            <meshStandardMaterial {...steelFrame} />
          </mesh>
        ))}

        {/* =========================================
            STAIRS
        ========================================= */}

        {Array.from(
          { length: stepCount },
          (_, i) => (
            <StairStep
              key={i}
              x={ENTRANCE_X}
              y={
                stairTopY -
                i * stepRise
              }
              z={
                STAIR_TOP_Z +
                i * stepRun
              }
              width={1.8}
            />
          ),
        )}

        {/* Grey/white stair stringers */}
        {[-0.84, 0.84].map((x) => (
          <mesh
            key={x}
            position={[
              ENTRANCE_X + x,
              PLATFORM_Y / 2,
              STAIR_TOP_Z +
                STAIR_LENGTH / 2,
            ]}
            rotation={[
              -Math.atan(
                PLATFORM_Y /
                  STAIR_LENGTH,
              ),
              0,
              0,
            ]}
            castShadow
          >
            <boxGeometry
              args={[
                0.1,
                PLATFORM_Y * 1.15,
                0.1,
              ]}
            />
            <meshStandardMaterial {...stairSteel} />
          </mesh>
        ))}

        {/* =========================================
            LANDING RAILINGS
        ========================================= */}

        <Railing
          start={ENTRANCE_X - 1.35}
          end={ENTRANCE_X + 1.35}
          y={PLATFORM_Y}
          z={LANDING_Z - 0.8}
        />

        {/* =========================================
            SLOPED STAIR RAILINGS
        ========================================= */}

        {[-0.95, 0.95].map((x) => {
          const railAngle =
            Math.atan(
              PLATFORM_Y /
                STAIR_LENGTH,
            )

          const railLength =
            Math.sqrt(
              STAIR_LENGTH ** 2 +
              PLATFORM_Y ** 2,
            )

          return (
            <group key={x}>

              {/* Sloped handrail */}
              <mesh
                position={[
                  ENTRANCE_X + x,
                  PLATFORM_Y / 2 + 0.55,
                  STAIR_TOP_Z +
                    STAIR_LENGTH / 2,
                ]}
                rotation={[
                  railAngle,
                  0,
                  0,
                ]}
              >
                <boxGeometry
                  args={[
                    0.07,
                    0.07,
                    railLength,
                  ]}
                />
                <meshStandardMaterial {...railingSteel} />
              </mesh>

              {/* Rail posts */}
              {Array.from(
                { length: 5 },
                (_, i) => {
                  const t = i / 4

                  const z =
                    STAIR_TOP_Z +
                    t * STAIR_LENGTH

                  const y =
                    PLATFORM_Y -
                    t * PLATFORM_Y +
                    0.28

                  return (
                    <mesh
                      key={i}
                      position={[
                        ENTRANCE_X + x,
                        y,
                        z,
                      ]}
                    >
                      <boxGeometry
                        args={[
                          0.06,
                          0.56,
                          0.06,
                        ]}
                      />
                      <meshStandardMaterial {...railingSteel} />
                    </mesh>
                  )
                },
              )}
            </group>
          )
        })}

        {/* =========================================
            CENTRAL ACCESS BRIDGE
        ========================================= */}

        <GratedBridge />

      </group>
    </InteractiveAsset>
  )
}