import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { RealtimeProvider, type RealtimeSource } from '../data/realtime'
import { AuthProvider } from '../features/auth/AuthContext'
import { fakeAuthClient } from './staffFakes'

/** Realtime stand-in: `emit(table)` fires a change, `setUp(false)` simulates a dropped socket. */
export function fakeRealtime(up = true) {
  const subs: { tables: string[]; onChange: (table: string) => void; onStatus: (up: boolean) => void }[] = []
  const source: RealtimeSource & { emit(table: string): void; setUp(v: boolean): void } = {
    subscribe: vi.fn((tables: string[], onChange: (table: string) => void, onStatus: (up: boolean) => void) => {
      const sub = { tables, onChange, onStatus }
      subs.push(sub)
      queueMicrotask(() => onStatus(up))
      return () => { subs.splice(subs.indexOf(sub), 1) }
    }),
    emit: (table) => subs.filter((s) => s.tables.includes(table)).forEach((s) => s.onChange(table)),
    setUp: (v) => subs.forEach((s) => s.onStatus(v)),
  }
  return source
}

/** Wrapper for staff hooks: a stored session (fetch must answer GET /me) plus a fake realtime source. */
export function staffWrapper(realtime: RealtimeSource = fakeRealtime()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <AuthProvider client={fakeAuthClient('stored')}>
          <RealtimeProvider source={realtime}>{children}</RealtimeProvider>
        </AuthProvider>
      </MemoryRouter>
    )
  }
}
