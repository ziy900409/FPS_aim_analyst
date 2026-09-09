"""WP-61 T2: the candidate event table -- one row per (run, theta, candidate gap).

**Every threshold here is frozen at T0** (D-61.T0-1, ``progress.md`` Pre-registration). After the
feature distributions have been looked at, these may only be version-bumped, never edited in place
(GD-20 / FR-61.5 / D-61.P6).

**Labels come only from annotations** (FR-61.3). A gap is never labelled because it is long, because
its neighbours were labelled, or because a run "should" have had one there. A candidate with no
matching annotation is ``none``, full stop.

Stage 1 segmentation is **read**, never recomputed (D-61.P4 / C-D4); see ``golden.py``.

Pure: no plotting, no printing, no writes (C-D2).
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from lift.algorithms.golden import Gap, Interval, LiftGolden


MATCH_TOLERANCE_MS = 300.0
"""Frozen event-matching tolerance. Derived from D-61.U2's ~200 ms self-report reaction time and
WP-57 section T5-real's 180-225 ms lift event length. It supports **event-level matching** ("which
gap was the lift") and explicitly **not** onset precision ("the lift began at millisecond X")."""

THETA_SWEEP_MS = (18.0, 30.0, 50.0)
"""Frozen theta sweep. All three are reported; none is selected before T3."""

CANDIDATE_COLUMNS = (
    "run_id",
    "session_id",
    "instruction_class",
    "theta_ms",
    "gap_index",
    "start_ms",
    "end_ms",
    "duration_ms",
    "label",
    "negative_group",
    "matched_annotation_index",
    "matched_annotation_start_ms",
)

LABELS = ("lift", "pause", "none")


@dataclass(frozen=True)
class Match:
    """One (annotation, gap) pairing. ``distance_ms`` is the greedy ordering key."""

    annotation_index: int
    gap_index: int
    distance_ms: float


def match_annotations_to_gaps(
    annotations: tuple[Interval, ...],
    gaps: tuple[Gap, ...],
    tolerance_ms: float = MATCH_TOLERANCE_MS,
) -> tuple[Match, ...]:
    """One-to-one greedy pairing under the frozen rule.

    An annotation interval expanded by ``tolerance_ms`` on **both** sides must overlap the gap
    interval by more than zero. Endpoint contact is not overlap -- the same rule
    ``segmentByTimeGap()`` uses for lock intervals, so a gap that merely abuts an annotation is not
    claimed by it.

    Greedy order is the smallest ``|annotation.start_ms - gap.start_ms|`` first, with ties broken by
    (annotation index, gap index) so the result is deterministic for a given input (NFR-61.5). Each
    annotation and each gap is used at most once; leftovers on either side are the false negatives
    and background respectively, and are meant to stay visible rather than be absorbed.
    """

    candidates: list[Match] = []
    for annotation_index, annotation in enumerate(annotations):
        low = annotation.start_ms - tolerance_ms
        high = annotation.end_ms + tolerance_ms
        for gap in gaps:
            if max(low, gap.start_ms) < min(high, gap.end_ms):
                candidates.append(
                    Match(
                        annotation_index=annotation_index,
                        gap_index=gap.index,
                        distance_ms=abs(annotation.start_ms - gap.start_ms),
                    )
                )

    candidates.sort(key=lambda match: (match.distance_ms, match.annotation_index, match.gap_index))

    used_annotations: set[int] = set()
    used_gaps: set[int] = set()
    accepted: list[Match] = []
    for match in candidates:
        if match.annotation_index in used_annotations or match.gap_index in used_gaps:
            continue
        used_annotations.add(match.annotation_index)
        used_gaps.add(match.gap_index)
        accepted.append(match)

    return tuple(sorted(accepted, key=lambda match: match.gap_index))


