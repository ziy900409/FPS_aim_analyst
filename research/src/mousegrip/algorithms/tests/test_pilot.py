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


def test_active_window_comes_from_the_protocol_not_the_last_event() -> None:
    """The recording tail must be trimmed by the time limit, not by where activity stopped."""
    start = 3000.0
    events = [_visible(start, "t0", zone="center"), _visible(start + 1000.0, "t1")]
    timing = resolve_timing(_payload(events, tick_span_ms=68062.5))

    assert timing.active_duration_ms == 60000.0
    assert timing.countdown_trim_ms == 3000.0
    assert abs(timing.post_task_trim_ms - 5062.5) < 1e-9
    assert timing.trim_reasons == ("TRIM_COUNTDOWN", "TRIM_POST_TASK")
