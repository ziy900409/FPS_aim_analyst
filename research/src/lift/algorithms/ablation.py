"""WP-61 T3: the four-layer separability ablation and the frozen decision rule (FR-61.6).

**The ablation is not a search for the best classifier.** It answers one question per layer: does
adding *this* information make lift more separable from pause and from an ordinary counter-strafe
stop, and by how much. Layers may therefore only be added, never re-tuned once a later layer exists
(T3 step 6), and the negative answer is a first-class result (FR-61.8 / R3).

    layer 1  gap only            duration >= d
    layer 2  + boundary          layer 1 and one boundary-kinematic threshold
    layer 3  + spike analogue    layer 2 and the reference stage 2 rule
    layer 4  + hover analogue    layer 3 and not the reference stage 3 rule

Two properties of that shape are deliberate:

* **Each layer is a conjunction over its predecessor**, so recall can only fall and the "gain" of a
  layer is exactly what its own rule bought in precision. A layer free to re-open cases the previous
  one closed would make per-layer attribution meaningless.
* **Only layers 1 and 2 fit anything.** Layer 1 fits one threshold and layer 2 fits one axis, one
  direction and one threshold; layers 3 and 4 apply the reference pipeline's own priors with nothing
  fitted at all. With the floor at 30 events per class (NFR-61.7) that is close to the most any
  honest fit can spend, and it is what keeps R4 (overfitting) from being decided by this module's
  appetite. Held-out is scored once, after calibration has frozen (FR-61.7 / T3 step 7).

Pure: no plotting, no printing, no writes (C-D2). Nothing here reads a clock or an unseeded RNG.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
import math

from lift.algorithms.candidates import MATCH_TOLERANCE_MS, THETA_SWEEP_MS, build_candidate_table
from lift.algorithms.features import GapBoundaryKinematics, SampleBlock, derive_gap_boundary_kinematics, sample_speed
from lift.algorithms.golden import Gap, LiftGolden
from lift.algorithms.pa_parameters import BOUNDARY_WINDOW_SWEEP_MS, TINY_COUNTS, counts_value


CONTRACT = "sensor-lift-validation-v1"

LAYERS = ("gap-only", "boundary", "spike-analogue", "hover-analogue")
"""Layer identifiers, in the only order they may be evaluated."""


# ── the frozen promotion gate (T0, README section 2.4) ───────────────────────────────────────────

MIN_HELD_OUT_PRECISION = 0.90
MIN_HELD_OUT_RECALL = 0.80
MIN_HELD_OUT_F1 = 0.85
MAX_PAUSE_FALSE_POSITIVE_RATE = 0.10
MAX_ONESHOT_FALSE_POSITIVE_RATE = 0.05
MAX_CALIBRATION_MINUS_HELD_OUT_F1 = 0.10

MIN_SESSIONS = 2
MIN_LIFT_INTERVALS = 30
MIN_PAUSE_INTERVALS = 30
MIN_HELD_OUT_PER_CLASS = 10

VERDICTS = ("promote", "not-reliably-separable", "blocked-by-data", "annotation-channel-unusable")
"""The four outcomes T0's decision rule can produce. T3's own task file calls the data-shortfall
outcome ``insufficient-evidence``; it is the same outcome, and the frozen rule's wording wins."""


# ── one scored candidate ─────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ScoredCandidate:
    """One candidate gap, its label, and everything the four layers are allowed to look at.

    ``label`` and ``negative_group`` come from ``candidates.py`` -- that is, from the operator's
    annotation and nothing else (FR-61.3). No field here is derived from the label.
    """

    run_id: str
    session_id: str
    instruction_class: str
    theta_ms: float
    gap_index: int
    duration_ms: float
    label: str
    negative_group: str
    boundary: GapBoundaryKinematics
    spike_analogue: bool
    hover_analogue: bool

    @property
    def is_lift(self) -> bool:
        return self.label == "lift"


