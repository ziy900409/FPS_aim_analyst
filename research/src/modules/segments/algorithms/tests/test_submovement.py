from __future__ import annotations

from dataclasses import FrozenInstanceError
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import pytest

from modules.segments.algorithms import (
    DEFAULT_SEGMENT_PARAMS,
    SEG_V2_PARAMS,
    SegmentList,
    SegmentParams,
    segment_submovements,
)


def _profile(
    length: int,
    pulses: tuple[tuple[int, int, float], ...],
    *,
    first_nan: bool = True,
) -> np.ndarray:
    values = np.zeros(length, dtype=float)
    for start, end, amplitude in pulses:
        phase = np.linspace(0.0, np.pi, end - start + 1)
        values[start : end + 1] = np.maximum(
            values[start : end + 1], amplitude * np.sin(phase)
        )
    if first_nan:
        values[0] = np.nan
    return values


@pytest.mark.parametrize(
    ("name", "signal", "expected"),
    [
        (
            "single_flick",
            _profile(48, ((10, 26, 720.0),)),
            (("primary_flick", 10, 26),),
        ),
        (
            "flick_plus_one_micro",
            _profile(64, ((6, 20, 720.0), (34, 44, 360.0))),
            (("primary_flick", 6, 20), ("micro_adjustment", 34, 44)),
        ),
        (
            "flick_plus_three_micro",
            _profile(
                88,
                ((4, 18, 720.0), (28, 38, 390.0), (48, 58, 360.0), (68, 78, 330.0)),
            ),
            (
                ("primary_flick", 4, 18),
                ("micro_adjustment", 28, 38),
                ("micro_adjustment", 48, 58),
                ("micro_adjustment", 68, 78),
            ),
        ),
    ],
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_known_submovement_boundaries_are_within_two_ticks(
    name: str,
    signal: np.ndarray,
    expected: tuple[tuple[str, int, int], ...],
) -> None:
    del name

    result = segment_submovements(signal)

    assert [segment.kind for segment in result] == [item[0] for item in expected]
    for segment, (_, expected_start, expected_end) in zip(result, expected, strict=True):
        assert abs(segment.start_idx - expected_start) <= 2
        assert abs(segment.end_idx - expected_end) <= 2


@pytest.mark.parametrize(
    ("name", "signal", "expected"),
    [
        (
            "single_flick",
            _profile(48, ((10, 26, 720.0),)),
            (("primary_flick", 10, 26),),
        ),
        (
            "flick_plus_one_micro",
            _profile(64, ((6, 20, 720.0), (34, 44, 360.0))),
            (("primary_flick", 6, 20), ("micro_adjustment", 34, 44)),
        ),
        (
            "flick_plus_three_micro",
            _profile(
                88,
                ((4, 18, 720.0), (28, 38, 390.0), (48, 58, 360.0), (68, 78, 330.0)),
            ),
            (
                ("primary_flick", 4, 18),
                ("micro_adjustment", 28, 38),
                ("micro_adjustment", 48, 58),
                ("micro_adjustment", 68, 78),
            ),
        ),
    ],
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_seg_v2_known_submovement_boundaries_are_within_two_ticks(
    name: str,
    signal: np.ndarray,
    expected: tuple[tuple[str, int, int], ...],
) -> None:
    """KI-005-A / A2-T3: seg-v2 must pass the same pre-registered synthetic cases as seg-v1."""
    del name

    result = segment_submovements(signal, SEG_V2_PARAMS)

    assert [segment.kind for segment in result] == [item[0] for item in expected]
    for segment, (_, expected_start, expected_end) in zip(result, expected, strict=True):
        assert abs(segment.start_idx - expected_start) <= 2
        assert abs(segment.end_idx - expected_end) <= 2


def test_zero_motion_returns_empty_segments_with_flags() -> None:
    result = segment_submovements(np.zeros(32))

    assert isinstance(result, SegmentList)
    assert isinstance(result, list)
    assert result == []
    assert result.flags == ("zero_motion", "below_floor")


def test_constant_motion_returns_empty_segments_with_no_peak_flag() -> None:
    result = segment_submovements(np.full(32, 240.0))

    assert result == []
    assert result.flags == ("no_peak",)


def test_tightly_spaced_double_peak_does_not_fragment() -> None:
    signal = np.zeros(32, dtype=float)
    signal[8:18] = (0.0, 120.0, 360.0, 720.0, 420.0, 520.0, 680.0, 360.0, 120.0, 0.0)

    result = segment_submovements(signal)

    assert len(result) == 1
    assert result[0].kind == "primary_flick"


def test_short_signal_uses_explicit_sg_fallback_flag() -> None:
    result = segment_submovements(np.asarray((0.0, 300.0, 0.0)))

    assert len(result) == 1
    assert result.flags == ("sg_fallback_short_signal",)
    assert result[0].flags == ("sg_fallback_short_signal",)


def test_window_edge_truncation_is_flagged() -> None:
    signal = np.asarray((300.0, 500.0, 700.0, 500.0, 300.0, 200.0, 180.0))

    result = segment_submovements(signal)

    assert len(result) == 1
    assert "truncated_at_window_edge" in result[0].flags


def test_segment_params_are_frozen_and_versioned() -> None:
    assert DEFAULT_SEGMENT_PARAMS.version == "seg-v1"
    with pytest.raises(FrozenInstanceError):
        DEFAULT_SEGMENT_PARAMS.sg_window = 9  # type: ignore[misc]


def test_seg_v2_params_are_frozen_versioned_and_distinct_from_seg_v1() -> None:
    """KI-005-A / A2-T3 (D-28.7): seg-v2 is additive -- seg-v1 stays unchanged alongside it."""
    assert SEG_V2_PARAMS.version == "seg-v2"
    assert SEG_V2_PARAMS.sg_window != DEFAULT_SEGMENT_PARAMS.sg_window
    with pytest.raises(FrozenInstanceError):
        SEG_V2_PARAMS.sg_window = 7  # type: ignore[misc]


@pytest.mark.parametrize(
    "overrides",
    [
        {"sg_window": 6},
        {"sg_poly": 7},
        {"peak_sigma_k": -0.1},
        {"peak_floor_deg_s": 0.0},
        {"low_ratio": 0.3, "stop_ratio": 0.2},
        {"version": ""},
    ],
)
def test_segment_params_reject_invalid_contracts(overrides: dict[str, object]) -> None:
    values = {
        "sg_window": 7,
        "sg_poly": 3,
        "peak_sigma_k": 0.5,
        "peak_floor_deg_s": 80.0,
        "low_ratio": 0.1,
        "stop_ratio": 0.2,
        "version": "seg-test",
    }
    values.update(overrides)

    with pytest.raises(ValueError):
        SegmentParams(**values)  # type: ignore[arg-type]


def test_submovement_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    source_root = Path(__file__).resolve().parents[4]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import modules.segments.algorithms.submovement; "
        "assert not any(name == 'matplotlib' or name.startswith('matplotlib.') for name in sys.modules)"
    )

    completed = subprocess.run(
        [sys.executable, "-c", command],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout == ""
    assert list(tmp_path.iterdir()) == []
