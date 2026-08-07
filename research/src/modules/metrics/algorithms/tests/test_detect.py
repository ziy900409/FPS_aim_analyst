from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from modules.ingest.algorithms import load_export, make_synthetic_export
from modules.ingest.algorithms.synthetic import SyntheticSpec
from modules.kinematics.algorithms.angular import resolve_eye_origin
from modules.metrics.algorithms.detect import DEFAULT_DETECT_PARAMS, detect_samples
from modules.metrics.algorithms.peek import build_peek_windows


_SIM_HZ = 128
_TICK_MS = 1000.0 / _SIM_HZ
_TARGET = (0.0, 1.6, -4.0)
_BASE_YAW_DEG = 10.0


def _yaw_deg_at(tick: int, onset_tick: int, speed_deg_per_tick: float, noise_deg: float) -> float:
    noise = noise_deg * math.sin(tick * 0.73)
    if speed_deg_per_tick == 0 or tick < onset_tick:
        return _BASE_YAW_DEG + noise
    movement_ticks = tick - onset_tick + 1
    return max(0.0, _BASE_YAW_DEG - movement_ticks * speed_deg_per_tick) + noise


def _detect_payload(
    *,
    visible_tick: int,
    onset_tick: int,
    speed_deg_per_tick: float,
    noise_deg: float,
    visible_has_target: bool = True,
    tick_has_target: bool = True,
    total_ticks: int | None = None,
) -> dict:
    if total_ticks is None:
        total_ticks = max(onset_tick + 18, visible_tick + 32)
    meta = make_synthetic_export(SyntheticSpec(peek_count=1))["meta"]
    meta["drillId"] = "detect_popin_test"
    ticks = []
    events = []
    for tick in range(total_ticks + 1):
        t = tick * _TICK_MS
        if tick == visible_tick:
            visible_event = {"type": "visible", "targetId": "target-1", "side": "R", "t": t}
            if visible_has_target:
                visible_event.update(
                    {"targetX": _TARGET[0], "targetY": _TARGET[1], "targetZ": _TARGET[2]}
                )
            events.append(visible_event)
        has_target = tick >= visible_tick and tick_has_target
        ticks.append(
            {
                "t": t,
                "vx": 0.0,
                "vz": 0.0,
                "px": 0.0,
                "pz": 0.0,
                "tx": _TARGET[0] if has_target else None,
                "ty": _TARGET[1] if has_target else None,
                "tz": _TARGET[2] if has_target else None,
                "aim": {
                    "yaw": math.radians(_yaw_deg_at(tick, onset_tick, speed_deg_per_tick, noise_deg)),
                    "pitch": 0.0,
                },
                "keys": [],
                "ads": False,
            }
        )
    return {"meta": meta, "ticks": ticks, "events": events}


def _only_sample(tmp_path: Path, **kwargs):
    payload = _detect_payload(**kwargs)
    source = tmp_path / "export.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    export = load_export(source)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    peeks = build_peek_windows(export)
    samples = detect_samples(export, peeks, eye_origin=eye_origin)
    assert len(samples) == 1
    return samples[0]


@pytest.mark.parametrize(
    ("speed_deg_per_tick", "noise_deg"),
    [(1.2, 0.005), (1.2, 0.08), (0.55, 0.005), (0.55, 0.08)],
    ids=("fast-low-noise", "fast-high-noise", "slow-low-noise", "slow-high-noise"),
)
def test_recovers_known_onset_within_one_tick(
    tmp_path: Path, speed_deg_per_tick: float, noise_deg: float
) -> None:
    visible_tick, onset_tick = 80, 100
    sample = _only_sample(
        tmp_path,
        visible_tick=visible_tick,
        onset_tick=onset_tick,
        speed_deg_per_tick=speed_deg_per_tick,
        noise_deg=noise_deg,
    )

    assert sample.status == "detected"
    assert sample.t_detect is not None
    assert abs(sample.t_detect - onset_tick * _TICK_MS) <= _TICK_MS + 1e-9
    assert sample.baseline_insufficient is False
    assert sample.flags == ()


def test_returns_timeout_when_no_sustained_decrease(tmp_path: Path) -> None:
    sample = _only_sample(
        tmp_path, visible_tick=80, onset_tick=100, speed_deg_per_tick=0.0, noise_deg=0.0
    )

    assert sample.status == "timeout"
    assert sample.t_detect is None
    assert sample.anticipation is False


