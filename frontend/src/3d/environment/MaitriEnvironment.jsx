import { Suspense } from 'react'
import { Sky, Environment, Cloud, Clouds } from '@react-three/drei'
import {
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

import { usePolarisStore } from '../../store/usePolarisStore'
import { climateLook } from '../../lib/climateLook'
import WeatherField from './WeatherField'

function MaitriLights({ climate }) {
  return (
    <>
      <hemisphereLight args={[climate.hemiSky, climate.hemiGround, 0.62]} />
      <directionalLight
        position={climate.sun}
        intensity={climate.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0004}
        color="#f0e8d4"
      />
      <directionalLight
        position={[-48, 18, -36]}
        intensity={climate.fillIntensity}
        color={climate.fillColor}
      />
      <ambientLight intensity={climate.ambientIntensity} />
    </>
  )
}

export default function MaitriEnvironment() {
  const telemetry = usePolarisStore((state) => state.telemetry.MAITRI)
  const climate = climateLook(telemetry, 'MAITRI')

  return (
    <>
      <color attach="background" args={[climate.background]} />
      <fog attach="fog" args={[climate.fog, climate.fogNear, climate.fogFar]} />

      <Sky
        sunPosition={climate.sun}
        turbidity={climate.turbidity}
        rayleigh={climate.rayleigh}
        mieCoefficient={climate.mieCoefficient}
        mieDirectionalG={0.78}
      />

      <Suspense fallback={null}>
        <Environment preset="city" />
        {climate.gale > 0.12 && (
          <Clouds material={THREE.MeshLambertMaterial}>
            <Cloud
              position={[20, 48, -18]}
              seed={3}
              segments={14}
              bounds={[42, 8, 20]}
              volume={16}
              color="#e7eef2"
              fade={70}
              opacity={0.28 + climate.gale * 0.45}
            />
          </Clouds>
        )}
      </Suspense>

      <MaitriLights climate={climate} />

      <WeatherField
        gale={climate.gale}
        cold={climate.cold}
        count={climate.snowCount}
        extent={[160, 38, 140]}
      />

      <EffectComposer multisampling={0}>
        <N8AO
          aoRadius={4}
          intensity={1.35}
          distanceFalloff={1.1}
          quality="medium"
          halfRes
        />
        <Vignette eskil={false} offset={0.2} darkness={climate.vignette} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
