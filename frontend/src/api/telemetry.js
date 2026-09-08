const ENGINE_URL =
  import.meta.env.VITE_TWIN_ENGINE_URL ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${ENGINE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      message || `Twin engine request failed: ${response.status}`
    )
  }

  return response.json()
}

export async function getTelemetry() {
  return request('/api/telemetry')
}

export async function switchStation(stationId) {
  return request(`/api/station/switch/${stationId}`, {
    method: 'POST',
  })
}

export async function injectScenario(
  scenarioType,
  durationSeconds = 60
) {
  return request('/api/scenario/inject', {
    method: 'POST',
    body: JSON.stringify({
      scenario_type: scenarioType,
      duration_seconds: durationSeconds,
    }),
  })
}

export async function updateStationControls(controls) {
  return request('/api/station/controls', {
    method: 'POST',
    body: JSON.stringify(controls),
  })
}

export function connectTelemetrySocket({
  onTelemetry,
  onOpen,
  onClose,
  onError,
}) {
  const socket = new WebSocket(
    `${ENGINE_URL.replace(/^http/, 'ws')}/ws/telemetry`
  )

  socket.onopen = () => {
    onOpen?.()
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onTelemetry?.(data)
    } catch (error) {
      console.error('[Twin WS] Invalid telemetry payload', error)
    }
  }

  socket.onerror = (error) => {
    console.error('[Twin WS] Connection error', error)
    onError?.(error)
  }

  socket.onclose = (event) => {
    onClose?.(event)
  }

  return socket
}