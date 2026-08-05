"""Generate the deterministic T2 Sync precision evidence report."""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict
import json
import math
from pathlib import Path
from statistics import stdev
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.metrics.algorithms.peek import build_peek_windows  # noqa: E402
from modules.metrics.algorithms.sync import (  # noqa: E402
    DEFAULT_SYNC_PARAMS,
    SYNC_METRICS,
    evaluate_release_precision,
    sync_metrics,
)


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OUTPUT_PATH = OUTPUT_DIR / "sync-precision.json"
SYNTHETIC_EXPORT = EXPORT_DIR / "synthetic_timeline.json"
REAL_ZERO_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json"
REAL_VALIDITY_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json"
FIXTURES = (SYNTHETIC_EXPORT, REAL_ZERO_EXPORT, REAL_VALIDITY_EXPORT)


def build_report() -> dict[str, object]:
    fixtures = [_fixture_report(path) for path in FIXTURES]
    primary = fixtures[-1]
    primary_verdicts = {
        verdict["verdict"] for verdict in primary["precisionVerdicts"]  # type: ignore[index]
    }
    if "insufficient" in primary_verdicts:
        gate_status = "triggered-pending"
        gate_reason = "09:39 has at least one insufficient sync-v1 precision verdict"
    elif primary_verdicts == {"sufficient"}:
        gate_status = "skipped"
        gate_reason = "09:39 has sufficient sync-v1 precision for both tick-quantized metrics"
    else:
        gate_status = "deferred"
        gate_reason = "09:39 lacks enough unflagged samples for a precision decision"

    sim_hz = 128
    tick_ms = 1000.0 / sim_hz
    return {
        "version": DEFAULT_SYNC_PARAMS.version,
        "params": asdict(DEFAULT_SYNC_PARAMS),
        "quantization": {
            "simHz": sim_hz,
            "tickMs": tick_ms,
            "model": "uniform tick quantization",
            "sdMs": tick_ms / math.sqrt(12.0),
        },
        "validSampleRule": (
            "finite metric value and empty flags; release_inferred_no_counter is excluded"
        ),
        "fixtures": fixtures,
        "t3Gate": {"status": gate_status, "reason": gate_reason},
    }


def generate_report(path: Path = OUTPUT_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(build_report(), indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    return path


def _fixture_report(path: Path) -> dict[str, object]:
    export = load_export(path)
    weapon = export.meta.get("weapon")
    weapon_mode = (
        "projectile"
        if isinstance(weapon, dict) and weapon.get("bullet") is not None
        else "hitscan"
    )
    rows = sync_metrics(
        build_peek_windows(export),
        export.ticks,
        weapon_mode=weapon_mode,
    )
    verdicts = evaluate_release_precision(rows, DEFAULT_SYNC_PARAMS, sim_hz=128)
    flag_counts = Counter(flag for flags in rows["flags"] for flag in flags)
    return {
        "source": path.name,
        "drillId": export.meta.get("drillId"),
        "metaSuspect": export.meta.get("suspect"),
        "weaponMode": weapon_mode,
        "peekCount": len(rows),
        "flagCounts": dict(sorted(flag_counts.items())),
        "metricStats": {
            metric: _metric_stats(rows, metric)
            for metric in (*SYNC_METRICS, "counter_to_fire_ms")
        },
        "precisionVerdicts": [asdict(verdict) for verdict in verdicts],
        "rows": [
            {
                "peekIndex": int(row["peek_index"]),
                "releaseToFireMs": _json_number(row["release_to_fire_ms"]),
                "counterHoldMs": _json_number(row["counter_hold_ms"]),
                "counterToFireMs": _json_number(row["counter_to_fire_ms"]),
                "side": row["side"],
                "ads": row["ads"],
                "weaponMode": row["weapon_mode"],
                "flags": list(row["flags"]),
            }
            for _, row in rows.iterrows()
        ],
    }


def _metric_stats(rows, metric: str) -> dict[str, float | int | None]:
    values = [
        float(row[metric])
        for _, row in rows.iterrows()
        if not row["flags"] and _json_number(row[metric]) is not None
    ]
    return {
        "n": len(values),
        "meanMs": sum(values) / len(values) if values else None,
        "sampleSdMs": stdev(values) if len(values) >= 2 else None,
    }


def _json_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def main() -> None:
    print(generate_report())


if __name__ == "__main__":
    main()
