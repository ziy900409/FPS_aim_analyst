"""WP-61 T3: run the four-layer separability ablation and emit the verdict.

    uv run python src/lift/notebooks/t3/run_ablation.py --pair <golden.json>=<export.json> [--pair ...]
    uv run python src/lift/notebooks/t3/run_ablation.py --pair ... --out out --seed 61

Each pair names a committed Stage 1 golden and the export it was cut from. Both are needed and they
do different jobs: the golden owns the segmentation and the operator's annotations, the export owns
``dx`` / ``dy``. They are checked against each other before anything is computed -- a golden read
against the wrong export would index every boundary window into a different recording and produce
numbers that look entirely reasonable.

Writes ``lift-ablation-results.csv`` and ``lift-ablation-report.md`` under ``out/`` (git-ignored:
derived from participant exports). The report carries no wall clock, so two runs at the same seed
produce byte-identical files; the elapsed time goes to stdout and to ``lift-ablation-timing.txt``,
which is deliberately not part of the hashed artefact.

**No plots.** T3 step 9 says any figure belongs here rather than in ``algorithms/``, and that rule is
honoured by this file's location -- but the repository has no plotting dependency, and a
distribution plot of a cohort that does not exist yet would be a picture of nothing. When there is a
real cohort, the figures belong beside this script.

I/O lives here, not in ``algorithms/`` (C-D2).
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import sys
import time


RESEARCH_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from lift.algorithms import pa_parameters  # noqa: E402
from lift.algorithms.ablation import (  # noqa: E402
    BOOTSTRAP_RESAMPLES,
    BOOTSTRAP_SEED,
    LayerResult,
    assess_sufficiency,
    bootstrap_f1_interval,
    decide,
    evaluate_layers,
    fit_layers,
    score_candidates,
    select,
    split_sessions,
    stage_2_reachability,
    THETA_SWEEP,
    WINDOW_SWEEP,
)
from lift.algorithms.features import assert_block_matches_golden, load_sample_block  # noqa: E402
from lift.algorithms.golden import load_lift_golden  # noqa: E402

import pandas as pd  # noqa: E402


RESULT_COLUMNS = (
    "theta_ms",
    "window_ms",
    "layer",
    "split",
    "rule",
    "true_positive",
    "false_positive",
    "false_negative",
    "true_negative",
    "precision",
    "recall",
    "f1",
    "pause_false_positive_rate",
    "oneshot_false_positive_rate",
    "background_false_positives",
    "f1_gain_over_previous_layer",
    "candidate_count",
)


def _row(result: LayerResult) -> dict[str, object]:
    matrix = result.matrix
    return {
        "theta_ms": result.theta_ms,
        "window_ms": result.window_ms,
        "layer": result.layer,
        "split": result.split,
        "rule": result.rule.describe(),
        "true_positive": matrix.true_positive,
        "false_positive": matrix.false_positive,
        "false_negative": matrix.false_negative,
        "true_negative": matrix.true_negative,
        "precision": matrix.precision,
        "recall": matrix.recall,
        "f1": matrix.f1,
        "pause_false_positive_rate": result.pause_false_positive_rate,
        "oneshot_false_positive_rate": result.oneshot_false_positive_rate,
        "background_false_positives": result.background_false_positives,
        "f1_gain_over_previous_layer": result.f1_gain_over_previous_layer,
        "candidate_count": result.candidate_count,
    }


def _number(value: float | None, digits: int = 4) -> str:
    return "n/a" if value is None else f"{value:.{digits}f}"


def _median_sample_spacing_ms(dt_us: tuple[int, ...]) -> float:
    intervals = sorted(value for value in dt_us[1:] if value > 0)
    if not intervals:
        return float("nan")
    middle = len(intervals) // 2
    if len(intervals) % 2:
        return intervals[middle] / 1000
    return (intervals[middle - 1] + intervals[middle]) / 2000


def build_report(goldens, results, verdict, spacing_ms: float) -> str:
    lines: list[str] = []
    add = lines.append

    add("# WP-61 T3 -- separability ablation")
    add("")
    add(f"Contract: `{pa_parameters.SOURCE_REPOSITORY}` parameters audited at `{pa_parameters.AUDITED_AT_HEAD[:12]}`.")
    add(f"Bootstrap seed `{BOOTSTRAP_SEED}`, {BOOTSTRAP_RESAMPLES} resamples. No wall clock is recorded here.")
    add("")

    add("## Verdict")
    add("")
    add(f"**`{verdict.verdict}`** -- {verdict.reason}")
    add("")
    add(
        "Claim ceiling (OQ-61.6): whatever this run says holds for **this operator, this hardware "
        "and this drill only**, is `research_only`, and does not reach a coach report (C-D3). A "
        "`blocked-by-data` or `annotation-channel-unusable` verdict is not a statement about "
        "separability at all -- the layers below were computed but decide nothing."
    )
    add("")

    add("## Decision rule, applied literally")
    add("")
    add("| frozen rule | actual | verdict |")
    add("|---|---|---|")
    for check in verdict.checks:
        add(f"| {check.rule} | {check.actual} | {'pass' if check.passed else 'FAIL'} |")
    add("")

    add("## Cohort")
    add("")
    add("| run | session | class | annotations | samples |")
    add("|---|---|---|---:|---:|")
    for golden in goldens:
        add(
            f"| {golden.run_id} | {golden.session_id} | {golden.instruction_class} "
            f"| {len(golden.annotation_intervals)} | {golden.sample_count} |"
        )
    add("")

    add("## Reference parameter carry-across (FR-61.10)")
    add("")
    add(
        f"Config `{pa_parameters.SOURCE_CONFIG}` at `{pa_parameters.SOURCE_CONFIG_COMMIT[:12]}`; "
        f"implementation `{pa_parameters.SOURCE_IMPLEMENTATION}` at "
        f"`{pa_parameters.SOURCE_IMPLEMENTATION_COMMIT[:12]}`; decision record "
        f"`{pa_parameters.SOURCE_DECISION_RECORD}` at `{pa_parameters.SOURCE_DECISION_RECORD_COMMIT[:12]}`."
    )
    add("")
    add("| parameter | source value | name claims | actually applied in | value used here | basis |")
    add("|---|---:|---|---|---:|---|")
    for record in pa_parameters.REFERENCE_PARAMETERS:
        add(
            f"| `{record.name}` | {record.source_value:g} | {record.declared_space} | {record.source_space} "
            f"| {record.counts_space_value:g} | {record.basis} |"
        )
    add("")
    add("Deliberately not ported:")
    add("")
    for name, reason in pa_parameters.NOT_PORTED.items():
        add(f"- `{name}` -- {reason}")
    add("")

    reachability = stage_2_reachability(spacing_ms)
    add("## Stage 2 reachability at this cohort's sample spacing")
    add("")
    add(f"Median sample spacing: **{spacing_ms:.3f} ms**.")
    add("")
    add("| branch | speed change required to fire | largest change the start-speed gate permits | can fire |")
    add("|---|---:|---:|---|")
    add(
        f"| landing | {reachability.landing_required_speed_change:.1f} counts/s "
        f"| {reachability.largest_possible_speed_change:.1f} counts/s "
        f"| {'yes' if reachability.landing_reachable else 'NO'} |"
    )
    add(
        f"| takeoff | {reachability.takeoff_required_speed_change:.1f} counts/s "
        f"| {reachability.largest_possible_speed_change:.1f} counts/s "
        f"| {'yes' if reachability.takeoff_reachable else 'NO'} |"
    )
    add("")
    if not reachability.reachable:
        add(
            "Neither branch can fire at this spacing: firing needs a speed change larger than the "
            "acceleration threshold times dt, while the start-speed gate caps how large that change "
            "can be, and at this dt the first number exceeds the second. **Layer 3's gain is "
            "therefore structurally zero here** -- which is a different finding from the boundaries "
            "genuinely looking alike, and must not be reported as one."
        )
        add("")

    add("## Data sufficiency (NFR-61.7)")
    add("")
    add("| frozen floor | actual | verdict |")
    add("|---|---|---|")
    for check in verdict.sufficiency.checks:
        add(f"| {check.rule} | {check.actual} | {'pass' if check.passed else 'FAIL'} |")
    add("")

    add("## Ablation")
    add("")
    add("| theta | window | layer | split | TP | FP | FN | TN | precision | recall | F1 | pause FPR | oneshot FPR | background FP | F1 gain | n |")
    add("|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for result in results:
        matrix = result.matrix
        add(
            f"| {result.theta_ms:g} | {result.window_ms:g} | {result.layer} | {result.split} "
            f"| {matrix.true_positive} | {matrix.false_positive} | {matrix.false_negative} | {matrix.true_negative} "
            f"| {_number(matrix.precision)} | {_number(matrix.recall)} | {_number(matrix.f1)} "
            f"| {_number(result.pause_false_positive_rate)} | {_number(result.oneshot_false_positive_rate)} "
            f"| {result.background_false_positives} | {_number(result.f1_gain_over_previous_layer)} "
            f"| {result.candidate_count} |"
        )
    add("")
    add(
        "Every cell is reported for both splits. A wide calibration-to-held-out gap is evidence of "
        "overfitting (F4), and `n/a` means a denominator was empty -- never that a rate was zero."
    )
    add("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="WP-61 T3 separability ablation")
    parser.add_argument(
        "--pair",
        action="append",
        default=[],
        required=True,
        metavar="GOLDEN=EXPORT",
        help="a committed Stage 1 golden and the export it was cut from (repeatable)",
    )
    parser.add_argument("--out", default=str(RESEARCH_ROOT / "out"), help="output directory (git-ignored)")
    parser.add_argument("--seed", type=int, default=BOOTSTRAP_SEED, help="bootstrap seed, written into the report")
    args = parser.parse_args()

    started = time.perf_counter()

    goldens = []
    blocks = {}
    for entry in args.pair:
        if "=" not in entry:
            print(f"--pair expects GOLDEN=EXPORT, got {entry!r}")
            return 2
        golden_path, export_path = entry.split("=", 1)
        golden = load_lift_golden(Path(golden_path))
        block = load_sample_block(Path(export_path))
        mismatches = assert_block_matches_golden(block, golden)
        if mismatches:
            print(f"{golden.run_id}: golden and export are not the same recording")
            for mismatch in mismatches:
                print(f"  {mismatch}")
            return 1
        goldens.append(golden)
        blocks[golden.run_id] = block

    goldens = tuple(goldens)
    calibration_sessions, held_out_sessions = split_sessions(goldens)

    results: list[LayerResult] = []
    paired: list[tuple[LayerResult, LayerResult]] = []
    for window_ms in WINDOW_SWEEP:
        scored = score_candidates(goldens, blocks, window_ms)
        for theta_ms in THETA_SWEEP:
            at_theta = tuple(row for row in scored if row.theta_ms == theta_ms)
            calibration = select(at_theta, calibration_sessions)
            held_out = select(at_theta, held_out_sessions)

            rules = fit_layers(calibration, theta_ms)
            calibration_results = evaluate_layers(calibration, rules, theta_ms, window_ms, "calibration")
            held_out_results = evaluate_layers(held_out, rules, theta_ms, window_ms, "held-out")

            results.extend(calibration_results)
            results.extend(held_out_results)
            paired.extend(zip(calibration_results, held_out_results))

    sufficiency = assess_sufficiency(goldens, held_out_sessions)
    verdict = decide(sufficiency, tuple(paired))

    spacings = [_median_sample_spacing_ms(golden.dt_us) for golden in goldens]
    spacing_ms = sum(spacings) / len(spacings) if spacings else float("nan")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame([_row(result) for result in results], columns=list(RESULT_COLUMNS))
    frame.to_csv(out_dir / "lift-ablation-results.csv", index=False, lineterminator="\n")

    report_path = out_dir / "lift-ablation-report.md"
    report = build_report(goldens, results, verdict, spacing_ms)
    report_path.write_text(report + "\n", encoding="utf-8")

    elapsed = time.perf_counter() - started
    (out_dir / "lift-ablation-timing.txt").write_text(
        f"full evaluation: {elapsed:.2f} s over {len(goldens)} runs, "
        f"{len(WINDOW_SWEEP)} windows x {len(THETA_SWEEP)} thetas x 4 layers x 2 splits\n",
        encoding="utf-8",
    )

    digest = hashlib.sha256(report_path.read_bytes()).hexdigest()

    print(f"verdict: {verdict.verdict} -- {verdict.reason}")
    print(f"sessions: {sufficiency.sessions} (calibration {calibration_sessions}, held-out {held_out_sessions})")
    print(f"lift intervals {sufficiency.lift_intervals}, pause intervals {sufficiency.pause_intervals}")
    print(f"rows: {len(results)}; report sha256 {digest}")
    print(f"seed {args.seed}; full evaluation {elapsed:.2f} s")
    print(f"wrote 3 files to {out_dir}")

    # Held-out interval is reported only when there is a held-out set to resample.
    if held_out_sessions and paired:
        interval = bootstrap_f1_interval(
            select(tuple(row for row in score_candidates(goldens, blocks, WINDOW_SWEEP[0])
                         if row.theta_ms == THETA_SWEEP[0]), held_out_sessions),
            paired[0][1].rule,
            seed=args.seed,
        )
        print(f"held-out F1 95% interval (layer 1, first cell): [{_number(interval.low)}, {_number(interval.high)}]")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
