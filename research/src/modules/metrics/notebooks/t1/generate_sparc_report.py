"""WP-31 / T1 -- per-session SPARC distributions over the `phase-v1` MR intervals, plus the
N=32/64 zero-padding step diagnostic that decides whether SPARC may be read across segment lengths
at all (OQ-S4-18).

The distribution table is the FR-D13 deliverable; the step diagnostic is the one that decides what
the table is allowed to *mean*. At 128 Hz an MR interval of 24-32 ticks pads to a 32-point FFT and
33-58 ticks pads to a 64-point one -- and the measured median interval is 32, sitting exactly on that
boundary -- so "this flick was less smooth" and "this flick was one tick longer" can look identical
unless the step is measured. Per D-31.2 the step is answered with a **usage restriction**, never by
retuning a ported constant.

Segments come from the frozen source (D-31.3/D-31.5): per-peek `seg-v2` segmentation, first
`primary_flick`, identical to `notebooks/t2/generate_phase_report.py`. Nothing here re-derives a
boundary.
"""

from __future__ import annotations

import csv
from dataclasses import replace
import json
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
from modules.kinematics.algorithms.angular import omega_deg_s  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.metrics.algorithms.sparc import (  # noqa: E402
    DEFAULT_SPARC_PARAMS,
    sparc_length_sensitivity,
    sparc_table,
)
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements  # noqa: E402


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

#: T0/D-30.2 roster (WP-31 README §0.1) -- `tick-integral` exports only.
REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)
SYNTHETIC_FIXTURE = EXPORT_DIR / "synthetic_counterstrafe.json"

#: `sparc-v1.fs_hz` is a registered assumption, not an observation -- so it is checked against the
#: data rather than trusted (the export's own median tick spacing must be 1/fs_hz).
_DT_TOLERANCE_MS = 1e-6


def build_sparc_frame(path: Path, params=DEFAULT_SPARC_PARAMS) -> pd.DataFrame:
    """Per-peek SPARC rows for one export, using the frozen `phase-v1` MR interval as the unit."""

    export = load_export(path)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = build_peek_windows(export)

    omega_by_peek: list[np.ndarray] = []
    segments_by_peek: list[list] = []
    for peek in peeks:
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        _assert_fs(window_ticks["t"].to_numpy(dtype=float), params)
        omega = omega_deg_s(window_ticks, strict=True).values
        raw = segment_submovements(omega[1:], SEG_V2_PARAMS) if len(omega) > 1 else []
        # Same +1 index mapping back into the window frame as generate_phase_report.py: the frozen
        # convention, not a local choice (C-D4).
        segments_by_peek.append(
            [replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index) for segment in raw]
        )
        omega_by_peek.append(omega)

    return sparc_table(peeks, omega_by_peek, segments_by_peek, params)


def _assert_fs(tick_times: np.ndarray, params) -> None:
    if tick_times.size < 2:
        return
    median_interval = float(np.median(np.diff(tick_times)))
    expected = 1000.0 / params.fs_hz
    assert abs(median_interval - expected) <= _DT_TOLERANCE_MS, (
        f"{params.version}.fs_hz={params.fs_hz} implies a {expected:.6f} ms tick, "
        f"but this window's median interval is {median_interval:.6f} ms"
    )


def _summarize(frame: pd.DataFrame, session: str) -> dict[str, Any]:
    valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
    values = valid["sparc"].to_numpy(dtype=float)
    lengths = valid["n_ticks"].to_numpy(dtype=float)
    return {
        "session": session,
        "n": int(values.size),
        "n_excluded": int(len(frame) - values.size),
        "sparc_mean": float(np.mean(values)) if values.size else float("nan"),
        "sparc_p50": float(np.median(values)) if values.size else float("nan"),
        "sparc_p25": float(np.percentile(values, 25)) if values.size else float("nan"),
        "sparc_p75": float(np.percentile(values, 75)) if values.size else float("nan"),
        "sparc_sd": float(np.std(values, ddof=1)) if values.size > 1 else float("nan"),
        "n_ticks_p50": float(np.median(lengths)) if lengths.size else float("nan"),
        "n_pad32": int((valid["padded_n"] == 32).sum()),
        "n_pad64": int((valid["padded_n"] == 64).sum()),
    }


