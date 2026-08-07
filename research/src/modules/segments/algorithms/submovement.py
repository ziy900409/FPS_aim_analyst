"""Submovement segmentation for 128 Hz angular-speed traces."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
import math
from typing import Literal

import numpy as np
from scipy.signal import find_peaks

from shared.filters import sg_filter


SegmentKind = Literal["primary_flick", "micro_adjustment"]


def _finite_non_negative(value: float, name: str) -> None:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ValueError(f"{name} must be a finite non-negative number")


def _finite_positive(value: float, name: str) -> None:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value <= 0
    ):
        raise ValueError(f"{name} must be a positive finite number")


def _ratio(value: float, name: str) -> None:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or not 0 <= value < 1
    ):
        raise ValueError(f"{name} must be a finite ratio in [0, 1)")


@dataclass(frozen=True)
class SegmentParams:
    """Pre-registered segmentation parameters; changes require a new version."""

    sg_window: int
    sg_poly: int
    peak_sigma_k: float
    peak_floor_deg_s: float
    low_ratio: float
    stop_ratio: float
    version: str

    def __post_init__(self) -> None:
        if (
            isinstance(self.sg_window, bool)
            or not isinstance(self.sg_window, int)
            or self.sg_window <= 0
            or self.sg_window % 2 == 0
        ):
            raise ValueError("sg_window must be a positive odd integer")
        if (
            isinstance(self.sg_poly, bool)
            or not isinstance(self.sg_poly, int)
            or self.sg_poly < 0
            or self.sg_poly >= self.sg_window
        ):
            raise ValueError("sg_poly must be a non-negative integer less than sg_window")
        _finite_non_negative(self.peak_sigma_k, "peak_sigma_k")
        _finite_positive(self.peak_floor_deg_s, "peak_floor_deg_s")
        _ratio(self.low_ratio, "low_ratio")
        _ratio(self.stop_ratio, "stop_ratio")
        if self.low_ratio > self.stop_ratio:
            raise ValueError("low_ratio must be less than or equal to stop_ratio")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


@dataclass(frozen=True)
class Segment:
    """One inclusive submovement interval."""

    kind: SegmentKind
    start_idx: int
    end_idx: int
    peak_omega: float
    flags: tuple[str, ...] = ()
    peek_index: int | None = None

    def __post_init__(self) -> None:
        if self.kind not in ("primary_flick", "micro_adjustment"):
            raise ValueError(f"unsupported segment kind: {self.kind!r}")
        if self.start_idx < 0 or self.end_idx < self.start_idx:
            raise ValueError("segment indices must satisfy 0 <= start_idx <= end_idx")
        if not math.isfinite(self.peak_omega) or self.peak_omega < 0:
            raise ValueError("peak_omega must be finite and non-negative")
        if not isinstance(self.flags, tuple) or not all(isinstance(flag, str) for flag in self.flags):
            raise ValueError("flags must be a tuple of strings")
        if self.peek_index is not None and (
            isinstance(self.peek_index, bool)
            or not isinstance(self.peek_index, int)
            or self.peek_index < 0
        ):
            raise ValueError("peek_index must be a non-negative integer or None")


class SegmentList(list[Segment]):
    """List-compatible result carrying flags when no segment can hold them."""

    def __init__(
        self,
        segments: Iterable[Segment] = (),
        *,
        flags: Sequence[str] = (),
    ) -> None:
        super().__init__(segments)
        self.flags = tuple(dict.fromkeys(flags))


DEFAULT_SEGMENT_PARAMS = SegmentParams(
    sg_window=7,
    sg_poly=3,
    peak_sigma_k=0.5,
    peak_floor_deg_s=80.0,
    low_ratio=0.1,
    stop_ratio=0.2,
    version="seg-v1",
)

#: KI-005-A / A2-T3 (2026-08-07): re-swept once real tick-integral omega was available (three
#: A2-T1 captures) in addition to the original synthetic boundary cases -- the sg_window=7
#: ceiling in ``seg-v1`` predates KI-005 and was never validated against real data because real
#: exports were always beat-aliasing-contaminated at the time. ``seg-v2`` widens the
#: Savitzky-Golay window now that the 8-tick beat no longer applies, cutting the real-data
#: ``merged_adjacent_peaks`` ratio from 60% (seg-v1) to 38% while holding the same 98.3% success
#: rate and passing every seg-v1 synthetic boundary case (max error <=2 ticks). Segment
#: boundaries are unaffected -- only which segments get flagged as merged adjacent peaks
#: changes (verified by direct overlay comparison, not just aggregate counts).
#: ``seg-v1`` remains frozen and in use for pre-KI-005 exports that only carry
#: ``aim-diff-legacy`` omega (D-28.7: versions are additive, never edited in place).
SEG_V2_PARAMS = SegmentParams(
    sg_window=11,
    sg_poly=3,
    peak_sigma_k=0.75,
    peak_floor_deg_s=60.0,
    low_ratio=0.1,
    stop_ratio=0.2,
    version="seg-v2",
)


@dataclass
class _Candidate:
    start_idx: int
    end_idx: int
    peak_omega: float
    flags: set[str]


def segment_submovements(
    omega: Sequence[float] | np.ndarray,
    params: SegmentParams = DEFAULT_SEGMENT_PARAMS,
) -> list[Segment]:
    """Segment an angular-speed trace into one primary flick and later adjustments.

    The peak gate is ``max(mean + k * std, floor)``. Inclusive boundaries are
    the first samples at or below ``low_ratio * peak`` before the peak and
    ``stop_ratio * peak`` after it. Overlapping peak intervals are merged to
    prevent tightly adjacent peaks from becoming artificial fragments.

    The returned object is list-compatible. Its ``flags`` attribute carries
    trace-level outcomes such as ``zero_motion`` or ``no_peak`` when the list is
    empty and no :class:`Segment` exists on which to store those flags.
    """

    if not isinstance(params, SegmentParams):
        raise TypeError("params must be a SegmentParams instance")
    values = np.asarray(omega, dtype=float)
    if values.ndim != 1:
        raise ValueError("omega must be a one-dimensional signal")
    if values.size == 0:
        return SegmentList(flags=("empty_signal",))

    clean, trace_flags = _prepare_signal(values)
    if not np.any(clean > 0):
        return SegmentList(flags=(*trace_flags, "zero_motion", "below_floor"))

    if clean.size < params.sg_window:
        smoothed = clean
        trace_flags.append("sg_fallback_short_signal")
    else:
        smoothed = sg_filter(clean, params.sg_window, params.sg_poly)
    smoothed = np.clip(smoothed, 0.0, None)

    threshold = max(
        float(np.mean(smoothed) + params.peak_sigma_k * np.std(smoothed)),
        params.peak_floor_deg_s,
    )
    all_peak_indices, _ = find_peaks(smoothed)
    peak_indices = [index for index in all_peak_indices if smoothed[index] >= threshold]
    if not peak_indices:
        outcome = "below_floor" if float(np.max(smoothed)) < params.peak_floor_deg_s else "no_peak"
        return SegmentList(flags=(*trace_flags, outcome))

    candidates = [_candidate(smoothed, int(index), trace_flags, params) for index in peak_indices]
    merged = _merge_overlapping(candidates)
    segments = [
        Segment(
            kind="primary_flick" if index == 0 else "micro_adjustment",
            start_idx=candidate.start_idx,
            end_idx=candidate.end_idx,
            peak_omega=candidate.peak_omega,
            flags=tuple(sorted(candidate.flags)),
        )
        for index, candidate in enumerate(merged)
    ]
    return SegmentList(segments, flags=trace_flags)


def _prepare_signal(values: np.ndarray) -> tuple[np.ndarray, list[str]]:
    finite = np.isfinite(values)
    if not np.any(finite):
        return np.zeros_like(values), ["non_finite_replaced"]
    if np.all(finite):
        return values.astype(float, copy=True), []

    indices = np.arange(values.size)
    clean = np.interp(indices, indices[finite], values[finite])
    first_finite = int(indices[finite][0])
    last_finite = int(indices[finite][-1])
    clean[:first_finite] = 0.0
    clean[last_finite + 1 :] = 0.0
    clean = np.clip(clean, 0.0, None)
    return clean, ["non_finite_interpolated"]


def _candidate(
    smoothed: np.ndarray,
    peak_idx: int,
    trace_flags: Sequence[str],
    params: SegmentParams,
) -> _Candidate:
    peak_omega = float(smoothed[peak_idx])
    flags = set(trace_flags)
    start = peak_idx
    low_threshold = params.low_ratio * peak_omega
    while start > 0 and smoothed[start] > low_threshold:
        start -= 1
    if start == 0 and smoothed[start] > low_threshold:
        flags.add("truncated_at_window_edge")

    end = peak_idx
    stop_threshold = params.stop_ratio * peak_omega
    last = len(smoothed) - 1
    while end < last and smoothed[end] > stop_threshold:
        end += 1
    if end == last and smoothed[end] > stop_threshold:
        flags.add("truncated_at_window_edge")

    return _Candidate(start, end, peak_omega, flags)


def _merge_overlapping(candidates: Sequence[_Candidate]) -> list[_Candidate]:
    merged: list[_Candidate] = []
    for candidate in candidates:
        if not merged or candidate.start_idx > merged[-1].end_idx:
            merged.append(candidate)
            continue

        prior = merged[-1]
        prior.end_idx = max(prior.end_idx, candidate.end_idx)
        prior.flags.update(candidate.flags)
        prior.flags.add("merged_adjacent_peaks")
        if candidate.peak_omega > prior.peak_omega:
            prior.peak_omega = candidate.peak_omega
    return merged
