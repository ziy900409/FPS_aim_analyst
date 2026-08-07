"""t_detect / eccentricity-at-spawn — Python reproduction of the existing ``detectionDerivation``
TypeScript construct (WP-30 / T1, FR-D11 prerequisite).

``t_detect`` is not a new construct (C-D4): the TypeScript reference implementation
(engine ``src/metrics``, spec ``docs/operational/analysis-t-detect.md``) is the sole authority. This
module reproduces that logic bit-for-bit so the golden research parity test can hold the two sides to
the same answer; it must not introduce a second definition of any boundary case the TS side already
resolves.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
import math
from typing import Any, Literal

import numpy as np
import pandas as pd

from modules.ingest.algorithms.loader import Export
from modules.kinematics.algorithms.angular import EyeOrigin, epsilon_deg, resolve_eye_origin
from modules.metrics.algorithms.peek import PeekWindow


_EPSILON = 1e-9
DETECT_VERSION = "detect-v1"

DetectStatus = Literal["detected", "timeout"]

#: Python-only bookkeeping flag, closed vocabulary (peek.py's ``KNOWN_PEEK_FLAGS`` precedent). TS has
#: no equivalent field -- ``targetFromVisibleOrTick`` throws instead -- because TS derives one
#: presentation at a time and a caller decides what to do with the exception; this module derives every
#: presentation in a batch (parity-fixture generation over a whole export), so a single malformed
#: presentation must not abort the rest. This is bookkeeping, not a second definition of "missing", the
#: TS side is not asked a different question, it is simply never asked this one.
KNOWN_DETECT_FLAGS = frozenset({"missing_target_position"})


@dataclass(frozen=True)
class DetectParams:
    """Mirrors TS ``ResolvedDetectionDerivationOptions`` (``detectionDerivation`` ``DEFAULT_OPTIONS``).

    Values are copied verbatim from the TS defaults, not re-derived: 500 ms pre-stimulus window,
    3x baseline SD threshold, 4 sustained ticks, 100 ms anticipation lower bound. See
    ``docs/operational/analysis-t-detect.md`` and WP-30 T1 progress.md for the field-by-field audit.
    """

    pre_stimulus_ms: float = 500.0
    theta_sd_k: float = 3.0
    sustain_ticks: int = 4
    anticipation_ms: float = 100.0
    version: str = DETECT_VERSION


DEFAULT_DETECT_PARAMS = DetectParams()


@dataclass(frozen=True)
class DetectSample:
    """One presentation's detection derivation. Mirrors TS ``DetectionPresentationDerivation``."""

    peek_index: int
    t_detect: float | None
    status: DetectStatus
    eccentricity_at_spawn_deg: float
    baseline_insufficient: bool
    anticipation: bool
    flags: tuple[str, ...] = ()


def detect_samples(
    export: Export,
    peeks: Sequence[PeekWindow],
    *,
    eye_origin: EyeOrigin,
    params: DetectParams = DEFAULT_DETECT_PARAMS,
) -> tuple[DetectSample, ...]:
    """Derive ``t_detect`` / ``eccentricity_at_spawn`` for every peek, TS-parity by construction.

    Window boundaries are taken from ``peek.t_visible`` / ``peek.t_end`` (``build_peek_windows``,
    ``timeline-v1``) and never recomputed here. ``epsilon(t)`` is always produced by the existing
    :func:`epsilon_deg` (the module's only radians->degrees boundary); this function only adds the
    velocity/threshold/sustained-run logic that the TS ``detectionDerivation`` module defines.
    """

    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    visible_events = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    samples = tuple(
        _detect_presentation(peek, visible_events.iloc[peek.index], ticks, export.meta, eye_origin, params)
        for peek in peeks
    )
    for sample in samples:
        if not set(sample.flags) <= KNOWN_DETECT_FLAGS:
            raise AssertionError("detect sample emitted an unknown flag")
    return samples


