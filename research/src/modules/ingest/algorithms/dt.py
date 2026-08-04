"""Fixed-tick interval quality reporting."""

from __future__ import annotations

from dataclasses import dataclass
import math

import pandas as pd

from .loader import SchemaError


DT_TOLERANCE_MS = 1e-6


@dataclass(frozen=True)
class DtReport:
    """Uniformity report; each gap index identifies the right-hand tick row."""

    tick_count: int
    median_dt_ms: float
    expected_dt_ms: float
    gap_count: int
    gaps: list[tuple[int, float]]
    uniform: bool


def check_dt(ticks: pd.DataFrame, sim_hz: int = 128) -> DtReport:
    """Compare adjacent tick times with ``1000 / sim_hz`` using a 1e-6 ms tolerance."""

    if isinstance(sim_hz, bool) or not isinstance(sim_hz, (int, float)) or not math.isfinite(sim_hz) or sim_hz <= 0:
        raise ValueError("sim_hz must be a positive finite number")
    if "t" not in ticks.columns:
        raise SchemaError("ticks.t", "column is required")

    expected = 1000.0 / sim_hz
    values = ticks["t"].tolist()
    for index, value in enumerate(values):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise SchemaError(f"ticks[{index}].t", "must be finite")

    intervals = [float(values[index] - values[index - 1]) for index in range(1, len(values))]
    gaps = [
        (index, interval)
        for index, interval in enumerate(intervals, start=1)
        if not math.isclose(interval, expected, rel_tol=0.0, abs_tol=DT_TOLERANCE_MS)
    ]
    median = float(pd.Series(intervals, dtype="float64").median()) if intervals else math.nan
    return DtReport(
        tick_count=len(values),
        median_dt_ms=median,
        expected_dt_ms=expected,
        gap_count=len(gaps),
        gaps=gaps,
        uniform=not gaps,
    )
