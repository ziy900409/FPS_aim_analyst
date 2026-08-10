from __future__ import annotations

from dataclasses import FrozenInstanceError

import numpy as np
import pandas as pd
import pytest

from modules.metrics.algorithms.curves import (
    CURVE_VERSION,
    DEFAULT_CURVE_PARAMS,
    KNOWN_CURVE_FLAGS,
    CurveParams,
    curve_summary,
    curve_table,
    normalize_101,
)
from modules.metrics.algorithms.peek import PeekWindow


_TICK_MS = 1000.0 / 128.0


def _peek(
    *,
    index: int = 0,
    side: str = "R",
    ads: bool | None = False,
    t_visible: float = 0.0,
    t_end: float = float("inf"),
    t_first_shot: float | None,
) -> PeekWindow:
    return PeekWindow(
        index=index,
        target_id="target-1",
        side=side,
        t_visible=t_visible,
        t_end=t_end,
        t_counter=None,
        counter_key=None,
        t_release=None,
        release_key=None,
        t_first_shot=t_first_shot,
        fires=(),
        t_hit=None,
        outcome="timeout" if t_first_shot is None else "hit",
        ads=ads,
        flags=(),
        tick_slice=slice(0, 0),
    )


def _uniform_ticks(length: int) -> pd.DataFrame:
    return pd.DataFrame({"t": np.arange(length, dtype=float) * _TICK_MS})


# ---------------------------------------------------------------------------
# normalize_101 -- the seven pre-registered edge cases (T3-lr-curves.md Steps #2)
# ---------------------------------------------------------------------------


def test_normalize_101_raises_on_fewer_than_two_samples() -> None:
    with pytest.raises(ValueError):
        normalize_101(np.array([1.0]), np.array([0.0]), t0=0.0, t1=1.0)
    with pytest.raises(ValueError):
        normalize_101(np.array([]), np.array([]), t0=0.0, t1=1.0)


def test_normalize_101_handles_all_zero_values() -> None:
    t = np.linspace(0.0, 100.0, 20)
    values = np.zeros_like(t)

    curve = normalize_101(values, t, t0=0.0, t1=100.0, points=11)

    assert np.array_equal(curve, np.zeros(11))


def test_normalize_101_drops_non_finite_samples_before_interpolating() -> None:
    t = np.array([0.0, 25.0, 50.0, 75.0, 100.0])
    values = np.array([0.0, np.nan, 50.0, np.nan, 100.0])

    curve = normalize_101(values, t, t0=0.0, t1=100.0, points=5)

    # With the two nan samples dropped, the remaining (0,0)/(50,50)/(100,100) points are
    # collinear, so the resample is exactly the linear ramp regardless of the missing samples.
    assert curve == pytest.approx([0.0, 25.0, 50.0, 75.0, 100.0])


def test_normalize_101_raises_when_all_values_are_non_finite() -> None:
    t = np.linspace(0.0, 100.0, 10)
    values = np.full_like(t, np.nan)

    with pytest.raises(ValueError):
        normalize_101(values, t, t0=0.0, t1=100.0)


def test_normalize_101_raises_on_coincident_endpoints() -> None:
    t = np.linspace(0.0, 100.0, 10)
    values = t.copy()

    with pytest.raises(ValueError):
        normalize_101(values, t, t0=50.0, t1=50.0)


def test_normalize_101_raises_when_t1_precedes_t0() -> None:
    t = np.linspace(0.0, 100.0, 10)
    values = t.copy()

    with pytest.raises(ValueError):
        normalize_101(values, t, t0=75.0, t1=25.0)


def test_normalize_101_endpoints_equal_the_t0_t1_samples_and_stay_monotonic() -> None:
    t = np.linspace(0.0, 100.0, 21)
    values = t * 2.0 + 3.0  # strictly increasing

    curve = normalize_101(values, t, t0=t[0], t1=t[-1], points=101)

    assert curve[0] == pytest.approx(values[0])
    assert curve[-1] == pytest.approx(values[-1])
    assert np.all(np.diff(curve) >= 0)


def test_normalize_101_matches_the_analytic_linear_ramp() -> None:
    t = np.linspace(0.0, 200.0, 41)
    values = 4.0 * t - 7.0

    curve = normalize_101(values, t, t0=20.0, t1=120.0, points=11)

    expected_t = 20.0 + np.linspace(0.0, 1.0, 11) * (120.0 - 20.0)
    assert curve == pytest.approx(4.0 * expected_t - 7.0)


