import { describe, expect, it } from 'vitest';
import { canonicalExportJSON, parseExportPayload } from './exportPayloadSchema.ts';
// Committed golden export fixtures (C-D1 exception: src/ may import a committed golden/parity
// JSON fixture from research/). Static imports, not a runtime fs read, so this file stays free
// of node:* — it never ships in the browser bundle (Vitest-only), matching FR-48.10's spirit.
import fixture1 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json';
import fixture2 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json';
import fixture3 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json';
import fixture4 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json';
import fixture5 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json';
import fixture6 from '../../research/fixtures/exports/synthetic_counterstrafe.json';
import fixture7 from '../../research/fixtures/exports/synthetic_counterstrafe_t1_long.json';
import fixture8 from '../../research/fixtures/exports/synthetic_timeline.json';

const FIXTURES: ReadonlyArray<{ name: string; raw: unknown }> = [
  { name: 'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json', raw: fixture1 },
  { name: 'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json', raw: fixture2 },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json', raw: fixture3 },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json', raw: fixture4 },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json', raw: fixture5 },
  { name: 'synthetic_counterstrafe.json', raw: fixture6 },
  { name: 'synthetic_counterstrafe_t1_long.json', raw: fixture7 },
  { name: 'synthetic_timeline.json', raw: fixture8 },
];

describe('parseExportPayload — existing research fixtures (8/8)', () => {
  for (const { name, raw } of FIXTURES) {
    it(`parses ${name}`, () => {
      const result = parseExportPayload(raw);
      if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
      expect(result.payload.meta.schemaVersion).toBe(2);
      expect(result.payload.ticks.length).toBe((raw as { ticks: unknown[] }).ticks.length);
      expect(result.payload.events.length).toBe((raw as { events: unknown[] }).events.length);
      // None of the fixtures carry meta.assessment — the parser must accept legal Practice
      // payloads (Assessment-only archival is a repository/API policy, not a parser concern).
      expect(result.payload.meta.assessment).toBeUndefined();
    });
  }
});

describe('parseExportPayload — positive: every DrillEvent variant', () => {
  it('parses visible', () => {
    expectOk(payloadWithEvents([{ type: 'visible', targetId: 't0', side: 'L', t: 0, targetX: 1, targetY: 2, targetZ: 3 }]));
  });

  it('parses a visible event carrying its per-presentation hitbox (WP-52 T5, additive/optional)', () => {
    const result = parseExportPayload(
      payloadWithEvents([
        {
          type: 'visible',
          targetId: 't0',
          side: 'L',
          t: 0,
          hitboxWidthU: 0.35,
          hitboxHeightU: 0.35,
          hitboxDepthU: 1,
          hitboxShape: 'box',
        },
      ]),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.events[0]).toMatchObject({
      hitboxWidthU: 0.35,
      hitboxHeightU: 0.35,
      hitboxDepthU: 1,
      hitboxShape: 'box',
    });
  });

  it('parses cue', () => {
    expectOk(payloadWithEvents([{ type: 'cue', t: 0, direction: 'A' }]));
  });

  it('parses counter', () => {
    expectOk(payloadWithEvents([{ type: 'counter', key: 'D', t: 0 }]));
  });

  it('parses ads', () => {
    expectOk(payloadWithEvents([{ type: 'ads', down: true, t: 0 }]));
  });

  it('parses target_stop', () => {
    expectOk(payloadWithEvents([{ type: 'target_stop', targetId: 't0', t: 0, targetX: 1, targetY: 2, targetZ: 3 }]));
  });

  it('parses key', () => {
    expectOk(payloadWithEvents([{ type: 'key', code: 'A', down: true, t: 0 }]));
  });

  it('parses fire', () => {
    expectOk(
      payloadWithEvents([
        { type: 'fire', t: 0, hit: true, firstShot: true, residualSpeed: 0, targetId: 't0', shotSeq: 1, part: 'body' },
      ]),
    );
  });

  it('parses hit', () => {
    expectOk(payloadWithEvents([{ type: 'hit', t: 0, timeOfFlightMs: 15, shotSeq: 1, targetId: 't0', part: 'head' }]));
  });

  it('parses scored_start (WP-54 T2)', () => {
    expectOk(payloadWithEvents([{ type: 'scored_start', targetId: 't0', t: 0, targetX: 1, targetY: 2, targetZ: 3 }]));
  });

  it('parses protocol_violation (WP-54 T2)', () => {
    expectOk(payloadWithEvents([{ type: 'protocol_violation', kind: 'fire', t: 0 }]));
  });

  it('parses target_motion_change (WP-54 T1)', () => {
    expectOk(
      payloadWithEvents([
        {
          type: 'target_motion_change',
          targetId: 't0',
          t: 400,
          yawVelocityBeforeDegPerSec: 12.5,
          yawVelocityAfterDegPerSec: -12.5,
          pitchVelocityBeforeDegPerSec: -6,
          pitchVelocityAfterDegPerSec: 6,
        },
      ]),
    );
  });
});

