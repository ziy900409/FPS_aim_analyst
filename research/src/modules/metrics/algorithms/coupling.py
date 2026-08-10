"""Key-velocity coupling cross-correlation + `gate-v1` reliability verdict (WP-31 / T2, FR-D14).

``xcorr-v1`` answers "does the strafe key state move together with the view, and which leads": for
one peek window it correlates the signed A/D key state against |ω(t)| at every lag in a symmetric
band and reports the lag with the strongest signed Pearson r, plus the whole correlogram.

Two things about this module matter more than the arithmetic:

**The alignment is free.** Both channels live on the same 128 Hz sim tick grid -- ``ticks[].keys`` is
sampled by the same loop that integrates the mouse delta -- so there is no clock alignment step and
no alignment error to budget for. That is the one structural advantage this project has over the
``performance_analysis`` original, whose key stream and mouse stream arrive on different clocks. The
``key`` **events** (WP-29 / T3) are therefore *not* the primary source; they are a cross-check
(:func:`key_event_crosscheck`), and the tick-derived state stays authoritative (README §0.6).

**The deliverable is a verdict, not a number** (C-D3 / GD-20). :func:`reliability_gate` executes the
three criteria frozen as ``gate-v1`` at T0 -- before any real xcorr value existed (D-31.4) -- and
this module may only *run* them. The frozen upper bound is enforced here in code rather than by
documentation discipline: under this sample structure (1 participant x 3 sessions x 20 peeks) the
three criteria show "the signal is not accidental and the estimate is stable", which is **weaker**
than split-half reliability and does **not** demonstrate individual-difference reliability. So
``'coach_report'`` is unreachable -- :func:`reliability_gate` has no code path that returns it.

Lag sign convention, ported verbatim from ``performance_analysis``'s
``metrics_key_velocity_coupling_xcorr.py`` (write it down or it *will* be read backwards):
**negative lag = key state leads ω; positive lag = ω leads key state.**
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
import hashlib
import math
from typing import Any, Final, Literal

import numpy as np
import pandas as pd

from modules.metrics.algorithms.peek import PeekWindow


XCORR_VERSION = "xcorr-v1"
GATE_VERSION = "gate-v1"

Side = Literal["L", "R"]

#: Ported from performance_analysis ``_pearson``: fewer than four paired samples is not a
#: correlation, it is noise, and returns ``nan`` rather than a number. Keeps the largest lags of a
#: short window honest instead of letting a 3-point r dominate the peak search.
MIN_PEARSON_SAMPLES: Final[int] = 4

#: Ported from performance_analysis ``_xcorr_peak``: the ">" that decides a new peak is fuzzy by
#: this much, so two lags whose |r| differ only in floating-point noise go to the tie-break
#: (smaller |lag| wins) instead of to whichever the loop happened to see first.
PEAK_TIE_EPSILON: Final[float] = 1e-12

#: Closed vocabulary; unknown flags raise, per `peek.py` / `phase.py` / `sparc.py`. A flagged row is
#: never repaired -- no zero fill, no NaN swallowing -- it is excluded from aggregation and kept in
#: the table for inspection (D-29.5).
KNOWN_XCORR_FLAGS = frozenset(
    {
        "window_too_short",
        "key_state_constant",
        "omega_constant",
        "non_finite_omega",
        "no_finite_lag",
    }
)

#: The order failed criteria are reported in, so one failure set has exactly one spelling.
_GATE_CRITERIA: Final[tuple[str, ...]] = ("shuffle_p", "ci_width", "half_within_ci")


def _all_gate_reasons() -> frozenset[str]:
    reasons = {"insufficient_n", "all_criteria_passed"}
    for mask in range(1, 1 << len(_GATE_CRITERIA)):
        failed = [name for bit, name in enumerate(_GATE_CRITERIA) if mask >> bit & 1]
        reasons.add("failed:" + ",".join(failed))
    return frozenset(reasons)


#: Closed vocabulary for :attr:`GateVerdict.reason` (9 strings). Every number a reader might want is
#: already a typed field of the verdict, so the reason itself stays enumerable rather than formatted.
KNOWN_GATE_REASONS = _all_gate_reasons()


@dataclass(frozen=True)
class XcorrParams:
    """Pre-registered ``xcorr-v1`` parameters (T0/D-31.5); changes require a new version."""

    max_lag_ms: float
    min_ticks: int
    key_encoding: Literal["signed_ad"] = "signed_ad"
    version: str = XCORR_VERSION

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_lag_ms, bool)
            or not isinstance(self.max_lag_ms, (int, float))
            or not math.isfinite(self.max_lag_ms)
            or self.max_lag_ms <= 0
        ):
            raise ValueError("max_lag_ms must be a positive finite number")
        if isinstance(self.min_ticks, bool) or not isinstance(self.min_ticks, int) or self.min_ticks <= 0:
            raise ValueError("min_ticks must be a positive integer")
        if self.key_encoding != "signed_ad":
            raise ValueError("key_encoding must be 'signed_ad'")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


#: Frozen 2026-08-10 by WP-31 T0 (progress.md D-31.5), **before** any real xcorr value was computed.
#: ``max_lag_ms=250`` is 32 ticks at 7.8125 ms, covering the measured median MR interval;
#: ``min_ticks=32`` is that same lag budget expressed as a floor on window length -- a structural
#: bound, deliberately not the 53-tick shortest real window (that would be a threshold tailored to
#: the sample at hand).
DEFAULT_XCORR_PARAMS = XcorrParams(max_lag_ms=250.0, min_ticks=32)


@dataclass(frozen=True)
class XcorrResult:
    """One window's cross-correlation.

    ``correlogram`` entries are ``(lag_ms, r, n_overlap)``. The third element is not decoration: at
    ``|lag|`` near the limit the two series only overlap on ``n - |lag|`` samples, which for a real
    62-tick window is about 30 -- so the ends of a correlogram are inherently less stable than its
    middle, and D-31.5 requires that to be visible in the output rather than inferred (S-31.1).

    ``peek_index``/``side`` default to ``None`` because the numeric core is a function of two series
    and nothing else; :func:`xcorr_table` attaches the identity when it builds a row.
    """

    peak_lag_ms: float | None
    peak_strength: float | None
    n_ticks: int
    correlogram: tuple[tuple[float, float, int], ...]
    flags: tuple[str, ...] = ()
    peek_index: int | None = None
    side: Side | None = None


def key_state_signed(ticks: pd.DataFrame) -> np.ndarray:
    """Signed strafe key state per tick: ``D`` -> ``+1``, ``A`` -> ``-1``, both or neither -> ``0``.

    ``both -> 0`` is the encoding's meaning, not a dropped case: holding A and D together produces no
    net strafe input, so the movement channel genuinely reads zero. It happens (40 of 2,038 ticks in
    the 09:18 session) and must not be scored as if one key won. Non-strafe keys are ignored -- the
    stage-A counter-strafe drill has no W/S -- so this is the ``signed_ad`` encoding, narrower than
    performance_analysis's ``signed_wasd`` by design, not by omission.
    """

    if not isinstance(ticks, pd.DataFrame):
        raise TypeError("ticks must be a pandas DataFrame returned by load_export")
    if "keys" not in ticks.columns:
        raise ValueError("ticks.keys is required")

    state = np.zeros(len(ticks), dtype=float)
    for row, value in enumerate(ticks["keys"]):
        held = value if isinstance(value, (list, tuple, set, frozenset)) else ()
        held_set = {str(item) for item in held}
        state[row] = float("D" in held_set) - float("A" in held_set)
    return state


def key_velocity_xcorr(
    key_state: np.ndarray,
    omega: np.ndarray,
    *,
    max_lag_ticks: int,
    dt_ms: float,
) -> XcorrResult:
    """Signed Pearson r at every lag in ``[-max_lag_ticks, +max_lag_ticks]``, plus the peak.

    Both arrays must already be aligned sample-for-sample (see :func:`xcorr_table`, which drops the
    contractual leading ``nan`` of ``omega_deg_s`` from both channels together). Negative lag means
    the key state leads ω; positive means ω leads.

    The peak is the lag with the largest ``|r|``; ties within :data:`PEAK_TIE_EPSILON` go to the
    smaller ``|lag|``, matching performance_analysis's ``_xcorr_peak``. Lags whose r is ``nan``
    (fewer than :data:`MIN_PEARSON_SAMPLES` overlapping samples, or a zero-variance overlap) are
    skipped for the peak but **kept in the correlogram**, so a hole in the curve stays visible.
    """

    key = np.asarray(key_state, dtype=float)
    values = np.asarray(omega, dtype=float)
    if key.shape != values.shape:
        raise ValueError("key_state and omega must have the same length")
    if key.ndim != 1:
        raise ValueError("key_state and omega must be one-dimensional")
    if isinstance(max_lag_ticks, bool) or not isinstance(max_lag_ticks, (int, np.integer)) or max_lag_ticks < 0:
        raise ValueError("max_lag_ticks must be a non-negative integer")
    if not math.isfinite(dt_ms) or dt_ms <= 0:
        raise ValueError("dt_ms must be a positive finite number")

    flags: list[str] = []
    if not np.all(np.isfinite(values)):
        flags.append("non_finite_omega")
    elif float(np.std(values)) == 0.0:
        flags.append("omega_constant")
    if float(np.std(key)) == 0.0:
        flags.append("key_state_constant")

    correlogram = _correlogram(key, values, int(max_lag_ticks), float(dt_ms))
    peak_lag_ticks, peak_strength = _peak(correlogram, float(dt_ms))

    if peak_lag_ticks is None and not flags:
        # Both channels vary and are finite, yet no lag produced a usable r -- the window is too
        # short for any overlap to reach MIN_PEARSON_SAMPLES. Named rather than folded into
        # `window_too_short` so the two causes stay distinguishable in the table.
        flags.append("no_finite_lag")

    return XcorrResult(
        peak_lag_ms=None if peak_lag_ticks is None else peak_lag_ticks * float(dt_ms),
        peak_strength=peak_strength,
        n_ticks=int(key.size),
        correlogram=correlogram,
        flags=_checked_flags(tuple(flags)),
    )


def xcorr_table(
    peeks: Sequence[PeekWindow],
    ticks: Sequence[pd.DataFrame],
    omega: Sequence[np.ndarray],
    params: XcorrParams = DEFAULT_XCORR_PARAMS,
    *,
    session: str = "",
) -> pd.DataFrame:
    """One row per peek: that window's key/ω cross-correlation, or the flag saying why there is none.

    ``ticks``/``omega`` are parallel per-peek sequences in each peek's own local frame -- the same
    convention :func:`~modules.metrics.algorithms.phase.phase_table` uses: ``ticks[i]`` is peek
    ``i``'s own tick slice and ``omega[i]`` is ``omega_deg_s(ticks[i], strict=True).values`` for that
    slice, index 0 being the contractual leading ``nan`` (D-29.4). Both channels drop that first
    sample **together**, so the key state and ω stay index-aligned; ``n_ticks`` counts the paired
    samples that survive, and ``min_ticks`` is applied to that count (mirroring ``sparc.py``'s
    ``MIN_SAMPLES + 1`` window rule rather than introducing a second tunable threshold).

    The ``key_state`` and ``omega`` columns carry the aligned per-peek series because
    :func:`reliability_gate`'s permutation null has to re-correlate a *shifted* key state -- keeping
    them on the table is what lets the gate stay a pure function of ``(table, thresholds)``. Drop
    both columns (and ``correlogram``) before writing CSV.

    ``session`` labels the rows so :func:`reliability_gate` can run per session; pooling across
    sessions then requires an explicit ``concat`` with a shared label, which is visible in a diff
    rather than accidental (cross-session inference is out of scope for this WP).
    """

    if not isinstance(params, XcorrParams):
        raise TypeError("params must be an XcorrParams instance")

    rows = [
        _xcorr_row(peek, window_ticks, window_omega, params)
        for peek, window_ticks, window_omega in zip(peeks, ticks, omega, strict=True)
    ]
    return pd.DataFrame(
        {
            "session": [session] * len(rows),
            "peek_index": [row.result.peek_index for row in rows],
            "side": [row.result.side for row in rows],
            "n_ticks": [row.result.n_ticks for row in rows],
            "dt_ms": [row.dt_ms for row in rows],
            "max_lag_ticks": [row.max_lag_ticks for row in rows],
            "peak_lag_ms": [row.result.peak_lag_ms for row in rows],
            "peak_strength": [row.result.peak_strength for row in rows],
            "correlogram": [row.result.correlogram for row in rows],
            "key_state": [row.key_state for row in rows],
            "omega": [row.omega for row in rows],
            "flags": [row.result.flags for row in rows],
        }
    )


@dataclass(frozen=True)
class GateThresholds:
    """``gate-v1``, frozen by WP-31 T0 on 2026-08-10 (D-31.4) before any real xcorr value existed.

    The three criteria replace OQ-S4-3's ``split-half r >= 0.7``, which is not merely a stricter bar
    but an **undefined** quantity here: split-half reliability estimates how consistently a measure
    ranks *individuals*, and this sample has one participant, so its denominator (between-subject
    variance) is zero. Treating the three sessions as three units would produce an n=3 correlation
    that answers a different question. So the unmeasurable quantity was swapped for measurable ones,
    and the price is stated in :func:`reliability_gate`: ``'coach_report'`` became unreachable.

    Nothing here may be retuned in response to a result. A different value is a ``gate-v2`` plus a
    full rerun plus a DECISIONS.md entry.
    """

    min_samples: int
    shuffle_iters: int
    shuffle_alpha: float
    bootstrap_iters: int
    ci_width_max: float
    half_agreement_within_ci: bool
    seed: int
    version: str = GATE_VERSION

    def __post_init__(self) -> None:
        for name in ("min_samples", "shuffle_iters", "bootstrap_iters"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError(f"{name} must be a positive integer")
        for name in ("shuffle_alpha", "ci_width_max"):
            value = getattr(self, name)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or value <= 0
            ):
                raise ValueError(f"{name} must be a positive finite number")
        if not isinstance(self.half_agreement_within_ci, bool):
            raise ValueError("half_agreement_within_ci must be a bool")
        if isinstance(self.seed, bool) or not isinstance(self.seed, int) or self.seed < 0:
            raise ValueError("seed must be a non-negative integer")
        if not isinstance(self.version, str) or not self.version.strip():
            raise ValueError("version must be a non-empty string")


#: The seven frozen ``gate-v1`` values, verbatim from progress.md D-31.4.
DEFAULT_GATE_THRESHOLDS = GateThresholds(
    min_samples=10,
    shuffle_iters=1000,
    shuffle_alpha=0.01,
    bootstrap_iters=2000,
    ci_width_max=0.20,
    half_agreement_within_ci=True,
    seed=20260810,
)


@dataclass(frozen=True)
class GateVerdict:
    """One session's ``gate-v1`` outcome. ``verdict`` is one of three pre-registered branches."""

    metric: str
    session: str
    n: int
    observed: float
    shuffle_p: float | None
    ci_lo: float | None
    ci_hi: float | None
    ci_width: float | None
    half_delta: float | None
    half_within_ci: bool | None
    verdict: Literal["coach_report", "research_only", "blocked-by-data"]
    reason: str


