import type { SharedState } from '../state/SharedState.ts';
import type { InputEvent, InputEventView } from '../state/types.ts';

/**
 * consume — WP-3 / T4（FR-3.4，sim 依時序消費輸入緩衝 + 排空）；T4b 換固定欄位 ring 游標排空。
 *
 * sim 在每個 tick 呼叫 `consume(state, tickEndMs, handle)`：取落在本 tick 邏輯窗
 * `[tickStart, untilT)` 的事件（**半開窗、嚴格 `<`**，GD-3）、依 `t` **升冪**逐一交付 `handle`、
 * 並從緩衝**排空**（保留 `t >= untilT` 者待下一 tick）。
 *
 * 決定性根源（ADR-7 / §6）：事件落哪個 tick 只由 `timeStamp` 與固定 tick 邊界決定，與 render
 * FPS、與事件寫入順序皆無關。邊界必須與 WP-2 佔位一致的嚴格 `<`——`t == untilT` 落**下一** tick；
 * 若漂移成 `<=`，`t == tickEndMs` 事件早一 tick 消費 → 破壞 M1 決定性回歸。
 *
 * 排序責任（D-3b，T4b）：ring 的**寫入端**（`InputSampler` 的 `push*`）以 bounded insertion 保序
 * （`event.timeStamp` 近單調 → append 近有序，罕見亂序就地小範圍前移修正）。故 consume **不**再每
 * tick 收集到期子集 + `sort` scratch（T4 佔位 array 階段的作法）：ring 從 head 起即升冪，直接沿
 * head 排空 `peekT() < untilT` 者即可，零每-tick 配置（守 GC 紀律，CLAUDE.md §4）。
 *
 * 遲到事件（GD-2）：`t` 早於上次已關閉 tick 窗邊界（`inputMeta.lastConsumedT`，= 當前最舊未消費
 * tick 窗起點）者，經寫入端 bounded insertion 前移至 head 端，仍**夾進當前最舊 tick 一併消費**
 * （不丟棄）並計入 `lateEventCount`。逐 tick exact 決定性只涵蓋預排序合成事件路徑；遲到路徑本質
 * wall-clock 相依、非決定性。
 */

/**
 * **單一重用** view（模組層級、跨所有 tick/事件重用）：`dequeueInto` 就地把 head packed 槽位解碼進此
 * 物件、交付 `handle`。⚠️ handle 須同步讀取、**不得保留參考**——下一事件會覆寫同一物件（型別契約見
 * [`InputEventView`](../state/types.ts)）。JS 單執行緒 + consume 同步排空 → 重用安全、零每事件配置。
 */
const view: InputEventView = { type: 'key', code: '', down: false, dx: 0, dy: 0, t: 0 };

export function consume(
  state: SharedState,
  untilT: number,
  handle: (ev: InputEvent) => void,
): void {
  const ring = state.input;
  const meta = state.inputMeta;

  // ring 從 head 即升冪（寫入端保序）→ 沿 head 排空到期事件（半開窗嚴格 `<`，GD-3）。
  while (!ring.isEmpty() && ring.peekT() < untilT) {
    ring.dequeueInto(view); // 就地解碼進重用 view + 推進 head（不配置物件）
    // 遲到（GD-2）：t 早於上次已關閉 tick 窗邊界 → 已被夾進本次消費，計數但不丟棄。
    if (view.t < meta.lastConsumedT) meta.lateEventCount++;
    handle(view as unknown as InputEvent); // 邏輯視圖；handle 同步讀取、不得保留參考
  }

  meta.lastConsumedT = untilT; // 推進低水位：下次早於此邊界者為遲到
}
