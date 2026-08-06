"""Pure reconstruction of per-visible-event peek windows."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Literal

import numpy as np
import pandas as pd

from modules.ingest.algorithms.loader import Export


WINDOW_EPSILON_MS = 1e-9
KNOWN_PEEK_FLAGS = frozenset(
    {
        "empty_window",
        "hit_outside_window",
        "multiple_counters",
        "no_counter",
        "no_first_shot",
        "no_key_transition",
        "release_inferred_no_counter",
        "unsupported_counter_key",
    }
)

Key = Literal["A", "D"]
Outcome = Literal["hit", "timeout", "no_shot"]
# WP-29 / T3 (user override, additive observability): which source produced ``t_release_event``.
# ``key_event`` = an in-window input-timestamp key up of the original-direction key (sub-tick).
# ``tick_keys`` = no such key event in the window, so only the frozen tick-derived ``t_release`` is available.
ReleaseSource = Literal["key_event", "tick_keys"]


@dataclass(frozen=True)
class PeekWindow:
    """One ``[visible, next visible)`` presentation window in measurement time."""

    index: int
    target_id: str
    side: Literal["L", "R"]
    t_visible: float
    t_end: float
    t_counter: float | None
    counter_key: Key | None
    t_release: float | None
    release_key: Key | None
    t_first_shot: float | None
    fires: tuple[float, ...]
    t_hit: float | None
    outcome: Outcome
    ads: bool | None
    flags: tuple[str, ...]
    tick_slice: slice
    # WP-29 / T3 additive fields (defaults keep every existing constructor/consumer intact). ``t_release`` above
    # stays frozen tick-derived ``timeline-v1``; these carry the opt-in key-event evidence WITHOUT redefining it
    # and WITHOUT entering ``flags`` (which would change the frozen ``sync-v1`` aggregate n). See D-29.10.
    t_release_event: float | None = None
    release_source: ReleaseSource = "tick_keys"


def build_peek_windows(export: Export) -> list[PeekWindow]:
    """Return one deterministic window for every visible event, without merging."""

    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    events = export.events.sort_values("t", kind="stable").reset_index(drop=True)
    visible_events = events.loc[events["type"] == "visible"].reset_index(drop=True)
    counter_events = events.loc[events["type"] == "counter"].reset_index(drop=True)
    fire_events = events.loc[events["type"] == "fire"].reset_index(drop=True)
    hit_events = events.loc[events["type"] == "hit"].reset_index(drop=True)
    key_events = events.loc[events["type"] == "key"].reset_index(drop=True)  # WP-29 / T3 (additive, opt-in)
    hit_times_by_shot = _hit_times_by_shot(hit_events)
    tick_times = ticks["t"].to_numpy(dtype=float)

    windows: list[PeekWindow] = []
    for index, visible in visible_events.iterrows():
        t_visible = float(visible["t"])
        t_end = (
            float(visible_events.iloc[index + 1]["t"])
            if index + 1 < len(visible_events)
            else math.inf
        )
        tick_slice = _tick_slice(tick_times, t_visible, t_end)
        window_ticks = ticks.iloc[tick_slice]
        counters = _events_in_window(counter_events, t_visible, t_end)
        fires = _events_in_window(fire_events, t_visible, t_end)

        flags: list[str] = []
        if window_ticks.empty:
            flags.append("empty_window")

        t_counter: float | None = None
        counter_key: Key | None = None
        if counters.empty:
            flags.append("no_counter")
        else:
            first_counter = counters.iloc[0]
            t_counter = float(first_counter["t"])
            counter_key = _key(first_counter.get("key"))
            if counter_key is None:
                flags.append("unsupported_counter_key")
            if len(counters) > 1:
                flags.append("multiple_counters")

        counter_present_invalid = t_counter is not None and counter_key is None
        t_release, release_key = (
            (None, None)
            if counter_present_invalid
            else _release_anchor(window_ticks, counter_key)
        )
        if t_counter is None and t_release is not None:
            flags.append("release_inferred_no_counter")
        if t_release is None:
            flags.append("no_key_transition")

        # WP-29 / T3 additive: derive the sub-tick release from in-window key up events (input timeStamp),
        # mirroring the tick-derived anchor's original-key / no-counter tie-break. Absent → keep None and
        # report ``tick_keys``. This does NOT feed frozen ``t_release`` / ``sync-v1`` (D-29.10).
        key_in_window = _events_in_window(key_events, t_visible, t_end)
        t_release_event = _release_event_anchor(
            key_in_window, counter_key, counter_present_invalid
        )
        release_source: ReleaseSource = (
            "key_event" if t_release_event is not None else "tick_keys"
        )

        target_id = str(visible["targetId"])
        first_shot = _first_compatible_fire(fires, target_id)
        t_first_shot = None if first_shot is None else float(first_shot["t"])
        if first_shot is None:
            flags.append("no_first_shot")

        fire_times = tuple(float(value) for value in fires["t"].tolist())
        hit_times = _window_hit_times(fires, hit_times_by_shot)
        t_hit = min(hit_times, default=None)
        if any(hit_time >= t_end for hit_time in hit_times):
            flags.append("hit_outside_window")
        outcome: Outcome = "no_shot" if not fire_times else "hit" if hit_times else "timeout"

        ads = None if window_ticks.empty else bool(window_ticks["ads"].eq(True).any())
        unique_flags = tuple(dict.fromkeys(flags))
        if not set(unique_flags) <= KNOWN_PEEK_FLAGS:
            raise AssertionError("peek window emitted an unknown flag")

        side = str(visible["side"])
        if side not in ("L", "R"):
            raise ValueError(f"unsupported visible side: {side!r}")
        windows.append(
            PeekWindow(
                index=index,
                target_id=target_id,
                side=side,
                t_visible=t_visible,
                t_end=t_end,
                t_counter=t_counter,
                counter_key=counter_key,
                t_release=t_release,
                release_key=release_key,
                t_first_shot=t_first_shot,
                fires=fire_times,
                t_hit=t_hit,
                outcome=outcome,
                ads=ads,
                flags=unique_flags,
                tick_slice=tick_slice,
                t_release_event=t_release_event,
                release_source=release_source,
            )
        )
    return windows


def _tick_slice(times: np.ndarray, start_ms: float, end_ms: float) -> slice:
    start = int(np.searchsorted(times, start_ms - WINDOW_EPSILON_MS, side="left"))
    stop = int(np.searchsorted(times, end_ms - WINDOW_EPSILON_MS, side="left"))
    return slice(start, stop)


def _events_in_window(events: pd.DataFrame, start_ms: float, end_ms: float) -> pd.DataFrame:
    return events.loc[(events["t"] >= start_ms) & (events["t"] < end_ms)].reset_index(
        drop=True
    )


def _key(value: object) -> Key | None:
    return value if value in ("A", "D") else None


def _release_anchor(ticks: pd.DataFrame, counter_key: Key | None) -> tuple[float | None, Key | None]:
    if counter_key is not None:
        original_key: Key = "A" if counter_key == "D" else "D"
        release = _last_release_transition(ticks, original_key)
        return (release, original_key if release is not None else None)

    candidates = [
        (release, key)
        for key in ("A", "D")
        if (release := _last_release_transition(ticks, key)) is not None
    ]
    if not candidates:
        return None, None
    release, key = max(candidates, key=lambda item: (item[0], item[1]))
    return release, key


def _release_event_anchor(
    key_in_window: pd.DataFrame, counter_key: Key | None, counter_present_invalid: bool
) -> float | None:
    """Sub-tick release time from in-window key up events, parity with :func:`_release_anchor`.

    ``counter_present_invalid`` (a counter fired but its key is not A/D) yields ``None`` just like the
    tick-derived path. With a valid counter, the original-direction key is the opposite of the counter key.
    Without a counter, both A and D key ups are considered and the latest ``(t, key)`` wins.
    """

    if counter_present_invalid:
        return None
    if counter_key is not None:
        original_key: Key = "A" if counter_key == "D" else "D"
        return _last_key_up(key_in_window, original_key)

    candidates = [
        (release, key)
        for key in ("A", "D")
        if (release := _last_key_up(key_in_window, key)) is not None
    ]
    if not candidates:
        return None
    release, _ = max(candidates, key=lambda item: (item[0], item[1]))
    return release


def _last_key_up(key_in_window: pd.DataFrame, key: Key) -> float | None:
    """Latest in-window ``key`` up (``down`` is False) timestamp, or ``None`` when none exists."""

    release: float | None = None
    for _, event in key_in_window.iterrows():
        if _key(event.get("key")) == key and _false(event.get("down")):
            release = float(event["t"])
    return release


def _false(value: object) -> bool:
    return isinstance(value, (bool, np.bool_)) and not bool(value)


def _last_release_transition(ticks: pd.DataFrame, key: Key) -> float | None:
    releases: list[float] = []
    for index in range(max(len(ticks) - 1, 0)):
        held = _keys(ticks.iloc[index].get("keys"))
        next_held = _keys(ticks.iloc[index + 1].get("keys"))
        if key in held and key not in next_held:
            releases.append(float(ticks.iloc[index]["t"]))
    return releases[-1] if releases else None


def _keys(value: object) -> frozenset[str]:
    if isinstance(value, (list, tuple, set, frozenset)):
        return frozenset(str(item) for item in value)
    return frozenset()


def _first_compatible_fire(fires: pd.DataFrame, target_id: str) -> pd.Series | None:
    for _, fire in fires.iterrows():
        if not _true(fire.get("firstShot")):
            continue
        fire_target = fire.get("targetId")
        if not isinstance(fire_target, str) or fire_target == target_id:
            return fire
    return None


def _hit_times_by_shot(hit_events: pd.DataFrame) -> dict[float, tuple[float, ...]]:
    values: dict[float, list[float]] = {}
    for _, hit in hit_events.iterrows():
        shot_seq = _finite_number(hit.get("shotSeq"))
        if shot_seq is not None:
            values.setdefault(shot_seq, []).append(float(hit["t"]))
    return {shot: tuple(times) for shot, times in values.items()}


def _window_hit_times(
    fires: pd.DataFrame, hit_times_by_shot: dict[float, tuple[float, ...]]
) -> list[float]:
    hit_times: list[float] = []
    for _, fire in fires.iterrows():
        if _true(fire.get("hit")):
            hit_times.append(float(fire["t"]))
        shot_seq = _finite_number(fire.get("shotSeq"))
        if shot_seq is not None:
            hit_times.extend(hit_times_by_shot.get(shot_seq, ()))
    return hit_times


def _finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, np.number)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _true(value: object) -> bool:
    return isinstance(value, (bool, np.bool_)) and bool(value)
