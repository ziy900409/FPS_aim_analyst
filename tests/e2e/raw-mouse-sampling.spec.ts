import { test, expect } from '@playwright/test';
import { armDrill, pulsePointerLock } from './support/arm.ts';

/**
 * WP-60 / T2 — raw mouse sample 擷取的 **app 佈線層** 端到端證據。
 *
 * 為什麼需要這一檔：`recordKeyEvents`（WP-29）曾經「API 層 opt-in 存在、main.ts 從未啟用」而無人
 * 發現（見 main.ts 該處註解與 input-sampler.spec.ts 的兩個對應斷言）。本檔比照同一紀律，直接讀
 * **正式單例** 的 recorder，證明三件事：
 *   ① 預設載入（無 query）時 `recordMouseSamples` 為 `false`，且不記任何 `pointer_lock` 事件
 *      —— FR-60.2「預設關閉、匯出逐位不變」不是只寫在型別預設值裡；
 *   ② `?rawMouse=1` 真的把正式單例切到開啟；
 *   ③ 開啟後，Pointer Lock 轉態經由**生產的** `PointerLock` 模組 → main.ts 的 onChange 訂閱 →
 *      正式 recorder，真的落成 `pointer_lock` 事件（FR-60.6 / OQ-60.3）。
 *
 * 合成的部分只有 `document.pointerLockElement`：自動化無法穩定取得真實 Pointer Lock（見
 * input-sampler.spec.ts 的 `locked === false` 斷言），而 `PointerLock` 的**權威狀態來源**正是
 * `pointerlockchange` 事件 + `pointerLockElement === canvas`。改寫該 getter 後派發真實事件，走的
 * 是與真人按下取鎖完全相同的那條 code path —— 與該檔合成 coalesced 子樣本是同一個既有取捨。
 * 該模擬自 WP-65 T6 起抽進共用 helper `support/arm.ts`（全 repo 只有一份）。
 *
 * WP-65 T6：`pointer_lock` 事件只在 `countdown`/`running` 記錄，而待命閘讓 drill 停在 `'armed'`
 * 直到一次取鎖 ⇒ **兩個 case 都必須先 `armDrill()`**。不 arm 也會通過，但那時「沒有事件」會變成
 * 相位擋掉的結果而非開關關掉的結果 —— 斷言會被悄悄弱化成同義反覆。
 *
 * 只跑 dev（5173）：preview（4173）為 production build、無 `__aimDebug` 縫（刻意）。
 */

const DEV_URL = 'http://localhost:5173/';

/** dev 觀測縫的形狀（見 main.ts）。此檔不在 tsconfig include 內，型別僅供本地可讀性。 */
type AimDebug = {
  recorder: {
    recordMouseSamples: boolean;
    snapshot: () => {
      events: Array<{ type: string; locked?: boolean; t: number }>;
      mouseSamples?: { t0Ms: number; dtUs: number[]; dx: number[]; dy: number[] };
      mouseSampling?: { recorded: number; capacity: number; overflow: boolean; timeSource: string; deltaUnit: string };
    };
  };
};

async function gotoAppReady(page: import('@playwright/test').Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)))
    .toBe(true);
}

/** 轉態後的正式 recorder 觀測（`pointer_lock` 事件與擷取 provenance）。 */
async function readRecorder(page: import('@playwright/test').Page): Promise<{
  events: Array<{ type: string; locked?: boolean; t: number }>;
  recordMouseSamples: boolean;
  mouseSampling: { recorded: number; capacity: number; overflow: boolean; timeSource: string; deltaUnit: string } | null;
}> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
    const snapshot = debug.recorder.snapshot();
    return {
      events: snapshot.events.filter((event) => event.type === 'pointer_lock'),
      recordMouseSamples: debug.recorder.recordMouseSamples,
      mouseSampling: snapshot.mouseSampling ?? null,
    };
  });
}

test.describe('WP-60 T2 — raw mouse sample 擷取的 app 佈線層（Edge, dev）', () => {
  test('FR-60.2：預設載入時正式單例維持關閉，且不記 pointer_lock 事件', async ({ page }) => {
    await gotoAppReady(page, DEV_URL);
    await armDrill(page);

    const transition = await pulsePointerLock(page);
    const recorder = await readRecorder(page);

    // 開關預設關閉 —— 這是 T0 經驗性 gate 未過期間的刻意狀態（見 main.ts 該處註解）。
    expect(recorder.recordMouseSamples).toBe(false);
    // 相位是「沒有事件」的前提：錄製中（countdown/running）才可能記錄，故必須先排除相位這個解釋。
    expect(['countdown', 'running']).toContain(transition.phase);
    // 轉態確實發生（否則下一條的「沒有事件」是因為沒轉態，不是因為關閉）。
    expect(transition.lockedDuringTransition).toBe(true);
    expect(transition.lockedAfter).toBe(false);
    // 關閉 ⇒ 匯出裡既沒有 raw 區塊也沒有 pointer_lock 事件（pre-WP-60 逐位形狀）。
    expect(recorder.events).toEqual([]);
    expect(recorder.mouseSampling).toBeNull();
  });

  test('FR-60.6 / OQ-60.3：`?rawMouse=1` 開啟後 Pointer Lock 轉態經生產路徑落成 pointer_lock 事件', async ({
    page,
  }) => {
    await gotoAppReady(page, `${DEV_URL}?rawMouse=1`);
    await armDrill(page);

    const transition = await pulsePointerLock(page);
    const recorder = await readRecorder(page);

    // ② app 佈線層真的把正式單例切到開啟（非僅 API 層 opt-in 存在）。
    expect(recorder.recordMouseSamples).toBe(true);
    // 只在 drill 實際錄製中記錄 —— 相位是斷言前提，不是時間假設。
    expect(['countdown', 'running']).toContain(transition.phase);
    expect(transition.lockedDuringTransition).toBe(true);
    expect(transition.lockedAfter).toBe(false);

    // ③ 一次 lock→unlock 恰好兩個事件，順序與 `locked` 值對得上。
    // 解除待命的那一次取鎖**不**在其中：它發生在 `'armed'`，被同一條相位閘擋在記錄之外。
    expect(recorder.events.map((event) => event.locked)).toEqual([true, false]);
    for (const event of recorder.events) {
      expect(Number.isFinite(event.t)).toBe(true);
      expect(event.t).toBeGreaterThan(0);
    }

    // provenance 一併就位（FR-60.3）：真實容量走 `mouseSampleCapacityForDrill(maxDrillSeconds)`。
    expect(recorder.mouseSampling?.timeSource).toBe('event.timeStamp');
    expect(recorder.mouseSampling?.deltaUnit).toBe('counts');
    expect(recorder.mouseSampling?.overflow).toBe(false);
    expect(recorder.mouseSampling?.capacity).toBeGreaterThanOrEqual(1000 * 300);
  });
});
