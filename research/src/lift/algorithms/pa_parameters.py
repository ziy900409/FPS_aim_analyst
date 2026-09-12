"""WP-61 T3 layers 3 and 4: the reference pipeline's parameters, with their provenance (FR-61.10).

This module is the **only** place a reference-pipeline constant may be written down. Everything
downstream reads ``counts_value()``; nothing downstream may spell a source literal. That is F5's
mitigation, and F5 is not hypothetical -- a threshold carried across a unit boundary without being
converted lands an order of magnitude off and the result merely *looks* like it nearly separated.

**What the audit found, and it is not what the parameter names say.** Three parameters are named
``..._PX_S`` / ``..._PX_S2``, and WP-60's parameter copy flagged all three as "px/s space; must be
re-derived". Reading the reference implementation instead of the parameter file shows the names are
a misnomer: the runtime computes ``hypot(DX, DY) / dtS`` where ``DX`` / ``DY`` come straight off the
platform's raw-input buffer -- raw device counts, never scaled to pixels, with no CPI normalisation
anywhere in that module. Its own architecture record concedes the same thing from the other end
("Deadzone threshold is counts-based -- users with non-standard DPI may need manual config tuning").

So the carry-across is a **relabelling, not a rescaling**: the numeric value is unchanged and the
unit is corrected from px to counts. That is a weaker claim than it looks, and the two conditions it
rests on are recorded per parameter rather than assumed:

1. **Device CPI.** Counts/s is proportional to CPI. The reference capture's CPI is recorded nowhere
   in that repository, so the transfer is CPI-conditioned with an unknown source CPI. Every run this
   is applied to carries its own ``meta.dpi``, and T3 reports it alongside the result.
2. **One count per sample.** This project reads coalesced pointer events with unadjusted movement,
   so a sample is one device report only while the observed rate tracks the polling rate. T2's
   frozen usability gate already enforces that (active rate >= 500 Hz, ``overflow === false``); when
   it fails the run is void, and with it this assumption.

Pure: no plotting, no printing, no writes (C-D2).
"""

from __future__ import annotations

from dataclasses import dataclass


SOURCE_REPOSITORY = "performance_analysis"

SOURCE_CONFIG = "research/src/modules/input/algorithms/config/lod_v3_default_config.json"
SOURCE_CONFIG_COMMIT = "ff24223662ed33fafd7e421703e2433130645400"
"""The tracked copy. WP-60 cited ``contracts/modules/input/lod_v3_default_config.json``; that path
no longer exists and the file has since moved under ``research/``. Contents are byte-identical to
the untracked ``Algorithm_test/config/`` copy, checked at audit time."""

SOURCE_IMPLEMENTATION = "backend/modules/input/infrastructure/lodclean/service.go"
SOURCE_IMPLEMENTATION_COMMIT = "8e0d0694219873beed5f9302486a594aefa380af"
"""The runtime that shows what space the values are actually applied in -- the parameter file alone
would have carried the ``_PX_`` names across unchallenged."""

SOURCE_DECISION_RECORD = "docs/architecture/adr/002_lod_v3_design.md"
SOURCE_DECISION_RECORD_COMMIT = "e9c5c40eb5ce179ad9ba2ece8c8f0c0924291785"

AUDITED_AT_HEAD = "0e6f176e988230d5d3102d69d79e6fea8d09c035"
"""The source repository's HEAD when this table was read (2026-09-09)."""


@dataclass(frozen=True)
class ReferenceParameter:
    """One reference-pipeline constant and the four things FR-61.10 requires be recorded with it.

    ``source_space`` is what the implementation actually applies the value in; ``declared_space`` is
    what the parameter's own name claims. They differ for three parameters, and that difference is
    the finding, so both are kept rather than silently reconciled.
    """

    name: str
    source_value: float
    declared_space: str
    source_space: str
    counts_space_value: float
    basis: str


_STAGE_2 = (
    ReferenceParameter(
        name="ACCEL_UP_THRESHOLD_PX_S2",
        source_value=350_000.0,
        declared_space="px/s^2",
        source_space="counts/s^2",
        counts_space_value=350_000.0,
        basis=(
            "Applied in the runtime to accelerations built from raw-input DX/DY, never from pixels; "
            "value carried unchanged with the unit corrected. CPI-conditioned, source CPI unrecorded."
        ),
    ),
    ReferenceParameter(
        name="ACCEL_DOWN_RATIO",
        source_value=3.0,
        declared_space="dimensionless",
        source_space="dimensionless",
        counts_space_value=3.0,
        basis="A ratio between two accelerations in the same space; unit-free, carried unchanged.",
    ),
    ReferenceParameter(
        name="START_SPEED_GATE_PX_S",
        source_value=300.0,
        declared_space="px/s",
        source_space="counts/s",
        counts_space_value=300.0,
        basis=(
            "Same misnomer as the acceleration threshold: compared against hypot(DX, DY)/dt over raw "
            "counts. Carried unchanged, unit corrected, CPI-conditioned."
        ),
    ),
    ReferenceParameter(
        name="HEAD_SCAN_MS",
        source_value=20.0,
        declared_space="ms",
        source_space="ms",
        counts_space_value=20.0,
        basis=(
            "Time domain, transfers directly. It is also where this project's boundary-window prior "
            "comes from: the reference pipeline only trims within the head/tail scan of a stroke, "
            "which is the same region a candidate gap's boundary window covers."
        ),
    ),
    ReferenceParameter(
        name="TAIL_SCAN_MS",
        source_value=20.0,
        declared_space="ms",
        source_space="ms",
        counts_space_value=20.0,
        basis="Time domain, transfers directly. Mirror of the head scan; same window prior.",
    ),
)


