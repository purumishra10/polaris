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

const SUN = [92, 38, 54]

function BharatiLights() {
  return (
    <>
      <hemisphereLight args={['#d7e4ee', '#6a5a48', 0.68]} />
      <directionalLight
        position={SUN}
        intensity={2.85}
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
        intensity={0.7}
        color="#9eb6c8"
      />
      <ambientLight intensity={0.3} />
      <mesh position={SUN}>
        <sphereGeometry args={[6.2, 16, 16]} />
        <meshBasicMaterial color="#fff6d0" />
      </mesh>
    </>
  )
}

export default function BharatiEnvironment() {
  return (
    <>
      <color attach="background" args={['#9eb4c4']} />
      <fog attach="fog" args={['#b7c6d2', 180, 540]} />

      <Sky
        sunPosition={SUN}
        turbidity={2.4}
        rayleigh={0.42}
        mieCoefficient={0.005}
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
            opacity={0.42}
          />
          <Cloud
            position={[-60, 58, 20]}
            seed={8}
            segments={16}
            bounds={[55, 8, 24]}
            volume={22}
            color="#f4f7f8"
            fade={80}
            opacity={0.35}
          />
          <Cloud
            position={[90, 70, 40]}
            seed={5}
            segments={14}
            bounds={[48, 7, 22]}
            volume={18}
            color="#e7eef2"
            fade={100}
            opacity={0.3}
          />
        </Clouds>
      </Suspense>

      <BharatiLights />

      <Sparkles
        count={120}
        scale={[220, 36, 180]}
        size={2.4}
        speed={0.25}
        opacity={0.45}
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
          intensity={0.38}
        />
        <Vignette eskil={false} offset={0.18} darkness={0.42} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}
