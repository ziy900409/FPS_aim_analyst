import type { SharedState } from '../state/SharedState.ts';

/**
 * InputSampler — WP-3 / T1（FR-3.1，鍵盤部分）
 *
 * 事件驅動採集（~1000 Hz，ADR-2 三速率之最快者）：把 keydown/keyup 蓋上高解析度
 * `event.timeStamp`（與 `performance.now()` 同 time origin，ADR-4/7；禁 `Date.now()`）
 * 寫入 `SharedState.input`——精準度的真正來源是這層的 sub-tick 時間戳，不是 sim tick 頻率
 * （規格 ADR-3）。sim 端（T4）再依 timeStamp 排序消費。
 *
 * T1（鍵盤）+ T3（開火 mousedown）已就緒；本切片 T2 補上滑鼠 `pointermove` 的 coalesced
 * 次幀採樣（FR-3.2）。三類事件（key/fire/mouse）append 進同一 sampler。
 * `state.input` 目前仍是 WP-2 佔位 plain array（`push` 依到達順序 append，`event.timeStamp`
 * 近單調 ⇒ 近有序，滿足 T4 consume 的保序前提，GD-3/D-3b）；換固定欄位 ring buffer 屬後續切片。
 */

/**
 * 採集的按鍵集合（`KeyboardEvent.code`，非 `key`：避開鍵盤 layout 差異，設計註記）。
 * A/D = 橫移（反向語意在 WP-5 急停判定，OQ-3.1）；W/S 預留（前後移動，階段 A 未用）。
 * 只收這些鍵 → 打字/快捷鍵不污染量測緩衝、守 GC 紀律（不 push 無關事件）。
 */
const SAMPLED_KEYS: ReadonlySet<string> = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS']);

export interface InputSampler {
  /**
   * 掛上事件監聽。鍵盤事件實務上落在 `window`/`document`（非某個 HTMLElement），故 target 型別
   * 放寬為 `EventTarget`（`Window`/`Document`/`HTMLElement` 皆滿足；偏離 README 原 `HTMLElement`，
   * 見 progress D-T1.1）。冪等：重複 `attach` 不疊聽。
   */
  attach(target: EventTarget): void;
  detach(): void;
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

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return; // 自動重複的 keydown 不入緩衝：只記真實狀態轉換（設計註記）
    if (!SAMPLED_KEYS.has(e.code)) return;
    state.input.push({ type: 'key', code: e.code, down: true, t: e.timeStamp });
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (!SAMPLED_KEYS.has(e.code)) return;
    state.input.push({ type: 'key', code: e.code, down: false, t: e.timeStamp });
  }

  /**
   * 開火事件（FR-3.3）：左鍵 mousedown 蓋 `event.timeStamp` 入緩衝。命中/首發判定不在此（→ WP-5，
   * sim 消費 fire 時就地 raycast）。僅 Pointer Lock 鎖定中採計——否則「點擊 canvas 取鎖」與 UI 點擊
   * 會被誤判為開火（設計註記 / T3 DoD）。
   */
  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // 只記主鍵（左鍵）開火；其餘鍵不入緩衝
    if (!isLocked()) return; // 未鎖定不採計（避免取鎖點擊 / UI 點擊污染量測）
    state.input.push({ type: 'fire', t: e.timeStamp });
  }

  /**
   * 滑鼠移動（FR-3.2）：以 `getCoalescedEvents()` 取回瀏覽器在單一 rAF 幀內合併的**次幀**樣本，
   * 逐一各記一筆 `{type:'mouse', dx, dy, t}`——1000 Hz 滑鼠下不遺失中間軌跡（ADR-5 / 附錄 B）。
   * 舊瀏覽器無 `getCoalescedEvents` 時 fallback 到 `[e]` 單筆（附錄 B）。
   * 每筆帶各自的 `event.timeStamp`（保留次幀時間解析度）；`movementX/Y` 在 Pointer Lock +
   * `unadjustedMovement` 下為原始位移（WP-1 T3）。與 WP-1 視角互不干擾：WP-1 走 `pointerLock.onMove`
   * 即時驅動 camera；本 task 只把樣本入緩衝供量測（兩者獨立、不在此套用視角）。
   */
  function onPointerMove(e: PointerEvent): void {
    const samples = e.getCoalescedEvents?.() ?? [e];
    for (const ev of samples) {
      state.input.push({ type: 'mouse', dx: ev.movementX, dy: ev.movementY, t: ev.timeStamp });
    }
  }

  return {
    attach(target: EventTarget): void {
      if (attached) return; // 已掛載則不重複（避免同一事件觸發多次 push）
      attached = target;
      target.addEventListener('keydown', onKeyDown as EventListener);
      target.addEventListener('keyup', onKeyUp as EventListener);
      target.addEventListener('mousedown', onMouseDown as EventListener);
      target.addEventListener('pointermove', onPointerMove as EventListener);
    },
    detach(): void {
      if (!attached) return;
      attached.removeEventListener('keydown', onKeyDown as EventListener);
      attached.removeEventListener('keyup', onKeyUp as EventListener);
      attached.removeEventListener('mousedown', onMouseDown as EventListener);
      attached.removeEventListener('pointermove', onPointerMove as EventListener);
      attached = null;
    },
  };
}
