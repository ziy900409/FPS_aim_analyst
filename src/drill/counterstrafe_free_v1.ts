import type { DrillConfig } from './DrillConfig.ts';

/** WP-37 / T3 practice-only counterpart to the legacy free-form counter-strafe drill. */
export const counterstrafeFreeV1: DrillConfig = {
  drillId: 'counterstrafe-free-v1',
  mode: 'practice',
  targets: { count: 20, distance: 4 },
  sequence: { alternation: 'LR', seed: 1 },
  timing: { countdownMs: 3000, spawnDelayMs: 0 },
  endCondition: { type: 'targetCount', value: 20 },
};
