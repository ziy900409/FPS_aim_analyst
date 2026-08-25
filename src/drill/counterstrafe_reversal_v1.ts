import type { DrillConfig } from './DrillConfig.ts';

export const COUNTERSTRAFE_REVERSAL_HOLD_DURATION_MS_V1 = 500;

/** WP-37 / T2 assessment protocol: hold the prompted direction, then reverse on the second cue. */
export const counterstrafeReversalV1: DrillConfig = {
  drillId: 'counterstrafe-reversal-v1',
  mode: 'assessment',
  cue: { kind: 'hold-reversal', holdDurationMs: COUNTERSTRAFE_REVERSAL_HOLD_DURATION_MS_V1 },
  targets: { count: 20, distance: 4 },
  sequence: { alternation: 'LR', seed: 37002, spawnDelayMsRange: [500, 500] },
  timing: { countdownMs: 3000, timeLimitMs: 120000 },
  endCondition: { type: 'targetCount', value: 20 },
};