def test_normalize_101_rejects_mismatched_shapes() -> None:
    with pytest.raises(ValueError):
        normalize_101(np.zeros(5), np.zeros(4), t0=0.0, t1=1.0)


# ---------------------------------------------------------------------------
# curve_table -- inclusion rules and flag handling
# ---------------------------------------------------------------------------


def test_curve_table_produces_two_rows_per_peek() -> None:
    ticks = _uniform_ticks(60)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    epsilon = np.linspace(5.0, 1.0, 60)
    peek = _peek(t_first_shot=ticks["t"].iloc[-1])

    table = curve_table([peek], [omega], [epsilon], [ticks], DEFAULT_CURVE_PARAMS)

    assert list(table["signal"]) == ["omega", "epsilon"]
    assert list(table["peek_index"]) == [0, 0]
    assert table.loc[0, "flags"] == ()
    assert table.loc[1, "flags"] == ()
    assert table.loc[0, "p000"] == pytest.approx(omega[1])
    assert table.loc[1, "p100"] == pytest.approx(epsilon[-1])


def test_curve_table_no_first_shot_flags_both_signals_and_fills_nan() -> None:
    ticks = _uniform_ticks(60)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    epsilon = np.linspace(5.0, 1.0, 60)
    peek = _peek(t_first_shot=None)

    table = curve_table([peek], [omega], [epsilon], [ticks], DEFAULT_CURVE_PARAMS)

    assert table["flags"].tolist() == [("no_first_shot",), ("no_first_shot",)]
    assert table.loc[0, "p050"] != table.loc[0, "p050"]  # nan


def test_curve_table_window_too_short_below_min_ticks() -> None:
    params = CurveParams(points=11, min_ticks=5, band="iqr")
    ticks = _uniform_ticks(4)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 40.0, 3)))
    epsilon = np.linspace(5.0, 4.0, 4)
    peek = _peek(t_first_shot=ticks["t"].iloc[-1])

    table = curve_table([peek], [omega], [epsilon], [ticks], params)

    assert table.loc[0, "flags"] == ("window_too_short",)
    assert table.loc[1, "flags"] == ("window_too_short",)


def test_curve_table_missing_epsilon_only_flags_the_epsilon_row() -> None:
    ticks = _uniform_ticks(60)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    peek = _peek(t_first_shot=ticks["t"].iloc[-1])

    table = curve_table([peek], [omega], [None], [ticks], DEFAULT_CURVE_PARAMS)

    assert table.loc[0, "flags"] == ()
    assert table.loc[1, "flags"] == ("missing_epsilon",)
    assert table.loc[1, "p000"] != table.loc[1, "p000"]  # nan


def test_curve_table_non_uniform_dt_is_additive_and_keeps_the_curve() -> None:
    ticks = _uniform_ticks(60)
    ticks.loc[ticks.index[-1], "t"] += 50.0  # one dropped-tick-sized gap at the tail
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    epsilon = np.linspace(5.0, 1.0, 60)
    peek = _peek(t_first_shot=ticks["t"].iloc[-1])

    table = curve_table([peek], [omega], [epsilon], [ticks], DEFAULT_CURVE_PARAMS)

    assert table.loc[0, "flags"] == ("non_uniform_dt",)
    assert table.loc[1, "flags"] == ("non_uniform_dt",)
    assert table.loc[0, "p100"] == table.loc[0, "p100"]  # still computed, not nan


def test_curve_table_degenerate_window_when_first_shot_precedes_visible() -> None:
    ticks = _uniform_ticks(60)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    epsilon = np.linspace(5.0, 1.0, 60)
    peek = _peek(t_visible=50.0, t_first_shot=10.0)

    table = curve_table([peek], [omega], [epsilon], [ticks], DEFAULT_CURVE_PARAMS)

    assert table.loc[0, "flags"] == ("degenerate_window",)
    assert table.loc[1, "flags"] == ("degenerate_window",)


def test_curve_table_rejects_unknown_flags() -> None:
    from modules.metrics.algorithms.curves import _row

    peek = _peek(t_first_shot=None)

    with pytest.raises(AssertionError):
        _row(peek, "epsilon", None, ("not_a_real_flag",), DEFAULT_CURVE_PARAMS)


