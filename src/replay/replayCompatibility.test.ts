import { describe, expect, it } from 'vitest';
import { collectMeta, type CollectMetaArgs } from '../data/metadata.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { classifyReplaySupport, replayProfileForExactDrill } from './replayCompatibility.ts';

const OFFICIAL_DRILL_IDS = [
  'hold_click_v1',
  'hold_track_v1',
  'spider-shot-v1',
  'spider-shot-v2',
  'counterstrafe-cued-v1',
  'counterstrafe-reversal-v1',
] as const;

const BASE_META_ARGS: CollectMetaArgs = {
  drillId: 'hold_click_v1',
  backend: 'webgpu',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  crossOriginIsolated: true,
  startedAt: '2026-08-28T00:00:00.000Z',
  scene: { sceneId: 'peek-corridor', assetPackVersion: '1', clutterTier: 'low', fallback: false },
};

function meta(overrides: Partial<CollectMetaArgs> = {}): ExportPayload['meta'] {
  return collectMeta({ ...BASE_META_ARGS, ...overrides });
}

/** `collectMeta` always declares `replay` (Slice 2: the current recorder always captures it) — these
 * tests need to simulate a pre-replay export, so strip the marker back off after building a valid Meta. */
function legacyMeta(overrides: Partial<CollectMetaArgs> = {}): ExportPayload['meta'] {
  const { replay: _replay, ...rest } = meta(overrides);
  return rest;
}

function tick(overrides: Partial<TickRecord> = {}): TickRecord {
  return {
    t: 0,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: null,
    ty: null,
    tz: null,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
    ...overrides,
  };
}

function payload(overrides: { meta?: ExportPayload['meta']; ticks?: TickRecord[]; events?: ExportPayload['events'] } = {}): ExportPayload {
  return {
    meta: overrides.meta ?? meta(),
    ticks: overrides.ticks ?? [tick({ t: 0 }), tick({ t: 1 })],
    events: overrides.events ?? [],
  };
}

/** A tick carrying an active, correctly-captured target (contract-honoring replay v1 capture). */
function tickWithTarget(t: number, id: string): TickRecord {
  return tick({ t, tx: 1, ty: 1.5, tz: -8, replayTargetId: id });
}

describe('replayProfileForExactDrill', () => {
  for (const drillId of OFFICIAL_DRILL_IDS) {
    it(`registers ${drillId}`, () => {
      const profile = replayProfileForExactDrill(drillId);
      expect(profile).toBeDefined();
      expect(profile?.requiredForFull).toEqual(['camera', 'target-lifecycle', 'ads', 'shot-hit-cue', 'scene']);
      expect(profile?.minimumPlayable).toEqual(['camera']);
    });
  }

  it('has no family/prefix fallback for an unregistered near-miss drillId (FR-50.1)', () => {
    expect(replayProfileForExactDrill('spider-shot-v2-alt')).toBeUndefined();
    expect(replayProfileForExactDrill('tracking_v1')).toBeUndefined();
  });
});

describe('classifyReplaySupport — reason matrix', () => {
  it('full: registered drill, monotonic ticks, honored replay v1 capture, scene present, no overflow', () => {
    const result = classifyReplaySupport(
      payload({ ticks: [tickWithTarget(0, 't0'), tick({ t: 1 }), tickWithTarget(2, 't1')] }),
    );
    expect(result.status).toBe('full');
    expect(result.available).toEqual(['camera', 'ads', 'shot-hit-cue', 'target-lifecycle', 'scene']);
    expect(result.missing).toEqual([]);
    expect(result.reasonCodes).toEqual([]);
    expect(result.profileVersion).toBe('1');
  });

  it('partial: legacy export (no meta.replay) with an otherwise trustworthy timeline', () => {
    const result = classifyReplaySupport(payload({ meta: legacyMeta() }));
    expect(result.status).toBe('partial');
    expect(result.missing).toEqual(['target-lifecycle']);
    expect(result.reasonCodes).toEqual(['LEGACY_REPLAY_FIELDS_MISSING']);
  });

  it('unsupported: unregistered exact drillId, even with an otherwise-full payload', () => {
    const result = classifyReplaySupport(payload({ meta: meta({ drillId: 'tracking_v1' }) }));
    expect(result.status).toBe('unsupported');
    expect(result.reasonCodes).toContain('UNKNOWN_EXACT_DRILL');
    expect(result.profileVersion).toBeUndefined();
  });

  it('unsupported: empty ticks (no trustworthy camera timeline)', () => {
    const result = classifyReplaySupport(payload({ ticks: [] }));
    expect(result.status).toBe('unsupported');
    expect(result.missing).toContain('camera');
    expect(result.reasonCodes).toContain('EMPTY_TICKS');
  });

  it('unsupported: non-monotonic tick times (no trustworthy camera timeline)', () => {
    const result = classifyReplaySupport(payload({ ticks: [tick({ t: 1 }), tick({ t: 0 })] }));
    expect(result.status).toBe('unsupported');
    expect(result.reasonCodes).toContain('NON_MONOTONIC_TICKS');
  });

  it('partial: recorderOverflow removes full eligibility even when every capability is present', () => {
    const result = classifyReplaySupport(
      payload({ meta: meta({ recorderOverflow: true }), ticks: [tickWithTarget(0, 't0')] }),
    );
    expect(result.status).toBe('partial');
    expect(result.reasonCodes).toContain('RECORDER_OVERFLOW');
  });

  it('partial: advertised replay v1 capture but a has-target tick is missing replayTargetId (contract mismatch)', () => {
    const brokenTick = tick({ t: 0, tx: 1, ty: 1.5, tz: -8 }); // has a target, but no replayTargetId
    const result = classifyReplaySupport(payload({ ticks: [brokenTick] })); // default meta() already declares replay v1
    expect(result.status).toBe('partial');
    expect(result.missing).toContain('target-lifecycle');
    expect(result.reasonCodes).toContain('REPLAY_CONTRACT_MISMATCH');
    expect(result.reasonCodes).not.toContain('LEGACY_REPLAY_FIELDS_MISSING');
  });

  it('partial: missing scene metadata (pre-KI-004/S1 export)', () => {
    const result = classifyReplaySupport(payload({ meta: meta({ scene: undefined }) }));
    expect(result.status).toBe('partial');
    expect(result.missing).toContain('scene');
    expect(result.reasonCodes).toContain('SCENE_METADATA_MISSING');
  });

  it('stable reason order: multiple simultaneous issues always report in the same fixed order', () => {
    const brokenPayload = payload({ meta: legacyMeta({ scene: undefined, drillId: 'unknown_drill_v9' }), ticks: [] });
    const first = classifyReplaySupport(brokenPayload);
    const second = classifyReplaySupport(brokenPayload);
    expect(first.reasonCodes).toEqual(['UNKNOWN_EXACT_DRILL', 'EMPTY_TICKS', 'LEGACY_REPLAY_FIELDS_MISSING', 'SCENE_METADATA_MISSING']);
    expect(second.reasonCodes).toEqual(first.reasonCodes);
  });
});
