import { useMemo } from 'react'

function RockyOutcrops() {
  const rocks = useMemo(() => {
    return Array.from({ length: 55 }, (_, i) => ({
      x: ((i * 37) % 100) - 50,
      z: ((i * 61) % 70) - 35,
      scale: 0.25 + ((i * 17) % 100) / 130,
      rotation: (i * 0.73) % Math.PI,
    }))
  }, [])

  return (
    <group>
      {rocks.map((rock, i) => (
        <mesh
          key={i}
          position={[rock.x, rock.scale * 0.22, rock.z]}
          rotation={[0, rock.rotation, 0]}
          scale={[
            rock.scale * 1.8,
            rock.scale * 0.65,
            rock.scale,
          ]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#55534f"
            roughness={0.95}
            metalness={0.03}
          />
        </mesh>
      ))}
    </group>
  )
}

function LowAntarcticRidges() {
    const ridges = [
        [-32, -20, 18, 1.4, 8],
        [-12, -24, 22, 1.2, 9],
        [12, -25, 20, 1.5, 10],
        [31, -20, 17, 1.3, 8],
      
        [-35, 17, 15, 1.1, 8],
        [34, 15, 16, 1.3, 9],
      ]

  return (
    <group>
      {ridges.map(([x, z, width, height, depth], i) => (
        <mesh
          key={i}
          position={[x, height * 0.45, z]}
          scale={[width, height, depth]}
          rotation={[0, i * 0.35, 0]}
          castShadow
        >
         <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#625f5a"
            roughness={1}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function AntarcticGround() {
  return (
    <group>
      {/* Rocky Antarctic plateau */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 80, 20, 20]} />
        <meshStandardMaterial
          color="#756f67"
          roughness={0.98}
          metalness={0.02}
        />
      </mesh>

      {/* Irregular snow fields */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-17, 0.01, -11]}
        scale={[1.7, 0.75, 1]}
        receiveShadow
      >
        <circleGeometry args={[8, 32]} />
        <meshStandardMaterial
          color="#d9e1e2"
          roughness={0.98}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[19, 0.015, 13]}
        scale={[1.6, 0.7, 1]}
        receiveShadow
      >
        <circleGeometry args={[7, 32]} />
        <meshStandardMaterial
          color="#e2e7e7"
          roughness={0.98}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-30, 0.02, 20]}
        scale={[1.8, 0.65, 1]}
        receiveShadow
      >
        <circleGeometry args={[6, 32]} />
        <meshStandardMaterial
          color="#cbd5d6"
          roughness={0.98}
        />
      </mesh>

      {/* Low distant Antarctic ridges */}
      <LowAntarcticRidges />

      {/* Rocky terrain */}
      <RockyOutcrops />

      {/* Main station access track */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 10]}
      >
        <planeGeometry args={[5, 40]} />
        <meshStandardMaterial
          color="#45433f"
          roughness={1}
        />
      </mesh>

      {/* Service track */}
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        position={[10, 0.028, 0]}
      >
        <planeGeometry args={[4, 30]} />
        <meshStandardMaterial
          color="#4b4945"
          roughness={1}
        />
      </mesh>
    </group>
  )
}