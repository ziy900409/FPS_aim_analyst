"""SPARC spectral-arc-length smoothness (WP-31 / T1, FR-D13).

``sparc-v1`` answers "how smooth was the main run" for one movement segment. The numeric core
(:func:`compute_sparc`) is a **bit-for-bit port** of ``performance_analysis``'s
``research/src/modules/analysis/algorithms/metrics_sparc.py`` (which in turn ports the Go
``computeSPARC``): same constants, same ``max(v)`` normalisation, same power-of-two zero padding,
same 8-bin fallback, same "degenerate returns ``0.0``, not NaN" contract. Nothing here is adapted to
this project's 128 Hz sampling rate -- the whole point of the port is that a cross-repo golden can
prove "same input, same output" (D-31.2). The 128 Hz resolution problem is handled by
:func:`sparc_length_sensitivity` as a **usage restriction**, never by editing a constant.

The per-segment unit is frozen too (D-31.3/D-31.5): SPARC is computed over the ``phase-v1`` **MR
interval** -- the first ``primary_flick`` :class:`~modules.segments.algorithms.submovement.Segment`
found *inside a single peek window* -- and this module contains no segmentation of its own. Choosing
any other scoping would give ``primary_flick`` a third definition (C-D4); segmenting the whole trace
instead of each peek window collapses the sample from 59 segments to 3.

The cross-repo golden lives in this repo as committed JSON (``research/fixtures/golden/sparc-*.json``);
``performance_analysis`` is **never** imported at runtime or under pytest (C-D1).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
import math
from typing import Final, Literal

import numpy as np
import pandas as pd

from modules.metrics.algorithms.peek import PeekWindow
from modules.segments.algorithms.submovement import Segment


SPARC_VERSION = "sparc-v1"

# --- ported constants -------------------------------------------------------------------------
# Every value below mirrors performance_analysis `metrics_sparc.py` exactly and is pinned
# value-by-value by test_sparc.py. Changing one turns the cross-repo golden into a self-golden and
# destroys FR-D13's external verification (D-31.2) -- a new version, not an edit, is the only path.
MIN_SAMPLES: Final[int] = 16
MAXV_FLOOR: Final[float] = 1e-9
MAXMAG_FLOOR: Final[float] = 1e-12
FSPAN_FLOOR: Final[float] = 1e-9
FC_HZ: Final[float] = 20.0
AMP_THRESH: Final[float] = 0.03
FALLBACK_MIN_BINS: Final[int] = 8

#: Closed vocabulary (T1 §3 pre-registration; may only narrow, never widen, per D-30.4/D-31.5).
KNOWN_SPARC_FLAGS = frozenset(
    {
        "no_primary_flick",
        "too_few_samples",
        "degenerate_spectrum",
        "window_too_short",
    }
)

Side = Literal["L", "R"]

#: ``omega_deg_s``'s index 0 is contractually ``nan`` (TD-3, D-29.4), so a window needs one more
#: sample than ``MIN_SAMPLES`` before any MR interval inside it could reach the port's minimum.
#: Derived from the ported constant -- not a second, separately tunable threshold.
_MIN_WINDOW_SAMPLES: Final[int] = MIN_SAMPLES + 1


@dataclass(frozen=True)
class SparcTrace:
    """One :func:`compute_sparc` evaluation with the intermediates the cross-repo golden pins.

    Field names mirror performance_analysis's ``expected_*`` golden keys one-for-one, so a parity
    failure names the first intermediate that diverged instead of only the final number.
    Degenerate evaluations still return a trace: fields the port never reached are ``0``/``nan``.
    """

    max_v: float
    n_fft: int
    max_mag: float
    freqs_pass1_count: int
    freqs_final_count: int
    f_span: float
    arc: float
    sparc: float


@dataclass(frozen=True)
class SparcParams:
    """Pre-registered ``sparc-v1`` parameters (T0/D-31.5); changes require a new version."""

    fs_hz: float
    step_ratio_threshold: float
    version: str = SPARC_VERSION

    def __post_init__(self) -> None:
        if (
            isinstance(self.fs_hz, bool)
            or not isinstance(self.fs_hz, (int, float))
            or not math.isfinite(self.fs_hz)
            or self.fs_hz <= 0
        ):
            raise ValueError("fs_hz must be a positive finite number")
        if (
            isinstance(self.step_ratio_threshold, bool)
            or not isinstance(self.step_ratio_threshold, (int, float))
            or not math.isfinite(self.step_ratio_threshold)
            or self.step_ratio_threshold <= 0
        ):
            raise ValueError("step_ratio_threshold must be a positive finite number")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


#: Frozen 2026-08-10 by WP-31 T0 (progress.md D-31.5), **before** any real SPARC value was computed.
#: ``fs_hz=128.0`` is the nominal sim rate every upstream construct already assumes;
#: ``step_ratio_threshold=0.5`` is the pre-registered bar for "the N=32/64 padding step is large
#: enough that cross-length comparison would tell a false story" (OQ-S4-18).
DEFAULT_SPARC_PARAMS = SparcParams(fs_hz=128.0, step_ratio_threshold=0.5)


@dataclass(frozen=True)
class SparcSample:
    """One MR interval's SPARC row. ``padded_n``/``bins_le_fc`` are the stratification keys."""

    peek_index: int
    side: Side
    start_idx: int | None
    end_idx: int | None
    n_ticks: int
    padded_n: int | None
    bins_le_fc: int | None
    sparc: float | None
    flags: tuple[str, ...] = ()


