from __future__ import annotations

import ast
import math
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from modules.metrics.algorithms.coupling import (
    DEFAULT_GATE_THRESHOLDS,
    DEFAULT_XCORR_PARAMS,
    GATE_VERSION,
    KNOWN_GATE_REASONS,
    KNOWN_XCORR_FLAGS,
    MIN_PEARSON_SAMPLES,
    XCORR_VERSION,
    GateThresholds,
    XcorrParams,
    _pearson,
    key_event_crosscheck,
    key_state_signed,
    key_velocity_xcorr,
    reliability_gate,
    xcorr_table,
)
from modules.metrics.algorithms.peek import PeekWindow


DT_MS = 1000.0 / 128.0

#: Small but structurally identical thresholds for the tests that must actually run the gate. The
#: frozen `gate-v1` numbers are asserted separately (they are the artefact); reproducing a 1000x
#: permutation null in a unit test would buy nothing but minutes.
FAST_THRESHOLDS = GateThresholds(
    min_samples=10,
    shuffle_iters=120,
    shuffle_alpha=0.01,
    bootstrap_iters=200,
    ci_width_max=0.20,
    half_agreement_within_ci=True,
    seed=20260810,
)


def _peek(index: int, side: str = "L") -> PeekWindow:
    return PeekWindow(
        index=index,
        target_id="target",
        side=side,
        t_visible=0.0,
        t_end=1.0,
        t_counter=None,
        counter_key=None,
        t_release=None,
        release_key=None,
        t_first_shot=None,
        fires=(),
        t_hit=None,
        outcome="no_shot",
        ads=None,
        flags=(),
        tick_slice=slice(0, 0),
    )


def _ticks(keys: list[list[str]]) -> pd.DataFrame:
    return pd.DataFrame({"t": np.arange(len(keys), dtype=float) * DT_MS, "keys": keys})


