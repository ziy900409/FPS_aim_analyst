import { describe, expect, it } from 'vitest';
import {
  evaluateRecordingIntegrity,
  type PauseFence,
  type RecordingIntegrityReason,
  type RecordingSnapshot,
} from './recordingIntegrity.ts';
// Committed golden export fixtures (C-D1 exception: src/ may import a committed golden/parity JSON
// fixture from research/). Static imports, not a runtime fs read, so this file stays node:*-free.
import fixture1 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json';
import fixture2 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json';
import fixture3 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json';
import fixture4 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json';
import fixture5 from '../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json';
import fixture6 from '../../research/fixtures/exports/synthetic_counterstrafe.json';
import fixture7 from '../../research/fixtures/exports/synthetic_counterstrafe_t1_long.json';
import fixture8 from '../../research/fixtures/exports/synthetic_sensor_lift.json';
import fixture9 from '../../research/fixtures/exports/synthetic_timeline.json';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ; // 7.8125 — exactly representable

interface RawFixture {
  readonly meta: { readonly simHz?: number; readonly bufferOverflow?: boolean; readonly recorderOverflow?: boolean };
  readonly ticks: readonly { readonly t: number }[];
  readonly events: readonly { readonly t: number }[];
}

const FIXTURES: ReadonlyArray<{ name: string; raw: RawFixture }> = [
  { name: 'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json', raw: fixture1 as RawFixture },
  { name: 'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json', raw: fixture2 as RawFixture },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json', raw: fixture3 as RawFixture },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json', raw: fixture4 as RawFixture },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json', raw: fixture5 as RawFixture },
  { name: 'synthetic_counterstrafe.json', raw: fixture6 as RawFixture },
  { name: 'synthetic_counterstrafe_t1_long.json', raw: fixture7 as RawFixture },
  { name: 'synthetic_sensor_lift.json', raw: fixture8 as RawFixture },
  { name: 'synthetic_timeline.json', raw: fixture9 as RawFixture },
];

const NO_PAUSE = { pauseOccurred: false, fences: [] as readonly PauseFence[] } as const;

/** Smallest representable step up from a positive finite double — `Math.nextUp` is not standard. */
function nextUp(value: number): number {
  const buffer = new ArrayBuffer(8);
  new Float64Array(buffer)[0] = value;
  const bits = new BigUint64Array(buffer);
  bits[0] = bits[0]! + 1n;
  return new Float64Array(buffer)[0]!;
}

function ticksFrom(count: number, startMs = 1000): { t: number }[] {
  return Array.from({ length: count }, (_unused, index) => ({ t: startMs + index * TICK_MS }));
}

function snapshot(overrides: Partial<RecordingSnapshot> = {}): RecordingSnapshot {
  return {
    ticks: ticksFrom(8),
    events: [],
    simHz: SIM_HZ,
    bufferOverflow: false,
    recorderOverflow: false,
    ...overrides,
  };
}

function reasonsOf(
  snap: RecordingSnapshot,
  pause: { pauseOccurred: boolean; fences: readonly PauseFence[] } = NO_PAUSE,
): readonly RecordingIntegrityReason[] {
  return evaluateRecordingIntegrity(snap, pause).reasons;
}

