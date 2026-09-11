import { test, expect, type Page } from '@playwright/test';
import { armDrill, installAutoArm } from './support/arm.ts';
import type { DrillConfig } from '../../src/drill/DrillConfig.ts';
import {
  ALL_TRACKING_PILOT_CONFIGS,
  TRACKING_PILOT_SCHEDULABLE_DRILLS,
} from '../../src/session/trackingPilotSchedulableDrills.ts';

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
 *
 * 4. WP-64 T3 — curated tracking-pilot block 的 ad hoc 軌（同一個 picker 的第三種內容）。同樣**擴充
 *    本檔而非新開 spec**（T3 Planned files）：WP-64 的主張是「這兩個 block 走的就是上面那條
 *    custom Session Plan 路徑，沒有第二套 orchestration」，拆成獨立 spec 等於在測試佈局上先承認
 *    它是另一條路。真瀏覽器在此新增的是三件只有實跑才成立的事：picker 裡的 pilot 選項**恰好**是
 *    curated 的兩個（其餘七個 block 缺席，A-64.1）、真 `field-low` clearance 載入後由
 *    `SessionRunner`（不是 `TrackingPilotRunner`）擁有完成與下載（FR-64.7/FM-64.1）、以及每份
 *    payload 帶著原 seed/武器/場景與 custom plan 座標、卻沒有 manifest 詞彙、沒有 eligibility
 *    判定、也沒有進 history（FR-64.5/64.6/64.8）。
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
        // WP-62 T6 — the weapon each run step will actually be fired with, as the preview resolved
        // it: the item's own choice, else the drill's declared weapon, else the literal `default`
        // (D-62.T4-4 keeps the app fallback `ak47` out of the UI).
        weaponId: node.getAttribute('data-step-weapon-id'),
        text: node.textContent,
      })),
    );
  }

  /** Picks a weapon on one program row. `''` is the `—（drill 預設）` option, i.e. no intent. */
  async function selectRowWeapon(
    planSetup: ReturnType<Page['locator']>,
    itemIndex: number,
    weaponId: string,
  ): Promise<void> {
    await planSetup
      .locator(`[data-program-item="${itemIndex}"] select[name="sessionPlanWeapon"]`)
      .selectOption(weaponId);
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
    // 36 -> 38 at WP-64 T1, which added the two curated tracking-pilot blocks to the `tracking`
    // roster row (the family already existed, so the optgroup count is unchanged). T1/T2 updated
    // the unit-level cardinalities (`SessionPlanSetup.test.ts`, `drillFamily.test.ts`) but ran no
    // Playwright, so this line was the one stale expectation WP-64 left behind — see T3 progress.
    await expect(picker.locator('option')).toHaveCount(38);
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
    // WP-62 T4 widened the run row's copy with the weapon it will use; with no per-item choice and
    // no drill-declared weapon, that reads `預設` and the attribute reads `default`. This line is
    // the pre-WP-62 assertion updated to the new copy — it was the only e2e casualty of T4 (the
    // task did not run Playwright), and it is tightened rather than relaxed: the attribute is now
    // pinned for every run step as well.
    expect(steps[0].text).toBe(`1. ▶ ${PROGRAM_DRILLS[0]} (1/2) · 武器 預設`);
    expect(steps.filter((step) => step.kind === 'run').map((step) => step.weaponId)).toEqual([
      'default',
      'default',
      'default',
      'default',
      'default',
      'default',
    ]);
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
  // WP-62 T6 — per-item weapon, in the same form and the same spec as everything above.
  //
  // One BR cell is used by name below. `tracking_br_v1__ads_off__hitscan__2deg` declares
  // `ak47_br_hip_hitscan` as the weapon of its 2x2x2 experimental grid, so it is the row where
  // D-62-1 (an override is a compile error, not a silently accepted plan) actually bites.
  // ---------------------------------------------------------------------------------------------

  const BR_GRID_DRILL = 'tracking_br_v1__ads_off__hitscan__2deg';
  const BR_GRID_WEAPON = 'ak47_br_hip_hitscan';

  test('WP-62 T6：每列各選一把武器 → 預覽逐步顯示該步武器 → 送出（FR-62.1/62.3/62.5）', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-weapon-picker');
    await buildProgram(planSetup, [PROGRAM_DRILLS[0], PROGRAM_DRILLS[1]], [2, 1], '1', '2');

    // FR-62.7 — the rendered menu is the whole of `WEAPONS` plus the "no intent" option, and each
    // label carries the magazine size. Unit tests own the exact list; what the real browser adds is
    // that the row's `<select>` is really populated and really scoped to its own row.
    const weaponSelect = planSetup.locator('[data-program-item="0"] select[name="sessionPlanWeapon"]');
    await expect(weaponSelect.locator('option')).toHaveCount(10);
    await expect(weaponSelect.locator('option[value="ak47"]')).toHaveText('ak47（30 發）');
    await expect(planSetup.getByText('無玩家 reload', { exact: false })).toBeVisible();
    await expect(planSetup.getByText('不會併入同一條趨勢線', { exact: false })).toBeVisible();

    await selectRowWeapon(planSetup, 0, 'm4a1s');
    await selectRowWeapon(planSetup, 1, 'usp_s_laser');

    // FR-62.3/62.5 — every rep of row 0 carries the same weapon, and row 1 carries its own. The
    // preview says so *before* the eligibility gate, which is the whole point of the picker.
    const steps = await readPreview(planSetup);
    const runs = steps.filter((step) => step.kind === 'run');
    expect(runs.map((step) => [step.drillId, step.weaponId])).toEqual([
      [PROGRAM_DRILLS[0], 'm4a1s'],
      [PROGRAM_DRILLS[0], 'm4a1s'],
      [PROGRAM_DRILLS[1], 'usp_s_laser'],
    ]);
    expect(runs[0].text).toBe(`1. ▶ ${PROGRAM_DRILLS[0]} (1/2) · 武器 m4a1s`);
    // Step 5 of 5: run, rep rest, run, family rest, run.
    expect(runs[2].text).toBe(`5. ▶ ${PROGRAM_DRILLS[1]} (1/1) · 武器 usp_s_laser`);

    // Clearing one row back to `—（drill 預設）` removes the intent again — the picker is not a
    // one-way door, and an undone choice must not leave `weaponId: undefined` behind (NFR-62.4).
    await selectRowWeapon(planSetup, 1, '');
    expect((await readPreview(planSetup)).filter((step) => step.kind === 'run').at(-1)?.weaponId).toBe(
      'default',
    );

    await planSetup.locator('button[type="submit"]').click();
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });

  test('WP-62 T6：覆蓋 BR 實驗格武器 → 標紅該列且禁用提交；改回宣告值即解除（FR-62.2/FM-2）', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't6-weapon-locked');
    await buildProgram(planSetup, [PROGRAM_DRILLS[0], BR_GRID_DRILL], [1, 1], '1', '2');

    const submit = planSetup.locator('button[type="submit"]');
    await expect(submit).toBeEnabled();
    // With no choice made the grid cell already shows its own declared weapon by name (D-62.T4-1).
    expect((await readPreview(planSetup)).filter((step) => step.kind === 'run').map((s) => s.weaponId)).toEqual([
      'default',
      BR_GRID_WEAPON,
    ]);

    // FM-2 — the failure this rejection exists for is data that looks entirely legal while
    // measuring a different grid than it claims. The compiler's typed error is the copy and its
    // `itemIndex` marks the row, exactly as for an invalid `reps` (same contract, no second path).
    await selectRowWeapon(planSetup, 1, 'm4a1s');
    await expect(submit).toBeDisabled();
    await expect(planSetup.locator('[data-program-item="1"]')).toHaveAttribute('data-invalid', 'true');
    await expect(planSetup.locator('[data-program-item="0"]')).not.toHaveAttribute('data-invalid', 'true');
    await expect(planSetup.locator('[role="alert"]')).toHaveText(
      `Session program 編譯失敗: items[1].weaponId ${BR_GRID_DRILL} 由實驗格固定為 ${BR_GRID_WEAPON}，不可指定其他武器`,
    );

    // Naming the weapon the drill already declares is agreement, not a conflict: it must be let
    // through, or the operator learns to leave the field blank and hope.
    await selectRowWeapon(planSetup, 1, BR_GRID_WEAPON);
    await expect(submit).toBeEnabled();
    await expect(planSetup.locator('[data-program-item="1"]')).not.toHaveAttribute('data-invalid', 'true');
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
        items: { drillId: string; reps: number; weaponId?: string }[];
        drillRestSeconds: number;
        familyRestSeconds: number;
      };

  /**
   * The slice of an exported payload the scheduler tests read. Only `meta` is needed: the run's
   * weapon is a fact recorded per run (`weaponId`), the plan it came from is intent recorded per
   * session (`sessionPlanItems`), and the cursor fields say which row of the plan this run is.
   */
  type ExportedMeta = {
    readonly drillId: string;
    readonly weaponId?: string;
    readonly sessionPlanMode?: string;
    readonly sessionPlanItemIndex?: number;
    readonly sessionPlanRepIndex?: number;
    readonly sessionPlanItems?: { drillId: string; reps: number; weaponId?: string }[];
    readonly [key: string]: unknown;
  };

  /**
   * FNV-1a over the sorted meta key list — the same cheap digest `exportPayloadSchema.test.ts` uses
   * for its canonical fixtures, applied here to a *live* export's schema surface. Keys only: the
   * values of a real run (timestamps, tick counts, hit tallies) differ every time, so pinning them
   * would pin nothing but flake. What must not drift is which fields the frozen track writes.
   */
  function metaKeyDigest(meta: ExportedMeta): string {
    let hash = 0x811c9dc5;
    for (const char of Object.keys(meta).sort().join(',')) {
      hash ^= char.codePointAt(0)!;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /** Measured at `f0df84d` (pre-WP-62 HEAD); see the frozen test for what they guard. */
  const FROZEN_META_KEY_DIGESTS = {
    detection_popin_v1: '2752c07b',
    'spider-shot-wide-v1': '2752c07b',
    tracking_scene_v1: '2752c07b',
  } as const;

  /**
   * WP-64 T3 widened this from `meta` to the whole payload: a curated pilot block's prep/scored
   * window is an *event* (`scored_start`), so "the block's own protocol guard survived being
   * scheduled" cannot be read off `meta` alone.
   */
  type ExportedPayload = {
    readonly meta: ExportedMeta;
    readonly ticks: readonly unknown[];
    readonly events: readonly { readonly type: string }[];
  };

  /** Reads one download to completion and parses it — the payload as it left the browser. */
  async function readExportedPayload(
    download: import('@playwright/test').Download,
  ): Promise<ExportedPayload> {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as ExportedPayload;
  }

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
  ): Promise<{
    samples: PhaseSample[];
    downloads: string[];
    statuses: string[];
    metas: ExportedMeta[];
    payloads: ExportedPayload[];
    /** WP-65 T6 — how many blocks the auto-arm watchdog actually released. Assert it. */
    armCount: number;
  }> {
    const downloads: string[] = [];
    // WP-62 T6 — the exports are now read, not just counted. The stream has to be taken while the
    // page is still alive, so each download is parsed as it arrives and awaited at the end.
    const payloadReads: Promise<ExportedPayload>[] = [];
    page.on('download', (download) => {
      downloads.push(download.suggestedFilename());
      payloadReads.push(readExportedPayload(download));
    });

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

    // WP-65 T6 — every block now stops in the `'armed'` phase until a fresh pointer lock arrives
    // (user ruling 2026-09-11 #3: the participant clicks once per block), and the spec cannot see
    // block boundaries (it only polls for `phase === 'done'`), so a rAF watchdog releases each one.
    //
    // The app's *own* boot drill is armed first, explicitly and outside the watchdog's count: the
    // page has been sitting on `counterstrafe_ad_v1` in `'armed'` since `waitForHarness()`, and a
    // watchdog installed while that is still pending would release it too — making `armCount` read
    // blocks+1 (measured: 7 for six blocks, 5 for four). Draining it here leaves the counter
    // measuring exactly what FR-65.4 is about: one gesture per *plan* block.
    await armDrill(page);
    const armCount = await installAutoArm(page);

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
    const payloads = await Promise.all(payloadReads);
    return {
      samples,
      downloads,
      statuses,
      metas: payloads.map((payload) => payload.meta),
      payloads,
      armCount: await armCount(),
    };
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

    const { samples, downloads, armCount } = await runLiveSessionPlan(
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

    // WP-65 FR-65.4 — one arming gesture per block, no more and no fewer. Six runs, six releases:
    // a block that skipped the gate (or one released twice) is a different number, not a silent pass.
    expect(armCount).toBe(6);

    // The session is over: cursor done, `experimentSession.exit()` ran, no rest overlay left behind.
    const last = samples.at(-1)!;
    expect(last.state.phase).toBe('done');
    expect(last.state.experimentActive).toBe(false);
    await expect(page.locator('#rest-overlay')).toBeHidden();
  });

  test('WP-62 T6：逐列武器實跑 —— 每份匯出的 meta.weaponId 對得上該列選擇，意圖與事實一致（FR-62.1/62.3/62.4）', async ({
    page,
  }) => {
    // Four runs of the same ~23 s drill. One drill, three rows, three different weapon situations:
    // the weapon is the only thing that varies, so a mismatch cannot be blamed on the drill.
    test.setTimeout(10 * 60_000);
    await waitForHarness(page);

    const { samples, downloads, metas, armCount } = await runLiveSessionPlan(
      page,
      't6-live-weapon',
      {
        mode: 'custom',
        items: [
          // Two reps, one weapon: FR-62.3 says both runs fire it, not just the first.
          { drillId: PROGRAM_DRILLS[0], reps: 2, weaponId: 'm4a1s' },
          { drillId: PROGRAM_DRILLS[0], reps: 1, weaponId: 'usp_s_laser' },
          // No intent at all — the row must still run, on the app default.
          { drillId: PROGRAM_DRILLS[0], reps: 1 },
        ],
        drillRestSeconds: 1,
        familyRestSeconds: 1,
      },
      9 * 60_000,
    );

    expect(samples.at(-1)!.state.phase).toBe('done');
    expect(downloads).toHaveLength(4);
    expect(armCount).toBe(4); // WP-65 FR-65.4 — four blocks, four arming gestures.

    // The fact, per run: `activateDrill()` really did build the sim loop with the planned weapon,
    // and it stayed put across the second rep instead of being reset by the next drill activation
    // (the pre-WP-62 behaviour this whole WP exists to replace).
    expect(metas.map((meta) => [meta.sessionPlanItemIndex, meta.sessionPlanRepIndex, meta.weaponId])).toEqual([
      [0, 0, 'm4a1s'],
      [0, 1, 'm4a1s'],
      [1, 0, 'usp_s_laser'],
      // "No intent" is not "no weapon": the run still records the weapon it actually fired.
      [2, 0, 'ak47'],
    ]);

    // The intent, per session: every export carries the whole plan, and the row that omitted a
    // weapon omits the *key* — a `weaponId: undefined` would be a visible schema change (NFR-62.4),
    // and `toEqual` alone would not notice it, hence the explicit `in`.
    for (const meta of metas) {
      expect(meta.sessionPlanMode).toBe('custom');
      expect(meta.sessionPlanItems).toEqual([
        { drillId: PROGRAM_DRILLS[0], reps: 2, weaponId: 'm4a1s' },
        { drillId: PROGRAM_DRILLS[0], reps: 1, weaponId: 'usp_s_laser' },
        { drillId: PROGRAM_DRILLS[0], reps: 1 },
      ]);
      expect('weaponId' in meta.sessionPlanItems![2]).toBe(false);
    }

    // FR-62.4 — the reconciliation itself: for every run, the plan row it came from either named
    // this weapon or named none. This is the assertion that would catch a runner handing step N's
    // weapon to step N+1 while both halves of the export still looked individually plausible.
    for (const meta of metas) {
      const planned = meta.sessionPlanItems![meta.sessionPlanItemIndex!].weaponId;
      if (planned !== undefined) expect(meta.weaponId).toBe(planned);
      else expect(meta.weaponId).toBe('ak47');
    }
  });

  test('WP-58 T6：frozen 標準 Assessment 軌在真瀏覽器跑完 —— 家族順序、單一休息秒數、無熱身提示', async ({
    page,
  }) => {
    test.setTimeout(11 * 60_000);
    await waitForHarness(page);

    const { samples, downloads, statuses, metas } = await runLiveSessionPlan(
      page,
      't6-live-frozen',
      // `detection` has no warmup drill (only `counterstrafe` does), so this also exercises the
      // "no warmup for this family" branch without paying for two 120s counterstrafe runs.
      //
      // WP-58 T-exit (OQ-58.6): `tracking` is here as the third family for a specific reason. T1
      // made it a frozen family whose representative was the scene-less `tracking_v1`, so ticking it
      // aborted the session on its very first load — the frozen form offered a family that could
      // never run. T-exit repointed the family at `tracking_scene_v1`; this is the live proof that
      // an operator ticking `tracking` now gets a session that actually completes, which the unit
      // invariant ("the representative pins a scene") cannot show on its own — only a real load
      // proves the drill clears the scene it is pinned to.
      {
        mode: 'frozen',
        families: ['detection', 'spider-shot-wide', 'tracking'],
        restSeconds: 2,
        includeWarmup: true,
      },
      10 * 60_000,
    );

    // `includeWarmup` was asked for, but `detection` has no warmup drill, so the operator is told
    // so and the program starts on the first measured run. The notice is transient (the run
    // ordinals overwrite it), hence the sampled history rather than a post-hoc read.
    expect(statuses.some((status) => status.includes('本家族無熱身'))).toBe(true);
    // Warmup runs are not numbered: three families means "1/3" through "3/3", and the ordinal
    // scheme itself is exactly as before WP-58.
    expect(statuses.some((status) => status.includes('正式測試 1/3'))).toBe(true);
    expect(statuses.some((status) => status.includes('正式測試 2/3'))).toBe(true);
    expect(statuses.some((status) => status.includes('正式測試 3/3'))).toBe(true);
    await expect(page.locator('#protocol-status')).toContainText('Session Plan 完成');

    // FR-58.10 — the frozen program is each selected family's representative drill, in the
    // operator's order, with exactly one rest of the single `restSeconds` between them.
    const walked = samples.filter(
      (sample) => sample.state.phase === 'run' || sample.state.phase === 'rest',
    );
    expect(walked.map((sample) => sample.state.phase)).toEqual(['run', 'rest', 'run', 'rest', 'run']);
    expect(
      walked.filter((sample) => sample.state.phase === 'run').map((sample) => sample.state.drillId),
    ).toEqual(['detection_popin_v1', 'spider-shot-wide-v1', 'tracking_scene_v1']);
    const rests = measuredRests(samples);
    // Every boundary here crosses families, so all of them take the single frozen `restSeconds`.
    expect(rests.map((rest) => rest.boundary)).toEqual(['family', 'family']);
    for (const rest of rests) {
      expect(rest.ms).toBeGreaterThanOrEqual(1_900);
      expect(rest.ms).toBeLessThan(12_000);
    }

    expect(downloads).toHaveLength(3);
    expect(new Set(downloads).size).toBe(3);
    expect(samples.at(-1)!.state.experimentActive).toBe(false);
    await expect(page.locator('#rest-overlay')).toBeHidden();

    // FR-62.6 / FR-58.10 — the frozen track is a pre-registered protocol, so WP-62 must be
    // invisible in its exports. The per-item weapon never reaches this track (D-62-2: the form
    // offers no picker here and `buildFrozenSessionPlan` sets no `weaponId`), and this is the live
    // proof of it: the session-plan audit block is still exactly the two frozen keys, no run
    // carries a planned weapon, and every run fired the app default because none of these three
    // representative drills declares a weapon of its own. `META_KEY_DIGEST` below pins the rest.
    for (const meta of metas) {
      expect(Object.keys(meta).filter((key) => key.startsWith('sessionPlan')).sort()).toEqual([
        'sessionPlanFamilyOrder',
        'sessionPlanRestSeconds',
      ]);
      expect(meta.sessionPlanItems).toBeUndefined();
      expect(meta.weaponId).toBe('ak47');
    }
    // The whole meta key surface, not just the parts WP-62 touched. These digests were taken from
    // the same live frozen run at `f0df84d` — the last commit before any WP-62 source change — and
    // must not move. Each drill has its own because the exported meta is drill-shaped (only
    // spider-shot writes `spiderShot`, only tracking writes `tracking`, and so on). A deliberate
    // addition to the frozen export's schema updates these *and* says so in the owning WP's
    // progress; silently drifting is what this exists to prevent.
    expect(metas.map((meta) => [meta.drillId, metaKeyDigest(meta)])).toEqual([
      ['detection_popin_v1', FROZEN_META_KEY_DIGESTS.detection_popin_v1],
      ['spider-shot-wide-v1', FROZEN_META_KEY_DIGESTS['spider-shot-wide-v1']],
      ['tracking_scene_v1', FROZEN_META_KEY_DIGESTS.tracking_scene_v1],
    ]);
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

    // WP-58 T-exit (OQ-58.7): an aborted session is now closed on the same rule as a completed one
    // — reaching `done` calls `experimentSession.exit()`. T6 pinned the old asymmetry here
    // (`true`); the assertion flipping is the regression evidence that the fix landed.
    expect(samples.at(-1)!.state.experimentActive).toBe(false);
  });

  // ---------------------------------------------------------------------------------------------
  // WP-64 T3 — the ad hoc research track: a curated tracking-pilot block scheduled from the *same*
  // custom Session Plan form, run by the *same* `SessionRunner`.
  //
  // Both curated blocks are read from `TRACKING_PILOT_SCHEDULABLE_DRILLS` rather than typed out, so
  // a change to the curated set shows up here as a diff instead of a stale literal — and the
  // complement (the seven pilot blocks that must stay unschedulable) is derived from the same
  // census, which is what makes "exactly these two, no more" checkable in the rendered DOM.
  //
  // Neither config is shortened for the test (T3 step 3): each block is `timeLimit` 26 000 ms
  // (1 000 ms centre-prep + 25 000 ms scored), so three reps cost ~90 s of real time plus scene
  // loads. That is the price of testing the production stimulus; no clock is scaled.
  // ---------------------------------------------------------------------------------------------

  const CURATED_PILOT_CONFIGS: readonly DrillConfig[] = TRACKING_PILOT_SCHEDULABLE_DRILLS.map(
    (entry) => entry.config,
  );
  const CURATED_PILOT_IDS: readonly string[] = CURATED_PILOT_CONFIGS.map((config) => config.drillId);
  /** The seven WP-54 blocks WP-64 deliberately did *not* curate (T0 §6 complement). */
  const UNCURATED_PILOT_IDS: readonly string[] = ALL_TRACKING_PILOT_CONFIGS.map(
    (config) => config.drillId,
  ).filter((drillId) => !CURATED_PILOT_IDS.includes(drillId));

  /**
   * The export fields an ad hoc pilot run is audited by; `ExportedMeta`'s index signature alone
   * would type every one of them `unknown`.
   */
  type PilotExportedMeta = ExportedMeta & {
    readonly scene?: { readonly sceneId?: string };
    readonly spawn?: { readonly trackingTrajectory?: unknown; readonly trackingPrepMs?: number };
    readonly targets?: {
      readonly hitbox?: { widthU: number; heightU: number; depthU: number; shape?: string };
    };
    readonly session?: { readonly participantId?: string; readonly sessionLabel?: string };
    readonly assessment?: unknown;
  };

  test('WP-64 T3：curated pilot block 是 picker 裡唯一兩個 pilot 選項，可編入 custom program 並走到 eligibility gate（A-64.1/FR-64.1/64.4）', async ({
    page,
  }) => {
    const planSetup = await openPlanSetup(page, 't3-pilot-picker');
    await planSetup.locator('input[name="sessionPlanMode"][value="custom"]').check();

    const picker = planSetup.locator('select[name="sessionPlanDrill"]');
    const options = await picker.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value,
        group: (node.parentElement as HTMLOptGroupElement | null)?.label ?? '',
      })),
    );

    // A-64.1 — the whole registry claim, stated on the rendered menu rather than on a map: the two
    // curated ids are offered, in the `tracking` group, and the other seven pilot blocks (practice,
    // both calibrations, three core cells, the medium reversal) are simply not there. This is the
    // assertion that fails if somebody "helpfully" spreads the whole manifest into the roster.
    for (const drillId of CURATED_PILOT_IDS) {
      const option = options.find((candidate) => candidate.value === drillId);
      expect(option, `${drillId} must be offered by the picker`).toBeDefined();
      expect(option!.group).toBe('tracking');
    }
    for (const drillId of UNCURATED_PILOT_IDS) {
      expect(
        options.map((option) => option.value),
        drillId,
      ).not.toContain(drillId);
    }

    // Two curated blocks, same family, different drills: the seam between them is a `drill` rest,
    // and the seam between two reps of the first is a `rep` rest (FR-64.3 — the ad hoc run inherits
    // the generic program semantics, it does not get a pilot-specific rest model).
    await buildProgram(planSetup, CURATED_PILOT_IDS, [2, 1], '1', '2');

    const steps = await readPreview(planSetup);
    expect(steps.map((step) => step.kind)).toEqual(['run', 'rest', 'run', 'rest', 'run']);
    expect(steps.filter((step) => step.kind === 'run').map((step) => step.drillId)).toEqual([
      CURATED_PILOT_IDS[0],
      CURATED_PILOT_IDS[0],
      CURATED_PILOT_IDS[1],
    ]);
    expect(steps.filter((step) => step.kind === 'rest').map((step) => step.boundary)).toEqual([
      'rep',
      'drill',
    ]);
    // FR-64.4 — the fixed research factor is visible before the operator commits: every run step
    // already says `tracking_pilot_hold` without anyone choosing it on the row. (WP-62's compile
    // error for a *different* weapon is asserted at unit level; what only the browser adds is that
    // the drill's declared weapon reaches the rendered preview.)
    expect(steps.filter((step) => step.kind === 'run').map((step) => step.weaponId)).toEqual([
      'tracking_pilot_hold',
      'tracking_pilot_hold',
      'tracking_pilot_hold',
    ]);

    await planSetup.locator('button[type="submit"]').click();
    await expect(page.locator('#eligibility-gate')).toBeVisible();
  });

  test('WP-64 T3：ad hoc custom program 真跑 curated pilot block —— field-low 載入、逐 rep 匯出稽核、SessionRunner 擁有完成（A-64.4/64.5/64.6/64.7）', async ({
    page,
  }) => {
    // Three unshortened 26 s blocks + 3 s countdowns + 3 s of rests + two scene loads.
    test.setTimeout(10 * 60_000);
    await waitForHarness(page);

    const participantId = 't3-live-pilot';
    const items = [
      { drillId: CURATED_PILOT_IDS[0], reps: 2 },
      { drillId: CURATED_PILOT_IDS[1], reps: 1 },
    ];
    const { samples, downloads, payloads } = await runLiveSessionPlan(
      page,
      participantId,
      { mode: 'custom', items, drillRestSeconds: 1, familyRestSeconds: 2 },
      9 * 60_000,
    );

    // A-64.4 — the cursor walked the compiled program: three real runs, in order, each knowing
    // which item/rep it is. Reaching `run` at all means `loadDrillById()` resolved the curated
    // runtime entry and the real `field-low` clearance accepted the block (FR-64.5): the runner
    // publishes `run` only after the load resolves, and a rejected clearance aborts instead.
    const walked = samples.filter(
      (sample) => sample.state.phase === 'run' || sample.state.phase === 'rest',
    );
    expect(walked.map((sample) => sample.state.phase)).toEqual(['run', 'rest', 'run', 'rest', 'run']);
    expect(
      walked
        .filter((sample) => sample.state.phase === 'run')
        .map((sample) => [sample.state.drillId, sample.state.itemIndex, sample.state.repIndex]),
    ).toEqual([
      [CURATED_PILOT_IDS[0], 0, 0],
      [CURATED_PILOT_IDS[0], 0, 1],
      [CURATED_PILOT_IDS[1], 1, 0],
    ]);
    expect(measuredRests(samples).map((rest) => rest.boundary)).toEqual(['rep', 'drill']);

    expect(downloads).toHaveLength(3);
    expect(new Set(downloads).size).toBe(3);
    expect(samples.at(-1)!.state.phase).toBe('done');
    expect(samples.at(-1)!.state.experimentActive).toBe(false);
    await expect(page.locator('#rest-overlay')).toBeHidden();

    // FR-64.7 / FM-64.1 — ownership. `TrackingPilotRunner` is offered this drill's `ended` first
    // (`main.ts`: `trackingPilotSession?.handleDrillEnded()`), and it must decline every time,
    // because no manifest is running: its block log stays empty and it renders no eligibility
    // verdict. Had it taken over, the downloads and the advances above would both be its doing.
    await expect(page.locator('#tracking-pilot-records-list').locator('li')).toHaveCount(0);
    await expect(page.locator('#tracking-pilot-quality-banner')).toBeHidden();
    await expect(page.locator('#tracking-pilot-operator')).toBeHidden();

    // FR-64.8 — practice never reaches the history API: the client-side policy short-circuits to
    // `excluded` without a request, so no history root can grow from an ad hoc run.
    const historyState = await page.evaluate(
      () =>
        (
          window as unknown as {
            __fpsTest: { historySaveState(): { kind: string; reason?: string } };
          }
        ).__fpsTest.historySaveState(),
    );
    expect(historyState).toEqual({ kind: 'excluded', reason: 'practice' });

    expect(payloads.map((payload) => payload.meta.drillId)).toEqual([
      CURATED_PILOT_IDS[0],
      CURATED_PILOT_IDS[0],
      CURATED_PILOT_IDS[1],
    ]);

    for (const [index, payload] of payloads.entries()) {
      const meta = payload.meta as PilotExportedMeta;
      const config = CURATED_PILOT_CONFIGS.find((candidate) => candidate.drillId === meta.drillId)!;
      const label = `${meta.drillId} rep ${String(meta.sessionPlanRepIndex)}`;

      // A-64.5 — the run is locatable in the plan it came from, with no new metadata field.
      expect(meta.sessionPlanMode, label).toBe('custom');
      expect(meta.sessionPlanItems, label).toEqual(items);
      expect([meta.sessionPlanItemIndex, meta.sessionPlanRepIndex], label).toEqual(
        index < 2 ? [0, index] : [1, 0],
      );
      expect(meta.sessionPlanItems![meta.sessionPlanItemIndex!].drillId, label).toBe(meta.drillId);
      // FR-64.6 — the run is audited as what it is: a `tracking`-family program with the two rest
      // seams the operator chose. A curated block gets no family of its own and no pilot-specific
      // rest model; the whole audit block is the stage8/WP-58 one, unchanged.
      expect(meta.sessionPlanFamilyOrder, label).toEqual(['tracking']);
      expect(meta.sessionPlanDrillRestSeconds, label).toBe(1);
      expect(meta.sessionPlanRestSeconds, label).toBe(2);

      // FR-64.2 — the stimulus that actually ran is the canonical config's. The primary seed lives
      // in the trajectory, not in `meta.rngSeed` (T2 §3), which is why the whole trajectory object
      // is compared rather than one number.
      expect(meta.spawn?.trackingTrajectory, label).toEqual(config.targets.trackingTrajectory);
      expect(meta.targets?.hitbox?.shape, label).toBe('sphere');
      expect(meta.targets?.hitbox?.widthU, label).toBeCloseTo(config.targets.hitbox!.widthU, 6);
      // FR-64.4 — the fact, not the intent: the run really did fire the pilot's own hold weapon.
      expect(meta.weaponId, label).toBe('tracking_pilot_hold');
      // FR-64.5 — the pinned scene, proven by the scene the export names.
      expect(meta.scene?.sceneId, label).toBe('field-low');

      // FR-64.8 — practice all the way through: no assessment block, so no trend cohort.
      expect(meta.assessment, label).toBeUndefined();

      // FR-64.7 / FM-64.8 — no manifest vocabulary is borrowed. `sessionLabel` is how a formal
      // pilot block records its counterbalance cell (`tracking-pilot-v2:<pid>:session-N`); an ad
      // hoc run carries the participant and nothing else, so its payload cannot be mistaken for
      // manifest evidence. Nor does anything here claim eligibility.
      expect(meta.session, label).toEqual({ participantId });
      expect(
        Object.keys(meta).filter((key) => /pilot|eligib|counterbalance/i.test(key)),
        label,
      ).toEqual([]);

      // The block's own protocol guard survived being scheduled: the 1 s centre-prep window is
      // still declared and the scored window still opens exactly once (the same two facts
      // `tracking-pilot-live.spec.ts` asserts for the manifest path). Recording a violation is
      // what these blocks do; *judging* it is what the ad hoc path refuses to do.
      expect(meta.spawn?.trackingPrepMs, label).toBe(config.timing.trackingPrepMs);
      expect(
        payload.events.filter((event) => event.type === 'scored_start'),
        label,
      ).toHaveLength(1);
      expect(payload.ticks.length, label).toBeGreaterThan(0);
      expect(meta.recorderOverflow, label).toBe(false);
    }

    // FM-64.7 — reps are repeated exposure, never independent samples: rep 0 and rep 1 of item 0
    // replay the *same* primary seed and the same trajectory. Stated here as an executable fact, so
    // the runbook's prohibition is not merely prose.
    expect((payloads[0].meta as PilotExportedMeta).spawn?.trackingTrajectory).toEqual(
      (payloads[1].meta as PilotExportedMeta).spawn?.trackingTrajectory,
    );
  });
});
