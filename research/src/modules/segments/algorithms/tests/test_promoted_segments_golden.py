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
    / "segments"
    / "notebooks"
    / "t2"
    / "generate_promoted_segments_golden.py"
)
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"


def test_committed_real_segment_fixtures_match_generator() -> None:
    generator = _load_generator()
    fixtures = (
        "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
        "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
        "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
    )

    pooled_primary = 0
    for fixture in fixtures:
        actual = generator.real_segments_payload(EXPORT_DIR / fixture)
        expected = _load_json(GOLDEN_DIR / f"segments-{Path(fixture).stem}.json")
        assert actual == expected
        pooled_primary += actual["primaryCount"]

    assert pooled_primary == 59


def test_committed_synthetic_segment_fixture_matches_generator() -> None:
    generator = _load_generator()

    actual = generator.synthetic_segments_payload()
    expected = _load_json(GOLDEN_DIR / "segments-synthetic_submovement_cases.json")

    assert actual == expected


def _load_generator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("generate_promoted_segments_golden", GENERATOR_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
