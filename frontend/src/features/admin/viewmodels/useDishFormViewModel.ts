import { useState } from 'react'
import { ApiError } from '../../../data/api/http'
import { centsToInput, parseMoneyInput } from '../../../domain/moneyInput'
import type { Category, Dish, DishExtraLink, DishIngredientLink, Extra, Ingredient } from '../../../domain/staffTypes'
import { useAuth } from '../../auth/AuthContext'

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface DishOptions {
  categories: Category[]
  ingredients: Ingredient[]
  extras: Extra[]
}

export interface DishFields {
  name: string
  description: string
  categoryId: string
  priceText: string
  costText: string
  prepText: string
  tagsText: string
  isActive: boolean
  isAvailable: boolean
}

type Links = { ingredients: { ingredient_id: string; is_removable: boolean }[]; extras: { extra_id: string; max_quantity: number }[] }
type Errors = Partial<Record<keyof DishFields, string>>

function fieldsOf(dish?: Dish): DishFields {
  return {
    name: dish?.name ?? '',
    description: dish?.description ?? '',
    categoryId: dish?.category_id ?? '',
    priceText: dish ? centsToInput(dish.price_cents) : '',
    costText: dish ? centsToInput(dish.cost_cents) : '',
    prepText: dish?.prep_minutes ? String(dish.prep_minutes) : '',
    tagsText: dish?.tags.join(', ') ?? '',
    isActive: dish?.is_active ?? true,
    isAvailable: dish?.is_available ?? true,
  }
}

function linksOf(dish?: Dish): Links {
  return {
    ingredients: (dish?.ingredients ?? []).map((l: DishIngredientLink) => ({ ingredient_id: l.ingredient_id, is_removable: l.is_removable })),
    extras: (dish?.extras ?? []).map((l: DishExtraLink) => ({ extra_id: l.extra_id, max_quantity: l.max_quantity })),
  }
}

/** Builds the API body from the form, or the field errors that stop it. */
function toBody(f: DishFields, links: Links): { body?: Record<string, unknown>; errors: Errors } {
  const errors: Errors = {}
  const price = parseMoneyInput(f.priceText)
  const cost = f.costText.trim() === '' ? 0 : parseMoneyInput(f.costText)
  const prep = f.prepText.trim() === '' ? null : Number(f.prepText)
  if (!f.name.trim()) errors.name = 'Escribe el nombre'
  if (!f.categoryId) errors.categoryId = 'Elige una categoría'
  if (price === null) errors.priceText = 'Escribe un precio válido, por ejemplo 165.50'
  if (cost === null) errors.costText = 'Escribe un costo válido o déjalo vacío'
  if (prep !== null && !(Number.isInteger(prep) && prep >= 1 && prep <= 240)) errors.prepText = 'Entre 1 y 240 minutos'
  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    body: {
      category_id: f.categoryId,
      name: f.name.trim(),
      description: f.description.trim(),
      price_cents: price,
      cost_cents: cost,
      prep_minutes: prep,
      tags: f.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      is_active: f.isActive,
      is_available: f.isAvailable,
      ingredients: links.ingredients,
      extras: links.extras,
    },
  }
}

export function useDishFormViewModel(dish: Dish | undefined, options: DishOptions, onSaved: () => void) {
  const { api } = useAuth()
  const [fields, setFields] = useState(() => fieldsOf(dish))
  const [links, setLinks] = useState(() => linksOf(dish))
  const [errors, setErrors] = useState<Errors>({})
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Id of a dish this form already created whose photo upload failed: retries update it instead of creating again.
  const [createdId, setCreatedId] = useState<string | null>(null)

  const set = <K extends keyof DishFields>(key: K, value: DishFields[K]) => setFields((f) => ({ ...f, [key]: value }))

  function pickPhoto(file: File | null) {
    setPhotoFile(null)
    setPhotoError(null)
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) return setPhotoError('Usa una foto JPG, PNG o WebP')
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError('La foto pesa más de 5 MB')
    setPhotoFile(file)
  }

  async function save() {
    const { body, errors: found } = toBody(fields, links)
    setErrors(found)
    if (!body) return
    setSaving(true)
    setError(null)
    let id = dish?.id ?? createdId
    try {
      if (!dish && !createdId) {
        id = (await api.createCatalog<Dish>('menu-items', body)).id
        setCreatedId(id)
      } else if (!dish && createdId) {
        await api.updateCatalog('menu-items', createdId, body)
      } else if (dish) {
        const original = toBody(fieldsOf(dish), linksOf(dish)).body ?? {}
        const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k])))
        if (Object.keys(changed).length) await api.updateCatalog('menu-items', dish.id, changed)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el platillo')
      setSaving(false)
      return
    }
    try {
      if (photoFile && id) await api.uploadPhoto(id, photoFile)
      onSaved()
    } catch (err) {
      setError(`El platillo se guardó, pero la foto no se subió: ${err instanceof ApiError ? err.message : 'intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  return {
    isNew: !dish,
    fields,
    set,
    errors,
    options,
    ingredientLinks: links.ingredients,
    extraLinks: links.extras,
    toggleIngredient: (id: string) => setLinks((l) => ({ ...l, ingredients: l.ingredients.some((x) => x.ingredient_id === id)
      ? l.ingredients.filter((x) => x.ingredient_id !== id) : [...l.ingredients, { ingredient_id: id, is_removable: true }] })),
    setRemovable: (id: string, removable: boolean) => setLinks((l) => ({ ...l,
      ingredients: l.ingredients.map((x) => (x.ingredient_id === id ? { ...x, is_removable: removable } : x)) })),
    toggleExtra: (id: string) => setLinks((l) => ({ ...l, extras: l.extras.some((x) => x.extra_id === id)
      ? l.extras.filter((x) => x.extra_id !== id) : [...l.extras, { extra_id: id, max_quantity: 1 }] })),
    setMaxQuantity: (id: string, n: number) => setLinks((l) => ({ ...l,
      extras: l.extras.map((x) => (x.extra_id === id ? { ...x, max_quantity: Math.min(10, Math.max(1, Math.round(n) || 1)) } : x)) })),
    photoFile,
    photoError,
    pickPhoto,
    saving,
    error,
    save,
  }
}
