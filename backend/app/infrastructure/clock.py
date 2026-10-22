from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


class SystemClock:
    def __init__(self, timezone: str) -> None:
        self._tz = ZoneInfo(timezone)

    def now(self) -> datetime:
        return datetime.now(UTC)

    def business_date(self) -> date:
        return datetime.now(self._tz).date()
