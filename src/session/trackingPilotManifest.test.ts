import { describe, expect, it } from 'vitest';
import {
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  trackingCorePrPilotV1Practice,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
} from '../drill/tracking_core_pr_pilot_v1.ts';
import { TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from '../drill/tracking_reversal_pilot_v1.ts';
import {
  buildTrackingPilotManifest,
  parseTrackingPilotManifest,
  resolveTrackingPilotBlockConfig,
  trackingPilotBlockRole,
  type TrackingPilotManifest,
} from './trackingPilotManifest.ts';

const SCORED_DRILL_IDS = new Set([
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((c) => c.drillId),
  ...TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((c) => c.drillId),
]);

describe('trackingPilotBlockRole', () => {
  it('classifies every known WP-54 pilot drillId', () => {
    expect(trackingPilotBlockRole(trackingCorePrPilotV1Practice.drillId)).toBe('practice');
    expect(trackingPilotBlockRole(trackingCorePrPilotV1CalibrationHorizontal.drillId)).toBe('calibration');
    expect(trackingPilotBlockRole(trackingCorePrPilotV1CalibrationVertical.drillId)).toBe('calibration');
    for (const drillId of SCORED_DRILL_IDS) {
      expect(trackingPilotBlockRole(drillId)).toBe('scored');
    }
  });

  it('throws for an unknown drillId', () => {
    expect(() => trackingPilotBlockRole('not-a-real-drill')).toThrow('Unknown WP-54 tracking pilot drillId');
  });
});

describe('buildTrackingPilotManifest', () => {
  it('is deterministic for the same participant/session (manifest replay)', () => {
    const first = buildTrackingPilotManifest('participant-1', 0, 60);
    const second = buildTrackingPilotManifest('participant-1', 0, 60);
    expect(second).toEqual(first);
  });

  it('produces exactly 9 blocks: 1 practice + 2 calibration + 6 scored, no duplicates', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 0, 60);
    expect(manifest.orderedBlocks).toHaveLength(9);
    expect(new Set(manifest.orderedBlocks.map((b) => b.drillId)).size).toBe(9);
    expect(manifest.orderedBlocks[0].drillId).toBe(trackingCorePrPilotV1Practice.drillId);
    expect(manifest.orderedBlocks[1].drillId).toBe(trackingCorePrPilotV1CalibrationHorizontal.drillId);
    expect(manifest.orderedBlocks[2].drillId).toBe(trackingCorePrPilotV1CalibrationVertical.drillId);
    const scoredBlocks = manifest.orderedBlocks.slice(3);
    expect(new Set(scoredBlocks.map((b) => b.drillId))).toEqual(SCORED_DRILL_IDS);
  });

  it('uses the primary seed family for every block in session 0', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 0, 60);
    expect(manifest.orderedBlocks.every((b) => b.seedFamily === 'primary')).toBe(true);
  });

  it('uses the alternate seed family only for scored blocks in session 1', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 1, 60);
    for (const block of manifest.orderedBlocks) {
      const role = trackingPilotBlockRole(block.drillId);
      expect(block.seedFamily).toBe(role === 'scored' ? 'alternate' : 'primary');
    }
  });

  it('rotates the scored block order across participants (position-balanced, not shuffled)', () => {
    const a = buildTrackingPilotManifest('participant-1', 0, 60);
    const b = buildTrackingPilotManifest('participant-2', 0, 60);
    const scoredOrderA = a.orderedBlocks.slice(3).map((block) => block.drillId);
    const scoredOrderB = b.orderedBlocks.slice(3).map((block) => block.drillId);
    expect(scoredOrderA).not.toEqual(scoredOrderB);
    expect(new Set(scoredOrderA)).toEqual(new Set(scoredOrderB));
  });

  it('produces a counterbalance cell label that is itself a pure function of the inputs', () => {
    const manifest = buildTrackingPilotManifest('participant-7', 1, 90);
    expect(manifest.generatedFromCounterbalanceCell).toBe('tracking-pilot-v1:participant-7:session-1');
  });

  it.each([
    { participantId: '', sessionIndex: 0 as const, restSeconds: 60, message: 'participantId must be a non-empty string' },
    { participantId: 'p1', sessionIndex: 2 as unknown as 0, restSeconds: 60, message: 'sessionIndex must be 0 or 1' },
    { participantId: 'p1', sessionIndex: 0 as const, restSeconds: -1, message: 'restSeconds must be a non-negative finite number' },
  ])('rejects invalid input: $message', ({ participantId, sessionIndex, restSeconds, message }) => {
    expect(() => buildTrackingPilotManifest(participantId, sessionIndex, restSeconds)).toThrow(message);
  });
});

