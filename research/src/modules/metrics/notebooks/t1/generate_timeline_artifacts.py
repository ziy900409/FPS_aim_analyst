"""Generate the T1 anti-vacuous fixture, parity payloads, and coach-facing artifacts."""

from __future__ import annotations

import csv
from html import escape
import json
import math
from pathlib import Path
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import SyntheticSpec, load_export, make_synthetic_export  # noqa: E402
from modules.metrics.algorithms import timeline_metrics, timeline_parity_payload  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
PARITY_DIR = RESEARCH_ROOT / "fixtures" / "parity"
OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
SYNTHETIC_EXPORT = EXPORT_DIR / "synthetic_timeline.json"
REAL_ZERO_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json"
REAL_VALIDITY_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json"
FIXTURES = (SYNTHETIC_EXPORT, REAL_ZERO_EXPORT, REAL_VALIDITY_EXPORT)


def build_synthetic_timeline_payload() -> dict:
    """Build four peeks covering missing anchors, hit/miss, and a cross-window hit."""

    spec = SyntheticSpec(
        peek_count=4,
        missing_counter_peeks=frozenset({2}),
        missing_release_peeks=frozenset({3}),
        seed=2901,
    )
    payload = make_synthetic_export(spec)
    payload["meta"]["drillId"] = "synthetic_timeline_v1"
    dt_ms = 1000.0 / spec.sim_hz
    next_visible_t = spec.ticks_per_peek * 2 * dt_ms
    for event in payload["events"]:
        if event["type"] == "fire" and event.get("targetId") == "target-3":
            event["hit"] = False
        if event["type"] == "hit" and event.get("shotSeq") == 2:
            event["t"] = next_visible_t + dt_ms
            event["timeOfFlightMs"] = event["t"] - (spec.ticks_per_peek + 12) * dt_ms
    order = {"visible": 0, "counter": 1, "ads": 2, "fire": 3, "hit": 4}
    payload["events"].sort(key=lambda event: (event["t"], order[event["type"]]))
    return payload


def generate_all() -> tuple[Path, ...]:
    SYNTHETIC_EXPORT.write_text(
        json.dumps(build_synthetic_timeline_payload(), indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    PARITY_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    written: list[Path] = [SYNTHETIC_EXPORT]
    for source in FIXTURES:
        export = load_export(source)
        parity_path = PARITY_DIR / f"timeline-{source.stem}.json"
        parity_path.write_text(
            json.dumps(timeline_parity_payload(export), indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        written.append(parity_path)

    synthetic = load_export(SYNTHETIC_EXPORT)
    real_zero = load_export(REAL_ZERO_EXPORT)
    written.extend(
        (
            _write_timeline_svg(
                synthetic,
                OUTPUT_DIR / "timeline-synthetic.svg",
                "Synthetic anti-vacuous timeline: hit, miss, missing anchors, cross-window projectile",
            ),
            _write_summary_csv(synthetic, OUTPUT_DIR / "drill-summary-synthetic.csv"),
            _write_timeline_svg(
                real_zero,
                OUTPUT_DIR / "timeline-real-0803.svg",
                "Real 08:03 boundary fixture — 零 strafe 樣本:counter/release 錨點全缺",
            ),
            _write_summary_csv(real_zero, OUTPUT_DIR / "drill-summary-real-0803.csv"),
        )
    )
    return tuple(written)


def _write_summary_csv(export, path: Path) -> Path:
    fields = (
        "peek_index",
        "target_id",
        "side",
        "outcome",
        "visible_to_counter_ms",
        "counter_to_first_shot_ms",
        "release_to_first_shot_ms",
        "flags",
    )
    rows = []
    for peek in timeline_metrics(export).peeks:
        rows.append(
            {
                "peek_index": peek.index,
                "target_id": peek.target_id,
                "side": peek.side,
                "outcome": peek.outcome,
                "visible_to_counter_ms": _delta(peek.t_counter, peek.t_visible),
                "counter_to_first_shot_ms": _delta(peek.t_first_shot, peek.t_counter),
                "release_to_first_shot_ms": _delta(peek.t_first_shot, peek.t_release),
                "flags": "|".join(peek.flags),
            }
        )
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return path


def _write_timeline_svg(export, path: Path, title: str) -> Path:
    peeks = timeline_metrics(export).peeks
    width = 1500
    margin = 180
    row_height = 44
    height = 80 + row_height * len(peeks)
    finite_ends = [peek.t_end - peek.t_visible for peek in peeks if math.isfinite(peek.t_end)]
    marker_spans = [
        value - peek.t_visible
        for peek in peeks
        for value in (*peek.fires, *((peek.t_hit,) if peek.t_hit is not None else ()))
    ]
    horizon = max((*finite_ends, *marker_spans), default=1000.0)
    horizon = max(horizon, 1.0)

    def x(relative_ms: float) -> float:
        return margin + max(0.0, relative_ms) / horizon * (width - margin - 40)

    colors = {
        "visible": "#64748b",
        "counter": "#2563eb",
        "release": "#16a34a",
        "fire": "#ea580c",
        "hit": "#9333ea",
    }
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white" />',
        f'<text x="20" y="28" font-family="sans-serif" font-size="17">{escape(title)}</text>',
        f'<text x="20" y="50" font-family="sans-serif" font-size="12" fill="#475569">timeline-v1; each row is one [visible,nextVisible) peek</text>',
    ]
    legend_x = 630
    for name, color in colors.items():
        parts.append(f'<circle cx="{legend_x}" cy="47" r="4" fill="{color}" />')
        parts.append(
            f'<text x="{legend_x + 8}" y="51" font-family="sans-serif" font-size="11" '
            f'fill="#334155">{name}</text>'
        )
        legend_x += 105
    for peek in peeks:
        y = 72 + peek.index * row_height
        parts.append(
            f'<text x="12" y="{y + 5}" font-family="monospace" font-size="11">'
            f'{peek.index:02d} {escape(peek.side)} {escape(peek.outcome)} '
            f'{escape(peek.target_id)}</text>'
        )
        parts.append(
            f'<line x1="{margin}" y1="{y}" x2="{width - 40}" y2="{y}" stroke="#cbd5e1" />'
        )
        markers = [("visible", peek.t_visible)]
        if peek.t_counter is not None:
            markers.append(("counter", peek.t_counter))
        if peek.t_release is not None:
            markers.append(("release", peek.t_release))
        markers.extend(("fire", value) for value in peek.fires)
        if peek.t_hit is not None:
            markers.append(("hit", peek.t_hit))
        for name, value in markers:
            marker_x = x(value - peek.t_visible)
            parts.append(
                f'<circle cx="{marker_x:.2f}" cy="{y}" r="4" fill="{colors[name]}"><title>'
                f'{name} {value - peek.t_visible:.3f} ms</title></circle>'
            )
        flags = "|".join(peek.flags) or "—"
        parts.append(
            f'<text x="{margin}" y="{y + 17}" font-family="monospace" font-size="9" fill="#475569">'
            f'{escape(flags)}</text>'
        )
    parts.append("</svg>\n")
    path.write_text("\n".join(parts), encoding="utf-8")
    return path


def _delta(later: float | None, earlier: float | None) -> float | str:
    return "" if later is None or earlier is None else later - earlier


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
