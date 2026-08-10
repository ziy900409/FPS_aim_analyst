from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from modules.ingest.algorithms import load_export
from modules.metrics.algorithms.sparc import DEFAULT_SPARC_PARAMS, sparc_length_sensitivity
from modules.metrics.notebooks.t1.generate_sparc_report import (
    OUTPUT_DIR,
    REAL_FIXTURES,
    SYNTHETIC_FIXTURE,
    build_sparc_frame,
)


#: Planning-period measurement, re-established here as a machine-checked fact (WP-31 README §0.2):
#: per-peek `seg-v2` segmentation yields 20/19/20 `primary_flick` intervals across the three real
#: fixtures. Segmenting the whole trace instead would yield 1/1/1 -- which is exactly the silent
#: failure this assertion exists to catch (README §3 first row).
_EXPECTED_VALID_PER_FIXTURE = (20, 19, 20)
_EXPECTED_POOLED_VALID = 59
_EXPECTED_POOLED_PEEKS = 60


def _frames() -> list:
    return [build_sparc_frame(path) for path in REAL_FIXTURES]


def test_valid_row_count_matches_the_phase_v1_non_degenerate_mr_count() -> None:
    # The frozen segment-source contract (D-31.3/D-31.5) made mechanical: SPARC must score exactly
    # the MR intervals `phase-v1` finds, no more and no fewer. Both counts are derived here from the
    # same per-peek segmentation, so a divergence means one of the two consumers changed scoping.
    from dataclasses import replace

    from modules.kinematics.algorithms.angular import omega_deg_s
    from modules.metrics.algorithms.peek import build_peek_windows
    from modules.metrics.algorithms.phase import DEFAULT_PHASE_PARAMS, phase_decompose
    from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements

    pooled_sparc = 0
    pooled_phase = 0
    for path, expected in zip(REAL_FIXTURES, _EXPECTED_VALID_PER_FIXTURE, strict=True):
        export = load_export(path)
        ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
        peeks = build_peek_windows(export)

        phase_mr = 0
        for peek in peeks:
            window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
            omega = omega_deg_s(window_ticks, strict=True).values
            raw = segment_submovements(omega[1:], SEG_V2_PARAMS) if len(omega) > 1 else []
            segments = [
                replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index)
                for segment in raw
            ]
            sample = phase_decompose(peek, omega, window_ticks, segments, DEFAULT_PHASE_PARAMS)
            if sample.t_mr_end is not None:
                phase_mr += 1

        frame = build_sparc_frame(path)
        sparc_valid = int(frame["flags"].map(lambda flags: len(flags) == 0).sum())

        assert sparc_valid == expected, f"{path.stem}: expected {expected} scorable MR intervals"
        assert sparc_valid == phase_mr, f"{path.stem}: sparc rows diverged from phase-v1's MR count"
        assert len(frame) == len(peeks)
        pooled_sparc += sparc_valid
        pooled_phase += phase_mr

    assert pooled_sparc == pooled_phase == _EXPECTED_POOLED_VALID


def test_the_single_excluded_peek_is_the_known_no_primary_flick_case() -> None:
    frames = _frames()
    excluded = [
        (path.stem, int(row.peek_index), row.flags)
        for path, frame in zip(REAL_FIXTURES, frames, strict=True)
        for row in frame.itertuples()
        if row.flags
    ]

    # 09:24 peek 0 is `seg-v2`'s known below-floor / zero-segment peek (D-30.1b), already accounted
    # for in its 98.3% success rate -- not a new SPARC-specific exclusion.
    assert len(excluded) == _EXPECTED_POOLED_PEEKS - _EXPECTED_POOLED_VALID
    assert excluded[0][1] == 0
    assert excluded[0][2] == ("no_primary_flick",)


def test_every_scored_interval_clears_the_ported_minimum_and_lands_in_a_known_bucket() -> None:
    for frame in _frames():
        valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
        assert (valid["n_ticks"] >= 16).all()
        assert set(valid["padded_n"]) <= {32, 64}
        assert (valid["sparc"] < 0).all()  # a real spectral arc length is strictly negative


def test_both_padding_buckets_are_populated_so_the_step_diagnostic_is_not_vacuous() -> None:
    import pandas as pd

    pooled = pd.concat(_frames(), ignore_index=True)
    result = sparc_length_sensitivity(pooled, DEFAULT_SPARC_PARAMS)

    assert [bucket["padded_n"] for bucket in result["buckets"]] == [32, 64]
    assert all(bucket["n"] >= 10 for bucket in result["buckets"])
    assert result["buckets"][0]["bins_le_fc"] == 6
    assert result["buckets"][1]["bins_le_fc"] == 11


def test_committed_length_sensitivity_artifact_matches_a_fresh_recomputation() -> None:
    import pandas as pd

    committed = json.loads((OUTPUT_DIR / "sparc-length-sensitivity.json").read_text(encoding="utf-8"))
    fresh = sparc_length_sensitivity(pd.concat(_frames(), ignore_index=True), DEFAULT_SPARC_PARAMS)

    assert committed == fresh


def test_registered_fs_hz_matches_the_real_export_tick_rate() -> None:
    # `sparc-v1.fs_hz=128.0` is an assumption carried into every frequency-domain quantity; it is
    # checked against the data, not trusted (SPARC scales directly with the assumed sample rate).
    expected_interval_ms = 1000.0 / DEFAULT_SPARC_PARAMS.fs_hz
    for path in REAL_FIXTURES:
        export = load_export(path)
        times = export.ticks.sort_values("t", kind="stable")["t"].to_numpy(dtype=float)
        assert float(np.median(np.diff(times))) == pytest.approx(expected_interval_ms, abs=1e-9)


def test_synthetic_fixture_degrades_to_too_few_samples_without_raising() -> None:
    # `synthetic_counterstrafe.json`'s MR intervals are 9 ticks -- below the ported MIN_SAMPLES=16.
    # Note this is a *different* degenerate branch than `phase-v1` takes on the same fixture
    # (`window_too_short`, min_window_ticks=30): the two constructs measure different things and
    # bottom out for different reasons; both must fail loudly-but-gracefully, neither may fabricate.
    frame = build_sparc_frame(SYNTHETIC_FIXTURE)

    assert len(frame) == 2
    assert list(frame["flags"]) == [("too_few_samples",), ("too_few_samples",)]
    assert list(frame["n_ticks"]) == [9, 9]
    assert frame["sparc"].isna().all()  # never 0.0: the port's degenerate value is not fabricated


def test_committed_per_fixture_tables_exist_for_review() -> None:
    for path in (*REAL_FIXTURES, SYNTHETIC_FIXTURE):
        assert (OUTPUT_DIR / f"sparc-table-{path.stem}.csv").exists()
    assert (OUTPUT_DIR / "sparc-distributions.csv").exists()
    assert (OUTPUT_DIR / "sparc-vs-length.svg").exists()


def test_golden_files_live_in_this_repo_and_are_readable_without_the_source_repo() -> None:
    golden_dir = Path(__file__).resolve().parents[5] / "fixtures" / "golden"

    for name in ("sparc-pa-parity.json", "sparc-128hz-domain.json"):
        payload = json.loads((golden_dir / name).read_text(encoding="utf-8"))
        assert payload["cases"]