BOUNDARY_AXES = (
    "speed_before_counts_per_sec",
    "speed_after_counts_per_sec",
    "accel_enter_counts_per_sec2",
    "accel_exit_counts_per_sec2",
    "density_before_hz",
    "density_after_hz",
    "tiny_fraction_before",
    "tiny_fraction_after",
)
"""The axes layer 2 may choose between -- one of them, not a combination. Declared here rather than
discovered from the data so the choice is a selection among named alternatives, not a search."""


# ── layer 3 / 4: the reference analogues ─────────────────────────────────────────────────────────


def spike_analogue(block: SampleBlock, gap: Gap) -> bool:
    """The reference stage 2 rule, read as evidence *for* a lift rather than as a trim.

    The source removes two shapes it calls kinematic spikes, using the words "landing" for the
    touchdown after a lift and "takeoff" for the braking before one. A landing is an acceleration
    above the up threshold while the sample's own speed is still at or under the start-speed gate; a
    takeoff is a deceleration steeper than the up threshold scaled by the asymmetry ratio, while the
    *previous* sample's speed is at or under that same gate.

    Both are reproduced here, on the first pair of samples of the continuous stretch after the gap,
    with the source's own acceleration arithmetic (``(speed(k) - speed(k-1)) / dt(k-1)``). A
    candidate passes the layer when either fires.

    **On this cohort's hardware neither can fire, and that is arithmetic rather than an accident** --
    see ``stage_2_reachability()``. Two departures from the source are recorded in
    ``pa_parameters.NOT_PORTED``: no click immunity (this layer cannot see the fire stream) and no
    nominal-dt fallback. Both make this rule strictly more willing to fire than the original, so the
    unreachability below is not an artefact of having ported it too strictly.
    """

    landing = gap.after_index + 1
    speed_here = sample_speed(block, landing)
    speed_prev = sample_speed(block, gap.after_index)
    if speed_here is None or speed_prev is None:
        return False
    dt_prev_s = block.dt_us[gap.after_index] / 1e6
    if dt_prev_s <= 0:
        return False

    accel = (speed_here - speed_prev) / dt_prev_s
    up_threshold = counts_value("ACCEL_UP_THRESHOLD_PX_S2")
    gate = counts_value("START_SPEED_GATE_PX_S")
    down_threshold = up_threshold * max(1.0, counts_value("ACCEL_DOWN_RATIO"))

    is_landing = accel > up_threshold and speed_here <= gate
    is_takeoff = accel < -down_threshold and speed_prev <= gate
    return is_landing or is_takeoff


@dataclass(frozen=True)
class StageTwoReachability:
    """Whether the reference stage 2 rule *can* fire at a given sample spacing, and by how much.

    The two conditions of each branch pull against each other. Firing needs a speed change of more
    than ``threshold * dt``; the start-speed gate simultaneously caps how large that change can be,
    because speeds are non-negative. At 1 ms spacing the required change (350 counts/s) exceeds the
    largest change the gate permits (300 counts/s), so the branch is unreachable -- for any data, on
    any mouse, with any CPI. Shrink the spacing and the required change shrinks with it until the
    two cross.

    This is reported rather than worked around. A layer that cannot fire contributes exactly zero
    gain, and a zero gain that comes from arithmetic is a different finding from one that comes from
    the boundaries genuinely looking alike (T3 step 6 / DoD).
    """

    sample_spacing_ms: float
    landing_required_speed_change: float
    takeoff_required_speed_change: float
    largest_possible_speed_change: float
    landing_reachable: bool
    takeoff_reachable: bool

    @property
    def reachable(self) -> bool:
        return self.landing_reachable or self.takeoff_reachable


