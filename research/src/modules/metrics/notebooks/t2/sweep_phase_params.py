"""WP-30 / T2 -- dual-dimension ``phase-v1`` parameter sweep (D-30.4 pattern).

Dimension 1 (synthetic): the six pre-registered REC/MR/V boundary cases (the same three known
submovement profiles used to freeze ``seg-v2``, each with/without a first-shot anchor) must
reproduce the ``seg-v2`` ``primary_flick`` segment verbatim (D-30.1/C-D4 -- this is a structural
guarantee, not something a candidate parameter set can fail; the sweep still asserts it for every
candidate so a future regression is caught here rather than assumed).

Dimension 2 (real): of the 60 real peeks across the three frozen fixtures (09:18/09:24/09:37,
T0/D-30.2 roster), the fraction with all three phases non-degenerate (no
window_too_short/no_primary_flick/no_first_shot/filter_degenerate/anchor_before_onset -- the same
five flags T0 pre-registered in progress.md Section 3.1) must be >=90%.

A candidate only freezes as ``phase-v1`` when both dimensions pass -- freezing on synthetic alone is
exactly the ``seg-v1`` failure mode this sweep exists to avoid (see analysis-segments.md).
"""

from __future__ import annotations

import csv
from dataclasses import replace
from itertools import product
from pathlib import Path
import sys
from typing import Any

import numpy as np


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
SOURCE_ROOT = RESEARCH_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from modules.ingest.algorithms import load_export  # noqa: E402
from modules.kinematics.algorithms.angular import omega_deg_s  # noqa: E402
from modules.metrics.algorithms.peek import PeekWindow, build_peek_windows  # noqa: E402
from modules.metrics.algorithms.phase import (  # noqa: E402
    DEFAULT_PHASE_PARAMS,
    PhaseParams,
    phase_decompose,
)
from modules.segments.algorithms import SEG_V2_PARAMS, segment_submovements  # noqa: E402


OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

#: T0/D-30.2 frozen real-data roster for WP-30 -- identical to T1's FIXTURES tuple.
REAL_FIXTURES = (
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    EXPORT_DIR / "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
)

#: T0 Section 3.1 pre-registered "degenerate" vocabulary for the 90% real-data gate. non_uniform_dt
#: is deliberately excluded: it is additive/diagnostic (D-29.5 inclusion rule), it does not null
#: rec_ms/mr_ms/v_ms.
DEGENERATE_FLAGS = frozenset(
    {"window_too_short", "no_primary_flick", "no_first_shot", "filter_degenerate", "anchor_before_onset"}
)

_TICK_MS = 1000.0 / 128.0


def _pulse_profile(length: int, pulses: tuple[tuple[int, int, float], ...]) -> np.ndarray:
    values = np.zeros(length, dtype=float)
    for start, end, amplitude in pulses:
        phase = np.linspace(0.0, np.pi, end - start + 1)
        values[start : end + 1] = np.maximum(values[start : end + 1], amplitude * np.sin(phase))
    values[0] = np.nan
    return values


#: Same three profiles that froze seg-v2 (test_submovement.py / analysis-segments.md).
_PROFILES = {
    "single_flick": (48, ((10, 26, 720.0),)),
    "flick_plus_one_micro": (64, ((6, 20, 720.0), (34, 44, 360.0))),
    "flick_plus_three_micro": (
        88,
        ((4, 18, 720.0), (28, 38, 390.0), (48, 58, 360.0), (68, 78, 330.0)),
    ),
}


def _fake_peek(t_visible: float, t_first_shot: float | None) -> PeekWindow:
    return PeekWindow(
        index=0,
        target_id="sweep",
        side="R",
        t_visible=t_visible,
        t_end=float("inf"),
        t_counter=None,
        counter_key=None,
        t_release=None,
        release_key=None,
        t_first_shot=t_first_shot,
        fires=(),
        t_hit=None,
        outcome="timeout" if t_first_shot is None else "hit",
        ads=False,
        flags=(),
        tick_slice=slice(0, 0),
    )


