import type { SharedState } from '../state/SharedState.ts';
import { CODE_KEY, KEY_CODE } from '../state/types.ts';

/**
 * InputSampler — WP-3 / T1（FR-3.1，鍵盤部分）
 *
 * 事件驅動採集（~1000 Hz，ADR-2 三速率之最快者）：把 keydown/keyup 蓋上高解析度
 * `event.timeStamp`（與 `performance.now()` 同 time origin，ADR-4/7；禁 `Date.now()`）
 * 寫入 `SharedState.input`——精準度的真正來源是這層的 sub-tick 時間戳，不是 sim tick 頻率
 * （規格 ADR-3）。sim 端（T4）再依 timeStamp 排序消費。
 *
 * T1（鍵盤）+ T2（滑鼠 coalesced）+ T3（開火 mousedown）就緒。三類事件（key/fire/mouse）寫進同一
 * 固定欄位 ring buffer（T4b）：`push*` 依到達順序 append，`event.timeStamp` 近單調 ⇒ ring 寫入端
 * bounded insertion 保序（罕見亂序就地前移），滿足 T4 consume 的升冪前提（GD-3/D-3b）。
 * 容量滿走**溢位政策**（GD-2）：`push*` 回 `false` → 升 `inputMeta.bufferOverflow`、**拒收新事件、
 * 不覆寫尚未消費的最舊槽**（覆寫 = 靜默丟最舊資料）。
 */

/**
 * 採集的按鍵集合 = `KEY_CODE` 的鍵（`KeyboardEvent.code`，非 `key`：避開鍵盤 layout 差異，設計註記）。
 * A/D = 橫移（反向語意在 WP-5 急停判定，OQ-3.1）；W/S 預留（前後移動，階段 A 未用）。
 * 只收這些鍵（`KEY_CODE[code]` 有定義）→ 打字/快捷鍵不污染量測緩衝、守 GC 紀律（不寫無關事件）。
 */

export interface InputSampler {
  /**
   * 掛上事件監聽。鍵盤事件實務上落在 `window`/`document`（非某個 HTMLElement），故 target 型別
   * 放寬為 `EventTarget`（`Window`/`Document`/`HTMLElement` 皆滿足；偏離 README 原 `HTMLElement`，
   * 見 progress D-T1.1）。冪等：重複 `attach` 不疊聽。
   */
  attach(target: EventTarget): void;
  detach(): void;
  /**
   * stuck-ads 防護接縫（WP-24 / T1）：PointerLock 解鎖 / blur 時由呼叫端觸發——若右鍵仍按住（已採計
   * ads-down），補送一筆 ads-up（`down=false`，蓋傳入 `t`）避免 `heldAds` 永真汙染後續 drill。
   * 未採計過 ads-down 時為 no-op（比照 stuck-fire 掛點，見 [main.ts] pointerLock.onChange）。
   *
   * `t` 為 **wall ms**（`performance.now()` 域）；映射交由本模組的 `mapEventTime` 統一處理，
   * 與其餘 push 點同一條規則（見 `createInputSampler` 的 options 註解）。
   */
  releaseAds(t: number): void;
  /**
   * WP-69 / T3（FR-69.1，NFR-69.4）— pause 邊界的**單一**收束點。對 sampler 自己採計過的 held
   * control（A/D/W/S、fire、ads）各補一筆 release edge（蓋同一個 `atWallMs`），然後把 held 帳面清零。
   *
   * 為什麼是 release **event** 而不是直接寫 `SharedState.held*`：held 狀態是 sim 依時序消費輸入事件
   * 推導出來的，UI 直接寫會讓「狀態」與「產生狀態的事件序列」對不上，離線分析再也無法重建那一刻
   * （ADR-2 / README §2.3）。走 ring ⇒ 錄製端同時看得到那筆放開。
   *
   * 呼叫端必須**先**凍結 time mapper 再呼叫本函式，release edge 才會恰好蓋在 pause 邊界上。
   * 未採計過任何 down 時為完全的 no-op（零 ring 寫入）。
   */
  suspend(atWallMs: number): void;
}

