import { test, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';

/**
 * WP-51 T4 — real network/response-shape inspection proving History's list/detail views only ever
 * read summary/analysis projections, never bulk-download the full tick/event payload
 * (T4-scale-lifecycle-a11y.md Work item 3, DoD "scale UI只讀summary/analysis projection，未批次下載
 * full payload"). Every existing spec asserts DOM *content*; none inspect the actual JSON wire shape
 * of the underlying HTTP responses the browser received while navigating there — this file listens
 * to real `page.on('response', ...)` events during the full History navigation and greps each list
 * endpoint's body for `"ticks"`/`"events"` keys, rather than trusting that the client code never asks
 * for them. The detail endpoint (`GET /api/history/runs/:runId`) is asserted to contain both — a
 * sanity check that this detection method isn't vacuously passing on an empty/wrong assertion.
 */

const BASE_URL = 'http://localhost:5173/';
const DRILL_ID = 'hold_click_v1';

async function postRun(request: APIRequestContext, payload: ExportPayload): Promise<{ ok: boolean }> {
  const res = await request.post('http://localhost:5173/api/history/runs', { data: payload });
  return res.json();
}

async function waitForHarnessReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

function buildFixture(participantId: string): { payload: ExportPayload; runId: string } {
  const startedAt = new Date(Date.UTC(2099, 1, 1) + Date.now()).toISOString();
  const payload = makePayload({
    meta: {
      drillId: DRILL_ID,
      session: { participantId },
      assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      startedAt,
      vStrafe: 250,
      scene: { sceneId: 'peek-corridor', assetPackVersion: 'peek-corridor-v1', clutterTier: 'low', fallback: false },
    },
    // Enough real ticks/events that a naive "bulk-download everything" implementation would be
    // trivially caught by this test — a payload with empty ticks/events would let a leaky endpoint
    // slip through undetected.
    ticks: [makeTick({ t: 0 }), makeTick({ t: 100 }), makeTick({ t: 200 }), makeTick({ t: 300 })],
    events: [
      { type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, shotSeq: 0 },
      { type: 'hit', t: 100, timeOfFlightMs: 5, shotSeq: 0 },
    ],
  });
  const runId = buildRunId(buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt));
  return { payload, runId };
}

/** True if the parsed JSON body contains a `ticks` or `events` array anywhere (recursively) — the
 * two fields that only ever legitimately belong to a full `ExportPayload` detail response. */
function containsFullPayloadFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsFullPayloadFields);
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'ticks' || key === 'events') && Array.isArray(nested)) return true;
      if (containsFullPayloadFields(nested)) return true;
    }
  }
  return false;
}

test.describe('WP-51 T4 — list/detail projections never carry full tick/event payloads (FR-51.12)', () => {
  test('every list-endpoint response encountered while navigating History stays payload-free; only the run-detail fetch carries ticks/events', async ({
    page,
    request,
  }) => {
    const participantId = `stage10-shape-${crypto.randomUUID()}`;
    const { payload, runId } = buildFixture(participantId);
    const seed = await postRun(request, payload);
    expect(seed.ok, `seed failed: ${JSON.stringify(seed)}`).toBe(true);

    const listResponses: { url: string; hasFullPayloadFields: boolean }[] = [];
    let detailResponse: { url: string; hasFullPayloadFields: boolean } | undefined;
    const pendingCaptures: Promise<void>[] = [];

    page.on('response', (response: Response) => {
      const url = response.url();
      if (!url.includes('/api/history/')) return;
      // Fire-and-forget: response bodies must be read asynchronously, and a listener callback can't
      // block navigation — collect promises and await them all after the journey completes instead.
      const capture = (async () => {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return; // non-JSON (e.g. a 204) — nothing to inspect
        }
        const entry = { url, hasFullPayloadFields: containsFullPayloadFields(body) };
        if (/\/api\/history\/runs\/[^/]+$/.test(new URL(url).pathname)) {
          detailResponse = entry;
        } else {
          listResponses.push(entry);
        }
      })();
      pendingCaptures.push(capture);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForHarnessReady(page);

    await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
    const screen = page.locator('#history-screen');
    await expect(screen).toBeVisible();
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(DRILL_ID) }).click();
    await screen.getByRole('button', { name: new RegExp(runId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();

    await Promise.all(pendingCaptures);

    expect(listResponses.length, 'expected at least one list-endpoint response to have been observed').toBeGreaterThan(0);
    for (const entry of listResponses) {
      expect(entry.hasFullPayloadFields, `list endpoint leaked ticks/events: ${entry.url}`).toBe(false);
    }

    // Sanity check: the detail fetch (which the UI is *supposed* to make, exactly once, only when a
    // specific run is opened) really does carry the full payload — proving `containsFullPayloadFields`
    // actually detects a true positive, not just passing because it never finds anything at all.
    expect(detailResponse, 'expected the run-detail endpoint to have been fetched when opening the run').toBeDefined();
    expect(detailResponse?.hasFullPayloadFields, 'run-detail endpoint should carry ticks/events').toBe(true);
  });
});
