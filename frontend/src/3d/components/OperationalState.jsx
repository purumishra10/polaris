import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

import { heightAt } from '../environment/terrainHeight'
import ResupplyAlarm from './ResupplyAlarm'

// Eases a scalar toward `goal` each frame; returns the ref holding the value.
function useEased(goal, rate = 1.4) {
  const value = useRef(goal)
  useFrame((_, delta) => {
    const diff = goal - value.current
    if (Math.abs(diff) < 1e-4) {
      value.current = goal
      return
    }
    value.current += diff * (1 - Math.exp(-Math.min(delta, 0.1) * rate))
  })
  return value
}

function severityColor(severity) {
  if (severity === 'CRITICAL') return '#ff4055'
  if (severity === 'ADVISORY') return '#ffb84d'
  return '#64d8a0'
}

function LockdownMarkers({ station }) {
  const xs =
    station === 'BHARATI'
      ? [-18, -9, 0, 9, 18]
      : [-10, -7, -4, -1, 2, 5, 8]
  const y = station === 'BHARATI' ? 12.35 : 5.3
  const z = station === 'BHARATI' ? 15.22 : 2.56
  const width = station === 'BHARATI' ? 1.4 : 0.55

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

function FuelLevel({ level, station, scarcity = 0 }) {
  const normalized = Math.max(0, Math.min(1, level / 600000))
  // Ease the fill so a resupply-delay injection drains visibly, not instantly
  const eased = useEased(normalized, 0.9)
  const fill = useRef()
  const fillMat = useRef()

  const isBharati = station === 'BHARATI'
  const height = isBharati ? 3.4 : 2.8
  const radius = isBharati ? 1.52 : 0.7 * 0.85

  useFrame(({ clock }) => {
    if (!fill.current) return
    const h = Math.max(0.03, eased.current * height)
    fill.current.scale.y = h
    fill.current.position.y = isBharati ? h / 2 : -height / 2 + h / 2
    if (fillMat.current) {
      // Fuel glow shifts from cyan to warning amber/red as reserves fall
      const warn = Math.max(0, Math.min(1, scarcity))
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2)
      fillMat.current.color.setRGB(
        0.34 + warn * 0.66,
        0.73 - warn * 0.5,
        0.85 - warn * 0.6,
      )
      fillMat.current.emissive.setRGB(
        0.12 + warn * 0.85,
        0.55 - warn * 0.4,
        0.68 - warn * 0.55,
      )
      fillMat.current.emissiveIntensity = 1.5 + warn * (1.2 + pulse * 1.6)
    }
  })

  if (isBharati) {
    const ground = heightAt(-52, -28)
    return (
      <group position={[-52, ground, -28]}>
        <mesh ref={fill} position={[0, height / 2, 0]}>
          <cylinderGeometry args={[radius, radius, 1, 24]} />
          <meshStandardMaterial
            ref={fillMat}
            color="#56b9d8"
            emissive="#1e8cad"
            emissiveIntensity={1.6}
            transparent
            opacity={0.78}
          />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[-18, 1.5, 1.5]}>
      <mesh>
        <cylinderGeometry args={[0.7, 0.7, height, 32]} />
        <meshStandardMaterial
          color="#18232a"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>

      <mesh ref={fill} position={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 1, 24]} />
        <meshStandardMaterial
          ref={fillMat}
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
    station === 'BHARATI' ? [36, 1.6, -16] : [16, 1.2, 0.5]
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

  const days = telemetry?.fuel?.days_of_autonomy ?? 999
  const scarcityGoal = Math.max(0, Math.min(1, (30 - days) / 18))
  const scarcity = useEased(scarcityGoal, 1.1)
  const [alarm, setAlarm] = useState(scarcityGoal)
  useFrame(() => {
    if (Math.abs(scarcity.current - alarm) > 0.01) setAlarm(scarcity.current)
    else if (scarcity.current === 0 && alarm !== 0) setAlarm(0)
  })

  if (!telemetry) return null

  const beaconY = station === 'BHARATI' ? 17.2 : 7.5
  const lightDistance = station === 'BHARATI' ? 28 : 14

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
        level={telemetry.fuel?.tank_level_liters ?? 0}
        station={station}
        scarcity={alarm}
      />

      <ResupplyAlarm station={station} intensity={alarm} />

      <GeneratorState
        active={Boolean(telemetry.controls?.aux_generator_active)}
        station={station}
      />

      {telemetry.controls.hatch_lockdown ||
      telemetry.lockouts?.outdoor === 'LOCKED' ? (
        <LockdownMarkers station={station} />
      ) : null}
    </group>
  )
}
