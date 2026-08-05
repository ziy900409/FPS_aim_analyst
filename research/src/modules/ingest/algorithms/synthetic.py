"""Deterministic schema v2 synthetic export generation.

No clock or random source is consulted. ``omega_profiles_deg_s`` controls the known angular
velocity applied between consecutive ticks and is intended for later kinematics/segmentation
fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any


@dataclass(frozen=True)
class SyntheticSpec:
    peek_count: int = 2
    sides: tuple[str, ...] = ("L", "R")
    ticks_per_peek: int = 24
    sim_hz: int = 128
    omega_profiles_deg_s: tuple[tuple[float, ...], ...] | None = None
    missing_counter_peeks: frozenset[int] = frozenset()
    missing_release_peeks: frozenset[int] = frozenset()
    dropped_tick_indices: tuple[int, ...] = ()
    seed: int = 2801

    def __post_init__(self) -> None:
        if self.peek_count <= 0:
            raise ValueError("peek_count must be positive")
        if self.ticks_per_peek < 16:
            raise ValueError("ticks_per_peek must be at least 16")
        if self.sim_hz <= 0:
            raise ValueError("sim_hz must be positive")
        if not self.sides or any(side not in ("L", "R") for side in self.sides):
            raise ValueError("sides must contain only 'L' and 'R'")
        for index in self.missing_counter_peeks | self.missing_release_peeks:
            if index < 0 or index >= self.peek_count:
                raise ValueError("missing-event peek index is out of range")
        total_ticks = self.peek_count * self.ticks_per_peek
        if len(set(self.dropped_tick_indices)) != len(self.dropped_tick_indices):
            raise ValueError("dropped_tick_indices must be unique")
        if any(index < 0 or index >= total_ticks for index in self.dropped_tick_indices):
            raise ValueError("dropped tick index is out of range")
        if self.omega_profiles_deg_s is not None:
            if len(self.omega_profiles_deg_s) != self.peek_count:
                raise ValueError("omega_profiles_deg_s must contain one profile per peek")
            if any(len(profile) != self.ticks_per_peek for profile in self.omega_profiles_deg_s):
                raise ValueError("each omega profile must match ticks_per_peek")


def make_synthetic_export(spec: SyntheticSpec) -> dict[str, Any]:
    """Create a schema-faithful deterministic v2 payload without writing it to disk."""

    dt_ms = 1000.0 / spec.sim_hz
    dt_sec = 1.0 / spec.sim_hz
    dropped = set(spec.dropped_tick_indices)
    ticks: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    player_x = 0.0
    shot_seq = 1

    for peek_index in range(spec.peek_count):
        side = spec.sides[peek_index % len(spec.sides)]
        original_key = "A" if side == "L" else "D"
        counter_key = "D" if side == "L" else "A"
        target_x = -1.0 if side == "L" else 1.0
        target_y = 1.6
        target_z = -10.0
        target_yaw = -math.atan2(target_x, -target_z)
        yaw = target_yaw + math.radians(6.0)
        profile = _profile(spec, peek_index)
        base_tick = peek_index * spec.ticks_per_peek
        yaw_values: list[float] = []

        for local_index in range(spec.ticks_per_peek):
            global_index = base_tick + local_index
            if local_index > 0:
                yaw += math.radians(profile[local_index]) * dt_sec
            yaw_values.append(yaw)
            keys = _keys_for_tick(spec, peek_index, local_index, original_key, counter_key)
            vx = 250.0 * (("D" in keys) - ("A" in keys))
            player_x += vx * dt_sec
            if global_index in dropped:
                continue
            ticks.append(
                {
                    "t": global_index * dt_ms,
                    "vx": vx,
                    "vz": 0.0,
                    "px": player_x,
                    "pz": 0.0,
                    "tx": target_x,
                    "ty": target_y,
                    "tz": target_z,
                    "aim": {"yaw": yaw, "pitch": 0.0},
                    "keys": keys,
                    "ads": 8 <= local_index <= 12,
                }
            )

        visible_t = base_tick * dt_ms
        fire_index = 12
        fire_t = (base_tick + fire_index) * dt_ms
        events.append(
            {
                "type": "visible",
                "targetId": f"target-{peek_index + 1}",
                "side": side,
                "t": visible_t,
                "targetX": target_x,
                "targetY": target_y,
                "targetZ": target_z,
            }
        )
        if peek_index not in spec.missing_counter_peeks:
            events.append({"type": "counter", "key": counter_key, "t": (base_tick + 5) * dt_ms})
        events.append({"type": "ads", "down": True, "t": (base_tick + 8) * dt_ms})
        projectile = peek_index % 2 == 1
        events.append(
            {
                "type": "fire",
                "t": fire_t,
                "targetId": f"target-{peek_index + 1}",
                "hit": not projectile,
                "firstShot": True,
                "residualSpeed": 0.0,
                "shotSeq": shot_seq,
                "viewYaw": yaw_values[fire_index],
                "viewPitch": 0.0,
                "aimPunchPitch": 0.0,
                "aimPunchYaw": 0.0,
                "spreadX": 0.0,
                "spreadY": 0.0,
                "recoilIndex": 0,
                "ammo": 30 - peek_index,
                "offsetDeg": 0.0,
            }
        )
        if projectile:
            events.append(
                {
                    "type": "hit",
                    "t": fire_t + 2 * dt_ms,
                    "targetId": f"target-{peek_index + 1}",
                    "shotSeq": shot_seq,
                    "timeOfFlightMs": 2 * dt_ms,
                    "part": "body",
                }
            )
        events.append({"type": "ads", "down": False, "t": (base_tick + 13) * dt_ms})
        shot_seq += 1

    event_order = {"visible": 0, "counter": 1, "ads": 2, "fire": 3, "hit": 4}
    events.sort(key=lambda event: (event["t"], event_order[event["type"]]))
    frame_series = [1000.0 / 144.0] * 3
    return {
        "meta": {
            "schemaVersion": 2,
            "drillId": "synthetic_counterstrafe_v2",
            "weaponId": "ak47_synthetic",
            "weaponSeed": spec.seed,
            "rngSeed": spec.seed,
            "backend": "webgl2",
            "displayHz": 144.0,
            "simHz": spec.sim_hz,
            "browser": "synthetic",
            "sensitivity": 1.0,
            "sensitivityModel": "cs2-0.022deg",
            "movementModel": "cs2-source",
            "crossOriginIsolated": True,
            "startedAt": "2026-01-01T00:00:00.000Z",
            "unit": "source",
            "vStrafe": 250.0,
            "maxDrillSeconds": 30.0,
            "lateEventCount": 0,
            "bufferOverflow": False,
            "recorderOverflow": False,
            "suspect": False,
            "weapon": {
                "id": "ak47_synthetic",
                "ads": {"fovDeg": 40.0, "sensitivityRatio": 1.0},
                "bullet": {"model": "projectile", "speedU": 916.73, "gravityU": 32.0, "maxRangeU": 143.24},
                "projectileOverflow": False,
            },
            "targets": {"hitbox": {"widthU": 1.0, "heightU": 2.0, "depthU": 1.0}},
            "scene": {"sceneId": "placeholder-room", "assetPackVersion": "synthetic-v1", "clutterTier": "low", "fallback": False},
            "display": {
                "mode": "fhd-1080",
                "bufferW": 1920,
                "bufferH": 1080,
                "cssW": 1920,
                "cssH": 1080,
                "dpr": 1.0,
                "screenW": 1920,
                "screenH": 1080,
                "fullscreen": True,
                "refreshEstimateHz": 144.0,
            },
            "session": {"participantId": "anonymous-synthetic", "sessionLabel": "fixture"},
            "frames": {
                "series": frame_series,
                "summary": {
                    "count": len(frame_series),
                    "p50": frame_series[0],
                    "p95": frame_series[0],
                    "p99": frame_series[0],
                    "overBudgetWindows": 0,
                    "overflow": False,
                },
            },
        },
        "ticks": ticks,
        "events": events,
    }


def _profile(spec: SyntheticSpec, peek_index: int) -> tuple[float, ...]:
    if spec.omega_profiles_deg_s is not None:
        return spec.omega_profiles_deg_s[peek_index]
    values = [0.0] * spec.ticks_per_peek
    primary = (-40.0, -80.0, -120.0, -160.0, -120.0, -80.0, -40.0)
    for offset, value in enumerate(primary, start=2):
        if offset < len(values):
            values[offset] = value
    micro = (25.0, 40.0, 25.0)
    for offset, value in enumerate(micro, start=13):
        if offset < len(values):
            values[offset] = value
    return tuple(values)


def _keys_for_tick(
    spec: SyntheticSpec,
    peek_index: int,
    local_index: int,
    original_key: str,
    counter_key: str,
) -> list[str]:
    if peek_index in spec.missing_release_peeks:
        keys = [original_key]
        if peek_index not in spec.missing_counter_peeks and 5 <= local_index < 8:
            keys.append(counter_key)
        return keys
    if local_index < 4:
        return [original_key]
    if peek_index not in spec.missing_counter_peeks and 5 <= local_index < 8:
        return [counter_key]
    return []
