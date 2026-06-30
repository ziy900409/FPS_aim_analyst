/**
 * Clock — WP-2 / T2（FR-2.2 / OQ-2.3）
 *
 * 注入式時間源：正式路徑用 `performance.now()`（量測時鐘域，與 `event.timeStamp` 同 time
 * origin，ADR-4 禁 `Date.now()`）；測試注入合成時間以驅動 accumulator（決定性驗證 T4）。
 * 正式與測試共用同一 `pump(nowMs)`，避免雙路徑分歧（README 風險表）。
 */
export interface Clock {
  /** 毫秒；與 `event.timeStamp` 同 time origin。 */
  now(): number;
}

export const realClock: Clock = { now: () => performance.now() };