def synthetic_cases() -> tuple[dict[str, Any], ...]:
    cases = []
    for name, (length, pulses) in _PROFILES.items():
        omega = _pulse_profile(length, pulses)
        tick_times = np.arange(length, dtype=float) * _TICK_MS
        ticks_frame = _ticks_frame(tick_times)
        segments = segment_submovements(omega, SEG_V2_PARAMS)
        primary = next(segment for segment in segments if segment.kind == "primary_flick")
        for with_first_shot in (True, False):
            t_first_shot = tick_times[-1] if with_first_shot else None
            cases.append(
                {
                    "name": f"{name}-{'with' if with_first_shot else 'no'}-first-shot",
                    "peek": _fake_peek(0.0, t_first_shot),
                    "omega": omega,
                    "ticks": ticks_frame,
                    "segments": segments,
                    "expected_start": tick_times[primary.start_idx],
                    "expected_end": tick_times[primary.end_idx],
                }
            )
    return tuple(cases)


def _ticks_frame(tick_times: np.ndarray):
    import pandas as pd

    return pd.DataFrame({"t": tick_times})


def candidate_params() -> list[PhaseParams]:
    return [
        PhaseParams(cutoff_hz=cutoff, butter_order=order, min_window_ticks=min_ticks, version="sweep")
        for cutoff, order, min_ticks in product((8.0, 12.0, 16.0), (2, 4), (24, 30, 40))
    ]


def _dimension_one(params: PhaseParams) -> dict[str, Any]:
    failures = 0
    for case in synthetic_cases():
        sample = phase_decompose(case["peek"], case["omega"], case["ticks"], case["segments"], params)
        if sample.t_onset != case["expected_start"] or sample.t_mr_end != case["expected_end"]:
            failures += 1
    return {"synthetic_case_failures": failures}


def _dimension_two(params: PhaseParams) -> dict[str, Any]:
    non_degenerate = 0
    total = 0
    for path in REAL_FIXTURES:
        export = load_export(path)
        ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
        for peek in build_peek_windows(export):
            window_ticks = ticks.iloc[peek.tick_slice].reset_index(drop=True)
            omega = omega_deg_s(window_ticks, strict=True).values
            raw_segments = segment_submovements(omega[1:], SEG_V2_PARAMS) if len(omega) > 1 else []
            segments = [
                replace(segment, start_idx=segment.start_idx + 1, end_idx=segment.end_idx + 1, peek_index=peek.index)
                for segment in raw_segments
            ]
            sample = phase_decompose(peek, omega, window_ticks, segments, params)
            total += 1
            if not (set(sample.flags) & DEGENERATE_FLAGS):
                non_degenerate += 1
    return {
        "real_peek_count": total,
        "real_non_degenerate_count": non_degenerate,
        "real_non_degenerate_rate": non_degenerate / total if total else 0.0,
    }


def _score(params: PhaseParams) -> dict[str, Any]:
    dim1 = _dimension_one(params)
    dim2 = _dimension_two(params)
    passes = dim1["synthetic_case_failures"] == 0 and dim2["real_non_degenerate_rate"] >= 0.90
    return {
        "cutoff_hz": params.cutoff_hz,
        "butter_order": params.butter_order,
        "min_window_ticks": params.min_window_ticks,
        **dim1,
        **dim2,
        "passes": passes,
        "is_frozen_candidate": _same_numeric_params(params, DEFAULT_PHASE_PARAMS),
    }


def _same_numeric_params(left: PhaseParams, right: PhaseParams) -> bool:
    return (left.cutoff_hz, left.butter_order, left.min_window_ticks) == (
        right.cutoff_hz,
        right.butter_order,
        right.min_window_ticks,
    )


def run() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [_score(params) for params in candidate_params()]
    rows.sort(
        key=lambda row: (
            not row["passes"],
            row["synthetic_case_failures"],
            -row["real_non_degenerate_rate"],
            not row["is_frozen_candidate"],
            row["min_window_ticks"],
            row["butter_order"],
            row["cutoff_hz"],
        )
    )
    output = OUTPUT_DIR / "phase-sweep.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=tuple(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    selected = next(row for row in rows if row["is_frozen_candidate"])
    if not selected["passes"]:
        raise RuntimeError(f"frozen phase-v1 candidate failed the dual-dimension gate: {selected}")
    return output


def main() -> None:
    output = run()
    print(output)


if __name__ == "__main__":
    main()
