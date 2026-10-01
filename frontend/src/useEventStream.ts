// WebSocket hook for live event streaming
// Uses stable refs to avoid re-creating the connection on every render.

import { useEffect, useRef } from 'react'

export function useEventStream(
  onMessage: (data: any) => void,
  onReset?: () => void,
) {
  // Store callbacks in refs so the WebSocket handler never goes stale
  // and we never need to tear down / rebuild the connection.
  const onMessageRef = useRef(onMessage)
  const onResetRef = useRef(onReset)

  // Update refs in an effect to comply with React 19's rule against
  // mutating refs during the render phase.
  useEffect(() => {
    onMessageRef.current = onMessage
    onResetRef.current = onReset
  })

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      try {
        ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/events`)
      } catch {
        reconnectTimer = setTimeout(connect, 3000)
        return
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'demo_reset' && onResetRef.current) {
            onResetRef.current()
            return
          }
          if (msg.type === 'ping') return
          // Forward the full message to the handler
          onMessageRef.current(msg)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onerror = () => {
        ws?.close()
      }

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 2000)
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null // prevent reconnect on cleanup close
        ws.close()
      }
    }
  }, []) // Empty deps — connect once, use refs for latest callbacks
}
