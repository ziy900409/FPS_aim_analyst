import type { GateReport } from './eligibilityGate.ts';

/**
 * 實驗 session 最小狀態機 — WP-20 T2（GD-10）。
 *
 * 「實驗 session」= 通過資格閘後鎖定的量測期。本模組只承載 T2 需要的最小語意:
 * - `enter(report)`:資格閘通過後進入 session,保存 GateReport(供 meta.display.gate 全量審查)。
 * - `handleFullscreenChange(present, recording)`:**drill 正在錄製中**（`recording`,由呼叫端依
 *   `DrillRunner.phase` 判定）偵測到 fullscreen 退出 → 標 `suspect`（failure mode:條件失效而資料
 *   照收;純觀測旗標,不中斷、不改 sim)。`recording=false`(idle 待命 / drill 已 ended)時的退出
 *   不算 —— KI-007:單一「實驗 session」流程不會在 drill 之間呼叫 `exit()`（刻意支援連續多 drill
 *   不重新過閘),若不分辨錄製中與否,drill 結束後研究者為了下載匯出檔而退出全螢幕的正常動作,會
 *   與錄製中途意外掉出全螢幕的真實失效樣態混為一談。
 * - `suspect`:**session 級 sticky 的內部閂鎖**,一旦為 true 就不再復位（`exit()` 刻意保留）。
 *
 * ⚠️ **WP-70 / T1（KI-040 缺陷 A）之後,本欄不再進匯出。** 它曾經被 `collectMeta()` 直接讀取並 OR 進
 * `meta.suspect`,而它從不復位 ⇒ 同一分頁內一次中斷會污染其後**每一場**匯出（靜默）。匯出路徑的
 * fullscreen 成分現在是 **run 級**的 `sharedState.validity.fullscreenExitedDuringRun`
 * →`meta.validity.fullscreenExited`（`resetState()` 每場歸零,判準見 GD-47）。
 * 本欄今日的**唯一**用途 = `handleFullscreenChange()` 裡的 `|| suspect` 早退,也就是
 * 「同一次退出只觸發一次 `onSuspect`」的去重閂;executable 讀取點為 **0**。
 * 橫幅顯示亦**不**由本欄驅動（WP-70 / T3 改為 run 旗標真值驅動）。
 *
 * protocol 排程本體（條件序列/對抗平衡）歸 WP-22 T2;本模組不涉及。
 */

export interface ExperimentSession {
  /** session 是否進行中（gate 通過後 → true;exit() → false）。 */
  readonly active: boolean;
  /** 進行中曾退出 fullscreen → true。**session 級 sticky,不進匯出**（WP-70;見檔頭警告）。 */
  readonly suspect: boolean;
  /** 通過的 gate 明細（進 meta.display.gate;未進 session 時 undefined）。 */
  readonly gate: GateReport | undefined;
  /** 資格閘通過後進入 session。 */
  enter(report: GateReport): void;
  /**
   * fullscreenchange 掛點:`present` = `document.fullscreenElement != null`;`recording` = 呼叫端
   * 判定「drill 目前是否正在錄製」（KI-007,例如 `DrillRunner.phase` 屬於 `countdown`/`running`）。
   */
  handleFullscreenChange(present: boolean, recording: boolean): void;
  /** 結束 session（保留 `gate` 供最後一次匯出讀取;`suspect` 自 WP-70 起不進匯出）。 */
  exit(): void;
}

export interface ExperimentSessionOptions {
  /** session 進行中退出 fullscreen 時觸發（UI 警示掛點）。同一次退出只觸發一次。 */
  onSuspect?: () => void;
}

export function createExperimentSession(options: ExperimentSessionOptions = {}): ExperimentSession {
  let active = false;
  let suspect = false;
  let gate: GateReport | undefined;

  return {
    get active(): boolean {
      return active;
    },
    get suspect(): boolean {
      return suspect;
    },
    get gate(): GateReport | undefined {
      return gate;
    },
    enter(report: GateReport): void {
      active = true;
      gate = report;
    },
    handleFullscreenChange(present: boolean, recording: boolean): void {
      if (!active || !recording || present || suspect) return;
      suspect = true;
      options.onSuspect?.();
    },
    exit(): void {
      active = false;
    },
  };
}