// ── T0.5 acceptance: criteria 1–6 must pass every committed clean fixture ─────────────────────
// The closed vocabulary was reverse-engineered from exactly this corpus, so this is the gate that
// proves it was not tightened past real production data. A red row here means a criterion drifted.
describe('evaluateRecordingIntegrity — the 9 clean fixtures all pass (progress.md §T0.5)', () => {
  for (const { name, raw } of FIXTURES) {
    it(`admits ${name}`, () => {
      const report = evaluateRecordingIntegrity(
        {
          ticks: raw.ticks,
          events: raw.events,
          simHz: raw.meta.simHz ?? SIM_HZ,
          bufferOverflow: raw.meta.bufferOverflow ?? false,
          recorderOverflow: raw.meta.recorderOverflow ?? false,
        },
        NO_PAUSE,
      );
      expect(report.reasons).toEqual([]);
      expect(report.ok).toBe(true);
    });
  }

  it('measures the corpus T0 froze the vocabulary against (13,262 ticks / 634 events)', () => {
    const ticks = FIXTURES.reduce((sum, { raw }) => sum + raw.ticks.length, 0);
    const events = FIXTURES.reduce((sum, { raw }) => sum + raw.events.length, 0);
    expect({ ticks, events }).toEqual({ ticks: 13262, events: 634 });
  });

  // The single measured backward event step in the corpus. Zero tolerance on the event axis would
  // reject this payload, whose `meta.suspect` is false — it is a cross-clock interleave inside one
  // tick, not disorder. This test pins the gap so a future tightening fails loudly here.
  it('keeps the 0.2025 ms backward event step in 09_37_24 well inside the one-tick window', () => {
    const { events } = fixture5 as RawFixture;
    let worstBackwardMs = 0;
    for (let i = 1; i < events.length; i += 1) {
      worstBackwardMs = Math.max(worstBackwardMs, events[i - 1]!.t - events[i]!.t);
    }
    expect(worstBackwardMs).toBeGreaterThan(0);
    expect(worstBackwardMs).toBeLessThan(TICK_MS);
    expect(reasonsOf({ ...snapshot(), ticks: (fixture5 as RawFixture).ticks, events })).toEqual([]);
  });
});

describe('evaluateRecordingIntegrity — tick axis', () => {
  it('admits an exact 128 Hz grid', () => {
    expect(evaluateRecordingIntegrity(snapshot(), NO_PAUSE)).toEqual({ ok: true, reasons: [] });
  });

  it('admits an empty recording (no axis, nothing to disprove)', () => {
    expect(reasonsOf(snapshot({ ticks: [], events: [] }))).toEqual([]);
  });

  it('flags a non-finite tick stamp', () => {
    const ticks = ticksFrom(4);
    ticks[2] = { t: Number.NaN };
    expect(reasonsOf(snapshot({ ticks }))).toContain('tick-non-finite');
  });

  it('flags Infinity as non-finite too', () => {
    const ticks = ticksFrom(4);
    ticks[1] = { t: Number.POSITIVE_INFINITY };
    expect(reasonsOf(snapshot({ ticks }))).toContain('tick-non-finite');
  });

  it('flags a backward tick as both regression and off-grid (criteria are not exclusive)', () => {
    const ticks = ticksFrom(4);
    ticks[2] = { t: ticks[1]!.t - TICK_MS };
    expect(reasonsOf(snapshot({ ticks }))).toEqual(['tick-regression', 'tick-step-off-grid']);
  });

  it('flags an off-grid step that is still forward (a re-anchor jump, FM-1)', () => {
    const ticks = ticksFrom(4);
    ticks[3] = { t: ticks[2]!.t + 2766.667 };
    expect(reasonsOf(snapshot({ ticks }))).toEqual(['tick-step-off-grid']);
  });

  // D-69-T0-2: bit-exact, zero tolerance. One ULP off the grid is a defect, not rounding.
  it('rejects a one-ULP deviation from the grid (bit-exact, D-69-T0-2)', () => {
    const ticks = ticksFrom(4);
    const onGrid = ticks[2]!.t + TICK_MS;
    const bumped = nextUp(onGrid);
    expect(bumped).not.toBe(onGrid);
    expect(bumped - onGrid).toBeLessThan(1e-9); // far below any epsilon anyone would be tempted by
    ticks[3] = { t: bumped };
    expect(reasonsOf(snapshot({ ticks }))).toEqual(['tick-step-off-grid']);
  });

  it('honours a non-128 simHz rather than hard-coding 7.8125', () => {
    const tickMs64 = 1000 / 64;
    const ticks = Array.from({ length: 5 }, (_unused, index) => ({ t: 500 + index * tickMs64 }));
    expect(reasonsOf(snapshot({ ticks, simHz: 64 }))).toEqual([]);
    expect(reasonsOf(snapshot({ ticks, simHz: SIM_HZ }))).toEqual(['tick-step-off-grid']);
  });
});

