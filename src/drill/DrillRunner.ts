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
  // hold-reversal 只追蹤目前可見目標。目標撤除或玩家放開第一個提示鍵時皆歸零，
  // 因此不會把不同目標或不連續按住時間累加在一起。
  let reversalTargetId: string | null = null;
  let reversalHoldStartedAtMs: number | null = null;
  let reversalCueSent = false;

  function resetReversalTracking(): void {
    reversalTargetId = null;
    reversalHoldStartedAtMs = null;
    reversalCueSent = false;
  }

  // WP-54 / T2：no-fire/no-ADS/no-movement protocol violation guard——每個 kind 各自一個「已回報」
  // latch（不是單純比較「上一 tick held 值」，因為跨 prep 窗界帶入的既有 held 狀態在窗界開始那一刻
  // 就該算一次違規，而不是等到下一次「false→true」邊緣才報）：held 期間只報一次，放開後 latch 歸零、
  // 下一次再按下才會再報一次。偵測**不阻擋輸入本身**（不改 heldFire/heldAds/held 任何寫入路徑）。
  let reportedFireViolation = false;
  let reportedAdsViolation = false;
  let reportedMovementViolation = false;
  // WP-54 / T7：`requireFire` 的鏡像 latch。與 `reportedFireViolation` 分開兩個變數而不共用一個
  // ——兩者的觸發條件相反，共用會在 guard 設定改變時留下錯誤的殘留狀態；且 schema 已保證
  // `noFire`/`requireFire` 互斥，同時只會有一個在跑，多一個 boolean 沒有代價。
  let reportedFireReleasedViolation = false;

  function resetProtocolGuardTracking(): void {
    reportedFireViolation = false;
    reportedAdsViolation = false;
    reportedMovementViolation = false;
    reportedFireReleasedViolation = false;
  }

  function tickProtocolGuard(s: SharedState, nowMs: number): void {
    const guard = config?.protocolGuard;
    if (guard === undefined) return;
    // scored 窗未開始（trackingTrajectory 目標尚未跨過 trackingPrepMs）：不偵測——與 FR-54-5「scored
    // start 前 1 秒置中準備」的既有輸入（例如玩家鬆開移動鍵準備瞄準）不應被誤記為違規。
    if (s.tScoredStart.size === 0) return;

    if (guard.noFire === true) {
      if (s.heldFire && !reportedFireViolation) {
        s.protocolViolations.push({ kind: 'fire', t: nowMs });
        reportedFireViolation = true;
      } else if (!s.heldFire) {
        reportedFireViolation = false;
      }
    }
    // WP-54 / T7（`tracking-pilot-v2`）：唯一的肯定式 guard——記「沒做該做的事」。條件是
    // `noFire` 那條的鏡像，latch 語意相同（放開期間只報一次，重新按住後才會再報下一次）。
    // 窗界那一刻若已經放開就立刻報一次，與其他三個 kind 同樣不等下一次邊緣（見上方 latch 註解）。
    if (guard.requireFire === true) {
      if (!s.heldFire && !reportedFireReleasedViolation) {
        s.protocolViolations.push({ kind: 'fire-released', t: nowMs });
        reportedFireReleasedViolation = true;
      } else if (s.heldFire) {
        reportedFireReleasedViolation = false;
      }
    }
    if (guard.noAds === true) {
      if (s.heldAds && !reportedAdsViolation) {
        s.protocolViolations.push({ kind: 'ads', t: nowMs });
        reportedAdsViolation = true;
      } else if (!s.heldAds) {
        reportedAdsViolation = false;
      }
    }
    if (guard.noMovement === true) {
      const moving = s.held.left || s.held.right;
      if (moving && !reportedMovementViolation) {
        s.protocolViolations.push({ kind: 'movement', t: nowMs });
        reportedMovementViolation = true;
      } else if (!moving) {
        reportedMovementViolation = false;
      }
    }
  }

  function tickHoldReversal(s: SharedState, nowMs: number): void {
    const cue = config?.cue;
    if (cue?.kind !== 'hold-reversal') return;

    const target = s.targets.find((candidate) => candidate.alive && candidate.visible);
    if (target === undefined) {
      resetReversalTracking();
      return;
    }

    const direction = target.side === 'L' ? 'A' : 'D';
    if (target.id !== reversalTargetId) {
      reversalTargetId = target.id;
      reversalHoldStartedAtMs = null;
      reversalCueSent = false;
      // hold-reversal 的第一個提示以目標可見為量測起點，不耦合 foreperiod/spawn 排程。
      s.cues.push({ t: nowMs, direction });
    }

    const isHoldingCueDirection = direction === 'A' ? s.held.left : s.held.right;
    if (!isHoldingCueDirection) {
      reversalHoldStartedAtMs = null;
      return;
    }
    if (reversalCueSent) return;

    if (reversalHoldStartedAtMs === null) reversalHoldStartedAtMs = nowMs;
    if (nowMs - reversalHoldStartedAtMs >= cue.holdDurationMs) {
      s.cues.push({ t: nowMs, direction: direction === 'A' ? 'D' : 'A' });
      reversalCueSent = true;
    }
  }

  /** 全 reset（start / restart 共用）：state + targetManager + 內部游標歸零。 */
  function resetAll(): void {
    resetState(state); // WP-2：清 player/快照/準心/輸入緩衝/tVisible/首發旗標（重用物件，GC 紀律）
    // 首側對齊 config.sequence.alternation（無 config 時退回 TargetManager 預設）。
    targetManager.reset(state, config ? config.sequence.alternation : undefined);
    seenIds.clear();
    countdownStartMs = null;
    runStartMs = 0;
    resetReversalTracking();
    resetProtocolGuardTracking();
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
        const peekTimeoutMs = config.timing.peekTimeoutMs;
        if (peekTimeoutMs !== undefined) {
          for (let i = 0; i < s.targets.length; i++) {
            const target = s.targets[i];
            if (target.zone === 'center' && config.spiderShot?.centerExemptFromTimeout === true) continue;
            const visibleAt = s.tVisible.get(target.id);
            if (target.alive && visibleAt !== undefined && nowMs - visibleAt >= peekTimeoutMs) {
              targetManager.markKilled(s, target.id);
              break;
            }
          }
        }

        // timed presentation 推進（WP-18 / T3,OQ-18.2）:純時長驅動——目標可見達 presentationMs 即
        // markKilled 推進下一目標（撤舊 spawn 新）。與 peekTimeoutMs 並存(語意不同:presentation 是
        // 追蹤窗右界,窗內命中不撤除,只有此到期閘撤除)。時間源 = sim clock nowMs（ADR-4）。
        const presentationMs = config.timing.presentationMs;
        if (presentationMs !== undefined) {
          for (let i = 0; i < s.targets.length; i++) {
            const target = s.targets[i];
            const visibleAt = s.tVisible.get(target.id);
            if (target.alive && visibleAt !== undefined && nowMs - visibleAt >= presentationMs) {
              targetManager.markKilled(s, target.id);
              break;
            }
          }
        }

        // 不建立第二套到期語意：先讓既有 timeout/presentation 閘撤除目標，再追蹤仍存活的
        // 可見目標；撤除同 tick 不會產生過期的 reversal cue。
        tickHoldReversal(s, nowMs);
        tickProtocolGuard(s, nowMs);

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
