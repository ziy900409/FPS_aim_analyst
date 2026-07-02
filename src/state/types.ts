/**
 * 三迴圈共享狀態的資料型別 — WP-2 / T1（FR-2.1）
 *
 * 型別宣告 + 輸入緩衝的 **packed 編碼常數**（`RING_CAPACITY` / 事件 type 碼 / key code enum）；
 * ring 的執行實作（typed-array 槽位、游標、bounded insertion）見 [SharedState.ts](./SharedState.ts)
 * 的 `createInputRing`。多數欄位由後續 WP 寫入（targets/tVisible → WP-4）。
 *
 * 單位：位置/velocity 一律 **CS Source unit（u、u/s）**（CONTEXT「正規單位」）；
 * sim 與匯出資料不得用公尺。
 */

/**
 * 輸入事件（discriminated union）。`t` = 事件時間戳，取自 `event.timeStamp`，與
 * `performance.now()` 同 time origin（量測時鐘域，ADR-7 two-clock）。
 *
 * 這是 ring buffer 的**邏輯視圖**：固定欄位 ring 把每個事件壓成 packed 數值槽位
 * `type,t,a,b`（CONTEXT「ring buffer」），`consume` 交付時就地解碼進**單一重用的**
 * `InputEventView`（見下）再 cast 成本 union——handle 須**同步讀取、不得保留參考**。
 */
export type InputEvent =
  | { type: 'key'; code: string; down: boolean; t: number } // 鍵盤：code=KeyboardEvent.code、down=true 為 keydown
  | { type: 'mouse'; dx: number; dy: number; t: number } //     滑鼠 delta（movementX/Y）→ 準心
  | { type: 'fire'; t: number }; //                            開火事件（simStep 內就地 raycast，WP-5）

/**
 * 輸入緩衝靜態容量（OQ-3.2 / CONTEXT「輸入分桶」容量政策）：
 * `RING_CAPACITY = nextPow2(MAX_EVENT_RATE_HZ × MAX_STALL_S × SAFETY)`。
 * 階段 A：~1000Hz（滑鼠 coalesced）× 0.25s（accumulator spiral 夾除上限）× 2 safety = 500 →
 * next-pow2 **512**。2 的冪 → 游標繞圈用 `& (CAP-1)` 位遮罩；**執行期不動態 resize**（resize 會在
 * burst 當下 realloc+copy，正是 ring 要消除的 GC 抖動；溢位由 `bufferOverflow` 兜底，見 CONTEXT）。
 */
export const RING_CAPACITY = 512;

/** packed 槽位 `type` 欄位編碼（小整數，不存字串）。 */
export const EV_KEY = 0;
export const EV_MOUSE = 1;
export const EV_FIRE = 2;

/**
 * key 事件 `code` 編碼（`KeyboardEvent.code` 封閉集 → 小整數 enum；packed 槽位存整數不存字串）。
 * A/D = 橫移；W/S 預留（階段 A 未用移動）。`CODE_KEY` 為反向表（解碼進 view 用）；兩者須同序。
 */
export const KEY_CODE: Readonly<Record<string, number>> = { KeyA: 0, KeyD: 1, KeyW: 2, KeyS: 3 };
export const CODE_KEY: readonly string[] = ['KeyA', 'KeyD', 'KeyW', 'KeyS'];

/**
 * 固定欄位輸入 ring buffer（真環狀、靜態容量、槽位重用、熱路徑不配置物件；CLAUDE.md §4 / OQ-3.2）。
 *
 * 表示法：並行 typed-array 槽位 `type,t,a,b`——key: a=code enum、b=down(0/1)；mouse: a=dx、b=dy；
 * fire 無 payload。`head`/`count` 游標繞圈（`& (CAP-1)`），寫入端 **bounded insertion 保序**
 * （`event.timeStamp` 近單調 → append 近有序，罕見亂序就地小範圍前移修正），故 `consume` 只需
 * 從 head 依序排空、**無需每 tick 排序 scratch**（守 GC 紀律，D-3b）。
 *
 * 溢位（GD-2「不靜默丟最舊」）：容量滿時 `push*` 回 `false`（**拒收新事件**，不覆寫尚未消費的最舊
 * 槽），由呼叫端升 `inputMeta.bufferOverflow`（研究 metadata，WP-7 匯出）。
 */
export interface InputRing {
  /** 目前緩衝內未消費事件數。 */
  size(): number;
  /** 是否空（`size() === 0` 的便捷判定）。 */
  isEmpty(): boolean;
  /** head（最舊未消費）事件的時間戳；**僅在非空時有意義**（呼叫端須先 `isEmpty()` 判定）。 */
  peekT(): number;
  /** 寫入 key 事件（bounded insertion 保序）；滿則回 `false`（拒收、不丟最舊）。 */
  pushKey(codeInt: number, down: boolean, t: number): boolean;
  /** 寫入 mouse delta 事件（bounded insertion 保序）；滿則回 `false`。 */
  pushMouse(dx: number, dy: number, t: number): boolean;
  /** 寫入 fire 事件（bounded insertion 保序）；滿則回 `false`。 */
  pushFire(t: number): boolean;
  /**
   * 把 head 槽位就地解碼進**呼叫端提供的重用 view**、推進 head（`count--`）。空時為 no-op（防呆；
   * 呼叫端仍應先 `isEmpty()` 判定）。view 為單一重用物件（避免每事件配置）；handle 須同步讀取、
   * **不得保留參考**（下一次覆寫）。
   */
  dequeueInto(view: InputEventView): void;
  /** 原地清空（`head=0`/`count=0`）：重用既有 typed-array、**不 realloc**（GC 紀律；重開 drill / reset）。 */
  clear(): void;
}