def _square_key(n: int, period: int = 14) -> np.ndarray:
    """Alternating A/D holds at a fixed period: a strafe pattern with real autocorrelation."""

    return np.where((np.arange(n) // (period // 2)) % 2 == 0, 1.0, -1.0)


def _block_key(n: int, rng: np.random.Generator) -> np.ndarray:
    """Alternating A/D holds of *random* duration.

    A fixed-period square wave would be the wrong probe for a lag test: its autocorrelation peaks
    again at every multiple of the period, so noise decides which of several equally perfect peaks
    wins and the recovered lag is off by a whole period. Random hold lengths keep the strafe-like
    autocorrelation while leaving exactly one correlation peak.
    """

    state = np.empty(n + 32, dtype=float)
    filled = 0
    value = 1.0
    while filled < state.size:
        length = int(rng.integers(9, 27))
        state[filled : filled + length] = value
        filled += length
        value = -value
    return state[:n]


def _keys_from_state(state: np.ndarray) -> list[list[str]]:
    return [["D"] if value > 0 else ["A"] if value < 0 else [] for value in state]


def _coupled_window(n: int, lag: int, noise: float, rng: np.random.Generator) -> tuple[pd.DataFrame, np.ndarray]:
    """A window whose |ω| is the key state shifted by ``lag`` ticks (key leads when ``lag > 0``)."""

    state = _block_key(n, rng)
    # omega[t] follows state[t - lag], so a positive `lag` means the key state leads omega by that
    # many ticks -- which the sign convention reports as a *negative* peak lag.
    omega = np.roll(state, lag) * 90.0 + 200.0 + rng.normal(scale=noise, size=n)
    omega[0] = math.nan  # the omega_deg_s contract: index 0 is nan
    return _ticks(_keys_from_state(state)), omega


def _noise_window(n: int, rng: np.random.Generator) -> tuple[pd.DataFrame, np.ndarray]:
    state = np.sign(rng.normal(size=n))
    omega = np.abs(rng.normal(size=n)) * 100.0
    omega[0] = math.nan
    return _ticks(_keys_from_state(state)), omega


def _table(windows: list[tuple[pd.DataFrame, np.ndarray]], session: str = "s1") -> pd.DataFrame:
    peeks = [_peek(index) for index in range(len(windows))]
    return xcorr_table(
        peeks,
        [ticks for ticks, _ in windows],
        [omega for _, omega in windows],
        DEFAULT_XCORR_PARAMS,
        session=session,
    )


# --- key_state_signed -------------------------------------------------------------------------


def test_key_state_signed_encodes_the_four_tick_states() -> None:
    state = key_state_signed(_ticks([["D"], ["A"], ["A", "D"], []]))

    # A+D held together is a genuine zero (no net strafe input), not a dropped sample.
    assert list(state) == [1.0, -1.0, 0.0, 0.0]


def test_key_state_signed_ignores_non_strafe_keys() -> None:
    assert list(key_state_signed(_ticks([["W"], ["D", "W"], ["S"]]))) == [0.0, 1.0, 0.0]


def test_key_state_signed_rejects_a_frame_without_the_keys_column() -> None:
    with pytest.raises(ValueError, match="ticks.keys"):
        key_state_signed(pd.DataFrame({"t": [0.0, 1.0]}))


# --- the ported Pearson core ------------------------------------------------------------------


def test_pearson_agrees_with_numpy_corrcoef() -> None:
    # The port computes r directly instead of via np.corrcoef (5x faster, and the permutation null
    # calls it ~1.3M times). This pins the two to the same value so "faster" cannot become "different".
    rng = np.random.default_rng(11)
    for _ in range(200):
        x = rng.normal(size=int(rng.integers(4, 80)))
        y = rng.normal(size=x.size)
        assert _pearson(x, y) == pytest.approx(float(np.corrcoef(x, y)[0, 1]), abs=1e-12)


def test_pearson_is_nan_below_the_ported_minimum_sample_count() -> None:
    assert MIN_PEARSON_SAMPLES == 4
    x = np.array([1.0, 2.0, 3.0])
    assert math.isnan(_pearson(x, x))


def test_pearson_is_nan_for_a_zero_variance_input() -> None:
    # nan, never 0.0: a constant series has no linear relation to anything, and 0.0 would read as
    # "measured, no coupling" instead of "not measurable".
    constant = np.ones(20)
    varying = np.arange(20, dtype=float)
    assert math.isnan(_pearson(constant, varying))
    assert math.isnan(_pearson(varying, constant))


# --- key_velocity_xcorr -----------------------------------------------------------------------


@pytest.mark.parametrize("lag", [-8, -3, 0, 3, 8])
def test_a_known_lag_is_recovered_within_one_tick_with_the_documented_sign(lag: int) -> None:
    # Sign convention (write it down or it gets read backwards): negative lag = key leads omega.
    rng = np.random.default_rng(5)
    ticks, omega = _coupled_window(240, lag, noise=1.0, rng=rng)
    key = key_state_signed(ticks)

    result = key_velocity_xcorr(key[1:], omega[1:], max_lag_ticks=32, dt_ms=DT_MS)

    assert result.flags == ()
    assert result.peak_lag_ms is not None
    assert abs(result.peak_lag_ms - (-lag * DT_MS)) <= DT_MS
    assert abs(result.peak_strength) > 0.5


def test_the_correlogram_spans_the_whole_lag_band_and_reports_its_own_overlap() -> None:
    rng = np.random.default_rng(7)
    ticks, omega = _coupled_window(80, 5, noise=5.0, rng=rng)
    result = key_velocity_xcorr(key_state_signed(ticks)[1:], omega[1:], max_lag_ticks=32, dt_ms=DT_MS)

    lags_ms = [lag for lag, _, _ in result.correlogram]
    overlaps = [overlap for _, _, overlap in result.correlogram]

    assert len(result.correlogram) == 65
    assert lags_ms[0] == pytest.approx(-32 * DT_MS)
    assert lags_ms[-1] == pytest.approx(32 * DT_MS)
    # S-31.1: the ends of a correlogram rest on far fewer paired samples than its middle, so the
    # count travels with every point rather than being left for the reader to infer.
    assert overlaps[32] == result.n_ticks
    assert overlaps[0] == result.n_ticks - 32
    assert overlaps == sorted(overlaps[:33]) + sorted(overlaps[33:], reverse=True)


def test_a_tie_in_absolute_strength_goes_to_the_smaller_absolute_lag() -> None:
    # A period-4 square wave against itself correlates identically at lag 0 and lag +-4; PA's
    # tie-break (ported) picks the lag closest to zero rather than whichever the loop saw first.
    state = np.tile([1.0, 1.0, -1.0, -1.0], 20)
    result = key_velocity_xcorr(state, state.copy(), max_lag_ticks=8, dt_ms=DT_MS)

    assert result.peak_lag_ms == pytest.approx(0.0)
    assert result.peak_strength == pytest.approx(1.0)


def test_a_constant_key_state_is_flagged_rather_than_scored_zero() -> None:
    omega = np.abs(np.random.default_rng(1).normal(size=60)) * 50.0
    result = key_velocity_xcorr(np.ones(60), omega, max_lag_ticks=32, dt_ms=DT_MS)

    assert result.flags == ("key_state_constant",)
    assert result.peak_lag_ms is None and result.peak_strength is None


def test_a_constant_omega_is_flagged() -> None:
    result = key_velocity_xcorr(_square_key(60), np.full(60, 42.0), max_lag_ticks=32, dt_ms=DT_MS)

    assert result.flags == ("omega_constant",)
    assert result.peak_strength is None


def test_a_non_finite_omega_is_named_as_such_and_not_reported_as_constant() -> None:
    omega = np.abs(np.random.default_rng(2).normal(size=60)) * 50.0
    omega[10] = math.nan
    result = key_velocity_xcorr(_square_key(60), omega, max_lag_ticks=32, dt_ms=DT_MS)

    assert result.flags == ("non_finite_omega",)


def test_no_finite_lag_is_reserved_for_windows_no_other_flag_explains() -> None:
    # Both channels vary and are finite, but every overlap is below MIN_PEARSON_SAMPLES.
    result = key_velocity_xcorr(
        np.array([1.0, -1.0, 1.0]), np.array([3.0, 1.0, 4.0]), max_lag_ticks=2, dt_ms=DT_MS
    )

    assert result.flags == ("no_finite_lag",)
    assert result.peak_strength is None


def test_every_emitted_flag_belongs_to_the_closed_vocabulary() -> None:
    assert KNOWN_XCORR_FLAGS == {
        "window_too_short",
        "key_state_constant",
        "omega_constant",
        "non_finite_omega",
        "no_finite_lag",
    }


def test_key_velocity_xcorr_rejects_mismatched_or_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="same length"):
        key_velocity_xcorr(np.zeros(5), np.zeros(6), max_lag_ticks=1, dt_ms=DT_MS)
    with pytest.raises(ValueError, match="dt_ms"):
        key_velocity_xcorr(np.zeros(5), np.zeros(5), max_lag_ticks=1, dt_ms=0.0)
    with pytest.raises(ValueError, match="max_lag_ticks"):
        key_velocity_xcorr(np.zeros(5), np.zeros(5), max_lag_ticks=-1, dt_ms=DT_MS)


# --- xcorr_table ------------------------------------------------------------------------------


def test_the_table_drops_the_leading_nan_from_both_channels_together() -> None:
    rng = np.random.default_rng(9)
    ticks, omega = _coupled_window(70, 4, noise=2.0, rng=rng)
    frame = _table([(ticks, omega)])

    row = frame.iloc[0]
    assert row["n_ticks"] == 69  # 70 ticks - the one omega_deg_s contractually leaves nan
    assert row["flags"] == ()
    assert row["max_lag_ticks"] == 32
    assert row["dt_ms"] == pytest.approx(DT_MS)
    assert len(row["key_state"]) == len(row["omega"]) == 69


def test_a_window_shorter_than_min_ticks_is_flagged_and_carries_no_correlogram() -> None:
    rng = np.random.default_rng(4)
    ticks, omega = _coupled_window(24, 4, noise=2.0, rng=rng)
    frame = _table([(ticks, omega)])

    row = frame.iloc[0]
    assert row["flags"] == ("window_too_short",)
    assert row["n_ticks"] == 23 < DEFAULT_XCORR_PARAMS.min_ticks
    assert row["correlogram"] == ()
    assert row["peak_strength"] is None


def test_the_table_keeps_peek_identity_and_the_session_label() -> None:
    rng = np.random.default_rng(6)
    windows = [_coupled_window(70, 4, noise=2.0, rng=rng) for _ in range(3)]
    frame = _table(windows, session="09:18")

    assert list(frame["peek_index"]) == [0, 1, 2]
    assert set(frame["session"]) == {"09:18"}
    assert list(frame["side"]) == ["L", "L", "L"]


def test_xcorr_table_rejects_a_wrong_params_type() -> None:
    with pytest.raises(TypeError, match="XcorrParams"):
        xcorr_table([], [], [], params="xcorr-v1")  # type: ignore[arg-type]


# --- frozen pre-registration ------------------------------------------------------------------


def test_the_frozen_xcorr_v1_values_are_pinned() -> None:
    # T0/D-31.5. Changing any of these is a new version plus a full rerun, never an edit.
    assert (DEFAULT_XCORR_PARAMS.max_lag_ms, DEFAULT_XCORR_PARAMS.min_ticks) == (250.0, 32)
    assert DEFAULT_XCORR_PARAMS.key_encoding == "signed_ad"
    assert DEFAULT_XCORR_PARAMS.version == XCORR_VERSION == "xcorr-v1"
    # 250 ms is exactly the +-32 tick band at the nominal 128 Hz tick.
    assert round(DEFAULT_XCORR_PARAMS.max_lag_ms / DT_MS) == 32


def test_the_frozen_gate_v1_values_are_pinned() -> None:
    # T0/D-31.4, frozen 2026-08-10 before any real xcorr value existed.
    assert DEFAULT_GATE_THRESHOLDS == GateThresholds(
        min_samples=10,
        shuffle_iters=1000,
        shuffle_alpha=0.01,
        bootstrap_iters=2000,
        ci_width_max=0.20,
        half_agreement_within_ci=True,
        seed=20260810,
        version="gate-v1",
    )
    assert GATE_VERSION == "gate-v1"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"max_lag_ms": 0.0},
        {"max_lag_ms": math.inf},
        {"min_ticks": 0},
        {"key_encoding": "signed_wasd"},
        {"version": " "},
    ],
)
def test_xcorr_params_rejects_out_of_contract_values(kwargs: dict) -> None:
    base = {"max_lag_ms": 250.0, "min_ticks": 32}
    with pytest.raises(ValueError):
        XcorrParams(**{**base, **kwargs})