describe('evaluateRecordingIntegrity — event axis', () => {
  it('admits events inside the tick window, including one in the first tick window', () => {
    const ticks = ticksFrom(8);
    const events = [{ t: ticks[0]!.t - TICK_MS + 0.5 }, { t: ticks[3]!.t }, { t: ticks[7]!.t }];
    expect(reasonsOf(snapshot({ ticks, events }))).toEqual([]);
  });

  it('flags a non-finite event stamp', () => {
    expect(reasonsOf(snapshot({ events: [{ t: Number.NaN }] }))).toContain('event-non-finite');
  });

  it('flags an event before the first tick window', () => {
    const ticks = ticksFrom(8);
    expect(reasonsOf(snapshot({ ticks, events: [{ t: ticks[0]!.t - TICK_MS - 0.001 }] }))).toEqual([
      'event-out-of-window',
    ]);
  });

  it('flags an event after the last tick', () => {
    const ticks = ticksFrom(8);
    expect(reasonsOf(snapshot({ ticks, events: [{ t: ticks[7]!.t + 0.001 }] }))).toEqual([
      'event-out-of-window',
    ]);
  });

  it('admits a sub-tick backward step (the sim/DOM interleave)', () => {
    const ticks = ticksFrom(8);
    const events = [{ t: ticks[4]!.t }, { t: ticks[4]!.t - (TICK_MS - 0.0001) }];
    expect(reasonsOf(snapshot({ ticks, events }))).toEqual([]);
  });

  it('flags a backward step of exactly one tick (the window is half-open)', () => {
    const ticks = ticksFrom(8);
    const events = [{ t: ticks[4]!.t }, { t: ticks[4]!.t - TICK_MS }];
    expect(reasonsOf(snapshot({ ticks, events }))).toEqual(['event-backward-step-exceeds-tick']);
  });

  it('flags a multi-tick backward step', () => {
    const ticks = ticksFrom(8);
    const events = [{ t: ticks[6]!.t }, { t: ticks[1]!.t }];
    expect(reasonsOf(snapshot({ ticks, events }))).toEqual(['event-backward-step-exceeds-tick']);
  });
});

