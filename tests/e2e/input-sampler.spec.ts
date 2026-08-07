import { test, expect } from '@playwright/test';

/**
 * WP-3 / T5 exit-gate — 在真實瀏覽器（Edge）端到端驗證 F1 採集層：
 * 事件帶高解析度 `event.timeStamp` 入固定欄位 ring buffer，sim 依 `t` 升冪、半開窗嚴格 `<`
 * 消費並排空（FR-3.1/3.2/3.3/3.4 + OQ-3.3 時間戳同源）。
 *
 * 觀測管道：main.ts 的 dev-only 縫 `window.__aimDebug = { state, pointerLock }`（僅 5173 dev
 * 存在；production 剝除）。單元測試（vitest）以假 target 覆蓋邏輯；本檔證明**真實瀏覽器事件 →
 * 生產 InputSampler → SharedState ring → SimLoop 消費**整條路徑端到端不丟例外、行為正確。
 *
 * 只跑 dev（5173）：preview（4173）為 production build、無 __aimDebug 縫（刻意）。
 * Pointer Lock 需真實使用者手勢、無法在自動化中穩定取得 → 「鎖定中 fire/pointermove 入緩衝」的
 * **正向**路徑由 manual-verification.md 手動驗（pointermove 的正向路徑另由
 * src/input/InputSampler.test.ts 的假 target 注入覆蓋）；此處驗其**負向**（未鎖定 → 被閘門擋，
 * KI-005 / A T3 起 pointermove 與 fire/ads 同套閘門）。
 */

const URL = 'http://localhost:5173/';

/** dev 觀測縫的形狀（見 main.ts）。此檔不在 tsconfig include 內，型別僅供本地可讀性。 */
type AimDebug = {
  state: {
    input: { size: () => number; peekT: () => number; isEmpty: () => boolean };
    player: { vx: number; x: number };
    inputMeta: { lateEventCount: number; bufferOverflow: number };
  };
  pointerLock: { locked: boolean };
  recorder: {
    mouseIntegration?: { gain: { hipStep: number; adsStep: number } };
    recordKeyEvents: boolean;
  };
};

/** 等待 async bootstrap 完成、dev 觀測縫掛上。 */
async function gotoAppReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)))
    .toBe(true);
}

