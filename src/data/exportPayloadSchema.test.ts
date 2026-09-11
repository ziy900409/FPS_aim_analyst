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

// WP-58 T5 (NFR-58.6) — the metadata additions must be invisible to every payload written before
// them. These digests were taken at the commit *before* T5 (`84483a6`) over
// `canonicalExportJSON(parseExportPayload(fixture).payload)`; if any of the five new optional
// fields ever acquires a default, gets emitted unconditionally, or perturbs an existing field, the
// bytes move and this table goes red. Hashed inline rather than with `node:crypto` so this file
// keeps the `node:*`-free property its header claims.
//
// WP-65 / T5 (D-65-3) — `meta.validity.pointerLockLost` is optional-in / required-out, so
// `parseValidity()` *materializes* `false` when the key is absent. That is exactly the "acquires a
// default" case this table was built to catch, and it moved the bytes of the **three** fixtures
// that carry a `meta.validity` block at all (09_18_05 / 09_24_18 / 09_37_24). The other five have
// no `meta.validity`, so `validity` stays absent and their digests are unchanged — which is the
// evidence that the shift is confined to the one key and did not perturb anything else.
//
// Why accept the shift instead of preserving absence: the flag is required-out so every reader
// gets a boolean rather than `boolean | undefined`. Nothing persists these digests across
// versions — `HistoryRepository` recomputes `contentHash` from `canonicalExportJSON` on both the
// index-load and save paths, and both sides go through `parseExportPayload` first, so a re-saved
// pre-WP-65 run hashes consistently. Python reads the raw on-disk JSON and never the canonical
// form (C-D1), so `research/` is untouched.
const CANONICAL_DIGEST_BEFORE_T5: ReadonlyMap<string, string> = new Map([
  ['counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json', '15c614402021931b'],
  ['counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json', '390d7578707f6ff9'],
  // ↓ 三筆帶 meta.validity 的 fixture，WP-65 / T5 後的新值（舊值依序為 a9555430873bfa89 /
  //   edb34bfc5b664f17 / d294238f1dc54df2）。
  ['counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json', 'e62c8b40f6d51fb4'],
  ['counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json', 'daa8782429b5904c'],
  ['counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json', '71814344e3dc42f7'],
  ['synthetic_counterstrafe.json', 'c159f12f895ae5f3'],
  ['synthetic_counterstrafe_t1_long.json', '2790a5da578ab390'],
  ['synthetic_timeline.json', '6b48b2f23a70b6bf'],
]);

