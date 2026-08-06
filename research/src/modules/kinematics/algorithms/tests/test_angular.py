from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from modules.ingest.algorithms.loader import load_export
from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export
from modules.kinematics.algorithms.angular import (
    SIM_TO_WORLD,
    EyeOrigin,
    epsilon_deg,
    omega_deg_s,
    on_target,
    resolve_eye_origin,
)

_DEFAULT_EYE_ORIGIN = EyeOrigin(base=(0.0, 1.6, 0.0), sim_to_world=SIM_TO_WORLD, source="explicit")


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

    assert result.source == "aim-diff-legacy"
    assert math.isnan(result.values[0])
    assert result.values[1] == pytest.approx(expected_deg_s, rel=1e-6)


def test_omega_uses_adjacent_midpoint_pitch() -> None:
    result = omega_deg_s(
        _ticks(
            yaws=(0.0, math.radians(60.0)),
            pitches=(math.radians(60.0), math.radians(80.0)),
        )
    )
    expected = math.hypot(60.0 * math.cos(math.radians(70.0)), 20.0)

    assert result.values[1] == pytest.approx(expected, rel=1e-6)


# --- KI-005 / A T5 — omega source resolution (FR-A-11) ---


def test_omega_falls_back_to_legacy_when_tick_columns_are_absent() -> None:
    result = omega_deg_s(_ticks())

    assert result.source == "aim-diff-legacy"


def test_omega_prefers_tick_integral_when_both_columns_are_finite() -> None:
    ticks = _ticks()
    ticks["d_yaw"] = [0.0, 0.0]
    ticks["d_pitch"] = [0.0, 0.0]

    result = omega_deg_s(ticks)

    assert result.source == "tick-integral"


def test_omega_treats_half_present_pair_as_a_miss() -> None:
    ticks = _ticks()
    ticks["d_yaw"] = [0.0, 0.0]
    ticks["d_pitch"] = [float("nan"), float("nan")]

    result = omega_deg_s(ticks)

    assert result.source == "aim-diff-legacy"


def test_omega_strict_raises_when_tick_columns_are_absent() -> None:
    with pytest.raises(ValueError, match="d_yaw|d_pitch|KI-005"):
        omega_deg_s(_ticks(), strict=True)


def test_omega_strict_does_not_raise_when_tick_columns_are_present() -> None:
    ticks = _ticks()
    ticks["d_yaw"] = [0.0, 0.0]
    ticks["d_pitch"] = [0.0, 0.0]

    result = omega_deg_s(ticks, strict=True)

    assert result.source == "tick-integral"


def test_omega_index_zero_is_nan_under_both_sources() -> None:
    legacy = omega_deg_s(_ticks())
    ticks = _ticks()
    ticks["d_yaw"] = [0.0, 0.0]
    ticks["d_pitch"] = [0.0, 0.0]
    tick_integral = omega_deg_s(ticks)

    assert math.isnan(legacy.values[0])
    assert math.isnan(tick_integral.values[0])


def test_omega_two_derivations_agree_on_self_consistent_synthetic_fixture(tmp_path) -> None:
    """No second definition (FM-5/C-D4): d_yaw/d_pitch mirror the aim series exactly here, so the
    tick-integral and legacy derivations must agree bit-for-bit on the synthetic fixture."""

    payload = make_synthetic_export(SyntheticSpec())
    source = tmp_path / "synthetic.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    ticks = load_export(source).ticks

    tick_integral = omega_deg_s(ticks)
    legacy = omega_deg_s(ticks.drop(columns=["d_yaw", "d_pitch"]))

    assert tick_integral.source == "tick-integral"
    assert legacy.source == "aim-diff-legacy"
    np.testing.assert_array_equal(tick_integral.values, legacy.values)


def test_epsilon_is_zero_at_target_center() -> None:
    result = epsilon_deg(_ticks(), {}, eye_origin=_DEFAULT_EYE_ORIGIN)

    np.testing.assert_allclose(result, (0.0, 0.0), atol=1e-12)


