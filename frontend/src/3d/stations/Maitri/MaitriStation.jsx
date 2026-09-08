import MaitriStructuralFrame from './MaitriStructuralFrame'
import MaitriModules from './MaitriModules'
import MaitriStairs from './MaitriStairs'
import MaitriInfrastructure from './MaitriInfrastructure'

export default function MaitriStation({
  position = [0, 0, 0],
}) {
  return (
    <group position={position}>
      <MaitriStructuralFrame />
      <MaitriModules />
      <MaitriStairs />
      <MaitriInfrastructure />
    </group>
  )
}
