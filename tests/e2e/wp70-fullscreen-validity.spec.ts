import { expect, test, type Page } from '@playwright/test';
import { armAndWaitRunning, armDrill, installAutoArm, readDrillArmState } from './support/arm.ts';

/**
 * WP-70 / T5 — the fullscreen validity lifecycle, in a real browser.
 *
 * ## Why this file exists (KI-040 §5)
 *
 * WP-69 shipped 119 green e2e and still missed KI-040, because **every** Session Plan e2e enters
 * through `__fpsTest.startSessionPlanWithoutGate()` and therefore **never enters fullscreen at
 * all**. A suite that never holds the condition cannot observe the condition being lost, so a
 * session-sticky `suspect` that never resets was invisible to all of it. This file is the one place
 * that actually takes real fullscreen, loses it mid-recording, and then proves the *next* run is
 * clean — which is the whole of FR-70.1.
 *
 * ⚠️ **The blind spot is still there for every other spec.** `startSessionPlanWithoutGate()` /
 * `startProtocolWithoutGate()` run the genuine eligibility gate and hand its genuine (failing)
 * report to `experimentSession.enter()` — they fabricate no pass — but they enter a session from a
 * page that is **not** in fullscreen. Nothing those seams drive says anything about fullscreen
 * validity. If you add fullscreen-sensitive behaviour, cover it here, not there.
 *
 * ## How fullscreen is obtained, and what is measured rather than assumed
 *
 * Fullscreen is taken through the **production** control: the eligibility gate's
 * 「進入 fullscreen 並開始」 button, clicked by Playwright. The gate then measures this environment
 * and **refuses** it, and its own rendered report is what says so (T0.7, re-measured on every run
 * of this file):
 *
 * ```
 * native:     FAIL — 原生 1280×720（screen 1280×720 × dpr 1) vs 需求 1920×1080
 * fullscreen: PASS — document.fullscreenElement 存在
 * perf:       FAIL — warmup p95 12.25ms vs 地板 8.33ms      (PERF_FLOOR_MS is a 120 Hz floor)
 * ```
 *
 * `fullscreen: PASS` in that report is the point: the **product**, not the test, observed a real
 * `document.fullscreenElement`. The refusal is why the run itself still has to start through the
 * documented seam — the gate cannot be passed by automation, and pretending otherwise would be the
 * fabrication this file exists to avoid.
 *
 * ⚠️ **Only the `native` line may be asserted as the refusal reason.** The `perf` line is a live
 * measurement of the host and swings across runs — the full-suite run that first exercised this
 * file measured `15.02ms` for one gate and `4.36ms` (a **PASS**) for another, minutes apart. So the
 * refusal is anchored on the one check this environment cannot pass by construction: the headless
 * `screen` is 1280×720, below every requirement on the roster. `assertGateIsRefusableHere()` pins
 * that precondition explicitly so a different host fails with a legible message instead of a
 * confusing one.
 *
 * ## Named limits of this file (do not overclaim it)
 *
 * - **L1 (T0 / D-70-T0-4) — FM-70.4 is NOT covered here.** Playwright's `page.evaluate()` carries
 *   user activation in this environment (T0 spikes C/D), so an implementation that moved
 *   `requestFullscreen()` after the first `await` would still pass every assertion below. The guard
 *   for FM-70.4 is T4's source-scan (`ConditionRecoveryScreen.test.ts`) plus manual on-hardware
 *   verification. A green run of this file is **not** evidence for it.
 * - **L2 (T0) — nothing here may assert window size.** Headless reports
 *   `innerHeight === screen.height === 720` both in and out of fullscreen; a size assertion would
 *   pass or fail for the wrong reason. Assertions hang on `fullscreenchange` / `fullscreenElement`.
 * - **L3 (T0 / S-70-T0-2) — waits hang on the event log, not on `fullscreenElement`**, because the
 *   exit `fullscreenchange` fires asynchronously with respect to the property flipping to null.
 * - **L4 (T5, measured here) — `meta.suspect === false` cannot be *pinned* for the clean run.** The
 *   perf-floor half of `suspect` is outside this file's control and swings with host load: two full
 *   runs of this file measured warmup p95 at `15.02 ms` (floor breached, `perfFloor: true`,
 *   `suspect: true`) and at `5.01 ms` (floor met, `perfFloor: false`, and the clean run's
 *   **`suspect` really was `false`**). So "the next run is clean" is asserted the way FR-70.2 made
 *   possible, in the one form true under both: the next run's `meta.validity.fullscreenExited` is
 *   `false`, every other non-perf validity flag is `false`, and `meta.suspect` is therefore
 *   **identical to `meta.validity.perfFloor`** — an identity, never a pinned constant. The
 *   fullscreen component is gone, and the payload names the component that remains. Before WP-70
 *   the second run inherited a session-sticky fullscreen `suspect` with no way to tell them apart.
 *   The corollary is that **FM-70.1 is not *reliably* guarded here**: on a host that breaches the
 *   perf floor, `collectMeta()` ORing `experimentSession.suspect` back in would be masked by
 *   `perfFloor: true` and every assertion below would still pass. That failure mode's dependable
 *   guard is T1's source-scan; this file catches it only when the host is fast enough.
 * - **L5 (T5, measured here) — `document.exitFullscreen()` does not release Pointer Lock in
 *   Chromium**; the run stays `running`. The recovery test therefore drops fullscreen and then
 *   Pointer Lock as two real transitions — the same pair Esc / alt-tab produces for an operator —
 *   rather than pretending one implies the other.
 */

