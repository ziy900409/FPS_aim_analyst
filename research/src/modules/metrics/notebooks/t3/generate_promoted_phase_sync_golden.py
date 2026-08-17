"""Generate WP-32/T3 golden fixtures for promoted phase-v1 and sync-v1 parity.

Writes are confined to this notebook script. Algorithm modules stay pure.
"""

from __future__ import annotations

from dataclasses import asdict, replace
import json
import math
from pathlib import Path
import sys
from typing import Any, Iterable

import numpy as np


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s, resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms.detect import detect_samples  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.metrics.algorithms.phase import DEFAULT_PHASE_PARAMS, PHASE_VERSION, phase_decompose  # noqa: E402
from modules.metrics.algorithms.sync import DEFAULT_SYNC_PARAMS, SYNC_VERSION, evaluate_release_precision, sync_metrics  # noqa: E402
from modules.metrics.algorithms.timeline import stat  # noqa: E402
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
GENERATOR = "research/src/modules/metrics/notebooks/t3/generate_promoted_phase_sync_golden.py"
GENERATED_AT = "2026-08-17"

PHASE_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
    EXPORT_DIR / "synthetic_counterstrafe_t1_long.json",
)

SYNC_FIXTURES = PHASE_FIXTURES + (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json",
)


def phase_payload(source: Path) -> dict[str, Any]:
    export = load_export(source)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    peeks = build_peek_windows(export)
    detects = detect_samples(export, peeks, eye_origin=resolve_eye_origin(export.meta, strict=True))
    samples = []
    for peek in peeks:
        window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
        omega = omega_deg_s(window_ticks, strict=True).values
        raw_segments = segment_submovements(omega[1:], SEG_V2_PARAMS) if len(omega) > 1 else []
        segments = [
            replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index)
            for segment in raw_segments
        ]
        sample = phase_decompose(
            peek,
            omega,
            window_ticks,
            segments,
            DEFAULT_PHASE_PARAMS,
            detects[peek.index],
        )
        samples.append(_phase_sample_payload(sample))

    return {
        "version": PHASE_VERSION,
        "segmentVersion": SEG_V2_PARAMS.version,
        "source": source.name,
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_AT,
        "filterDegeneratePolicy": "excluded-from-ts-flags",
        "peekCount": len(samples),
        "nonDegenerateCount": sum(1 for sample in samples if not sample["flags"]),
        "samples": samples,
        "aggregate": _phase_aggregate(samples),
    }


def sync_payload(source: Path) -> dict[str, Any]:
    export = load_export(source)
    peeks = build_peek_windows(export)
    table = sync_metrics(peeks, export.ticks)
    verdicts = evaluate_release_precision(table, DEFAULT_SYNC_PARAMS, sim_hz=int(export.meta["simHz"]))
    rows = [
        {
            "peekIndex": int(row["peek_index"]),
            "releaseToFireMs": _json_number(row["release_to_fire_ms"]),
            "counterHoldMs": _json_number(row["counter_hold_ms"]),
            "counterToFireMs": _json_number(row["counter_to_fire_ms"]),
            "side": row["side"],
            "ads": row["ads"] if isinstance(row["ads"], bool) else None,
            "weaponMode": row["weapon_mode"],
            "flags": list(row["flags"]),
        }
        for _, row in table.iterrows()
    ]

    return {
        "version": SYNC_VERSION,
        "source": source.name,
        "generatedBy": GENERATOR,
        "generatedAt": GENERATED_AT,
        "peekCount": len(rows),
        "unflaggedCount": sum(1 for row in rows if not row["flags"]),
        "rows": rows,
        "aggregate": _sync_aggregate(rows, verdicts),
    }


def generate_all() -> tuple[Path, ...]:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for source in PHASE_FIXTURES:
        path = GOLDEN_DIR / f"phase-{source.stem}.json"
        path.write_text(json.dumps(phase_payload(source), indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(path)
    for source in SYNC_FIXTURES:
        path = GOLDEN_DIR / f"sync-{source.stem}.json"
        path.write_text(json.dumps(sync_payload(source), indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(path)
    return tuple(written)


def _phase_sample_payload(sample: Any) -> dict[str, Any]:
    python_flags = list(sample.flags)
    ts_flags = [flag for flag in python_flags if flag != "filter_degenerate"]
    return {
        "peekIndex": int(sample.peek_index),
        "side": sample.side,
        "tOnset": _json_number(sample.t_onset),
        "tMrEnd": _json_number(sample.t_mr_end),
        "tAnchor": _json_number(sample.t_anchor),
        "recMs": _json_number(sample.rec_ms),
        "mrMs": _json_number(sample.mr_ms),
        "vMs": _json_number(sample.v_ms),
        "peakOmegaDegPerSec": _json_number(sample.peak_omega_deg_s),
        "tDetect": _json_number(sample.t_detect),
        "recMinusDetectMs": _json_number(sample.rec_minus_detect_ms),
        "flags": ts_flags,
        "pythonFlags": python_flags,
    }


def _phase_aggregate(samples: list[dict[str, Any]]) -> dict[str, Any]:
    unflagged = [sample for sample in samples if not sample["flags"]]
    return {
        "recMs": _stat(sample["recMs"] for sample in unflagged),
        "mrMs": _stat(sample["mrMs"] for sample in unflagged),
        "vMs": _stat(sample["vMs"] for sample in unflagged),
        "peakOmegaDegPerSec": _stat(sample["peakOmegaDegPerSec"] for sample in unflagged),
        "flagCounts": _flag_counts(samples),
        "version": PHASE_VERSION,
    }


def _sync_aggregate(rows: list[dict[str, Any]], verdicts: Iterable[Any]) -> dict[str, Any]:
    unflagged = [row for row in rows if not row["flags"]]
    return {
        "releaseToFireMs": _stat(row["releaseToFireMs"] for row in unflagged),
        "counterHoldMs": _stat(row["counterHoldMs"] for row in unflagged),
        "counterToFireMs": _stat(row["counterToFireMs"] for row in unflagged),
        "verdicts": [_verdict_payload(verdict) for verdict in verdicts],
        "flagCounts": _flag_counts(rows),
        "version": SYNC_VERSION,
    }


def _verdict_payload(verdict: Any) -> dict[str, Any]:
    payload = asdict(verdict)
    return {
        "metric": payload["metric"],
        "n": int(payload["n"]),
        "sampleSdMs": _json_number(payload["sample_sd_ms"]),
        "quantizationSdMs": float(payload["quantization_sd_ms"]),
        "verdict": payload["verdict"],
        "reason": payload["reason"],
    }


def _stat(values: Iterable[float | None]) -> dict[str, Any]:
    return asdict(stat(value for value in values if value is not None))


def _flag_counts(rows: Iterable[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        for flag in row["flags"]:
            counts[flag] = counts.get(flag, 0) + 1
    return counts


def _json_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, np.number)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
