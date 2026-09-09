"""WP-61 / T2: the loader must accept the WP-60/61 additive event types.

Before this slice ``load_export`` rejected ``pointer_lock`` and ``annotation`` outright
(``unsupported event type``), so **every** raw-mouse or annotated cohort export failed to load at
all -- the Python side could not even see the labels it is supposed to audit.

Two deliberate asymmetries are pinned here:

* ``annotation.code`` reuses the shared ``key`` column (the WP-29 ``key`` precedent), so
  ``EVENT_COLUMNS`` and the sparse CSV surface stay byte-stable for every existing consumer.
* ``pointer_lock.locked`` is validated but **not** surfaced. Attributing a sampling gap to a lock
  break is TS ``deriveUnlockedIntervals()``'s single definition (C-D4); the Python side reads that
  attribution off the committed Stage 1 golden and must not grow a second one.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from modules.ingest.algorithms.loader import EVENT_COLUMNS, SchemaError, load_export


FIXTURE = Path(__file__).resolve().parents[4].parent / "fixtures" / "exports" / "synthetic_counterstrafe.json"


def _write(tmp_path: Path, events: list[dict]) -> Path:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["events"] = payload["events"] + events
    path = tmp_path / "annotated.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_annotation_and_pointer_lock_events_load_without_changing_the_column_surface(tmp_path) -> None:
    path = _write(
        tmp_path,
        [
            {"type": "pointer_lock", "locked": False, "t": 900.0},
            {"type": "pointer_lock", "locked": True, "t": 950.0},
            {"type": "annotation", "kind": "sensor_lift", "code": "KeyL", "down": True, "t": 1000.0},
            {"type": "annotation", "kind": "sensor_lift", "code": "KeyL", "down": False, "t": 1240.0},
        ],
    )

    export = load_export(path)

    assert tuple(export.events.columns) == EVENT_COLUMNS

    annotations = export.events.loc[export.events["type"] == "annotation"]
    assert len(annotations) == 2
    # ``code`` arrives through the shared ``key`` column -- no new column, no second key vocabulary.
    assert list(annotations["key"]) == ["KeyL", "KeyL"]
    assert list(annotations["down"]) == [True, False]
    assert list(annotations["t"]) == [1000.0, 1240.0]

    locks = export.events.loc[export.events["type"] == "pointer_lock"]
    assert len(locks) == 2
    assert list(locks["t"]) == [900.0, 950.0]


def test_a_non_annotated_export_stays_free_of_both_event_types(tmp_path) -> None:
    export = load_export(FIXTURE)

    assert int((export.events["type"] == "annotation").sum()) == 0
    assert int((export.events["type"] == "pointer_lock").sum()) == 0


@pytest.mark.parametrize(
    ("event", "field"),
    [
        ({"type": "annotation", "kind": "sensor_lift", "down": True, "t": 1.0}, "code"),
        ({"type": "annotation", "code": "KeyL", "down": True, "t": 1.0}, "kind"),
        ({"type": "annotation", "kind": "sensor_lift", "code": "KeyL", "t": 1.0}, "down"),
        ({"type": "pointer_lock", "t": 1.0}, "locked"),
    ],
)
def test_a_missing_required_field_names_its_json_path(tmp_path, event: dict, field: str) -> None:
    path = _write(tmp_path, [event])

    with pytest.raises(SchemaError) as error:
        load_export(path)

    assert error.value.field_path.endswith(f".{field}")


def test_an_unknown_annotation_kind_is_rejected_rather_than_loaded_unlabelled(tmp_path) -> None:
    # A second ``kind`` would be a second construct. Letting it through would put rows into the
    # candidate event table whose label means something nobody wrote down (FR-61.3).
    path = _write(tmp_path, [{"type": "annotation", "kind": "hand_pause", "code": "KeyL", "down": True, "t": 1.0}])

    with pytest.raises(SchemaError) as error:
        load_export(path)

    assert error.value.field_path.endswith(".kind")
