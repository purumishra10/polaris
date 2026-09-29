import { useEffect, useState } from 'react'
import { usePolarisStore } from '../store/usePolarisStore'

const DOWN = new Set(['OFFLINE', 'ERROR_WS', 'RECONNECTING', 'FALLBACK_POLLING'])
const UP = new Set(['CONNECTED_WS', 'CONNECTED'])

const SHOW_AFTER_MS = 7000
const CONFIRM_UP_MS = 1500
const RESTORED_FOR_MS = 4500

let notice = null
const listeners = new Set()
let downTimer = null
let upTimer = null
let hideTimer = null

function emit(next) {
  notice = next
  listeners.forEach((listener) => listener(next))
}

function clearTimer(kind) {
  if (kind === 'down' && downTimer) {
    window.clearTimeout(downTimer)
    downTimer = null
  }
  if (kind === 'up' && upTimer) {
    window.clearTimeout(upTimer)
    upTimer = null
  }
  if (kind === 'hide' && hideTimer) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

function trackLink(status) {
  if (DOWN.has(status)) {
    clearTimer('up')
    clearTimer('hide')
    if (notice === 'restored') emit(null)
    if (!downTimer && notice !== 'outage') {
      downTimer = window.setTimeout(() => {
        downTimer = null
        emit('outage')
      }, SHOW_AFTER_MS)
    }
    return
  }

  if (UP.has(status)) {
    clearTimer('down')
    if (notice === 'outage' && !upTimer) {
      upTimer = window.setTimeout(() => {
        upTimer = null
        emit('restored')
        hideTimer = window.setTimeout(() => {
          hideTimer = null
          emit(null)
        }, RESTORED_FOR_MS)
      }, CONFIRM_UP_MS)
    }
  }
}

export default function LinkBanner() {
  const status = usePolarisStore((s) => s.connection?.status)
  const [current, setCurrent] = useState(notice)

  useEffect(() => {
    listeners.add(setCurrent)
    setCurrent(notice)
    return () => listeners.delete(setCurrent)
  }, [])

  useEffect(() => {
    trackLink(status)
  }, [status])

  if (current === 'restored') {
    return (
      <div className="border-b border-emerald-500/40 bg-emerald-950/85 px-4 py-1.5 text-center text-[11px] font-mono text-emerald-100">
        Satellite link reconnected.
      </div>
    )
  }

  if (current === 'outage') {
    return (
      <div className="border-b border-red-500/50 bg-red-950/90 px-4 py-1.5 text-center text-[11px] font-mono text-red-100">
        Satellite link interrupted — reconnecting to the twin.
      </div>
    )
  }

  return null
}
