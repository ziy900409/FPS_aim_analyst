"""Session-level construct presence gate.

Complements the existing format-only gates (schema, dt, purity, epsilon-parity), none of which
ask whether the recorded behavior is actually the one the drill claims to measure. See
docs/known_issue/KI-006-C/README.md for the diagnosis this closes and the frozen-threshold
evidence (``construct-v1``).
"""

from __future__ import annotations

from dataclasses import dataclass
import math

from .loader import Export


CONSTRUCT_PARAMS_VERSION = "construct-v1"

_CONSTRUCT_ABSENT_PREFIX = "construct_absent:"

#: Session-level flag vocabulary. Deliberately kept separate from segments'
#: ``QUALITY_FLAG_VOCABULARY`` (peek/segment level, lives in the ``segments`` module) so ``ingest``
#: does not gain a reverse dependency on it; both are documented side by side in
#: docs/operational/analysis-segments.md with a Level column.
CONSTRUCT_FLAG_VOCABULARY = (
    "construct_absent:<construct>",
    "construct_unknown",
)


def is_known_construct_flag(flag: str) -> bool:
    """Return whether *flag* is an exact or templated vocabulary member."""

    return flag in CONSTRUCT_FLAG_VOCABULARY or (
        flag.startswith(_CONSTRUCT_ABSENT_PREFIX) and bool(flag.removeprefix(_CONSTRUCT_ABSENT_PREFIX).strip())
    )


@dataclass(frozen=True)
class ConstructRule:
    """A drill family's core construct declaration (frozen; changes require a version bump, C-6)."""

    construct: str
    min_counter_events: int
    min_moving_tick_ratio: float


@dataclass(frozen=True)
class ConstructReport:
    """Session-level presence verdict. ``present is None`` iff the family is unregistered (unknown, not absent)."""

    drill_id: str
    family: str | None
    construct: str | None
    present: bool | None
    params_version: str
    counter_event_count: int
    tick_count: int
    moving_tick_count: int
    moving_tick_ratio: float
    thresholds: ConstructRule | None
    flags: tuple[str, ...]


#: Family -> declared construct condition. Only ``counterstrafe`` is registered today: the
#: ``tracking_*`` / ``detection_*`` families' declared values are not present in ``meta`` yet
#: (KI-006-C README §2.4 ③) -- hardcoding a threshold for them would be a guess.
CONSTRUCT_REGISTRY: dict[str, ConstructRule] = {
    "counterstrafe": ConstructRule(
        construct="counter-strafe",
        min_counter_events=1,
        min_moving_tick_ratio=0.05,
    ),
}

_SYNTHETIC_PREFIX = "synthetic_"


def resolve_drill_family(drill_id: str) -> str | None:
    """Resolve *drill_id* to a registered construct family.

    Strips a leading ``synthetic_`` marker, then takes the first underscore-delimited token and
    looks it up in :data:`CONSTRUCT_REGISTRY`. Unregistered names resolve to ``None`` (unknown,
    not absent) rather than guessing, so a newly added drill is visibly unguarded instead of
    silently passing.
    """

    family = drill_id.removeprefix(_SYNTHETIC_PREFIX).split("_", 1)[0]
    return family if family in CONSTRUCT_REGISTRY else None


def check_construct_presence(export: Export) -> ConstructReport:
    """Determine whether *export* contains the core construct its drill family declares.

    Reads only ``export.meta['drillId']``, ``export.events['type']``, and ``export.ticks['vx']``
    (single O(n) scan of already-loaded frames); ``counter`` events are counted, never re-derived
    from ``keys``/``vx`` (C-4 / D-C4).
    """

    drill_id = export.meta["drillId"]
    family = resolve_drill_family(drill_id)

    counter_event_count = int((export.events["type"] == "counter").sum())
    tick_count = len(export.ticks)
    moving_tick_count = int((export.ticks["vx"] != 0).sum())
    moving_tick_ratio = moving_tick_count / tick_count if tick_count else math.nan

    if family is None:
        return ConstructReport(
            drill_id=drill_id,
            family=None,
            construct=None,
            present=None,
            params_version=CONSTRUCT_PARAMS_VERSION,
            counter_event_count=counter_event_count,
            tick_count=tick_count,
            moving_tick_count=moving_tick_count,
            moving_tick_ratio=moving_tick_ratio,
            thresholds=None,
            flags=("construct_unknown",),
        )

    rule = CONSTRUCT_REGISTRY[family]
    # ``moving_tick_ratio`` is nan when tick_count == 0; nan >= anything is False, so an empty
    # export resolves to present=False here without a separate branch (FM-2).
    present = counter_event_count >= rule.min_counter_events and moving_tick_ratio >= rule.min_moving_tick_ratio
    flags = () if present else (f"{_CONSTRUCT_ABSENT_PREFIX}{rule.construct}",)

    return ConstructReport(
        drill_id=drill_id,
        family=family,
        construct=rule.construct,
        present=present,
        params_version=CONSTRUCT_PARAMS_VERSION,
        counter_event_count=counter_event_count,
        tick_count=tick_count,
        moving_tick_count=moving_tick_count,
        moving_tick_ratio=moving_tick_ratio,
        thresholds=rule,
        flags=flags,
    )
