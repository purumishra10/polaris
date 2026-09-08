import { useMemo } from 'react'

function severityColor(severity) {
  if (severity === 'CRITICAL') return '#ff4055'
  if (severity === 'ADVISORY') return '#ffb84d'
  return '#64d8a0'
}

function LockdownMarkers() {
  return (
    <group>
      {[-3.8, -1.9, 0, 1.9, 3.8].map((x) => (
        <mesh
          key={x}
          position={[x, 4.35, 2.55]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <boxGeometry args={[0.08, 0.75, 0.08]} />
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

function FuelLevel({ level }) {
  const normalized = Math.max(
    0,
    Math.min(1, level / 600000),
  )

  return (
    <group position={[-7, 1.45, -2]}>
      <mesh>
        <cylinderGeometry args={[0.62, 0.62, 2.5, 32]} />
        <meshStandardMaterial
          color="#18232a"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>

      <mesh
        position={[0, -1.25 + normalized * 1.25, 0]}
      >
        <cylinderGeometry
          args={[
            0.53,
            0.53,
            Math.max(0.03, normalized * 2.5),
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

function GeneratorState({ active }) {
  return (
    <group position={[6.5, 1.3, -2]}>
      <mesh>
        <boxGeometry args={[2.2, 2.4, 2]} />
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
          distance={5}
        />
      )}
    </group>
  )
}

export default function OperationalState({
  telemetry,
}) {
  const severity = telemetry?.risk?.severity ?? 'NOMINAL'

  const color = useMemo(
    () => severityColor(severity),
    [severity],
  )

  if (!telemetry) return null

  return (
    <group>
      {/* Operational status beacon */}
      <mesh position={[0, 7.2, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />

        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={5}
        />
      </mesh>

      <pointLight
        position={[0, 7.2, 0]}
        color={color}
        intensity={severity === 'CRITICAL' ? 5 : 1.5}
        distance={10}
      />

      {/* Fuel visualization */}
      <FuelLevel
        level={telemetry.fuel.tank_level_liters}
      />

      {/* Generator visualization */}
      <GeneratorState
        active={telemetry.controls.aux_generator_active}
      />

      {/* Lockdown visualization */}
      {telemetry.controls.hatch_lockdown && (
        <LockdownMarkers />
      )}
    </group>
  )
}