def detect_parity_payload(export: Export, samples: Sequence[DetectSample]) -> dict[str, Any]:
    """JSON-ready payload for the golden ``detect-parity`` research test.

    Parity generation always resolves ``eye_origin`` with ``strict=True`` (T0 / D-30.2 machine gate:
    WP-30 research entry points must not silently fall back to a guessed origin) and always uses
    :data:`DEFAULT_DETECT_PARAMS` -- this task reproduces the TS construct, it does not calibrate it
    (T1 scope).
    """

    eye_origin = resolve_eye_origin(export.meta, strict=True)
    visible_events = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    presentations = []
    for sample in samples:
        visible = visible_events.iloc[sample.peek_index]
        presentations.append(
            {
                "targetId": str(visible["targetId"]),
                "tVisibleMs": float(visible["t"]),
                "status": sample.status,
                "tDetectMs": sample.t_detect,
                "eccentricityAtSpawnDeg": sample.eccentricity_at_spawn_deg,
                "baselineInsufficient": sample.baseline_insufficient,
                "anticipation": sample.anticipation,
                "flags": list(sample.flags),
            }
        )
    return {
        "source": export.source_path.name,
        "version": DEFAULT_DETECT_PARAMS.version,
        "options": {
            "preStimulusMs": DEFAULT_DETECT_PARAMS.pre_stimulus_ms,
            "thresholdSdMultiplier": DEFAULT_DETECT_PARAMS.theta_sd_k,
            "sustainedTicks": DEFAULT_DETECT_PARAMS.sustain_ticks,
            "anticipationMs": DEFAULT_DETECT_PARAMS.anticipation_ms,
            "eyeOrigin": _eye_origin_to_json(eye_origin),
        },
        "presentations": presentations,
    }


def _eye_origin_to_json(eye_origin: EyeOrigin) -> dict[str, Any]:
    x, y, z = eye_origin.base
    return {
        "base": {"x": x, "y": y, "z": z},
        "simToWorld": eye_origin.sim_to_world,
        "source": eye_origin.source,
    }


def _detect_presentation(
    peek: PeekWindow,
    visible: pd.Series,
    ticks: pd.DataFrame,
    meta: Mapping[str, Any],
    eye_origin: EyeOrigin,
    params: DetectParams,
) -> DetectSample:
    t_visible = peek.t_visible
    times = ticks["t"].to_numpy(dtype=float)
    spawn_idx = _first_tick_index_at_or_after(times, t_visible)
    if spawn_idx is None:
        raise ValueError(f"detect_samples: no tick at or after t_visible for peek {peek.index}")
    spawn_tick = ticks.iloc[spawn_idx]

    spawn_target = _resolve_spawn_target(visible, spawn_tick)
    if spawn_target is None:
        return DetectSample(
            peek_index=peek.index,
            t_detect=None,
            status="timeout",
            eccentricity_at_spawn_deg=math.nan,
            baseline_insufficient=True,
            anticipation=False,
            flags=("missing_target_position",),
        )

    baseline_window = _window_ticks(ticks, t_visible - params.pre_stimulus_ms, t_visible)
    baseline_epsilon = _epsilon_with_fixed_target(baseline_window, meta, eye_origin, spawn_target)
    baseline_t, baseline_deg_per_sec = _velocity_samples(
        baseline_window["t"].to_numpy(dtype=float), baseline_epsilon
    )
    baseline_abs = np.abs(baseline_deg_per_sec)
    baseline_sd = float(np.std(baseline_abs, ddof=0)) if len(baseline_abs) > 0 else 0.0
    threshold_deg_per_sec = params.theta_sd_k * baseline_sd
    baseline_coverage_ms = (
        t_visible - float(baseline_window["t"].iloc[0]) if len(baseline_window) > 0 else 0.0
    )
    baseline_insufficient = len(baseline_t) < 2 or baseline_coverage_ms + _EPSILON < params.pre_stimulus_ms

    post_window = _window_ticks(ticks, t_visible, peek.t_end)
    post_epsilon = epsilon_deg(post_window, meta, eye_origin=eye_origin, fallback_target=spawn_target)
    post_t, post_deg_per_sec = _velocity_samples(post_window["t"].to_numpy(dtype=float), post_epsilon)
    t_detect = _first_sustained_decrease(post_t, post_deg_per_sec, threshold_deg_per_sec, params.sustain_ticks)
    reaction_ms = None if t_detect is None else t_detect - t_visible
    status: DetectStatus = "detected" if t_detect is not None else "timeout"
    anticipation = reaction_ms is not None and reaction_ms < params.anticipation_ms

    spawn_frame = ticks.iloc[[spawn_idx]]
    eccentricity_at_spawn = float(
        epsilon_deg(spawn_frame, meta, eye_origin=eye_origin, fallback_target=spawn_target)[0]
    )

    return DetectSample(
        peek_index=peek.index,
        t_detect=t_detect,
        status=status,
        eccentricity_at_spawn_deg=eccentricity_at_spawn,
        baseline_insufficient=baseline_insufficient,
        anticipation=anticipation,
        flags=(),
    )


