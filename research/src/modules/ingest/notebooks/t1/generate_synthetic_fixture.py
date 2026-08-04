"""Regenerate the committed T1 schema v2 fixture."""

from __future__ import annotations

import json
from pathlib import Path
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from modules.ingest.algorithms.synthetic import SyntheticSpec, make_synthetic_export  # noqa: E402


def main() -> None:
    output = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"
    payload = make_synthetic_export(SyntheticSpec())
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
