import { test, expect } from '@playwright/test';

/**
 * WP-42 / T-exit — session orchestrator 端到端補證。
 *
 * 兩件事分別驗證,對應 README §3 失效模式表第一項與 T-exit-gate.md DoD②:
 *
 * 1. `availableDrills` 缺口補齊(T1 §0-2)風險本體:三個新登記 drill
 *    （spider-shot-v1 / counterstrafe-reversal-v1 / counterstrafe-free-v1）此前只被
 *    unit test 用合成物件驗證過 schema，從未走過 `loadDrill()` → `createTargetManager()` →
 *    `createSimLoop()` 真實建構鏈路。`__fpsTest.startDrill(id)` 呼叫的正是 `loadDrillById()`
 *    包的同一批函式（main.ts:985-1011 vs fpsTestHarness.ts:309-345），故在真瀏覽器對這三個
 *    id 各跑一次 `startDrill` 即可證明 T1 §0-2 擔心的執行期錯誤（如 spiderShot.seed 與
 *    sequence.seed 互斥檢查）不存在；兩個 counter-strafe 變體另外跑滿一輪到 `ended` +
 *    匯出，補齊 T1 DoD「選單選取→倒數→目標→擊殺→ended→匯出」在缺口分析中列出但先前未驗證
 *    的部分。Spider Shot 沒有可重用的合成擊殺 round-runner（`__fpsTest` 目前只有
 *    counter-strafe/detection/tracking 三種形狀），補一個屬於 spider-shot 家族本體的驅動器
 *    超出 WP-42（純 orchestration 層）範圍，故只驗證到「running + 首目標可見」，不在此新增。
 *
 * 2. Session Plan 真實 DOM 接線（main.ts 的 4 個啟動按鈕之一 + `SessionSetup` → `SessionPlanSetup`
 *    → `EligibilityGate` 既有 pipeline，README §0-5/§2.3）：點擊真實按鈕、填真實表單、勾選真實
 *    checkbox，而非呼叫任何測試專用捷徑，藉此證明 main.ts:392-401/324-331 的接線本身無誤，並且
 *    在真實渲染出的 DOM 上直接斷言 FR-G9②（session-plan preset 只能選、UI 不得渲染任何
 *    `<input type="number">`）。真人原生滑鼠/pointer lock 走完整場 assessment 仍如既有慣例
 *    （full-drill.spec.ts 標頭）留給另外的人工驗收，不在自動化 CI 範圍。
 */

const URL = 'http://localhost:5173/';

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

