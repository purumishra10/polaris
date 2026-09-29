import { useEffect } from 'react'
import { useVoiceAgent } from './useVoiceAgent'

const STATUS_LABEL = {
  idle: 'STANDBY',
  connecting: 'LINKING',
  connected: 'LIVE',
  listening: 'LISTENING',
  transcribing: 'STT',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
}

const QUICK_COMMANDS = [
  ['Fuel', 'fuel status'],
  ['Blizzard', 'inject blizzard'],
  ['August fifth', 'fifth of August'],
  ['SITREP', 'export sitrep'],
  ['Briefing', 'station status briefing, fuel wind and alerts'],
]

export default function VoiceDock() {
  const {
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
  } = useVoiceAgent()

  useEffect(() => {
    const onBrief = () => {
      setOpen(true)
      void sendText('station status briefing, fuel wind and alerts')
    }
    window.addEventListener('polaris:briefing', onBrief)
    return () => window.removeEventListener('polaris:briefing', onBrief)
  }, [sendText, setOpen])

  const label = STATUS_LABEL[status] ?? status.toUpperCase()
  const showWave = status === 'speaking' || status === 'listening' || micActive

  return (
    <div className={`voice-dock ${open ? 'open' : ''} ${connected || micActive ? 'live' : ''}`}>
      {open && (
        <div className="voice-panel">
          <div className="voice-panel-head">
            <span>POLARIS AI</span>
            <strong className={`voice-status status-${status}`}>{label}</strong>
          </div>
          {(fallback || (ragMode && ragMode !== 'ops')) && (
            <div className="voice-rag">
              {fallback || ragMode === 'local-fallback'
                ? 'LOCAL SOP BRIEF · LLM OFF'
                : `RAG ${ragMode === 'pgvector' ? 'PGVECTOR' : 'KNOWLEDGE MD'}`}
              {sources.length ? ` · ${sources.length} HITS` : ''}
            </div>
          )}

          {showWave && (
            <div className={`voice-wave ${status}`} aria-hidden>
              {Array.from({ length: 12 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    animationDelay: `${index * 0.07}s`,
                    height:
                      status === 'listening'
                        ? `${5 + Math.min(18, micLevel * 90) * (0.35 + ((index * 3) % 5) / 5)}px`
                        : undefined,
                  }}
                />
              ))}
            </div>
          )}

          <div className="voice-chips">
            {QUICK_COMMANDS.map(([labelText, command]) => (
              <button key={command} type="button" onClick={() => sendText(command)}>
                {labelText}
              </button>
            ))}
          </div>

          <div className="voice-transcript">
            {lines.length === 0 && (
              <p className="voice-hint">
                Give an order: fuel, blizzard, ship +14, Maitri-II, fifth of August,
                export sitrep. If the sidecar dies I still brief from the desk.
              </p>
            )}
            {micActive && status === 'listening' && (
              <p className="voice-hint voice-hint-live">
                Mic open. Say fuel, blizzard, or map.
              </p>
            )}
            {lines.map((line, index) => (
              <div
                key={`${line.speaker}-${index}`}
                className={`voice-line ${line.speaker}`}
              >
                {line.text}
              </div>
            ))}
          </div>

          {sources.length > 0 && (
            <div className="voice-sources">
              {sources.map((hit) => (
                <div key={`${hit.source}-${hit.heading}`} className="voice-cite">
                  <b>{hit.heading}</b>
                  <span>{hit.source}</span>
                </div>
              ))}
            </div>
          )}

          {error && <div className="voice-error">{error}</div>}

          <form
            className="voice-form"
            onSubmit={(event) => {
              event.preventDefault()
              sendText(draft)
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a station query"
              autoComplete="off"
            />
            <button type="submit">SEND</button>
          </form>

          <div className="voice-actions">
            {micActive ? (
              <button type="button" className="voice-end" onClick={endCall}>
                END
              </button>
            ) : (
              <button type="button" className="voice-call" onClick={startCall}>
                OPEN MIC
              </button>
            )}
            <button
              type="button"
              className="voice-close"
              onClick={() => {
                endCall()
                setOpen(false)
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="voice-fab"
        onClick={() => {
          if (open) {
            endCall()
            setOpen(false)
            return
          }
          void startCall()
        }}
        title="Polaris station AI"
      >
        {connected || micActive ? 'LIVE' : 'AI'}
      </button>
    </div>
  )
}
