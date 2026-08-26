import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { resolveTargetHitbox, targetHitboxToConfig } from '../drill/DrillConfig.ts';
import { loadDrill } from '../drill/DrillLoader.ts';
import { trackingLongrangeV1 } from '../drill/tracking_longrange_v1.ts';
import type { TargetState } from '../state/types.ts';
import { raycastWithRay } from '../sim/HitDetector.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE_HEIGHT = 1.6;
const TARGET_Y = 1.6;
const TARGET_Z = -4;
const MOTION_RANGE = 1; // horizontal pingpong half-amplitude (u), matching tracking_v1
const OFF_TARGET_X = 6; // aim held far from the corridor → never on-target
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const LONGRANGE_TARGET_Y = 1.5;

type HitboxMeta = NonNullable<NonNullable<Meta['targets']>['hitbox']>;

const longrangeConfig = loadDrill(trackingLongrangeV1.drill);
const longrangeHitbox = targetHitboxToConfig(resolveTargetHitbox(longrangeConfig));
const longrangeSpawn = spawnPointFromLongrangeConfig();
const longrangeSeed = longrangeConfig.sequence.seed ?? 23002;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 18018,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-07-09T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
};

describe('deriveTrackingMetrics', () => {
  it('round-trips tracking_longrange_v1 small-angle acquisition within one tick from export JSON', () => {
    const visibleTick = 24;
    const onsetTick = 41;
    const payload = makeLongrangeRoundTripPayload({
      visibleTick,
      totalTicks: 96,
      mode: 'lock-at',
      onsetTick,
    });
    const result = deriveTrackingMetrics(payload);
    const presentation = onlyPresentation(result);

    expect(payload.meta.drillId).toBe('tracking_longrange_v1');
    expect(payload.meta.targets?.hitbox).toEqual({ widthU: 0.5, heightU: 1, depthU: 0.5, shape: 'box' });
    expect(result.options.hitbox).toEqual({ width: 0.5, height: 1, depth: 0.5 });
    expect(angularHeightDeg(longrangeHitbox.heightU, longrangeConfig.targets.distance)).toBeCloseTo(0.5, 12);
    expect(presentation.acquisitionFailure).toBe(false);
    expect(Math.abs(presentation.tAcquireMs! - (onsetTick - visibleTick) * TICK_MS)).toBeLessThanOrEqual(TICK_MS);
    expect(presentation.totPercent).toBe(100);
    expect(presentation.rmsEpsilonDeg!).toBeLessThan(1e-6);
  });

  it('keeps longrange endpoint sanity at perfect tracking and total miss', () => {
    const perfect = onlyPresentation(
      deriveTrackingMetrics(makeLongrangeRoundTripPayload({ visibleTick: 8, totalTicks: 56, mode: 'perfect' })),
    );
    const missResult = deriveTrackingMetrics(
      makeLongrangeRoundTripPayload({ visibleTick: 8, totalTicks: 56, mode: 'stationary-miss' }),
    );
    const miss = onlyPresentation(missResult);

    expect(perfect.acquisitionFailure).toBe(false);
    expect(perfect.tAcquireMs).toBe(0);
    expect(perfect.totPercent).toBe(100);
    expect(perfect.rmsEpsilonDeg!).toBeLessThan(1e-6);
    expect(miss.acquisitionFailure).toBe(true);
    expect(missResult.acquisitionFailureRate).toBe(1);
    expect(miss.totPercent).toBeUndefined();
  });

  it('uses sub-tick interpolation for longrange small-hitbox raycasts', () => {
    const target = makeLongrangeInterpolatedTarget();
    const origin = new THREE.Vector3(0, EYE_HEIGHT, 0);
    const firePoint = { x: 0.25, y: LONGRANGE_TARGET_Y, z: -longrangeConfig.targets.distance };
    const direction = new THREE.Vector3(firePoint.x, firePoint.y - EYE_HEIGHT, firePoint.z).normalize();

    expect(raycastWithRay(origin, direction, [target]).hit).toBe(false);
    expect(raycastWithRay(origin, direction, [target], undefined, 0.25)).toEqual({
      hit: true,
      targetId: 'longrange-subtick',
      part: undefined,
    });
  });

  it('reports near-perfect tracking when the aim rides the target center every tick', () => {
    const payload = makeRoundTripPayload({ visibleTick: 20, totalTicks: 80, mode: 'perfect' });
    const presentation = onlyPresentation(deriveTrackingMetrics(payload));

    expect(presentation.acquisitionFailure).toBe(false);
    expect(presentation.tAcquireMs).toBeCloseTo(0, 9); // on-target from the first visible tick
    expect(presentation.totPercent).toBe(100);
    expect(presentation.rmsEpsilonDeg!).toBeLessThan(1e-6);
    expect(presentation.p95EpsilonDeg!).toBeLessThan(1e-6);
  });

  it('records an acquisition failure when the aim never covers the moving target', () => {
    const payload = makeRoundTripPayload({ visibleTick: 20, totalTicks: 80, mode: 'stationary-miss' });
    const result = deriveTrackingMetrics(payload);
    const presentation = onlyPresentation(result);

    expect(presentation.acquisitionFailure).toBe(true);
    expect(presentation.tAcquireMs).toBeUndefined();
    expect(presentation.totPercent).toBeUndefined(); // excluded from TOT aggregation
    expect(presentation.rmsEpsilonDeg).toBeUndefined();
    expect(result.acquisitionFailureRate).toBe(1);
  });

  it('recovers a known acquisition onset within one tick', () => {
    const visibleTick = 20;
    const onsetTick = 45;
    const payload = makeRoundTripPayload({ visibleTick, totalTicks: 90, mode: 'lock-at', onsetTick });
    const presentation = onlyPresentation(deriveTrackingMetrics(payload));

    expect(presentation.acquisitionFailure).toBe(false);
    const expectedAcquireMs = (onsetTick - visibleTick) * TICK_MS;
    expect(Math.abs(presentation.tAcquireMs! - expectedAcquireMs)).toBeLessThanOrEqual(TICK_MS + 1e-9);
    // TOT window starts at first-on-target; from onset on it tracks perfectly → 100%.
    expect(presentation.totPercent).toBe(100);
    expect(presentation.rmsEpsilonDeg!).toBeLessThan(1e-6);
  });

  it('aggregates the acquisition failure rate across multiple presentations', () => {
    const payload = makeMultiPresentationPayload();
    const result = deriveTrackingMetrics(payload);

    expect(result.presentations).toHaveLength(2);
    expect(result.presentations[0].acquisitionFailure).toBe(false);
    expect(result.presentations[1].acquisitionFailure).toBe(true);
    expect(result.acquisitionFailureRate).toBe(0.5);
    // A presentation window must not leak samples into the next presentation.
    expect(result.presentations[0].windowEndMs).toBeCloseTo(result.presentations[1].tVisibleMs, 9);
  });

  it('reads meta.targets.hitbox before options.hitbox for on-target geometry', () => {
    const payload = makeRoundTripPayload({
      visibleTick: 0,
      totalTicks: 0,
      mode: 'edge-inside',
      hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 },
    });
    const result = deriveTrackingMetrics(payload, { hitbox: { width: 0.1, height: 0.1, depth: 0.1 } });
    const presentation = onlyPresentation(result);

    expect(result.options.hitbox).toEqual({ width: 0.5, height: 1, depth: 0.5 });
    expect(presentation.acquisitionFailure).toBe(false);
    expect(presentation.totPercent).toBe(100);
  });

  it('edge aim fixture keeps sim hit and offline on-target geometry identical', () => {
    const hitbox = { widthU: 0.5, heightU: 1, depthU: 0.5 };
    expect(simAndOfflineOnTarget(0.24, hitbox)).toEqual({ simHit: true, offlineOnTarget: true });
    expect(simAndOfflineOnTarget(0.3, hitbox)).toEqual({ simHit: false, offlineOnTarget: false });
  });

  it('resolves eyeOrigin from meta.scene.eye / meta.simToWorld without any options (G-7 round-trip)', () => {
    const payload = makeRoundTripPayload({ visibleTick: 0, totalTicks: 0, mode: 'edge-inside' });
    const withSceneMeta: ExportPayload = {
      ...payload,
      meta: {
        ...payload.meta,
        simToWorld: 0.01,
        scene: { sceneId: 'field-low', assetPackVersion: 'field-low-v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 4 } },
      },
    };

    const result = deriveTrackingMetrics(withSceneMeta);

    expect(result.options.eyeOrigin).toEqual({ base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'meta' });
  });
});

