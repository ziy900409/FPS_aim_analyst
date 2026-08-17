"""Contract tests for the one-command coach report v1 (WP-30 T-exit).

Covers the DoD surface: a single self-contained HTML file, the six metrics with n /
flags / version / validity tier, the pre-registered precision verdicts, the three
``--group-by`` stratifications with unchanged parameter metadata, safe zero-sample
output, HTML escaping, and byte-level determinism.
"""

from __future__ import annotations

import json
from pathlib import Path
import re

import pytest

from modules.ingest.algorithms import SyntheticSpec, load_export, make_synthetic_export
from modules.metrics.algorithms.sync import DEFAULT_SYNC_PARAMS
from report.coach_report import (
    DEFAULT_EXPORT,
    GROUP_BY_CHOICES,
    REPORT_VERSION,
    SYNC_COLUMNS,
    build_report,
    generate,
    main,
    render_html,
    report_filename,
)


RESEARCH_ROOT = Path(__file__).resolve().parents[3]
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"
SYNTHETIC = EXPORT_DIR / "synthetic_timeline.json"
REAL_ZERO = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json"
REAL_VALIDITY = EXPORT_DIR / "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json"
SYNTHETIC_COUNTERSTRAFE = EXPORT_DIR / "synthetic_counterstrafe.json"
REAL_TRAJECTORY = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)
ALL_FIXTURES = (SYNTHETIC_COUNTERSTRAFE, *REAL_TRAJECTORY)

TIMELINE_KEYS = ("counterReactionMs", "fireTimingAlignmentMs", "firstShotHitRate")
FROZEN_VERSIONS = ("compute-v1", "timeline-v1", "sync-v1", "seg-v2", "phase-v1", "curve-v1", "detect-v1")


def _section(html: str, section_id: str) -> str:
    match = re.search(rf'<section id="{section_id}">.*?</section>', html, re.S)
    assert match is not None, f"missing section #{section_id}"
    return match.group(0)


# ---------------------------------------------------------------------------- artifact


def test_one_command_writes_exactly_one_self_contained_html(tmp_path: Path) -> None:
    path = generate(REAL_VALIDITY, tmp_path)

    assert list(tmp_path.iterdir()) == [path]
    assert path.suffix == ".html"
    html = path.read_text(encoding="utf-8")
    assert html.startswith("<!doctype html>")
    # A coach must be able to open or forward the file with no server and no network.
    for forbidden in ("http", "<script", "<link", "@import", "url(", "src=", "srcset"):
        assert forbidden not in html, f"report references an external resource: {forbidden}"


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda path: path.stem[:28])
def test_every_fixture_produces_a_report(fixture: Path, tmp_path: Path) -> None:
    assert main(["--export", str(fixture), "--out", str(tmp_path)]) == 0
    assert (tmp_path / report_filename(fixture, None)).is_file()


def test_report_names_its_source_fixture(tmp_path: Path) -> None:
    html = generate(REAL_VALIDITY, tmp_path).read_text(encoding="utf-8")

    assert REAL_VALIDITY.name in html
    assert REPORT_VERSION in html


# ----------------------------------------------------------------------- required parts


def test_report_contains_every_required_block() -> None:
    html = render_html(build_report(REAL_TRAJECTORY[0]))

    for section_id in ("summary", "precision", "phase", "rec-detect", "curves", "timeline", "peeks", "flags", "groups", "parameters", "limits"):
        _section(html, section_id)
    assert "<svg" in _section(html, "timeline")


def test_all_six_metrics_carry_n_flags_version_and_validity_tier() -> None:
    model = build_report(REAL_VALIDITY)
    html = render_html(model)

    entries = model["timelineMetrics"] + model["syncMetrics"]
    assert [entry["key"] for entry in entries] == [*TIMELINE_KEYS, *SYNC_COLUMNS]
    for entry in entries:
        assert isinstance(entry["n"], int)
        assert isinstance(entry["flagCounts"], dict)
        assert entry["version"] in FROZEN_VERSIONS
        assert entry["validity"], f"{entry['key']} has an empty validity tier"
        assert entry["label"] in html
        assert entry["validity"] in html


