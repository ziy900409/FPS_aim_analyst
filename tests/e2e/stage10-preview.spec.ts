import { test, expect, type APIRequestContext, type Page, type Locator } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { buildStage10Fixtures } from '../stage10/Stage10FixtureFactory.ts';
import { makeMeta, makePayload, makeTick } from '../replay/fixtures.ts';

/**
 * WP-51 T2 — Preview public smoke (FR-51.11, OQ-51.3). The production bundle has no DEV-only
 * `__fpsTest` hook (`src/main.ts`'s `import.meta.env.DEV` guard, WP-48 FR-48.10), so this file seeds
 * through the public `POST /api/history/runs` API only and drives the same public History UI dev
 * uses — never a test-only backdoor into the built bundle.
 *
 * It reuses the Stage10 T2 fixture roster (`Stage10FixtureFactory.ts`) to prove exact grouping,
 * same-instant tie-break, cohort separation, unregistered-metric projection and Practice exclusion
 * all hold against a real built `vite preview` bundle — WP-49's own `history-library.spec.ts` proves
 * the same UI contracts, but only ever against `vite dev` (no existing spec runs against preview at
 * all). Every Stage10 fixture payload has empty `ticks` (built for identity/grouping, not for a real
 * recording), which makes it a legitimate, non-fabricated `unsupported` Replay case (EMPTY_TICKS,
 * `src/replay/replayCompatibility.ts`) reachable through the real public UI — `replay.spec.ts`
 * (WP-50) deliberately does not attempt `unsupported` with real drills since every registered
 * Assessment exact `drillId` classifies `full` once it has real sim ticks.
 */

const URL = 'http://localhost:4173/';
const API_BASE = 'http://localhost:4173';

async function postRun(request: APIRequestContext, payload: ExportPayload): Promise<{ ok: boolean; data?: unknown; error?: { code: string } }> {
  const res = await request.post(`${API_BASE}/api/history/runs`, { data: payload });
  return res.json();
}

async function openHistory(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  const screen = page.locator('#history-screen');
  await expect(screen).toBeVisible();
  return screen;
}