def stage_2_reachability(sample_spacing_ms: float) -> StageTwoReachability:
    """Decide, from the parameters alone, whether either stage 2 branch can fire at this spacing."""

    dt_s = sample_spacing_ms / 1000
    gate = counts_value("START_SPEED_GATE_PX_S")
    landing_required = counts_value("ACCEL_UP_THRESHOLD_PX_S2") * dt_s
    takeoff_required = counts_value("ACCEL_UP_THRESHOLD_PX_S2") * max(1.0, counts_value("ACCEL_DOWN_RATIO")) * dt_s
    return StageTwoReachability(
        sample_spacing_ms=sample_spacing_ms,
        landing_required_speed_change=landing_required,
        takeoff_required_speed_change=takeoff_required,
        largest_possible_speed_change=gate,
        landing_reachable=landing_required < gate,
        takeoff_reachable=takeoff_required < gate,
    )


def hover_analogue(block: SampleBlock, gap: Gap) -> bool:
    """The reference stage 3 rule: does the boundary look like a hovering, jittering hand.

    The source rejects a window as hover when its mean speed is under the hover velocity threshold
    **and** the variance of its direction changes is above the variance threshold -- unless the
    window's total displacement is under the deadzone, in which case it is "stationary dwell" and
    the check is skipped entirely. All three parts are reproduced, including the skip.

    ``True`` means "this boundary looks like hover", i.e. evidence *against* a lift; layer 4 negates
    it. README section 1.4 predicts the deadzone skip may swallow every pause window on this
    hardware, in which case this rule never fires and layer 4 is a no-op -- which is a finding to
    report, not a bug to work around.
    """

    window_samples = _hover_window_samples(block, gap)
    if len(window_samples) < int(counts_value("MIN_STROKE_POINTS")):
        return False

    displacement = sum(abs(block.dx[index]) + abs(block.dy[index]) for index in window_samples)
    if displacement < counts_value("DEADZONE_COUNTS"):
        return False  # stationary dwell, not jitter -- the source skips the angular check here.

    speeds = [sample_speed(block, index) for index in window_samples]
    if any(speed is None for speed in speeds):
        return False
    mean_speed = sum(speed for speed in speeds if speed is not None) / len(speeds)
    if mean_speed >= counts_value("HOVER_VELOCITY_THRESHOLD_PX_S"):
        return False

    return _direction_change_variance(block, window_samples) > counts_value("HOVER_VARIANCE_THRESHOLD")


def _hover_window_samples(block: SampleBlock, gap: Gap) -> tuple[int, ...]:
    """The hover window: the samples entering the gap, spanning the source's hover window length."""

    window_ms = counts_value("HOVER_WINDOW_MS")
    end_ms = block.times_ms[gap.before_index]
    indices: list[int] = []
    index = gap.before_index
    while index >= 1 and block.times_ms[index] >= end_ms - window_ms:
        indices.append(index)
        index -= 1
    indices.reverse()
    return tuple(indices)


def _direction_change_variance(block: SampleBlock, indices: tuple[int, ...]) -> float:
    """Variance of the wrapped change in movement direction across a window (rad^2)."""

    thetas = [math.atan2(block.dy[index], block.dx[index]) for index in indices]
    deltas: list[float] = []
    for previous, current in zip(thetas, thetas[1:]):
        delta = current - previous
        while delta > math.pi:
            delta -= 2 * math.pi
        while delta < -math.pi:
            delta += 2 * math.pi
        deltas.append(delta)
    if not deltas:
        return 0.0
    mean = sum(deltas) / len(deltas)
    return sum(delta * delta for delta in deltas) / len(deltas) - mean * mean


