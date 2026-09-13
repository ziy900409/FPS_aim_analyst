import type { DrillConfig } from './DrillConfig.ts';
import {
  buildTrackingCorePrPilotV1Cell,
  CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG,
  CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC,
} from './tracking_core_pr_pilot_v1.ts';

/**
 * `tracking_core_pr_3deg_14dps_feedback_v1` — core pseudorandom pursuit（`band-limited-2d-v1`）的
 * 大目標／快速格，**帶命中視覺回饋**（WP-66 的 `targets.hitFeedback: 'flash'`）。
 *
 * **為什麼是獨立 drill id**：與 [`tracking_reversal_feedback_v1.ts`](./tracking_reversal_feedback_v1.ts)
 * 同一個理由，完整論證見該檔頭註解。摘要：`tracking_core_pr_pilot_v1_3deg_14dps` 是
 * `tracking-pilot-v2` 四個 core matrix scored block 之一，在它身上加回饋會讓協定內部分 block 帶回饋、
 * 其餘不帶（size／speed 兩個被操弄變數與「有無回饋」共變），而 `checkTrackingCompatibility()` 的十個軸
 * **沒有 `hitFeedback`** ⇒ 啟用前後的 run 取得相同 cohort key、離線無法分池（KI-025 同型）。
 * 走獨立 id ⇒ `tracking-pilot-v2` 逐位不變、不必升 `TRACKING_PILOT_PROTOCOL_VERSION`、
 * WP-66 OQ-66.6 的排除斷言原封不動。
 *
 * **取值方式**：以 exported builder ＋ 兩個 exported candidate 常數取格，**不用 candidate 陣列索引、
 * 不手抄 drill id**（WP-64 README §1.5 的同一紀律）。builder 的 seed 由 candidate 索引決定 ⇒ 本 drill
 * 與 census 上的同名格**逐欄同值**（僅物件參考不同），由測試逐欄釘死。
 *
 * **刺激關係**：本 drill 與 `tracking_core_pr_pilot_v1_3deg_14dps` **只差兩欄**（`drillId` 與
 * `targets.hitFeedback`）。但兩者仍是**不同刺激**（命中回饋改變校正策略與注意力分配）⇒
 * **不可與任何 `tracking-pilot-v2` block 混池比較**；本 drill 也**不是** pilot evidence
 * （不在 `ALL_TRACKING_PILOT_CONFIGS`、不進 manifest、不進 exact-id history registry、`mode: 'practice'`）。
 *
 * scene pin 沿用 pilot 的 `field-low`（落在 `main.ts` 的 roster entry），理由同 pilot block：
 * 軌跡的角度視窗是對該場景的 clearance envelope 驗證過的。
 */

/** 大目標候選（3.0°）——與 pilot 同一個 exported 常數，不寫死字面量。 */
const SIZE_DEG = CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0];
/** 快速候選（14 deg/s）——同上。 */
const SPEED_DEG_PER_SEC = CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC[1];

const BASE_CELL: DrillConfig = buildTrackingCorePrPilotV1Cell(SIZE_DEG, SPEED_DEG_PER_SEC);

export const trackingCorePrFeedbackV1: DrillConfig = {
  ...BASE_CELL,
  drillId: 'tracking_core_pr_3deg_14dps_feedback_v1',
  targets: {
    ...BASE_CELL.targets,
    // WP-66：唯一相對於 pilot 格的刺激差異。省略＝逐位等同該格。
    hitFeedback: 'flash',
  },
};
