# WP-6 — Drill 系統（F4）

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-6（PLAN §5）— *Drill 系統（F4）* |
| **里程碑** | M2 之後；通往 M3 |
| **相依** | WP-4（TargetManager）、WP-5（核心玩法） |
| **Type** | 設定驅動（F4）：drill 由資料定義，新增 drill 不改引擎程式碼 |
| **Module / 觸及路徑** | NEW `src/drill/DrillConfig.ts`（型別）、`src/drill/DrillLoader.ts`、`src/drill/DrillRunner.ts`、`drills/counterstrafe_ad_v1.json`；MODIFY `src/sim/TargetManager.ts`（由 config 驅動） |
| **必讀** | 規格 §1.2 F4 · §3（DrillConfig 元件）· 附錄 C（drillId 範例）· [CONTEXT.md](../../../../CONTEXT.md) | 
| **估時** | 2–4 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

F4：drill 以 **config（資料）定義**——目標數、位置、時序、方向交替、結束條件——新增 drill 不需改動引擎程式碼。這是工具可擴充性的關鍵：研究者只改 JSON 即可設計新 drill。本 WP 把 WP-4 內建的佔位序列換成 config 驅動，並交付至少 1 個完整 counter-strafe drill 與完整生命週期（開始/倒數/結束/重來）。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-6.1** | `DrillConfig` schema：目標數、位置、時序、方向交替、結束條件；型別 + 範例 JSON。 | T1 |
| **FR-6.2** | drill 載入器：由 config 驅動 `TargetManager`（換 config 即換 drill，不改引擎）。 | T2 |
| **FR-6.3** | 至少 1 個完整 counter-strafe drill 設定檔（可玩）。 | T3 |
| **FR-6.4** | drill 生命週期：開始 / 倒數 / 結束 / 重來。 | T4 |

### Non-functional Requirements

- **資料/引擎解耦**：新增 drill = 新增 JSON，零引擎程式碼改動（F4 硬性要求）。
- **確定性**：相同 config（含種子）→ 相同目標序列（與 WP-2/4 決定性相容）。
- config 為設定，不寫死（規格 §6 可維護性）。

### Constraints

- `TargetManager` 改為**消費 config**（位置/時序/交替/結束），不再內建固定序列（取代 WP-4 OQ-4.3 佔位）。
- drill 結束條件可為：目標數達標 / 時限到 / 全部命中。
- config 以 JSON（附錄 C `drillId` 對齊匯出 metadata）。

### Out of scope
- 指標統計/結果頁（→ WP-8）；資料匯出（→ WP-7）。
- drill 編輯 UI（研究者手改 JSON 即可，階段 A）。
- 多 drill 選單（→ WP-8 T4 換 drill 控制）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-6.1** | config schema 欄位範圍？ | 至少：`drillId`、`targets`（數/位置/距離）、`sequence`（交替規則/種子）、`timing`（倒數/間隔/時限）、`endCondition`。以 TS 型別 + JSON Schema 雙重約束。 | T1 |
| **OQ-6.2** | 位置定義（絕對座標 vs 左右槽位）？ | 階段 A 用「左/右 peek 槽位 + 距離」抽象，貼合 counter-strafe；絕對座標延後。 | T1, T2 |
| **OQ-6.3** | 結束條件預設？ | 預設「目標數達標」（如 20 個 peek）；可選時限。 | T1, T4 |
| **OQ-6.4** | 載入失敗 / schema 不合處理？ | 載入時驗證（型別 + 必填）；不合 → 明確錯誤 + 不啟動，避免污染資料。 | T2 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/drill/DrillConfig.ts   ← NEW (型別 + JSON Schema 驗證)                          [FR-6.1]
src/drill/DrillLoader.ts   ← NEW (載入 + 驗證 JSON → DrillConfig)                   [FR-6.2/OQ-6.4]
src/drill/DrillRunner.ts   ← NEW (生命週期：idle→countdown→running→ended；驅動 TargetManager) [FR-6.2/6.4]
drills/counterstrafe_ad_v1.json ← NEW (範例 drill)                                  [FR-6.3]
src/sim/TargetManager.ts   ← MODIFY (改由 DrillConfig 驅動 spawn/位置/交替/結束)     [FR-6.2]
```

### Data flow

```
DrillLoader.load(json) → 驗證 → DrillConfig
DrillRunner.start(config):
   idle → countdown(timing.countdown) → running
   running：TargetManager 依 config 生成目標（位置=L/R 槽位、交替=sequence、t_visible 蓋戳 WP-4）
            玩家急停/命中（WP-5）→ markKilled → 下一目標（依 config）
   endCondition 達成（目標數/時限）→ ended → （WP-8 結果頁）
