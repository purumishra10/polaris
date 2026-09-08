import AerodynamicHull from './AerodynamicHull'
import IsoVillage from './IsoVillage'
import ElevatedUtility from './ElevatedUtility'
import OpsVehicles from './OpsVehicles'
import RadomeRidge from './RadomeRidge'

export default function BharatiStation(props) {
  return (
    <group {...props}>
      <AerodynamicHull />
      <IsoVillage />
      <ElevatedUtility />
      <OpsVehicles />
      <RadomeRidge />
    </group>
  )
}
