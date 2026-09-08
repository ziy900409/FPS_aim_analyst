import { describe, expect, it } from 'vitest';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { microFlickThreeTargetTestV8 } from '../drill/micro_flick_three_target_test_v8.ts';
import { createRan1 } from '../recoil/rng.ts';
import { createSharedState } from '../state/SharedState.ts';
import type { TargetState, Vec3 } from '../state/types.ts';
import {
  TARGET_POPULATION_SPAWN_ATTEMPT_LIMIT,
  TARGET_REPLACEMENT_PREFERRED_CANDIDATE_LIMIT,
  createTargetManager,
} from './TargetManager.ts';

const EYE = { x: 0, y: 1.6, z: 0 } as const;
const REPLACEMENTS_PER_RUN = microFlickThreeTargetTestV8.drill.targets.count -
  microFlickThreeTargetTestV8.drill.targets.population.activeCount;
const KILL_ORDER_RUNS = 2_000;

interface V8StressObservation {
  readonly completedRuns: number;
  readonly placementFailures: number;
  readonly replacementOpportunities: number;
  readonly unchangedAimHits: number;
  readonly completedRunsWithUnchangedAimHit: number;
  readonly temporalPreferenceFallbacks: number;
  readonly invalidPopulationSnapshots: number;
  readonly minimumKilledSeparationDeg: number;
  readonly minimumActiveSeparationDeg: number;
}

function copyPos(target: TargetState): Vec3 {
  return { x: target.pos.x, y: target.pos.y, z: target.pos.z };
}

function replacementConfig(): DrillConfig {
  const base = microFlickThreeTargetTestV8.drill;
  return {
    ...base,
    targets: {
      ...base.targets,
      spawnArea: {
        ...base.targets.spawnArea,
        minAngularSeparationDeg: 5,
        preferredReplacementSeparationDeg: 2.6,
      },
    },
  };
}

