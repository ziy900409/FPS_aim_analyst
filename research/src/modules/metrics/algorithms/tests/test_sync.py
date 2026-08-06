from __future__ import annotations

from dataclasses import FrozenInstanceError
import math
from pathlib import Path
from statistics import stdev

import pandas as pd
import pytest

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, Export
from modules.metrics.algorithms.peek import build_peek_windows
from modules.metrics.algorithms.sync import (
    DEFAULT_SYNC_PARAMS,
    KNOWN_SYNC_FLAGS,
    SyncParams,
    evaluate_release_precision,
    sync_metrics,
)


def _export(*, events: list[dict], ticks: list[dict]) -> Export:
    return Export(
        meta={},
        ticks=pd.DataFrame(ticks).reindex(columns=TICK_COLUMNS),
        events=pd.DataFrame(events).reindex(columns=EVENT_COLUMNS),
        source_path=Path("unit-sync.json"),
    )


def _visible(t: float, target: str, side: str = "L") -> dict:
    return {"type": "visible", "t": t, "targetId": target, "side": side}


def _counter(t: float, key: str = "D") -> dict:
    return {"type": "counter", "t": t, "key": key}


def _fire(t: float, target: str = "a") -> dict:
    return {
        "type": "fire",
        "t": t,
        "targetId": target,
        "hit": True,
        "firstShot": True,
        "residualSpeed": 0.0,
        "shotSeq": 1,
    }


def _tick(t: float, keys: list[str], *, ads: bool = False) -> dict:
    return {"t": t, "keys": keys, "ads": ads}


def _rows(export: Export, *, weapon_mode: str = "hitscan") -> pd.DataFrame:
    return sync_metrics(
        build_peek_windows(export),
        export.ticks,
        weapon_mode=weapon_mode,  # type: ignore[arg-type]
    )


def _normal_export() -> Export:
    return _export(
        events=[_fire(6.0), _counter(2.25), _visible(0.0, "a")],
        ticks=[
            _tick(0.0, ["A"]),
            _tick(1.0, ["A"]),
            _tick(2.0, []),
            _tick(3.0, ["D"], ads=True),
            _tick(4.0, ["D"]),
            _tick(5.0, []),
        ],
    )


def test_sync_metrics_computes_three_anchors_and_condition_columns() -> None:
    row = _rows(_normal_export(), weapon_mode="projectile").iloc[0]

    assert row["peek_index"] == 0
    assert row["release_to_fire_ms"] == 5.0
    assert row["counter_hold_ms"] == 1.75
    assert row["counter_to_fire_ms"] == 3.75
    assert row["side"] == "L"
    assert row["ads"] is True
    assert row["weapon_mode"] == "projectile"
    assert row["flags"] == ()


def test_missing_release_stays_none_and_is_flagged() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0), _fire(5.0)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, ["A", "D"])],
    )

    row = _rows(export).iloc[0]

    assert row["release_to_fire_ms"] is None
    assert "missing_release" in row["flags"]
    assert set(row["flags"]) <= KNOWN_SYNC_FLAGS


def test_missing_counter_keeps_inferred_release_but_is_excluded_by_flags() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _fire(5.0)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    row = _rows(export).iloc[0]

    assert row["release_to_fire_ms"] == 4.0
    assert row["counter_hold_ms"] is None
    assert row["counter_to_fire_ms"] is None
    assert "missing_counter" in row["flags"]
    assert "release_inferred_no_counter" in row["flags"]


def test_missing_first_shot_keeps_none_instead_of_nan() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0)],
        ticks=[
            _tick(0.0, ["A"]),
            _tick(1.0, ["A"]),
            _tick(2.0, ["D"]),
            _tick(3.0, []),
        ],
    )

    row = _rows(export).iloc[0]

    assert row["release_to_fire_ms"] is None
    assert row["counter_to_fire_ms"] is None
    assert "missing_first_shot" in row["flags"]


def test_unordered_events_and_ticks_produce_the_same_sync_row() -> None:
    unordered = _normal_export()
    ordered = _export(
        events=sorted(unordered.events.dropna(how="all").to_dict("records"), key=lambda row: row["t"]),
        ticks=sorted(unordered.ticks.dropna(how="all").to_dict("records"), key=lambda row: row["t"]),
    )

    pd.testing.assert_frame_equal(_rows(unordered), _rows(ordered))


