from uuid import uuid4

import pytest

from app.domain.entities import TableSession
from app.domain.errors import InvalidCustomization
from app.domain.services.billing import apply_payment, balance_cents
from tests.fakes import T0


def session(subtotal=10000, tip=0, paid=0) -> TableSession:
    return TableSession(uuid4(), uuid4(), None, T0, None, subtotal_cents=subtotal, tip_cents=tip, paid_cents=paid)


def test_balance_counts_tip():
    assert balance_cents(session(10000, tip=1500, paid=2000)) == 9500


def test_apply_payment_settles_exact_amount():
    s = session()
    assert apply_payment(s, 10000, 1500) is True
    assert (s.paid_cents, s.tip_cents, balance_cents(s)) == (11500, 1500, 0)


def test_partial_payment_does_not_settle():
    s = session()
    assert apply_payment(s, 6000, 0) is False
    assert balance_cents(s) == 4000
    assert apply_payment(s, 4000, 500) is True


def test_amount_over_remaining_is_rejected():
    s = session()
    with pytest.raises(InvalidCustomization) as err:
        apply_payment(s, 10001, 0)
    assert err.value.details["field"] == "amount_cents"
    assert (s.paid_cents, s.tip_cents) == (0, 0)


@pytest.mark.parametrize(("amount", "tip", "field"), [(0, 0, "amount_cents"), (-5, 0, "amount_cents"),
                                                       (100, -1, "tip_cents")])
def test_zero_or_negative_amounts_are_rejected(amount, tip, field):
    with pytest.raises(InvalidCustomization) as err:
        apply_payment(session(), amount, tip)
    assert err.value.details["field"] == field