def _label_for(instruction_class: str, matched: bool) -> tuple[str, str]:
    """Return ``(label, negative_group)`` for one candidate gap.

    The frozen rule reads: positives are matched ``lift`` annotations; ``pause`` annotations that
    match a gap are pause negatives; every candidate gap in a ``oneshot`` run is a oneshot negative;
    unmatched gaps in a lift run are background and count as precision false positives.

    One deliberate reading (recorded as an interpretation in ``progress.md``, not a threshold
    change): in a ``oneshot`` run a gap that **is** matched to an annotation is labelled ``lift``,
    not a negative. The oneshot instruction is "one shot to target; press KeyL only when you
    actually lift" (``spider-wide-recording-spec.md`` section 3.3), so an annotation there reports a
    real lift. Labelling it a negative would contradict FR-61.3 -- it would let the gap's context,
    rather than the operator's annotation, decide the label. The unmatched oneshot gaps remain the
    oneshot negative group, which is what the frozen FPR is computed over.
    """

    if instruction_class == "lift":
        return ("lift", "") if matched else ("none", "background")
    if instruction_class == "pause":
        return ("pause", "pause") if matched else ("none", "")
    return ("lift", "") if matched else ("none", "oneshot")


def build_candidate_table(
    goldens: tuple[LiftGolden, ...],
    theta_sweep_ms: tuple[float, ...] = THETA_SWEEP_MS,
    tolerance_ms: float = MATCH_TOLERANCE_MS,
) -> pd.DataFrame:
    """The long table: one row per (run, theta, candidate gap).

    Row order is (input golden order, theta order, gap index) so reruns are byte-identical
    (NFR-61.5). An empty input yields an empty frame with the full column surface -- never a frame
    with no columns, which would break every downstream selection silently.
    """

    rows: list[dict[str, object]] = []
    for golden in goldens:
        for theta_ms in theta_sweep_ms:
            segmentation = golden.segmentation_at(theta_ms)
            matches = {
                match.gap_index: match
                for match in match_annotations_to_gaps(golden.annotation_intervals, segmentation.gaps, tolerance_ms)
            }
            for gap in segmentation.gaps:
                match = matches.get(gap.index)
                label, negative_group = _label_for(golden.instruction_class, match is not None)
                rows.append(
                    {
                        "run_id": golden.run_id,
                        "session_id": golden.session_id,
                        "instruction_class": golden.instruction_class,
                        "theta_ms": theta_ms,
                        "gap_index": gap.index,
                        "start_ms": gap.start_ms,
                        "end_ms": gap.end_ms,
                        "duration_ms": gap.duration_ms,
                        "label": label,
                        "negative_group": negative_group,
                        "matched_annotation_index": None if match is None else match.annotation_index,
                        "matched_annotation_start_ms": (
                            None if match is None else golden.annotation_intervals[match.annotation_index].start_ms
                        ),
                    }
                )

    return pd.DataFrame(rows, columns=list(CANDIDATE_COLUMNS))


MATCH_SUMMARY_COLUMNS = (
    "run_id",
    "session_id",
    "instruction_class",
    "theta_ms",
    "candidate_count",
    "annotation_count",
    "matched_count",
    "unmatched_annotation_count",
    "match_rate",
)


def build_match_summary(
    goldens: tuple[LiftGolden, ...],
    theta_sweep_ms: tuple[float, ...] = THETA_SWEEP_MS,
    tolerance_ms: float = MATCH_TOLERANCE_MS,
) -> pd.DataFrame:
    """Per (run, theta) coverage.

    ``unmatched_annotation_count`` is the one column a candidate-only table cannot express: an
    annotation with no candidate gap is a **missed** event, and without it recall is not computable
    from the table alone. ``match_rate`` is matched / annotation_count, and is ``NaN`` -- never 0 --
    when a run carries no annotations, because "nothing to match" is not "matched nothing".
    """

    rows: list[dict[str, object]] = []
    for golden in goldens:
        for theta_ms in theta_sweep_ms:
            segmentation = golden.segmentation_at(theta_ms)
            matches = match_annotations_to_gaps(golden.annotation_intervals, segmentation.gaps, tolerance_ms)
            annotation_count = len(golden.annotation_intervals)
            rows.append(
                {
                    "run_id": golden.run_id,
                    "session_id": golden.session_id,
                    "instruction_class": golden.instruction_class,
                    "theta_ms": theta_ms,
                    "candidate_count": len(segmentation.gaps),
                    "annotation_count": annotation_count,
                    "matched_count": len(matches),
                    "unmatched_annotation_count": annotation_count - len(matches),
                    "match_rate": float("nan") if annotation_count == 0 else len(matches) / annotation_count,
                }
            )

    return pd.DataFrame(rows, columns=list(MATCH_SUMMARY_COLUMNS))
