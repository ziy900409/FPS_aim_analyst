"""Track P extraction for the S01 mouse x grip pilot (`spider-shot-wide-v1`).

Implements the S03-S05 half of
``docs/algorithm/spider_shot/spider-shot-wide/mouse-grip-final-workflow-2026-09-17.html``
for the one cohort that already exists: a single participant, three conditions, a fixed
condition order. Per that document's Track P contract this is a **descriptive and
methodological** extraction -- it produces no winner, no ranking and no confirmatory CI.

Three boundaries this module deliberately respects:

**Only exported readings, never a second derivation (C-D4).** Everything here is read
straight off ``events`` / ``meta``: the fire event's own ``hit`` and ``offsetDeg``, the
visible event's ``zone`` / ``side`` / coordinates, the protocol's countdown, time limit and
peek timeout. The canonical kinematic constructs -- onset, first entry, peak/entry omega,
overshoot, repositioning suspicion -- are **not** reimplemented here. They live in
the TypeScript ``src/metrics`` package, and a Python near-copy would be exactly the second definition C-D4
forbids. Metrics depending on them are reported as unavailable, not approximated.

**The active window comes from the protocol, not from the data.** ``active_end`` is
``active_start + timeLimitMs``. It is never the last shot, the last visible or the last
non-zero tick: a condition that fails more at the end of a run would otherwise get its own
dead time trimmed away and look faster (final workflow S05).

**Three kinds of "no hit" stay separate.** ``timeout`` (target survived its full 2500 ms
deadline), ``session_end`` (the task clock ran out while the target was still live --
administrative censoring) and ``unresolved`` (neither, i.e. a parsing surprise) are distinct
end reasons. Collapsing them into one failure rate is the error this task is most prone to.

Pure: no I/O, no clock, no randomness, no plotting (C-D2).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

#: Marker for the one drill this module understands. Other drills have no
#: ``zone: 'peripheral'`` presentations, so the population would silently be empty.
WIDE_DRILL_ID = "spider-shot-wide-v1"

#: Protocol constants for `spider-shot-wide-v1`, mirrored from the TypeScript drill config in
#: `src/drill` (module `spider_shot_wide_v1`).
#: Mirrored rather than imported because `research/` must not import TS (C-D1); any drift between
#: the two is a bug, so the run summary records the values it used.
COUNTDOWN_MS = 3000.0
TIME_LIMIT_MS = 60000.0
PEEK_TIMEOUT_MS = 2500.0

#: Tolerance when deciding whether a presentation reached its deadline. The sim runs at 128 Hz,
#: so a target retired at its deadline can be observed up to one tick (7.8125 ms) late.
TICK_MS = 1000.0 / 128.0


@dataclass(frozen=True)
class Presentation:
    """One peripheral target presentation -- the analysis unit of Track P."""

    presentation_index: int
    """1-based ordinal among *peripheral* presentations in this run."""

    target_id: str
    side: str
    stimulus_key: tuple[float, float, float, str]
    """Rounded target coordinates + side. Two runs may only be paired when this matches."""

    t_visible_ms: float
    """Offset from ``active_start``, so runs are comparable without wall-clock arithmetic."""

    deadline_ms: float
    """``t_visible + PEEK_TIMEOUT_MS`` -- when the target retires if never hit."""

    observed_until_ms: float
    """Earliest of: next visible, deadline, active_end. Follow-up cannot exceed this."""

    first_fire_ms: float | None
    first_fire_hit: bool | None
    first_fire_offset_deg: float | None
    """Angular error of the first shot, read from the fire event. Present even on a miss."""

    fire_count: int
    time_to_hit_ms: float | None
    end_reason: str
    """``hit`` | ``timeout`` | ``session_end`` | ``unresolved``."""

    ads_overlap: bool
    """True when a right-button hold overlaps this presentation's observation window."""

    full_follow_up: bool
    """True when the task clock allowed the target its whole 2500 ms deadline."""

    @property
    def observed_ms(self) -> float:
        """Survival-analysis time: time to hit, else time under observation."""
        if self.time_to_hit_ms is not None:
            return self.time_to_hit_ms
        return self.observed_until_ms - self.t_visible_ms

    @property
    def event_observed(self) -> int:
        """1 = hit observed, 0 = right-censored."""
        return 1 if self.time_to_hit_ms is not None else 0


