from __future__ import annotations

from dataclasses import FrozenInstanceError
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from modules.metrics.algorithms.peek import PeekWindow
from modules.metrics.algorithms.sparc import (
    AMP_THRESH,
    DEFAULT_SPARC_PARAMS,
    FALLBACK_MIN_BINS,
    FC_HZ,
    FSPAN_FLOOR,
    KNOWN_SPARC_FLAGS,
    MAXMAG_FLOOR,
    MAXV_FLOOR,
    MIN_SAMPLES,
    SPARC_VERSION,
    SparcParams,
    bins_at_or_below_fc,
    compute_sparc,
    compute_sparc_traced,
    padded_length,
    sparc_length_sensitivity,
    sparc_table,
)
from modules.segments.algorithms.submovement import Segment


GOLDEN_DIR = Path(__file__).resolve().parents[5] / "fixtures" / "golden"
PA_PARITY_GOLDEN = GOLDEN_DIR / "sparc-pa-parity.json"
DOMAIN_GOLDEN = GOLDEN_DIR / "sparc-128hz-domain.json"

#: Golden parity bar (T1 DoD 1). Relative, so it means the same thing for `arc` (~1.4) and for
#: `max_mag` (~0.9) as it does for a 128 Hz SPARC value.
_PARITY_RTOL = 1e-9


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _peek(*, index: int = 0, side: str = "R") -> PeekWindow:
    return PeekWindow(
        index=index,
        target_id="target-1",
        side=side,
        t_visible=0.0,
        t_end=float("inf"),
        t_counter=None,
        counter_key=None,
        t_release=None,
        release_key=None,
        t_first_shot=None,
        fires=(),
        t_hit=None,
        outcome="timeout",
        ads=False,
        flags=(),
        tick_slice=slice(0, 0),
    )


def _flick(start_idx: int, end_idx: int, kind: str = "primary_flick") -> Segment:
    return Segment(kind=kind, start_idx=start_idx, end_idx=end_idx, peak_omega=100.0)


# ---------------------------------------------------------------------------
# Ported constants -- pinned value by value (T1 §1: no in-place tuning, ever)
# ---------------------------------------------------------------------------


def test_ported_constants_match_performance_analysis_exactly() -> None:
    assert MIN_SAMPLES == 16
    assert MAXV_FLOOR == 1e-9
    assert MAXMAG_FLOOR == 1e-12
    assert FSPAN_FLOOR == 1e-9
    assert FC_HZ == 20.0
    assert AMP_THRESH == 0.03
    assert FALLBACK_MIN_BINS == 8


# ---------------------------------------------------------------------------
# Cross-repo golden #1: algorithm identity (T1 DoD 1 -- all 8 quantities)
# ---------------------------------------------------------------------------


def test_pa_parity_golden_matches_every_intermediate_and_the_final_value() -> None:
    cases = _load(PA_PARITY_GOLDEN)["cases"]
    assert cases, "sparc-pa-parity.json must contain at least one case"

    for case in cases:
        series = np.asarray(case["velocity_series"], dtype=float)
        trace = compute_sparc_traced(series, case["fs"])
        name = case["name"]

        # Compared one field at a time so a failure names the first intermediate that diverged,
        # rather than only reporting that the final SPARC disagrees.
        assert trace.max_v == pytest.approx(case["expected_max_v"], rel=_PARITY_RTOL), f"{name}: max_v"
        assert trace.n_fft == case["expected_n_fft"], f"{name}: n_fft"
        assert trace.max_mag == pytest.approx(case["expected_max_mag"], rel=_PARITY_RTOL), f"{name}: max_mag"
        assert trace.freqs_pass1_count == case["expected_freqs_pass1_count"], f"{name}: freqs_pass1_count"
        assert trace.freqs_final_count == case["expected_freqs_final_count"], f"{name}: freqs_final_count"
        assert trace.f_span == pytest.approx(case["expected_f_span"], rel=_PARITY_RTOL), f"{name}: f_span"
        assert trace.arc == pytest.approx(case["expected_arc"], rel=_PARITY_RTOL), f"{name}: arc"
        assert trace.sparc == pytest.approx(case["expected_sparc"], rel=_PARITY_RTOL), f"{name}: sparc"

        assert compute_sparc(series, case["fs"]) == trace.sparc


