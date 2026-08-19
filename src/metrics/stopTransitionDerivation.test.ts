import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { simStep } from '../loop/SimLoop.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { deriveStopTransitions } from './stopTransitionDerivation.ts';

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'hold_track_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 35035,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-08-19T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
};

describe('deriveStopTransitions', () => {
  it('derives immediate, delayed, and absent post-stop first shots from canonical peek semantics', () => {
    const result = deriveStopTransitions(payloadWithStopTransitions());

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      targetId: 't0',
      tStopMs: 100,
      tFireMs: 100,
      fireToStopMs: 0,
      firstShotHitAfterStop: true,
    });
    expect(result[0].fireAngleErrorDeg).toBeCloseTo(0, 12);
    expect(result[1]).toMatchObject({
      targetId: 't1',
      tStopMs: 400,
      tFireMs: 450,
      fireToStopMs: 50,
      firstShotHitAfterStop: false,
    });
    expect(result[1].fireAngleErrorDeg).toBeCloseTo((0.1 * 180) / Math.PI, 12);
    expect(result[2]).toEqual({ targetId: 't2', tStopMs: 700 });
  });

  it('exports target_stop exactly on the target manager stop tick', () => {
    const state = createSharedState();
    const recorder = createDataRecorder({ capacity: 4 });
    const config: DrillConfig = {
      drillId: 'hold-track-export-test',
      targets: { count: 1, distance: 4 },
      sequence: { alternation: 'LR' },
      timing: { countdownMs: 0, trackingStopMs: 1000 / 128 },
      endCondition: { type: 'targetCount', value: 1 },
    };

    simStep(state, 1 / 128, 1000, createTargetManager(config), undefined, undefined, undefined, undefined, recorder);

    expect(recorder.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'target_stop', targetId: 't0', t: 1000 }),
      ]),
    );
  });
});

function payloadWithStopTransitions(): ExportPayload {
  const recorder = createDataRecorder({ capacity: 9 });
  for (let t = 0; t <= 800; t += 100) {
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: 0,
      ty: 1.6,
      tz: -4,
      aim: { yaw: 0, pitch: 0 },
      keys: [],
    });
  }
  recorder.recordEvent({ type: 'visible', targetId: 't0', side: 'R', t: 0, targetX: 0, targetY: 1.6, targetZ: -4 });
  recorder.recordEvent({ type: 'target_stop', targetId: 't0', t: 100, targetX: 0, targetY: 1.6, targetZ: -4 });
  recorder.recordEvent({ type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0', viewYaw: 0, viewPitch: 0 });
  recorder.recordEvent({ type: 'visible', targetId: 't1', side: 'L', t: 300, targetX: 0, targetY: 1.6, targetZ: -4 });
  recorder.recordEvent({ type: 'target_stop', targetId: 't1', t: 400, targetX: 0, targetY: 1.6, targetZ: -4 });
  recorder.recordEvent({ type: 'fire', t: 450, hit: false, firstShot: true, residualSpeed: 0, targetId: 't1', viewYaw: 0.1, viewPitch: 0 });
  recorder.recordEvent({ type: 'visible', targetId: 't2', side: 'R', t: 600, targetX: 0, targetY: 1.6, targetZ: -4 });
  recorder.recordEvent({ type: 'target_stop', targetId: 't2', t: 700, targetX: 0, targetY: 1.6, targetZ: -4 });
  return buildExportPayload(meta, recorder.snapshot());
}
