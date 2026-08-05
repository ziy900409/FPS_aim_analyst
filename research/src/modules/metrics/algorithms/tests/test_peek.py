from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, Export
from modules.metrics.algorithms.peek import KNOWN_PEEK_FLAGS, build_peek_windows


def _export(*, events: list[dict], ticks: list[dict]) -> Export:
    return Export(
        meta={},
        ticks=pd.DataFrame(ticks).reindex(columns=TICK_COLUMNS),
        events=pd.DataFrame(events).reindex(columns=EVENT_COLUMNS),
        source_path=Path("unit-timeline.json"),
    )


def _visible(t: float, target: str, side: str = "L") -> dict:
    return {"type": "visible", "t": t, "targetId": target, "side": side}


def _tick(t: float, keys: list[str], ads: bool = False) -> dict:
    return {"t": t, "keys": keys, "ads": ads}


def _fire(t: float, *, target: str | None = None, hit: bool = False, seq: int = 1) -> dict:
    event = {
        "type": "fire",
        "t": t,
        "hit": hit,
        "firstShot": True,
        "residualSpeed": 0.0,
        "shotSeq": seq,
    }
    if target is not None:
        event["targetId"] = target
    return event


def test_window_boundaries_assign_boundary_tick_to_next_and_last_end_is_infinite() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _visible(10.0, "b", "R")],
        ticks=[_tick(0.0, []), _tick(9.0, []), _tick(10.0, []), _tick(11.0, [])],
    )

    windows = build_peek_windows(export)

    assert len(windows) == 2
    assert windows[0].tick_slice == slice(0, 2)
    assert windows[1].tick_slice == slice(2, 4)
    assert windows[0].t_end == 10.0
    assert math.isinf(windows[1].t_end)


def test_first_fire_filters_target_id_and_sorts_unordered_events() -> None:
    export = _export(
        events=[
            _fire(5.0, seq=2),
            _fire(4.0, target="wrong", seq=1),
            {"type": "counter", "t": 2.0, "key": "D"},
            _visible(0.0, "right"),
        ],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_counter == 2.0
    assert window.fires == (4.0, 5.0)
    assert window.t_first_shot == 5.0


def test_release_uses_original_key_opposite_the_counter_key() -> None:
    export = _export(
        events=[_visible(0.0, "a"), {"type": "counter", "t": 2.0, "key": "D"}],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.counter_key == "D"
    assert window.release_key == "A"
    assert window.t_release == 1.0


def test_missing_counter_uses_last_ad_release_and_flags_inference() -> None:
    export = _export(
        events=[_visible(0.0, "a")],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_counter is None
    assert window.t_release == 1.0
    assert window.release_key == "A"
    assert "no_counter" in window.flags
    assert "release_inferred_no_counter" in window.flags


def test_missing_release_transition_stays_none_instead_of_using_last_held_tick() -> None:
    export = _export(
        events=[_visible(0.0, "a"), {"type": "counter", "t": 2.0, "key": "D"}],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, ["A", "D"])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_release is None
    assert window.release_key is None
    assert "no_key_transition" in window.flags


def test_empty_window_has_none_ads_and_explicit_flag() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _visible(1.0, "b", "R")],
        ticks=[_tick(1.0, [], ads=True)],
    )

    first, second = build_peek_windows(export)

    assert first.tick_slice == slice(0, 0)
    assert first.ads is None
    assert "empty_window" in first.flags
    assert second.ads is True


def test_projectile_hit_after_next_visible_remains_a_hit_and_is_flagged() -> None:
    export = _export(
        events=[
            _visible(0.0, "a"),
            _fire(8.0, target="a", seq=7),
            _visible(10.0, "b", "R"),
            {"type": "hit", "t": 12.0, "shotSeq": 7, "timeOfFlightMs": 4.0},
        ],
        ticks=[_tick(0.0, []), _tick(10.0, [])],
    )

    first = build_peek_windows(export)[0]

    assert first.t_hit == 12.0
    assert first.outcome == "hit"
    assert "hit_outside_window" in first.flags


def test_outcome_covers_hit_timeout_and_no_shot() -> None:
    export = _export(
        events=[
            _visible(0.0, "hit"),
            _fire(1.0, target="hit", hit=True, seq=1),
            _visible(10.0, "miss", "R"),
            _fire(11.0, target="miss", hit=False, seq=2),
            _visible(20.0, "none"),
        ],
        ticks=[_tick(0.0, []), _tick(10.0, []), _tick(20.0, [])],
    )

    windows = build_peek_windows(export)

    assert [window.outcome for window in windows] == ["hit", "timeout", "no_shot"]
    assert len(windows) == 3


def test_multiple_counters_selects_first_and_uses_only_known_flags() -> None:
    export = _export(
        events=[
            _visible(0.0, "a"),
            {"type": "counter", "t": 3.0, "key": "A"},
            {"type": "counter", "t": 2.0, "key": "D"},
        ],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, []), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_counter == 2.0
    assert window.counter_key == "D"
    assert "multiple_counters" in window.flags
    assert set(window.flags) <= KNOWN_PEEK_FLAGS


def test_unsupported_counter_key_does_not_use_no_counter_release_fallback() -> None:
    export = _export(
        events=[_visible(0.0, "a"), {"type": "counter", "t": 2.0, "key": "Space"}],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_counter == 2.0
    assert window.counter_key is None
    assert window.t_release is None
    assert "unsupported_counter_key" in window.flags
    assert "release_inferred_no_counter" not in window.flags
