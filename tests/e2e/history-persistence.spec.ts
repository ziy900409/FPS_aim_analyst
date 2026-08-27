import { test, expect } from '@playwright/test';

/**
 * WP-48 T5 — Assessment-only automatic persistence, end to end against the real Node History API
 * and its Playwright temp root (`.playwright-tmp/history-dev`, playwright.config.ts).
 *
 * `__fpsTest` (src/testharness/fpsTestHarness.ts) runs an isolated synthetic pipeline, not the live
 * `main.ts` singleton driven by `renderLoop` — so it never reaches the live completion IIFE's
 * `phase === 'ended'` branch (that requires real pointer-lock/mouse input, out of automated E2E
 * scope; see full-drill.spec.ts header). `saveToHistory()` is a dev-only test hook (main.ts,
 * `import.meta.env.DEV`, production-stripped) that drives the *same* `historyPersistence` instance
 * the live seam uses, against a harness-built payload with an injected Participant/assessment
 * envelope — exercising the real HistoryClient -> Node API -> temp root path end to end without
 * needing live gameplay.
 */

const URL = 'http://localhost:5173/';
const DRILL_ID = 'counterstrafe_ad_v1';

type HistorySaveState =
  | { kind: 'idle' }
  | { kind: 'excluded'; reason: 'practice' }
  | { kind: 'saving'; runKey: string }
  | { kind: 'saved'; run: { runId: string }; disposition: 'created' | 'existing' }
  | { kind: 'failed'; message: string; retryable: boolean };

type Harness = {
  startDrill(id: string): void;
  runCounterStrafeRound(maxPeeks?: number): void;
  forceExportJSON(): { meta: Record<string, unknown>; ticks: unknown[]; events: unknown[] };
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
};

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

test.describe('WP-48 T5 — auto-save wiring (dev server, real temp-root API)', () => {
  test('Assessment save: created then existing on retry, and the saved run matches the same-payload identity/counts', async ({
    page,
    request,
  }) => {
    await waitForHarness(page);

    const r = await page.evaluate(async (drillId) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runCounterStrafeRound(3);

      const participantId = `e2e-t5-${crypto.randomUUID()}`;
      const created = await harness.saveToHistory({ participantId, assessment: true });
      const existing = await harness.saveToHistory({ participantId, assessment: true });
      const verify = harness.forceExportJSON(); // same recorder snapshot — no ticks advanced since save

      return {
        participantId,
        drillId: verify.meta.drillId as string,
        startedAt: verify.meta.startedAt as string,
        ticksLen: verify.ticks.length,
        eventsLen: verify.events.length,
        created,
        existing,
      };
    }, DRILL_ID);

    expect(r.created.kind).toBe('saved');
    expect(r.existing.kind).toBe('saved');
    if (r.created.kind !== 'saved' || r.existing.kind !== 'saved') throw new Error('unreachable');
    expect(r.created.disposition).toBe('created');
    expect(r.existing.disposition).toBe('existing');
    expect(r.existing.run.runId).toBe(r.created.run.runId);

    const runsResponse = await request.get(
      `${URL}api/history/participants/${encodeURIComponent(r.participantId)}/drills/${encodeURIComponent(r.drillId)}/runs`,
    );
    expect(runsResponse.status()).toBe(200);
    const runsBody = await runsResponse.json();
    expect(runsBody.data).toHaveLength(1);
    expect(runsBody.data[0].runId).toBe(r.created.run.runId);
    expect(runsBody.data[0].startedAt).toBe(r.startedAt);

    const loadResponse = await request.get(`${URL}api/history/runs/${encodeURIComponent(r.created.run.runId)}`);
    expect(loadResponse.status()).toBe(200);
    const loadBody = await loadResponse.json();
    expect(loadBody.data.meta.session.participantId).toBe(r.participantId);
    expect(loadBody.data.meta.startedAt).toBe(r.startedAt);
    expect(loadBody.data.ticks).toHaveLength(r.ticksLen);
    expect(loadBody.data.events).toHaveLength(r.eventsLen);
  });

  test('Practice (no assessment) short-circuits to excluded without calling the API', async ({ page }) => {
    await waitForHarness(page);

    const state = await page.evaluate(async (drillId) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runCounterStrafeRound(2);
      return harness.saveToHistory(); // no overrides -> meta.assessment stays undefined
    }, DRILL_ID);

    expect(state).toEqual({ kind: 'excluded', reason: 'practice' });
  });

  test('Assessment without a Participant ID is rejected as a non-retryable failure, never persisted', async ({
    page,
  }) => {
    await waitForHarness(page);

    const r = await page.evaluate(async (drillId) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runCounterStrafeRound(2);
      return { state: await harness.saveToHistory({ assessment: true }) };
    }, DRILL_ID);

    expect(r.state.kind).toBe('failed');
    if (r.state.kind !== 'failed') throw new Error('unreachable');
    expect(r.state.retryable).toBe(false);
  });
});
