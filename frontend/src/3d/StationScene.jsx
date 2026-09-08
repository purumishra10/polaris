import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'

import BharatiEnvironment from './environment/BharatiEnvironment'
import BharatiGround from './environment/BharatiGround'
import MaitriEnvironment from './environment/MaitriEnvironment'
import MaitriGround from './environment/MaitriGround'

import BharatiStation from './stations/Bharati/BharatiStation'
import MaitriStation from './stations/Maitri/MaitriStation'

import { usePolarisStore } from '../store/usePolarisStore'
import OperationalState from './components/OperationalState'
import CameraRig from './components/CameraRig'

export default function StationScene() {
  const orbitRoot = useRef(null)
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )

  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  const connectTelemetry = usePolarisStore(
    (state) => state.connectTelemetry,
  )
  useEffect(() => {
    connectTelemetry()
  }, [connectTelemetry])
  const isBharati = selectedStation === 'BHARATI'

  return (
    <div ref={orbitRoot} className="orbit-layer">
      <Canvas
        key={selectedStation}
        shadows
        dpr={[1, 2]}
        eventSource={orbitRoot}
        eventPrefix="client"
        gl={{ antialias: true }}
        camera={
          isBharati
            ? { position: [82, 54, 68], fov: 42, near: 0.1, far: 720 }
            : { position: [0, 15.5, 38], fov: 38, near: 0.1, far: 320 }
        }
        onCreated={({ camera }) => {
          if (isBharati) {
            camera.lookAt(0, 6, 4)
          } else {
            camera.lookAt(0, 4.2, 1.5)
          }
        }}
        onPointerMissed={() => {
          usePolarisStore.getState().setSelectedSubsystem(null)
        }}
      >
        {isBharati ? (
          <>
            <BharatiEnvironment />
            <BharatiGround />
            <BharatiStation />
          </>
        ) : (
          <>
            <MaitriEnvironment />
            <MaitriGround />
            <MaitriStation position={[0, 0, 0]} />
            <ContactShadows
              position={[0, 0.02, 0]}
              opacity={0.35}
              scale={50}
              blur={2.5}
              far={12}
            />
          </>
        )}

        <CameraRig />
        <OperationalState
          telemetry={telemetry}
          station={selectedStation}
        />
      </Canvas>
    </div>
  )
}