def reliability_gate(
    table: pd.DataFrame,
    thresholds: GateThresholds = DEFAULT_GATE_THRESHOLDS,
    params: XcorrParams = DEFAULT_XCORR_PARAMS,
) -> tuple[GateVerdict, ...]:
    """Run the three frozen ``gate-v1`` criteria per session and return one verdict each.

    The session statistic is the **median ``|peak_strength|``** over that session's rows that pass
    the D-29.5 inclusion rule (empty ``flags`` *and* a finite strength):

    1. **Permutation null** -- each included peek's key state is *circularly shifted* by a random
       amount in ``[1, n_ticks - 1]`` and its peak strength recomputed; ``shuffle_iters`` repeats
       give the null distribution of the session statistic, and ``shuffle_p`` is the share of null
       draws at or above the observed value. The shift is circular, and never 0 or the full length,
       because a plain reshuffle would destroy the key state's own autocorrelation and hand back an
       optimistic null -- p values that look significant because the surrogate is easier to beat,
       not because the coupling is real.
    2. **Bootstrap CI** -- peeks resampled with replacement ``bootstrap_iters`` times, 95 % percentile
       CI of the session statistic, compared against ``ci_width_max``.
    3. **Odd/even split** -- the session statistic computed on odd and on even ``peek_index``; the
       gap must fall inside criterion 2's CI width.

    ``'coach_report'`` is unreachable **by construction**, not by convention: the three criteria
    establish that the signal is not accidental and the estimate is stable, which is strictly weaker
    than the individual-difference reliability C-D3 requires before a metric may be spoken to a
    player. Grep this function for the string and you will find it only in the type annotation.

    Determinism: each session draws from ``default_rng([thresholds.seed, blake2b(session)])``, so a
    session's verdict does not depend on which other sessions were in the table or on their order --
    running one session alone reproduces exactly what running all three produces.
    """

    if not isinstance(thresholds, GateThresholds):
        raise TypeError("thresholds must be a GateThresholds instance")
    if not isinstance(params, XcorrParams):
        raise TypeError("params must be an XcorrParams instance")
    for column in ("session", "peek_index", "peak_strength", "flags", "key_state", "omega", "max_lag_ticks"):
        if column not in table.columns:
            raise ValueError(f"table must contain the {column!r} column (see xcorr_table)")

    metric = f"{params.version}:median_abs_peak_strength"
    return tuple(
        _session_verdict(metric, str(session), table.loc[table["session"] == session], thresholds)
        for session in sorted({str(value) for value in table["session"]})
    )


