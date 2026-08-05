"""Pure angular kinematics for schema v2 export ticks.

The ingest layer flattens tick aim values to ``yaw`` and ``pitch`` columns in
radians.  This module is the research layer's only radians-to-degrees boundary;
all returned angular quantities are expressed in degrees.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
import math
from typing import Any

import numpy as np
import pandas as pd


_RAY_EPSILON = 1e-9
_DEFAULT_HITBOX = (1.0, 2.0, 1.0)


def omega_deg_s(ticks: pd.DataFrame) -> np.ndarray:
    """Return angular speed for each tick, with ``nan`` at index zero.

    The pitch correction uses the midpoint pitch of each adjacent tick pair.
    Tick timestamps are milliseconds and exported aim angles are radians.
    """

    t_ms = _finite_column(ticks, "t")
    yaw = _finite_column(ticks, "yaw")
    pitch = _finite_column(ticks, "pitch")
    _same_length(t_ms, yaw, pitch)

    result = np.full(t_ms.shape, np.nan, dtype=float)
    if len(t_ms) < 2:
        return result

    dt_s = np.diff(t_ms) / 1000.0
    if np.any(dt_s <= 0):
        raise ValueError("tick timestamps must be strictly increasing")

    delta_yaw = np.diff(yaw)
    delta_pitch = np.diff(pitch)
    midpoint_pitch = (pitch[:-1] + pitch[1:]) / 2.0
    speed_rad_s = np.hypot(delta_yaw * np.cos(midpoint_pitch), delta_pitch) / dt_s
    result[1:] = np.degrees(speed_rad_s)
    return result


def epsilon_deg(
    ticks: pd.DataFrame,
    meta: Mapping[str, Any],
    eye_height: float = 1.6,
    *,
    fallback_target: Sequence[float] | None = None,
) -> np.ndarray:
    """Return unsigned aim-to-target-center angular error for each tick.

    ``fallback_target`` supplies the presentation's visible-event target center
    when a tick does not carry all three target coordinates.  ``meta`` is kept
    in the public contract alongside :func:`on_target`; epsilon itself does not
    depend on hitbox dimensions.
    """

    _require_mapping(meta, "meta")
    eye_height = _finite_scalar(eye_height, "eye_height")
    yaw, pitch, origins, targets = _geometry(ticks, eye_height, fallback_target)
    aim = _aim_forward(yaw, pitch)
    to_target = targets - origins
    target_distance = np.linalg.norm(to_target, axis=1)

    result = np.zeros(len(yaw), dtype=float)
    nonzero = target_distance > 0
    if np.any(nonzero):
        dots = np.sum(aim[nonzero] * to_target[nonzero], axis=1) / target_distance[nonzero]
        result[nonzero] = np.degrees(np.arccos(np.clip(dots, -1.0, 1.0)))
    return result


def on_target(
    ticks: pd.DataFrame,
    meta: Mapping[str, Any],
    eye_height: float = 1.6,
    *,
    fallback_target: Sequence[float] | None = None,
) -> np.ndarray:
    """Return whether each tick's aim ray intersects the resolved H1 AABB."""

    eye_height = _finite_scalar(eye_height, "eye_height")
    width, height, depth = _hitbox(meta)
    yaw, pitch, origins, targets = _geometry(ticks, eye_height, fallback_target)
    direction = _aim_forward(yaw, pitch)
    half_extents = np.asarray((width, height, depth), dtype=float) / 2.0
    lower = targets - half_extents
    upper = targets + half_extents

    parallel = np.abs(direction) < _RAY_EPSILON
    parallel_outside = parallel & ((origins < lower) | (origins > upper))
    safe_direction = np.where(parallel, 1.0, direction)
    first = (lower - origins) / safe_direction
    second = (upper - origins) / safe_direction
    axis_min = np.where(parallel, -np.inf, np.minimum(first, second))
    axis_max = np.where(parallel, np.inf, np.maximum(first, second))
    ray_min = np.max(axis_min, axis=1)
    ray_max = np.min(axis_max, axis=1)
    return (
        ~np.any(parallel_outside, axis=1)
        & (ray_min <= ray_max)
        & (ray_max >= np.maximum(ray_min, 0.0))
    )


def _geometry(
    ticks: pd.DataFrame,
    eye_height: float,
    fallback_target: Sequence[float] | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    yaw = _finite_column(ticks, "yaw")
    pitch = _finite_column(ticks, "pitch")
    px = _finite_column(ticks, "px")
    pz = _finite_column(ticks, "pz")
    tx = _column(ticks, "tx")
    ty = _column(ticks, "ty")
    tz = _column(ticks, "tz")
    _same_length(yaw, pitch, px, pz, tx, ty, tz)

    origins = np.column_stack((px, np.full(len(px), eye_height), pz))
    targets = np.column_stack((tx, ty, tz))
    missing = ~np.all(np.isfinite(targets), axis=1)
    if np.any(missing):
        if fallback_target is None:
            indices = np.flatnonzero(missing).tolist()
            raise ValueError(f"target position is missing for tick rows {indices}")
        fallback = np.asarray(fallback_target, dtype=float)
        if fallback.shape != (3,) or not np.all(np.isfinite(fallback)):
            raise ValueError("fallback_target must contain three finite coordinates")
        targets[missing] = fallback
    return yaw, pitch, origins, targets


def _aim_forward(yaw: np.ndarray, pitch: np.ndarray) -> np.ndarray:
    cos_pitch = np.cos(pitch)
    return np.column_stack(
        (-np.sin(yaw) * cos_pitch, np.sin(pitch), -np.cos(yaw) * cos_pitch)
    )


def _hitbox(meta: Mapping[str, Any]) -> tuple[float, float, float]:
    _require_mapping(meta, "meta")
    targets = meta.get("targets")
    hitbox = targets.get("hitbox") if isinstance(targets, Mapping) else None
    if hitbox is None:
        return _DEFAULT_HITBOX
    if not isinstance(hitbox, Mapping):
        raise ValueError("meta.targets.hitbox must be an object")
    dimensions = tuple(
        _positive_scalar(hitbox.get(field), f"meta.targets.hitbox.{field}")
        for field in ("widthU", "heightU", "depthU")
    )
    return dimensions


def _column(ticks: pd.DataFrame, name: str) -> np.ndarray:
    if not isinstance(ticks, pd.DataFrame):
        raise TypeError("ticks must be a pandas DataFrame returned by load_export")
    if name not in ticks.columns:
        raise ValueError(f"ticks.{name} is required")
    return ticks[name].to_numpy(dtype=float, copy=True)


def _finite_column(ticks: pd.DataFrame, name: str) -> np.ndarray:
    values = _column(ticks, name)
    if not np.all(np.isfinite(values)):
        raise ValueError(f"ticks.{name} must contain only finite values")
    return values


def _same_length(*values: np.ndarray) -> None:
    if len({len(value) for value in values}) > 1:
        raise ValueError("tick columns must have equal length")


def _finite_scalar(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return float(value)


def _positive_scalar(value: Any, name: str) -> float:
    result = _finite_scalar(value, name)
    if result <= 0:
        raise ValueError(f"{name} must be positive")
    return result


def _require_mapping(value: Any, name: str) -> None:
    if not isinstance(value, Mapping):
        raise TypeError(f"{name} must be a mapping")
