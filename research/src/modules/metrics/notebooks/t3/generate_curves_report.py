"""WP-30 / T3 -- per-session L/R 101-point normalized ω(t)/ε(t) curves + IQR-band overlays.

Runs the frozen ``curve-v1`` resampling (:data:`DEFAULT_CURVE_PARAMS`) over the three T0/D-30.2 real
fixtures (09:18/09:24/09:37) plus the committed synthetic fixture (short-window regression), using
the same strict ω/ε derivation as T1/T2. Per-session only -- three sessions from one participant are
not pooled into a cross-session curve (README §3 Out of scope / KI-004-S1 R-7 discipline). All
outputs are diagnostics for the coach report (T-exit), not the report itself.
"""

from __future__ import annotations

import csv
import math
from pathlib import Path
import sys

import numpy as np
import pandas as pd


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import epsilon_deg, omega_deg_s, resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.curves import DEFAULT_CURVE_PARAMS, curve_summary, curve_table  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402


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

SIGNALS = ("omega", "epsilon")
SIDES = ("L", "R")
_COLORS = {"L": "#2563eb", "R": "#ea580c"}


def build_curve_table(path: Path) -> pd.DataFrame:
    export = load_export(path)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = build_peek_windows(export)
    visible_events = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    eye_origin = resolve_eye_origin(export.meta, strict=True)

    peek_ticks: list[pd.DataFrame] = []
    omega_values: list[np.ndarray] = []
    epsilon_values: list[np.ndarray | None] = []
    for peek in peeks:
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        peek_ticks.append(window_ticks)
        omega_values.append(omega_deg_s(window_ticks, strict=True).values)
        fallback_target = _visible_target(visible_events.iloc[peek.index], window_ticks)
        epsilon_values.append(_epsilon_or_none(window_ticks, export.meta, eye_origin, fallback_target))

    return curve_table(peeks, omega_values, epsilon_values, peek_ticks, DEFAULT_CURVE_PARAMS)


def _epsilon_or_none(
    ticks: pd.DataFrame,
    meta: dict,
    eye_origin,
    fallback_target: tuple[float, float, float] | None,
) -> np.ndarray | None:
    if not len(ticks):
        return None
    try:
        return epsilon_deg(ticks, meta, eye_origin=eye_origin, fallback_target=fallback_target)
    except ValueError:
        return None


def _visible_target(visible: pd.Series, ticks: pd.DataFrame) -> tuple[float, float, float] | None:
    """Same fallback precedence as ``run_pipeline.py``'s ``_visible_target`` helper: prefer the
    visible event's own target coordinates, fall back to the window's first tick's target columns.
    """

    event_target = tuple(visible[field] for field in ("targetX", "targetY", "targetZ"))
    if all(_is_finite(value) for value in event_target):
        return tuple(float(value) for value in event_target)

    if not len(ticks):
        return None
    first_target = tuple(ticks.iloc[0][field] for field in ("tx", "ty", "tz"))
    if all(_is_finite(value) for value in first_target):
        return tuple(float(value) for value in first_target)
    return None


def _is_finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _write_curve_csv(path: Path, table: pd.DataFrame) -> None:
    frame = table.copy()
    frame["flags"] = frame["flags"].map(lambda flags: "|".join(flags))
    frame.to_csv(path, index=False)


def _write_overlay(session: str, signal: str, summary: dict) -> None:
    width, height, margin = 900, 320, 48
    left, right = summary["L"][signal], summary["R"][signal]
    all_values = [
        value
        for entry in (left, right)
        for key in ("mean", "band_lower", "band_upper")
        if entry[key] is not None
        for value in entry[key]
    ]
    y_min, y_max = (min(all_values), max(all_values)) if all_values else (0.0, 1.0)
    if y_min == y_max:
        y_min, y_max = y_min - 1.0, y_max + 1.0
    points = DEFAULT_CURVE_PARAMS.points

    def x(index: int) -> float:
        return margin + index / (points - 1) * (width - 2 * margin)

    def y(value: float) -> float:
        return height - margin - (value - y_min) / (y_max - y_min) * (height - 2 * margin)

    def polyline(values: list[float], color: str) -> str:
        coords = " ".join(f"{x(i):.2f},{y(v):.2f}" for i, v in enumerate(values))
        return f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="2" />'

    def band(lower: list[float], upper: list[float], color: str) -> str:
        top = " ".join(f"{x(i):.2f},{y(v):.2f}" for i, v in enumerate(upper))
        bottom = " ".join(f"{x(i):.2f},{y(v):.2f}" for i, v in reversed(list(enumerate(lower))))
        return f'<polygon points="{top} {bottom}" fill="{color}" fill-opacity="0.15" stroke="none" />'

    parts = ['<rect width="100%" height="100%" fill="white" />']
    for side, entry in (("L", left), ("R", right)):
        if entry["mean"] is None:
            continue
        parts.append(band(entry["band_lower"], entry["band_upper"], _COLORS[side]))
        parts.append(polyline(entry["mean"], _COLORS[side]))

    label = (
        f"{session} {signal}(t): blue=L (n={left['n']}, excluded={left['n_excluded']}) "
        f"orange=R (n={right['n']}, excluded={right['n_excluded']})"
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        + "\n".join(parts)
        + f'\n<text x="{margin}" y="20" font-family="sans-serif" font-size="13">{label}</text>\n'
        "</svg>\n"
    )
    (OVERLAY_DIR / f"{session}-{signal}-lr-overlay.svg").write_text(svg, encoding="utf-8")


def _summary_rows(session: str, summary: dict) -> list[dict[str, object]]:
    return [
        {"session": session, "side": side, "signal": signal, "n": summary[side][signal]["n"], "n_excluded": summary[side][signal]["n_excluded"]}
        for side in SIDES
        for signal in SIGNALS
    ]


def write_curve_reports() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    summary_rows: list[dict[str, object]] = []

    for path in REAL_FIXTURES:
        table = build_curve_table(path)
        _write_curve_csv(OUTPUT_DIR / f"curve-table-{path.stem}.csv", table)
        summary = curve_summary(table, DEFAULT_CURVE_PARAMS)
        summary_rows.extend(_summary_rows(path.stem, summary))
        for signal in SIGNALS:
            _write_overlay(path.stem, signal, summary)

    summary_path = OUTPUT_DIR / "curve-summary.csv"
    with summary_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(summary_rows[0]))
        writer.writeheader()
        writer.writerows(summary_rows)

    # Synthetic fixture: short-window regression. curve-v1's min_ticks=3 is chosen specifically so
    # this fixture's ~13-in-window-tick peeks are NOT excluded (S-30.3-style natural short-window
    # case for curve-v1 -- unlike phase-v1, where the *same* fixture deliberately DOES trip
    # window_too_short on its 24-tick full peek; curve-v1's window and threshold are both different).
    synthetic_table = build_curve_table(SYNTHETIC_FIXTURE)
    _write_curve_csv(OUTPUT_DIR / f"curve-table-{SYNTHETIC_FIXTURE.stem}.csv", synthetic_table)
    assert not any("window_too_short" in flags for flags in synthetic_table["flags"]), (
        "synthetic_counterstrafe.json's peeks must NOT trip window_too_short: min_ticks=3 is "
        "calibrated so their ~13 in-window ticks still produce a (short but valid) curve -- only "
        "pathological 1-2 tick windows are meant to be excluded (T3-lr-curves.md min_ticks rule)"
    )
    print("synthetic regression OK: no window_too_short")
    return summary_path


def main() -> None:
    summary_path = write_curve_reports()
    print(summary_path)


if __name__ == "__main__":
    main()