describe('resolveTrackingPilotBlockConfig', () => {
  it('returns the unmodified config for a primary-seed block', () => {
    const scoredDrillId = TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].drillId;
    const config = resolveTrackingPilotBlockConfig({ drillId: scoredDrillId, seedFamily: 'primary' });
    expect(config).toBe(TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0]);
  });

  it('offsets the trajectory seed for an alternate-seed scored block, leaving everything else unchanged', () => {
    const base = TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0];
    const baseSeed = base.targets.trackingTrajectory!.seed;
    const config = resolveTrackingPilotBlockConfig({ drillId: base.drillId, seedFamily: 'alternate' });
    expect(config.targets.trackingTrajectory!.seed).toBe(baseSeed + 10000);
    expect({ ...config, targets: { ...config.targets, trackingTrajectory: undefined } }).toEqual({
      ...base,
      targets: { ...base.targets, trackingTrajectory: undefined },
    });
  });

  it('throws for an unknown drillId', () => {
    expect(() => resolveTrackingPilotBlockConfig({ drillId: 'not-a-real-drill', seedFamily: 'primary' })).toThrow(
      'Unknown WP-54 tracking pilot drillId',
    );
  });
});

describe('parseTrackingPilotManifest', () => {
  it('round-trips a manifest produced by buildTrackingPilotManifest', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 1, 45);
    expect(parseTrackingPilotManifest(manifest)).toEqual(manifest);
  });

  it('round-trips a manifest that has been JSON-serialized (replay from a persisted log)', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 0, 45);
    expect(parseTrackingPilotManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
  });

  function validManifestJson(): TrackingPilotManifest {
    return buildTrackingPilotManifest('participant-1', 0, 60);
  }

  it('rejects an unknown drillId', () => {
    const manifest = validManifestJson();
    const corrupted = {
      ...manifest,
      orderedBlocks: [...manifest.orderedBlocks.slice(1), { drillId: 'not-a-real-drill', seedFamily: 'primary' }],
    };
    expect(() => parseTrackingPilotManifest(corrupted)).toThrow('Unknown WP-54 tracking pilot drillId');
  });

  it('rejects a duplicate block', () => {
    const manifest = validManifestJson();
    const corrupted = { ...manifest, orderedBlocks: [manifest.orderedBlocks[0], manifest.orderedBlocks[0]] };
    expect(() => parseTrackingPilotManifest(corrupted)).toThrow('must not repeat a drillId');
  });

  it('rejects a non-scored block claiming the alternate seed family', () => {
    const manifest = validManifestJson();
    const corrupted = {
      ...manifest,
      orderedBlocks: [
        { drillId: trackingCorePrPilotV1Practice.drillId, seedFamily: 'alternate' },
        ...manifest.orderedBlocks.slice(1),
      ],
    };
    expect(() => parseTrackingPilotManifest(corrupted)).toThrow("must not use the 'alternate' seed family");
  });

  it('rejects mixed seed families across scored blocks', () => {
    const manifest = buildTrackingPilotManifest('participant-1', 1, 60);
    const scoredIndex = manifest.orderedBlocks.findIndex((b) => trackingPilotBlockRole(b.drillId) === 'scored');
    const orderedBlocks = manifest.orderedBlocks.map((block, index) =>
      index === scoredIndex ? { ...block, seedFamily: 'primary' as const } : block,
    );
    expect(() => parseTrackingPilotManifest({ ...manifest, orderedBlocks })).toThrow(
      'scored blocks must all share the same seedFamily',
    );
  });

  it('rejects the wrong protocolVersion', () => {
    const manifest = validManifestJson();
    expect(() => parseTrackingPilotManifest({ ...manifest, protocolVersion: 'tracking-pilot-v2' })).toThrow(
      "protocolVersion must be 'tracking-pilot-v1'",
    );
  });

  it.each([
    { field: 'participantId', value: '', message: 'participantId must be a non-empty string' },
    { field: 'sessionIndex', value: 2, message: 'sessionIndex must be 0 or 1' },
    { field: 'restSeconds', value: -1, message: 'restSeconds must be a non-negative finite number' },
    { field: 'orderedBlocks', value: [], message: 'orderedBlocks must be a non-empty array' },
    { field: 'generatedFromCounterbalanceCell', value: '', message: 'generatedFromCounterbalanceCell must be a non-empty string' },
  ])('rejects an invalid $field', ({ field, value, message }) => {
    const manifest = validManifestJson();
    expect(() => parseTrackingPilotManifest({ ...manifest, [field]: value })).toThrow(message);
  });

  it('rejects a non-object value', () => {
    expect(() => parseTrackingPilotManifest(null)).toThrow('manifest must be an object');
    expect(() => parseTrackingPilotManifest('nope')).toThrow('manifest must be an object');
  });
});
