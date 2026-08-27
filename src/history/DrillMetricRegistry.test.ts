import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { createDrillMetricRegistry } from './DrillMetricRegistry.ts';

const CENTER = { x: 0, y: 0, z: -10 };
const PERIPHERAL = { x: 5, y: 0, z: -Math.sqrt(75) };

describe('DrillMetricRegistry', () => {
  it('registers spider-shot-v2 with five unique, well-formed descriptors and exactly one primary', () => {
    const registry = createDrillMetricRegistry();
    const registration = registry.registrationForExactDrill('spider-shot-v2');
    expect(registration).toBeDefined();
    expect(registration!.version).toBe('1.0.0');

    const ids = registration!.descriptors.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'spider-v2.peripheral-hits-per-minute',
      'spider-v2.peripheral-first-shot-hit-rate',
      'spider-v2.median-peripheral-hit-time-ms',
      'spider-v2.median-fire-angle-error-deg',
      'spider-v2.median-overshoot-deg',
    ]);
    expect(registration!.descriptors.filter((d) => d.primary)).toHaveLength(1);
    expect(registration!.descriptors.find((d) => d.primary)!.id).toBe('spider-v2.peripheral-hits-per-minute');
    for (const descriptor of registration!.descriptors) {
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.unit.length).toBeGreaterThan(0);
      expect(['higher-is-better', 'lower-is-better', 'neutral']).toContain(descriptor.direction);
      expect(['integer', 'decimal-1', 'decimal-2', 'percent']).toContain(descriptor.format);
    }
  });

  it('does not fall back to family/prefix matching for near-miss drill ids', () => {
    const registry = createDrillMetricRegistry();
    expect(registry.registrationForExactDrill('spider-shot-v1')).toBeUndefined();
    expect(registry.registrationForExactDrill('spider-shot-v2-alt')).toBeUndefined();
    expect(registry.registrationForExactDrill('spider-shot-v20')).toBeUndefined();
    expect(registry.registrationForExactDrill('hold-click-v1')).toBeUndefined();
  });

  it('projects an unregistered drill as unregistered-drill without throwing', () => {
    const registry = createDrillMetricRegistry();
    const result = registry.project(makePayload({ drillId: 'hold-click-v1' }));
    expect(result).toEqual({ status: 'unregistered-drill', drillId: 'hold-click-v1' });
  });

  it('excludes a Practice payload as invalid-metric even if it slipped past the repository (FM-49.3)', () => {
    const registry = createDrillMetricRegistry();
    const result = registry.project(makePayload({ assessment: false }));
    expect(result).toEqual({ status: 'invalid-metric', reasonCode: 'not-assessment' });
  });

  it('verifies the first-shot outcome directly instead of trusting the window-wide hit outcome', () => {
    // Window 2's first fire misses but a later corrective fire in the same window hits — this is
    // exactly the risk the metric design doc flags (spider-v2-performance-metrics-design §risks):
    // `spiderShotMetrics.ts`'s `firstShot.hit` uses the whole window's outcome and would wrongly
    // mark this as a first-shot hit. The registry must not repeat that bug.
    const registry = createDrillMetricRegistry();
    const result = registry.project(makePayload({}));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    expect(result.qualityGateStatus).toBe('ok');
    expect(result.compatibilityKey.qualityGateStatus).toBe('ok');
    expect(result.compatibilityKey.taskId).toBe('spider-shot-v2');

    const byId = new Map(result.observations.map((o) => [o.metricId, o]));
    // duration = last tick t (500) - first tick t (0) = 500ms; both peripheral windows end in a
    // hit (window 1's own first shot; window 2's corrective second shot) → 2 hits / 500ms.
    expect(byId.get('spider-v2.peripheral-hits-per-minute')).toEqual({
      metricId: 'spider-v2.peripheral-hits-per-minute',
      unit: 'hits/min',
      value: 240,
    });
    // Only window 1's first shot actually hit → 1 of 2 peripheral presentations.
    expect(byId.get('spider-v2.peripheral-first-shot-hit-rate')).toEqual({
      metricId: 'spider-v2.peripheral-first-shot-hit-rate',
      unit: '%',
      value: 50,
    });
    // window 1: tHit(280) - tVisible(200) = 80; window 2: tHit(490) - tVisible(400) = 90; median 85.
    expect(byId.get('spider-v2.median-peripheral-hit-time-ms')).toEqual({
      metricId: 'spider-v2.median-peripheral-hit-time-ms',
      unit: 'ms',
      value: 85,
    });

    for (const observation of result.observations) {
      expect(Number.isFinite(observation.value)).toBe(true);
    }
  });

  it('still projects a suspect run as ready — quality is an eligibility gate for trend inclusion, not a projection gate', () => {
    const registry = createDrillMetricRegistry();
    const result = registry.project(makePayload({ suspect: true }));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.qualityGateStatus).toBe('suspect-run');
    expect(result.compatibilityKey.qualityGateStatus).toBe('suspect-run');
  });

  it('returns invalid-metric with a safe reason code when a canonical derivation cannot process the payload', () => {
    const registry = createDrillMetricRegistry();
    const payload = makePayload({});
    // Push a visible event past the end of the recorded ticks — deriveDetectionMetrics requires a
    // tick at or after every visible.t and throws otherwise. The registry must not propagate that.
    const malformed: ExportPayload = {
      ...payload,
      events: [...payload.events, { type: 'visible', targetId: 'peripheral-3', side: 'R', zone: 'peripheral', t: 10000 }],
    };
    const result = registry.project(malformed);
    expect(result).toEqual({ status: 'invalid-metric', reasonCode: 'projection-failed' });
  });
});