def test_flags_first_presentation_short_baseline_as_insufficient(tmp_path: Path) -> None:
    sample = _only_sample(
        tmp_path, visible_tick=3, onset_tick=20, speed_deg_per_tick=1.0, noise_deg=0.005
    )

    assert sample.baseline_insufficient is True
    assert sample.status == "detected"


def test_flags_detections_below_human_rt_lower_bound_as_anticipation(tmp_path: Path) -> None:
    visible_tick, onset_tick = 80, 86
    sample = _only_sample(
        tmp_path,
        visible_tick=visible_tick,
        onset_tick=onset_tick,
        speed_deg_per_tick=1.2,
        noise_deg=0.005,
    )
    reaction_ms = (onset_tick - visible_tick) * _TICK_MS

    assert sample.status == "detected"
    assert reaction_ms < DEFAULT_DETECT_PARAMS.anticipation_ms
    assert sample.anticipation is True


def test_missing_tick_target_center_falls_back_to_visible_event(tmp_path: Path) -> None:
    with_tick_target = _only_sample(
        tmp_path, visible_tick=80, onset_tick=100, speed_deg_per_tick=1.2, noise_deg=0.005
    )
    fallback = _only_sample(
        tmp_path,
        visible_tick=80,
        onset_tick=100,
        speed_deg_per_tick=1.2,
        noise_deg=0.005,
        tick_has_target=False,
    )

    # Same visible-event target center in both scenarios; forcing every tick's own tx/ty/tz to
    # be absent must fall back to an identical result (spec: "目標中心缺席時以 visible.targetX/Y/Z
    # 為 fallback").
    assert fallback == with_tick_target


def test_both_target_sources_missing_flags_instead_of_crashing(tmp_path: Path) -> None:
    sample = _only_sample(
        tmp_path,
        visible_tick=80,
        onset_tick=100,
        speed_deg_per_tick=1.2,
        noise_deg=0.005,
        visible_has_target=False,
        tick_has_target=False,
    )

    assert sample.flags == ("missing_target_position",)
    assert sample.status == "timeout"
    assert math.isnan(sample.eccentricity_at_spawn_deg)


def test_window_boundary_does_not_leak_into_next_presentation(tmp_path: Path) -> None:
    """Two back-to-back presentations: peek 0 never moves (must stay ``timeout``) while peek 1
    starts moving the instant it becomes visible (must be ``detected``). If a peek's post-window
    search were not bounded by its own ``t_end`` (spec: "不得讓一個 target 的樣本洩漏進下一個
    target"), peek 0 would pick up peek 1's decrease and falsely report ``detected``."""

    ticks_per_peek = 60
    meta = make_synthetic_export(SyntheticSpec(peek_count=1))["meta"]
    meta["drillId"] = "detect_popin_boundary_test"
    onset_local_by_peek = {0: None, 1: 0}  # peek 0 never moves; peek 1 moves from its first tick.
    ticks = []
    events = []
    for peek_index in range(2):
        base_tick = peek_index * ticks_per_peek
        onset_local = onset_local_by_peek[peek_index]
        for local in range(ticks_per_peek):
            tick = base_tick + local
            t = tick * _TICK_MS
            if local == 0:
                events.append(
                    {
                        "type": "visible",
                        "targetId": f"target-{peek_index + 1}",
                        "side": "R",
                        "t": t,
                        "targetX": _TARGET[0],
                        "targetY": _TARGET[1],
                        "targetZ": _TARGET[2],
                    }
                )
            if onset_local is None:
                yaw_deg = _BASE_YAW_DEG
            else:
                yaw_deg = _yaw_deg_at(local, onset_local, 1.2, 0.0)
            ticks.append(
                {
                    "t": t,
                    "vx": 0.0,
                    "vz": 0.0,
                    "px": 0.0,
                    "pz": 0.0,
                    "tx": _TARGET[0],
                    "ty": _TARGET[1],
                    "tz": _TARGET[2],
                    "aim": {"yaw": math.radians(yaw_deg), "pitch": 0.0},
                    "keys": [],
                    "ads": False,
                }
            )
    payload = {"meta": meta, "ticks": ticks, "events": events}
    source = tmp_path / "export.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    export = load_export(source)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    peeks = build_peek_windows(export)
    samples = detect_samples(export, peeks, eye_origin=eye_origin)

    assert len(samples) == 2
    assert samples[0].status == "timeout"
    assert samples[0].t_detect is None
    assert samples[1].status == "detected"
    assert samples[1].t_detect is not None
    assert samples[1].t_detect >= ticks_per_peek * _TICK_MS