@pytest.mark.parametrize(
    "kwargs",
    [
        {"min_samples": 0},
        {"shuffle_iters": -1},
        {"shuffle_alpha": 0.0},
        {"bootstrap_iters": 0},
        {"ci_width_max": math.nan},
        {"half_agreement_within_ci": 1},
        {"seed": -1},
    ],
)
def test_gate_thresholds_rejects_out_of_contract_values(kwargs: dict) -> None:
    base = {
        "min_samples": 10,
        "shuffle_iters": 100,
        "shuffle_alpha": 0.01,
        "bootstrap_iters": 100,
        "ci_width_max": 0.2,
        "half_agreement_within_ci": True,
        "seed": 1,
    }
    with pytest.raises(ValueError):
        GateThresholds(**{**base, **kwargs})


# --- reliability_gate -------------------------------------------------------------------------


def test_the_gate_does_not_call_pure_noise_a_signal() -> None:
    # The reverse control, and the reason the gate is worth running at all: a gate that certifies
    # noise as "not accidental" certifies nothing. Independent key state and omega must not reach
    # shuffle_alpha.
    rng = np.random.default_rng(31)
    frame = _table([_noise_window(80, rng) for _ in range(14)])

    (verdict,) = reliability_gate(frame, FAST_THRESHOLDS)

    assert verdict.verdict == "research_only"
    assert verdict.shuffle_p is not None and verdict.shuffle_p >= FAST_THRESHOLDS.shuffle_alpha
    assert "shuffle_p" in verdict.reason


