"""REC/MR/V phase decomposition (WP-30 / T2, FR-D11).

``phase-v1`` answers "which part of the peek is slow": every presentation window is split into a
**REC** (reaction) segment before the primary movement, an **MR** (main run) segment covering the
primary movement itself, and a **V** (verification) segment between the end of that movement and the
first compatible shot. The three-segment structure is frozen (D-30.1): ``MR`` is always the
``seg-v2``/``seg-v1`` ``primary_flick`` :class:`~modules.segments.algorithms.submovement.Segment` --
this module contains **no motion-onset detection of its own**. Reusing the existing segmentation
boundary is the point (C-D4): a second "when did the movement start" definition is exactly the
failure mode this module must not introduce.

Zero-phase Butterworth smoothing (:func:`smooth_report_omega`) exists solely to produce a readable
ω(t) curve for the coach-report / notebook overlay; it never feeds a boundary decision. When
smoothing is not possible (too few samples for the requested filter order, see
:func:`~shared.filters.butter.butter_filter`), the affected :class:`PhaseSample` is flagged
``filter_degenerate`` rather than raising.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
import math
from typing import Literal

import numpy as np
import pandas as pd

from modules.metrics.algorithms.detect import DetectSample
from modules.metrics.algorithms.peek import PeekWindow
from modules.segments.algorithms.submovement import Segment
from shared.filters.butter import butter_filter


PHASE_VERSION = "phase-v1"

#: Nominal tick rate every `phase-v1` quantity assumes (analysis-segments.md precedent: parameters
#: are registered for the nominal 128 Hz trace; a different sampling rate needs a new version).
NOMINAL_SIM_HZ = 128.0

#: Closed vocabulary (T0 §3.1 pre-registration draft; T2 may only narrow, never widen, per D-30.4).
KNOWN_PHASE_FLAGS = frozenset(
    {
        "window_too_short",
        "no_primary_flick",
        "no_first_shot",
        "filter_degenerate",
        "anchor_before_onset",
        "non_uniform_dt",
    }
)

Side = Literal["L", "R"]

_DT_TOLERANCE_MS = 1e-6


@dataclass(frozen=True)
class PhaseParams:
    """Pre-registered ``phase-v1`` parameters; changes require a new version (D-30.4)."""

    cutoff_hz: float
    butter_order: int
    min_window_ticks: int
    version: str = PHASE_VERSION

    def __post_init__(self) -> None:
        if (
            isinstance(self.cutoff_hz, bool)
            or not isinstance(self.cutoff_hz, (int, float))
            or not math.isfinite(self.cutoff_hz)
            or self.cutoff_hz <= 0
        ):
            raise ValueError("cutoff_hz must be a positive finite number")
        if isinstance(self.butter_order, bool) or not isinstance(self.butter_order, int) or self.butter_order <= 0:
            raise ValueError("butter_order must be a positive integer")
        if (
            isinstance(self.min_window_ticks, bool)
            or not isinstance(self.min_window_ticks, int)
            or self.min_window_ticks <= 0
        ):
            raise ValueError("min_window_ticks must be a positive integer")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


#: Frozen 2026-08 (T2 dual-dimension sweep, notebooks/t2/outputs/phase-sweep.csv): synthetic
#: regression (six pre-registered boundary cases, zero failures) + 90.0% of the 60 real peeks
#: (09:18/09:24/09:37) non-degenerate across all three phases. See analysis-phase-curves.md.
DEFAULT_PHASE_PARAMS = PhaseParams(cutoff_hz=12.0, butter_order=4, min_window_ticks=30)


@dataclass(frozen=True)
class PhaseSample:
    """One peek's REC/MR/V decomposition. Mirrors the WP-30 README §5 interface contract."""

    peek_index: int
    side: Side
    t_onset: float | None
    t_mr_end: float | None
    t_anchor: float | None
    rec_ms: float | None
    mr_ms: float | None
    v_ms: float | None
    peak_omega_deg_s: float | None
    t_detect: float | None
    rec_minus_detect_ms: float | None
    flags: tuple[str, ...] = ()