interface FixtureOptions {
  visibleTick: number;
  totalTicks: number;
  mode: 'perfect' | 'stationary-miss' | 'lock-at' | 'edge-inside';
  onsetTick?: number;
  hitbox?: HitboxMeta;
}

function makeRoundTripPayload(options: FixtureOptions): ExportPayload {
  const recorder = createDataRecorder({ capacity: options.totalTicks + 1 });

  for (let tick = 0; tick <= options.totalTicks; tick++) {
    const t = tickTime(tick);
    const active = tick >= options.visibleTick;
    const target = active ? targetAt(tick) : null;

    if (tick === options.visibleTick) {
      recorder.recordEvent({
        type: 'visible',
        targetId: 'target-1',
        side: 'R',
        t,
        targetX: target!.x,
        targetY: target!.y,
        targetZ: target!.z,
      });
    }

    const aim = aimForTick(tick, options, target);
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target ? target.x : null,
      ty: target ? target.y : null,
      tz: target ? target.z : null,
      aim,
      keys: [],
    });
  }

  return options.hitbox === undefined
    ? roundTrip(recorder.snapshot())
    : roundTripWithMeta(recorder.snapshot(), { targets: { hitbox: options.hitbox } });
}

function makeMultiPresentationPayload(): ExportPayload {
  const visibleA = 20;
  const advanceTick = 60; // presentation A ends, presentation B (a miss) begins
  const totalTicks = 100;
  const recorder = createDataRecorder({ capacity: totalTicks + 1 });

  for (let tick = 0; tick <= totalTicks; tick++) {
    const t = tickTime(tick);
    const presentationA = tick >= visibleA && tick < advanceTick;
    const presentationB = tick >= advanceTick;
    const target = presentationA || presentationB ? targetAt(tick) : null;

    if (tick === visibleA) {
      recorder.recordEvent({ type: 'visible', targetId: 'target-1', side: 'R', t, targetX: target!.x, targetY: target!.y, targetZ: target!.z });
    }
    if (tick === advanceTick) {
      recorder.recordEvent({ type: 'visible', targetId: 'target-2', side: 'L', t, targetX: target!.x, targetY: target!.y, targetZ: target!.z });
    }

    // Presentation A: perfect tracking. Presentation B: aim held off-target (miss).
    const aim = presentationB ? aimAtOffTarget() : target ? aimAtCenter(target) : aimAtOffTarget();
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target ? target.x : null,
      ty: target ? target.y : null,
      tz: target ? target.z : null,
      aim,
      keys: [],
    });
  }

  return roundTrip(recorder.snapshot());
}

