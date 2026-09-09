"""WP-61 T3: the four-layer ablation, the session split, and the frozen decision rule.

The real cohort does not exist yet, so the corpus here is built in memory. That is a deliberate
limit, not a shortcut: these tests pin the **machinery** -- that layers only narrow, that held-out
is a different set of sessions, that an empty negative group is refused rather than scored 0.0, that
the verdict is the frozen rule applied literally. They say nothing about whether a sensor lift is
separable from a hand pause, and a synthetic corpus never could.
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from lift.algorithms.ablation import (
    LAYERS,
    ConfusionMatrix,
    LayerRule,
    ScoredCandidate,
    assess_sufficiency,
    bootstrap_f1_interval,
    confusion_matrix,
    decide,
    evaluate_layers,
    fit_layers,
    hover_analogue,
    promotion_checks,
    score_candidates,
    select,
    spike_analogue,
    split_sessions,
    stage_2_reachability,
)
from lift.algorithms.features import GapBoundaryKinematics, parse_sample_block
from lift.algorithms.golden import Gap, Interval, LiftGolden, Segmentation
from lift.algorithms.candidates import THETA_SWEEP_MS


# ── corpus builders ──────────────────────────────────────────────────────────────────────────────


def make_block(dt_us: list[int], dx: list[float]) -> object:
    return parse_sample_block({"t0Ms": 0.0, "dtUs": dt_us, "dx": dx, "dy": [0.0] * len(dx)})


def synthetic_run(
    run_id: str,
    session_id: str,
    instruction_class: str,
    gap_ms: list[int],
    exit_speed_counts: float,
    annotate: bool = True,
) -> tuple[LiftGolden, object]:
    """One run: N trials of a steady approach, a gap, then a resume at ``exit_speed_counts``.

    ``exit_speed_counts`` is the only axis on which the two classes differ here, which is what makes
    the layer-2 gain in these tests interpretable -- and also why they prove nothing about real
    mice, where no such clean axis is known to exist.

    The steady stretch is 400 samples for a reason: the frozen matcher pairs each annotation with
    the gap whose start is nearest, and the self-report latency is 180 ms, so trials spaced closer
    than ~2x that would let an annotation be claimed by the *following* gap and every label in the
    corpus would shift by one.
    """

    dt_us: list[int] = [0]
    dx: list[float] = [0.0]
    gap_after_indices: list[int] = []

    for duration_ms in gap_ms:
        for _ in range(400):
            dt_us.append(1000)
            dx.append(2.0)
        gap_after_indices.append(len(dt_us))
        dt_us.append(duration_ms * 1000)
        dx.append(0.0)
        for _ in range(400):
            dt_us.append(1000)
            dx.append(exit_speed_counts)

    block = make_block(dt_us, dx)

    gaps: list[Gap] = []
    annotations: list[Interval] = []
    for index, after_index in enumerate(gap_after_indices):
        gaps.append(
            Gap(
                index=index,
                start_ms=block.times_ms[after_index - 1],
                end_ms=block.times_ms[after_index],
                duration_ms=dt_us[after_index] / 1000,
                before_index=after_index - 1,
                after_index=after_index,
            )
        )
        if annotate:
            start = block.times_ms[after_index - 1] + 180
            annotations.append(Interval(start_ms=start, end_ms=start + dt_us[after_index] / 1000))

    golden = LiftGolden(
        run_id=run_id,
        session_id=session_id,
        instruction_class=instruction_class,
        display_hz=240.0,
        sample_count=len(dt_us),
        t0_ms=0.0,
        dt_us=tuple(dt_us),
        unlocked_intervals=(),
        annotation_intervals=tuple(annotations),
        segmentations=tuple(Segmentation(theta_ms=theta, gaps=tuple(gaps)) for theta in THETA_SWEEP_MS),
        source_path=None,
    )
    return golden, block


def corpus() -> tuple[tuple[LiftGolden, ...], dict[str, object]]:
    """Two sessions, each with a lift run, a pause run and a oneshot run."""

    runs = [
        synthetic_run("lift-a", "s1", "lift", [200] * 8, exit_speed_counts=40.0),
        synthetic_run("pause-a", "s1", "pause", [200] * 8, exit_speed_counts=2.0),
        synthetic_run("oneshot-a", "s1", "oneshot", [60] * 8, exit_speed_counts=2.0, annotate=False),
        synthetic_run("lift-b", "s2", "lift", [200] * 8, exit_speed_counts=40.0),
        synthetic_run("pause-b", "s2", "pause", [200] * 8, exit_speed_counts=2.0),
        synthetic_run("oneshot-b", "s2", "oneshot", [60] * 8, exit_speed_counts=2.0, annotate=False),
    ]
    return tuple(golden for golden, _ in runs), {golden.run_id: block for golden, block in runs}


def candidate(label: str, negative_group: str, duration_ms: float, speed_after: float | None) -> ScoredCandidate:
    return ScoredCandidate(
        run_id="r",
        session_id="s",
        instruction_class="lift" if label == "lift" else "pause",
        theta_ms=30.0,
        gap_index=0,
        duration_ms=duration_ms,
        label=label,
        negative_group=negative_group,
        boundary=GapBoundaryKinematics(
            speed_before_counts_per_sec=1000.0,
            speed_after_counts_per_sec=speed_after,
            accel_enter_counts_per_sec2=-1.0,
            accel_exit_counts_per_sec2=1.0,
            density_before_hz=1000.0,
            density_after_hz=1000.0,
            tiny_fraction_before=0.0,
            tiny_fraction_after=0.0,
            n_before=20,
            n_after=20,
        ),
        spike_analogue=False,
        hover_analogue=False,
    )


# ── scoring keeps T2's labels ────────────────────────────────────────────────────────────────────


def test_scoring_reuses_the_frozen_candidate_table_rather_than_relabelling() -> None:
    goldens, blocks = corpus()
    scored = score_candidates(goldens, blocks, window_ms=20.0)

    lift_rows = [row for row in scored if row.run_id == "lift-a" and row.theta_ms == 30.0]
    pause_rows = [row for row in scored if row.run_id == "pause-a" and row.theta_ms == 30.0]
    oneshot_rows = [row for row in scored if row.run_id == "oneshot-a" and row.theta_ms == 30.0]

    assert [row.label for row in lift_rows] == ["lift"] * 8
    assert [row.label for row in pause_rows] == ["pause"] * 8
    # No annotations in the oneshot runs, so every candidate there is a oneshot negative.
    assert {row.negative_group for row in oneshot_rows} == {"oneshot"}


def test_a_golden_without_its_sample_block_raises_instead_of_being_dropped() -> None:
    goldens, blocks = corpus()
    del blocks["pause-b"]
    with pytest.raises(KeyError, match="pause-b"):
        score_candidates(goldens, blocks, window_ms=20.0)


# ── layers only ever narrow ──────────────────────────────────────────────────────────────────────


def test_each_layer_is_a_conjunction_so_recall_can_only_fall() -> None:
    goldens, blocks = corpus()
    scored = score_candidates(goldens, blocks, window_ms=20.0)
    at_theta = tuple(row for row in scored if row.theta_ms == 30.0)

    rules = fit_layers(at_theta, theta_ms=30.0)
    predicted = [{index for index, row in enumerate(at_theta) if rule.predict(row)} for rule in rules]

    for narrower, wider in zip(predicted[1:], predicted):
        assert narrower <= wider


def test_a_later_layer_never_re_fits_an_earlier_layer_s_threshold() -> None:
    goldens, blocks = corpus()
    at_theta = tuple(row for row in score_candidates(goldens, blocks, window_ms=20.0) if row.theta_ms == 30.0)

    gap_only, boundary, spike, hover = fit_layers(at_theta, theta_ms=30.0)

    assert boundary.min_duration_ms == gap_only.min_duration_ms
    assert spike.min_duration_ms == gap_only.min_duration_ms
    assert hover.min_duration_ms == gap_only.min_duration_ms
    assert spike.boundary_threshold == boundary.boundary_threshold
    assert hover.boundary_axis == boundary.boundary_axis


def test_fitting_the_same_calibration_set_twice_yields_the_same_rule() -> None:
    goldens, blocks = corpus()
    at_theta = tuple(row for row in score_candidates(goldens, blocks, window_ms=20.0) if row.theta_ms == 30.0)
    assert fit_layers(at_theta, 30.0) == fit_layers(at_theta, 30.0)


def test_a_candidate_whose_chosen_axis_is_missing_is_not_predicted() -> None:
    # A window too sparse to yield a speed must not pass for free.
    rule = LayerRule(LAYERS[1], min_duration_ms=0.0, boundary_axis="speed_after_counts_per_sec",
                     boundary_direction=">=", boundary_threshold=1.0)
    assert rule.predict(candidate("lift", "", 100.0, speed_after=5.0)) is True
    assert rule.predict(candidate("lift", "", 100.0, speed_after=None)) is False


# ── metrics ──────────────────────────────────────────────────────────────────────────────────────


def test_the_confusion_matrix_counts_all_four_cells() -> None:
    rows = (
        candidate("lift", "", 200.0, 50.0),
        candidate("lift", "", 10.0, 50.0),
        candidate("pause", "pause", 200.0, 50.0),
        candidate("pause", "pause", 10.0, 50.0),
    )
    matrix = confusion_matrix(rows, LayerRule(LAYERS[0], min_duration_ms=100.0))
    assert (matrix.true_positive, matrix.false_negative, matrix.false_positive, matrix.true_negative) == (1, 1, 1, 1)
    assert matrix.precision == 0.5 and matrix.recall == 0.5 and matrix.f1 == 0.5


def test_metrics_with_an_empty_denominator_are_absent_rather_than_zero() -> None:
    empty = ConfusionMatrix(0, 0, 0, 0)
    assert empty.precision is None and empty.recall is None and empty.f1 is None


def test_an_unmeasured_negative_group_reports_no_rate_rather_than_a_passing_one() -> None:
    # A 0.0 here would satisfy the frozen ceiling with no evidence behind it.
    rows = (candidate("lift", "", 200.0, 50.0),)
    results = evaluate_layers(rows, (LayerRule(LAYERS[0], min_duration_ms=100.0),), 30.0, 20.0, "held-out")
    assert results[0].pause_false_positive_rate is None
    assert results[0].oneshot_false_positive_rate is None


def test_each_layer_carries_its_gain_over_the_previous_one() -> None:
    goldens, blocks = corpus()
    at_theta = tuple(row for row in score_candidates(goldens, blocks, window_ms=20.0) if row.theta_ms == 30.0)
    rules = fit_layers(at_theta, 30.0)
    results = evaluate_layers(at_theta, rules, 30.0, 20.0, "calibration")

    assert results[0].f1_gain_over_previous_layer is None  # nothing precedes the baseline
    assert [result.layer for result in results] == list(LAYERS)
    for previous, current in zip(results, results[1:]):
        if previous.matrix.f1 is not None and current.matrix.f1 is not None:
            assert current.f1_gain_over_previous_layer == pytest.approx(current.matrix.f1 - previous.matrix.f1)


# ── the reference analogues ──────────────────────────────────────────────────────────────────────


def test_the_stage_2_rule_cannot_fire_at_this_cohort_s_sample_spacing() -> None:
    """The finding, as arithmetic rather than as an observation about one recording.

    Firing needs a speed change larger than ``ACCEL_UP * dt``; the start-speed gate caps how large
    that change can be, because speeds cannot be negative. At the 1 ms spacing the recording spec
    requires, the first number (350) is above the second (300), so neither branch can ever fire --
    on any data, at any CPI. Layer 3's gain is therefore structurally zero on this cohort, which is
    a different result from "the boundaries looked alike".
    """

    at_1_khz = stage_2_reachability(1.0)
    assert at_1_khz.landing_required_speed_change == 350.0
    assert at_1_khz.largest_possible_speed_change == 300.0
    assert at_1_khz.reachable is False

    # It is the spacing, not the parameters, that closes the door: halve it and the landing branch
    # opens. Recorded so the finding is not misread as "the ported thresholds are wrong".
    assert stage_2_reachability(0.5).landing_reachable is True
    assert stage_2_reachability(0.25).takeoff_reachable is True


def test_the_stage_2_analogue_therefore_fires_on_no_candidate_in_the_corpus() -> None:
    goldens, blocks = corpus()
    scored = score_candidates(goldens, blocks, window_ms=20.0)
    assert [row for row in scored if row.spike_analogue] == []

    lift = next(g for g in goldens if g.run_id == "lift-a")
    assert spike_analogue(blocks["lift-a"], lift.segmentation_at(30.0).gaps[0]) is False


def test_the_stage_3_analogue_skips_a_boundary_under_the_deadzone_as_the_source_does() -> None:
    # Straight-line entry, so the direction never changes: no jitter, whatever the speed.
    goldens, blocks = corpus()
    lift = next(g for g in goldens if g.run_id == "lift-a")
    assert hover_analogue(blocks["lift-a"], lift.segmentation_at(30.0).gaps[0]) is False


# ── the session split ────────────────────────────────────────────────────────────────────────────


def test_the_split_is_by_session_and_no_session_appears_on_both_sides() -> None:
    goldens, _ = corpus()
    calibration, held_out = split_sessions(goldens)
    assert calibration == ("s1",)
    assert held_out == ("s2",)
    assert set(calibration) & set(held_out) == set()


def test_a_single_session_yields_no_held_out_rather_than_a_fabricated_one() -> None:
    goldens, _ = corpus()
    one_session = tuple(golden for golden in goldens if golden.session_id == "s1")
    calibration, held_out = split_sessions(one_session)
    assert calibration == ("s1",)
    assert held_out == ()


def test_selecting_a_split_keeps_only_that_split_s_candidates() -> None:
    goldens, blocks = corpus()
    scored = score_candidates(goldens, blocks, window_ms=20.0)
    calibration, held_out = split_sessions(goldens)
    assert {row.session_id for row in select(scored, calibration)} == {"s1"}
    assert {row.session_id for row in select(scored, held_out)} == {"s2"}


# ── sufficiency and the decision rule ────────────────────────────────────────────────────────────


def test_sufficiency_counts_annotation_intervals_not_candidate_gaps() -> None:
    goldens, _ = corpus()
    _, held_out = split_sessions(goldens)
    report = assess_sufficiency(goldens, held_out)
    assert (report.sessions, report.lift_intervals, report.pause_intervals) == (2, 16, 16)
    assert report.sufficient is False  # 16 < 30: the frozen floor is not met by this corpus


def test_the_verdict_is_blocked_by_data_when_a_floor_is_missed_even_if_a_layer_looks_perfect() -> None:
    goldens, blocks = corpus()
    calibration_sessions, held_out_sessions = split_sessions(goldens)
    scored = tuple(row for row in score_candidates(goldens, blocks, window_ms=20.0) if row.theta_ms == 30.0)
    rules = fit_layers(select(scored, calibration_sessions), 30.0)
    calibration = evaluate_layers(select(scored, calibration_sessions), rules, 30.0, 20.0, "calibration")
    held_out = evaluate_layers(select(scored, held_out_sessions), rules, 30.0, 20.0, "held-out")

    verdict = decide(assess_sufficiency(goldens, held_out_sessions), tuple(zip(calibration, held_out)))

    assert verdict.verdict == "blocked-by-data"
    assert "annotation intervals >= 30" in verdict.reason


def test_an_unusable_annotation_channel_short_circuits_before_any_layer_is_looked_at() -> None:
    goldens, _ = corpus()
    _, held_out = split_sessions(goldens)
    verdict = decide(assess_sufficiency(goldens, held_out), (), annotation_channel_usable=False)
    assert verdict.verdict == "annotation-channel-unusable"
    assert verdict.promoting_cell is None


def test_the_promotion_gate_is_the_six_frozen_conditions_with_the_measured_value_beside_each() -> None:
    rows = (candidate("lift", "", 200.0, 50.0), candidate("pause", "pause", 10.0, 50.0))
    rule = LayerRule(LAYERS[0], min_duration_ms=100.0)
    result = evaluate_layers(rows, (rule,), 30.0, 20.0, "held-out")[0]

    checks = promotion_checks(result, result)
    assert [check.rule for check in checks] == [
        "held-out precision >= 0.9",
        "held-out recall >= 0.8",
        "held-out F1 >= 0.85",
        "pause false-positive rate <= 0.1",
        "oneshot false-positive rate <= 0.05",
        "calibration F1 - held-out F1 <= 0.1",
    ]
    # Perfect separation on this toy pair, but the oneshot group is empty, so that row cannot pass.
    assert [check.passed for check in checks] == [True, True, True, True, False, True]
    assert checks[4].actual == "not measurable (empty denominator)"


def test_promotion_needs_every_condition_and_one_shortfall_is_enough_to_deny_it() -> None:
    rows = (candidate("lift", "", 200.0, 50.0), candidate("pause", "pause", 200.0, 50.0))
    rule = LayerRule(LAYERS[0], min_duration_ms=100.0)
    result = evaluate_layers(rows, (rule,), 30.0, 20.0, "held-out")[0]
    checks = promotion_checks(result, result)
    assert any(not check.passed for check in checks)


def test_a_sufficient_cohort_with_no_qualifying_layer_reads_not_reliably_separable() -> None:
    goldens, _ = corpus()
    # Stand in a report that has already cleared the data floors, so the layer arm is what decides.
    sufficiency = assess_sufficiency(goldens, ("s2",))
    cleared = replace(sufficiency, checks=tuple(replace(check, passed=True) for check in sufficiency.checks))

    rows = (candidate("lift", "", 10.0, 50.0), candidate("pause", "pause", 200.0, 50.0))
    rule = LayerRule(LAYERS[0], min_duration_ms=100.0)
    result = evaluate_layers(rows, (rule,), 30.0, 20.0, "held-out")[0]

    verdict = decide(cleared, ((result, result),))
    assert verdict.verdict == "not-reliably-separable"


# ── reproducibility (NFR-61.5) ───────────────────────────────────────────────────────────────────


def test_the_bootstrap_interval_is_identical_across_runs_at_the_same_seed() -> None:
    rows = tuple(candidate("lift", "", 200.0, 50.0) for _ in range(10)) + tuple(
        candidate("pause", "pause", 200.0, 50.0) for _ in range(10)
    )
    rule = LayerRule(LAYERS[0], min_duration_ms=100.0)
    first = bootstrap_f1_interval(rows, rule, seed=61, resamples=200)
    second = bootstrap_f1_interval(rows, rule, seed=61, resamples=200)
    assert first == second
    assert first.seed == 61 and first.resamples == 200


def test_a_different_seed_is_allowed_to_differ_so_the_seed_is_doing_work() -> None:
    # Without this the reproducibility test above would also pass on a hard-coded constant.
    rows = tuple(candidate("lift", "", 200.0 + index, 50.0) for index in range(10)) + tuple(
        candidate("pause", "pause", 150.0 + index, 50.0) for index in range(10)
    )
    rule = LayerRule(LAYERS[0], min_duration_ms=160.0)
    assert bootstrap_f1_interval(rows, rule, seed=61, resamples=200) != bootstrap_f1_interval(
        rows, rule, seed=62, resamples=200
    )


def test_an_empty_candidate_set_has_no_interval_rather_than_a_degenerate_one() -> None:
    assert bootstrap_f1_interval((), LayerRule(LAYERS[0], min_duration_ms=0.0)).low is None
