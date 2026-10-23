import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useSettingsViewModel } from './useSettingsViewModel'

afterEach(() => vi.unstubAllGlobals())

describe('useSettingsViewModel', () => {
  it('settings validates tip options', async () => {
    const fetchMock = stubFetch({
      'GET /me': meAs('admin'),
      'GET /admin/settings': { status: 200, body: { name: 'Foody', auto_release_minutes: 10, tip_options: [10, 15, 20] } },
      'PUT /admin/settings': (init) => ({ status: 200, body: JSON.parse(String(init.body)) }),
    })
    const { result } = renderHook(() => useSettingsViewModel(), { wrapper: staffWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.form).toEqual({ name: 'Foody', autoRelease: '10', tips: '10, 15, 20' })
    const puts = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'PUT')

    for (const tips of ['10, 0', '150', '', '5,10,15,20,25,30', '10.5']) {
      act(() => result.current.set('tips', tips))
      await act(() => result.current.save())
      expect(result.current.errors.tips, tips).toBe('Escribe de 1 a 5 porcentajes enteros entre 1 y 100')
    }
    act(() => result.current.set('autoRelease', '300'))
    await act(() => result.current.save())
    expect(result.current.errors.autoRelease).toBe('Entre 0 y 240 minutos')
    expect(puts()).toHaveLength(0)

    act(() => {
      result.current.set('autoRelease', '15')
      result.current.set('tips', '10, 15%, 18')
    })
    await act(() => result.current.save())
    expect(JSON.parse(String(puts()[0][1]?.body))).toEqual({ name: 'Foody', auto_release_minutes: 15, tip_options: [10, 15, 18] })
    expect(result.current.saved).toBe(true)
  })
})
