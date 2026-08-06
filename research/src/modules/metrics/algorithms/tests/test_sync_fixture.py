from __future__ import annotations

import json

import pytest

from modules.metrics.notebooks.t2.generate_sync_precision_report import (
    OUTPUT_PATH,
    build_report,
)


def test_committed_sync_precision_report_matches_generator() -> None:
    expected = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))

    assert build_report() == expected


def test_all_three_fixtures_have_explicit_precision_verdicts() -> None:
    report = build_report()
    synthetic, real_zero, real_validity = report["fixtures"]

    assert synthetic["peekCount"] == 4
    assert [(item["n"], item["verdict"]) for item in synthetic["precisionVerdicts"]] == [
        (1, "blocked-by-data"),
        (1, "blocked-by-data"),
    ]
    assert real_zero["peekCount"] == 20
    assert [(item["n"], item["verdict"]) for item in real_zero["precisionVerdicts"]] == [
        (0, "blocked-by-data"),
        (0, "blocked-by-data"),
    ]
    assert real_validity["peekCount"] == 20
    assert [(item["n"], item["verdict"]) for item in real_validity["precisionVerdicts"]] == [
        (13, "sufficient"),
        (13, "sufficient"),
    ]
    assert real_validity["precisionVerdicts"][0]["sample_sd_ms"] == pytest.approx(
        46.044857876328535
    )
    assert real_validity["precisionVerdicts"][1]["sample_sd_ms"] == pytest.approx(
        16.480640422417093
    )
    assert report["t3Gate"]["status"] == "skipped"


def test_zero_input_fixture_uses_none_and_records_missing_anchor_causes() -> None:
    real_zero = build_report()["fixtures"][1]

    assert real_zero["flagCounts"] == {
        "missing_counter": 20,
        "missing_release": 20,
        "no_counter": 20,
        "no_key_transition": 20,
    }
    assert all(row["releaseToFireMs"] is None for row in real_zero["rows"])
    assert all(row["counterHoldMs"] is None for row in real_zero["rows"])