@dataclass(frozen=True)
class RunTiming:
    """The active-window contract for one run, with every boundary traceable to its source."""

    active_start_ms: float
    active_end_ms: float
    boundary_source: str
    raw_duration_ms: float
    active_duration_ms: float
    countdown_trim_ms: float
    post_task_trim_ms: float
    trim_reasons: tuple[str, ...]


@dataclass(frozen=True)
class RunQuality:
    """S03 quality ledger row. ``blockers`` empty means the run may enter the main comparison."""

    validity_flags: tuple[str, ...]
    suspect: bool
    late_event_count: int
    buffer_overflow: bool
    recorder_overflow: bool
    aim_update_ratio: float
    """Share of sim ticks carrying a non-zero aim delta. A near-zero value is the KI-031
    silent-failure mode where detection dies while every validity flag stays green."""
    blockers: tuple[str, ...]
    notes: tuple[str, ...] = field(default=())


@dataclass(frozen=True)
class RunExtract:
    """Everything Track P needs from one run."""

    run_id: str
    condition_id: str
    mouse: str
    grip: str
    rep: int
    started_at: str
    timing: RunTiming
    quality: RunQuality
    presentations: tuple[Presentation, ...]
    center_presentations: int
    ads_down_count: int
    seed: int
    sensitivity: float
    dpi: int
    fov_deg: float

    @property
    def peripheral_count(self) -> int:
        return len(self.presentations)

    @property
    def unique_hits(self) -> int:
        """Each presentation contributes at most one hit -- duplicate hit events cannot inflate."""
        return sum(1 for p in self.presentations if p.time_to_hit_ms is not None)

    @property
    def hits_per_min(self) -> float:
        return self.unique_hits / (self.timing.active_duration_ms / 60000.0)

    @property
    def first_shot_hits(self) -> int:
        return sum(1 for p in self.presentations if p.first_fire_hit)

    @property
    def first_shot_rate(self) -> float:
        """No-fire and timeout stay in the denominator; eventual hits do not count."""
        return self.first_shot_hits / len(self.presentations) if self.presentations else float("nan")


def _round_key(event: dict[str, Any]) -> tuple[float, float, float, str]:
    return (
        round(float(event["targetX"]), 4),
        round(float(event["targetY"]), 4),
        round(float(event["targetZ"]), 4),
        str(event["side"]),
    )


def _ads_holds(events: Sequence[dict[str, Any]]) -> list[tuple[float, float]]:
    """Pair ``ads`` down/up events into holds. An unclosed hold runs to +inf."""
    holds: list[tuple[float, float]] = []
    open_at: float | None = None
    for event in events:
        if event.get("type") != "ads":
            continue
        if event.get("down"):
            if open_at is None:
                open_at = float(event["t"])
        elif open_at is not None:
            holds.append((open_at, float(event["t"])))
            open_at = None
    if open_at is not None:
        holds.append((open_at, float("inf")))
    return holds


def resolve_timing(payload: dict[str, Any]) -> RunTiming:
    """Apply the S05 active-window contract.

    ``active_start`` is the first visible event; ``active_end`` is ``active_start`` plus the
    protocol time limit. Anything recorded before the first visible is the countdown; anything
    after ``active_end`` is recording tail. Both are trimmed and both are named.
    """
    ticks = payload["ticks"]
    events = payload["events"]
    tick_start = float(ticks[0]["t"])
    tick_end = float(ticks[-1]["t"])
    visibles = [e for e in events if e.get("type") == "visible"]
    if not visibles:
        raise ValueError("run has no visible events; active window is undefined")

    active_start = float(visibles[0]["t"])
    active_end = active_start + TIME_LIMIT_MS
    countdown_trim = active_start - tick_start
    post_task_trim = max(0.0, tick_end - active_end)

    reasons: list[str] = []
    if countdown_trim > 0:
        reasons.append("TRIM_COUNTDOWN")
    if post_task_trim > TICK_MS:
        reasons.append("TRIM_POST_TASK")

    return RunTiming(
        active_start_ms=active_start,
        active_end_ms=active_end,
        boundary_source="protocol:firstVisible+timeLimitMs=60000",
        raw_duration_ms=tick_end - tick_start,
        active_duration_ms=TIME_LIMIT_MS,
        countdown_trim_ms=countdown_trim,
        post_task_trim_ms=post_task_trim,
        trim_reasons=tuple(reasons),
    )


