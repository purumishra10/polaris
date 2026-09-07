const ENGINE_URL = 'http://localhost:8000'

export async function getTelemetry(stationId) {
  const response = await fetch(
    `${ENGINE_URL}/telemetry/${stationId}`,
  )

  if (!response.ok) {
    throw new Error(
      `Telemetry request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function injectScenario(stationId, scenario) {
  const response = await fetch(
    `${ENGINE_URL}/scenario/inject`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        station_id: stationId,
        scenario,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Scenario injection failed: ${response.status}`,
    )
  }

  return response.json()
}

export function connectTelemetrySocket(onTelemetry, onError) {
  const socket = new WebSocket(
    'ws://localhost:8000/ws/telemetry',
  )

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      onTelemetry(data)
    } catch (error) {
      console.error(
        'Invalid telemetry message:',
        error,
      )
    }
  }

  socket.onerror = (error) => {
    console.error(
      'Telemetry WebSocket error:',
      error,
    )

    onError?.(error)
  }

  return socket
}