def test_epsilon_recovers_known_unsigned_offset() -> None:
    result = epsilon_deg(_ticks(yaws=(math.radians(12.0),) * 2), {}, eye_origin=_DEFAULT_EYE_ORIGIN)

    np.testing.assert_allclose(result, (12.0, 12.0), rtol=1e-12, atol=1e-12)


def test_missing_tick_target_uses_visible_event_fallback() -> None:
    ticks = _ticks()
    ticks.loc[0, ["tx", "ty", "tz"]] = np.nan

    epsilon = epsilon_deg(ticks, {}, eye_origin=_DEFAULT_EYE_ORIGIN, fallback_target=(0.0, 1.6, -10.0))
    covered = on_target(ticks, {}, eye_origin=_DEFAULT_EYE_ORIGIN, fallback_target=(0.0, 1.6, -10.0))

    assert epsilon[0] == pytest.approx(0.0, abs=1e-12)
    assert covered.tolist() == [True, True]


def test_on_target_resolves_meta_hitbox_before_h1_fallback() -> None:
    ticks = _ticks(target=(0.75, 1.6, -10.0))
    wide_hitbox = {
        "targets": {"hitbox": {"widthU": 2.0, "heightU": 2.0, "depthU": 1.0}}
    }

    assert on_target(ticks, wide_hitbox, eye_origin=_DEFAULT_EYE_ORIGIN).tolist() == [True, True]
    assert on_target(ticks, {}, eye_origin=_DEFAULT_EYE_ORIGIN).tolist() == [False, False]


# --- KI-004 / S1 T5 — resolve_eye_origin: mirrors TS `resolveEyeOrigin` branch-for-branch ---


def _meta(**overrides: object) -> dict[str, object]:
    return dict(overrides)


def test_resolve_eye_origin_prefers_explicit_over_meta() -> None:
    meta = _meta(simToWorld=0.02, scene={"eye": {"x": 9.0, "y": 9.0, "z": 9.0}})

    resolved = resolve_eye_origin(meta, eye_base=(1.0, 2.0, 3.0), sim_to_world=0.05)

    assert resolved == EyeOrigin(base=(1.0, 2.0, 3.0), sim_to_world=0.05, source="explicit")


def test_resolve_eye_origin_explicit_defaults_sim_to_world_to_engine_constant() -> None:
    resolved = resolve_eye_origin({}, eye_base=(1.0, 2.0, 3.0))

    assert resolved == EyeOrigin(base=(1.0, 2.0, 3.0), sim_to_world=SIM_TO_WORLD, source="explicit")


def test_resolve_eye_origin_resolves_meta_branch_when_both_present() -> None:
    meta = _meta(simToWorld=0.01, scene={"eye": {"x": 0.0, "y": 1.6, "z": 4.0}})

    resolved = resolve_eye_origin(meta)

    assert resolved == EyeOrigin(base=(0.0, 1.6, 4.0), sim_to_world=0.01, source="meta")


def test_resolve_eye_origin_allows_zero_eye_z_br_field() -> None:
    meta = _meta(simToWorld=0.01, scene={"eye": {"x": 0.0, "y": 1.6, "z": 0.0}})

    resolved = resolve_eye_origin(meta)

    assert resolved.source == "meta"
    assert resolved.base == (0.0, 1.6, 0.0)


def test_resolve_eye_origin_half_meta_miss_missing_sim_to_world() -> None:
    meta = _meta(scene={"eye": {"x": 0.0, "y": 1.6, "z": 4.0}})

    resolved = resolve_eye_origin(meta)

    assert resolved == EyeOrigin(base=(0.0, 1.6, 0.0), sim_to_world=SIM_TO_WORLD, source="legacy-default")


def test_resolve_eye_origin_half_meta_miss_missing_scene_eye() -> None:
    meta = _meta(simToWorld=0.01, scene={})

    resolved = resolve_eye_origin(meta)

    assert resolved.source == "legacy-default"