def phase_decompose(
    peek: PeekWindow,
    omega: np.ndarray,
    ticks: pd.DataFrame,
    segments: Sequence[Segment],
    params: PhaseParams = DEFAULT_PHASE_PARAMS,
    detect: DetectSample | None = None,
) -> PhaseSample:
    """Decompose one peek into REC/MR/V, cross-checked (not redefined) against ``t_detect``.

    ``omega``/``ticks``/``segments`` are all in the peek's own local frame: ``ticks`` is this
    presentation window's own tick slice, ``omega`` is ``omega_deg_s(ticks).values`` for that same
    slice (index 0 is the contractual leading ``nan``), and ``segments`` are the
    :func:`~modules.segments.algorithms.submovement.segment_submovements` result for this peek with
    indices already mapped back into that tick frame (the caller's ``_OMEGA_INDEX_OFFSET`` step,
    matching ``run_pipeline.py``). This function never renumbers or recomputes a boundary from
    ``omega`` -- ``t_onset``/``t_mr_end`` are read verbatim off the selected :class:`Segment`.
    """

    if not isinstance(params, PhaseParams):
        raise TypeError("params must be a PhaseParams instance")

    tick_times = ticks["t"].to_numpy(dtype=float) if len(ticks) else np.empty(0, dtype=float)
    t_detect = detect.t_detect if detect is not None else None

    if len(tick_times) < params.min_window_ticks:
        return _finalize(peek, t_detect=t_detect, flags=("window_too_short",))

    flags: list[str] = []
    if not _is_locally_uniform(tick_times):
        flags.append("non_uniform_dt")

    primary = next((segment for segment in segments if segment.kind == "primary_flick"), None)
    if primary is None:
        flags.append("no_primary_flick")
        return _finalize(peek, t_detect=t_detect, flags=tuple(flags))

    t_onset = float(tick_times[primary.start_idx])
    t_mr_end = float(tick_times[primary.end_idx])
    peak_omega_deg_s = _peak_omega(omega, primary.start_idx, primary.end_idx)

    t_anchor = peek.t_first_shot
    if t_anchor is None:
        flags.append("no_first_shot")
    elif t_anchor < t_mr_end:
        # Spec: "t_first_shot 早於 MR 起點等順序退化" -- generalised to the whole MR span so a shot
        # fired during the flick's tail (after onset, before its measured end) does not produce a
        # negative v_ms either; a negative duration is never a valid measurement (§2 "不硬給負值").
        flags.append("anchor_before_onset")

    degenerate = "anchor_before_onset" in flags
    rec_ms = None if degenerate else t_onset - peek.t_visible
    mr_ms = None if degenerate else t_mr_end - t_onset
    v_ms = None if degenerate or t_anchor is None else t_anchor - t_mr_end

    if not _can_smooth(tick_times, omega, params):
        flags.append("filter_degenerate")

    rec_minus_detect_ms = (
        t_onset - t_detect if (rec_ms is not None and t_detect is not None) else None
    )

    return _finalize(
        peek,
        t_onset=t_onset,
        t_mr_end=t_mr_end,
        t_anchor=t_anchor,
        rec_ms=rec_ms,
        mr_ms=mr_ms,
        v_ms=v_ms,
        peak_omega_deg_s=peak_omega_deg_s,
        t_detect=t_detect,
        rec_minus_detect_ms=rec_minus_detect_ms,
        flags=tuple(flags),
    )


