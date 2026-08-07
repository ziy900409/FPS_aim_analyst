"""One-command research pipeline for a schema v2 export.

Runs ``ingest -> dt report -> omega/epsilon -> submovement segments -> quality
summary`` and writes the artifacts WP-29/30/31 read as their shared entry point.
This module belongs to the report tier, so file writes and console output are
allowed here; the ``algorithms/`` packages it calls stay pure.

Usage from ``research/``::

    uv run python src/report/run_pipeline.py
    uv run python src/report/run_pipeline.py --export fixtures/exports/<real>.json

The per-segment values written here (segment duration, peak angular speed, mean
epsilon) are pipeline diagnostics, not coach-report metrics: they restate
already-authoritative quantities and have not passed a construct-validity gate.

Exit codes:
    0   pipeline completed; construct present or family unknown (FR-C-9)
    1   schema/IO failure -- no artifacts written
    2   pipeline completed but the drill's core construct is absent (FR-C-8);
        artifacts are still written (KI-006-C D-C2) but the session must not be
        used as validity evidence for that drill
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import replace
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
import pandas as pd


RESEARCH_ROOT = Path(__file__).resolve().parents[2]
_SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SOURCE_ROOT))

from modules.ingest.algorithms import (  # noqa: E402
    Export,
    SchemaError,
    check_construct_presence,
    check_dt,
    load_export,
)
from modules.kinematics.algorithms.angular import epsilon_deg, omega_deg_s, resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.segments.algorithms import (  # noqa: E402
    DEFAULT_SEGMENT_PARAMS,
    Segment,
    SegmentParams,
    per_segment_apply,
    segment_submovements,
    summarize_with_flags,
)


DEFAULT_EXPORT = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"
DEFAULT_OUT_DIR = RESEARCH_ROOT / "out"

SUMMARY_FILENAME = "pipeline-summary.json"
PEEK_FILENAME = "peek-quality.csv"
SEGMENT_FILENAME = "peek-segments.csv"

#: Construct-absent exit code; kept distinct from the schema/IO failure code (1) so automation
#: can tell "pipeline broke" apart from "pipeline ran, this session isn't valid evidence" (D-C3).
EXIT_CONSTRUCT_ABSENT = 2

METRIC_COLUMNS = ("duration_ms", "peak_omega_deg_s", "mean_epsilon_deg")

# omega_deg_s returns nan at index zero by contract; segmentation consumes the
# measured tail and every reported index is shifted back by this offset.
_OMEGA_INDEX_OFFSET = 1

_PEEK_FIELDS = (
    "peek_index",
    "target_id",
    "t_visible_ms",
    "tick_count",
    "segment_count",
    "has_primary_flick",
    "flags",
)

_SEGMENT_FIELDS = (
    "peek_index",
    "segment_index",
    "kind",
    "start_idx",
    "end_idx",
    "start_t_ms",
    "end_t_ms",
    *METRIC_COLUMNS,
    "flags",
)


def run(
    export_path: Path,
    out_dir: Path,
    params: SegmentParams = DEFAULT_SEGMENT_PARAMS,
) -> dict[str, Any]:
    """Run the full chain and write the three artifacts into *out_dir*."""

    export = load_export(export_path)
    dt_report = check_dt(export.ticks, _sim_hz(export.meta))
    construct_report = check_construct_presence(export)

    # A dt gap is attributed only to the presentation window that contains it.
    # Flagging every window from the export-wide report would let one dropped
    # tick exclude every segment from every aggregate.
    gap_indices = {index for index, _ in dt_report.gaps}

    # KI-005 / A (FR-A-11/R-5): which omega derivation this export carries, surfaced once at the
    # export level rather than re-derived per peek -- every window shares the same tick columns.
    omega_source = omega_deg_s(export.ticks.sort_values("t", kind="stable").reset_index(drop=True)).source

    peek_rows: list[dict[str, Any]] = []
    segment_rows: list[dict[str, Any]] = []
    frames: list[pd.DataFrame] = []
    for window in _presentation_windows(export):
        frame, peek_row, rows = _analyze_peek(window, export.meta, gap_indices, params)
        peek_rows.append(peek_row)
        segment_rows.extend(rows)
        if not frame.empty:
            frames.append(frame)

    combined = (
        pd.concat(frames, ignore_index=True)
        if frames
        else per_segment_apply((), lambda segment: {})
    )
    summary = {
        "export": {
            "path": export.source_path.name,
            "drillId": export.meta.get("drillId"),
            "schemaVersion": export.meta.get("schemaVersion"),
            "simHz": export.meta.get("simHz"),
            "suspect": export.meta.get("suspect"),
            "omegaSource": omega_source,
        },
        "dtReport": {
            "tickCount": dt_report.tick_count,
            "medianDtMs": dt_report.median_dt_ms,
            "expectedDtMs": dt_report.expected_dt_ms,
            "gapCount": dt_report.gap_count,
            "gaps": [{"tickIndex": index, "dtMs": value} for index, value in dt_report.gaps],
            "uniform": dt_report.uniform,
        },
        "constructPresence": {
            "drillId": construct_report.drill_id,
            "family": construct_report.family,
            "construct": construct_report.construct,
            "present": construct_report.present,
            "paramsVersion": construct_report.params_version,
            "counterEventCount": construct_report.counter_event_count,
            "tickCount": construct_report.tick_count,
            "movingTickCount": construct_report.moving_tick_count,
            "movingTickRatio": construct_report.moving_tick_ratio,
            "thresholds": (
                {
                    "minCounterEvents": construct_report.thresholds.min_counter_events,
                    "minMovingTickRatio": construct_report.thresholds.min_moving_tick_ratio,
                }
                if construct_report.thresholds is not None
                else None
            ),
            "flags": list(construct_report.flags),
        },
        "segmentation": {
            "paramsVersion": params.version,
            "peekCount": len(peek_rows),
            "peeksWithPrimaryFlick": sum(row["has_primary_flick"] for row in peek_rows),
            "peeksWithoutSegment": sum(row["segment_count"] == 0 for row in peek_rows),
            "successRate": _success_rate(peek_rows),
            "segmentCount": len(segment_rows),
        },
        "quality": {
            column: summarize_with_flags(combined, column)
            for column in METRIC_COLUMNS
            if column in combined.columns
        },
        "flagCounts": _flag_counts(peek_rows, segment_rows),
    }
    if omega_source == "aim-diff-legacy":
        summary["export"]["omegaSourceWarning"] = (
            "this export has no ticks.dYaw/dPitch (pre-KI-005); omega_deg_s fell back to the "
            "aim-difference derivation, which carries the render/sim beat-aliasing bug -- see "
            "docs/known_issue/KI-005-*"
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / SUMMARY_FILENAME).write_text(
        json.dumps(_json_safe(summary), indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    _write_csv(out_dir / PEEK_FILENAME, _PEEK_FIELDS, peek_rows)
    _write_csv(out_dir / SEGMENT_FILENAME, _SEGMENT_FIELDS, segment_rows)
    return summary


def _analyze_peek(
    window: tuple[int, pd.Series, pd.DataFrame, np.ndarray],
    meta: dict[str, Any],
    gap_indices: set[int],
    params: SegmentParams,
) -> tuple[pd.DataFrame, dict[str, Any], list[dict[str, Any]]]:
    ordinal, visible, ticks, global_indices = window
    uniform = not gap_indices.intersection(global_indices.tolist())
    omega = omega_deg_s(ticks).values
    epsilon = _epsilon_or_none(ticks, visible, meta)

    # omega[i] describes the interval (i-1, i], so omega[0] is undefined rather
    # than missing. Segmenting the measured samples only keeps
    # ``non_finite_interpolated`` meaningful: were the undefined leading sample
    # included, every segment of every export would carry that flag and
    # summarize_with_flags would exclude all rows. Indices are mapped back to
    # the tick frame with _OMEGA_INDEX_OFFSET.
    segments = segment_submovements(omega[_OMEGA_INDEX_OFFSET:], params)
    indexed = [
        replace(
            segment,
            start_idx=segment.start_idx + _OMEGA_INDEX_OFFSET,
            end_idx=segment.end_idx + _OMEGA_INDEX_OFFSET,
            peek_index=ordinal,
        )
        for segment in segments
    ]

    frame = per_segment_apply(indexed, _segment_metrics(ticks, epsilon, uniform))
    tick_times = ticks["t"].to_numpy(dtype=float) if len(ticks) else np.empty(0)
    peek_flags = list(segments.flags)
    if not indexed:
        peek_flags.append("no_segment")
    if not uniform:
        peek_flags.append("non_uniform_dt")
    if epsilon is None:
        peek_flags.append("missing_target")

    peek_row = {
        "peek_index": ordinal,
        "target_id": visible["targetId"],
        "t_visible_ms": float(visible["t"]),
        "tick_count": len(ticks),
        "segment_count": len(indexed),
        "has_primary_flick": any(segment.kind == "primary_flick" for segment in indexed),
        "flags": "|".join(dict.fromkeys(peek_flags)),
    }

    rows = [
        {
            "peek_index": ordinal,
            "segment_index": index,
            "kind": segment.kind,
            "start_idx": segment.start_idx,
            "end_idx": segment.end_idx,
            "start_t_ms": tick_times[segment.start_idx],
            "end_t_ms": tick_times[segment.end_idx],
            **{column: record.get(column) for column in METRIC_COLUMNS},
            "flags": "|".join(record["flags"]),
        }
        for index, (segment, record) in enumerate(
            zip(indexed, frame.to_dict("records"), strict=True)
        )
    ]
    return frame, peek_row, rows


def _segment_metrics(
    ticks: pd.DataFrame,
    epsilon: np.ndarray | None,
    uniform: bool,
):
    """Build the per-segment metric function passed to ``per_segment_apply``."""

    tick_times = ticks["t"].to_numpy(dtype=float) if len(ticks) else np.empty(0)

    def compute(segment: Segment) -> dict[str, Any]:
        flags: tuple[str, ...] = () if uniform else ("non_uniform_dt",)
        if epsilon is None:
            return {"flags": (*flags, "missing_target")}
        span = slice(segment.start_idx, segment.end_idx + 1)
        return {
            "duration_ms": float(tick_times[segment.end_idx] - tick_times[segment.start_idx]),
            "peak_omega_deg_s": float(segment.peak_omega),
            "mean_epsilon_deg": float(np.mean(epsilon[span])),
            "flags": flags,
        }

    return compute


def _presentation_windows(
    export: Export,
) -> list[tuple[int, pd.Series, pd.DataFrame, np.ndarray]]:
    """Adapt the shared peek windows to the report pipeline's legacy tuple shape.

    Each window also carries the positions its ticks occupy in the sorted export,
    so dt gaps reported against the whole export can be attributed per window.
    """

    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    visible = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    windows = []
    for window in build_peek_windows(export):
        positions = np.arange(window.tick_slice.start, window.tick_slice.stop, dtype=int)
        windows.append(
            (
                window.index,
                visible.iloc[window.index],
                ticks.iloc[window.tick_slice].reset_index(drop=True),
                positions,
            )
        )
    return windows


def _epsilon_or_none(
    ticks: pd.DataFrame,
    visible: pd.Series,
    meta: dict[str, Any],
) -> np.ndarray | None:
    """Return authoritative epsilon, or ``None`` when the eye origin or target geometry is missing.

    KI-004/S1 T5 (FR-S1-7): resolves ``eye_origin`` with ``strict=True`` — a pre-S1
    export with no ``meta.scene.eye``/``meta.simToWorld`` must not silently fall back
    to a guessed origin here. The ``None`` result still surfaces through the existing
    ``missing_target`` quality flag at the call site, so the row is never silently
    dropped — it is left unmeasured rather than measured against a guess.
    """

    if not len(ticks):
        return None
    try:
        eye_origin = resolve_eye_origin(meta, strict=True)
    except ValueError:
        return None
    try:
        return epsilon_deg(ticks, meta, eye_origin=eye_origin, fallback_target=_visible_target(visible, ticks))
    except ValueError:
        return None


def _visible_target(visible: pd.Series, ticks: pd.DataFrame) -> tuple[float, float, float] | None:
    event_target = tuple(visible[field] for field in ("targetX", "targetY", "targetZ"))
    if all(_is_finite(value) for value in event_target):
        return tuple(float(value) for value in event_target)

    first_target = tuple(ticks.iloc[0][field] for field in ("tx", "ty", "tz"))
    if all(_is_finite(value) for value in first_target):
        return tuple(float(value) for value in first_target)
    return None


def _sim_hz(meta: dict[str, Any]) -> int:
    sim_hz = meta.get("simHz")
    if isinstance(sim_hz, bool) or not isinstance(sim_hz, (int, float)) or sim_hz <= 0:
        raise SchemaError("meta.simHz", "must be a positive number")
    return int(sim_hz)


def _success_rate(peek_rows: list[dict[str, Any]]) -> float | None:
    if not peek_rows:
        return None
    return sum(row["has_primary_flick"] for row in peek_rows) / len(peek_rows)


def _flag_counts(
    peek_rows: list[dict[str, Any]],
    segment_rows: list[dict[str, Any]],
) -> dict[str, dict[str, int]]:
    return {
        "peek": _count_flags(row["flags"] for row in peek_rows),
        "segment": _count_flags(row["flags"] for row in segment_rows),
    }


def _count_flags(values) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        for flag in filter(None, value.split("|")):
            counts[flag] = counts.get(flag, 0) + 1
    return dict(sorted(counts.items()))


def _write_csv(path: Path, fields: tuple[str, ...], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _is_finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _json_safe(value: Any) -> Any:
    """Replace non-finite numbers with ``None`` so the summary stays valid JSON."""

    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return float(value) if math.isfinite(float(value)) else None
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)

    try:
        summary = run(args.export, args.out)
    except (ValueError, OSError) as error:
        print(f"pipeline failed: {error}", file=sys.stderr)
        return 1

    dt_report = summary["dtReport"]
    segmentation = summary["segmentation"]
    construct = summary["constructPresence"]
    print(f"export           {summary['export']['path']}")
    print(f"ticks            {dt_report['tickCount']} (median dt {dt_report['medianDtMs']} ms)")
    print(f"dt gaps          {dt_report['gapCount']} (uniform={dt_report['uniform']})")
    if construct["present"] is True:
        print(f"construct        present ({construct['construct']}, {construct['paramsVersion']})")
    elif construct["present"] is None:
        print("construct        unknown (drill family not registered)")
    else:
        print(f"construct        absent ({construct['construct']}, {construct['paramsVersion']})")
    print(f"peeks            {segmentation['peekCount']}")
    print(
        f"segmented        {segmentation['peeksWithPrimaryFlick']}"
        f"/{segmentation['peekCount']} (rate {segmentation['successRate']})"
    )
    print(f"segments         {segmentation['segmentCount']} ({segmentation['paramsVersion']})")
    for name in (SUMMARY_FILENAME, PEEK_FILENAME, SEGMENT_FILENAME):
        print(args.out / name)

    if construct["present"] is False:
        print(
            f"construct absent: drill '{construct['drillId']}' declares '{construct['construct']}' "
            f"but counter_event_count={construct['counterEventCount']} "
            f"(threshold {construct['thresholds']['minCounterEvents']}), "
            f"moving_tick_ratio={construct['movingTickRatio']} "
            f"(threshold {construct['thresholds']['minMovingTickRatio']}). "
            f"this session must not be used for a validity claim about '{construct['drillId']}'.",
            file=sys.stderr,
        )
        return EXIT_CONSTRUCT_ABSENT
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
