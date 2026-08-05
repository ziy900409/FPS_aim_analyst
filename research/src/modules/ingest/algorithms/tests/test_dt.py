from __future__ import annotations

import json

import pytest

from modules.ingest.algorithms.dt import check_dt
from modules.ingest.algorithms.loader import load_export
from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export


def _load(tmp_path, spec: SyntheticSpec):
    path = tmp_path / "export.json"
    path.write_text(json.dumps(make_synthetic_export(spec)), encoding="utf-8")
    return load_export(path)


def test_check_dt_reports_uniform_128_hz_ticks(tmp_path) -> None:
    export = _load(tmp_path, SyntheticSpec())

    report = check_dt(export.ticks)

    assert report.tick_count == 48
    assert report.expected_dt_ms == pytest.approx(7.8125)
    assert report.median_dt_ms == pytest.approx(7.8125)
    assert report.gap_count == 0
    assert report.gaps == []
    assert report.uniform is True


def test_check_dt_reports_dropped_tick_by_right_hand_row_index(tmp_path) -> None:
    export = _load(tmp_path, SyntheticSpec(dropped_tick_indices=(5,)))

    report = check_dt(export.ticks)

    assert report.tick_count == 47
    assert report.uniform is False
    assert report.gap_count == 1
    assert report.gaps == [(5, pytest.approx(15.625))]
