from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from modules.segments.algorithms import (
    QUALITY_FLAG_VOCABULARY,
    Segment,
    is_known_quality_flag,
    per_segment_apply,
    summarize_with_flags,
)


def _segment(index: int, *, samples: int = 2, flags: tuple[str, ...] = ()) -> Segment:
    return Segment(
        kind="primary_flick" if index == 0 else "micro_adjustment",
        start_idx=index * 4,
        end_idx=index * 4 + samples - 1,
        peak_omega=300.0 - index * 20.0,
        flags=flags,
        peek_index=7,
    )


def test_empty_segments_return_typed_contract_columns() -> None:
    result = per_segment_apply([], lambda segment: {"value": segment.peak_omega})

    assert result.empty
    assert list(result.columns) == ["peek_index", "flags"]
    assert str(result["peek_index"].dtype) == "Int64"
    assert result["flags"].dtype == object


def test_single_sample_is_flagged_and_peek_index_is_forwarded() -> None:
    result = per_segment_apply([_segment(0, samples=1)], lambda segment: {"value": 12.0})

    assert result.loc[0, "peek_index"] == 7
    assert result.loc[0, "value"] == 12.0
    assert result.loc[0, "flags"] == ("insufficient_samples",)


def test_non_finite_result_does_not_contaminate_other_segments() -> None:
    result = per_segment_apply(
        [_segment(0), _segment(1)],
        lambda segment: {"value": np.nan if segment.start_idx == 0 else 42.0},
    )

    assert math.isnan(result.loc[0, "value"])
    assert result.loc[0, "flags"] == ("compute_failed:non_finite_result:value",)
    assert result.loc[1, "value"] == 42.0
    assert result.loc[1, "flags"] == ()


def test_fn_exception_flags_only_failed_row_and_preserves_metric_columns() -> None:
    def compute(segment: Segment) -> dict[str, float]:
        if segment.start_idx > 0:
            raise RuntimeError("bad window")
        return {"score": 3.5}

    result = per_segment_apply([_segment(0), _segment(1)], compute)

    assert result.loc[0, "score"] == 3.5
    assert result.loc[0, "flags"] == ()
    assert math.isnan(result.loc[1, "score"])
    assert result.loc[1, "flags"] == ("compute_failed:bad window",)


def test_output_flags_are_closed_over_the_vocabulary() -> None:
    result = per_segment_apply(
        [_segment(0, flags=("truncated_at_window_edge",))],
        lambda segment: {"value": 1.0, "flags": ("missing_target",)},
    )

    assert "compute_failed:<reason>" in QUALITY_FLAG_VOCABULARY
    assert all(is_known_quality_flag(flag) for flags in result["flags"] for flag in flags)


def test_unknown_fn_flag_becomes_a_computation_failure() -> None:
    result = per_segment_apply(
        [_segment(0)],
        lambda segment: {"value": 1.0, "flags": ("not_registered",)},
    )

    assert math.isnan(result.loc[0, "value"])
    assert result.loc[0, "flags"] == ("compute_failed:unknown_quality_flag:not_registered",)


def test_summarize_excludes_flagged_rows_and_counts_them() -> None:
    frame = pd.DataFrame(
        {
            "value": [1.0, 100.0, 3.0, np.nan],
            "flags": [(), ("below_floor",), (), ()],
        }
    )

    summary = summarize_with_flags(frame, "value")

    assert summary == {
        "n": 2,
        "n_flagged": 1,
        "mean": 2.0,
        "p50": 2.0,
        "sd": pytest.approx(math.sqrt(2.0)),
    }


def test_segment_rejects_invalid_peek_index() -> None:
    with pytest.raises(ValueError, match="peek_index"):
        Segment("primary_flick", 0, 1, 100.0, peek_index=-1)
