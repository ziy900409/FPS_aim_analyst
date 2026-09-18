"""Pure report-model assembly for the Spider Shot mouse x grip cohort.

The model consumes CSV-shaped rows emitted by ``run_cohort.py``. It never reads files and never
recomputes canonical aim constructs; mechanism columns are descriptive summaries of values
already derived by TypeScript.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
import statistics
from typing import Any

from mousegrip.algorithms.pilot import kaplan_meier


Row = Mapping[str, str]

MECHANISM_FIELDS = (
    "peak_omega_deg_per_sec",
    "entry_omega_deg_per_sec",
    "brake_retention",
    "trigger_margin_ms",
    "overshoot_deg",
    "drop_count",
    "micro_adjust_count",
    "fire_angle_error_deg",
)

CONTRAST_SPECS = (
    ("mouse_122", "固定 1-2-2｜GPW1 → DK", "A", "B", "1-2-2"),
    ("grip_dk", "固定 DK｜1-2-2 → 1-3-1", "B", "C", None),
    ("mouse_131", "固定 1-3-1｜GPW1 → DK", "A", "C", "1-3-1"),
    ("configuration", "完整配置｜GPW1/1-2-2 → DK/1-3-1", "A", "C", "1-2-2"),
)


def build_report_model(
    quality_rows: Sequence[Row],
    trial_rows: Sequence[Row],
    run_rows: Sequence[Row],
    pair_rows: Sequence[Row],
    coverage_rows: Sequence[Row],
) -> dict[str, Any]:
    """Build the JSON-safe model consumed by the offline HTML renderer."""
    participants = sorted({row["participant"] for row in run_rows})
    admitted_runs = [row for row in run_rows if _bool(row.get("admitted"))]
    admitted_trials = [row for row in trial_rows if _bool(row.get("admitted"))]

    cells = _cell_summaries(admitted_trials, admitted_runs, coverage_rows)
    cell_index = {(cell["participant"], cell["conditionId"]): cell for cell in cells}

    return {
        "participants": participants,
        "summary": {
            "participantCount": len(participants),
            "runCount": len(run_rows),
            "admittedRunCount": len(admitted_runs),
            "blockedRunCount": len(run_rows) - len(admitted_runs),
            "presentationCount": len(admitted_trials),
            "lateEventRunCount": sum(_int(row.get("late_event_count")) > 0 for row in quality_rows),
            "lateEventTotal": sum(_int(row.get("late_event_count")) for row in quality_rows),
        },
        "configurations": _configuration_summaries(run_rows, trial_rows),
        "orders": _order_rows(run_rows),
        "cells": cells,
        "contrasts": _contrast_summaries(pair_rows, run_rows, cell_index),
        "coverage": [_coverage_row(row) for row in coverage_rows],
        "blockedRuns": [
            {
                "participant": row["participant"],
                "runId": row["run_id"],
                "blockers": row.get("blockers", ""),
                "validityFlags": row.get("validity_flags", ""),
            }
            for row in quality_rows
            if not _bool(row.get("admitted"))
        ],
        "sensitivityChanges": _sensitivity_changes(run_rows),
        "policy": {
            "sensitivity": (
                "Sensitivity 是玩家對當下滑鼠與握姿的自適應；完整揭露，但不封鎖 run、cell 或 contrast。"
            ),
            "inference": "所有跨人摘要以玩家為權重；trial 數不得冒充獨立玩家樣本。",
        },
    }


def _configuration_summaries(run_rows: Sequence[Row], trial_rows: Sequence[Row]) -> list[dict[str, Any]]:
    trial_counts: dict[tuple[str, str], int] = defaultdict(int)
    for row in trial_rows:
        if _bool(row.get("admitted")):
            trial_counts[(row["mouse"], row["grip"])] += 1

    groups: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in run_rows:
        groups[(row["mouse"], row["grip"])].append(row)

    out = []
    for (mouse, grip), rows in sorted(groups.items()):
        admitted = [row for row in rows if _bool(row.get("admitted"))]
        out.append(
            {
                "mouse": mouse,
                "grip": grip,
                "label": f"{mouse}/{grip}",
                "participants": sorted({row["participant"] for row in rows}),
                "runCount": len(rows),
                "admittedRunCount": len(admitted),
                "presentationCount": trial_counts[(mouse, grip)],
            }
        )
    return out


def _cell_summaries(
    trial_rows: Sequence[Row], run_rows: Sequence[Row], coverage_rows: Sequence[Row]
) -> list[dict[str, Any]]:
    admissible = {
        row["column"] for row in coverage_rows if row.get("verdict") == "admissible"
    }
    trials_by: dict[tuple[str, str], list[Row]] = defaultdict(list)
    runs_by: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in trial_rows:
        trials_by[(row["participant"], row["condition_id"])].append(row)
    for row in run_rows:
        runs_by[(row["participant"], row["condition_id"])].append(row)

    cells = []
    for key in sorted(runs_by):
        participant, condition = key
        runs = runs_by[key]
        trials = trials_by.get(key, [])
        if not trials:
            continue
        km = kaplan_meier(
            (_float(row.get("observed_ms")) or 0.0, _int(row.get("event_observed")))
            for row in trials
        )
        first_hits = sum(_bool(row.get("first_fire_hit")) for row in trials)
        mechanisms = {
            field: _median(_numbers(row.get(field) for row in trials))
            for field in MECHANISM_FIELDS
            if field in admissible
        }
        cells.append(
            {
                "participant": participant,
                "conditionId": condition,
                "mouse": runs[0]["mouse"],
                "grip": runs[0]["grip"],
                "label": f"{runs[0]['mouse']}/{runs[0]['grip']}",
                "runCount": len(runs),
                "presentationCount": len(trials),
                "hitsPerMin": _mean(_numbers(row.get("hits_per_min") for row in runs)),
                "firstShotRate": first_hits / len(trials),
                "kmMedianMs": km.quantile(0.5),
                "kmP90Ms": km.quantile(0.9),
                "sensitivities": _unique_numbers(row.get("sensitivity") for row in runs),
                "firstShotNoisePp": _range(_numbers(row.get("first_shot_rate") for row in runs), 100),
                "hitTimeNoiseMs": _range(_numbers(row.get("km_median_ms") for row in runs)),
                "mechanisms": mechanisms,
            }
        )
    return cells


def _contrast_summaries(
    pair_rows: Sequence[Row],
    run_rows: Sequence[Row],
    cell_index: Mapping[tuple[str, str], Mapping[str, Any]],
) -> list[dict[str, Any]]:
    grips = {
        (row["participant"], row["condition_id"]): row["grip"]
        for row in run_rows
    }
    by_pair: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in pair_rows:
        by_pair[(row["participant"], row["contrast"])].append(row)

    contrasts = []
    for key, title, left, right, required_left_grip in CONTRAST_SPECS:
        rows = []
        contrast_id = f"{left}->{right}"
        for participant in sorted({p for p, c in by_pair if c == contrast_id}):
            if required_left_grip is not None and grips.get((participant, left)) != required_left_grip:
                continue
            pairs = by_pair[(participant, contrast_id)]
            left_cell = cell_index[(participant, left)]
            right_cell = cell_index[(participant, right)]
            time_deltas = _numbers(row.get("time_delta_ms") for row in pairs)
            mechanisms = {}
            for field in MECHANISM_FIELDS:
                left_value = left_cell["mechanisms"].get(field)
                right_value = right_cell["mechanisms"].get(field)
                if left_value is not None and right_value is not None:
                    mechanisms[field] = right_value - left_value
            rows.append(
                {
                    "participant": participant,
                    "pairCount": len(pairs),
                    "firstShotDeltaPp": 100 * _mean(
                        [_float(row.get("first_shot_delta")) or 0.0 for row in pairs]
                    ),
                    "hitTimeDeltaMs": _median(time_deltas),
                    "firstShotNoisePp": max(
                        left_cell["firstShotNoisePp"] or 0.0,
                        right_cell["firstShotNoisePp"] or 0.0,
                    ),
                    "hitTimeNoiseMs": max(
                        left_cell["hitTimeNoiseMs"] or 0.0,
                        right_cell["hitTimeNoiseMs"] or 0.0,
                    ),
                    "mechanismDeltas": mechanisms,
                }
            )
        contrasts.append({"key": key, "title": title, "left": left, "right": right, "rows": rows})
    return contrasts


def _order_rows(run_rows: Sequence[Row]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in run_rows:
        groups[(row["participant"], row["condition_id"])].append(row)

    out = []
    for participant in sorted({row["participant"] for row in run_rows}):
        cells = []
        for (owner, condition), rows in groups.items():
            if owner != participant:
                continue
            ordered = sorted(rows, key=lambda row: row["started_at"])
            cells.append(
                {
                    "conditionId": condition,
                    "label": f"{ordered[0]['mouse']}/{ordered[0]['grip']}",
                    "startedAt": ordered[0]["started_at"],
                    "sensitivities": _unique_numbers(row.get("sensitivity") for row in ordered),
                }
            )
        out.append({"participant": participant, "cells": sorted(cells, key=lambda cell: cell["startedAt"])})
    return out


def _sensitivity_changes(run_rows: Sequence[Row]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in run_rows:
        groups[(row["participant"], row["condition_id"])].append(row)
    changes = []
    for (participant, condition), rows in sorted(groups.items()):
        values = _unique_numbers(row.get("sensitivity") for row in sorted(rows, key=lambda r: r["started_at"]))
        if len(values) > 1:
            changes.append({"participant": participant, "conditionId": condition, "values": values})
    return changes


def _coverage_row(row: Row) -> dict[str, Any]:
    return {
        "column": row["column"],
        "tier": _int(row.get("tier")),
        "coverage": _float(row.get("coverage")) or 0.0,
        "verdict": row.get("verdict", "withheld"),
    }


def _numbers(values: Sequence[str | None] | Any) -> list[float]:
    out = []
    for value in values:
        parsed = _float(value)
        if parsed is not None:
            out.append(parsed)
    return out


def _unique_numbers(values: Any) -> list[float]:
    out = []
    for value in _numbers(values):
        if value not in out:
            out.append(value)
    return out


def _median(values: Sequence[float]) -> float | None:
    return statistics.median(values) if values else None


def _mean(values: Sequence[float]) -> float:
    return statistics.fmean(values) if values else 0.0


def _range(values: Sequence[float], scale: float = 1.0) -> float | None:
    return (max(values) - min(values)) * scale if values else None


def _float(value: object) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    return float(value)


def _int(value: object) -> int:
    return int(float(value or 0))


def _bool(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}
