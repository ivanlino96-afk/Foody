from uuid import uuid4

import pytest

from app.domain.entities import ItemExtra, ItemIngredient
from app.domain.errors import InvalidCustomization, ItemUnavailable
from app.domain.services.pricing import ExtraRequest, LineRequest, RemovedIngredient, price_order
from tests.fakes import make_extra, make_ingredient, make_item


def test_line_total_includes_extras_times_quantity():
    queso = make_extra("Queso extra", price_cents=2500, cost_cents=800)
    taco = make_item("Taco", price_cents=4000, cost_cents=1500, extras=[ItemExtra(queso, max_quantity=2)])
    po = price_order({taco.id: taco}, [LineRequest(taco.id, 3, extras=(ExtraRequest(queso.id, 2),))])
    assert po.lines[0].line_total_cents == (4000 + 2500 * 2) * 3 == 27000
    assert po.cost_cents == (1500 + 800 * 2) * 3
    assert po.subtotal_cents == 27000


def test_unavailable_removable_ingredient_is_removed_automatically():
    cebolla = make_ingredient("Cebolla", available=False)
    taco = make_item(ingredients=[ItemIngredient(cebolla, True)])
    line = price_order({taco.id: taco}, [LineRequest(taco.id, 1)]).lines[0]
    assert line.removed == (RemovedIngredient(cebolla.id, "Cebolla"),)


def test_collects_every_unavailable_line():
    off = make_item(is_available=False)
    ok = make_item()
    with pytest.raises(ItemUnavailable) as e:
        price_order({off.id: off, ok.id: ok}, [LineRequest(ok.id, 1), LineRequest(off.id, 1), LineRequest(uuid4(), 1)])
    assert [line["index"] for line in e.value.details["lines"]] == [1, 2]
    assert e.value.details["lines"][1]["reason"] == "not_found"


def test_unavailable_extra_makes_line_unavailable():
    queso = make_extra("Queso", available=False)
    taco = make_item(extras=[ItemExtra(queso)])
    with pytest.raises(ItemUnavailable) as e:
        price_order({taco.id: taco}, [LineRequest(taco.id, 1, extras=(ExtraRequest(queso.id),))])
    assert e.value.details["lines"][0]["reason"] == "extra_unavailable:Queso"


def test_cannot_remove_essential_ingredient():
    tortilla = make_ingredient("Tortilla")
    taco = make_item(ingredients=[ItemIngredient(tortilla, False)])
    with pytest.raises(InvalidCustomization):
        price_order({taco.id: taco}, [LineRequest(taco.id, 1, removed_ingredient_ids=(tortilla.id,))])


def test_cannot_remove_foreign_ingredient():
    taco = make_item()
    with pytest.raises(InvalidCustomization):
        price_order({taco.id: taco}, [LineRequest(taco.id, 1, removed_ingredient_ids=(uuid4(),))])


@pytest.mark.parametrize("qty", [0, -1, 51])
def test_rejects_bad_quantities(qty):
    taco = make_item()
    with pytest.raises(InvalidCustomization):
        price_order({taco.id: taco}, [LineRequest(taco.id, qty)])


def test_rejects_empty_order():
    with pytest.raises(InvalidCustomization):
        price_order({}, [])


def test_rejects_duplicate_or_excess_extras():
    queso = make_extra("Queso")
    taco = make_item(extras=[ItemExtra(queso, max_quantity=1)])
    for extras in [(ExtraRequest(queso.id), ExtraRequest(queso.id)), (ExtraRequest(queso.id, 2),), (ExtraRequest(uuid4()),),
                   (ExtraRequest(queso.id, 0),)]:
        with pytest.raises(InvalidCustomization):
            price_order({taco.id: taco}, [LineRequest(taco.id, 1, extras=extras)])


def test_inactive_or_deleted_item_is_unavailable():
    gone = make_item(is_deleted=True)
    with pytest.raises(ItemUnavailable) as e:
        price_order({gone.id: gone}, [LineRequest(gone.id, 1)])
    assert e.value.details["lines"][0]["reason"] == "item_inactive"


def test_copies_names_and_note():
    taco = make_item("Taco al pastor")
    line = price_order({taco.id: taco}, [LineRequest(taco.id, 1, note="sin picante")]).lines[0]
    assert (line.item_name, line.note, line.unit_price_cents) == ("Taco al pastor", "sin picante", 4000)
