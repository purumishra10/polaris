import { useState, useEffect } from 'react'
import './App.css'
import Home from './pages/Home'
import Analytics from './pages/Analytics'
import MissionControl from './pages/MissionControl'
import Fleet from './pages/Fleet'
import VoiceDock from './voice/VoiceDock'
import CriticalOverlay from './ops/CriticalOverlay'
import { usePolarisStore } from './store/usePolarisStore'
import { connectTelemetrySocket } from './api/telemetry'

export default function App() {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.toLowerCase()
    if (hash.includes('analytics')) return 'analytics'
    if (hash.includes('mission-control')) return 'mission-control'
    if (hash.includes('fleet')) return 'fleet'
    return 'home'
  })

  const setTelemetryPacket = usePolarisStore((s) => s.setTelemetryPacket)
  const setConnectionStatus = usePolarisStore((s) => s.setConnectionStatus)

  // Listen to browser URL hash changes for native navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase()
      if (hash.includes('analytics')) {
        setRoute('analytics')
      } else if (hash.includes('mission-control')) {
        setRoute('mission-control')
      } else if (hash.includes('fleet')) {
        setRoute('fleet')
      } else {
        setRoute('home')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Establish persistent WebSocket connection with fallback polling
  useEffect(() => {
    const connection = connectTelemetrySocket(
      (packet) => {
        setTelemetryPacket(packet)
      },
      (status) => {
        setConnectionStatus(status)
      },
    )

    return () => {
      connection.disconnect()
    }
  }, [setTelemetryPacket, setConnectionStatus])

  // Soft plant drift only when WS is down. With live packets, 700ms ticks
  // double-update the store and re-render the whole 3D + desk every cycle.
  useEffect(() => {
    const id = window.setInterval(() => {
      const status = usePolarisStore.getState().connection?.status
      if (status === 'CONNECTED_WS' || status === 'CONNECTED') return
      usePolarisStore.getState().tickLive()
    }, 2000)
    return () => window.clearInterval(id)
  }, [])

  const navigate = (nextRoute) => {
    setRoute(nextRoute)
    if (nextRoute === 'home') {
      window.location.hash = '#/'
    } else if (nextRoute === 'analytics') {
      window.location.hash = '#/analytics'
    } else if (nextRoute === 'mission-control') {
      window.location.hash = '#/mission-control'
    } else if (nextRoute === 'fleet') {
      window.location.hash = '#/fleet'
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const page =
    route === 'analytics' ? (
      <Analytics onNavigate={navigate} />
    ) : route === 'mission-control' ? (
      <MissionControl onNavigate={navigate} />
    ) : route === 'fleet' ? (
      <Fleet onNavigate={navigate} />
    ) : (
      <Home onNavigate={navigate} />
    )

  return (
    <>
      {page}
      <CriticalOverlay />
      <VoiceDock />
    </>
  )
}
