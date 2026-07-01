import type { SharedState } from '../state/SharedState.ts';
import type { InputEvent } from '../state/types.ts';

/**
 * consume — WP-3 / T4（FR-3.4，sim 依時序消費輸入緩衝 + 排空）
 *
 * sim 在每個 tick 呼叫 `consume(state, tickEndMs, handle)`：取落在本 tick 邏輯窗
 * `[tickStart, untilT)` 的事件（**半開窗、嚴格 `<`**，GD-3）、依 `t` **升冪**逐一交付 `handle`、
 * 並從緩衝**排空**（保留 `t >= untilT` 者待下一 tick）。
 *
 * 決定性根源（ADR-7 / §6）：事件落哪個 tick 只由 `timeStamp` 與固定 tick 邊界決定，與 render
 * FPS、與事件 push 順序皆無關。邊界必須與 WP-2 佔位一致的嚴格 `<`——`t == untilT` 落**下一** tick；
 * 若漂移成 `<=`，`t == tickEndMs` 事件早一 tick 消費 → 破壞 M1 決定性回歸。
 *
 * 排序責任（D-3b）：consume **不**每 tick 全排序整個 buffer。理想上採集端（T1–T3）保序寫入
 * （`event.timeStamp` 近單調 → append 近有序）；但目前為到達順序 plain `push`（尚未實作寫入端
 * bounded insertion），故此處對**本 tick 到期子集**做局部排序（小範圍、非整 buffer）補齊「亂序 →
 * 升冪交付」。局部排序的 scratch 配置在佔位 array 階段可接受；GC-strict 的 ring buffer 槽位重用版
 * 屬後續切片（T4b）。
 *
 * 遲到事件（GD-2）：`t` 早於上次已關閉 tick 窗邊界（`inputMeta.lastConsumedT`，= 當前最舊未消費
 * tick 窗起點）者，仍**夾進當前最舊 tick 一併消費**（不丟棄）並計入 `lateEventCount`。逐 tick exact
 * 決定性只涵蓋預排序合成事件路徑；遲到路徑本質 wall-clock 相依、非決定性。
 */
export function consume(
  state: SharedState,
  untilT: number,
  handle: (ev: InputEvent) => void,
): void {
  const buf = state.input;
  const meta = state.inputMeta;

  // 一趟掃描：到期事件（t < untilT）收進 due；其餘（t >= untilT）就地壓實回 buf 前段留待下一 tick。
  // write <= read 恆成立 → 壓實不會覆寫尚未讀取的元素。
  const due: InputEvent[] = [];
  let write = 0;
  for (let read = 0; read < buf.length; read++) {
    const ev = buf[read];
    if (ev.t < untilT) {
      due.push(ev);
    } else {
      buf[write++] = ev;
    }
  }
  buf.length = write; // 排空已到期事件（原地縮長、保留同一陣列參考，不 realloc）

  // 局部窗排序（D-3b）：僅排序本 tick 到期子集、非整 buffer。V8 sort 為 stable → 同 t 保留到達順序。
  due.sort((a, b) => a.t - b.t);

  for (let i = 0; i < due.length; i++) {
    const ev = due[i];
    // 遲到（GD-2）：t 早於上次已關閉 tick 窗邊界 → 已被夾進本次消費，計數但不丟棄。
    if (ev.t < meta.lastConsumedT) meta.lateEventCount++;
    handle(ev);
  }

  meta.lastConsumedT = untilT; // 推進低水位：下次早於此邊界者為遲到
}