const APP_URL = 'http://localhost:5173/';
/** Shortest self-terminating scene-pinned drill on the roster (~23 s), per session-orchestrator.spec.ts. */
const TRACKING_DRILL_ID = 'tracking_scene_v1';
const SUSPECT_BANNER = '⚠ 已離開 fullscreen';

interface CapturedDownload {
  filename: string;
  content: string;
}

interface ExportedValidity {
  readonly corridorExceeded: boolean;
  readonly perfFloor: boolean;
  readonly recorderOverflow: boolean;
  readonly bufferOverflow: boolean;
  readonly pointerLockLost: boolean;
  readonly pauseOccurred: boolean;
  readonly fullscreenExited: boolean;
}

interface ExportedMeta {
  readonly suspect: boolean;
  readonly sessionPlanRepIndex?: number;
  readonly validity: ExportedValidity;
}

/** Same anchor-click interception WP-69 T6 uses: the app revokes blob URLs immediately. */
const INSTALL_DOWNLOAD_CAPTURE = (): void => {
  const blobs = new Map<string, Blob>();
  const captures: CapturedDownload[] = [];
  let serial = 0;
  const nativeCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob: Blob | MediaSource): string => {
    if (!(blob instanceof Blob)) return nativeCreate(blob);
    const url = `blob:wp70-e2e/${serial++}`;
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
  (window as unknown as { __wp70Downloads: CapturedDownload[] }).__wp70Downloads = captures;
};

/**
 * L3 — the authoritative record of what the browser actually did. `fullscreenElement` is polled
 * state; this is the event the product's own handler is wired to, in order.
 */
const INSTALL_FULLSCREEN_LOG = (): void => {
  const log: string[] = [];
  (window as unknown as { __wp70FullscreenLog: string[] }).__wp70FullscreenLog = log;
  document.addEventListener('fullscreenchange', () => {
    log.push(document.fullscreenElement != null ? 'enter' : 'exit');
  });
};

async function openApp(page: Page): Promise<void> {
  await page.route('**/@vite/client', (route) => route.abort());
  await page.addInitScript(INSTALL_DOWNLOAD_CAPTURE);
  await page.addInitScript(INSTALL_FULLSCREEN_LOG);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 20_000,
    })
    .toBe(true);
}

async function readDownloads(page: Page): Promise<CapturedDownload[]> {
  return page.evaluate(() =>
    [...(window as unknown as { __wp70Downloads: CapturedDownload[] }).__wp70Downloads].map((entry) => ({ ...entry })),
  );
}

async function readFullscreenLog(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { __wp70FullscreenLog: string[] }).__wp70FullscreenLog]);
}

async function readRunFlag(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window as unknown as { __aimDebug: { state: { validity: { fullscreenExitedDuringRun: boolean } } } }).__aimDebug
        .state.validity.fullscreenExitedDuringRun,
  );
}

async function readSessionCursor(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() =>
    (window as unknown as { __fpsTest: { sessionPlanState(): Record<string, unknown> } }).__fpsTest.sessionPlanState(),
  );
}

