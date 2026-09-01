import { describe, expect, it } from 'vitest';
import type { Meta } from '../data/metadata.ts';
import { buildCompatibilityKey, checkCompatibility } from './compatibilityKey.ts';
import { PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION } from '../drill/peek_click_transfer_v1.ts';
import { buildPeekClickTransferV1ConditionCell } from './peekClickTransferConditions.ts';

/** WP-53 / T2 — formal condition cell tests. Frozen values per GD-29 (2026-09-01). */
const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'peek_click_transfer_v1',
  weaponId: 'ak47_br_ads_hitscan',
  weaponSeed: 223,
  rngSeed: 96000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1.2,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 75,
  crossOriginIsolated: true,
  startedAt: '2026-09-01T10:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  session: { participantId: 'P001', sessionLabel: 'formal-transfer' },
  assessment: {
    protocolVersion: PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION,
    assessmentFeedbackPolicy: 'minimal-end-of-block',
  },
};

describe('buildPeekClickTransferV1ConditionCell (WP-53 T2, GD-29 formal freeze)', () => {
  it('is a deterministic string covering every frozen comparison field', () => {
    const cell = buildPeekClickTransferV1ConditionCell();
    expect(cell).toBe(buildPeekClickTransferV1ConditionCell());
    expect(cell).toMatch(/^peek-click-transfer-v1:angularSize=.+deg;distance=.+u;timeout=\d+ms;count=\d+;visSamples=9;visThreshold=0\.5$/);
  });
});

describe('peek_click_transfer_v1 compatibility key (WP-53 T2)', () => {
  it('builds a compatibility key from formal assessment metadata and the frozen condition cell', () => {
    const cell = buildPeekClickTransferV1ConditionCell();
    const key = buildCompatibilityKey(baseMeta, 'peek_click_transfer_v1', cell, 'ok');
    expect(key.taskId).toBe('peek_click_transfer_v1');
    expect(key.protocolVersion).toBe(PEEK_CLICK_TRANSFER_V1_PROTOCOL_VERSION);
    expect(key.targetConditionCell).toBe(cell);
  });

  it('rejects a formal run whose export never attached meta.assessment (practice payload leaking in)', () => {
    const cell = buildPeekClickTransferV1ConditionCell();
    expect(() =>
      buildCompatibilityKey({ ...baseMeta, assessment: undefined }, 'peek_click_transfer_v1', cell, 'ok'),
    ).toThrow('meta.assessment');
  });

  it('treats two runs under the identical frozen condition cell as compatible', () => {
    const cell = buildPeekClickTransferV1ConditionCell();
    const a = buildCompatibilityKey(baseMeta, 'peek_click_transfer_v1', cell, 'ok');
    const b = buildCompatibilityKey({ ...baseMeta, startedAt: '2026-09-01T11:00:00.000Z' }, 'peek_click_transfer_v1', cell, 'ok');
    expect(checkCompatibility(a, b)).toBe(true);
  });

  it('treats a differently-configured condition cell as incompatible, never silently merged', () => {
    const cell = buildPeekClickTransferV1ConditionCell();
    const a = buildCompatibilityKey(baseMeta, 'peek_click_transfer_v1', cell, 'ok');
    const differentCell = `${cell};note=hypothetical-config-change`;
    const b = buildCompatibilityKey(baseMeta, 'peek_click_transfer_v1', differentCell, 'ok');
    expect(checkCompatibility(a, b)).toBe(false);
  });
});