def score_candidates(
    goldens: tuple[LiftGolden, ...],
    blocks: dict[str, SampleBlock],
    window_ms: float,
    theta_sweep_ms: tuple[float, ...] = THETA_SWEEP_MS,
    tolerance_ms: float = MATCH_TOLERANCE_MS,
    tiny_counts: float = TINY_COUNTS,
) -> tuple[ScoredCandidate, ...]:
    """Attach the layer inputs to T2's candidate table, for one boundary-window length.

    The labels are **not** recomputed here: ``build_candidate_table()`` is called and its rows are
    taken as given. That is the whole point -- T2 already tested the frozen matching rule, and a
    second labelling pass in T3 would be a second definition of the thing being measured (C-D4), as
    well as a place for the label to quietly acquire a dependence on a feature.

    ``blocks`` is keyed by ``run_id``. A golden without a block raises rather than being skipped: a
    run silently dropped from the ablation would move every denominator in the report.
    """

    table = build_candidate_table(goldens, theta_sweep_ms, tolerance_ms)
    gaps_by_key = {
        (golden.run_id, segmentation.theta_ms, gap.index): gap
        for golden in goldens
        for segmentation in golden.segmentations
        for gap in segmentation.gaps
    }

    for golden in goldens:
        if golden.run_id not in blocks:
            raise KeyError(f"no sample block supplied for run {golden.run_id!r}")

    scored: list[ScoredCandidate] = []
    for row in table.itertuples(index=False):
        block = blocks[row.run_id]
        gap = gaps_by_key[(row.run_id, row.theta_ms, row.gap_index)]
        scored.append(
            ScoredCandidate(
                run_id=row.run_id,
                session_id=row.session_id,
                instruction_class=row.instruction_class,
                theta_ms=float(row.theta_ms),
                gap_index=int(row.gap_index),
                duration_ms=float(row.duration_ms),
                label=row.label,
                negative_group=row.negative_group,
                boundary=derive_gap_boundary_kinematics(block, gap, window_ms, tiny_counts),
                spike_analogue=spike_analogue(block, gap),
                hover_analogue=hover_analogue(block, gap),
            )
        )
    return tuple(scored)


# ── the layer rules ──────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LayerRule:
    """The fitted rule at one layer. Later layers extend it; they never rewrite what came before."""

    layer: str
    min_duration_ms: float
    boundary_axis: str | None = None
    boundary_direction: str | None = None
    boundary_threshold: float | None = None

    def describe(self) -> str:
        parts = [f"duration >= {self.min_duration_ms:g} ms"]
        if self.boundary_axis is not None:
            parts.append(f"{self.boundary_axis} {self.boundary_direction} {self.boundary_threshold:g}")
        if self.layer in ("spike-analogue", "hover-analogue"):
            parts.append("stage-2 analogue fires")
        if self.layer == "hover-analogue":
            parts.append("stage-3 analogue does not fire")
        return " and ".join(parts)

    def predict(self, candidate: ScoredCandidate) -> bool:
        if candidate.duration_ms < self.min_duration_ms:
            return False
        if self.boundary_axis is not None:
            value = getattr(candidate.boundary, self.boundary_axis)
            # An axis that could not be computed for this candidate does not get to vote. Treating a
            # missing window as a passing one would let sparse boundaries in for free.
            if value is None:
                return False
            if self.boundary_direction == ">=" and not value >= self.boundary_threshold:
                return False
            if self.boundary_direction == "<=" and not value <= self.boundary_threshold:
                return False
        if self.layer in ("spike-analogue", "hover-analogue") and not candidate.spike_analogue:
            return False
        if self.layer == "hover-analogue" and candidate.hover_analogue:
            return False
        return True


# ── metrics ──────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ConfusionMatrix:
    true_positive: int
    false_positive: int
    false_negative: int
    true_negative: int

    @property
    def precision(self) -> float | None:
        predicted = self.true_positive + self.false_positive
        return None if predicted == 0 else self.true_positive / predicted

    @property
    def recall(self) -> float | None:
        actual = self.true_positive + self.false_negative
        return None if actual == 0 else self.true_positive / actual

    @property
    def f1(self) -> float | None:
        precision, recall = self.precision, self.recall
        if precision is None or recall is None or precision + recall == 0:
            return None
        return 2 * precision * recall / (precision + recall)


