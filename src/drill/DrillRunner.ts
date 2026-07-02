import type { SharedState } from '../state/SharedState.ts';
import { resetState } from '../state/SharedState.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import type { DrillConfig } from './DrillConfig.ts';

/**
 * DrillRunner — WP-6 / T4（FR-6.4）
 *
 * drill 生命週期狀態機：`idle → countdown → running → ended`，以及 `restart()` 全 reset。
 * 相位轉換**在 sim tick 內**推進（`tick(state, nowMs)`），時間源為 sim 邏輯時鐘（`nowMs`＝
 * `SimLoop` 累加的量測時鐘域，非 rAF/`Date.now`，與 TargetManager 同源，ADR-4）。
 *
 * **職責**：管理相位並**在 running 期間驅動 `TargetManager`**（spawn/可見性/蓋 t_visible）；
 * countdown/idle/ended 期間不驅動，故 drill 未開始或已結束時不生成目標。`endCondition` 達成
 * （目標數達標 / 時限到）→ `ended`（結果頁屬 WP-8，本 WP 只轉相位）。命中判定（fire→markKilled）
 * 仍走 `SimLoop` 的 fire 路徑（同一 `TargetManager` 實例）——本 runner 只驅動 spawn 面。
 *
 * **restart 全 reset**（風險登記：殘留狀態污染下一輪資料）：呼叫 WP-2 `resetState`（清 player/
 * 快照/準心/輸入緩衝/tVisible/**首發旗標**）+ `TargetManager.reset`（清目標序列、spawn 計數、
 * 首側）+ 本 runner 內部游標（seen 集合、倒數/開跑時戳）→ 回 `idle`。
 *
 * **建構期依賴注入 state + targetManager**：README §2 interface 的 `restart(): void` 不帶參數,
 * 但 restart 必須 reset **某個** state/targetManager,故於 factory 注入。`tick(state, …)` 仍依
 * interface 收 state（＝同一實例）,用於推進相位與讀目標;restart 走建構期閉包的 state。
 */

export type DrillPhase = 'idle' | 'countdown' | 'running' | 'ended';

export interface DrillRunner {
  /** 載入 config → 全 reset → 進 countdown（倒數在第一個 tick 以 sim clock 起算）。 */
  start(config: DrillConfig): void;
  /** 在 sim tick 內推進相位；running 期間驅動 TargetManager 並判定 endCondition。 */
  tick(state: SharedState, nowMs: number): void;
  /** 全 reset（state + targetManager + 內部游標）→ idle（風險：殘留狀態污染資料）。 */
  restart(): void;
  /** 目前相位（唯讀）。 */
  readonly phase: DrillPhase;
}

export function createDrillRunner(state: SharedState, targetManager: TargetManager): DrillRunner {
  let phase: DrillPhase = 'idle';
  let config: DrillConfig | null = null;

  // countdown 起點：於 **第一個 countdown tick** 以 sim clock 起算（start() 不帶時間源，
  // 故倒數自進入 sim tick 才計，避免依賴 wall-clock）。null = 尚未起算。
  let countdownStartMs: number | null = null;
  // running 起點：endCondition timeLimit / timing.timeLimitMs 後援閘的計時基準。
  let runStartMs = 0;
  // 已見過的目標 id 集合：擊殺數 = seen − 目前存活（單 active 目標，peek 節奏）；驅動 targetCount 判定。
  const seenIds = new Set<string>();

  /** 全 reset（start / restart 共用）：state + targetManager + 內部游標歸零。 */
  function resetAll(): void {
    resetState(state); // WP-2：清 player/快照/準心/輸入緩衝/tVisible/首發旗標（重用物件，GC 紀律）
    // 首側對齊 config.sequence.alternation（無 config 時退回 TargetManager 預設）。
    targetManager.reset(state, config ? config.sequence.alternation : undefined);
    seenIds.clear();
    countdownStartMs = null;
    runStartMs = 0;
  }

  return {
    start(cfg: DrillConfig): void {
      config = cfg;
      resetAll(); // 乾淨起步（含 targetManager 首側 = cfg 首側）
      phase = 'countdown';
    },

    tick(s: SharedState, nowMs: number): void {
      // idle / ended：不推進；config 為 null（未 start）亦不動作。
      if (phase === 'idle' || phase === 'ended' || config === null) return;

      if (phase === 'countdown') {
        if (countdownStartMs === null) countdownStartMs = nowMs; // 第一 tick 起算倒數
        if (nowMs - countdownStartMs >= config.timing.countdownMs) {
          phase = 'running';
          runStartMs = nowMs;
          // 落入下方 running 區塊：倒數結束即在同 tick spawn 首個目標（不浪費一個 tick）。
        } else {
          return; // 倒數中，暫不驅動目標
        }
      }

      if (phase === 'running') {
        // 驅動 TargetManager：spawn（至多 targets.count）/可見性/蓋 t_visible（sim clock nowMs）。
        targetManager.tick(s, nowMs);
        for (let i = 0; i < s.targets.length; i++) seenIds.add(s.targets[i].id);

        // 擊殺數 = 見過的 id 數 − 目前存活數（單 active 目標，故 targets.length ∈ {0,1}）。
        // 命中一 tick 後才反映（markKilled 在本 tick 之後的 fire 路徑），最多晚一 tick 偵測 ended。
        const killed = seenIds.size - s.targets.length;
        const ec = config.endCondition;
        const elapsed = nowMs - runStartMs;
        const backstopMs = config.timing.timeLimitMs;

        const reachedCount = ec.type === 'targetCount' && killed >= ec.value;
        const reachedTime = ec.type === 'timeLimit' && elapsed >= ec.value;
        // timing.timeLimitMs：獨立於 endCondition 型別的後援閘（防生命週期卡 phase，OQ-6.3）。
        const reachedBackstop = backstopMs !== undefined && elapsed >= backstopMs;

        if (reachedCount || reachedTime || reachedBackstop) phase = 'ended';
      }
    },

    restart(): void {
      resetAll();
      phase = 'idle';
    },

    get phase(): DrillPhase {
      return phase;
    },
  };
}
