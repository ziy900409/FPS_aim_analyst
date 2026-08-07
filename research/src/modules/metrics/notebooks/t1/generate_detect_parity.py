"""Generate the committed Python side of the T1 t_detect parity gate (WP-30).

Fixture roster is frozen by T0 / D-30.2: only fixtures with ``meta.scene.eye`` +
``meta.simToWorld`` (``tick-integral`` omega source) may produce ω/ε-derived metrics.
``08:03``/``09:39`` are pre-S1 ``aim-diff-legacy`` exports and are used only as the
negative case (``resolve_eye_origin(strict=True)`` must raise for them).
"""

from __future__ import annotations

import json
from pathlib import Path
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import resolve_eye_origin  # noqa: E402
from modules.metrics.algorithms import build_peek_windows, detect_parity_payload, detect_samples  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
PARITY_DIR = RESEARCH_ROOT / "fixtures" / "parity"

#: T0 / D-30.2 frozen roster -- the only fixtures WP-30 may derive ω/ε metrics from.
FIXTURES = (
    EXPORT_DIR / "synthetic_counterstrafe.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)

#: Banned roster (§0.2) -- kept here only so the negative "strict raises" case has a named source.
LEGACY_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json",
)


def build_payload(source: Path) -> dict:
    export = load_export(source)
    eye_origin = resolve_eye_origin(export.meta, strict=True)
    peeks = build_peek_windows(export)
    samples = detect_samples(export, peeks, eye_origin=eye_origin)
    return detect_parity_payload(export, samples)


def generate_all() -> tuple[Path, ...]:
    PARITY_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for source in FIXTURES:
        payload = build_payload(source)
        parity_path = PARITY_DIR / f"detect-{source.stem}.json"
        parity_path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        written.append(parity_path)
    return tuple(written)


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
