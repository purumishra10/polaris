import { usePolarisStore } from '../../store/usePolarisStore'

export default function InteractiveAsset({
  id,
  children,
  position = [0, 0, 0],
}) {
  const selectedSubsystem = usePolarisStore(
    (state) => state.selectedSubsystem,
  )

  const setSelectedSubsystem = usePolarisStore(
    (state) => state.setSelectedSubsystem,
  )

  const selected = selectedSubsystem === id

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation()

        setSelectedSubsystem(
          selected ? null : id,
        )
      }}
    >
      {children}

      {selected && (
        <pointLight
          position={[0, 1.5, 0]}
          intensity={3}
          distance={5}
          color="#66d9ff"
        />
      )}
    </group>
  )
}