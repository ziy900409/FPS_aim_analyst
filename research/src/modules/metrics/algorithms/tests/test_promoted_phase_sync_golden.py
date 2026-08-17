from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
GENERATOR_PATH = (
    RESEARCH_ROOT
    / "src"
    / "modules"
    / "metrics"
    / "notebooks"
    / "t3"
    / "generate_promoted_phase_sync_golden.py"
)
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

PHASE_FIXTURES = (
    "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
    "synthetic_counterstrafe_t1_long.json",
)

SYNC_FIXTURES = PHASE_FIXTURES + (
    "counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json",
    "counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json",
)


def test_committed_phase_fixtures_match_generator() -> None:
    generator = _load_generator()
    pooled_non_degenerate = 0

    for fixture in PHASE_FIXTURES:
        actual = generator.phase_payload(EXPORT_DIR / fixture)
        expected = _load_json(GOLDEN_DIR / f"phase-{Path(fixture).stem}.json")
        assert actual == expected
        if fixture.startswith("counterstrafe_ad_v1-2026-08-07"):
            pooled_non_degenerate += actual["nonDegenerateCount"]

    assert pooled_non_degenerate == 59


def test_committed_sync_fixtures_match_generator() -> None:
    generator = _load_generator()

    for fixture in SYNC_FIXTURES:
        actual = generator.sync_payload(EXPORT_DIR / fixture)
        expected = _load_json(GOLDEN_DIR / f"sync-{Path(fixture).stem}.json")
        assert actual == expected

    assert _load_json(GOLDEN_DIR / "sync-counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json")["unflaggedCount"] == 13
    zero_input = _load_json(GOLDEN_DIR / "sync-counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json")
    assert zero_input["aggregate"]["releaseToFireMs"]["n"] == 0
    assert zero_input["aggregate"]["verdicts"][0]["verdict"] == "blocked-by-data"


def _load_generator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("generate_promoted_phase_sync_golden", GENERATOR_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
