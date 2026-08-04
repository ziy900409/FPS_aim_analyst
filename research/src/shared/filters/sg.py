"""Savitzky-Golay smoothing with explicit input contracts."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from scipy.signal import savgol_filter


def sg_filter(x: Sequence[float] | np.ndarray, window: int, poly: int) -> np.ndarray:
    """Smooth a finite one-dimensional signal.

    Degenerate inputs raise :class:`ValueError`; callers that choose a fallback
    must make that fallback visible in their own quality flags.
    """

    values = np.asarray(x, dtype=float)
    if values.ndim != 1:
        raise ValueError("x must be a one-dimensional signal")
    if not np.all(np.isfinite(values)):
        raise ValueError("x must contain only finite values")
    if isinstance(window, bool) or not isinstance(window, int) or window <= 0 or window % 2 == 0:
        raise ValueError("window must be a positive odd integer")
    if isinstance(poly, bool) or not isinstance(poly, int) or poly < 0:
        raise ValueError("poly must be a non-negative integer")
    if poly >= window:
        raise ValueError("poly must be less than window")
    if values.size < window:
        raise ValueError(f"x has {values.size} samples, fewer than window={window}")

    return np.asarray(savgol_filter(values, window_length=window, polyorder=poly), dtype=float)
