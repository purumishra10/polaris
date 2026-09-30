const ENGINE_URL =
  import.meta.env.VITE_TWIN_ENGINE_URL ?? 'http://localhost:8000'
const WS_URL = `${ENGINE_URL.replace(/^http/, 'ws')}/ws/telemetry`

export const VOICE_URL =
  import.meta.env.VITE_VOICE_URL ?? 'http://localhost:8002'

async function apiRequest(path, options = {}) {
  const response = await fetch(`${ENGINE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`)
  }
  return response.json()
}

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

export async function replayAug2018() {
  return apiRequest('/api/replay/2018-08-05', { method: 'POST' })
}

export async function setClock(clock) {
  return apiRequest('/api/clock', {
    method: 'POST',
    body: JSON.stringify({ clock, live: false }),
  })
}

export async function liveNow() {
  return apiRequest('/api/clock', {
    method: 'POST',
    body: JSON.stringify({ live: true }),
  })
}

export async function getClockCatalog() {
  return apiRequest('/api/clock/catalog')
}
export async function getBlizzardValidation() {
  return apiRequest('/api/validate/blizzard-events')
}
export async function clearReplay() {
  return apiRequest('/api/replay/clear', { method: 'POST' })
}

export async function updateStationControls(controls) {
  return applyControls(controls)
}

export async function fetchTelemetryHistory(station = 'BHARATI', minutes = 60) {
  const query = new URLSearchParams({
    station,
    minutes: String(minutes),
  })
  return apiRequest(`/api/telemetry/history?${query}`)
}

export async function fetchModelCard(station = 'BHARATI') {
  return apiRequest(`/api/models/${station}`)
}

export async function fetchIncidentLog(limit = 80) {
  return apiRequest(`/api/events?limit=${limit}`)
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
  let lastStatus = null

  // Packets already carry latency; only push connection changes to the store
  // so each packet costs one store write instead of two.
  const reportStatus = (next) => {
    if (next.status === lastStatus) return
    lastStatus = next.status
    onStatusChange?.(next)
  }

  const startFallbackPolling = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      try {
        const data = await fetchTelemetrySnapshot()
        if (data) {
          onTelemetry(data)
          reportStatus({
            status: 'FALLBACK_POLLING',
            latency_ms: data.link_status?.latency_ms || 450,
          })
        }
      } catch (err) {
        reportStatus({ status: 'OFFLINE', error: err.message })
      }
    }, 2000)
  }

  const connect = () => {
    if (isClosedExplicitly) return

    try {
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        if (pollTimer) clearInterval(pollTimer)
        reportStatus({ status: 'CONNECTED_WS', latency_ms: 420 })
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          onTelemetry(payload)
        } catch (parseError) {
          console.error('Invalid telemetry JSON packet:', parseError)
        }
      }

      socket.onerror = () => {
        reportStatus({ status: 'ERROR_WS' })
      }

      socket.onclose = () => {
        if (!isClosedExplicitly) {
          reportStatus({ status: 'RECONNECTING' })
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
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close()
      }
    },
  }
}
