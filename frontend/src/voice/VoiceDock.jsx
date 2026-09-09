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
    draft,
    setDraft,
    startCall,
    endCall,
    sendText,
  } = useVoiceAgent()

  const label = STATUS_LABEL[status] ?? status.toUpperCase()

  return (
    <div className={`voice-dock ${open ? 'open' : ''} ${connected ? 'live' : ''}`}>
      {open && (
        <div className="voice-panel">
          <div className="voice-panel-head">
            <span>POLARIS AI</span>
            <strong className={`voice-status status-${status}`}>{label}</strong>
          </div>
          {(ragMode || fallback) && (
            <div className="voice-rag">
              {fallback || ragMode === 'local-fallback'
                ? 'LOCAL SOP BRIEF · LLM OFF'
                : `RAG ${ragMode === 'pgvector' ? 'PGVECTOR' : 'KNOWLEDGE MD'}`}
              {sources.length ? ` · ${sources.length} HITS` : ''}
            </div>
          )}

          {connected && (
            <div className="voice-meter" aria-hidden>
              <span
                className="voice-meter-fill"
                style={{ transform: `scaleX(${Math.min(1, micLevel * 8)})` }}
              />
            </div>
          )}

          <div className="voice-transcript">
            {lines.length === 0 && (
              <p className="voice-hint">
                Give an order: fuel, blizzard, ship +14, Maitri-II, fifth of August,
                export sitrep. If the sidecar dies I still brief from the desk.
              </p>
            )}
            {connected && status === 'listening' && (
              <p className="voice-hint voice-hint-live">Mic open — speak now.</p>
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
            {connected ? (
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
          setOpen(true)
          startCall()
        }}
        title="Polaris station AI"
      >
        {connected ? 'LIVE' : 'AI'}
      </button>
    </div>
  )
}
