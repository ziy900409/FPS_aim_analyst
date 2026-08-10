from __future__ import annotations

from dataclasses import FrozenInstanceError

import numpy as np
import pandas as pd
import pytest

from modules.metrics.algorithms.detect import DetectSample
from modules.metrics.algorithms.peek import PeekWindow
from modules.metrics.algorithms.phase import (
    DEFAULT_PHASE_PARAMS,
    KNOWN_PHASE_FLAGS,
    PHASE_VERSION,
    PhaseParams,
    _finalize,
    phase_decompose,
    phase_table,
    smooth_report_omega,
)
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements


_TICK_MS = 1000.0 / 128.0


def _peek(
    *,
    index: int = 0,
    side: str = "R",
    t_visible: float = 0.0,
    t_end: float = float("inf"),
    t_first_shot: float | None,
) -> PeekWindow:
    return PeekWindow(
        index=index,
        target_id="target-1",
        side=side,
        t_visible=t_visible,
        t_end=t_end,
        t_counter=None,
        counter_key=None,
        t_release=None,
        release_key=None,
        t_first_shot=t_first_shot,
        fires=(),
        t_hit=None,
        outcome="timeout" if t_first_shot is None else "hit",
        ads=False,
        flags=(),
        tick_slice=slice(0, 0),
    )


def _pulse_profile(length: int, pulses: tuple[tuple[int, int, float], ...]) -> np.ndarray:
    """Same shape as ``test_submovement.py``'s ``_profile`` (single/plus-one/plus-three cases)."""

    values = np.zeros(length, dtype=float)
    for start, end, amplitude in pulses:
        phase = np.linspace(0.0, np.pi, end - start + 1)
        values[start : end + 1] = np.maximum(values[start : end + 1], amplitude * np.sin(phase))
    values[0] = np.nan
    return values


def _window(length: int, omega: np.ndarray, t_first_shot_offset: int | None):
    tick_times = np.arange(length, dtype=float) * _TICK_MS
    ticks = pd.DataFrame({"t": tick_times})
    segments = segment_submovements(omega, SEG_V2_PARAMS)
    t_first_shot = None if t_first_shot_offset is None else tick_times[t_first_shot_offset]
    peek = _peek(t_visible=0.0, t_first_shot=t_first_shot)
    return peek, ticks, segments, tick_times


_PROFILES = {
    "single_flick": (48, ((10, 26, 720.0),)),
    "flick_plus_one_micro": (64, ((6, 20, 720.0), (34, 44, 360.0))),
    "flick_plus_three_micro": (
        88,
        ((4, 18, 720.0), (28, 38, 390.0), (48, 58, 360.0), (68, 78, 330.0)),
    ),
}


@pytest.mark.parametrize("name", sorted(_PROFILES))
@pytest.mark.parametrize("with_first_shot", [True, False], ids=["with-first-shot", "no-first-shot"])
def test_known_boundaries_reproduce_seg_v2_primary_flick_exactly(
    name: str, with_first_shot: bool
) -> None:
    """Six pre-registered synthetic cases (3 known submovement profiles x with/without a first
    shot): REC/MR/V boundaries must come verbatim from the seg-v2 primary_flick segment (D-30.1/C-D4),
    not a re-detected onset."""

    length, pulses = _PROFILES[name]
    omega = _pulse_profile(length, pulses)
    first_shot_offset = length - 1 if with_first_shot else None
    peek, ticks, segments, tick_times = _window(length, omega, first_shot_offset)
    primary = next(segment for segment in segments if segment.kind == "primary_flick")

    sample = phase_decompose(peek, omega, ticks, segments)

    assert tick_times[primary.start_idx] == sample.t_onset
    assert tick_times[primary.end_idx] == sample.t_mr_end
    assert sample.rec_ms == pytest.approx(sample.t_onset - peek.t_visible)
    assert sample.mr_ms == pytest.approx(sample.t_mr_end - sample.t_onset)
    assert sample.peak_omega_deg_s == pytest.approx(
        float(np.nanmax(omega[primary.start_idx : primary.end_idx + 1]))
    )
    if with_first_shot:
        assert sample.t_anchor == tick_times[first_shot_offset]
        assert sample.v_ms == pytest.approx(sample.t_anchor - sample.t_mr_end)
        assert "no_first_shot" not in sample.flags
    else:
        assert sample.t_anchor is None
        assert sample.v_ms is None
        assert "no_first_shot" in sample.flags
    assert "anchor_before_onset" not in sample.flags
    assert "window_too_short" not in sample.flags
    assert "no_primary_flick" not in sample.flags


