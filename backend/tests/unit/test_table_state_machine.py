import itertools

import pytest

from app.domain.enums import TableEvent as E
from app.domain.enums import TableStatus as S
from app.domain.errors import InvalidTransition
from app.domain.services.table_state_machine import can_order, next_table_status

VALID = [
    (S.FREE, E.OPEN, S.OCCUPIED),
    (S.OCCUPIED, E.ORDER_PLACED, S.AWAITING_ORDER),
    (S.AWAITING_ORDER, E.ORDER_PLACED, S.AWAITING_ORDER),
    (S.SERVED, E.ORDER_PLACED, S.AWAITING_ORDER),
    (S.AWAITING_ORDER, E.ALL_SERVED, S.SERVED),
    (S.OCCUPIED, E.BILL_REQUESTED, S.BILL_REQUESTED),
    (S.AWAITING_ORDER, E.BILL_REQUESTED, S.BILL_REQUESTED),
    (S.SERVED, E.BILL_REQUESTED, S.BILL_REQUESTED),
    (S.BILL_REQUESTED, E.PAID, S.CLOSED),
    (S.CLOSED, E.RELEASE, S.FREE),
    (S.CLOSED, E.REOPEN, S.OCCUPIED),
]


@pytest.mark.parametrize(("current", "event", "expected"), VALID)
def test_valid_transitions(current, event, expected):
    assert next_table_status(current, event) == expected


INVALID = [(s, e) for s, e in itertools.product(S, E) if (s, e) not in {(c, ev) for c, ev, _ in VALID}]


@pytest.mark.parametrize(("current", "event"), INVALID)
def test_invalid_transitions_raise(current, event):
    with pytest.raises(InvalidTransition):
        next_table_status(current, event)


def test_cannot_order_after_bill_requested():
    assert can_order(S.BILL_REQUESTED) is False
    assert can_order(S.CLOSED) is False
    assert can_order(S.FREE) is False
    assert all(can_order(s) for s in (S.OCCUPIED, S.AWAITING_ORDER, S.SERVED))