def test_timeline_metrics_are_labelled_parity_and_sync_metrics_new_construct() -> None:
    model = build_report(REAL_VALIDITY)

    for entry in model["timelineMetrics"]:
        assert entry["version"] == "compute-v1"
        assert "compute-v1" in entry["validity"] and "parity" in entry["validity"]
    for entry in model["syncMetrics"]:
        assert entry["version"] == "sync-v1"
        assert "新構念" in entry["validity"]


def test_tick_derived_sync_metrics_carry_a_precision_verdict() -> None:
    model = build_report(REAL_VALIDITY)
    by_key = {entry["key"]: entry for entry in model["syncMetrics"]}

    for key in ("release_to_fire_ms", "counter_hold_ms"):
        verdict = by_key[key]["verdict"]
        assert verdict["verdict"] == "sufficient"
        assert verdict["n"] == 13
        assert verdict["quantization_sd_ms"] == pytest.approx(2.255274489021976, rel=1e-12)
        assert verdict["reason"]
    # Both endpoints are sub-tick input timestamps, so sync-v1 does not judge it.
    assert by_key["counter_to_fire_ms"]["verdict"] is None


def test_frozen_version_strings_and_sync_params_are_reported() -> None:
    html = render_html(build_report(REAL_TRAJECTORY[0]))
    parameters = _section(html, "parameters")

    for version in FROZEN_VERSIONS:
        assert version in parameters
    assert f"min_samples={DEFAULT_SYNC_PARAMS.min_samples}" in parameters
    assert "2.255274489021976" in parameters
    assert "7.8125" in parameters


def test_only_registered_trajectory_constructs_reach_the_report() -> None:
    """C-D3 / GD-20: registered phase/curve constructs are labeled; SPARC/xcorr/Fitts never
    leak into the main table -- they live only in the WP-31 T-exit research-only block."""

    html = render_html(build_report(REAL_TRAJECTORY[0]))

    for banned in ("SPARC", "xcorr", "Fitts"):
        for section_id in ("summary", "phase", "curves", "rec-detect", "peeks", "groups", "parameters"):
            assert banned not in _section(html, section_id), f"{banned!r} leaked into #{section_id}"
    assert "phase-v1" in _section(html, "phase")
    assert "curve-v1" in _section(html, "curves")
    assert "detect-v1" in _section(html, "rec-detect")
    # Registered in v2, but only inside the dedicated research-only block / its gap notes.
    assert "sparc-v1" in _section(html, "advanced")
    assert "研究向" in _section(html, "advanced")
    assert "SPARC" in _section(html, "limits")


# ------------------------------------------------------------ WP-31 T-exit: research block


def test_passing_p2_diagnostics_render_in_the_research_block_with_full_annotations() -> None:
    """DoD ③: every P2 block that lands in the research section carries n / flags / version /
    a validity-tier sentence / a limitation sentence -- and 09:24 has all three passing."""

    model = build_report(REAL_TRAJECTORY[1])  # 09:24: sparc + xcorr research_only, fitts ok
    advanced = model["advancedDiagnostics"]
    html = render_html(model)
    section = _section(html, "advanced")

    assert advanced["xcorr"]["blocked"] is False
    assert advanced["fitts"]["blocked"] is False
    for block, version, needle in (
        (advanced["sparc"], "sparc-v1", "stratified_only"),
        (advanced["xcorr"], "xcorr-v1", "research_only"),
        (advanced["fitts"], "fitts-v1", "fitts-v1"),
    ):
        assert isinstance(block["n"], int)
        assert isinstance(block["flagCounts"], dict)
        assert block["version"] == version or version in block["version"]
        assert block["validity"], "P2 block has an empty validity tier"
        assert version in section
        assert needle in section
    # SPARC's frozen cross-length limit and xcorr's frozen upper-bound clause are reproduced
    # verbatim (not just referenced), so a coach reading one report sees the whole story.
    assert "stratified_only" in section and "padded_n bucket" in section
    assert "coach_report 不可達" in section
    assert "研究向" in section and "不得作為訓練處方依據" in section
    # A passing metric never also shows up as a "why is this absent" gap.
    assert "advanced-gaps" in html
    assert "無缺口" in _section(html, "advanced-gaps")


