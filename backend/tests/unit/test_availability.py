from app.domain.entities import ItemExtra, ItemIngredient
from app.domain.services.availability import extra_available, item_availability
from tests.fakes import make_extra, make_ingredient, make_item


def test_disabled_item_is_unavailable():
    assert item_availability(make_item(is_available=False)).reason == "item_disabled"


def test_essential_ingredient_out_turns_item_off():
    tortilla = make_ingredient("Tortilla", available=False)
    a = item_availability(make_item(ingredients=[ItemIngredient(tortilla, is_removable=False)]))
    assert a.available is False and a.reason == "ingredient_unavailable:Tortilla"


def test_removable_ingredient_out_keeps_item_on():
    cebolla = make_ingredient("Cebolla", available=False)
    a = item_availability(make_item(ingredients=[ItemIngredient(cebolla, is_removable=True)]))
    assert a.available is True and a.unavailable_ingredient_ids == frozenset({cebolla.id})


def test_extra_off_when_its_ingredient_is_out():
    aguacate = make_ingredient("Aguacate", available=False)
    extra = make_extra("Aguacate extra", ingredient=aguacate)
    assert extra_available(extra) is False
    assert item_availability(make_item(extras=[ItemExtra(extra)])).unavailable_extra_ids == frozenset({extra.id})


def test_inactive_or_deleted_item_is_unavailable():
    assert item_availability(make_item(is_active=False)).reason == "item_inactive"
    assert item_availability(make_item(is_deleted=True)).reason == "item_inactive"
