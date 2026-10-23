from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.exc import IntegrityError

from app.application.dto import DinerMenuCategoryView, DinerSessionView, DinerTableView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.queries import get_diner_menu, get_diner_session, get_diner_table
from app.application.use_cases.service_calls import request_service_call
from app.domain.entities import Order
from app.presentation.deps import get_clock, get_uow
from app.presentation.rate_limit import limit_orders
from app.presentation.schemas import PlacedOrderOut, PlaceOrderIn, ServiceCallIn, ServiceCallOut

QrToken = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,128}$")]

router = APIRouter(prefix="/diner/tables/{qr_token}", tags=["diner"])


def _placed(order: Order) -> PlacedOrderOut:
    return PlacedOrderOut(order_id=order.id, daily_number=order.daily_number, round_number=order.round_number,
                          status=order.status, subtotal_cents=order.subtotal_cents)


@router.get("")
def read_table(qr_token: QrToken, uow: UnitOfWork = Depends(get_uow)) -> DinerTableView:
    return get_diner_table(uow, qr_token)


@router.get("/menu")
def read_menu(qr_token: QrToken, uow: UnitOfWork = Depends(get_uow)) -> list[DinerMenuCategoryView]:
    get_diner_table(uow, qr_token)
    return get_diner_menu(uow)


@router.get("/session")
def read_session(qr_token: QrToken, uow: UnitOfWork = Depends(get_uow)) -> DinerSessionView | None:
    return get_diner_session(uow, qr_token)


@router.post("/orders", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_orders)])
def create_order(qr_token: QrToken, body: PlaceOrderIn, uow: UnitOfWork = Depends(get_uow),
                 clock: Clock = Depends(get_clock)) -> PlacedOrderOut:
    cmd = PlaceOrderCommand(qr_token, body.idempotency_key, tuple(line.to_request() for line in body.lines),
                            body.expected_total_cents)
    try:
        return _placed(place_order(uow, clock, cmd))
    except IntegrityError:
        # A concurrent request with the same idempotency key won the insert; answer with its order.
        with uow:
            existing = uow.orders.get_by_idempotency_key(body.idempotency_key)
        if existing is None:
            raise
        return _placed(existing)


@router.post("/service-calls", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_orders)])
def create_service_call(qr_token: QrToken, body: ServiceCallIn, uow: UnitOfWork = Depends(get_uow),
                        clock: Clock = Depends(get_clock)) -> ServiceCallOut:
    call = request_service_call(uow, clock, qr_token, body.type)
    return ServiceCallOut(id=call.id, type=call.type, created_at=call.created_at)
