import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { microFlickThreeTargetTestV1 } from '../drill/micro_flick_three_target_test_v1.ts';
import type { Clock } from '../loop/clock.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { createSimLoop, simStep } from '../loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../state/SharedState.ts';
import type { TargetState } from '../state/types.ts';
import {
  TARGET_POPULATION_SPAWN_ATTEMPT_LIMIT,
  createTargetManager,
} from './TargetManager.ts';

const TICK_MS = 1000 / SIM_HZ;
const TARGET_CENTER_Y_U = 1.5;

function populationConfig(count = 60, seed = 56001): DrillConfig {
  const base = microFlickThreeTargetTestV1.drill;
  return {
    ...base,
    targets: { ...base.targets, count },
    sequence: { ...base.sequence, seed },
    timing: { countdownMs: 0 },
    endCondition: { type: 'targetCount', value: count },
  };
}

function activeTargets(state: SharedState): TargetState[] {
  return state.targets.filter((target) => target.visible && target.alive);
}

function direction(target: TargetState): readonly [number, number, number] {
  const x = target.pos.x;
  const y = target.pos.y - TARGET_CENTER_Y_U;
  const z = target.pos.z;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function angularSeparationDeg(left: TargetState, right: TargetState): number {
  const a = direction(left);
  const b = direction(right);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

function expectPopulationInvariant(state: SharedState, expectedCount = 3): void {
  const targets = activeTargets(state);
  expect(targets).toHaveLength(expectedCount);
  expect(new Set(targets.map((target) => target.id)).size).toBe(expectedCount);

  for (const target of targets) {
    expect(Object.values(target.pos).every(Number.isFinite)).toBe(true);
    const yawDeg = (Math.atan2(target.pos.x, -target.pos.z) * 180) / Math.PI;
    const horizontalDistance = Math.hypot(target.pos.x, target.pos.z);
    const pitchDeg = (Math.atan2(target.pos.y - TARGET_CENTER_Y_U, horizontalDistance) * 180) / Math.PI;
    expect(yawDeg).toBeGreaterThanOrEqual(-22 - 1e-10);
    expect(yawDeg).toBeLessThanOrEqual(22 + 1e-10);
    expect(pitchDeg).toBeGreaterThanOrEqual(-12 - 1e-10);
    expect(pitchDeg).toBeLessThanOrEqual(12 + 1e-10);
    expect(horizontalDistance).toBeGreaterThanOrEqual(12 - 1e-10);
    expect(horizontalDistance).toBeLessThanOrEqual(14 + 1e-10);
    expect(target.posPrev).toEqual(target.pos);
    expect(target.hitbox.shape).toBe('sphere');
  }

  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      expect(angularSeparationDeg(targets[i], targets[j])).toBeGreaterThanOrEqual(7 - 1e-9);
    }
  }
}

function snapshot(targets: readonly TargetState[]): string {
  return JSON.stringify(
    targets.map((target) => ({ id: target.id, side: target.side, pos: target.pos, posPrev: target.posPrev })),
  );
}

function traceHash(trace: readonly string[]): string {
  return createHash('sha256').update(trace.join('\n')).digest('hex');
}

function collectReplacementTrace(config: DrillConfig, replacements: number): string[] {
  const state = createSharedState();
  const manager = createTargetManager(config);
  manager.tick(state, 0);
  const trace = [snapshot(state.targets)];
  for (let i = 0; i < replacements; i++) {
    manager.markKilled(state, state.targets[i % state.targets.length].id);
    manager.tick(state, (i + 1) * TICK_MS);
    trace.push(snapshot(state.targets));
  }
  return trace;
}

function fixedClock(nowMs: number): Clock {
  return { now: () => nowMs };
}

