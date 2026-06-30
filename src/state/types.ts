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
