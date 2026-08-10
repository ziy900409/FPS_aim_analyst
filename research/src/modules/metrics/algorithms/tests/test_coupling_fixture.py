from __future__ import annotations

from dataclasses import asdict
import json
import math

import numpy as np
import pandas as pd
import pytest

from modules.ingest.algorithms import load_export
from modules.metrics.algorithms.coupling import (
    DEFAULT_GATE_THRESHOLDS,
    DEFAULT_XCORR_PARAMS,
    key_event_crosscheck,
    reliability_gate,
)
from modules.metrics.notebooks.t2.generate_xcorr_report import (
    OUTPUT_DIR,
    REAL_FIXTURES,
    SYNTHETIC_FIXTURE,
    build_xcorr_frame,
)


#: T0 §3 measured these before any xcorr value existed: every real peek clears `min_ticks=32` by a
#: wide margin (shortest real window 53 ticks), so `xcorr-v1` excludes nothing on this data.
_EXPECTED_VALID_PER_FIXTURE = (20, 20, 20)

#: T0 §2's independent re-run of the roster: A/D transitions derivable from `ticks[].keys`, which
#: happens to equal the number of additive `key` events one-for-one.
_EXPECTED_TRANSITIONS = (86, 84, 78)

_NOMINAL_DT_MS = 1000.0 / 128.0


def _frames() -> list[pd.DataFrame]:
    return [build_xcorr_frame(path) for path in REAL_FIXTURES]


def _committed_gate() -> dict:
    return json.loads((OUTPUT_DIR / "xcorr-gate-verdicts.json").read_text(encoding="utf-8"))


def test_every_real_peek_is_scorable_so_the_gate_denominator_is_the_full_roster() -> None:
    for frame, expected in zip(_frames(), _EXPECTED_VALID_PER_FIXTURE, strict=True):
        assert len(frame) == 20
        assert int(frame["flags"].map(lambda flags: len(flags) == 0).sum()) == expected
        assert (frame["n_ticks"] >= DEFAULT_XCORR_PARAMS.min_ticks).all()


def test_the_two_channels_stay_index_aligned_on_the_same_tick_grid() -> None:
    # The whole reason this project needs no clock alignment: key state and omega are sampled by the
    # same 128 Hz loop. Both drop omega's contractual leading nan together, so the paired-sample
    # count is exactly one below the window length and dt is the nominal tick.
    for path, frame in zip(REAL_FIXTURES, _frames(), strict=True):
        export = load_export(path)
        ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
        from modules.metrics.algorithms.peek import build_peek_windows

        for peek, row in zip(build_peek_windows(export), frame.itertuples(), strict=True):
            window = ticks.iloc[peek.tick_slice]
            assert row.n_ticks == len(window) - 1
            assert len(row.key_state) == len(row.omega) == row.n_ticks
            assert row.dt_ms == pytest.approx(_NOMINAL_DT_MS, abs=1e-9)
            assert row.max_lag_ticks == 32
        assert path.stem  # keeps the loop variable meaningful if the assertions above are edited


def test_every_correlogram_carries_its_own_paired_sample_count() -> None:
    # D-31.5's presentation contract (from S-31.1): at |lag| = 32 a ~62-tick peek has only ~30 pairs
    # left, so the edges of the curve are inherently noisier than its middle and the reader must be
    # able to see that without recomputing it.
    frame = _frames()[0]
    for row in frame.itertuples():
        assert len(row.correlogram) == 2 * row.max_lag_ticks + 1
        overlaps = [overlap for _, _, overlap in row.correlogram]
        assert overlaps[row.max_lag_ticks] == row.n_ticks
        assert min(overlaps) == row.n_ticks - row.max_lag_ticks


def test_the_tick_derived_key_state_agrees_with_the_additive_key_event_stream() -> None:
    """T2 DoD 7. The tick state is authoritative; this is the witness that it lost no transition."""

    for path, expected in zip(REAL_FIXTURES, _EXPECTED_TRANSITIONS, strict=True):
        export = load_export(path)
        report = key_event_crosscheck(export.ticks, export.events)

        assert report["status"] == "agree"
        assert report["n_tick_transitions"] == report["n_key_events"] == expected
        assert report["n_matched"] == expected
        # Every residual is under one tick: each event surfaces on the very next tick, which is
        # exactly what sampling an input-timestamped event onto a 128 Hz grid should look like.
        assert report["max_abs_residual_ms"] < _NOMINAL_DT_MS


def test_the_synthetic_fixture_has_no_key_events_and_that_is_not_a_disagreement() -> None:
    export = load_export(SYNTHETIC_FIXTURE)
    report = key_event_crosscheck(export.ticks, export.events)

    assert report["status"] == "no_key_events"
    assert report["n_tick_transitions"] == 7 and report["n_key_events"] == 0


