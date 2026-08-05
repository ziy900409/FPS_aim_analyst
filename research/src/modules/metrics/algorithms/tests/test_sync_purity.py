from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


def test_sync_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    source_root = Path(__file__).resolve().parents[4]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import modules.metrics.algorithms.sync; "
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
