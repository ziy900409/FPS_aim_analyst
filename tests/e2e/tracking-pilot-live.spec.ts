import { readFileSync } from 'node:fs';
import { test, expect, type Download, type Page } from '@playwright/test';

/**
 * WP-54 / T6 slice 2 — the live tracking pilot path in a real browser.
 *
 * Distinct from `tracking-pilot-operator.spec.ts` (T5), which drives the operator screen against
 * the dev-only fake-stub harness to prove keyboard accessibility in seconds. This spec runs the
 * *real* app: researcher menu -> operator screen -> a real pilot `DrillConfig` loaded through
 * `main.ts`'s live clearance/TargetManager/SimLoop chain -> a real 25s block played by the live
 * three-loop runtime -> a real `ExportPayload` assembled by `buildCurrentExportPayload()` and
 * downloaded. It is therefore slow (one block ≈ 28s of wall clock) and asserts the things only a
 * real run can show: that the block actually loads and ends, that the exported JSON carries the
 * WP-54 traceability metadata (drill id, trajectory version/seed, participant, counterbalance
 * cell), and that a real scored block reaches a real `evaluateTrackingRunEligibility()` verdict.
 *
 * No pointer lock and no aiming here: the sim advances on `simLoop.pump()` regardless of pointer
 * lock, and the pilot blocks end on `endCondition: timeLimit`, so an idle run is a legitimate
 * instrumentation test. It measures the plumbing, never a human's tracking ability.
 */

const URL = 'http://localhost:5173/';
const BLOCK_WALL_CLOCK_MS = 60_000; // one 3s countdown + 25s block, with generous headroom

async function openOperatorScreen(page: Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#session-launch-controls')).toBeVisible();
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: 'Tracking pilot', exact: true }).click();
  await expect(page.locator('#tracking-pilot-operator')).toBeVisible();
}

/** Every locator is scoped to the operator overlay: the live app also renders `SessionSetup`,
 * which has its own `participantId` input. */
async function startManifest(page: Page, participantId: string, sessionIndex: '0' | '1'): Promise<void> {
  const operator = page.locator('#tracking-pilot-operator');
  await operator.locator('input[name="participantId"]').fill(participantId);
  await operator.locator('select[name="sessionIndex"]').selectOption(sessionIndex);
  // 1s rest keeps the spec's wall clock dominated by the block itself, not the rest countdown.
  await operator.locator('input[name="restSeconds"]').fill('1');
  await operator.getByRole('button', { name: 'Start manifest', exact: true }).click();
}

