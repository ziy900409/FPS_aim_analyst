import type { DrillConfig } from './DrillConfig.ts';
import { trackingCorePrFeedbackV1 } from './tracking_core_pr_feedback_v1.ts';

/**
 * `tracking_core_pr_3deg_14dps_feedback_30s_noprep_v1` — 以
 * [`tracking_core_pr_feedback_v1.ts`](./tracking_core_pr_feedback_v1.ts) 為**參照**衍生的變體
 * （使用者 2026-09-14）：**測試時間 30 秒**，且**目標從計時的第一個 tick 就開始移動**。
 *
 * **與參照 drill 的兩個差異，兩個都是刺激層級的差異：**
 *
 * 1. **30 秒**（參照為 1 s prep + 25 s scored = 26 s）。`band-limited-2d-v1` 的正弦分量由
 *    `seed` 決定、與 `durationMs` 無關（`durationMs` 只是 `sample()` 的夾取上界），所以延長不會
 *    改變軌跡形狀、也不會動到 `boundedSpeedScale` 的振幅/速度求解——同一條軌跡多走 5 秒而已。
 *    振幅上界是解析上界（`yawBoundDeg`/`pitchBoundDeg`），故 `validateClearance` 與 KI-020 的
 *    可交付性守衛在任何 duration 下結論都一樣;實際 excursion 與交付 RMS 速度由本 drill 自己的
 *    測試在 30 s 視窗上重新量過，不沿用 25 s 的結論。
 * 2. **移除 `timing.trackingPrepMs`**。參照 drill 帶 `trackingPrepMs: 1000`，那一秒內
 *    trajectory 被凍結在 `sample(0)`（FR-54-5 的「置中準備」窗），這正是使用者觀察到的
 *    「一開始 1–2 秒不會動」。省略此欄＝`TargetManager` 的 `trackingPrepSec = 0`，trajectory
 *    自 `age=0` 立即推進;`scored_start` 仍會在 spawn 當下的第一個 drive tick 觸發
 *    （`DataRecorder` 明載的 `prepSec=0` 退化情形），因此 `protocolGuard` 與
 *    `trackingRunEligibility` 的 scored 窗語意不變，只是窗界與目標開始移動的時刻重合。
 *
 *    ⚠️ **代價（研究者需知情）**：`requireFire` guard 現在從 running 的第一個 tick 就武裝，
 *    受測者沒有 1 秒的緩衝可以先按住左鍵/完成初始對準;held-fire 覆蓋率門檻
 *    （`MIN_FIRE_HOLD_COVERAGE` = 95%）是對整個 30 s 窗算的，晚 1.5 s 才按住即用掉全部餘裕。
 *    另外沒有置中準備窗 ⇒ scored 窗頭幾百毫秒必然含一段「初始捕獲」而非穩態追蹤。
 *
 * **為什麼是獨立 drill id 而不是改參照 drill**：同 WP-66 後續兩個回饋 drill 的理由——duration 與
 * prep 都不是 `checkTrackingCompatibility()` 的軸，就地改會讓改動前後的 run 取得相同 cohort key、
 * 離線無法分池（KI-025 同型）。`_30s_noprep_` 兩段都寫進 id，是因為兩個差異都會改變任務本身;
 * 只寫 `_30s_` 會讓「guard 何時武裝」這個更有後果的差異在 id 上隱形。
 *
 * 本 drill 一樣**不是** pilot evidence（不在 `ALL_TRACKING_PILOT_CONFIGS`、不進 manifest、
 * `mode: 'practice'`），也**不可**與參照 drill 或任何 `tracking-pilot-v2` block 混池比較。
 * scene pin 沿用 `field-low`（`main.ts` roster entry），理由同參照 drill。
 */

/** 使用者指定的測試時間（ms）——**全程都在動**，沒有凍結的置中準備窗。 */
const DURATION_MS = 30_000;
/**
 * `presentationMs` 對 `RUNNING_DURATION_MS` 的餘裕，沿用 `tracking_core_pr_pilot_v1.ts` 的 4 s
 * 慣例：`presentationMs` 只是「目標持久化」的開關與後援，必須明顯大於 timeLimit，否則會在
 * `endCondition` 之前先把目標推進掉。
 */
const PRESENTATION_HEADROOM_MS = 4000;

const BASE_TRAJECTORY = trackingCorePrFeedbackV1.targets.trackingTrajectory;
if (BASE_TRAJECTORY === undefined || BASE_TRAJECTORY.kind !== 'band-limited-2d-v1') {
  // 參照 drill 換掉 trajectory kind 時在模組載入當下就炸，而不是安靜地產出一個少了 `durationMs`
  // 語意的變體。
  throw new Error('tracking_core_pr_feedback_30s_v1: 參照 drill 不再是 band-limited-2d-v1');
}

export const trackingCorePrFeedback30sV1: DrillConfig = {
  ...trackingCorePrFeedbackV1,
  drillId: 'tracking_core_pr_3deg_14dps_feedback_30s_noprep_v1',
  targets: {
    ...trackingCorePrFeedbackV1.targets,
    trackingTrajectory: { ...BASE_TRAJECTORY, durationMs: DURATION_MS },
  },
  timing: {
    // 逐欄重寫而非 spread：`trackingPrepMs` 的「不存在」是本 drill 的核心宣告，用 spread 會讓它
    // 隨參照 drill 的欄位增減而悄悄回來。
    countdownMs: trackingCorePrFeedbackV1.timing.countdownMs,
    presentationMs: DURATION_MS + PRESENTATION_HEADROOM_MS,
  },
  endCondition: { type: 'timeLimit', value: DURATION_MS },
};