def _resolve_spawn_target(
    visible: pd.Series, spawn_tick: pd.Series
) -> tuple[float, float, float] | None:
    """Mirrors TS ``targetFromVisibleOrTick``: prefer the visible event's target center, else the
    spawn tick's own center. TS throws when both are missing; this batch entry point flags instead
    (see :data:`KNOWN_DETECT_FLAGS`)."""

    visible_target = (visible.get("targetX"), visible.get("targetY"), visible.get("targetZ"))
    if all(_is_finite(value) for value in visible_target):
        return (float(visible_target[0]), float(visible_target[1]), float(visible_target[2]))

    tick_target = (spawn_tick["tx"], spawn_tick["ty"], spawn_tick["tz"])
    if all(_is_finite(value) for value in tick_target):
        return (float(tick_target[0]), float(tick_target[1]), float(tick_target[2]))

    return None


def _first_tick_index_at_or_after(times: np.ndarray, t: float) -> int | None:
    """Mirrors TS ``firstTickAtOrAfter``: first tick with ``tick.t + EPSILON >= t``."""

    idx = int(np.searchsorted(times, t - _EPSILON, side="left"))
    return idx if idx < len(times) else None


def _window_ticks(ticks: pd.DataFrame, start_ms: float, end_ms: float) -> pd.DataFrame:
    """``[start_ms, end_ms)`` tick slice with TS's epsilon-fuzzed boundary (``eccentricitySamples``)."""

    t = ticks["t"].to_numpy(dtype=float)
    if math.isinf(end_ms):
        mask = t >= start_ms - _EPSILON
    else:
        mask = (t >= start_ms - _EPSILON) & (t < end_ms - _EPSILON)
    return ticks.loc[mask].reset_index(drop=True)


def _epsilon_with_fixed_target(
    ticks: pd.DataFrame,
    meta: Mapping[str, Any],
    eye_origin: EyeOrigin,
    target: tuple[float, float, float],
) -> np.ndarray:
    """Baseline epsilon: TS's ``preferTickTarget=false`` always uses the not-yet-spawned target, even
    when a (previous presentation's) tick target center happens to be present. Blanking ``tx/ty/tz``
    forces :func:`epsilon_deg`'s existing fallback path rather than reimplementing its geometry."""

    if ticks.empty:
        return np.array([], dtype=float)
    forced = ticks.copy()
    forced["tx"] = np.nan
    forced["ty"] = np.nan
    forced["tz"] = np.nan
    return epsilon_deg(forced, meta, eye_origin=eye_origin, fallback_target=target)


def _velocity_samples(t: np.ndarray, epsilon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """``d epsilon / dt`` assigned to the later tick (spec); non-positive/non-finite dt is skipped
    entirely, matching TS's ``continue`` (not filled with a placeholder)."""

    sample_t: list[float] = []
    sample_deg_per_sec: list[float] = []
    for i in range(1, len(t)):
        dt_s = (t[i] - t[i - 1]) / 1000.0
        if dt_s <= 0 or not math.isfinite(dt_s):
            continue
        sample_t.append(float(t[i]))
        sample_deg_per_sec.append(float((epsilon[i] - epsilon[i - 1]) / dt_s))
    return np.array(sample_t, dtype=float), np.array(sample_deg_per_sec, dtype=float)


def _first_sustained_decrease(
    t: np.ndarray,
    deg_per_sec: np.ndarray,
    threshold_deg_per_sec: float,
    sustain_ticks: int,
) -> float | None:
    """First tick of the first run of ``sustain_ticks`` consecutive samples below
    ``-threshold_deg_per_sec`` -- the run's *first* tick, not its confirming (last) one (spec)."""

    run = 0
    candidate_start: float | None = None
    for time, value in zip(t, deg_per_sec):
        if value < -threshold_deg_per_sec:
            if run == 0:
                candidate_start = float(time)
            run += 1
            if run >= sustain_ticks:
                return candidate_start
        else:
            run = 0
            candidate_start = None
    return None


def _is_finite(value: Any) -> bool:
    if isinstance(value, bool) or value is None:
        return False
    if not isinstance(value, (int, float, np.floating, np.integer)):
        return False
    return math.isfinite(float(value))