async function readAttemptNumber(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __fpsTest: { wp69State(): { attempt: { number: number } } } }).__fpsTest.wp69State()
        .attempt.number,
  );
}

function metaOf(download: CapturedDownload): ExportedMeta {
  return (JSON.parse(download.content) as { meta: ExportedMeta }).meta;
}

/**
 * Named precondition, not an incidental assumption: every gate in this file is expected to
 * **refuse**, and the only check that cannot pass here by construction is `native`. Pin it once, so
 * a host whose `screen` clears 1920×1080 fails on this line — where the reason is written down —
 * rather than somewhere downstream where a gate unexpectedly *passed* and entered a real session.
 */
async function assertGateIsRefusableHere(page: Page): Promise<void> {
  const nativePixels = await page.evaluate(() => ({
    w: Math.round(screen.width * devicePixelRatio),
    h: Math.round(screen.height * devicePixelRatio),
  }));
  expect(
    nativePixels.w < 1920 || nativePixels.h < 1080,
    `WP-70 T5 assumes a host below SESSION_PLAN_MIN_CONDITION so every gate refuses; got ${nativePixels.w}×${nativePixels.h}`,
  ).toBe(true);
}

/**
 * Segment 1 of the chain — take **real** fullscreen through the production eligibility-gate button,
 * and read the gate's own verdict back. Leaves the page in fullscreen with the refused gate closed.
 */
async function takeRealFullscreenThroughTheGate(page: Page, participantId: string): Promise<string> {
  await page.getByRole('button', { name: '選手測試 Session', exact: true }).click();
  await expect(page.locator('#session-setup')).toBeVisible();
  await page.locator('#session-setup input[name="participantId"]').fill(participantId);
  await page.locator('#session-setup button[type="submit"]').click();
  const planSetup = page.locator('#session-plan-setup');
  await expect(planSetup).toBeVisible();
  await planSetup.locator('button[type="submit"]').click();
  await expect(page.locator('#eligibility-gate')).toBeVisible();

  await page.getByRole('button', { name: '進入 fullscreen 並開始', exact: true }).click();
  await expect.poll(async () => readFullscreenLog(page), { timeout: 20_000 }).toEqual(['enter']);
  expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(true);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  // The product's own gate report — not the test — is what certifies the fullscreen is real.
  const report = page.locator('#eligibility-gate pre');
  await expect(report).toBeVisible({ timeout: 20_000 });
  const details = (await report.textContent()) ?? '';
  expect(details).toContain('fullscreen: PASS — document.fullscreenElement 存在');
  // …and the same report is why the run below cannot start through the gate. `native` is the
  // refusal this host cannot escape; `perf` is a live measurement and must never be pinned.
  expect(details).toContain('native:     FAIL');
  await expect(page.locator('#eligibility-gate')).toBeVisible();
  await expect(page.getByRole('button', { name: '重試', exact: true })).toBeVisible();

  // Closing the refused gate does not drop fullscreen: the log still ends at 'enter'.
  await page.locator('#eligibility-gate').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('#eligibility-gate')).toBeHidden();
  expect(await readFullscreenLog(page)).toEqual(['enter']);
  return details;
}

