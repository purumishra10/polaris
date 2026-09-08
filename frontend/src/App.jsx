import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Analytics from './pages/Analytics'
import MissionControl from './pages/MissionControl'
import { usePolarisStore } from './store/usePolarisStore'
import { connectTelemetrySocket } from './api/telemetry'

export default function App() {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.toLowerCase()
    if (hash.includes('analytics')) return 'analytics'
    if (hash.includes('mission-control')) return 'mission-control'
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

  const navigate = (nextRoute) => {
    setRoute(nextRoute)
    if (nextRoute === 'home') {
      window.location.hash = '#/'
    } else if (nextRoute === 'analytics') {
      window.location.hash = '#/analytics'
    } else if (nextRoute === 'mission-control') {
      window.location.hash = '#/mission-control'
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (route === 'analytics') {
    return <Analytics onNavigate={navigate} />
  }

  if (route === 'mission-control') {
    return <MissionControl onNavigate={navigate} />
  }

  return <Home onNavigate={navigate} />
}