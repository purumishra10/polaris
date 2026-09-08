import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'

import AntarcticGround from './environment/AntarcticGround'
import Atmosphere from './environment/Atmosphere'
import Lighting from './environment/Lighting'

import BharatiStation from './stations/Bharati/BharatiStation'
import MaitriStation from './stations/Maitri/MaitriStation'

import { usePolarisStore } from '../store/usePolarisStore'
import OperationalState from './components/OperationalState'

export default function StationScene() {
  const selectedStation = usePolarisStore(
    (state) => state.selectedStation,
  )

  const telemetry = usePolarisStore(
    (state) => state.telemetry[selectedStation],
  )

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{position:[24,16,27], fov:45, near:.1, far:180}}
      onPointerMissed={() => {
        usePolarisStore
          .getState()
          .setSelectedSubsystem(null)
      }}
    >
      <Atmosphere />

      <Lighting />

      <AntarcticGround />

      {selectedStation === 'BHARATI' && (
        <BharatiStation position={[0, 0, 0]} />
      )}

      {selectedStation === 'MAITRI' && (
        <MaitriStation position={[0, 0, 0]} />
      )}

      <OperationalState telemetry={telemetry} />

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
    </Canvas>
  )
}