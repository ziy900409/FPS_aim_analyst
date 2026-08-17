"""WP-31 / T2 -- per-session key-velocity coupling correlograms and the `gate-v1` verdict (FR-D14).

The correlogram tables are the visible deliverable; the verdict is the one that decides what they
are allowed to *mean*. `gate-v1`'s three criteria, their thresholds, their iteration counts and
their RNG seed were all frozen at T0 (D-31.4) **before any real xcorr value existed** -- this script
only runs them. If a threshold looks wrong while reading the output, the protocol is to record it
and carry it to a `gate-v2`, never to edit it here.

Key state comes from `ticks[].keys`, which shares omega's 128 Hz grid, so the two channels need no
clock alignment at all. The additive `key` events (WP-29 / T3) are the independent witness that the
grid lost no transition -- reported by `key_event_crosscheck`, never substituted for the tick state
(README §0.6).

Runtime is dominated by criterion 1: 1000 permutations x ~20 peeks x 65 lags per session. It is a
single-threaded loop on purpose -- a worker pool would reorder the seeded RNG's draws and silently
destroy the reproducibility `gate-v1` requires (WP-31 README §6).
"""

from __future__ import annotations

import csv
from dataclasses import asdict, replace
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
from modules.metrics.algorithms.coupling import (  # noqa: E402
    DEFAULT_GATE_THRESHOLDS,
    DEFAULT_XCORR_PARAMS,
    key_event_crosscheck,
    reliability_gate,
    xcorr_table,
)
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

#: T0/D-30.2 roster (WP-31 README §0.1) -- `tick-integral` exports only.
REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)
SYNTHETIC_FIXTURE = EXPORT_DIR / "synthetic_counterstrafe.json"

#: Columns holding per-peek arrays: needed by the gate, useless in a CSV.
_ARRAY_COLUMNS = ("key_state", "omega", "correlogram")

_NOMINAL_DT_MS = 1000.0 / 128.0
_DT_TOLERANCE_MS = 1e-6


def build_xcorr_frame(path: Path, params=DEFAULT_XCORR_PARAMS) -> pd.DataFrame:
    """Per-peek cross-correlation rows for one export, labelled with that export's session."""

    export = load_export(path)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = build_peek_windows(export)

    ticks_by_peek: list[pd.DataFrame] = []
    omega_by_peek: list[np.ndarray] = []
    for peek in peeks:
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        _assert_tick_rate(window_ticks["t"].to_numpy(dtype=float))
        ticks_by_peek.append(window_ticks)
        omega_by_peek.append(omega_deg_s(window_ticks, strict=True).values)

    return xcorr_table(peeks, ticks_by_peek, omega_by_peek, params, session=path.stem)


def _assert_tick_rate(tick_times: np.ndarray) -> None:
    """`max_lag_ms` is converted to ticks through the data's own dt, so the dt is checked, not assumed."""

    if tick_times.size < 2:
        return
    median_interval = float(np.median(np.diff(tick_times)))
    assert abs(median_interval - _NOMINAL_DT_MS) <= _DT_TOLERANCE_MS, (
        f"expected a {_NOMINAL_DT_MS:.6f} ms tick, but this window's median interval is "
        f"{median_interval:.6f} ms"
    )


def _summarize(frame: pd.DataFrame, session: str) -> dict[str, Any]:
    valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
    strengths = np.abs(valid["peak_strength"].to_numpy(dtype=float))
    lags = valid["peak_lag_ms"].to_numpy(dtype=float)
    return {
        "session": session,
        "n": int(strengths.size),
        "n_excluded": int(len(frame) - strengths.size),
        "abs_strength_p50": float(np.median(strengths)) if strengths.size else float("nan"),
        "abs_strength_p25": float(np.percentile(strengths, 25)) if strengths.size else float("nan"),
        "abs_strength_p75": float(np.percentile(strengths, 75)) if strengths.size else float("nan"),
        "signed_strength_p50": float(np.median(valid["peak_strength"].to_numpy(dtype=float)))
        if strengths.size
        else float("nan"),
        "peak_lag_ms_p50": float(np.median(lags)) if lags.size else float("nan"),
        "peak_lag_ms_p25": float(np.percentile(lags, 25)) if lags.size else float("nan"),
        "peak_lag_ms_p75": float(np.percentile(lags, 75)) if lags.size else float("nan"),
        "n_key_leads": int((lags < 0).sum()),
        "n_omega_leads": int((lags > 0).sum()),
    }