async function readDownloadedPayload(download: Download): Promise<{
  meta: Record<string, unknown> & {
    drillId: string;
    session?: { participantId: string; sessionLabel?: string };
    spawn?: { trackingTrajectory?: Record<string, unknown>; trackingPrepMs?: number };
    targets?: { hitbox?: { widthU: number; heightU: number; depthU: number; shape?: string } };
    recorderOverflow: boolean;
  };
  ticks: unknown[];
  events: { type: string }[];
}> {
  const path = await download.path();
  if (path === null) throw new Error(`download ${download.suggestedFilename()} produced no file`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

test.describe('WP-54 T6 — live tracking pilot session', () => {
  test('practice -> calibration: real blocks load, export with full traceability, and reach a real quality verdict', async ({
    page,
  }) => {
    // Two full blocks plus rest; each block is ~28s of real sim time.
    test.setTimeout(4 * BLOCK_WALL_CLOCK_MS);

    await openOperatorScreen(page);

    const status = page.locator('#tracking-pilot-status');
    const operator = page.locator('#tracking-pilot-operator');
    const blockLog = page.locator('#tracking-pilot-records-list');
    const qualityBanner = page.locator('#tracking-pilot-quality-banner');

    const firstDownload = page.waitForEvent('download', { timeout: BLOCK_WALL_CLOCK_MS });
    await startManifest(page, 'e2e-pilot', '0');

    // The runner only publishes this status *after* `await loadDrillConfig(...)` resolves, so
    // seeing it is proof the real config cleared `loadDrill()`/clearance and rebuilt the sim.
    await expect(status).toHaveText(/Block 1\/9（practice）：tracking_core_pr_pilot_v1_practice/);
    // The full-viewport operator scrim must step aside so the participant can see the target.
    await expect(operator).toBeHidden();

    const practicePayload = await readDownloadedPayload(await firstDownload);
    expect(practicePayload.meta.drillId).toBe('tracking_core_pr_pilot_v1_practice');
    // Traceability rides the existing `meta.session` fields (D-54.31) — participant plus the
    // manifest's counterbalance cell, which is a pure function of (participantId, sessionIndex).
    expect(practicePayload.meta.session).toEqual({
      participantId: 'e2e-pilot',
      sessionLabel: 'tracking-pilot-v1:e2e-pilot:session-0',
    });
    // KI-020: travel amplitude is now a shared constant (±16°) and `size` lives in the hitbox, so
    // the trajectory carries the amplitude/speed while the target's angular size is asserted below.
    expect(practicePayload.meta.spawn?.trackingTrajectory).toMatchObject({
      kind: 'band-limited-2d-v1',
      seed: 54000,
      yawBoundDeg: 16,
      pitchBoundDeg: 16,
      targetRmsSpeedDegPerSec: 5,
    });
    // The practice cell's target is the 2.0° candidate: a cube edge of 2*4*tan(1°) at 4u.
    expect(practicePayload.meta.targets?.hitbox?.widthU).toBeCloseTo(0.13964, 4);
    expect(practicePayload.ticks.length).toBeGreaterThan(0);
    expect(practicePayload.meta.recorderOverflow).toBe(false);
    // Practice carries no prep window (T2: no `trackingPrepMs`, no `protocolGuard`)…
    expect(practicePayload.meta.spawn?.trackingPrepMs).toBeUndefined();
    // …but it *does* still emit one `scored_start`, at its first motion tick: `TargetManager`
    // stamps `tScoredStart` as soon as `age >= trackingPrepSec`, and an absent `trackingPrepMs`
    // means `trackingPrepSec === 0`. So "practice has no scored window" is enforced by *role*
    // (drillId), never by the absence of this event — see progress.md D-54.34, which is why
    // aggregation must exclude practice explicitly rather than relying on this event.
    expect(practicePayload.events.filter((event) => event.type === 'scored_start')).toHaveLength(1);

    // Back to the operator: practice is never quality-gated, so there is no banner to show.
    await expect(operator).toBeVisible();
    await expect(blockLog.locator('li')).toHaveCount(1);
    await expect(blockLog).toContainText('tracking_core_pr_pilot_v1_practice');
    await expect(qualityBanner).toBeHidden();

    const secondDownload = page.waitForEvent('download', { timeout: BLOCK_WALL_CLOCK_MS });
    await operator.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(status).toHaveText(
      /Block 2\/9（calibration）：tracking_core_pr_pilot_v1_calibration_horizontal/,
      { timeout: 10_000 },
    );

    const calibrationPayload = await readDownloadedPayload(await secondDownload);
    expect(calibrationPayload.meta.drillId).toBe('tracking_core_pr_pilot_v1_calibration_horizontal');
    // A scored block: 1s centre-prep window then the frozen 25s scored window (FR-54-5/D-54.4).
    expect(calibrationPayload.meta.spawn?.trackingPrepMs).toBe(1000);
    const scoredStarts = calibrationPayload.events.filter((event) => event.type === 'scored_start');
    expect(scoredStarts).toHaveLength(1);

    // The real payload reaches the real eligibility gate — verdict text, never a capability score.
    await expect(operator).toBeVisible();
    await expect(qualityBanner).toBeVisible();
    await expect(qualityBanner).toHaveAttribute('role', 'alert');
    await expect(qualityBanner).toHaveText(/^(Eligible|Blocked) — /);
    await expect(blockLog.locator('li')).toHaveCount(2);

    // Printed, not asserted: the verdict of an *idle* (no-aiming) run is an instrumentation fact
    // about this machine/browser, not a contract — T6's gate document quotes it as measured
    // evidence, and pinning it here would make the spec fail on a slower machine instead of
    // reporting the truth.
    console.log(
      `[WP-54 T6] calibration block — ticks=${calibrationPayload.ticks.length}, ` +
        `events=${calibrationPayload.events.length}, quality="${await qualityBanner.textContent()}"`,
    );
  });
});
