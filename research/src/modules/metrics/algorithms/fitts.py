"""Fitts ID/MT/TP diagnostics (WP-31 / T3).

The geometry deliberately reuses the existing angular derivation path:
``epsilon_deg`` supplies D at spawn, and angular ``_hitbox`` supplies the
same H1 hitbox source as tracking/on-target derivations.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
import math
from typing import Any, Literal

import numpy as np
import pandas as pd

from modules.ingest.algorithms.loader import Export
from modules.kinematics.algorithms.angular import EyeOrigin, _hitbox, epsilon_deg
from modules.metrics.algorithms.peek import PeekWindow


FITTS_VERSION = "fitts-v1"

KNOWN_FITTS_FLAGS = frozenset(
    {
        "no_first_shot",
        "missing_target_position",
        "missing_spawn_tick",
        "degenerate_geometry",
    }
)

KNOWN_FITTS_REASONS = frozenset(
    {
        "ok",
        "insufficient_n",
        "insufficient_d_ratio",
        "insufficient_id_range",
        "non_positive_slope",
    }
)

Side = Literal["L", "R"]
FittsStatus = Literal["ok", "blocked-by-data"]

_EPSILON = 1e-9


@dataclass(frozen=True)
class FittsParams:
    """Pre-registered ``fitts-v1`` parameters (T0/D-31.5); changes require a new version."""

    min_samples: int
    min_d_ratio: float
    min_id_range_bits: float
    version: str = FITTS_VERSION

    def __post_init__(self) -> None:
        if isinstance(self.min_samples, bool) or not isinstance(self.min_samples, int) or self.min_samples <= 0:
            raise ValueError("min_samples must be a positive integer")
        if (
            isinstance(self.min_d_ratio, bool)
            or not isinstance(self.min_d_ratio, (int, float))
            or not math.isfinite(self.min_d_ratio)
            or self.min_d_ratio <= 0
        ):
            raise ValueError("min_d_ratio must be a positive finite number")
        if (
            isinstance(self.min_id_range_bits, bool)
            or not isinstance(self.min_id_range_bits, (int, float))
            or not math.isfinite(self.min_id_range_bits)
            or self.min_id_range_bits <= 0
        ):
            raise ValueError("min_id_range_bits must be a positive finite number")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


# Frozen by WP-31 T0 (progress.md D-31.5), before computing any real Fitts result.
# KI-008/BD-008: these three values must match T0-entry-gate.md Sec.4 verbatim -- do not
# adjust to change a session's verdict without a new version (T0's pre-registration rule).
DEFAULT_FITTS_PARAMS = FittsParams(min_samples=20, min_d_ratio=2.0, min_id_range_bits=1.0)


@dataclass(frozen=True)
class FittsSample:
    peek_index: int
    side: Side
    d_deg: float | None
    w_deg: float | None
    id_bits: float | None
    mt_ms: float | None
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class FittsResult:
    samples: tuple[FittsSample, ...]
    n: int
    slope_ms_per_bit: float | None
    intercept_ms: float | None
    r2: float | None
    throughput_bits_s: float | None
    d_ratio: float | None
    id_range_bits: float | None
    status: FittsStatus
    reason: str


def fitts_samples(
    peeks: Sequence[PeekWindow],
    export: Export,
    *,
    eye_origin: EyeOrigin,
    params: FittsParams = DEFAULT_FITTS_PARAMS,
) -> FittsResult:
    """Compute per-peek Fitts rows and the ID-MT regression verdict.

    D is the spawn eccentricity from the same ``epsilon_deg`` path used by
    ``detect-v1``. MT is ``t_first_shot - t_visible``; it intentionally includes
    reaction time and counter-strafe stop time for ``fitts-v1``.
    """

    if not isinstance(params, FittsParams):
        raise TypeError("params must be a FittsParams instance")
    if not isinstance(eye_origin, EyeOrigin):
        raise TypeError("eye_origin must be an EyeOrigin instance")

    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    visible_events = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    times = ticks["t"].to_numpy(dtype=float)

    rows = tuple(
        _sample(peek, visible_events.iloc[peek.index], ticks, times, export.meta, eye_origin)
        for peek in peeks
    )
    for row in rows:
        if not set(row.flags) <= KNOWN_FITTS_FLAGS:
            raise AssertionError("fitts sample emitted an unknown flag")

    return _result(rows, params)


def _sample(
    peek: PeekWindow,
    visible: pd.Series,
    ticks: pd.DataFrame,
    times: np.ndarray,
    meta: Mapping[str, Any],
    eye_origin: EyeOrigin,
) -> FittsSample:
    flags: list[str] = []
    if peek.t_first_shot is None:
        flags.append("no_first_shot")

    spawn_idx = _first_tick_index_at_or_after(times, peek.t_visible)
    if spawn_idx is None:
        flags.append("missing_spawn_tick")
        return _flagged(peek, flags)

    spawn_tick = ticks.iloc[spawn_idx]
    target = _resolve_spawn_target(visible, spawn_tick)
    if target is None:
        flags.append("missing_target_position")
        return _flagged(peek, flags)

    d_deg = float(
        epsilon_deg(ticks.iloc[[spawn_idx]], meta, eye_origin=eye_origin, fallback_target=target)[0]
    )
    try:
        w_deg = target_width_deg(meta, eye_origin, spawn_tick, target)
    except ValueError:
        w_deg = math.nan
    if not (math.isfinite(d_deg) and math.isfinite(w_deg) and w_deg > 0):
        flags.append("degenerate_geometry")

    mt_ms = None if peek.t_first_shot is None else float(peek.t_first_shot - peek.t_visible)
    if mt_ms is not None and (not math.isfinite(mt_ms) or mt_ms < 0):
        flags.append("no_first_shot")
        mt_ms = None

    id_bits = math.log2(1.0 + d_deg / w_deg) if not flags else None
    return FittsSample(
        peek_index=peek.index,
        side=peek.side,
        d_deg=None if flags else d_deg,
        w_deg=None if flags else w_deg,
        id_bits=id_bits,
        mt_ms=None if flags else mt_ms,
        flags=tuple(dict.fromkeys(flags)),
    )


def target_width_deg(
    meta: Mapping[str, Any],
    eye_origin: EyeOrigin,
    spawn_tick: pd.Series,
    target: Sequence[float],
) -> float:
    """Horizontal angular width from the shared H1 hitbox source."""

    width, _, _ = _hitbox(meta)
    if not math.isfinite(width) or width <= 0:
        return math.nan
    origin = _origin_for_tick(spawn_tick, eye_origin)
    center = np.asarray(tuple(float(value) for value in target), dtype=float)
    distance = float(np.linalg.norm(center - origin))
    if not math.isfinite(distance) or distance <= 0:
        return math.nan
    return math.degrees(2.0 * math.atan((width / 2.0) / distance))


def _result(samples: tuple[FittsSample, ...], params: FittsParams) -> FittsResult:
    valid = [
        sample
        for sample in samples
        if not sample.flags
        and _finite(sample.d_deg)
        and _finite(sample.id_bits)
        and _finite(sample.mt_ms)
    ]
    n = len(valid)
    if n < params.min_samples:
        return _blocked(samples, n, None, None, "insufficient_n")

    d_values = np.asarray([sample.d_deg for sample in valid], dtype=float)
    id_values = np.asarray([sample.id_bits for sample in valid], dtype=float)
    mt_values = np.asarray([sample.mt_ms for sample in valid], dtype=float)
    min_d = float(np.min(d_values))
    max_d = float(np.max(d_values))
    d_ratio = math.inf if min_d <= 0 else max_d / min_d
    id_range_bits = float(np.max(id_values) - np.min(id_values))

    # KI-008/BD-008: min_d <= 0 (a centered spawn, D=0) makes the ratio undefined, not
    # insufficient -- it is the maximal possible spread, not the minimal one. Only a
    # *finite* ratio below the threshold indicates too little span; id_range_bits below
    # is the gate that actually catches "no real variation at all" (all D == 0).
    if math.isfinite(d_ratio) and d_ratio < params.min_d_ratio:
        return _blocked(samples, n, d_ratio, id_range_bits, "insufficient_d_ratio")
    if id_range_bits < params.min_id_range_bits:
        return _blocked(samples, n, d_ratio, id_range_bits, "insufficient_id_range")

    slope, intercept, r2 = _linear_regression(id_values, mt_values)
    if slope <= 0 or not math.isfinite(slope):
        return _blocked(samples, n, d_ratio, id_range_bits, "non_positive_slope")
    return FittsResult(
        samples=samples,
        n=n,
        slope_ms_per_bit=slope,
        intercept_ms=intercept,
        r2=r2,
        throughput_bits_s=1000.0 / slope,
        d_ratio=d_ratio,
        id_range_bits=id_range_bits,
        status="ok",
        reason="ok",
    )


def _linear_regression(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    x_mean = float(np.mean(x))
    y_mean = float(np.mean(y))
    ss_x = float(np.sum((x - x_mean) ** 2))
    if ss_x <= 0:
        return (math.nan, math.nan, math.nan)
    slope = float(np.sum((x - x_mean) * (y - y_mean)) / ss_x)
    intercept = y_mean - slope * x_mean
    predicted = intercept + slope * x
    ss_res = float(np.sum((y - predicted) ** 2))
    ss_tot = float(np.sum((y - y_mean) ** 2))
    r2 = 1.0 if ss_tot <= 0 else 1.0 - ss_res / ss_tot
    return (slope, intercept, r2)


def _blocked(
    samples: tuple[FittsSample, ...],
    n: int,
    d_ratio: float | None,
    id_range_bits: float | None,
    reason: str,
) -> FittsResult:
    if reason not in KNOWN_FITTS_REASONS:
        raise AssertionError("fitts result emitted an unknown reason")
    return FittsResult(
        samples=samples,
        n=n,
        slope_ms_per_bit=None,
        intercept_ms=None,
        r2=None,
        throughput_bits_s=None,
        d_ratio=d_ratio,
        id_range_bits=id_range_bits,
        status="blocked-by-data",
        reason=reason,
    )


def _flagged(peek: PeekWindow, flags: Sequence[str]) -> FittsSample:
    return FittsSample(
        peek_index=peek.index,
        side=peek.side,
        d_deg=None,
        w_deg=None,
        id_bits=None,
        mt_ms=None,
        flags=tuple(dict.fromkeys(flags)),
    )


def _origin_for_tick(tick: pd.Series, eye_origin: EyeOrigin) -> np.ndarray:
    px = _finite_scalar(tick["px"])
    pz = _finite_scalar(tick["pz"])
    return np.asarray(eye_origin.base, dtype=float) + np.asarray(
        (px, 0.0, pz), dtype=float
    ) * eye_origin.sim_to_world


def _first_tick_index_at_or_after(times: np.ndarray, t: float) -> int | None:
    idx = int(np.searchsorted(times, t - _EPSILON, side="left"))
    return idx if idx < len(times) else None


def _resolve_spawn_target(
    visible: pd.Series, spawn_tick: pd.Series
) -> tuple[float, float, float] | None:
    visible_target = (visible.get("targetX"), visible.get("targetY"), visible.get("targetZ"))
    if all(_finite(value) for value in visible_target):
        return (float(visible_target[0]), float(visible_target[1]), float(visible_target[2]))

    tick_target = (spawn_tick["tx"], spawn_tick["ty"], spawn_tick["tz"])
    if all(_finite(value) for value in tick_target):
        return (float(tick_target[0]), float(tick_target[1]), float(tick_target[2]))

    return None


def _finite(value: object) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float, np.number))
        and math.isfinite(float(value))
    )


def _finite_scalar(value: object) -> float:
    if not _finite(value):
        raise ValueError("tick coordinate must be finite")
    return float(value)
