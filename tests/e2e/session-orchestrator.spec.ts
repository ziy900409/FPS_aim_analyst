import { test, expect, type Page } from '@playwright/test';

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
 *
 * 3. WP-58 T6 — 自訂 session program 軌（同一個 Session Plan 表單的第二條路徑）。刻意**擴充本檔而
 *    非新開平行 spec**（T6 步驟 1 / R-58.9 的緩解）：兩軌共用同一個 `#session-plan-setup`、同一個
 *    `button[type=submit]` 與同一條 eligibility 路徑，拆成兩個檔案只會讓「frozen 是否被改壞」失去
 *    對照。真瀏覽器在此新增的證據是**渲染出來的預覽表**——編譯器輸出逐 step 落到 DOM 屬性
 *    （`data-program-step` / `data-step-boundary` / `data-step-next-drill-id`），因此「UI 偷算一套
 *    休息模型」在真實 DOM 上會直接紅燈；以及非法輸入時提交確實被禁用（FR-58.7/58.13）。
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
    // WP-54 T6 新增第四個研究員入口「Tracking pilot」（tracking pilot manifest operator screen）。
    await expect(researcherMenu.locator('button')).toHaveCount(4);
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

  test('WP-52 T5：peek_click_transfer_pilot_v2_randomized 是研究員模式可選、可載入的 drill', async ({ page }) => {
    await waitForHarness(page);

    const r = await page.evaluate(() => {
      type Harness = {
        startDrill(id: string): void;
        forceExportJSON(): { meta: Record<string, unknown> };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;

      harness.startDrill('peek_click_transfer_pilot_v2_randomized');
      const phase = harness.phase();
      const meta = harness.forceExportJSON().meta;

      return { phase, drillId: meta.drillId, visibility: meta.visibility };
    });

    expect(r.phase).toBe('running');
    expect(r.drillId).toBe('peek_click_transfer_pilot_v2_randomized');
    expect(r.visibility).toEqual({ sampleCount: 9, onsetThreshold: 0.5 });
  });

  test('WP-52 T5：v2 的 1°/5° 個別候選也各自可選、可載入（不只 2.5° 預設）', async ({ page }) => {
    await waitForHarness(page);

    const r = await page.evaluate(() => {
      type Harness = {
        startDrill(id: string): void;
        forceExportJSON(): { meta: Record<string, unknown> };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;

      harness.startDrill('peek_click_transfer_pilot_v2_1deg');
      const oneDegPhase = harness.phase();
      const oneDegDrillId = harness.forceExportJSON().meta.drillId;

      harness.startDrill('peek_click_transfer_pilot_v2_5deg');
      const fiveDegPhase = harness.phase();
      const fiveDegDrillId = harness.forceExportJSON().meta.drillId;

      return { oneDegPhase, oneDegDrillId, fiveDegPhase, fiveDegDrillId };
    });

    expect(r.oneDegPhase).toBe('running');
    expect(r.oneDegDrillId).toBe('peek_click_transfer_pilot_v2_1deg');
    expect(r.fiveDegPhase).toBe('running');
    expect(r.fiveDegDrillId).toBe('peek_click_transfer_pilot_v2_5deg');
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
    // KNOWN_SESSION_FAMILY_IDS(6,含 pilot 'peek-click-transfer' 與 WP-53 T4 formal
    // 'peek-click-transfer-v1'),讓操作者能在同一套自由勾選 UI 選入 transfer 家族,而不需要
    // 重新引入 WP-43 FR-H3 已移除的 preset 下拉。
    // WP-58 T1 further widened it to 10 by adding the four schedulable construct families
    // ('tracking' / 'detection' / 'micro-flick' / 'spider-shot-wide') to the same allowlist.
    const familyCheckboxes = planSetup.locator('input[name="sessionFamily"]');
    await expect(familyCheckboxes).toHaveCount(10);
    for (let i = 0; i < 10; i++) await expect(familyCheckboxes.nth(i)).toBeChecked();
    await expect(planSetup.locator('[data-session-family="peek-click-transfer"]')).toHaveCount(1);
    await expect(planSetup.locator('[data-session-family="peek-click-transfer-v1"]')).toHaveCount(1);

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

  test('WP-53 T4：操作者只勾選 formal peek-click-transfer-v1 家族亦能走到 eligibility gate', async ({ page }) => {
    await waitForHarness(page);

    await page.getByRole('button', { name: '選手測試 Session', exact: true }).click();
    await page.locator('#session-setup input[name="participantId"]').fill('t-exit-transfer-formal');
    await page.locator('#session-setup button[type="submit"]').click();

    const planSetup = page.locator('#session-plan-setup');
    await expect(planSetup).toBeVisible();

    // 只保留 formal 'peek-click-transfer-v1',其餘（含 pilot 'peek-click-transfer'）取消勾選——
    // 證明 formal 家族與 pilot 家族是可獨立選取的兩個 id（FR-53-6），不是同一個勾選項。
    const familyCheckboxes = planSetup.locator('input[name="sessionFamily"]');
    const count = await familyCheckboxes.count();
    for (let i = 0; i < count; i++) {
      const checkbox = familyCheckboxes.nth(i);
      const value = await checkbox.getAttribute('value');
      if (value !== 'peek-click-transfer-v1') await checkbox.uncheck();
    }
    await expect(planSetup.locator('[data-session-family="peek-click-transfer-v1"] input')).toBeChecked();
    await expect(planSetup.locator('[data-session-family="peek-click-transfer"] input')).not.toBeChecked();

    await planSetup.locator('button[type="submit"]').click();
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });

  // ---------------------------------------------------------------------------------------------
  // WP-58 T6 — the custom session program track, covered in the same spec as the frozen one
  // (T6 step 1: update the existing Session Plan spec, never open a parallel one).
  // ---------------------------------------------------------------------------------------------

  /** The three families the program tests interleave, and the one drill each contributes. */
  const PROGRAM_DRILLS = ['tracking_scene_v1', 'detection_popin_v1', 'spider-shot-wide-v1'] as const;

  async function openPlanSetup(page: Page, participantId: string) {
    await waitForHarness(page);
    await page.getByRole('button', { name: '選手測試 Session', exact: true }).click();
    await page.locator('#session-setup input[name="participantId"]').fill(participantId);
    await page.locator('#session-setup button[type="submit"]').click();
    const planSetup = page.locator('#session-plan-setup');
    await expect(planSetup).toBeVisible();
    return planSetup;
  }

  /** Switches to the custom track and appends `drillIds` to the program list, in order. */
  async function buildProgram(
    planSetup: ReturnType<Page['locator']>,
    drillIds: readonly string[],
    reps: readonly number[],
    drillRestSeconds: string,
    familyRestSeconds: string,
  ): Promise<void> {
    await planSetup.locator('input[name="sessionPlanMode"][value="custom"]').check();
    await expect(planSetup.locator('[data-plan-section="custom"]')).toBeVisible();
    for (const drillId of drillIds) {
      await planSetup.locator('select[name="sessionPlanDrill"]').selectOption(drillId);
      await planSetup.getByRole('button', { name: '加入', exact: true }).click();
    }
    for (let i = 0; i < reps.length; i++) {
      await planSetup
        .locator(`[data-program-item="${i}"] input[name="sessionPlanReps"]`)
        .fill(String(reps[i]));
    }
    await planSetup.locator('input[name="sessionPlanDrillRestSeconds"]').fill(drillRestSeconds);
    await planSetup.locator('input[name="sessionPlanFamilyRestSeconds"]').fill(familyRestSeconds);
  }

  /** The preview rows as read off the DOM — never recomputed here (the compiler owns the model). */
  async function readPreview(planSetup: ReturnType<Page['locator']>) {
    return planSetup.locator('[data-program-preview-steps] li').evaluateAll((nodes) =>
      nodes.map((node) => ({
        kind: node.getAttribute('data-program-step'),
        boundary: node.getAttribute('data-step-boundary'),
        drillId: node.getAttribute('data-step-drill-id'),
        nextDrillId: node.getAttribute('data-step-next-drill-id'),
        text: node.textContent,
      })),
    );
  }

  test('WP-58 T6：自訂 program 表單在真實 DOM 編出 3 家族 × 2 reps，預覽 11 步且邊界秒數正確', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-custom-preview');

    // Switching tracks hides the frozen block; the frozen DOM itself is untouched (FR-58.10).
    await expect(planSetup.locator('[data-plan-section="frozen"]')).toBeVisible();
    await planSetup.locator('input[name="sessionPlanMode"][value="custom"]').check();
    await expect(planSetup.locator('[data-plan-section="frozen"]')).toBeHidden();

    // The menu is the roster, grouped by family (FR-58.1). Exact equality with
    // `SCHEDULABLE_DRILL_IDS` / `FAMILY_BY_DRILL_ID` is already asserted in
    // `src/ui/SessionPlanSetup.test.ts`; importing `drillFamily.ts` here is impossible anyway (it
    // pulls `drills/*.json`, which Playwright's Node loader rejects without an import attribute).
    // What only the real browser adds is that the *rendered* menu has the same shape and that a
    // drill picked from it is the one that lands in the list.
    const picker = planSetup.locator('select[name="sessionPlanDrill"]');
    await expect(picker.locator('option')).toHaveCount(36);
    await expect(picker.locator('optgroup')).toHaveCount(10);
    const options = await picker
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    expect(new Set(options).size).toBe(options.length);
    for (const drillId of PROGRAM_DRILLS) expect(options).toContain(drillId);

    await buildProgram(planSetup, PROGRAM_DRILLS, [2, 2, 2], '1', '2');

    // FR-58.13 — 11 steps: 6 runs, three 1s `rep` seams inside an item, two 2s `family` seams
    // between items. The operator sees this table *before* the eligibility gate.
    const steps = await readPreview(planSetup);
    expect(steps.map((step) => step.kind)).toEqual([
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
    ]);
    expect(steps.filter((step) => step.kind === 'run').map((step) => step.drillId)).toEqual([
      PROGRAM_DRILLS[0],
      PROGRAM_DRILLS[0],
      PROGRAM_DRILLS[1],
      PROGRAM_DRILLS[1],
      PROGRAM_DRILLS[2],
      PROGRAM_DRILLS[2],
    ]);
    expect(steps.filter((step) => step.kind === 'rest').map((step) => step.boundary)).toEqual([
      'rep',
      'family',
      'rep',
      'family',
      'rep',
    ]);
    expect(steps.filter((step) => step.kind === 'rest').map((step) => step.nextDrillId)).toEqual([
      PROGRAM_DRILLS[0],
      PROGRAM_DRILLS[1],
      PROGRAM_DRILLS[1],
      PROGRAM_DRILLS[2],
      PROGRAM_DRILLS[2],
    ]);
    expect(steps[0].text).toBe(`1. ▶ ${PROGRAM_DRILLS[0]} (1/2)`);
    expect(steps[1].text).toBe(`2. ⏸ 1s · rep（同一 drill 下一輪） → ${PROGRAM_DRILLS[0]}`);
    expect(steps[3].text).toBe(`4. ⏸ 2s · family（換家族） → ${PROGRAM_DRILLS[1]}`);

    // 3 x 1s + 2 x 2s = 7s of rest; `summarizeProgram()` owns the number, the header owns the copy.
    await expect(planSetup.locator('[data-program-preview-summary]')).toHaveText(
      '預覽（11 步 · 執行 6 輪 · 休息合計 7 秒）',
    );

    await planSetup.locator('button[type="submit"]').click();
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });

  test('WP-58 T6：相鄰同家族 drill 只拿到 drill 休息，預覽在提交前就把它說出來（R-58.8）', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-same-family');

    // Both drills are in the `tracking` family, so FR-58.5 gives that seam `drill`, not `family` —
    // the counter-intuitive result the preview table exists to surface before the session starts.
    await buildProgram(planSetup, ['tracking_v1', 'tracking_scene_v1'], [1, 1], '30', '60');

    const steps = await readPreview(planSetup);
    expect(steps.map((step) => step.kind)).toEqual(['run', 'rest', 'run']);
    expect(steps[1].boundary).toBe('drill');
    expect(steps[1].text).toBe(
      '2. ⏸ 30s · drill（同家族換 drill） → tracking_scene_v1',
    );
  });

  test('WP-58 T6：非法 reps 標出該列並禁用提交，修好即解除；切回 frozen 不被自訂軌鎖死', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-invalid');
    await buildProgram(planSetup, ['tracking_v1', 'detection_popin_v1'], [1, 1], '30', '60');

    const submit = planSetup.locator('button[type="submit"]');
    await expect(submit).toBeEnabled();

    // FR-58.7 — the compiler's typed error is the copy, and its `itemIndex` marks the row.
    await planSetup.locator('[data-program-item="1"] input[name="sessionPlanReps"]').fill('0');
    await expect(submit).toBeDisabled();
    await expect(planSetup.locator('[data-program-item="1"]')).toHaveAttribute('data-invalid', 'true');
    await expect(planSetup.locator('[data-program-item="0"]')).not.toHaveAttribute('data-invalid', 'true');
    await expect(planSetup.locator('[role="alert"]')).toHaveText(
      'Session program 編譯失敗: items[1].reps 必須為 >= 1 的整數',
    );

    // Switching back to frozen must lift the custom track's block, or an operator who experimented
    // with a program would be locked out of the standard assessment.
    await planSetup.locator('input[name="sessionPlanMode"][value="frozen"]').check();
    await expect(submit).toBeEnabled();

    await planSetup.locator('input[name="sessionPlanMode"][value="custom"]').check();
    await expect(submit).toBeDisabled();
    await planSetup.locator('[data-program-item="1"] input[name="sessionPlanReps"]').fill('3');
    await expect(submit).toBeEnabled();
    await expect(planSetup.locator('[data-program-item="1"]')).not.toHaveAttribute('data-invalid', 'true');
  });

  test('WP-58 T6：▲▼ 排序與移除改變的是編譯出來的順序（NFR-58.7）', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-reorder');
    await buildProgram(planSetup, PROGRAM_DRILLS, [1, 1, 1], '30', '60');

    await planSetup
      .getByRole('button', { name: `${PROGRAM_DRILLS[2]} 上移`, exact: true })
      .click();
    expect(
      await planSetup
        .locator('[data-program-item]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-drill-id'))),
    ).toEqual([PROGRAM_DRILLS[0], PROGRAM_DRILLS[2], PROGRAM_DRILLS[1]]);

    await planSetup
      .getByRole('button', { name: `移除 ${PROGRAM_DRILLS[0]}`, exact: true })
      .click();
    const steps = await readPreview(planSetup);
    expect(steps.filter((step) => step.kind === 'run').map((step) => step.drillId)).toEqual([
      PROGRAM_DRILLS[2],
      PROGRAM_DRILLS[1],
    ]);
  });

  // ---------------------------------------------------------------------------------------------
  // WP-58 T6 — the *live* scheduler: compile -> cursor -> real drill -> per-rep export -> rest
  // overlay -> done, in a real browser.
  //
  // Driven through the dev-only `__fpsTest.startSessionPlanWithoutGate()` seam because the
  // eligibility gate cannot be passed under automation — measured, not assumed: the gate's own
  // report in this environment reads `native FAIL — 1280x720 vs 1920x1080` and
  // `perf FAIL — warmup p95 16.83ms vs 地板 8.33ms` (PERF_FLOOR_MS is a 120 Hz floor; headless rAF
  // is ~17 ms). The seam still *runs* the real gate and hands its genuine, failing report to
  // `experimentSession.enter()`, so nothing here fabricates an eligibility pass; only the refusal
  // is skipped. Everything after that point — compiler, runner, drill load, export, overlay — is
  // the production path. The DOM route as far as `#eligibility-gate` is covered by the form tests
  // above, and the pointer-lock playthrough stays manual (full-drill.spec.ts header).
  //
  // Drill choice is constrained twice. (1) Only scene-*pinned* drills can be scheduled from a cold
  // boot: an unpinned drill inherits whatever scene is loaded, and `tracking_v1` on the boot scene
  // `field-low` fails clearance against its rocks and trees — which is exactly what the abort test
  // below uses as its fault injection. (2) The run must end without a human aiming, so the roster's
  // shortest self-terminating drills are used: `tracking_scene_v1` (~23 s of timed presentations),
  // `detection_popin_v1` (~65 s of pop-in timeouts) and `spider-shot-wide-v1` (60 s time limit).
  // Nothing runs faster than real time and no `DrillConfig` is shortened for the test.
  // ---------------------------------------------------------------------------------------------

  type SessionPlanState = {
    phase: 'idle' | 'run' | 'rest' | 'done';
    drillId?: string;
    itemIndex?: number;
    repIndex?: number;
    boundary?: 'rep' | 'drill' | 'family';
    nextDrillId?: string;
    experimentActive: boolean;
  };
  type PhaseSample = { readonly state: SessionPlanState; readonly t: number };

  type SessionPlanSelectionArg =
    | { mode: 'frozen'; families: string[]; restSeconds: number; includeWarmup: boolean }
    | {
        mode: 'custom';
        items: { drillId: string; reps: number }[];
        drillRestSeconds: number;
        familyRestSeconds: number;
      };

  /**
   * Starts the live Session Plan and records every phase transition inside the page, on rAF,
   * stamped with `performance.now()` (ADR-4 — never `Date.now()`). Sampling in the page instead of
   * polling over the wire is what makes the measured rest durations trustworthy to about a frame.
   * A rest emits exactly one sample: `sessionPlanState()` deliberately omits `remainingMs`, so the
   * countdown does not churn the sample log.
   */
  async function runLiveSessionPlan(
    page: Page,
    participantId: string,
    selection: SessionPlanSelectionArg,
    timeoutMs: number,
  ): Promise<{ samples: PhaseSample[]; downloads: string[]; statuses: string[] }> {
    const downloads: string[] = [];
    page.on('download', (download) => void downloads.push(download.suggestedFilename()));

    await page.evaluate(() => {
      const target = window as unknown as {
        __fpsTest: { sessionPlanState(): { phase: string } };
        __t6samples?: { state: { phase: string }; t: number }[];
        __t6statuses?: string[];
      };
      const samples: { state: { phase: string }; t: number }[] = [];
      const statuses: string[] = [];
      target.__t6samples = samples;
      target.__t6statuses = statuses;

      // Statuses are watched, not sampled. Some of them live for less than a frame: when the first
      // drill's scene is already loaded, `startSessionPlan()` runs from the "no warmup" notice to
      // the first run ordinal without ever yielding to rAF, so a per-frame sampler would miss the
      // notice entirely (it did, on the first attempt at this test). A MutationObserver sees every
      // write regardless of when it happens.
      const statusEl = document.getElementById('protocol-status');
      if (statusEl !== null) {
        const record = (): void => {
          const text = statusEl.textContent ?? '';
          if (statuses.at(-1) !== text) statuses.push(text);
        };
        record();
        new MutationObserver(record).observe(statusEl, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      let previousState = '';
      const tick = (): void => {
        const state = target.__fpsTest.sessionPlanState();
        const key = JSON.stringify(state);
        if (key !== previousState) {
          previousState = key;
          samples.push({ state, t: performance.now() });
        }
        if (state.phase !== 'done') requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.evaluate(
      async (arg) => {
        await (
          window as unknown as {
            __fpsTest: {
              startSessionPlanWithoutGate(participantId: string, selection: unknown): Promise<void>;
            };
          }
        ).__fpsTest.startSessionPlanWithoutGate(arg.participantId, arg.selection);
      },
      { participantId, selection },
    );

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __fpsTest: { sessionPlanState(): SessionPlanState } }).__fpsTest
                .sessionPlanState().phase,
          ),
        { timeout: timeoutMs, intervals: [500] },
      )
      .toBe('done');

    const samples = (await page.evaluate(
      () => (window as unknown as { __t6samples: PhaseSample[] }).__t6samples,
    )) as PhaseSample[];
    const statuses = await page.evaluate(
      () => (window as unknown as { __t6statuses: string[] }).__t6statuses,
    );
    return { samples, downloads, statuses };
  }

  /** Every rest the run actually served, with the wall time until the next phase, in ms. */
  function measuredRests(
    samples: readonly PhaseSample[],
  ): { boundary: string; nextDrillId: string; ms: number }[] {
    const rests: { boundary: string; nextDrillId: string; ms: number }[] = [];
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const next = samples[i + 1];
      if (sample.state.phase !== 'rest' || next === undefined) continue;
      rests.push({
        boundary: sample.state.boundary ?? '',
        nextDrillId: sample.state.nextDrillId ?? '',
        ms: next.t - sample.t,
      });
    }
    return rests;
  }

  test('WP-58 T6：自訂 program 在真瀏覽器跑完 3 家族 × 2 reps —— 休息時長、6 份唯一匯出、收工狀態', async ({
    page,
  }) => {
    // Six real drills (~23s + ~65s + 60s, twice) plus 7s of rests, with headroom for scene loads
    // and countdowns.
    test.setTimeout(15 * 60_000);
    await waitForHarness(page);

    const { samples, downloads } = await runLiveSessionPlan(
      page,
      't6-live-custom',
      {
        mode: 'custom',
        items: [
          { drillId: PROGRAM_DRILLS[0], reps: 2 },
          { drillId: PROGRAM_DRILLS[1], reps: 2 },
          { drillId: PROGRAM_DRILLS[2], reps: 2 },
        ],
        drillRestSeconds: 1,
        familyRestSeconds: 2,
      },
      13 * 60_000,
    );

    // FR-58.9 — the cursor walked the compiled 11 steps, in order, and each run knows where it is.
    const walked = samples.filter(
      (sample) => sample.state.phase === 'run' || sample.state.phase === 'rest',
    );
    expect(walked.map((sample) => sample.state.phase)).toEqual([
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
      'rest',
      'run',
    ]);
    expect(
      walked
        .filter((sample) => sample.state.phase === 'run')
        .map((sample) => [sample.state.drillId, sample.state.itemIndex, sample.state.repIndex]),
    ).toEqual([
      [PROGRAM_DRILLS[0], 0, 0],
      [PROGRAM_DRILLS[0], 0, 1],
      [PROGRAM_DRILLS[1], 1, 0],
      [PROGRAM_DRILLS[1], 1, 1],
      [PROGRAM_DRILLS[2], 2, 0],
      [PROGRAM_DRILLS[2], 2, 1],
    ]);

    // FR-58.5 — each rest served the duration carried by its own step, not one global value.
    const rests = measuredRests(samples);
    expect(rests.map((rest) => rest.boundary)).toEqual(['rep', 'family', 'rep', 'family', 'rep']);
    for (const rest of rests) {
      const expectedMs = rest.boundary === 'family' ? 2_000 : 1_000;
      const label = `${rest.boundary} rest before ${rest.nextDrillId}`;
      // The lower bound is strict: a rest must never be served short. The upper bound is loose
      // because the next drill's load (and its scene's GLTF) happens inside the same transition —
      // the runner publishes the `run` phase only after `loadDrillById()` resolves.
      expect(rest.ms, label).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(rest.ms, label).toBeLessThan(expectedMs + 10_000);
    }

    // FR-58.15 — one export per rep, and `startedAt` really does keep the basenames apart (OQ-58.2).
    expect(downloads).toHaveLength(6);
    expect(new Set(downloads).size).toBe(6);

    // The session is over: cursor done, `experimentSession.exit()` ran, no rest overlay left behind.
    const last = samples.at(-1)!;
    expect(last.state.phase).toBe('done');
    expect(last.state.experimentActive).toBe(false);
    await expect(page.locator('#rest-overlay')).toBeHidden();
  });

  test('WP-58 T6：frozen 標準 Assessment 軌在真瀏覽器跑完 —— 家族順序、單一休息秒數、無熱身提示', async ({
    page,
  }) => {
    test.setTimeout(8 * 60_000);
    await waitForHarness(page);

    const { samples, downloads, statuses } = await runLiveSessionPlan(
      page,
      't6-live-frozen',
      // `detection` has no warmup drill (only `counterstrafe` does), so this also exercises the
      // "no warmup for this family" branch without paying for two 120s counterstrafe runs.
      { mode: 'frozen', families: ['detection', 'spider-shot-wide'], restSeconds: 2, includeWarmup: true },
      7 * 60_000,
    );

    // `includeWarmup` was asked for, but `detection` has no warmup drill, so the operator is told
    // so and the program starts on the first measured run. The notice is transient (the run
    // ordinals overwrite it), hence the sampled history rather than a post-hoc read.
    expect(statuses.some((status) => status.includes('本家族無熱身'))).toBe(true);
    // Warmup runs are not numbered: two families means "1/2" then "2/2", exactly as before WP-58.
    expect(statuses.some((status) => status.includes('正式測試 1/2'))).toBe(true);
    expect(statuses.some((status) => status.includes('正式測試 2/2'))).toBe(true);
    await expect(page.locator('#protocol-status')).toContainText('Session Plan 完成');

    // FR-58.10 — the frozen program is each selected family's representative drill, in the
    // operator's order, with exactly one rest of the single `restSeconds` between them.
    const walked = samples.filter(
      (sample) => sample.state.phase === 'run' || sample.state.phase === 'rest',
    );
    expect(walked.map((sample) => sample.state.phase)).toEqual(['run', 'rest', 'run']);
    expect(
      walked.filter((sample) => sample.state.phase === 'run').map((sample) => sample.state.drillId),
    ).toEqual(['detection_popin_v1', 'spider-shot-wide-v1']);
    const rests = measuredRests(samples);
    expect(rests.map((rest) => rest.boundary)).toEqual(['family']);
    expect(rests[0].ms).toBeGreaterThanOrEqual(1_900);
    expect(rests[0].ms).toBeLessThan(12_000);

    expect(downloads).toHaveLength(2);
    expect(new Set(downloads).size).toBe(2);
    expect(samples.at(-1)!.state.experimentActive).toBe(false);
    await expect(page.locator('#rest-overlay')).toBeHidden();
  });

  test('WP-58 T6：program 中途 drill 載入失敗 → 中止、錯誤可見、rest overlay 不殘留（FR-58.11）', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    await waitForHarness(page);

    // Real fault injection, no stubbing: `tracking_v1` pins no scene, so it inherits whichever one
    // is loaded, and `tracking_scene_v1` leaves `field-low` loaded — whose rocks and trees the
    // wider `tracking_v1` envelope cannot clear. The second run therefore fails inside the real
    // `loadDrillById()`, on the unattended auto-advance out of a rest: the path that would strand
    // the rest overlay on screen forever if it were not handled.
    const { samples, downloads } = await runLiveSessionPlan(
      page,
      't6-live-abort',
      {
        mode: 'custom',
        items: [
          { drillId: 'tracking_scene_v1', reps: 1 },
          { drillId: 'tracking_v1', reps: 1 },
        ],
        drillRestSeconds: 1,
        familyRestSeconds: 1,
      },
      4 * 60_000,
    );

    expect(samples.map((sample) => sample.state.phase)).toEqual(['idle', 'run', 'rest', 'done']);
    expect(downloads).toHaveLength(1);

    // The operator is told why, in the same status line the rest of the Session Plan uses.
    const status = page.locator('#protocol-status');
    await expect(status).toContainText('本次 session 已中止');
    await expect(status).toContainText('clearance');
    await expect(page.locator('#rest-overlay')).toBeHidden();

    // An aborted session is *not* formally exited — `experimentSession.exit()` only runs on the
    // completion branch. Pinned here so the asymmetry is visible rather than folklore; see
    // progress.md (T6 open questions).
    expect(samples.at(-1)!.state.experimentActive).toBe(true);
  });
});