test.describe('WP-51 T2 — Preview public smoke', () => {
  test('the production bundle has no DEV test hook, and stays cross-origin isolated', async ({ page }) => {
    const response = await page.goto(URL, { waitUntil: 'networkidle' });
    expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin');
    expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp');
    expect(await page.evaluate(() => (self as unknown as { crossOriginIsolated: boolean }).crossOriginIsolated)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __fpsTest?: unknown }).__fpsTest)).toBeUndefined();
  });

  test('the Stage10 fixture roster is reachable end to end through the public History UI (FR-51.5/51.7/51.8)', async ({ page, request }) => {
    const { manifest, assessmentPayloads, practicePayload } = buildStage10Fixtures(`preview-${crypto.randomUUID()}`);
    const [participantA, participantB] = manifest.syntheticParticipantIds;

    for (const payload of assessmentPayloads) {
      const result = await postRun(request, payload);
      expect(result.ok, `seed failed for ${payload.meta.drillId}: ${JSON.stringify(result)}`).toBe(true);
    }
    const practiceResult = await postRun(request, practicePayload);
    expect(practiceResult.ok).toBe(false);
    expect(practiceResult.error?.code).toBe('PRACTICE_NOT_ARCHIVABLE');

    await page.goto(URL, { waitUntil: 'networkidle' });
    const screen = await openHistory(page);

    // Same-instant tie-break: both synthetic participants share the same latestStartedAt (the
    // counterstrafe-cued-v1 instant) — order must resolve deterministically by participantId, not
    // insertion order, both before and after going through the real public seed/UI path.
    const commonPrefix = participantA!.replace(/-participant-1$/, '-participant-');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(commonPrefix);
    const rows = screen.locator('[data-section="participant-status"] li button');
    await expect(rows).toHaveCount(2);
    const rowTexts = await rows.allTextContents();
    expect(rowTexts[0]).toContain(participantA);
    expect(rowTexts[1]).toContain(participantB);

    await screen.getByRole('button', { name: new RegExp(participantA!) }).click();

    // Exact grouping: three distinct exact-drillId cards for participant A, never merged into one
    // family bucket; Practice's drill (hold_track_v1) was never archived, so it never appears.
    await expect(screen.getByRole('button', { name: /hold_click_v1/ })).toBeVisible();
    await expect(screen.getByRole('button', { name: /spider-shot-v2/ })).toBeVisible();
    await expect(screen.getByRole('button', { name: /counterstrafe-cued-v1/ })).toBeVisible();
    await expect(screen.getByRole('button', { name: /hold_track_v1/ })).toHaveCount(0);

    // Unregistered metric (hold_click_v1): explicit "not registered" trend message, not silent
    // emptiness — same contract WP-49 already proves on dev, here on the built preview bundle.
    await screen.getByRole('button', { name: /hold_click_v1/ }).click();
    await expect(screen.locator('[data-section="drill-trend"]')).toContainText('尚未註冊歷史指標');

    // Unsupported Replay, reached only through the public run list and Run Detail.
    const unknownRunId = manifest.assessmentRunIds[0]!;
    await screen.getByRole('button', { name: new RegExp(unknownRunId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
    await screen.locator('[data-history-action="replay"]').click();

    const replay = page.locator('#replay-screen');
    await expect(replay).toBeVisible();
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveText('僅結果');
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'unsupported');
    await expect(replay.locator('[data-section="replay-unsupported"]')).toBeVisible();
    await expect(replay.locator('[data-section="replay-unsupported"]')).toContainText('缺少可播放的紀錄資料');
    await replay.locator('[data-section="replay-unsupported"] [data-replay-action="back"]').click();
    await expect(replay).toBeHidden();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();

    // Exact grouping / cohort separation: spider-shot-v2 (registered) has two runs with different
    // sensitivity — both remain distinct run-list rows, never merged into one. Every Stage10 fixture
    // has empty `events` (built for identity, not a real recording), so neither run has any
    // `visible`-type sample and both fail the trend quality gate (`qualityGateStatusForPayload`,
    // `src/history/DrillMetricRegistry.ts`) — the cohort *selector* itself only lists quality-gate-
    // eligible cohorts, so it correctly renders nothing here; the trend instead shows the same
    // explicit "insufficient data" state FR-51.7 requires (never silent emptiness), which is a case
    // WP-49's own trend spec never exercises (its fixtures always have real, quality-gate-passing
    // sim ticks).
    const cohortRunIdA = manifest.assessmentRunIds[1]!;
    const cohortRunIdB = manifest.assessmentRunIds[2]!;
    await screen.locator('[data-history-crumb="drills"]').click();
    await screen.getByRole('button', { name: /spider-shot-v2/ }).click();
    await expect(screen.getByRole('button', { name: new RegExp(cohortRunIdA) })).toBeVisible();
    await expect(screen.getByRole('button', { name: new RegExp(cohortRunIdB) })).toBeVisible();
    await expect(screen.locator('[data-section="drill-trend"]')).toContainText('目前沒有足夠的合格資料可產生趨勢');
  });

  test('a run with real ticks but no scene/target-lifecycle capture reaches a partial Replay through the public UI (FR-51.8)', async ({
    page,
    request,
  }) => {
    // Real (non-empty, monotonic) ticks classify `full`/`partial` by capability, not EMPTY_TICKS —
    // omitting `scene` (and never declaring the `replay` contract) is the same, non-fabricated
    // capability gap `tests/replay/fixtures.ts` already uses for Vitest-level partial coverage
    // (src/replay/ReplayController.test.ts); this just reaches the identical classification through
    // the real public API + UI instead of a fake, which no existing Playwright spec attempts.
    const participantId = `stage10-partial-${crypto.randomUUID()}`;
    const partialPayload: ExportPayload = makePayload({
      meta: {
        drillId: 'hold_click_v1',
        session: { participantId },
        assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
        startedAt: '2026-08-31T09:00:00.000Z',
        vStrafe: 250,
        scene: undefined,
        replay: undefined,
      },
      ticks: [makeTick({ t: 0 }), makeTick({ t: 16 }), makeTick({ t: 32 })],
    });
    const runId = buildRunId(
      buildRunIdentity(partialPayload.meta.schemaVersion, participantId, partialPayload.meta.drillId, partialPayload.meta.startedAt),
    );

    const seedResult = await postRun(request, partialPayload);
    expect(seedResult.ok, `seed failed: ${JSON.stringify(seedResult)}`).toBe(true);

    await page.goto(URL, { waitUntil: 'networkidle' });
    const screen = await openHistory(page);
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: /hold_click_v1/ }).click();
    await screen.getByRole('button', { name: new RegExp(runId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
    await screen.locator('[data-history-action="replay"]').click();

    const replay = page.locator('#replay-screen');
    await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveText('有限重播');
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'partial');
    await expect(replay.locator('[data-section="replay-partial-banner"]')).toBeVisible();
    // Partial still plays — unlike unsupported, the transport is present, not just a message+Back.
    await expect(replay.locator('[data-replay-action="play-pause"]')).toBeVisible();
    await replay.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replay).toBeHidden();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
  });
});
