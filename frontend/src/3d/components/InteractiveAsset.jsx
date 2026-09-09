import { useLayoutEffect, useRef, useState } from 'react'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { usePolarisStore } from '../../store/usePolarisStore'
import { bharatiAnchors } from '../stations/Bharati/bharatiAnchors'
import { maitriAnchors } from '../stations/Maitri/maitriAnchors'

// Soft ice-blue tint added to a component's materials while hovered
const HOVER_TINT = new THREE.Color('#8fd3ff')
const HOVER_STRENGTH = 0.16

function forEachMaterial(root, fn) {
  if (!root) return
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      if (material) fn(material)
    }
  })
}

function applyHoverGlow(root, on) {
  forEachMaterial(root, (material) => {
    if (!material.emissive) return
    if (material.userData._polarisBaseEmissive === undefined) {
      material.userData._polarisBaseEmissive = material.emissive.clone()
      material.userData._polarisBaseEmissiveIntensity = material.emissiveIntensity
    }
    const base = material.userData._polarisBaseEmissive
    const baseIntensity = material.userData._polarisBaseEmissiveIntensity
    if (on) {
      // Add a light tint on top of whatever the material already emits
      material.emissive
        .copy(base)
        .lerp(HOVER_TINT, HOVER_STRENGTH)
      material.emissiveIntensity = 1
    } else {
      material.emissive.copy(base)
      material.emissiveIntensity = baseIntensity
    }
    material.needsUpdate = true
  })
}

function applyFocusDim(root, dim) {
  if (!root) return

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (!material) continue
      if (material.userData._polarisBaseOpacity === undefined) {
        material.userData._polarisBaseOpacity = material.opacity ?? 1
        material.userData._polarisBaseTransparent = material.transparent
      }
      if (dim) {
        material.transparent = true
        material.opacity = material.userData._polarisBaseOpacity * 0.22
      } else {
        material.transparent = material.userData._polarisBaseTransparent
        material.opacity = material.userData._polarisBaseOpacity
      }
      material.needsUpdate = true
    }
  })
}

export default function InteractiveAsset({
  id,
  children,
  position = [0, 0, 0],
}) {
  const root = useRef(null)
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
  const dimmed = Boolean(selectedSubsystem && !selected)
  useCursor(hovered)

  useLayoutEffect(() => {
    applyFocusDim(root.current, dimmed)
  }, [dimmed])

  const glow = hovered && !selected
  useLayoutEffect(() => {
    const node = root.current
    applyHoverGlow(node, glow)
    return () => applyHoverGlow(node, false)
  }, [glow])

  const anchors =
    selectedStation === 'BHARATI' ? bharatiAnchors : maitriAnchors
  const labelPos = anchors[id] ?? [0, 2.2, 0]
  const isBharati = selectedStation === 'BHARATI'

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

      {selected && (
        <pointLight
          position={labelPos}
          intensity={isBharati ? 2.2 : 3}
          distance={isBharati ? 18 : 5}
          color={isBharati ? '#e8c48a' : '#66d9ff'}
        />
      )}

      {hovered && !selected && (
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
