import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('formats cents as MXN', () => {
    expect(formatMoney(38500)).toBe('$385.00')
    expect(formatMoney(123450)).toBe('$1,234.50')
    expect(formatMoney(0)).toBe('$0.00')
  })
})
