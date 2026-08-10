"""WP-30 / T2 -- per-session REC/MR/V distributions, REC-vs-t_detect consistency check, and
per-peek ω(t) overlays for manual review (A2-T2 lesson: aggregate numbers cannot substitute for
looking at the traces).

Runs the frozen ``phase-v1`` decomposition (:data:`DEFAULT_PHASE_PARAMS`) over the three T0/D-30.2
real fixtures (09:18/09:24/09:37) plus the committed synthetic fixture (short-window regression),
using the same T1 ``t_detect`` derivation for the REC-end consistency check. All outputs are
diagnostics for the coach report (T-exit), not the report itself.
"""

from __future__ import annotations

import csv
from dataclasses import replace
from pathlib import Path
import sys
from typing import Any

import numpy as np
import pandas as pd


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s, resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.detect import detect_samples  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.metrics.algorithms.phase import DEFAULT_PHASE_PARAMS, phase_decompose  # noqa: E402
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements, summarize_with_flags  # noqa: E402


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OVERLAY_DIR = OUTPUT_DIR / "overlays"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

#: T0/D-30.2 roster -- the only fixtures WP-30 may derive omega/epsilon metrics from.
REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)
SYNTHETIC_FIXTURE = EXPORT_DIR / "synthetic_counterstrafe.json"

#: T0 Section 3.1: the REC-vs-t_detect consistency check needs >=10 `detected` samples or it must
#: report `blocked-by-data` (OQ-S4-15) rather than a vacuous "consistent" verdict (D-29.3 lesson).
_MIN_DETECTED_SAMPLES = 10
_TICK_MS = 1000.0 / 128.0
#: "Consistent" bar: REC-end and t_detect agree within one tick's worth of median offset.
_CONSISTENCY_TOLERANCE_MS = _TICK_MS

METRIC_COLUMNS = ("rec_ms", "mr_ms", "v_ms", "peak_omega_deg_s")


def build_phase_frame(path: Path) -> pd.DataFrame:
    export = load_export(path)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = build_peek_windows(export)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    detects = {sample.peek_index: sample for sample in detect_samples(export, peeks, eye_origin=eye_origin)}

    rows = []
    for peek in peeks:
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        omega = omega_deg_s(window_ticks, strict=True).values
        raw_segments = segment_submovements(omega[1:], SEG_V2_PARAMS) if len(omega) > 1 else []
        segments = [
            replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index)
            for segment in raw_segments
        ]
        sample = phase_decompose(peek, omega, window_ticks, segments, DEFAULT_PHASE_PARAMS, detects.get(peek.index))
        rows.append(
            {
                "peek_index": sample.peek_index,
                "side": sample.side,
                "t_onset": sample.t_onset,
                "t_mr_end": sample.t_mr_end,
                "t_anchor": sample.t_anchor,
                "rec_ms": sample.rec_ms,
                "mr_ms": sample.mr_ms,
                "v_ms": sample.v_ms,
                "peak_omega_deg_s": sample.peak_omega_deg_s,
                "t_detect": sample.t_detect,
                "rec_minus_detect_ms": sample.rec_minus_detect_ms,
                "flags": sample.flags,
            }
        )
        _write_overlay(path.stem, peek.index, window_ticks["t"].to_numpy(dtype=float), omega, sample)
    return pd.DataFrame(rows)


def _write_overlay(slug: str, peek_index: int, tick_times: np.ndarray, omega: np.ndarray, sample) -> None:
    directory = OVERLAY_DIR / slug
    directory.mkdir(parents=True, exist_ok=True)
    width, height, margin = 900, 280, 36
    finite = np.nan_to_num(omega, nan=0.0, posinf=0.0, neginf=0.0)
    scale = max(float(np.max(finite)), 1.0)
    denominator = max(len(finite) - 1, 1)

    def x_of_index(index: int) -> float:
        return margin + index / denominator * (width - 2 * margin)

    def x_of_time(t: float) -> float:
        idx = float(np.interp(t, tick_times, np.arange(len(tick_times))))
        return x_of_index(idx)

    def y(value: float) -> float:
        return height - margin - value / scale * (height - 2 * margin)

    points = " ".join(f"{x_of_index(i):.2f},{y(v):.2f}" for i, v in enumerate(finite))

    bands: list[str] = []
    if sample.t_onset is not None:
        bands.append(_band(margin, x_of_time(0.0), x_of_time(sample.t_onset), height, margin, "#9ca3af"))  # REC
        if sample.t_mr_end is not None:
            bands.append(
                _band(margin, x_of_time(sample.t_onset), x_of_time(sample.t_mr_end), height, margin, "#0ea5e9")
            )  # MR
            if sample.t_anchor is not None and sample.t_anchor >= sample.t_mr_end:
                bands.append(
                    _band(margin, x_of_time(sample.t_mr_end), x_of_time(sample.t_anchor), height, margin, "#22c55e")
                )  # V

    marker = ""
    if sample.t_detect is not None:
        marker_x = x_of_time(sample.t_detect)
        marker = f'<line x1="{marker_x:.2f}" y1="{margin}" x2="{marker_x:.2f}" y2="{height - margin}" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,3" />'

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="white" />\n'
        + "\n".join(bands)
        + f'\n<polyline points="{points}" fill="none" stroke="#111827" stroke-width="2" />\n'
        + marker
        + f'\n<text x="{margin}" y="20" font-family="sans-serif" font-size="13">'
        f"{slug} peek {peek_index} ({sample.side}): grey=REC blue=MR green=V red-dash=t_detect "
        f"flags={'|'.join(sample.flags) or 'none'}</text>\n"
        "</svg>\n"
    )
    (directory / f"peek-{peek_index:03d}-overlay.svg").write_text(svg, encoding="utf-8")


