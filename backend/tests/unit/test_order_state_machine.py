import pytest

from app.domain.enums import OrderStatus as O
from app.domain.enums import StaffRole as R
from app.domain.errors import Forbidden, InvalidTransition
from app.domain.services.order_state_machine import check_order_transition, is_pending

VALID = [
    (O.RECEIVED, O.PREPARING, R.KITCHEN),
    (O.PREPARING, O.READY, R.KITCHEN),
    (O.READY, O.SERVED, R.WAITER),
    (O.RECEIVED, O.CANCELLED, R.WAITER),
    (O.PREPARING, O.CANCELLED, R.WAITER),
]


@pytest.mark.parametrize(("current", "target", "role"), VALID)
def test_valid_with_role(current, target, role):
    check_order_transition(current, target, role)


@pytest.mark.parametrize(("current", "target", "_role"), VALID)
def test_admin_can_do_any_valid_transition(current, target, _role):
    check_order_transition(current, target, R.ADMIN)


def test_kitchen_cannot_serve():
    with pytest.raises(Forbidden):
        check_order_transition(O.READY, O.SERVED, R.KITCHEN)


def test_cannot_cancel_ready_or_served():
    for current in (O.READY, O.SERVED):
        with pytest.raises(InvalidTransition):
            check_order_transition(current, O.CANCELLED, R.WAITER)


def test_cannot_skip_preparing():
    with pytest.raises(InvalidTransition):
        check_order_transition(O.RECEIVED, O.READY, R.KITCHEN)


def test_pending_statuses():
    assert [s for s in O if is_pending(s)] == [O.RECEIVED, O.PREPARING, O.READY]
