import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { createMetricsDashboard } from '../../src/metrics/MetricsDashboard.ts';
import type { TargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import type { TargetState } from '../../src/state/types.ts';
import type { WeaponConfig } from '../../src/weapon/WeaponConfig.ts';
import { ak47 } from '../../src/weapon/weapons.ts';

const TICK_MS = 1000 / SIM_HZ;
const EXPECTED_TICKS = 10;
const END_MS = (EXPECTED_TICKS + 0.5) * TICK_MS;

const projectileWeapon: WeaponConfig = {
  ...ak47,
  id: 'ak47_projectile_regression',
  inaccuracy: {
    stand: 0,
    crouch: 0,
    fire: 0,
    move: 0,
    recoveryTimeStand: ak47.inaccuracy.recoveryTimeStand,
    recoveryTimeCrouch: ak47.inaccuracy.recoveryTimeCrouch,
  },
  bullet: { model: 'projectile', speedU: 832, gravityU: 1, maxRangeU: 64 },
};

const hitscanWeapon: WeaponConfig = {
  ...ak47,
  id: 'ak47_hitscan_regression',
  inaccuracy: projectileWeapon.inaccuracy,
};

interface ProjectileRun {
  ticks: number;
  snapshot: DataRecorderSnapshot;
  activeBullets: number;
  overflowCount: number;
  impacts: Array<{ seq: number; x: number; y: number; z: number }>;
  tracers: Array<{ seq: number; ox: number; oy: number; oz: number; ex: number; ey: number; ez: number }>;
  remainingTargets: string[];
}

const frameSequences: Record<string, number[]> = {
  'stable 60 Hz': framesAt(1000 / 60, END_MS),
  'stable 144 Hz': framesAt(1000 / 144, END_MS),
  'stable 240 Hz': framesAt(1000 / 240, END_MS),
  'jitter 144 Hz +/-50%': jitterFrames(1000 / 144, END_MS),
};

function canonicalFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k <= EXPECTED_TICKS; k++) abs.push(k * TICK_MS);
  return abs;
}

function runProjectile(absTimes: readonly number[]): ProjectileRun {
  return runWeapon(absTimes, projectileWeapon);
}

function runWeapon(absTimes: readonly number[], weapon: WeaponConfig): ProjectileRun {
  const state = createSharedState();
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const clock: Clock = { now: () => 0 };
  const targetManager = createTargetManagerStub();
  const camera = createCamera();
  const loop = createSimLoop(
    state,
    clock,
    SIM_HZ,
    targetManager,
    camera,
    undefined,
    recorder,
    weapon,
    2026,
  );

  const target = makeTarget('t0', 0, -8);
  state.targets.push(target);
  recorder.recordEvent({
    type: 'visible',
    targetId: target.id,
    side: target.side,
    t: 0,
    targetX: target.pos.x,
    targetY: target.pos.y,
    targetZ: target.pos.z,
  });
  pushEvent(state, { type: 'fire', down: true, t: 0 });
  pushEvent(state, { type: 'fire', down: false, t: 1 });

  let ticks = 0;
  for (const now of absTimes) ticks += loop.pump(now).ticks;

  return {
    ticks,
    snapshot: recorder.snapshot(),
    activeBullets: state.bullets.activeCount,
    overflowCount: state.bullets.overflowCount,
    impacts: collectImpacts(state),
    tracers: collectTracers(state),
    remainingTargets: state.targets.map((target) => target.id),
  };
}

function createTargetManagerStub(): TargetManager {
  return {
    tick() {},
    markKilled(state, id) {
      const i = state.targets.findIndex((target) => target.id === id);
      if (i >= 0) state.targets.splice(i, 1);
    },
    reset() {},
  };
}

function makeTarget(id: string, x: number, z: number): TargetState {
  return {
    id,
    side: 'R',
    pos: { x, y: 1.5, z },
    visible: true,
    alive: true,
    hitbox: { width: 1, height: 2, depth: 1, part: 'body' },
  };
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 1.5, -1);
  camera.updateMatrixWorld(true);
  return camera;
}