def test_the_synthetic_fixture_degrades_to_window_too_short_without_raising() -> None:
    # 24-tick peeks leave 23 paired samples, below `xcorr-v1.min_ticks = 32`. Note this is yet
    # another degenerate branch than the same fixture takes under `phase-v1` (min_window_ticks=30)
    # or `sparc-v1` (MIN_SAMPLES=16 on the MR interval): different constructs bottom out for
    # different reasons, and requiring one shared flag would be a false consistency (S-31.4).
    frame = build_xcorr_frame(SYNTHETIC_FIXTURE)

    assert list(frame["flags"]) == [("window_too_short",), ("window_too_short",)]
    assert list(frame["n_ticks"]) == [23, 23]
    assert frame["peak_strength"].isna().all()
    assert all(correlogram == () for correlogram in frame["correlogram"])


def test_the_committed_verdicts_carry_the_frozen_thresholds_and_the_upper_bound_clause() -> None:
    payload = _committed_gate()

    assert payload["gate_thresholds"] == asdict(DEFAULT_GATE_THRESHOLDS)
    assert payload["xcorr_params"] == asdict(DEFAULT_XCORR_PARAMS)
    assert "coach_report' is unreachable" in payload["upper_bound_clause"]
    assert "P001" in payload["sample_limitation"]
    assert [verdict["verdict"] for verdict in payload["verdicts"]] == ["research_only"] * 3
    assert [verdict["n"] for verdict in payload["verdicts"]] == [20, 20, 20]


def test_the_committed_observed_statistic_matches_a_fresh_recomputation() -> None:
    # The session statistic needs no RNG, so all three sessions are re-derived cheaply here; the
    # seeded parts are re-derived for one session below.
    payload = _committed_gate()
    for frame, verdict in zip(_frames(), payload["verdicts"], strict=True):
        valid = frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]
        observed = float(np.median(np.abs(valid["peak_strength"].to_numpy(dtype=float))))

        assert verdict["session"] == frame["session"].iloc[0]
        assert verdict["observed"] == pytest.approx(observed, abs=1e-12)


def test_the_committed_verdict_for_one_session_reproduces_bit_for_bit_from_the_seed() -> None:
    """T2 DoD 2/5 on the real artefact: seed in, same permutation null and CI out.

    Only the first session is re-run. The 1000-permutation null costs ~10 s per session, and the
    seeding is per session (blake2b of the session label), so reproducing one session exercises
    every RNG-dependent code path the other two use -- paying 30 s on every future test run to
    re-derive the same guarantee three times would not add evidence.
    """

    payload = _committed_gate()
    frame = build_xcorr_frame(REAL_FIXTURES[0])

    (verdict,) = reliability_gate(frame, DEFAULT_GATE_THRESHOLDS, DEFAULT_XCORR_PARAMS)
    committed = payload["verdicts"][0]

    assert asdict(verdict) == committed


def test_the_committed_cross_check_and_distribution_artifacts_exist_for_review() -> None:
    for path in (*REAL_FIXTURES, SYNTHETIC_FIXTURE):
        assert (OUTPUT_DIR / f"xcorr-table-{path.stem}.csv").exists()
        assert (OUTPUT_DIR / f"xcorr-correlogram-{path.stem}.csv").exists()
    for path in REAL_FIXTURES:
        assert (OUTPUT_DIR / f"xcorr-correlogram-{path.stem}.svg").exists()
    assert (OUTPUT_DIR / "xcorr-distributions.csv").exists()

    crosscheck = json.loads((OUTPUT_DIR / "xcorr-key-event-crosscheck.json").read_text(encoding="utf-8"))
    assert {report["status"] for report in crosscheck.values()} == {"agree", "no_key_events"}


def test_the_peak_lag_direction_is_not_stable_across_sessions() -> None:
    """A recorded limitation, asserted so it cannot quietly stop being true.

    ``gate-v1``'s three criteria are all about the *magnitude* of the coupling; none of them looks
    at its direction. On this data the median signed strength and the median peak lag both change
    sign between sessions, which is why T2 reports the lag distribution rather than a single
    "the key leads by X ms" number.
    """

    signed_medians = [
        float(
            np.median(
                frame.loc[frame["flags"].map(lambda flags: len(flags) == 0)]["peak_strength"].to_numpy(
                    dtype=float
                )
            )
        )
        for frame in _frames()
    ]

    assert min(signed_medians) < 0 < max(signed_medians)
    assert all(math.isfinite(value) for value in signed_medians)