def compute_sparc(velocity_series: np.ndarray, fs: float) -> float:
    """Spectral arc length of ``velocity_series`` sampled at ``fs`` Hz (bit-for-bit PA/Go parity).

    ``fs`` is converted to ``dt = 1 / fs`` to mirror Go ``computeSPARC(speed, dt)``. Degenerate
    inputs return ``0.0`` (fewer than :data:`MIN_SAMPLES` samples, non-positive ``fs``, a flat or
    empty spectrum); a NaN anywhere in the series propagates as ``nan``. Neither case raises --
    the caller turns them into a flag.
    """

    return _compute_traced(velocity_series, fs).sparc


def compute_sparc_traced(velocity_series: np.ndarray, fs: float) -> SparcTrace:
    """:func:`compute_sparc` plus the seven intermediates the cross-repo golden compares."""

    return _compute_traced(velocity_series, fs)


def sparc_table(
    peeks: Sequence[PeekWindow],
    omega_by_peek: Sequence[np.ndarray],
    segments_by_peek: Sequence[Sequence[Segment]],
    params: SparcParams = DEFAULT_SPARC_PARAMS,
) -> pd.DataFrame:
    """One row per peek: the SPARC of that peek's MR interval, or the flag saying why there is none.

    The three sequences are parallel per-peek values in the peek's **own local frame**, exactly the
    convention :func:`~modules.metrics.algorithms.phase.phase_table` already uses: ``omega_by_peek[i]``
    is ``omega_deg_s(window_ticks, strict=True).values`` for peek ``i``'s own tick slice (index 0 is
    the contractual leading ``nan``) and ``segments_by_peek[i]`` are that window's
    :func:`~modules.segments.algorithms.submovement.segment_submovements` results with indices
    already mapped back into the same frame. This function selects the MR interval the same way
    ``phase-v1`` does -- ``next(segment for segment in segments if segment.kind == 'primary_flick')``
    -- and never recomputes a boundary.
    """

    if not isinstance(params, SparcParams):
        raise TypeError("params must be a SparcParams instance")

    rows = [
        _sparc_sample(peek, omega, segments, params)
        for peek, omega, segments in zip(peeks, omega_by_peek, segments_by_peek, strict=True)
    ]
    return pd.DataFrame(
        {
            "peek_index": [row.peek_index for row in rows],
            "side": [row.side for row in rows],
            "start_idx": [row.start_idx for row in rows],
            "end_idx": [row.end_idx for row in rows],
            "n_ticks": [row.n_ticks for row in rows],
            "padded_n": [row.padded_n for row in rows],
            "bins_le_fc": [row.bins_le_fc for row in rows],
            "sparc": [row.sparc for row in rows],
            "flags": [row.flags for row in rows],
        }
    )


