"""Per-segment computation with a closed, machine-readable quality vocabulary.

Exact flags are enumerated in :data:`QUALITY_FLAG_VOCABULARY`. Computation
failures use the sole templated entry, ``compute_failed:<reason>``; callers
must add any other new flag here before emitting it.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
import math
from numbers import Number
from typing import Any

import numpy as np
import pandas as pd

from modules.segments.algorithms.submovement import Segment


QUALITY_FLAG_VOCABULARY = (
    "insufficient_samples",
    "no_segment",
    "truncated_at_window_edge",
    "below_floor",
    "non_uniform_dt",
    "missing_target",
    "empty_signal",
    "zero_motion",
    "no_peak",
    "sg_fallback_short_signal",
    "non_finite_replaced",
    "non_finite_interpolated",
    "merged_adjacent_peaks",
    "compute_failed:<reason>",
)

_COMPUTE_FAILED_PREFIX = "compute_failed:"


def is_known_quality_flag(flag: str) -> bool:
    """Return whether *flag* is an exact or templated vocabulary member."""

    return flag in QUALITY_FLAG_VOCABULARY or (
        flag.startswith(_COMPUTE_FAILED_PREFIX)
        and bool(flag.removeprefix(_COMPUTE_FAILED_PREFIX).strip())
    )


def per_segment_apply(
    segments: Sequence[Segment],
    fn: Callable[[Segment], Mapping[str, Any]],
) -> pd.DataFrame:
    """Apply ``fn`` independently and return one quality-aware row per segment.

    ``peek_index`` is copied from each segment. A one-sample segment remains
    visible but is flagged. Exceptions and non-finite numeric results affect
    only their own row; their metric values become ``NaN`` and the reason is
    retained as a ``compute_failed:<reason>`` flag.
    """

    rows: list[dict[str, Any]] = []
    metric_columns: list[str] = []
    for segment in segments:
        if not isinstance(segment, Segment):
            raise TypeError("segments must contain Segment instances")

        flags = list(segment.flags)
        if segment.end_idx == segment.start_idx:
            flags.append("insufficient_samples")

        values: dict[str, Any] = {}
        try:
            computed = fn(segment)
            if not isinstance(computed, Mapping):
                raise TypeError("fn must return a mapping")
            values = dict(computed)
            returned_flags = values.pop("flags", ())
            if "peek_index" in values:
                raise ValueError("fn result must not override peek_index")
            if not isinstance(returned_flags, tuple) or not all(
                isinstance(flag, str) for flag in returned_flags
            ):
                raise TypeError("fn result flags must be a tuple of strings")
            flags.extend(returned_flags)
            unknown = next((flag for flag in flags if not is_known_quality_flag(flag)), None)
            if unknown is not None:
                raise ValueError(f"unknown_quality_flag:{unknown}")
            non_finite = next(
                (
                    name
                    for name, value in values.items()
                    if isinstance(value, Number)
                    and not isinstance(value, bool)
                    and not math.isfinite(float(value))
                ),
                None,
            )
            if non_finite is not None:
                raise ValueError(f"non_finite_result:{non_finite}")
        except Exception as error:
            values = {name: np.nan for name in values if name != "flags"}
            flags = [flag for flag in flags if is_known_quality_flag(flag)]
            flags.append(_compute_failed_flag(error))

        for name in values:
            if name not in metric_columns:
                metric_columns.append(name)
        rows.append(
            {
                "peek_index": segment.peek_index,
                **values,
                "flags": tuple(dict.fromkeys(flags)),
            }
        )

    if not rows:
        return pd.DataFrame(
            {
                "peek_index": pd.Series(dtype="Int64"),
                "flags": pd.Series(dtype="object"),
            }
        )

    frame = pd.DataFrame(rows)
    frame["peek_index"] = frame["peek_index"].astype("Int64")
    return frame.loc[:, ["peek_index", *metric_columns, "flags"]]


def summarize_with_flags(df: pd.DataFrame, value_col: str) -> dict[str, int | float]:
    """Summarize finite, unflagged values while counting excluded flagged rows."""

    missing = [column for column in (value_col, "flags") if column not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {', '.join(missing)}")

    flagged = df["flags"].map(_has_flags)
    numeric = pd.to_numeric(df[value_col], errors="coerce")
    valid = numeric.loc[~flagged & np.isfinite(numeric)]
    return {
        "n": int(valid.size),
        "n_flagged": int(flagged.sum()),
        "mean": float(valid.mean()),
        "p50": float(valid.median()),
        "sd": float(valid.std(ddof=1)),
    }


def _has_flags(value: object) -> bool:
    if not isinstance(value, tuple) or not all(isinstance(flag, str) for flag in value):
        raise TypeError("flags column must contain tuple[str, ...]")
    return bool(value)


def _compute_failed_flag(error: Exception) -> str:
    reason = " ".join(str(error).split()) or type(error).__name__
    return f"{_COMPUTE_FAILED_PREFIX}{reason}"