def test_blocked_by_data_p2_diagnostic_produces_a_gap_note_not_a_metric_block() -> None:
    """DoD ③: ``blocked-by-data`` never appears as a metric block anywhere in the report, but
    its absence is explained -- 09:18's Fitts is blocked (d_ratio 1.8343 < min_d_ratio 2.0)."""

    model = build_report(REAL_TRAJECTORY[0])  # 09:18
    advanced = model["advancedDiagnostics"]
    html = render_html(model)

    assert advanced["fitts"]["blocked"] is True
    assert advanced["fitts"]["status"] == "blocked-by-data"
    assert advanced["fitts"]["reason"] == "insufficient_d_ratio"
    advanced_section = _section(html, "advanced")
    # The blocked construct's *numbers* (a slope/TP figure) must not appear as a rendered
    # metric row; only the still-passing SPARC/xcorr blocks and the section heading may
    # mention "Fitts" (in prose), so check for its metric sub-heading specifically.
    assert "<h3>Fitts(" not in advanced_section
    gaps_section = _section(html, "advanced-gaps")
    assert "Fitts" in gaps_section
    assert "fitts-v1" in gaps_section
    assert "insufficient_d_ratio" not in gaps_section  # human text, not the raw enum
    assert "spawn 偏心角變異" in gaps_section


def test_sparc_has_no_blocked_branch_and_always_reaches_the_research_block() -> None:
    """SPARC's ``sparc-v1`` carries no ``blocked-by-data`` concept; even the synthetic
    fixture's degenerate (too-short) segments still produce a research-block row with n=0."""

    model = build_report(SYNTHETIC_COUNTERSTRAFE)
    advanced = model["advancedDiagnostics"]

    assert advanced["sparc"]["available"] is True
    assert advanced["sparc"]["n"] == 0
    assert advanced["sparc"]["flagCounts"].get("too_few_samples", 0) > 0
    assert "SPARC(" in _section(render_html(model), "advanced")


def test_xcorr_and_fitts_never_reach_coach_report_verdict() -> None:
    """C-D3 upper-bound clause made visible at the report layer: gate-v1's xcorr verdict is
    'research_only' or 'blocked-by-data', never 'coach_report'."""

    for fixture in REAL_TRAJECTORY:
        verdict = build_report(fixture)["advancedDiagnostics"]["xcorr"]["verdict"]
        assert verdict is not None
        assert verdict["verdict"] in ("research_only", "blocked-by-data")


def test_advanced_diagnostics_are_absent_for_pre_wp30_legacy_exports() -> None:
    model = build_report(REAL_VALIDITY)  # pre-WP-30 legacy: no eye origin, no strict omega
    advanced = model["advancedDiagnostics"]

    assert model["trajectory"]["available"] is False
    for key in ("sparc", "xcorr", "fitts"):
        assert advanced[key]["available"] is False
    html = render_html(model)
    assert "strict trajectory source gate" in _section(html, "advanced")


@pytest.mark.parametrize("fixture", REAL_TRAJECTORY, ids=lambda path: path.stem[-17:-1])
def test_trajectory_sections_have_complete_annotations_and_expected_side_counts(fixture: Path) -> None:
    model = build_report(fixture)
    html = render_html(model)

    assert model["trajectory"]["available"] is True
    for entry in model["phaseMetrics"]:
        assert entry["n"] > 0
        assert isinstance(entry["flagCounts"], dict)
        assert entry["version"] == "phase-v1"
        assert entry["validity"]
    consistency = model["recDetectConsistency"]
    assert consistency["n"] >= 5
    assert consistency["verdict"] == "session-insufficient"
    assert consistency["validity"] in _section(html, "rec-detect")
    assert "pooled 結論為系統性分歧" in _section(html, "rec-detect")
    for side in ("L", "R"):
        for signal in ("omega", "epsilon"):
            assert model["trajectory"]["curveSummary"][side][signal]["n"] == 10
            assert model["trajectory"]["curveSummary"][side][signal]["n_excluded"] == 0


