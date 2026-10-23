from app.domain.services.floor import AreaRect, area_at

SALON = AreaRect("salon", 0, 0, 12, 9)
BARRA = AreaRect("barra", 8, 0, 4, 3)
JARDIN = AreaRect("jardin", 0, 9, 12, 6)


def test_table_takes_the_area_under_its_center():
    assert area_at(2, 2, [SALON, JARDIN]) == "salon"
    assert area_at(5, 12, [SALON, JARDIN]) == "jardin"


def test_smallest_area_wins_when_areas_overlap():
    assert area_at(9, 1, [SALON, BARRA]) == "barra"


def test_unplaced_or_outside_tables_have_no_area():
    assert area_at(None, None, [SALON]) is None
    assert area_at(30, 30, [SALON]) is None
