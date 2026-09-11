import { expect, type Page } from '@playwright/test';

/**
 * WP-65 / T6 — live e2e 的待命閘解除 helper。
 *
 * WP-65 之後 `main.ts` 以 `requireArm: true` 建構 `DrillRunner`：每次 `start()` 都停在 `'armed'`，
 * 要等一次**新的取鎖**才轉 `countdown`。不驅動 `window.__fps` 合成 harness 的 live spec 因此不再能
 * 假設「載入 app 就會自己跑起來」，必須先送出那一次取鎖訊號。
 *
 * 全 repo **只有這一份**取鎖模擬（DoD）：`raw-mouse-sampling.spec.ts` 原本的 inline 版本已改用
 * `pulsePointerLock()`，避免兩份模擬各自演化。
 *
 * **走生產路徑**：改寫 `document.pointerLockElement` 指向 canvas 並派發真實 `pointerlockchange`
 * ——那正是 `PointerLock` 的權威狀態來源（`PointerLock.ts:55-58`），所以訊號會經
 * 生產 `PointerLock` → `main.ts` 的 `armOnPointerLock` 訂閱者 → `SharedState.armRequested` →
 * `DrillRunner` 唯讀。**不**直接寫 `sharedState.armRequested`（那會繞過整條接線，測了等於沒測）。
 */

/** dev-only 觀測縫 `window.__aimDebug` 的形狀（見 `main.ts`）。此目錄不在 tsconfig include 內。 */
type AimDebug = {
  state: { armRequested: boolean; validity: { pointerLockLostDuringRun: boolean } };
  pointerLock: { locked: boolean };
  drillPhase: () => string;
};

export interface DrillArmState {
  phase: string;
  locked: boolean;
  armRequested: boolean;
  pointerLockLostDuringRun: boolean;
}

export interface LockPulseResult {
  /** 轉態**之前**的相位（`pointer_lock` 事件的記錄前提，見 raw-mouse-sampling.spec.ts）。 */
  phase: string;
  lockedDuringTransition: boolean;
  lockedAfter: boolean;
  /**
   * 取鎖那一刻同步讀到的 `armRequested`。`armDrill()` 以它判斷「arm 訂閱者是否已掛上」——
   * 見該函式對開機競態的說明。
   */
  armRequestedDuringTransition: boolean;
}

/** `__aimDebug` 尚未掛上時回 `null`，讓呼叫端的 poll 繼續等而不是炸在 undefined 上。 */
export async function readDrillArmState(page: Page): Promise<DrillArmState | null> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __aimDebug?: AimDebug }).__aimDebug;
    if (debug === undefined) return null;
    return {
      phase: debug.drillPhase(),
      locked: debug.pointerLock.locked,
      armRequested: debug.state.armRequested,
      pointerLockLostDuringRun: debug.state.validity.pointerLockLostDuringRun,
    };
  });
}

/**
 * 在生產 `PointerLock` 上驅動一次完整的 lock→unlock 轉態，結束時把 `pointerLockElement` 還原，
 * **頁面回到未鎖定**——所有既有 spec 的互動與斷言因此維持在它們原本的鎖狀態下。
 *
 * 覆寫在 `finally` 內還原，不外洩到後續斷言。
 */
export async function pulsePointerLock(page: Page): Promise<LockPulseResult> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
    const canvas = document.querySelector('canvas');
    if (canvas === null) throw new Error('canvas not mounted');

    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');
    const phase = debug.drillPhase();
    let lockedDuringTransition = false;
    let armRequestedDuringTransition = false;
    try {
      // 取鎖：權威狀態 = `pointerLockElement === canvas`（PointerLock.ts 的註解與實作皆如此）。
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
      document.dispatchEvent(new Event('pointerlockchange'));
      lockedDuringTransition = debug.pointerLock.locked;
      armRequestedDuringTransition = debug.state.armRequested;
      // 解鎖（Esc / 失焦的同一條路徑）。
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
      document.dispatchEvent(new Event('pointerlockchange'));
    } finally {
      delete (document as unknown as Record<string, unknown>).pointerLockElement;
      if (descriptor !== undefined) Object.defineProperty(Document.prototype, 'pointerLockElement', descriptor);
    }

    return {
      phase,
      lockedDuringTransition,
      lockedAfter: debug.pointerLock.locked,
      armRequestedDuringTransition,
    };
  });
}

