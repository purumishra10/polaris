import { Suspense } from 'react'
import { Sky, Environment, Cloud, Clouds, Sparkles } from '@react-three/drei'
import {
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Bloom,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

import { usePolarisStore } from '../../store/usePolarisStore'
import { climateLook } from '../../lib/climateLook'
import WeatherField from './WeatherField'

function BharatiLights({ climate }) {
  return (
    <>
      <hemisphereLight args={[climate.hemiSky, climate.hemiGround, 0.68]} />
      <directionalLight
        position={climate.sun}
        intensity={climate.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={280}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-bias={-0.00035}
        color="#fff1d2"
      />
      <directionalLight
        position={[-70, 24, -48]}
        intensity={climate.fillIntensity}
        color={climate.fillColor}
      />
      <ambientLight intensity={climate.ambientIntensity} />
      <mesh position={climate.sun}>
        <sphereGeometry args={[6.2, 16, 16]} />
        <meshBasicMaterial
          color="#fff6d0"
          transparent
          opacity={Math.max(0.12, 1 - climate.dark * 0.85)}
        />
      </mesh>
    </>
  )
}

export default function BharatiEnvironment() {
  const telemetry = usePolarisStore((state) => state.telemetry.BHARATI)
  const climate = climateLook(telemetry, 'BHARATI')

  return (
    <>
      <color attach="background" args={[climate.background]} />
      <fog attach="fog" args={[climate.fog, climate.fogNear, climate.fogFar]} />

      <Sky
        sunPosition={climate.sun}
        turbidity={climate.turbidity}
        rayleigh={climate.rayleigh}
        mieCoefficient={climate.mieCoefficient}
        mieDirectionalG={0.82}
      />

      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <Clouds material={THREE.MeshLambertMaterial}>
          <Cloud
            position={[40, 62, -50]}
            seed={2}
            segments={18}
            bounds={[70, 10, 28]}
            volume={28}
            color="#eef3f6"
            fade={90}
            opacity={0.42 + climate.gale * 0.35}
          />
          <Cloud
            position={[-60, 58, 20]}
            seed={8}
            segments={16}
            bounds={[55, 8, 24]}
            volume={22}
            color="#f4f7f8"
            fade={80}
            opacity={0.35 + climate.gale * 0.4}
          />
          <Cloud
            position={[90, 70, 40]}
            seed={5}
            segments={14}
            bounds={[48, 7, 22]}
            volume={18}
            color="#e7eef2"
            fade={100}
            opacity={0.3 + climate.gale * 0.45}
          />
        </Clouds>
      </Suspense>

      <BharatiLights climate={climate} />

      <WeatherField
        gale={climate.gale}
        cold={climate.cold}
        count={climate.snowCount}
        extent={[240, 52, 200]}
      />

      <Sparkles
        count={climate.sparkleCount}
        scale={[220, 36, 180]}
        size={1.6 + climate.gale * 1.4}
        speed={climate.sparkleSpeed}
        opacity={climate.sparkleOpacity}
        color="#f4fbff"
      />

      <EffectComposer multisampling={0}>
        <N8AO
          aoRadius={6}
          intensity={1.55}
          distanceFalloff={1.05}
          quality="medium"
          halfRes
        />
        <Bloom
          luminanceThreshold={0.72}
          luminanceSmoothing={0.2}
          intensity={climate.bloom}
        />
        <Vignette eskil={false} offset={0.18} darkness={climate.vignette} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
