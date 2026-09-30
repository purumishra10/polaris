import { useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import PolarCalendar from './PolarCalendar'
import { exportSitrep } from './exportSitrep'
import {
  NODES,
  ROUTES,
  iceOpen,
  meltFrame,
  shipNearby,
  voyageState,
  windowStatus,
  SEA_VIA,
} from './decisions'
import VoyageSlider from './VoyageSlider'
import DelayForecast from './DelayForecast'

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

const VIEWS = [
  { id: 'SHIP', label: 'SHIP' },
  { id: 'BHARATI', label: 'BHARATI' },
  { id: 'MAITRI', label: 'MAITRI' },
  { id: 'ROUTE', label: 'FULL' },
]

function nodeLatLng(id) {
  const node = NODES[id]
  return [node.lat, node.lon]
}

function shipIcon() {
  return L.divIcon({
    className: 'voyage-ship-icon',
    iconSize: [72, 56],
    iconAnchor: [36, 28],
    popupAnchor: [0, -28],
    html: `<div class="voyage-ship-mark">
      <svg viewBox="0 0 72 40" width="72" height="40" aria-hidden="true">
        <ellipse cx="36" cy="34" rx="26" ry="4" fill="rgba(8,18,24,0.45)"/>
        <path d="M8 24 C10 28 16 31 36 31 C56 31 62 28 64 24 L58 22 L14 22 Z" fill="#d7e0e6" stroke="#f7fbff" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M16 22 L20 16 H40 L44 22 Z" fill="#eef3f6"/>
        <rect x="22" y="10" width="16" height="8" rx="1.2" fill="#ff6b7c"/>
        <rect x="24" y="12" width="4" height="3" rx="0.4" fill="#9fe2f8"/>
        <rect x="30" y="12" width="4" height="3" rx="0.4" fill="#9fe2f8"/>
        <rect x="40" y="8" width="5" height="10" rx="0.8" fill="#6a1b22"/>
        <rect x="40.8" y="5" width="3.4" height="4" rx="0.4" fill="#24343c"/>
        <circle cx="18" cy="26" r="1.4" fill="#24343c"/>
        <circle cx="24" cy="26.4" r="1.4" fill="#24343c"/>
        <circle cx="30" cy="26.6" r="1.4" fill="#24343c"/>
        <circle cx="36" cy="26.6" r="1.4" fill="#24343c"/>
        <path d="M12 24 H60" stroke="#ff6b7c" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>SHIP</span>
    </div>`,
  })
}

function ShipMarker({ ship }) {
  const icon = useMemo(() => shipIcon(), [])
  return (
    <Marker position={[ship.lat, ship.lon]} icon={icon} zIndexOffset={900}>
      <Popup>
        <b>{ship.label}</b>
        <br />
        {ship.lat.toFixed(2)}° {ship.lon.toFixed(2)}°
        <br />
        {km(ship.remainingKm)} · {days(ship.remainingDays)} this leg
        <br />
        Bharati {km(ship.kmToBharati)} / {days(ship.daysToBharati)}
        <br />
        Maitri {km(ship.kmToMaitri)} / {days(ship.daysToMaitri)}
      </Popup>
    </Marker>
  )
}

function km(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v < 10 ? `${v.toFixed(1)} km` : `${Math.round(v)} km`
}

function days(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${Math.round(v)} d`
}

function FitView({ view, station, ship }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const shipPt = [ship.lat, ship.lon]
    const viaPt = [SEA_VIA.lat, SEA_VIA.lon]
    let timer
    if (view === 'SHIP') {
      const corridor = [nodeLatLng('CPT'), viaPt, nodeLatLng('QUILTY_BAY'), nodeLatLng('INDIA_BAY'), shipPt]
      map.fitBounds(corridor, { padding: [28, 28], maxZoom: 4 })
      timer = window.setTimeout(() => {
        map.invalidateSize()
        map.fitBounds(corridor, { padding: [28, 28], maxZoom: 4 })
      }, 80)
      return () => window.clearTimeout(timer)
    }
    let pts
    if (view === 'ROUTE') {
      pts = [nodeLatLng('CPT'), viaPt, nodeLatLng('QUILTY_BAY'), nodeLatLng('INDIA_BAY'), shipPt]
    } else if (view === 'BHARATI') {
      pts = [nodeLatLng('BHARATI'), nodeLatLng('QUILTY_BAY')]
      if (ship.atBharati || (ship.kmToBharati != null && ship.kmToBharati < 400)) pts.push(shipPt)
    } else if (view === 'MAITRI') {
      pts = [nodeLatLng('MAITRI'), nodeLatLng('INDIA_BAY')]
      if (ship.atMaitri || (ship.kmToMaitri != null && ship.kmToMaitri < 400)) pts.push(shipPt)
    } else {
      pts = [nodeLatLng('CPT'), nodeLatLng('QUILTY_BAY'), nodeLatLng('INDIA_BAY'), shipPt]
    }
    map.fitBounds(pts, { padding: [28, 28], maxZoom: view === 'ROUTE' ? 4 : 7 })
  }, [map, view, station, ship.lat, ship.lon, ship.phase, ship.atBharati, ship.atMaitri, ship.kmToBharati, ship.kmToMaitri])
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
  const [view, setView] = useState('SHIP')
  const clock = useMemo(() => {
    const next = new Date(date.getTime())
    next.setUTCDate(next.getUTCDate() - Number(delayDays || 0))
    return next
  }, [date, delayDays])
  const ship = voyageState(clock)
  const center = view === 'SHIP'
    ? [SEA_VIA.lat, SEA_VIA.lon]
    : [NODES[station].lat, NODES[station].lon]
  const nearbyB = shipNearby('BHARATI', clock)
  const nearbyM = shipNearby('MAITRI', clock)
  const melt = meltFrame(date)
  const prydzOpen = iceOpen(date, 'PRYDZ')
  const lazarevOpen = iceOpen(date, 'LAZAREV')
  const access = windows ?? windowStatus(station, date)
  const route = useMemo(
    () => [
      nodeLatLng('CPT'),
      [SEA_VIA.lat, SEA_VIA.lon],
      nodeLatLng('QUILTY_BAY'),
      nodeLatLng('INDIA_BAY'),
      nodeLatLng('CPT'),
    ],
    [],
  )
  const done = useMemo(() => {
    const via = [SEA_VIA.lat, SEA_VIA.lon]
    const here = [ship.lat, ship.lon]
    if (ship.phase === 'LAYUP' || (ship.phase === 'STEAM_BHARATI' && ship.t < 0.5)) {
      return [nodeLatLng('CPT'), here]
    }
    if (ship.phase === 'STEAM_BHARATI') return [nodeLatLng('CPT'), via, here]
    if (ship.phase === 'AT_BHARATI') return [nodeLatLng('CPT'), via, nodeLatLng('QUILTY_BAY')]
    if (ship.phase === 'STEAM_MAITRI') {
      return [nodeLatLng('CPT'), via, nodeLatLng('QUILTY_BAY'), here]
    }
    if (ship.phase === 'AT_MAITRI' || ship.phase === 'STEAM_HOME') {
      return [nodeLatLng('CPT'), via, nodeLatLng('QUILTY_BAY'), nodeLatLng('INDIA_BAY'), here]
    }
    return [nodeLatLng('CPT')]
  }, [ship.phase, ship.lat, ship.lon, ship.t])

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

      {decision && <DelayForecast decision={decision} />}

      <div className="ship-card">
        <div className="chart-legend">
          <span>VOYAGE SHIP</span>
          <b>{ship.phase.replace(/_/g, ' ')}</b>
        </div>
        <strong>{ship.label}</strong>
        <em>
          {ship.leg} · {ship.lat.toFixed(2)}° {ship.lon.toFixed(2)}°
        </em>
        <div className="ship-stats">
          <div>
            <span>THIS LEG</span>
            <b>{km(ship.remainingKm)}</b>
            <em>{days(ship.remainingDays)} left</em>
          </div>
          <div className={ship.atBharati ? 'on' : ''}>
            <span>BHARATI</span>
            <b>{ship.atBharati ? 'IN BAY' : km(ship.kmToBharati)}</b>
            <em>{ship.atBharati ? 'heli OPEN' : `${days(ship.daysToBharati)} · heli ${nearbyB ? 'OPEN' : 'LOCK'}`}</em>
          </div>
          <div className={ship.atMaitri ? 'on' : ''}>
            <span>MAITRI</span>
            <b>{ship.atMaitri ? 'IN BAY' : km(ship.kmToMaitri)}</b>
            <em>{ship.atMaitri ? 'heli OPEN' : `${days(ship.daysToMaitri)} · heli ${nearbyM ? 'OPEN' : 'LOCK'}`}</em>
          </div>
        </div>
      </div>

      <div className="map-views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'on' : ''}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="map-frame voyage">
        <MapContainer
          key={`${station}-${view}`}
          center={center}
          zoom={view === 'SHIP' ? 3 : 4}
          scrollWheelZoom
          zoomControl={false}
          attributionControl
          style={{ height: '100%', width: '100%', background: '#071018' }}
        >
          <TileLayer
            attribution="Esri World Imagery"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <FitView view={view} station={station} ship={ship} />
          {!prydzOpen && (
            <Polygon
              positions={PRYDZ_ICE}
              pathOptions={{ color: '#9fe2f8', weight: 1, fillOpacity: 0.22 }}
            >
              <Popup>Prydz ice climatology — not live NSIDC.</Popup>
            </Polygon>
          )}
          {!lazarevOpen && (
            <Polygon
              positions={LAZAREV_ICE}
              pathOptions={{ color: '#9fe2f8', weight: 1, fillOpacity: 0.2 }}
            >
              <Popup>Lazarev ice climatology — not live NSIDC.</Popup>
            </Polygon>
          )}
          <Polyline
            positions={route}
            pathOptions={{ color: '#5a7380', weight: 1.4, dashArray: '4 7' }}
          />
          <Polyline
            positions={done}
            pathOptions={{ color: '#e8c48a', weight: 3 }}
          />
          {ROUTES.filter((routeRow) => routeRow.mode === 'AIR').map((routeRow) => (
            <Polyline
              key={routeRow.id}
              positions={[nodeLatLng(routeRow.from), nodeLatLng(routeRow.to)]}
              pathOptions={{ color: '#56b9d8', weight: 1.2 }}
            />
          ))}
          {['BHARATI', 'MAITRI', 'QUILTY_BAY', 'INDIA_BAY', 'CPT'].map((id) => {
            const node = NODES[id]
            const home = id === 'BHARATI' || id === 'MAITRI'
            return (
              <CircleMarker
                key={id}
                center={[node.lat, node.lon]}
                radius={home ? 8 : 5}
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
            )
          })}
          {melt.active && (
            <CircleMarker
              center={[-70.772814, 11.753228]}
              radius={6 + melt.area / 4000}
              pathOptions={{ color: '#64d8a0', fillOpacity: 0.28 }}
            >
              <Popup>
                Melt pond {melt.date}
                <br />
                {melt.volume} m³
              </Popup>
            </CircleMarker>
          )}
          <ShipMarker ship={ship} />
        </MapContainer>
      </div>
      <div className="map-legend">
        <span className="map-key ship">SHIP now</span>
        <span className="map-key sea">FLOWN (gold) / remaining dashed</span>
        <span>BHARATI {nearbyB ? 'HELI' : '—'}</span>
        <span>MAITRI {nearbyM ? 'HELI' : '—'}</span>
      </div>
      <button
        type="button"
        className="sitrep-export"
        onClick={() => {
          void exportSitrep({
            station,
            telemetry,
            delayDays,
            plantMode: telemetry?.plant?.mode,
          })
        }}
      >
        EXPORT SITREP PDF
      </button>
      <div className="source-note">
        Position is great-circle between AL/02 waypoints, not a live AIS fix. km are spherical Earth.
        Delay slider moves the ship backward on that calendar.
      </div>
    </div>
  )
}
