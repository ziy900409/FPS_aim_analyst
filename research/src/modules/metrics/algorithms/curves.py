"""101-point normalized L/R ω(t)/ε(t) curves (WP-30 / T3, FR-D12).

``curve-v1`` answers "what does the movement look like, shape-wise" -- each peek's
``[t_visible, t_first_shot]`` window is resampled onto 101 equally spaced normalized-time
points so that peeks of different real duration become comparable curves, then averaged
per side (L/R) and per signal (ω/ε) with a distribution band. This module does no
detection or segmentation of its own: it only resamples signals the caller already
derived with the frozen upstream constructs (``omega_deg_s(strict=True)``,
``epsilon_deg(..., eye_origin=strict)``, ``build_peek_windows``).

Degenerate peeks (missing first shot, too few ticks in-window, missing epsilon) never
raise -- they are flagged and excluded from :func:`curve_summary`'s aggregation (D-29.5),
but still appear as a row so the exclusion is auditable.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
import math
from typing import Literal

import numpy as np
import pandas as pd

from modules.metrics.algorithms.peek import PeekWindow


CURVE_VERSION = "curve-v1"

#: Closed vocabulary (T0 §3.2 pre-registration draft; T3 may only narrow, never widen, per D-30.4).
KNOWN_CURVE_FLAGS = frozenset(
    {
        "no_first_shot",
        "window_too_short",
        "missing_epsilon",
        "non_uniform_dt",
        "degenerate_window",
    }
)

Side = Literal["L", "R"]
SignalName = Literal["omega", "epsilon"]

_SIGNALS: tuple[SignalName, ...] = ("omega", "epsilon")
_DT_TOLERANCE_MS = 1e-6


@dataclass(frozen=True)
class CurveParams:
    """Pre-registered ``curve-v1`` parameters; changes require a new version (D-30.4)."""

    points: int
    min_ticks: int
    band: Literal["iqr", "sd"]
    version: str = CURVE_VERSION

    def __post_init__(self) -> None:
        if isinstance(self.points, bool) or not isinstance(self.points, int) or self.points < 2:
            raise ValueError("points must be an integer >= 2")
        if isinstance(self.min_ticks, bool) or not isinstance(self.min_ticks, int) or self.min_ticks < 2:
            raise ValueError("min_ticks must be an integer >= 2")
        if self.band not in ("iqr", "sd"):
            raise ValueError("band must be 'iqr' or 'sd'")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


#: Frozen 2026-08 (T3, notebooks/t3/generate_curves_report.py): 101 points / IQR band were format
#: decisions pre-registered without data (T0 §3.2). `min_ticks=3` is the data-informed value -- the
#: committed synthetic fixture's two peeks have 13 in-window ticks each (a natural short-window
#: regression case that must still produce a curve) while the pathological case this guards against
#: is a 1-2 tick window, too few samples for a 101-point resample to represent anything but a single
#: line segment stretched to fill the whole normalized range. All 60 real peeks have >= 52 in-window
#: ticks, so this threshold never excludes real data. See analysis-phase-curves.md.
DEFAULT_CURVE_PARAMS = CurveParams(points=101, min_ticks=3, band="iqr")


def normalize_101(
    values: np.ndarray, t: np.ndarray, t0: float, t1: float, *, points: int = 101
) -> np.ndarray:
    """Resample ``values(t)`` onto ``points`` equally spaced samples over ``[t0, t1]``.

    Linear interpolation, normalized time ``[0, 1]`` mapped back to ``t0 + frac * (t1 - t0)``
    (``curve-v1``, pre-registered format decision -- WP-30 progress.md §3.2). Non-finite entries
    in ``values``/``t`` are dropped before interpolating (this is how a signal's undefined leading
    sample, e.g. ``omega_deg_s``'s contractual ``nan`` at index zero, disappears without the caller
    needing to slice it out -- same idea as the ``_OMEGA_INDEX_OFFSET`` tail-cut elsewhere, just
    expressed as a value mask instead of an index offset since this function works in the time
    domain, not the tick-index domain). Degenerate input (fewer than two finite samples, an empty or
    inverted window) raises :class:`ValueError` rather than returning a guessed curve -- the caller
    turns that into a flag.
    """

    values = np.asarray(values, dtype=float)
    t = np.asarray(t, dtype=float)
    if values.shape != t.shape:
        raise ValueError("values and t must have the same shape")
    if not (isinstance(points, int) and not isinstance(points, bool) and points >= 2):
        raise ValueError("points must be an integer >= 2")
    if not (math.isfinite(t0) and math.isfinite(t1)):
        raise ValueError("t0 and t1 must be finite")
    if t1 <= t0:
        raise ValueError("t1 must be greater than t0 (degenerate window)")

    finite = np.isfinite(values) & np.isfinite(t)
    if int(np.count_nonzero(finite)) < 2:
        raise ValueError("normalize_101 requires at least two finite samples")

    t_finite = t[finite]
    values_finite = values[finite]
    order = np.argsort(t_finite, kind="stable")
    t_sorted = t_finite[order]
    values_sorted = values_finite[order]

    fractions = np.linspace(0.0, 1.0, points)
    targets = t0 + fractions * (t1 - t0)
    return np.interp(targets, t_sorted, values_sorted)


def curve_table(
    peeks: Sequence[PeekWindow],
    omega: Sequence[np.ndarray],
    epsilon: Sequence[np.ndarray | None],
    ticks: Sequence[pd.DataFrame],
    params: CurveParams = DEFAULT_CURVE_PARAMS,
) -> pd.DataFrame:
    """Batch-resample every peek's ω(t)/ε(t) into one row per ``(peek, signal)``.

    ``omega``/``epsilon``/``ticks`` are parallel per-peek sequences over that peek's own tick
    slice (same convention as :func:`~modules.metrics.algorithms.phase.phase_table`): ``ticks[i]``
    is the presentation window's own tick DataFrame, ``omega[i]`` is
    ``omega_deg_s(ticks[i], strict=True).values`` for that same slice, and ``epsilon[i]`` is either
    ``epsilon_deg(ticks[i], ..., eye_origin=strict)`` for that slice or ``None`` when the caller
    could not resolve an eye origin/target geometry for this peek (``missing_epsilon``).
    """

    if not isinstance(params, CurveParams):
        raise TypeError("params must be a CurveParams instance")

    rows: list[dict[str, object]] = []
    for peek, om, eps, tk in zip(peeks, omega, epsilon, ticks, strict=True):
        rows.extend(_curve_rows(peek, om, eps, tk, params))

    columns = ["peek_index", "side", "ads", "signal", *_point_columns(params.points), "flags"]
    return pd.DataFrame(rows, columns=columns)


def curve_summary(table: pd.DataFrame, params: CurveParams = DEFAULT_CURVE_PARAMS) -> dict:
    """Per ``side x signal``: mean curve, distribution band, and the ``n`` behind both.

    Inclusion rule matches D-29.5: a row's curve only enters the aggregate when every one of its
    ``p000..pNNN`` values is finite **and** its ``flags`` tuple is empty. Excluded rows are still
    counted (``n_excluded``) so a report can show how many peeks were dropped and why (Failure
    modes table, README §3).
    """

    point_columns = _point_columns(params.points)
    summary: dict[str, dict[str, dict[str, object]]] = {}
    for side in ("L", "R"):
        summary[side] = {}
        for signal in _SIGNALS:
            subset = table.loc[(table["side"] == side) & (table["signal"] == signal)]
            unflagged = subset.loc[subset["flags"].map(lambda flags: len(flags) == 0)]
            matrix = unflagged[list(point_columns)].to_numpy(dtype=float)
            finite_rows = np.all(np.isfinite(matrix), axis=1) if matrix.size else np.zeros(0, dtype=bool)
            matrix = matrix[finite_rows]
            n = int(matrix.shape[0])
            summary[side][signal] = {
                "n": n,
                "n_excluded": int(len(subset) - n),
                **_band(matrix, params.band),
            }
    return summary


def _band(matrix: np.ndarray, band: Literal["iqr", "sd"]) -> dict[str, list[float] | None]:
    if matrix.shape[0] == 0:
        return {"mean": None, "band_lower": None, "band_upper": None}
    mean = np.mean(matrix, axis=0)
    if band == "iqr":
        lower = np.percentile(matrix, 25, axis=0)
        upper = np.percentile(matrix, 75, axis=0)
    else:
        sd = np.std(matrix, axis=0, ddof=1) if matrix.shape[0] > 1 else np.zeros(matrix.shape[1])
        lower = mean - sd
        upper = mean + sd
    return {
        "mean": mean.tolist(),
        "band_lower": lower.tolist(),
        "band_upper": upper.tolist(),
    }


def _curve_rows(
    peek: PeekWindow,
    omega: np.ndarray,
    epsilon: np.ndarray | None,
    ticks: pd.DataFrame,
    params: CurveParams,
) -> list[dict[str, object]]:
    tick_times = ticks["t"].to_numpy(dtype=float) if len(ticks) else np.empty(0, dtype=float)
    t0 = peek.t_visible
    t1 = peek.t_first_shot

    base_flags: list[str] = []
    window_ok = True
    if t1 is None:
        base_flags.append("no_first_shot")
        window_ok = False
    elif t1 <= t0:
        base_flags.append("degenerate_window")
        window_ok = False
    elif int(np.sum((tick_times >= t0) & (tick_times <= t1))) < params.min_ticks:
        base_flags.append("window_too_short")
        window_ok = False

    if not _is_locally_uniform(tick_times):
        base_flags.append("non_uniform_dt")

    omega_values, omega_extra = (
        _resolve_signal(omega, tick_times, t0, t1, params) if window_ok else (None, None)
    )
    omega_flags = tuple(dict.fromkeys((*base_flags, *((omega_extra,) if omega_extra else ()))))

    if epsilon is None:
        epsilon_values, epsilon_extra = None, None
        epsilon_flags = tuple(dict.fromkeys((*base_flags, "missing_epsilon")))
    else:
        epsilon_values, epsilon_extra = (
            _resolve_signal(epsilon, tick_times, t0, t1, params) if window_ok else (None, None)
        )
        epsilon_flags = tuple(dict.fromkeys((*base_flags, *((epsilon_extra,) if epsilon_extra else ()))))

    return [
        _row(peek, "omega", omega_values, omega_flags, params),
        _row(peek, "epsilon", epsilon_values, epsilon_flags, params),
    ]


def _resolve_signal(
    values: np.ndarray, tick_times: np.ndarray, t0: float, t1: float, params: CurveParams
) -> tuple[tuple[float, ...] | None, str | None]:
    try:
        curve = normalize_101(values, tick_times, t0, t1, points=params.points)
    except ValueError:
        return None, "degenerate_window"
    return tuple(float(value) for value in curve), None


def _row(
    peek: PeekWindow,
    signal: SignalName,
    values: tuple[float, ...] | None,
    flags: tuple[str, ...],
    params: CurveParams,
) -> dict[str, object]:
    if not set(flags) <= KNOWN_CURVE_FLAGS:
        raise AssertionError("curve row emitted an unknown flag")
    resolved = values if values is not None else tuple(float("nan") for _ in range(params.points))
    row: dict[str, object] = {
        "peek_index": peek.index,
        "side": peek.side,
        "ads": peek.ads,
        "signal": signal,
    }
    row.update(zip(_point_columns(params.points), resolved, strict=True))
    row["flags"] = flags
    return row


def _point_columns(points: int) -> tuple[str, ...]:
    width = len(str(points - 1))
    return tuple(f"p{index:0{width}d}" for index in range(points))


def _is_locally_uniform(tick_times: np.ndarray) -> bool:
    """Whether this window's own tick spacing is internally consistent.

    Same narrower-but-same-meaning check as ``phase.py``'s ``_is_locally_uniform`` (this module is
    a pure algorithms function that only ever sees one peek's own ticks, so it has no ``meta.simHz``
    to compare against; see analysis-phase-curves.md's `phase-v1` section for the full rationale).
    Duplicated rather than imported -- both modules keep their own closed-vocabulary flag list and
    neither depends on the other's internals.
    """

    if len(tick_times) < 2:
        return True
    intervals = np.diff(tick_times)
    median = float(np.median(intervals))
    return bool(np.all(np.isclose(intervals, median, rtol=0.0, atol=_DT_TOLERANCE_MS)))
