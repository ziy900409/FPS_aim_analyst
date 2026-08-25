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
    await expect(primaryButtons).toHaveCount(2);
    await expect(primaryButtons.nth(0)).toHaveText('選手測試 Session');
    await expect(primaryButtons.nth(1)).toHaveText('研究員模式');
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

  test('Session Plan 真實 DOM 接線：按鈕 → 表單 → 家族勾選/preset 選單（無自由數字輸入）→ eligibility gate', async ({
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

    // FR-G9①：家族子集自由勾選——四個家族（TEST_FAMILY_IDS）皆渲染、預設全選。
    const familyCheckboxes = planSetup.locator('input[name="sessionFamily"]');
    await expect(familyCheckboxes).toHaveCount(4);
    for (let i = 0; i < 4; i++) await expect(familyCheckboxes.nth(i)).toBeChecked();

    // FR-G9②：preset 只能選既有具名常數，UI 不得渲染任何自由數字輸入框。
    const presetSelect = planSetup.locator('select[name="sessionPlanPreset"]');
    await expect(presetSelect).toHaveValue('pilot-default');
    await expect(planSetup.locator('input[type="number"]')).toHaveCount(0);

    await planSetup.locator('button[type="submit"]').click();

    // SessionPlanSetup onSubmit → eligibilityGateScreen.open()（main.ts:327-330）。真人 pointer
    // lock/fullscreen 正向路徑起始於此，留待既有慣例的人工驗收，不在本測試繼續往下走。
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });
});
