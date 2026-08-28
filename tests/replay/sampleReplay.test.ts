import { describe, expect, it } from 'vitest';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { createReplaySampleBuffer, EFFECT_WINDOW_MS, sampleReplay } from '../../src/replay/sampleReplay.ts';
import { makePayload, makeTick } from './fixtures.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';

function normalize(payload: Parameters<typeof makePayload>[0]): ReplayRecording {
  const result = normalizeReplayRecording(makePayload(payload));
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
  return result.recording;
}

describe('WP-50 T2 — sampleReplay: position/camera interpolation', () => {
  it('linearly interpolates px/pz between the surrounding ticks', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0, px: 0, pz: 0 }), makeTick({ t: 100, px: 10, pz: -20 })],
    });
    const sample = sampleReplay(recording, 25);
    expect(sample.alpha).toBeCloseTo(0.25);
    expect(sample.player.px).toBeCloseTo(2.5);
    expect(sample.player.pz).toBeCloseTo(-5);
  });

  it('linearly interpolates pitch and yaw within a normal (non-wrapping) range', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0, aim: { yaw: 0.2, pitch: 0.1 } }), makeTick({ t: 100, aim: { yaw: 0.6, pitch: 0.5 } })],
    });
    const sample = sampleReplay(recording, 50);
    expect(sample.camera.yaw).toBeCloseTo(0.4);
    expect(sample.camera.pitch).toBeCloseTo(0.3);
  });

  it('takes the shortest arc when yaw wraps across +PI/-PI, never the long way around', () => {
    const nearPi = Math.PI - 0.1;
    const nearNegPi = -Math.PI + 0.1;
    const recording = normalize({
      ticks: [makeTick({ t: 0, aim: { yaw: nearPi, pitch: 0 } }), makeTick({ t: 100, aim: { yaw: nearNegPi, pitch: 0 } })],
    });
    const sample = sampleReplay(recording, 50);
    // shortest arc from nearPi to nearNegPi crosses the +-PI seam; midpoint should be near +-PI itself,
    // not near 0 (which is what a naive non-wrapping lerp would produce).
    expect(Math.abs(sample.camera.yaw)).toBeGreaterThan(Math.PI - 0.15);
  });

  it('takes keys/ADS/speed from the left (at-or-before) tick, not interpolated', () => {
    const recording = normalize({
      ticks: [
        makeTick({ t: 0, vx: 3, vz: 4, keys: ['A'], ads: false }),
        makeTick({ t: 100, vx: 0, vz: 0, keys: ['D', 'W'], ads: true }),
      ],
    });
    const sample = sampleReplay(recording, 50);
    expect(sample.input.keys).toEqual(['A']);
    expect(sample.input.ads).toBe(false);
    expect(sample.player.speed).toBeCloseTo(5); // hypot(3,4) at the left tick
  });

  it('clamps out-of-range seeks to [0, durationMs]', () => {
    const recording = normalize({ ticks: [makeTick({ t: 0, px: 1 }), makeTick({ t: 100, px: 2 })] });
    expect(sampleReplay(recording, -50).timeMs).toBe(0);
    expect(sampleReplay(recording, 99999).timeMs).toBe(100);
  });

  it('handles a single-tick recording without dividing by zero', () => {
    const recording = normalize({ ticks: [makeTick({ t: 500, px: 7 })] });
    const sample = sampleReplay(recording, 0);
    expect(sample.alpha).toBe(0);
    expect(sample.tickBefore).toBe(0);
    expect(sample.tickAfter).toBe(0);
    expect(sample.player.px).toBe(7);
  });
});

describe('WP-50 T2 — sampleReplay: target lifecycle interpolation', () => {
  it('interpolates target position when both surrounding ticks share the same target id', () => {
    const recording = normalize({
      ticks: [
        makeTick({ t: 0, replayTargetId: 'tgt-1', tx: 0, ty: 1, tz: 0 }),
        makeTick({ t: 100, replayTargetId: 'tgt-1', tx: 10, ty: 1, tz: 0 }),
      ],
    });
    const sample = sampleReplay(recording, 50);
    expect(sample.targets).toEqual([{ id: 'tgt-1', x: 5, y: 1, z: 0 }]);
  });

  it('holds the left tick discrete state (no cross-target lerp) at a spawn/death or target-swap boundary', () => {
    const recording = normalize({
      ticks: [
        makeTick({ t: 0, replayTargetId: 'tgt-1', tx: 0, ty: 0, tz: 0 }),
        makeTick({ t: 100, replayTargetId: 'tgt-2', tx: 100, ty: 0, tz: 0 }),
      ],
    });
    const sample = sampleReplay(recording, 50);
    // must equal the left tick's target exactly, never a blend toward tgt-2's position
    expect(sample.targets).toEqual([{ id: 'tgt-1', x: 0, y: 0, z: 0 }]);
  });

  it('produces no target when the left tick has none, even if the right tick spawns one', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0 }), makeTick({ t: 100, replayTargetId: 'tgt-1', tx: 5, ty: 0, tz: 0 })],
    });
    const sample = sampleReplay(recording, 50);
    expect(sample.targets).toEqual([]);
  });

  it('holds the left tick target when it despawns on the right tick', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0, replayTargetId: 'tgt-1', tx: 5, ty: 0, tz: 0 }), makeTick({ t: 100 })],
    });
    const sample = sampleReplay(recording, 50);
    expect(sample.targets).toEqual([{ id: 'tgt-1', x: 5, y: 0, z: 0 }]);
  });
});

