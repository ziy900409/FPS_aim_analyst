import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../src/state/SharedState.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import type { DrillConfig } from '../../src/drill/DrillConfig.ts';
import { holdClickV1 } from '../../src/drill/hold_click_v1.ts';
import { holdTrackV1 } from '../../src/drill/hold_track_v1.ts';
import { spiderShotV1 } from '../../src/drill/spider_shot_v1.ts';
import { spiderShotV2 } from '../../src/drill/spider_shot_v2.ts';
import { counterstrafeCuedV1 } from '../../src/drill/counterstrafe_cued_v1.ts';
import { counterstrafeReversalV1 } from '../../src/drill/counterstrafe_reversal_v1.ts';

const TICK_MS = 1000 / SIM_HZ;
const MARGIN_MS = 5000;
const DEFAULT_BACKSTOP_MS = 120_000;

/**
 * WP-50 D-50-P8: this fixture is a PRECONDITION for the T1 replay schema decision (README
 * D-50-P6/P8) — full replay drops `targets[]` for a scalar `replayTargetId?` because these 6
 * official Assessment exact drillIds never carry more than one active target at once. If this
 * regresses, the replay schema/profile registry must be revisited before capture work proceeds.
 */
const OFFICIAL_ASSESSMENT_DRILLS: ReadonlyArray<{ readonly label: string; readonly config: DrillConfig }> = [
  { label: 'hold_click_v1', config: holdClickV1.drill },
  { label: 'hold_track_v1', config: holdTrackV1.drill },
  { label: 'spider-shot-v1', config: spiderShotV1 },
  { label: 'spider-shot-v2', config: spiderShotV2 },
  { label: 'counterstrafe-cued-v1', config: counterstrafeCuedV1 },
  { label: 'counterstrafe-reversal-v1', config: counterstrafeReversalV1 },
];

describe('WP-50 D-50-P8 — official Assessment exact drillId target cardinality invariant', () => {
  for (const { label, config } of OFFICIAL_ASSESSMENT_DRILLS) {
    it(`${label}: state.targets.length never exceeds 1 across a full run`, () => {
      const state = createSharedState();
      const targetManager = createTargetManager(config);
      const runner = createDrillRunner(state, targetManager);
      runner.start(config);

      const backstopMs =
        config.timing.timeLimitMs ?? (config.endCondition.type === 'timeLimit' ? config.endCondition.value : DEFAULT_BACKSTOP_MS);
      const totalTicks = Math.ceil((config.timing.countdownMs + backstopMs + MARGIN_MS) / TICK_MS);

      let nowMs = 0;
      for (let i = 0; i < totalTicks; i++) {
        nowMs += TICK_MS;
        runner.tick(state, nowMs);
        expect(state.targets.length).toBeLessThanOrEqual(1);
        if (runner.phase === 'ended') break;
      }

      expect(runner.phase).toBe('ended');
    });
  }
});
