"""Generate WP-32/T2 golden fixtures for promoted seg-v2 submovement parity.

Writes are confined to this notebook script. Algorithm modules stay pure.
"""

from __future__ import annotations

from dataclasses import replace
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
from scipy.signal import find_peaks


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
GENERATOR = "research/src/modules/segments/notebooks/t2/generate_promoted_segments_golden.py"
GENERATED_AT = "2026-08-17"

REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)

PEAK_CASES: dict[str, tuple[float, ...]] = {
    "single_spike": (0.0, 3.0, 0.0),
    "even_plateau": (0.0, 3.0, 3.0, 0.0),
    "odd_plateau": (0.0, 3.0, 3.0, 3.0, 0.0),
    "endpoint_plateaus": (3.0, 3.0, 0.0, 2.0, 0.0, 4.0, 4.0),
    "two_adjacent_peaks": (0.0, 5.0, 0.0, 4.0, 0.0),
}

SEGMENT_CASES: dict[str, tuple[float, ...]] = {
    "empty_signal": (),
    "all_non_finite": (math.nan, math.inf),
    "interpolated_short_signal": (0.0, math.nan, 300.0, 0.0),
    "zero_motion": (0.0, 0.0, 0.0),
    "below_floor_short_signal": (0.0, 10.0, 0.0),
    "no_peak_plateau": tuple(240.0 for _ in range(32)),
    "short_signal_primary": (0.0, 300.0, 0.0),
    "truncated_at_window_edge": (300.0, 500.0, 700.0, 500.0, 300.0, 200.0, 180.0),
    "merged_adjacent_peaks": (0.0, 100.0, 300.0, 100.0, 250.0, 0.0),
}


def real_segments_payload(source: Path) -> dict[str, Any]:
    export = load_export(source)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = []
    primary_count = 0
    for peek in build_peek_windows(export):
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        omega = omega_deg_s(window_ticks, strict=True).values
        if len(omega) > 1:
            raw_segments = segment_submovements(omega[1:], SEG_V2_PARAMS)
            trace_flags = tuple(raw_segments.flags)
        else:
            raw_segments = []
            trace_flags = ()
        segments = [
            replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index)
            for segment in raw_segments
        ]
        primary_count += sum(1 for segment in segments if segment.kind == "primary_flick")
        peeks.append(
            {
                "peekIndex": int(peek.index),
                "targetId": peek.target_id,
                "side": peek.side,
                "tickRange": {
                    "start": int(peek.tick_slice.start or 0),
                    "end": int(peek.tick_slice.stop or len(ticks)),
                },
                "tickCount": int(len(window_ticks)),
                "indexFrame": "tick",
                "segments": [_segment_payload(segment) for segment in segments],
                "traceFlags": list(trace_flags),
            }
        )
    return {
        "version": "segments-v1",
        "segmentVersion": SEG_V2_PARAMS.version,
        "source": source.name,
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_AT,
        "indexFrame": "tick",
        "peekCount": len(peeks),
        "primaryCount": primary_count,
        "peeks": peeks,
    }


def synthetic_segments_payload() -> dict[str, Any]:
    return {
        "version": "segments-v1",
        "segmentVersion": SEG_V2_PARAMS.version,
        "source": "synthetic_submovement_cases",
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_AT,
        "indexFrame": "signal",
        "peakCases": [
            {
                "name": name,
                "values": _json_floats_or_null(np.asarray(values, dtype=float)),
                "peaks": [int(index) for index in find_peaks(np.asarray(values, dtype=float))[0]],
            }
            for name, values in PEAK_CASES.items()
        ],
        "segmentCases": [
            {
                "name": name,
                "omega": _json_floats_or_null(np.asarray(values, dtype=float)),
                "segments": [_segment_payload(segment) for segment in segment_submovements(values, SEG_V2_PARAMS)],
                "traceFlags": list(segment_submovements(values, SEG_V2_PARAMS).flags),
            }
            for name, values in SEGMENT_CASES.items()
        ],
    }


def generate_all() -> tuple[Path, ...]:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for source in REAL_FIXTURES:
        path = GOLDEN_DIR / f"segments-{source.stem}.json"
        path.write_text(json.dumps(real_segments_payload(source), indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(path)

    synthetic_path = GOLDEN_DIR / "segments-synthetic_submovement_cases.json"
    synthetic_path.write_text(
        json.dumps(synthetic_segments_payload(), indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    written.append(synthetic_path)
    return tuple(written)


def _segment_payload(segment: Any) -> dict[str, Any]:
    payload = {
        "kind": segment.kind,
        "startIdx": int(segment.start_idx),
        "endIdx": int(segment.end_idx),
        "peakOmega": float(segment.peak_omega),
        "flags": list(segment.flags),
    }
    if segment.peek_index is not None:
        payload["peekIndex"] = int(segment.peek_index)
    return payload


def _json_floats_or_null(values: np.ndarray) -> list[float | None]:
    return [None if not math.isfinite(float(value)) else float(value) for value in values]


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
