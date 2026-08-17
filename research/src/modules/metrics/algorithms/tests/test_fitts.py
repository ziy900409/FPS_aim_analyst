from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest

from modules.ingest.algorithms.loader import load_export
from modules.kinematics.algorithms.angular import EyeOrigin, resolve_eye_origin
from modules.metrics.algorithms.fitts import (
    DEFAULT_FITTS_PARAMS,
    FITTS_VERSION,
    KNOWN_FITTS_FLAGS,
    FittsParams,
    FittsSample,
    _result,
    fitts_samples,
    target_width_deg,
)
from modules.metrics.algorithms.peek import PeekWindow, build_peek_windows


_TICK_MS = 1000.0 / 128.0
_TARGET = (0.0, 0.0, -10.0)


def _payload(
    *,
    yaw_deg: float = 0.0,
    target: tuple[float, float, float] = _TARGET,
    hitbox: dict | None = None,
    include_hitbox: bool = True,
    include_fire: bool = True,
    include_visible_target: bool = True,
    include_tick_target: bool = True,
    visible_t: float = 0.0,
    fire_t: float = 250.0,
) -> dict:
    meta = {
        "schemaVersion": 2,
        "appVersion": "test",
        "drillId": "fitts_test",
        "weaponId": "h1",
        "weaponSeed": 1,
        "rngSeed": 1,
        "backend": "test",
        "displayHz": 240.0,
        "simHz": 128.0,
        "browser": "pytest",
        "sensitivity": 1.0,
        "sensitivityModel": "linear",
        "movementModel": "stage-a",
        "crossOriginIsolated": True,
        "startedAt": "2026-08-10T00:00:00.000Z",
        "unit": "u",
        "vStrafe": 1.0,
        "maxDrillSeconds": 10.0,
        "lateEventCount": 0,
        "bufferOverflow": False,
        "recorderOverflow": False,
        "suspect": False,
        "participant": {"id": "P001"},
        "scene": {"eye": {"x": 0.0, "y": 0.0, "z": 0.0}},
        "simToWorld": 1.0,
        "targets": {},
    }
    if include_hitbox:
        meta["targets"]["hitbox"] = hitbox or {"widthU": 2.0, "heightU": 2.0, "depthU": 1.0}
    events = [{"type": "visible", "targetId": "target-1", "side": "R", "t": visible_t}]
    if include_visible_target:
        events[0].update({"targetX": target[0], "targetY": target[1], "targetZ": target[2]})
    if include_fire:
        events.append(
            {
                "type": "fire",
                "targetId": "target-1",
                "t": fire_t,
                "firstShot": True,
                "hit": True,
                "offsetDeg": 0.0,
                "residualSpeed": 0.0,
                "shotSeq": 1,
            }
        )
    ticks = []
    for index in range(8):
        tick_t = index * _TICK_MS
        has_target = include_tick_target and tick_t + 1e-9 >= visible_t
        ticks.append(
            {
                "t": tick_t,
                "vx": 0.0,
                "vz": 0.0,
                "px": 0.0,
                "pz": 0.0,
                "tx": target[0] if has_target else None,
                "ty": target[1] if has_target else None,
                "tz": target[2] if has_target else None,
                "aim": {"yaw": math.radians(yaw_deg), "pitch": 0.0},
                "dYaw": 0.0,
                "dPitch": 0.0,
                "keys": [],
                "ads": False,
            }
        )
    return {"meta": meta, "ticks": ticks, "events": events}


def _run(tmp_path: Path, payload: dict, *, params: FittsParams = DEFAULT_FITTS_PARAMS):
    source = tmp_path / "export.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    export = load_export(source)
    peeks = build_peek_windows(export)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    return fitts_samples(peeks, export, eye_origin=eye_origin, params=params)


def test_fitts_params_are_frozen() -> None:
    assert DEFAULT_FITTS_PARAMS == FittsParams(
        min_samples=10, min_d_ratio=2.0, min_id_range_bits=0.5, version=FITTS_VERSION
    )


def test_known_geometry_computes_d_w_id_and_mt(tmp_path: Path) -> None:
    result = _run(tmp_path, _payload(yaw_deg=0.0), params=FittsParams(1, 1.0, 0.01))

    assert result.n == 1
    sample = result.samples[0]
    assert sample.flags == ()
    assert sample.d_deg == pytest.approx(0.0, abs=1e-9)
    assert sample.w_deg == pytest.approx(math.degrees(2.0 * math.atan(1.0 / 10.0)), rel=1e-9)
    assert sample.id_bits == pytest.approx(0.0, abs=1e-9)
    assert sample.mt_ms == pytest.approx(250.0)


def test_d_reuses_spawn_eccentricity_semantics(tmp_path: Path) -> None:
    result = _run(tmp_path, _payload(yaw_deg=-10.0), params=FittsParams(1, 1.0, 0.01))

    assert result.samples[0].d_deg == pytest.approx(10.0, abs=1e-9)


