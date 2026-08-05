from __future__ import annotations

import ast
import os
from pathlib import Path
import subprocess
import sys


def test_angular_import_has_no_output_plotting_or_cwd_writes(tmp_path) -> None:
    source_root = Path(__file__).resolve().parents[4]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; "
        "import modules.kinematics.algorithms.angular; "
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


def test_research_python_has_no_typescript_dependencies() -> None:
    source_root = Path(__file__).resolve().parents[4]
    forbidden_suffixes = ("." + "ts", "." + "tsx")

    for path in source_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        imported = [node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
        imported.extend(alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names)
        assert all(module is None or not module.endswith(forbidden_suffixes) for module in imported), path
        string_paths = [
            node.value
            for node in ast.walk(tree)
            if isinstance(node, ast.Constant) and isinstance(node.value, str)
        ]
        assert all(not any(suffix in value for suffix in forbidden_suffixes) for value in string_paths), path
