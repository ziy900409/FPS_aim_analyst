import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'hold_track_v1', weaponId: 'ak47', weaponSeed: 1, rngSeed: 35035, backend: 'webgl2', displayHz: 144, simHz: 128,
  browser: 'test-browser', sensitivity: 1, sensitivityModel: 'cs2-0.022deg', movementModel: 'cs2-source', crossOriginIsolated: true,
  startedAt: '2026-08-19T00:00:00.000Z', unit: 'source', vStrafe: 250, maxDrillSeconds: 300, lateEventCount: 0,
  bufferOverflow: false, recorderOverflow: false, suspect: false,
};

describe('hold-track fixed tracking window invariant', () => {
  it('keeps the presentation right edge identical for early, on-time, and absent fires', () => {
    const windows = [10, 500, undefined].map((fireAt) => deriveTrackingMetrics(payload(fireAt)).presentations[0]);

    expect(windows.map((window) => window.windowEndMs)).toEqual([1000, 1000, 1000]);
    expect(windows.map((window) => window.windowEndMs - window.tVisibleMs)).toEqual([1000, 1000, 1000]);
  });
});

function payload(fireAt: number | undefined): ExportPayload {
  const recorder = createDataRecorder({ capacity: 12 });
  for (let t = 0; t <= 1100; t += 100) {
    recorder.recordTick({ t, vx: 0, vz: 0, px: 0, pz: 0, tx: 0, ty: 1.6, tz: -4, aim: { yaw: 0, pitch: 0 }, keys: [] });
  }
  recorder.recordEvent({ type: 'visible', targetId: 't0', side: 'R', t: 0, targetX: 0, targetY: 1.6, targetZ: -4 });
  if (fireAt !== undefined) recorder.recordEvent({ type: 'fire', t: fireAt, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0' });
  recorder.recordEvent({ type: 'visible', targetId: 't1', side: 'L', t: 1000, targetX: 0, targetY: 1.6, targetZ: -4 });
  return buildExportPayload(meta, recorder.snapshot());
}
