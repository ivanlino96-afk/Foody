const MONEY = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{1,2}))?$/

/** Parses what a waiter types ("640", "640.5", "$1,640.50") into cents; null when it is not a valid amount. */
export function parseMoneyInput(text: string): number | null {
  const match = MONEY.exec(text.trim())
  if (!match || (match[1] === undefined && match[2] === undefined)) return null
  const pesos = Number((match[1] ?? '0').replaceAll(',', ''))
  const cents = Number((match[2] ?? '').padEnd(2, '0'))
  return pesos * 100 + cents
}

/** Cents as plain editable text ("640.00"), for prefilling inputs. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
