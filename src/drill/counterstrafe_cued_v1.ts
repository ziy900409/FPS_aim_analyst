import type { DrillConfig } from './DrillConfig.ts';

/** WP-37 / T1 assessment protocol: cue starts the fixed foreperiod before each alternating target. */
export const counterstrafeCuedV1: DrillConfig = {
  drillId: 'counterstrafe-cued-v1',
  mode: 'assessment',
  cue: { kind: 'single' },
  targets: { count: 20, distance: 4 },
  sequence: { alternation: 'LR', seed: 37001, spawnDelayMsRange: [500, 500] },
  timing: { countdownMs: 3000, peekTimeoutMs: 1500, timeLimitMs: 120000 },
  endCondition: { type: 'targetCount', value: 20 },
};