/**
 * WP-69 / T3（FR-69.1/69.5，NFR-69.1/69.4）— 兩個注入接縫，**都**預設為既有行為的 identity，
 * 所以沒有 pause 的路徑（含全部既有測試與 e2e）逐位不變。
 */
export interface InputSamplerOptions {
  /**
   * gameplay 採計總閘。`false` 時所有 **down edge**（key/fire/ads）與 pointermove 一律拒收——
   * pause、取鎖中（locking）與 resume 倒數期間皆然（NFR-69.4）。
   *
   * **up edge 不走這個閘**：放開事件的採計條件是「sampler 自己採計過對應的 down」（見 heldKeys /
   * fireButtonHeld / adsButtonHeld）。閘關掉時 `suspend()` 已把 held 帳面清零 ⇒ 之後真正抵達的
   * keyup/mouseup 自然被那個條件擋下,不需要第二套判準;而閘開著時語意與 WP-69 之前逐字相同。
   * 預設 `() => true`：sampler 單獨使用時不閘門。
   */
  isGameplayInputEnabled?: () => boolean;
  /**
   * wall ms（DOM `event.timeStamp` / `performance.now()`，同一 Chromium time origin）→ **active
   * measurement time**（[pausableTimeMapper.ts]）。本模組的**每一個** push 點都經過它,包含
   * `releaseAds()` 與 `suspend()` ⇒ 呼叫端一律傳 wall,沒有「這個要映射、那個不用」的分岔。
   * 預設 identity（回傳同一個 double，非算術上相等的另一個）⇒ 未 pause 路徑逐位不變（NFR-69.1）。
   */
  mapEventTime?: (wallMs: number) => number;
}

/**
 * @param isLocked 開火採計閘門：僅 Pointer Lock 鎖定中才記 fire（見 onMouseDown）。注入以維持
 *   可測性（本專案慣例，D-T1.1）；main 傳 `() => pointerLock.locked`（[PointerLock.ts] 為權威狀態）。
 *   預設 `() => true`：sampler 單獨使用時不閘門（與鍵盤一致，鍵盤/滑鼠不受此閘門影響）。
 * @param options WP-69 / T3 的 pause 接縫，見 `InputSamplerOptions`。
 */
