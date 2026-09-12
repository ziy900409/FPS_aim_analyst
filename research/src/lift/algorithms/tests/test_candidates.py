"""WP-61 T2: the frozen matching rule and the candidate event table.

What is pinned here is deliberately narrow: the rule's **refusals**. A matcher that pairs everything
would make T3 look like it had labels; the tests that matter are the ones showing it declines --
outside the tolerance, already-used annotations, endpoint contact, and empty inputs.
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from lift.algorithms.candidates import (
    CANDIDATE_COLUMNS,
    MATCH_SUMMARY_COLUMNS,
    MATCH_TOLERANCE_MS,
    THETA_SWEEP_MS,
    build_candidate_table,
    build_match_summary,
    match_annotations_to_gaps,
)
from lift.algorithms.golden import Gap, Interval, LiftGolden, Segmentation, load_lift_golden


GOLDEN = Path(__file__).resolve().parents[4] / "fixtures" / "golden" / "lift-segments-synthetic-lift.json"


def gap(index: int, start_ms: float, duration_ms: float) -> Gap:
    return Gap(
        index=index,
        start_ms=start_ms,
        end_ms=start_ms + duration_ms,
        duration_ms=duration_ms,
        before_index=index * 10,
        after_index=index * 10 + 1,
    )


def golden(instruction_class: str, annotations: tuple[Interval, ...], gaps: tuple[Gap, ...]) -> LiftGolden:
    return LiftGolden(
        run_id="r1",
        session_id="s1",
        instruction_class=instruction_class,
        display_hz=240.0,
        sample_count=len(gaps) * 100,
        t0_ms=0.0,
        dt_us=(0,) * (len(gaps) * 100),
        unlocked_intervals=(),
        annotation_intervals=annotations,
        segmentations=tuple(Segmentation(theta_ms=theta, gaps=gaps) for theta in THETA_SWEEP_MS),
        source_path=None,
    )


def test_the_frozen_tolerance_is_the_value_pre_registered_at_t0() -> None:
    assert MATCH_TOLERANCE_MS == 300.0
    assert THETA_SWEEP_MS == (18.0, 30.0, 50.0)


def test_an_annotation_inside_the_tolerance_matches_and_one_outside_does_not() -> None:
    gaps = (gap(0, 1000.0, 200.0),)

    # Annotation starts 180 ms after the gap opens: comfortably inside +/-300 ms.
    assert len(match_annotations_to_gaps((Interval(1180.0, 1330.0),), gaps)) == 1
    # Starts 900 ms after the gap closes: expanding by 300 ms still leaves no overlap.
    assert match_annotations_to_gaps((Interval(2100.0, 2250.0),), gaps) == ()


def test_endpoint_contact_is_not_overlap() -> None:
    # The expanded annotation ends exactly where the gap begins. Claiming that gap would let an
    # annotation reach an event it never touched -- the same refusal segmentByTimeGap() makes for
    # lock intervals.
    gaps = (gap(0, 1000.0, 200.0),)

    assert match_annotations_to_gaps((Interval(600.0, 700.0),), gaps) == ()


def test_pairing_is_one_to_one_and_prefers_the_nearer_gap() -> None:
    gaps = (gap(0, 1000.0, 200.0), gap(1, 1150.0, 200.0))
    annotations = (Interval(1160.0, 1200.0),)

    matches = match_annotations_to_gaps(annotations, gaps)

    # Both gaps are within tolerance; only the nearer one is taken, and the annotation is consumed.
    assert len(matches) == 1
    assert matches[0].gap_index == 1


def test_two_annotations_cannot_claim_the_same_gap() -> None:
    gaps = (gap(0, 1000.0, 200.0),)
    annotations = (Interval(1050.0, 1100.0), Interval(1060.0, 1110.0))

    matches = match_annotations_to_gaps(annotations, gaps)

    assert len(matches) == 1
    assert matches[0].annotation_index == 0


def test_an_empty_side_yields_no_matches_rather_than_an_error() -> None:
    assert match_annotations_to_gaps((), (gap(0, 1000.0, 200.0),)) == ()
    assert match_annotations_to_gaps((Interval(1000.0, 1100.0),), ()) == ()


def test_a_lift_run_labels_matched_gaps_lift_and_leaves_the_rest_as_background() -> None:
    gaps = (gap(0, 1000.0, 200.0), gap(1, 5000.0, 200.0))
    table = build_candidate_table((golden("lift", (Interval(1180.0, 1330.0),), gaps),))

    at_theta = table[table["theta_ms"] == 30.0].sort_values("gap_index")
    assert list(at_theta["label"]) == ["lift", "none"]
    assert list(at_theta["negative_group"]) == ["", "background"]
    # pandas holds the unmatched slot as NaN in a numeric column -- `isna()` is the honest read of
    # "no annotation claimed this gap"; it must never surface as 0, which is a valid index.
    assert at_theta["matched_annotation_index"].iloc[0] == 0
    assert bool(at_theta["matched_annotation_index"].isna().iloc[1])


def test_a_pause_run_labels_matched_gaps_pause_never_lift() -> None:
    gaps = (gap(0, 1000.0, 200.0),)
    table = build_candidate_table((golden("pause", (Interval(1180.0, 1330.0),), gaps),))

    at_theta = table[table["theta_ms"] == 30.0]
    assert list(at_theta["label"]) == ["pause"]
    assert list(at_theta["negative_group"]) == ["pause"]


def test_a_oneshot_run_keeps_unmatched_gaps_as_the_oneshot_negative_group() -> None:
    # The annotated gap reports a real lift (the oneshot instruction is "press KeyL only when you
    # actually lift"); the rest are the negative control the frozen oneshot FPR is computed over.
    gaps = (gap(0, 1000.0, 200.0), gap(1, 5000.0, 200.0), gap(2, 9000.0, 200.0))
    table = build_candidate_table((golden("oneshot", (Interval(1180.0, 1330.0),), gaps),))

    at_theta = table[table["theta_ms"] == 30.0].sort_values("gap_index")
    assert list(at_theta["label"]) == ["lift", "none", "none"]
    assert list(at_theta["negative_group"]) == ["", "oneshot", "oneshot"]


def test_no_label_is_ever_invented_for_a_gap_without_an_annotation() -> None:
    # FR-61.3: a very long gap in a lift run is still `none` if nobody annotated it.
    gaps = (gap(0, 1000.0, 4000.0),)
    table = build_candidate_table((golden("lift", (), gaps),))

    assert set(table["label"]) == {"none"}
    assert table["matched_annotation_index"].isna().all()


def test_an_empty_cohort_yields_an_empty_frame_with_the_full_column_surface() -> None:
    table = build_candidate_table(())

    assert len(table) == 0
    assert tuple(table.columns) == CANDIDATE_COLUMNS


def test_the_table_is_byte_identical_across_reruns() -> None:
    goldens = (load_lift_golden(GOLDEN),)

    assert build_candidate_table(goldens).equals(build_candidate_table(goldens))


def test_the_committed_synthetic_golden_produces_one_row_per_gap_per_theta() -> None:
    loaded = load_lift_golden(GOLDEN)
    table = build_candidate_table((loaded,))

    assert tuple(table.columns) == CANDIDATE_COLUMNS
    assert len(table) == 8 * len(THETA_SWEEP_MS)
    # Every synthetic gap carries an annotation 181 ms after it opens -- inside the frozen tolerance.
    assert set(table["label"]) == {"lift"}


def test_the_match_summary_separates_missed_annotations_from_matched_ones() -> None:
    gaps = (gap(0, 1000.0, 200.0),)
    # Two annotations, one gap: exactly one annotation is left unmatched -- a false negative that a
    # candidate-only table cannot express.
    summary = build_match_summary((golden("lift", (Interval(1180.0, 1330.0), Interval(9000.0, 9100.0)), gaps),))

    row = summary[summary["theta_ms"] == 30.0].iloc[0]
    assert tuple(summary.columns) == MATCH_SUMMARY_COLUMNS
    assert row["candidate_count"] == 1
    assert row["annotation_count"] == 2
    assert row["matched_count"] == 1
    assert row["unmatched_annotation_count"] == 1
    assert row["match_rate"] == pytest.approx(0.5)


def test_a_run_without_annotations_reports_nan_match_rate_not_zero() -> None:
    summary = build_match_summary((golden("lift", (), (gap(0, 1000.0, 200.0),)),))

    assert math.isnan(summary.iloc[0]["match_rate"])