def sparc_length_sensitivity(
    table: pd.DataFrame, params: SparcParams = DEFAULT_SPARC_PARAMS
) -> dict:
    """Quantify the zero-padding step: is SPARC comparable across ``padded_n`` buckets? (OQ-S4-18)

    At 128 Hz an MR interval of 24-32 ticks pads to ``N=32`` (6 spectral bins at or below
    :data:`FC_HZ`) while 33-58 ticks pads to ``N=64`` (11 bins) -- so two movements one tick apart in
    length can be scored at twice the frequency resolution. This function measures how big that
    artefact is on the data at hand: ``step_ratio = (largest gap between bucket medians) / (largest
    within-bucket IQR)``. Reaching ``params.step_ratio_threshold`` means the step is at least that
    fraction of the natural spread inside a bucket, i.e. large enough to be read as a smoothness
    difference when it is only a resolution difference.

    The verdict decides a **usage restriction**, never a parameter change (D-31.2): ``comparable``
    permits cross-length reading, ``stratified_only`` limits SPARC to comparisons within one
    ``padded_n`` bucket. Fewer than two populated buckets yields ``stratified_only`` as well -- one
    bucket of data cannot demonstrate cross-bucket comparability, and the restriction is vacuous
    there anyway. Rows enter this diagnostic under the D-29.5 inclusion rule (finite ``sparc``
    **and** empty ``flags``).
    """

    if not isinstance(params, SparcParams):
        raise TypeError("params must be a SparcParams instance")

    valid = table.loc[
        table["flags"].map(lambda flags: len(flags) == 0)
        & table["sparc"].map(lambda value: value is not None and math.isfinite(float(value)))
    ]

    buckets: list[dict[str, object]] = []
    for padded_n in sorted({int(value) for value in valid["padded_n"]}):
        subset = valid.loc[valid["padded_n"] == padded_n]
        values = subset["sparc"].to_numpy(dtype=float)
        p25 = float(np.percentile(values, 25))
        p75 = float(np.percentile(values, 75))
        buckets.append(
            {
                "padded_n": padded_n,
                "bins_le_fc": int(subset["bins_le_fc"].iloc[0]),
                "n": int(values.size),
                "median": float(np.median(values)),
                "p25": p25,
                "p75": p75,
                "iqr": p75 - p25,
            }
        )

    result: dict[str, object] = {
        "version": params.version,
        "step_ratio_threshold": params.step_ratio_threshold,
        "n_valid": int(len(valid)),
        "n_excluded": int(len(table) - len(valid)),
        "buckets": buckets,
        "median_gap": None,
        "max_iqr": None,
        "step_ratio": None,
    }

    if len(buckets) < 2:
        result["verdict"] = "stratified_only"
        result["reason"] = (
            f"only {len(buckets)} populated padded_n bucket(s): cross-bucket comparability cannot be "
            "demonstrated from this sample"
        )
        return result

    medians = [float(bucket["median"]) for bucket in buckets]
    iqrs = [float(bucket["iqr"]) for bucket in buckets]
    median_gap = max(medians) - min(medians)
    max_iqr = max(iqrs)
    if median_gap == 0.0:
        step_ratio = 0.0
    elif max_iqr == 0.0:
        step_ratio = math.inf
    else:
        step_ratio = median_gap / max_iqr

    stratified = step_ratio >= params.step_ratio_threshold
    result["median_gap"] = median_gap
    result["max_iqr"] = max_iqr
    result["step_ratio"] = step_ratio
    result["verdict"] = "stratified_only" if stratified else "comparable"
    result["reason"] = (
        f"step_ratio={step_ratio:.4f} "
        f"{'>=' if stratified else '<'} step_ratio_threshold={params.step_ratio_threshold}"
    )
    return result


def padded_length(n_samples: int) -> int:
    """Zero-padded FFT length the port uses for ``n_samples`` inputs (``1 << (n-1).bit_length()``)."""

    if n_samples < 1:
        raise ValueError("n_samples must be >= 1")
    return 1 << (n_samples - 1).bit_length()


