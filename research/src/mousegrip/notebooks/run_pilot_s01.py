"""Track P pilot run over the S01 mouse x grip cohort.

    uv run python src/mousegrip/notebooks/run_pilot_s01.py
    uv run python src/mousegrip/notebooks/run_pilot_s01.py --data <dir> --out out/mousegrip-s01

Reads the committed `spider-shot-wide-v1` exports under ``data/BQC-test/DKMouse/S01`` and writes
``quality_ledger.csv``, ``trial_metrics.csv``, ``run_metrics.csv`` and ``matched_pairs.csv``.
I/O lives here, not in ``algorithms/`` (C-D2). Never imports TS (C-D1).

The condition manifest is declared in this file rather than inferred from the folder tree: the
GPW1 runs have no grip sub-folder, and guessing a grip from a path is exactly how a label ends
up meaning two different things (final workflow S02 / §04).
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import statistics
import sys

RESEARCH_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from mousegrip.algorithms.pilot import (  # noqa: E402
    PEEK_TIMEOUT_MS,
    RunExtract,
    common_prefix_length,
    extract_run,
    kaplan_meier,
    match_prefix,
)

REPO_ROOT = RESEARCH_ROOT.parent

#: condition_id -> (folder relative to the S01 root, mouse, grip). Grip for GPW1 is confirmed by
#: the study owner, not inferred; recorded here so the claim is auditable.
MANIFEST: dict[str, tuple[str, str, str]] = {
    "A": ("GPW1", "GPW1", "1-2-2"),
    "B": ("DK/1-2-2", "DK", "1-2-2"),
    "C": ("DK/1-3-1", "DK", "1-3-1"),
}

CONTRASTS = [("A", "B"), ("B", "C"), ("A", "C")]


def load_condition(root: Path, condition_id: str) -> list[RunExtract]:
    folder, mouse, grip = MANIFEST[condition_id]
    paths = sorted((root / folder).glob("spider-shot-wide-v1-*.json"))
    runs: list[RunExtract] = []
    for rep, path in enumerate(paths, start=1):
        payload = json.loads(path.read_text(encoding="utf-8"))
        runs.append(
            extract_run(
                payload,
                run_id=path.stem,
                condition_id=condition_id,
                mouse=mouse,
                grip=grip,
                rep=rep,
            )
        )
    runs.sort(key=lambda r: r.started_at)
    return [
        RunExtract(**{**run.__dict__, "rep": rep}) for rep, run in enumerate(runs, start=1)
    ]


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default=str(REPO_ROOT / "data/BQC-test/DKMouse/S01"))
    parser.add_argument("--out", default=str(RESEARCH_ROOT / "out/mousegrip-s01"))
    args = parser.parse_args()

    root = Path(args.data)
    out = Path(args.out)

    conditions = {cid: load_condition(root, cid) for cid in MANIFEST}
    all_runs = [run for runs in conditions.values() for run in runs]
    prefix = common_prefix_length(all_runs)

    # --- quality ledger ---------------------------------------------------------------
    quality_rows = []
    for run in all_runs:
        quality_rows.append(
            {
                "run_id": run.run_id,
                "condition_id": run.condition_id,
                "mouse": run.mouse,
                "grip": run.grip,
                "rep": run.rep,
                "started_at": run.started_at,
                "seed": run.seed,
                "sensitivity": run.sensitivity,
                "dpi": run.dpi,
                "fov_deg": run.fov_deg,
                "raw_duration_ms": round(run.timing.raw_duration_ms, 1),
                "active_duration_ms": round(run.timing.active_duration_ms, 1),
                "countdown_trim_ms": round(run.timing.countdown_trim_ms, 1),
                "post_task_trim_ms": round(run.timing.post_task_trim_ms, 1),
                "trim_reasons": "|".join(run.timing.trim_reasons),
                "boundary_source": run.timing.boundary_source,
                "validity_flags": "|".join(run.quality.validity_flags),
                "suspect": run.quality.suspect,
                "late_event_count": run.quality.late_event_count,
                "aim_update_ratio": round(run.quality.aim_update_ratio, 4),
                "blockers": "|".join(run.quality.blockers),
                "notes": "; ".join(run.quality.notes),
            }
        )
    write_csv(out / "quality_ledger.csv", quality_rows)

    # --- trial + run metrics ----------------------------------------------------------
    trial_rows = []
    run_rows = []
    for run in all_runs:
        for p in run.presentations:
            trial_rows.append(
                {
                    "participant": "S01",
                    "condition_id": run.condition_id,
                    "mouse": run.mouse,
                    "grip": run.grip,
                    "rep": run.rep,
                    "run_id": run.run_id,
                    "presentation_index": p.presentation_index,
                    "in_matched_prefix": p.presentation_index <= prefix,
                    "target_id": p.target_id,
                    "side": p.side,
                    "stimulus_key": "|".join(str(v) for v in p.stimulus_key),
                    "t_visible_ms": round(p.t_visible_ms, 3),
                    "observed_until_ms": round(p.observed_until_ms, 3),
                    "full_follow_up": p.full_follow_up,
                    "first_fire_ms": None if p.first_fire_ms is None else round(p.first_fire_ms, 3),
                    "first_fire_hit": p.first_fire_hit,
                    "first_fire_offset_deg": (
                        None if p.first_fire_offset_deg is None else round(p.first_fire_offset_deg, 4)
                    ),
                    "fire_count": p.fire_count,
                    "time_to_hit_ms": None if p.time_to_hit_ms is None else round(p.time_to_hit_ms, 3),
                    "observed_ms": round(p.observed_ms, 3),
                    "event_observed": p.event_observed,
                    "end_reason": p.end_reason,
                    "ads_overlap": p.ads_overlap,
                }
            )

        km = kaplan_meier((p.observed_ms, p.event_observed) for p in run.presentations)
        run_rows.append(
            {
                "participant": "S01",
                "condition_id": run.condition_id,
                "mouse": run.mouse,
                "grip": run.grip,
                "rep": run.rep,
                "started_at": run.started_at,
                "peripheral_presentations": run.peripheral_count,
                "center_presentations": run.center_presentations,
                "unique_hits": run.unique_hits,
                "hits_per_min": round(run.hits_per_min, 3),
                "first_shot_hits": run.first_shot_hits,
                "first_shot_rate": round(run.first_shot_rate, 4),
                "timeouts": sum(1 for p in run.presentations if p.end_reason == "timeout"),
                "session_end": sum(1 for p in run.presentations if p.end_reason == "session_end"),
                "unresolved": sum(1 for p in run.presentations if p.end_reason == "unresolved"),
                "no_fire": sum(1 for p in run.presentations if p.fire_count == 0),
                "km_median_ms": None if km.quantile(0.5) is None else round(km.quantile(0.5), 1),
                "km_p90_ms": None if km.quantile(0.9) is None else round(km.quantile(0.9), 1),
                "ads_down_count": run.ads_down_count,
                "ads_overlap_trials": sum(1 for p in run.presentations if p.ads_overlap),
            }
        )
    write_csv(out / "trial_metrics.csv", trial_rows)
    write_csv(out / "run_metrics.csv", run_rows)

    # --- matched pairs ----------------------------------------------------------------
    pair_rows = []
    for left_id, right_id in CONTRASTS:
        pairs, dropped = match_prefix(conditions[left_id], conditions[right_id], prefix)
        for pair in pairs:
            pair_rows.append(
                {
                    "contrast": f"{left_id}->{right_id}",
                    "rep": pair.rep,
                    "presentation_index": pair.presentation_index,
                    "side": pair.side,
                    "left_first_shot_hit": pair.left.first_fire_hit,
                    "right_first_shot_hit": pair.right.first_fire_hit,
                    "first_shot_delta": pair.first_shot_delta,
                    "left_time_to_hit_ms": pair.left.time_to_hit_ms,
                    "right_time_to_hit_ms": pair.right.time_to_hit_ms,
                    "time_delta_ms": (
                        None if pair.time_delta_ms is None else round(pair.time_delta_ms, 3)
                    ),
                    "left_end_reason": pair.left.end_reason,
                    "right_end_reason": pair.right.end_reason,
                }
            )
        print(f"[pairs] {left_id}->{right_id}: matched={len(pairs)} dropped={len(dropped)}")
        for reason in dropped[:5]:
            print(f"         dropped: {reason}")
    write_csv(out / "matched_pairs.csv", pair_rows)

    # --- console summary --------------------------------------------------------------
    print(f"\ncommon matched prefix = {prefix} peripheral presentations per run")
    print(f"\n{'cond':5s} {'runs':4s} {'pres':5s} {'hits':5s} {'hits/min':9s} "
          f"{'1st-shot':9s} {'timeout':8s} {'sess-end':9s} {'no-fire':8s} {'ads':5s}")
    tau_candidates = []
    for cid, runs in conditions.items():
        pres = [p for r in runs for p in r.presentations]
        km = kaplan_meier((p.observed_ms, p.event_observed) for p in pres)
        tau_candidates.append(km.max_follow_up_ms)
        hits = sum(1 for p in pres if p.time_to_hit_ms is not None)
        fs = sum(1 for p in pres if p.first_fire_hit)
        minutes = sum(r.timing.active_duration_ms for r in runs) / 60000.0
        print(
            f"{cid:5s} {len(runs):<4d} {len(pres):<5d} {hits:<5d} {hits / minutes:<9.2f} "
            f"{fs / len(pres):<9.3f} "
            f"{sum(1 for p in pres if p.end_reason == 'timeout'):<8d} "
            f"{sum(1 for p in pres if p.end_reason == 'session_end'):<9d} "
            f"{sum(1 for p in pres if p.fire_count == 0):<8d} "
            f"{sum(r.ads_down_count for r in runs):<5d}"
        )

    tau = min(tau_candidates)
    print(f"\ncommon follow-up tau = {tau:.1f} ms (protocol deadline {PEEK_TIMEOUT_MS:.0f} ms)")
    print(f"\n{'cond':5s} {'n':5s} {'hits':5s} {'median':8s} {'p90':10s} {'RMST(tau)':10s}")
    for cid, runs in conditions.items():
        pres = [p for r in runs for p in r.presentations]
        km = kaplan_meier((p.observed_ms, p.event_observed) for p in pres)
        median = km.quantile(0.5)
        p90 = km.quantile(0.9)
        print(
            f"{cid:5s} {km.n:<5d} {km.events:<5d} "
            f"{median if median is None else round(median, 1):<8} "
            f"{'unestimable' if p90 is None else round(p90, 1):<10} "
            f"{km.rmst(tau):<10.1f}"
        )

    print("\nper-run detail (drift stress test input)")
    for cid, runs in conditions.items():
        for run in runs:
            print(
                f"  {cid} rep{run.rep} {run.started_at[11:19]} "
                f"pres={run.peripheral_count:2d} hits={run.unique_hits:2d} "
                f"hits/min={run.hits_per_min:5.1f} 1st={run.first_shot_rate:.3f} "
                f"ads={run.ads_down_count:2d} trim={'|'.join(run.timing.trim_reasons) or '-'}"
            )

    print("\nfirst-shot angular error (deg, direct export reading)")
    for cid, runs in conditions.items():
        errs = [
            p.first_fire_offset_deg
            for r in runs
            for p in r.presentations
            if p.first_fire_offset_deg is not None
        ]
        errs.sort()
        if errs:
            print(
                f"  {cid} n={len(errs):3d} median={statistics.median(errs):.3f} "
                f"p90={errs[int(0.9 * (len(errs) - 1))]:.3f} max={errs[-1]:.3f}"
            )

    print(f"\nwrote CSVs to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