def assess_quality(payload: dict[str, Any]) -> RunQuality:
    """S03 hard gate. Returns the ledger row; ``blockers`` decides admission."""
    meta = payload["meta"]
    ticks = payload["ticks"]
    validity = meta.get("validity", {})
    flags = tuple(sorted(name for name, raised in validity.items() if raised))

    moved = sum(1 for t in ticks if t.get("dYaw") or t.get("dPitch"))
    aim_ratio = moved / len(ticks) if ticks else 0.0

    blockers: list[str] = []
    if flags:
        blockers.append("INVALID_RUN")
    if meta.get("suspect"):
        blockers.append("SUSPECT_RUN")
    if meta.get("drillId") != WIDE_DRILL_ID:
        blockers.append("WRONG_DRILL")
    if aim_ratio < 0.05:
        blockers.append("DETECTOR_UNHEALTHY")

    notes: list[str] = []
    if meta.get("lateEventCount"):
        notes.append(f"lateEventCount={meta['lateEventCount']}")
    if not meta.get("crossOriginIsolated", True):
        notes.append("crossOriginIsolated=false")
    if "mouseSamples" not in meta:
        notes.append("no mouseSamples block: polling/sensor claims unavailable")

    return RunQuality(
        validity_flags=flags,
        suspect=bool(meta.get("suspect")),
        late_event_count=int(meta.get("lateEventCount", 0) or 0),
        buffer_overflow=bool(meta.get("bufferOverflow")),
        recorder_overflow=bool(meta.get("recorderOverflow")),
        aim_update_ratio=aim_ratio,
        blockers=tuple(blockers),
        notes=tuple(notes),
    )


def extract_presentations(payload: dict[str, Any], timing: RunTiming) -> tuple[Presentation, ...]:
    """Build one row per peripheral presentation.

    Fires are matched to a presentation by ``targetId``, which is unique per presentation in
    this drill, so a shot can never be attributed to the wrong target. Fires landing outside
    the presentation's observation window are ignored for first-shot purposes and counted as
    an anomaly by the caller if needed.
    """
    events = payload["events"]
    visibles = [e for e in events if e.get("type") == "visible"]
    fires_by_target: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        if event.get("type") == "fire" and event.get("targetId") is not None:
            fires_by_target.setdefault(str(event["targetId"]), []).append(event)

    holds = _ads_holds(events)
    out: list[Presentation] = []
    index = 0

    for position, visible in enumerate(visibles):
        if visible.get("zone") != "peripheral":
            continue
        index += 1
        t_visible = float(visible["t"])
        if t_visible >= timing.active_end_ms:
            continue  # spawned after the task clock expired; not part of the task
        next_visible = (
            float(visibles[position + 1]["t"]) if position + 1 < len(visibles) else float("inf")
        )
        deadline = t_visible + PEEK_TIMEOUT_MS
        observed_until = min(next_visible, deadline, timing.active_end_ms)

        target_id = str(visible["targetId"])
        fires = sorted(
            (f for f in fires_by_target.get(target_id, []) if t_visible <= float(f["t"]) <= observed_until),
            key=lambda f: float(f["t"]),
        )
        first_fire = fires[0] if fires else None
        hit_fire = next((f for f in fires if f.get("hit")), None)
        time_to_hit = float(hit_fire["t"]) - t_visible if hit_fire else None

        if hit_fire is not None:
            end_reason = "hit"
        elif next_visible <= deadline + TICK_MS and next_visible <= timing.active_end_ms:
            # A new target appeared while this one was still inside its deadline and the clock
            # had not expired: the target was retired, i.e. it ran out its peek window.
            end_reason = "timeout" if next_visible >= deadline - TICK_MS else "unresolved"
        elif observed_until >= timing.active_end_ms - TICK_MS:
            end_reason = "session_end"
        elif next_visible > deadline:
            end_reason = "timeout"
        else:
            end_reason = "unresolved"

        out.append(
            Presentation(
                presentation_index=index,
                target_id=target_id,
                side=str(visible["side"]),
                stimulus_key=_round_key(visible),
                t_visible_ms=t_visible - timing.active_start_ms,
                deadline_ms=deadline - timing.active_start_ms,
                observed_until_ms=observed_until - timing.active_start_ms,
                first_fire_ms=float(first_fire["t"]) - t_visible if first_fire else None,
                first_fire_hit=bool(first_fire["hit"]) if first_fire else None,
                first_fire_offset_deg=(
                    float(first_fire["offsetDeg"]) if first_fire and "offsetDeg" in first_fire else None
                ),
                fire_count=len(fires),
                time_to_hit_ms=time_to_hit,
                end_reason=end_reason,
                ads_overlap=any(h0 < observed_until and h1 > t_visible for h0, h1 in holds),
                full_follow_up=deadline <= timing.active_end_ms,
            )
        )

    return tuple(out)


