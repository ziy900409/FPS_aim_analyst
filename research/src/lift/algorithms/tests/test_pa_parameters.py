"""WP-61 T3: the reference-parameter table and F5's scan.

F5 is the failure mode where a threshold crosses a unit boundary uncorrected, lands an order of
magnitude off, and the ablation then reads as "nearly separated". The mitigation is structural
rather than careful: the source literals exist in exactly one module, downstream code reaches them
only through ``counts_value()``, and this file fails if either stops being true.
"""

from __future__ import annotations

import ast
from pathlib import Path
import re

import pytest

from lift.algorithms import pa_parameters
from lift.algorithms.pa_parameters import (
    BOUNDARY_WINDOW_SWEEP_MS,
    NOT_PORTED,
    REFERENCE_PARAMETERS,
    STAGE_2_PARAMETERS,
    STAGE_3_PARAMETERS,
    TINY_COUNTS,
    counts_value,
    parameter,
)


LIFT_ROOT = Path(__file__).resolve().parents[2]
PROVENANCE_MODULE = LIFT_ROOT / "algorithms" / "pa_parameters.py"


# ── provenance completeness (FR-61.10) ───────────────────────────────────────────────────────────


def test_every_parameter_records_source_file_version_space_converted_value_and_basis() -> None:
    for record in REFERENCE_PARAMETERS:
        assert record.name.isupper(), record.name
        assert record.declared_space, record.name
        assert record.source_space, record.name
        assert len(record.basis) > 40, f"{record.name} basis is too thin to audit"
    # The file/version half of the five columns is module-level and applies to every row.
    assert len(pa_parameters.SOURCE_CONFIG_COMMIT) == 40
    assert len(pa_parameters.SOURCE_IMPLEMENTATION_COMMIT) == 40
    assert len(pa_parameters.SOURCE_DECISION_RECORD_COMMIT) == 40
    assert len(pa_parameters.AUDITED_AT_HEAD) == 40


def test_the_three_misnamed_parameters_record_both_the_claimed_and_the_actual_space() -> None:
    # This is the audit's finding. If someone later "tidies" declared_space to match source_space,
    # the reason the values transfer unchanged disappears with it.
    misnamed = {record.name: record for record in REFERENCE_PARAMETERS if record.name.endswith(("_PX_S", "_PX_S2"))}
    assert set(misnamed) == {
        "ACCEL_UP_THRESHOLD_PX_S2",
        "START_SPEED_GATE_PX_S",
        "HOVER_VELOCITY_THRESHOLD_PX_S",
    }
    for record in misnamed.values():
        assert record.declared_space.startswith("px")
        assert record.source_space.startswith("counts")
        assert record.counts_space_value == record.source_value


def test_the_carry_across_is_a_relabelling_and_says_so_rather_than_being_silent() -> None:
    for record in REFERENCE_PARAMETERS:
        assert record.counts_space_value == record.source_value
    assert "CPI" in parameter("ACCEL_UP_THRESHOLD_PX_S2").basis


def test_the_two_stages_partition_the_ported_set() -> None:
    assert set(STAGE_2_PARAMETERS) | set(STAGE_3_PARAMETERS) == {record.name for record in REFERENCE_PARAMETERS}
    assert set(STAGE_2_PARAMETERS) & set(STAGE_3_PARAMETERS) == set()


def test_a_deliberately_dropped_parameter_raises_with_its_reason_rather_than_a_bare_key_error() -> None:
    # "Not ported" and "never heard of it" are different mistakes and must not read the same.
    with pytest.raises(KeyError, match="deliberately not ported"):
        parameter("CLICK_IMMUNITY_MS")
    with pytest.raises(KeyError, match="not a parameter"):
        parameter("NO_SUCH_PARAMETER")


def test_every_dropped_parameter_carries_the_consequence_of_dropping_it() -> None:
    assert set(NOT_PORTED) == {
        "CLICK_IMMUNITY_MS",
        "GAP_CONFIRM_MS",
        "TIME_GAP_THRESHOLD_MS",
        "SAMPLE_INTERVAL_US_FALLBACK",
    }
    for name, reason in NOT_PORTED.items():
        assert len(reason) > 60, name
    # The click-immunity omission changes what the stage 2 analogue *is*, so it must say so.
    assert "without" in NOT_PORTED["CLICK_IMMUNITY_MS"]


