from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ALGORITHMS_DIR = Path(__file__).resolve().parents[1]


def test_fitts_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    source_root = Path(__file__).resolve().parents[4]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import modules.metrics.algorithms.fitts; "
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


def test_fitts_module_does_no_file_io() -> None:
    source = (ALGORITHMS_DIR / "fitts.py").read_text(encoding="utf-8")

    for forbidden in ("open(", "read_text", "write_text", "to_csv", "read_csv", "print("):
        assert forbidden not in source, f"algorithms/ must stay pure (C-D2): found {forbidden!r}"


def test_fitts_uses_shared_angular_sources() -> None:
    source = (ALGORITHMS_DIR / "fitts.py").read_text(encoding="utf-8")

    assert "epsilon_deg" in source
    assert "_hitbox" in source
