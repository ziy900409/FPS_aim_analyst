from __future__ import annotations

import dataclasses
import math
from pathlib import Path

import pandas as pd
import pytest

from modules.ingest.algorithms.construct import (
    CONSTRUCT_PARAMS_VERSION,
    CONSTRUCT_REGISTRY,
    ConstructRule,
    check_construct_presence,
    is_known_construct_flag,
    resolve_drill_family,
)
from modules.ingest.algorithms.loader import Export, load_export


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
FIXTURES_DIR = RESEARCH_ROOT / "fixtures" / "exports"


def _export(drill_id: str, vx_values: list[float], counter_count: int) -> Export:
    ticks = pd.DataFrame({"vx": vx_values})
    events = pd.DataFrame({"type": ["counter"] * counter_count})
    return Export(meta={"drillId": drill_id}, ticks=ticks, events=events, source_path=Path("in-memory"))


# --- committed fixtures (FR-C-11; expected values taken from KI-006-C/progress.md T0 reproduction) ---


def test_check_construct_presence_08_03_export_is_absent() -> None:
    export = load_export(FIXTURES_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json")

    report = check_construct_presence(export)

    assert report.present is False
    assert report.flags == ("construct_absent:counter-strafe",)
    assert report.counter_event_count == 0
    assert report.tick_count == 3507
    assert report.moving_tick_ratio == pytest.approx(0.0)


def test_check_construct_presence_09_39_export_is_present() -> None:
    export = load_export(FIXTURES_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json")

    report = check_construct_presence(export)

    assert report.present is True
    assert report.flags == ()
    assert report.counter_event_count == 24
    assert report.moving_tick_count == 1415


def test_check_construct_presence_synthetic_counterstrafe_is_present() -> None:
    export = load_export(FIXTURES_DIR / "synthetic_counterstrafe.json")

    report = check_construct_presence(export)

    assert report.family == "counterstrafe"
    assert report.present is True
    assert report.counter_event_count == 2


def test_check_construct_presence_synthetic_timeline_is_unknown() -> None:
    export = load_export(FIXTURES_DIR / "synthetic_timeline.json")

    report = check_construct_presence(export)

    assert report.family is None
    assert report.present is None
    assert report.flags == ("construct_unknown",)


# --- family resolution (FR-C-3 / FM-1) ---


@pytest.mark.parametrize(
    ("drill_id", "expected_family"),
    [
        ("counterstrafe_ad_v1", "counterstrafe"),
        ("synthetic_counterstrafe_v2", "counterstrafe"),
        ("synthetic_timeline_v1", None),
        ("tracking_longrange_v1", None),
        ("detection_popin_v1", None),
        ("", None),
    ],
)
def test_resolve_drill_family(drill_id: str, expected_family: str | None) -> None:
    assert resolve_drill_family(drill_id) == expected_family


# --- boundary cases ---


def test_check_construct_presence_empty_ticks_is_absent_with_nan_ratio() -> None:
    export = _export("counterstrafe_ad_v1", vx_values=[], counter_count=1)

    report = check_construct_presence(export)

    assert report.present is False
    assert math.isnan(report.moving_tick_ratio)


def test_check_construct_presence_no_counter_events_is_absent_despite_movement() -> None:
    export = _export("counterstrafe_ad_v1", vx_values=[1.0] * 10, counter_count=0)

    report = check_construct_presence(export)

    assert report.present is False


def test_check_construct_presence_below_ratio_floor_is_absent_despite_counter() -> None:
    export = _export("counterstrafe_ad_v1", vx_values=[1.0] + [0.0] * 99, counter_count=1)

    report = check_construct_presence(export)

    assert report.moving_tick_ratio == pytest.approx(0.01)
    assert report.present is False


def test_check_construct_presence_ratio_at_floor_is_present() -> None:
    export = _export("counterstrafe_ad_v1", vx_values=[1.0] * 5 + [0.0] * 95, counter_count=1)

    report = check_construct_presence(export)

    assert report.moving_tick_ratio == pytest.approx(0.05)
    assert report.present is True


# --- contract and vocabulary ---


def test_construct_report_params_version_and_thresholds() -> None:
    known = check_construct_presence(_export("counterstrafe_ad_v1", vx_values=[1.0] * 5, counter_count=1))
    unknown = check_construct_presence(_export("timeline_v1", vx_values=[1.0] * 5, counter_count=1))

    assert known.params_version == CONSTRUCT_PARAMS_VERSION
    assert known.thresholds == CONSTRUCT_REGISTRY["counterstrafe"]
    assert unknown.thresholds is None


@pytest.mark.parametrize(
    ("flag", "expected"),
    [
        ("construct_unknown", True),
        ("construct_absent:counter-strafe", True),
        ("construct_absent:", False),
        ("not_a_flag", False),
    ],
)
def test_is_known_construct_flag(flag: str, expected: bool) -> None:
    assert is_known_construct_flag(flag) is expected


def test_construct_rule_and_report_are_frozen() -> None:
    rule = ConstructRule(construct="counter-strafe", min_counter_events=1, min_moving_tick_ratio=0.05)
    report = check_construct_presence(_export("counterstrafe_ad_v1", vx_values=[1.0] * 5, counter_count=1))

    with pytest.raises(dataclasses.FrozenInstanceError):
        rule.min_counter_events = 2  # type: ignore[misc]
    with pytest.raises(dataclasses.FrozenInstanceError):
        report.present = False  # type: ignore[misc]
