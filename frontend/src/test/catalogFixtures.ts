import type { Category, Dish, Extra, Ingredient } from '../domain/staffTypes'

export const CATEGORIES: Category[] = [{ id: 'c1', name: 'Bowls', description: null, sort_order: 1, is_active: true }]
export const INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Quinoa', is_available: true },
  { id: 'i2', name: 'Kale', is_available: true },
]
export const EXTRAS: Extra[] = [{ id: 'e1', name: 'Aguacate extra', price_cents: 3000, cost_cents: 1200, is_available: true, ingredient_id: null }]

export const DISH: Dish = {
  id: 'd1', category_id: 'c1', name: 'Bowl de quinoa', description: 'Con kale', price_cents: 16500, cost_cents: 5200,
  photo_path: null, prep_minutes: 10, tags: ['vegano'], is_available: true, is_active: true, sort_order: 1,
  ingredients: [{ ingredient_id: 'i1', name: 'Quinoa', is_removable: false }],
  extras: [{ extra_id: 'e1', name: 'Aguacate extra', max_quantity: 2 }],
}

export const OPTIONS = { categories: CATEGORIES, ingredients: INGREDIENTS, extras: EXTRAS }
