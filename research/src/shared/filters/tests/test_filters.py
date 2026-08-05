from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import pytest

from shared.filters import butter_filter, sg_filter


def test_sg_filter_preserves_quadratic_signal() -> None:
    x = np.arange(9, dtype=float) ** 2

    np.testing.assert_allclose(sg_filter(x, window=7, poly=2), x, atol=1e-12)


@pytest.mark.parametrize(
    ("x", "window", "poly", "message"),
    [
        ([1.0, 2.0, 3.0], 5, 2, "fewer than window"),
        ([1.0] * 7, 4, 2, "positive odd integer"),
        ([1.0] * 7, 7, 7, "less than window"),
        ([1.0, np.nan, 3.0], 3, 1, "finite values"),
    ],
)
def test_sg_filter_rejects_degenerate_inputs(
    x: list[float], window: int, poly: int, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        sg_filter(x, window=window, poly=poly)


def test_butter_filter_is_zero_phase_and_attenuates_high_frequency() -> None:
    fs = 128.0
    t = np.arange(256, dtype=float) / fs
    low = np.sin(2 * np.pi * 2 * t)
    high = 0.5 * np.sin(2 * np.pi * 40 * t)

    filtered = butter_filter(low + high, cutoff_hz=10.0, fs=fs, order=4)

    assert np.sqrt(np.mean((filtered - low) ** 2)) < 0.05
    assert np.argmax(filtered[16:48]) + 16 == np.argmax(low[16:48]) + 16


@pytest.mark.parametrize(
    ("x", "cutoff_hz", "fs", "order", "message"),
    [
        ([1.0] * 64, 64.0, 128.0, 4, "below the Nyquist"),
        ([1.0] * 64, 0.0, 128.0, 4, "positive finite"),
        ([1.0] * 64, 10.0, 128.0, 0, "positive integer"),
        ([1.0] * 8, 10.0, 128.0, 4, "requires more than"),
    ],
)
def test_butter_filter_rejects_degenerate_inputs(
    x: list[float], cutoff_hz: float, fs: float, order: int, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        butter_filter(x, cutoff_hz=cutoff_hz, fs=fs, order=order)


def test_filter_import_has_no_output_plotting_or_cwd_writes(tmp_path: Path) -> None:
    source_root = Path(__file__).resolve().parents[3]
    env = os.environ.copy()
    env["PYTHONPATH"] = str(source_root)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    command = (
        "import sys; import shared.filters; "
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
