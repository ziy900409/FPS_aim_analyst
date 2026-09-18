"""Track P extraction over the whole mouse x grip cohort.

    uv run python src/mousegrip/notebooks/run_cohort.py
    uv run python src/mousegrip/notebooks/run_cohort.py --participants S01 --out out/mousegrip-s01

Reads every `spider-shot-wide-v1` export under ``data/BQC-test/DKMouse/<participant>/`` and writes
``quality_ledger.csv``, ``trial_metrics.csv``, ``run_metrics.csv`` and ``matched_pairs.csv``.
I/O lives here, not in ``algorithms/`` (C-D2). Never imports TS (C-D1).

Condition cells come from the folder tree, but the *grip* of the GPW1 cell does not: GPW1 has no
grip sub-folder, and a grip guessed from a path is how one label ends up meaning two different
things. It is therefore recorded as ``unrecorded`` for every participant whose grip the study
owner has not confirmed -- currently everyone except S01 (confirmed 1-2-2).

Runs stay in the ledger whatever happens to them. Only a hard-gate blocker -- a technical
failure -- withholds a run from the comparison. A settings change inside one participant's
session is handled at the level of the **contrast** instead: if they played one condition at a
different sensitivity or viewport, the two factors are confounded and only the contrasts
spanning that change are spoiled, while every run remains a valid measurement of what it
actually recorded.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys

RESEARCH_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from mousegrip.algorithms.pilot import (  # noqa: E402
    MECHANISM_COLUMNS,
    MECHANISM_COVERAGE_FLOOR,
    RunExtract,
    admissible_mechanism_columns,
    common_prefix_length,
    contrast_comparability,
    extract_run,
    index_mechanism,
    kaplan_meier,
    match_prefix,
    mechanism_coverage,
    mechanism_key,
)

REPO_ROOT = RESEARCH_ROOT.parent

#: condition_id -> (folder under the participant root, mouse, grip label).
CELLS: dict[str, tuple[str, str, str]] = {
    "A": ("GPW1", "GPW1", "GRIP"),
    "B": ("DK/1-2-2", "DK", "1-2-2"),
    "C": ("DK/1-3-1", "DK", "1-3-1"),
}

#: Participants whose GPW1 grip the study owner has confirmed. Everyone else gets ``unrecorded``.
CONFIRMED_GPW1_GRIP: dict[str, str] = {"S01": "1-2-2"}

CONTRASTS = [("A", "B"), ("B", "C"), ("A", "C")]


def load_participant(root: Path, participant: str) -> list[RunExtract]:
    runs: list[RunExtract] = []
    for condition_id, (folder, mouse, grip_label) in CELLS.items():
        grip = CONFIRMED_GPW1_GRIP.get(participant, "unrecorded") if grip_label == "GRIP" else grip_label
        paths = sorted((root / participant / folder).glob("spider-shot-wide-v1-*.json"))
        cell_runs = []
        for path in paths:
            payload = json.loads(path.read_text(encoding="utf-8"))
            cell_runs.append(
                extract_run(
                    payload,
                    # Identical to the TS extractor's `run_id` (path relative to the cohort
                    # root, POSIX separators), so the two sides join on equality rather than
                    # on a timestamp fished out of a filename.
                    run_id=f"{participant}/{folder}/{path.name}",
                    condition_id=condition_id,
                    mouse=mouse,
                    grip=grip,
                    rep=0,
                )
            )
        cell_runs.sort(key=lambda r: r.started_at)
        runs.extend(
            RunExtract(**{**run.__dict__, "rep": rep}) for rep, run in enumerate(cell_runs, start=1)
        )
    return runs


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
    parser.add_argument("--data", default=str(REPO_ROOT / "data/BQC-test/DKMouse"))
    parser.add_argument("--participants", nargs="*", default=None)
    parser.add_argument("--out", default=str(RESEARCH_ROOT / "out/mousegrip-cohort"))
    parser.add_argument(
        "--mechanism",
        default=None,
        help="mechanism_metrics.csv from `npm run analyze:spider-wide-mech` (TS side, C-D4)",
    )
    args = parser.parse_args()

    root = Path(args.data)
    out = Path(args.out)

    # The mechanism constructs are derived in TypeScript and joined here on (run_id, target_id);
    # this side never recomputes one. No file given = the columns simply do not appear.
    mechanism: dict[tuple[str, str], dict[str, str]] = {}
    if args.mechanism:
        with Path(args.mechanism).open(encoding="utf-8") as handle:
            mechanism = index_mechanism(csv.DictReader(handle))
    participants = args.participants or sorted(
        p.name for p in root.iterdir() if p.is_dir() and p.name.startswith("S")
    )

    by_participant: dict[str, list[RunExtract]] = {
        participant: load_participant(root, participant) for participant in participants
    }
    all_runs = [run for runs in by_participant.values() for run in runs]

    def admitted(run: RunExtract) -> bool:
        """Only a technical failure withholds a run. A settings change spoils contrasts, not
        measurements, so it is handled per contrast below."""
        return not run.quality.blockers

    # Which contrasts each participant can actually support, and why not when they cannot.
    comparability: dict[tuple[str, str, str], tuple[str, ...]] = {}
    for participant, runs in by_participant.items():
        ok = [r for r in runs if admitted(r)]
        for left_id, right_id in CONTRASTS:
            left = [r for r in ok if r.condition_id == left_id]
            right = [r for r in ok if r.condition_id == right_id]
            if not left or not right:
                comparability[(participant, left_id, right_id)] = ("cell missing",)
                continue
            comparability[(participant, left_id, right_id)] = contrast_comparability(left, right)

    # --- quality ledger ---------------------------------------------------------------
    write_csv(out / "quality_ledger.csv", [
        {
            "participant": run.run_id.split("/")[0],
            "run_id": run.run_id,
            "condition_id": run.condition_id,
            "mouse": run.mouse,
            "grip": run.grip,
            "rep": run.rep,
            "started_at": run.started_at,
            "sensitivity": run.sensitivity,
            "dpi": run.dpi,
            "fov_deg": run.fov_deg,
            "display_css": run.display_css,
            "fullscreen": run.fullscreen,
            "display_hz": run.display_hz,
            "seed": run.seed,
            "raw_duration_ms": round(run.timing.raw_duration_ms, 1),
            "active_duration_ms": round(run.timing.active_duration_ms, 1),
            "post_task_trim_ms": round(run.timing.post_task_trim_ms, 1),
            "trim_reasons": "|".join(run.timing.trim_reasons),
            "validity_flags": "|".join(run.quality.validity_flags),
            "suspect": run.quality.suspect,
            "late_event_count": run.quality.late_event_count,
            "aim_update_ratio": round(run.quality.aim_update_ratio, 4),
            "blockers": "|".join(run.quality.blockers),
            "admitted": admitted(run),
        }
        for run in all_runs
    ])

    # --- trial + run metrics ----------------------------------------------------------
    trial_rows = []
    run_rows = []
    prefix_by_participant = {
        p: common_prefix_length([r for r in runs if admitted(r)])
        for p, runs in by_participant.items()
    }
    for run in all_runs:
        participant = run.run_id.split("/")[0]
        prefix = prefix_by_participant.get(participant, 0)
        for p in run.presentations:
            trial_rows.append({
                "participant": participant,
                "run_id": run.run_id,
                "condition_id": run.condition_id,
                "mouse": run.mouse,
                "grip": run.grip,
                "rep": run.rep,
                "admitted": admitted(run),
                "presentation_index": p.presentation_index,
                "target_id": p.target_id,
                "in_matched_prefix": p.presentation_index <= prefix,
                "side": p.side,
                "stimulus_key": "|".join(str(v) for v in p.stimulus_key),
                "t_visible_ms": round(p.t_visible_ms, 3),
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
                **({
                    column.name: mechanism.get(
                        mechanism_key(run.run_id, p.target_id), {}
                    ).get(column.name, "")
                    for column in MECHANISM_COLUMNS
                } if mechanism else {}),
            })

        km = kaplan_meier((p.observed_ms, p.event_observed) for p in run.presentations)
        median, p90 = km.quantile(0.5), km.quantile(0.9)
        run_rows.append({
            "participant": participant,
            "run_id": run.run_id,
            "condition_id": run.condition_id,
            "mouse": run.mouse,
            "grip": run.grip,
            "rep": run.rep,
            "admitted": admitted(run),
            "started_at": run.started_at,
            "sensitivity": run.sensitivity,
            "peripheral_presentations": run.peripheral_count,
            "centre_presentations": run.center_presentations,
            "unique_hits": run.unique_hits,
            "hits_per_min": round(run.hits_per_min, 3),
            "first_shot_hits": run.first_shot_hits,
            "first_shot_rate": round(run.first_shot_rate, 4),
            "timeouts": sum(1 for p in run.presentations if p.end_reason == "timeout"),
            "session_end": sum(1 for p in run.presentations if p.end_reason == "session_end"),
            "unresolved": sum(1 for p in run.presentations if p.end_reason == "unresolved"),
            "no_fire": sum(1 for p in run.presentations if p.fire_count == 0),
            "km_median_ms": None if median is None else round(median, 1),
            "km_p90_ms": None if p90 is None else round(p90, 1),
            "ads_down_count": run.ads_down_count,
            "ads_overlap_trials": sum(1 for p in run.presentations if p.ads_overlap),
        })
    write_csv(out / "trial_metrics.csv", trial_rows)
    write_csv(out / "run_metrics.csv", run_rows)

    # --- matched pairs, always within one participant ---------------------------------
    pair_rows = []
    for participant, runs in by_participant.items():
        prefix = prefix_by_participant[participant]
        ok = [r for r in runs if admitted(r)]
        for left_id, right_id in CONTRASTS:
            left = [r for r in ok if r.condition_id == left_id]
            right = [r for r in ok if r.condition_id == right_id]
            if not left or not right:
                continue
            if comparability[(participant, left_id, right_id)]:
                continue
            pairs, dropped = match_prefix(left, right, prefix)
            for pair in pairs:
                pair_rows.append({
                    "participant": participant,
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
                })
            if dropped:
                print(f"[pairs] {participant} {left_id}->{right_id}: dropped {len(dropped)}")
    write_csv(out / "matched_pairs.csv", pair_rows)

    # --- console summary --------------------------------------------------------------
    print(f"participants={len(by_participant)} runs={len(all_runs)} presentations={len(trial_rows)}")
    print(f"admitted runs={sum(1 for r in all_runs if admitted(r))} "
          f"blocked={sum(1 for r in all_runs if r.quality.blockers)}")
    for run in all_runs:
        if run.quality.blockers:
            print(f"  blocked {run.run_id}: {list(run.quality.blockers)}")
    if mechanism:
        joined = [row for row in trial_rows if row["admitted"]]
        matched = sum(
            1 for row in trial_rows if mechanism_key(row["run_id"], row["target_id"]) in mechanism
        )
        coverage = mechanism_coverage(joined)
        admissible, withheld = admissible_mechanism_columns(coverage)
        write_csv(out / "mechanism_coverage.csv", [
            {
                "column": column.name,
                "tier": column.tier,
                "blank_is_missing": column.blank_is_missing,
                "coverage": round(coverage[column.name], 4),
                "floor": MECHANISM_COVERAGE_FLOOR,
                "verdict": "admissible" if column.name in admissible else "withheld",
            }
            for column in MECHANISM_COLUMNS
        ])
        print(f"mechanism join: {matched}/{len(trial_rows)} presentations matched")
        for column in MECHANISM_COLUMNS:
            mark = "OK  " if column.name in admissible else "HOLD"
            print(f"  {mark} tier{column.tier} {column.name:26s} {coverage[column.name]:6.1%}")
        if withheld:
            print(f"  withheld at the {MECHANISM_COVERAGE_FLOOR:.0%} floor: {', '.join(withheld)}")
    print("\ncontrast comparability:")
    for key in sorted(comparability):
        reasons = comparability[key]
        state = "OK" if not reasons else "NOT COMPARABLE"
        print(f"  {key[0]} {key[1]}->{key[2]}: {state}" + (f"  {list(reasons)}" if reasons else ""))
    print("\nmatched prefix per participant:", prefix_by_participant)
    print(f"\nwrote CSVs to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