/** FNV-1a 64-bit over the canonical JSON — a change detector, not a security primitive. */
function canonicalDigest(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

describe('canonicalExportJSON — existing fixtures are byte-identical after the WP-58 T5 schema additions', () => {
  for (const { name, raw } of FIXTURES) {
    it(`serializes ${name} unchanged`, () => {
      const result = parseExportPayload(raw);
      if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
      expect(canonicalDigest(canonicalExportJSON(result.payload))).toBe(CANONICAL_DIGEST_BEFORE_T5.get(name));
      for (const key of [
        'sessionPlanMode',
        'sessionPlanItems',
        'sessionPlanDrillRestSeconds',
        'sessionPlanItemIndex',
        'sessionPlanRepIndex',
      ]) {
        expect(key in result.payload.meta).toBe(false);
      }
    });
  }
});

describe('parseExportPayload — WP-58 T5 session program audit fields', () => {
  function metaWith(overrides: Record<string, unknown>): unknown {
    return minimalPayload({ meta: minimalMeta(overrides) });
  }

  it('parses a complete custom program', () => {
    const result = parseExportPayload(
      metaWith({
        sessionPlanMode: 'custom',
        sessionPlanItems: [
          { drillId: 'hold_click_v1', reps: 3 },
          { drillId: 'spider-shot-v2', reps: 2 },
        ],
        sessionPlanDrillRestSeconds: 30,
        sessionPlanRestSeconds: 60,
        sessionPlanItemIndex: 1,
        sessionPlanRepIndex: 0,
      }),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.sessionPlanMode).toBe('custom');
    expect(result.payload.meta.sessionPlanItems).toEqual([
      { drillId: 'hold_click_v1', reps: 3 },
      { drillId: 'spider-shot-v2', reps: 2 },
    ]);
    expect(result.payload.meta.sessionPlanDrillRestSeconds).toBe(30);
    expect(result.payload.meta.sessionPlanItemIndex).toBe(1);
    expect(result.payload.meta.sessionPlanRepIndex).toBe(0);
  });

  it('keeps reading a stored run whose drill has since left the schedulable roster', () => {
    // Deliberate asymmetry with `collectMeta` (strict at write time): the reader must never make a
    // historical payload unreadable because the roster moved on — same rule `sessionPlanFamilyOrder`
    // has followed since stage8.
    const result = parseExportPayload(
      metaWith({ sessionPlanMode: 'custom', sessionPlanItems: [{ drillId: 'a_drill_that_no_longer_exists', reps: 1 }] }),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.sessionPlanItems).toEqual([{ drillId: 'a_drill_that_no_longer_exists', reps: 1 }]);
  });

  // -------------------------------------------------------------------------
  // WP-62 T5 — the planned weapon per item (FR-62.4)
  // -------------------------------------------------------------------------

  it('parses a program that names a weapon on some rows and not others', () => {
    const result = parseExportPayload(
      metaWith({
        sessionPlanMode: 'custom',
        sessionPlanItems: [
          { drillId: 'hold_click_v1', reps: 3, weaponId: 'm4a1s' },
          { drillId: 'spider-shot-v2', reps: 2 },
        ],
      }),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.sessionPlanItems).toEqual([
      { drillId: 'hold_click_v1', reps: 3, weaponId: 'm4a1s' },
      { drillId: 'spider-shot-v2', reps: 2 },
    ]);
    // The unplanned row must not gain the key — absent in, absent out, or the round trip below
    // would move bytes that WP-58 payloads never had.
    expect('weaponId' in (result.payload.meta.sessionPlanItems?.[1] ?? {})).toBe(false);
  });

  it('keeps reading a stored run whose weapon has since been renamed', () => {
    // Same asymmetry as the drill id above: `collectMeta` checks `isWeaponId` at write time, the
    // reader does not, so a run recorded against a weapon this build dropped still loads.
    const result = parseExportPayload(
      metaWith({
        sessionPlanMode: 'custom',
        sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 1, weaponId: 'a_weapon_that_no_longer_exists' }],
      }),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.sessionPlanItems?.[0].weaponId).toBe('a_weapon_that_no_longer_exists');
  });

  it('round-trips the planned weapon through canonicalExportJSON', () => {
    const result = parseExportPayload(
      metaWith({
        sessionPlanMode: 'custom',
        sessionPlanItems: [
          { drillId: 'hold_click_v1', reps: 3, weaponId: 'usp_s_laser' },
          { drillId: 'spider-shot-v2', reps: 2 },
        ],
      }),
    );
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(result.payload)));
    if (!reparsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload.meta.sessionPlanItems).toEqual(result.payload.meta.sessionPlanItems);
  });

  it.each([
    ['an unknown mode literal', { sessionPlanMode: 'manual' }, 'meta.sessionPlanMode'],
    ['a non-array item list', { sessionPlanItems: 'hold_click_v1' }, 'meta.sessionPlanItems'],
    ['a non-object item', { sessionPlanItems: ['hold_click_v1'] }, 'meta.sessionPlanItems[0]'],
    ['an empty drill id', { sessionPlanItems: [{ drillId: '', reps: 1 }] }, 'meta.sessionPlanItems[0].drillId'],
    ['reps = 0', { sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 0 }] }, 'meta.sessionPlanItems[0].reps'],
    [
      'fractional reps',
      { sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 2.5 }] },
      'meta.sessionPlanItems[0].reps',
    ],
    [
      'an empty weapon id',
      { sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 1, weaponId: '' }] },
      'meta.sessionPlanItems[0].weaponId',
    ],
    [
      'a non-string weapon id',
      { sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 1, weaponId: 7 }] },
      'meta.sessionPlanItems[0].weaponId',
    ],
    [
      'a null weapon id',
      { sessionPlanItems: [{ drillId: 'hold_click_v1', reps: 1, weaponId: null }] },
      'meta.sessionPlanItems[0].weaponId',
    ],
    ['a negative drill rest', { sessionPlanDrillRestSeconds: -1 }, 'meta.sessionPlanDrillRestSeconds'],
    ['a fractional item index', { sessionPlanItemIndex: 0.5 }, 'meta.sessionPlanItemIndex'],
    ['a negative rep index', { sessionPlanRepIndex: -1 }, 'meta.sessionPlanRepIndex'],
  ])('rejects %s', (_label, overrides, path) => {
    const result = parseExportPayload(metaWith(overrides as Record<string, unknown>));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.path === path)).toBe(true);
  });
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

  it('parses annotation (WP-61 / T1)', () => {
    expectOk(payloadWithEvents([{ type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 125.5 }]));
  });

  it('parses pointer_lock', () => {
    expectOk(payloadWithEvents([{ type: 'pointer_lock', locked: false, t: 125.5 }]));
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

describe('parseExportPayload — annotation event strict matrix (WP-61 / T1)', () => {
  it('round-trips annotation events through canonicalExportJSON with every field preserved', () => {
    const event = { type: 'annotation' as const, kind: 'sensor_lift' as const, code: 'KeyL', down: false, t: 42.5 };
    const parsed = parseExportPayload(payloadWithEvents([event]));
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { events: unknown[] };
    expect(canonical.events).toEqual([event]);

    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(parsed.payload)));
    if (!reparsed.ok) throw new Error(`expected ok on reparse, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload.events).toEqual(parsed.payload.events);
  });

  it.each([
    ['missing kind', { type: 'annotation', code: 'KeyL', down: true, t: 0 }, 'events[0].kind'],
    ['unsupported kind', { type: 'annotation', kind: 'pause', code: 'KeyL', down: true, t: 0 }, 'events[0].kind'],
    ['missing code', { type: 'annotation', kind: 'sensor_lift', down: true, t: 0 }, 'events[0].code'],
    ['code is not a string', { type: 'annotation', kind: 'sensor_lift', code: 4, down: true, t: 0 }, 'events[0].code'],
    ['down is not boolean', { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: 'true', t: 0 }, 'events[0].down'],
    ['t is non-finite', { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: Number.NaN }, 'events[0].t'],
    ['t is missing', { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true }, 'events[0].t'],
  ])('rejects %s with a named field path', (_label, event, expectedPath) => {
    const result = parseExportPayload(payloadWithEvents([event]));
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain(expectedPath);
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

describe('parseExportPayload — meta.validity.pointerLockLost (WP-65 / T5, D-65-3)', () => {
  const fourFlags = { corridorExceeded: false, perfFloor: false, recorderOverflow: false, bufferOverflow: false };

  it('round-trips a payload that carries the new flag', () => {
    const payload = minimalPayload({ meta: minimalMeta({ validity: { ...fourFlags, pointerLockLost: true } }) });
    const parsed = parseExportPayload(payload);
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.validity).toEqual({ ...fourFlags, pointerLockLost: true });

    const canonical = JSON.parse(canonicalExportJSON(parsed.payload)) as { meta: { validity: unknown } };
    expect(canonical.meta.validity).toEqual({ ...fourFlags, pointerLockLost: true });
  });

  it('parses a pre-WP-65 payload that omits the flag, defaulting it to false (optional-in)', () => {
    const payload = minimalPayload({ meta: minimalMeta({ validity: { ...fourFlags } }) });
    const parsed = parseExportPayload(payload);
    if (!parsed.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(parsed.errors)}`);
    expect(parsed.payload.meta.validity).toEqual({ ...fourFlags, pointerLockLost: false });
  });

  it('rejects a non-boolean flag (optional-in is not lenient-in)', () => {
    const payload = minimalPayload({ meta: minimalMeta({ validity: { ...fourFlags, pointerLockLost: 'yes' } }) });
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

describe('parseExportPayload — WP-54 T7 additive meta.protocolGuard (tracking-pilot-v2)', () => {
  it('round-trips a declared guard', () => {
    const result = parseExportPayload(
      minimalPayload({ meta: minimalMeta({ protocolGuard: { requireFire: true, noMovement: true } }) }),
    );
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.meta.protocolGuard).toEqual({ requireFire: true, noMovement: true });
  });

  it('parses a payload that omits meta.protocolGuard (drill declares no guard)', () => {
    const result = parseExportPayload(minimalPayload({}));
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.meta.protocolGuard).toBeUndefined();
  });

  it('rejects a non-boolean guard flag with a field path', () => {
    const result = parseExportPayload(minimalPayload({ meta: minimalMeta({ protocolGuard: { requireFire: 'yes' } }) }));
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('meta.protocolGuard.requireFire');
  });
});

describe('parseExportPayload — WP-54 T7 additive tick.fire (tracking-pilot-v2)', () => {
  it('parses a tick recorded while holding fire', () => {
    const result = parseExportPayload(minimalPayload({ ticks: [validTick({ fire: true })] }));
    if (!result.ok) throw new Error('expected payload to parse');
    expect(result.payload.ticks[0].fire).toBe(true);
  });

  it('keeps an explicit false distinct from an omitted flag', () => {
    // D-54.50 counts held-fire coverage, so "recorded, released" must not collapse into
    // "never recorded" — a parser default of false would silently fabricate coverage data.
    const recorded = parseExportPayload(minimalPayload({ ticks: [validTick({ fire: false })] }));
    const omitted = parseExportPayload(minimalPayload({ ticks: [validTick()] }));
    if (!recorded.ok || !omitted.ok) throw new Error('expected both payloads to parse');
    expect(recorded.payload.ticks[0].fire).toBe(false);
    expect(omitted.payload.ticks[0].fire).toBeUndefined();
  });

  it('rejects a non-boolean fire flag with a field path', () => {
    const result = parseExportPayload(minimalPayload({ ticks: [validTick({ fire: 1 })] }));
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('ticks[0].fire');
  });
});

describe('parseExportPayload — WP-60 T1 raw mouse samples', () => {
  it('accepts legacy payloads that omit mouseSamples and meta.mouseSampling', () => {
    const result = parseExportPayload(minimalPayload({}));
    if (!result.ok) throw new Error('expected legacy payload to parse');
    expect(result.payload.mouseSamples).toBeUndefined();
    expect(result.payload.meta.mouseSampling).toBeUndefined();
  });

  it('round-trips a valid columnar mouseSamples block with provenance', () => {
    const payload = minimalPayload({
      meta: minimalMeta({
        mouseSampling: {
          recorded: 3,
          capacity: 72_000,
          overflow: false,
          timeSource: 'event.timeStamp',
          deltaUnit: 'counts',
          observedRateHz: 1000,
        },
      }),
      events: [{ type: 'pointer_lock', locked: true, t: 99 }],
    }) as Record<string, unknown>;
    payload.mouseSamples = { t0Ms: 100, dtUs: [0, 1000, 1000], dx: [2, -1, 0], dy: [0, 3, -2] };

    const result = parseExportPayload(payload);
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.mouseSampling?.timeSource).toBe('event.timeStamp');
    expect(result.payload.mouseSamples).toEqual({ t0Ms: 100, dtUs: [0, 1000, 1000], dx: [2, -1, 0], dy: [0, 3, -2] });

    const reparsed = parseExportPayload(JSON.parse(canonicalExportJSON(result.payload)));
    if (!reparsed.ok) throw new Error(`expected ok on reparse, got errors: ${JSON.stringify(reparsed.errors)}`);
    expect(reparsed.payload).toEqual(result.payload);
  });

  it.each([
    ['non-finite t0Ms', { t0Ms: Number.NaN, dtUs: [0], dx: [1], dy: [1] }, 'mouseSamples.t0Ms'],
    ['mismatched dx length', { t0Ms: 1, dtUs: [0, 1000], dx: [1], dy: [1, 2] }, 'mouseSamples.dx'],
    ['negative dtUs', { t0Ms: 1, dtUs: [0, -1], dx: [1, 2], dy: [1, 2] }, 'mouseSamples.dtUs[1]'],
    ['non-integer dtUs', { t0Ms: 1, dtUs: [0, 1.5], dx: [1, 2], dy: [1, 2] }, 'mouseSamples.dtUs[1]'],
  ])('rejects %s with a named field path', (_label, mouseSamples, expectedPath) => {
    const payload = minimalPayload({}) as Record<string, unknown>;
    payload.mouseSamples = mouseSamples;
    const result = parseExportPayload(payload);
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain(expectedPath);
  });

  it('accepts raw mouse overflow without changing meta.suspect', () => {
    const payload = minimalPayload({
      meta: minimalMeta({
        suspect: false,
        mouseSampling: {
          recorded: 1,
          capacity: 1,
          overflow: true,
          timeSource: 'event.timeStamp',
          deltaUnit: 'counts',
          observedRateHz: 0,
        },
      }),
    }) as Record<string, unknown>;
    payload.mouseSamples = { t0Ms: 10, dtUs: [0], dx: [4], dy: [5] };

    const result = parseExportPayload(payload);
    if (!result.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(result.errors)}`);
    expect(result.payload.meta.suspect).toBe(false);
    expect(result.payload.meta.mouseSampling?.overflow).toBe(true);
  });

  it('rejects meta.mouseSampling.recorded > capacity with a named path', () => {
    const result = parseExportPayload(
      minimalPayload({
        meta: minimalMeta({
          mouseSampling: {
            recorded: 2,
            capacity: 1,
            overflow: true,
            timeSource: 'event.timeStamp',
            deltaUnit: 'counts',
            observedRateHz: 1000,
          },
        }),
      }),
    );

    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('meta.mouseSampling.recorded');
  });

  it('rejects provenance/sample count mismatches with a named path', () => {
    const payload = minimalPayload({
      meta: minimalMeta({
        mouseSampling: {
          recorded: 2,
          capacity: 10,
          overflow: false,
          timeSource: 'event.timeStamp',
          deltaUnit: 'counts',
          observedRateHz: 1000,
        },
      }),
    }) as Record<string, unknown>;
    payload.mouseSamples = { t0Ms: 10, dtUs: [0], dx: [1], dy: [1] };

    const result = parseExportPayload(payload);
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('meta.mouseSampling.recorded');
  });

  it('rejects mouseSamples without matching provenance', () => {
    const payload = minimalPayload({}) as Record<string, unknown>;
    payload.mouseSamples = { t0Ms: 10, dtUs: [0], dx: [1], dy: [1] };

    const result = parseExportPayload(payload);
    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('meta.mouseSampling');
  });

  it('rejects raw sampling provenance without a matching mouseSamples block', () => {
    const result = parseExportPayload(
      minimalPayload({
        meta: minimalMeta({
          mouseSampling: {
            recorded: 0,
            capacity: 10,
            overflow: false,
            timeSource: 'event.timeStamp',
            deltaUnit: 'counts',
            observedRateHz: 0,
          },
        }),
      }),
    );

    if (result.ok) throw new Error('expected payload to be rejected');
    expect(result.errors.map((error) => error.path)).toContain('mouseSamples');
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
