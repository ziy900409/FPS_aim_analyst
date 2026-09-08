import { describe, expect, it } from 'vitest';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { createRan1 } from '../recoil/rng.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { TargetState, Vec3 } from '../state/types.ts';
import { createTargetManager } from './TargetManager.ts';

const EYE = { x: 0, y: 1.6, z: 0 } as const;
const REPLACEMENTS_PER_RUN = microFlickThreeTargetTestV8.drill.targets.count -
  microFlickThreeTargetTestV8.drill.targets.population.activeCount;
const KILL_ORDER_RUNS = 2_000;

interface BaselineObservation {
  readonly completedRuns: number;
  readonly placementFailures: number;
  readonly replacementOpportunities: number;
  readonly unchangedAimHits: number;
  readonly completedRunsWithUnchangedAimHit: number;
}

function copyPos(target: TargetState): Vec3 {
  return { x: target.pos.x, y: target.pos.y, z: target.pos.z };
}

function rayAimedAtKilledCenterHitsReplacement(killedPos: Vec3, replacement: TargetState): boolean {
  const dx = killedPos.x - EYE.x;
  const dy = killedPos.y - EYE.y;
  const dz = killedPos.z - EYE.z;
  const inverseLength = 1 / Math.hypot(dx, dy, dz);
  const ux = dx * inverseLength;
  const uy = dy * inverseLength;
  const uz = dz * inverseLength;
  const cx = replacement.pos.x - EYE.x;
  const cy = replacement.pos.y - EYE.y;
  const cz = replacement.pos.z - EYE.z;
  const projection = cx * ux + cy * uy + cz * uz;
  if (projection < 0) return false;
  const closestDistanceSquared = cx * cx + cy * cy + cz * cz - projection * projection;
  const radius = replacement.hitbox.width / 2;
  return closestDistanceSquared <= radius * radius;
}

function observeCurrentV8(): BaselineObservation {
  let completedRuns = 0;
  let placementFailures = 0;
  let replacementOpportunities = 0;
  let unchangedAimHits = 0;
  let completedRunsWithUnchangedAimHit = 0;

  for (let killOrderSeed = 0; killOrderSeed < KILL_ORDER_RUNS; killOrderSeed++) {
    const state = createSharedState();
    const manager = createTargetManager(microFlickThreeTargetTestV8.drill);
    const killOrderRng = createRan1(killOrderSeed);
    let runHits = 0;

    try {
      manager.tick(state, 0);
      for (let replacementIndex = 0; replacementIndex < REPLACEMENTS_PER_RUN; replacementIndex++) {
        const killedIndex = Math.floor(killOrderRng() * state.targets.length);
        const killed = state.targets[killedIndex];
        const killedPos = copyPos(killed);
        const survivorIds = new Set(state.targets.filter((_, index) => index !== killedIndex).map((target) => target.id));

        manager.markKilled(state, killed.id);
        manager.tick(state, replacementIndex + 1);

        const replacement = state.targets.find((target) => !survivorIds.has(target.id));
        if (replacement === undefined) throw new Error('Replacement target was not created');
        replacementOpportunities++;
        if (rayAimedAtKilledCenterHitsReplacement(killedPos, replacement)) {
          unchangedAimHits++;
          runHits++;
        }
      }
      completedRuns++;
      if (runHits > 0) completedRunsWithUnchangedAimHit++;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Unable to place 3 active targets')) throw error;
      placementFailures++;
    }
  }

  return {
    completedRuns,
    placementFailures,
    replacementOpportunities,
    unchangedAimHits,
    completedRunsWithUnchangedAimHit,
  };
}

describe('TargetManager — WP-59 T0 v8 near-replacement baseline', () => {
  it('reproduces the bounded deterministic exploit before the replacement policy is enabled', () => {
    const observation = observeCurrentV8();
    const unchangedAimHitRate = observation.unchangedAimHits / observation.replacementOpportunities;

    expect(REPLACEMENTS_PER_RUN).toBe(57);
    expect(observation).toEqual({
      completedRuns: 1_923,
      placementFailures: 77,
      replacementOpportunities: 112_114,
      unchangedAimHits: 19_429,
      completedRunsWithUnchangedAimHit: 1_923,
    });
    expect(unchangedAimHitRate).toBeCloseTo(0.1733, 4);
  });
});