def _write_tables(frame: pd.DataFrame, session: str) -> None:
    frame.drop(columns=list(_ARRAY_COLUMNS)).to_csv(OUTPUT_DIR / f"xcorr-table-{session}.csv", index=False)

    rows = [
        {
            "peek_index": int(row.peek_index),
            "side": row.side,
            "lag_ms": lag_ms,
            "r": r,
            "n_overlap": overlap,
        }
        for row in frame.itertuples()
        for lag_ms, r, overlap in row.correlogram
    ]
    path = OUTPUT_DIR / f"xcorr-correlogram-{session}.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("peek_index", "side", "lag_ms", "r", "n_overlap"))
        writer.writeheader()
        writer.writerows(rows)


def write_reports() -> dict[str, Any]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    session_rows: list[dict[str, Any]] = []
    crosschecks: dict[str, Any] = {}
    frames: list[pd.DataFrame] = []

    for path in REAL_FIXTURES:
        frame = build_xcorr_frame(path)
        _write_tables(frame, path.stem)
        _write_correlogram_svg(frame, path.stem)
        session_rows.append(_summarize(frame, path.stem))
        frames.append(frame)

    # Short-window regression: the synthetic fixture's peeks are 24 ticks (23 paired samples after
    # dropping omega's leading nan), below `xcorr-v1.min_ticks=32`, so both peeks must degrade to
    # `window_too_short` deterministically -- never a fabricated r, never an exception.
    synthetic = build_xcorr_frame(SYNTHETIC_FIXTURE)
    _write_tables(synthetic, SYNTHETIC_FIXTURE.stem)
    assert all(flags == ("window_too_short",) for flags in synthetic["flags"]), (
        "synthetic_counterstrafe.json's 24-tick peeks must hit window_too_short deterministically"
    )

    for path in (*REAL_FIXTURES, SYNTHETIC_FIXTURE):
        export = load_export(path)
        crosschecks[path.stem] = key_event_crosscheck(export.ticks, export.events)

    distributions_path = OUTPUT_DIR / "xcorr-distributions.csv"
    with distributions_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(session_rows[0]))
        writer.writeheader()
        writer.writerows(session_rows)

    verdicts = reliability_gate(
        pd.concat(frames, ignore_index=True), DEFAULT_GATE_THRESHOLDS, DEFAULT_XCORR_PARAMS
    )
    payload = {
        "xcorr_params": asdict(DEFAULT_XCORR_PARAMS),
        "gate_thresholds": asdict(DEFAULT_GATE_THRESHOLDS),
        # Frozen at T0, before any real value existed; reproduced here so a reader of the artefact
        # alone can see the ceiling that applies to every verdict below (D-31.4).
        "upper_bound_clause": (
            "gate-v1 is weaker than split-half r: it shows the signal is not accidental and the "
            "estimate is stable, and does NOT demonstrate individual-difference reliability. Under "
            "this sample structure (1 participant x 3 sessions x 20 peeks) 'coach_report' is "
            "unreachable; the best attainable verdict is 'research_only'."
        ),
        "sample_limitation": (
            "Single anonymous participant P001, three sessions on one 240 Hz machine, one drill "
            "config. Not population-level evidence (KI-004 R-7)."
        ),
        "verdicts": [asdict(verdict) for verdict in verdicts],
    }
    (OUTPUT_DIR / "xcorr-gate-verdicts.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "xcorr-key-event-crosscheck.json").write_text(
        json.dumps(crosschecks, indent=2) + "\n", encoding="utf-8"
    )

    for verdict in verdicts:
        print(
            f"{verdict.session}: verdict={verdict.verdict} reason={verdict.reason} n={verdict.n} "
            f"observed={verdict.observed:.4f} p={verdict.shuffle_p} "
            f"ci=[{verdict.ci_lo}, {verdict.ci_hi}] width={verdict.ci_width} "
            f"half_delta={verdict.half_delta} half_within_ci={verdict.half_within_ci}"
        )
    for session, report in crosschecks.items():
        print(f"crosscheck {session}: {report['status']} matched={report['n_matched']}/{report['n_tick_transitions']}")
    return payload