/**
 * 等 drill 停在 `'armed'`，送出取鎖訊號解除待命，並斷言相位真的離開 `'armed'`。
 * 回傳解除後當下的狀態供呼叫端加斷言。
 *
 * **為什麼是 poll 而不是「送一次就好」**（T6 spike 實測）：`armOnPointerLock` 的訂閱者掛在
 * `main.ts:1379`，而 `__aimDebug` 在 `main.ts:1127` 就已掛上，兩者之間隔著 `fpsTestHarness` 的
 * top-level `await import(...)`。真人點擊**持著**鎖，所以就算點在這個視窗內，`main.ts:1405` 的
 * 補呼叫仍會補上；本 helper 的模擬取鎖是**脈衝**（取完立刻放），落在該視窗就會整個消失。
 * 每次 poll 送出的是一次完整且已還原的轉態，`armRequestedDuringTransition` 則是「訂閱者已掛上」
 * 的**直接觀測**——不是換算成時間的等待，也不是綁死某個開機內部順序的 proxy 訊號。
 */
export async function armDrill(page: Page): Promise<DrillArmState> {
  await expect
    .poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 20_000 })
    .toBe('armed');

  await expect
    .poll(async () => (await pulsePointerLock(page)).armRequestedDuringTransition, { timeout: 20_000 })
    .toBe(true);

  await expect
    .poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 10_000 })
    .not.toBe('armed');

  const state = await readDrillArmState(page);
  if (state === null) throw new Error('armDrill: __aimDebug disappeared after arming');
  // FR-65.12：待命相位的釋鎖（含本 helper 的脈衝尾端）不得被記成「錄製中掉鎖」。每個用到 arm 的
  // spec 都順帶把這條不變式跑一次，比另立一個只跑一次的斷言更難悄悄壞掉。
  expect(state.pointerLockLostDuringRun).toBe(false);
  expect(state.locked).toBe(false);
  return state;
}

/**
 * `armDrill()` + 等 `timing.countdownMs` 的倒數走完進入 `'running'`。
 * **不寫死 3000**：輪詢相位本身，倒數長度改了這裡也不用跟著改。
 */
export async function armAndWaitRunning(page: Page): Promise<void> {
  await armDrill(page);
  await expect
    .poll(async () => (await readDrillArmState(page))?.phase ?? null, { timeout: 20_000 })
    .toBe('running');
}

/**
 * 連續多場（Session Plan 的每個 block、tracking pilot 的每個 block）用的**自動解除待命**看門狗。
 *
 * 受試者在連續 session 裡是每個 block 開頭各點一次左鍵（使用者 2026-09-11 拍板第三條）。單次
 * `armDrill()` 表達不了這件事：block 之間的 `start()` 會把 `armRequested` 清掉，而 spec 多半只
 * 輪詢「整個 plan 跑完了沒」，沒有 block 邊界可以掛。本函式在頁面內裝一個 rAF 看門狗，**每次**
 * 相位落到 `'armed'` 就送一次取鎖脈衝 —— 語意上等同「受試者每場都會點」。
 *
 * 走的是同一個生產路徑（`pulsePointerLock()` 的同一段程式碼），不寫 `sharedState.armRequested`。
 * 只在 `'armed'` 且 `armRequested === false` 時動作 ⇒ `countdown`/`running`/`ended` 期間一次
 * `pointerlockchange` 都不派發，不會污染掉鎖效度旗標（FR-65.12）。
 *
 * 回傳 `armCount(page)`：看門狗實際解除了幾場。**請斷言它**——否則「plan 跑完了」無法區分
 * 「每場都被正確解除」與「待命閘根本沒生效」。
 */
export async function installAutoArm(page: Page): Promise<(p?: Page) => Promise<number>> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 20_000,
    })
    .toBe(true);

  await page.evaluate(() => {
    const target = window as unknown as { __aimDebug: AimDebug; __wp65AutoArmCount?: number };
    if (target.__wp65AutoArmCount !== undefined) return; // 同一頁只裝一次
    target.__wp65AutoArmCount = 0;
    const debug = target.__aimDebug;

    const tick = (): void => {
      const canvas = document.querySelector('canvas');
      if (canvas !== null && debug.drillPhase() === 'armed' && !debug.state.armRequested) {
        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');
        try {
          Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
          document.dispatchEvent(new Event('pointerlockchange'));
          Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
          document.dispatchEvent(new Event('pointerlockchange'));
        } finally {
          delete (document as unknown as Record<string, unknown>).pointerLockElement;
          if (descriptor !== undefined) Object.defineProperty(Document.prototype, 'pointerLockElement', descriptor);
        }
        if (debug.state.armRequested) target.__wp65AutoArmCount = (target.__wp65AutoArmCount ?? 0) + 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return async (p: Page = page): Promise<number> =>
    p.evaluate(() => (window as unknown as { __wp65AutoArmCount?: number }).__wp65AutoArmCount ?? 0);
}
