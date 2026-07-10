import * as THREE from 'three/webgpu';
import { createDataRecorder, type DataRecorderSnapshot } from '../../src/data/DataRecorder.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { trackingLongrangeV1 } from '../../src/drill/tracking_longrange_v1.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { fieldLow } from '../../src/scene/scenes/field-low.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createSharedState } from '../../src/state/SharedState.ts';
import { ak47 } from '../../src/weapon/weapons.ts';

const TICK_MS = 1000 / SIM_HZ;
const CLOCK_BASE = 0;
const CAMERA_EYE_HEIGHT = 1.6;

export const EXPECTED_LONGRANGE_TICKS = 920;
export const LONGRANGE_END_MS = (EXPECTED_LONGRANGE_TICKS + 0.5) * TICK_MS;

export interface LongrangeTrackingRun {
  snapshot: DataRecorderSnapshot;
  phase: string;
  ticks: number;
  visibleCount: number;
  distinctTx: number;
  firstTargetRadialDistance: number | null;
}

export const longrangeFrameSequences: Record<string, number[]> = {
  'stable 60 Hz': framesAt(1000 / 60, LONGRANGE_END_MS),
  'stable 144 Hz': framesAt(1000 / 144, LONGRANGE_END_MS),
  'stable 240 Hz': framesAt(1000 / 240, LONGRANGE_END_MS),
  'jitter 144 Hz +/-50%': jitterFrames(1000 / 144, LONGRANGE_END_MS),
};

export function canonicalLongrangeFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k <= EXPECTED_LONGRANGE_TICKS; k++) abs.push(k * TICK_MS);
  return abs;
}

export function runLongrangeTracking(absTimes: readonly number[]): LongrangeTrackingRun {
  const config = loadDrill(trackingLongrangeV1.drill, fieldLow);
  const state = createSharedState();
  const clock: Clock = { now: () => CLOCK_BASE };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const camera = createCamera();
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, camera, drillRunner, recorder, ak47, config.sequence.seed);

  drillRunner.start(config);

  let ticks = 0;
  for (const now of absTimes) ticks += sim.pump(now).ticks;

  const snapshot = recorder.snapshot();
  const targetTicks = snapshot.ticks.filter((tk) => tk.tx !== null && tk.ty !== null && tk.tz !== null);
  const firstTarget = targetTicks[0];
  return {
    snapshot,
    phase: drillRunner.phase,
    ticks,
    visibleCount: snapshot.events.filter((event) => event.type === 'visible').length,
    distinctTx: new Set(targetTicks.map((tk) => tk.tx)).size,
    firstTargetRadialDistance:
      firstTarget !== undefined && firstTarget.tx !== null && firstTarget.tz !== null
        ? Math.hypot(firstTarget.tx, firstTarget.tz)
        : null,
  };
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

function jitterFrames(basePeriod: number, endMs: number): number[] {
  let seed = 23023;
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

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, CAMERA_EYE_HEIGHT, 0);
  camera.lookAt(0, CAMERA_EYE_HEIGHT, -1);
  camera.updateMatrixWorld(true);
  return camera;
}
