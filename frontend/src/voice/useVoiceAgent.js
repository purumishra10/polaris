import { useCallback, useEffect, useRef, useState } from 'react'

import { VOICE_URL } from '../api/telemetry'
import { usePolarisStore } from '../store/usePolarisStore'
import { localVoiceTurn } from './localBrief'

const SAMPLE_RATE = 16000
const PLAYBACK_SLACK_MS = 4000
const PLAYBACK_MAX_MS = 90000
const TTS_START_GRACE_MS = 900

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

function pcmPayload(pcm) {
  return pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
}

function rmsFromPcm16(pcm) {
  let sum = 0
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = pcm[i] / 32768
    sum += sample * sample
  }
  return Math.sqrt(sum / Math.max(1, pcm.length))
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

function unlockContext(ctx) {
  if (!ctx) return Promise.resolve()
  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || SAMPLE_RATE)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // ignore
  }
  return resume.catch(() => {})
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
  const [micActive, setMicActive] = useState(false)

  const wsRef = useRef(null)
  const recCtxRef = useRef(null)
  const workletRef = useRef(null)
  const processorRef = useRef(null)
  const inputRef = useRef(null)
  const streamRef = useRef(null)
  const audioElRef = useRef(null)
  const historyRef = useRef([])
  const speakingRef = useRef(false)
  const watchdogRef = useRef(0)
  const startGraceRef = useRef(0)
  const lastLevelAtRef = useRef(0)
  const wantMicRef = useRef(false)
  const pendingLocalTtsRef = useRef('')
  const utteranceRef = useRef(null)
  const callGenRef = useRef(0)
  const bargeInMsRef = useRef(0)
  const handleMessageRef = useRef(null)
  const runLocalTurnRef = useRef(null)

  const appendLine = useCallback((speaker, text) => {
    if (!text) return
    let clean = String(text)
    clean = clean.replace(/<[^>]+>/g, ' ')
    clean = clean.replace(/speak\s+version[\s\S]{0,200}/gi, ' ')
    clean = clean.replace(/\s+/g, ' ').trim()
    if (!clean) return
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.speaker === speaker && last.text === clean) return prev
      return [...prev.slice(-8), { speaker, text: clean }]
    })
    historyRef.current = [
      ...historyRef.current,
      { role: speaker === 'assistant' ? 'assistant' : 'user', content: clean },
    ].slice(-16)
  }, [])

  const stopPlayback = useCallback(() => {
    if (startGraceRef.current) {
      window.clearTimeout(startGraceRef.current)
      startGraceRef.current = 0
    }
    const audio = audioElRef.current
    if (audio) {
      try {
        audio.onended = null
        audio.onerror = null
        audio.pause()
        if (audio.src?.startsWith('blob:')) URL.revokeObjectURL(audio.src)
      } catch {
        // already stopped
      }
      audioElRef.current = null
    }
    utteranceRef.current = null
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
    if (startGraceRef.current) {
      window.clearTimeout(startGraceRef.current)
      startGraceRef.current = 0
    }
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'playback_ended' }))
    }
    setStatus('listening')
  }, [])

  const armSpeakingWatchdog = useCallback(
    (audioSeconds) => {
      if (watchdogRef.current) window.clearTimeout(watchdogRef.current)
      const ms = Math.min(
        PLAYBACK_MAX_MS,
        Math.max(6000, (audioSeconds || 0) * 1000 + PLAYBACK_SLACK_MS),
      )
      watchdogRef.current = window.setTimeout(() => {
        watchdogRef.current = 0
        if (!speakingRef.current) return
        console.warn('[Voice] speaking watchdog — returning to listen')
        stopPlayback()
        signalPlaybackEnded()
      }, ms)
    },
    [signalPlaybackEnded, stopPlayback],
  )

  const enterListening = useCallback(() => {
    speakingRef.current = false
    setStatus('listening')
  }, [])

  const speakLocal = useCallback(
    (text) => {
      const spoken = String(text || '').trim()
      if (!spoken || !window.speechSynthesis) {
        signalPlaybackEnded()
        return
      }
      speakingRef.current = true
      setStatus('speaking')
      armSpeakingWatchdog(spoken.split(/\s+/).length * 0.5 + 2)
      try {
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(spoken)
        utter.rate = 0.96
        utter.pitch = 0.85
        const voice = pickLocalVoice()
        if (voice) utter.voice = voice
        utter.onstart = () => {
          if (startGraceRef.current) {
            window.clearTimeout(startGraceRef.current)
            startGraceRef.current = 0
          }
        }
        utter.onend = () => {
          if (utteranceRef.current !== utter) return
          utteranceRef.current = null
          signalPlaybackEnded()
        }
        utter.onerror = () => {
          if (utteranceRef.current !== utter) return
          utteranceRef.current = null
          signalPlaybackEnded()
        }
        utteranceRef.current = utter
        window.setTimeout(() => {
          try {
            window.speechSynthesis.speak(utter)
          } catch (err) {
            console.error('[Voice] local TTS failed', err)
            signalPlaybackEnded()
          }
        }, 40)
        if (startGraceRef.current) window.clearTimeout(startGraceRef.current)
        startGraceRef.current = window.setTimeout(() => {
          startGraceRef.current = 0
          if (!speakingRef.current) return
          const pending = window.speechSynthesis.speaking || window.speechSynthesis.pending
          if (pending) return
          console.warn('[Voice] local TTS never started')
          signalPlaybackEnded()
        }, TTS_START_GRACE_MS)
      } catch (err) {
        console.error('[Voice] local TTS failed', err)
        signalPlaybackEnded()
      }
    },
    [armSpeakingWatchdog, signalPlaybackEnded],
  )

  const playAudio = useCallback(
    async (blob) => {
      const fallbackText = pendingLocalTtsRef.current
      stopPlayback()
      speakingRef.current = true
      setStatus('speaking')
      try {
        const audioBlob =
          blob instanceof Blob && blob.type
            ? blob
            : new Blob([blob], { type: 'audio/mpeg' })
        if (!audioBlob.size) {
          if (fallbackText) speakLocal(fallbackText)
          else signalPlaybackEnded()
          return
        }
        const url = URL.createObjectURL(audioBlob)
        const audio = new Audio(url)
        audioElRef.current = audio
        pendingLocalTtsRef.current = ''
        const armFromDuration = (seconds) => {
          const safe = Number.isFinite(seconds) && seconds > 0 ? seconds + 1.5 : 8
          armSpeakingWatchdog(safe)
        }
        armFromDuration(Math.max(6, audioBlob.size / 12000))
        audio.onloadedmetadata = () => armFromDuration(audio.duration)
        audio.onended = () => {
          if (audioElRef.current !== audio) return
          audioElRef.current = null
          URL.revokeObjectURL(url)
          signalPlaybackEnded()
        }
        audio.onerror = () => {
          if (audioElRef.current !== audio) return
          audioElRef.current = null
          URL.revokeObjectURL(url)
          if (fallbackText) speakLocal(fallbackText)
          else signalPlaybackEnded()
        }
        await audio.play()
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          armFromDuration(audio.duration)
        }
      } catch (err) {
        console.error('[Voice] playback failed', err)
        if (fallbackText) speakLocal(fallbackText)
        else signalPlaybackEnded()
      }
    },
    [armSpeakingWatchdog, signalPlaybackEnded, speakLocal, stopPlayback],
  )

  const runLocalTurn = useCallback(
    async (text) => {
      const value = String(text || '').trim()
      if (!value) return
      speakingRef.current = true
      appendLine('user', value)
      setStatus('thinking')
      setFallback(true)
      const local = localVoiceTurn(value, usePolarisStore.getState())
      appendLine('assistant', local.reply)
      setSources(local.sources)
      setRagMode(local.rag)
      await usePolarisStore.getState().applyVoiceActions(local.actions)
      pendingLocalTtsRef.current = local.reply
      speakLocal(local.reply)
    },
    [appendLine, speakLocal],
  )
  runLocalTurnRef.current = runLocalTurn

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
            armSpeakingWatchdog(0)
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
          signalPlaybackEnded()
        }
        if (data.type === 'notice' && data.message) {
          setError(data.message)
        }
        if (data.type === 'transcript' && data.final) {
          if (data.speaker === 'user') setError('')
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
      signalPlaybackEnded,
      speakLocal,
      stopPlayback,
    ],
  )
  handleMessageRef.current = handleMessage

  const maybeLocalBargeIn = useCallback(
    (level) => {
      if (!speakingRef.current) {
        bargeInMsRef.current = 0
        return
      }
      if (level < 0.055) {
        bargeInMsRef.current = 0
        return
      }
      bargeInMsRef.current += 128
      if (bargeInMsRef.current < 280) return
      bargeInMsRef.current = 0
      stopPlayback()
      signalPlaybackEnded()
    },
    [signalPlaybackEnded, stopPlayback],
  )

  const sendPcm = useCallback(
    (buffer) => {
      const pcm = buffer instanceof Int16Array ? buffer : new Int16Array(buffer)
      const level = rmsFromPcm16(pcm)
      const now = performance.now()
      if (now - lastLevelAtRef.current > 80) {
        lastLevelAtRef.current = now
        setMicLevel(level)
      }
      maybeLocalBargeIn(level)
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(pcm.buffer)
    },
    [maybeLocalBargeIn],
  )

  const teardown = useCallback(() => {
    wantMicRef.current = false
    speakingRef.current = false
    pendingLocalTtsRef.current = ''
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current)
      watchdogRef.current = 0
    }
    if (startGraceRef.current) {
      window.clearTimeout(startGraceRef.current)
      startGraceRef.current = 0
    }
    stopPlayback()
    if (workletRef.current) {
      workletRef.current.port.onmessage = null
      try {
        workletRef.current.disconnect()
      } catch {
        // ignore
      }
      workletRef.current = null
    }
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
    setConnected(false)
    setMicActive(false)
    setStatus('idle')
    setMicLevel(0)
  }, [stopPlayback])

  const attachLegacyMic = useCallback((stream) => {
    const rec = recCtxRef.current
    if (!rec) return
    const input = rec.createMediaStreamSource(stream)
    inputRef.current = input
    const processor = rec.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor
    input.connect(processor)
    const silent = rec.createGain()
    silent.gain.value = 0.0001
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
      const level = rmsLevel(floats)
      maybeLocalBargeIn(level)
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      const pcm =
        Math.abs(rec.sampleRate - SAMPLE_RATE) < 1
          ? floatsToPcm16(floats)
          : floatsToPcm16(downsample(floats, rec.sampleRate, SAMPLE_RATE))
      ws.send(pcmPayload(pcm))
    }
  }, [maybeLocalBargeIn])

  const attachMicGraph = useCallback(
    async (stream) => {
      const rec = recCtxRef.current
      if (!rec) return
      if (inputRef.current) {
        try {
          inputRef.current.disconnect()
        } catch {
          // ignore
        }
      }
      if (workletRef.current) {
        workletRef.current.port.onmessage = null
        try {
          workletRef.current.disconnect()
        } catch {
          // ignore
        }
        workletRef.current = null
      }
      if (processorRef.current) {
        try {
          processorRef.current.disconnect()
        } catch {
          // ignore
        }
        processorRef.current = null
      }

      if (rec.audioWorklet) {
        try {
          await rec.audioWorklet.addModule('/audio-processor.js')
          const input = rec.createMediaStreamSource(stream)
          inputRef.current = input
          const worklet = new AudioWorkletNode(rec, 'pcm-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            channelCount: 1,
            processorOptions: { bufferSize: 2048 },
          })
          workletRef.current = worklet
          worklet.port.onmessage = (event) => sendPcm(event.data)
          input.connect(worklet)
          return
        } catch (err) {
          console.warn('[Voice] AudioWorklet unavailable, using ScriptProcessor', err)
        }
      }
      attachLegacyMic(stream)
    },
    [attachLegacyMic, sendPcm],
  )

  const startCall = useCallback(async () => {
    const callId = callGenRef.current + 1
    callGenRef.current = callId
    setError('')
    setLines([])
    setSources([])
    historyRef.current = []
    setOpen(true)
    setStatus('connecting')
    teardown()
    if (callGenRef.current !== callId) return
    wantMicRef.current = true
    setStatus('connecting')

    const Ctor = AudioContextCtor()
    if (Ctor) {
      try {
        recCtxRef.current = new Ctor({ sampleRate: SAMPLE_RATE })
      } catch {
        recCtxRef.current = new Ctor()
      }
      await unlockContext(recCtxRef.current)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (callGenRef.current !== callId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setMicActive(true)
      await attachMicGraph(stream)

      const ws = new WebSocket(voiceWsUrl())
      ws.binaryType = 'blob'
      wsRef.current = ws

      const failToLocal = (reason) => {
        if (callGenRef.current !== callId) return
        wsRef.current = null
        setConnected(false)
        setFallback(true)
        setError(reason)
        enterListening()
      }

      const connectTimer = window.setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) return
        try {
          ws.close()
        } catch {
          // ignore
        }
      }, 4000)

      ws.onopen = () => {
        window.clearTimeout(connectTimer)
        if (callGenRef.current !== callId) return
        setConnected(true)
        setFallback(false)
        setError('')
        setStatus('connected')
        unlockContext(recCtxRef.current)
      }

      ws.onmessage = (event) => handleMessageRef.current?.(event)
      ws.onerror = () => {
        console.warn('[Voice] websocket error')
      }
      ws.onclose = () => {
        window.clearTimeout(connectTimer)
        if (callGenRef.current !== callId) return
        if (!wantMicRef.current) return
        failToLocal('Voice sidecar dropped. Mic is still open — local brief will answer.')
      }
    } catch (err) {
      console.error('[Voice] mic failed', err)
      wantMicRef.current = false
      teardown()
      setError('Microphone blocked. You can still type a query.')
      setStatus('idle')
    }
  }, [attachMicGraph, enterListening, teardown])

  const endCall = useCallback(() => {
    callGenRef.current += 1
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
      await runLocalTurn(value)
    },
    [runLocalTurn],
  )

  const teardownRef = useRef(teardown)
  teardownRef.current = teardown
  useEffect(() => () => teardownRef.current(), [])

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth?.getVoices) return undefined
    const warm = () => synth.getVoices()
    warm()
    synth.addEventListener?.('voiceschanged', warm)
    return () => synth.removeEventListener?.('voiceschanged', warm)
  }, [])

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
    micActive,
    draft,
    setDraft,
    startCall,
    endCall,
    sendText,
  }
}