function collectImpacts(state: SharedState): ProjectileRun['impacts'] {
  const out: ProjectileRun['impacts'] = [];
  for (let i = 0; i < state.impacts.seq.length; i++) {
    const seq = state.impacts.seq[i];
    if (seq === 0) continue;
    out.push({ seq, x: state.impacts.x[i], y: state.impacts.y[i], z: state.impacts.z[i] });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

function collectTracers(state: SharedState): ProjectileRun['tracers'] {
  const out: ProjectileRun['tracers'] = [];
  for (let i = 0; i < state.shotRays.seq.length; i++) {
    const seq = state.shotRays.seq[i];
    if (seq === 0) continue;
    out.push({
      seq,
      ox: state.shotRays.ox[i],
      oy: state.shotRays.oy[i],
      oz: state.shotRays.oz[i],
      ex: state.shotRays.ex[i],
      ey: state.shotRays.ey[i],
      ez: state.shotRays.ez[i],
    });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 25017;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const abs: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand());
    if (t + d >= endMs) break;
    t += d;
    abs.push(t);
  }
  abs.push(endMs);
  return abs;
}

const canonical = runProjectile(canonicalFrames());

describe('WP-25 projectile determinism regression', () => {
  for (const [name, frames] of Object.entries(frameSequences)) {
    it(`${name}: projectile hit event, impact, and tracer match canonical`, () => {
      const run = runProjectile(frames);

      expect(run.ticks).toBe(EXPECTED_TICKS);
      expect(run).toEqual(canonical);
    });
  }

  it('canonical run records decoupled fire and hit events for the same shotSeq', () => {
    const fire = canonical.snapshot.events.find((event) => event.type === 'fire');
    const hit = canonical.snapshot.events.find((event) => event.type === 'hit');

    expect(fire).toMatchObject({ type: 'fire', hit: false, shotSeq: 1, targetId: 't0' });
    expect(hit).toMatchObject({ type: 'hit', shotSeq: 1, targetId: 't0', part: 'body' });
    if (fire?.type !== 'fire' || hit?.type !== 'hit') throw new Error('expected projectile fire/hit events');
    expect(hit.t).toBeGreaterThan(fire.t);
    expect(hit.timeOfFlightMs).toBeCloseTo(hit.t - fire.t, 12);
    expect(canonical.activeBullets).toBe(0);
    expect(canonical.remainingTargets).toEqual([]);
  });

  it('keeps shot-layer firstShot and t_fire semantics identical to hitscan for the same input', () => {
    const hitscan = runWeapon(canonicalFrames(), hitscanWeapon);
    const projectileFire = fireRows(canonical.snapshot).map((event) => ({
      t: event.t,
      firstShot: event.firstShot,
      targetId: event.targetId,
    }));
    const hitscanFire = fireRows(hitscan.snapshot).map((event) => ({
      t: event.t,
      firstShot: event.firstShot,
      targetId: event.targetId,
    }));

    expect(projectileFire).toEqual(hitscanFire);
    expect(fireRows(hitscan.snapshot)[0]).toMatchObject({ hit: true, firstShot: true });
    expect(fireRows(canonical.snapshot)[0]).toMatchObject({ hit: false, firstShot: true, shotSeq: 1 });
  });

  it('keeps MetricsDashboard finite and backfills projectile first-shot outcome from hit events', () => {
    const metrics = createMetricsDashboard().compute(canonical.snapshot);

    expect(metrics.firstShotHitRate).toBe(100);
    expect(metrics.counterReactionMs.mean).toBe(0);
    expect(metrics.residualSpeed.mean).toBe(0);
    expect(metrics.fireTimingAlignmentMs.mean).toBe(0);
    expect(metrics.crosshairOffset.mean).toBe(0);
    expect(metrics.switchTimeMs.mean).toBe(0);
    expect(metrics.rhythmStability).toBe(0);
    expect(metrics.leftRightSymmetry.diff).toBe(0);
    expect(Number.isFinite(metrics.recoilCompensationError.meanDeg)).toBe(true);
    expect(Number.isFinite(metrics.recoilCompensationError.rmsDeg)).toBe(true);
  });
});

function fireRows(snapshot: DataRecorderSnapshot) {
  return snapshot.events.filter((event) => event.type === 'fire');
}
