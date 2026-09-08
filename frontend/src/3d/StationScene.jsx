import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'

import AntarcticGround from './environment/AntarcticGround'
import Atmosphere from './environment/Atmosphere'
import Lighting from './environment/Lighting'
import BharatiEnvironment from './environment/BharatiEnvironment'
import BharatiGround from './environment/BharatiGround'

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
            : { position: [24, 16, 27], fov: 45, near: 0.1, far: 180 }
        }
        onCreated={({ camera }) => {
          if (isBharati) {
            camera.lookAt(0, 6, 4)
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
            <CameraRig />
          </>
        ) : (
          <>
            <Atmosphere />
            <Lighting />
            <AntarcticGround />
            <MaitriStation position={[0, 0, 0]} />
            <ContactShadows
              position={[0, 0.05, 0]}
              opacity={0.45}
              scale={30}
              blur={2.5}
              far={10}
            />
            <OrbitControls
              enableDamping
              dampingFactor={0.08}
              minDistance={11}
              maxDistance={55}
              maxPolarAngle={Math.PI / 2.05}
              target={[0, 3.2, 0]}
            />
          </>
        )}

        <OperationalState
          telemetry={telemetry}
          station={selectedStation}
        />
      </Canvas>
    </div>
  )
}
