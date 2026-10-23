import { describe, expect, it } from 'vitest'
import { parseMoneyInput } from './moneyInput'

describe('parseMoneyInput', () => {
  it('parses money input', () => {
    expect(parseMoneyInput('640')).toBe(64000)
    expect(parseMoneyInput('640.5')).toBe(64050)
    expect(parseMoneyInput('$640.50')).toBe(64050)
    expect(parseMoneyInput(' $1,640.50 ')).toBe(164050)
    expect(parseMoneyInput('0.05')).toBe(5)
    expect(parseMoneyInput('.5')).toBe(50)
  })

  it('rejects what is not an amount', () => {
    for (const bad of ['', '  ', 'abc', '-5', '$-5', '1.234', '1,2,3.4.5', '12a', '1e3']) {
      expect(parseMoneyInput(bad), bad).toBeNull()
    }
  })
})