function centerRelativeAngularSeparationDeg(left: Vec3, right: Vec3): number {
  const leftLength = Math.hypot(left.x, left.y - 1.5, left.z);
  const rightLength = Math.hypot(right.x, right.y - 1.5, right.z);
  const dot =
    (left.x * right.x + (left.y - 1.5) * (right.y - 1.5) + left.z * right.z) /
    (leftLength * rightLength);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function targetSnapshot(state: ReturnType<typeof createSharedState>): string {
  return JSON.stringify(state.targets.map((target) => ({ id: target.id, side: target.side, pos: target.pos })));
}

function inspectV8Population(state: ReturnType<typeof createSharedState>): {
  readonly valid: boolean;
  readonly minimumActiveSeparationDeg: number;
} {
  if (state.targets.length !== 3 || new Set(state.targets.map((target) => target.id)).size !== 3) {
    return { valid: false, minimumActiveSeparationDeg: -Infinity };
  }
  let valid = true;
  let minimumActiveSeparationDeg = Infinity;
  for (const target of state.targets) {
    const yawDeg = (Math.atan2(target.pos.x, -target.pos.z) * 180) / Math.PI;
    const horizontalDistance = Math.hypot(target.pos.x, target.pos.z);
    const pitchDeg = (Math.atan2(target.pos.y - 1.5, horizontalDistance) * 180) / Math.PI;
    valid &&=
      target.visible &&
      target.alive &&
      Object.values(target.pos).every(Number.isFinite) &&
      yawDeg >= -6.5 - 1e-10 &&
      yawDeg <= 6.5 + 1e-10 &&
      pitchDeg >= -5 - 1e-10 &&
      pitchDeg <= 6 + 1e-10 &&
      horizontalDistance >= 24 - 1e-10 &&
      horizontalDistance <= 26 + 1e-10;
  }
  for (let left = 0; left < state.targets.length; left++) {
    for (let right = left + 1; right < state.targets.length; right++) {
      minimumActiveSeparationDeg = Math.min(
        minimumActiveSeparationDeg,
        centerRelativeAngularSeparationDeg(state.targets[left].pos, state.targets[right].pos),
      );
    }
  }
  valid &&= minimumActiveSeparationDeg >= 5 - 1e-10;
  return { valid, minimumActiveSeparationDeg };
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

function observeCurrentV8(): V8StressObservation {
  let completedRuns = 0;
  let placementFailures = 0;
  let replacementOpportunities = 0;
  let unchangedAimHits = 0;
  let completedRunsWithUnchangedAimHit = 0;
  let temporalPreferenceFallbacks = 0;
  let invalidPopulationSnapshots = 0;
  let minimumKilledSeparationDeg = Infinity;
  let minimumActiveSeparationDeg = Infinity;

  for (let killOrderSeed = 0; killOrderSeed < KILL_ORDER_RUNS; killOrderSeed++) {
    const state = createSharedState();
    const manager = createTargetManager(microFlickThreeTargetTestV8.drill);
    const killOrderRng = createRan1(killOrderSeed);
    let runHits = 0;

    try {
      manager.tick(state, 0);
      const initialPopulation = inspectV8Population(state);
      if (!initialPopulation.valid) invalidPopulationSnapshots++;
      minimumActiveSeparationDeg = Math.min(
        minimumActiveSeparationDeg,
        initialPopulation.minimumActiveSeparationDeg,
      );
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
        const killedSeparationDeg = centerRelativeAngularSeparationDeg(killedPos, replacement.pos);
        minimumKilledSeparationDeg = Math.min(minimumKilledSeparationDeg, killedSeparationDeg);
        if (killedSeparationDeg + 1e-10 < 2.6) temporalPreferenceFallbacks++;
        const population = inspectV8Population(state);
        if (!population.valid) invalidPopulationSnapshots++;
        minimumActiveSeparationDeg = Math.min(minimumActiveSeparationDeg, population.minimumActiveSeparationDeg);
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
    temporalPreferenceFallbacks,
    invalidPopulationSnapshots,
    minimumKilledSeparationDeg,
    minimumActiveSeparationDeg,
  };
}

describe('TargetManager — WP-59 T3 v8 replacement-spacing acceptance', () => {
  it('completes the frozen kill-order corpus without placement failures or unchanged-aim hits', () => {
    const observation = observeCurrentV8();
    const unchangedAimHitRate = observation.unchangedAimHits / observation.replacementOpportunities;

    expect(REPLACEMENTS_PER_RUN).toBe(57);
    expect(observation.completedRuns).toBe(2_000);
    expect(observation.placementFailures).toBe(0);
    expect(observation.replacementOpportunities).toBe(114_000);
    expect(observation.unchangedAimHits).toBe(0);
    expect(observation.completedRunsWithUnchangedAimHit).toBe(0);
    expect(observation.temporalPreferenceFallbacks).toBe(0);
    expect(observation.invalidPopulationSnapshots).toBe(0);
    expect(observation.minimumKilledSeparationDeg).toBeGreaterThanOrEqual(2.6 - 1e-10);
    expect(observation.minimumActiveSeparationDeg).toBeGreaterThanOrEqual(5 - 1e-10);
    expect(unchangedAimHitRate).toBe(0);
  });
});

describe('TargetManager — WP-59 T2 temporal replacement sampler', () => {
  it('keeps the initial population trace identical before any successful kill', () => {
    const controlState = createSharedState();
    const replacementState = createSharedState();
    const configured = replacementConfig();
    const { preferredReplacementSeparationDeg: _preference, ...spawnArea } = configured.targets.spawnArea!;
    const withoutPreference: DrillConfig = {
      ...configured,
      targets: { ...configured.targets, spawnArea },
    };
    createTargetManager(withoutPreference).tick(controlState, 0);
    createTargetManager(configured).tick(replacementState, 0);

    expect(targetSnapshot(replacementState)).toBe(targetSnapshot(controlState));
  });

  it('ranks a next-tick replacement away from the exact killed position within frozen bounds', () => {
    expect(TARGET_POPULATION_SPAWN_ATTEMPT_LIMIT).toBe(32);
    expect(TARGET_REPLACEMENT_PREFERRED_CANDIDATE_LIMIT).toBe(8);
    const state = createSharedState();
    const manager = createTargetManager(replacementConfig());
    manager.tick(state, 0);
    const killed = state.targets[1];
    const killedPos = copyPos(killed);
    const survivorIds = new Set(state.targets.filter((target) => target.id !== killed.id).map((target) => target.id));

    manager.markKilled(state, killed.id);
    expect(state.targets).toHaveLength(2);
    manager.tick(state, 1);

    const replacement = state.targets.find((target) => !survivorIds.has(target.id));
    expect(replacement).toBeDefined();
    expect(centerRelativeAngularSeparationDeg(killedPos, replacement!.pos)).toBeGreaterThanOrEqual(2.6 - 1e-10);
    expect(rayAimedAtKilledCenterHitsReplacement(killedPos, replacement!)).toBe(false);
    for (const survivor of state.targets.filter((target) => target.id !== replacement!.id)) {
      expect(centerRelativeAngularSeparationDeg(survivor.pos, replacement!.pos)).toBeGreaterThanOrEqual(5 - 1e-10);
    }
  });

  it('copies killed coordinates into manager-owned state before removal', () => {
    function run(mutateRemovedTarget: boolean): string {
      const state = createSharedState();
      const manager = createTargetManager(replacementConfig());
      manager.tick(state, 0);
      const killed = state.targets[1];
      manager.markKilled(state, killed.id);
      if (mutateRemovedTarget) {
        killed.pos.x = 1_000;
        killed.pos.y = 1_000;
        killed.pos.z = 1_000;
      }
      manager.tick(state, 1);
      return targetSnapshot(state);
    }

    expect(run(true)).toBe(run(false));
  });

  it('does not let unknown or duplicate IDs perturb temporal state or RNG', () => {
    function run(withNoOps: boolean): string {
      const state = createSharedState();
      const manager = createTargetManager(replacementConfig());
      manager.tick(state, 0);
      const killedId = state.targets[1].id;
      if (withNoOps) manager.markKilled(state, 'unknown');
      manager.markKilled(state, killedId);
      if (withNoOps) manager.markKilled(state, killedId);
      manager.tick(state, 1);
      return targetSnapshot(state);
    }

    expect(run(true)).toBe(run(false));
  });

  it('clears killed-position state and reconstructs the seeded stream on reset', () => {
    const state = createSharedState();
    const manager = createTargetManager(replacementConfig());

    function run(): string[] {
      const trace: string[] = [];
      manager.tick(state, 0);
      trace.push(targetSnapshot(state));
      for (let i = 0; i < 12; i++) {
        manager.markKilled(state, state.targets[i % state.targets.length].id);
        manager.tick(state, i + 1);
        trace.push(targetSnapshot(state));
      }
      return trace;
    }

    const first = run();
    manager.reset(state);
    expect(run()).toEqual(first);
  });

  it('uses active-valid soft fallback when the temporal preference is impossible', () => {
    const base = replacementConfig();
    const impossiblePreference: DrillConfig = {
      ...base,
      targets: {
        ...base.targets,
        count: 2,
        population: { activeCount: 1, replacement: 'next-tick' },
        spawnArea: {
          yawDegRange: [0, 0],
          pitchDegRange: [0, 0],
          distanceURange: [25, 25],
          preferredReplacementSeparationDeg: 2.6,
        },
      },
      endCondition: { type: 'targetCount', value: 2 },
    };
    const state = createSharedState();
    const manager = createTargetManager(impossiblePreference);
    manager.tick(state, 0);
    const killedPos = copyPos(state.targets[0]);
    manager.markKilled(state, state.targets[0].id);

    expect(() => manager.tick(state, 1)).not.toThrow();
    expect(centerRelativeAngularSeparationDeg(killedPos, state.targets[0].pos)).toBeCloseTo(0, 12);
  });
});
