import type { InputEvent, PlayerSnapshot, TargetState } from './types.ts';

/**
 * SharedState — WP-2 / T1（FR-2.1）
 *
 * 三迴圈（input / sim / render）的**唯一**溝通管道（ADR-2）：input 寫入緩衝、sim 消費並
 * 推進 player/targets、render 唯讀 prev/curr 做內插。三者互不直接呼叫。
 *
 * 本 task 只立結構與單例；多數欄位由後續 WP 寫入（input → WP-3、targets/tVisible → WP-4）。
 * GC 紀律（CLAUDE.md §4）：position/velocity 用 plain number 欄位、不在熱路徑配置 vector；
 * `resetState` **原地**清空、重用既有物件/陣列，不 realloc。
 */
export interface SharedState {
  /** 輸入緩衝。本 task 為 plain array 佔位；WP-3 換成固定欄位 ring buffer（真環狀、消費後槽位重用）。 */
  input: InputEvent[];
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

/** 建一份全零的獨立 SharedState。app 用下方單例；測試（T4 決定性）以此取獨立實例比對不同 FPS。 */
export function createSharedState(): SharedState {
  return {
    input: [],
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
  state.input.length = 0;
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
