import type { SharedState } from '../state/SharedState.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';

/**
 * TargetManager — WP-4 / T2（FR-4.2）；WP-6 / T2（FR-6.2）config 驅動
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
 * **左右交替序列(T3,FR-4.3)**:一次只一個 active 目標(counter-strafe peek 節奏)。
 * `markKilled` 撤除目標後翻面 `nextSide`(L↔R),下一個可見 tick 於對側 spawn 並蓋新
 * `t_visible`。輪替純由內部 `nextSide` 布林驅動、無隨機源——確定性(給定首側,序列可重現),
 * 與 WP-2 決定性契約相容(不可用無種子 `Math.random`)。首側由 `reset(seq)` 決定(預設 'R')。
 * 命中訊號(何時呼叫 `markKilled`)屬 WP-5;本 task 用測試/佔位觸發。
 *
 * **config 驅動(WP-6 / T2,FR-6.2)**:`createTargetManager(config)` 由 `DrillConfig` 取代 WP-4
 * 內建佔位——`targets.distance`(位置)、`sequence.alternation` 首字(首側)、`targets.count`
 * (spawn 上限,達標後不再補生)。**換 config 即換 drill,零引擎程式碼改動**(F4)。`config`
 * 省略時退回 WP-4 佔位行為(預設距離、首側 'R'、無限補生),既有 WP-4 測試不變。
 *
 * ⚠️ 範圍:`endCondition` 的 **phase 語意**(running→ended)屬 DrillRunner(T4);此處只把
 * `targets.count` 當 spawn 上限,不判定 drill 結束。`sequence.seed` 為未來隨機化保留(階段 A
 * 交替為決定性 L↔R,不讀 seed)。`targets.motion` 若提供則寫入目標(F5 接縫),階段 A 不驅動移動。
 */

/**
 * 目標距玩家的前方(-Z)距離(u,source unit;佔位,WP-6 drill config 接管)。
 * ⚠️ 須 < 佔位房間半深(SceneManager `roomSize` 預設 [10,10,3] → 北牆 z=−5),否則目標生在牆後
 * 被遮擋(WP-5 T1 手動驗證發現:距離 8 → z=−8 落在北牆後方)。4 → z=−4,落在房間內、camera 前方。
 */
const DEFAULT_DISTANCE = 4;
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
  /** 標記某目標被擊殺 → 撤除並翻面 `nextSide`,下一 tick 於對側 spawn(WP-5 命中後呼叫)。 */
  markKilled(state: SharedState, id: string): void;
  /** 重置目標/tVisible/spawn 計數;`seq` 首字定首側,省略時用 config 首側(或無 config 預設 'R')。 */
  reset(state: SharedState, seq?: 'LR' | 'RL'): void;
}

export function createTargetManager(config?: DrillConfig): TargetManager {
  const distance = config?.targets.distance ?? DEFAULT_DISTANCE;
  // spawn 上限:config 的目標總數;無 config 時不設限(向後相容 WP-4 佔位——無限補生)。
  const spawnLimit = config ? config.targets.count : Infinity;
  // F5 接縫:config 帶 motion 即寫入目標(階段 A 不驅動移動,WP-6.5 接管)。
  const motion = config?.targets.motion;
  // 首側:config.sequence.alternation 首字(對齊 reset 語意);無 config 時預設 'R'(WP-4)。
  const defaultFirstSide: 'L' | 'R' = config ? (config.sequence.alternation[0] as 'L' | 'R') : 'R';

  let nextId = 0;
  // 下一個 spawn 側;`markKilled` 每次擊殺翻面以實現左右交替(FR-4.3)。首側由 reset 設。
  let nextSide: 'L' | 'R' = defaultFirstSide;
  // 已 spawn 目標數(對照 spawnLimit;reset 歸零)——config 驅動的「換 config 即換數量」判準。
  let spawnedCount = 0;

  /** 生成一個目標(OQ-4.2:spawn 瞬間即可見)。spawn 屬低頻事件(peek 節奏),非每 tick 熱路徑。 */
  function spawn(state: SharedState): void {
    state.weapon.ammo = state.weapon.magSize;
    state.targets.push({
      id: `t${nextId++}`,
      side: nextSide,
      pos: { x: sideX(nextSide), y: TARGET_Y, z: -distance },
      visible: true,
      alive: true,
      hitbox: { ...HITBOX },
      ...(motion ? { motion: { ...motion } } : {}),
    });
    spawnedCount++;
  }

  function hasAliveTarget(state: SharedState): boolean {
    for (let i = 0; i < state.targets.length; i++) {
      if (state.targets[i].alive) return true;
    }
    return false;
  }

  return {
    tick(state: SharedState, nowMs: number): void {
      // ① spawn:無存活目標且未達 spawn 上限時補一個(單 active 目標;side 由 nextSide 交替)。
      //    達 spawnLimit(config.targets.count)後不再補生——drill 目標序列耗盡(結束判定屬 T4)。
      if (!hasAliveTarget(state) && spawnedCount < spawnLimit) spawn(state);
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
      let removed = false;
      for (let i = 0; i < state.targets.length; i++) {
        if (state.targets[i].id === id) {
          state.targets.splice(i, 1);
          removed = true;
          break;
        }
      }
      // 只有真的撤除了目標才翻面(擊殺不存在 id 不推進序列)——確定性輪替 L↔R(FR-4.3),
      // 下一個可見 tick 於對側 spawn 並蓋新 t_visible。
      if (removed) {
        nextSide = nextSide === 'R' ? 'L' : 'R';
        // t_visible 隨目標撤除清掉;下次 spawn 為新 id、重新蓋戳(可見→不可見→再可見視為新目標)。
        state.tVisible.delete(id);
      }
    },

    reset(state: SharedState, seq?: 'LR' | 'RL'): void {
      state.targets.length = 0;
      state.tVisible.clear();
      nextId = 0;
      spawnedCount = 0;
      // seq 顯式優先(既有 WP-4 呼叫);省略時退回 config 首側(或無 config 的預設 'R')。
      nextSide = seq ? (seq[0] as 'L' | 'R') : defaultFirstSide;
    },
  };
}
