from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.errors import (
    DomainError,
    Forbidden,
    InvalidCustomization,
    InvalidTransition,
    ItemUnavailable,
    NotFound,
    PriceChanged,
    TableNotOpen,
)


class Unauthorized(DomainError):
    code = "unauthorized"
    default_message = "Inicia sesión para continuar"


STATUS_BY_ERROR: dict[type[DomainError], int] = {
    Unauthorized: 401,
    NotFound: 404,
    TableNotOpen: 403,
    Forbidden: 403,
    ItemUnavailable: 409,
    PriceChanged: 409,
    InvalidTransition: 409,
    InvalidCustomization: 422,
}


def error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {"code": code, "message": message, "details": details or {}}


def _status_for(exc: DomainError) -> int:
    for error_type in type(exc).__mro__:
        if error_type in STATUS_BY_ERROR:
            return STATUS_BY_ERROR[error_type]
    return 400


async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(error_body(exc.code, exc.message, exc.details), status_code=_status_for(exc))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain_error)