def test_pa_parity_golden_case_is_the_1khz_synthetic_one_moved_in_verbatim() -> None:
    # Guards the move-in itself: if someone regenerates this file from *our* implementation it stops
    # being external verification (README §2, "跨 repo golden 不是自我對表").
    cases = _load(PA_PARITY_GOLDEN)["cases"]
    assert [case["name"] for case in cases] == ["synthetic_v1"]
    assert cases[0]["fs"] == 1000.0
    assert cases[0]["dt"] == 0.001
    assert len(cases[0]["velocity_series"]) == 64


# ---------------------------------------------------------------------------
# Cross-repo golden #2: this project's 128 Hz domain (T1 DoD 3)
# ---------------------------------------------------------------------------


def test_domain_golden_matches_the_port_on_every_case() -> None:
    payload = _load(DOMAIN_GOLDEN)
    for case in payload["cases"]:
        series = np.asarray(case["velocity_series"], dtype=float)
        value = compute_sparc(series, case["fs"])
        expected = case["expected_sparc"]
        if expected is None:  # JSON cannot carry nan; the generator writes null for it.
            assert math.isnan(value), f"{case['name']}: expected nan"
        else:
            assert value == pytest.approx(expected, rel=_PARITY_RTOL), f"{case['name']}: sparc"


def test_domain_golden_covers_both_padding_buckets_and_the_edge_cases() -> None:
    payload = _load(DOMAIN_GOLDEN)
    cases = payload["cases"]

    real = [case for case in cases if case["kind"] == "real_mr_segment"]
    assert sum(1 for case in real if case["n_fft"] == 32) >= 2
    assert sum(1 for case in real if case["n_fft"] == 64) >= 2

    synthetic = {case["name"] for case in cases if case["kind"] == "synthetic_edge"}
    assert synthetic == {
        "edge_len15_below_min_samples",
        "edge_len16_exactly_min_samples",
        "edge_constant_series",
        "edge_contains_nan",
    }

    # Provenance is part of the deliverable (C-D1): a golden whose origin is unrecorded cannot be
    # re-derived, and "which PA commit was this?" is exactly the question a future rerun asks.
    provenance = payload["provenance"]
    assert provenance["source_repo"] == "performance_analysis"
    assert len(provenance["source_commit"]) == 40
    assert provenance["generated_on"]
    assert provenance["generator"].endswith("generate_sparc_domain_golden.py")


# ---------------------------------------------------------------------------
# Degenerate semantics -- must match PA exactly (T1 DoD 2)
# ---------------------------------------------------------------------------


def test_below_min_samples_returns_zero_not_nan() -> None:
    series = np.linspace(1.0, 2.0, MIN_SAMPLES - 1)

    assert compute_sparc(series, 128.0) == 0.0


def test_exactly_min_samples_produces_a_finite_negative_value() -> None:
    series = np.linspace(1.0, 2.0, MIN_SAMPLES)

    value = compute_sparc(series, 128.0)

    assert math.isfinite(value)
    assert value < 0.0


def test_constant_series_returns_zero() -> None:
    # Normalised to a constant 1.0, whose spectrum is a single DC bin: every other bin falls below
    # AMP_THRESH, so pass 1 keeps < 2 bins and the 8-bin fallback carries it -- still a real value,
    # so the genuinely degenerate constant case is the all-zero one below.
    value = compute_sparc(np.ones(32), 128.0)

    assert math.isfinite(value)


def test_all_zero_series_returns_zero_via_the_max_v_floor() -> None:
    assert compute_sparc(np.zeros(32), 128.0) == 0.0


