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
 * 實驗最高條件（原生解析度需 ≥ 此值,單位 = 實體像素 = CSS 尺寸 × devicePixelRatio）。
 * = qhd-1440 buffer（2560×1440）。資格閘「原生解析度」檢查以此為門檻:
 * FHD 面板（1920×1080）跑 QHD 條件 = 方向性錯誤資料的統計必然,故拒入（GD-10 防線①）。
 */
export const EXPERIMENT_MAX_CONDITION = { minW: 2560, minH: 1440 } as const;
