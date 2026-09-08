import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const starVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;
  void main() {
    vTwinkle = 0.62 + 0.38 * sin(uTime * 1.6 + aPhase);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (0.8 + 0.2 * vTwinkle);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const starFragment = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.08, d) * uOpacity * vTwinkle;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const auroraVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const auroraFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float x = vUv.x;
    float y = vUv.y;
    // slow drifting curtains
    float wave = sin(x * 5.0 + uTime * 0.45) * 0.5 + 0.5;
    float wave2 = sin(x * 11.0 - uTime * 0.8 + 2.0) * 0.5 + 0.5;
    float ripple = sin(x * 26.0 - uTime * 1.6 + y * 9.0) * 0.5 + 0.5;
    // fade at the base, long tail toward the top
    float band = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.25, 1.0, y + wave * 0.15));
    // soften the horizontal edges of the ribbon
    float edge = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
    float a = band * edge * (0.35 + 0.65 * wave) * (0.55 + 0.45 * ripple) * (0.6 + 0.4 * wave2) * uOpacity;
    vec3 green = vec3(0.22, 0.95, 0.58);
    vec3 violet = vec3(0.48, 0.32, 0.96);
    vec3 col = mix(green, violet, smoothstep(0.15, 0.85, y));
    gl_FragColor = vec4(col * a, a);
  }
`

function Stars({ radius, count, visibility }) {
  const material = useRef()

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2
      // bias toward the zenith, keep every star above the horizon
      const y = 0.06 + Math.pow(Math.random(), 0.8) * 0.94
      const ring = Math.sqrt(1 - y * y)
      const r = radius * (0.9 + Math.random() * 0.1)
      pos[i * 3] = ring * Math.cos(theta) * r
      pos[i * 3 + 1] = y * r
      pos[i * 3 + 2] = ring * Math.sin(theta) * r
      phase[i] = Math.random() * Math.PI * 2
      size[i] = 1.1 + Math.pow(Math.random(), 3.2) * 3.6
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    return geo
  }, [radius, count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uColor: { value: new THREE.Color('#dfe9ff') },
    }),
    [],
  )

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    uniforms.uOpacity.value = visibility
  })

  if (visibility < 0.01) return null

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={-5}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function Moon({ position, radius, opacity }) {
  if (opacity < 0.01) return null
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color="#eef3fb" transparent opacity={opacity} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 2.6, 24, 24]} />
        <meshBasicMaterial
          color="#9fb8dc"
          transparent
          opacity={opacity * 0.12}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function AuroraRibbon({ position, size, opacity, lookAt, phase = 0 }) {
  const mesh = useRef()
  const uniforms = useMemo(
    () => ({ uTime: { value: phase }, uOpacity: { value: 0 } }),
    [phase],
  )

  useFrame((_, delta) => {
    uniforms.uTime.value += delta
    uniforms.uOpacity.value = opacity
    if (mesh.current) mesh.current.lookAt(...lookAt)
  })

  if (opacity < 0.01) return null

  return (
    <mesh ref={mesh} position={position} frustumCulled={false} renderOrder={-4}>
      <planeGeometry args={size} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={auroraVertex}
        fragmentShader={auroraFragment}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/**
 * Stars, moon and aurora that fade in as the polar night sets in.
 * All values are already smoothed by useSmoothedClimate.
 */
export default function NightSky({ climate, station = 'BHARATI' }) {
  const isBharati = station === 'BHARATI'
  // Everything sits far beyond the terrain so the horizon never occludes it
  const radius = isBharati ? 3200 : 1500
  const moonPos = isBharati ? [-1500, 950, -1900] : [-560, 380, -760]
  const moonRadius = isBharati ? 70 : 28
  const lookAt = isBharati ? [0, 200, 0] : [0, 90, 0]

  return (
    <group>
      <Stars
        radius={radius}
        count={isBharati ? 1900 : 1200}
        visibility={climate.starVisibility}
      />
      <Moon position={moonPos} radius={moonRadius} opacity={climate.moon} />
      {climate.moonLight > 0.01 && (
        <directionalLight
          position={moonPos}
          intensity={climate.moonLight}
          color="#8fa9cf"
        />
      )}
      <AuroraRibbon
        position={isBharati ? [-500, 900, -2700] : [-200, 420, -1200]}
        size={isBharati ? [3400, 850] : [1600, 400]}
        opacity={climate.aurora * 0.7}
        lookAt={lookAt}
      />
      <AuroraRibbon
        position={isBharati ? [1200, 1050, -2300] : [420, 480, -1050]}
        size={isBharati ? [2600, 720] : [1200, 330]}
        opacity={climate.aurora * 0.45}
        lookAt={lookAt}
        phase={17}
      />
    </group>
  )
}
