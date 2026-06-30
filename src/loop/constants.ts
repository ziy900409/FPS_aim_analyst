/**
 * Sim loop 常數 — WP-2 / T2（FR-2.2）
 */

/**
 * 固定 sim tick rate（Hz）。階段 A = 128（= 64×2，便於對照 CS2 的 15.625 ms tick）。
 * 設為設定常數、**不寫死於邏輯**（ADR-3）；日後可提升 256/384，決定性測試與下游邏輯不需改。
 */
export const SIM_HZ = 128;
