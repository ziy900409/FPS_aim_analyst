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
