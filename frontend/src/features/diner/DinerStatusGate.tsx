import type { ReactNode } from 'react'
import { useDiner } from './DinerContext'
import { ErrorView, InvalidQrView } from './views/InvalidQrView'

/** One place for the screens that replace every diner route: unknown QR and nothing loaded at all. */
export function DinerStatusGate({ children }: { children: ReactNode }) {
  const { status, refreshSession } = useDiner()
  if (status === 'invalid_qr') return <InvalidQrView />
  if (status === 'error') return <ErrorView onRetry={() => void refreshSession().catch(() => undefined)} />
  return <>{children}</>
}
