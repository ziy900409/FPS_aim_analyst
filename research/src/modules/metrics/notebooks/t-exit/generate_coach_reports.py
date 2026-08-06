"""Regenerate the committed WP-29 T-exit example coach reports.

The three fixtures cover the three things the report must survive:

* ``synthetic_timeline.json`` -- algorithm boundaries (projectile, cross-window hit,
  missing counter, missing release);
* the 08:03 run -- the zero-input boundary, where every Sync anchor is absent and the
  report must show ``n=0`` / ``blocked-by-data`` rather than fabricated zeros;
* the 09:39 run -- the primary real validity sample, also emitted with
  ``--group-by side`` to show the stratified layout.

Writing files is legal here (notebook/report boundary, D-28.11); the algorithms this
calls stay pure. Output is deterministic, so a diff in ``outputs/`` always means the data
or a frozen contract changed.
"""

from __future__ import annotations

from pathlib import Path
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from report.coach_report import generate  # noqa: E402


EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"

SYNTHETIC_EXPORT = EXPORT_DIR / "synthetic_timeline.json"
REAL_ZERO_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json"
REAL_VALIDITY_EXPORT = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json"

REPORTS: tuple[tuple[Path, str | None], ...] = (
    (SYNTHETIC_EXPORT, None),
    (REAL_ZERO_EXPORT, None),
    (REAL_VALIDITY_EXPORT, None),
    (REAL_VALIDITY_EXPORT, "side"),
)


def generate_all() -> tuple[Path, ...]:
    return tuple(generate(export, OUTPUT_DIR, group_by) for export, group_by in REPORTS)


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()