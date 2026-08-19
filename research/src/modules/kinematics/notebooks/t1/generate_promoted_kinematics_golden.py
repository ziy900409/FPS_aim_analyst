"""Generate WP-32/T1 golden fixtures for promoted kinematics.

Writes are intentionally confined to this notebook script. The algorithm modules
remain pure and only return arrays/data structures.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
from scipy.signal import savgol_filter


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s  # noqa: E402
from shared.filters import sg_filter  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"

SG_WINDOW = 11
SG_POLY = 3
SG_VERSION = "sg-seg-v2"
GENERATED_DATE = "2026-08-17"
GENERATOR = "research/src/modules/kinematics/notebooks/t1/generate_promoted_kinematics_golden.py"
SYNTHETIC_T1_EXPORT = EXPORT_DIR / "synthetic_counterstrafe_t1_long.json"

REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)


def sg_coefficients_payload() -> dict[str, Any]:
    """Extract scipy's actual linear operator for the frozen SG instance."""

    half = SG_WINDOW // 2
    basis = np.eye(SG_WINDOW, dtype=float)
    columns = [
        np.asarray(savgol_filter(column, window_length=SG_WINDOW, polyorder=SG_POLY), dtype=float)
        for column in basis
    ]
    matrix = np.column_stack(columns)
    return {
        "version": SG_VERSION,
        "window": SG_WINDOW,
        "poly": SG_POLY,
        "interior": _json_floats(matrix[half]),
        "leadingEdge": [_json_floats(row) for row in matrix[:half]],
        "trailingEdge": [_json_floats(row) for row in matrix[half + 1 :]],
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_DATE,
        "source": "scipy.signal.savgol_filter(window_length=11, polyorder=3, mode='interp') basis-vector extraction",
    }


def omega_payload(source: Path) -> dict[str, Any]:
    export = load_export(source)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    omega = omega_deg_s(ticks, strict=True)
    finite = omega.values[np.isfinite(omega.values)]
    smoothed = sg_filter(omega.values[1:], window=SG_WINDOW, poly=SG_POLY)
    return {
        "version": "omega-v1",
        "source": source.name,
        "omegaSource": omega.source,
        "sampleCount": int(len(omega.values)),
        "finiteCount": int(len(finite)),
        "maxOmegaDegPerSec": float(np.max(finite)) if len(finite) else None,
        "values": _json_floats_or_null(omega.values),
        "sg": {
            "version": SG_VERSION,
            "input": "omega.values[1:]",
            "values": _json_floats(smoothed),
        },
    }


def generate_synthetic_t1_export() -> Path:
    payload = make_synthetic_export(SyntheticSpec(peek_count=6, ticks_per_peek=24))
    SYNTHETIC_T1_EXPORT.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return SYNTHETIC_T1_EXPORT


def generate_all() -> tuple[Path, ...]:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    synthetic = generate_synthetic_t1_export()
    sg_path = GOLDEN_DIR / "sg-coeffs-seg-v2.json"
    sg_path.write_text(json.dumps(sg_coefficients_payload(), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    written.append(sg_path)

    for source in (*REAL_FIXTURES, synthetic):
        path = GOLDEN_DIR / f"omega-{source.stem}.json"
        path.write_text(json.dumps(omega_payload(source), indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(path)

    written.append(synthetic)
    return tuple(written)


def _json_floats(values: np.ndarray) -> list[float]:
    return [float(value) for value in values]


def _json_floats_or_null(values: np.ndarray) -> list[float | None]:
    return [None if not math.isfinite(float(value)) else float(value) for value in values]


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
