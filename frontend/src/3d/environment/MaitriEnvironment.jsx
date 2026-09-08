import { Suspense } from 'react'
import { Sky, Environment } from '@react-three/drei'
import {
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

const SUN = [68, 42, 38]

function MaitriLights() {
  return (
    <>
      <hemisphereLight args={['#c8d4dc', '#5a5048', 0.62]} />
      <directionalLight
        position={SUN}
        intensity={2.4}
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
        intensity={0.55}
        color="#8ea8b8"
      />
      <ambientLight intensity={0.28} />
    </>
  )
}

export default function MaitriEnvironment() {
  return (
    <>
      <color attach="background" args={['#a8bac6']} />
      <fog attach="fog" args={['#b5c4ce', 120, 320]} />

      <Sky
        sunPosition={SUN}
        turbidity={2.8}
        rayleigh={0.48}
        mieCoefficient={0.004}
        mieDirectionalG={0.78}
      />

      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <MaitriLights />

      <EffectComposer multisampling={0}>
        <N8AO
          aoRadius={4}
          intensity={1.35}
          distanceFalloff={1.1}
          quality="medium"
          halfRes
        />
        <Vignette eskil={false} offset={0.2} darkness={0.38} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