def test_window_too_short_yields_no_measurement() -> None:
    length = 10  # below DEFAULT_PHASE_PARAMS.min_window_ticks (30)
    omega = _pulse_profile(length, ((2, 6, 500.0),))
    peek, ticks, segments, _ = _window(length, omega, t_first_shot_offset=length - 1)

    sample = phase_decompose(peek, omega, ticks, segments)

    assert sample.flags == ("window_too_short",)
    assert sample.t_onset is None
    assert sample.t_mr_end is None
    assert sample.t_anchor is None
    assert sample.rec_ms is None
    assert sample.mr_ms is None
    assert sample.v_ms is None
    assert sample.peak_omega_deg_s is None
    assert sample.rec_minus_detect_ms is None


def test_no_primary_flick_leaves_all_three_phases_undefined() -> None:
    length = 40
    omega = np.zeros(length, dtype=float)
    omega[0] = np.nan
    segments = segment_submovements(omega, SEG_V2_PARAMS)
    assert segments == []  # zero motion -> no segments at all
    peek, ticks, _, _ = _window(length, omega, t_first_shot_offset=length - 1)

    sample = phase_decompose(peek, omega, ticks, segments)

    assert sample.flags == ("no_primary_flick",)
    assert sample.t_onset is None
    assert sample.mr_ms is None
    assert sample.v_ms is None


def test_no_first_shot_leaves_v_undefined_but_keeps_rec_and_mr() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek, ticks, segments, tick_times = _window(length, omega, t_first_shot_offset=None)

    sample = phase_decompose(peek, omega, ticks, segments)

    assert "no_first_shot" in sample.flags
    assert sample.t_anchor is None
    assert sample.v_ms is None
    assert sample.rec_ms is not None
    assert sample.mr_ms is not None


def test_anchor_before_mr_end_nulls_all_three_durations_without_going_negative() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    segments = segment_submovements(omega, SEG_V2_PARAMS)
    primary = next(segment for segment in segments if segment.kind == "primary_flick")
    tick_times = np.arange(length, dtype=float) * _TICK_MS
    ticks = pd.DataFrame({"t": tick_times})
    # Fired mid-flick: strictly before the MR segment's own end.
    mid_mr_offset = (primary.start_idx + primary.end_idx) // 2
    peek = _peek(t_visible=0.0, t_first_shot=tick_times[mid_mr_offset])

    sample = phase_decompose(peek, omega, ticks, segments)

    assert "anchor_before_onset" in sample.flags
    assert sample.rec_ms is None
    assert sample.mr_ms is None
    assert sample.v_ms is None
    # Raw timestamps are retained for diagnostics even though durations are nulled.
    assert sample.t_onset == tick_times[primary.start_idx]
    assert sample.t_mr_end == tick_times[primary.end_idx]
    assert sample.t_anchor == tick_times[mid_mr_offset]


def test_non_uniform_dt_is_flagged_but_does_not_null_the_computed_phases() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    segments = segment_submovements(omega, SEG_V2_PARAMS)
    tick_times = np.arange(length, dtype=float) * _TICK_MS
    tick_times[-1] += 50.0  # one dropped-tick-sized gap at the tail
    ticks = pd.DataFrame({"t": tick_times})
    peek = _peek(t_visible=0.0, t_first_shot=tick_times[-1])

    sample = phase_decompose(peek, omega, ticks, segments)

    assert "non_uniform_dt" in sample.flags
    assert sample.rec_ms is not None
    assert sample.mr_ms is not None
    assert sample.v_ms is not None


def test_cutoff_at_or_above_nyquist_flags_filter_degenerate_without_raising() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek, ticks, segments, _ = _window(length, omega, t_first_shot_offset=length - 1)
    bad_params = PhaseParams(cutoff_hz=70.0, butter_order=4, min_window_ticks=30)  # Nyquist = 64 Hz

    sample = phase_decompose(peek, omega, ticks, segments, bad_params)

    assert "filter_degenerate" in sample.flags
    # The degenerate smoothing path must not affect boundary-derived fields.
    assert sample.rec_ms is not None
    assert sample.mr_ms is not None


