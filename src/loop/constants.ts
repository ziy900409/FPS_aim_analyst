/**
 * Sim loop 常數 — WP-2 / T2（FR-2.2）
 */

/**
 * 固定 sim tick rate（Hz）。階段 A = 128（= 64×2，便於對照 CS2 的 15.625 ms tick）。
 * 設為設定常數、**不寫死於邏輯**（ADR-3）；日後可提升 256/384，決定性測試與下游邏輯不需改。
 */
export const SIM_HZ = 128;

/**
 * world unit per source unit —— sim domain（Source unit）與 world domain（three.js，≈公尺）
 * 之間的**唯一**橋樑（KI-004 / K-1「雙域 + 顯式換算」）。
 *
 * 幾何（位置 / hitbox / eyeHeight / 場景 / camera）= world domain；
 * kinematics（vx / vStrafe / CS2_PROFILE / residualSpeed）= source unit（CS2 校準活在這裡，不得改）。
 *
 * **不掛 SceneConfig**：掛上去會讓同一 drill 在不同場景產生不同幾何，並讓行為依賴場景資料
 * （KI-004 §5.1；GD-6 精神）。
 */
export const SIM_TO_WORLD = 0.01;
