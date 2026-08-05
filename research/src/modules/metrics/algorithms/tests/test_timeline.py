from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
import pytest

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, Export
from modules.metrics.algorithms.timeline import stat, timeline_metrics, timeline_parity_payload


def _export() -> Export:
    events = [
        {"type": "visible", "t": 0.0, "targetId": "a", "side": "L"},
        {"type": "counter", "t": 2.0, "key": "D"},
        {
            "type": "fire",
            "t": 5.0,
            "targetId": "a",
            "hit": True,
            "firstShot": True,
            "residualSpeed": 0.0,
            "shotSeq": 1,
        },
        {"type": "visible", "t": 10.0, "targetId": "b", "side": "R"},
        {"type": "counter", "t": 14.0, "key": "A"},
        {
            "type": "fire",
            "t": 19.0,
            "targetId": "b",
            "hit": False,
            "firstShot": True,
            "residualSpeed": 0.0,
            "shotSeq": 2,
        },
        {"type": "visible", "t": 20.0, "targetId": "c", "side": "L"},
    ]
    ticks = [
        {"t": 0.0, "keys": ["A"], "ads": False},
        {"t": 1.0, "keys": [], "ads": False},
        {"t": 10.0, "keys": ["D"], "ads": False},
        {"t": 11.0, "keys": [], "ads": False},
        {"t": 20.0, "keys": [], "ads": False},
    ]
    return Export(
        meta={},
        ticks=pd.DataFrame(ticks).reindex(columns=TICK_COLUMNS),
        events=pd.DataFrame(events).reindex(columns=EVENT_COLUMNS),
        source_path=Path("timeline-unit.json"),
    )


def test_stat_matches_linear_p50_population_sd_and_empty_contract() -> None:
    assert stat([]) == stat([math.nan, math.inf])
    assert stat([]).mean == 0.0
    assert stat([]).p50 == 0.0
    assert stat([]).sd == 0.0
    assert stat([]).n == 0

    even = stat([1.0, 3.0])
    assert even.p50 == 2.0
    assert even.mean == 2.0
    assert even.sd == 1.0
    assert even.n == 2

    odd = stat([8.0, 1.0, 2.0])
    assert odd.p50 == 2.0
    assert odd.mean == pytest.approx(11.0 / 3.0)
    assert odd.sd == pytest.approx(math.sqrt(86.0 / 9.0))


def test_timeline_metrics_uses_visible_denominator_and_requires_both_alignment_anchors() -> None:
    metrics = timeline_metrics(_export())

    assert metrics.counter_reaction_ms.n == 2
    assert metrics.counter_reaction_ms.mean == 3.0
    assert metrics.fire_timing_alignment_ms.n == 2
    assert metrics.fire_timing_alignment_ms.mean == 4.0
    assert metrics.first_shot_hit_rate == pytest.approx(100.0 / 3.0)
    assert len(metrics.peeks) == 3


def test_parity_payload_is_json_ready_and_records_final_end_as_null() -> None:
    payload = timeline_parity_payload(_export())

    assert payload["version"] == "timeline-v1"
    assert payload["computeVersion"] == "compute-v1"
    assert payload["source"] == "timeline-unit.json"
    assert payload["peeks"][-1]["tEnd"] is None
    assert payload["metrics"]["counterReactionMs"]["n"] == 2
