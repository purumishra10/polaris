import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const BHARATI = [-69.406, 76.195]
const MAITRI = [-70.766, 11.735]

function arc(from, to, lift = 8) {
  const steps = 24
  const points = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const lat = from[0] + (to[0] - from[0]) * t + Math.sin(Math.PI * t) * lift
    const lng = from[1] + (to[1] - from[1]) * t
    points.push([lat, lng])
  }
  return points
}

export default function AntarcticRouteMap({ onSelect }) {
  return (
    <div className="polar-map h-[220px] overflow-hidden rounded-2xl border border-base-700">
      <MapContainer
        center={[-70.3, 44]}
        zoom={3}
        minZoom={2}
        maxZoom={6}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#071016' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Polyline
          positions={arc(BHARATI, MAITRI)}
          pathOptions={{ color: '#7dd3fc', weight: 2, opacity: 0.85 }}
        />
        <CircleMarker
          center={BHARATI}
          radius={7}
          pathOptions={{ color: '#7dd3fc', fillColor: '#38bdf8', fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect?.('BHARATI') }}
        >
          <Tooltip direction="top" permanent>
            Bharati
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={MAITRI}
          radius={7}
          pathOptions={{ color: '#fcd34d', fillColor: '#fbbf24', fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect?.('MAITRI') }}
        >
          <Tooltip direction="top" permanent>
            Maitri
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  )
}