_STAGE_3 = (
    ReferenceParameter(
        name="HOVER_WINDOW_MS",
        source_value=15.0,
        declared_space="ms",
        source_space="ms",
        counts_space_value=15.0,
        basis=(
            "Time domain, transfers directly. The runtime turns it into a sample count "
            "(round(window / median dt), floored at 3 and forced odd), so it carries a hidden "
            "dependence on event rate; at the ~1005 Hz measured here it resolves to 15 samples."
        ),
    ),
    ReferenceParameter(
        name="HOVER_VELOCITY_THRESHOLD_PX_S",
        source_value=1200.0,
        declared_space="px/s",
        source_space="counts/s",
        counts_space_value=1200.0,
        basis=(
            "Third instance of the misnomer: compared against the same raw-count speed series. "
            "Carried unchanged, unit corrected, CPI-conditioned."
        ),
    ),
    ReferenceParameter(
        name="HOVER_VARIANCE_THRESHOLD",
        source_value=0.35,
        declared_space="rad^2",
        source_space="rad^2",
        counts_space_value=0.35,
        basis=(
            "Variance of the change in movement direction. Direction is scale-free, so the value "
            "transfers without reference to counts, pixels or CPI."
        ),
    ),
    ReferenceParameter(
        name="DEADZONE_COUNTS",
        source_value=5.0,
        declared_space="counts",
        source_space="counts",
        counts_space_value=5.0,
        basis=(
            "Already counts on both sides, so no relabelling is needed -- but it is the parameter "
            "the source's own decision record singles out as CPI-sensitive, so the same "
            "CPI-conditioned caveat applies with no conversion to hide behind."
        ),
    ),
    ReferenceParameter(
        name="MIN_STROKE_POINTS",
        source_value=5.0,
        declared_space="samples",
        source_space="samples",
        counts_space_value=5.0,
        basis=(
            "A sample count, so it transfers only while the two event rates match. The source "
            "assumes ~1 ms nominal spacing and WP-60 R1 measured ~1005 Hz here, so it does."
        ),
    ),
)


REFERENCE_PARAMETERS = _STAGE_2 + _STAGE_3

STAGE_2_PARAMETERS = tuple(parameter.name for parameter in _STAGE_2)
STAGE_3_PARAMETERS = tuple(parameter.name for parameter in _STAGE_3)


NOT_PORTED = {
    "CLICK_IMMUNITY_MS": (
        "The reference pipeline unconditionally preserves samples near a click. Porting it would "
        "require the feature layer to read the fire event stream, and that layer is deliberately "
        "blind to events so it cannot learn to read a label off them (FR-61.3). Consequence, stated "
        "rather than hidden: this project's stage 2 analogue is the reference rule *without* click "
        "immunity, i.e. strictly more willing to flag."
    ),
    "GAP_CONFIRM_MS": (
        "Context window used to decide whether a sample is gap-adjacent. Every candidate here is a "
        "gap by construction, so the mask it feeds is trivially true and the parameter has nothing "
        "left to decide."
    ),
    "TIME_GAP_THRESHOLD_MS": (
        "Stage 1 belongs to segmentByTimeGap() on the other side, and its threshold is the frozen "
        "theta sweep (18/30/50 ms), not a single ported prior. Porting the value here would create "
        "a second Stage 1 threshold (F7 / D-61.P4)."
    ),
    "SAMPLE_INTERVAL_US_FALLBACK": (
        "The reference substitutes a nominal 1 ms whenever dt is non-positive. This project reports "
        "no speed at all for such a sample instead: a fabricated interval would turn 'no interval "
        "exists' into a measured speed, and sample 0 -- the only sample with dt == 0 by contract -- "
        "would acquire a velocity it cannot have."
    ),
}
"""Parameters deliberately left behind, each with the reason. An omission that is not written down
reads later as an oversight, and the click-immunity one in particular changes what the analogue is."""


def parameter(name: str) -> ReferenceParameter:
    """Look one parameter up by its source name."""

    for record in REFERENCE_PARAMETERS:
        if record.name == name:
            return record
    if name in NOT_PORTED:
        raise KeyError(f"{name} is deliberately not ported: {NOT_PORTED[name]}")
    raise KeyError(f"{name} is not a parameter of the ported reference set")


def counts_value(name: str) -> float:
    """The value in this project's space. The only accessor downstream code may use."""

    return parameter(name).counts_space_value


BOUNDARY_WINDOW_SWEEP_MS = (10.0, 20.0, 40.0)
"""Declared before layer 2 was run, as T3 step 3 requires.

20 ms is the reference pipeline's head/tail scan window, carried across as a prior; 10 and 40 ms
bracket it at half and double. At the ~1005 Hz observed here that is roughly 11 / 21 / 41 samples
per window, so even the narrowest holds enough samples for a mean speed to exist. All three are
reported; none is selected before the calibration split says so."""

TINY_COUNTS = counts_value("DEADZONE_COUNTS")
"""The tremor proxy's threshold, taken from the reference deadzone rather than invented. Same
CPI caveat as that parameter."""