@dataclass(frozen=True)
class LayerResult:
    """One (theta, window, layer, split) cell of the ablation. Every field the DoD names is here."""

    theta_ms: float
    window_ms: float
    layer: str
    split: str
    rule: LayerRule
    matrix: ConfusionMatrix
    pause_false_positive_rate: float | None
    oneshot_false_positive_rate: float | None
    background_false_positives: int
    f1_gain_over_previous_layer: float | None
    candidate_count: int


def confusion_matrix(candidates: tuple[ScoredCandidate, ...], rule: LayerRule) -> ConfusionMatrix:
    true_positive = false_positive = false_negative = true_negative = 0
    for candidate in candidates:
        predicted = rule.predict(candidate)
        if candidate.is_lift and predicted:
            true_positive += 1
        elif candidate.is_lift:
            false_negative += 1
        elif predicted:
            false_positive += 1
        else:
            true_negative += 1
    return ConfusionMatrix(true_positive, false_positive, false_negative, true_negative)


def _group_false_positive_rate(
    candidates: tuple[ScoredCandidate, ...], rule: LayerRule, group: str
) -> float | None:
    """Share of one negative group the rule flags. ``None`` when the group is empty.

    ``None`` rather than 0.0 is load-bearing: an empty group means the rate was never measured, and a
    0.0 there would satisfy the frozen ceiling without any evidence having been produced.
    """

    members = [candidate for candidate in candidates if candidate.negative_group == group]
    if not members:
        return None
    return sum(1 for candidate in members if rule.predict(candidate)) / len(members)


# ── fitting (calibration only) ───────────────────────────────────────────────────────────────────


def _duration_grid(candidates: tuple[ScoredCandidate, ...], theta_ms: float) -> tuple[float, ...]:
    """Candidate duration thresholds: the observed durations, plus theta as the do-nothing floor.

    Using the observed values rather than a fixed ladder means the grid cannot be too coarse to find
    a split that exists -- which matters because layer 1 is the control the later layers are scored
    against, and a hobbled control would manufacture gains for them.
    """

    return tuple(sorted({theta_ms} | {candidate.duration_ms for candidate in candidates}))


def _axis_grid(candidates: tuple[ScoredCandidate, ...], axis: str) -> tuple[float, ...]:
    values = sorted({getattr(candidate.boundary, axis) for candidate in candidates} - {None})
    return tuple(float(value) for value in values)


def _better(new: tuple[float, ...], best: tuple[float, ...] | None) -> bool:
    return best is None or new > best


def fit_gap_only(candidates: tuple[ScoredCandidate, ...], theta_ms: float) -> LayerRule:
    """Layer 1: the single duration threshold maximising F1 on the calibration set.

    Ties break toward the **larger** threshold, then toward the smaller value of nothing else -- a
    deterministic order, so the same calibration set always yields the same rule (NFR-61.5).
    """

    best_rule = LayerRule(layer=LAYERS[0], min_duration_ms=theta_ms)
    best_key: tuple[float, ...] | None = None
    for threshold in _duration_grid(candidates, theta_ms):
        rule = LayerRule(layer=LAYERS[0], min_duration_ms=threshold)
        matrix = confusion_matrix(candidates, rule)
        key = (matrix.f1 or 0.0, matrix.precision or 0.0, threshold)
        if _better(key, best_key):
            best_key, best_rule = key, rule
    return best_rule


def fit_boundary(candidates: tuple[ScoredCandidate, ...], previous: LayerRule) -> LayerRule:
    """Layer 2: one axis, one direction, one threshold, added on top of a frozen layer 1.

    The duration threshold is inherited unchanged -- re-fitting it here is exactly the move T3 step 6
    forbids, because the gain would then be attributable to neither layer.
    """

    best_rule = replace(previous, layer=LAYERS[1])
    best_key: tuple[float, ...] | None = None
    for axis_index, axis in enumerate(BOUNDARY_AXES):
        for direction_index, direction in enumerate((">=", "<=")):
            for threshold in _axis_grid(candidates, axis):
                rule = replace(
                    previous,
                    layer=LAYERS[1],
                    boundary_axis=axis,
                    boundary_direction=direction,
                    boundary_threshold=threshold,
                )
                matrix = confusion_matrix(candidates, rule)
                key = (matrix.f1 or 0.0, matrix.precision or 0.0, -axis_index, -direction_index, -threshold)
                if _better(key, best_key):
                    best_key, best_rule = key, rule
    return best_rule