def test_the_gate_does_detect_a_genuinely_coupled_signal() -> None:
    # The positive half of the same control: the noise result above must be a property of the data,
    # not of a gate that can never fire.
    rng = np.random.default_rng(32)
    frame = _table([_coupled_window(80, 6, noise=8.0, rng=rng) for _ in range(14)])

    (verdict,) = reliability_gate(frame, FAST_THRESHOLDS)

    assert verdict.shuffle_p is not None and verdict.shuffle_p < FAST_THRESHOLDS.shuffle_alpha
    assert verdict.verdict == "research_only"  # never better than research_only, however strong


def test_the_same_input_and_thresholds_reproduce_the_verdict_bit_for_bit() -> None:
    rng = np.random.default_rng(33)
    frame = _table([_coupled_window(80, 6, noise=20.0, rng=rng) for _ in range(12)])

    first = reliability_gate(frame, FAST_THRESHOLDS)
    second = reliability_gate(frame, FAST_THRESHOLDS)

    assert first == second


def test_a_session_verdict_does_not_depend_on_what_else_is_in_the_table() -> None:
    # Per-session RNG seeding (blake2b of the session label, not iteration order) means a session
    # can be re-run alone to reproduce exactly what the batch produced.
    rng = np.random.default_rng(34)
    left = _table([_coupled_window(80, 6, noise=20.0, rng=rng) for _ in range(12)], session="a")
    right = _table([_noise_window(80, rng) for _ in range(12)], session="b")

    pooled = reliability_gate(pd.concat([left, right], ignore_index=True), FAST_THRESHOLDS)
    alone = reliability_gate(left, FAST_THRESHOLDS)

    assert [v.session for v in pooled] == ["a", "b"]
    assert pooled[0] == alone[0]


