"""WP-29 / T3 (user override): loader acceptance of additive ``key`` events.

The engine emits ``key`` events opt-in with JSON field ``code`` (canonical A/D). The loader maps that into
the shared ``key`` DataFrame column so ``EVENT_COLUMNS`` and the sparse CSV surface stay additive-stable.
Absence in older / opt-out exports is normal, not an error.
"""

from __future__ import annotations

import json

import pytest

from modules.ingest.algorithms.loader import EVENT_COLUMNS, SchemaError, load_export
from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export


def _write(tmp_path, payload: dict, name: str = "export.json"):
    path = tmp_path / name
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_load_export_accepts_key_events_and_maps_code_into_key_column(tmp_path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    first_t = payload["events"][0]["t"]
    payload["events"].append({"type": "key", "code": "A", "down": False, "t": first_t})
    payload["events"].append({"type": "key", "code": "D", "down": True, "t": first_t})

    export = load_export(_write(tmp_path, payload))

    # EVENT_COLUMNS is unchanged: no new `code` column added.
    assert tuple(export.events.columns) == EVENT_COLUMNS
    key_rows = export.events.loc[export.events["type"] == "key"]
    assert len(key_rows) == 2
    assert list(key_rows["key"]) == ["A", "D"]  # JSON `code` mapped into the shared `key` column
    assert list(key_rows["down"]) == [False, True]


def test_export_without_key_events_stays_backward_compatible(tmp_path) -> None:
    payload = make_synthetic_export(SyntheticSpec())

    export = load_export(_write(tmp_path, payload))

    assert int((export.events["type"] == "key").sum()) == 0


def test_key_event_missing_code_reports_field_path(tmp_path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["events"].append({"type": "key", "down": False, "t": payload["events"][0]["t"]})

    with pytest.raises(SchemaError) as captured:
        load_export(_write(tmp_path, payload))

    assert captured.value.field_path.endswith(".code")


def test_key_event_non_bool_down_reports_field_path(tmp_path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["events"].append(
        {"type": "key", "code": "A", "down": "nope", "t": payload["events"][0]["t"]}
    )

    with pytest.raises(SchemaError) as captured:
        load_export(_write(tmp_path, payload))

    assert captured.value.field_path.endswith(".down")
