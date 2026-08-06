"""Pure research metric algorithms."""

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
    "KNOWN_PEEK_FLAGS",
    "PeekWindow",
    "Stat",
    "TIMELINE_VERSION",
    "TimelineMetrics",
    "build_peek_windows",
    "first_shot_hits",
    "stat",
    "timeline_metrics",
    "timeline_parity_payload",
]
