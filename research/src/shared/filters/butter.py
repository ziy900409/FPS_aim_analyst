"""Zero-phase Butterworth low-pass filtering."""

from __future__ import annotations

from collections.abc import Sequence
import math

import numpy as np
from scipy.signal import butter, filtfilt


def butter_filter(
    x: Sequence[float] | np.ndarray,
    cutoff_hz: float,
    fs: float,
    order: int,
) -> np.ndarray:
    """Low-pass a finite one-dimensional signal without phase shift.

    Invalid cutoffs and signals too short for ``filtfilt`` raise
    :class:`ValueError` instead of silently returning unfiltered data.
    """

    values = np.asarray(x, dtype=float)
    if values.ndim != 1:
        raise ValueError("x must be a one-dimensional signal")
    if not np.all(np.isfinite(values)):
        raise ValueError("x must contain only finite values")
    if isinstance(order, bool) or not isinstance(order, int) or order <= 0:
        raise ValueError("order must be a positive integer")
    if isinstance(fs, bool) or not isinstance(fs, (int, float)) or not math.isfinite(fs) or fs <= 0:
        raise ValueError("fs must be a positive finite number")
    if (
        isinstance(cutoff_hz, bool)
        or not isinstance(cutoff_hz, (int, float))
        or not math.isfinite(cutoff_hz)
        or cutoff_hz <= 0
    ):
        raise ValueError("cutoff_hz must be a positive finite number")
    if cutoff_hz >= fs / 2:
        raise ValueError("cutoff_hz must be below the Nyquist frequency")

    numerator, denominator = butter(order, cutoff_hz, btype="low", fs=fs)
    padlen = 3 * max(len(numerator), len(denominator))
    if values.size <= padlen:
        raise ValueError(
            f"x has {values.size} samples, but filtfilt requires more than {padlen} for order={order}"
        )
    return np.asarray(filtfilt(numerator, denominator, values), dtype=float)