DrillRunner.restart() → reset state（WP-2 resetState + TargetManager.reset）→ idle
```

### Interface contracts

```ts
// src/drill/DrillConfig.ts (FR-6.1)
export interface DrillConfig {
  drillId: string;                       // 對齊匯出 metadata（附錄 C）
  targets: { count: number; distance: number; /* 槽位幾何 */ };
  sequence: { alternation: 'LR' | 'RL'; seed?: number };
  timing: { countdownMs: number; interTargetMs?: number; timeLimitMs?: number };
  endCondition: { type: 'targetCount' | 'timeLimit'; value: number };
}

// src/drill/DrillLoader.ts (FR-6.2/OQ-6.4)
export function loadDrill(json: unknown): DrillConfig;   // 驗證失敗 throw 明確錯誤

// src/drill/DrillRunner.ts (FR-6.4)
export type DrillPhase = 'idle' | 'countdown' | 'running' | 'ended';
export interface DrillRunner {
  start(config: DrillConfig): void;
  tick(state: SharedState, nowMs: number): void;  // 在 sim tick 內推進生命週期
  restart(): void;
  readonly phase: DrillPhase;
}
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| config 不合 schema | 缺欄位/型別錯 | `loadDrill` 驗證 throw；UI 顯示錯誤、不啟動（OQ-6.4） |
| 引擎被 config 耦合 | TargetManager 寫死位置 | TargetManager 全參數化由 config 驅動；新 drill 只改 JSON（T2 驗證） |
| 生命週期卡 phase | 結束條件永不達成 | timeLimit 後援；phase 轉換單元測試 |
| 重來殘留狀態 | restart 沒清乾淨 | restart 呼叫 WP-2 resetState + TargetManager.reset；T4 測試斷言乾淨 |

### Concurrency model
DrillRunner.tick 在 sim tick 內推進；無 worker。確定性沿用（種子化交替）。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **引擎與 config 未真解耦**（F4 不成立） | Med | High | T2 驗收：新增第二個 JSON（不同數/交替）即換 drill，零引擎改動 |
| schema 演進破壞舊 config | Low | Med | `drillId` + schema 版本欄位；驗證明確報錯 |
| 重來狀態殘留污染資料 | Med | High | restart 全 reset（state + target + 首發 + 記錄游標）；T4 測試 |
| 交替種子缺失破壞決定性 | Low | Med | sequence.seed 預設；種子化 PRNG |

### Technical debt
- 無 drill 編輯 UI（手改 JSON）。*Trigger*：研究者需頻繁調 drill。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 M2（WP-5 exit ✅）+ WP-4 TargetManager；鎖 OQ-6.1~6.4。 | WP-4, WP-5 | Low | Low |
| **T1** DrillConfig schema | [T1-drill-config.md](T1-drill-config.md) | 型別 + JSON Schema 驗證 + 範例（FR-6.1）。 | T0 | Low | Med |
| **T2** Drill 載入器 | [T2-drill-loader.md](T2-drill-loader.md) | 由 config 驅動 TargetManager，換 config 即換 drill（FR-6.2）。 | T1 | Med | High |
| **T3** Counter-strafe drill 檔 | [T3-counterstrafe-drill.md](T3-counterstrafe-drill.md) | 至少 1 個完整可玩 drill JSON（FR-6.3）。 | T2 | Low | Low |
| **T4** Drill 生命週期 | [T4-lifecycle.md](T4-lifecycle.md) | 開始/倒數/結束/重來（FR-6.4）。 | T2 | Med | Med |
| **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | 換 config 即換 drill、1 drill 可玩、生命週期完整；交棒 WP-7/WP-8。 | T1–T4 | Low | Low |

### Acceptance criteria（PLAN WP-6 / F4）→ task map
- [ ] `DrillConfig` schema（型別 + 範例 JSON）→ **T1**
- [ ] 換 config 即換 drill（零引擎改動）→ **T2**
- [ ] 1 個完整 counter-strafe drill 可玩 → **T3**
- [ ] drill 生命週期完整（開始/倒數/結束/重來）→ **T4**

## Assumptions
- **A1**：M2 達成（核心玩法可玩）。
- **A2**：階段 A 用 L/R 槽位抽象位置（OQ-6.2）。
- **A3**：drill 以 JSON 手改，無編輯 UI。