def extract_run(
    payload: dict[str, Any],
    *,
    run_id: str,
    condition_id: str,
    mouse: str,
    grip: str,
    rep: int,
) -> RunExtract:
    """S03 + S04 for one run. ``mouse`` / ``grip`` come from the manifest, never from the payload."""
    meta = payload["meta"]
    timing = resolve_timing(payload)
    quality = assess_quality(payload)
    presentations = extract_presentations(payload, timing)
    visibles = [e for e in payload["events"] if e.get("type") == "visible"]

    return RunExtract(
        run_id=run_id,
        condition_id=condition_id,
        mouse=mouse,
        grip=grip,
        rep=rep,
        started_at=str(meta.get("startedAt", "")),
        timing=timing,
        quality=quality,
        presentations=presentations,
        center_presentations=sum(1 for v in visibles if v.get("zone") == "center"),
        ads_down_count=sum(
            1 for e in payload["events"] if e.get("type") == "ads" and e.get("down")
        ),
        seed=int(meta.get("rngSeed", -1)),
        sensitivity=float(meta.get("sensitivity", float("nan"))),
        dpi=int(meta.get("dpi", -1)),
        fov_deg=float(meta.get("fovDeg", float("nan"))),
    )


# --- survival estimates -------------------------------------------------------------------
# Time-to-hit is right-censored: a target that times out or is cut off by the task clock has
# no hit time, and dropping those rows would make the condition that fails most look fastest.


@dataclass(frozen=True)
class KaplanMeier:
    """Step function S(t) for time-to-hit, plus the follow-up limit it is valid within."""

    times: tuple[float, ...]
    survival: tuple[float, ...]
    n: int
    events: int
    max_follow_up_ms: float

    def survival_at(self, t: float) -> float:
        current = 1.0
        for time, surv in zip(self.times, self.survival):
            if time <= t:
                current = surv
            else:
                break
        return current

    def quantile(self, q: float) -> float | None:
        """Smallest t with S(t) <= 1-q, or None when the curve never gets that low."""
        target = 1.0 - q
        for time, surv in zip(self.times, self.survival):
            if surv <= target + 1e-12:
                return time
        return None

    def rmst(self, tau: float) -> float:
        """Restricted mean time-to-hit over [0, tau] -- the area under S(t)."""
        area = 0.0
        prev_t = 0.0
        prev_s = 1.0
        for time, surv in zip(self.times, self.survival):
            if time >= tau:
                break
            area += prev_s * (time - prev_t)
            prev_t, prev_s = time, surv
        area += prev_s * (tau - prev_t)
        return area


