from mousegrip.notebooks.run_cohort import CONFIRMED_GPW1_GRIP


def test_s01_to_s08_gpw1_grips_match_the_study_owner_manifest() -> None:
    assert CONFIRMED_GPW1_GRIP == {
        "S01": "1-2-2",
        "S02": "1-2-2",
        "S03": "1-2-2",
        "S04": "1-2-2",
        "S05": "1-2-2",
        "S06": "1-3-1",
        "S07": "1-2-2",
        "S08": "1-2-2",
    }