def key_event_crosscheck(
    ticks: pd.DataFrame, events: pd.DataFrame, *, tolerance_ticks: int = 1
) -> dict[str, Any]:
    """Cross-check the tick-derived key state against the additive ``key`` event stream (WP-29 / T3).

    The tick state is authoritative for ``xcorr-v1`` (it shares ω's grid, so it needs no alignment);
    this is the independent witness that the grid did not lose or invent a transition. Every A/D
    held-state change between consecutive ticks is matched greedily, nearest-first, against an
    unmatched ``key`` event of the same key and direction within ``(tolerance_ticks + 1)`` ticks --
    one tick for the quantisation itself (an event at input time lands on the next tick) plus the
    requested tolerance.

    ``status`` is ``'no_key_events'`` when the export predates the additive emission or opted out;
    that is an absent witness, not a disagreement, and is reported as such.

    Deliberately **not** a per-peek flag: this validates the input channel, not one window's
    computability, and folding it into :func:`xcorr_table`'s ``flags`` would let an observability
    check silently change the frozen gate's ``n`` (D-31.7).
    """

    if isinstance(tolerance_ticks, bool) or not isinstance(tolerance_ticks, int) or tolerance_ticks < 0:
        raise ValueError("tolerance_ticks must be a non-negative integer")

    ordered = ticks.sort_values("t", kind="stable").reset_index(drop=True)
    tick_times = ordered["t"].to_numpy(dtype=float)
    dt_ms = _median_dt_ms(tick_times)
    transitions = _key_transitions(ordered, tick_times)
    key_events = _ad_key_events(events)

    result: dict[str, Any] = {
        "n_tick_transitions": len(transitions),
        "n_key_events": len(key_events),
        "n_matched": 0,
        "n_unmatched_transitions": len(transitions),
        "n_unmatched_events": len(key_events),
        "tolerance_ms": None,
        "max_abs_residual_ms": None,
        "status": "no_key_events" if not key_events else "mismatch",
    }
    if not key_events or not math.isfinite(dt_ms):
        return result

    tolerance_ms = (tolerance_ticks + 1) * dt_ms
    unmatched = list(key_events)
    residuals: list[float] = []
    for t_target, key, down in transitions:
        candidates = [
            (abs(t_target - t_event), position)
            for position, (t_event, event_key, event_down) in enumerate(unmatched)
            if event_key == key and event_down == down and abs(t_target - t_event) <= tolerance_ms
        ]
        if not candidates:
            continue
        residual, position = min(candidates)
        residuals.append(residual)
        unmatched.pop(position)

    result["n_matched"] = len(residuals)
    result["n_unmatched_transitions"] = len(transitions) - len(residuals)
    result["n_unmatched_events"] = len(unmatched)
    result["tolerance_ms"] = tolerance_ms
    result["max_abs_residual_ms"] = max(residuals) if residuals else None
    result["status"] = (
        "agree" if not result["n_unmatched_transitions"] and not result["n_unmatched_events"] else "mismatch"
    )
    return result


