"""Deterministic T3 parameter sweep and optional real-data overlay generation."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from itertools import product
from pathlib import Path
import sys
from typing import Any

import numpy as np


SOURCE_ROOT = Path(__file__).resolve().parents[4]
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s  # noqa: E402
from modules.segments.algorithms import (  # noqa: E402
    DEFAULT_SEGMENT_PARAMS,
    Segment,
    SegmentParams,
    segment_submovements,
)


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"


@dataclass(frozen=True)
class SyntheticCase:
    name: str
    omega: np.ndarray
    expected: tuple[tuple[str, int, int], ...]
    expected_result_flag: str | None = None


def _profile(
    length: int,
    pulses: tuple[tuple[int, int, float], ...],
    *,
    first_nan: bool = True,
) -> np.ndarray:
    values = np.zeros(length, dtype=float)
    for start, end, amplitude in pulses:
        phase = np.linspace(0.0, np.pi, end - start + 1)
        values[start : end + 1] = np.maximum(
            values[start : end + 1], amplitude * np.sin(phase)
        )
    if first_nan:
        values[0] = np.nan
    return values


def synthetic_cases() -> tuple[SyntheticCase, ...]:
    close_double = np.zeros(32, dtype=float)
    close_double[8:18] = (
        0.0,
        120.0,
        360.0,
        720.0,
        420.0,
        520.0,
        680.0,
        360.0,
        120.0,
        0.0,
    )
    return (
        SyntheticCase(
            "single_flick",
            _profile(48, ((10, 26, 720.0),)),
            (("primary_flick", 10, 26),),
        ),
        SyntheticCase(
            "flick_plus_one_micro",
            _profile(64, ((6, 20, 720.0), (34, 44, 360.0))),
            (("primary_flick", 6, 20), ("micro_adjustment", 34, 44)),
        ),
        SyntheticCase(
            "flick_plus_three_micro",
            _profile(
                88,
                ((4, 18, 720.0), (28, 38, 390.0), (48, 58, 360.0), (68, 78, 330.0)),
            ),
            (
                ("primary_flick", 4, 18),
                ("micro_adjustment", 28, 38),
                ("micro_adjustment", 48, 58),
                ("micro_adjustment", 68, 78),
            ),
        ),
        SyntheticCase("zero_motion", np.zeros(32), (), "zero_motion"),
        SyntheticCase("constant_motion", np.full(32, 240.0), (), "no_peak"),
        SyntheticCase("close_double_peak", close_double, (("primary_flick", 8, 17),)),
    )


def candidate_params() -> list[SegmentParams]:
    return [
        SegmentParams(window, 3, sigma, floor, low, stop, "sweep")
        for window, sigma, floor, low, stop in product(
            (5, 7, 9),
            (0.25, 0.5, 0.75),
            (60.0, 80.0, 100.0),
            (0.05, 0.1, 0.15),
            (0.15, 0.2, 0.25),
        )
        if low <= stop
    ]


def _score(params: SegmentParams) -> dict[str, Any]:
    failures = 0
    boundary_errors: list[int] = []
    for case in synthetic_cases():
        segments = segment_submovements(case.omega, params)
        kinds_match = [segment.kind for segment in segments] == [item[0] for item in case.expected]
        count_matches = len(segments) == len(case.expected)
        flag_matches = case.expected_result_flag is None or case.expected_result_flag in segments.flags
        if not (kinds_match and count_matches and flag_matches):
            failures += 1
            continue
        for segment, (_, expected_start, expected_end) in zip(segments, case.expected, strict=True):
            boundary_errors.extend(
                (abs(segment.start_idx - expected_start), abs(segment.end_idx - expected_end))
            )

    max_error = max(boundary_errors, default=0)
    return {
        "sg_window": params.sg_window,
        "sg_poly": params.sg_poly,
        "peak_sigma_k": params.peak_sigma_k,
        "peak_floor_deg_s": params.peak_floor_deg_s,
        "low_ratio": params.low_ratio,
        "stop_ratio": params.stop_ratio,
        "case_failures": failures,
        "max_boundary_error_ticks": max_error,
        "passes": failures == 0 and max_error <= 2,
        "selected_seg_v1": _same_numeric_params(params, DEFAULT_SEGMENT_PARAMS),
    }


def _same_numeric_params(left: SegmentParams, right: SegmentParams) -> bool:
    return (
        left.sg_window,
        left.sg_poly,
        left.peak_sigma_k,
        left.peak_floor_deg_s,
        left.low_ratio,
        left.stop_ratio,
    ) == (
        right.sg_window,
        right.sg_poly,
        right.peak_sigma_k,
        right.peak_floor_deg_s,
        right.low_ratio,
        right.stop_ratio,
    )


def write_synthetic_sweep() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [_score(params) for params in candidate_params()]
    rows.sort(
        key=lambda row: (
            not row["passes"],
            row["case_failures"],
            row["max_boundary_error_ticks"],
            not row["selected_seg_v1"],
            row["sg_window"],
            row["peak_sigma_k"],
            row["peak_floor_deg_s"],
            row["low_ratio"],
            row["stop_ratio"],
        )
    )
    output = OUTPUT_DIR / "synthetic-boundary-errors.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    selected = next(row for row in rows if row["selected_seg_v1"])
    if not selected["passes"]:
        raise RuntimeError(f"selected {DEFAULT_SEGMENT_PARAMS.version} parameters failed: {selected}")
    return output


def write_real_evidence(path: Path) -> tuple[Path, Path]:
    export = load_export(path)
    visible = export.events.loc[export.events["type"] == "visible"].sort_values("t")
    summary_rows: list[dict[str, Any]] = []
    segment_rows: list[dict[str, Any]] = []

    for ordinal, (_, event) in enumerate(visible.iterrows()):
        start_t = float(event["t"])
        next_t = float(visible.iloc[ordinal + 1]["t"]) if ordinal + 1 < len(visible) else np.inf
        ticks = export.ticks.loc[(export.ticks["t"] >= start_t) & (export.ticks["t"] < next_t)].reset_index()
        omega = omega_deg_s(ticks)
        segments = segment_submovements(omega)
        summary_rows.append(
            {
                "peek_index": ordinal,
                "tick_count": len(ticks),
                "segment_count": len(segments),
                "has_primary_flick": any(segment.kind == "primary_flick" for segment in segments),
                "result_flags": "|".join(segments.flags),
            }
        )
        for segment_index, segment in enumerate(segments):
            segment_rows.append(
                {
                    "peek_index": ordinal,
                    "segment_index": segment_index,
                    "kind": segment.kind,
                    "start_idx": segment.start_idx,
                    "end_idx": segment.end_idx,
                    "peak_omega_deg_s": segment.peak_omega,
                    "flags": "|".join(segment.flags),
                }
            )
        _write_overlay(ordinal, omega, segments)

    segmented = sum(bool(row["has_primary_flick"]) for row in summary_rows)
    overview = {
        "export": path.name,
        "peek_count": len(summary_rows),
        "segmented_peeks": segmented,
        "no_segment_peeks": len(summary_rows) - segmented,
        "success_rate": segmented / len(summary_rows) if summary_rows else 0.0,
        "total_segments": len(segment_rows),
        "params_version": DEFAULT_SEGMENT_PARAMS.version,
    }
    summary_path = OUTPUT_DIR / "real-segmentation-summary.csv"
    with summary_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(overview))
        writer.writeheader()
        writer.writerow(overview)

    segments_path = OUTPUT_DIR / "real-peek-segments.csv"
    fields = (
        "peek_index",
        "segment_index",
        "kind",
        "start_idx",
        "end_idx",
        "peak_omega_deg_s",
        "flags",
    )
    with segments_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(segment_rows)
    return summary_path, segments_path


def _write_overlay(ordinal: int, omega: np.ndarray, segments: list[Segment]) -> None:
    width, height, margin = 1200, 360, 36
    finite = np.nan_to_num(omega, nan=0.0, posinf=0.0, neginf=0.0)
    scale = max(float(np.max(finite)), 1.0)
    denominator = max(len(finite) - 1, 1)

    def x(index: int) -> float:
        return margin + index / denominator * (width - 2 * margin)

    def y(value: float) -> float:
        return height - margin - value / scale * (height - 2 * margin)

    points = " ".join(f"{x(index):.2f},{y(value):.2f}" for index, value in enumerate(finite))
    bands = []
    for segment in segments:
        color = "#0ea5e9" if segment.kind == "primary_flick" else "#fb923c"
        bands.append(
            f'<rect x="{x(segment.start_idx):.2f}" y="{margin}" '
            f'width="{max(x(segment.end_idx) - x(segment.start_idx), 1):.2f}" '
            f'height="{height - 2 * margin}" fill="{color}" fill-opacity="0.18" />'
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="white" />\n'
        + "\n".join(bands)
        + f'\n<polyline points="{points}" fill="none" stroke="#111827" stroke-width="2" />\n'
        f'<text x="{margin}" y="22" font-family="sans-serif" font-size="14">'
        f'peek {ordinal}: omega deg/s + {DEFAULT_SEGMENT_PARAMS.version} segments</text>\n'
        "</svg>\n"
    )
    (OUTPUT_DIR / f"real-peek-{ordinal:03d}-overlay.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--real-export", type=Path)
    args = parser.parse_args()

    synthetic_path = write_synthetic_sweep()
    print(synthetic_path)
    if args.real_export is not None:
        for output in write_real_evidence(args.real_export):
            print(output)


if __name__ == "__main__":
    main()