def test_legacy_fixture_never_generates_aliased_trajectory_metrics() -> None:
    model = build_report(REAL_VALIDITY)

    assert model["trajectory"]["available"] is False
    assert all(entry["n"] == 0 for entry in model["phaseMetrics"])
    assert "strict trajectory source gate" in _section(render_html(model), "phase")


def test_drill_summary_reports_peeks_outcomes_and_first_shot_hit_rate() -> None:
    model = build_report(REAL_VALIDITY)
    summary = model["drillSummary"]

    assert summary["peekCount"] == 20
    assert summary["outcomes"] == {"hit": 20, "timeout": 0, "no_shot": 0}
    assert summary["firstShotHitRate"] == pytest.approx(90.0)
    assert summary["firstShotHits"] == 18


def test_per_peek_timeline_covers_every_visible_event_in_order() -> None:
    model = build_report(REAL_VALIDITY)
    peeks = model["peeks"]

    assert [peek["index"] for peek in peeks] == list(range(20))
    assert len(re.findall(r"<circle", _section(render_html(model), "timeline"))) >= len(peeks)


def test_flag_counts_match_the_frozen_t2_evidence() -> None:
    model = build_report(REAL_VALIDITY)

    assert model["flagCounts"] == {
        "counter_hold_truncated": 3,
        "missing_release": 1,
        "multiple_counters": 4,
        "no_key_transition": 1,
    }


# ------------------------------------------------------------------- zero-sample safety


def test_zero_input_fixture_reports_n_zero_without_crashing_or_filling_zeros() -> None:
    model = build_report(REAL_ZERO)
    html = render_html(model)

    for entry in model["syncMetrics"]:
        assert entry["n"] == 0
        # Missing anchors stay missing: no 0 substitute, no NaN swallow.
        assert entry["mean"] is None
        assert entry["sampleSdMs"] is None
    for verdict in model["precisionVerdicts"]:
        assert verdict["verdict"] == "blocked-by-data"
        assert verdict["n"] == 0
        assert verdict["sample_sd_ms"] is None
    assert "blocked-by-data" in html
    # No cell may render a non-finite value, and an empty compute-v1 aggregate must not
    # show its {mean:0,p50:0,sd:0} placeholder as if it were a measurement.
    assert ">NaN<" not in html and ">nan<" not in html
    assert "mean 0 · p50 0 · sd 0" not in html


def test_zero_input_fixture_still_reports_its_parity_verified_hit_rate() -> None:
    model = build_report(REAL_ZERO)

    assert model["drillSummary"]["firstShotHitRate"] == pytest.approx(90.0)
    counter_reaction = model["timelineMetrics"][0]
    assert counter_reaction["n"] == 0
    assert counter_reaction["excludedCount"] == 20


