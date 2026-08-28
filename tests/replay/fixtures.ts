import type { ExportPayload } from '../../src/data/export.ts';
import type { Meta } from '../../src/data/metadata.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';

/**
 * WP-50 / T2 — shared literal-construction helpers for replay domain tests (normalizer/sampling/
 * player). Mirrors the required-field shape already exercised in
 * `tests/replay/official-full-candidate.test.ts`, but builds `ExportPayload` directly instead of
 * driving the full sim pipeline — these tests need fine-grained control over tick/event timing
 * (duplicate timestamps, yaw wraparound, target lifecycle boundaries) that a real drill run can't
 * cheaply produce on demand.
 */
export function makeMeta(overrides: Partial<Meta> = {}): Meta {
  return {
    schemaVersion: 2,
    drillId: 'hold_click_v1',
    weaponId: 'ak47',
    weaponSeed: 1,
    rngSeed: 1,
    backend: 'webgpu',
    displayHz: 144,
    simHz: 128,
    browser: 'test-browser',
    sensitivity: 1,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    crossOriginIsolated: true,
    startedAt: '2026-08-28T00:00:00.000Z',
    unit: 'source',
    vStrafe: 0,
    maxDrillSeconds: 120,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    scene: { sceneId: 'peek-corridor', assetPackVersion: '1', clutterTier: 'low', fallback: false },
    replay: { replaySchemaVersion: 1 },
    ...overrides,
  };
}

export function makeTick(overrides: Partial<TickRecord> & { t: number }): TickRecord {
  return {
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

export function makePayload(args: {
  readonly meta?: Partial<Meta>;
  readonly ticks: readonly TickRecord[];
  readonly events?: readonly DrillEvent[];
}): ExportPayload {
  return {
    meta: makeMeta(args.meta),
    ticks: args.ticks as TickRecord[],
    events: (args.events ?? []) as DrillEvent[],
  };
}
