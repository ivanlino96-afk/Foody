import { useEffect, useState } from 'react'

/** Current time as HH:MM, refreshed every 15 s. */
export function useClock(): string {
  const format = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  const [time, setTime] = useState(format)
  useEffect(() => {
    const id = window.setInterval(() => setTime(format()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return time
}
