export const RESTAURANT_TZ = 'America/Mexico_City'

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: RESTAURANT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('es-MX', { timeZone: RESTAURANT_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const longFmt = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

/** Today's business date (YYYY-MM-DD) in the restaurant's timezone. */
export function todayInMexico(now = new Date()): string {
  return dateFmt.format(now)
}

/** HH:MM of an ISO timestamp in the restaurant's timezone. */
export function timeInMexico(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** "22 oct 2026" for a YYYY-MM-DD date. */
export function longDate(day: string): string {
  return longFmt.format(new Date(`${day}T12:00:00Z`)).replace('.', '')
}
