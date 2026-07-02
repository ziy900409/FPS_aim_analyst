import type {
  InputEventView,
  InputMeta,
  InputRing,
  PlayerSnapshot,
  TargetState,
} from './types.ts';
import { CODE_KEY, EV_FIRE, EV_KEY, EV_MOUSE, RING_CAPACITY } from './types.ts';

/**
 * SharedState — WP-2 / T1（FR-2.1）
 *
 * 三迴圈（input / sim / render）的**唯一**溝通管道（ADR-2）：input 寫入緩衝、sim 消費並
 * 推進 player/targets、render 唯讀 prev/curr 做內插。三者互不直接呼叫。
 *
 * GC 紀律（CLAUDE.md §4）：輸入緩衝 = 固定欄位真 ring（見 `createInputRing`）；position/velocity 用
 * plain number 欄位、不在熱路徑配置 vector；`resetState` **原地**清空、重用既有物件/陣列，不 realloc。
 */
export interface SharedState {
  /** 輸入緩衝：固定欄位 ring buffer（真環狀、靜態容量、消費後槽位重用；CLAUDE.md §4 / OQ-3.2）。 */
  input: InputRing;
  /** 輸入消費 metadata（T4/T4b）：遲到事件計數 + consume 低水位游標 + ring 溢位計數。 */
  inputMeta: InputMeta;
  /** 玩家即時狀態，由 simStep 推進（u / u·s⁻¹，canonical unit）。 */
  player: { vx: number; vz: number; x: number; z: number };
  /** 內插用雙快照：sim 每 tick 末更新，render 以 alpha 在 prev→curr 間 lerp（T3）。 */
  prev: PlayerSnapshot;
  curr: PlayerSnapshot;
  /** 準心瞄準狀態（WP-3 由滑鼠樣本寫入、WP-5 raycast 消費；本 task 佔位、語意待該二 WP 定）。 */
  crosshair: { cx: number; cy: number };
  /** 目標清單（WP-4 寫入；先空）。 */
  targets: TargetState[];
  /** 各目標可見瞬間的 `performance.now()` 時間戳（量測時鐘域，WP-4 寫入；先空）。 */
  tVisible: Map<string, number>;
}

/**
 * 建固定欄位輸入 ring（[`InputRing`](./types.ts)）。並行 typed-array 槽位 `type,t,a,b`、`head`/`count`
 * 游標繞圈（`& MASK`，`RING_CAPACITY` 為 2 的冪）、槽位重用、**熱路徑不配置物件**（CLAUDE.md §4）。
 *
 * 寫入端 **bounded insertion 保序**（D-3b）：append 到 tail 後，若 `t` 小於前一槽（罕見亂序）就地
 * 往 head 方向前移交換，直到升冪或抵 head——`event.timeStamp` 近單調故近 O(1)。使 `consume` 只需從
 * head 排空、免每 tick 排序 scratch。溢位（GD-2）：滿則 `push*` 回 `false`（拒收、不覆寫最舊槽）。
 */
