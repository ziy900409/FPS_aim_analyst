"""WP-61 T3 layer 2: the boundary kinematics of a candidate gap (FR-61.4).

**Why the boundary and not the gap.** README section 1.4 argues the physics: on this hardware a
sensor lift and a hand pause both produce a *zero-sample* interval, and WP-60's D-60.R2-1 already
showed their durations overlap. Whatever separating signal exists therefore cannot be inside the
gap -- there is nothing in there -- it can only be in the deceleration profile entering it and the
acceleration profile leaving it. This module computes exactly those, and nothing else.

**Neutral naming is load-bearing.** Nothing here is called lift, reposition or suspicion. These are
descriptions of a sample stream; whether a boundary profile *means* a lift is what T3 measures, and
a feature that already carries the answer in its name cannot be used to test for it (C-D4 / GD-36,
the same discipline the ``mouseSampleGaps`` module keeps on the other side).

**Stage 1 segmentation is read, never recomputed** (D-61.P4 / F7): gaps arrive as ``Gap`` records
parsed from the committed golden, and their ``before_index`` / ``after_index`` index into the very
sample arrays this module reads. ``assert_block_matches_golden()` is what makes that pairing safe.

Pure: no plotting, no printing, no writes (C-D2). Reads are allowed, on the ``loader.py`` and
``golden.py`` precedent.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any

from lift.algorithms.golden import Gap, LiftGolden


class FeatureError(ValueError):
    """A malformed feature input, with a machine-readable JSON field path."""

    def __init__(self, field_path: str, message: str) -> None:
        self.field_path = field_path
        super().__init__(f"{field_path}: {message}")


@dataclass(frozen=True)
class SampleBlock:
    """One export's columnar raw mouse block, with absolute sample times derived once.

    ``dt_us[i]`` is the interval **ending** at sample ``i`` and ``dx[i]`` / ``dy[i]`` is the
    displacement accumulated over that interval, so sample 0 has no predecessor and carries
    ``dt_us[0] == 0`` by the export contract. ``times_ms`` accumulates in integer microseconds
    before converting, mirroring ``segmentByTimeGap()`` exactly -- a per-sample float accumulation
    here would drift away from the TS times the golden was cut with.
    """

    t0_ms: float
    dt_us: tuple[int, ...]
    dx: tuple[float, ...]
    dy: tuple[float, ...]
    times_ms: tuple[float, ...]

    def __len__(self) -> int:
        return len(self.dt_us)


def parse_sample_block(payload: Any, field_path: str = "mouseSamples") -> SampleBlock:
    """Validate an already-loaded ``mouseSamples`` block. Field paths name the offending key."""

    block = _mapping(payload, field_path)
    t0_ms = _number(_required(block, "t0Ms", f"{field_path}.t0Ms"), f"{field_path}.t0Ms")

    dt_us_raw = _list(_required(block, "dtUs", f"{field_path}.dtUs"), f"{field_path}.dtUs")
    dx_raw = _list(_required(block, "dx", f"{field_path}.dx"), f"{field_path}.dx")
    dy_raw = _list(_required(block, "dy", f"{field_path}.dy"), f"{field_path}.dy")
    if len(dx_raw) != len(dt_us_raw):
        raise FeatureError(f"{field_path}.dx", f"length {len(dx_raw)} does not match dtUs length {len(dt_us_raw)}")
    if len(dy_raw) != len(dt_us_raw):
        raise FeatureError(f"{field_path}.dy", f"length {len(dy_raw)} does not match dtUs length {len(dt_us_raw)}")

    dt_us: list[int] = []
    for index, value in enumerate(dt_us_raw):
        number = _number(value, f"{field_path}.dtUs[{index}]")
        if number < 0:
            raise FeatureError(f"{field_path}.dtUs[{index}]", "must be non-negative")
        dt_us.append(int(number))

    dx = tuple(_number(value, f"{field_path}.dx[{index}]") for index, value in enumerate(dx_raw))
    dy = tuple(_number(value, f"{field_path}.dy[{index}]") for index, value in enumerate(dy_raw))

    times_ms: list[float] = []
    elapsed_us = 0
    for index in range(len(dt_us)):
        if index > 0:
            elapsed_us += dt_us[index]
        times_ms.append(t0_ms + elapsed_us / 1000)

    return SampleBlock(t0_ms=t0_ms, dt_us=tuple(dt_us), dx=dx, dy=dy, times_ms=tuple(times_ms))


def load_sample_block(path: Path) -> SampleBlock:
    """Read one export JSON and return its ``mouseSamples`` block.

    Only the block is taken. Ticks, events and participant metadata are none of this module's
    business -- the labels come from the golden's annotation intervals (FR-61.3), and a feature
    module that could see the event stream could learn to read the label off it.
    """

    source_path = Path(path)
    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise FeatureError("$", f"invalid JSON: {error.msg}") from error
    root = _mapping(payload, "$")
    if "mouseSamples" not in root:
        raise FeatureError("mouseSamples", f"is required ({source_path.name} was exported without raw sampling)")
    return parse_sample_block(root["mouseSamples"])


def assert_block_matches_golden(block: SampleBlock, golden: LiftGolden) -> tuple[str, ...]:
    """Return the byte-level mismatches between a block and the golden cut from it. Empty = paired.

    This is the check that makes the golden/export split safe. The golden owns Stage 1 and embeds
    the time channel; the export owns ``dx`` / ``dy``. If they are not the same recording, every
    boundary window in T3 would be read at indices that mean something else -- silently, with
    plausible-looking numbers out the far end. Comparing the whole time channel is cheap; being
    wrong about which run a feature came from is not recoverable.
    """

    mismatches: list[str] = []
    if len(block) != golden.sample_count:
        mismatches.append(f"sampleCount: golden {golden.sample_count} vs block {len(block)}")
        return tuple(mismatches)
    if block.t0_ms != golden.t0_ms:
        mismatches.append(f"t0Ms: golden {golden.t0_ms} vs block {block.t0_ms}")
    for index, (recorded, actual) in enumerate(zip(golden.dt_us, block.dt_us)):
        if recorded != actual:
            mismatches.append(f"dtUs[{index}]: golden {recorded} vs block {actual}")
            if len(mismatches) >= 8:
                mismatches.append("... further dtUs mismatches not listed")
                break
    return tuple(mismatches)


@dataclass(frozen=True)
class GapBoundaryKinematics:
    """The boundary profile of one candidate gap, in counts space (README section 2.3).

    ``None`` means *not computable from this window*, never 0: a window holding one sample has no
    speed and a window holding none has no tiny fraction, and reporting either as zero would put a
    fabricated "the mouse was still" into the evidence.
    """

    speed_before_counts_per_sec: float | None
    speed_after_counts_per_sec: float | None
    accel_enter_counts_per_sec2: float | None
    accel_exit_counts_per_sec2: float | None
    density_before_hz: float
    density_after_hz: float
    tiny_fraction_before: float | None
    tiny_fraction_after: float | None
    n_before: int
    n_after: int


BOUNDARY_FEATURE_COLUMNS = (
    "speed_before_counts_per_sec",
    "speed_after_counts_per_sec",
    "accel_enter_counts_per_sec2",
    "accel_exit_counts_per_sec2",
    "density_before_hz",
    "density_after_hz",
    "tiny_fraction_before",
    "tiny_fraction_after",
    "n_before",
    "n_after",
)


def sample_speed(block: SampleBlock, index: int) -> float | None:
    """Counts/s at one sample, or ``None`` where no interval exists (sample 0, or ``dt_us == 0``).

    Same arithmetic as the reference pipeline's ``hypot(DX, DY) / dtS`` -- deliberately, so layers 3
    and 4 can apply that pipeline's thresholds to this series rather than to a second definition of
    speed (see ``pa_parameters.py``).
    """

    if index <= 0 or index >= len(block):
        return None
    dt_us = block.dt_us[index]
    if dt_us <= 0:
        return None
    return math.hypot(block.dx[index], block.dy[index]) / (dt_us / 1e6)


def boundary_windows(block: SampleBlock, gap: Gap, window_ms: float) -> tuple[tuple[int, ...], tuple[int, ...]]:
    """Return ``(before_indices, after_indices)`` for one gap's boundary windows.

    * before = ``[gap.start_ms - window_ms, gap.start_ms]``, closed, so it **includes**
      ``before_index`` -- the last sample of the continuous stretch entering the gap.
    * after = ``(gap.end_ms, gap.end_ms + window_ms]``, open on the left, so it **excludes**
      ``after_index``.

    The asymmetry is deliberate and is the one modelling choice in this module. ``after_index`` is
    the sample whose own interval *is* the gap: its ``dt_us`` is the gap duration and its ``dx`` /
    ``dy`` is whatever displacement accumulated across it. Counting it as a post-gap sample would
    fold the gap's own displacement into the exit profile and drag every ``speed_after`` toward
    zero by construction -- the exit acceleration would then measure the gap length, which is the
    axis WP-60 already ruled out.
    """

    if not math.isfinite(window_ms) or window_ms <= 0:
        raise FeatureError("windowMs", "must be a positive finite number")
    n = len(block)
    if not 0 <= gap.before_index < n:
        raise FeatureError("gap.beforeIndex", f"{gap.before_index} is out of range for {n} samples")
    if not 0 <= gap.after_index < n:
        raise FeatureError("gap.afterIndex", f"{gap.after_index} is out of range for {n} samples")

    start_ms = block.times_ms[gap.before_index]
    end_ms = block.times_ms[gap.after_index]

    before: list[int] = []
    index = gap.before_index
    while index >= 0 and block.times_ms[index] >= start_ms - window_ms:
        before.append(index)
        index -= 1
    before.reverse()

    after: list[int] = []
    index = gap.after_index + 1
    while index < n and block.times_ms[index] <= end_ms + window_ms:
        after.append(index)
        index += 1

    return tuple(before), tuple(after)


def derive_gap_boundary_kinematics(
    block: SampleBlock,
    gap: Gap,
    window_ms: float,
    tiny_counts: float,
) -> GapBoundaryKinematics:
    """The boundary profile of one candidate gap.

    ``window_ms`` and ``tiny_counts`` have **no defaults**: both are conditioned on the recording
    hardware's event rate and CPI, and a module-level default would quietly lie on a different
    mouse. That is the discipline ``segmentByTimeGap()``'s ``gapThresholdMs`` already keeps
    (D-60.T3), and T3 sweeps ``window_ms`` rather than picking one.

    :raises FeatureError: ``window_ms`` non-positive or non-finite, ``tiny_counts`` negative or
        non-finite, or a gap index outside the block.
    """

    if not math.isfinite(tiny_counts) or tiny_counts < 0:
        raise FeatureError("tinyCounts", "must be a non-negative finite number")

    before, after = boundary_windows(block, gap, window_ms)
    window_s = window_ms / 1000

    return GapBoundaryKinematics(
        speed_before_counts_per_sec=_mean_speed(block, before),
        speed_after_counts_per_sec=_mean_speed(block, after),
        accel_enter_counts_per_sec2=_window_accel(block, before),
        accel_exit_counts_per_sec2=_window_accel(block, after),
        density_before_hz=len(before) / window_s,
        density_after_hz=len(after) / window_s,
        tiny_fraction_before=_tiny_fraction(block, before, tiny_counts),
        tiny_fraction_after=_tiny_fraction(block, after, tiny_counts),
        n_before=len(before),
        n_after=len(after),
    )


def _mean_speed(block: SampleBlock, indices: tuple[int, ...]) -> float | None:
    """Mean counts/s over a window, or ``None`` when fewer than two samples carry a speed."""

    speeds = [speed for speed in (sample_speed(block, index) for index in indices) if speed is not None]
    if len(speeds) < 2:
        return None
    return sum(speeds) / len(speeds)


def _window_accel(block: SampleBlock, indices: tuple[int, ...]) -> float | None:
    """Rate of change of speed across a window (counts/s^2), or ``None`` when undefined.

    Signed: entering a gap the speed falls, so ``accel_enter`` is normally negative, and leaving one
    it rises, so ``accel_exit`` is normally positive. The sign is the direction of the profile and
    is not absorbed -- "decelerating into the gap" and "accelerating into the gap" are different
    events and an absolute value would make them the same number.
    """

    timed = [
        (block.times_ms[index], speed)
        for index, speed in ((index, sample_speed(block, index)) for index in indices)
        if speed is not None
    ]
    if len(timed) < 2:
        return None
    span_s = (timed[-1][0] - timed[0][0]) / 1000
    if span_s <= 0:
        return None
    return (timed[-1][1] - timed[0][1]) / span_s


def _tiny_fraction(block: SampleBlock, indices: tuple[int, ...], tiny_counts: float) -> float | None:
    """Share of window samples whose ``|dx| + |dy|`` is at or under ``tiny_counts``.

    A tremor proxy. README section 1.4 predicts it may be degenerate on this hardware -- if the hand
    pause sits below the sensor threshold there is nothing to be a fraction *of* -- and T3's DoD
    requires that outcome to be reported rather than quietly averaged into a layer's score.
    """

    if not indices:
        return None
    tiny = sum(1 for index in indices if abs(block.dx[index]) + abs(block.dy[index]) <= tiny_counts)
    return tiny / len(indices)


def _required(container: dict[str, Any], field: str, field_path: str) -> Any:
    if field not in container:
        raise FeatureError(field_path, "is required")
    return container[field]


def _mapping(value: Any, field_path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise FeatureError(field_path, "must be an object")
    return value


def _list(value: Any, field_path: str) -> list[Any]:
    if not isinstance(value, list):
        raise FeatureError(field_path, "must be an array")
    return value


def _number(value: Any, field_path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise FeatureError(field_path, "must be a number")
    if not math.isfinite(float(value)):
        raise FeatureError(field_path, "must be finite")
    return float(value)
