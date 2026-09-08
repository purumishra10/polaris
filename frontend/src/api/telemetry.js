const ENGINE_URL = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000/ws/telemetry'

export async function fetchTelemetrySnapshot() {
  const response = await fetch(`${ENGINE_URL}/api/telemetry`)
  if (!response.ok) {
    throw new Error(`Telemetry snapshot failed: ${response.status}`)
  }
  return response.json()
}

export async function applyControls(controlsPayload) {
  const response = await fetch(`${ENGINE_URL}/api/station/controls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(controlsPayload),
  })
  if (!response.ok) {
    throw new Error(`Control dispatch failed: ${response.status}`)
  }
  return response.json()
}

export async function injectScenario(scenarioType, durationSeconds = 60) {
  const response = await fetch(`${ENGINE_URL}/api/scenario/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_type: scenarioType,
      duration_seconds: durationSeconds,
    }),
  })
  if (!response.ok) {
    throw new Error(`Scenario injection failed: ${response.status}`)
  }
  return response.json()
}

export async function switchStation(stationId) {
  const response = await fetch(`${ENGINE_URL}/api/station/switch/${stationId}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Station switch failed: ${response.status}`)
  }
  return response.json()
}

export async function checkBackendHealth() {
  const response = await fetch(`${ENGINE_URL}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }
  return response.json()
}

export function connectTelemetrySocket(onTelemetry, onStatusChange) {
  let socket = null
  let reconnectTimer = null
  let pollTimer = null
  let isClosedExplicitly = false

  const startFallbackPolling = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      try {
        const data = await fetchTelemetrySnapshot()
        if (data) {
          onTelemetry(data)
          onStatusChange?.({ status: 'FALLBACK_POLLING', latency_ms: data.link_status?.latency_ms || 450 })
        }
      } catch (err) {
        onStatusChange?.({ status: 'OFFLINE', error: err.message })
      }
    }, 2000)
  }

  const connect = () => {
    if (isClosedExplicitly) return

    try {
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        if (pollTimer) clearInterval(pollTimer)
        onStatusChange?.({ status: 'CONNECTED_WS', latency_ms: 420 })
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          onTelemetry(payload)
          onStatusChange?.({
            status: 'CONNECTED_WS',
            latency_ms: payload.link_status?.latency_ms || 450,
            station_id: payload.station_id,
          })
        } catch (parseError) {
          console.error('Invalid telemetry JSON packet:', parseError)
        }
      }

      socket.onerror = () => {
        onStatusChange?.({ status: 'ERROR_WS' })
      }

      socket.onclose = () => {
        if (!isClosedExplicitly) {
          onStatusChange?.({ status: 'RECONNECTING' })
          startFallbackPolling()
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    } catch (err) {
      console.warn('WebSocket connection init failed, starting polling:', err)
      startFallbackPolling()
      reconnectTimer = setTimeout(connect, 5000)
    }
  }

  connect()

  return {
    disconnect: () => {
      isClosedExplicitly = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pollTimer) clearInterval(pollTimer)
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close()
      }
    },
  }
}