function traceAtRenderFps(renderFps: number): string[] {
  const config = populationConfig(40, 56001);
  const state = createSharedState();
  const manager = createTargetManager(config);
  const trace: string[] = [];
  const loop = createSimLoop(state, fixedClock(0), SIM_HZ, manager, undefined, undefined, undefined, undefined, {
    afterTick(current, _tickEndMs, tickIndex): void {
      if (tickIndex % 3 === 0 && current.targets.length > 0) {
        manager.markKilled(current, current.targets[tickIndex % current.targets.length].id);
      }
      if (trace.length < 96) trace.push(snapshot(current.targets));
    },
  });

  let frameNowMs = 0;
  while (trace.length < 96) {
    frameNowMs += 1000 / renderFps;
    loop.pump(frameNowMs);
  }
  return trace;
}

function externalTarget(id: string, yawDeg: number): TargetState {
  const yawRad = (yawDeg * Math.PI) / 180;
  return {
    id,
    side: yawDeg < 0 ? 'L' : 'R',
    pos: { x: Math.sin(yawRad) * 13, y: TARGET_CENTER_Y_U, z: -Math.cos(yawRad) * 13 },
    posPrev: { x: Math.sin(yawRad) * 13, y: TARGET_CENTER_Y_U, z: -Math.cos(yawRad) * 13 },
    visible: true,
    alive: true,
    hitbox: { width: 1, height: 1, depth: 1, shape: 'sphere' },
  };
}

