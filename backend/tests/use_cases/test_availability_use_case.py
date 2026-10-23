from uuid import uuid4

import pytest

from app.application.use_cases.availability import set_availability
from app.domain.enums import AvailabilityEntity
from app.domain.errors import NotFound
from tests.fakes import FixedClock, InMemoryUnitOfWork


def test_set_availability_writes_log():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    ingredient_id, cook = uuid4(), uuid4()
    uow.state.availability[(AvailabilityEntity.INGREDIENT, ingredient_id)] = True
    set_availability(uow, clock, AvailabilityEntity.INGREDIENT, ingredient_id, False, cook)
    assert uow.state.availability[(AvailabilityEntity.INGREDIENT, ingredient_id)] is False
    assert uow.state.availability_log == [(AvailabilityEntity.INGREDIENT, ingredient_id, False, cook, clock.now())]
    set_availability(uow, clock, AvailabilityEntity.INGREDIENT, ingredient_id, False, cook)
    assert len(uow.state.availability_log) == 2


def test_unknown_entity_is_not_found():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    with pytest.raises(NotFound):
        set_availability(uow, clock, AvailabilityEntity.EXTRA, uuid4(), False, uuid4())
    assert uow.state.availability_log == []
