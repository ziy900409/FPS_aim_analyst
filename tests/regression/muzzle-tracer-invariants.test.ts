import * as THREE from 'three/webgpu';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const raycastProbe = vi.hoisted(() => ({ origins: [] as number[][] }));

vi.mock('../../src/sim/HitDetector.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/sim/HitDetector.ts')>();
  return {
    ...actual,
    raycastWithRay: (...args: Parameters<typeof actual.raycastWithRay>) => {
      raycastProbe.origins.push(args[0].toArray());
      return actual.raycastWithRay(...args);
    },
  };
});

import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop, simStep } from '../../src/loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import { createDataRecorder, type DataRecorder } from '../../src/data/DataRecorder.ts';
import type { TargetManager } from '../../src/sim/TargetManager.ts';
import type { TargetState } from '../../src/state/types.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { ak47 } from '../../src/weapon/weapons.ts';
import type { WeaponConfig } from '../../src/weapon/WeaponConfig.ts';

const TICK_MS = 1000 / SIM_HZ;
const CAMERA_POSITION = [2, 3, 4] as const;
const HIP_MUZZLE = [2.15, 2.88, 3.4] as const;
const ADS_MUZZLE = [2, 2.935, 3.4] as const;
const projectileWeapon: WeaponConfig = {
  ...ak47,
  id: 'muzzle_tracer_projectile_test',
  bullet: { model: 'projectile', speedU: 100, gravityU: 0, maxRangeU: 50 },
};

const targetManager: TargetManager = {
  tick() {},
  markKilled() {},
  reset() {},
};

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(CAMERA_POSITION[0], CAMERA_POSITION[1], -10);
  camera.updateMatrixWorld(true);
  return camera;
}

function createTarget(): TargetState {
  return {
    id: 'target',
    side: 'R',
    pos: { x: CAMERA_POSITION[0], y: CAMERA_POSITION[1], z: -8 },
    visible: true,
    alive: true,
    hitbox: { width: 1, height: 2, depth: 1, part: 'body' },
  };
}

function fireOne(
  state: SharedState,
  camera: THREE.Camera,
  weapon: WeaponConfig = ak47,
  ads = false,
  recorder?: DataRecorder,
): void {
  state.targets.push(createTarget());
  state.heldAds = ads;
  state.heldFire = true;
  state.weapon.nextFireT = 0;
  simStep(state, 1 / SIM_HZ, TICK_MS, targetManager, camera, undefined, undefined, undefined, recorder, weapon);
  state.heldFire = false;
  state.weapon.nextFireT = Infinity;
}

function advanceUntilTracer(
  state: SharedState,
  camera: THREE.Camera,
  weapon: WeaponConfig,
  recorder?: DataRecorder,
): void {
  for (let tick = 2; tick <= 64 && state.shotRays.total === 0; tick++) {
    simStep(
      state,
      1 / SIM_HZ,
      tick * TICK_MS,
      targetManager,
      camera,
      undefined,
      undefined,
      undefined,
      recorder,
      weapon,
    );
  }
  expect(state.shotRays.total).toBe(1);
}

function runAtFrames(frames: readonly number[], ads = false): [number, number, number] {
  const state = createSharedState();
  const camera = createCamera();
  const clock: Clock = { now: () => 0 };
  const loop = createSimLoop(state, clock, SIM_HZ, targetManager, camera);
  state.targets.push(createTarget());
  if (ads) pushEvent(state, { type: 'ads', down: true, t: 0 });
  pushEvent(state, { type: 'fire', down: true, t: 1 });
  pushEvent(state, { type: 'fire', down: false, t: 2 });
  for (const frame of frames) loop.pump(frame);
  return [state.shotRays.ox[0], state.shotRays.oy[0], state.shotRays.oz[0]];
}