describe('WP-50 T2 — sampleReplay: event navigation and effect windows', () => {
  it('eventCursor is -1 before the first event, and the event index at/after it once time reaches it', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0 }), makeTick({ t: 200 })],
      events: [{ type: 'cue', t: 50, direction: 'A' }],
    });
    expect(sampleReplay(recording, 0).eventCursor).toBe(-1);
    expect(sampleReplay(recording, 49).eventCursor).toBe(-1);
    expect(sampleReplay(recording, 50).eventCursor).toBe(0);
    expect(sampleReplay(recording, 200).eventCursor).toBe(0);
  });

  it('an effect stays active for exactly [eventTime, eventTime + EFFECT_WINDOW_MS)', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0 }), makeTick({ t: 1000 })],
      events: [{ type: 'cue', t: 100, direction: 'A' }],
    });
    expect(sampleReplay(recording, 100).effects).toHaveLength(1);
    expect(sampleReplay(recording, 100 + EFFECT_WINDOW_MS - 1).effects).toHaveLength(1);
    expect(sampleReplay(recording, 100 + EFFECT_WINDOW_MS).effects).toHaveLength(0);
  });

  it('collects multiple simultaneously-active effects in stable chronological order', () => {
    const recording = normalize({
      ticks: [makeTick({ t: 0 }), makeTick({ t: 1000 })],
      events: [
        { type: 'cue', t: 100, direction: 'A' },
        { type: 'counter', key: 'A', t: 150 },
      ],
    });
    const sample = sampleReplay(recording, 160);
    expect(sample.effects.map((e) => e.event.raw.type)).toEqual(['cue', 'counter']);
  });
});

describe('WP-50 T2 — sampleReplay: seek purity', () => {
  it('a direct seek and a sequential walk to the same t produce an identical sample (state hash)', () => {
    const recording = normalize({
      ticks: [
        makeTick({ t: 0, px: 0, pz: 0, aim: { yaw: -3, pitch: 0.1 }, replayTargetId: 'tgt-1', tx: 0, ty: 1, tz: 2 }),
        makeTick({ t: 100, px: 5, pz: -1, aim: { yaw: 3, pitch: 0.2 }, replayTargetId: 'tgt-1', tx: 4, ty: 1, tz: 2 }),
        makeTick({ t: 200, px: 8, pz: -2, aim: { yaw: 0, pitch: -0.1 }, replayTargetId: null }),
      ],
      events: [{ type: 'fire', t: 150, hit: true, firstShot: true, residualSpeed: 0 }],
    });

    const targetTimes = [0, 33, 100, 149, 150, 175, 199, 200];
    for (const t of targetTimes) {
      const direct = sampleReplay(recording, t);
      let sequential = sampleReplay(recording, 0);
      for (let walk = 1; walk <= t; walk++) sequential = sampleReplay(recording, walk);
      expect(sequential).toEqual(direct);
    }
  });

  it('reusing a ReplaySampleBuffer produces per-call values equal to the unbuffered result, once each call is snapshotted before the next mutates the shared arrays', () => {
    const recording = normalize({
      ticks: [
        makeTick({ t: 0, px: 0, replayTargetId: 'tgt-1', tx: 0, ty: 0, tz: 0 }),
        makeTick({ t: 100, px: 10, replayTargetId: 'tgt-1', tx: 10, ty: 0, tz: 0 }),
      ],
      events: [{ type: 'cue', t: 20, direction: 'A' }],
    });
    const buffer = createReplaySampleBuffer();

    const buffered1 = sampleReplay(recording, 25, buffer);
    const snapshot1 = { ...buffered1, targets: [...buffered1.targets], effects: [...buffered1.effects] };
    expect(snapshot1).toEqual(sampleReplay(recording, 25));

    const buffered2 = sampleReplay(recording, 75, buffer);
    // the buffer's arrays are the same instances across calls (that's the whole point of reuse) —
    // which is exactly why a caller must consume/snapshot a buffered sample before the next call.
    expect(buffered2.targets).toBe(buffer.targets);
    const snapshot2 = { ...buffered2, targets: [...buffered2.targets], effects: [...buffered2.effects] };
    expect(snapshot2).toEqual(sampleReplay(recording, 75));
  });
});
