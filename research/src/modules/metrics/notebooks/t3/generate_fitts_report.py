"""WP-31 / T3 -- per-session Fitts ID/MT/TP diagnostics (FR-D15).

`fitts-v1` is observational: D is the spawn eccentricity caused by where the
player left the crosshair after the previous peek, not an experimentally
manipulated target distance. MT is `t_first_shot - t_visible`, so it includes
reaction time and counter-strafe stop time. These limitations are emitted into
the JSON artefact, not left as prose in the task plan.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, replace
import json
from pathlib import Path
import sys
from typing import Any

import numpy as np


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.fitts import DEFAULT_FITTS_PARAMS, FittsResult, fitts_samples  # noqa: E402
from modules.metrics.algorithms.peek import PeekWindow, build_peek_windows  # noqa: E402


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)
SYNTHETIC_FIXTURE = EXPORT_DIR / "synthetic_counterstrafe.json"

LIMITATIONS = (
    "D is endogenous, not experimentally manipulated. The targets only appear at two fixed "
    "positions ((+-2, 1.5, -4)); D mostly comes from where the player left the crosshair after "
    "the previous peek. This is observational correlation, not a controlled Fitts design; D "
    "covaries with previous-peek overshoot/correction behavior.",
    "MT includes reaction time and counter-strafe stop time. MT = t_firstShot - t_visible, so "
    "the regression intercept absorbs RT and stopping time. t_detect is available for only 5-9 "
    "of 20 peeks in the counter-strafe drill, too few for per-peek RT subtraction; fitts-v1 "
    "therefore applies no RT correction.",
)

SAMPLE_LIMITATION = (
    "Single anonymous participant P001, three sessions on one 240 Hz machine, one drill config. "
    "Not population-level evidence (KI-004 R-7)."
)


def build_fitts_result(path: Path, *, peeks: tuple[PeekWindow, ...] | None = None) -> FittsResult:
    export = load_export(path)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    windows = tuple(build_peek_windows(export)) if peeks is None else peeks
    return fitts_samples(windows, export, eye_origin=eye_origin, params=DEFAULT_FITTS_PARAMS)


def write_reports() -> dict[str, Any]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    side_rows: list[dict[str, Any]] = []
    verdicts: list[dict[str, Any]] = []

    for path in REAL_FIXTURES:
        export = load_export(path)
        peeks = tuple(build_peek_windows(export))
        result = build_fitts_result(path, peeks=peeks)
        _write_table(result, path.stem)
        _write_scatter_svg(result, path.stem)
        rows.append(_summary_row(path.stem, "all", result))
        verdicts.append(_verdict_payload(path.stem, result))

        for side in ("L", "R"):
            side_result = build_fitts_result(path, peeks=tuple(peek for peek in peeks if peek.side == side))
            row = _summary_row(path.stem, side, side_result)
            side_rows.append(row)

    synthetic = build_fitts_result(SYNTHETIC_FIXTURE)
    _write_table(synthetic, SYNTHETIC_FIXTURE.stem)

    _write_csv(OUTPUT_DIR / "fitts-regression-summary.csv", rows)
    _write_csv(OUTPUT_DIR / "fitts-side-summary.csv", side_rows)

    payload = {
        "fitts_params": asdict(DEFAULT_FITTS_PARAMS),
        "validity_level": "observational_non_controlled",
        "limitations": list(LIMITATIONS),
        "sample_limitation": SAMPLE_LIMITATION,
        "verdicts": verdicts,
    }
    (OUTPUT_DIR / "fitts-verdicts.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    for row in rows:
        print(
            f"{row['session']}: status={row['status']} reason={row['reason']} n={row['n']} "
            f"d_ratio={row['d_ratio']} id_range={row['id_range_bits']} "
            f"slope={row['slope_ms_per_bit']} r2={row['r2']} tp={row['throughput_bits_s']}"
        )
    return payload


def _summary_row(session: str, stratum: str, result: FittsResult) -> dict[str, Any]:
    return {
        "session": session,
        "stratum": stratum,
        "status": result.status,
        "reason": result.reason,
        "n": result.n,
        "d_ratio": result.d_ratio,
        "id_range_bits": result.id_range_bits,
        "slope_ms_per_bit": result.slope_ms_per_bit,
        "intercept_ms": result.intercept_ms,
        "r2": result.r2,
        "throughput_bits_s": result.throughput_bits_s,
        "n_excluded": len(result.samples) - result.n,
    }


def _verdict_payload(session: str, result: FittsResult) -> dict[str, Any]:
    return {
        **_summary_row(session, "all", result),
        "validity_level": "observational_non_controlled",
        "limitations": list(LIMITATIONS),
    }


def _write_table(result: FittsResult, session: str) -> None:
    rows = [
        {
            "peek_index": sample.peek_index,
            "side": sample.side,
            "d_deg": sample.d_deg,
            "w_deg": sample.w_deg,
            "id_bits": sample.id_bits,
            "mt_ms": sample.mt_ms,
            "flags": ";".join(sample.flags),
        }
        for sample in result.samples
    ]
    _write_csv(OUTPUT_DIR / f"fitts-table-{session}.csv", rows)


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _write_scatter_svg(result: FittsResult, session: str) -> None:
    valid = [sample for sample in result.samples if not sample.flags]
    if not valid:
        return
    x = np.asarray([sample.id_bits for sample in valid], dtype=float)
    y = np.asarray([sample.mt_ms for sample in valid], dtype=float)
    width, height, margin = 740, 420, 62
    x_pad = max(0.05, float(np.ptp(x)) * 0.08)
    y_pad = max(10.0, float(np.ptp(y)) * 0.08)
    x_lo, x_hi = float(np.min(x) - x_pad), float(np.max(x) + x_pad)
    y_lo, y_hi = float(np.min(y) - y_pad), float(np.max(y) + y_pad)

    def x_of(value: float) -> float:
        return margin + (value - x_lo) / (x_hi - x_lo) * (width - 2 * margin)

    def y_of(value: float) -> float:
        return height - margin - (value - y_lo) / (y_hi - y_lo) * (height - 2 * margin)

    points = "\n".join(
        f'<circle cx="{x_of(sample.id_bits):.2f}" cy="{y_of(sample.mt_ms):.2f}" r="4.5" '
        f'fill="{"#2563eb" if sample.side == "R" else "#16a34a"}" />'
        for sample in valid
    )
    line = ""
    if result.slope_ms_per_bit is not None and result.intercept_ms is not None:
        y1 = result.intercept_ms + result.slope_ms_per_bit * x_lo
        y2 = result.intercept_ms + result.slope_ms_per_bit * x_hi
        line = (
            f'<line x1="{x_of(x_lo):.2f}" y1="{y_of(y1):.2f}" '
            f'x2="{x_of(x_hi):.2f}" y2="{y_of(y2):.2f}" stroke="#dc2626" stroke-width="2" />'
        )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">\n'
        '<rect width="100%" height="100%" fill="white" />\n'
        f'<line x1="{margin}" y1="{height - margin}" x2="{width - margin}" y2="{height - margin}" stroke="#111827" />\n'
        f'<line x1="{margin}" y1="{margin}" x2="{margin}" y2="{height - margin}" stroke="#111827" />\n'
        f"{line}\n{points}\n"
        f'<text x="{margin}" y="26" font-family="sans-serif" font-size="13">Fitts ID-MT -- {session} '
        f'(status={result.status}, reason={result.reason}, n={result.n})</text>\n'
        f'<text x="{margin}" y="44" font-family="sans-serif" font-size="12">observational, non-controlled design; '
        'MT includes RT + counter-strafe stop time</text>\n'
        f'<text x="{width / 2:.0f}" y="{height - 16}" font-family="sans-serif" font-size="12" text-anchor="middle">ID (bits)</text>\n'
        f'<text x="16" y="{height / 2:.0f}" font-family="sans-serif" font-size="12" '
        f'transform="rotate(-90 16 {height / 2:.0f})" text-anchor="middle">MT (ms)</text>\n'
        "</svg>\n"
    )
    (OUTPUT_DIR / f"fitts-scatter-{session}.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    write_reports()


if __name__ == "__main__":
    main()