def test_curve_table_column_naming_matches_points() -> None:
    ticks = _uniform_ticks(60)
    omega = np.concatenate(([np.nan], np.linspace(10.0, 90.0, 59)))
    epsilon = np.linspace(5.0, 1.0, 60)
    peek = _peek(t_first_shot=ticks["t"].iloc[-1])

    table = curve_table([peek], [omega], [epsilon], [ticks], DEFAULT_CURVE_PARAMS)

    assert "p000" in table.columns
    assert "p100" in table.columns
    point_columns = [column for column in table.columns if column[0] == "p" and column[1:].isdigit()]
    assert len(point_columns) == 101


# ---------------------------------------------------------------------------
# curve_summary -- D-29.5 inclusion rule
# ---------------------------------------------------------------------------


def _clean_row(side: str, signal: str, base: float) -> dict[str, object]:
    row = {"peek_index": 0, "side": side, "ads": False, "signal": signal}
    row.update({f"p{i:03d}": base + i for i in range(101)})
    row["flags"] = ()
    return row


def _flagged_row(side: str, signal: str) -> dict[str, object]:
    row = {"peek_index": 1, "side": side, "ads": False, "signal": signal}
    row.update({f"p{i:03d}": float("nan") for i in range(101)})
    row["flags"] = ("no_first_shot",)
    return row


def test_curve_summary_excludes_flagged_rows_but_counts_them() -> None:
    rows = [
        _clean_row("L", "omega", 0.0),
        _clean_row("L", "omega", 10.0),
        _flagged_row("L", "omega"),
    ]
    table = pd.DataFrame(rows)

    summary = curve_summary(table, DEFAULT_CURVE_PARAMS)

    assert summary["L"]["omega"]["n"] == 2
    assert summary["L"]["omega"]["n_excluded"] == 1
    assert summary["L"]["omega"]["mean"][0] == pytest.approx(5.0)
    assert summary["R"]["omega"]["n"] == 0
    assert summary["R"]["omega"]["mean"] is None


def test_curve_summary_iqr_band_bounds_the_mean() -> None:
    rows = [_clean_row("R", "epsilon", value) for value in (0.0, 10.0, 20.0, 30.0)]
    table = pd.DataFrame(rows)

    summary = curve_summary(table, DEFAULT_CURVE_PARAMS)

    band = summary["R"]["epsilon"]
    assert band["n"] == 4
    for lower, mean, upper in zip(band["band_lower"], band["mean"], band["band_upper"], strict=True):
        assert lower <= mean <= upper


def test_curve_summary_sd_band() -> None:
    params = CurveParams(points=101, min_ticks=3, band="sd")
    rows = [_clean_row("L", "omega", value) for value in (0.0, 10.0)]
    table = pd.DataFrame(rows)

    summary = curve_summary(table, params)

    band = summary["L"]["omega"]
    assert band["n"] == 2
    assert band["mean"][0] == pytest.approx(5.0)
    assert band["band_lower"][0] < band["mean"][0] < band["band_upper"][0]


# ---------------------------------------------------------------------------
# CurveParams contract
# ---------------------------------------------------------------------------


def test_curve_params_are_frozen_and_versioned() -> None:
    assert DEFAULT_CURVE_PARAMS.version == CURVE_VERSION == "curve-v1"
    with pytest.raises(FrozenInstanceError):
        DEFAULT_CURVE_PARAMS.points = 51  # type: ignore[misc]


@pytest.mark.parametrize(
    "overrides",
    [
        {"points": 1},
        {"points": 1.5},
        {"min_ticks": 1},
        {"band": "mean"},
        {"version": ""},
    ],
)
def test_curve_params_reject_invalid_contracts(overrides: dict[str, object]) -> None:
    values = {"points": 101, "min_ticks": 3, "band": "iqr", "version": "curve-test"}
    values.update(overrides)

    with pytest.raises(ValueError):
        CurveParams(**values)  # type: ignore[arg-type]


def test_known_curve_flags_is_the_pre_registered_closed_vocabulary() -> None:
    assert KNOWN_CURVE_FLAGS == frozenset(
        {
            "no_first_shot",
            "window_too_short",
            "missing_epsilon",
            "non_uniform_dt",
            "degenerate_window",
        }
    )
