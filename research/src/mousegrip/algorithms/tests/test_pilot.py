"""Guards for the Track P extraction.

Two of these are behavioural tripwires rather than coverage. The pilot's whole value rests on
(1) censored time-to-hit being estimated instead of dropped and (2) the three kinds of "no hit"
staying apart -- both fail *silently*, producing a plausible-looking number that flatters the
condition with the most failures. The rest is the C-D2 purity check every ``algorithms/``
package in this repo carries.
"""

from __future__ import annotations

from pathlib import Path

from mousegrip.algorithms.pilot import (
    MECHANISM_COLUMNS,
    PEEK_TIMEOUT_MS,
    extract_presentations,
    kaplan_meier,
    resolve_timing,
)

ALGORITHMS = Path(__file__).resolve().parents[1]


def _sources() -> list[Path]:
    return sorted(p for p in ALGORITHMS.rglob("*.py") if "tests" not in p.parts)


def test_algorithms_do_not_print_plot_or_write_files() -> None:
    """C-D2: rendering and I/O belong in ``notebooks/``, never here."""
    banned = ("print(", "matplotlib", "open(", "savefig", "to_csv", "Path(")
    for path in _sources():
        source = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in source, f"{path.name} contains {token!r}"


def test_algorithms_do_not_read_the_clock_or_random() -> None:
    """Determinism: the same export must always yield the same table."""
    for path in _sources():
        source = path.read_text(encoding="utf-8")
        for token in ("import random", "import time", "datetime.now", "perf_counter"):
            assert token not in source, f"{path.name} contains {token!r}"


def test_kaplan_meier_matches_a_hand_computed_curve() -> None:
    """Four observations, one censored mid-way -- the censored row must stay in the risk set
    until its own time and then leave without dropping the curve."""
    km = kaplan_meier([(100.0, 1), (200.0, 0), (300.0, 1), (400.0, 1)])

    # t=100: 1 event of 4 at risk  -> S = 0.75
    # t=200: censored, no step, at risk falls to 2
    # t=300: 1 event of 2 at risk  -> S = 0.375
    # t=400: 1 event of 1 at risk  -> S = 0.0
    assert km.times == (100.0, 300.0, 400.0)
    assert km.survival[0] == 0.75
    assert abs(km.survival[1] - 0.375) < 1e-12
    assert km.survival[2] == 0.0
    assert km.n == 4 and km.events == 3


def test_kaplan_meier_reports_unestimable_quantiles_instead_of_guessing() -> None:
    """When the curve never falls to 1-q, the quantile is unknown -- not the largest seen time."""
    km = kaplan_meier([(100.0, 1)] + [(200.0, 0)] * 9)
    assert km.quantile(0.5) is None
    assert km.rmst(200.0) > 0.0


def test_kaplan_meier_rmst_is_the_area_under_the_step_function() -> None:
    km = kaplan_meier([(100.0, 1), (100.0, 1)])
    # S = 1 on [0, 100) then 0 -> area over [0, 200] is exactly 100.
    assert abs(km.rmst(200.0) - 100.0) < 1e-9


def _payload(events: list[dict], *, tick_span_ms: float = 63000.0) -> dict:
    ticks = [{"t": 0.0, "dYaw": 1.0, "dPitch": 0.0}, {"t": tick_span_ms, "dYaw": 1.0, "dPitch": 0.0}]
    return {"meta": {"drillId": "spider-shot-wide-v1"}, "ticks": ticks, "events": events}


def _visible(t: float, target: str, zone: str = "peripheral", side: str = "L") -> dict:
    return {
        "type": "visible", "t": t, "targetId": target, "zone": zone, "side": side,
        "targetX": -6.0, "targetY": 1.1, "targetZ": -5.2,
    }