def test_too_few_usable_peeks_is_blocked_by_data_and_not_a_weak_verdict() -> None:
    rng = np.random.default_rng(35)
    frame = _table([_coupled_window(80, 6, noise=8.0, rng=rng) for _ in range(9)])

    (verdict,) = reliability_gate(frame, FAST_THRESHOLDS)

    assert verdict.verdict == "blocked-by-data"
    assert verdict.reason == "insufficient_n"
    assert verdict.n == 9
    assert verdict.shuffle_p is None and verdict.ci_width is None


def test_flagged_peeks_do_not_enter_the_gate_denominator() -> None:
    # D-29.5: a row counts only when its value is finite *and* its flags are empty.
    rng = np.random.default_rng(36)
    good = [_coupled_window(80, 6, noise=8.0, rng=rng) for _ in range(11)]
    short = [_coupled_window(24, 6, noise=8.0, rng=rng) for _ in range(4)]
    frame = _table(good + short)

    (verdict,) = reliability_gate(frame, FAST_THRESHOLDS)

    assert len(frame) == 15
    assert verdict.n == 11


def test_the_verdict_reason_comes_from_a_closed_vocabulary() -> None:
    assert len(KNOWN_GATE_REASONS) == 9  # insufficient_n + all_criteria_passed + 7 failure subsets
    rng = np.random.default_rng(37)
    frames = [
        _table([_noise_window(80, rng) for _ in range(12)]),
        _table([_coupled_window(80, 6, noise=8.0, rng=rng) for _ in range(12)]),
        _table([_coupled_window(80, 6, noise=8.0, rng=rng) for _ in range(9)]),
    ]
    for frame in frames:
        for verdict in reliability_gate(frame, FAST_THRESHOLDS):
            assert verdict.reason in KNOWN_GATE_REASONS


