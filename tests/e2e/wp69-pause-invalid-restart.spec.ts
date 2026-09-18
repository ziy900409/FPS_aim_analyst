import { expect, test, type Page } from '@playwright/test';
import { armAndWaitRunning, readDrillArmState } from './support/arm.ts';

/**
 * WP-69 / T6 — production-wired Edge acceptance for pause → invalid → restart.
 *
 * The unit suite owns the exhaustive transition matrix. This file deliberately exercises the
 * browser-only seams that a DOM stub cannot prove: a trusted click obtains real Pointer Lock,
 * `document.exitPointerLock()` takes the same path as Esc, Resume stays in the user-gesture stack,
 * the diagnostic action is actually clicked, and a saturated live input ring discards the result.
 */

const APP_URL = 'http://localhost:5173/';
const TRACKING_DRILL_ID = 'tracking_scene_v1';

interface CapturedDownload {
  filename: string;
  content: string;
}

interface Wp69State {
  drill: { drillId: string; sceneId: string; weaponId: string; seed: number };
  attempt: {
    number: number;
    phase: string;
    validity: string;
    pauseOccurred: boolean;
    fenceCount: number;
    lockConfirmationCount: number;
  };
  time: { mapperPaused: boolean; excludedWallMs: number; hudElapsedMs: number };
  recording: {
    tickCount: number;
    eventCount: number;
    fireCount: number;
    hitCount: number;
    recorderOverflow: boolean;
    bufferOverflow: number;
    inputSize: number;
    ammo: number;
  };
  aim: { yaw: number; pitch: number };
  held: { left: boolean; right: boolean; fire: boolean; ads: boolean };
  finalizedDisposition?: { kind: string; reason?: string };
  resultShown: boolean;
  session: Record<string, unknown>;
  protocol: { protocolId: string; current?: { conditionIndex: number }; exportCount: number };
  pilot?: {
    phase: Record<string, unknown>;
    recordCount: number;
    invalidAttemptCount: number;
    invalidAttempts: unknown[];
  };
}

/**
 * `download` is intentionally intercepted at the product's actual anchor-click boundary. The app
 * revokes blob URLs immediately after clicking them, which makes Playwright's native download event
 * timing-dependent. Keeping the Blob and dispatching the real click event proves that the visible
 * action was invoked while giving the test deterministic access to filename and bytes.
 */
