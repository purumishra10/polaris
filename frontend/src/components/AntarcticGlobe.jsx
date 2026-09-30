import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { Crosshair, Globe2, MousePointer2 } from 'lucide-react'
import { liteGraphics } from '../lib/graphicsQuality'
import { useCanvasActive } from '../lib/useCanvasActive'
import { GLOBE_SITES } from '../lib/stationSites'

const R = 1
const EARTH_RADIUS_KM = 6371

const GOA = { name: 'NCPOR Goa', lat: 15.456, lon: 73.802, color: '#f97316' }

const VIEWS = {
  OVERVIEW: { lat: -40, lon: 46, dist: 3.05 },
  BHARATI: { lat: -52, lon: 76, dist: 1.9 },
  MAITRI: { lat: -52, lon: 12, dist: 1.9 },
}

function toVec(lat, lon, r = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function greatCircleKm(a, b) {
  return toVec(a.lat, a.lon).angleTo(toVec(b.lat, b.lon)) * EARTH_RADIUS_KM
}

function arcPoints(a, b, lift, segments = 96) {
  const va = toVec(a.lat, a.lon).normalize()
  const vb = toVec(b.lat, b.lon).normalize()
  const angle = va.angleTo(vb)
  const s = Math.sin(angle)
  const points = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const v = va
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / s)
      .add(vb.clone().multiplyScalar(Math.sin(t * angle) / s))
    v.multiplyScalar(R + 0.004 + Math.sin(Math.PI * t) * lift)
    points.push(v)
  }
  return points
}

const glowVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBias;
  uniform float uPower;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(max(uBias - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), uPower);
    gl_FragColor = vec4(uColor, 1.0) * intensity;
  }
`

const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
    gl_FragColor = vec4(uColor, f * 0.9);
  }
`

function Earth() {
  const [map, bump, water] = useLoader(THREE.TextureLoader, [
    '/textures/earth-blue-marble.jpg',
    '/textures/earth-topology.png',
    '/textures/earth-water.png',
  ])
  const { gl } = useThree()

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  }, [map, gl])

  const segments = liteGraphics ? 72 : 128

  return (
    <mesh>
      <sphereGeometry args={[R, segments, segments]} />
      <meshPhongMaterial
        map={map}
        bumpMap={bump}
        bumpScale={0.018}
        specularMap={water}
        specular={new THREE.Color('#3b6b96')}
        shininess={18}
      />
    </mesh>
  )
}

function Atmosphere() {
  const glowUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#4aa8ff') },
      uBias: { value: 0.62 },
      uPower: { value: 5.0 },
    }),
    [],
  )
  const rimUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#8fd3ff') } }), [])

  return (
    <>
      <mesh scale={1.006}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial
          vertexShader={rimVertex}
          fragmentShader={rimFragment}
          uniforms={rimUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={1.16}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={glowUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

function Graticule() {
  const lines = useMemo(() => {
    const out = []
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = []
      for (let lon = -180; lon <= 180; lon += 4) pts.push(toVec(lat, lon, R * 1.002))
      out.push({ key: `lat${lat}`, pts, opacity: lat === 0 ? 0.22 : 0.1 })
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = []
      for (let lat = -90; lat <= 90; lat += 4) pts.push(toVec(lat, lon, R * 1.002))
      out.push({ key: `lon${lon}`, pts, opacity: 0.1 })
    }
    return out
  }, [])

  const antarcticCircle = useMemo(() => {
    const pts = []
    for (let lon = -180; lon <= 180; lon += 2) pts.push(toVec(-66.56, lon, R * 1.003))
    return pts
  }, [])

  return (
    <group>
      {lines.map((l) => (
        <Line key={l.key} points={l.pts} color="#7cc4ff" lineWidth={0.6} transparent opacity={l.opacity} />
      ))}
      <Line
        points={antarcticCircle}
        color="#67e8f9"
        lineWidth={1.1}
        dashed
        dashSize={0.02}
        gapSize={0.014}
        transparent
        opacity={0.55}
      />
    </group>
  )
}

function useFacingCamera(normal, labelRef, threshold = 0.12) {
  const { camera } = useThree()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const el = labelRef.current
    if (!el) return
    const facing = tmp.copy(camera.position).normalize().dot(normal)
    const visible = facing > threshold
    el.style.opacity = visible ? '1' : '0'
    el.style.pointerEvents = visible ? 'auto' : 'none'
  })
}

