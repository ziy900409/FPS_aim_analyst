"""Read the committed Stage 1 segmentation golden produced by the TS side.

``segmentByTimeGap()`` is the **only** definition of Stage 1 segmentation (D-61.P4 / C-D4). A second
implementation here would make T3 unattributable -- a difference between layers could come from the
features or from two different segmentations. So this module parses; it never segments.

Reads are allowed here (same as ``modules.ingest.algorithms.loader``); writing and plotting are not
(C-D2) and live under ``notebooks/``.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any


GOLDEN_VERSION = "lift-segments-v1"
CONTRACT = "sensor-lift-validation-v1"

INSTRUCTION_CLASSES = ("lift", "pause", "oneshot")


class GoldenError(ValueError):
    """A malformed Stage 1 golden, with a machine-readable JSON field path."""

    def __init__(self, field_path: str, message: str) -> None:
        self.field_path = field_path
        super().__init__(f"{field_path}: {message}")


@dataclass(frozen=True)
class Interval:
    start_ms: float
    end_ms: float


@dataclass(frozen=True)
class Gap:
    """One candidate gap. ``index`` is its position in this theta's ``gaps`` array."""

    index: int
    start_ms: float
    end_ms: float
    duration_ms: float
    before_index: int
    after_index: int


@dataclass(frozen=True)
class Segmentation:
    theta_ms: float
    gaps: tuple[Gap, ...]


@dataclass(frozen=True)
class LiftGolden:
    run_id: str
    session_id: str
    instruction_class: str
    display_hz: float
    sample_count: int
    #: The embedded time channel. It is what makes the golden byte-reproducible on the TS side, and
    #: on this side it is how a candidate export is proved to be the run the golden was cut from
    #: (``features.assert_block_matches_golden``). It deliberately carries no ``dx`` / ``dy``.
    t0_ms: float
    dt_us: tuple[int, ...]
    unlocked_intervals: tuple[Interval, ...]
    annotation_intervals: tuple[Interval, ...]
    segmentations: tuple[Segmentation, ...]
    source_path: Path | None

    def segmentation_at(self, theta_ms: float) -> Segmentation:
        for segmentation in self.segmentations:
            if segmentation.theta_ms == theta_ms:
                return segmentation
        raise GoldenError("segmentationsByTheta", f"golden {self.run_id!r} has no theta {theta_ms}")


def parse_lift_golden(payload: Any, source_path: Path | None = None) -> LiftGolden:
    """Validate an already-loaded golden document. Field paths name the offending key."""

    root = _mapping(payload, "$")
    version = _required(root, "version", "version")
    if version != GOLDEN_VERSION:
        raise GoldenError("version", f"must equal {GOLDEN_VERSION!r} (found {version!r})")
    contract = _required(root, "contract", "contract")
    if contract != CONTRACT:
        raise GoldenError("contract", f"must equal {CONTRACT!r} (found {contract!r})")

    instruction_class = _required(root, "instructionClass", "instructionClass")
    if instruction_class not in INSTRUCTION_CLASSES:
        raise GoldenError("instructionClass", f"must be one of {INSTRUCTION_CLASSES}")

    segmentations: list[Segmentation] = []
    raw_segmentations = _list(_required(root, "segmentationsByTheta", "segmentationsByTheta"), "segmentationsByTheta")
    for index, entry in enumerate(raw_segmentations):
        base = f"segmentationsByTheta[{index}]"
        record = _mapping(entry, base)
        raw_gaps = _list(_required(record, "gaps", f"{base}.gaps"), f"{base}.gaps")

        gaps: list[Gap] = []
        for gap_index, raw_gap in enumerate(raw_gaps):
            gap_path = f"{base}.gaps[{gap_index}]"
            gap = _mapping(raw_gap, gap_path)
            gaps.append(
                Gap(
                    index=gap_index,
                    start_ms=_number(_required(gap, "startMs", f"{gap_path}.startMs"), f"{gap_path}.startMs"),
                    end_ms=_number(_required(gap, "endMs", f"{gap_path}.endMs"), f"{gap_path}.endMs"),
                    duration_ms=_number(_required(gap, "durationMs", f"{gap_path}.durationMs"), f"{gap_path}.durationMs"),
                    before_index=int(_number(_required(gap, "beforeIndex", f"{gap_path}.beforeIndex"), f"{gap_path}.beforeIndex")),
                    after_index=int(_number(_required(gap, "afterIndex", f"{gap_path}.afterIndex"), f"{gap_path}.afterIndex")),
                )
            )

        theta_path = f"{base}.thetaMs"
        segmentations.append(
            Segmentation(theta_ms=_number(_required(record, "thetaMs", theta_path), theta_path), gaps=tuple(gaps))
        )

    block = _mapping(_required(root, "input", "input"), "input")
    t0_ms = _number(_required(block, "t0Ms", "input.t0Ms"), "input.t0Ms")
    dt_us_raw = _list(_required(block, "dtUs", "input.dtUs"), "input.dtUs")
    dt_us = tuple(int(_number(value, f"input.dtUs[{index}]")) for index, value in enumerate(dt_us_raw))

    return LiftGolden(
        run_id=str(_required(root, "runId", "runId")),
        session_id=str(_required(root, "sessionId", "sessionId")),
        instruction_class=str(instruction_class),
        display_hz=_number(_required(root, "displayHz", "displayHz"), "displayHz"),
        sample_count=int(_number(_required(root, "sampleCount", "sampleCount"), "sampleCount")),
        t0_ms=t0_ms,
        dt_us=dt_us,
        unlocked_intervals=_intervals(root.get("unlockedIntervals", []), "unlockedIntervals"),
        annotation_intervals=_intervals(root.get("annotationIntervals", []), "annotationIntervals"),
        segmentations=tuple(segmentations),
        source_path=source_path,
    )


def load_lift_golden(path: Path) -> LiftGolden:
    """Read and validate one committed Stage 1 golden."""

    source_path = Path(path)
    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise GoldenError("$", f"invalid JSON: {error.msg}") from error
    return parse_lift_golden(payload, source_path)


def _intervals(value: Any, field_path: str) -> tuple[Interval, ...]:
    intervals: list[Interval] = []
    for index, entry in enumerate(_list(value, field_path)):
        path = f"{field_path}[{index}]"
        record = _mapping(entry, path)
        intervals.append(
            Interval(
                start_ms=_number(_required(record, "startMs", f"{path}.startMs"), f"{path}.startMs"),
                end_ms=_number(_required(record, "endMs", f"{path}.endMs"), f"{path}.endMs"),
            )
        )
    return tuple(intervals)


def _required(container: dict[str, Any], field: str, field_path: str) -> Any:
    if field not in container:
        raise GoldenError(field_path, "is required")
    return container[field]


def _mapping(value: Any, field_path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise GoldenError(field_path, "must be an object")
    return value


def _list(value: Any, field_path: str) -> list[Any]:
    if not isinstance(value, list):
        raise GoldenError(field_path, "must be an array")
    return value


def _number(value: Any, field_path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GoldenError(field_path, "must be a number")
    return float(value)