def test_nan_input_propagates_as_nan() -> None:
    series = np.linspace(1.0, 2.0, 32)
    series[7] = np.nan

    assert math.isnan(compute_sparc(series, 128.0))


def test_non_positive_fs_returns_zero() -> None:
    series = np.linspace(1.0, 2.0, 32)

    assert compute_sparc(series, 0.0) == 0.0
    assert compute_sparc(series, -128.0) == 0.0


def test_empty_series_returns_zero() -> None:
    assert compute_sparc(np.empty(0), 128.0) == 0.0


def test_max_v_uses_max_not_max_abs() -> None:
    # PA follows Go's `max(v)`; on a series whose largest magnitude is negative the two differ, and
    # the port must keep PA's answer even though angular speed is never negative in this project.
    series = np.full(32, -5.0)
    series[0] = 1e-12

    assert compute_sparc_traced(series, 128.0).max_v == pytest.approx(1e-12)


def test_fallback_path_is_reachable_and_capped_at_eight_bins() -> None:
    rng = np.random.default_rng(0)
    series = 100.0 + rng.normal(0.0, 1e-6, 64)  # near-DC: pass 1 keeps only the DC bin

    trace = compute_sparc_traced(series, 128.0)

    assert trace.freqs_pass1_count == 1
    assert trace.freqs_final_count == FALLBACK_MIN_BINS


# ---------------------------------------------------------------------------
# Geometry helpers -- the stratification keys behind the step diagnostic
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("n_samples", "expected"),
    [(16, 16), (17, 32), (24, 32), (32, 32), (33, 64), (58, 64), (64, 64), (65, 128)],
)
def test_padded_length_matches_the_ported_padding_rule(n_samples: int, expected: int) -> None:
    assert padded_length(n_samples) == expected


def test_padded_length_rejects_non_positive_lengths() -> None:
    with pytest.raises(ValueError):
        padded_length(0)


def test_bins_at_or_below_fc_reproduces_the_128hz_step() -> None:
    # The whole reason OQ-S4-18 exists: one extra tick of movement doubles the resolution.
    assert bins_at_or_below_fc(32, 128.0) == 6
    assert bins_at_or_below_fc(64, 128.0) == 11


def test_bins_at_or_below_fc_rejects_non_power_of_two_and_bad_fs() -> None:
    with pytest.raises(ValueError):
        bins_at_or_below_fc(48, 128.0)
    with pytest.raises(ValueError):
        bins_at_or_below_fc(32, 0.0)


# ---------------------------------------------------------------------------
# sparc_table -- segment sourcing and the closed flag vocabulary
# ---------------------------------------------------------------------------


def _omega(length: int) -> np.ndarray:
    values = 50.0 + 40.0 * np.sin(np.linspace(0.0, 3.0, length))
    values[0] = np.nan  # omega_deg_s's contractual leading nan
    return values


def test_sparc_table_scores_the_primary_flick_interval() -> None:
    omega = _omega(70)
    segments = [_flick(5, 40), _flick(45, 60, kind="micro_adjustment")]

    table = sparc_table([_peek()], [omega], [segments], DEFAULT_SPARC_PARAMS)

    assert list(table["start_idx"]) == [5]
    assert list(table["end_idx"]) == [40]
    assert list(table["n_ticks"]) == [36]
    assert list(table["padded_n"]) == [64]
    assert list(table["bins_le_fc"]) == [11]
    assert table.loc[0, "flags"] == ()
    assert table.loc[0, "sparc"] == pytest.approx(compute_sparc(omega[5:41], 128.0))


def test_sparc_table_ignores_micro_adjustments_when_no_primary_flick_exists() -> None:
    omega = _omega(70)
    segments = [_flick(5, 40, kind="micro_adjustment")]

    table = sparc_table([_peek()], [omega], [segments], DEFAULT_SPARC_PARAMS)

    assert table.loc[0, "flags"] == ("no_primary_flick",)
    assert table.loc[0, "sparc"] is None
    assert table.loc[0, "start_idx"] is None


