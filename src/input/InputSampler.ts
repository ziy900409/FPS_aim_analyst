import type { SharedState } from '../state/SharedState.ts';
import { KEY_CODE } from '../state/types.ts';

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
   */
  releaseAds(t: number): void;
}

/**
 * @param isLocked 開火採計閘門：僅 Pointer Lock 鎖定中才記 fire（見 onMouseDown）。注入以維持
 *   可測性（本專案慣例，D-T1.1）；main 傳 `() => pointerLock.locked`（[PointerLock.ts] 為權威狀態）。
 *   預設 `() => true`：sampler 單獨使用時不閘門（與鍵盤一致，鍵盤/滑鼠不受此閘門影響）。
 */
export function createInputSampler(
  state: SharedState,
  isLocked: () => boolean = () => true,
): InputSampler {
  let attached: EventTarget | null = null;
  let fireButtonHeld = false;
  let adsButtonHeld = false; // 右鍵 ADS 按住狀態（WP-24 / T1）：比照 fireButtonHeld，用於 up 補送與 stuck 防護

  // ring 溢位政策（GD-2）：push* 回 false（容量滿）→ 升 bufferOverflow、拒收、不丟最舊。
  const ring = state.input;
  const meta = state.inputMeta;

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return; // 自動重複的 keydown 不入緩衝：只記真實狀態轉換（設計註記）
    const codeInt = KEY_CODE[e.code];
    if (codeInt === undefined) return; // 非採集鍵（KEY_CODE 封閉集）→ 不污染緩衝
    if (!ring.pushKey(codeInt, true, e.timeStamp)) meta.bufferOverflow++;
  }

  function onKeyUp(e: KeyboardEvent): void {
    const codeInt = KEY_CODE[e.code];
    if (codeInt === undefined) return;
    if (!ring.pushKey(codeInt, false, e.timeStamp)) meta.bufferOverflow++;
  }

  /**
   * 開火按下事件（FR-3.3 / WP-11 T2）：左鍵 mousedown 蓋 `event.timeStamp` 入緩衝。僅 Pointer Lock
   * 鎖定中採計——否則「點擊 canvas 取鎖」與 UI 點擊會被誤判為開火（設計註記 / T3 DoD）。
   */
  function onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      if (!isLocked()) return; // 未鎖定不採計（避免取鎖點擊 / UI 點擊污染量測）
      if (!ring.pushFire(true, e.timeStamp)) {
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
      if (!ring.pushAds(true, e.timeStamp)) {
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
      if (!ring.pushFire(false, e.timeStamp)) meta.bufferOverflow++;
      return;
    }
    if (e.button === 2) {
      if (!adsButtonHeld) return;
      adsButtonHeld = false;
      if (!ring.pushAds(false, e.timeStamp)) meta.bufferOverflow++;
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
    const samples = e.getCoalescedEvents?.() ?? [e];
    for (const ev of samples) {
      if (!ring.pushMouse(ev.movementX, ev.movementY, ev.timeStamp)) meta.bufferOverflow++;
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
    },
    releaseAds(t: number): void {
      if (!adsButtonHeld) return; // 未按住 → no-op（比照 stuck-fire：只在已採計 down 後補 up）
      adsButtonHeld = false;
      if (!ring.pushAds(false, t)) meta.bufferOverflow++;
    },
  };
}