describe('WP-27 muzzle tracer invariants', () => {
  beforeEach(() => {
    raycastProbe.origins.length = 0;
  });

  it('keeps the hitscan raycast origin byte-for-byte at camera world position', () => {
    const state = createSharedState();
    fireOne(state, createCamera());

    expect(raycastProbe.origins).toEqual([[...CAMERA_POSITION]]);
  });

  it('keeps projectile x/y/z and o* at camera origin while storing a separate muzzle m*', () => {
    const state = createSharedState();
    fireOne(state, createCamera(), projectileWeapon);

    expect([state.bullets.x[0], state.bullets.y[0], state.bullets.z[0]]).toEqual([...CAMERA_POSITION]);
    expect([state.bullets.ox[0], state.bullets.oy[0], state.bullets.oz[0]]).toEqual([...CAMERA_POSITION]);
    expect([state.bullets.mx[0], state.bullets.my[0], state.bullets.mz[0]]).toEqual([...HIP_MUZZLE]);
  });

  it('uses the hip muzzle origin for both hitscan and projectile tracers', () => {
    const hitscan = createSharedState();
    fireOne(hitscan, createCamera());

    const projectile = createSharedState();
    const projectileCamera = createCamera();
    fireOne(projectile, projectileCamera, projectileWeapon);
    advanceUntilTracer(projectile, projectileCamera, projectileWeapon);

    expect([hitscan.shotRays.ox[0], hitscan.shotRays.oy[0], hitscan.shotRays.oz[0]]).toEqual([...HIP_MUZZLE]);
    expect([projectile.shotRays.ox[0], projectile.shotRays.oy[0], projectile.shotRays.oz[0]]).toEqual([...HIP_MUZZLE]);
  });

  it('captures projectile muzzle origin at fire time when aim changes in later ticks', () => {
    const state = createSharedState();
    const camera = createCamera();
    fireOne(state, camera, projectileWeapon);
    state.aim.yaw = 1.1;
    state.aim.pitch = -0.4;
    advanceUntilTracer(state, camera, projectileWeapon);

    expect([state.shotRays.ox[0], state.shotRays.oy[0], state.shotRays.oz[0]]).toEqual([...HIP_MUZZLE]);
  });

  it('produces byte-for-byte identical tracer origins across render frame sequences', () => {
    const canonical: number[] = [];
    for (let tick = 1; tick <= 8; tick++) canonical.push(tick * TICK_MS);

    expect(runAtFrames([5, 18, 31, 47, 62.5])).toEqual(runAtFrames(canonical));
  });

  it('switches hip -> ADS -> hip as two discrete capture-at-fire muzzle origins', () => {
    const state = createSharedState();
    const camera = createCamera();

    fireOne(state, camera, ak47, false);
    fireOne(state, camera, ak47, true);
    fireOne(state, camera, ak47, false);

    const origins = [0, 1, 2].map((i) => [state.shotRays.ox[i], state.shotRays.oy[i], state.shotRays.oz[i]]);
    expect(origins).toEqual([[...HIP_MUZZLE], [...ADS_MUZZLE], [...HIP_MUZZLE]]);
    expect(new Set(origins.map((origin) => origin.join(','))).size).toBe(2);
  });

  it('keeps hit authority and fire/hit events byte-for-byte unchanged when ADS changes', () => {
    const hipHitscan = createSharedState();
    const hipHitscanRecorder = createDataRecorder({ capacity: 8 });
    fireOne(hipHitscan, createCamera(), ak47, false, hipHitscanRecorder);

    const adsHitscan = createSharedState();
    const adsHitscanRecorder = createDataRecorder({ capacity: 8 });
    fireOne(adsHitscan, createCamera(), ak47, true, adsHitscanRecorder);

    expect(raycastProbe.origins).toEqual([[...CAMERA_POSITION], [...CAMERA_POSITION]]);
    expect(adsHitscanRecorder.snapshot().events).toEqual(hipHitscanRecorder.snapshot().events);

    const hipProjectile = createSharedState();
    const hipProjectileCamera = createCamera();
    const hipProjectileRecorder = createDataRecorder({ capacity: 64 });
    fireOne(hipProjectile, hipProjectileCamera, projectileWeapon, false, hipProjectileRecorder);

    const adsProjectile = createSharedState();
    const adsProjectileCamera = createCamera();
    const adsProjectileRecorder = createDataRecorder({ capacity: 64 });
    fireOne(adsProjectile, adsProjectileCamera, projectileWeapon, true, adsProjectileRecorder);

    expect([adsProjectile.bullets.x[0], adsProjectile.bullets.y[0], adsProjectile.bullets.z[0]]).toEqual([
      hipProjectile.bullets.x[0],
      hipProjectile.bullets.y[0],
      hipProjectile.bullets.z[0],
    ]);
    expect([adsProjectile.bullets.ox[0], adsProjectile.bullets.oy[0], adsProjectile.bullets.oz[0]]).toEqual([
      hipProjectile.bullets.ox[0],
      hipProjectile.bullets.oy[0],
      hipProjectile.bullets.oz[0],
    ]);
    expect([hipProjectile.bullets.mx[0], hipProjectile.bullets.my[0], hipProjectile.bullets.mz[0]]).toEqual([
      ...HIP_MUZZLE,
    ]);
    expect([adsProjectile.bullets.mx[0], adsProjectile.bullets.my[0], adsProjectile.bullets.mz[0]]).toEqual([
      ...ADS_MUZZLE,
    ]);

    advanceUntilTracer(hipProjectile, hipProjectileCamera, projectileWeapon, hipProjectileRecorder);
    advanceUntilTracer(adsProjectile, adsProjectileCamera, projectileWeapon, adsProjectileRecorder);
    expect([hipProjectile.shotRays.ox[0], hipProjectile.shotRays.oy[0], hipProjectile.shotRays.oz[0]]).toEqual([
      ...HIP_MUZZLE,
    ]);
    expect([adsProjectile.shotRays.ox[0], adsProjectile.shotRays.oy[0], adsProjectile.shotRays.oz[0]]).toEqual([
      ...ADS_MUZZLE,
    ]);
    expect(adsProjectileRecorder.snapshot().events).toEqual(hipProjectileRecorder.snapshot().events);
  });

  it('produces byte-for-byte identical ADS tracer origins across render frame sequences', () => {
    const canonical: number[] = [];
    for (let tick = 1; tick <= 8; tick++) canonical.push(tick * TICK_MS);

    expect(runAtFrames([5, 18, 31, 47, 62.5], true)).toEqual(runAtFrames(canonical, true));
    expect(runAtFrames(canonical, true)).toEqual([...ADS_MUZZLE]);
  });
});
