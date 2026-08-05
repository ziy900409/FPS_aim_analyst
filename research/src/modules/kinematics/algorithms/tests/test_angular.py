from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from modules.kinematics.algorithms.angular import epsilon_deg, omega_deg_s, on_target


def _ticks(
    *,
    times: tuple[float, ...] = (0.0, 1000.0),
    yaws: tuple[float, ...] = (0.0, 0.0),
    pitches: tuple[float, ...] = (0.0, 0.0),
    target: tuple[float, float, float] = (0.0, 1.6, -10.0),
) -> pd.DataFrame:
    count = len(times)
    return pd.DataFrame(
        {
            "t": times,
            "yaw": yaws,
            "pitch": pitches,
            "px": np.zeros(count),
            "pz": np.zeros(count),
            "tx": np.full(count, target[0]),
            "ty": np.full(count, target[1]),
            "tz": np.full(count, target[2]),
        }
    )


@pytest.mark.parametrize(
    ("yaws", "pitches", "expected_deg_s"),
    [
        (
            (0.0, math.radians(30.0)),
            (0.0, math.radians(40.0)),
            math.hypot(30.0 * math.cos(math.radians(20.0)), 40.0),
        ),
        ((0.0, math.radians(90.0)), (0.0, 0.0), 90.0),
        ((0.0, 0.0), (0.0, math.radians(45.0)), 45.0),
        (
            (0.0, math.radians(90.0)),
            (math.radians(80.0), math.radians(80.0)),
            90.0 * math.cos(math.radians(80.0)),
        ),
    ],
    ids=("combined", "pure-yaw", "pure-pitch", "high-pitch-correction"),
)
def test_omega_known_geometry(
    yaws: tuple[float, float],
    pitches: tuple[float, float],
    expected_deg_s: float,
) -> None:
    result = omega_deg_s(_ticks(yaws=yaws, pitches=pitches))

    assert math.isnan(result[0])
    assert result[1] == pytest.approx(expected_deg_s, rel=1e-6)


def test_omega_uses_adjacent_midpoint_pitch() -> None:
    result = omega_deg_s(
        _ticks(
            yaws=(0.0, math.radians(60.0)),
            pitches=(math.radians(60.0), math.radians(80.0)),
        )
    )
    expected = math.hypot(60.0 * math.cos(math.radians(70.0)), 20.0)

    assert result[1] == pytest.approx(expected, rel=1e-6)


def test_epsilon_is_zero_at_target_center() -> None:
    result = epsilon_deg(_ticks(), {})

    np.testing.assert_allclose(result, (0.0, 0.0), atol=1e-12)


def test_epsilon_recovers_known_unsigned_offset() -> None:
    result = epsilon_deg(_ticks(yaws=(math.radians(12.0),) * 2), {})

    np.testing.assert_allclose(result, (12.0, 12.0), rtol=1e-12, atol=1e-12)


def test_missing_tick_target_uses_visible_event_fallback() -> None:
    ticks = _ticks()
    ticks.loc[0, ["tx", "ty", "tz"]] = np.nan

    epsilon = epsilon_deg(ticks, {}, fallback_target=(0.0, 1.6, -10.0))
    covered = on_target(ticks, {}, fallback_target=(0.0, 1.6, -10.0))

    assert epsilon[0] == pytest.approx(0.0, abs=1e-12)
    assert covered.tolist() == [True, True]


def test_on_target_resolves_meta_hitbox_before_h1_fallback() -> None:
    ticks = _ticks(target=(0.75, 1.6, -10.0))
    wide_hitbox = {
        "targets": {"hitbox": {"widthU": 2.0, "heightU": 2.0, "depthU": 1.0}}
    }

    assert on_target(ticks, wide_hitbox).tolist() == [True, True]
    assert on_target(ticks, {}).tolist() == [False, False]
