from __future__ import annotations

from copy import deepcopy
import json

import pytest

from modules.ingest.algorithms.loader import EVENT_COLUMNS, TICK_COLUMNS, SchemaError, load_export
from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export


def _write_payload(tmp_path, payload: dict, name: str = "export.json"):
    path = tmp_path / name
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_load_export_round_trips_synthetic_schema_v2(tmp_path) -> None:
    spec = SyntheticSpec(peek_count=2, sides=("L", "R"), ticks_per_peek=24)
    payload = make_synthetic_export(spec)

    export = load_export(_write_payload(tmp_path, payload))

    assert len(export.ticks) == spec.peek_count * spec.ticks_per_peek
    assert len(export.events) == 11
    assert tuple(export.ticks.columns) == TICK_COLUMNS
    assert tuple(export.events.columns) == EVENT_COLUMNS
    assert export.meta == payload["meta"]


@pytest.mark.parametrize(
    ("mutate", "expected_path"),
    [
        (lambda payload: payload["meta"].__setitem__("schemaVersion", 1), "meta.schemaVersion"),
        (lambda payload: payload["ticks"][12]["aim"].pop("pitch"), "ticks[12].aim.pitch"),
        (lambda payload: payload["ticks"][12]["aim"].__setitem__("pitch", float("inf")), "ticks[12].aim.pitch"),
    ],
)
def test_load_export_reports_exact_field_path(tmp_path, mutate, expected_path: str) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    mutate(payload)

    with pytest.raises(SchemaError) as captured:
        load_export(_write_payload(tmp_path, payload))

    assert captured.value.field_path == expected_path


def test_load_export_accepts_absent_stage5_additive_fields(tmp_path) -> None:
    payload = deepcopy(make_synthetic_export(SyntheticSpec()))
    for block in ("weapon", "targets", "scene", "display", "session", "frames"):
        payload["meta"].pop(block)
    payload["events"] = [event for event in payload["events"] if event["type"] != "hit"]
    for event in payload["events"]:
        if event["type"] == "fire":
            event.pop("shotSeq")

    export = load_export(_write_payload(tmp_path, payload))

    assert export.meta == payload["meta"]
    assert "weapon" not in export.meta
    assert "targets" not in export.meta
    assert export.events.loc[export.events["type"] == "fire", "shotSeq"].isna().all()


# --- KI-005 / A T5 — ticks.dYaw/dPitch (FR-A-12) ---


def test_load_export_fills_nan_when_mouse_integration_ticks_are_absent(tmp_path) -> None:
    payload = deepcopy(make_synthetic_export(SyntheticSpec()))
    for tick in payload["ticks"]:
        tick.pop("dYaw")
        tick.pop("dPitch")
    payload["meta"].pop("mouseIntegration")

    export = load_export(_write_payload(tmp_path, payload))

    assert export.ticks["d_yaw"].isna().all()
    assert export.ticks["d_pitch"].isna().all()
    assert "mouseIntegration" not in export.meta


def test_load_export_reads_present_mouse_integration_ticks(tmp_path) -> None:
    payload = make_synthetic_export(SyntheticSpec())

    export = load_export(_write_payload(tmp_path, payload))

    assert export.ticks["d_yaw"].notna().all()
    assert export.ticks["d_pitch"].notna().all()
    assert export.ticks["d_yaw"].tolist() == [tick["dYaw"] for tick in payload["ticks"]]


def test_load_export_rejects_non_finite_mouse_integration_tick(tmp_path) -> None:
    payload = deepcopy(make_synthetic_export(SyntheticSpec()))
    payload["ticks"][12]["dYaw"] = float("inf")

    with pytest.raises(SchemaError) as captured:
        load_export(_write_payload(tmp_path, payload))

    assert captured.value.field_path == "ticks[12].dYaw"
