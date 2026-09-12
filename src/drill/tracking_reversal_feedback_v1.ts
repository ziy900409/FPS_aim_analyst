import type { DrillConfig } from './DrillConfig.ts';
import { trackingReversalPilotV1High } from './tracking_reversal_pilot_v1.ts';

/**
 * `tracking_reversal_high_feedback_v1` — 高反轉密度 reversal tracking，**帶命中視覺回饋**（WP-66 的
 * `targets.hitFeedback: 'flash'`，見 CONTEXT.md §H「命中回饋」）。
 *
 * **為什麼是一個獨立 drill，而不是在 pilot block 上開回饋**（使用者 2026-09-12 裁決）：
 * `trackingReversalPilotV1High` 是 `tracking-pilot-v2` 這個**已版本化協定**六個 scored block 之一，
 * 且 WP-64 的策展註冊表持有的正是**同一個物件參考**（實測 `curated === census` 為 true）⇒ 在它身上
 * 加 `hitFeedback` 不可能只影響 ad hoc 的 Session Plan 路徑，一定會同時改掉協定 runner 看到的刺激。
 * 那會造成兩個問題：① 協定內 **1/6 帶回饋、5/6 不帶**，reversal 對比與「有無回饋」共變；
 * ② `checkTrackingCompatibility()` 的十個軸**沒有 `hitFeedback`** ⇒ 啟用前後的 run 取得**相同**
 * cohort key、離線無法分池（KI-025 同型）。本 drill 因此走「**新增獨立 id**」：`tracking-pilot-v2`
 * 逐位不變、`TRACKING_PILOT_PROTOCOL_VERSION` 不必升版、WP-66 OQ-66.6 的排除斷言原封不動。
 *
 * **刺激關係（讀結果時必看）**：本 drill 與 `tracking_reversal_pilot_v1_high` **只差兩欄**
 * （`drillId` 與 `targets.hitFeedback`），由 `tracking_reversal_feedback_v1.test.ts` 逐欄釘死——
 * 其餘參數（seed、reversal interval、角度視窗、速度範圍、hitbox、timing、protocolGuard、weaponId）
 * 全部沿用同一份來源，改 pilot 參數會同步改到這裡。但**這兩者仍是不同的刺激**：命中回饋改變受試者
 * 的校正策略與注意力分配 ⇒ **本 drill 的資料不可與任何 `tracking-pilot-v2` block 混池比較**，
 * 它也**不是** pilot evidence（不在 `ALL_TRACKING_PILOT_CONFIGS` 普查表、不進 manifest、
 * 不進 exact-id history registry、`mode: 'practice'`）。
 *
 * 沿用 `field-low` 的 scene pin 理由與 pilot block 相同：`reversal-2d-v1` 的 ±13° 角度視窗是對
 * `field-low` 的 clearance envelope 驗證過的，繼承當下載入的場景可能在 session 中途被拒。
 * scene pin 落在 `main.ts` 的 roster entry（`sceneId: 'field-low'`）。
 */
export const trackingReversalFeedbackV1: DrillConfig = {
  ...trackingReversalPilotV1High,
  drillId: 'tracking_reversal_high_feedback_v1',
  targets: {
    ...trackingReversalPilotV1High.targets,
    // WP-66：唯一相對於 pilot block 的刺激差異。省略＝逐位等同 pilot block。
    hitFeedback: 'flash',
  },
};
