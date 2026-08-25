/**
 * 顯示管線設定常數 — WP-20（GD-10 顯示硬體防線）
 *
 * 設為設定常數、**不寫死於邏輯**：效能地板門檻與實驗最高條件皆可調（ADR-3 精神）。
 */

/**
 * 效能地板（warmup 探測 p95 frame time 上限,ms）。
 * OQ-S3-1 收斂值（WP-20 T0 2026-07-08）:8.33ms = 120Hz 等效起點。
 * 資格閘 warmup p95 `<= PERF_FLOOR_MS` 才可進實驗 session;drill 中 p95 `> PERF_FLOOR_MS` 標 suspect（T3）。
 * pilot 後另以獨立 task/commit 校準。
 */
export const PERF_FLOOR_MS = 8.33;

/**
 * Highest display refresh rate the frame log reserves for.
 * OQ-20.1 (WP-20 T0 2026-07-08): capacity = maxDrillSeconds * MAX_DISPLAY_HZ.
 */
export const MAX_DISPLAY_HZ = 240;

/**
 * 實驗最高條件（原生解析度需 ≥ 此值,單位 = 實體像素 = CSS 尺寸 × devicePixelRatio）。
 * = qhd-1440 buffer（2560×1440）。resolution/BR 兩個「受試者內解析度操弄」protocol 的資格閘
 * 以此為門檻:FHD 面板（1920×1080）跑 QHD 條件 = 方向性錯誤資料的統計必然,故拒入（GD-10 防線①）。
 */
export const EXPERIMENT_MAX_CONDITION = { minW: 2560, minH: 1440 } as const;

/**
 * Session Plan（選手表現測試,WP-42）資格閘的原生解析度門檻。
 * Session Plan 不操弄/比較解析度條件（四家族一律 native 載入,見 `SessionRunner.ts`）,
 * 不適用 `EXPERIMENT_MAX_CONDITION` 的 QHD 門檻(那是給 resolution/BR protocol 的解析度操弄
 * 研究效度用的);只需排除明顯過小的面板(< FHD)即可,故獨立於 `EXPERIMENT_MAX_CONDITION`。
 */
export const SESSION_PLAN_MIN_CONDITION = { minW: 1920, minH: 1080 } as const;