def bins_at_or_below_fc(padded_n: int, fs: float) -> int:
    """Number of spectral bins at or below :data:`FC_HZ` for a ``padded_n``-point FFT at ``fs`` Hz.

    Purely geometric (independent of the signal), which is what makes it a usable stratification
    key: at 128 Hz, ``padded_n=32`` gives 6 bins and ``padded_n=64`` gives 11.
    """

    if padded_n < 2 or padded_n & (padded_n - 1):
        raise ValueError("padded_n must be a power of two >= 2")
    if not math.isfinite(fs) or fs <= 0:
        raise ValueError("fs must be a positive finite number")
    df_freq = fs / float(padded_n)
    return int(sum(1 for k in range(padded_n // 2 + 1) if float(k) * df_freq <= FC_HZ))


# --- internals --------------------------------------------------------------------------------


def _compute_traced(velocity_series: np.ndarray, fs: float) -> SparcTrace:
    """The port itself. Line order deliberately mirrors performance_analysis `compute_sparc`."""

    speed = np.asarray(velocity_series, dtype=np.float64)
    fs_value = float(fs)
    if speed.size < MIN_SAMPLES or fs_value <= 0.0:
        return _degenerate(0.0)

    dt = 1.0 / fs_value
    max_v = float(np.max(speed))
    if math.isnan(max_v):
        return _degenerate(math.nan, max_v=max_v)
    if max_v <= MAXV_FLOOR:
        return _degenerate(0.0, max_v=max_v)

    n = 1 << (speed.size - 1).bit_length()
    sig = np.zeros(n, dtype=np.complex128)
    sig[: speed.size] = speed / max_v
    fft_out = np.fft.fft(sig)

    half = n // 2
    mags = np.abs(fft_out[: half + 1]) / float(n)
    max_mag = float(np.max(mags))
    if math.isnan(max_mag):
        return _degenerate(math.nan, max_v=max_v, n_fft=n, max_mag=max_mag)
    if max_mag <= MAXMAG_FLOOR:
        return _degenerate(0.0, max_v=max_v, n_fft=n, max_mag=max_mag)
    mags = mags / max_mag

    df_freq = 1.0 / (float(n) * dt)
    freqs: list[float] = []
    spec: list[float] = []
    for k in range(half + 1):
        freq = float(k) * df_freq
        if freq > FC_HZ:
            break
        if k > 0 and float(mags[k]) < AMP_THRESH:
            continue
        freqs.append(freq)
        spec.append(float(mags[k]))

    pass1_count = len(freqs)

    if len(freqs) < 2:
        freqs.clear()
        spec.clear()
        for k in range(half + 1):
            freq = float(k) * df_freq
            if freq > FC_HZ:
                break
            freqs.append(freq)
            spec.append(float(mags[k]))
            if len(freqs) >= FALLBACK_MIN_BINS:
                break

    if len(freqs) < 2:
        return _degenerate(
            0.0,
            max_v=max_v,
            n_fft=n,
            max_mag=max_mag,
            freqs_pass1_count=pass1_count,
            freqs_final_count=len(freqs),
        )

    f_span = freqs[-1] - freqs[0]
    if f_span <= FSPAN_FLOOR:
        f_span = 1.0

    arc = 0.0
    for i in range(1, len(freqs)):
        dx = (freqs[i] - freqs[i - 1]) / f_span
        dy = spec[i] - spec[i - 1]
        arc += math.sqrt(dx * dx + dy * dy)

    return SparcTrace(
        max_v=max_v,
        n_fft=n,
        max_mag=max_mag,
        freqs_pass1_count=pass1_count,
        freqs_final_count=len(freqs),
        f_span=f_span,
        arc=arc,
        sparc=-arc,
    )


def _degenerate(
    sparc: float,
    *,
    max_v: float = math.nan,
    n_fft: int = 0,
    max_mag: float = math.nan,
    freqs_pass1_count: int = 0,
    freqs_final_count: int = 0,
) -> SparcTrace:
    """Trace for an evaluation that returned before reaching the arc-length sum."""

    return SparcTrace(
        max_v=max_v,
        n_fft=n_fft,
        max_mag=max_mag,
        freqs_pass1_count=freqs_pass1_count,
        freqs_final_count=freqs_final_count,
        f_span=math.nan,
        arc=math.nan,
        sparc=sparc,
    )


def _sparc_sample(
    peek: PeekWindow,
    omega: np.ndarray,
    segments: Sequence[Segment],
    params: SparcParams,
) -> SparcSample:
    omega = np.asarray(omega, dtype=float)

    if omega.size < _MIN_WINDOW_SAMPLES:
        return _finalize(peek, flags=("window_too_short",))

    primary = next((segment for segment in segments if segment.kind == "primary_flick"), None)
    if primary is None:
        return _finalize(peek, flags=("no_primary_flick",))

    start_idx = int(primary.start_idx)
    end_idx = int(primary.end_idx)
    n_ticks = end_idx - start_idx + 1

    if n_ticks < MIN_SAMPLES:
        return _finalize(
            peek,
            start_idx=start_idx,
            end_idx=end_idx,
            n_ticks=n_ticks,
            flags=("too_few_samples",),
        )

    padded_n = padded_length(n_ticks)
    bins_le_fc = bins_at_or_below_fc(padded_n, params.fs_hz)
    value = compute_sparc(omega[start_idx : end_idx + 1], params.fs_hz)

    # `compute_sparc`'s arc is a sum of strictly positive segment lengths, so a genuine result is
    # always < 0: exactly 0.0 (or nan) can only come from one of the port's degenerate exits.
    flags = ("degenerate_spectrum",) if (not math.isfinite(value) or value == 0.0) else ()

    return _finalize(
        peek,
        start_idx=start_idx,
        end_idx=end_idx,
        n_ticks=n_ticks,
        padded_n=padded_n,
        bins_le_fc=bins_le_fc,
        sparc=value,
        flags=flags,
    )


def _finalize(
    peek: PeekWindow,
    *,
    start_idx: int | None = None,
    end_idx: int | None = None,
    n_ticks: int = 0,
    padded_n: int | None = None,
    bins_le_fc: int | None = None,
    sparc: float | None = None,
    flags: tuple[str, ...] = (),
) -> SparcSample:
    if not set(flags) <= KNOWN_SPARC_FLAGS:
        raise AssertionError("sparc sample emitted an unknown flag")
    return SparcSample(
        peek_index=peek.index,
        side=peek.side,
        start_idx=start_idx,
        end_idx=end_idx,
        n_ticks=n_ticks,
        padded_n=padded_n,
        bins_le_fc=bins_le_fc,
        sparc=sparc,
        flags=flags,
    )
