from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ALGORITHMS_DIR = Path(__file__).resolve().parents[1]
TESTS_DIR = Path(__file__).resolve().parent
SOURCE_ROOT = Path(__file__).resolve().parents[4]

#: The external repo whose ``metrics_key_velocity_coupling_xcorr.py`` supplied the lag convention,
#: the tie-break and the ``_pearson`` semantics. It may appear in prose but never as an import
#: target or a filesystem path (C-D1).
_FOREIGN_REPO = "performance_analysis"
_FOREIGN_PACKAGE = "modules.analysis"


def test_coupling_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SOURCE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import modules.metrics.algorithms.coupling; "
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


def test_coupling_imports_nothing_from_the_source_repo(tmp_path: Path) -> None:
    """C-D1 by filesystem path, which also catches a same-named module shadowed in from elsewhere."""

    env = os.environ.copy()
    env["PYTHONPATH"] = str(SOURCE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys, json;"
        "import modules.metrics.algorithms.coupling as m;"
        "foreign = sorted("
        "  name for name, mod in list(sys.modules.items())"
        f"  if getattr(mod, '__file__', None) and {_FOREIGN_REPO!r} in mod.__file__.replace('\\\\', '/')"
        ");"
        "print(json.dumps(foreign))"
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
    assert completed.stdout.strip() == "[]", f"coupling pulled in modules from {_FOREIGN_REPO}"


def test_coupling_sources_contain_no_cross_repo_import_statement() -> None:
    """The runtime scan above cannot see an import that only fires on an untaken branch."""

    sources = [ALGORITHMS_DIR / "coupling.py", *TESTS_DIR.glob("test_coupling*.py")]
    assert len(sources) == 4  # coupling.py + test_coupling.py + _fixture + this file

    for path in sources:
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if not (stripped.startswith("import ") or stripped.startswith("from ")):
                continue
            assert _FOREIGN_REPO not in stripped, f"{path.name}:{lineno} imports from {_FOREIGN_REPO}"
            assert _FOREIGN_PACKAGE not in stripped, f"{path.name}:{lineno} imports {_FOREIGN_PACKAGE}"


def test_coupling_module_does_no_file_io() -> None:
    source = (ALGORITHMS_DIR / "coupling.py").read_text(encoding="utf-8")

    for forbidden in ("open(", "read_text", "write_text", "to_csv", "read_csv", "print("):
        assert forbidden not in source, f"algorithms/ must stay pure (C-D2): found {forbidden!r}"


def test_the_gate_never_reaches_for_a_thread_or_process_pool() -> None:
    """WP-31 README §6: parallelising the permutation null would reorder the seeded RNG's draws.

    The result would still look plausible and would no longer be reproducible, which is the one
    property ``gate-v1`` cannot trade away -- so the prohibition is asserted rather than trusted.
    """

    source = (ALGORITHMS_DIR / "coupling.py").read_text(encoding="utf-8")

    for forbidden in ("concurrent.futures", "multiprocessing", "ThreadPool", "ProcessPool", "threading"):
        assert forbidden not in source, f"gate-v1 must stay single-threaded: found {forbidden!r}"
