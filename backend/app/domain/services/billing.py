from app.domain.entities import TableSession
from app.domain.errors import InvalidCustomization


def balance_cents(session: TableSession) -> int:
    return session.subtotal_cents + session.tip_cents - session.paid_cents


def apply_payment(session: TableSession, amount_cents: int, tip_cents: int) -> bool:
    """Adds a payment (amount without tip, plus tip) to the session; returns True when the bill is settled."""
    if amount_cents < 1:
        raise InvalidCustomization("El monto debe ser mayor a cero", {"field": "amount_cents"})
    if tip_cents < 0:
        raise InvalidCustomization("La propina no puede ser negativa", {"field": "tip_cents"})
    remaining = session.subtotal_cents - (session.paid_cents - session.tip_cents)
    if amount_cents > remaining:
        raise InvalidCustomization("El monto es mayor que el saldo pendiente",
                                   {"field": "amount_cents", "remaining_cents": remaining})
    session.tip_cents += tip_cents
    session.paid_cents += amount_cents + tip_cents
    return session.paid_cents >= session.subtotal_cents + session.tip_cents
