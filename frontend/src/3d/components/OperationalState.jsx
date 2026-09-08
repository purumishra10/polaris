import { useMemo } from 'react'

function severityColor(severity) {
  if (severity === 'CRITICAL') return '#ff4055'
  if (severity === 'ADVISORY') return '#ffb84d'
  return '#64d8a0'
}

function LockdownMarkers({ station }) {
  const xs =
    station === 'BHARATI'
      ? [-18, -9, 0, 9, 18]
      : [-3.8, -1.9, 0, 1.9, 3.8]
  const y = station === 'BHARATI' ? 12.35 : 4.35
  const z = station === 'BHARATI' ? 15.22 : 2.55
  const width = station === 'BHARATI' ? 1.4 : 0.75

  return (
    <group>
      {xs.map((x) => (
        <mesh
          key={x}
          position={[x, y, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <boxGeometry args={[0.08, width, 0.08]} />
          <meshStandardMaterial
            color="#ff4055"
            emissive="#ff2038"
            emissiveIntensity={4}
          />
        </mesh>
      ))}
    </group>
  )
}

function FuelLevel({ level, station }) {
  const normalized = Math.max(
    0,
    Math.min(1, level / 600000),
  )
  const position =
    station === 'BHARATI' ? [-58, 1.8, -28] : [-7, 1.45, -2]
  const height = station === 'BHARATI' ? 3.2 : 2.5
  const radius = station === 'BHARATI' ? 0.85 : 0.62

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial
          color="#18232a"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>

      <mesh
        position={[0, -height / 2 + normalized * (height / 2), 0]}
      >
        <cylinderGeometry
          args={[
            radius * 0.85,
            radius * 0.85,
            Math.max(0.03, normalized * height),
            24,
          ]}
        />

        <meshStandardMaterial
          color="#56b9d8"
          emissive="#1e8cad"
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

function GeneratorState({ active, station }) {
  const position =
    station === 'BHARATI' ? [36, 1.6, -16] : [6.5, 1.3, -2]
  const size = station === 'BHARATI' ? [2.4, 2.8, 2.2] : [2.2, 2.4, 2]

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={active ? '#465b62' : '#303b42'}
          metalness={0.75}
          roughness={0.35}
          emissive={active ? '#4c8f6d' : '#000000'}
          emissiveIntensity={active ? 1.4 : 0}
        />
      </mesh>

      {active && (
        <pointLight
          position={[0, 0.4, 1.1]}
          color="#64d8a0"
          intensity={3}
          distance={station === 'BHARATI' ? 12 : 5}
        />
      )}
    </group>
  )
}

export default function OperationalState({
  telemetry,
  station = 'MAITRI',
}) {
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'

  const color = useMemo(
    () => severityColor(severity),
    [severity],
  )

  if (!telemetry) return null

  const beaconY = station === 'BHARATI' ? 17.2 : 7.2
  const lightDistance = station === 'BHARATI' ? 28 : 10

  return (
    <group>
      <mesh position={[0, beaconY, 0]}>
        <sphereGeometry args={[station === 'BHARATI' ? 0.22 : 0.16, 16, 16]} />

        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={5}
        />
      </mesh>

      <pointLight
        position={[0, beaconY, 0]}
        color={color}
        intensity={severity === 'CRITICAL' ? 5 : 1.5}
        distance={lightDistance}
      />

      <FuelLevel
        level={telemetry.fuel.tank_level_liters}
        station={station}
      />

      <GeneratorState
        active={telemetry.controls.aux_generator_active}
        station={station}
      />

      {telemetry.controls.hatch_lockdown && (
        <LockdownMarkers station={station} />
      )}
    </group>
  )
}