export function createInputRing(): InputRing {
  const MASK = RING_CAPACITY - 1; // RING_CAPACITY 為 2 的冪 → 繞圈用位遮罩
  const typeArr = new Uint8Array(RING_CAPACITY); // packed: 事件 type 碼（EV_KEY/EV_MOUSE/EV_FIRE）
  const tArr = new Float64Array(RING_CAPACITY); //  packed: 時間戳（量測時鐘域，float 精確）
  const aArr = new Float64Array(RING_CAPACITY); //  packed a: key→code enum / mouse→dx
  const bArr = new Float64Array(RING_CAPACITY); //  packed b: key→down(0/1) / mouse→dy
  let head = 0; //  最舊未消費槽位的物理索引
  let count = 0; // 未消費事件數（tail 物理索引 = (head + count) & MASK）

  /** 交換兩物理槽位的全部欄位（bounded insertion 前移用）。 */
  function swap(i: number, j: number): void {
    const ty = typeArr[i]; typeArr[i] = typeArr[j]; typeArr[j] = ty;
    const t = tArr[i]; tArr[i] = tArr[j]; tArr[j] = t;
    const a = aArr[i]; aArr[i] = aArr[j]; aArr[j] = a;
    const b = bArr[i]; bArr[i] = bArr[j]; bArr[j] = b;
  }

  /**
   * append 一槽 + bounded insertion 保序。滿（count === CAPACITY）回 `false`（拒收、不丟最舊）。
   * 新槽落 tail，若 `t` < 前一槽則就地往 head 方向交換前移，直到升冪或抵 head。
   */
  function enqueue(type: number, t: number, a: number, b: number): boolean {
    if (count === RING_CAPACITY) return false; // 滿：溢位由呼叫端計 bufferOverflow（GD-2）
    let cur = (head + count) & MASK; // tail 物理索引
    typeArr[cur] = type;
    tArr[cur] = t;
    aArr[cur] = a;
    bArr[cur] = b;
    count++;
    while (cur !== head) {
      const prev = (cur - 1) & MASK;
      if (tArr[cur] < tArr[prev]) {
        swap(cur, prev); // 罕見亂序：前移至升冪位（stable：相等不換 → 保到達順序）
        cur = prev;
      } else break;
    }
    return true;
  }

  return {
    size: () => count,
    isEmpty: () => count === 0,
    peekT: () => tArr[head], // 呼叫端須先 isEmpty() 判定；空時值無意義
    pushKey: (codeInt, down, t) => enqueue(EV_KEY, t, codeInt, down ? 1 : 0),
    pushMouse: (dx, dy, t) => enqueue(EV_MOUSE, t, dx, dy),
    pushFire: (t) => enqueue(EV_FIRE, t, 0, 0),
    dequeueInto(view: InputEventView): void {
      if (count === 0) return; // 空防呆：勿讀殘值/推進 head/使 count 變負（呼叫端仍應先 isEmpty()）
      const i = head;
      const ty = typeArr[i];
      view.t = tArr[i];
      if (ty === EV_KEY) {
        view.type = 'key';
        view.code = CODE_KEY[aArr[i]];
        view.down = bArr[i] === 1;
      } else if (ty === EV_MOUSE) {
        view.type = 'mouse';
        view.dx = aArr[i];
        view.dy = bArr[i];
      } else {
        view.type = 'fire';
      }
      head = (head + 1) & MASK; // 推進 head、槽位留待繞圈重用（不清值）
      count--;
    },
    clear(): void {
      head = 0;
      count = 0; // 原地歸零游標；typed-array 不 realloc、殘值待覆寫（GC 紀律）
    },
  };
}

/** 建一份全零的獨立 SharedState。app 用下方單例；測試（T4 決定性）以此取獨立實例比對不同 FPS。 */
export function createSharedState(): SharedState {
  return {
    input: createInputRing(),
    inputMeta: { lateEventCount: 0, lastConsumedT: -Infinity, bufferOverflow: 0 },
    player: { vx: 0, vz: 0, x: 0, z: 0 },
    prev: { x: 0, z: 0 },
    curr: { x: 0, z: 0 },
    crosshair: { cx: 0, cy: 0 },
    targets: [],
    tVisible: new Map(),
  };
}

/** 應用程式單例：三迴圈唯一溝通管道。 */
export const sharedState: SharedState = createSharedState();

/**
 * 原地重置（測試 / 重開 drill）。清空緩衝、歸零 player/快照/準心、清空目標與 tVisible。
 * 重用既有物件與陣列（不 realloc）以守 GC 紀律；預設作用於單例。
 */
export function resetState(state: SharedState = sharedState): void {
  state.input.clear(); // 原地歸零 ring 游標、重用同一 typed-array（不 realloc，GC 紀律）
  state.inputMeta.lateEventCount = 0; // 原地歸零、重用既有 inputMeta 物件（GC 紀律）
  state.inputMeta.lastConsumedT = -Infinity;
  state.inputMeta.bufferOverflow = 0;
  state.player.vx = 0;
  state.player.vz = 0;
  state.player.x = 0;
  state.player.z = 0;
  state.prev.x = 0;
  state.prev.z = 0;
  state.curr.x = 0;
  state.curr.z = 0;
  state.crosshair.cx = 0;
  state.crosshair.cy = 0;
  state.targets.length = 0;
  state.tVisible.clear();
}
