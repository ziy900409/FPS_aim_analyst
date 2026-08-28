import { describe, expect, it } from 'vitest';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { createReplaySampleBuffer, sampleReplay } from '../../src/replay/sampleReplay.ts';
import { makeMeta } from './fixtures.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ReplayRecording } from '../../src/replay/contracts.ts';

/**
 * WP-50 T2 DoD — NFR-50.1 ("normalize + indexes P95 < 250ms" for a ~42,000-tick recorder-capacity
 * payload) and NFR-50.2 ("任意 seek/sample P95 < 2ms; tick/event 定位採 binary search，複雜度
 * O(log n + k_visible)"). This is a Node/Vitest (V8) benchmark, not a browser measurement — it is the
 * same kind of headless proxy evidence T0's PoC already used for this codebase (see
 * docs/exec-plan/active/stage10/wp-50-3d-state-replay/progress.md T0 Evidence Log); an actual
 * browser-level measurement is T-exit's job once a real Replay Screen exists to profile.
 *
 * 42,000 ticks matches `capacityForDrill(128, 300)` (T0 PoC finding, README NFR-50.1's own number),
 * not the ~15,360-tick realistic worst case the 6 official drills' timing gates actually produce
 * (T1 progress.md Surprises entry) — this benchmark deliberately stress-tests the theoretical upper
 * bound the recorder can produce, since that is what NFR-50.1 names.
 */
const TICK_COUNT = 42_000;
const TICK_MS = 1000 / 128;
const EVENT_EVERY_N_TICKS = 20; // ~2,100 events across the fixture — stresses the event index too

function buildLargePayload(): ExportPayload {
  const ticks: TickRecord[] = new Array(TICK_COUNT);
  const events: DrillEvent[] = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i * TICK_MS;
    const hasTarget = i % 7 !== 0; // occasional gaps, occasional target swaps below
    const targetId = hasTarget ? `tgt-${Math.floor(i / 300)}` : null;
    ticks[i] = {
      t,
      vx: Math.sin(i * 0.01) * 250,
      vz: Math.cos(i * 0.01) * 250,
      px: Math.sin(i * 0.001) * 500,
      pz: Math.cos(i * 0.001) * 500,
      tx: hasTarget ? Math.sin(i * 0.02) * 100 : null,
      ty: hasTarget ? 60 : null,
      tz: hasTarget ? Math.cos(i * 0.02) * 100 : null,
      aim: { yaw: ((i * 0.013) % (2 * Math.PI)) - Math.PI, pitch: Math.sin(i * 0.007) * 0.5 },
      keys: i % 4 === 0 ? ['A'] : i % 4 === 1 ? ['D'] : [],
      ads: i % 50 < 10,
      ...(targetId !== null ? { replayTargetId: targetId } : {}),
    };
    if (i % EVENT_EVERY_N_TICKS === 0) {
      events.push({ type: 'fire', t, hit: i % 3 === 0, firstShot: i % EVENT_EVERY_N_TICKS === 0, residualSpeed: 0, shotSeq: i });
    }
  }
  return { meta: makeMeta(), ticks, events };
}

function p95(durationsMs: readonly number[]): number {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

describe('WP-50 T2 — perf: normalize + sample at recorder-capacity scale', () => {
  it(`normalizeReplayRecording(${TICK_COUNT} ticks) completes well under the NFR-50.1 250ms budget`, () => {
    const payload = buildLargePayload();

    const iterations = 5;
    const durations: number[] = [];
    let ticksBuilt = 0;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = normalizeReplayRecording(payload);
      durations.push(performance.now() - start);
      if (!result.ok) throw new Error('expected ok');
      ticksBuilt = result.recording.ticks.length;
    }

    expect(ticksBuilt).toBe(TICK_COUNT);
    const p95Ms = p95(durations);
    // eslint-disable-next-line no-console
    console.log(`[WP-50 T2 perf] normalize P95 over ${iterations} iterations, ${TICK_COUNT} ticks: ${p95Ms.toFixed(2)}ms (Node/V8, headless)`);
    expect(p95Ms).toBeLessThan(250);
  });

  it('sampleReplay P95 over many scattered seeks stays well under the NFR-50.2 2ms budget', () => {
    const payload = buildLargePayload();
    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');
    const recording = result.recording;

    const sampleCount = 5000;
    const durations: number[] = new Array(sampleCount);
    // Deterministic pseudo-scatter (no Math.random per the replay-domain purity rule extends to this
    // benchmark too, for reproducibility) covering the full timeline non-monotonically, as a seek UI
    // would: this is what actually stresses binary search rather than sequential cache-friendly access.
    for (let i = 0; i < sampleCount; i++) {
      const t = ((i * 96_931) % recording.durationMs);
      const start = performance.now();
      sampleReplay(recording, t);
      durations[i] = performance.now() - start;
    }

    const p95Ms = p95(durations);
    // eslint-disable-next-line no-console
    console.log(`[WP-50 T2 perf] sampleReplay P95 over ${sampleCount} scattered seeks, ${TICK_COUNT} ticks: ${p95Ms.toFixed(3)}ms (Node/V8, headless)`);
    expect(p95Ms).toBeLessThan(2);
  });

  it('per-frame sampling with a reused buffer stays well under the NFR-50.4 4ms/frame budget at 60Hz playback pacing', () => {
    const payload = buildLargePayload();
    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');
    const recording = result.recording;

    const buffer = createReplaySampleBuffer();
    const frameCount = 3000;
    const stepMs = recording.durationMs / frameCount;
    const durations: number[] = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const start = performance.now();
      sampleReplay(recording, i * stepMs, buffer);
      durations[i] = performance.now() - start;
    }

    const p95Ms = p95(durations);
    // eslint-disable-next-line no-console
    console.log(`[WP-50 T2 perf] buffered sampleReplay P95 over ${frameCount} sequential frames: ${p95Ms.toFixed(3)}ms (Node/V8, headless)`);
    expect(p95Ms).toBeLessThan(4);
  });

  it('sampleReplay cost does not scale linearly with tick count (binary search, not a full-array scan)', () => {
    const small = normalizeReplayRecording(buildSmallPayload(500));
    const large = normalizeReplayRecording(buildSmallPayload(TICK_COUNT));
    if (!small.ok || !large.ok) throw new Error('expected ok');

    const timeFor = (recording: ReplayRecording): number => {
      const iterations = 20_000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        sampleReplay(recording, (i * 97) % recording.durationMs);
      }
      return performance.now() - start;
    };

    const smallDuration = timeFor(small.recording);
    const largeDuration = timeFor(large.recording);
    // eslint-disable-next-line no-console
    console.log(
      `[WP-50 T2 perf] 20k sampleReplay calls: 500 ticks = ${smallDuration.toFixed(1)}ms, ${TICK_COUNT} ticks = ${largeDuration.toFixed(1)}ms`,
    );
    // O(log n) growth from 500 -> 42,000 ticks (~84x) should cost at most a small constant factor
    // more, nowhere near the ~84x an O(n) full-array scan would show.
    expect(largeDuration).toBeLessThan(smallDuration * 10 + 50);
  });
});

function buildSmallPayload(tickCount: number): ExportPayload {
  const ticks: TickRecord[] = new Array(tickCount);
  for (let i = 0; i < tickCount; i++) {
    const t = i * TICK_MS;
    ticks[i] = {
      t,
      vx: 0,
      vz: 0,
      px: i,
      pz: -i,
      tx: null,
      ty: null,
      tz: null,
      aim: { yaw: 0, pitch: 0 },
      keys: [],
      ads: false,
    };
  }
  return { meta: makeMeta(), ticks, events: [] };
}
