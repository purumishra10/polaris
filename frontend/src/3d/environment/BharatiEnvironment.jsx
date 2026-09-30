import { Suspense } from 'react'
import { Sky, Environment, Cloud, Clouds, Sparkles } from '@react-three/drei'
import {
  EffectComposer,
  ToneMapping,
  Bloom,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

import { useSmoothedClimate } from './useSmoothedClimate'
import { liteGraphics } from '../../lib/graphicsQuality'
import WeatherField from './WeatherField'
import NightSky from './NightSky'

function BharatiLights({ climate }) {
  return (
    <>
      <hemisphereLight args={[climate.hemiSky, climate.hemiGround, 0.68]} />
      <directionalLight
        position={climate.sun}
        intensity={climate.sunIntensity}
        castShadow={!liteGraphics}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={2}
        shadow-camera-far={320}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        color="#fff1d2"
      />
      <directionalLight
        position={[-70, 24, -48]}
        intensity={climate.fillIntensity}
        color={climate.fillColor}
      />
      <ambientLight intensity={climate.ambientIntensity} />
      {climate.sunVisible && climate.sunOpacity > 0.02 && (
        <mesh position={climate.sun}>
          <sphereGeometry args={[6.2, 16, 16]} />
          <meshBasicMaterial
            color="#fff6d0"
            transparent
            opacity={climate.sunOpacity}
            fog={false}
          />
        </mesh>
      )}
      {/* Station keeps its own warm lights on through the polar night */}
      {climate.stationGlow > 0.01 && (
        <>
          <pointLight
            position={[0, 11, 2]}
            color="#ffd9a3"
            intensity={climate.stationGlow * 55}
            distance={70}
            decay={2}
          />
          <pointLight
            position={[30, 5, -16]}
            color="#ffe2b0"
            intensity={climate.stationGlow * 18}
            distance={34}
            decay={2}
          />
        </>
      )}
    </>
  )
}

export default function BharatiEnvironment() {
  const climate = useSmoothedClimate('BHARATI')

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

      {!liteGraphics && (
      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <Clouds material={THREE.MeshLambertMaterial}>
          <Cloud
            position={[40, 62, -50]}
            seed={2}
            segments={12}
            bounds={[70, 10, 28]}
            volume={22}
            color="#eef3f6"
            fade={90}
            opacity={(0.42 + climate.gale * 0.35) * climate.cloudOpacity}
          />
          <Cloud
            position={[-60, 58, 20]}
            seed={8}
            segments={10}
            bounds={[55, 8, 24]}
            volume={16}
            color="#f4f7f8"
            fade={80}
            opacity={(0.35 + climate.gale * 0.4) * climate.cloudOpacity}
          />
        </Clouds>
      </Suspense>
      )}

      <NightSky climate={climate} station="BHARATI" />

      <BharatiLights climate={climate} />

      {/* Falling snow */}
      <WeatherField
        gale={climate.gale}
        cold={climate.cold}
        count={climate.snowCount}
        maxCount={liteGraphics ? 180 : 420}
        extent={[240, 52, 200]}
      />
      {/* Low, fast ground-blowing snow that only appears in a gale */}
      {climate.groundSnowCount > 40 && (
        <WeatherField
          gale={climate.gale}
          cold={climate.cold}
          count={climate.groundSnowCount}
          maxCount={liteGraphics ? 60 : 180}
          extent={[240, 6, 200]}
          floor={0.15}
          speed={1.9}
          size={1.1}
          opacityScale={0.55}
          color="#f7fbfe"
        />
      )}

      {climate.sparkleCount > 0 && (
        <Sparkles
          count={climate.sparkleCount}
          scale={[220, 36, 180]}
          size={1.6 + climate.gale * 1.4}
          speed={climate.sparkleSpeed}
          opacity={climate.sparkleOpacity}
          color="#f4fbff"
        />
      )}

      {!liteGraphics && (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.78}
          luminanceSmoothing={0.25}
          intensity={climate.bloom * 0.7}
        />
        <Vignette eskil={false} offset={0.18} darkness={climate.vignette} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
      )}
    </>
  )
}