def test_release_transition_at_next_window_boundary_does_not_leak_back() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0), _fire(8.0), _visible(10.0, "b", "R")],
        ticks=[_tick(0.0, ["A"]), _tick(9.0, ["A", "D"]), _tick(10.0, [])],
    )

    first = _rows(export).iloc[0]

    assert first["release_to_fire_ms"] is None
    assert "missing_release" in first["flags"]


def test_counter_hold_is_truncated_at_window_edge_and_flagged() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0), _fire(8.0), _visible(10.0, "b", "R")],
        ticks=[
            _tick(0.0, ["A"]),
            _tick(1.0, []),
            _tick(2.0, ["D"]),
            _tick(9.0, ["D"]),
            _tick(10.0, []),
        ],
    )

    first = _rows(export).iloc[0]

    assert first["counter_hold_ms"] == 7.0
    assert "counter_hold_truncated" in first["flags"]


def _precision_frame(values: list[float], *, flagged_value: float | None = None) -> pd.DataFrame:
    rows = [
        {
            "release_to_fire_ms": value,
            "counter_hold_ms": value,
            "flags": (),
        }
        for value in values
    ]
    if flagged_value is not None:
        rows.append(
            {
                "release_to_fire_ms": flagged_value,
                "counter_hold_ms": flagged_value,
                "flags": ("multiple_counters",),
            }
        )
    return pd.DataFrame(rows)


def test_precision_sufficient_branch_for_large_sample_sd() -> None:
    verdicts = evaluate_release_precision(
        _precision_frame([float(value * 10) for value in range(10)]),
        DEFAULT_SYNC_PARAMS,
    )

    assert {verdict.verdict for verdict in verdicts} == {"sufficient"}
    assert {verdict.n for verdict in verdicts} == {10}


def test_precision_insufficient_branch_for_small_sample_sd() -> None:
    verdicts = evaluate_release_precision(
        _precision_frame([float(value) for value in range(10)]),
        DEFAULT_SYNC_PARAMS,
    )

    assert {verdict.verdict for verdict in verdicts} == {"insufficient"}


def test_precision_blocked_by_data_branch() -> None:
    verdicts = evaluate_release_precision(
        _precision_frame([float(value * 10) for value in range(9)]),
        DEFAULT_SYNC_PARAMS,
    )

    assert {verdict.verdict for verdict in verdicts} == {"blocked-by-data"}
    assert {verdict.n for verdict in verdicts} == {9}


def test_quantization_sd_and_equality_boundary_follow_frozen_rule() -> None:
    quantization_sd = (1000.0 / 128) / math.sqrt(12.0)
    boundary_sd = quantization_sd / DEFAULT_SYNC_PARAMS.sd_ratio_threshold
    values = [0.0] * 9 + [boundary_sd * math.sqrt(10.0)]

    verdicts = evaluate_release_precision(_precision_frame(values), DEFAULT_SYNC_PARAMS)

    for verdict in verdicts:
        assert verdict.quantization_sd_ms == pytest.approx(quantization_sd, rel=1e-12)
        assert verdict.sample_sd_ms == pytest.approx(boundary_sd, rel=1e-12)
        assert verdict.verdict == "insufficient"


def test_flagged_rows_do_not_enter_n_or_sample_sd() -> None:
    values = [float(value * 10) for value in range(10)]
    verdicts = evaluate_release_precision(
        _precision_frame(values, flagged_value=1_000_000.0),
        DEFAULT_SYNC_PARAMS,
    )

    for verdict in verdicts:
        assert verdict.n == 10
        assert verdict.sample_sd_ms == stdev(values)
        assert verdict.verdict == "sufficient"


def test_sync_params_are_frozen_and_match_pre_registration() -> None:
    assert DEFAULT_SYNC_PARAMS == SyncParams(
        min_samples=10,
        sd_ratio_threshold=1 / 3,
        version="sync-v1",
    )
    with pytest.raises(FrozenInstanceError):
        DEFAULT_SYNC_PARAMS.min_samples = 11  # type: ignore[misc]
    with pytest.raises(ValueError):
        SyncParams(min_samples=10.5)  # type: ignore[arg-type]