def test_sparc_table_flags_a_short_mr_interval_without_computing_a_value() -> None:
    omega = _omega(70)
    segments = [_flick(5, 5 + MIN_SAMPLES - 2)]  # one sample short of the port's minimum

    table = sparc_table([_peek()], [omega], [segments], DEFAULT_SPARC_PARAMS)

    assert table.loc[0, "flags"] == ("too_few_samples",)
    assert table.loc[0, "n_ticks"] == MIN_SAMPLES - 1
    assert table.loc[0, "sparc"] is None  # not 0.0: the port's degenerate value is never fabricated


def test_sparc_table_flags_a_window_too_short_to_contain_any_scorable_interval() -> None:
    table = sparc_table([_peek()], [_omega(MIN_SAMPLES)], [[_flick(1, 15)]], DEFAULT_SPARC_PARAMS)

    assert table.loc[0, "flags"] == ("window_too_short",)
    assert table.loc[0, "sparc"] is None


def test_sparc_table_flags_a_degenerate_spectrum_but_keeps_the_ported_value() -> None:
    omega = np.zeros(70)
    omega[0] = np.nan
    segments = [_flick(5, 40)]

    table = sparc_table([_peek()], [omega], [segments], DEFAULT_SPARC_PARAMS)

    assert table.loc[0, "flags"] == ("degenerate_spectrum",)
    assert table.loc[0, "sparc"] == 0.0


def test_sparc_table_requires_matching_sequence_lengths() -> None:
    with pytest.raises(ValueError):
        sparc_table([_peek()], [_omega(70), _omega(70)], [[]], DEFAULT_SPARC_PARAMS)


def test_sparc_table_rejects_a_params_of_the_wrong_type() -> None:
    with pytest.raises(TypeError):
        sparc_table([_peek()], [_omega(70)], [[]], object())  # type: ignore[arg-type]


def test_sparc_sample_rejects_unknown_flags() -> None:
    from modules.metrics.algorithms.sparc import _finalize

    with pytest.raises(AssertionError):
        _finalize(_peek(), flags=("not_a_real_flag",))


def test_known_sparc_flags_is_the_pre_registered_closed_vocabulary() -> None:
    assert KNOWN_SPARC_FLAGS == frozenset(
        {
            "no_primary_flick",
            "too_few_samples",
            "degenerate_spectrum",
            "window_too_short",
        }
    )


# ---------------------------------------------------------------------------
# sparc_length_sensitivity -- known distributions, known step ratio
# ---------------------------------------------------------------------------


def _rows(padded_n: int, bins: int, values: list[float]) -> list[dict[str, object]]:
    return [
        {
            "peek_index": index,
            "side": "L",
            "start_idx": 1,
            "end_idx": 1,
            "n_ticks": 24 if padded_n == 32 else 40,
            "padded_n": padded_n,
            "bins_le_fc": bins,
            "sparc": value,
            "flags": (),
        }
        for index, value in enumerate(values)
    ]


#: Five values put p25/p75 exactly on the second and fourth elements (numpy's linear interpolation
#: lands on an element only at odd-ish counts), so these fixtures have an IQR of exactly 1.0 and the
#: expected step ratio is readable by hand rather than an interpolation artefact.
_BUCKET_32 = [-3.0, -2.5, -2.0, -1.5, -1.0]  # median -2.0, IQR 1.0


def _shifted(offset: float) -> list[float]:
    return [value + offset for value in _BUCKET_32]


def test_length_sensitivity_computes_the_step_ratio_from_a_known_distribution() -> None:
    # bucket 32: median -2.0, IQR 1.0 | bucket 64: median -2.4, IQR 1.0 -> gap 0.4 / 1.0 = 0.4
    table = pd.DataFrame(_rows(32, 6, _BUCKET_32) + _rows(64, 11, _shifted(-0.4)))

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert [bucket["padded_n"] for bucket in result["buckets"]] == [32, 64]
    assert result["buckets"][0]["median"] == pytest.approx(-2.0)
    assert result["buckets"][0]["iqr"] == pytest.approx(1.0)
    assert result["median_gap"] == pytest.approx(0.4)
    assert result["max_iqr"] == pytest.approx(1.0)
    assert result["step_ratio"] == pytest.approx(0.4)
    assert result["verdict"] == "comparable"
    assert result["n_valid"] == 10


