import { useCallback, useEffect, useRef, useState } from 'react'

import { VOICE_URL } from '../api/telemetry'
import { usePolarisStore } from '../store/usePolarisStore'
import { localVoiceTurn } from './localBrief'

const SAMPLE_RATE = 16000

function voiceWsUrl() {
  const http = VOICE_URL.replace(/\/$/, '')
  return `${http.replace(/^http/, 'ws')}/ws/voice`
}

export function useVoiceAgent() {
  const [open, setOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [lines, setLines] = useState([])
  const [draft, setDraft] = useState('')
  const [sources, setSources] = useState([])
  const [ragMode, setRagMode] = useState('')
  const [fallback, setFallback] = useState(false)

  const wsRef = useRef(null)
  const recCtxRef = useRef(null)
  const playCtxRef = useRef(null)
  const processorRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef(null)
  const sourceRef = useRef(null)
  const historyRef = useRef([])
  const speakingRef = useRef(false)

  const appendLine = useCallback((speaker, text) => {
    if (!text) return
    let clean = String(text)
    clean = clean.replace(/<[^>]+>/g, ' ')
    clean = clean.replace(/speak\s+version[\s\S]{0,200}/gi, ' ')
    clean = clean.replace(/\s+/g, ' ').trim()
    if (!clean) return
    setLines((prev) => [...prev.slice(-8), { speaker, text: clean }])
    historyRef.current = [
      ...historyRef.current,
      { role: speaker === 'assistant' ? 'assistant' : 'user', content: clean },
    ].slice(-16)
  }, [])

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null
        sourceRef.current.stop()
      } catch {
        // already stopped
      }
      sourceRef.current = null
    }
  }, [])

  const signalPlaybackEnded = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'playback_ended' }))
    }
  }, [])

  const playAudio = useCallback(
    async (blob) => {
      if (!playCtxRef.current) return
      stopPlayback()
      try {
        const buffer = await blob.arrayBuffer()
        const decoded = await playCtxRef.current.decodeAudioData(buffer)
        const source = playCtxRef.current.createBufferSource()
        source.buffer = decoded
        source.connect(playCtxRef.current.destination)
        source.onended = () => {
          sourceRef.current = null
          speakingRef.current = false
          signalPlaybackEnded()
        }
        sourceRef.current = source
        source.start(0)
      } catch (err) {
        console.error('[Voice] playback failed', err)
        signalPlaybackEnded()
      }
    },
    [signalPlaybackEnded, stopPlayback],
  )

  const handleMessage = useCallback(
    (event) => {
      if (typeof event.data === 'string') {
        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          return
        }
        if (data.type === 'status') {
          setStatus(data.message || 'listening')
          if (data.message === 'speaking') speakingRef.current = true
          if (data.message === 'listening') speakingRef.current = false
        }
        if (data.type === 'interrupt') {
          speakingRef.current = false
          stopPlayback()
          setStatus('listening')
          signalPlaybackEnded()
        }
        if (data.type === 'transcript' && data.final) {
          appendLine(data.speaker === 'assistant' ? 'assistant' : 'user', data.text)
        }
        if (data.type === 'action') {
          usePolarisStore.getState().applyVoiceActions(data.actions)
        }
        if (data.type === 'sources') {
          setSources(Array.isArray(data.hits) ? data.hits : [])
          setRagMode(data.rag || '')
        }
        return
      }
      playAudio(event.data)
    },
    [appendLine, playAudio, signalPlaybackEnded, stopPlayback],
  )

  const teardown = useCallback(() => {
    stopPlayback()
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (inputRef.current) {
      inputRef.current.disconnect()
      inputRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    if (recCtxRef.current) {
      recCtxRef.current.close()
      recCtxRef.current = null
    }
    if (playCtxRef.current) {
      playCtxRef.current.close()
      playCtxRef.current = null
    }
    setConnected(false)
    setStatus('idle')
  }, [stopPlayback])

  const startCall = useCallback(async () => {
    setError('')
    setOpen(true)
    setStatus('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      const ws = new WebSocket(voiceWsUrl())
      ws.binaryType = 'blob'
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setStatus('connected')
        const rec = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: SAMPLE_RATE,
        })
        recCtxRef.current = rec
        const input = rec.createMediaStreamSource(stream)
        inputRef.current = input
        const processor = rec.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        input.connect(processor)
        const silent = rec.createGain()
        silent.gain.value = 0
        processor.connect(silent)
        silent.connect(rec.destination)
        processor.onaudioprocess = (event) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
          if (speakingRef.current) return
          const floats = event.inputBuffer.getChannelData(0)
          const pcm = new Int16Array(floats.length)
          for (let i = 0; i < floats.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, floats[i]))
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
          }
          wsRef.current.send(pcm.buffer)
        }
        playCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      ws.onmessage = handleMessage
      ws.onerror = () => {
        setFallback(true)
        setError('Mic link down. Type a query — local SOP brief still works.')
      }
      ws.onclose = () => {
        teardown()
      }
    } catch (err) {
      console.error('[Voice] mic failed', err)
      setError('Microphone blocked. You can still type a query.')
      setStatus('idle')
    }
  }, [handleMessage, teardown])

  const endCall = useCallback(() => {
    teardown()
  }, [teardown])

  const sendText = useCallback(
    async (text) => {
      const value = text.trim()
      if (!value) return
      setDraft('')
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text', text: value }))
        return
      }
      appendLine('user', value)
      setStatus('thinking')
      const runLocal = async (reason) => {
        setFallback(true)
        setError(reason)
        const local = localVoiceTurn(value, usePolarisStore.getState())
        appendLine('assistant', local.reply)
        setSources(local.sources)
        setRagMode(local.rag)
        await usePolarisStore.getState().applyVoiceActions(local.actions)
        setStatus('idle')
      }
      try {
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 4000)
        const response = await fetch(`${VOICE_URL.replace(/\/$/, '')}/api/voice/turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: value,
            history: historyRef.current,
          }),
          signal: controller.signal,
        })
        window.clearTimeout(timer)
        if (!response.ok) {
          throw new Error(`voice HTTP ${response.status}`)
        }
        const data = await response.json()
        setFallback(false)
        appendLine('assistant', data.reply)
        setSources(Array.isArray(data.sources) ? data.sources : [])
        setRagMode(data.rag || '')
        await usePolarisStore.getState().applyVoiceActions(data.actions)
        setStatus('idle')
      } catch (err) {
        console.error('[Voice] turn failed', err)
        await runLocal(
          'Voice sidecar timed out or is down. Local SOP brief is speaking from the desk.',
        )
      }
    },
    [appendLine],
  )

  useEffect(() => () => teardown(), [teardown])

  useEffect(() => {
    if (!open) return undefined
    const http = VOICE_URL.replace(/\/$/, '')
    fetch(`${http}/health`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.rag) setRagMode(data.rag)
      })
      .catch(() => {})
    return undefined
  }, [open])

  return {
    open,
    setOpen,
    connected,
    status,
    error,
    lines,
    sources,
    ragMode,
    fallback,
    draft,
    setDraft,
    startCall,
    endCall,
    sendText,
  }
}
