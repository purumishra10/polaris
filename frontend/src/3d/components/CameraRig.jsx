import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePolarisStore } from '../../store/usePolarisStore'
import { getTemplate } from '../../intelligence/subsystemCatalog'
import {
  bharatiAnchors,
  bharatiCameraPresets,
} from '../stations/Bharati/bharatiAnchors'
import { maitriAnchors } from '../stations/Maitri/maitriAnchors'

const MAITRI_OVERVIEW = {
  position: [24, 16, 27],
  target: [0, 3.2, 0],
}

function isUiTarget(target) {
  return Boolean(
    target instanceof Element &&
      target.closest(
        'button, input, textarea, a, .station-panel, .telemetry-panel, .scenario-panel, .camera-presets, .subsystem-card, .telemetry-toggle, .cinematic-brief, .letterbox, .title-slam',
      ),
  )
}

export default function CameraRig() {
  const { camera, invalidate } = useThree()
  const target = useRef(new THREE.Vector3(0, 6, 4))
  const spherical = useRef(new THREE.Spherical())
  const dragging = useRef(null)
  const last = useRef({ x: 0, y: 0 })
  const flying = useRef(false)
  const announced = useRef(true)
  const autoSpin = useRef(false)
  const goalPos = useRef(new THREE.Vector3(82, 54, 68))
  const goalTarget = useRef(new THREE.Vector3(0, 6, 4))
  const panRight = useRef(new THREE.Vector3())
  const panUp = useRef(new THREE.Vector3())

  const cameraPreset = usePolarisStore((state) => state.cameraPreset)
  const cameraTick = usePolarisStore((state) => state.cameraTick)
  const flySource = usePolarisStore((state) => state.flySource)
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )

  const apply = () => {
    spherical.current.makeSafe()
    spherical.current.phi = THREE.MathUtils.clamp(
      spherical.current.phi,
      0.08,
      Math.PI / 2.02,
    )
    spherical.current.radius = THREE.MathUtils.clamp(
      spherical.current.radius,
      3,
      280,
    )
    camera.position
      .setFromSpherical(spherical.current)
      .add(target.current)
    camera.lookAt(target.current)
    invalidate()
  }

  useEffect(() => {
    spherical.current.setFromVector3(
      camera.position.clone().sub(target.current),
    )
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    flying.current = true
    announced.current = false

    if (flySource === 'preset') {
      if (selectedStation === 'BHARATI') {
        const view = bharatiCameraPresets[cameraPreset]
        if (!view) {
          usePolarisStore.getState().markFlyComplete()
          return
        }
        goalPos.current.set(...view.position)
        goalTarget.current.set(...view.target)
        autoSpin.current = cameraPreset === 'spin360'
        return
      }

      goalPos.current.set(...MAITRI_OVERVIEW.position)
      goalTarget.current.set(...MAITRI_OVERVIEW.target)
      autoSpin.current = false
      return
    }

    if (flySource === 'asset' && selectedSubsystem) {
      const anchors =
        selectedStation === 'BHARATI' ? bharatiAnchors : maitriAnchors
      const look = anchors[selectedSubsystem]
      if (!look) {
        usePolarisStore.getState().markFlyComplete()
        return
      }
      const template = getTemplate(selectedStation, selectedSubsystem)
      const [tx, ty, tz] = look
      const distance = template.framing?.distance ?? 16
      const height = template.framing?.height ?? 8
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
  }, [camera, invalidate])

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
    if (camera.position.distanceTo(goalPos.current) < 0.55) {
      flying.current = false
      if (!announced.current) {
        announced.current = true
        usePolarisStore.getState().markFlyComplete()
      }
    }
  })

  return null
}
