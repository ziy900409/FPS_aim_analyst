"""Generate the committed Python side of the T2 epsilon parity gate."""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
import pandas as pd


RESEARCH_ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(RESEARCH_ROOT / "src"))

from modules.ingest.algorithms.loader import Export, load_export  # noqa: E402
from modules.kinematics.algorithms.angular import epsilon_deg, on_target  # noqa: E402


_WINDOW_EPSILON_MS = 1e-9
_DEFAULT_HITBOX = {"width": 1.0, "height": 2.0, "depth": 1.0}


def build_parity_payload(export: Export, eye_height: float = 1.6) -> dict[str, Any]:
    """Derive presentation metrics using only Python research functions."""

    ticks = export.ticks.sort_values("t", kind="stable").reset_index(drop=True)
    visible_events = (
        export.events.loc[export.events["type"] == "visible"]
        .sort_values("t", kind="stable")
        .reset_index(drop=True)
    )
    presentations = []
    for index, visible in visible_events.iterrows():
        end_ms = (
            float(visible_events.iloc[index + 1]["t"])
            if index + 1 < len(visible_events)
            else math.inf
        )
        presentations.append(_derive_presentation(ticks, visible, end_ms, export.meta, eye_height))

    return {
        "source": export.source_path.name,
        "options": {"eyeHeight": eye_height, "hitbox": _resolved_hitbox(export.meta)},
        "presentations": presentations,
    }


def _derive_presentation(
    ticks: pd.DataFrame,
    visible: pd.Series,
    end_ms: float,
    meta: dict[str, Any],
    eye_height: float,
) -> dict[str, Any]:
    visible_ms = float(visible["t"])
    fallback = _visible_or_first_tick_target(visible, ticks)
    inside = (ticks["t"] + _WINDOW_EPSILON_MS >= visible_ms) & (
        ticks["t"] < end_ms - _WINDOW_EPSILON_MS
    )
    presentation_ticks = ticks.loc[inside].reset_index(drop=True)
    epsilon = epsilon_deg(
        presentation_ticks,
        meta,
        eye_height,
        fallback_target=fallback,
    )
    covered = on_target(
        presentation_ticks,
        meta,
        eye_height,
        fallback_target=fallback,
    )
    acquired_indices = np.flatnonzero(covered)
    base = {
        "targetId": str(visible["targetId"]),
        "tVisibleMs": visible_ms,
        "tAcquireMs": None,
        "totPercent": None,
        "rmsEpsilonDeg": None,
        "medianEpsilonDeg": None,
        "p95EpsilonDeg": None,
        "acquisitionFailure": len(acquired_indices) == 0,
    }
    if len(acquired_indices) == 0:
        return base

    first = int(acquired_indices[0])
    tracking_epsilon = epsilon[first:]
    tracking_covered = covered[first:]
    first_tick_ms = float(presentation_ticks.iloc[first]["t"])
    base.update(
        {
            "tAcquireMs": first_tick_ms - visible_ms,
            "totPercent": float(np.mean(tracking_covered) * 100.0),
            "rmsEpsilonDeg": float(np.sqrt(np.mean(np.square(tracking_epsilon)))),
            "medianEpsilonDeg": float(np.percentile(tracking_epsilon, 50)),
            "p95EpsilonDeg": float(np.percentile(tracking_epsilon, 95)),
        }
    )
    return base


def _visible_or_first_tick_target(
    visible: pd.Series,
    ticks: pd.DataFrame,
) -> tuple[float, float, float]:
    visible_target = tuple(visible[field] for field in ("targetX", "targetY", "targetZ"))
    if all(_is_finite_number(value) for value in visible_target):
        return tuple(float(value) for value in visible_target)

    candidates = ticks.loc[ticks["t"] + _WINDOW_EPSILON_MS >= float(visible["t"])]
    if not candidates.empty:
        tick_target = tuple(candidates.iloc[0][field] for field in ("tx", "ty", "tz"))
        if all(_is_finite_number(value) for value in tick_target):
            return tuple(float(value) for value in tick_target)
    raise ValueError(f"visible target position is missing for {visible['targetId']}")


def _resolved_hitbox(meta: dict[str, Any]) -> dict[str, float]:
    hitbox = meta.get("targets", {}).get("hitbox")
    if hitbox is None:
        return dict(_DEFAULT_HITBOX)
    return {
        "width": float(hitbox["widthU"]),
        "height": float(hitbox["heightU"]),
        "depth": float(hitbox["depthU"]),
    }


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def main() -> None:
    source = RESEARCH_ROOT / "fixtures" / "exports" / "synthetic_counterstrafe.json"
    output = RESEARCH_ROOT / "fixtures" / "parity" / "epsilon-synthetic_counterstrafe.json"
    payload = build_parity_payload(load_export(source))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
