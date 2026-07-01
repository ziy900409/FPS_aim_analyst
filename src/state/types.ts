/**
 * 三迴圈共享狀態的資料型別 — WP-2 / T1（FR-2.1）
 *
 * 純型別宣告、無執行邏輯（單例與 reset 見 SharedState.ts）。本 task 只立結構，
 * 多數欄位由後續 WP 寫入（input → WP-3、targets/tVisible → WP-4）。
 *
 * 單位：位置/velocity 一律 **CS Source unit（u、u/s）**（CONTEXT「正規單位」）；
 * sim 與匯出資料不得用公尺。
 */

/**
 * 輸入事件（discriminated union）。`t` = 事件時間戳，取自 `event.timeStamp`，與
 * `performance.now()` 同 time origin（量測時鐘域，ADR-7 two-clock）。
 *
 * 本 task 為佔位型別：WP-2 用合成事件、WP-3 用真實 `InputSampler` 寫入。WP-3 的
 * ring buffer 會把每個事件壓成固定數值欄位（CONTEXT「ring buffer」），此 union 為其邏輯視圖。
 */
export type InputEvent =
  | { type: 'key'; code: string; down: boolean; t: number } // 鍵盤：code=KeyboardEvent.code、down=true 為 keydown
  | { type: 'mouse'; dx: number; dy: number; t: number } //     滑鼠 delta（movementX/Y）→ 準心
  | { type: 'fire'; t: number }; //                            開火事件（simStep 內就地 raycast，WP-5）

/**
 * 輸入消費 metadata（WP-3 / T4，FR-3.4）。sim 端 `consume`（[consume.ts](../input/consume.ts)）維護。
 *
 * 目前只承載遲到事件計數（GD-2 研究 metadata）與 consume 的內部低水位游標。溢位計數
 * `bufferOverflow`（GD-2）待固定欄位 ring buffer 就緒後於後續切片（T4b）加入——本階段仍為
 * plain array 佔位、無靜態容量，故無溢位語意。
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
 * 目標狀態（WP-4 寫入；本 task 先立空結構）。
 * 階段 A 單一 hitbox（CONTEXT `HitDetector`）；WP-4 視需要擴充（左右側、hitbox 尺寸等）。
 */
export interface TargetState {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean; // 可見/存活；P2 推進政策下命中才撤（WP-4/WP-5）
}
