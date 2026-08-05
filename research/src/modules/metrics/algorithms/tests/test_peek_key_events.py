"""WP-29 / T3 (user override): additive key-event release evidence in ``build_peek_windows``.

These assert the ADDITIVE ``t_release_event`` / ``release_source`` fields only. The frozen tick-derived
``t_release`` (``timeline-v1``) and the ``flags`` tuple (which drives the frozen ``sync-v1`` aggregate) must
stay byte-for-byte unchanged, so every test also checks the frozen surface is untouched (D-29.10).

The loader maps the JSON ``code`` field into the shared ``key`` column; these unit tests build that post-load
DataFrame representation directly (``key`` = canonical code), bypassing ``load_export``.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, Export
from modules.metrics.algorithms.peek import KNOWN_PEEK_FLAGS, build_peek_windows


def _export(*, events: list[dict], ticks: list[dict]) -> Export:
    return Export(
        meta={},
        ticks=pd.DataFrame(ticks).reindex(columns=TICK_COLUMNS),
        events=pd.DataFrame(events).reindex(columns=EVENT_COLUMNS),
        source_path=Path("unit-key.json"),
    )


def _visible(t: float, target: str, side: str = "L") -> dict:
    return {"type": "visible", "t": t, "targetId": target, "side": side}


def _counter(t: float, key: str = "D") -> dict:
    return {"type": "counter", "t": t, "key": key}


def _key_ev(t: float, code: str, down: bool) -> dict:
    # Post-load DataFrame representation: canonical code lives in the shared `key` column.
    return {"type": "key", "t": t, "key": code, "down": down}


def _tick(t: float, keys: list[str], ads: bool = False) -> dict:
    return {"t": t, "keys": keys, "ads": ads}


def test_key_up_gives_subtick_release_event_without_touching_tick_derived_release() -> None:
    # counter D at 2.0 -> original key A. Tick keys: A held at 0,1 then released at 2 (tick-derived = 1.0,
    # +/-1 tick). The A key up is recorded at input timeStamp 1.6 (sub-tick, between tick 1.0 and 2.0).
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0, "D"), _key_ev(1.6, "A", False)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_release == 1.0  # frozen tick-derived, unchanged
    assert window.release_key == "A"
    assert window.t_release_event == 1.6  # additive sub-tick evidence
    assert window.release_source == "key_event"
    assert set(window.flags) <= KNOWN_PEEK_FLAGS  # no new flags introduced


def test_absent_key_events_fall_back_to_tick_keys_source() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0, "D")],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_release == 1.0
    assert window.t_release_event is None
    assert window.release_source == "tick_keys"


def test_no_counter_uses_latest_ad_key_up_for_event_release() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _key_ev(1.2, "A", False), _key_ev(1.8, "D", False)],
        ticks=[_tick(0.0, ["A", "D"]), _tick(1.0, []), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_counter is None
    assert window.t_release_event == 1.8  # latest (t, key) wins, mirroring the tick fallback tie-break
    assert window.release_source == "key_event"


def test_key_up_in_next_window_does_not_leak_back() -> None:
    export = _export(
        events=[
            _visible(0.0, "a"),
            _counter(2.0, "D"),
            _visible(10.0, "b", "R"),
            _key_ev(11.0, "A", False),
        ],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, []), _tick(10.0, [])],
    )

    first = build_peek_windows(export)[0]

    assert first.t_release == 1.0
    assert first.t_release_event is None  # the A key up at 11.0 belongs to the next window
    assert first.release_source == "tick_keys"


def test_latest_in_window_key_up_wins_for_original_key() -> None:
    export = _export(
        events=[
            _visible(0.0, "a"),
            _counter(3.0, "D"),
            _key_ev(1.0, "A", False),
            _key_ev(2.4, "A", False),
        ],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, []), _tick(2.0, ["A"]), _tick(3.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_release_event == 2.4


def test_unsupported_counter_key_yields_no_event_release() -> None:
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0, "Space"), _key_ev(1.5, "A", False)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.counter_key is None
    assert window.t_release is None  # parity: no tick-derived release either
    assert window.t_release_event is None
    assert window.release_source == "tick_keys"


def test_keydown_is_ignored_only_key_up_anchors_release() -> None:
    # An A key DOWN at 0.5 must not anchor the release; only the key UP at 1.6 does.
    export = _export(
        events=[_visible(0.0, "a"), _counter(2.0, "D"), _key_ev(0.5, "A", True), _key_ev(1.6, "A", False)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )

    window = build_peek_windows(export)[0]

    assert window.t_release_event == 1.6
    assert window.release_source == "key_event"


def test_unordered_key_events_produce_the_same_release_event() -> None:
    ordered = _export(
        events=[_visible(0.0, "a"), _counter(2.0, "D"), _key_ev(0.5, "A", True), _key_ev(1.6, "A", False)],
        ticks=[_tick(0.0, ["A"]), _tick(1.0, ["A"]), _tick(2.0, [])],
    )
    unordered = _export(
        events=[_key_ev(1.6, "A", False), _counter(2.0, "D"), _key_ev(0.5, "A", True), _visible(0.0, "a")],
        ticks=[_tick(2.0, []), _tick(0.0, ["A"]), _tick(1.0, ["A"])],
    )

    assert (
        build_peek_windows(ordered)[0].t_release_event
        == build_peek_windows(unordered)[0].t_release_event
        == 1.6
    )