describe('evaluateRecordingIntegrity — pause fence', () => {
  it('admits a degenerate fence, which is what a frozen active clock produces', () => {
    const ticks = ticksFrom(8);
    const fence: PauseFence = { pausedAtMs: ticks[4]!.t, resumedAtMs: ticks[4]!.t };
    expect(reasonsOf(snapshot({ ticks }), { pauseOccurred: true, fences: [fence] })).toEqual([]);
  });

  it('admits several degenerate fences from repeated pauses', () => {
    const ticks = ticksFrom(8);
    const fences: PauseFence[] = [
      { pausedAtMs: ticks[2]!.t, resumedAtMs: ticks[2]!.t },
      { pausedAtMs: ticks[5]!.t, resumedAtMs: ticks[5]!.t },
    ];
    expect(reasonsOf(snapshot({ ticks }), { pauseOccurred: true, fences })).toEqual([]);
  });

  it('flags a fence that never closed (still paused at finalization)', () => {
    const fences: PauseFence[] = [{ pausedAtMs: 1000, resumedAtMs: undefined }];
    expect(reasonsOf(snapshot(), { pauseOccurred: true, fences })).toEqual(['pause-fence-unclosed']);
  });

  // The mechanical proof that active time froze: if it leaked forward, a tick lands inside.
  it('flags a tick stamped inside an open fence interval (active time leaked forward)', () => {
    const ticks = ticksFrom(8);
    const fences: PauseFence[] = [{ pausedAtMs: ticks[2]!.t, resumedAtMs: ticks[6]!.t }];
    expect(reasonsOf(snapshot({ ticks }), { pauseOccurred: true, fences })).toEqual([
      'pause-fence-unclosed',
    ]);
  });

  it('flags an event stamped inside an open fence interval', () => {
    const ticks = ticksFrom(8);
    const events = [{ t: ticks[4]!.t }];
    const fences: PauseFence[] = [{ pausedAtMs: ticks[3]!.t, resumedAtMs: ticks[5]!.t }];
    expect(reasonsOf(snapshot({ ticks, events }), { pauseOccurred: true, fences })).toEqual([
      'pause-fence-unclosed',
    ]);
  });

  it('flags a fence that resumes before it paused', () => {
    const fences: PauseFence[] = [{ pausedAtMs: 2000, resumedAtMs: 1000 }];
    expect(reasonsOf(snapshot(), { pauseOccurred: true, fences })).toEqual(['pause-fence-unclosed']);
  });

  it('flags a non-finite fence bound', () => {
    const fences: PauseFence[] = [{ pausedAtMs: Number.NaN, resumedAtMs: Number.NaN }];
    expect(reasonsOf(snapshot(), { pauseOccurred: true, fences })).toEqual(['pause-fence-unclosed']);
  });

  it('flags the sticky flag and the fence list disagreeing in either direction', () => {
    const closed: PauseFence = { pausedAtMs: 1000, resumedAtMs: 1000 };
    expect(reasonsOf(snapshot(), { pauseOccurred: true, fences: [] })).toEqual(['pause-fence-unclosed']);
    expect(reasonsOf(snapshot(), { pauseOccurred: false, fences: [closed] })).toEqual([
      'pause-fence-unclosed',
    ]);
  });
});

describe('evaluateRecordingIntegrity — overflow is pause-scoped (OQ-69.3)', () => {
  const closed: PauseFence = { pausedAtMs: 1000, resumedAtMs: 1000 };

  it('leaves a clean never-paused overflow alone (existing suspect semantics untouched)', () => {
    expect(reasonsOf(snapshot({ bufferOverflow: true, recorderOverflow: true }))).toEqual([]);
  });

  it('discards a paused attempt on bufferOverflow', () => {
    expect(
      reasonsOf(snapshot({ bufferOverflow: true }), { pauseOccurred: true, fences: [closed] }),
    ).toEqual(['pause-attempt-overflow']);
  });

  it('discards a paused attempt on recorderOverflow', () => {
    expect(
      reasonsOf(snapshot({ recorderOverflow: true }), { pauseOccurred: true, fences: [closed] }),
    ).toEqual(['pause-attempt-overflow']);
  });
});

describe('evaluateRecordingIntegrity — report shape', () => {
  it('reports every violated criterion once, in the frozen vocabulary order', () => {
    const ticks = [{ t: 1000 }, { t: Number.NaN }, { t: 900 }, { t: 5000 }];
    const events = [{ t: Number.NaN }, { t: 99_999 }, { t: 100 }];
    const report = evaluateRecordingIntegrity(
      { ticks, events, simHz: SIM_HZ, bufferOverflow: true, recorderOverflow: false },
      { pauseOccurred: true, fences: [{ pausedAtMs: 1000, resumedAtMs: undefined }] },
    );
    expect(report.ok).toBe(false);
    expect(report.reasons).toEqual([
      'tick-non-finite',
      'tick-step-off-grid',
      'event-non-finite',
      'event-out-of-window',
      'event-backward-step-exceeds-tick',
      'pause-fence-unclosed',
      'pause-attempt-overflow',
    ]);
    expect(new Set(report.reasons).size).toBe(report.reasons.length);
  });

  it('is ok exactly when it reports nothing', () => {
    expect(evaluateRecordingIntegrity(snapshot(), NO_PAUSE).ok).toBe(true);
    expect(evaluateRecordingIntegrity(snapshot({ ticks: [{ t: 0 }, { t: 1 }] }), NO_PAUSE).ok).toBe(false);
  });
});