def test_resolve_eye_origin_legacy_default_when_neither_present() -> None:
    resolved = resolve_eye_origin({})

    assert resolved == EyeOrigin(base=(0.0, 1.6, 0.0), sim_to_world=SIM_TO_WORLD, source="legacy-default")


def test_resolve_eye_origin_eye_height_alias_only_applies_in_legacy_default() -> None:
    resolved = resolve_eye_origin({}, eye_height=1.8)

    assert resolved == EyeOrigin(base=(0.0, 1.8, 0.0), sim_to_world=SIM_TO_WORLD, source="legacy-default")


def test_resolve_eye_origin_legacy_default_still_applies_sim_to_world() -> None:
    resolved = resolve_eye_origin({})

    assert resolved.sim_to_world == SIM_TO_WORLD


def test_resolve_eye_origin_strict_raises_on_legacy_default() -> None:
    with pytest.raises(ValueError, match="legacy-default|meta.scene.eye"):
        resolve_eye_origin({}, strict=True)


def test_resolve_eye_origin_strict_does_not_raise_with_explicit_eye_base() -> None:
    resolve_eye_origin({}, eye_base=(0.0, 1.6, 0.0), strict=True)


def test_resolve_eye_origin_strict_does_not_raise_when_meta_resolves() -> None:
    meta = _meta(simToWorld=0.01, scene={"eye": {"x": 0.0, "y": 1.6, "z": 4.0}})

    resolved = resolve_eye_origin(meta, strict=True)

    assert resolved.source == "meta"


# --- KI-004 / S1 T5 — gate ②: closed-form geometry (eyeBase.z ≠ 0 ∧ px ≠ 0) ---
#
# Expected values are the exact constants asserted by the TS side
# (tests/golden/research/epsilon-closed-form-geometry.test.ts) — each side asserts
# against the same closed-form constant independently (FM-3: parity is a
# consistency gate and cannot catch both sides drifting together).

_GATE_TWO_RELATIVE_TOLERANCE = 1e-9


def _gate_two_ticks(px: float, pz: float, yaw: float, pitch: float) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "t": [0.0],
            "yaw": [yaw],
            "pitch": [pitch],
            "px": [px],
            "pz": [pz],
            "tx": [2.0],
            "ty": [1.5],
            "tz": [-4.0],
        }
    )


def _assert_relative_parity(actual: float, expected: float) -> None:
    relative_error = abs(actual - expected) / abs(expected)
    assert relative_error <= _GATE_TWO_RELATIVE_TOLERANCE


def test_gate_two_matches_closed_form_when_pz_is_zero() -> None:
    eye_origin = EyeOrigin(base=(0.0, 1.6, 4.0), sim_to_world=0.01, source="explicit")
    ticks = _gate_two_ticks(px=169.25, pz=0.0, yaw=0.1, pitch=-0.05)

    result = epsilon_deg(ticks, {}, eye_origin=eye_origin)

    _assert_relative_parity(result[0], 8.2126491400431885)


def test_gate_two_matches_closed_form_when_both_px_and_pz_are_nonzero() -> None:
    eye_origin = EyeOrigin(base=(0.0, 1.6, 4.0), sim_to_world=0.01, source="explicit")
    ticks = _gate_two_ticks(px=169.25, pz=-50.0, yaw=0.2, pitch=0.03)

    result = epsilon_deg(ticks, {}, eye_origin=eye_origin)

    _assert_relative_parity(result[0], 14.026766041343230)


def test_gate_two_degenerates_to_legacy_formula_when_eye_base_z_is_zero() -> None:
    eye_origin = EyeOrigin(base=(0.0, 1.6, 0.0), sim_to_world=0.01, source="explicit")
    ticks = _gate_two_ticks(px=169.25, pz=0.0, yaw=0.1, pitch=-0.05)

    result = epsilon_deg(ticks, {}, eye_origin=eye_origin)

    _assert_relative_parity(result[0], 10.219676013510679)
