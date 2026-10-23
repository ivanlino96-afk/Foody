import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Dish } from '../../../domain/staffTypes'
import { DISH, OPTIONS } from '../../../test/catalogFixtures'
import { staffWrapper } from '../../../test/renderStaff'
import { meAs, stubFetch } from '../../../test/staffFakes'
import { useAuth } from '../../auth/AuthContext'
import { useDishFormViewModel } from './useDishFormViewModel'

afterEach(() => vi.unstubAllGlobals())

function setup(dish?: Dish) {
  const fetchMock = stubFetch({
    'GET /me': meAs('admin'),
    'POST /admin/menu-items': { status: 201, body: { ...DISH, id: 'new' } },
    'PATCH /admin/menu-items/d1': { status: 200, body: DISH },
    'POST /admin/menu-items/new/photo': { status: 200, body: { photo_path: 'menu/new.jpg' } },
  })
  const onSaved = vi.fn()
  const hook = renderHook(() => ({ vm: useDishFormViewModel(dish, OPTIONS, onSaved), auth: useAuth() }), { wrapper: staffWrapper() })
  const body = (method: string, path: string) => {
    const c = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith(path) && (i?.method ?? 'GET') === method)
    return c ? (typeof c[1]?.body === 'string' ? JSON.parse(c[1].body) : c[1]?.body) : undefined
  }
  return { ...hook, fetchMock, onSaved, body }
}

describe('useDishFormViewModel', () => {
  it('new dish sends links and cents', async () => {
    const { result, onSaved, body } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => {
      const vm = result.current.vm
      vm.set('name', '  Bowl verde ')
      vm.set('categoryId', 'c1')
      vm.set('priceText', '$165.5')
      vm.set('costText', '52')
      vm.set('prepText', '12')
      vm.set('tagsText', 'vegano, sin gluten ,')
    })
    act(() => result.current.vm.toggleIngredient('i1'))
    act(() => result.current.vm.setRemovable('i1', false))
    act(() => result.current.vm.toggleExtra('e1'))
    act(() => result.current.vm.setMaxQuantity('e1', 2))

    await act(() => result.current.vm.save())

    expect(body('POST', '/admin/menu-items')).toEqual({
      category_id: 'c1', name: 'Bowl verde', description: '', price_cents: 16550, cost_cents: 5200, prep_minutes: 12,
      tags: ['vegano', 'sin gluten'], is_active: true, is_available: true,
      ingredients: [{ ingredient_id: 'i1', is_removable: false }], extras: [{ extra_id: 'e1', max_quantity: 2 }],
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('validates required fields before sending', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => result.current.vm.set('priceText', 'abc'))
    await act(() => result.current.vm.save())
    expect(result.current.vm.errors).toEqual({ name: 'Escribe el nombre', categoryId: 'Elige una categoría',
      priceText: 'Escribe un precio válido, por ejemplo 165.50' })
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/admin/menu-items'))).toBe(false)
  })

  it('edit sends only changed fields', async () => {
    const { result, body, onSaved } = setup(DISH)
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    expect(result.current.vm.fields.priceText).toBe('165.00')
    act(() => result.current.vm.set('priceText', '170'))
    act(() => result.current.vm.setRemovable('i1', true))
    await act(() => result.current.vm.save())
    expect(body('PATCH', '/admin/menu-items/d1')).toEqual({
      price_cents: 17000, ingredients: [{ ingredient_id: 'i1', is_removable: true }],
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('an untouched edit sends nothing', async () => {
    const { result, fetchMock, onSaved } = setup(DISH)
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    await act(() => result.current.vm.save())
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/admin/menu-items') && i?.method === 'PATCH')).toBe(false)
    expect(onSaved).toHaveBeenCalled()
  })

  it('rejects photos over 5 MB or wrong type', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => result.current.vm.pickPhoto(new File(['x'], 'a.gif', { type: 'image/gif' })))
    expect(result.current.vm.photoError).toBe('Usa una foto JPG, PNG o WebP')
    act(() => result.current.vm.pickPhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })))
    expect(result.current.vm.photoError).toBe('La foto pesa más de 5 MB')
    expect(result.current.vm.photoFile).toBeNull()
    act(() => result.current.vm.pickPhoto(new File(['x'], 'a.webp', { type: 'image/webp' })))
    expect(result.current.vm.photoError).toBeNull()
    expect(result.current.vm.photoFile?.name).toBe('a.webp')
  })

  it('uploads the picked photo after creating the dish', async () => {
    const { result, fetchMock } = setup()
    await waitFor(() => expect(result.current.auth.status).toBe('signed_in'))
    act(() => {
      result.current.vm.set('name', 'Bowl')
      result.current.vm.set('categoryId', 'c1')
      result.current.vm.set('priceText', '100')
      result.current.vm.pickPhoto(new File(['x'], 'a.png', { type: 'image/png' }))
    })
    await act(() => result.current.vm.save())
    const upload = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/admin/menu-items/new/photo'))
    expect(upload?.[1]?.body).toBeInstanceOf(FormData)
  })
})
