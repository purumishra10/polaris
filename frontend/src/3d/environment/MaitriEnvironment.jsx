import { Suspense } from 'react'
import { Sky, Environment } from '@react-three/drei'
import {
  EffectComposer,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

import { useSmoothedClimate } from './useSmoothedClimate'
import { liteGraphics } from '../../lib/graphicsQuality'
import WeatherField from './WeatherField'
import NightSky from './NightSky'

function MaitriLights({ climate }) {
  return (
    <>
      <hemisphereLight args={[climate.hemiSky, climate.hemiGround, 0.62]} />
      <directionalLight
        position={climate.sun}
        intensity={climate.sunIntensity}
        castShadow={!liteGraphics}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        color="#f0e8d4"
      />
      <directionalLight
        position={[-48, 18, -36]}
        intensity={climate.fillIntensity}
        color={climate.fillColor}
      />
      <ambientLight intensity={climate.ambientIntensity} />
      {climate.stationGlow > 0.01 && (
        <pointLight
          position={[0, 5, 0]}
          color="#ffd9a3"
          intensity={climate.stationGlow * 22}
          distance={34}
          decay={2}
        />
      )}
    </>
  )
}

export default function MaitriEnvironment() {
  const climate = useSmoothedClimate('MAITRI')

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

      {!liteGraphics && (
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      )}

      <NightSky climate={climate} station="MAITRI" />

      <MaitriLights climate={climate} />

      <WeatherField
        gale={climate.gale}
        cold={climate.cold}
        count={Math.floor(climate.snowCount * 0.55)}
        maxCount={liteGraphics ? 140 : 320}
        extent={[90, 28, 70]}
        size={0.22}
      />
      {climate.groundSnowCount > 40 && (
        <WeatherField
          gale={climate.gale}
          cold={climate.cold}
          count={Math.floor(climate.groundSnowCount * 0.5)}
          maxCount={liteGraphics ? 40 : 140}
          extent={[90, 3, 70]}
          floor={0.1}
          speed={1.9}
          size={0.6}
          opacityScale={0.55}
          color="#f7fbfe"
        />
      )}

      {!liteGraphics && (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Vignette eskil={false} offset={0.2} darkness={climate.vignette} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
      )}
    </>
  )
}
