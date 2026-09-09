import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import PolarCalendar from './PolarCalendar'
import { exportSitrep } from './exportSitrep'
import {
  NODES,
  ROUTES,
  iceOpen,
  meltFrame,
  shipNearby,
  shipTrack,
  voyageClock,
  windowStatus,
} from './decisions'
import VoyageSlider from './VoyageSlider'

const PRYDZ_ICE = [
  [-66.2, 70.4],
  [-66.0, 80.8],
  [-69.8, 81.2],
  [-70.2, 70.0],
]

const LAZAREV_ICE = [
  [-68.6, 8.2],
  [-68.4, 16.4],
  [-71.4, 16.8],
  [-71.6, 8.0],
]

function nodeLatLng(id) {
  const node = NODES[id]
  return [node.lat, node.lon]
}

function FitStation({ station, ship, nearby }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const home = [NODES[station].lat, NODES[station].lon]
    const bay = station === 'BHARATI' ? NODES.QUILTY_BAY : NODES.INDIA_BAY
    const pts = [home, [bay.lat, bay.lon]]
    const closeToShip =
      nearby ||
      (Math.abs(ship.lat - home[0]) < 6 && Math.abs(ship.lon - home[1]) < 12)
    if (closeToShip) pts.push([ship.lat, ship.lon])
    map.fitBounds(pts, { padding: [22, 22], maxZoom: 8 })
  }, [map, nearby, ship.lat, ship.lon, station])
  return null
}

export default function MapDesk({
  station,
  date,
  polar,
  windows,
  telemetry,
  onNight,
  onLive,
  delayDays = 0,
  onDelay,
  decision,
}) {
  const center = [NODES[station].lat, NODES[station].lon]
  const clock = voyageClock(date, delayDays)
  const ship = shipTrack(clock)
  const nearby = shipNearby(station, clock)
  const melt = meltFrame(date)
  const prydzOpen = iceOpen(date, 'PRYDZ')
  const lazarevOpen = iceOpen(date, 'LAZAREV')
  const access = windows ?? windowStatus(station, date)
  const voyage = useMemo(
    () => [
      nodeLatLng('CPT'),
      nodeLatLng('QUILTY_BAY'),
      nodeLatLng('INDIA_BAY'),
      nodeLatLng('CPT'),
    ],
    [],
  )

  return (
    <div className="map-desk">
      <PolarCalendar
        compact
        station={station}
        date={date}
        polar={polar}
        windows={access}
        onNight={onNight}
        onLive={onLive}
      />

      {onDelay && (
        <VoyageSlider
          delayDays={delayDays}
          onChange={onDelay}
          decision={decision}
        />
      )}

      <div className="ship-card">
        <div className="chart-legend">
          <span>SHIP TRACK</span>
          <b>{nearby ? 'IN BAY' : 'AWAY'}</b>
        </div>
        <strong>{ship.leg}</strong>
        <em>
          {ship.lat.toFixed(2)}° / {ship.lon.toFixed(2)}° · heli{' '}
          {nearby ? 'OPEN' : 'LOCKED'}
        </em>
        <div className="source-note">{ship.source}</div>
      </div>

      <div className="chart-legend">
        <span>GIS</span>
        <b>
          {polar.phase} · Esri imagery (no API key)
        </b>
      </div>
      <div className="map-frame">
        <MapContainer
          key={station}
          center={center}
          zoom={station === 'BHARATI' ? 7 : 7}
          scrollWheelZoom
          zoomControl={false}
          attributionControl
          style={{ height: '100%', width: '100%', background: '#071018' }}
        >
          <TileLayer
            attribution="Esri World Imagery"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <FitStation station={station} ship={ship} nearby={nearby} />
          {!prydzOpen && (
            <Polygon
              positions={PRYDZ_ICE}
              pathOptions={{ color: '#9fe2f8', weight: 1, fillOpacity: 0.22 }}
            >
              <Popup>
                Prydz Bay ice climatology (closed). Not live NSIDC concentration.
              </Popup>
            </Polygon>
          )}
          {!lazarevOpen && (
            <Polygon
              positions={LAZAREV_ICE}
              pathOptions={{ color: '#9fe2f8', weight: 1, fillOpacity: 0.2 }}
            >
              <Popup>Lazarev / India Bay ice climatology. Not live NSIDC.</Popup>
            </Polygon>
          )}
          <Polyline
            positions={voyage}
            pathOptions={{ color: '#e8c48a', weight: 2, dashArray: '5 6' }}
          />
          {ROUTES.filter((route) => route.mode === 'AIR').map((route) => (
            <Polyline
              key={route.id}
              positions={[nodeLatLng(route.from), nodeLatLng(route.to)]}
              pathOptions={{ color: '#56b9d8', weight: 1.4 }}
            />
          ))}
          {Object.entries(NODES).map(([id, node]) => (
            <CircleMarker
              key={id}
              center={[node.lat, node.lon]}
              radius={id === station ? 8 : 5}
              pathOptions={{
                color: id === station ? '#f3e0b8' : '#9fe2f8',
                fillColor: id === station ? '#e8c48a' : '#1f6983',
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                {node.name}
                <br />
                {id}
              </Popup>
            </CircleMarker>
          ))}
          {melt.active && (
            <CircleMarker
              center={[-70.772814, 11.753228]}
              radius={6 + melt.area / 4000}
              pathOptions={{ color: '#64d8a0', fillOpacity: 0.28 }}
            >
              <Popup>
                Melt pond {melt.date}
                <br />
                {melt.volume} m³ · {melt.status}
              </Popup>
            </CircleMarker>
          )}
          <CircleMarker
            center={[ship.lat, ship.lon]}
            radius={8}
            pathOptions={{ color: '#ff6b7c', fillColor: '#ff6b7c', fillOpacity: 1 }}
          >
            <Popup>
              Voyage ship (modeled)
              <br />
              {ship.leg}
            </Popup>
          </CircleMarker>
        </MapContainer>
      </div>
      <div className="map-legend">
        <span className="map-key ice">ICE mask</span>
        <span className="map-key sea">AIR route</span>
        <span className="map-key ship">SHIP</span>
        <span>SEA {prydzOpen || lazarevOpen ? 'LEAD' : 'ICE'}</span>
        {melt.active && <span>POND {melt.status.toUpperCase()}</span>}
      </div>
      <button
        type="button"
        className="sitrep-export"
        onClick={() =>
          exportSitrep({
            station,
            telemetry,
            delayDays,
            plantMode: telemetry?.plant?.mode,
          })
        }
      >
        EXPORT SITREP PDF
      </button>
      <div className="source-note">
        Carto dark tiles need a paid basemap key — not used. Ice = seasonal
        climatology, not live NSIDC. Ship interpolated from AL/02 / 43-ISEA.
      </div>
    </div>
  )
}
