"""Contract tests for the one-command research pipeline."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from modules.ingest.algorithms import (
    SchemaError,
    SyntheticSpec,
    load_export,
    make_synthetic_export,
)
from modules.segments.algorithms import DEFAULT_SEGMENT_PARAMS, SEG_V2_PARAMS, is_known_quality_flag
from report.run_pipeline import (
    DEFAULT_EXPORT,
    EXIT_CONSTRUCT_ABSENT,
    METRIC_COLUMNS,
    PEEK_FILENAME,
    SEGMENT_FILENAME,
    SUMMARY_FILENAME,
    main,
    run,
)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _write_export(path: Path, payload: dict) -> Path:
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_synthetic_export_produces_all_three_artifacts(tmp_path: Path) -> None:
    summary = run(DEFAULT_EXPORT, tmp_path)

    for name in (SUMMARY_FILENAME, PEEK_FILENAME, SEGMENT_FILENAME):
        assert (tmp_path / name).is_file()
    assert summary["export"]["schemaVersion"] == 2
    # KI-005-A / A2-T3: the default synthetic fixture carries dYaw/dPitch (tick-integral),
    # so run() auto-selects seg-v2, not the module-level DEFAULT_SEGMENT_PARAMS (seg-v1).
    assert summary["export"]["omegaSource"] == "tick-integral"
    assert summary["segmentation"]["paramsVersion"] == SEG_V2_PARAMS.version
    assert summary["segmentation"]["peekCount"] > 0


def test_dt_report_carries_tick_count_gaps_and_median(tmp_path: Path) -> None:
    dt_report = run(DEFAULT_EXPORT, tmp_path)["dtReport"]

    expected_ticks = len(load_export(DEFAULT_EXPORT).ticks)
    assert dt_report["tickCount"] == expected_ticks
    assert dt_report["medianDtMs"] == pytest.approx(1000.0 / 128.0)
    assert dt_report["gapCount"] == 0
    assert dt_report["uniform"] is True


def test_summary_is_valid_json_without_non_finite_values(tmp_path: Path) -> None:
    run(DEFAULT_EXPORT, tmp_path)

    text = (tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8")
    assert "NaN" not in text and "Infinity" not in text
    json.loads(text, parse_constant=_reject_constant)


def _reject_constant(name: str) -> None:
    raise AssertionError(f"summary contains non-finite constant {name}")


def test_peek_rows_cover_every_visible_event_in_order(tmp_path: Path) -> None:
    summary = run(DEFAULT_EXPORT, tmp_path)
    export = load_export(DEFAULT_EXPORT)
    visible = export.events.loc[export.events["type"] == "visible"].sort_values("t")

    rows = _read_csv(tmp_path / PEEK_FILENAME)
    assert [int(row["peek_index"]) for row in rows] == list(range(len(visible)))
    assert [row["target_id"] for row in rows] == visible["targetId"].tolist()
    assert summary["segmentation"]["peekCount"] == len(rows)


def test_segment_rows_join_to_peeks_and_use_known_flags(tmp_path: Path) -> None:
    summary = run(DEFAULT_EXPORT, tmp_path)

    peek_rows = _read_csv(tmp_path / PEEK_FILENAME)
    segment_rows = _read_csv(tmp_path / SEGMENT_FILENAME)
    assert len(segment_rows) == summary["segmentation"]["segmentCount"]

    counted = {int(row["peek_index"]): int(row["segment_count"]) for row in peek_rows}
    for row in segment_rows:
        assert int(row["segment_index"]) < counted[int(row["peek_index"])]
        assert float(row["start_t_ms"]) <= float(row["end_t_ms"])
        for flag in filter(None, row["flags"].split("|")):
            assert is_known_quality_flag(flag)
    for row in peek_rows:
        for flag in filter(None, row["flags"].split("|")):
            assert is_known_quality_flag(flag)


def test_quality_summary_reports_n_and_flagged_per_metric(tmp_path: Path) -> None:
    quality = run(DEFAULT_EXPORT, tmp_path)["quality"]

    assert set(quality) <= set(METRIC_COLUMNS)
    segment_count = len(_read_csv(tmp_path / SEGMENT_FILENAME))
    for stats in quality.values():
        assert stats["n"] + stats["n_flagged"] == segment_count


def test_undefined_leading_omega_sample_does_not_flag_segments(tmp_path: Path) -> None:
    """A clean export must leave rows summarizable, not blanket-flagged."""

    summary = run(DEFAULT_EXPORT, tmp_path)

    assert "non_finite_interpolated" not in summary["flagCounts"]["segment"]
    for stats in summary["quality"].values():
        assert stats["n"] == summary["segmentation"]["segmentCount"]
        assert stats["n_flagged"] == 0


def test_segment_indices_and_times_are_in_the_tick_frame(tmp_path: Path) -> None:
    run(DEFAULT_EXPORT, tmp_path)
    export = load_export(DEFAULT_EXPORT)
    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    visible = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )

    rows = _read_csv(tmp_path / SEGMENT_FILENAME)
    assert rows, "the synthetic export must produce at least one segment"
    for row in rows:
        window_start = float(visible.iloc[int(row["peek_index"])]["t"])
        window_ticks = ticks.loc[ticks["t"] >= window_start].reset_index(drop=True)
        # Index 0 is the undefined omega sample, so a segment can never start there.
        assert int(row["start_idx"]) >= 1
        assert float(row["start_t_ms"]) == window_ticks.iloc[int(row["start_idx"])]["t"]
        assert float(row["end_t_ms"]) == window_ticks.iloc[int(row["end_idx"])]["t"]


def test_repeated_runs_are_deterministic(tmp_path: Path) -> None:
    first = run(DEFAULT_EXPORT, tmp_path / "a")
    second = run(DEFAULT_EXPORT, tmp_path / "b")

    assert first == second
    for name in (SUMMARY_FILENAME, PEEK_FILENAME, SEGMENT_FILENAME):
        assert (tmp_path / "a" / name).read_bytes() == (tmp_path / "b" / name).read_bytes()


def test_export_without_visible_events_yields_empty_but_valid_artifacts(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["events"] = [event for event in payload["events"] if event["type"] != "visible"]
    source = _write_export(tmp_path / "no-visible.json", payload)

    summary = run(source, tmp_path / "out")

    assert summary["segmentation"]["peekCount"] == 0
    assert summary["segmentation"]["successRate"] is None
    assert summary["quality"] == {}
    assert _read_csv(tmp_path / "out" / PEEK_FILENAME) == []


def test_dt_gap_flags_only_the_peek_that_contains_it(tmp_path: Path) -> None:
    """One dropped tick must not exclude every segment from every aggregate."""

    payload = make_synthetic_export(SyntheticSpec())
    for tick in payload["ticks"][24:]:  # gap lands on the first tick of peek 1
        tick["t"] += 7.8125
    source = _write_export(tmp_path / "gap.json", payload)

    summary = run(source, tmp_path / "out")

    assert summary["dtReport"]["uniform"] is False
    assert summary["dtReport"]["gapCount"] == 1
    assert summary["dtReport"]["gaps"][0]["tickIndex"] == 24
    assert summary["segmentation"]["peekCount"] == 2

    peek_flags = {
        int(row["peek_index"]): row["flags"]
        for row in _read_csv(tmp_path / "out" / PEEK_FILENAME)
    }
    assert "non_uniform_dt" not in peek_flags[0]
    assert "non_uniform_dt" in peek_flags[1]
    assert summary["flagCounts"]["peek"]["non_uniform_dt"] == 1

    # The clean peek still aggregates instead of being excluded with the flagged one.
    for stats in summary["quality"].values():
        assert stats["n"] >= 1
        assert stats["n_flagged"] >= 1


def test_invalid_export_exits_non_zero_without_writing_artifacts(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["meta"]["schemaVersion"] = 1
    source = _write_export(tmp_path / "bad.json", payload)
    out_dir = tmp_path / "out"

    assert main(["--export", str(source), "--out", str(out_dir)]) == 1
    assert not out_dir.exists()

    with pytest.raises(SchemaError) as error:
        run(source, out_dir)
    assert error.value.field_path == "meta.schemaVersion"


def test_cli_returns_zero_on_the_synthetic_export(tmp_path: Path) -> None:
    assert main(["--export", str(DEFAULT_EXPORT), "--out", str(tmp_path)]) == 0
    assert (tmp_path / SUMMARY_FILENAME).is_file()


# --- KI-005 / A T5 — omega source surfaced in pipeline-summary.json (FR-A-11/R-5) ---

_REAL_LEGACY_EXPORT = (
    Path(__file__).resolve().parents[3]
    / "fixtures"
    / "exports"
    / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json"
)


def test_summary_reports_tick_integral_source_for_the_synthetic_export(tmp_path: Path) -> None:
    summary = run(DEFAULT_EXPORT, tmp_path)

    assert summary["export"]["omegaSource"] == "tick-integral"
    assert "omegaSourceWarning" not in summary["export"]


def test_summary_reports_legacy_source_and_warning_for_a_pre_ki005_export(tmp_path: Path) -> None:
    summary = run(_REAL_LEGACY_EXPORT, tmp_path)

    assert summary["export"]["omegaSource"] == "aim-diff-legacy"
    assert "KI-005" in summary["export"]["omegaSourceWarning"]


# --- KI-005-A / A2-T3 — seg-v2 auto-selected by omega source (D-28.7: seg-v1 stays frozen
# for pre-KI-005 exports that can only ever produce aim-diff-legacy omega) ---


def test_seg_v2_selected_automatically_for_tick_integral_omega(tmp_path: Path) -> None:
    summary = run(DEFAULT_EXPORT, tmp_path)

    assert summary["export"]["omegaSource"] == "tick-integral"
    assert summary["segmentation"]["paramsVersion"] == SEG_V2_PARAMS.version


def test_seg_v1_selected_automatically_for_legacy_omega(tmp_path: Path) -> None:
    summary = run(_REAL_LEGACY_EXPORT, tmp_path)

    assert summary["export"]["omegaSource"] == "aim-diff-legacy"
    assert summary["segmentation"]["paramsVersion"] == DEFAULT_SEGMENT_PARAMS.version


def test_explicit_params_override_the_omega_source_auto_selection(tmp_path: Path) -> None:
    # A tick-integral export forced onto seg-v1 -- explicit caller intent always wins.
    summary = run(DEFAULT_EXPORT, tmp_path, params=DEFAULT_SEGMENT_PARAMS)

    assert summary["export"]["omegaSource"] == "tick-integral"
    assert summary["segmentation"]["paramsVersion"] == DEFAULT_SEGMENT_PARAMS.version


# --- KI-006 / C T2 — constructPresence block + dedicated exit code (FR-C-7/8) ---

_REAL_VALID_EXPORT = (
    Path(__file__).resolve().parents[3]
    / "fixtures"
    / "exports"
    / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json"
)

_SYNTHETIC_TIMELINE_EXPORT = (
    Path(__file__).resolve().parents[3] / "fixtures" / "exports" / "synthetic_timeline.json"
)


def test_construct_absent_export_exits_two_but_still_writes_all_artifacts(tmp_path: Path) -> None:
    exit_code = main(["--export", str(_REAL_LEGACY_EXPORT), "--out", str(tmp_path)])

    assert exit_code == EXIT_CONSTRUCT_ABSENT
    for name in (SUMMARY_FILENAME, PEEK_FILENAME, SEGMENT_FILENAME):
        assert (tmp_path / name).is_file()

    summary = json.loads((tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8"))
    construct = summary["constructPresence"]
    assert construct["present"] is False
    assert construct["flags"] == ["construct_absent:counter-strafe"]
    assert construct["paramsVersion"] == "construct-v1"
    assert construct["thresholds"] == {"minCounterEvents": 1, "minMovingTickRatio": 0.05}


def test_construct_absent_export_stderr_names_drill_and_measured_values(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--export", str(_REAL_LEGACY_EXPORT), "--out", str(tmp_path)])

    captured = capsys.readouterr()
    assert "failed" not in captured.err
    assert "counterstrafe_ad_v1" in captured.err
    assert "counter-strafe" in captured.err


def test_construct_present_export_exits_zero(tmp_path: Path) -> None:
    exit_code = main(["--export", str(_REAL_VALID_EXPORT), "--out", str(tmp_path)])

    assert exit_code == 0
    summary = json.loads((tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8"))
    assert summary["constructPresence"]["present"] is True


def test_default_synthetic_export_construct_present_on_default_path(tmp_path: Path) -> None:
    """FM-6: the gate must actually fire on run_pipeline's own default fixture."""

    exit_code = main(["--export", str(DEFAULT_EXPORT), "--out", str(tmp_path)])

    assert exit_code == 0
    summary = json.loads((tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8"))
    construct = summary["constructPresence"]
    assert construct["present"] is True
    assert construct["family"] == "counterstrafe"


def test_unknown_drill_family_exits_zero_and_flags_unknown(tmp_path: Path) -> None:
    exit_code = main(["--export", str(_SYNTHETIC_TIMELINE_EXPORT), "--out", str(tmp_path)])

    assert exit_code == 0
    summary = json.loads((tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8"))
    construct = summary["constructPresence"]
    assert construct["present"] is None
    assert construct["flags"] == ["construct_unknown"]
    assert construct["thresholds"] is None


def test_construct_presence_summary_json_has_no_nan_literal(tmp_path: Path) -> None:
    run(_REAL_LEGACY_EXPORT, tmp_path)

    text = (tmp_path / SUMMARY_FILENAME).read_text(encoding="utf-8")
    assert "NaN" not in text and "Infinity" not in text
    json.loads(text, parse_constant=_reject_constant)