def test_timeout_and_session_end_are_not_collapsed() -> None:
    """A target that ran its full 2500 ms deadline and one cut off by the task clock are
    different failures: the first is the player's, the second is the schedule's."""
    start = 3000.0
    events = [
        _visible(start, "t0", zone="center"),
        _visible(start + 1000.0, "t1"),
        # nothing hits t1; the next target only appears after the full deadline -> timeout
        _visible(start + 1000.0 + PEEK_TIMEOUT_MS, "t2", zone="center"),
        # t3 appears 500 ms before the task clock expires -> administrative censoring
        _visible(start + 59500.0, "t3"),
    ]
    timing = resolve_timing(_payload(events))
    presentations = extract_presentations(_payload(events), timing)

    assert [p.target_id for p in presentations] == ["t1", "t3"]
    assert presentations[0].end_reason == "timeout"
    assert presentations[0].full_follow_up is True
    assert presentations[1].end_reason == "session_end"
    assert presentations[1].full_follow_up is False
    # The censored row keeps its observed time; it is never recorded as a 0 ms hit.
    assert presentations[1].time_to_hit_ms is None
    assert abs(presentations[1].observed_ms - 500.0) < 1e-9


def test_a_presentation_with_no_fire_still_counts_in_the_denominator() -> None:
    """First-shot rate must not be computed over "trials where the player shot"."""
    start = 3000.0
    events = [
        _visible(start, "t0", zone="center"),
        _visible(start + 1000.0, "t1"),
        {"type": "fire", "t": start + 1400.0, "hit": True, "targetId": "t1", "offsetDeg": 0.4},
        _visible(start + 1500.0, "t2", zone="center"),
        _visible(start + 2000.0, "t3"),
        _visible(start + 2000.0 + PEEK_TIMEOUT_MS, "t4", zone="center"),
    ]
    timing = resolve_timing(_payload(events))
    presentations = extract_presentations(_payload(events), timing)

    assert len(presentations) == 2
    assert presentations[0].first_fire_hit is True
    assert presentations[1].fire_count == 0
    assert presentations[1].first_fire_hit is None
    hits = sum(1 for p in presentations if p.first_fire_hit)
    assert hits / len(presentations) == 0.5


def _run(run_id: str, condition: str, **overrides) -> object:
    from mousegrip.algorithms.pilot import RunExtract, RunQuality, RunTiming

    timing = RunTiming(3000.0, 63000.0, "test", 63000.0, 60000.0, 3000.0, 0.0, ())
    quality = RunQuality((), False, 0, False, False, 0.9, ())
    defaults = dict(
        run_id=run_id, condition_id=condition, mouse="m", grip="g", rep=1, started_at="",
        timing=timing, quality=quality, presentations=(), center_presentations=0,
        ads_down_count=0, seed=1, sensitivity=1.0, dpi=800, fov_deg=75.0,
        display_css="1920x1080", fullscreen=True, display_hz=240,
    )
    return RunExtract(**{**defaults, **overrides})


def test_a_settings_change_spoils_the_contrast_that_spans_it_not_the_runs() -> None:
    """A participant who played one condition at a different sensitivity has two confounded
    factors, not one deviant block: the contrast crossing the change is unusable while every
    other contrast of theirs -- and every run -- stays intact."""
    from mousegrip.algorithms.pilot import contrast_comparability

    a = [_run("a1", "A", sensitivity=1.1), _run("a2", "A", sensitivity=1.1)]
    b = [_run("b1", "B", sensitivity=1.0), _run("b2", "B", sensitivity=1.0)]
    c = [_run("c1", "C", sensitivity=1.0), _run("c2", "C", sensitivity=1.0)]

    spoiled = contrast_comparability(a, b)
    assert spoiled and "sensitivity" in spoiled[0]
    # The contrast that never crosses the change is untouched.
    assert contrast_comparability(b, c) == ()


def test_a_setting_that_moves_inside_one_condition_spoils_its_contrasts_too() -> None:
    from mousegrip.algorithms.pilot import contrast_comparability

    mixed = [_run("b1", "B", fullscreen=False), _run("b2", "B", fullscreen=True)]
    steady = [_run("c1", "C"), _run("c2", "C")]
    reasons = contrast_comparability(mixed, steady)
    assert any("fullscreen" in r for r in reasons)


