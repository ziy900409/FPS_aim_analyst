"""WP-61 T2 step 6: emit the candidate event table from committed Stage 1 goldens.

    uv run python src/lift/notebooks/t2/build_candidate_table.py                       # all goldens
    uv run python src/lift/notebooks/t2/build_candidate_table.py --golden <file.json>  # a subset
    uv run python src/lift/notebooks/t2/build_candidate_table.py --out out

Reads only committed golden JSON -- **never** the raw exports, and it does not recompute Stage 1
segmentation (D-61.P4 / C-D4). Writes ``lift-candidates.csv`` and ``lift-match-summary.csv`` under
``out/`` (git-ignored, derived from participant exports).

I/O lives here, not in ``algorithms/`` (C-D2).
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from lift.algorithms.candidates import build_candidate_table, build_match_summary  # noqa: E402
from lift.algorithms.golden import load_lift_golden  # noqa: E402

GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"


def _discover() -> list[Path]:
    return sorted(GOLDEN_DIR.glob("lift-segments-*.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--golden", action="append", default=[], help="a Stage 1 golden JSON (repeatable)")
    parser.add_argument("--out", default=str(RESEARCH_ROOT / "out"), help="output directory (git-ignored)")
    args = parser.parse_args()

    paths = [Path(entry) for entry in args.golden] if args.golden else _discover()
    if not paths:
        print(f"no lift-segments-*.json found under {GOLDEN_DIR}")
        return 1

    goldens = tuple(load_lift_golden(path) for path in paths)
    table = build_candidate_table(goldens)
    summary = build_match_summary(goldens)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    table.to_csv(out_dir / "lift-candidates.csv", index=False, lineterminator="\n")
    summary.to_csv(out_dir / "lift-match-summary.csv", index=False, lineterminator="\n")

    print(f"goldens: {len(goldens)} ({', '.join(golden.run_id for golden in goldens)})")
    for theta_ms in sorted(set(table["theta_ms"])):
        at_theta = table[table["theta_ms"] == theta_ms]
        counts = at_theta["label"].value_counts().to_dict()
        matched = int(at_theta["matched_annotation_index"].notna().sum())
        rate = "n/a" if len(at_theta) == 0 else f"{matched / len(at_theta):.2%}"
        print(f"  theta={theta_ms:g} ms: {len(at_theta)} candidates, labels {counts}, match rate {rate}")
    print(f"wrote 2 files to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
