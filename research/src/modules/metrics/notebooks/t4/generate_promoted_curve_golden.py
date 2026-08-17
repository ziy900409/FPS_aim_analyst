"""Generate WP-32/T4 golden fixtures for promoted curve-v1 parity.

Writes are confined to this notebook script. Algorithm modules stay pure.
"""

from __future__ import annotations

import json
import math
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
from modules.kinematics.algorithms.angular import epsilon_deg, omega_deg_s, resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.curves import CURVE_VERSION, DEFAULT_CURVE_PARAMS, curve_summary, curve_table  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
GENERATOR = "research/src/modules/metrics/notebooks/t4/generate_promoted_curve_golden.py"
GENERATED_AT = "2026-08-17"

CURVE_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
    EXPORT_DIR / "synthetic_counterstrafe.json",
)


def curve_payload(source: Path) -> dict[str, Any]:
    table = build_curve_table(source)
    summary = curve_summary(table, DEFAULT_CURVE_PARAMS)
    rows = _row_payloads(table)

    return {
        "version": CURVE_VERSION,
        "source": source.name,
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_AT,
        "peekCount": len(rows) // 2,
        "rowCount": len(rows),
        "unflaggedRows": sum(1 for row in rows if not row["flags"]),
        "flagCounts": _flag_counts(rows),
        "aggregate": {
            "omega": {
                "left": _curve_entry(summary["L"]["omega"]),
                "right": _curve_entry(summary["R"]["omega"]),
            },
            "epsilon": {
                "left": _curve_entry(summary["L"]["epsilon"]),
                "right": _curve_entry(summary["R"]["epsilon"]),
            },
            "flagCounts": _flag_counts(rows),
            "version": CURVE_VERSION,
        },
    }


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


def generate_all() -> tuple[Path, ...]:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for source in CURVE_FIXTURES:
        path = GOLDEN_DIR / f"curve-{source.stem}.json"
        path.write_text(json.dumps(curve_payload(source), indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(path)
    return tuple(written)


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
    event_target = tuple(visible[field] for field in ("targetX", "targetY", "targetZ"))
    if all(_is_finite(value) for value in event_target):
        return tuple(float(value) for value in event_target)

    if not len(ticks):
        return None
    first_target = tuple(ticks.iloc[0][field] for field in ("tx", "ty", "tz"))
    if all(_is_finite(value) for value in first_target):
        return tuple(float(value) for value in first_target)
    return None


def _row_payloads(table: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "peekIndex": int(row["peek_index"]),
            "side": row["side"],
            "ads": row["ads"] if isinstance(row["ads"], bool) else None,
            "signal": row["signal"],
            "flags": list(row["flags"]),
        }
        for _, row in table.iterrows()
    ]


def _curve_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "mean": _curve_values(entry["mean"]),
        "lower": _curve_values(entry["band_lower"]),
        "upper": _curve_values(entry["band_upper"]),
        "n": int(entry["n"]),
    }


def _curve_values(values: Any) -> list[float]:
    if values is None:
        return [0.0 for _ in range(DEFAULT_CURVE_PARAMS.points)]
    return [float(value) for value in values]


def _flag_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        for flag in row["flags"]:
            counts[flag] = counts.get(flag, 0) + 1
    return counts


def _is_finite(value: object) -> bool:
    return isinstance(value, (int, float, np.number)) and not isinstance(value, bool) and math.isfinite(float(value))


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
