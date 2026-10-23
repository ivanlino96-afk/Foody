import { useEffect, useRef } from 'react'

/** Calls `fn` on mount and every `intervalMs`; skips ticks while the tab is hidden or a call is in flight. */
export function usePolling(fn: () => Promise<unknown>, intervalMs: number, enabled = true): void {
  const fnRef = useRef(fn)
  const busy = useRef(false)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const tick = async () => {
      if (!alive || busy.current || document.hidden) return
      busy.current = true
      try {
        await fnRef.current()
      } catch {
        // The caller keeps its own error state; polling keeps going.
      } finally {
        busy.current = false
      }
    }
    void tick()
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (!document.hidden) void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, enabled])
}
