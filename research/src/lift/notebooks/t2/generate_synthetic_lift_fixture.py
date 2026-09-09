"""WP-61 T2: regenerate the committed synthetic annotated export.

Why a synthetic fixture exists at all: the real 240 Hz annotated cohort does not exist yet, and real
per-sample trajectories never enter the repo (D-57.T5-8). Without *some* committed export carrying
``mouseSamples`` **and** ``annotation`` events, none of the T2 chain -- Stage 1 golden, TS
reproduction assertion, Python candidate event table -- can be exercised at all, and every part of
it would land unverified.

What it is **not**: evidence. A synthetic run cannot answer whether sensor lift is separable from a
hand pause; the gaps here are placed by this script, so any classifier trained on them would only
recover this file. It unlocks the plumbing; NFR-61.7's floors still demand real sessions.

I/O lives here, in ``notebooks/`` -- never in ``algorithms/`` (C-D2).

    uv run python src/lift/notebooks/t2/generate_synthetic_lift_fixture.py
"""

from __future__ import annotations

import json
from pathlib import Path


FIXTURES = Path(__file__).resolve().parents[4] / "fixtures" / "exports"
BASE = FIXTURES / "synthetic_counterstrafe.json"
TARGET = FIXTURES / "synthetic_sensor_lift.json"

SAMPLE_INTERVAL_US = 1000
"""1000 Hz polling -- the polling rate the recording spec requires (>= 500 Hz active rate)."""

TRIALS = 8
SAMPLES_BEFORE_GAP = 300
SAMPLES_AFTER_LAST_GAP = 300
GAP_MS = (150, 170, 190, 210, 230, 250, 270, 290)
"""Eight gaps spanning 150-290 ms. Deliberately straddles the frozen theta sweep's top end (50 ms)
so all three thetas see every gap -- the fixture exercises the pipeline, not the discrimination."""

ANNOTATION_LATENCY_MS = 180
"""Self-report reaction time (D-61.U2: ~200 ms). Held identical for every interval: a synthetic
fixture must not carry a latency structure that the F3 check could mistake for a real finding."""


def _mouse_samples(t0_ms: float) -> tuple[dict, list[float]]:
    """Return the columnar block plus the absolute start time of each synthetic gap."""

    dt_us: list[int] = []
    gap_start_ms: list[float] = []
    elapsed_us = 0

    for trial in range(TRIALS):
        for _ in range(SAMPLES_BEFORE_GAP):
            dt_us.append(SAMPLE_INTERVAL_US)
            elapsed_us += SAMPLE_INTERVAL_US
        # The gap opens at the last sample before it, which is where the operator reacts from.
        gap_start_ms.append(t0_ms + elapsed_us / 1000)
        dt_us.append(GAP_MS[trial] * 1000)
        elapsed_us += GAP_MS[trial] * 1000

    for _ in range(SAMPLES_AFTER_LAST_GAP):
        dt_us.append(SAMPLE_INTERVAL_US)
        elapsed_us += SAMPLE_INTERVAL_US

    dt_us[0] = 0  # schema contract: the first sample has no predecessor.
    elapsed_us -= SAMPLE_INTERVAL_US

    block = {
        "t0Ms": t0_ms,
        "dtUs": dt_us,
        # dx/dy are a flat synthetic ramp: segmentation reads only dtUs, and a fabricated trajectory
        # must not look like a recorded one.
        "dx": [(index % 3) - 1 for index in range(len(dt_us))],
        "dy": [0 for _ in dt_us],
    }
    return block, gap_start_ms


def build() -> dict:
    payload = json.loads(BASE.read_text(encoding="utf-8"))
    t0_ms = 1000.0
    block, gap_start_ms = _mouse_samples(t0_ms)

    payload["meta"] = {
        **payload["meta"],
        "drillId": "spider-shot-wide-v1",
        "displayHz": 240,
        "dpi": 800,
        "crossOriginIsolated": True,
        "mouseSampling": {
            "recorded": len(block["dtUs"]),
            "capacity": 144000,
            "overflow": False,
            "timeSource": "event.timeStamp",
            "deltaUnit": "counts",
            "observedRateHz": 1000,
        },
    }

    events: list[dict] = []
    for trial, start_ms in enumerate(gap_start_ms):
        events.append(
            {
                "type": "visible",
                "targetId": f"p{trial}",
                "side": "R" if trial % 2 == 0 else "L",
                "zone": "peripheral",
                "t": start_ms - 200,
                "targetX": 6.2,
                "targetY": 1.5,
                "targetZ": -5,
            }
        )
        down_ms = start_ms + ANNOTATION_LATENCY_MS
        events.append({"type": "annotation", "kind": "sensor_lift", "code": "KeyL", "down": True, "t": down_ms})
        events.append(
            {
                "type": "annotation",
                "kind": "sensor_lift",
                "code": "KeyL",
                "down": False,
                "t": down_ms + GAP_MS[trial],
            }
        )

    payload["events"] = sorted(events, key=lambda event: event["t"])
    payload["mouseSamples"] = block
    payload["ticks"] = _extend_ticks(payload["ticks"], until_ms=max(event["t"] for event in events) + 100)
    return payload


SIM_TICK_MS = 1000.0 / 128.0


def _extend_ticks(ticks: list[dict], until_ms: float) -> list[dict]:
    """Pad the borrowed tick stream so it spans the synthetic events.

    The base fixture is a 375 ms counter-strafe run; the annotation events here reach ~4.8 s. Any
    consumer that reads ticks at an event's timestamp (``deriveDetectionMetrics`` throws outright
    when there is no tick at or after ``t_visible``) needs the stream to cover the drill.

    The padding holds aim and position **static** and only advances ``t``. That is deliberate: this
    fixture exists to exercise the sampling/annotation path, and inventing plausible-looking aim
    motion would make it look like a recording of something.
    """

    extended = [dict(tick) for tick in ticks]
    last = dict(extended[-1])
    t = float(last["t"])
    while t < until_ms:
        t += SIM_TICK_MS
        extended.append({**last, "t": t, "dYaw": 0.0, "dPitch": 0.0})
    return extended


def main() -> None:
    TARGET.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {TARGET}")


if __name__ == "__main__":
    main()
