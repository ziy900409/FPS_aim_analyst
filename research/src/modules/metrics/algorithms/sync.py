"""Pure Release-to-Click Sync metrics and pre-registered precision verdicts."""

from __future__ import annotations

from dataclasses import dataclass
import math
from statistics import stdev
from typing import Literal, Sequence

import numpy as np
import pandas as pd

from modules.metrics.algorithms.peek import KNOWN_PEEK_FLAGS, PeekWindow, WINDOW_EPSILON_MS


SYNC_VERSION = "sync-v1"
SYNC_METRICS = ("release_to_fire_ms", "counter_hold_ms")
KNOWN_SYNC_FLAGS = KNOWN_PEEK_FLAGS | frozenset(
    {
        "counter_hold_truncated",
        "missing_counter",
        "missing_first_shot",
        "missing_release",
    }
)

WeaponMode = Literal["hitscan", "projectile"]
Verdict = Literal["sufficient", "insufficient", "blocked-by-data"]


@dataclass(frozen=True)
class SyncParams:
    """Pre-registered precision parameters; semantic changes require a new version."""

    min_samples: int = 10
    sd_ratio_threshold: float = 1 / 3
    version: str = SYNC_VERSION

    def __post_init__(self) -> None:
        if (
            isinstance(self.min_samples, bool)
            or not isinstance(self.min_samples, int)
            or self.min_samples < 2
        ):
            raise ValueError("min_samples must be an integer of at least 2")
        if (
            isinstance(self.sd_ratio_threshold, bool)
            or not isinstance(self.sd_ratio_threshold, (int, float))
            or not math.isfinite(float(self.sd_ratio_threshold))
            or self.sd_ratio_threshold <= 0
        ):
            raise ValueError("sd_ratio_threshold must be a positive finite number")
        if not isinstance(self.version, str) or not self.version:
            raise ValueError("version must be a non-empty string")


DEFAULT_SYNC_PARAMS = SyncParams()


@dataclass(frozen=True)
class PrecisionVerdict:
    metric: str
    n: int
    sample_sd_ms: float | None
    quantization_sd_ms: float
    verdict: Verdict
    reason: str


def sync_metrics(
    peeks: Sequence[PeekWindow],
    ticks: pd.DataFrame,
    *,
    weapon_mode: WeaponMode = "hitscan",
) -> pd.DataFrame:
    """Return one Sync row per peek without dropping missing-anchor semantics."""

    if not isinstance(ticks, pd.DataFrame):
        raise TypeError("ticks must be a pandas DataFrame returned by load_export")
    missing_columns = {"t", "keys"} - set(ticks.columns)
    if missing_columns:
        raise ValueError(f"ticks is missing required columns: {sorted(missing_columns)}")
    if weapon_mode not in ("hitscan", "projectile"):
        raise ValueError("weapon_mode must be 'hitscan' or 'projectile'")

    ordered_ticks = ticks.sort_values("t", kind="stable").reset_index(drop=True)
    rows: list[dict[str, object]] = []
    for peek in peeks:
        flags = list(peek.flags)
        if peek.t_release is None:
            flags.append("missing_release")
        if peek.t_counter is None:
            flags.append("missing_counter")
        if peek.t_first_shot is None:
            flags.append("missing_first_shot")

        window_ticks = ordered_ticks.iloc[peek.tick_slice]
        counter_hold_ms, counter_hold_truncated = _counter_hold_ms(peek, window_ticks)
        if counter_hold_truncated:
            flags.append("counter_hold_truncated")
        elif (
            peek.t_counter is not None
            and peek.counter_key is not None
            and counter_hold_ms is None
        ):
            flags.append("no_key_transition")

        unique_flags = tuple(dict.fromkeys(flags))
        if not set(unique_flags) <= KNOWN_SYNC_FLAGS:
            raise AssertionError("sync row emitted an unknown flag")
        rows.append(
            {
                "peek_index": peek.index,
                "release_to_fire_ms": _delta(peek.t_first_shot, peek.t_release),
                "counter_hold_ms": counter_hold_ms,
                "counter_to_fire_ms": _delta(peek.t_first_shot, peek.t_counter),
                "side": peek.side,
                "ads": peek.ads,
                "weapon_mode": weapon_mode,
                "flags": unique_flags,
            }
        )

    columns = (
        "peek_index",
        "release_to_fire_ms",
        "counter_hold_ms",
        "counter_to_fire_ms",
        "side",
        "ads",
        "weapon_mode",
        "flags",
    )
    result = pd.DataFrame(rows, columns=columns)
    for column in ("release_to_fire_ms", "counter_hold_ms", "counter_to_fire_ms", "ads"):
        result[column] = pd.Series([row[column] for row in rows], dtype=object)
    return result