def test_export_without_visible_events_produces_a_valid_empty_report(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["events"] = [event for event in payload["events"] if event["type"] != "visible"]
    source = tmp_path / "no-visible.json"
    source.write_text(json.dumps(payload), encoding="utf-8")

    model = build_report(source)

    assert model["drillSummary"]["peekCount"] == 0
    assert model["peeks"] == []
    assert "<svg" in render_html(model)


# -------------------------------------------------------------------------- group-by


@pytest.mark.parametrize("group_by", GROUP_BY_CHOICES)
def test_group_by_runs_and_names_every_group(group_by: str, tmp_path: Path) -> None:
    assert main(
        ["--export", str(REAL_VALIDITY), "--group-by", group_by, "--out", str(tmp_path)]
    ) == 0

    path = tmp_path / report_filename(REAL_VALIDITY, group_by)
    assert path.is_file()
    html = path.read_text(encoding="utf-8")
    for group in build_report(REAL_VALIDITY, group_by)["groups"]:
        assert group["label"] in html


@pytest.mark.parametrize("group_by", GROUP_BY_CHOICES)
def test_every_group_carries_its_own_n_stats_and_flags(group_by: str) -> None:
    model = build_report(REAL_VALIDITY, group_by)

    assert model["groups"], f"--group-by {group_by} produced no group"
    assert [group["key"] for group in model["groups"]] == sorted(
        group["key"] for group in model["groups"]
    )
    for group in model["groups"]:
        assert group["peekCount"] > 0
        assert [entry["key"] for entry in group["timelineMetrics"]] == list(TIMELINE_KEYS)
        assert [entry["key"] for entry in group["syncMetrics"]] == list(SYNC_COLUMNS)
        for entry in group["timelineMetrics"] + group["syncMetrics"]:
            assert isinstance(entry["n"], int)
            assert isinstance(entry["flagCounts"], dict)


@pytest.mark.parametrize("group_by", GROUP_BY_CHOICES)
def test_groups_partition_the_drill_without_losing_or_duplicating_rows(group_by: str) -> None:
    ungrouped = build_report(REAL_VALIDITY)
    grouped = build_report(REAL_VALIDITY, group_by)

    assert sum(group["peekCount"] for group in grouped["groups"]) == ungrouped["drillSummary"]["peekCount"]
    for column in SYNC_COLUMNS:
        drill_n = next(entry for entry in ungrouped["syncMetrics"] if entry["key"] == column)["n"]
        group_n = sum(
            next(entry for entry in group["syncMetrics"] if entry["key"] == column)["n"]
            for group in grouped["groups"]
        )
        assert group_n == drill_n
    merged: dict[str, int] = {}
    for group in grouped["groups"]:
        for flag, count in group["flagCounts"].items():
            merged[flag] = merged.get(flag, 0) + count
    assert merged == ungrouped["flagCounts"]


def test_group_by_side_reproduces_the_known_left_right_split() -> None:
    groups = {group["key"]: group for group in build_report(REAL_VALIDITY, "side")["groups"]}

    assert set(groups) == {"L", "R"}
    assert groups["L"]["peekCount"] == 10 and groups["R"]["peekCount"] == 10
    left_release = next(
        entry for entry in groups["L"]["syncMetrics"] if entry["key"] == "release_to_fire_ms"
    )
    right_release = next(
        entry for entry in groups["R"]["syncMetrics"] if entry["key"] == "release_to_fire_ms"
    )
    assert left_release["n"] + right_release["n"] == 13


def test_real_fixtures_degenerate_to_one_cell_for_ads_and_weapon_mode() -> None:
    """OQ-S4-11 evidence: no ADS-on and no projectile cell exists in real data."""

    ads = build_report(REAL_VALIDITY, "ads")["groups"]
    weapon = build_report(REAL_VALIDITY, "weapon_mode")["groups"]

    assert [group["key"] for group in ads] == ["off"]
    assert [group["key"] for group in weapon] == ["hitscan"]


def test_synthetic_fixture_exercises_the_projectile_group() -> None:
    weapon = build_report(SYNTHETIC, "weapon_mode")["groups"]

    assert [group["key"] for group in weapon] == ["projectile"]


@pytest.mark.parametrize("group_by", GROUP_BY_CHOICES)
def test_grouping_never_changes_parameter_metadata(group_by: str, tmp_path: Path) -> None:
    ungrouped = build_report(REAL_VALIDITY)
    grouped = build_report(REAL_VALIDITY, group_by)

    assert grouped["parameters"] == ungrouped["parameters"]
    assert grouped["precisionVerdicts"] == ungrouped["precisionVerdicts"]
    assert grouped["syncMetrics"] == ungrouped["syncMetrics"]
    # ...and the rendered contract block is byte-identical, not merely equal in memory.
    assert _section(render_html(grouped), "parameters") == _section(
        render_html(ungrouped), "parameters"
    )


def test_group_by_rejects_an_unknown_key() -> None:
    with pytest.raises(ValueError):
        build_report(REAL_VALIDITY, "recoilIndex")


# -------------------------------------------------------------------------- escaping


def test_drill_id_cannot_inject_html(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["meta"]["drillId"] = '<img src=x onerror="alert(1)">'
    source = tmp_path / "injected.json"
    source.write_text(json.dumps(payload), encoding="utf-8")

    html = render_html(build_report(source))

    # The payload must survive only as inert text, never as a live tag.
    assert "<img" not in html
    assert '<img src=x onerror="alert(1)">' not in html
    assert "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;" in html


@pytest.mark.parametrize("field", ("weaponId", "browser", "movementModel"))
def test_unrendered_meta_strings_never_reach_the_page(field: str, tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["meta"][field] = "SENTINEL-DO-NOT-RENDER"
    source = tmp_path / f"unrendered-{field}.json"
    source.write_text(json.dumps(payload), encoding="utf-8")

    assert "SENTINEL-DO-NOT-RENDER" not in render_html(build_report(source))


def test_target_ids_cannot_inject_html_into_the_table_or_svg(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    for event in payload["events"]:
        if "targetId" in event:
            event["targetId"] = "</svg><script>alert(1)</script>"
    source = tmp_path / "injected-target.json"
    source.write_text(json.dumps(payload), encoding="utf-8")

    html = render_html(build_report(source))

    assert "<script>" not in html
    assert "</svg><script" not in html
    assert "&lt;" in html


def test_fixture_filename_is_escaped(tmp_path: Path) -> None:
    # Windows forbids <> in filenames, so & is the escapable character available here.
    payload = make_synthetic_export(SyntheticSpec())
    source = tmp_path / "a&b'c.json"
    source.write_text(json.dumps(payload), encoding="utf-8")

    html = render_html(build_report(source))

    assert "a&amp;b&#x27;c.json" in html
    assert "a&b'c.json" not in html


# ----------------------------------------------------------------------- determinism


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda path: path.stem[:28])
def test_repeated_generation_is_byte_identical(fixture: Path, tmp_path: Path) -> None:
    first = generate(fixture, tmp_path / "a")
    second = generate(fixture, tmp_path / "b")

    assert first.read_bytes() == second.read_bytes()


def test_report_embeds_no_wall_clock_or_random_identifier() -> None:
    html = render_html(build_report(REAL_VALIDITY))

    # A generated-at stamp or uuid would make every regeneration a spurious diff.
    assert not re.search(r"\b20\d\d-\d\d-\d\dT\d\d:\d\d", html)
    assert not re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}", html)


def test_committed_example_reports_match_a_fresh_run(tmp_path: Path) -> None:
    outputs = (
        RESEARCH_ROOT / "src" / "modules" / "metrics" / "notebooks" / "t-exit" / "outputs"
    )
    committed = sorted(outputs.glob("coach-report-*.html"))
    assert committed, "the T-exit slice must commit at least one example report"

    for index, path in enumerate(committed):
        match = re.fullmatch(r"coach-report-(.+?)(?:-by-(side|ads|weapon_mode))?\.html", path.name)
        assert match is not None, path.name
        export = EXPORT_DIR / f"{match.group(1)}.json"
        # Short output dir: the fixture names are long enough to hit Windows MAX_PATH.
        fresh = generate(export, tmp_path / str(index), match.group(2))
        assert fresh.read_bytes() == path.read_bytes(), f"{path.name} is stale"


# ------------------------------------------------------------------------------ CLI


def test_cli_defaults_to_the_synthetic_timeline_fixture(tmp_path: Path) -> None:
    assert main(["--out", str(tmp_path)]) == 0
    assert (tmp_path / report_filename(DEFAULT_EXPORT, None)).is_file()


def test_invalid_export_exits_non_zero_without_writing_a_report(tmp_path: Path) -> None:
    payload = make_synthetic_export(SyntheticSpec())
    payload["meta"]["schemaVersion"] = 1
    source = tmp_path / "bad.json"
    source.write_text(json.dumps(payload), encoding="utf-8")
    out_dir = tmp_path / "out"

    assert main(["--export", str(source), "--out", str(out_dir)]) == 1
    assert not out_dir.exists()


def test_report_uses_strict_trajectory_gate_before_consuming_position_columns() -> None:
    """WP-30 supersedes D-29.2: trajectory metrics consume px/pz only via strict eye geometry."""

    source = (RESEARCH_ROOT / "src" / "report" / "coach_report.py").read_text(encoding="utf-8")

    assert "resolve_eye_origin(export.meta, strict=True)" in source
    assert "omega_deg_s(window_ticks, strict=True)" in source
    assert load_export(REAL_TRAJECTORY[0]).meta["suspect"] is True