def write_reports() -> dict[str, Any]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    session_rows: list[dict[str, Any]] = []
    pooled = []

    for path in REAL_FIXTURES:
        frame = build_sparc_frame(path)
        frame.to_csv(OUTPUT_DIR / f"sparc-table-{path.stem}.csv", index=False)
        session_rows.append(_summarize(frame, path.stem))
        pooled.append(frame)

    # Short-window regression: the synthetic fixture's MR intervals are 9 ticks, below the ported
    # MIN_SAMPLES=16, so both peeks must degrade to `too_few_samples` deterministically -- never a
    # fabricated 0.0 and never an exception (README §3, "退化不得 crash").
    synthetic_frame = build_sparc_frame(SYNTHETIC_FIXTURE)
    synthetic_frame.to_csv(OUTPUT_DIR / f"sparc-table-{SYNTHETIC_FIXTURE.stem}.csv", index=False)
    assert all(flags == ("too_few_samples",) for flags in synthetic_frame["flags"]), (
        "synthetic_counterstrafe.json's 9-tick MR intervals must hit too_few_samples deterministically"
    )

    pooled_frame = pd.concat(pooled, ignore_index=True)
    session_rows.append(_summarize(pooled_frame, "pooled (padding-step diagnostic only, not a training-effect claim)"))

    distributions_path = OUTPUT_DIR / "sparc-distributions.csv"
    with distributions_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(session_rows[0]))
        writer.writeheader()
        writer.writerows(session_rows)

    sensitivity = sparc_length_sensitivity(pooled_frame, DEFAULT_SPARC_PARAMS)
    (OUTPUT_DIR / "sparc-length-sensitivity.json").write_text(
        json.dumps(sensitivity, indent=2) + "\n", encoding="utf-8"
    )
    _write_scatter(pooled_frame, sensitivity)

    print(f"length-sensitivity verdict: {sensitivity['verdict']} ({sensitivity['reason']})")
    for bucket in sensitivity["buckets"]:
        print(
            f"  padded_n={bucket['padded_n']} bins<=20Hz={bucket['bins_le_fc']} n={bucket['n']} "
            f"median={bucket['median']:.4f} IQR={bucket['iqr']:.4f}"
        )
    return sensitivity


def _write_scatter(frame: pd.DataFrame, sensitivity: dict[str, Any]) -> None:
    """SPARC vs MR length, coloured by padding bucket, with the L=32/33 boundary drawn in."""

    valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
    lengths = valid["n_ticks"].to_numpy(dtype=float)
    values = valid["sparc"].to_numpy(dtype=float)
    width, height, margin = 760, 380, 56
    x_lo, x_hi = float(lengths.min()) - 2, float(lengths.max()) + 2
    y_lo, y_hi = float(values.min()) - 0.05, float(values.max()) + 0.05

    def x_of(value: float) -> float:
        return margin + (value - x_lo) / (x_hi - x_lo) * (width - 2 * margin)

    def y_of(value: float) -> float:
        return height - margin - (value - y_lo) / (y_hi - y_lo) * (height - 2 * margin)

    points = "\n".join(
        f'<circle cx="{x_of(length):.2f}" cy="{y_of(value):.2f}" r="3.5" '
        f'fill="{"#0ea5e9" if padded == 32 else "#f97316"}" fill-opacity="0.75" />'
        for length, value, padded in zip(lengths, values, valid["padded_n"], strict=True)
    )

    boundary_x = x_of(32.5)
    medians = "\n".join(
        f'<line x1="{margin}" y1="{y_of(bucket["median"]):.2f}" x2="{width - margin}" '
        f'y2="{y_of(bucket["median"]):.2f}" stroke="{"#0ea5e9" if bucket["padded_n"] == 32 else "#f97316"}" '
        'stroke-width="1.5" stroke-dasharray="6,4" />'
        for bucket in sensitivity["buckets"]
    )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="white" />\n'
        f'<line x1="{margin}" y1="{height - margin}" x2="{width - margin}" y2="{height - margin}" stroke="#111827" />\n'
        f'<line x1="{margin}" y1="{margin}" x2="{margin}" y2="{height - margin}" stroke="#111827" />\n'
        f'<line x1="{boundary_x:.2f}" y1="{margin}" x2="{boundary_x:.2f}" y2="{height - margin}" '
        'stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3" />\n'
        f"{medians}\n{points}\n"
        f'<text x="{margin}" y="24" font-family="sans-serif" font-size="13">SPARC vs MR length '
        f'(n={len(valid)}, pooled 3 sessions, P001) -- blue=padded_n 32 (6 bins &#8804;20Hz), '
        f'orange=padded_n 64 (11 bins); red dash = L=32/33 padding boundary</text>\n'
        f'<text x="{margin}" y="42" font-family="sans-serif" font-size="12">step_ratio='
        f'{sensitivity["step_ratio"]:.4f} vs threshold {sensitivity["step_ratio_threshold"]} '
        f'&#8594; {sensitivity["verdict"]}; dashed horizontal lines = bucket medians</text>\n'
        f'<text x="{width / 2:.0f}" y="{height - 16}" font-family="sans-serif" font-size="12" '
        'text-anchor="middle">MR length (ticks @128 Hz)</text>\n'
        f'<text x="16" y="{height / 2:.0f}" font-family="sans-serif" font-size="12" '
        f'transform="rotate(-90 16 {height / 2:.0f})" text-anchor="middle">SPARC</text>\n'
        "</svg>\n"
    )
    (OUTPUT_DIR / "sparc-vs-length.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    write_reports()


if __name__ == "__main__":
    main()