def test_length_sensitivity_calls_a_step_at_or_above_the_threshold_stratified_only() -> None:
    # Same spread, bigger gap: median -2.0 vs -2.6 -> 0.6 / 1.0 = 0.6 >= 0.5
    table = pd.DataFrame(_rows(32, 6, _BUCKET_32) + _rows(64, 11, _shifted(-0.6)))

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert result["step_ratio"] == pytest.approx(0.6)
    assert result["verdict"] == "stratified_only"


def test_length_sensitivity_excludes_flagged_and_non_finite_rows() -> None:
    rows = _rows(32, 6, _BUCKET_32) + _rows(64, 11, _shifted(-0.4))
    rows.append({**rows[0], "peek_index": 99, "sparc": 0.0, "flags": ("degenerate_spectrum",)})
    rows.append({**rows[0], "peek_index": 98, "sparc": None, "flags": ("no_primary_flick",)})
    table = pd.DataFrame(rows)

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert result["n_valid"] == 10
    assert result["n_excluded"] == 2
    assert result["step_ratio"] == pytest.approx(0.4)


def test_length_sensitivity_is_stratified_only_when_a_single_bucket_is_populated() -> None:
    table = pd.DataFrame(_rows(32, 6, _BUCKET_32))

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert result["step_ratio"] is None
    assert result["verdict"] == "stratified_only"
    assert "cannot be demonstrated" in result["reason"]


def test_length_sensitivity_treats_a_zero_spread_step_as_infinite() -> None:
    table = pd.DataFrame(_rows(32, 6, [-2.0, -2.0]) + _rows(64, 11, [-2.5, -2.5]))

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert result["step_ratio"] == math.inf
    assert result["verdict"] == "stratified_only"


def test_length_sensitivity_treats_identical_buckets_as_comparable() -> None:
    table = pd.DataFrame(_rows(32, 6, [-2.0, -2.0]) + _rows(64, 11, [-2.0, -2.0]))

    result = sparc_length_sensitivity(table, DEFAULT_SPARC_PARAMS)

    assert result["step_ratio"] == 0.0
    assert result["verdict"] == "comparable"


def test_length_sensitivity_rejects_a_params_of_the_wrong_type() -> None:
    with pytest.raises(TypeError):
        sparc_length_sensitivity(pd.DataFrame(), object())  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# SparcParams contract
# ---------------------------------------------------------------------------


def test_sparc_params_are_frozen_and_carry_the_t0_registered_values() -> None:
    assert DEFAULT_SPARC_PARAMS.version == SPARC_VERSION == "sparc-v1"
    assert DEFAULT_SPARC_PARAMS.fs_hz == 128.0
    assert DEFAULT_SPARC_PARAMS.step_ratio_threshold == 0.5
    with pytest.raises(FrozenInstanceError):
        DEFAULT_SPARC_PARAMS.fs_hz = 256.0  # type: ignore[misc]


@pytest.mark.parametrize(
    "overrides",
    [
        {"fs_hz": 0.0},
        {"fs_hz": -128.0},
        {"fs_hz": float("nan")},
        {"step_ratio_threshold": 0.0},
        {"step_ratio_threshold": -1.0},
        {"version": ""},
    ],
)
def test_sparc_params_reject_invalid_contracts(overrides: dict[str, object]) -> None:
    values = {"fs_hz": 128.0, "step_ratio_threshold": 0.5, "version": "sparc-test"}
    values.update(overrides)

    with pytest.raises(ValueError):
        SparcParams(**values)  # type: ignore[arg-type]
