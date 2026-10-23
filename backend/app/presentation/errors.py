from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.domain.errors import (
    DomainError,
    DuplicateEmail,
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


class RateLimited(DomainError):
    code = "rate_limited"
    default_message = "Demasiadas órdenes seguidas; espera un momento"


class Conflict(DomainError):
    code = "conflict"
    default_message = "Ya existe un registro con ese nombre o código"


class InvalidReference(DomainError):
    code = "invalid_reference"
    default_message = "Alguna referencia no existe"


class InvalidValue(DomainError):
    code = "validation_error"
    default_message = "Algún campo tiene un valor no permitido"


class ServiceUnavailable(DomainError):
    code = "service_unavailable"
    default_message = "Este servicio no está configurado"


STATUS_BY_ERROR: dict[type[DomainError], int] = {
    Unauthorized: 401,
    RateLimited: 429,
    Conflict: 409,
    DuplicateEmail: 409,
    InvalidReference: 422,
    InvalidValue: 422,
    ServiceUnavailable: 503,
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


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = jsonable_encoder(exc.errors(), exclude={"input", "ctx", "url"})
    return JSONResponse(error_body("validation_error", "Revisa los datos enviados", {"errors": errors}),
                        status_code=422)


async def _integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
    sqlstate = getattr(exc.orig, "sqlstate", None)
    if sqlstate == "23505":
        return await _domain_error(request, Conflict())
    if sqlstate == "23503":
        return await _domain_error(request, InvalidReference())
    if sqlstate in ("23502", "23514"):  # not-null or check violation, e.g. an explicit null in a PATCH
        return await _domain_error(request, InvalidValue())
    raise exc


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain_error)
    app.add_exception_handler(IntegrityError, _integrity_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