const INSTALL_DOWNLOAD_CAPTURE = (): void => {
  const blobs = new Map<string, Blob>();
  const captures: CapturedDownload[] = [];
  let serial = 0;
  const nativeCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob: Blob | MediaSource): string => {
    if (!(blob instanceof Blob)) return nativeCreate(blob);
    const url = `blob:wp69-e2e/${serial++}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click(): void {
    const blob = blobs.get(this.href);
    if (blob === undefined) {
      nativeClick.call(this);
      return;
    }
    void blob.text().then((content) => captures.push({ filename: this.download, content }));
    this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  (window as unknown as { __wp69Downloads: CapturedDownload[] }).__wp69Downloads = captures;
};

async function openStandaloneDrill(page: Page): Promise<void> {
  await openApp(page);
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await page.locator('#drill-select').selectOption(TRACKING_DRILL_ID);
  await expect.poll(async () => (await readState(page)).drill.drillId).toBe(TRACKING_DRILL_ID);
}

async function openApp(page: Page): Promise<void> {
  await page.route('**/@vite/client', (route) => route.abort());
  await page.addInitScript(INSTALL_DOWNLOAD_CAPTURE);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 20_000,
    })
    .toBe(true);
}

async function readState(page: Page): Promise<Wp69State> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __fpsTest: { wp69State(): Wp69State };
      }
    ).__fpsTest.wp69State(),
  );
}

async function readDownloads(page: Page): Promise<CapturedDownload[]> {
  return page.evaluate(() =>
    [...(window as unknown as { __wp69Downloads: CapturedDownload[] }).__wp69Downloads].map((entry) => ({ ...entry })),
  );
}

async function takeRealPointerLock(page: Page): Promise<void> {
  await page.locator('canvas').click({ position: { x: 400, y: 300 } });
  await expect.poll(async () => (await readDrillArmState(page))?.locked ?? null, { timeout: 10_000 }).toBe(true);
}

async function startRunningWithRealLock(page: Page): Promise<void> {
  await armAndWaitRunning(page);
  await takeRealPointerLock(page);
}

async function pauseThroughRealPointerLockLoss(page: Page): Promise<void> {
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(async () => (await readState(page)).attempt.phase, { timeout: 10_000 }).toBe('paused');
  await expect(page.locator('#pause-overlay')).toBeVisible();
}

async function restartFromPause(page: Page): Promise<void> {
  const attempt = (await readState(page)).attempt.number;
  await page.locator('#pause-overlay').getByRole('button', { name: '重新測試', exact: true }).click();
  await expect.poll(async () => (await readState(page)).attempt.number).toBe(attempt + 1);
  await expect.poll(async () => (await readDrillArmState(page))?.phase ?? null).toBe('armed');
}

/**
 * The text span only, never `#protocol-status` itself: the banner also contains the `下一條件`
 * button, whose label is in `textContent` whether or not it is displayed — comparing the whole
 * element would compare the button's visibility rules instead of the status line.
 */
function protocolStatusLine(page: Page) {
  return page.locator('#protocol-status > span');
}

async function readProtocolStatusLine(page: Page): Promise<string> {
  return (await protocolStatusLine(page).textContent()) ?? '';
}

/**
 * KI-041 — the hold notice's lifetime ends when the next attempt starts.
 *
 * `#protocol-status` is a single channel shared by Session / Protocol / Pilot, and it had no clear
 * path at all: whatever `holdOrchestratorsOnAttempt()` wrote survived the operator's own Restart and
 * kept claiming "測試進度停在原處…請按「重新測試」" while the retry was already counting down. The
 * assertion is deliberately equality against the pre-pause line rather than a mere absence check —
 * hiding the banner would also pass an absence check while destroying the operator's "where am I in
 * the plan" context (KI-041 §5.1 option C, rejected).
 */
async function expectStatusRestoredAfterRestart(page: Page, before: string): Promise<void> {
  await expect(protocolStatusLine(page)).toHaveText(before);
  await expect(protocolStatusLine(page)).not.toContainText('重新測試');
}

async function snapshotFrozenGameplay(page: Page): Promise<Pick<Wp69State, 'recording' | 'aim' | 'held' | 'time'>> {
  const state = await readState(page);
  return { recording: state.recording, aim: state.aim, held: state.held, time: state.time };
}

async function exerciseBlockedInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { movementX: 91, movementY: -47, bubbles: true }));
  });
}

function expectFrozen(before: Awaited<ReturnType<typeof snapshotFrozenGameplay>>, after: Awaited<ReturnType<typeof snapshotFrozenGameplay>>): void {
  expect(after.recording.tickCount).toBe(before.recording.tickCount);
  expect(after.recording.eventCount).toBe(before.recording.eventCount);
  expect(after.recording.fireCount).toBe(before.recording.fireCount);
  expect(after.recording.inputSize).toBe(before.recording.inputSize);
  expect(after.recording.ammo).toBe(before.recording.ammo);
  expect(after.aim).toEqual(before.aim);
  expect(after.time.hudElapsedMs).toBe(before.time.hudElapsedMs);
  expect(after.held).toEqual({ left: false, right: false, fire: false, ads: false });
}

