import type { DrillConfig } from './DrillConfig.ts';

/**
 * WP-21 / T2 detection pop-in drill.
 *
 * Pop-in timing and position are both seeded. The stimulus becomes visible at the
 * TargetManager spawn tick, so existing t_visible semantics remain unchanged.
 */
export const detectionPopinV1: DrillConfig = {
  drillId: 'detection_popin_v1',
  targets: {
    count: 20,
    distance: 4,
    spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
  },
  sequence: {
    alternation: 'LR',
    seed: 21021,
    spawnDelayMsRange: [800, 2400],
  },
  timing: {
    countdownMs: 3000,
    peekTimeoutMs: 1500,
    timeLimitMs: 120000,
  },
  endCondition: { type: 'targetCount', value: 20 },
};