# --- internals --------------------------------------------------------------------------------


def _pearson(x: np.ndarray, y: np.ndarray) -> float:
    """Signed Pearson r, or ``nan`` for too-few samples / a zero-variance input (PA ``_pearson``).

    ``nan`` on zero variance is the correct answer, not a gap to be filled: a constant series has no
    linear relationship to anything, and substituting 0.0 would claim "measured, no coupling" where
    the truth is "not measurable". Callers turn it into a flag.
    """

    if x.size < MIN_PEARSON_SAMPLES or y.size < MIN_PEARSON_SAMPLES:
        return math.nan
    dx = x - x.mean()
    dy = y - y.mean()
    norm_x = math.sqrt(float(dx.dot(dx)))
    norm_y = math.sqrt(float(dy.dot(dy)))
    if norm_x == 0.0 or norm_y == 0.0:
        return math.nan
    return float(dx.dot(dy) / (norm_x * norm_y))


def _correlogram(
    key: np.ndarray, values: np.ndarray, max_lag_ticks: int, dt_ms: float
) -> tuple[tuple[float, float, int], ...]:
    n = key.size
    rows: list[tuple[float, float, int]] = []
    for lag in range(-max_lag_ticks, max_lag_ticks + 1):
        overlap = max(n - abs(lag), 0)
        if abs(lag) >= n:
            r = math.nan
        elif lag > 0:
            r = _pearson(key[lag:], values[: n - lag])
        elif lag < 0:
            offset = -lag
            r = _pearson(key[: n - offset], values[offset:])
        else:
            r = _pearson(key, values)
        rows.append((lag * dt_ms, r, overlap))
    return tuple(rows)


