import { useCallback, useEffect, useRef, useState } from 'react'

import { VOICE_URL } from '../api/telemetry'
import { usePolarisStore } from '../store/usePolarisStore'
import { localVoiceTurn } from './localBrief'

const SAMPLE_RATE = 16000
const SPEAKING_WATCHDOG_MS = 12000

function voiceWsUrl() {
  const http = VOICE_URL.replace(/\/$/, '')
  return `${http.replace(/^http/, 'ws')}/ws/voice`
}

function AudioContextCtor() {
  return window.AudioContext || window.webkitAudioContext
}

function downsample(floats, inputRate, outputRate = SAMPLE_RATE) {
  if (!floats.length) return floats
  if (!inputRate || Math.abs(inputRate - outputRate) < 1) return floats
  const ratio = inputRate / outputRate
  const length = Math.max(1, Math.round(floats.length / ratio))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const idx = i * ratio
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, floats.length - 1)
    const frac = idx - i0
    out[i] = floats[i0] * (1 - frac) + floats[i1] * frac
  }
  return out
}

function floatsToPcm16(floats) {
  const pcm = new Int16Array(floats.length)
  for (let i = 0; i < floats.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floats[i]))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return pcm
}

function rmsLevel(floats) {
  let sum = 0
  for (let i = 0; i < floats.length; i += 1) {
    sum += floats[i] * floats[i]
  }
  return Math.sqrt(sum / Math.max(1, floats.length))
}

function pickLocalVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return (
    voices.find((v) => /en-GB/i.test(v.lang) && /male|ryan|daniel|george/i.test(v.name)) ||
    voices.find((v) => /en-IN/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  )
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
  const [micLevel, setMicLevel] = useState(0)

  const wsRef = useRef(null)
  const recCtxRef = useRef(null)
  const playCtxRef = useRef(null)
  const processorRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef(null)
  const sourceRef = useRef(null)
  const historyRef = useRef([])
  const speakingRef = useRef(false)
  const watchdogRef = useRef(0)
  const lastLevelAtRef = useRef(0)
  const speechRecRef = useRef(null)
  const wantMicRef = useRef(false)
  const pendingLocalTtsRef = useRef('')

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

  const resumeContexts = useCallback(async () => {
    const rec = recCtxRef.current
    const play = playCtxRef.current
    try {
      if (rec && rec.state === 'suspended') await rec.resume()
    } catch {
      // ignore
    }
    try {
      if (play && play.state === 'suspended') await play.resume()
    } catch {
      // ignore
    }
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
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // ignore
    }
  }, [])

  const signalPlaybackEnded = useCallback(() => {
    speakingRef.current = false
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current)
      watchdogRef.current = 0
    }
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'playback_ended' }))
    }
    setStatus('listening')
  }, [])

  const armSpeakingWatchdog = useCallback(() => {
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current)
    watchdogRef.current = window.setTimeout(() => {
      watchdogRef.current = 0
      if (!speakingRef.current) return
      console.warn('[Voice] speaking watchdog — returning to listen')
      stopPlayback()
      signalPlaybackEnded()
    }, SPEAKING_WATCHDOG_MS)
  }, [signalPlaybackEnded, stopPlayback])

  const speakLocal = useCallback(
    (text) => {
      const spoken = String(text || '').trim()
      if (!spoken || !window.speechSynthesis) {
        signalPlaybackEnded()
        return
      }
      try {
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(spoken)
        utter.rate = 0.96
        utter.pitch = 0.85
        const voice = pickLocalVoice()
        if (voice) utter.voice = voice
        utter.onend = () => {
          sourceRef.current = null
          signalPlaybackEnded()
        }
        utter.onerror = () => {
          signalPlaybackEnded()
        }
        window.speechSynthesis.speak(utter)
      } catch (err) {
        console.error('[Voice] local TTS failed', err)
        signalPlaybackEnded()
      }
    },
    [signalPlaybackEnded],
  )

  const playAudio = useCallback(
    async (blob) => {
      pendingLocalTtsRef.current = ''
      await resumeContexts()
      if (!playCtxRef.current) {
        signalPlaybackEnded()
        return
      }
      stopPlayback()
      try {
        if (playCtxRef.current.state === 'suspended') {
          await playCtxRef.current.resume()
        }
        const buffer = await blob.arrayBuffer()
        const decoded = await playCtxRef.current.decodeAudioData(buffer.slice(0))
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
        const fallbackText = pendingLocalTtsRef.current
        if (fallbackText) speakLocal(fallbackText)
        else signalPlaybackEnded()
      }
    },
    [resumeContexts, signalPlaybackEnded, speakLocal, stopPlayback],
  )

  const stopBrowserStt = useCallback(() => {
    const rec = speechRecRef.current
    if (!rec) return
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
    try {
      rec.stop()
    } catch {
      // ignore
    }
    speechRecRef.current = null
  }, [])

  const startBrowserStt = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    const ws = wsRef.current
    if (!Ctor || !ws || ws.readyState !== WebSocket.OPEN) return
    stopBrowserStt()
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    rec.onresult = (event) => {
      if (speakingRef.current) return
      const result = event.results[event.results.length - 1]
      if (!result?.isFinal) return
      const text = String(result[0]?.transcript || '').trim()
      if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      wsRef.current.send(JSON.stringify({ type: 'text', text }))
      stopBrowserStt()
    }
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone blocked. Allow mic access, then open the AI dock again.')
        rec.onend = null
        speechRecRef.current = null
      }
    }
    rec.onend = () => {
      if (!wantMicRef.current || speakingRef.current) return
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      window.setTimeout(() => {
        if (!wantMicRef.current || speakingRef.current) return
        try {
          rec.start()
        } catch {
          // already started
        }
      }, 180)
    }
    speechRecRef.current = rec
    try {
      rec.start()
    } catch {
      // already started
    }
  }, [stopBrowserStt])

  const enterListening = useCallback(() => {
    speakingRef.current = false
    setStatus('listening')
    if (wantMicRef.current) startBrowserStt()
  }, [startBrowserStt])

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
          const next = data.message || 'listening'
          setStatus(next)
          if (next === 'speaking') {
            speakingRef.current = true
            stopBrowserStt()
            armSpeakingWatchdog()
          }
          if (next === 'listening') {
            enterListening()
          }
        }
        if (data.type === 'interrupt') {
          speakingRef.current = false
          if (watchdogRef.current) {
            window.clearTimeout(watchdogRef.current)
            watchdogRef.current = 0
          }
          stopPlayback()
          enterListening()
        }
        if (data.type === 'transcript' && data.final) {
          appendLine(data.speaker === 'assistant' ? 'assistant' : 'user', data.text)
          if (data.speaker === 'assistant') pendingLocalTtsRef.current = data.text
        }
        if (data.type === 'tts_fallback' && data.text) {
          pendingLocalTtsRef.current = data.text
          speakLocal(data.text)
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
    [
      appendLine,
      armSpeakingWatchdog,
      enterListening,
      playAudio,
      speakLocal,
      stopBrowserStt,
      stopPlayback,
    ],
  )

  const teardown = useCallback(() => {
    wantMicRef.current = false
    speakingRef.current = false
    pendingLocalTtsRef.current = ''
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current)
      watchdogRef.current = 0
    }
    stopBrowserStt()
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
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
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
    setMicLevel(0)
  }, [stopBrowserStt, stopPlayback])

  const startCall = useCallback(async () => {
    setError('')
    setOpen(true)
    setStatus('connecting')
    teardown()
    wantMicRef.current = true
    setStatus('connecting')

    const Ctor = AudioContextCtor()
    if (Ctor) {
      recCtxRef.current = new Ctor({ sampleRate: SAMPLE_RATE })
      playCtxRef.current = new Ctor()
    }

    try {
      await resumeContexts()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      await resumeContexts()

      const ws = new WebSocket(voiceWsUrl())
      ws.binaryType = 'blob'
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setFallback(false)
        setStatus('connected')
        const rec = recCtxRef.current
        if (!rec) return
        if (rec.state === 'suspended') rec.resume()
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
          if (rec.state === 'suspended') rec.resume()
          const floats = event.inputBuffer.getChannelData(0)
          const now = performance.now()
          if (now - lastLevelAtRef.current > 80) {
            lastLevelAtRef.current = now
            setMicLevel(rmsLevel(floats))
          }
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
          const resampled = downsample(floats, rec.sampleRate, SAMPLE_RATE)
          wsRef.current.send(floatsToPcm16(resampled).buffer)
        }
        const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition
        ws.send(JSON.stringify({ type: 'browser_stt', enabled: Boolean(SpeechCtor) }))
      }

      ws.onmessage = handleMessage
      ws.onerror = () => {
        console.warn('[Voice] websocket error')
      }
      ws.onclose = () => {
        teardown()
      }
    } catch (err) {
      console.error('[Voice] mic failed', err)
      wantMicRef.current = false
      teardown()
      setError('Microphone blocked. You can still type a query.')
      setStatus('idle')
    }
  }, [handleMessage, resumeContexts, teardown])

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

  const teardownRef = useRef(teardown)
  teardownRef.current = teardown
  useEffect(() => () => teardownRef.current(), [])

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
    micLevel,
    draft,
    setDraft,
    startCall,
    endCall,
    sendText,
  }
}
