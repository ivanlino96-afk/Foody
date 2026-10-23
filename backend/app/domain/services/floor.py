from dataclasses import dataclass

AREA_KINDS = ("salon", "jardin", "roof", "terraza", "barra", "privado", "otro")
TABLE_KINDS = ("table", "round", "bar", "high", "booth")
ROTATIONS = (0, 90, 180, 270)


@dataclass(frozen=True)
class AreaRect:
    key: str
    x: float
    y: float
    width: float
    depth: float

    def contains(self, px: float, py: float) -> bool:
        return self.x <= px <= self.x + self.width and self.y <= py <= self.y + self.depth


def area_at(px: float | None, py: float | None, areas: list[AreaRect]) -> str | None:
    """Key of the area under a table's center; the smallest one wins so a bar drawn inside the salón takes it."""
    if px is None or py is None:
        return None
    inside = [a for a in areas if a.contains(px, py)]
    return min(inside, key=lambda a: a.width * a.depth).key if inside else None
