import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePolarisStore } from '../../store/usePolarisStore'
import { getTemplate } from '../../intelligence/subsystemCatalog'
import {
  bharatiAnchors,
  bharatiCameraPresets,
} from '../stations/Bharati/bharatiAnchors'
import {
  maitriAnchors,
  maitriCameraPresets,
} from '../stations/Maitri/maitriAnchors'

function isUiTarget(target) {
  return Boolean(
    target instanceof Element &&
      target.closest(
        'button, input, textarea, a, .station-panel, .telemetry-panel, .scenario-panel, .camera-presets, .subsystem-card, .telemetry-toggle, .cinematic-brief, .cinematic-brief-rail, .letterbox, .title-slam, .twin-live-chrome, .twin-exit-fullscreen',
      ),
  )
}

export default function CameraRig() {
  const { camera, invalidate } = useThree()

  const cameraPreset = usePolarisStore((state) => state.cameraPreset)
  const cameraTick = usePolarisStore((state) => state.cameraTick)
  const flySource = usePolarisStore((state) => state.flySource)
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )

  const isBharati = selectedStation === 'BHARATI'
  const anchors = isBharati ? bharatiAnchors : maitriAnchors
  const cameraPresets = isBharati ? bharatiCameraPresets : maitriCameraPresets
  const defaultTarget = isBharati ? [0, 6, 4] : [0, 4, 0]
  const defaultPos = isBharati ? [82, 54, 68] : [38, 22, 32]
  const minRadius = isBharati ? 3 : 8
  const maxRadius = isBharati ? 900 : 420

  const target = useRef(new THREE.Vector3(...defaultTarget))
  const spherical = useRef(new THREE.Spherical())
  const dragging = useRef(null)
  const last = useRef({ x: 0, y: 0 })
  const flying = useRef(false)
  const announced = useRef(true)
  const autoSpin = useRef(false)
  const goalPos = useRef(new THREE.Vector3(...defaultPos))
  const goalTarget = useRef(new THREE.Vector3(...defaultTarget))
  const panRight = useRef(new THREE.Vector3())
  const panUp = useRef(new THREE.Vector3())
  const previousSubsystem = useRef(selectedSubsystem)

  const apply = () => {
    spherical.current.makeSafe()
    spherical.current.phi = THREE.MathUtils.clamp(
      spherical.current.phi,
      0.08,
      Math.PI / 2.02,
    )
    spherical.current.radius = THREE.MathUtils.clamp(
      spherical.current.radius,
      minRadius,
      maxRadius,
    )
    camera.position
      .setFromSpherical(spherical.current)
      .add(target.current)
    camera.lookAt(target.current)
    invalidate()
  }

  useEffect(() => {
    target.current.set(...defaultTarget)
    goalPos.current.set(...defaultPos)
    goalTarget.current.set(...defaultTarget)
    camera.position.set(...defaultPos)
    spherical.current.setFromVector3(
      camera.position.clone().sub(target.current),
    )
    flying.current = false
    autoSpin.current = false
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation])

  useEffect(() => {
    flying.current = true
    announced.current = false

    if (flySource === 'preset' && cameraPreset) {
      const view = cameraPresets[cameraPreset]
      if (!view) {
        usePolarisStore.getState().markFlyComplete()
        return
      }
      goalPos.current.set(...view.position)
      goalTarget.current.set(...view.target)
      autoSpin.current = cameraPreset === 'spin360'
      return
    }

    if (flySource === 'asset' && selectedSubsystem) {
      const look = anchors[selectedSubsystem]
      if (!look) {
        usePolarisStore.getState().markFlyComplete()
        return
      }
      const template = getTemplate(selectedStation, selectedSubsystem)
      const [tx, ty, tz] = look
      const distance = template.framing?.distance ?? (isBharati ? 16 : 12)
      const height = template.framing?.height ?? 6
      const lateral = template.framing?.lateral ?? 0.95
      goalPos.current.set(
        tx + distance * lateral,
        ty + height,
        tz + distance,
      )
      goalTarget.current.set(tx, ty, tz)
      autoSpin.current = false
    }
  }, [
    cameraPreset,
    cameraTick,
    flySource,
    selectedSubsystem,
    selectedStation,
    anchors,
    cameraPresets,
    isBharati,
  ])

  useEffect(() => {
    const onDown = (event) => {
      if (isUiTarget(event.target)) return
      const layer = event.target instanceof Element
        ? event.target.closest('.orbit-layer')
        : null
      if (!layer) return
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
        return
      }

      flying.current = false
      autoSpin.current = false
      dragging.current = event.button === 0 ? 'rotate' : 'pan'
      last.current = { x: event.clientX, y: event.clientY }
      layer.style.cursor = 'grabbing'
      event.preventDefault()
    }

    const onMove = (event) => {
      if (!dragging.current) return
      const dx = event.clientX - last.current.x
      const dy = event.clientY - last.current.y
      last.current = { x: event.clientX, y: event.clientY }

      if (dragging.current === 'rotate') {
        spherical.current.theta -= dx * 0.0085
        spherical.current.phi -= dy * 0.0085
      } else {
        const distance = spherical.current.radius
        panRight.current.setFromMatrixColumn(camera.matrix, 0)
        panUp.current.setFromMatrixColumn(camera.matrix, 1)
        target.current.addScaledVector(
          panRight.current,
          -dx * distance * 0.0014,
        )
        target.current.addScaledVector(
          panUp.current,
          dy * distance * 0.0014,
        )
      }
      apply()
    }

    const onUp = () => {
      dragging.current = null
      const layer = document.querySelector('.orbit-layer')
      if (layer) layer.style.cursor = 'grab'
    }

    const onWheel = (event) => {
      if (isUiTarget(event.target)) return
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('.orbit-layer')
      ) {
        return
      }
      event.preventDefault()
      flying.current = false
      spherical.current.radius *= Math.exp(event.deltaY * 0.00115)
      apply()
    }

    const onContext = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.orbit-layer') &&
        !isUiTarget(event.target)
      ) {
        event.preventDefault()
      }
    }

    const onKey = (event) => {
      const step = event.shiftKey ? 0.12 : 0.06
      if (event.key === 'ArrowLeft') spherical.current.theta += step
      else if (event.key === 'ArrowRight') spherical.current.theta -= step
      else if (event.key === 'ArrowUp') spherical.current.phi -= step
      else if (event.key === 'ArrowDown') spherical.current.phi += step
      else return
      flying.current = false
      autoSpin.current = false
      apply()
    }

    window.addEventListener('pointerdown', onDown, { capture: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
    }
  }, [camera, invalidate, minRadius, maxRadius])

  // Deselecting a component: keep the camera where it is but swing the orbit
  // pivot back to the station centre, so drags revolve around the station again.
  useEffect(() => {
    const was = previousSubsystem.current
    previousSubsystem.current = selectedSubsystem
    if (!was || selectedSubsystem) return
    goalPos.current.copy(camera.position)
    goalTarget.current.set(...defaultTarget)
    autoSpin.current = false
    announced.current = true
    flying.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubsystem])

  useFrame((_, delta) => {
    if (autoSpin.current && !dragging.current && !flying.current) {
      spherical.current.theta += delta * 0.32
      apply()
      return
    }

    if (!flying.current) return
    camera.position.lerp(goalPos.current, 0.1)
    target.current.lerp(goalTarget.current, 0.1)
    camera.lookAt(target.current)
    spherical.current.setFromVector3(
      camera.position.clone().sub(target.current),
    )
    if (
      camera.position.distanceTo(goalPos.current) < 0.55 &&
      target.current.distanceTo(goalTarget.current) < 0.55
    ) {
      flying.current = false
      if (!announced.current) {
        announced.current = true
        usePolarisStore.getState().markFlyComplete()
      }
    }
  })

  return null
}
