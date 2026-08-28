import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { normalizeReplayRecording } from '../../src/replay/normalizeReplayRecording.ts';
import { createReplaySampleBuffer, sampleReplay } from '../../src/replay/sampleReplay.ts';
import { buildReplayPunchTimeline, resolveReplayCameraVisualState } from '../../src/replay/replayRecoil.ts';
import { SceneManager } from '../../src/render/SceneManager.ts';
import { placeholderRoom } from '../../src/scene/scenes/placeholder-room.ts';
import { ReplaySceneAdapter } from '../../src/render/replay/ReplaySceneAdapter.ts';
import { ReplayTargetView } from '../../src/render/replay/ReplayTargetView.ts';
import { ReplayEffectView } from '../../src/render/replay/ReplayEffectView.ts';
import { ak47 } from '../../src/weapon/weapons.ts';
import { makeMeta } from './fixtures.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';

/**
 * WP-50 T4 DoD — "量測最大target/effect fixture的adapter/frame P95、mesh pool上限與allocation"
 * (NFR-50.2/50.4). Mirrors `replay-perf.test.ts`'s Node/V8 headless benchmark style/caveats (T2's
 * own comment applies unchanged here — an actual browser measurement is T-exit's job). Fixture keeps
 * one target continuously alive and swapping every 50 ticks (worst case for `same-ID-segment`
 * re-evaluation every sample) plus a fire+hit pair every 20 ticks (worst case for the effect-window
 * scan) — this is deliberately denser churn than any of the 6 official single-target profiles produce.
 */
const TICK_COUNT = 42_000;
const TICK_MS = 1000 / 128;

function buildLargePayload(): ExportPayload {
  const ticks: TickRecord[] = new Array(TICK_COUNT);
  const events: DrillEvent[] = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i * TICK_MS;
    const targetId = `tgt-${Math.floor(i / 50)}`; // swaps every 50 ticks — worst-case segment re-eval
    ticks[i] = {
      t,
      vx: Math.sin(i * 0.01) * 250,
      vz: Math.cos(i * 0.01) * 250,
      px: Math.sin(i * 0.001) * 500,
      pz: Math.cos(i * 0.001) * 500,
      tx: Math.sin(i * 0.02) * 5,
      ty: 1,
      tz: -5 + Math.cos(i * 0.02),
      aim: { yaw: ((i * 0.013) % (2 * Math.PI)) - Math.PI, pitch: Math.sin(i * 0.007) * 0.5 },
      keys: i % 4 === 0 ? ['A'] : i % 4 === 1 ? ['D'] : [],
      ads: i % 50 < 10,
      replayTargetId: targetId,
    };
    if (i % 20 === 0) {
      events.push({ type: 'fire', t, hit: true, firstShot: false, residualSpeed: 0, targetId, shotSeq: i });
      events.push({ type: 'hit', t: t + 5, timeOfFlightMs: 5, shotSeq: i, targetId });
    }
  }
  return { meta: makeMeta({ weaponId: 'ak47' }), ticks, events };
}

function p95(durationsMs: readonly number[]): number {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

describe('WP-50 T4 — perf: replay render-adapter frame cost at recorder-capacity scale', () => {
  it(`buildReplayPunchTimeline(${TICK_COUNT} ticks) is a one-time cost, well under NFR-50.1's 250ms normalize budget`, () => {
    const payload = buildLargePayload();
    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');

    const start = performance.now();
    const timeline = buildReplayPunchTimeline(result.recording, ak47);
    const durationMs = performance.now() - start;

    expect(timeline.pitchDeg.length).toBe(TICK_COUNT);
    // eslint-disable-next-line no-console
    console.log(`[WP-50 T4 perf] buildReplayPunchTimeline one-time cost, ${TICK_COUNT} ticks: ${durationMs.toFixed(2)}ms (Node/V8, headless)`);
    expect(durationMs).toBeLessThan(250);
  });

  it('per-frame sample + camera extras + target/effect sync stays well under the NFR-50.4 4ms/frame budget, with a bounded mesh pool', () => {
    const payload = buildLargePayload();
    const result = normalizeReplayRecording(payload);
    if (!result.ok) throw new Error('expected ok');
    const recording = result.recording;

    const timeline = buildReplayPunchTimeline(recording, ak47);
    const sceneManager = new SceneManager(placeholderRoom);
    const adapter = new ReplaySceneAdapter(sceneManager, placeholderRoom);
    const targetView = new ReplayTargetView(sceneManager.scene, recording.targetHitbox);
    const effectView = new ReplayEffectView(sceneManager.scene);
    const buffer = createReplaySampleBuffer();

    const frameCount = 3000;
    const stepMs = recording.durationMs / frameCount;
    const durations: number[] = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const start = performance.now();
      const sample = sampleReplay(recording, i * stepMs, buffer);
      const extras = resolveReplayCameraVisualState(sample, timeline, ak47, placeholderRoom.proceduralRoom!.fovDeg);
      adapter.applySample(sample, extras);
      targetView.sync(sample.targets);
      effectView.sync(sample, sceneManager.camera);
      durations[i] = performance.now() - start;
    }

    const p95Ms = p95(durations);
    // eslint-disable-next-line no-console
    console.log(`[WP-50 T4 perf] render-adapter frame P95 over ${frameCount} sequential frames: ${p95Ms.toFixed(3)}ms (Node/V8, headless)`);
    expect(p95Ms).toBeLessThan(4);

    // NFR-50.4 "GPU objects/DOM 不逐 frame 無界增長" — at most one concurrent target across this
    // fixture's whole timeline, so the pool must never have grown past 1 mesh.
    expect(targetView.poolSize).toBe(1);
  });
});