def _peak(
    correlogram: Sequence[tuple[float, float, int]], dt_ms: float
) -> tuple[int | None, float | None]:
    """Largest ``|r|`` across the correlogram; ties within :data:`PEAK_TIE_EPSILON` prefer smaller ``|lag|``."""

    best_abs = -math.inf
    peak_lag: int | None = None
    peak_strength: float | None = None
    for lag_ms, r, _overlap in correlogram:
        if not math.isfinite(r):
            continue
        lag_ticks = int(round(lag_ms / dt_ms))
        magnitude = abs(r)
        better = magnitude > best_abs + PEAK_TIE_EPSILON
        tied_and_closer = (
            peak_lag is not None
            and math.isclose(magnitude, best_abs, rel_tol=PEAK_TIE_EPSILON, abs_tol=PEAK_TIE_EPSILON)
            and abs(lag_ticks) < abs(peak_lag)
        )
        if better or tied_and_closer:
            best_abs = magnitude
            peak_lag = lag_ticks
            peak_strength = r
    return peak_lag, peak_strength


def _peak_strength(key: np.ndarray, values: np.ndarray, max_lag_ticks: int) -> float:
    """Peak strength only, for the permutation null's inner loop (``dt_ms`` cancels out there)."""

    _, strength = _peak(_correlogram(key, values, max_lag_ticks, 1.0), 1.0)
    return math.nan if strength is None else strength


