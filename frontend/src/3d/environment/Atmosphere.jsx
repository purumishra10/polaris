export default function Atmosphere() {
    return (
      <>
        <color attach="background" args={['#050b10']} />
  
        <fog
          attach="fog"
          args={['#071118', 28, 85]}
        />
      </>
    )
  }