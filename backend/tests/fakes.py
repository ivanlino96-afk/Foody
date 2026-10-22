from uuid import uuid4

from app.domain.entities import Extra, Ingredient, ItemExtra, ItemIngredient, MenuItem


def make_ingredient(name: str = "Cebolla", available: bool = True) -> Ingredient:
    return Ingredient(id=uuid4(), name=name, is_available=available)


def make_extra(name: str = "Queso extra", price_cents: int = 2000, cost_cents: int = 500, available: bool = True,
               ingredient: Ingredient | None = None) -> Extra:
    return Extra(id=uuid4(), name=name, price_cents=price_cents, cost_cents=cost_cents, is_available=available,
                 ingredient=ingredient)


def make_item(name: str = "Taco", price_cents: int = 4000, cost_cents: int = 1500, is_available: bool = True,
              is_active: bool = True, is_deleted: bool = False, ingredients: list[ItemIngredient] | None = None,
              extras: list[ItemExtra] | None = None, category_id=None) -> MenuItem:
    return MenuItem(id=uuid4(), category_id=category_id or uuid4(), name=name, price_cents=price_cents,
                    cost_cents=cost_cents, is_available=is_available, is_active=is_active, is_deleted=is_deleted,
                    ingredients=tuple(ingredients or ()), extras=tuple(extras or ()))
