from app.domain.enums import TableStatus
from app.domain.errors import ItemUnavailable


def test_item_unavailable_carries_code_and_lines():
    err = ItemUnavailable(lines=[{"index": 0, "menu_item_id": "a", "reason": "item_disabled"}])
    assert err.code == "item_unavailable"
    assert err.details == {"lines": [{"index": 0, "menu_item_id": "a", "reason": "item_disabled"}]}


def test_table_status_values():
    assert [s.value for s in TableStatus] == ["free", "occupied", "awaiting_order", "served", "bill_requested", "closed"]
