import { useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import { Color } from 'three'
import { usePolarisStore } from '../../store/usePolarisStore'
import { bharatiAnchors } from '../stations/Bharati/bharatiAnchors'
import { maitriAnchors } from '../stations/Maitri/maitriAnchors'
import { assetFault, faultColor } from '../../ops/assetHealth'

function applyAssetLook(root, dim, faultTone) {
  if (!root) return

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (!material) continue
      const data = material.userData
      if (data._polarisBaseOpacity === undefined) {
        data._polarisBaseOpacity = material.opacity ?? 1
        data._polarisBaseTransparent = material.transparent
        data._polarisBaseEmissive = material.emissive
          ? material.emissive.clone()
          : new Color(0, 0, 0)
        data._polarisBaseEmissiveIntensity = material.emissiveIntensity ?? 0
      }
      if (dim && !faultTone) {
        material.transparent = true
        material.opacity = data._polarisBaseOpacity * 0.22
      } else if (dim && faultTone) {
        material.transparent = true
        material.opacity = data._polarisBaseOpacity * 0.55
      } else {
        material.transparent = data._polarisBaseTransparent
        material.opacity = data._polarisBaseOpacity
      }

      if (material.emissive) {
        material.emissive.copy(data._polarisBaseEmissive)
        material.emissiveIntensity = data._polarisBaseEmissiveIntensity
      }
      material.needsUpdate = true
    }
  })
}

function PulseLight({ position, color, base, distance }) {
  const light = useRef(null)
  useFrame(({ clock }) => {
    if (!light.current) return
    const pulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5.2)
    light.current.intensity = base * pulse
  })
  return (
    <pointLight
      ref={light}
      position={position}
      color={color}
      intensity={base}
      distance={distance}
    />
  )
}

export default function InteractiveAsset({
  id,
  children,
  position = [0, 0, 0],
}) {
  const root = useRef(null)
  const [hovered, setHovered] = useState(false)
  const selectedStation = usePolarisStore((state) => state.selectedStation)
  const selectedSubsystem = usePolarisStore((state) => state.selectedSubsystem)
  const setSelectedSubsystem = usePolarisStore(
    (state) => state.setSelectedSubsystem,
  )
  const hoveredSubsystem = usePolarisStore((state) => state.hoveredSubsystem)
  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  const selected = selectedSubsystem === id
  const dimmed = Boolean(selectedSubsystem && !selected)
  const hudHover = hoveredSubsystem === id
  const fault = assetFault(id, telemetry)
  useCursor(hovered || hudHover)

  useLayoutEffect(() => {
    applyAssetLook(root.current, dimmed, fault?.tone ?? null)
  }, [dimmed, fault?.tone])

  const anchors =
    selectedStation === 'BHARATI' ? bharatiAnchors : maitriAnchors
  const labelPos = anchors[id] ?? [0, 2.2, 0]
  const isBharati = selectedStation === 'BHARATI'
  const showHover = (hovered || hudHover) && !selected && !fault
  const showFault = Boolean(fault) && (!selectedSubsystem || selected || fault.tone === 'critical')

  return (
    <group
      ref={root}
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

      {fault && (
        <PulseLight
          position={labelPos}
          color={faultColor(fault.tone)}
          base={
            fault.tone === 'critical'
              ? isBharati
                ? 8.5
                : 5.5
              : isBharati
                ? 4.2
                : 2.8
          }
          distance={isBharati ? 28 : 12}
        />
      )}

      {selected && !fault && (
        <pointLight
          position={labelPos}
          intensity={isBharati ? 2.2 : 3}
          distance={isBharati ? 18 : 5}
          color={isBharati ? '#e8c48a' : '#66d9ff'}
        />
      )}

      {showFault && (
        <Html
          position={labelPos}
          center
          distanceFactor={isBharati ? 26 : 11}
          style={{ pointerEvents: 'none' }}
        >
          <div className={`asset-fault ${fault.tone}`}>
            <div className="asset-fault-kicker">{fault.title}</div>
            <div className="asset-fault-id">{id}</div>
            <p>{fault.reason}</p>
          </div>
        </Html>
      )}

      {showHover && (
        <Html
          position={labelPos}
          center
          distanceFactor={isBharati ? 28 : 12}
          style={{ pointerEvents: 'none' }}
        >
          <div className="asset-label hover">{id}</div>
        </Html>
      )}
    </group>
  )
}
