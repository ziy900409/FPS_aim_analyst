import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { Meta } from '../data/metadata.ts';
import { evaluateTrackingRunEligibility } from './trackingRunEligibility.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const TARGET_ID = 'target-1';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_core_pr_pilot_v1_test',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 54000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  spawn: {
    seed: 54000,
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: 54000,
      durationMs: 25000,
      yawBoundDeg: 2,
      pitchBoundDeg: 2,
      targetRmsSpeedDegPerSec: 5,
      frequencyBandHz: [0.1, 0.7],
    },
  },
};

interface BuildOptions {
  prepTicks?: number;
  scoredTicks?: number;
  metaOverrides?: Partial<Meta>;
  /** Mutates the built ticks array in place before returning (e.g. to null out a target position). */
  mutateTicks?: (ticks: TickRecord[]) => void;
  /** Omit the `scored_start` event entirely. */
  omitScoredStart?: boolean;
}

function buildPayload(options: BuildOptions = {}): ExportPayload {
  const prepTicks = options.prepTicks ?? 5;
  const scoredTicks = options.scoredTicks ?? 40;
  const totalTicks = prepTicks + scoredTicks;

  const ticks: TickRecord[] = [];
  for (let i = 0; i <= totalTicks; i++) {
    ticks.push({
      t: i * TICK_MS,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: 0,
      ty: 1.6,
      tz: -4,
      aim: { yaw: 0, pitch: 0 },
      keys: [],
      ads: false,
    });
  }
  options.mutateTicks?.(ticks);

  const events: ExportPayload['events'] = [
    { type: 'visible', targetId: TARGET_ID, side: 'R', t: 0, targetX: 0, targetY: 1.6, targetZ: -4 },
  ];
  if (!options.omitScoredStart) {
    events.push({
      type: 'scored_start',
      targetId: TARGET_ID,
      t: prepTicks * TICK_MS,
      targetX: 0,
      targetY: 1.6,
      targetZ: -4,
    });
  }

  return {
    meta: { ...baseMeta, ...options.metaOverrides },
    ticks,
    events,
  };
}

describe('evaluateTrackingRunEligibility — eligible', () => {
  it('reports eligible with valid scored tick count and duration for a clean run', () => {
    const payload = buildPayload({ prepTicks: 5, scoredTicks: 40 });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
    if (result.status !== 'eligible') return;
    expect(result.validScoredTicks).toBe(41); // ticks [5..45] inclusive
    expect(result.durationMs).toBeCloseTo(40 * TICK_MS, 6);
  });
});

describe('evaluateTrackingRunEligibility — overflow', () => {
  it('blocks on recorder overflow', () => {
    const payload = buildPayload({ metaOverrides: { recorderOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['recorder-overflow'] });
  });

  it('blocks on input buffer overflow', () => {
    const payload = buildPayload({ metaOverrides: { bufferOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['input-buffer-overflow'] });
  });

  it('collects both overflow reasons at once rather than short-circuiting on the first', () => {
    const payload = buildPayload({ metaOverrides: { recorderOverflow: true, bufferOverflow: true } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toEqual(['recorder-overflow', 'input-buffer-overflow']);
  });
});

describe('evaluateTrackingRunEligibility — missing target', () => {
  it('blocks when a scored-window tick has a null target position', () => {
    const payload = buildPayload({
      prepTicks: 5,
      scoredTicks: 40,
      mutateTicks: (ticks) => {
        ticks[10] = { ...ticks[10], tx: null, ty: null, tz: null };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('missing-target-position');
  });

  it('does not flag a null target position that only occurs inside the prep window', () => {
    const payload = buildPayload({
      prepTicks: 5,
      scoredTicks: 40,
      mutateTicks: (ticks) => {
        ticks[1] = { ...ticks[1], tx: null, ty: null, tz: null };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
  });
});

describe('evaluateTrackingRunEligibility — timestamp', () => {
  it('blocks on a non-monotonic tick timestamp', () => {
    const payload = buildPayload({
      mutateTicks: (ticks) => {
        ticks[20] = { ...ticks[20], t: ticks[19].t };
      },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('non-monotonic-timestamps');
  });
});

describe('evaluateTrackingRunEligibility — coverage', () => {
  it('blocks when scored-window tick coverage falls under the 99.5% floor', () => {
    const prepTicks = 5;
    const scoredTicks = 200;
    const payload = buildPayload({ prepTicks, scoredTicks });
    // Drop enough scored-window ticks to push coverage well under 99.5% while keeping the
    // last tick (and therefore `durationMs`) unchanged.
    const dropped = payload.ticks.filter((_tick, index) => !(index > prepTicks + 5 && index <= prepTicks + 10));
    const result = evaluateTrackingRunEligibility({ ...payload, ticks: dropped });
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('insufficient-scored-coverage');
  });

  it('does not flag coverage for a clean, gap-free run', () => {
    const payload = buildPayload({ prepTicks: 5, scoredTicks: 200 });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('eligible');
  });
});

describe('evaluateTrackingRunEligibility — protocol mismatch', () => {
  it('blocks when there is no scored_start event at all', () => {
    const payload = buildPayload({ omitScoredStart: true });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result).toEqual({ status: 'blocked', reasons: ['missing-scored-start'] });
  });

  it('blocks on an unsupported schema version', () => {
    const payload = buildPayload({ metaOverrides: { schemaVersion: 1 as unknown as 2 } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unsupported-schema-version');
  });

  it('blocks when meta.spawn.trackingTrajectory is missing', () => {
    const payload = buildPayload({ metaOverrides: { spawn: { seed: 54000 } } });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unrecognized-tracking-trajectory');
  });

  it('blocks when meta.spawn.trackingTrajectory.kind is unrecognized', () => {
    const payload = buildPayload({
      metaOverrides: { spawn: { seed: 54000, trackingTrajectory: { kind: 'legacy-static-v0' } } },
    });
    const result = evaluateTrackingRunEligibility(payload);
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.reasons).toContain('unrecognized-tracking-trajectory');
  });
});
