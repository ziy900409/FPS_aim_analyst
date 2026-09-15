"""WP-69 / T4: an ``invalid-retained`` diagnostic export must still load, and must say so.

The whole point of keeping a paused attempt is that somebody can audit it later. That only works if
the offline side can (a) open the file at all and (b) tell — from the file alone, without any app
state — that this run is **not adoptable**. Both halves are pinned here:

* ``meta.validity.pauseOccurred`` is additive under ``meta.validity``, which ``load_export`` passes
  through opaquely. This test is the proof that "opaque" really does mean the flag survives, rather
  than an assumption that happens to hold today.
* The flag is **not** promoted into a tick/event column, and the column surface is unchanged. Adding
  a column would make every existing consumer's schema drift for a fact that belongs to the run, not
  to any row (the same asymmetry ``pointer_lock.locked`` is held to in the WP-61 test next door).

C-D4 note: this test reads the flag, it does not re-derive it. "Was this attempt paused" has exactly
one definition — ``RunAttemptController`` — and the payload is its only carrier across the boundary.
"""

from __future__ import annotations

import json
from pathlib import Path

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, load_export


FIXTURE = Path(__file__).resolve().parents[4].parent / "fixtures" / "exports" / "synthetic_counterstrafe.json"


def _write_invalid_paused(tmp_path: Path) -> Path:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["meta"]["validity"] = {
        "corridorExceeded": False,
        "perfFloor": False,
        "recorderOverflow": False,
        "bufferOverflow": False,
        # Recording-time lock loss sets both, but they stay two constructs (FR-69.11).
        "pointerLockLost": True,
        "pauseOccurred": True,
    }
    payload["meta"]["suspect"] = True  # collectMeta ORs pauseOccurred into suspect
    path = tmp_path / "drill-2026-09-15T09_18_05.351Z.invalid-paused.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_invalid_paused_export_loads_and_self_describes(tmp_path) -> None:
    path = _write_invalid_paused(tmp_path)

    export = load_export(path)

    assert export.meta["validity"]["pauseOccurred"] is True
    assert export.meta["validity"]["pointerLockLost"] is True
    assert export.meta["suspect"] is True
    # The diagnostic marker rides in the filename as well, so a file pulled out of a download folder
    # is identifiable before anyone opens it (OQ-69.1 / D-69-T0-3).
    assert path.name.endswith(".invalid-paused.json")


def test_invalid_paused_export_does_not_change_the_column_surface(tmp_path) -> None:
    export = load_export(_write_invalid_paused(tmp_path))

    assert tuple(export.ticks.columns) == TICK_COLUMNS
    assert tuple(export.events.columns) == EVENT_COLUMNS
    assert len(export.ticks) > 0


def test_a_clean_export_reads_as_not_paused(tmp_path) -> None:
    """The negative control: absence of the flag must not read as ``True`` by accident."""
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    path = tmp_path / "clean.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    export = load_export(path)

    # Pre-WP-69 payloads have no ``validity`` block at all; optional-in means "absent = false".
    assert export.meta.get("validity", {}).get("pauseOccurred", False) is False
