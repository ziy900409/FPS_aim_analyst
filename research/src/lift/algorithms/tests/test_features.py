"""WP-61 T3 layer 2: the boundary window rule and what it refuses to compute.

What is pinned here is mostly the module's *silences*. A feature function that always returns a
number is the dangerous kind: a one-sample window reported as ``speed = 0`` would look, downstream,
exactly like a measured stillness. So the tests that matter are the ones showing ``None``, plus the
one showing that the sample spanning the gap never enters the exit profile.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from lift.algorithms.features import (
    BOUNDARY_FEATURE_COLUMNS,
    FeatureError,
    GapBoundaryKinematics,
    SampleBlock,
    assert_block_matches_golden,
    boundary_windows,
    derive_gap_boundary_kinematics,
    load_sample_block,
    parse_sample_block,
    sample_speed,
)
from lift.algorithms.golden import Gap, load_lift_golden


RESEARCH_ROOT = Path(__file__).resolve().parents[4]
GOLDEN = RESEARCH_ROOT / "fixtures" / "golden" / "lift-segments-synthetic-lift.json"
EXPORT = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_sensor_lift.json"


def block(dt_us: tuple[int, ...], dx: tuple[float, ...], dy: tuple[float, ...] | None = None) -> SampleBlock:
    return parse_sample_block(
        {"t0Ms": 1000.0, "dtUs": list(dt_us), "dx": list(dx), "dy": list(dy if dy is not None else (0.0,) * len(dx))}
    )


def gap_at(sample_block: SampleBlock, after_index: int) -> Gap:
    return Gap(
        index=0,
        start_ms=sample_block.times_ms[after_index - 1],
        end_ms=sample_block.times_ms[after_index],
        duration_ms=sample_block.dt_us[after_index] / 1000,
        before_index=after_index - 1,
        after_index=after_index,
    )


# ── the block itself ─────────────────────────────────────────────────────────────────────────────


def test_sample_times_accumulate_in_microseconds_and_skip_the_first_interval() -> None:
    # dtUs[0] is 0 by the export contract; times must still start exactly at t0Ms.
    parsed = block((0, 1000, 1000, 30_000), (0, 1, 1, 1))
    assert parsed.times_ms == (1000.0, 1001.0, 1002.0, 1032.0)


def test_a_block_whose_channels_disagree_in_length_names_the_channel() -> None:
    with pytest.raises(FeatureError) as error:
        parse_sample_block({"t0Ms": 0.0, "dtUs": [0, 1000], "dx": [1], "dy": [0, 0]})
    assert error.value.field_path == "mouseSamples.dx"


def test_a_negative_interval_is_rejected_at_the_offending_index() -> None:
    with pytest.raises(FeatureError) as error:
        parse_sample_block({"t0Ms": 0.0, "dtUs": [0, -1], "dx": [0, 0], "dy": [0, 0]})
    assert error.value.field_path == "mouseSamples.dtUs[1]"


def test_an_export_without_raw_sampling_is_named_rather_than_returning_an_empty_block(tmp_path) -> None:
    path = tmp_path / "legacy.json"
    path.write_text(json.dumps({"meta": {}, "ticks": [], "events": []}), encoding="utf-8")
    with pytest.raises(FeatureError) as error:
        load_sample_block(path)
    assert error.value.field_path == "mouseSamples"


# ── golden/export pairing ────────────────────────────────────────────────────────────────────────


def test_the_committed_golden_and_the_committed_export_are_the_same_recording() -> None:
    assert assert_block_matches_golden(load_sample_block(EXPORT), load_lift_golden(GOLDEN)) == ()


def test_a_block_from_a_different_run_is_reported_rather_than_silently_indexed() -> None:
    golden = load_lift_golden(GOLDEN)
    shifted = load_sample_block(EXPORT)
    tampered = SampleBlock(
        t0_ms=shifted.t0_ms,
        dt_us=(shifted.dt_us[0], shifted.dt_us[1] + 1) + shifted.dt_us[2:],
        dx=shifted.dx,
        dy=shifted.dy,
        times_ms=shifted.times_ms,
    )
    mismatches = assert_block_matches_golden(tampered, golden)
    assert mismatches and mismatches[0].startswith("dtUs[1]:")


def test_a_block_of_the_wrong_length_stops_at_the_count_instead_of_diffing_every_sample() -> None:
    golden = load_lift_golden(GOLDEN)
    short = block((0, 1000), (1, 1))
    assert assert_block_matches_golden(short, golden) == (
        f"sampleCount: golden {golden.sample_count} vs block 2",
    )


# ── the window rule ──────────────────────────────────────────────────────────────────────────────


def test_the_before_window_includes_the_last_sample_before_the_gap() -> None:
    parsed = block((0, 1000, 1000, 1000, 30_000, 1000), (1,) * 6)
    before, _ = boundary_windows(parsed, gap_at(parsed, 4), window_ms=2.0)
    assert before == (1, 2, 3)


def test_the_after_window_excludes_the_sample_that_spans_the_gap() -> None:
    # Sample 4 carries dtUs = 30 ms -- it *is* the gap. Counting it as a post-gap sample would put
    # the gap's own displacement into the exit profile.
    parsed = block((0, 1000, 1000, 1000, 30_000, 1000, 1000), (1,) * 7)
    _, after = boundary_windows(parsed, gap_at(parsed, 4), window_ms=2.0)
    assert after == (5, 6)


def test_a_wider_window_only_ever_adds_samples() -> None:
    parsed = block((0,) + (1000,) * 9 + (30_000,) + (1000,) * 9, (1,) * 20)
    gap = gap_at(parsed, 10)
    narrow_before, narrow_after = boundary_windows(parsed, gap, window_ms=3.0)
    wide_before, wide_after = boundary_windows(parsed, gap, window_ms=8.0)
    assert set(narrow_before) <= set(wide_before)
    assert set(narrow_after) <= set(wide_after)


def test_a_non_positive_window_is_refused_by_name() -> None:
    parsed = block((0, 1000, 30_000, 1000), (1,) * 4)
    with pytest.raises(FeatureError) as error:
        boundary_windows(parsed, gap_at(parsed, 2), window_ms=0.0)
    assert error.value.field_path == "windowMs"


def test_a_gap_index_outside_the_block_is_refused_by_name() -> None:
    parsed = block((0, 1000, 30_000), (1, 1, 1))
    out_of_range = Gap(index=0, start_ms=0, end_ms=1, duration_ms=1, before_index=1, after_index=99)
    with pytest.raises(FeatureError) as error:
        boundary_windows(parsed, out_of_range, window_ms=5.0)
    assert error.value.field_path == "gap.afterIndex"


# ── the features ─────────────────────────────────────────────────────────────────────────────────


def test_speed_is_counts_per_second_over_the_interval_ending_at_the_sample() -> None:
    parsed = block((0, 1000, 2000), (0.0, 3.0, 3.0), (0.0, 4.0, 4.0))
    assert sample_speed(parsed, 1) == pytest.approx(5000.0)  # hypot(3,4) counts over 1 ms
    assert sample_speed(parsed, 2) == pytest.approx(2500.0)  # same displacement over 2 ms


def test_the_first_sample_has_no_speed_because_it_has_no_interval() -> None:
    assert sample_speed(block((0, 1000), (5.0, 5.0)), 0) is None


def test_a_window_with_one_sample_reports_no_speed_rather_than_zero() -> None:
    parsed = block((0, 1000, 1000, 30_000, 1000), (1,) * 5)
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 3), window_ms=1.5, tiny_counts=0.0)
    assert features.n_after == 1
    assert features.speed_after_counts_per_sec is None
    assert features.accel_exit_counts_per_sec2 is None


def test_an_empty_window_reports_no_tiny_fraction_but_still_reports_a_density_of_zero() -> None:
    parsed = block((0, 1000, 1000, 30_000), (1,) * 4)
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 3), window_ms=0.5, tiny_counts=0.0)
    assert features.n_after == 0
    assert features.tiny_fraction_after is None
    assert features.density_after_hz == 0.0


def test_density_uses_the_nominal_window_so_two_gaps_are_comparable() -> None:
    # The before window is closed at both ends, so a 4 ms window over a 1 kHz stream holds the
    # boundary sample plus four predecessors. Dividing by the *nominal* window rather than by the
    # observed span is what makes a sparse boundary read as sparse instead of as a shorter window.
    parsed = block((0,) + (1000,) * 5 + (30_000,) + (1000,) * 5, (1,) * 12)
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 6), window_ms=4.0, tiny_counts=0.0)
    assert features.n_before == 5
    assert features.density_before_hz == pytest.approx(1250.0)


def test_deceleration_into_a_gap_is_negative_and_acceleration_out_of_it_is_positive() -> None:
    # Slowing 4 -> 1 counts/ms entering, speeding 1 -> 4 counts/ms leaving.
    parsed = block((0, 1000, 1000, 1000, 30_000, 1000, 1000, 1000), (0, 4, 2, 1, 0, 1, 2, 4))
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 4), window_ms=3.0, tiny_counts=0.0)
    assert features.accel_enter_counts_per_sec2 is not None and features.accel_enter_counts_per_sec2 < 0
    assert features.accel_exit_counts_per_sec2 is not None and features.accel_exit_counts_per_sec2 > 0


def test_the_tiny_fraction_is_the_share_at_or_under_the_threshold() -> None:
    parsed = block((0, 1000, 1000, 1000, 1000, 30_000), (0, 1, 1, 9, 9, 0))
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 5), window_ms=3.0, tiny_counts=1.0)
    assert features.n_before == 4
    assert features.tiny_fraction_before == pytest.approx(0.5)


def test_a_boundary_that_never_moves_reports_a_tiny_fraction_of_one_not_a_missing_value() -> None:
    # README section 1.4 predicts this shape on this hardware, and T3's DoD requires it be visible.
    parsed = block((0, 1000, 1000, 1000, 30_000), (0, 0, 0, 0, 0))
    features = derive_gap_boundary_kinematics(parsed, gap_at(parsed, 4), window_ms=3.0, tiny_counts=0.0)
    assert features.tiny_fraction_before == 1.0
    assert features.speed_before_counts_per_sec == 0.0


def test_a_negative_tiny_threshold_is_refused_by_name() -> None:
    parsed = block((0, 1000, 30_000), (1, 1, 1))
    with pytest.raises(FeatureError) as error:
        derive_gap_boundary_kinematics(parsed, gap_at(parsed, 2), window_ms=2.0, tiny_counts=-1.0)
    assert error.value.field_path == "tinyCounts"


def test_the_declared_column_surface_matches_the_dataclass() -> None:
    # The ablation writes these names into a CSV; a field renamed on one side only would surface as
    # a column of NaN rather than an error.
    assert set(BOUNDARY_FEATURE_COLUMNS) == set(GapBoundaryKinematics.__dataclass_fields__)


def test_every_candidate_gap_in_the_committed_fixture_yields_finite_or_absent_features() -> None:
    golden = load_lift_golden(GOLDEN)
    parsed = load_sample_block(EXPORT)
    for segmentation in golden.segmentations:
        for gap in segmentation.gaps:
            features = derive_gap_boundary_kinematics(parsed, gap, window_ms=20.0, tiny_counts=5.0)
            for name in BOUNDARY_FEATURE_COLUMNS:
                value = getattr(features, name)
                assert value is None or math.isfinite(value), (segmentation.theta_ms, gap.index, name)
