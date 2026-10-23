import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi } from '../../test/fakeApi'
import { renderDiner } from '../../test/renderDiner'
import { SplashGate } from './SplashGate'

afterEach(() => vi.useRealTimers())

describe('SplashGate', () => {
  it('shows once per tab for at least the minimum time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderDiner(<SplashGate><p>menú</p></SplashGate>, fakeApi())
    expect(screen.getByText('Preparando tu menú')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(1_900))
    expect(screen.queryByText('Preparando tu menú')).toBeNull()
    expect(sessionStorage.getItem('foody.splash.tok')).toBe('1')
  })

  it('is skipped when already shown', () => {
    sessionStorage.setItem('foody.splash.tok', '1')
    renderDiner(<SplashGate><p>menú</p></SplashGate>, fakeApi())
    expect(screen.queryByText('Preparando tu menú')).toBeNull()
  })
})
