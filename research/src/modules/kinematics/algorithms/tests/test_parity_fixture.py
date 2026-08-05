from __future__ import annotations

import json
from pathlib import Path

from modules.ingest.algorithms.loader import load_export
from modules.kinematics.notebooks.t2.generate_epsilon_parity import build_parity_payload


RESEARCH_ROOT = Path(__file__).resolve().parents[5]


def test_committed_epsilon_parity_matches_python_generator() -> None:
    source = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"
    fixture = RESEARCH_ROOT / "fixtures" / "parity" / "epsilon-synthetic_counterstrafe.json"

    expected = json.loads(fixture.read_text(encoding="utf-8"))
    assert build_parity_payload(load_export(source)) == expected


def test_parity_fixture_covers_failure_and_acquisition_paths() -> None:
    fixture = RESEARCH_ROOT / "fixtures" / "parity" / "epsilon-synthetic_counterstrafe.json"
    presentations = json.loads(fixture.read_text(encoding="utf-8"))["presentations"]

    assert [item["acquisitionFailure"] for item in presentations] == [True, False]
    assert presentations[0]["tAcquireMs"] is None
    assert presentations[1]["tAcquireMs"] == 54.6875


def test_parity_falls_back_from_visible_event_to_first_tick_target(tmp_path) -> None:
    source = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    for event in payload["events"]:
        if event["type"] == "visible":
            event.pop("targetX")
            event.pop("targetY")
            event.pop("targetZ")
    fallback_source = tmp_path / "fallback.json"
    fallback_source.write_text(json.dumps(payload), encoding="utf-8")

    actual = build_parity_payload(load_export(fallback_source))["presentations"]
    expected_fixture = RESEARCH_ROOT / "fixtures" / "parity" / "epsilon-synthetic_counterstrafe.json"
    expected = json.loads(expected_fixture.read_text(encoding="utf-8"))["presentations"]

    assert actual == expected
