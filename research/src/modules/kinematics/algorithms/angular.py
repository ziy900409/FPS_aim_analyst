"""Pure angular kinematics for schema v2 export ticks.

The ingest layer flattens tick aim values to ``yaw`` and ``pitch`` columns in
radians.  This module is the research layer's only radians-to-degrees boundary;
all returned angular quantities are expressed in degrees.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
import math
from typing import Any, Literal

import numpy as np
import pandas as pd


_RAY_EPSILON = 1e-9
_DEFAULT_HITBOX = (1.0, 2.0, 1.0)

#: world unit per source unit — fallback only. KI-004/S1 exports carry the
#: authoritative value in ``meta.simToWorld``; this constant exists so that
#: ``legacy-default`` resolution (pre-S1 exports) still applies the engine's
#: sim->world scale. Mirrors the TS engine constant (``src/loop/constants.ts``);
#: C-D1 forbids importing it, so gate ② binds the two sides to the same closed
#: form instead of trusting them to stay in sync (TD-3).
SIM_TO_WORLD = 0.01

EyeOriginSource = Literal["explicit", "meta", "legacy-default"]


@dataclass(frozen=True)
class EyeOrigin:
    """Resolved ray/ballistic origin (world domain) for one export.

    Mirrors the TypeScript ``ResolvedEyeOrigin`` type in the engine's ``eyeOrigin``
    metrics module (KI-004/S1 T4/T5).
    """

    base: tuple[float, float, float]
    sim_to_world: float
    source: EyeOriginSource


def resolve_eye_origin(
    meta: Mapping[str, Any],
    *,
    eye_base: Sequence[float] | None = None,
    sim_to_world: float | None = None,
    eye_height: float | None = None,
    strict: bool = False,
) -> EyeOrigin:
    """Resolve the eye world base and sim->world scale for ``epsilon_deg``/``on_target``.

    Priority order, mirroring TS ``resolveEyeOrigin`` (KI-004/S1 §2.3a):

    1. ``eye_base`` (explicit) -> ``source="explicit"``.
    2. ``meta["scene"]["eye"]`` + ``meta["simToWorld"]`` (S1 exports carry both) ->
       ``source="meta"``. Both must resolve to finite values; only half a pair is
       treated as a miss, never a half-guess.
    3. Legacy fallback ``(0, eye_height ?? 1.6, 0)`` -> ``source="legacy-default"``.
       The fallback still applies ``sim_to_world`` — that factor is a knowable
       engine constant; only ``base.z`` is unrecoverable from a pre-S1 export.

    ``strict=True`` raises instead of falling to ``legacy-default`` — the research
    entry points (parity generator, ``run_pipeline``) must not silently guess an
    origin that the export cannot self-describe.
    """

    _require_mapping(meta, "meta")
    resolved_sim_to_world = (
        _finite_scalar(sim_to_world, "sim_to_world") if sim_to_world is not None else SIM_TO_WORLD
    )

    if eye_base is not None:
        base = _finite_vec3(eye_base, "eye_base")
        return EyeOrigin(base=base, sim_to_world=resolved_sim_to_world, source="explicit")

    meta_origin = _meta_eye_origin(meta)
    if meta_origin is not None:
        return meta_origin

    if strict:
        raise ValueError(
            "resolve_eye_origin: this export has no meta.scene.eye / meta.simToWorld "
            "(pre-S1); please supply an explicit eye_base (see KI-004 §2.3)"
        )

    default_height = _finite_scalar(eye_height, "eye_height") if eye_height is not None else 1.6
    return EyeOrigin(base=(0.0, default_height, 0.0), sim_to_world=resolved_sim_to_world, source="legacy-default")


def _meta_eye_origin(meta: Mapping[str, Any]) -> EyeOrigin | None:
    scene = meta.get("scene")
    eye = scene.get("eye") if isinstance(scene, Mapping) else None
    sim_to_world = meta.get("simToWorld")
    if not isinstance(eye, Mapping):
        return None
    if isinstance(sim_to_world, bool) or not isinstance(sim_to_world, (int, float)):
        return None
    if not math.isfinite(sim_to_world) or sim_to_world <= 0:
        return None
    try:
        base = _finite_vec3((eye.get("x"), eye.get("y"), eye.get("z")), "meta.scene.eye")
    except ValueError:
        return None
    return EyeOrigin(base=base, sim_to_world=float(sim_to_world), source="meta")


def _finite_vec3(values: Sequence[float], name: str) -> tuple[float, float, float]:
    items = tuple(values)
    if len(items) != 3:
        raise ValueError(f"{name} must contain exactly three coordinates")
    x = _finite_scalar(items[0], f"{name}.x")
    y = _finite_scalar(items[1], f"{name}.y")
    z = _finite_scalar(items[2], f"{name}.z")
    return (x, y, z)


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
    *,
    eye_origin: EyeOrigin,
    fallback_target: Sequence[float] | None = None,
) -> np.ndarray:
    """Return unsigned aim-to-target-center angular error for each tick.

    The ray origin is world domain: ``eye_origin.base + (px, 0, pz) * eye_origin.sim_to_world``
    (KI-004/S1 T4/T5) — callers resolve ``eye_origin`` via :func:`resolve_eye_origin`.
    ``fallback_target`` supplies the presentation's visible-event target center when a
    tick does not carry all three target coordinates.  ``meta`` is kept in the public
    contract alongside :func:`on_target`; epsilon itself does not depend on hitbox
    dimensions.
    """

    _require_mapping(meta, "meta")
    _require_eye_origin(eye_origin)
    yaw, pitch, origins, targets = _geometry(ticks, eye_origin, fallback_target)
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
    *,
    eye_origin: EyeOrigin,
    fallback_target: Sequence[float] | None = None,
) -> np.ndarray:
    """Return whether each tick's aim ray intersects the resolved H1 AABB.

    See :func:`epsilon_deg` for the ``eye_origin`` ray-origin contract.
    """

    _require_eye_origin(eye_origin)
    width, height, depth = _hitbox(meta)
    yaw, pitch, origins, targets = _geometry(ticks, eye_origin, fallback_target)
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
    eye_origin: EyeOrigin,
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

    offsets = np.column_stack((px, np.zeros(len(px)), pz)) * eye_origin.sim_to_world
    origins = np.asarray(eye_origin.base, dtype=float) + offsets
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


def _require_eye_origin(value: Any) -> None:
    if not isinstance(value, EyeOrigin):
        raise TypeError("eye_origin must be an EyeOrigin instance (see resolve_eye_origin)")
