from typing import Any


class DomainError(Exception):
    code = "domain_error"
    default_message = "Error de dominio"

    def __init__(self, message: str | None = None, details: dict[str, Any] | None = None) -> None:
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)


class InvalidTransition(DomainError):
    code = "invalid_transition"
    default_message = "Cambio de estado no permitido"


class TableNotOpen(DomainError):
    code = "table_not_open"
    default_message = "La mesa no está abierta para ordenar"


class ItemUnavailable(DomainError):
    code = "item_unavailable"
    default_message = "Algunos platillos no están disponibles"

    def __init__(self, lines: list[dict[str, Any]], message: str | None = None) -> None:
        super().__init__(message, {"lines": lines})


class InvalidCustomization(DomainError):
    code = "invalid_customization"
    default_message = "La personalización del platillo no es válida"


class PriceChanged(DomainError):
    code = "price_changed"
    default_message = "El total cambió; confirma de nuevo"

    def __init__(self, total_cents: int, message: str | None = None) -> None:
        super().__init__(message, {"total_cents": total_cents})


class NotFound(DomainError):
    code = "not_found"
    default_message = "No encontrado"


class Forbidden(DomainError):
    code = "forbidden"
    default_message = "No tienes permiso para esta acción"
