import * as THREE from 'three/webgpu';
import drillJson from '../../drills/counterstrafe_ad_v1.json';
import { createDataRecorder } from '../../src/data/DataRecorder.ts';
import { loadDrill } from '../../src/drill/DrillLoader.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { createSharedState, type SharedState } from '../../src/state/SharedState.ts';
import { pushEvent } from '../../src/state/inputRingTestUtil.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { ak47 } from '../../src/weapon/weapons.ts';

const TICK_MS = 1000 / SIM_HZ;
const CAMERA_EYE_HEIGHT = 1.6;
const CAMERA_Z = 4;

export const SPRAY_RNG_SEED = 1;
export const SPRAY_FIRE_DOWN_MS = 3100;
export const SPRAY_FIRE_UP_MS = 6100;
export const SPRAY_EXPECTED_TICKS = 800;
export const SPRAY_END_MS = (SPRAY_EXPECTED_TICKS + 0.5) * TICK_MS;

export interface SprayShot {
  shot: number;
  t: number;
  tick: number;
  aimPunchPitchDeg: number;
  aimPunchYawDeg: number;
  rawPunchPitchDeg: number;
  rawPunchYawDeg: number;
  spreadX: number;
  spreadY: number;
  impactX: number;
  impactY: number;
  impactZ: number;
  recoilIndex: number;
  ammoBefore: number;
}

export interface SprayBaseline {
  drillId: string;
  weaponId: string;
  rngSeed: number;
  fireWindowMs: { down: number; up: number };
  expectedTicks: number;
  aimFixture: {
    yawRad: number;
    pitchRad: number;
    note: string;
  };
  shots: SprayShot[];
  final: {
    ticks: number;
    shots: number;
    impactTotal: number;
    aimPunchPitchDeg: number;
    aimPunchYawDeg: number;
    rawPunchPitchDeg: number;
    rawPunchYawDeg: number;
    recoilIndex: number;
    ammo: number;
    recorderOverflow: boolean;
  };
}

export interface SprayRun {
  baseline: SprayBaseline;
  phase: string;
}

export const sprayFrameSequences: Record<string, number[]> = {
  '穩定 60 Hz': framesAt(1000 / 60, SPRAY_END_MS),
  '穩定 144 Hz': framesAt(1000 / 144, SPRAY_END_MS),
  '穩定 240 Hz': framesAt(1000 / 240, SPRAY_END_MS),
};

export function canonicalSprayFrames(): number[] {
  const abs: number[] = [];
  for (let k = 1; k <= SPRAY_EXPECTED_TICKS; k++) abs.push(k * TICK_MS);
  return abs;
}

export function runSpray(absTimes: readonly number[]): SprayRun {
  const config = loadDrill(drillJson);
  const state = createSharedState();
  const clock: Clock = { now: () => 0 };
  const recorder = createDataRecorder({ simHz: SIM_HZ });
  const targetManager = createTargetManager(config);
  const drillRunner = createDrillRunner(state, targetManager);
  const camera = createCamera();
  const sim = createSimLoop(state, clock, SIM_HZ, targetManager, camera, drillRunner, recorder, ak47, SPRAY_RNG_SEED);

  drillRunner.start(config);
  applyAimFixture(state);
  pushEvent(state, { type: 'fire', down: true, t: SPRAY_FIRE_DOWN_MS });
  pushEvent(state, { type: 'fire', down: false, t: SPRAY_FIRE_UP_MS });

  let ticks = 0;
  for (const now of absTimes) ticks += sim.pump(now).ticks;

  const snapshot = recorder.snapshot();
  const impacts = collectImpacts(state);
  const fires = snapshot.events.filter((e): e is Extract<(typeof snapshot.events)[number], { type: 'fire' }> => e.type === 'fire');
  const shots: SprayShot[] = fires.map((f, index) => {
    const impact = impacts[index];
    if (impact === undefined) throw new Error(`missing impact for shot ${index + 1}`);
    return {
      shot: index + 1,
      t: round(f.t),
      tick: snapshot.ticks.findIndex((tk) => tk.t >= f.t) + 1,
      aimPunchPitchDeg: round(f.aimPunchPitch ?? 0),
      aimPunchYawDeg: round(f.aimPunchYaw ?? 0),
      rawPunchPitchDeg: round((f.aimPunchPitch ?? 0) * 2),
      rawPunchYawDeg: round((f.aimPunchYaw ?? 0) * 2),
      spreadX: round(f.spreadX ?? 0),
      spreadY: round(f.spreadY ?? 0),
      impactX: round(impact.x),
      impactY: round(impact.y),
      impactZ: round(impact.z),
      recoilIndex: round(f.recoilIndex ?? 0),
      ammoBefore: f.ammo ?? 0,
    };
  });

  return {
    phase: drillRunner.phase,
    baseline: {
      drillId: config.drillId,
      weaponId: ak47.id,
      rngSeed: SPRAY_RNG_SEED,
      fireWindowMs: { down: SPRAY_FIRE_DOWN_MS, up: SPRAY_FIRE_UP_MS },
      expectedTicks: SPRAY_EXPECTED_TICKS,
      aimFixture: {
        yawRad: 0,
        pitchRad: 0,
        note: 'neutral fixed aim; no per-frame auto aim so impact projection is keyed only by sim tick, recoil and spread',
      },
      shots,
      final: {
        ticks,
        shots: shots.length,
        impactTotal: state.impacts.total,
        aimPunchPitchDeg: round(state.recoilState.aimPunchPitchDeg),
        aimPunchYawDeg: round(state.recoilState.aimPunchYawDeg),
        rawPunchPitchDeg: round(state.recoilState.aimPunchPitchDeg * 2),
        rawPunchYawDeg: round(state.recoilState.aimPunchYawDeg * 2),
        recoilIndex: round(state.recoilState.recoilIndex),
        ammo: state.weapon.ammo,
        recorderOverflow: snapshot.recorderOverflow,
      },
    },
  };
}

function framesAt(periodMs: number, endMs: number): number[] {
  const abs: number[] = [];
  for (let t = periodMs; t < endMs; t += periodMs) abs.push(t);
  if (abs.length === 0 || abs[abs.length - 1] < endMs) abs.push(endMs);
  return abs;
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, CAMERA_EYE_HEIGHT, CAMERA_Z);
  camera.lookAt(0, CAMERA_EYE_HEIGHT, -CAMERA_Z);
  camera.updateMatrixWorld(true);
  return camera;
}

function applyAimFixture(state: SharedState): void {
  state.aim.yaw = 0;
  state.aim.pitch = 0;
}

function collectImpacts(state: SharedState): Array<{ seq: number; x: number; y: number; z: number }> {
  const impacts: Array<{ seq: number; x: number; y: number; z: number }> = [];
  for (let i = 0; i < state.impacts.seq.length; i++) {
    const seq = state.impacts.seq[i];
    if (seq === 0) continue;
    impacts.push({ seq, x: state.impacts.x[i], y: state.impacts.y[i], z: state.impacts.z[i] });
  }
  impacts.sort((a, b) => a.seq - b.seq);
  return impacts;
}

function round(value: number): number {
  return Number(value.toFixed(12));
}
