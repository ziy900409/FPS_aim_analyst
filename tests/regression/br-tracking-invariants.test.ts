import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { trackingBrVariants, type BrTrackingVariant } from '../../src/drill/tracking_br_v1.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop, type SimLoopOptions } from '../../src/loop/SimLoop.ts';
import { CameraController } from '../../src/view/CameraController.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import type { InputEvent } from '../../src/state/types.ts';
import type { SceneConfig } from '../../src/scene/SceneConfig.ts';
import { brField } from '../../src/scene/scenes/br-field.ts';
import { getWeapon } from '../../src/weapon/weapons.ts';

const TICK_MS = 1000 / SIM_HZ;
const END_MS = 3400;

interface BrRun {
  ticks: number;
  snapshot: DataRecorderSnapshot;
  phase: string;
}

const brAdsHitscan2Deg = requireVariant('ads_on', 'hitscan', '2deg');
const brAdsProjectile05Deg = requireVariant('ads_on', 'projectile', '0p5deg');

function brInputs(): InputEvent[] {
  return [
    { type: 'ads', down: true, t: 3100 },
    { type: 'fire', down: true, t: 3125 },
    { type: 'fire', down: false, t: 3135 },
    { type: 'ads', down: false, t: 3300 },
  ];
}

function runBrVariant(
  variant: BrTrackingVariant,
  frames: readonly number[],
  options: { scene?: SceneConfig; driveAdsDisplay?: boolean } = {},
): BrRun {
  const config = loadDrill(variant.drill, options.scene);
  const weapon = getWeapon(config.weaponId ?? 'ak47');
  const state = createSharedState();
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const camera = createCamera();
  const clock: Clock = { now: () => 0 };
  const simOptions: SimLoopOptions = {};

  if (options.driveAdsDisplay !== undefined) {
    const controller = new CameraController(camera, state.aim);
    controller.setAdsConfig(weapon.ads);
    if (options.driveAdsDisplay === true) {
      simOptions.afterTick = (_, tickEndMs) => controller.setAds(state.heldAds, tickEndMs);
    }
  }

  const loop = createSimLoop(
    state,
    clock,
    SIM_HZ,
    targetManager,
    camera,
    drillRunner,
    recorder,
    weapon,
    config.sequence.seed,
    simOptions,
  );
  drillRunner.start(config);
  for (const ev of brInputs()) pushEvent(state, ev);

  let ticks = 0;
  for (const now of frames) ticks += loop.pump(now).ticks;
  return { ticks, snapshot: recorder.snapshot(), phase: drillRunner.phase };
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 1.6, 4);
  camera.lookAt(0, 1.5, -120);
  camera.updateMatrixWorld(true);
  return camera;
}

function canonicalFrames(endMs = END_MS): number[] {
  const frames: number[] = [];
  for (let t = TICK_MS; t < endMs; t += TICK_MS) frames.push(t);
  frames.push(endMs);
  return frames;
}

function framesAt(periodMs: number, endMs = END_MS): number[] {
  const frames: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) frames.push(t);
  frames.push(endMs);
  return frames;
}

function jitterFrames(basePeriod: number, endMs = END_MS): number[] {
  let seed = 26026;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const frames: number[] = [];
  let t = 0;
  for (;;) {
    const d = basePeriod * (0.5 + rand());
    if (t + d >= endMs) break;
    t += d;
    frames.push(t);
  }
  frames.push(endMs);
  return frames;
}

function requireVariant(
  ads: BrTrackingVariant['axes']['ads'],
  ballistic: BrTrackingVariant['axes']['ballistic'],
  angularHeight: BrTrackingVariant['axes']['angularHeight'],
): BrTrackingVariant {
  const variant = trackingBrVariants.find(
    (candidate) =>
      candidate.axes.ads === ads &&
      candidate.axes.ballistic === ballistic &&
      candidate.axes.angularHeight === angularHeight,
  );
  if (variant === undefined) throw new Error(`missing BR variant ${ads}/${ballistic}/${angularHeight}`);
  return variant;
}

describe('WP-26 T4 BR tracking invariants', () => {
  it('br-field scene config does not change hitscan sim output versus the scene-free baseline', () => {
    const frames = framesAt(1000 / 144);
    const baseline = runBrVariant(brAdsHitscan2Deg, frames);
    const br = runBrVariant(brAdsHitscan2Deg, frames, { scene: brField });

    expect(br.ticks).toBe(baseline.ticks);
    expect(br.phase).toBe(baseline.phase);
    expect(br.snapshot).toEqual(baseline.snapshot);
  });

  it('ADS FOV/overlay display updates do not change the ADS-input sim sequence', () => {
    const frames = framesAt(1000 / 144);
    const displayOff = runBrVariant(brAdsHitscan2Deg, frames, { scene: brField, driveAdsDisplay: false });
    const displayOn = runBrVariant(brAdsHitscan2Deg, frames, { scene: brField, driveAdsDisplay: true });

    expect(displayOn.ticks).toBe(displayOff.ticks);
    expect(displayOn.phase).toBe(displayOff.phase);
    expect(displayOn.snapshot).toEqual(displayOff.snapshot);
    expect(displayOn.snapshot.events.filter((event) => event.type === 'ads')).toHaveLength(2);
    expect(displayOn.snapshot.ticks.some((tick) => tick.ads)).toBe(true);
  });

  it('BR projectile condition is render-FPS deterministic across stable and jittered frames', () => {
    const canonical = runBrVariant(brAdsProjectile05Deg, canonicalFrames(), { scene: brField });
    const sequences: Record<string, number[]> = {
      'stable 60 Hz': framesAt(1000 / 60),
      'stable 144 Hz': framesAt(1000 / 144),
      'stable 240 Hz': framesAt(1000 / 240),
      'jitter 144 Hz +/-50%': jitterFrames(1000 / 144),
    };

    for (const frames of Object.values(sequences)) {
      expect(runBrVariant(brAdsProjectile05Deg, frames, { scene: brField })).toEqual(canonical);
    }
    expect(canonical.snapshot.events.some((event) => event.type === 'fire' && event.shotSeq === 1)).toBe(true);
  });
});