def _checked_flags(flags: tuple[str, ...]) -> tuple[str, ...]:
    if not set(flags) <= KNOWN_XCORR_FLAGS:
        raise AssertionError("xcorr result emitted an unknown flag")
    return flags


def _median_dt_ms(tick_times: np.ndarray) -> float:
    if tick_times.size < 2:
        return math.nan
    return float(np.median(np.diff(tick_times)))


def _aligned(window_ticks: pd.DataFrame, window_omega: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Drop ``omega_deg_s``'s contractual leading ``nan`` from **both** channels together."""

    key = key_state_signed(window_ticks)
    values = np.asarray(window_omega, dtype=float)
    if key.size != values.size:
        raise ValueError("per-peek ticks and omega must have the same length")
    return key[1:], values[1:]


@dataclass(frozen=True)
class _Row:
    """One table row's result plus the inputs :func:`reliability_gate` needs to re-correlate it."""

    result: XcorrResult
    key_state: np.ndarray
    omega: np.ndarray
    dt_ms: float
    max_lag_ticks: int


def _xcorr_row(
    peek: PeekWindow, window_ticks: pd.DataFrame, window_omega: np.ndarray, params: XcorrParams
) -> _Row:
    key, values = _aligned(window_ticks, window_omega)
    dt_ms = _median_dt_ms(window_ticks["t"].to_numpy(dtype=float))

    if key.size < params.min_ticks or not math.isfinite(dt_ms) or dt_ms <= 0:
        return _Row(
            result=XcorrResult(
                peak_lag_ms=None,
                peak_strength=None,
                n_ticks=int(key.size),
                correlogram=(),
                flags=_checked_flags(("window_too_short",)),
                peek_index=peek.index,
                side=peek.side,
            ),
            key_state=key,
            omega=values,
            dt_ms=dt_ms,
            max_lag_ticks=0,
        )

    max_lag_ticks = int(round(params.max_lag_ms / dt_ms))
    result = key_velocity_xcorr(key, values, max_lag_ticks=max_lag_ticks, dt_ms=dt_ms)
    return _Row(
        result=replace(result, peek_index=peek.index, side=peek.side),
        key_state=key,
        omega=values,
        dt_ms=dt_ms,
        max_lag_ticks=max_lag_ticks,
    )


def _session_verdict(
    metric: str, session: str, rows: pd.DataFrame, thresholds: GateThresholds
) -> GateVerdict:
    valid = rows.loc[
        rows["flags"].map(lambda flags: len(flags) == 0)
        & rows["peak_strength"].map(lambda value: value is not None and math.isfinite(float(value)))
    ]
    strengths = np.abs(valid["peak_strength"].to_numpy(dtype=float))
    n = int(strengths.size)
    observed = float(np.median(strengths)) if n else math.nan

    if n < thresholds.min_samples:
        return _gate_verdict(metric, session, n, observed, verdict="blocked-by-data", reason="insufficient_n")

    rng = np.random.default_rng([thresholds.seed, _session_seed(session)])
    shuffle_p = _shuffle_p(valid, observed, thresholds, rng)
    ci_lo, ci_hi = _bootstrap_ci(strengths, thresholds, rng)
    ci_width = ci_hi - ci_lo
    half_delta, half_within_ci = _half_agreement(valid, strengths, ci_width)

    failed = []
    if shuffle_p is None or not shuffle_p < thresholds.shuffle_alpha:
        failed.append("shuffle_p")
    if not ci_width <= thresholds.ci_width_max:
        failed.append("ci_width")
    if thresholds.half_agreement_within_ci and half_within_ci is not True:
        failed.append("half_within_ci")

    return _gate_verdict(
        metric,
        session,
        n,
        observed,
        shuffle_p=shuffle_p,
        ci_lo=ci_lo,
        ci_hi=ci_hi,
        ci_width=ci_width,
        half_delta=half_delta,
        half_within_ci=half_within_ci,
        # Never 'coach_report': see the module docstring and D-31.4's upper-bound clause.
        verdict="research_only",
        reason="all_criteria_passed" if not failed else "failed:" + ",".join(failed),
    )


def _shuffle_p(
    valid: pd.DataFrame, observed: float, thresholds: GateThresholds, rng: np.random.Generator
) -> float | None:
    series = [
        (np.asarray(row.key_state, dtype=float), np.asarray(row.omega, dtype=float), int(row.max_lag_ticks))
        for row in valid.itertuples()
    ]
    null = np.empty(thresholds.shuffle_iters, dtype=float)
    for iteration in range(thresholds.shuffle_iters):
        draws: list[float] = []
        for key, values, max_lag_ticks in series:
            shift = int(rng.integers(1, key.size))  # never 0 and never the full length
            strength = _peak_strength(np.roll(key, shift), values, max_lag_ticks)
            if math.isfinite(strength):
                draws.append(abs(strength))
        null[iteration] = np.median(draws) if draws else math.nan
    if not np.all(np.isfinite(null)):
        return None
    return float(np.mean(null >= observed))


def _bootstrap_ci(
    strengths: np.ndarray, thresholds: GateThresholds, rng: np.random.Generator
) -> tuple[float, float]:
    indices = rng.integers(0, strengths.size, size=(thresholds.bootstrap_iters, strengths.size))
    medians = np.median(strengths[indices], axis=1)
    return float(np.percentile(medians, 2.5)), float(np.percentile(medians, 97.5))


def _half_agreement(
    valid: pd.DataFrame, strengths: np.ndarray, ci_width: float
) -> tuple[float | None, bool | None]:
    parity = valid["peek_index"].to_numpy(dtype=int) % 2
    odd = strengths[parity == 1]
    even = strengths[parity == 0]
    if odd.size == 0 or even.size == 0:
        return None, None
    delta = abs(float(np.median(odd)) - float(np.median(even)))
    return delta, bool(delta <= ci_width)


def _session_seed(session: str) -> int:
    """Stable per-session seed component: ``hash()`` is randomised per process, blake2b is not."""

    return int.from_bytes(hashlib.blake2b(session.encode("utf-8"), digest_size=8).digest(), "big")


def _gate_verdict(
    metric: str,
    session: str,
    n: int,
    observed: float,
    *,
    shuffle_p: float | None = None,
    ci_lo: float | None = None,
    ci_hi: float | None = None,
    ci_width: float | None = None,
    half_delta: float | None = None,
    half_within_ci: bool | None = None,
    verdict: Literal["coach_report", "research_only", "blocked-by-data"],
    reason: str,
) -> GateVerdict:
    if reason not in KNOWN_GATE_REASONS:
        raise AssertionError("gate verdict emitted an unknown reason")
    return GateVerdict(
        metric=metric,
        session=session,
        n=n,
        observed=observed,
        shuffle_p=shuffle_p,
        ci_lo=ci_lo,
        ci_hi=ci_hi,
        ci_width=ci_width,
        half_delta=half_delta,
        half_within_ci=half_within_ci,
        verdict=verdict,
        reason=reason,
    )


def _key_transitions(
    ordered: pd.DataFrame, tick_times: np.ndarray
) -> list[tuple[float, str, bool]]:
    held = [
        {str(item) for item in value} if isinstance(value, (list, tuple, set, frozenset)) else set()
        for value in ordered["keys"]
    ]
    transitions: list[tuple[float, str, bool]] = []
    for index in range(len(held) - 1):
        for key in ("A", "D"):
            before = key in held[index]
            after = key in held[index + 1]
            if before != after:
                transitions.append((float(tick_times[index + 1]), key, after))
    return transitions


def _ad_key_events(events: pd.DataFrame) -> list[tuple[float, str, bool]]:
    if "type" not in events.columns:
        raise ValueError("events.type is required")
    rows = events.loc[events["type"] == "key"]
    result: list[tuple[float, str, bool]] = []
    for _, event in rows.iterrows():
        key = event.get("key")
        down = event.get("down")
        if key in ("A", "D") and isinstance(down, (bool, np.bool_)):
            result.append((float(event["t"]), str(key), bool(down)))
    result.sort(key=lambda item: item[0])
    return result