function formatReading(value, digits, unit) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : '—'
}

const SEVERITY_TONE = {
  CRITICAL: 'text-red-300 border-red-400/60 bg-red-500/15',
  ADVISORY: 'text-amber-200 border-amber-400/60 bg-amber-500/15',
  WARNING: 'text-amber-200 border-amber-400/60 bg-amber-500/15',
  CAUTION: 'text-amber-200 border-amber-400/60 bg-amber-500/15',
  NOMINAL: 'text-emerald-200 border-emerald-400/50 bg-emerald-500/10',
}

function StationMarker({ site, selected, telemetry, onSelect }) {
  const position = useMemo(() => toVec(site.lat, site.lon, R), [site])
  const normal = useMemo(() => position.clone().normalize(), [position])
  const ringQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    [normal],
  )
  const beamQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal),
    [normal],
  )
  const beamHeight = selected ? 0.22 : 0.14
  const beamPos = useMemo(
    () => position.clone().add(normal.clone().multiplyScalar(beamHeight / 2)),
    [position, normal, beamHeight],
  )
  const labelPos = useMemo(
    () => position.clone().add(normal.clone().multiplyScalar(beamHeight + 0.03)),
    [position, normal, beamHeight],
  )

  const ringA = useRef()
  const ringB = useRef()
  const labelRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  useFacingCamera(normal, labelRef)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ;[ringA, ringB].forEach((ref, i) => {
      if (!ref.current) return
      const phase = (t * 0.7 + i * 0.5) % 1
      const s = 0.4 + phase * (selected ? 2.4 : 1.8)
      ref.current.scale.setScalar(s)
      ref.current.material.opacity = (1 - phase) * 0.85
    })
  })

  const severity = telemetry?.risk?.severity || 'NOMINAL'
  const tone = SEVERITY_TONE[severity] || SEVERITY_TONE.NOMINAL
  const color = new THREE.Color(site.color)

  return (
    <group>
      <mesh
        position={position}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(site.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
      >
        <sphereGeometry args={[hovered || selected ? 0.019 : 0.015, 24, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {[ringA, ringB].map((ref, i) => (
        <mesh key={i} ref={ref} position={position.clone().add(normal.clone().multiplyScalar(0.002))} quaternion={ringQuat}>
          <ringGeometry args={[0.028, 0.034, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <mesh position={beamPos} quaternion={beamQuat}>
        <cylinderGeometry args={[0.0022, 0.006, beamHeight, 12, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Html position={labelPos} center zIndexRange={[30, 10]} style={{ transition: 'opacity 0.25s' }}>
        <button
          ref={labelRef}
          type="button"
          onClick={() => onSelect?.(site.id)}
          className={`globe-station-label group -translate-y-1/2 whitespace-nowrap rounded-xl border px-3 py-2 text-left backdrop-blur-md transition-all ${
            selected
              ? 'border-white/40 bg-base-900/90 shadow-[0_0_30px_rgba(56,189,248,0.35)]'
              : 'border-white/15 bg-base-900/70 hover:border-white/35'
          }`}
          style={{ boxShadow: selected ? `0 0 28px ${site.color}55` : undefined }}
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: site.color }}
              />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: site.color }} />
            </span>
            <span className="text-[13px] font-bold tracking-wide text-white">{site.name}</span>
            <span className={`rounded border px-1.5 py-px font-mono text-[9px] font-semibold ${tone}`}>{severity}</span>
          </span>
          <span className="mt-1 flex gap-3 font-mono text-[10px] text-slate-300">
            <span>{formatReading(telemetry?.ambient?.temp_c, 1, '°C')}</span>
            <span>{formatReading(telemetry?.ambient?.wind_speed_knots, 0, ' kt')}</span>
            <span className="text-slate-500">
              {Math.abs(site.lat).toFixed(2)}°S {site.lon.toFixed(2)}°E
            </span>
          </span>
        </button>
      </Html>
    </group>
  )
}

function RouteArc({ from, to, color, lift, dashed = false, speed = 0.18, label }) {
  const points = useMemo(() => arcPoints(from, to, lift), [from, to, lift])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points])
  const lineRef = useRef()
  const packetRef = useRef()
  const trailRef = useRef()
  const labelRef = useRef(null)
  const mid = points[Math.floor(points.length / 2)]
  const midNormal = useMemo(() => mid.clone().normalize(), [mid])
  useFacingCamera(midNormal, labelRef, 0.25)

  useFrame(({ clock }, delta) => {
    const t = (clock.elapsedTime * speed) % 1
    if (packetRef.current) packetRef.current.position.copy(curve.getPointAt(t))
    if (trailRef.current) trailRef.current.position.copy(curve.getPointAt(Math.max(0, t - 0.025)))
    if (dashed && lineRef.current?.material) lineRef.current.material.dashOffset -= delta * 0.12
  })

  return (
    <group>
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={dashed ? 1 : 2.2}
        transparent
        opacity={dashed ? 0.55 : 0.95}
        dashed={dashed}
        dashSize={0.03}
        gapSize={0.02}
      />
      {!dashed && (
        <Line points={points} color={color} lineWidth={7} transparent opacity={0.12} depthWrite={false} />
      )}
      <mesh ref={packetRef}>
        <sphereGeometry args={[dashed ? 0.006 : 0.009, 16, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={trailRef}>
        <sphereGeometry args={[dashed ? 0.004 : 0.006, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {label && (
        <Html position={mid} center zIndexRange={[25, 10]} style={{ transition: 'opacity 0.25s', pointerEvents: 'none' }}>
          <span
            ref={labelRef}
            className="whitespace-nowrap rounded-full border border-sky-300/30 bg-base-950/75 px-2 py-0.5 font-mono text-[10px] text-sky-200 backdrop-blur"
          >
            {label}
          </span>
        </Html>
      )}
    </group>
  )
}

function GoaNode() {
  const position = useMemo(() => toVec(GOA.lat, GOA.lon, R), [])
  const normal = useMemo(() => position.clone().normalize(), [position])
  const labelRef = useRef(null)
  useFacingCamera(normal, labelRef)
  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.012, 20, 20]} />
        <meshBasicMaterial color={GOA.color} toneMapped={false} />
      </mesh>
      <Html
        position={position.clone().add(normal.clone().multiplyScalar(0.05))}
        center
        zIndexRange={[25, 10]}
        style={{ transition: 'opacity 0.25s', pointerEvents: 'none' }}
      >
        <span
          ref={labelRef}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-orange-300/40 bg-base-950/80 px-2 py-1 font-mono text-[10px] font-semibold text-orange-200 backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          INDIA · NCPOR GOA
        </span>
      </Html>
    </group>
  )
}

function CameraRig({ view, flightRef, controlsRef }) {
  const { camera } = useThree()

  useEffect(() => {
    const v = VIEWS[view] || VIEWS.OVERVIEW
    flightRef.current = toVec(v.lat, v.lon, v.dist)
  }, [view, flightRef])

  useFrame((_, delta) => {
    const target = flightRef.current
    if (!target) return
    const k = 1 - Math.exp(-delta * 2.6)
    const dir = camera.position.clone().normalize().lerp(target.clone().normalize(), k).normalize()
    const dist = THREE.MathUtils.lerp(camera.position.length(), target.length(), k)
    camera.position.copy(dir.multiplyScalar(dist))
    camera.lookAt(0, 0, 0)
    controlsRef.current?.update()
    if (camera.position.distanceTo(target) < 0.004) flightRef.current = null
  })

  return null
}

function Scene({ view, selected, telemetry, onSelect }) {
  const controlsRef = useRef()
  const flightRef = useRef(null)
  const sun = useMemo(() => toVec(-15, 40, 6), [])

  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#cfe8ff', '#0b1a2e', 0.5]} />
      <directionalLight position={sun} intensity={2.1} color="#fff6e8" />
      <Stars radius={60} depth={40} count={liteGraphics ? 1500 : 4000} factor={3} saturation={0} fade speed={0.4} />

      <Earth />
      <Atmosphere />
      <Graticule />

      <RouteArc
        from={GLOBE_SITES.MAITRI}
        to={GLOBE_SITES.BHARATI}
        color="#7dd3fc"
        lift={0.09}
        speed={0.22}
        label={`${Math.round(greatCircleKm(GLOBE_SITES.MAITRI, GLOBE_SITES.BHARATI)).toLocaleString()} km`}
      />
      <RouteArc from={GOA} to={GLOBE_SITES.BHARATI} color="#fdba74" lift={0.22} dashed speed={0.12} />
      <RouteArc from={GOA} to={GLOBE_SITES.MAITRI} color="#fdba74" lift={0.26} dashed speed={0.1} />
      <GoaNode />

      {Object.values(GLOBE_SITES).map((site) => (
        <StationMarker
          key={site.id}
          site={site}
          selected={selected === site.id}
          telemetry={telemetry?.[site.id]}
          onSelect={onSelect}
        />
      ))}

      <CameraRig view={view} flightRef={flightRef} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
        minDistance={1.45}
        maxDistance={4.2}
        onStart={() => {
          flightRef.current = null
        }}
      />
    </>
  )
}

function GlobeLoading() {
  return (
    <Html center>
      <div className="flex items-center gap-2 font-mono text-xs text-sky-200">
        <span className="h-2 w-2 animate-ping rounded-full bg-sky-300" />
        Rendering globe…
      </div>
    </Html>
  )
}

export default memo(AntarcticGlobe)

function AntarcticGlobe({ selected, telemetry, onSelect, className = '' }) {
  const [view, setView] = useState('OVERVIEW')
  const shellRef = useRef(null)
  const active = useCanvasActive(shellRef)
  const initial = useMemo(() => toVec(VIEWS.OVERVIEW.lat, VIEWS.OVERVIEW.lon, VIEWS.OVERVIEW.dist), [])

  const focus = (id) => {
    setView(id)
    if (id !== 'OVERVIEW') onSelect?.(id)
  }

  const viewButton = (id, label, dot) => (
    <button
      key={id}
      type="button"
      onClick={() => focus(id)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
        view === id ? 'bg-white/15 text-white shadow-inner' : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {dot ? <span className="h-2 w-2 rounded-full" style={{ background: dot }} /> : <Globe2 size={13} />}
      {label}
    </button>
  )

  return (
    <div
      ref={shellRef}
      className={`globe-shell relative overflow-hidden rounded-3xl border border-sky-400/20 bg-[radial-gradient(ellipse_at_center,#0b1d33_0%,#050a12_62%,#02040a_100%)] ${className}`}
    >
      <Canvas
        frameloop={active ? 'always' : 'never'}
        camera={{ position: initial.toArray(), fov: 40, near: 0.1, far: 200 }}
        dpr={liteGraphics ? [1, 1] : [1, 1.5]}
        gl={{ antialias: !liteGraphics, alpha: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => (document.body.style.cursor = '')}
      >
        <Suspense fallback={<GlobeLoading />}>
          <Scene
            view={view}
            selected={selected}
            telemetry={telemetry}
            onSelect={(id) => {
              setView(id)
              onSelect?.(id)
            }}
          />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(2,6,14,0.9)]" />

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-sky-400/25 bg-base-950/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Southern Ocean network
      </div>

      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-base-950/70 p-1 backdrop-blur">
        {viewButton('OVERVIEW', 'Overview')}
        {viewButton('BHARATI', 'Bharati', GLOBE_SITES.BHARATI.color)}
        {viewButton('MAITRI', 'Maitri', GLOBE_SITES.MAITRI.color)}
      </div>

      <div className="absolute bottom-4 left-4 space-y-1.5 rounded-xl border border-white/10 bg-base-950/70 px-3 py-2.5 font-mono text-[10px] text-slate-300 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: GLOBE_SITES.BHARATI.color }} /> Bharati station
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: GLOBE_SITES.MAITRI.color }} /> Maitri station
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-400" /> NCPOR Goa command
        </div>
        <div className="flex items-center gap-2">
          <span className="h-px w-3 bg-cyan-300" /> Antarctic Circle 66.5°S
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-full border border-white/10 bg-base-950/70 px-3 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur">
        <span className="flex items-center gap-1">
          <MousePointer2 size={11} /> Drag to rotate
        </span>
        <span className="flex items-center gap-1">
          <Crosshair size={11} /> Scroll to zoom
        </span>
      </div>
    </div>
  )
}
