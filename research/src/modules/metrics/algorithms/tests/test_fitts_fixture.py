from __future__ import annotations

from dataclasses import asdict
import json
import math

import pytest

from modules.metrics.algorithms.fitts import DEFAULT_FITTS_PARAMS
from modules.metrics.notebooks.t3.generate_fitts_report import (
    LIMITATIONS,
    OUTPUT_DIR,
    REAL_FIXTURES,
    SYNTHETIC_FIXTURE,
    build_fitts_result,
)


def _committed_payload() -> dict:
    return json.loads((OUTPUT_DIR / "fitts-verdicts.json").read_text(encoding="utf-8"))


def test_real_fixtures_emit_one_fitts_row_per_peek_with_closed_flags() -> None:
    for path in REAL_FIXTURES:
        result = build_fitts_result(path)

        assert len(result.samples) == 20
        assert result.n >= 10
        assert all(sample.flags == () for sample in result.samples)
        assert all(sample.d_deg is not None and sample.w_deg is not None for sample in result.samples)


def test_committed_verdicts_match_fresh_recomputation() -> None:
    payload = _committed_payload()

    assert payload["fitts_params"] == asdict(DEFAULT_FITTS_PARAMS)
    assert payload["validity_level"] == "observational_non_controlled"
    assert payload["limitations"] == list(LIMITATIONS)

    for path, verdict in zip(REAL_FIXTURES, payload["verdicts"], strict=True):
        result = build_fitts_result(path)
        assert verdict["session"] == path.stem
        assert verdict["status"] == result.status
        assert verdict["reason"] == result.reason
        assert verdict["n"] == result.n
        assert verdict["d_ratio"] == pytest.approx(result.d_ratio)
        assert verdict["id_range_bits"] == pytest.approx(result.id_range_bits)
        if result.status == "ok":
            assert verdict["slope_ms_per_bit"] == pytest.approx(result.slope_ms_per_bit)
            assert verdict["intercept_ms"] == pytest.approx(result.intercept_ms)
            assert verdict["r2"] == pytest.approx(result.r2)
            assert verdict["throughput_bits_s"] == pytest.approx(result.throughput_bits_s)
        else:
            assert verdict["slope_ms_per_bit"] is None
            assert verdict["r2"] is None
            assert verdict["throughput_bits_s"] is None


def test_blocked_by_data_never_fabricates_regression_outputs() -> None:
    payload = _committed_payload()

    for verdict in payload["verdicts"]:
        if verdict["status"] != "blocked-by-data":
            continue
        assert verdict["slope_ms_per_bit"] is None
        assert verdict["intercept_ms"] is None
        assert verdict["r2"] is None
        assert verdict["throughput_bits_s"] is None


def test_synthetic_fixture_degrades_without_raising() -> None:
    result = build_fitts_result(SYNTHETIC_FIXTURE)

    assert len(result.samples) == 2
    assert result.status == "blocked-by-data"
    assert result.reason == "insufficient_n"
    assert result.slope_ms_per_bit is None
    assert all(sample.flags == () for sample in result.samples)
    assert all(math.isfinite(sample.id_bits) for sample in result.samples if sample.id_bits is not None)


def test_committed_artifacts_exist_for_review() -> None:
    for path in (*REAL_FIXTURES, SYNTHETIC_FIXTURE):
        assert (OUTPUT_DIR / f"fitts-table-{path.stem}.csv").exists()
    for path in REAL_FIXTURES:
        assert (OUTPUT_DIR / f"fitts-scatter-{path.stem}.svg").exists()
    assert (OUTPUT_DIR / "fitts-regression-summary.csv").exists()
    assert (OUTPUT_DIR / "fitts-side-summary.csv").exists()
    assert (OUTPUT_DIR / "fitts-verdicts.json").exists()
