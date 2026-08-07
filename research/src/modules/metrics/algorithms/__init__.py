"""Pure research metric algorithms."""

from .detect import (
    DETECT_VERSION,
    KNOWN_DETECT_FLAGS,
    DEFAULT_DETECT_PARAMS,
    DetectParams,
    DetectSample,
    detect_parity_payload,
    detect_samples,
)
from .peek import KNOWN_PEEK_FLAGS, PeekWindow, build_peek_windows
from .timeline import (
    COMPUTE_VERSION,
    TIMELINE_VERSION,
    Stat,
    TimelineMetrics,
    first_shot_hits,
    stat,
    timeline_metrics,
    timeline_parity_payload,
)

__all__ = [
    "COMPUTE_VERSION",
    "DEFAULT_DETECT_PARAMS",
    "DETECT_VERSION",
    "KNOWN_DETECT_FLAGS",
    "KNOWN_PEEK_FLAGS",
    "DetectParams",
    "DetectSample",
    "PeekWindow",
    "Stat",
    "TIMELINE_VERSION",
    "TimelineMetrics",
    "build_peek_windows",
    "detect_parity_payload",
    "detect_samples",
    "first_shot_hits",
    "stat",
    "timeline_metrics",
    "timeline_parity_payload",
]