def kaplan_meier(observations: Iterable[tuple[float, int]]) -> KaplanMeier:
    """Standard Kaplan-Meier estimator over ``(time, event_observed)`` pairs."""
    rows = sorted(observations, key=lambda r: (r[0], -r[1]))
    n_total = len(rows)
    at_risk = n_total
    survival = 1.0
    times: list[float] = []
    curve: list[float] = []
    events_seen = 0

    i = 0
    while i < len(rows):
        t = rows[i][0]
        deaths = 0
        censored = 0
        while i < len(rows) and rows[i][0] == t:
            if rows[i][1] == 1:
                deaths += 1
            else:
                censored += 1
            i += 1
        if deaths and at_risk > 0:
            survival *= 1.0 - deaths / at_risk
            events_seen += deaths
            times.append(t)
            curve.append(survival)
        at_risk -= deaths + censored

    return KaplanMeier(
        times=tuple(times),
        survival=tuple(curve),
        n=n_total,
        events=events_seen,
        max_follow_up_ms=max((r[0] for r in rows), default=0.0),
    )


# --- pairing ------------------------------------------------------------------------------


@dataclass(frozen=True)
class MatchedPair:
    """One (rep, presentation_index) cell shared by two conditions with identical stimulus."""

    rep: int
    presentation_index: int
    side: str
    left: Presentation
    right: Presentation

    @property
    def first_shot_delta(self) -> int:
        """+1 = right condition hit first shot and left did not; -1 = the reverse."""
        return int(bool(self.right.first_fire_hit)) - int(bool(self.left.first_fire_hit))

    @property
    def time_delta_ms(self) -> float | None:
        """Only defined when both sides produced an uncensored hit."""
        if self.left.time_to_hit_ms is None or self.right.time_to_hit_ms is None:
            return None
        return self.right.time_to_hit_ms - self.left.time_to_hit_ms


def match_prefix(
    left_runs: Sequence[RunExtract],
    right_runs: Sequence[RunExtract],
    prefix_length: int,
) -> tuple[tuple[MatchedPair, ...], tuple[str, ...]]:
    """Pair two conditions on ``rep + presentation_index`` after verifying the stimulus matches.

    The shared seed makes the stimulus sequence identical, but identity is *verified* here
    rather than assumed: a pair whose target coordinates or side differ is dropped with a
    reason instead of silently comparing two different flicks.
    """
    pairs: list[MatchedPair] = []
    dropped: list[str] = []
    by_rep_left = {r.rep: r for r in left_runs}
    by_rep_right = {r.rep: r for r in right_runs}

    for rep in sorted(set(by_rep_left) & set(by_rep_right)):
        left_index = {p.presentation_index: p for p in by_rep_left[rep].presentations}
        right_index = {p.presentation_index: p for p in by_rep_right[rep].presentations}
        for idx in range(1, prefix_length + 1):
            left = left_index.get(idx)
            right = right_index.get(idx)
            if left is None or right is None:
                dropped.append(f"PAIR_MEMBER_MISSING rep={rep} index={idx}")
                continue
            if left.stimulus_key != right.stimulus_key:
                dropped.append(f"UNMATCHED_STIMULUS rep={rep} index={idx}")
                continue
            pairs.append(
                MatchedPair(
                    rep=rep,
                    presentation_index=idx,
                    side=left.side,
                    left=left,
                    right=right,
                )
            )

    return tuple(pairs), tuple(dropped)


def common_prefix_length(runs: Sequence[RunExtract]) -> int:
    """Longest presentation prefix every run shares, with identical stimuli throughout."""
    if not runs:
        return 0
    shortest = min(r.peripheral_count for r in runs)
    reference = runs[0].presentations
    for idx in range(shortest):
        key = reference[idx].stimulus_key
        if any(run.presentations[idx].stimulus_key != key for run in runs):
            return idx
    return shortest