def fit_layers(candidates: tuple[ScoredCandidate, ...], theta_ms: float) -> tuple[LayerRule, ...]:
    """The four rules, in order. Layers 3 and 4 fit nothing -- they only add the reference gates."""

    gap_only = fit_gap_only(candidates, theta_ms)
    boundary = fit_boundary(candidates, gap_only)
    return (
        gap_only,
        boundary,
        replace(boundary, layer=LAYERS[2]),
        replace(boundary, layer=LAYERS[3]),
    )


# ── evaluation ───────────────────────────────────────────────────────────────────────────────────


def evaluate_layers(
    candidates: tuple[ScoredCandidate, ...],
    rules: tuple[LayerRule, ...],
    theta_ms: float,
    window_ms: float,
    split: str,
) -> tuple[LayerResult, ...]:
    """Score every layer on one split, carrying each layer's gain over its predecessor."""

    results: list[LayerResult] = []
    previous_f1: float | None = None
    for rule in rules:
        matrix = confusion_matrix(candidates, rule)
        f1 = matrix.f1
        gain = None if f1 is None or previous_f1 is None else f1 - previous_f1
        results.append(
            LayerResult(
                theta_ms=theta_ms,
                window_ms=window_ms,
                layer=rule.layer,
                split=split,
                rule=rule,
                matrix=matrix,
                pause_false_positive_rate=_group_false_positive_rate(candidates, rule, "pause"),
                oneshot_false_positive_rate=_group_false_positive_rate(candidates, rule, "oneshot"),
                background_false_positives=sum(
                    1 for candidate in candidates if candidate.negative_group == "background" and rule.predict(candidate)
                ),
                f1_gain_over_previous_layer=gain,
                candidate_count=len(candidates),
            )
        )
        previous_f1 = f1 if f1 is not None else previous_f1
    return tuple(results)


BOOTSTRAP_RESAMPLES = 2000
BOOTSTRAP_SEED = 61
"""The only randomness in T3. Both are written down so a rerun reproduces the report byte for byte
(NFR-61.5); the seed is echoed into the report so a number can never be quoted without it."""


@dataclass(frozen=True)
class F1Interval:
    """A percentile bootstrap interval for F1, with the seed that produced it."""

    seed: int
    resamples: int
    low: float | None
    high: float | None


def bootstrap_f1_interval(
    candidates: tuple[ScoredCandidate, ...],
    rule: LayerRule,
    seed: int = BOOTSTRAP_SEED,
    resamples: int = BOOTSTRAP_RESAMPLES,
    percentiles: tuple[float, float] = (2.5, 97.5),
) -> F1Interval:
    """Resample candidates with replacement and report the F1 percentile interval.

    Resampling is over **candidates**, not sessions, so this interval speaks to sampling noise
    within the cohort and not to whether another operator would look the same -- OQ-61.6 already
    caps that claim, and a wider-sounding interval must not be read as covering it.

    A resample in which no candidate is a lift has no F1 at all; those are dropped rather than
    scored 0, and an interval built from fewer than a tenth of the resamples is refused outright.
    """

    import numpy as np

    if not candidates:
        return F1Interval(seed, resamples, None, None)

    generator = np.random.default_rng(seed)
    indices = generator.integers(0, len(candidates), size=(resamples, len(candidates)))

    scores: list[float] = []
    for row in indices:
        resampled = tuple(candidates[index] for index in row)
        f1 = confusion_matrix(resampled, rule).f1
        if f1 is not None:
            scores.append(f1)

    if len(scores) < resamples // 10:
        return F1Interval(seed, resamples, None, None)
    low, high = np.percentile(scores, percentiles)
    return F1Interval(seed, resamples, float(low), float(high))