def test_reliability_gate_requires_a_table_produced_by_xcorr_table() -> None:
    with pytest.raises(ValueError, match="session"):
        reliability_gate(pd.DataFrame({"peek_index": [0]}), FAST_THRESHOLDS)


def test_coach_report_is_unreachable_by_construction_not_by_convention() -> None:
    """T2 DoD 3, proven from the source rather than by sampling inputs.

    Two facts, both read off the AST: ``GateVerdict`` is constructed in exactly one place
    (``_gate_verdict``, which forwards its own ``verdict`` parameter), and every call to
    ``_gate_verdict`` passes a string literal from the two-value set below. Together they leave no
    input-dependent path to ``'coach_report'`` -- it survives only in the type annotation, which is
    what keeps the value available to a future ``gate-v2`` with a sample structure that could
    actually earn it (D-31.4's failure clause).
    """

    source = Path(__file__).resolve().parents[1] / "coupling.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))

    constructions = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "GateVerdict"
    ]
    assert len(constructions) == 1

    passed = [
        keyword.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "_gate_verdict"
        for keyword in node.keywords
        if keyword.arg == "verdict"
    ]
    assert passed, "no verdict= argument found -- this test has drifted from the code"
    for value in passed:
        assert isinstance(value, ast.Constant)
        assert value.value in {"research_only", "blocked-by-data"}


# --- key event cross-check --------------------------------------------------------------------


def _key_events(rows: list[tuple[float, str, bool]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "type": ["key"] * len(rows),
            "t": [t for t, _, _ in rows],
            "key": [key for _, key, _ in rows],
            "down": [down for _, _, down in rows],
        }
    )


def test_the_cross_check_matches_every_transition_to_its_event() -> None:
    ticks = _ticks([[], [], ["D"], ["D"], [], []])
    # The press is visible at tick 2, so its event lands just before that tick's timestamp.
    events = _key_events([(2 * DT_MS - 1.0, "D", True), (4 * DT_MS - 1.0, "D", False)])

    report = key_event_crosscheck(ticks, events)

    assert report["status"] == "agree"
    assert (report["n_tick_transitions"], report["n_key_events"], report["n_matched"]) == (2, 2, 2)
    assert report["max_abs_residual_ms"] <= report["tolerance_ms"]


def test_the_cross_check_reports_a_disagreement_instead_of_hiding_it() -> None:
    ticks = _ticks([[], [], ["D"], ["D"], [], []])
    events = _key_events([(2 * DT_MS - 1.0, "D", True)])  # the release event is missing

    report = key_event_crosscheck(ticks, events)

    assert report["status"] == "mismatch"
    assert report["n_unmatched_transitions"] == 1


def test_an_export_without_key_events_is_an_absent_witness_not_a_disagreement() -> None:
    # The `key` event stream is WP-29/T3 additive: older or opted-out exports simply have none.
    report = key_event_crosscheck(_ticks([[], ["D"], ["D"]]), _key_events([]))

    assert report["status"] == "no_key_events"
    assert report["n_key_events"] == 0
    assert report["n_matched"] == 0


def test_an_event_beyond_the_tolerance_does_not_match() -> None:
    ticks = _ticks([[], [], ["D"], ["D"]])
    events = _key_events([(2 * DT_MS - 5 * DT_MS, "D", True)])

    report = key_event_crosscheck(ticks, events, tolerance_ticks=1)

    assert report["status"] == "mismatch"
    assert report["n_unmatched_transitions"] == 1 and report["n_unmatched_events"] == 1