def test_active_window_comes_from_the_protocol_not_the_last_event() -> None:
    """The recording tail must be trimmed by the time limit, not by where activity stopped."""
    start = 3000.0
    events = [_visible(start, "t0", zone="center"), _visible(start + 1000.0, "t1")]
    timing = resolve_timing(_payload(events, tick_span_ms=68062.5))

    assert timing.active_duration_ms == 60000.0
    assert timing.countdown_trim_ms == 3000.0
    assert abs(timing.post_task_trim_ms - 5062.5) < 1e-9
    assert timing.trim_reasons == ("TRIM_COUNTDOWN", "TRIM_POST_TASK")


# --- mechanism layer ----------------------------------------------------------------------


def _mech(run_id: str, target_id: str, **cells) -> dict[str, str]:
    row = {column.name: "" for column in MECHANISM_COLUMNS}
    row.update({"run_id": run_id, "target_id": target_id})
    row.update({key: str(value) for key, value in cells.items()})
    return row


def test_mechanism_rows_key_on_run_and_target_because_target_ids_repeat() -> None:
    """`t3` exists in every run; keying on it alone would silently overwrite 50 rows with one."""
    from mousegrip.algorithms.pilot import index_mechanism

    rows = [_mech("S01/GPW1/a.json", "t3", peak_omega_deg_per_sec=100),
            _mech("S02/GPW1/b.json", "t3", peak_omega_deg_per_sec=200)]
    indexed = index_mechanism(rows)
    assert len(indexed) == 2
    assert indexed[("S01/GPW1/a.json", "t3")]["peak_omega_deg_per_sec"] == "100"
    assert indexed[("S02/GPW1/b.json", "t3")]["peak_omega_deg_per_sec"] == "200"


def test_a_blank_that_is_an_answer_does_not_count_against_coverage() -> None:
    """`overshoot_deg` is blank when the crosshair never left the target -- that is "no escape",
    not "unknown", and treating it as missing would withhold a column that is fully available."""
    from mousegrip.algorithms.pilot import mechanism_coverage

    rows = [_mech("r", f"t{i}", peak_omega_deg_per_sec=1) for i in range(10)]
    rows[0]["overshoot_deg"] = "0.4"  # only one trial actually overshot
    coverage = mechanism_coverage(rows)
    assert coverage["overshoot_deg"] == 1.0
    assert coverage["peak_omega_deg_per_sec"] == 1.0
    assert coverage["reaction_ms"] == 0.0


def test_admissibility_is_decided_by_coverage_not_by_tier() -> None:
    """The tier explains why a column tends to fail; the verdict still comes from what this
    cohort produced, so a Tier 1 column that did survive is admitted."""
    from mousegrip.algorithms.pilot import admissible_mechanism_columns

    coverage = {
        "peak_omega_deg_per_sec": 1.0,
        "entry_omega_deg_per_sec": 0.99,
        "brake_retention": 0.99,
        "trigger_margin_ms": 0.99,
        "overshoot_deg": 1.0,
        "drop_count": 1.0,
        "micro_adjust_count": 1.0,
        "fire_angle_error_deg": 0.99,
        "reaction_ms": 0.95,      # would have survived
        "movement_time_ms": 0.32,  # the cohort's actual figure
    }
    admissible, withheld = admissible_mechanism_columns(coverage)
    assert "reaction_ms" in admissible
    assert withheld == ("movement_time_ms",)


def test_the_cohort_figure_withholds_both_tier_one_columns() -> None:
    from mousegrip.algorithms.pilot import admissible_mechanism_columns

    coverage = {"peak_omega_deg_per_sec": 1.0, "entry_omega_deg_per_sec": 0.992,
                "brake_retention": 0.992, "trigger_margin_ms": 0.991, "overshoot_deg": 1.0,
                "drop_count": 1.0, "micro_adjust_count": 1.0, "fire_angle_error_deg": 0.992,
                "reaction_ms": 0.318, "movement_time_ms": 0.317}
    admissible, withheld = admissible_mechanism_columns(coverage)
    assert set(withheld) == {"reaction_ms", "movement_time_ms"}
    assert len(admissible) == 8