def test_w_missing_hitbox_uses_h1_fallback(tmp_path: Path) -> None:
    payload = _payload(include_hitbox=False)
    source = tmp_path / "export.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    export = load_export(source)
    tick = export.ticks.iloc[0]
    eye_origin = resolve_eye_origin(export.meta, strict=True)

    assert target_width_deg(export.meta, eye_origin, tick, _TARGET) == pytest.approx(
        math.degrees(2.0 * math.atan(0.5 / 10.0)), rel=1e-9
    )


def test_degenerate_geometry_flags_bad_width(tmp_path: Path) -> None:
    result = _run(
        tmp_path,
        _payload(hitbox={"widthU": 0.0, "heightU": 2.0, "depthU": 1.0}),
        params=FittsParams(1, 1.0, 0.01),
    )

    assert result.samples[0].flags == ("degenerate_geometry",)
    assert result.n == 0


def test_no_first_shot_is_flagged_and_excluded(tmp_path: Path) -> None:
    result = _run(tmp_path, _payload(include_fire=False), params=FittsParams(1, 1.0, 0.01))

    assert result.samples[0].flags == ("no_first_shot",)
    assert result.samples[0].mt_ms is None
    assert result.n == 0


def test_missing_target_position_is_flagged(tmp_path: Path) -> None:
    result = _run(
        tmp_path,
        _payload(include_visible_target=False, include_tick_target=False),
        params=FittsParams(1, 1.0, 0.01),
    )

    assert result.samples[0].flags == ("missing_target_position",)
    assert result.samples[0].d_deg is None


def test_result_blocks_when_n_is_insufficient() -> None:
    rows = (
        FittsSample(0, "R", 10.0, 5.0, 1.0, 200.0),
        FittsSample(1, "L", 20.0, 5.0, 2.0, 300.0),
    )

    result = _result(rows, FittsParams(min_samples=3, min_d_ratio=1.0, min_id_range_bits=0.1))

    assert result.status == "blocked-by-data"
    assert result.reason == "insufficient_n"
    assert result.slope_ms_per_bit is None
    assert result.r2 is None
    assert result.throughput_bits_s is None


def test_result_blocks_when_d_ratio_is_insufficient() -> None:
    rows = tuple(
        FittsSample(index, "R", 10.0 + index, 5.0, 1.0 + index * 0.1, 200.0 + index * 10.0)
        for index in range(4)
    )

    result = _result(rows, FittsParams(min_samples=4, min_d_ratio=2.0, min_id_range_bits=0.1))

    assert result.status == "blocked-by-data"
    assert result.reason == "insufficient_d_ratio"
    assert result.d_ratio == pytest.approx(1.3)
    assert result.slope_ms_per_bit is None


def test_result_blocks_when_id_range_is_insufficient() -> None:
    rows = tuple(
        FittsSample(index, "R", 10.0 + index * 10.0, 5.0, 1.0 + index * 0.01, 200.0 + index * 10.0)
        for index in range(4)
    )

    result = _result(rows, FittsParams(min_samples=4, min_d_ratio=2.0, min_id_range_bits=0.1))

    assert result.status == "blocked-by-data"
    assert result.reason == "insufficient_id_range"
    assert result.id_range_bits == pytest.approx(0.03)
    assert result.slope_ms_per_bit is None


def test_regression_recovers_known_linear_data() -> None:
    rows = tuple(
        FittsSample(index, "R", 5.0 * (index + 1), 2.0, float(index + 1), 100.0 + 50.0 * (index + 1))
        for index in range(5)
    )

    result = _result(rows, FittsParams(min_samples=5, min_d_ratio=1.0, min_id_range_bits=1.0))

    assert result.status == "ok"
    assert result.reason == "ok"
    assert result.slope_ms_per_bit == pytest.approx(50.0)
    assert result.intercept_ms == pytest.approx(100.0)
    assert result.r2 == pytest.approx(1.0)
    assert result.throughput_bits_s == pytest.approx(20.0)


def test_non_positive_slope_blocks_throughput() -> None:
    rows = tuple(
        FittsSample(index, "R", 5.0 * (index + 1), 2.0, float(index + 1), 400.0 - 50.0 * index)
        for index in range(5)
    )

    result = _result(rows, FittsParams(min_samples=5, min_d_ratio=1.0, min_id_range_bits=1.0))

    assert result.status == "blocked-by-data"
    assert result.reason == "non_positive_slope"
    assert result.throughput_bits_s is None


def test_unknown_flag_and_reason_vocabularies_are_closed() -> None:
    assert {
        "no_first_shot",
        "missing_target_position",
        "missing_spawn_tick",
        "degenerate_geometry",
    } == KNOWN_FITTS_FLAGS
