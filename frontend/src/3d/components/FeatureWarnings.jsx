import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

import { usePolarisStore } from '../../store/usePolarisStore'
import { featureAlerts } from '../../lib/climateLook'
import { bharatiAnchors } from '../stations/Bharati/bharatiAnchors'
import { maitriAnchors } from '../stations/Maitri/maitriAnchors'

export default function FeatureWarnings() {
  const station = usePolarisStore((state) => state.selectedStation)
  const telemetry = usePolarisStore((state) => state.telemetry[station])
  const selectedSubsystem = usePolarisStore((state) => state.selectedSubsystem)
  const alerts = featureAlerts(station, telemetry)
  const anchors = station === 'BHARATI' ? bharatiAnchors : maitriAnchors
  const isBharati = station === 'BHARATI'

  if (!alerts.length) return null

  return (
    <group>
      {alerts.map((alert) => {
        const pos = anchors[alert.id]
        if (!pos) return null
        return (
          <WarningSpike
            key={alert.id}
            alert={alert}
            position={pos}
            isBharati={isBharati}
            focused={!selectedSubsystem || selectedSubsystem === alert.id}
          />
        )
      })}
    </group>
  )
}

function WarningSpike({ alert, position, isBharati, focused }) {
  const beam = useRef()
  const light = useRef()
  const critical = alert.level === 'CRITICAL'
  const color = critical ? '#ff3b4e' : '#ffb24a'
  const height = isBharati ? 9.5 : 5.2
  const radius = isBharati ? 0.09 : 0.055

  useFrame(({ clock }) => {
    const pulse = 0.55 + Math.sin(clock.elapsedTime * (critical ? 6.2 : 3.4)) * 0.45
    if (beam.current) {
      beam.current.material.emissiveIntensity = 2.2 + pulse * 4.5
      beam.current.scale.y = 0.86 + pulse * 0.22
    }
    if (light.current) {
      light.current.intensity = 3.6 * pulse
    }
  })

  return (
    <group position={position} visible={focused}>
      <mesh ref={beam} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius * 0.45, height, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={4}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[isBharati ? 0.28 : 0.16, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={6}
        />
      </mesh>
      {critical && (
        <pointLight
          ref={light}
          color={color}
          distance={isBharati ? 16 : 8}
          intensity={4}
        />
      )}
      <Html
        position={[0, height + 0.6, 0]}
        center
        distanceFactor={isBharati ? 28 : 12}
        style={{ pointerEvents: 'none' }}
      >
        <div className={`feature-warning ${critical ? 'critical' : 'advisory'}`}>
          {alert.label}
        </div>
      </Html>
    </group>
  )
}