def test_the_ported_values_are_the_ones_in_the_source_config() -> None:
    assert counts_value("ACCEL_UP_THRESHOLD_PX_S2") == 350_000.0
    assert counts_value("ACCEL_DOWN_RATIO") == 3.0
    assert counts_value("START_SPEED_GATE_PX_S") == 300.0
    assert counts_value("HOVER_WINDOW_MS") == 15.0
    assert counts_value("HOVER_VELOCITY_THRESHOLD_PX_S") == 1200.0
    assert counts_value("HOVER_VARIANCE_THRESHOLD") == 0.35
    assert counts_value("DEADZONE_COUNTS") == 5.0
    assert counts_value("MIN_STROKE_POINTS") == 5.0


def test_the_tremor_threshold_is_taken_from_the_deadzone_rather_than_invented() -> None:
    assert TINY_COUNTS == counts_value("DEADZONE_COUNTS")


def test_the_window_sweep_is_declared_and_brackets_the_reference_scan_window() -> None:
    # T3 step 3 requires the sweep's range and step be written down before layer 2 is run.
    assert BOUNDARY_WINDOW_SWEEP_MS == (10.0, 20.0, 40.0)
    assert counts_value("HEAD_SCAN_MS") in BOUNDARY_WINDOW_SWEEP_MS


# ── F5: no unconverted source literal anywhere else (README section 2.6) ─────────────────────────


def _every_module_but_this_one() -> list[Path]:
    return sorted(path for path in LIFT_ROOT.rglob("*.py") if path.name != Path(__file__).name)


def _shipping_modules() -> list[Path]:
    """Non-test sources outside the provenance table -- where an F5 error would actually do damage.

    Test files are excluded from the *literal* scan only. They are full of arbitrary millisecond
    timestamps, so any speed-space magnitude will eventually collide with one, and a scan that cries
    wolf gets deleted. The name scan below still covers them.
    """

    return [
        path
        for path in _every_module_but_this_one()
        if path != PROVENANCE_MODULE and "tests" not in path.parts
    ]


def test_there_are_sources_to_scan() -> None:
    # A scan over zero files passes vacuously -- the worst kind of green.
    assert len(_shipping_modules()) >= 4
    assert len(_every_module_but_this_one()) >= 8


def test_no_module_outside_the_provenance_table_spells_a_source_space_literal() -> None:
    # The two speed-space magnitudes that could only have come from the source table. A bare 350000
    # or 1200 in an algorithm module is precisely F5 happening.
    #
    # START_SPEED_GATE's 300.0 is deliberately *not* scanned for: it collides with T0's frozen
    # 300 ms matching tolerance and with the synthetic fixture's sample counts, so scanning it would
    # produce three standing false positives and the scan would be silenced within a week. The name
    # scan below covers that parameter instead, which is the half that matters -- a stray 300.0 is
    # not an order-of-magnitude unit error, and F5 is about order-of-magnitude unit errors.
    forbidden = {350_000.0, 1200.0}

    offenders: list[str] = []
    for path in _shipping_modules():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                if not isinstance(node.value, bool) and float(node.value) in forbidden:
                    offenders.append(f"{path.relative_to(LIFT_ROOT)}:{node.lineno} has {node.value}")

    assert offenders == [], offenders


SANCTIONED_LOOKUP = re.compile(r"""(?:counts_value|parameter)\(\s*["'][A-Z0-9_]+["']\s*\)""")
"""The one way downstream code may name a source parameter: hand it to the table and take back the
value in this project's space. Everything else -- a comment quoting the name, a local constant
carrying it, a docstring restating its value -- is a copy that has escaped the table."""


def test_no_module_outside_the_provenance_table_names_a_source_parameter() -> None:
    # Catches the other half of F5: a threshold copied across and *renamed*, which the literal scan
    # would miss, but which still carries the source identifier somewhere in the file.
    names = tuple(record.name for record in REFERENCE_PARAMETERS) + tuple(NOT_PORTED)

    offenders: list[str] = []
    for path in _every_module_but_this_one():
        if path == PROVENANCE_MODULE:
            continue
        residue = SANCTIONED_LOOKUP.sub("<lookup>", path.read_text(encoding="utf-8"))
        for name in names:
            if name in residue:
                offenders.append(f"{path.relative_to(LIFT_ROOT)}: {name}")

    assert offenders == [], offenders


def test_the_scan_still_catches_a_name_that_did_not_go_through_the_table() -> None:
    # Without this, the exemption above could be widened until the scan means nothing.
    assert SANCTIONED_LOOKUP.sub("<lookup>", 'counts_value("DEADZONE_COUNTS")') == "<lookup>"
    assert "DEADZONE_COUNTS" in SANCTIONED_LOOKUP.sub("<lookup>", "TINY = 5.0  # DEADZONE_COUNTS")
    assert "DEADZONE_COUNTS" in SANCTIONED_LOOKUP.sub("<lookup>", 'DEADZONE_COUNTS = 5.0')
