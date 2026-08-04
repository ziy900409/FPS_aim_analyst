from __future__ import annotations

import json
from pathlib import Path

import pytest

from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export


RESEARCH_ROOT = Path(__file__).resolve().parents[5]


def test_make_synthetic_export_is_deterministic() -> None:
    spec = SyntheticSpec(
        peek_count=2,
        sides=("R", "L"),
        missing_counter_peeks=frozenset({1}),
        missing_release_peeks=frozenset({0}),
        dropped_tick_indices=(7,),
        seed=42,
    )

    assert make_synthetic_export(spec) == make_synthetic_export(spec)


def test_make_synthetic_export_models_missing_counter_release_and_drop() -> None:
    spec = SyntheticSpec(
        missing_counter_peeks=frozenset({1}),
        missing_release_peeks=frozenset({0}),
        dropped_tick_indices=(7,),
    )
    payload = make_synthetic_export(spec)

    counters = [event for event in payload["events"] if event["type"] == "counter"]
    assert len(counters) == 1
    assert counters[0]["t"] < 24 * (1000 / 128)
    assert len(payload["ticks"]) == 47
    first_peek_keys = [tick["keys"] for tick in payload["ticks"] if tick["t"] < 24 * (1000 / 128)]
    assert all("A" in keys for keys in first_peek_keys)


def test_make_synthetic_export_uses_supplied_omega_profiles() -> None:
    profile = tuple([0.0] + [64.0] * 23)
    payload = make_synthetic_export(
        SyntheticSpec(peek_count=1, sides=("L",), omega_profiles_deg_s=(profile,))
    )
    yaws = [tick["aim"]["yaw"] for tick in payload["ticks"]]

    assert yaws[1] - yaws[0] == pytest.approx(64.0 * (1 / 128) * 3.141592653589793 / 180.0)


def test_committed_synthetic_fixture_matches_generator() -> None:
    fixture = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"

    assert json.loads(fixture.read_text(encoding="utf-8")) == make_synthetic_export(SyntheticSpec())
