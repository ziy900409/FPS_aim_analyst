"""WP-61 T2: C-D1 and C-D2 enforced by scan, not by convention.

* **C-D1** -- ``research/`` reads exported JSON and committed golden/parity fixtures only; it must
  not import any TypeScript module. The single Stage 1 definition lives on the TS side (D-61.P4),
  and the moment Python grows a second one, T3's ablation stops being attributable.
* **C-D2** -- ``algorithms/`` must not plot, print, or write files. Rendering and output belong in
  ``notebooks/``.

Both are cheap to state and easy to violate by accident, which is exactly why they are tested.
"""

from __future__ import annotations

import ast
import os
from pathlib import Path
import subprocess
import sys


LIFT_ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS = LIFT_ROOT / "algorithms"


def _algorithm_sources() -> list[Path]:
    return sorted(path for path in ALGORITHMS.rglob("*.py") if "tests" not in path.parts)


def test_the_package_has_algorithm_sources_to_scan() -> None:
    # A scan over zero files passes vacuously -- the worst kind of green.
    assert len(_algorithm_sources()) >= 2


def test_no_module_under_lift_references_a_typescript_module(tmp_path) -> None:
    # The needles are assembled rather than written literally, for the same reason
    # ``modules/kinematics/algorithms/tests/test_purity.py`` does it: that test scans **every** .py
    # under research/src for a ".ts" substring in any string constant, so a C-D1 scanner that spells
    # its own needles out would trip the repo-wide C-D1 scanner. (It did, on the first full run.)
    extension = "." + "ts"
    forbidden = ("from src.", "import src.", f"{extension}'", f'{extension}"', "src/metrics", "src/data")

    offenders: list[str] = []
    for path in sorted(LIFT_ROOT.rglob("*.py")):
        if path.name == Path(__file__).name:
            continue
        text = path.read_text(encoding="utf-8")
        for needle in forbidden:
            if needle in text:
                offenders.append(f"{path.relative_to(LIFT_ROOT)}: {needle!r}")

    assert offenders == [], offenders


def test_algorithms_do_not_print_or_write_files() -> None:
    banned_calls = {"print", "open", "savefig", "to_csv", "to_json", "write_text", "write_bytes"}

    offenders: list[str] = []
    for path in _algorithm_sources():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", None)
            # ``read_text`` is allowed (loader.py precedent: reads are how a fixture gets in);
            # every write and every print is not.
            if name in banned_calls:
                offenders.append(f"{path.name}:{node.lineno} calls {name}()")

    assert offenders == [], offenders


def test_importing_the_algorithms_pulls_in_no_plotting_and_touches_no_cwd(tmp_path) -> None:
    source_root = LIFT_ROOT.parent
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; "
        "import lift.algorithms.golden; "
        "import lift.algorithms.candidates; "
        "assert not any(name == 'matplotlib' or name.startswith('matplotlib.') for name in sys.modules)"
    )

    completed = subprocess.run(
        [sys.executable, "-c", command],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout == ""
    assert list(tmp_path.iterdir()) == []