interface LongrangeFixtureOptions {
  visibleTick: number;
  totalTicks: number;
  mode: 'perfect' | 'stationary-miss' | 'lock-at';
  onsetTick?: number;
}

function makeLongrangeRoundTripPayload(options: LongrangeFixtureOptions): ExportPayload {
  const recorder = createDataRecorder({ capacity: options.totalTicks + 1 });

  for (let tick = 0; tick <= options.totalTicks; tick++) {
    const t = tickTime(tick);
    const active = tick >= options.visibleTick;
    const target = active ? longrangeTargetAt(tick - options.visibleTick) : null;

    if (tick === options.visibleTick) {
      recorder.recordEvent({
        type: 'visible',
        targetId: 'longrange-target-1',
        side: 'R',
        t,
        targetX: target!.x,
        targetY: target!.y,
        targetZ: target!.z,
      });
    }

    const aim = longrangeAimForTick(tick, options, target);
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target ? target.x : null,
      ty: target ? target.y : null,
      tz: target ? target.z : null,
      aim,
      keys: [],
    });
  }

  return roundTripWithMeta(recorder.snapshot(), {
    drillId: 'tracking_longrange_v1',
    rngSeed: longrangeSeed,
    targets: { hitbox: longrangeHitbox },
    spawn: {
      seed: longrangeSeed,
      spawnArea: longrangeConfig.targets.spawnArea,
      motion: longrangeConfig.targets.motion,
      presentationMs: longrangeConfig.timing.presentationMs,
    },
  });
}

function longrangeAimForTick(
  tick: number,
  options: LongrangeFixtureOptions,
  target: { x: number; y: number; z: number } | null,
): { yaw: number; pitch: number } {
  if (target === null) return aimAtPoint(longrangeMissPoint(longrangeSpawn));
  if (options.mode === 'stationary-miss') return aimAtPoint(longrangeMissPoint(target));
  if (options.mode === 'lock-at' && tick < options.onsetTick!) return aimAtPoint(longrangeMissPoint(target));
  return aimAtPoint(target);
}

function longrangeTargetAt(ageTicks: number): { x: number; y: number; z: number } {
  const motion = longrangeConfig.targets.motion!;
  const ageS = ageTicks / SIM_HZ;
  const displacement = triangleWave((motion.speed ?? 0) * ageS, motion.range ?? 0);
  return {
    x: longrangeSpawn.x + displacement,
    y: LONGRANGE_TARGET_Y,
    z: longrangeSpawn.z,
  };
}

function longrangeMissPoint(target: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: target.x + 2, y: target.y, z: target.z };
}

function spawnPointFromLongrangeConfig(): { x: number; y: number; z: number } {
  const spawnArea = longrangeConfig.targets.spawnArea!;
  const yawDeg = spawnArea.yawDegRange[0];
  const distance = spawnArea.distanceURange[0];
  const yawRad = yawDeg * DEG_TO_RAD;
  return {
    x: Math.sin(yawRad) * distance,
    y: LONGRANGE_TARGET_Y,
    z: -Math.cos(yawRad) * distance,
  };
}