def phase_table(
    peeks: Sequence[PeekWindow],
    omega: Sequence[np.ndarray],
    ticks: Sequence[pd.DataFrame],
    segments: Sequence[Sequence[Segment]],
    params: PhaseParams = DEFAULT_PHASE_PARAMS,
    detects: Sequence[DetectSample | None] | None = None,
) -> pd.DataFrame:
    """Batch :func:`phase_decompose` over every peek of one export into one row-per-peek frame.

    ``omega``/``ticks``/``segments`` are parallel per-peek sequences (the same per-peek values a
    caller already builds while segmenting each window, e.g. ``run_pipeline.py``'s per-peek loop) --
    this function does no window slicing of its own, only orchestration.
    """

    resolved_detects = detects if detects is not None else (None,) * len(peeks)
    rows = [
        phase_decompose(peek, om, tk, segs, params, detect)
        for peek, om, tk, segs, detect in zip(
            peeks, omega, ticks, segments, resolved_detects, strict=True
        )
    ]
    return pd.DataFrame(
        {
            "peek_index": [row.peek_index for row in rows],
            "side": [row.side for row in rows],
            "t_onset": [row.t_onset for row in rows],
            "t_mr_end": [row.t_mr_end for row in rows],
            "t_anchor": [row.t_anchor for row in rows],
            "rec_ms": [row.rec_ms for row in rows],
            "mr_ms": [row.mr_ms for row in rows],
            "v_ms": [row.v_ms for row in rows],
            "peak_omega_deg_s": [row.peak_omega_deg_s for row in rows],
            "t_detect": [row.t_detect for row in rows],
            "rec_minus_detect_ms": [row.rec_minus_detect_ms for row in rows],
            "flags": [row.flags for row in rows],
        }
    )


def smooth_report_omega(
    omega: np.ndarray, tick_times: np.ndarray, params: PhaseParams = DEFAULT_PHASE_PARAMS
) -> tuple[np.ndarray, bool]:
    """Zero-phase-smoothed ω(t) for the report overlay only (never a boundary input, see module docstring).

    Returns ``(values, degenerate)``. ``values`` is the Butterworth output when smoothing is
    possible, otherwise the unfiltered tail (``omega[1:]``) as a graceful fallback -- the caller
    still gets a curve to plot, just an unsmoothed one, and ``degenerate=True`` records why.
    """

    clean = omega[1:] if len(omega) else omega
    if not _can_smooth(tick_times, omega, params):
        return clean, True
    return butter_filter(clean, params.cutoff_hz, NOMINAL_SIM_HZ, params.butter_order), False


def _can_smooth(tick_times: np.ndarray, omega: np.ndarray, params: PhaseParams) -> bool:
    clean = omega[1:] if len(omega) else omega
    try:
        butter_filter(clean, params.cutoff_hz, NOMINAL_SIM_HZ, params.butter_order)
    except ValueError:
        return False
    return True


def _peak_omega(omega: np.ndarray, start_idx: int, end_idx: int) -> float | None:
    span = omega[start_idx : end_idx + 1]
    finite = span[np.isfinite(span)]
    if finite.size == 0:
        return None
    return float(np.max(finite))


def _is_locally_uniform(tick_times: np.ndarray) -> bool:
    """Whether this window's own tick spacing is internally consistent.

    Scoped to phase-v1: unlike ``run_pipeline.py``'s ``non_uniform_dt`` (which attributes a
    export-wide ``check_dt`` gap to the window that contains it), this module only ever sees one
    peek's own ticks, so it compares each interval against this window's own median interval
    instead of threading ``meta.simHz`` through the pure algorithms layer. Same meaning ("tick
    spacing unsuitable for uniform-rate downstream calculations"), narrower evidence.
    """

    if len(tick_times) < 2:
        return True
    intervals = np.diff(tick_times)
    median = float(np.median(intervals))
    return bool(np.all(np.isclose(intervals, median, rtol=0.0, atol=_DT_TOLERANCE_MS)))


def _finalize(
    peek: PeekWindow,
    *,
    t_onset: float | None = None,
    t_mr_end: float | None = None,
    t_anchor: float | None = None,
    rec_ms: float | None = None,
    mr_ms: float | None = None,
    v_ms: float | None = None,
    peak_omega_deg_s: float | None = None,
    t_detect: float | None = None,
    rec_minus_detect_ms: float | None = None,
    flags: tuple[str, ...] = (),
) -> PhaseSample:
    if not set(flags) <= KNOWN_PHASE_FLAGS:
        raise AssertionError("phase sample emitted an unknown flag")
    return PhaseSample(
        peek_index=peek.index,
        side=peek.side,
        t_onset=t_onset,
        t_mr_end=t_mr_end,
        t_anchor=t_anchor,
        rec_ms=rec_ms,
        mr_ms=mr_ms,
        v_ms=v_ms,
        peak_omega_deg_s=peak_omega_deg_s,
        t_detect=t_detect,
        rec_minus_detect_ms=rec_minus_detect_ms,
        flags=flags,
    )