test.describe('WP-3 InputSampler — 真實瀏覽器端到端（Edge）', () => {
  test('鍵盤 A/D（trusted keydown/keyup）→ 入緩衝 → sim 消費 → 套用 vx + 推進位置（FR-3.1/3.4）', async ({
    page,
  }) => {
    await gotoAppReady(page);
    const vx = () => page.evaluate(() => (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state.player.vx);
    const x = () => page.evaluate(() => (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state.player.x);

    // 真實 keydown（Playwright → CDP，isTrusted 事件、code=KeyD、高解析度 timeStamp）。
    await page.keyboard.down('D');
    await expect.poll(vx).toBe(250); // 已入緩衝 + 被 sim 依時序消費 + 佔位 applyInput 套用
    await expect.poll(x).toBeGreaterThan(0); // sim 等速推進位置（消費確實發生）

    await page.keyboard.up('D');
    await expect.poll(vx).toBe(0); // keyup 亦入緩衝並被消費

    await page.keyboard.down('A');
    await expect.poll(vx).toBe(-250); // 反向鍵原始鍵碼（反向語意 → WP-5）
    await page.keyboard.up('A');
    await expect.poll(vx).toBe(0);
  });

  test('同步探針：帶同源 timeStamp 入 ring、非採集鍵忽略、未鎖定 fire 被閘門擋（FR-3.1/3.3 + OQ-3.3）', async ({
    page,
  }) => {
    await gotoAppReady(page);

    // 單一同步 evaluate：dispatch 後 rAF 尚未 fire → sim 未排空 ring，可原地觀測入緩衝結果。
    const probe = await page.evaluate(() => {
      const { state, pointerLock } = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
      const ring = state.input;
      const base = ring.size();

      // 非採集鍵（KeyQ）：不污染緩衝。
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
      const afterNonSampled = ring.size();

      // 採集鍵（KeyD）：入緩衝；head 時間戳應與 performance.now() 同時鐘域（OQ-3.3）。
      const t0 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      const afterKey = ring.size();
      const headT = ring.peekT();

      // 未鎖定 → 左鍵 mousedown 被 isLocked 閘門擋（避免取鎖/UI 點擊誤判為開火）。
      const locked = pointerLock.locked;
      const beforeFire = ring.size();
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      const afterFire = ring.size();

      return {
        nonSampledDelta: afterNonSampled - base,
        keyDelta: afterKey - afterNonSampled,
        headT,
        t0,
        locked,
        fireDelta: afterFire - beforeFire,
      };
    });

    expect(probe.nonSampledDelta).toBe(0); // KeyQ 不入
    expect(probe.keyDelta).toBe(1); // 只有 KeyD 入
    expect(Math.abs(probe.headT - probe.t0)).toBeLessThan(50); // event.timeStamp 與 performance.now() 同源
    expect(probe.locked).toBe(false); // 自動化無 pointer lock
    expect(probe.fireDelta).toBe(0); // 未鎖定 → fire 被閘門擋、不入緩衝
  });

  test('同步探針：未鎖定 pointermove 被閘門擋、coalesced 子樣本亦不入 ring（KI-005 / A T3，FR-A-8）', async ({
    page,
  }) => {
    await gotoAppReady(page);

    // KI-005 / A T3：pointermove 補上與 fire/ads 相同的 isLocked() 閘。自動化無法穩定取得
    // 真實 Pointer Lock（見上一個測試的 locked === false 斷言），故比照 fire 的既有模式——
    // 只驗負向路徑（未鎖定 → 不入 ring）；正向路徑（鎖定中 coalesced 子樣本各入一筆）由
    // src/input/InputSampler.test.ts（假 target 注入 isLocked）覆蓋，行為與 T3 前逐位不變。
    const delta = await page.evaluate(() => {
      const ring = (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state.input;
      const base = ring.size();
      const ev = new PointerEvent('pointermove', { bubbles: true });
      // 合成 3 個次幀子樣本（模擬 1000Hz coalesced 軌跡；真實事件由瀏覽器提供，此處合成以斷言 wiring）。
      const subs = [
        { movementX: 3, movementY: -1, timeStamp: performance.now() },
        { movementX: 5, movementY: 0, timeStamp: performance.now() },
        { movementX: 2, movementY: 2, timeStamp: performance.now() },
      ];
      Object.defineProperty(ev, 'getCoalescedEvents', { value: () => subs });
      window.dispatchEvent(ev);
      return ring.size() - base;
    });

    expect(delta).toBe(0); // 自動化無 Pointer Lock → 閘門擋下，coalesced 子樣本一律不入 ring
  });

  test('KI-005 / A（FR-A-7）：app 佈線層真的對正式單例啟用 mouse 積分（非僅 API 層 opt-in）', async ({
    page,
  }) => {
    await gotoAppReady(page);

    // recordKeyEvents（WP-29）至今未在 main.ts 啟用是前車之鑑——本斷言直接讀正式單例的
    // recorder.mouseIntegration，證明 FR-A-7「app 佈線層必須啟用」不是只有 API 層 opt-in 存在。
    const mouseIntegration = await page.evaluate(
      () => (window as unknown as { __aimDebug: AimDebug }).__aimDebug.recorder.mouseIntegration,
    );

    expect(mouseIntegration).toBeDefined();
    expect(Number.isFinite(mouseIntegration?.gain.hipStep)).toBe(true);
    expect(Number.isFinite(mouseIntegration?.gain.adsStep)).toBe(true);
    expect((mouseIntegration?.gain.hipStep ?? 0) > 0).toBe(true);
  });

  test('KI-005-A / OQ-A-2（TD-5，2026-08-07 拍板）：app 佈線層真的對正式單例啟用 recordKeyEvents（非僅 API 層 opt-in）', async ({
    page,
  }) => {
    await gotoAppReady(page);

    // 比照上一案同一紀律：recordKeyEvents（WP-29）至今未啟用曾是前車之鑑（見 main.ts 註解），
    // 本斷言直接讀正式單例的 recorder.recordKeyEvents，證明 A2-T1 前置決策不是只有 API 層 opt-in 存在。
    const recordKeyEvents = await page.evaluate(
      () => (window as unknown as { __aimDebug: AimDebug }).__aimDebug.recorder.recordKeyEvents,
    );

    expect(recordKeyEvents).toBe(true);
  });
});