test.describe('WP-70 T5 — fullscreen validity lifecycle', () => {
  test('a run that loses fullscreen is flagged and the next run in fullscreen is clean @slow', async ({ page }) => {
    test.setTimeout(180_000);
    await openApp(page);
    await assertGateIsRefusableHere(page);

    // ---- Segment 1: really enter fullscreen ----------------------------------------------------
    const gateDetails = await takeRealFullscreenThroughTheGate(page, 'wp70-session-e2e');

    // The app's own boot drill is armed explicitly before the watchdog, so `armCount` measures
    // exactly the plan's blocks (session-orchestrator.spec.ts documents this).
    await armDrill(page);
    const armCount = await installAutoArm(page);
    await page.evaluate(async (drillId) => {
      await (
        window as unknown as {
          __fpsTest: { startSessionPlanWithoutGate(participantId: string, selection: unknown): Promise<void> };
        }
      ).__fpsTest.startSessionPlanWithoutGate('wp70-session-e2e', {
        mode: 'custom',
        items: [{ drillId, reps: 2 }],
        // A rest step between the two reps is what gives an operator — and this test — a window to
        // put the display back before the next recording window opens.
        drillRestSeconds: 6,
        familyRestSeconds: 0,
      });
    }, TRACKING_DRILL_ID);

    // ---- Segment 2: lose fullscreen inside rep 1's recording window ----------------------------
    await expect.poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 40_000 }).toBe('running');
    expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(true);
    expect(await readRunFlag(page)).toBe(false);

    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(async () => readFullscreenLog(page), { timeout: 10_000 }).toEqual(['enter', 'exit']);
    expect(await readRunFlag(page)).toBe(true);
    await expect(page.getByText(SUSPECT_BANNER)).toBeVisible();
    // L5 — dropping fullscreen alone does not drop Pointer Lock, so rep 1 keeps recording and
    // reaches its own export. That export is the thing FR-70.2 is about.
    expect((await readDrillArmState(page))?.phase ?? null).toBe('running');

    await expect.poll(async () => (await readDownloads(page)).length, { timeout: 60_000 }).toBe(1);
    const flaggedMeta = metaOf((await readDownloads(page))[0]);
    expect(flaggedMeta.sessionPlanRepIndex).toBe(0);
    expect(flaggedMeta.validity.fullscreenExited).toBe(true);
    expect(flaggedMeta.suspect).toBe(true);

    // ---- Segment 4: the next run, entirely in fullscreen, is clean -----------------------------
    // Environment step, not a production-path claim: no production control re-enters fullscreen
    // outside the gate and the recovery screen, and the recovery screen's own re-entry is asserted
    // by the second test. What is under test here is only what the *next* run's payload says.
    await page.evaluate(() => document.documentElement.requestFullscreen());
    await expect
      .poll(async () => readFullscreenLog(page), { timeout: 10_000 })
      .toEqual(['enter', 'exit', 'enter']);

    await expect.poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 60_000 }).toBe('running');
    expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(true);
    // FR-70.1, live: the flag the previous run raised is gone at the start of this one.
    expect(await readRunFlag(page)).toBe(false);
    await expect(page.getByText(SUSPECT_BANNER)).toBeHidden();

    await expect.poll(async () => (await readDownloads(page)).length, { timeout: 60_000 }).toBe(2);
    const cleanMeta = metaOf((await readDownloads(page))[1]);
    expect(cleanMeta.sessionPlanRepIndex).toBe(1);
    // ⭐ The live disproof of KI-040 defect A. Before WP-70 this inherited rep 1's sticky suspect.
    expect(cleanMeta.validity.fullscreenExited).toBe(false);
    // L4 — `suspect` cannot be false under automation, so state exactly what is left of it: every
    // non-perf validity component is clear, and `suspect` is therefore the perf floor and nothing
    // else. That identity is only checkable because FR-70.2 made the components nameable.
    expect(cleanMeta.validity).toMatchObject({
      fullscreenExited: false,
      pointerLockLost: false,
      pauseOccurred: false,
      corridorExceeded: false,
      recorderOverflow: false,
      bufferOverflow: false,
    });
    expect(cleanMeta.suspect).toBe(cleanMeta.validity.perfFloor);

    // The browser never left fullscreen again after rep 2 opened.
    expect(await readFullscreenLog(page)).toEqual(['enter', 'exit', 'enter']);
    expect(await armCount()).toBe(2);

    console.log(
      'WP70_SESSION_EVIDENCE',
      JSON.stringify({
        browser: await page.evaluate(() => navigator.userAgent),
        crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
        gateDetails,
        fullscreenLog: await readFullscreenLog(page),
        flagged: {
          repIndex: flaggedMeta.sessionPlanRepIndex,
          validity: flaggedMeta.validity,
          suspect: flaggedMeta.suspect,
        },
        clean: { repIndex: cleanMeta.sessionPlanRepIndex, validity: cleanMeta.validity, suspect: cleanMeta.suspect },
        downloads: (await readDownloads(page)).map((entry) => entry.filename),
      }),
    );
  });

  test('condition recovery re-enters fullscreen without advancing the session @slow', async ({ page }) => {
    test.setTimeout(150_000);
    await openApp(page);
    await assertGateIsRefusableHere(page);

    // ---- Segment 1 -----------------------------------------------------------------------------
    await takeRealFullscreenThroughTheGate(page, 'wp70-recovery-e2e');
    await armDrill(page);
    await page.evaluate(async (drillId) => {
      await (
        window as unknown as {
          __fpsTest: { startSessionPlanWithoutGate(participantId: string, selection: unknown): Promise<void> };
        }
      ).__fpsTest.startSessionPlanWithoutGate('wp70-recovery-e2e', {
        mode: 'custom',
        items: [{ drillId, reps: 2 }],
        drillRestSeconds: 0,
        familyRestSeconds: 0,
      });
    }, TRACKING_DRILL_ID);
    await expect.poll(async () => String((await readSessionCursor(page)).phase), { timeout: 30_000 }).toBe('run');
    await armAndWaitRunning(page);

    // ---- Segment 2, with a real Pointer Lock so the pause path is the production one ------------
    await page.locator('canvas').click({ position: { x: 400, y: 300 }, force: true });
    await expect.poll(async () => (await readDrillArmState(page))?.locked ?? null, { timeout: 10_000 }).toBe(true);

    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(async () => readFullscreenLog(page), { timeout: 10_000 }).toEqual(['enter', 'exit']);
    expect(await readRunFlag(page)).toBe(true);
    await expect(page.getByText(SUSPECT_BANNER)).toBeVisible();
    // L5 — the second half of what Esc / alt-tab does to an operator.
    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#pause-overlay')).toBeVisible({ timeout: 10_000 });

    const cursorBefore = await readSessionCursor(page);
    const attemptBefore = await readAttemptNumber(page);
    expect(cursorBefore).toMatchObject({ phase: 'run', itemIndex: 0, repIndex: 0 });
    expect(await readDownloads(page)).toHaveLength(0);

    // ---- Segment 3: recovery re-enters fullscreen and refuses to advance ------------------------
    // FR-70.8 — a fullscreen-invalid run's Restart opens condition recovery instead of restarting.
    await page.locator('#pause-overlay').getByRole('button', { name: '重新測試', exact: true }).click();
    const recovery = page.locator('#condition-recovery-screen');
    await expect(recovery).toBeVisible();
    expect(await readAttemptNumber(page)).toBe(attemptBefore);

    await recovery.getByRole('button', { name: '重新進入 fullscreen', exact: true }).click();
    // Real fullscreen, re-acquired through the production recovery control.
    await expect
      .poll(async () => readFullscreenLog(page), { timeout: 20_000 })
      .toEqual(['enter', 'exit', 'enter']);
    expect(await page.evaluate(() => document.fullscreenElement != null)).toBe(true);

    const recoveryReport = recovery.locator('pre');
    await expect(recoveryReport).toBeVisible({ timeout: 20_000 });
    const recoveryDetails = (await recoveryReport.textContent()) ?? '';
    expect(recoveryDetails).toContain('fullscreen: PASS — document.fullscreenElement 存在');
    // As at the entry gate: `native` is the refusal, `perf` is a live measurement (it read PASS at
    // 4.36 ms on the first full-suite run of this file) and is deliberately not asserted.
    expect(recoveryDetails).toContain('native:     FAIL');

    // FR-70.9 / FR-70.10 — a failed recovery stays put, names the reason, offers a retry, and moves
    // nothing: no restart, no cursor change, no export, no download, no Result.
    await expect(recovery.getByRole('status')).toHaveText('條件仍未通過，請修正後重試。');
    await expect(recovery.getByRole('button', { name: '重試條件檢查', exact: true })).toBeEnabled();
    await expect(recovery).toBeVisible();
    expect(await readSessionCursor(page)).toEqual(cursorBefore);
    expect(await readAttemptNumber(page)).toBe(attemptBefore);
    expect(await readDownloads(page)).toHaveLength(0);
    expect(await readRunFlag(page)).toBe(true);
    await expect(page.locator('#result-screen')).toBeHidden();

    console.log(
      'WP70_RECOVERY_EVIDENCE',
      JSON.stringify({
        browser: await page.evaluate(() => navigator.userAgent),
        crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
        fullscreenLog: await readFullscreenLog(page),
        recoveryDetails,
        cursor: cursorBefore,
        attempt: attemptBefore,
        downloads: (await readDownloads(page)).length,
      }),
    );
  });
});