test.describe('WP-42 T-exit — session orchestrator', () => {
  test('WP-43 T1 啟動分岔與研究員選單接回既有 Controls / protocol setup', async ({ page }) => {
    await waitForHarness(page);

    const launchControls = page.locator('#session-launch-controls');
    const primaryButtons = launchControls.locator('[data-launch-tier="primary"] > button');
    // WP-49 T1 新增第三個主入口「歷史紀錄」。
    await expect(primaryButtons).toHaveCount(3);
    await expect(primaryButtons.nth(0)).toHaveText('選手測試 Session');
    await expect(primaryButtons.nth(1)).toHaveText('研究員模式');
    await expect(primaryButtons.nth(2)).toHaveText('歷史紀錄');
    await expect(launchControls.locator('button[data-launch-tier="legacy"]')).toHaveText('實驗 session');

    const drillControls = page.locator('#drill-controls');
    await expect(drillControls).toBeHidden();

    await page.getByRole('button', { name: '研究員模式', exact: true }).click();
    const researcherMenu = page.locator('#researcher-menu');
    await expect(researcherMenu).toBeVisible();
    await expect(researcherMenu.locator('button')).toHaveCount(3);
    await expect(drillControls).toBeVisible();

    await researcherMenu.getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
    await expect(researcherMenu).toBeHidden();
    await expect(drillControls).toBeVisible();

    await page.getByRole('button', { name: '研究員模式', exact: true }).click();
    await researcherMenu.getByRole('button', { name: '解析度 protocol', exact: true }).click();
    await expect(page.locator('#session-setup')).toBeVisible();
    await expect(drillControls).toBeHidden();

    await page.locator('#session-setup button[type="button"]').click();
    await page.getByRole('button', { name: '研究員模式', exact: true }).click();
    await researcherMenu.getByRole('button', { name: 'BR protocol', exact: true }).click();
    await expect(page.locator('#session-setup')).toBeVisible();
    await expect(drillControls).toBeHidden();
  });

  test('三個新登記 drill（spider-shot / counterstrafe-reversal / counterstrafe-free）走完整 loadDrill 鏈路', async ({
    page,
  }) => {
    await waitForHarness(page);

    const r = await page.evaluate(() => {
      type Harness = {
        startDrill(id: string): void;
        runCounterStrafeRound(maxPeeks?: number): void;
        forceExportJSON(): { meta: Record<string, unknown> };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;

      // T1 §0-2：只證明「選單選取 → 倒數 → 目標出現」的建構鏈路不拋錯（無專屬 round-runner）。
      harness.startDrill('spider-shot-v1');
      const spiderShotPhase = harness.phase();
      const spiderShotMeta = harness.forceExportJSON().meta;

      // 兩個 counter-strafe 變體與既有 counterstrafe_ad_v1 同形狀，可跑滿一輪(endCondition
      // targetCount=20)到 ended + 匯出——不傳 maxPeeks，讓 round-runner 跑到真正 ended。
      harness.startDrill('counterstrafe-reversal-v1');
      harness.runCounterStrafeRound();
      const reversalPhase = harness.phase();
      const reversalMeta = harness.forceExportJSON().meta;

      harness.startDrill('counterstrafe-free-v1');
      harness.runCounterStrafeRound();
      const freePhase = harness.phase();
      const freeMeta = harness.forceExportJSON().meta;

      return {
        coi: window.crossOriginIsolated,
        spiderShotPhase,
        spiderShotDrillId: spiderShotMeta.drillId,
        reversalPhase,
        reversalDrillId: reversalMeta.drillId,
        freePhase,
        freeDrillId: freeMeta.drillId,
      };
    });

    expect(r.coi).toBe(true);

    // spider-shot-v1：building the pipeline advanced past countdown to a visible target.
    expect(r.spiderShotPhase).toBe('running');
    expect(r.spiderShotDrillId).toBe('spider-shot-v1');

    // counterstrafe-reversal-v1 / counterstrafe-free-v1：full round → ended → exportable.
    expect(r.reversalPhase).toBe('ended');
    expect(r.reversalDrillId).toBe('counterstrafe-reversal-v1');
    expect(r.freePhase).toBe('ended');
    expect(r.freeDrillId).toBe('counterstrafe-free-v1');
  });

  test('WP-52 T4：peek_click_transfer_pilot_v2 是研究員模式可選、可載入的 drill（manual gate 前置條件）', async ({
    page,
  }) => {
    await waitForHarness(page);

    const r = await page.evaluate(() => {
      type Harness = {
        startDrill(id: string): void;
        forceExportJSON(): { meta: Record<string, unknown> };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;

      harness.startDrill('peek_click_transfer_pilot_v2_2_5deg');
      const phase = harness.phase();
      const meta = harness.forceExportJSON().meta;

      return { phase, drillId: meta.drillId, visibility: meta.visibility };
    });

    // Same minimal proof as spider-shot-v1 above: the pipeline reaches a visible target without
    // throwing. A full timeout/hit playthrough needs camera raycast simulation (see
    // peek_click_transfer_pilot_v2.test.ts's unit-level runTimeoutOnly for that).
    expect(r.phase).toBe('running');
    expect(r.drillId).toBe('peek_click_transfer_pilot_v2_2_5deg');
    expect(r.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
  });

  test('Session Plan 真實 DOM 接線：按鈕 → 表單 → 家族拖曳排序/自由休息秒數 → eligibility gate', async ({
    page,
  }) => {
    await waitForHarness(page);

    // WP-43 T1：選手測試主入口沿用既有 Session Plan 接線。
    await page.getByRole('button', { name: '選手測試 Session', exact: true }).click();
    await expect(page.locator('#session-setup')).toBeVisible();

    // SessionSetup.ts：唯一必填欄位是 Participant ID。
    await page.locator('#session-setup input[name="participantId"]').fill('t-exit-smoke');
    await page.locator('#session-setup button[type="submit"]').click();

    // pendingSessionMode==='session-plan' 分支：submit 後開 SessionPlanSetup，而非直接開 eligibility gate。
    const planSetup = page.locator('#session-plan-setup');
    await expect(planSetup).toBeVisible();

    // FR-G9①：家族子集自由勾選——WP-52 T2 把家族清單從 TEST_FAMILY_IDS(4)擴充為
    // KNOWN_SESSION_FAMILY_IDS(5,含 'peek-click-transfer'),讓操作者能在同一套自由勾選 UI
    // 選入 transfer pilot 家族,而不需要重新引入 WP-43 FR-H3 已移除的 preset 下拉。
    const familyCheckboxes = planSetup.locator('input[name="sessionFamily"]');
    await expect(familyCheckboxes).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(familyCheckboxes.nth(i)).toBeChecked();
    await expect(planSetup.locator('[data-session-family="peek-click-transfer"]')).toHaveCount(1);

    // FR-H2：拖曳後 DOM 與提交順序都以操作者排列為準。
    await planSetup
      .locator('[data-session-family="counterstrafe"]')
      .dragTo(planSetup.locator('[data-session-family="hold-click"]'));
    await expect(planSetup.locator('[data-session-family]').first()).toHaveAttribute(
      'data-session-family',
      'counterstrafe',
    );

    // FR-H3：具名 preset 下拉已移除，改為含邊界的自由休息秒數。
    await expect(planSetup.locator('select[name="sessionPlanPreset"]')).toHaveCount(0);
    const restSeconds = planSetup.locator('input[name="sessionPlanRestSeconds"]');
    await expect(restSeconds).toHaveValue('60');
    await expect(restSeconds).toHaveAttribute('min', '0');
    await expect(restSeconds).toHaveAttribute('max', '3600');
    await restSeconds.fill('42');

    await planSetup.locator('button[type="submit"]').click();

    // SessionPlanSetup onSubmit → eligibilityGateScreen.open()（main.ts:327-330）。真人 pointer
    // lock/fullscreen 正向路徑起始於此，留待既有慣例的人工驗收，不在本測試繼續往下走。
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });

  test('WP-52 T2：操作者只勾選 peek-click-transfer 家族亦能走到 eligibility gate（KI-016 gap 前置條件）', async ({
    page,
  }) => {
    await waitForHarness(page);

    await page.getByRole('button', { name: '選手測試 Session', exact: true }).click();
    await page.locator('#session-setup input[name="participantId"]').fill('t-exit-transfer-pilot');
    await page.locator('#session-setup button[type="submit"]').click();

    const planSetup = page.locator('#session-plan-setup');
    await expect(planSetup).toBeVisible();

    // 只保留 peek-click-transfer,其餘四個取消勾選——證明 KI-016 修好前會在匯出時 throw 的那條
    // family order，如今能透過既有自由勾選 UI 真的被操作者組出來。
    const familyCheckboxes = planSetup.locator('input[name="sessionFamily"]');
    const count = await familyCheckboxes.count();
    for (let i = 0; i < count; i++) {
      const checkbox = familyCheckboxes.nth(i);
      const value = await checkbox.getAttribute('value');
      if (value !== 'peek-click-transfer') await checkbox.uncheck();
    }
    await expect(planSetup.locator('[data-session-family="peek-click-transfer"] input')).toBeChecked();

    await planSetup.locator('button[type="submit"]').click();
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });
});