test.describe('WP-69 T6 — live pause / invalid / restart lifecycle', () => {
  test('Esc pause, Resume failure/success, invalid diagnostic, fresh Restart, and forced discard @slow', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openStandaloneDrill(page);
    await startRunningWithRealLock(page);

    const initial = await readState(page);
    await pauseThroughRealPointerLockLoss(page);
    const paused = await readState(page);
    expect(paused.attempt).toMatchObject({
      number: initial.attempt.number,
      phase: 'paused',
      validity: 'invalid-paused',
      pauseOccurred: true,
      fenceCount: 1,
    });
    expect(paused.time.mapperPaused).toBe(true);
    await expect(page.locator('#pause-overlay')).toContainText('本次已失去實驗效力');

    const pausedBefore = await snapshotFrozenGameplay(page);
    await exerciseBlockedInput(page);
    await page.waitForTimeout(250);
    expectFrozen(pausedBefore, await snapshotFrozenGameplay(page));

    // Force the browser error event while retaining the actual visible Resume click path.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas === null) throw new Error('canvas not mounted');
      Object.defineProperty(canvas, 'requestPointerLock', {
        configurable: true,
        value: () => {
          document.dispatchEvent(new Event('pointerlockerror'));
          return Promise.reject(new Error('WP-69 forced E2E lock failure'));
        },
      });
    });
    await page.getByRole('button', { name: '繼續（本次仍無效）', exact: true }).click();
    await expect.poll(async () => (await readState(page)).attempt.phase).toBe('paused');
    await expect(page.locator('#pause-overlay').getByRole('status')).toContainText('滑鼠鎖定');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas !== null) delete (canvas as unknown as Record<string, unknown>).requestPointerLock;
    });

    await page.getByRole('button', { name: '繼續（本次仍無效）', exact: true }).click();
    await expect.poll(async () => (await readDrillArmState(page))?.locked ?? false).toBe(true);
    await expect.poll(async () => (await readState(page)).attempt.phase).toBe('resume-countdown');
    const countdownBefore = await snapshotFrozenGameplay(page);
    await exerciseBlockedInput(page);
    await page.waitForTimeout(250);
    expectFrozen(countdownBefore, await snapshotFrozenGameplay(page));

    await expect.poll(async () => (await readState(page)).attempt.phase, { timeout: 10_000 }).toBe('active');
    const resumed = await readState(page);
    expect(resumed.attempt).toMatchObject({ validity: 'invalid-paused', pauseOccurred: true });
    expect(resumed.attempt.lockConfirmationCount).toBe(1);
    expect(resumed.time.mapperPaused).toBe(false);
    expect(resumed.time.excludedWallMs).toBeGreaterThan(0);

    await expect(page.locator('#result-screen')).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('[data-section="result-invalid-attempt"]')).toBeVisible();
    await expect(page.locator('[data-result-action="export-json"]')).toBeHidden();
    await expect(page.locator('[data-result-action="replay"]')).toBeHidden();
    expect(await readDownloads(page)).toHaveLength(0);

    await page.locator('[data-result-action="export-invalid-diagnostic"]').click();
    await expect.poll(async () => (await readDownloads(page)).length).toBe(1);
    const diagnostic = (await readDownloads(page))[0];
    expect(diagnostic.filename).toMatch(/\.invalid-paused\.json$/);
    expect(diagnostic.filename.match(/\.invalid-paused/g)).toHaveLength(1);
    const diagnosticPayload = JSON.parse(diagnostic.content) as {
      meta: { validity: { pauseOccurred: boolean; pointerLockLost: boolean } };
    };
    expect(diagnosticPayload.meta.validity).toMatchObject({ pauseOccurred: true, pointerLockLost: true });

    // Researcher mode intentionally keeps its z=32 control strip over the z=30 Result footer
    // (ResultScreen documents that layout contract). Use that strip's real Restart control; unlike
    // the diagnostic button above, the footer action is not the WP-69 acceptance-critical path.
    await page.locator('#drill-controls').getByRole('button', { name: 'Restart', exact: true }).click();
    await expect.poll(async () => (await readState(page)).attempt.number).toBe(initial.attempt.number + 1);
    const restarted = await readState(page);
    expect(restarted.drill).toEqual(initial.drill);
    // AttemptController is active while DrillRunner is armed; they intentionally model different
    // axes (attempt validity vs. simulation start gate).
    expect(restarted.attempt).toMatchObject({ phase: 'active', validity: 'eligible-candidate', pauseOccurred: false });
    expect((await readDrillArmState(page))?.phase).toBe('armed');
    expect(restarted.recording).toMatchObject({
      tickCount: 0,
      eventCount: 0,
      fireCount: 0,
      hitCount: 0,
      recorderOverflow: false,
      bufferOverflow: 0,
      inputSize: 0,
    });
    await expect(page.locator('#result-screen')).toBeHidden();

    // A second paused attempt whose input integrity is then destroyed must produce no Result and no
    // second download. The synchronous burst blocks rAF long enough to saturate the production ring.
    await startRunningWithRealLock(page);
    await pauseThroughRealPointerLockLoss(page);
    await page.getByRole('button', { name: '繼續（本次仍無效）', exact: true }).click();
    await expect.poll(async () => (await readState(page)).attempt.phase, { timeout: 10_000 }).toBe('active');
    await page.evaluate(() => {
      for (let i = 0; i < 10_000; i += 1) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
      }
    });
    await expect.poll(async () => (await readState(page)).recording.bufferOverflow).toBeGreaterThan(0);
    const overflowCount = (await readState(page)).recording.bufferOverflow;
    await expect(page.locator('#pause-overlay')).toContainText('本次紀錄已作廢', { timeout: 40_000 });
    const discarded = await readState(page);
    expect(discarded.finalizedDisposition).toEqual({ kind: 'discarded', reason: 'pause-attempt-overflow' });
    expect(discarded.recording).toMatchObject({ tickCount: 0, eventCount: 0, fireCount: 0, inputSize: 0 });
    await expect(page.locator('#result-screen')).toBeHidden();
    expect(await readDownloads(page)).toHaveLength(1);

    console.log(
      'WP69_STANDALONE_EVIDENCE',
      JSON.stringify({
        browser: await page.evaluate(() => navigator.userAgent),
        crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
        paused: {
          tickCount: paused.recording.tickCount,
          fireCount: paused.recording.fireCount,
          fenceCount: paused.attempt.fenceCount,
        },
        resumed: {
          excludedWallMs: resumed.time.excludedWallMs,
          lockConfirmationCount: resumed.attempt.lockConfirmationCount,
        },
        restartAttempt: restarted.attempt.number,
        discardOverflow: overflowCount,
        downloads: (await readDownloads(page)).map((entry) => entry.filename),
      }),
    );
  });

  test('Session Plan holds the item on paused Restart; one clean retry advances and exports once @slow', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openApp(page);
    await page.evaluate(async (drillId) => {
      await (
        window as unknown as {
          __fpsTest: { startSessionPlanWithoutGate(participantId: string, selection: unknown): Promise<void> };
        }
      ).__fpsTest.startSessionPlanWithoutGate('wp69-session-e2e', {
        mode: 'custom',
        items: [{ drillId, reps: 1 }],
        drillRestSeconds: 0,
        familyRestSeconds: 0,
      });
    }, TRACKING_DRILL_ID);
    await expect.poll(async () => (await readState(page)).drill.drillId).toBe(TRACKING_DRILL_ID);
    const statusBeforePause = await readProtocolStatusLine(page);
    await startRunningWithRealLock(page);
    await pauseThroughRealPointerLockLoss(page);
    const beforeRestart = await readState(page);
    await restartFromPause(page);
    const held = await readState(page);
    expect(held.session).toMatchObject({ kind: 'run', cursor: 0 });
    expect(held.attempt.number).toBe(beforeRestart.attempt.number + 1);
    expect(await readDownloads(page)).toHaveLength(0);
    await expectStatusRestoredAfterRestart(page, statusBeforePause); // KI-041

    await startRunningWithRealLock(page);
    await expect.poll(async () => String((await readState(page)).session.kind), { timeout: 40_000 }).toBe('done');
    await expect.poll(async () => (await readDownloads(page)).length).toBe(1);
    const official = (await readDownloads(page))[0];
    expect(official.filename).not.toContain('.invalid-paused');
    const payload = JSON.parse(official.content) as { meta: { validity?: { pauseOccurred?: boolean } } };
    expect(payload.meta.validity?.pauseOccurred).toBe(false);
    console.log(
      'WP69_SESSION_EVIDENCE',
      JSON.stringify({ heldCursor: held.session.cursor, retryAttempt: held.attempt.number, downloads: [official.filename] }),
    );
  });

  test('BR Protocol holds its condition on paused Restart; one clean retry advances and exports once @slow', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openApp(page);
    await page.evaluate(async () => {
      await (
        window as unknown as {
          __fpsTest: { startProtocolWithoutGate(participantId: string, protocol: 'br'): Promise<void> };
        }
      ).__fpsTest.startProtocolWithoutGate('wp69-protocol-e2e', 'br');
    });
    await expect.poll(async () => (await readState(page)).protocol.current?.conditionIndex ?? 0).toBe(0);
    const statusBeforePause = await readProtocolStatusLine(page);
    await startRunningWithRealLock(page);
    await pauseThroughRealPointerLockLoss(page);
    await restartFromPause(page);
    const held = await readState(page);
    expect(held.protocol.current?.conditionIndex ?? 0).toBe(0);
    expect(held.protocol.exportCount).toBe(0);
    expect(await readDownloads(page)).toHaveLength(0);
    await expectStatusRestoredAfterRestart(page, statusBeforePause); // KI-041

    await startRunningWithRealLock(page);
    await expect.poll(async () => (await readState(page)).protocol.exportCount, { timeout: 40_000 }).toBe(1);
    await expect.poll(async () => (await readDownloads(page)).length).toBe(1);
    const official = (await readDownloads(page))[0];
    expect(official.filename).not.toContain('.invalid-paused');
    await page.locator('#protocol-status').getByRole('button', { name: '下一條件', exact: true }).click();
    await expect.poll(async () => (await readState(page)).protocol.current?.conditionIndex).toBe(1);
    console.log(
      'WP69_PROTOCOL_EVIDENCE',
      JSON.stringify({ heldCondition: 0, exportCount: 1, advancedCondition: 1, downloads: [official.filename] }),
    );
  });

  test('Tracking Pilot audits a paused Restart at the same block; clean retry records and advances @slow', async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await openApp(page);
    await page.getByRole('button', { name: '研究員模式', exact: true }).click();
    await page.locator('#researcher-menu').getByRole('button', { name: 'Tracking pilot', exact: true }).click();
    const operator = page.locator('#tracking-pilot-operator');
    await operator.locator('input[name="participantId"]').fill('wp69-pilot-e2e');
    await operator.locator('select[name="sessionIndex"]').selectOption('0');
    await operator.locator('input[name="restSeconds"]').fill('0');
    await operator.getByRole('button', { name: 'Start manifest', exact: true }).click();
    await expect(page.locator('#tracking-pilot-status')).toContainText('Block 1/9');
    const statusBeforePause = await readProtocolStatusLine(page);
    await startRunningWithRealLock(page);
    await pauseThroughRealPointerLockLoss(page);
    await restartFromPause(page);
    // KI-041 — the pilot's hold line reaches the same shared element through `onStatus`, so the
    // restore must cover it too. `#tracking-pilot-status` (the operator screen's own line) keeps the
    // hold text on purpose: that screen is the audit surface and is hidden while a block runs.
    await expectStatusRestoredAfterRestart(page, statusBeforePause);
    const held = await readState(page);
    expect(held.pilot?.phase).toMatchObject({ kind: 'running', blockIndex: 0, attempt: 2 });
    expect(held.pilot?.recordCount).toBe(0);
    expect(held.pilot?.invalidAttemptCount).toBe(1);
    expect(held.pilot?.invalidAttempts[0]).toMatchObject({
      blockIndex: 0,
      previousAttempt: 1,
      reason: 'pause-fence-unclosed',
    });
    expect(await readDownloads(page)).toHaveLength(0);

    await startRunningWithRealLock(page);
    await expect(operator).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => (await readState(page)).pilot?.recordCount ?? 0).toBe(1);
    await expect.poll(async () => (await readDownloads(page)).length).toBe(1);
    const completed = await readState(page);
    expect(completed.pilot?.phase).toMatchObject({ kind: 'block-outcome', blockIndex: 0, attempt: 2 });
    const official = (await readDownloads(page))[0];
    expect(official.filename).not.toContain('.invalid-paused');
    await operator.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(async () => (await readState(page)).pilot?.phase).toMatchObject({
      kind: 'running',
      blockIndex: 1,
      attempt: 1,
    });
    console.log(
      'WP69_PILOT_EVIDENCE',
      JSON.stringify({ invalidAttempts: held.pilot?.invalidAttempts, recordCount: 1, downloads: [official.filename] }),
    );
  });
});
