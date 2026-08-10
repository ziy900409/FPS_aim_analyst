from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ALGORITHMS_DIR = Path(__file__).resolve().parents[1]
TESTS_DIR = Path(__file__).resolve().parent
SOURCE_ROOT = Path(__file__).resolve().parents[4]

#: The external repo `sparc.py` is ported *from*. It may appear in prose (module docstrings, this
#: file's own explanation) but never as an import target or a filesystem path (C-D1).
_FOREIGN_REPO = "performance_analysis"
_FOREIGN_PACKAGE = "modules.analysis"


def test_sparc_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SOURCE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import modules.metrics.algorithms.sparc; "
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


def test_sparc_imports_nothing_from_the_source_repo(tmp_path: Path) -> None:
    """T1 DoD 6: pytest must be green on a machine where performance_analysis does not exist.

    Proven by import scan rather than by deleting the other repo: after importing `sparc` (and the
    tests that exercise it), no loaded module may resolve to a file outside this repository. A
    filesystem-path check is strictly stronger than a name check -- it would also catch a same-named
    module shadowed in from elsewhere on `sys.path`.
    """

    env = os.environ.copy()
    env["PYTHONPATH"] = str(SOURCE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys, json;"
        "import modules.metrics.algorithms.sparc as m;"
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
    assert completed.stdout.strip() == "[]", f"sparc pulled in modules from {_FOREIGN_REPO}"


def test_sparc_sources_contain_no_cross_repo_import_statement() -> None:
    """The runtime scan above cannot see an import that only fires on an untaken branch."""

    sources = [ALGORITHMS_DIR / "sparc.py", *TESTS_DIR.glob("test_sparc*.py")]
    assert len(sources) == 4  # sparc.py + test_sparc.py + test_sparc_fixture.py + this file

    for path in sources:
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if not (stripped.startswith("import ") or stripped.startswith("from ")):
                continue
            assert _FOREIGN_REPO not in stripped, f"{path.name}:{lineno} imports from {_FOREIGN_REPO}"
            assert _FOREIGN_PACKAGE not in stripped, f"{path.name}:{lineno} imports {_FOREIGN_PACKAGE}"


def test_only_the_one_off_generator_may_reference_the_source_repo() -> None:
    """The generator is the single sanctioned crossing point, and it is never run by pytest.

    Kept as an explicit allow-list so "which file talks to the other repo" is a one-line answer
    rather than a grep, and so a second crossing point cannot appear unnoticed.
    """

    notebooks = SOURCE_ROOT / "modules" / "metrics" / "notebooks"
    referencing = sorted(
        path.relative_to(SOURCE_ROOT).as_posix()
        for path in notebooks.rglob("*.py")
        if _FOREIGN_REPO in path.read_text(encoding="utf-8")
    )

    assert referencing == ["modules/metrics/notebooks/t1/generate_sparc_domain_golden.py"]


def test_sparc_module_does_no_file_io() -> None:
    source = (ALGORITHMS_DIR / "sparc.py").read_text(encoding="utf-8")

    for forbidden in ("open(", "read_text", "write_text", "to_csv", "read_csv", "print("):
        assert forbidden not in source, f"algorithms/ must stay pure (C-D2): found {forbidden!r}"
