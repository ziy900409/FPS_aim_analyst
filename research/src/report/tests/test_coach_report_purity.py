"""Layer discipline for the coach report: writes live in report/, purity lives below it.

C-D2 keeps ``algorithms/`` free of I/O and matplotlib, and the report tier is the
boundary where writing a file becomes legal -- so this is where that split gets pinned
down. C-D1 (no TypeScript dependency anywhere in ``research/``) is already enforced
repo-wide by ``modules/kinematics/algorithms/tests/test_purity.py`` and is deliberately
not re-implemented here.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


RESEARCH_ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = RESEARCH_ROOT / "src"


def _run(command: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SOURCE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, "-c", command],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_importing_the_report_writes_nothing_and_pulls_in_no_plotting(tmp_path: Path) -> None:
    completed = _run(
        "import sys; import report.coach_report; "
        "assert not any(name == 'matplotlib' or name.startswith('matplotlib.') "
        "for name in sys.modules)",
        tmp_path,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout == ""
    assert list(tmp_path.iterdir()) == []


def test_building_the_model_writes_nothing_until_generate_is_called(tmp_path: Path) -> None:
    """``build_report``/``render_html`` stay side-effect free; only ``generate`` writes."""

    fixture = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_timeline.json"
    completed = _run(
        "from report.coach_report import build_report, render_html; "
        f"html = render_html(build_report({str(fixture)!r})); "
        "assert html.startswith('<!doctype html>')",
        tmp_path,
    )

    assert completed.returncode == 0, completed.stderr
    assert list(tmp_path.iterdir()) == []


def test_algorithms_never_import_the_report_tier() -> None:
    """Dependencies point one way: report -> algorithms, never the reverse."""

    offenders = [
        path.relative_to(RESEARCH_ROOT).as_posix()
        for path in SOURCE_ROOT.rglob("modules/**/algorithms/**/*.py")
        if "import report" in path.read_text(encoding="utf-8")
        or "from report" in path.read_text(encoding="utf-8")
    ]

    assert offenders == []