def evaluate_release_precision(
    sync: pd.DataFrame,
    params: SyncParams,
    sim_hz: int = 128,
) -> tuple[PrecisionVerdict, ...]:
    """Judge tick-quantized Sync metrics using the frozen ``sync-v1`` branches."""

    if not isinstance(sync, pd.DataFrame):
        raise TypeError("sync must be a pandas DataFrame returned by sync_metrics")
    missing_columns = ({"flags"} | set(SYNC_METRICS)) - set(sync.columns)
    if missing_columns:
        raise ValueError(f"sync is missing required columns: {sorted(missing_columns)}")
    if isinstance(sim_hz, bool) or not isinstance(sim_hz, int) or sim_hz <= 0:
        raise ValueError("sim_hz must be a positive integer")

    quantization_sd_ms = (1000.0 / sim_hz) / math.sqrt(12.0)
    verdicts: list[PrecisionVerdict] = []
    for metric in SYNC_METRICS:
        values = _valid_metric_values(sync, metric)
        n = len(values)
        sample_sd_ms = stdev(values) if n >= 2 else None
        if n < params.min_samples:
            verdict: Verdict = "blocked-by-data"
            reason = (
                f"n={n} < min_samples={params.min_samples}; "
                f"collect {params.min_samples - n} more unflagged samples"
            )
        elif quantization_sd_ms >= sample_sd_ms * params.sd_ratio_threshold:
            verdict = "insufficient"
            reason = (
                f"quantization_sd_ms={quantization_sd_ms:.12g} >= "
                f"sample_sd_ms={sample_sd_ms:.12g} * "
                f"sd_ratio_threshold={params.sd_ratio_threshold:.12g}"
            )
        else:
            verdict = "sufficient"
            reason = (
                f"quantization_sd_ms={quantization_sd_ms:.12g} < "
                f"sample_sd_ms={sample_sd_ms:.12g} * "
                f"sd_ratio_threshold={params.sd_ratio_threshold:.12g}"
            )
        verdicts.append(
            PrecisionVerdict(
                metric=metric,
                n=n,
                sample_sd_ms=sample_sd_ms,
                quantization_sd_ms=quantization_sd_ms,
                verdict=verdict,
                reason=reason,
            )
        )
    return tuple(verdicts)


def _counter_hold_ms(
    peek: PeekWindow, window_ticks: pd.DataFrame
) -> tuple[float | None, bool]:
    if peek.t_counter is None or peek.counter_key is None or window_ticks.empty:
        return None, False

    eligible = window_ticks.loc[window_ticks["t"] >= peek.t_counter - WINDOW_EPSILON_MS]
    last_held_ms: float | None = None
    for _, tick in eligible.iterrows():
        held = peek.counter_key in _keys(tick.get("keys"))
        if held:
            last_held_ms = float(tick["t"])
        elif last_held_ms is not None:
            return max(0.0, last_held_ms - peek.t_counter), False
    if last_held_ms is None:
        return None, False
    return max(0.0, last_held_ms - peek.t_counter), True


def _valid_metric_values(sync: pd.DataFrame, metric: str) -> list[float]:
    values: list[float] = []
    for _, row in sync.iterrows():
        flags = row["flags"]
        if not isinstance(flags, (tuple, list, set, frozenset)):
            raise ValueError("sync.flags must contain a sequence of flag strings")
        if flags:
            continue
        value = _finite_number(row[metric])
        if value is not None:
            values.append(value)
    return values


def _delta(later: float | None, earlier: float | None) -> float | None:
    return None if later is None or earlier is None else float(later - earlier)


def _keys(value: object) -> frozenset[str]:
    if isinstance(value, (list, tuple, set, frozenset)):
        return frozenset(str(item) for item in value)
    return frozenset()


def _finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, np.number)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None
