import type { SharedState } from '../state/SharedState.ts';

/**
 * TargetManager — WP-4 / T2（FR-4.2）
 *
 * sim 職責（CONTEXT.md §B）:在 **sim tick 內** 管理目標 spawn／可見性,並於目標 `visible`
 * 由 false→true 的轉換 tick 蓋 `t_visible = nowMs`(sim clock)。`t_visible` 是所有反應時間
 * 量測的起點(規格 §5),其時間源與只蓋一次是效度關鍵。
 *
 * **時間源硬約束**:`nowMs` 由 `SimLoop.simStep` 傳入的 sim 邏輯時鐘(累加 tickMs,量測時鐘域,
 * 與 `performance.now()` 同 time origin)——**不可** 用 rAF frame 時間或 `Date.now()`(ADR-4 /
 * README failure-mode「t_visible 蓋在 render frame」)。TargetManager 不讀時鐘、只收注入的 nowMs,
 * 故天然純函式(不碰 DOM/`performance.now`),與 simStep 的 Worker 搬遷紀律(OQ-2.4)相容。
 *
 * **只蓋一次**:以 `state.tVisible.has(id)` 防重複——可見目標只在第一個可見 tick 蓋戳。
 *
 * 本 task(T2)為**單目標** spawn:無存活目標時生成一個(side 固定,見 `nextSide`)。左右交替
 * 序列(擊殺 → 生成對側的 side 選擇)屬 T3;命中訊號屬 WP-5。`markKilled`/`reset` 先立最小
 * 可用版本供下游與測試呼叫。
 */

/** 目標距玩家的前方(-Z)距離(u,source unit;佔位,WP-6 drill config 接管)。 */
const DEFAULT_DISTANCE = 8;
/** 目標中心高(u;略低於眼高 1.6,使準心正對軀幹)。 */
const TARGET_Y = 1.5;
/** 左右 peek 槽位相對中軸的水平偏移(u)。 */
const SIDE_OFFSET = 2;
/** 單一 box hitbox(H1;width/height/depth,u)——與 mesh 同來源(TargetView 以此 scale)。 */
const HITBOX = { width: 1, height: 2, depth: 1 } as const;

function sideX(side: 'L' | 'R'): number {
  return side === 'R' ? SIDE_OFFSET : -SIDE_OFFSET;
}

export interface TargetManager {
  /** sim tick 內呼叫:spawn/可見性 → 可見轉換即蓋 `t_visible`(nowMs = sim clock)。 */
  tick(state: SharedState, nowMs: number): void;
  /** 標記某目標被擊殺 → 撤除(WP-5 命中後呼叫;T3 接「生成對側」的 side 翻面)。 */
  markKilled(state: SharedState, id: string): void;
  /** 重置目標與 tVisible;`seq` 首字決定首個 spawn 側(預設 'RL' → 'R')。 */
  reset(state: SharedState, seq?: 'LR' | 'RL'): void;
}

export function createTargetManager(opts: { distance?: number } = {}): TargetManager {
  const distance = opts.distance ?? DEFAULT_DISTANCE;
  let nextId = 0;
  // 首個 spawn 側;T3 將於擊殺後翻面以實現左右交替(本 task 固定不翻)。
  let nextSide: 'L' | 'R' = 'R';

  /** 生成一個目標(OQ-4.2:spawn 瞬間即可見)。spawn 屬低頻事件(peek 節奏),非每 tick 熱路徑。 */
  function spawn(state: SharedState): void {
    state.targets.push({
      id: `t${nextId++}`,
      side: nextSide,
      pos: { x: sideX(nextSide), y: TARGET_Y, z: -distance },
      visible: true,
      alive: true,
      hitbox: { ...HITBOX },
    });
  }

  function hasAliveTarget(state: SharedState): boolean {
    for (let i = 0; i < state.targets.length; i++) {
      if (state.targets[i].alive) return true;
    }
    return false;
  }

  return {
    tick(state: SharedState, nowMs: number): void {
      // ① spawn:無存活目標時補一個(T2 單目標;T3 接 side 交替選擇)。
      if (!hasAliveTarget(state)) spawn(state);
      // ② 蓋 t_visible:可見且尚未蓋過者蓋一次(sim clock nowMs)——只在可見轉換 tick 蓋。
      //    穩態(已蓋戳)只做 Map.has 掃描,零配置(GC 紀律)。
      for (let i = 0; i < state.targets.length; i++) {
        const t = state.targets[i];
        if (t.visible && !state.tVisible.has(t.id)) {
          state.tVisible.set(t.id, nowMs);
        }
      }
    },

    markKilled(state: SharedState, id: string): void {
      for (let i = 0; i < state.targets.length; i++) {
        if (state.targets[i].id === id) {
          state.targets.splice(i, 1);
          break;
        }
      }
      // t_visible 隨目標撤除清掉;下次 spawn 為新 id、重新蓋戳(可見→不可見→再可見視為新目標)。
      state.tVisible.delete(id);
    },

    reset(state: SharedState, seq: 'LR' | 'RL' = 'RL'): void {
      state.targets.length = 0;
      state.tVisible.clear();
      nextId = 0;
      nextSide = seq[0] as 'L' | 'R';
    },
  };
}