function makePayload(overrides: { drillId?: string; assessment?: boolean; suspect?: boolean }): ExportPayload {
  const { drillId = 'spider-shot-v2', assessment = true, suspect = false } = overrides;

  const ticks: ExportPayload['ticks'] = [];
  let previousYaw = 0;
  for (let t = 0; t <= 500; t += 10) {
    const target = targetAt(t);
    const aim = aimAt(t);
    ticks.push({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      aim: { yaw: aim, pitch: 0 },
      keys: [],
      ads: false,
      dYaw: aim - previousYaw,
      dPitch: 0,
    });
    previousYaw = aim;
  }

  const meta: Meta = {
    schemaVersion: 2,
    drillId,
    weaponId: 'ak47',
    weaponSeed: 0,
    rngSeed: 260826,
    backend: 'webgl2',
    displayHz: 144,
    simHz: 100,
    browser: 'test-browser',
    sensitivity: 1,
    fovDeg: 90,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    crossOriginIsolated: true,
    startedAt: '2026-08-27T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 60,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect,
    simToWorld: 1,
    session: { participantId: 'P-1' },
    targets: { hitbox: { widthU: 1, heightU: 2, depthU: 1 } },
    spawn: { seed: 260826 },
    ...(assessment ? { assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' as const } } : {}),
  };

  return {
    meta,
    ticks,
    events: [
      visible('center-0', 'center', CENTER, 100),
      visible('peripheral-1', 'peripheral', PERIPHERAL, 200),
      { type: 'fire', t: 280, hit: true, firstShot: true, residualSpeed: 0, targetId: 'peripheral-1' },
      visible('center-1', 'center', CENTER, 300),
      visible('peripheral-2', 'peripheral', PERIPHERAL, 400),
      // First shot on target 2 misses; a corrective second shot in the same window hits.
      { type: 'fire', t: 480, hit: false, firstShot: true, residualSpeed: 0, targetId: 'peripheral-2' },
      { type: 'fire', t: 490, hit: true, firstShot: false, residualSpeed: 0, targetId: 'peripheral-2' },
      visible('center-2', 'center', CENTER, 500),
    ],
  };
}

function targetAt(t: number): typeof CENTER {
  return (t >= 200 && t < 300) || (t >= 400 && t < 500) ? PERIPHERAL : CENTER;
}

function aimAt(t: number): number {
  const peripheralYaw = aimYaw(PERIPHERAL);
  const withinPeripheral = (t >= 200 && t < 300) || (t >= 400 && t < 500);
  if (!withinPeripheral) return aimYaw(CENTER);
  const phase = t % 200;
  if (phase === 0) return aimYaw(CENTER);
  if (phase === 10) return peripheralYaw / 2;
  if (phase === 20) return (peripheralYaw * 2) / 3;
  if (phase === 30) return (peripheralYaw * 5) / 6;
  if (phase === 50) return peripheralYaw + 0.06;
  if (phase === 60) return peripheralYaw + 0.08;
  return peripheralYaw;
}

function aimYaw(point: { x: number; z: number }): number {
  return Math.atan2(-point.x, -point.z);
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: { x: number; y: number; z: number },
  t: number,
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, side: 'R', zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}
