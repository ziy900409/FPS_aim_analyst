import { describe, expect, it } from 'vitest';
import { createSharedState } from '../../src/state/SharedState.ts';
import { createTargetManager } from '../../src/sim/TargetManager.ts';
import { createDrillRunner } from '../../src/drill/DrillRunner.ts';
import { createDataRecorder } from '../../src/data/DataRecorder.ts';
import { createSimLoop } from '../../src/loop/SimLoop.ts';
import { SIM_HZ } from '../../src/loop/constants.ts';
import type { Clock } from '../../src/loop/clock.ts';
import { collectMeta } from '../../src/data/metadata.ts';
import { buildExportPayload } from '../../src/data/export.ts';
import { canonicalExportJSON, parseExportPayload } from '../../src/data/exportPayloadSchema.ts';
import { ak47 } from '../../src/weapon/weapons.ts';
import { holdClickV1 } from '../../src/drill/hold_click_v1.ts';
import { classifyReplaySupport } from '../../src/replay/replayCompatibility.ts';

const TICK_MS = 1000 / SIM_HZ;

/**
 * WP-50 T1 DoD: "至少一 official exact drill 可 full 候選 fixture，可追溯到 capture path" — this
 * drives an official Assessment drill (`hold_click_v1`) through the real production pipeline
 * (TargetManager → DrillRunner → SimLoop → DataRecorder → collectMeta → buildExportPayload), round
 * trips it through the strict wire boundary (canonicalExportJSON → parseExportPayload — the same
 * path a saved-and-reloaded history entry takes), and asserts the classifier reports `full`. This
 * is the end-to-end proof that Slice 2's capture and Slice 3's classifier actually agree, not just
 * two independently-plausible pieces.
 */
describe('WP-50 T1 — an official drill capture round-trip classifies as full', () => {
  it('hold_click_v1: capture -> export -> strict parse -> classify => full', () => {
    const config = holdClickV1.drill;
    const state = createSharedState();
    const clock: Clock = { now: () => 0 };
    const recorder = createDataRecorder({ simHz: SIM_HZ });
    const targetManager = createTargetManager(config);
    const drillRunner = createDrillRunner(state, targetManager);
    const sim = createSimLoop(state, clock, SIM_HZ, targetManager, undefined, drillRunner, recorder, ak47, config.sequence.seed);

    drillRunner.start(config);
    // countdown (3000ms) + spawnDelayMsRange up to 1700ms + margin for the target to become visible
    // and get t_visible-stamped before peekTimeoutMs (1500ms) would time it out.
    const totalTicks = Math.ceil((config.timing.countdownMs + 4000) / TICK_MS);
    for (let i = 0; i < totalTicks; i++) sim.pump((i + 1) * TICK_MS);

    const snapshot = recorder.snapshot();
    // Traceable to the real capture path (D-50-P8): the run actually produced an active target.
    expect(snapshot.ticks.some((tick) => tick.replayTargetId !== undefined)).toBe(true);

    const meta = collectMeta({
      drillId: config.drillId,
      backend: 'webgpu',
      displayHz: 144,
      simHz: SIM_HZ,
      browser: 'test-browser',
      sensitivity: 1,
      crossOriginIsolated: true,
      startedAt: '2026-08-28T00:00:00.000Z',
      scene: { sceneId: 'peek-corridor', assetPackVersion: '1', clutterTier: 'low', fallback: false },
    });
    const payload = buildExportPayload(meta, snapshot);

    // Round trip through the same strict wire boundary a saved/reloaded history entry uses.
    const parsed = parseExportPayload(JSON.parse(canonicalExportJSON(payload)));
    if (!parsed.ok) throw new Error(`expected payload to parse: ${JSON.stringify(parsed.errors)}`);

    const support = classifyReplaySupport(parsed.payload);
    expect(support.status).toBe('full');
    expect(support.missing).toEqual([]);
    expect(support.reasonCodes).toEqual([]);
  });
});
