import { Html } from '@react-three/drei'

import { usePolarisStore } from '../store/usePolarisStore'
import { getTemplate } from './subsystemCatalog'

export default function WorldPins() {
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )
  const flyComplete = usePolarisStore((state) => state.flyComplete)
  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  if (!selectedSubsystem || !flyComplete) return null

  const template = getTemplate(selectedStation, selectedSubsystem)
  const isBharati = selectedStation === 'BHARATI'

  return (
    <group>
      {template.features.map((feature, index) => (
        <Html
          key={feature.id}
          position={feature.position}
          center
          distanceFactor={isBharati ? 26 : 10}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="world-pin"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="world-pin-label">{feature.label}</div>
            <div className="world-pin-hint">{feature.hint}</div>
            <div className="world-pin-stat">
              {typeof feature.pin === 'function'
                ? feature.pin(telemetry)
                : ''}
            </div>
          </div>
        </Html>
      ))}
    </group>
  )
}