describe('parseExportPayload — target_motion_change round trip (WP-54 T1)', () => {
  it('round-trips through canonicalExportJSON with every field preserved', () => {
    const event = {
      type: 'target_motion_change' as const,
      targetId: 't0',
      t: 400,
      yawVelocityBeforeDegPerSec: 12.5,
      yawVelocityAfterDegPerSec: -12.5,
      pitchVelocityBeforeDegPerSec: -6,
      pitchVelocityAfterDegPerSec: 6,
    };
    const parsed = parseExportPayload(payloadWithEvents([event]));
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { events: unknown[] };
    expect(canonical.events).toEqual([event]);

    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(parsed.payload)));
    if (!reparsed.ok) throw new Error(`expected ok on reparse, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload.events).toEqual(parsed.payload.events);
  });

  it.each([
    ['missing targetId', { type: 'target_motion_change', t: 0, yawVelocityBeforeDegPerSec: 0, yawVelocityAfterDegPerSec: 0, pitchVelocityBeforeDegPerSec: 0, pitchVelocityAfterDegPerSec: 0 }],
    ['missing t', { type: 'target_motion_change', targetId: 't0', yawVelocityBeforeDegPerSec: 0, yawVelocityAfterDegPerSec: 0, pitchVelocityBeforeDegPerSec: 0, pitchVelocityAfterDegPerSec: 0 }],
    ['non-finite yaw velocity', { type: 'target_motion_change', targetId: 't0', t: 0, yawVelocityBeforeDegPerSec: Number.NaN, yawVelocityAfterDegPerSec: 0, pitchVelocityBeforeDegPerSec: 0, pitchVelocityAfterDegPerSec: 0 }],
    ['missing pitchVelocityAfterDegPerSec', { type: 'target_motion_change', targetId: 't0', t: 0, yawVelocityBeforeDegPerSec: 0, yawVelocityAfterDegPerSec: 0, pitchVelocityBeforeDegPerSec: 0 }],
  ])('fails fast on %s', (_label, event) => {
    const result = parseExportPayload(payloadWithEvents([event]));
    expect(result.ok).toBe(false);
  });
});

describe('parseExportPayload — scored_start round trip (WP-54 T2)', () => {
  it('round-trips through canonicalExportJSON with every field preserved', () => {
    const event = { type: 'scored_start' as const, targetId: 't0', t: 400, targetX: 0.1, targetY: 1.5, targetZ: -4 };
    const parsed = parseExportPayload(payloadWithEvents([event]));
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { events: unknown[] };
    expect(canonical.events).toEqual([event]);

    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(parsed.payload)));
    if (!reparsed.ok) throw new Error(`expected ok on reparse, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload.events).toEqual(parsed.payload.events);
  });

  it.each([
    ['missing targetId', { type: 'scored_start', t: 0, targetX: 0, targetY: 0, targetZ: 0 }],
    ['missing t', { type: 'scored_start', targetId: 't0', targetX: 0, targetY: 0, targetZ: 0 }],
    ['non-finite targetX', { type: 'scored_start', targetId: 't0', t: 0, targetX: Number.NaN, targetY: 0, targetZ: 0 }],
    ['missing targetZ', { type: 'scored_start', targetId: 't0', t: 0, targetX: 0, targetY: 0 }],
  ])('fails fast on %s', (_label, event) => {
    const result = parseExportPayload(payloadWithEvents([event]));
    expect(result.ok).toBe(false);
  });
});