# ── the session split (FR-61.7) ──────────────────────────────────────────────────────────────────


def split_sessions(goldens: tuple[LiftGolden, ...]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """Frozen 50/50 session split: sessions in manifest order, first half calibrates.

    Session isolation is the whole point -- a session appearing on both sides would make held-out a
    second calibration set wearing a different name. With a single session there is no legal split,
    and this returns it as calibration with an empty held-out rather than inventing one; the
    sufficiency gate then refuses on the held-out floors.
    """

    ordered: list[str] = []
    for golden in goldens:
        if golden.session_id not in ordered:
            ordered.append(golden.session_id)
    midpoint = len(ordered) // 2 if len(ordered) > 1 else len(ordered)
    return tuple(ordered[:midpoint] or ordered), tuple(ordered[midpoint:] if len(ordered) > 1 else ())


def select(candidates: tuple[ScoredCandidate, ...], sessions: tuple[str, ...]) -> tuple[ScoredCandidate, ...]:
    return tuple(candidate for candidate in candidates if candidate.session_id in sessions)


# ── the frozen decision rule (T0, README section 2.4) ────────────────────────────────────────────


@dataclass(frozen=True)
class GateCheck:
    """One row of the "rule text -> actual value -> verdict" table the DoD requires."""

    rule: str
    actual: str
    passed: bool


@dataclass(frozen=True)
class SufficiencyReport:
    sessions: int
    lift_intervals: int
    pause_intervals: int
    held_out_lift_intervals: int
    held_out_pause_intervals: int
    checks: tuple[GateCheck, ...]

    @property
    def sufficient(self) -> bool:
        return all(check.passed for check in self.checks)


def assess_sufficiency(
    goldens: tuple[LiftGolden, ...],
    held_out_sessions: tuple[str, ...],
) -> SufficiencyReport:
    """Apply NFR-61.7's frozen floors to the annotation intervals actually present.

    Counted over annotation intervals, not over candidate gaps: the floor is about how much operator
    ground truth exists, and a run whose annotations all fell outside the tolerance would otherwise
    look well-supplied because it still produced gaps.
    """

    sessions = {golden.session_id for golden in goldens}
    lift = sum(len(g.annotation_intervals) for g in goldens if g.instruction_class == "lift")
    pause = sum(len(g.annotation_intervals) for g in goldens if g.instruction_class == "pause")
    held_lift = sum(
        len(g.annotation_intervals)
        for g in goldens
        if g.instruction_class == "lift" and g.session_id in held_out_sessions
    )
    held_pause = sum(
        len(g.annotation_intervals)
        for g in goldens
        if g.instruction_class == "pause" and g.session_id in held_out_sessions
    )

    checks = (
        GateCheck(f"independent sessions >= {MIN_SESSIONS}", str(len(sessions)), len(sessions) >= MIN_SESSIONS),
        GateCheck(f"lift annotation intervals >= {MIN_LIFT_INTERVALS}", str(lift), lift >= MIN_LIFT_INTERVALS),
        GateCheck(f"pause annotation intervals >= {MIN_PAUSE_INTERVALS}", str(pause), pause >= MIN_PAUSE_INTERVALS),
        GateCheck(
            f"held-out lift intervals >= {MIN_HELD_OUT_PER_CLASS}",
            str(held_lift),
            held_lift >= MIN_HELD_OUT_PER_CLASS,
        ),
        GateCheck(
            f"held-out pause intervals >= {MIN_HELD_OUT_PER_CLASS}",
            str(held_pause),
            held_pause >= MIN_HELD_OUT_PER_CLASS,
        ),
    )
    return SufficiencyReport(len(sessions), lift, pause, held_lift, held_pause, checks)


def promotion_checks(calibration: LayerResult, held_out: LayerResult) -> tuple[GateCheck, ...]:
    """The frozen promotion gate, as six literal conditions with the measured value beside each."""

    matrix = held_out.matrix
    calibration_f1, held_out_f1 = calibration.matrix.f1, matrix.f1
    delta = None if calibration_f1 is None or held_out_f1 is None else calibration_f1 - held_out_f1

    return (
        _threshold_check("held-out precision", matrix.precision, MIN_HELD_OUT_PRECISION, at_least=True),
        _threshold_check("held-out recall", matrix.recall, MIN_HELD_OUT_RECALL, at_least=True),
        _threshold_check("held-out F1", held_out_f1, MIN_HELD_OUT_F1, at_least=True),
        _threshold_check(
            "pause false-positive rate", held_out.pause_false_positive_rate, MAX_PAUSE_FALSE_POSITIVE_RATE, at_least=False
        ),
        _threshold_check(
            "oneshot false-positive rate",
            held_out.oneshot_false_positive_rate,
            MAX_ONESHOT_FALSE_POSITIVE_RATE,
            at_least=False,
        ),
        _threshold_check(
            "calibration F1 - held-out F1", delta, MAX_CALIBRATION_MINUS_HELD_OUT_F1, at_least=False
        ),
    )


def _threshold_check(name: str, value: float | None, threshold: float, at_least: bool) -> GateCheck:
    """One frozen condition. An unmeasurable value fails -- it is not evidence of passing."""

    comparator = ">=" if at_least else "<="
    rule = f"{name} {comparator} {threshold:g}"
    if value is None:
        return GateCheck(rule, "not measurable (empty denominator)", False)
    passed = value >= threshold if at_least else value <= threshold
    return GateCheck(rule, f"{value:.4f}", passed)


@dataclass(frozen=True)
class Verdict:
    verdict: str
    reason: str
    sufficiency: SufficiencyReport
    promoting_cell: tuple[float, float, str] | None
    checks: tuple[GateCheck, ...]


def decide(
    sufficiency: SufficiencyReport,
    paired_results: tuple[tuple[LayerResult, LayerResult], ...],
    annotation_channel_usable: bool = True,
) -> Verdict:
    """Apply T0's decision rule literally. This function may not introduce a threshold of its own.

    Order matters and is the frozen rule's own: an unusable annotation channel or insufficient data
    is decided *before* any layer is looked at, because a metric computed on either is not evidence
    about separability -- reporting "not separable" from a starved cohort would be a claim the data
    cannot support (F2 / R3).
    """

    if not annotation_channel_usable:
        return Verdict(
            "annotation-channel-unusable",
            "F3 found the self-report channel unusable; separability was not evaluated.",
            sufficiency,
            None,
            sufficiency.checks,
        )

    if not sufficiency.sufficient:
        shortfalls = "; ".join(f"{check.rule} (actual {check.actual})" for check in sufficiency.checks if not check.passed)
        return Verdict(
            "blocked-by-data",
            f"Frozen data-sufficiency floors not met: {shortfalls}.",
            sufficiency,
            None,
            sufficiency.checks,
        )

    for calibration, held_out in paired_results:
        checks = promotion_checks(calibration, held_out)
        if all(check.passed for check in checks):
            return Verdict(
                "promote",
                f"theta={calibration.theta_ms:g} ms, window={calibration.window_ms:g} ms, "
                f"layer={calibration.layer} met every frozen threshold on held-out.",
                sufficiency,
                (calibration.theta_ms, calibration.window_ms, calibration.layer),
                checks,
            )

    return Verdict(
        "not-reliably-separable",
        "Data and annotation gates passed; no theta x window x layer met the frozen thresholds on held-out.",
        sufficiency,
        None,
        () if not paired_results else promotion_checks(*paired_results[0]),
    )


THETA_SWEEP = THETA_SWEEP_MS
WINDOW_SWEEP = BOUNDARY_WINDOW_SWEEP_MS