export function createInputSampler(
  state: SharedState,
  isLocked: () => boolean = () => true,
  options: InputSamplerOptions = {},
): InputSampler {
  let attached: EventTarget | null = null;
  let fireButtonHeld = false;
  let adsButtonHeld = false; // 右鍵 ADS 按住狀態（WP-24 / T1）：比照 fireButtonHeld，用於 up 補送與 stuck 防護
  /**
   * WP-69 / T3：已採計 down 但尚未採計 up 的按鍵（索引 = `KEY_CODE` 值）。固定長度 typed array,
   * 建構期一次配置、熱路徑零配置（NFR-69.5）。兩個用途:
   *   1. `suspend()` 知道該補哪幾筆 release edge;
   *   2. 讓 keyup 的採計條件與 fire/ads 對齊（「採計過 down 才送 up」）——閘關閉期間抵達的 keyup
   *      因此不會偷偷入 ring。
   */
  const heldKeys = new Uint8Array(CODE_KEY.length);

  const isGameplayInputEnabled = options.isGameplayInputEnabled ?? (() => true);
  // 預設為短路 identity（不是 `t + 0`）：後者對 -0 不是 identity，且短路讓「未 pause 逐位不變」
  // 是讀得出來的保證，而非推導出來的巧合（同 pausableTimeMapper 的 identity 短路）。
  const mapEventTime = options.mapEventTime ?? ((wallMs: number): number => wallMs);

  // ring 溢位政策（GD-2）：push* 回 false（容量滿）→ 升 bufferOverflow、拒收、不丟最舊。
  const ring = state.input;
  const meta = state.inputMeta;

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return; // 自動重複的 keydown 不入緩衝：只記真實狀態轉換（設計註記）
    const codeInt = KEY_CODE[e.code];
    if (codeInt === undefined) return; // 非採集鍵（KEY_CODE 封閉集）→ 不污染緩衝
    if (!isGameplayInputEnabled()) return; // WP-69 / T3：pause / locking / resume 倒數期間不採計
    if (!ring.pushKey(codeInt, true, mapEventTime(e.timeStamp))) {
      meta.bufferOverflow++;
      return;
    }
    heldKeys[codeInt] = 1;
  }

  /**
   * 放開：採計條件與 fire/ads 一致——**採計過對應的 down 才送 up**（WP-69 / T3）。
   * 不看 gameplay 閘：按住期間掉鎖/暫停時 `suspend()` 已補過 release 並清帳,此處自然成為 no-op;
   * 反之閘開著時 held 必為真 ⇒ 與 WP-69 之前逐字同行為。
   */
  function onKeyUp(e: KeyboardEvent): void {
    const codeInt = KEY_CODE[e.code];
    if (codeInt === undefined) return;
    if (heldKeys[codeInt] === 0) return;
    heldKeys[codeInt] = 0;
    if (!ring.pushKey(codeInt, false, mapEventTime(e.timeStamp))) meta.bufferOverflow++;
  }

  /**
   * 開火按下事件（FR-3.3 / WP-11 T2）：左鍵 mousedown 蓋 `event.timeStamp` 入緩衝。僅 Pointer Lock
   * 鎖定中採計——否則「點擊 canvas 取鎖」與 UI 點擊會被誤判為開火（設計註記 / T3 DoD）。
   */
  function onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      if (!isLocked()) return; // 未鎖定不採計（避免取鎖點擊 / UI 點擊污染量測）
      if (!isGameplayInputEnabled()) return; // WP-69 / T3：pause / resume 倒數期間不採計
      if (!ring.pushFire(true, mapEventTime(e.timeStamp))) {
        meta.bufferOverflow++;
        return;
      }
      fireButtonHeld = true;
      return;
    }
    // 右鍵 ADS 開鏡按下（WP-24 / T1，FR-E4）：比照 fire-down 走 pointer-lock 採計閘門
    // （否則取鎖前的右鍵 / UI 右鍵污染量測）；packed b=down，走既有 ring 分桶消費。
    if (e.button === 2) {
      if (!isLocked()) return;
      if (!isGameplayInputEnabled()) return; // WP-69 / T3：同 fire-down
      if (!ring.pushAds(true, mapEventTime(e.timeStamp))) {
        meta.bufferOverflow++;
        return;
      }
      adsButtonHeld = true;
    }
  }

  /**
   * 滑鼠放開事件（左鍵 fire / 右鍵 ads）：不受 `isLocked` 閘門限制；若按住期間 Esc/失焦導致解鎖，
   * mouseup 仍須送達，否則 sim 端 `heldFire`/`heldAds` 會卡住。未採計過對應 down 時不送 up，避免
   * UI 點擊放開污染資料。
   */
  function onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      if (!fireButtonHeld) return;
      fireButtonHeld = false;
      if (!ring.pushFire(false, mapEventTime(e.timeStamp))) meta.bufferOverflow++;
      return;
    }
    if (e.button === 2) {
      if (!adsButtonHeld) return;
      adsButtonHeld = false;
      if (!ring.pushAds(false, mapEventTime(e.timeStamp))) meta.bufferOverflow++;
    }
  }

  /**
   * 右鍵情境選單抑制（WP-24 / T1）：PointerLock 鎖定中 `preventDefault` 阻止瀏覽器右鍵選單彈出
   * （否則 ADS 按住手勢會被選單打斷）。未鎖定時放行（不劫持一般右鍵選單）。
   */
  function onContextMenu(e: Event): void {
    if (isLocked()) e.preventDefault();
  }

  /**
   * 滑鼠移動（FR-3.2）：以 `getCoalescedEvents()` 取回瀏覽器在單一 rAF 幀內合併的**次幀**樣本，
   * 逐一各記一筆 `{type:'mouse', dx, dy, t}`——1000 Hz 滑鼠下不遺失中間軌跡（ADR-5 / 附錄 B）。
   * 舊瀏覽器無 `getCoalescedEvents` 時 fallback 到 `[e]` 單筆（附錄 B）。
   * 每筆帶各自的 `event.timeStamp`（保留次幀時間解析度）；`movementX/Y` 在 Pointer Lock +
   * `unadjustedMovement` 下為原始位移（WP-1 T3）。與 WP-1 視角互不干擾：WP-1 走 `pointerLock.onMove`
   * 即時驅動 camera；本 task 只把樣本入緩衝供量測（兩者獨立、不在此套用視角）。
   * 僅 Pointer Lock 鎖定中採計（KI-005 / A，FR-A-8）——比照 fire-down / ads-down 的同一理由：
   * 未鎖定不採計，避免取鎖點擊 / UI 滑鼠移動污染量測；且是 tick 窗積分（T4）守恆閘的前提
   * （未鎖定時的移動若入 ring，會被積分成 camera 從未套用的角位移）。
   */
  function onPointerMove(e: PointerEvent): void {
    if (!isLocked()) return; // 未鎖定不採計（避免取鎖點擊 / UI 移動污染量測）
    // WP-69 / T3：resume 倒數期間已經重新取得鎖（`isLocked()` 為真），若只靠上面那條閘，視角與
    // 位移取樣會在倒數三秒內偷跑 ⇒ 必須有這第二條（NFR-69.4，與 camera consumer 共用同一個閘）。
    if (!isGameplayInputEnabled()) return;
    const samples = e.getCoalescedEvents?.() ?? [e];
    for (const ev of samples) {
      if (!ring.pushMouse(ev.movementX, ev.movementY, mapEventTime(ev.timeStamp))) meta.bufferOverflow++;
    }
  }

  return {
    attach(target: EventTarget): void {
      if (attached) return; // 已掛載則不重複（避免同一事件觸發多次 push）
      attached = target;
      target.addEventListener('keydown', onKeyDown as EventListener);
      target.addEventListener('keyup', onKeyUp as EventListener);
      target.addEventListener('mousedown', onMouseDown as EventListener);
      target.addEventListener('mouseup', onMouseUp as EventListener);
      target.addEventListener('contextmenu', onContextMenu as EventListener);
      target.addEventListener('pointermove', onPointerMove as EventListener);
    },
    detach(): void {
      if (!attached) return;
      attached.removeEventListener('keydown', onKeyDown as EventListener);
      attached.removeEventListener('keyup', onKeyUp as EventListener);
      attached.removeEventListener('mousedown', onMouseDown as EventListener);
      attached.removeEventListener('mouseup', onMouseUp as EventListener);
      attached.removeEventListener('contextmenu', onContextMenu as EventListener);
      attached.removeEventListener('pointermove', onPointerMove as EventListener);
      attached = null;
      fireButtonHeld = false;
      adsButtonHeld = false;
      heldKeys.fill(0);
    },
    releaseAds(t: number): void {
      if (!adsButtonHeld) return; // 未按住 → no-op（比照 stuck-fire：只在已採計 down 後補 up）
      adsButtonHeld = false;
      if (!ring.pushAds(false, mapEventTime(t))) meta.bufferOverflow++;
    },
    suspend(atWallMs: number): void {
      const t = mapEventTime(atWallMs);
      // 順序 = key → fire → ads，全部蓋同一個 `t`。ring 的 bounded insertion 對相等時間戳是
      // stable（相等不換槽）⇒ 消費端看到的就是這個到達順序，不依賴排序穩定性以外的假設。
      for (let codeInt = 0; codeInt < heldKeys.length; codeInt += 1) {
        if (heldKeys[codeInt] === 0) continue;
        heldKeys[codeInt] = 0;
        if (!ring.pushKey(codeInt, false, t)) meta.bufferOverflow++;
      }
      if (fireButtonHeld) {
        fireButtonHeld = false;
        if (!ring.pushFire(false, t)) meta.bufferOverflow++;
      }
      if (adsButtonHeld) {
        adsButtonHeld = false;
        if (!ring.pushAds(false, t)) meta.bufferOverflow++;
      }
    },
  };
}