describe('parseExportPayload — protocol_violation round trip (WP-54 T2)', () => {
  it('round-trips through canonicalExportJSON with every field preserved', () => {
    const event = { type: 'protocol_violation' as const, kind: 'ads' as const, t: 250 };
    const parsed = parseExportPayload(payloadWithEvents([event]));
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { events: unknown[] };
    expect(canonical.events).toEqual([event]);

    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(parsed.payload)));
    if (!reparsed.ok) throw new Error(`expected ok on reparse, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload.events).toEqual(parsed.payload.events);
  });

  it.each([
    ['unknown kind', { type: 'protocol_violation', kind: 'jump', t: 0 }],
    ['missing kind', { type: 'protocol_violation', t: 0 }],
    ['missing t', { type: 'protocol_violation', kind: 'fire' }],
  ])('fails fast on %s', (_label, event) => {
    const result = parseExportPayload(payloadWithEvents([event]));
    expect(result.ok).toBe(false);
  });
});

describe('parseExportPayload — meta.spawn.trackingTrajectory/trackingPrepMs (WP-54 T2)', () => {
  const trackingTrajectory = {
    kind: 'reversal-2d-v1',
    seed: 7,
    durationMs: 25000,
    angularBoundsDeg: [-8, 8],
    speedRangeDegPerSec: [5, 20],
    reversalIntervalMs: [800, 1400],
    accelerationRampMs: 150,
  };

  it('round-trips opaquely through canonicalExportJSON', () => {
    const payload = minimalPayload({ meta: minimalMeta({ spawn: { seed: 7, trackingTrajectory, trackingPrepMs: 1000 } }) });
    const parsed = parseExportPayload(payload);
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.spawn).toEqual({ seed: 7, trackingTrajectory, trackingPrepMs: 1000 });

    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { meta: { spawn: unknown } };
    expect(canonical.meta.spawn).toEqual({ seed: 7, trackingTrajectory, trackingPrepMs: 1000 });
  });

  it('trackingPrepMs ≤ 0 fails fast', () => {
    const payload = minimalPayload({ meta: minimalMeta({ spawn: { seed: 7, trackingPrepMs: 0 } }) });
    const result = parseExportPayload(payload);
    expect(result.ok).toBe(false);
  });
});

describe('parseExportPayload — WP-50 additive replay fields', () => {
  it('parses a tick with an active replayTargetId', () => {
    expectOk(minimalPayload({ ticks: [validTick({ replayTargetId: 't0' })] }));
  });

  it('parses a tick with replayTargetId explicitly null (no active target)', () => {
    expectOk(minimalPayload({ ticks: [validTick({ replayTargetId: null })] }));
  });

  it('parses a tick that omits replayTargetId (pre-replay export)', () => {
    const result = parseExportPayload(minimalPayload({ ticks: [validTick()] }));
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.ticks[0].replayTargetId).toBeUndefined();
  });

  it('parses meta.replay declaring replaySchemaVersion 1', () => {
    const result = parseExportPayload(minimalPayload({ meta: minimalMeta({ replay: { replaySchemaVersion: 1 } }) }));
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.meta.replay).toEqual({ replaySchemaVersion: 1 });
  });

  it('parses a payload that omits meta.replay (pre-replay export)', () => {
    const result = parseExportPayload(minimalPayload({}));
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.meta.replay).toBeUndefined();
  });
});

describe('parseExportPayload — negative matrix', () => {
  const cases: Array<{ name: string; value: unknown }> = [
    { name: 'root is not an object (array)', value: [] },
    { name: 'root is not an object (string)', value: 'not-a-payload' },
    { name: 'root is not an object (null)', value: null },
    { name: 'meta is missing', value: { ticks: [], events: [] } },
    { name: 'ticks is not an array', value: { meta: minimalMeta(), ticks: {}, events: [] } },
    { name: 'events is not an array', value: { meta: minimalMeta(), ticks: [], events: {} } },
    { name: 'meta.schemaVersion is unsupported', value: minimalPayload({ meta: minimalMeta({ schemaVersion: 1 }) }) },
    { name: 'meta.drillId is missing', value: minimalPayload({ meta: withoutKey(minimalMeta(), 'drillId') }) },
    { name: 'meta.startedAt is not ISO-parseable', value: minimalPayload({ meta: minimalMeta({ startedAt: 'not-a-date' }) }) },
    { name: 'meta.backend is an unsupported enum value', value: minimalPayload({ meta: minimalMeta({ backend: 'directx' }) }) },
    {
      name: 'meta.weapon.bullet.model is not projectile',
      value: minimalPayload({ meta: minimalMeta({ weapon: { id: 'ak47', bullet: { model: 'hitscan', speedU: 1, gravityU: 1, maxRangeU: 1 } } }) }),
    },
    { name: 'tick.t is NaN', value: minimalPayload({ ticks: [validTick({ t: Number.NaN })] }) },
    { name: 'tick.vx is Infinity', value: minimalPayload({ ticks: [validTick({ vx: Number.POSITIVE_INFINITY })] }) },
    { name: 'tick.keys contains an unsupported key name', value: minimalPayload({ ticks: [validTick({ keys: ['Q'] })] }) },
    { name: 'event.type is an unsupported discriminant', value: minimalPayload({ events: [{ type: 'reload', t: 0 }] }) },
    { name: 'visible event is missing side', value: minimalPayload({ events: [{ type: 'visible', targetId: 't0', t: 0 }] }) },
    { name: 'tick.replayTargetId is an empty string', value: minimalPayload({ ticks: [validTick({ replayTargetId: '' })] }) },
    { name: 'tick.replayTargetId is the wrong type', value: minimalPayload({ ticks: [validTick({ replayTargetId: 42 })] }) },
    {
      name: 'meta.replay.replaySchemaVersion is unsupported',
      value: minimalPayload({ meta: minimalMeta({ replay: { replaySchemaVersion: 2 } }) }),
    },
  ];

  for (const testCase of cases) {
    it(`rejects: ${testCase.name}`, () => {
      const result = parseExportPayload(testCase.value);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.length).toBeGreaterThan(0);
      for (const error of result.errors) {
        expect(error.path.length).toBeGreaterThan(0);
        expect(['invalid_type', 'invalid_value', 'unsupported_schema', 'non_finite']).toContain(error.code);
      }
    });
  }
});

describe('canonicalExportJSON', () => {
  it('is unaffected by top-level and nested key order', () => {
    const a = parseExportPayload(minimalPayload({}));
    const reordered = reorderKeysDeep(minimalPayload({}));
    const b = parseExportPayload(reordered);
    if (!a.ok || !b.ok) throw new Error('expected both payloads to parse');
    expect(canonicalExportJSON(a.payload)).toBe(canonicalExportJSON(b.payload));
  });

  it('preserves tick/event array order', () => {
    const payload = minimalPayload({
      ticks: [validTick({ t: 0 }), validTick({ t: 1 }), validTick({ t: 2 })],
      events: [{ type: 'counter', key: 'A', t: 0 }, { type: 'counter', key: 'D', t: 1 }],
    });
    const result = parseExportPayload(payload);
    if (!result.ok) throw new Error('expected payload to parse');
    const canonical = canonicalExportJSON(result.payload);
    const reparsed = JSON.parse(canonical) as { ticks: Array<{ t: number }>; events: Array<{ key: string }> };
    expect(reparsed.ticks.map((tick) => tick.t)).toEqual([0, 1, 2]);
    expect(reparsed.events.map((event) => event.key)).toEqual(['A', 'D']);
  });
});

function expectOk(value: unknown): void {
  const result = parseExportPayload(value);
  if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
}

function payloadWithEvents(events: unknown[]): unknown {
  return minimalPayload({ events });
}

function minimalMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    drillId: 'counterstrafe_reversal_v1',
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
    startedAt: '2026-08-25T12:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 60,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    ...overrides,
  };
}

function validTick(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function minimalPayload(overrides: { meta?: Record<string, unknown>; ticks?: unknown[]; events?: unknown[] }): unknown {
  return {
    meta: overrides.meta ?? minimalMeta(),
    ticks: overrides.ticks ?? [],
    events: overrides.events ?? [],
  };
}

function withoutKey(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const clone = { ...record };
  delete clone[key];
  return clone;
}

/** Rebuilds every plain object in the tree with keys inserted in reverse order (arrays untouched). */
function reorderKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const reordered: Record<string, unknown> = {};
    for (const key of Object.keys(record).reverse()) reordered[key] = reorderKeysDeep(record[key]);
    return reordered;
  }
  return value;
}