def test_too_few_samples_for_filtfilt_flags_filter_degenerate_without_raising() -> None:
    length, pulses = _PROFILES["single_flick"]  # 48 samples, 47 after dropping the leading nan
    omega = _pulse_profile(length, pulses)
    peek, ticks, segments, _ = _window(length, omega, t_first_shot_offset=length - 1)
    # order=20 -> padlen = 3 * 21 = 63 > 47 available samples.
    bad_params = PhaseParams(cutoff_hz=12.0, butter_order=20, min_window_ticks=30)

    sample = phase_decompose(peek, omega, ticks, segments, bad_params)

    assert "filter_degenerate" in sample.flags


def test_smooth_report_omega_falls_back_to_unfiltered_tail_when_degenerate() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    tick_times = np.arange(length, dtype=float) * _TICK_MS
    bad_params = PhaseParams(cutoff_hz=70.0, butter_order=4, min_window_ticks=30)

    values, degenerate = smooth_report_omega(omega, tick_times, bad_params)

    assert degenerate is True
    assert np.array_equal(values, omega[1:], equal_nan=True)


def test_rec_minus_detect_ms_uses_rec_end_not_a_new_boundary() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek, ticks, segments, tick_times = _window(length, omega, t_first_shot_offset=length - 1)
    primary = next(segment for segment in segments if segment.kind == "primary_flick")
    detect = DetectSample(
        peek_index=0,
        t_detect=tick_times[primary.start_idx] - _TICK_MS,
        status="detected",
        eccentricity_at_spawn_deg=5.0,
        baseline_insufficient=False,
        anticipation=False,
    )

    sample = phase_decompose(peek, omega, ticks, segments, detect=detect)

    assert sample.t_detect == detect.t_detect
    assert sample.rec_minus_detect_ms == pytest.approx(sample.t_onset - detect.t_detect)


def test_rec_minus_detect_ms_is_none_on_timeout() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek, ticks, segments, _ = _window(length, omega, t_first_shot_offset=length - 1)
    detect = DetectSample(
        peek_index=0,
        t_detect=None,
        status="timeout",
        eccentricity_at_spawn_deg=5.0,
        baseline_insufficient=False,
        anticipation=False,
    )

    sample = phase_decompose(peek, omega, ticks, segments, detect=detect)

    assert sample.t_detect is None
    assert sample.rec_minus_detect_ms is None


def test_phase_table_batches_rows_in_order() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek_a, ticks_a, segments_a, _ = _window(length, omega, t_first_shot_offset=length - 1)
    peek_b = _peek(index=1, t_first_shot=None)

    table = phase_table(
        [peek_a, peek_b],
        [omega, omega],
        [ticks_a, ticks_a],
        [segments_a, segments_a],
    )

    assert list(table["peek_index"]) == [0, 1]
    assert table.loc[1, "flags"] == ("no_first_shot",)


def test_finalize_rejects_unknown_flags() -> None:
    length, pulses = _PROFILES["single_flick"]
    omega = _pulse_profile(length, pulses)
    peek, _, _, _ = _window(length, omega, t_first_shot_offset=None)

    with pytest.raises(AssertionError):
        _finalize(peek, flags=("not_a_real_flag",))


def test_known_phase_flags_is_the_pre_registered_closed_vocabulary() -> None:
    assert KNOWN_PHASE_FLAGS == frozenset(
        {
            "window_too_short",
            "no_primary_flick",
            "no_first_shot",
            "filter_degenerate",
            "anchor_before_onset",
            "non_uniform_dt",
        }
    )


def test_phase_params_are_frozen_and_versioned() -> None:
    assert DEFAULT_PHASE_PARAMS.version == PHASE_VERSION == "phase-v1"
    with pytest.raises(FrozenInstanceError):
        DEFAULT_PHASE_PARAMS.cutoff_hz = 1.0  # type: ignore[misc]


@pytest.mark.parametrize(
    "overrides",
    [
        {"cutoff_hz": 0.0},
        {"cutoff_hz": float("nan")},
        {"butter_order": 0},
        {"min_window_ticks": 0},
        {"version": ""},
    ],
)
def test_phase_params_reject_invalid_contracts(overrides: dict[str, object]) -> None:
    values = {"cutoff_hz": 12.0, "butter_order": 4, "min_window_ticks": 30, "version": "phase-test"}
    values.update(overrides)

    with pytest.raises(ValueError):
        PhaseParams(**values)  # type: ignore[arg-type]