/**
 * `consume` 交付用的**單一重用** view（packed 槽位就地解碼目標）。含 union 所有可能欄位，交付前
 * cast 成 [`InputEvent`](#InputEvent)。⚠️ handle 須同步讀取、**不得保留參考**——下一事件會覆寫同一物件。
 */
export interface InputEventView {
  type: 'key' | 'mouse' | 'fire';
  code: string; // key: 解碼自 code enum；mouse/fire 未定義語意（handle 依 type 分辨）
  down: boolean; // key: keydown=true；其餘忽略
  dx: number; // mouse: movementX；其餘忽略
  dy: number; // mouse: movementY；其餘忽略
  t: number; // 事件時間戳（量測時鐘域）
}

/**
 * 輸入消費 metadata（WP-3 / T4+T4b，FR-3.4）。sim 端 `consume`（[consume.ts](../input/consume.ts)）
 * 維護 `lateEventCount`/`lastConsumedT`；`InputSampler` 寫入端維護 `bufferOverflow`。三者皆 GD-2 研究
 * metadata（`lastConsumedT` 除外，為 consume 內部游標，不匯出）。
 */
export interface InputMeta {
  /**
   * 遲到事件累計（GD-2 metadata，WP-7 匯出）：`t` 早於已關閉 tick 窗起點、被夾進當前最舊 tick
   * 一併消費者（非丟棄）。逐 tick 決定性只涵蓋預排序路徑；遲到本質 wall-clock 相依、非決定性。
   */
  lateEventCount: number;
  /**
   * consume 內部游標：上次 `consume` 的 `untilT`（低水位邊界 = 當前最舊未消費 tick 窗起點），
   * 用於偵測遲到事件。初始 `-Infinity`（首 tick 不誤判）。非匯出語意、不入研究資料。
   */
  lastConsumedT: number;
  /**
   * ring buffer 溢位累計（GD-2 metadata，WP-7 匯出）：容量滿時拒收的新事件數（**不靜默丟最舊**）。
   * 由 `InputSampler` 寫入端在 `push*` 回 `false` 時遞增；`> 0` 標示該 drill suspect。
   */
  bufferOverflow: number;
}

/**
 * 玩家位置快照，供 RenderLoop 在兩個 sim tick 間做 alpha 內插（T3）。
 * 只含可內插的位置；朝向由 CameraController 走 render/輸入路徑、不入 sim（雙迴圈邊界）。
 */
export interface PlayerSnapshot {
  x: number;
  z: number;
}

/**
 * 3D 座標（source unit，u）。目標位置與 motion waypoints 用；玩家快照只需 x/z（見
 * PlayerSnapshot，2D 雙迴圈邊界），故兩者不共用型別。
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 目標移動策略資料（F5 接縫，規格附錄 G / ADR-6）。
 *
 * **階段 A 不實作移動**：省略 `motion` 即靜止（向後相容）。此型別先立、供 WP-6 drill config
 * 與未來 motion registry 消費；屆時 `SimLoop` 每 tick 依 `age` 更新目標 `pos`、排在命中判定之前。
 */
export interface TargetMotion {
  type: 'static' | 'linear' | 'pingpong' | 'sine' | 'waypoints';
  speed?: number; //     u/s（source unit）
  axis?: 'horizontal' | 'vertical';
  range?: number; //     擺盪範圍（u；pingpong / sine 用）
  waypoints?: Vec3[]; // waypoints 用
  spawnKind?: 'pop-in' | 'slide-in'; // 影響 t_visible 語意（規格 §5 註）；預設 pop-in
}

/**
 * 目標狀態（WP-4 寫入）。階段 A **單一 hitbox**（H1，CONTEXT `HitDetector`）：命中/未命中，
 * `hitbox.part` 選填保留（頭/身分解延後、向後相容）。左右交替 peek 槽位由 `side` 標記（T3）。
 *
 * 可見性語意分兩軸、不可合併為單一布林：`visible`（是否已 spawn／在視野內——決定 render 顯示
 * 與 `t_visible` 蓋戳，T2）與 `alive`（是否未被擊殺——P2 推進政策下命中才撤，T3/WP-5）。
 *
 * `pos` 為 3D（目標有高度 y）；`motion?`/`age?` 為 F5 接縫（省略＝static，見 TargetMotion）。
 *
 * 註：欄位形狀對齊 WP-4 exec-plan README §2 interface contract。`hitbox` 具體採 **box**
 * （width/height/depth，source unit）——供 T1 mesh（`BoxGeometry`）與 WP-5 raycast（`Box3`）
 * 同來源衍生，確保視覺與判定一致（README failure-mode「hitbox 與 mesh 不一致」）。
 */
export interface TargetState {
  id: string;
  side: 'L' | 'R'; //                     左右交替 peek 槽位（T3）
  pos: Vec3; //                           世界座標（source unit，u）
  visible: boolean; //                    是否可見（決定 render 顯示 + t_visible 蓋戳，T2）
  alive: boolean; //                      是否未被擊殺（P2：命中才撤，WP-5）
  hitbox: { width: number; height: number; depth: number; part?: 'head' | 'body' }; // 單一 box hitbox（H1）；part 選填保留
  motion?: TargetMotion; //               F5 接縫：省略＝static
  age?: number; //                        自 spawn 起的邏輯秒數（sim tick 累加；motion 用）
}
