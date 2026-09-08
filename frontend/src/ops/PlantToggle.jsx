export default function PlantToggle({ mode, onChange, station }) {
  return (
    <div className="plant-toggle">
      <div className="chart-legend">
        <span>PLANT DOCTRINE</span>
        <b>{station === 'MAITRI' ? 'MAITRI LOAD' : 'HITS MAITRI ONLY'}</b>
      </div>
      <div className="plant-row">
        <button
          type="button"
          className={mode === 'CURRENT' ? 'active' : ''}
          onClick={() => onChange('CURRENT')}
        >
          CURRENT 1988
        </button>
        <button
          type="button"
          className={mode === 'MAITRI_II' ? 'active' : ''}
          onClick={() => onChange('MAITRI_II')}
        >
          MAITRI-II
        </button>
      </div>
      <p>
        {mode === 'MAITRI_II'
          ? 'Planned 600–750 kVA · 600 kL JET A-1 · summer wing shuts in winter (40 / 140). Same weather, different burn.'
          : 'Current occupancy 25 winter / 65 summer (AL/03). Generator kVA is not published — energy stays labeled synthetic.'}
      </p>
    </div>
  )
}
