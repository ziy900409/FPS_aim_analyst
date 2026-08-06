"""Drill-level metrics that reproduce the frozen ``compute-v1`` semantics."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Iterable, Sequence

import numpy as np

from modules.ingest.algorithms.loader import Export
from modules.metrics.algorithms.peek import PeekWindow, build_peek_windows


TIMELINE_VERSION = "timeline-v1"
COMPUTE_VERSION = "compute-v1"


@dataclass(frozen=True)
class Stat:
    mean: float
    p50: float
    sd: float
    n: int


@dataclass(frozen=True)
class TimelineMetrics:
    counter_reaction_ms: Stat
    fire_timing_alignment_ms: Stat
    first_shot_hit_rate: float
    peeks: tuple[PeekWindow, ...]


def stat(values: Iterable[float]) -> Stat:
    """Match frozen ``compute-v1``: finite values, linear p50, population SD."""

    finite = [float(value) for value in values if _finite(value)]
    if not finite:
        return Stat(mean=0.0, p50=0.0, sd=0.0, n=0)
    mean = sum(finite) / len(finite)
    variance = sum((value - mean) ** 2 for value in finite) / len(finite)
    ordered = sorted(finite)
    index = (len(ordered) - 1) * 0.5
    lower = math.floor(index)
    upper = math.ceil(index)
    weight = index - lower
    p50 = ordered[lower] * (1 - weight) + ordered[upper] * weight
    return Stat(mean=mean, p50=p50, sd=math.sqrt(variance), n=len(finite))


def timeline_metrics(export: Export) -> TimelineMetrics:
    """Compute the three frozen timeline metrics and retain every peek window."""

    peeks = tuple(build_peek_windows(export))
    counter_reactions = [
        peek.t_counter - peek.t_visible for peek in peeks if peek.t_counter is not None
    ]
    fire_alignments = [
        peek.t_first_shot - peek.t_counter
        for peek in peeks
        if peek.t_counter is not None and peek.t_first_shot is not None
    ]
    first_shot_hits = _first_shot_hit_count(export, peeks)
    hit_rate = (first_shot_hits / len(peeks) * 100.0) if peeks else 0.0
    return TimelineMetrics(
        counter_reaction_ms=stat(counter_reactions),
        fire_timing_alignment_ms=stat(fire_alignments),
        first_shot_hit_rate=hit_rate,
        peeks=peeks,
    )


def timeline_parity_payload(export: Export) -> dict[str, object]:
    """Return a JSON-ready payload; writing remains at the notebook boundary."""

    metrics = timeline_metrics(export)
    return {
        "version": TIMELINE_VERSION,
        "computeVersion": COMPUTE_VERSION,
        "source": export.source_path.name,
        "metrics": {
            "counterReactionMs": asdict(metrics.counter_reaction_ms),
            "fireTimingAlignmentMs": asdict(metrics.fire_timing_alignment_ms),
            "firstShotHitRate": metrics.first_shot_hit_rate,
        },
        "peeks": [
            {
                "index": peek.index,
                "targetId": peek.target_id,
                "tVisible": peek.t_visible,
                "tEnd": peek.t_end if math.isfinite(peek.t_end) else None,
                "outcome": peek.outcome,
                "flags": list(peek.flags),
            }
            for peek in metrics.peeks
        ],
    }


def first_shot_hits(export: Export, peeks: Sequence[PeekWindow]) -> tuple[bool, ...]:
    """Per-peek compatible-first-shot hit indicator under frozen ``compute-v1``.

    ``firstShotHitRate`` is exactly ``sum(...) / len(peeks) * 100``. The per-peek form is
    exposed so the report tier can stratify the rate by side/ads/weapon mode without
    writing a second definition of the frozen rule (C-D4).
    """

    events = export.events.sort_values("t", kind="stable").reset_index(drop=True)
    fires = events.loc[events["type"] == "fire"].reset_index(drop=True)
    hits = events.loc[events["type"] == "hit"].reset_index(drop=True)
    hit_shot_seqs = {
        float(value)
        for value in hits["shotSeq"].tolist()
        if _finite(value)
    }
    indicators: list[bool] = []
    for peek in peeks:
        candidates = fires.loc[
            (fires["t"] >= peek.t_visible) & (fires["t"] < peek.t_end)
        ]
        indicator = False
        for _, fire in candidates.iterrows():
            target_id = fire.get("targetId")
            if not _true(fire.get("firstShot")):
                continue
            if isinstance(target_id, str) and target_id != peek.target_id:
                continue
            shot_seq = fire.get("shotSeq")
            indicator = _true(fire.get("hit")) or (
                _finite(shot_seq) and float(shot_seq) in hit_shot_seqs
            )
            break
        indicators.append(indicator)
    return tuple(indicators)


def _first_shot_hit_count(export: Export, peeks: tuple[PeekWindow, ...]) -> int:
    return sum(first_shot_hits(export, peeks))


def _finite(value: object) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float, np.number))
        and math.isfinite(float(value))
    )


def _true(value: object) -> bool:
    return isinstance(value, (bool, np.bool_)) and bool(value)
