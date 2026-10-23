import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePolling } from '../shared/usePolling'
import { supabase } from './supabase'

/** Something that reports row changes on public tables; `onStatus(false)` means the socket is down. */
export interface RealtimeSource {
  subscribe(tables: string[], onChange: (table: string) => void, onStatus: (up: boolean) => void): () => void
}

let channelSeq = 0

/** Supabase Realtime `postgres_changes`, authenticated with the signed-in staff session (RLS: active staff). */
export const supabaseRealtime: RealtimeSource = {
  subscribe(tables, onChange, onStatus) {
    const client = supabase()
    let channel = client.channel(`live-${tables.join('-')}-${++channelSeq}`)
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(table))
    }
    channel.subscribe((status) => onStatus(status === 'SUBSCRIBED'))
    return () => { void client.removeChannel(channel) }
  },
}

const RealtimeContext = createContext<RealtimeSource>(supabaseRealtime)

export function RealtimeProvider({ source, children }: { source: RealtimeSource; children: ReactNode }) {
  return <RealtimeContext.Provider value={source}>{children}</RealtimeContext.Provider>
}

export const LIVE_DEBOUNCE_MS = 300

/**
 * Refetches through the API whenever one of `tables` changes (debounced), and keeps polling every
 * `fallbackMs` no matter what, so a dropped socket only slows updates down.
 */
export function useLiveRefresh(tables: string[], refresh: () => Promise<unknown>, fallbackMs: number): { connected: boolean } {
  const source = useContext(RealtimeContext)
  const [connected, setConnected] = useState(false)
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })
  const key = tables.join(',')

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = source.subscribe(key.split(','), () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void refreshRef.current().catch(() => undefined), LIVE_DEBOUNCE_MS)
    }, setConnected)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [source, key])

  usePolling(refresh, fallbackMs)
  return { connected }
}
