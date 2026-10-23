import { useEffect, useState, type ReactNode } from 'react'
import { useDiner } from './DinerContext'
import { SplashView } from './views/SplashView'

export const SPLASH_MIN_MS = 1_800
export const SPLASH_MAX_MS = 4_000

function alreadyShown(token: string): boolean {
  try {
    return sessionStorage.getItem(`foody.splash.${token}`) === '1'
  } catch {
    return false
  }
}

function markShown(token: string): void {
  try {
    sessionStorage.setItem(`foody.splash.${token}`, '1')
  } catch {
    // ignore
  }
}

/** Shows the splash once per tab: at least SPLASH_MIN_MS, until the menu loads, at most SPLASH_MAX_MS. */
export function SplashGate({ children }: { children: ReactNode }) {
  const { token, table, menuLoaded, status } = useDiner()
  const [visible, setVisible] = useState(() => !alreadyShown(token))
  const [minElapsed, setMinElapsed] = useState(false)
  const [maxElapsed, setMaxElapsed] = useState(false)

  useEffect(() => {
    if (!visible) return
    const a = window.setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS)
    const b = window.setTimeout(() => setMaxElapsed(true), SPLASH_MAX_MS)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [visible])

  const done = maxElapsed || (minElapsed && (menuLoaded || status !== 'loading'))
  const show = visible && !done && status !== 'invalid_qr'

  useEffect(() => {
    if (visible && !show) {
      markShown(token)
      setVisible(false)
    }
  }, [visible, show, token])

  const line = table ? [`Mesa ${table.code}`, table.label].filter(Boolean).join(' · ') : ''
  return (
    <>
      {children}
      {show && <SplashView tableLine={line} onSkip={() => { markShown(token); setVisible(false) }} />}
    </>
  )
}