describe('TargetManager — WP-56 T2 deterministic target population', () => {
  it('fills three unique targets on the first tick and emits one visible event for each', () => {
    const state = createSharedState();
    const recorder = createDataRecorder();
    const manager = createTargetManager(populationConfig());

    simStep(state, 1 / SIM_HZ, TICK_MS, manager, undefined, undefined, undefined, undefined, recorder);

    expectPopulationInvariant(state);
    const visible = recorder.snapshot().events.filter((event) => event.type === 'visible');
    expect(visible).toHaveLength(3);
    expect(new Set(visible.map((event) => event.targetId))).toEqual(new Set(state.targets.map((target) => target.id)));
    expect(visible.every((event) => event.t === TICK_MS)).toBe(true);
  });

  it('removes only the exact ID and replenishes on the following tick without moving survivors', () => {
    const state = createSharedState();
    const manager = createTargetManager(populationConfig());
    manager.tick(state, 0);
    const killedId = state.targets[1].id;
    const survivors = new Map(
      [state.targets[0], state.targets[2]].map((target) => [target.id, JSON.stringify(target.pos)] as const),
    );

    manager.markKilled(state, killedId);
    expect(state.targets.map((target) => target.id)).toEqual([...survivors.keys()]);
    expect(state.tVisible.has(killedId)).toBe(false);

    manager.tick(state, TICK_MS);
    expectPopulationInvariant(state);
    expect(state.targets[2].id).toBe('t3');
    expect(state.tVisible.get('t3')).toBe(TICK_MS);
    for (const target of state.targets.slice(0, 2)) expect(JSON.stringify(target.pos)).toBe(survivors.get(target.id));
  });

  it('treats unknown and repeated kills as no-ops and consumes only one replacement slot', () => {
    const state = createSharedState();
    const manager = createTargetManager(populationConfig(4));
    manager.tick(state, 0);
    const killedId = state.targets[1].id;

    manager.markKilled(state, 'unknown');
    expect(state.targets).toHaveLength(3);
    manager.markKilled(state, killedId);
    manager.markKilled(state, killedId);
    expect(state.targets).toHaveLength(2);

    manager.tick(state, TICK_MS);
    expect(state.targets.map((target) => target.id)).toEqual(['t0', 't2', 't3']);
    manager.markKilled(state, 'unknown');
    manager.tick(state, 2 * TICK_MS);
    expect(state.targets.map((target) => target.id)).toEqual(['t0', 't2', 't3']);
  });

  it('drains the remaining spawn budget as 3 → 3 → 2 → 1 → 0 without extra spawns', () => {
    const state = createSharedState();
    const manager = createTargetManager(populationConfig(5));
    manager.tick(state, 0);
    expect(state.targets).toHaveLength(3);

    const counts = [3];
    for (let i = 0; i < 5; i++) {
      manager.markKilled(state, state.targets[0].id);
      manager.tick(state, (i + 1) * TICK_MS);
      counts.push(state.targets.length);
    }
    expect(counts).toEqual([3, 3, 3, 2, 1, 0]);
    manager.tick(state, 99 * TICK_MS);
    expect(state.targets).toHaveLength(0);
  });

  it('reset reproduces the same-seed trace while a different seed changes it', () => {
    const config = populationConfig(20, 56001);
    const state = createSharedState();
    const manager = createTargetManager(config);

    function run(): string[] {
      manager.tick(state, 0);
      const trace = [snapshot(state.targets)];
      for (let i = 0; i < 12; i++) {
        manager.markKilled(state, state.targets[i % state.targets.length].id);
        manager.tick(state, (i + 1) * TICK_MS);
        trace.push(snapshot(state.targets));
      }
      return trace;
    }

    const first = run();
    const firstHash = traceHash(first);
    manager.reset(state);
    expect(traceHash(run())).toBe(firstHash);
    expect(traceHash(collectReplacementTrace(populationConfig(20, 56002), 12))).not.toBe(firstHash);
  });

  it('keeps 10,000 replacements finite, in bounds, unique, and at least 7 degrees apart', () => {
    const state = createSharedState();
    const manager = createTargetManager(populationConfig(10_003));
    manager.tick(state, 0);
    expectPopulationInvariant(state);

    for (let i = 0; i < 10_000; i++) {
      manager.markKilled(state, state.targets[i % state.targets.length].id);
      manager.tick(state, (i + 1) * TICK_MS);
      expectPopulationInvariant(state);
    }
  });

  it('uses the frozen 32-attempt cap, then a reproducible 63-cell farthest fallback', () => {
    expect(TARGET_POPULATION_SPAWN_ATTEMPT_LIMIT).toBe(32);
    const config: DrillConfig = {
      ...populationConfig(3, 94),
      targets: {
        ...populationConfig(3, 94).targets,
        spawnArea: {
          yawDegRange: [-8, 8],
          pitchDegRange: [0, 0],
          distanceURange: [12, 14],
          minAngularSeparationDeg: 8,
        },
      },
    };

    function fallbackTarget(): TargetState {
      const state = createSharedState();
      state.targets.push(externalTarget('left', -8), externalTarget('right', 8));
      createTargetManager(config).tick(state, 0);
      expect(state.targets).toHaveLength(3);
      return state.targets[2];
    }

    const first = fallbackTarget();
    const second = fallbackTarget();
    expect(first.pos).toEqual(second.pos);
    expect((Math.atan2(first.pos.x, -first.pos.z) * 180) / Math.PI).toBeCloseTo(0, 12);
    expect(angularSeparationDeg(first, externalTarget('left', -8))).toBeGreaterThanOrEqual(8 - 1e-9);
    expect(angularSeparationDeg(first, externalTarget('right', 8))).toBeGreaterThanOrEqual(8 - 1e-9);
  });

  it('fails deterministically instead of hanging when no separated population can fit', () => {
    const impossible: DrillConfig = {
      ...populationConfig(3, 1),
      targets: {
        ...populationConfig(3, 1).targets,
        spawnArea: {
          yawDegRange: [0, 0],
          pitchDegRange: [0, 0],
          distanceURange: [13, 13],
          minAngularSeparationDeg: 1,
        },
      },
    };

    for (let run = 0; run < 2; run++) {
      const state = createSharedState();
      expect(() => createTargetManager(impossible).tick(state, 0)).toThrowError(
        'Unable to place 3 active targets with 1° minimum angular separation after 32 seeded attempts and 63 fallback cells',
      );
    }
  });

  it('produces an identical non-vacuous per-tick trace at 30, 60, 144, and 240 render FPS', () => {
    const baseline = traceAtRenderFps(30);
    expect(new Set(baseline.flatMap((entry) => JSON.parse(entry).map((target: TargetState) => target.id))).size).toBeGreaterThan(3);
    for (const renderFps of [60, 144, 240]) expect(traceAtRenderFps(renderFps)).toEqual(baseline);
  });
});