def _band(margin: float, x0: float, x1: float, height: float, top_margin: float, color: str) -> str:
    left, right = sorted((x0, x1))
    return (
        f'<rect x="{left:.2f}" y="{top_margin}" width="{max(right - left, 1):.2f}" '
        f'height="{height - 2 * top_margin}" fill="{color}" fill-opacity="0.18" />'
    )


def write_distribution_reports() -> tuple[Path, Path]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    per_session_rows: list[dict[str, Any]] = []
    rec_detect_rows: list[dict[str, Any]] = []
    pooled_rec_detect = []

    for path in REAL_FIXTURES:
        frame = build_phase_frame(path)
        frame.to_csv(OUTPUT_DIR / f"phase-quality-{path.stem}.csv", index=False)
        for column in METRIC_COLUMNS:
            summary = summarize_with_flags(frame, column)
            per_session_rows.append({"session": path.stem, "metric": column, **summary})
        rec_detect_summary = summarize_with_flags(frame, "rec_minus_detect_ms")
        rec_detect_rows.append({"session": path.stem, **rec_detect_summary})
        valid = frame.loc[frame["flags"].map(lambda f: not f) & frame["rec_minus_detect_ms"].notna(), "rec_minus_detect_ms"]
        pooled_rec_detect.extend(valid.tolist())

    # Synthetic fixture: short-window regression only (must not crash, must not contribute to any
    # validity claim -- P001-only real evidence stays authoritative per KI-004 S1 R-7).
    synthetic_frame = build_phase_frame(SYNTHETIC_FIXTURE)
    synthetic_frame.to_csv(OUTPUT_DIR / f"phase-quality-{SYNTHETIC_FIXTURE.stem}.csv", index=False)
    assert all(("window_too_short",) == flags for flags in synthetic_frame["flags"]), (
        "synthetic_counterstrafe.json's 24-tick peeks must hit window_too_short deterministically "
        "(the natural short-window regression case, README S-30.3 / T2 §2)"
    )

    distributions_path = OUTPUT_DIR / "phase-distributions.csv"
    with distributions_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(per_session_rows[0]))
        writer.writeheader()
        writer.writerows(per_session_rows)

    pooled_n = len(pooled_rec_detect)
    verdict = _verdict(pooled_n, pooled_rec_detect)
    rec_detect_rows.append(
        {
            "session": "pooled (anti-vacuous gate only, not a training-effect claim)",
            "n": pooled_n,
            "n_flagged": sum(row["n_flagged"] for row in rec_detect_rows),
            "mean": float(np.mean(pooled_rec_detect)) if pooled_n else float("nan"),
            "p50": float(np.median(pooled_rec_detect)) if pooled_n else float("nan"),
            "sd": float(np.std(pooled_rec_detect, ddof=1)) if pooled_n > 1 else float("nan"),
        }
    )
    rec_detect_path = OUTPUT_DIR / "rec-minus-detect.csv"
    with rec_detect_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(rec_detect_rows[0]))
        writer.writeheader()
        writer.writerows(rec_detect_rows)

    verdict_path = OUTPUT_DIR / "rec-vs-detect-verdict.txt"
    verdict_path.write_text(
        f"pooled_n={pooled_n} (threshold {_MIN_DETECTED_SAMPLES}); verdict={verdict}\n",
        encoding="utf-8",
    )
    print(f"REC-end vs t_detect verdict: {verdict} (pooled n={pooled_n})")
    return distributions_path, rec_detect_path


def _verdict(n: int, values: list[float]) -> str:
    if n < _MIN_DETECTED_SAMPLES:
        return "blocked-by-data (OQ-S4-15): fewer than 10 valid REC-end/t_detect pairs"
    median = float(np.median(values))
    if abs(median) <= _CONSISTENCY_TOLERANCE_MS:
        return f"consistent: median REC-end - t_detect = {median:.3f} ms (<= 1 tick = {_TICK_MS:.4f} ms)"
    return f"systematic divergence: median REC-end - t_detect = {median:.3f} ms (> 1 tick = {_TICK_MS:.4f} ms)"


def main() -> None:
    distributions, rec_detect = write_distribution_reports()
    print(distributions)
    print(rec_detect)


if __name__ == "__main__":
    main()
