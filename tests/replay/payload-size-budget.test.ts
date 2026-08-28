import { describe, expect, it } from 'vitest';
import { capacityForDrill, TickArena, type TickRecord, type TickSourceState } from '../../src/data/RingBuffer.ts';

const CAPACITY = capacityForDrill(128, 300);

function stateWithoutTarget(): TickSourceState {
  return {
    player: { vx: 10, vz: 0, x: 12.5, z: 0 },
    aim: { yaw: 0.12, pitch: -0.04 },
    heldAds: false,
    held: { left: false, right: true },
    targets: [],
  };
}

function stateWithTarget(id: string): TickSourceState {
  return {
    player: { vx: 10, vz: 0, x: 12.5, z: 0 },
    aim: { yaw: 0.12, pitch: -0.04 },
    heldAds: false,
    held: { left: false, right: true },
    targets: [{ id, pos: { x: 2, y: 1.5, z: -8 }, visible: true, alive: true }],
  };
}

/** README §2.3 draft this WP superseded (progress.md "Revised Replay-v1 Schema Candidate") — a
 * per-tick nested `targets: [...]` array, kept here only as the size comparison baseline. */
function asRejectedArrayDraft(tick: TickRecord): unknown {
  const { replayTargetId, ...rest } = tick;
  return {
    ...rest,
    ...(replayTargetId != null
      ? { targets: [{ id: replayTargetId, pos: { x: tick.tx, y: tick.ty, z: tick.tz }, visible: true, alive: true }] }
      : { targets: [] }),
  };
}

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

/**
 * WP-50 / T1 NFR-50.1 evidence: the T0 PoC (progress.md) found the README §2.3 draft's nested
 * `targets: [...]` array inflates a full-capacity fixture 2-3x past the 4 MiB budget — driving
 * D-50-P6/P8's scalar `replayTargetId?` redesign. This locks that comparison at the recorder's full
 * preallocated capacity with every tick carrying an active target (worst case for either encoding):
 * the scalar field must add only a small, bounded per-tick byte cost and must stay meaningfully
 * cheaper than the array shape it replaced. (The 4 MiB budget itself is a target for a *realistic*
 * recorded fixture bounded by a drill's actual endCondition — no official drill reaches this
 * synthetic 300s/41.5k-tick ceiling — so it is not re-asserted as an absolute bound here.)
 */
describe('WP-50 NFR-50.1 — replayTargetId payload-size vs. the rejected array-of-targets draft', () => {
  it(`adds a small, bounded per-tick byte cost over ${CAPACITY} ticks with a target on every tick`, () => {
    const withoutTarget = new TickArena(1);
    withoutTarget.recordState(0, stateWithoutTarget());
    const baselineBytesPerTick = byteSize(withoutTarget.snapshot().ticks[0]);

    const withTarget = new TickArena(1);
    withTarget.recordState(0, stateWithTarget('t0'));
    const withTargetBytesPerTick = byteSize(withTarget.snapshot().ticks[0]);

    // A short id string (`t${n}`) plus its JSON key — comfortably under 40 bytes/tick, nowhere near
    // the hundreds of bytes/tick a nested object-array costs (see the full-capacity comparison below).
    expect(withTargetBytesPerTick - baselineBytesPerTick).toBeLessThan(40);
  });

  it(`is meaningfully cheaper than the rejected array-of-targets draft at full ${CAPACITY}-tick capacity`, () => {
    const arena = new TickArena(CAPACITY);
    for (let i = 0; i < CAPACITY; i++) {
      arena.recordState(i * (1000 / 128), stateWithTarget(`t${i % 300}`));
    }
    const snapshot = arena.snapshot();
    expect(snapshot.recorderOverflow).toBe(false);

    const scalarBytes = byteSize(snapshot.ticks);
    const arrayDraftBytes = byteSize(snapshot.ticks.map(asRejectedArrayDraft));

    // T0 PoC found the array draft costs 2-3x the scalar field's budget impact; require it to stay
    // at least meaningfully worse (>1.2x) so this test would actually catch a regression back to it.
    expect(arrayDraftBytes / scalarBytes).toBeGreaterThan(1.2);
  });
});
