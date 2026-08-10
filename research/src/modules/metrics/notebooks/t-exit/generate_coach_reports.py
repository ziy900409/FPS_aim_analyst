"""Regenerate the committed WP-29/v1 WP-30 coach-report examples.

The three fixtures cover the three things the report must survive:

* The four legacy WP-29 reports retain their v0 metric evidence while showing that their
  source is rejected for v1 trajectory derivation.
* ``synthetic_counterstrafe.json`` is phase-v1's short-window regression.
* The three 2026-08-07 tick-integral exports are WP-30's only real trajectory evidence;
  09:18 is also emitted with ``--group-by side`` to exercise stratification.

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
SYNTHETIC_COUNTERSTRAFE = EXPORT_DIR / "synthetic_counterstrafe.json"
REAL_TRAJECTORY_EXPORTS = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)

REPORTS: tuple[tuple[Path, str | None], ...] = (
    (SYNTHETIC_EXPORT, None),
    (REAL_ZERO_EXPORT, None),
    (REAL_VALIDITY_EXPORT, None),
    (REAL_VALIDITY_EXPORT, "side"),
    (SYNTHETIC_COUNTERSTRAFE, None),
    *((path, None) for path in REAL_TRAJECTORY_EXPORTS),
    (REAL_TRAJECTORY_EXPORTS[0], "side"),
)


def generate_all() -> tuple[Path, ...]:
    return tuple(generate(export, OUTPUT_DIR, group_by) for export, group_by in REPORTS)


def main() -> None:
    for path in generate_all():
        print(path)


if __name__ == "__main__":
    main()
