import type { SharedState } from '../state/SharedState.ts';

/**
 * firstShot — WP-5 / T2（FR-5.2，OQ-5.3）
 *
 * sim 職責：每個 **peek**（一個目標可見週期）只把**第一發** fire 標為 `firstShot`，作為「首發命中率」
 * 的分子來源，**不被後續掃射稀釋**（README failure-mode「首發被掃射稀釋」）。
 *
 * **peek 錨定**（CONTEXT「首發」/ OQ-5.3）：peek 以「當前 active（`visible && alive`）目標 id」為鍵。
 * `TargetManager` 每次擊殺撤除目標並在對側 spawn **新 id**（`markKilled` 翻面 + `nextId++`），故新 peek
 * 必帶**唯一的新 peekId**——首發旗標因此**隱式 reset**（新 peekId ≠ 已計 peekId），無需顯式清旗標事件。
 *
 * 狀態載體：旗標記憶存 `SharedState.firstShotPeekId`（已計首發的 peekId），與雙迴圈邊界相容——
 * 純讀寫傳入 state、不讀時鐘、不碰 DOM（OQ-2.4 純函式紀律）。GC 紀律：僅寫 string 欄位，零配置。
 */

/**
 * 當前 peek 錨：第一個 active（`visible && alive`）目標 id。階段 A 一次只一個 active 目標
 * （counter-strafe peek 節奏，TargetManager T3），故取首個即可。無 active 目標時回 `undefined`
 * （無 peek 可歸屬 → 呼叫端不計首發）。
 */
export function currentPeekId(state: SharedState): string | undefined {
  for (let i = 0; i < state.targets.length; i++) {
    const t = state.targets[i];
    if (t.visible && t.alive) return t.id;
  }
  return undefined;
}

/**
 * 首發旗標閘：每個 peek **第一次**呼叫回 `true`（並記錄該 peekId 已計首發），其後同 peek 回 `false`。
 * 換 peek（新 peekId）自動回 `true`——peekId 唯一故隱式 reset。掃射（同 peek 連續 fire）只有首發計入。
 */
export function firstShotGate(state: SharedState, peekId: string): boolean {
  if (state.firstShotPeekId === peekId) return false; // 同 peek 已計首發 → 後續 fire 不稀釋
  state.firstShotPeekId = peekId; // 新 peek 首發：記錄；其後回 false（新 peekId 唯一 → 隱式 reset）
  return true;
}
