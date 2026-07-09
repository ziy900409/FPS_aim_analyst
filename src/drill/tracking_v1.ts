import type { DrillConfig } from './DrillConfig.ts';

/**
 * WP-18 / T4 pure tracking drill.
 *
 * A single horizontally oscillating target (motion driven by `age`, WP-18 T1) presented for a
 * fixed duration (`timing.presentationMs`, WP-18 T3 timed presentation). The player aims from a
 * static position — this drill is **pure tracking**, not composited with counter-strafe (GD-7):
 * acquisition (t_acquire) and pursuit (TOT% / RMS ε) are separated at the metric layer, not by
 * mixing skills in the same drill.
 *
 * Motion envelope uses the field-low-compatible bounds fixed in WP-18 T0 OQ-18.1
 * (`axis: 'horizontal'`, `range ∈ [0.5, 1.5] u`, `speed ∈ [1, 4] u/s`). Clearance against the
 * real `field-low` corridor is verified in WP-22 T1; this WP only bounds the envelope in units.
 *
 * `sequence.seed` is recorded in export metadata for reproducibility (GD-5/GD-8). There is no
 * `spawnArea` here: the target uses the L/R peek slot + distance abstraction (like the
 * counter-strafe drill) and the seed reserves a reproducible RNG stream for future spawn
 * randomisation without changing the deterministic sim path.
 *
 * Tracking metrics (t_acquire / TOT% / RMS ε) are derived offline — the engine records raw v2
 * ticks/events only (GD-7). The executable interface lives in
 * `src/metrics/trackingDerivation.ts` and `docs/operational/analysis-tracking.md`.
 */
export const trackingV1: DrillConfig = {
  drillId: 'tracking_v1',
  targets: {
    count: 10,
    distance: 4,
    motion: { type: 'pingpong', axis: 'horizontal', range: 1, speed: 2 },
  },
  sequence: {
    alternation: 'LR',
    seed: 18018,
  },
  timing: {
    countdownMs: 3000,
    presentationMs: 2000,
    timeLimitMs: 120000,
  },
  endCondition: { type: 'targetCount', value: 10 },
};
