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
    / "t4"
    / "generate_promoted_curve_golden.py"
)
GOLDEN_DIR = RESEARCH_ROOT / "fixtures" / "golden"
EXPORT_DIR = RESEARCH_ROOT / "fixtures" / "exports"

CURVE_FIXTURES = (
    "counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json",
    "counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json",
    "counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json",
    "synthetic_counterstrafe.json",
)


def test_committed_curve_fixtures_match_generator() -> None:
    generator = _load_generator()

    for fixture in CURVE_FIXTURES:
        actual = generator.curve_payload(EXPORT_DIR / fixture)
        expected = _load_json(GOLDEN_DIR / f"curve-{Path(fixture).stem}.json")
        assert actual == expected


def test_real_curve_fixtures_keep_pre_registered_counts() -> None:
    for fixture in CURVE_FIXTURES[:3]:
        expected = _load_json(GOLDEN_DIR / f"curve-{Path(fixture).stem}.json")
        for signal in ("omega", "epsilon"):
            assert expected["aggregate"][signal]["left"]["n"] == 10
            assert expected["aggregate"][signal]["right"]["n"] == 10
        assert expected["flagCounts"] == {}


def _load_generator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("generate_promoted_curve_golden", GENERATOR_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
