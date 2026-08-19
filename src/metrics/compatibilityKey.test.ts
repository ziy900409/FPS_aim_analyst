import { describe, expect, it } from 'vitest';
import type { Meta } from '../data/metadata.ts';
import {
  buildCompatibilityKey,
  checkCompatibility,
  checkQualityGate,
  deriveSessionId,
  type CompatibilityKey,
} from './compatibilityKey.ts';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'hold_click_v1',
  weaponId: 'ak47_br_ads_hitscan',
  weaponSeed: 223,
  rngSeed: 18018,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1.2,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 75,
  crossOriginIsolated: true,
  startedAt: '2026-08-19T10:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  session: { participantId: 'P001', sessionLabel: 'baseline' },
  assessment: {
    protocolVersion: 'hold-click-v1@1.0.0',
    assessmentFeedbackPolicy: 'minimal-end-of-block',
  },
};

const baseKey: CompatibilityKey = {
  participantId: 'P001',
  taskId: 'hold-click-v1',
  protocolVersion: 'hold-click-v1@1.0.0',
  gameMovementProfile: 'cs2-source',
  weaponId: 'ak47_br_ads_hitscan',
  weaponMode: 'ak47_br_ads_hitscan',
  sensitivityFovKey: 'sensitivity=1.2;fovDeg=75',
  targetConditionCell: 'hold:distance=mid',
  assessmentFeedbackPolicy: 'minimal-end-of-block',
  qualityGateStatus: 'ok',
};

describe('deriveSessionId', () => {
  it('derives a stable participant/start timestamp key', () => {
    expect(deriveSessionId(baseMeta)).toBe('P001:2026-08-19T10:00:00.000Z');
  });

  it('rejects exports without session participant metadata', () => {
    const meta = { ...baseMeta, session: undefined };
    expect(() => deriveSessionId(meta)).toThrow('meta.session.participantId');
  });
});

describe('buildCompatibilityKey', () => {
  it('builds the closed v1 compatibility key from assessment metadata', () => {
    expect(buildCompatibilityKey(baseMeta, 'hold-click-v1', 'hold:distance=mid', 'ok')).toEqual(baseKey);
  });

  it('rejects missing assessment metadata, fov, or target condition cell', () => {
    expect(() =>
      buildCompatibilityKey({ ...baseMeta, assessment: undefined }, 'hold-click-v1', 'hold:distance=mid', 'ok'),
    ).toThrow('meta.assessment');
    expect(() =>
      buildCompatibilityKey({ ...baseMeta, fovDeg: undefined }, 'hold-click-v1', 'hold:distance=mid', 'ok'),
    ).toThrow('meta.fovDeg');
    expect(() => buildCompatibilityKey(baseMeta, 'hold-click-v1', ' ', 'ok')).toThrow('targetConditionCell');
  });

  it('uses weaponId as the initial weaponMode value while no independent mode field exists', () => {
    const key = buildCompatibilityKey(baseMeta, 'hold-click-v1', 'hold:distance=mid', 'ok');
    expect(key.weaponMode).toBe(key.weaponId);
  });
});

describe('checkCompatibility', () => {
  it('returns true when every closed v1 key field is identical', () => {
    expect(checkCompatibility(baseKey, { ...baseKey })).toBe(true);
  });

  it.each<keyof CompatibilityKey>([
    'participantId',
    'taskId',
    'protocolVersion',
    'gameMovementProfile',
    'weaponId',
    'weaponMode',
    'sensitivityFovKey',
    'targetConditionCell',
    'assessmentFeedbackPolicy',
    'qualityGateStatus',
  ])('returns false when %s differs', (field) => {
    expect(checkCompatibility(baseKey, { ...baseKey, [field]: `${baseKey[field]}-changed` })).toBe(false);
  });
});

describe('checkQualityGate', () => {
  it('classifies low sample size before other quality failures', () => {
    expect(checkQualityGate({ n: 4, minN: 5, compatible: false, suspect: true })).toBe('insufficient-n');
  });

  it('classifies incompatible protocol before suspect runs', () => {
    expect(checkQualityGate({ n: 5, minN: 5, compatible: false, suspect: true })).toBe('incompatible-protocol');
  });

  it('classifies suspect compatible runs after sample and compatibility checks', () => {
    expect(checkQualityGate({ n: 5, minN: 5, compatible: true, suspect: true })).toBe('suspect-run');
  });

  it('classifies complete compatible non-suspect runs as ok', () => {
    expect(checkQualityGate({ n: 5, minN: 5, compatible: true, suspect: false })).toBe('ok');
  });

  it('rejects non-integer sample counts', () => {
    expect(() => checkQualityGate({ n: 4.5, minN: 5, compatible: true, suspect: false })).toThrow(
      'n must be a non-negative integer',
    );
  });
});