def _write_correlogram_svg(frame: pd.DataFrame, session: str) -> None:
    """Per-peek correlograms in grey with their median in colour, plus the overlap-count context.

    The overlap curve is drawn on purpose (S-31.1): at the edges of a +-250 ms band a ~62-tick peek
    only has ~30 paired samples left, so a correlogram that rises at both ends may be showing sample
    scarcity rather than coupling. Printing r without printing n invites exactly that misreading.
    """

    valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
    if valid.empty:
        return

    curves = [np.array([r for _, r, _ in row.correlogram], dtype=float) for row in valid.itertuples()]
    lags = np.array([lag for lag, _, _ in valid.iloc[0]["correlogram"]], dtype=float)
    overlaps = np.array(
        [
            float(np.median([row.correlogram[index][2] for row in valid.itertuples()]))
            for index in range(lags.size)
        ]
    )
    median_curve = np.nanmedian(np.vstack(curves), axis=0)

    width, height, margin = 780, 400, 58
    x_lo, x_hi = float(lags.min()), float(lags.max())
    y_lo, y_hi = -1.0, 1.0

    def x_of(value: float) -> float:
        return margin + (value - x_lo) / (x_hi - x_lo) * (width - 2 * margin)

    def y_of(value: float) -> float:
        return height - margin - (value - y_lo) / (y_hi - y_lo) * (height - 2 * margin)

    def polyline(values: np.ndarray, stroke: str, opacity: float, stroke_width: float) -> str:
        points = " ".join(
            f"{x_of(lag):.2f},{y_of(value):.2f}"
            for lag, value in zip(lags, values, strict=True)
            if np.isfinite(value)
        )
        return (
            f'<polyline points="{points}" fill="none" stroke="{stroke}" '
            f'stroke-opacity="{opacity}" stroke-width="{stroke_width}" />'
        )

    overlap_scale = float(overlaps.max()) if overlaps.max() > 0 else 1.0
    overlap_curve = polyline(overlaps / overlap_scale * 2.0 - 1.0, "#9ca3af", 0.9, 1.2)
    per_peek = "\n".join(polyline(curve, "#0ea5e9", 0.25, 1.0) for curve in curves)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="white" />\n'
        f'<line x1="{margin}" y1="{y_of(0.0):.2f}" x2="{width - margin}" y2="{y_of(0.0):.2f}" stroke="#111827" />\n'
        f'<line x1="{x_of(0.0):.2f}" y1="{margin}" x2="{x_of(0.0):.2f}" y2="{height - margin}" '
        'stroke="#111827" stroke-dasharray="4,3" />\n'
        f"{per_peek}\n{overlap_curve}\n{polyline(median_curve, '#dc2626', 1.0, 2.2)}\n"
        f'<text x="{margin}" y="24" font-family="sans-serif" font-size="13">Key-velocity correlogram '
        f'-- {session} (n={len(valid)} peeks); blue=per peek, red=median, grey=paired-sample count '
        f'(scaled, max {int(overlap_scale)})</text>\n'
        f'<text x="{margin}" y="42" font-family="sans-serif" font-size="12">negative lag = key state '
        'leads &#969; &#183; positive lag = &#969; leads key state &#183; r on [-1, 1]</text>\n'
        f'<text x="{width / 2:.0f}" y="{height - 16}" font-family="sans-serif" font-size="12" '
        'text-anchor="middle">lag (ms)</text>\n'
        f'<text x="16" y="{height / 2:.0f}" font-family="sans-serif" font-size="12" '
        f'transform="rotate(-90 16 {height / 2:.0f})" text-anchor="middle">signed Pearson r</text>\n'
        "</svg>\n"
    )
    (OUTPUT_DIR / f"xcorr-correlogram-{session}.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    write_reports()


if __name__ == "__main__":
    main()