function makeLongrangeInterpolatedTarget(): TargetState {
  return {
    id: 'longrange-subtick',
    side: 'R',
    posPrev: { x: 0, y: LONGRANGE_TARGET_Y, z: -longrangeConfig.targets.distance },
    pos: { x: 1, y: LONGRANGE_TARGET_Y, z: -longrangeConfig.targets.distance },
    visible: true,
    alive: true,
    hitbox: {
      width: longrangeHitbox.widthU,
      height: longrangeHitbox.heightU,
      depth: longrangeHitbox.depthU,
      shape: 'box',
    },
  };
}

function triangleWave(distance: number, range: number): number {
  if (range <= 0) return 0;
  const period = 4 * range;
  let p = distance % period;
  if (p < 0) p += period;
  if (p < range) return p;
  if (p < 3 * range) return 2 * range - p;
  return p - period;
}

function angularHeightDeg(heightU: number, distanceU: number): number {
  return 2 * Math.atan(heightU / (2 * distanceU)) * RAD_TO_DEG;
}

function aimForTick(tick: number, options: FixtureOptions, target: { x: number; y: number; z: number } | null) {
  if (options.mode === 'stationary-miss') return aimAtOffTarget();
  if (options.mode === 'edge-inside') return aimAtPoint({ x: 0.24, y: TARGET_Y, z: TARGET_Z });
  if (options.mode === 'lock-at' && tick < options.onsetTick!) return aimAtOffTarget();
  if (target === null) return aimAtOffTarget();
  return aimAtCenter(target);
}

/** Horizontal pingpong-style target trajectory (source units), centered on x = 0 at distance 4. */
function targetAt(tick: number): { x: number; y: number; z: number } {
  const x = MOTION_RANGE * Math.sin(tick * 0.15);
  return { x, y: TARGET_Y, z: TARGET_Z };
}

/** Yaw/pitch that aims exactly at a world point from eye (0, EYE_HEIGHT, 0). */
function aimAtCenter(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  return aimAtPoint(point);
}

function aimAtPoint(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = point.x;
  const dy = point.y - EYE_HEIGHT;
  const dz = point.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function aimAtOffTarget(): { yaw: number; pitch: number } {
  return aimAtCenter({ x: OFF_TARGET_X, y: TARGET_Y, z: TARGET_Z });
}

function roundTrip(snapshot: ReturnType<ReturnType<typeof createDataRecorder>['snapshot']>): ExportPayload {
  const payload = buildExportPayload(meta, snapshot);
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function roundTripWithMeta(
  snapshot: ReturnType<ReturnType<typeof createDataRecorder>['snapshot']>,
  metaOverride: Partial<Meta>,
): ExportPayload {
  const payload = buildExportPayload({ ...meta, ...metaOverride }, snapshot);
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function simAndOfflineOnTarget(
  aimXAtTargetDepth: number,
  hitbox: HitboxMeta,
): { simHit: boolean; offlineOnTarget: boolean } {
  const target = makeHitboxTarget(hitbox);
  const origin = new THREE.Vector3(0, EYE_HEIGHT, 0);
  const point = { x: aimXAtTargetDepth, y: TARGET_Y, z: TARGET_Z };
  const direction = new THREE.Vector3(point.x, point.y - EYE_HEIGHT, point.z).normalize();
  const simHit = raycastWithRay(origin, direction, [target]).hit;

  const recorder = createDataRecorder({ capacity: 2 });
  recorder.recordEvent({ type: 'visible', targetId: target.id, side: target.side, t: 0, targetX: target.pos.x, targetY: target.pos.y, targetZ: target.pos.z });
  recorder.recordTick({
    t: 0,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: target.pos.x,
    ty: target.pos.y,
    tz: target.pos.z,
    aim: aimAtPoint(point),
    keys: [],
  });
  const payload = roundTripWithMeta(recorder.snapshot(), { targets: { hitbox } });
  const offlineOnTarget = !onlyPresentation(deriveTrackingMetrics(payload)).acquisitionFailure;
  return { simHit, offlineOnTarget };
}

function makeHitboxTarget(hitbox: HitboxMeta): TargetState {
  return {
    id: 'edge-target',
    side: 'R',
    pos: { x: 0, y: TARGET_Y, z: TARGET_Z },
    visible: true,
    alive: true,
    hitbox: { width: hitbox.widthU, height: hitbox.heightU, depth: hitbox.depthU, shape: 'box' },
  };
}

function onlyPresentation(result: ReturnType<typeof deriveTrackingMetrics>) {
  expect(result.presentations).toHaveLength(1);
  return result.presentations[0];
}

function tickTime(tick: number): number {
  return tick * TICK_MS;
}
