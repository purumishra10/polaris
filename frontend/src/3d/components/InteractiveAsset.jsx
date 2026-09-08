import { useState } from 'react'
import { Html, useCursor } from '@react-three/drei'
import { usePolarisStore } from '../../store/usePolarisStore'
import { bharatiAnchors } from '../stations/Bharati/bharatiAnchors'
import { maitriAnchors } from '../stations/Maitri/maitriAnchors'

export default function InteractiveAsset({
  id,
  children,
  position = [0, 0, 0],
}) {
  const [hovered, setHovered] = useState(false)
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )
  const setSelectedSubsystem = usePolarisStore(
    (state) => state.setSelectedSubsystem,
  )

  const selected = selectedSubsystem === id
  useCursor(hovered)

  const anchors =
    selectedStation === 'BHARATI' ? bharatiAnchors : maitriAnchors
  const labelPos = anchors[id] ?? [0, 2.2, 0]
  const isBharati = selectedStation === 'BHARATI'

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation()
        setSelectedSubsystem(selected ? null : id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}

      {selected && (
        <>
          <pointLight
            position={labelPos}
            intensity={isBharati ? 2.2 : 3}
            distance={isBharati ? 18 : 5}
            color={isBharati ? '#e8c48a' : '#66d9ff'}
          />
          <Html
            position={labelPos}
            center
            distanceFactor={isBharati ? 28 : 12}
            style={{ pointerEvents: 'none' }}
          >
            <div className="asset-label">{id}</div>
          </Html>
        </>
      )}
    </group>
  )
}
