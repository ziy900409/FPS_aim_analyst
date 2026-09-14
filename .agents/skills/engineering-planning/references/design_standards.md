# Design Standards — Engineering Planning Quality Guide

> 本文件是 `engineering-planning` Skill 的 **HOW to write** 規範。
> Step 3 載入此文件，確保 Tech Spec 的每個 section 達到品質標準。
> `assets/tech_spec_template.md` 定義結構（WHAT），本文件定義品質（HOW）。

---

## Section 1 — Requirements 撰寫規範

### Functional Requirements
- 使用「系統**必須**...」格式（should/may 不算 FR）
- 每條 FR 必須可以被測試（能寫出對應的驗收條件）
- 避免描述實作細節（描述 **what**，不描述 **how**）

**好的例子**:
> 系統必須在用戶移動滑鼠時，以 ≤ 4ms 的延遲回傳游標位置。

**壞的例子**:
> 系統會用 ETW 監聽滑鼠事件並透過 channel 傳遞。（這是實作細節）

### Non-functional Requirements
- 每條 NFR 必須有**量化指標**（不能只說「快」或「穩定」）
- 常見量化格式：
  - 效能：`P99 延遲 < X ms`
  - 可用性：`uptime > 99.X%`
  - 資料量：`支援 X GB / X 萬筆`

### Open Questions
- 每個 Open Question 必須標記：
  - **Owner**：誰負責回答
  - **Deadline**：何時需要答案
  - **Impact**：若未解決會影響哪個 Task

---

## Section 2 — Technical Design 撰寫規範

### System Boundary
必須明確列出：
- **In scope**: 此次修改涵蓋的模組與功能
- **Out of scope**: 刻意排除的部分（防止範圍蔓延）

### Data Flow
優先使用 Mermaid 圖（若環境支援）：
```mermaid
graph LR
  A[ETW Driver] -->|raw event| B[Session Controller]
  B -->|MouseEvent| C[Backend Channel]
  C -->|IPC| D[Frontend]
```

若不使用圖，至少描述：「資料從 X 產生，經由 Y 轉換，最終到達 Z」

### Interface Contracts
每個 interface 必須包含：
- 函數/方法名稱與完整簽名（含型別）
- 參數說明
- 回傳值說明
- Error 情境

**TypeScript 介面範例(本 repo 風格:純函式 + 驗證即建構)**:
```ts
/**
 * 淨空驗證:目標包絡 vs 場景 propBounds。
 * @param envelopes drill 推導出的目標活動包絡(canonical unit u)
 * @param props     場景權威 prop AABB(唯讀,render/validation 層獨有 — GD-6)
 * @returns 違規清單;空陣列 = 通過。呼叫端負責拒載並顯示 prop id。
 */
export function validateClearance(
  envelopes: readonly TargetEnvelope[],
  props: readonly PropBound[],
  options?: ClearanceOptions,
): ClearanceViolation[];
```

### Failure Modes
每個 High Risk Task 對應至少一個 Failure Mode：
- **觸發條件**: 何時會失敗
- **影響範圍**: 失敗時影響哪些功能
- **處理策略**: retry / fallback / 用戶通知 / graceful degradation

### 決定性契約與三迴圈邊界（本 repo 的併發模型）

若設計觸及 sim 迴圈、`SharedState`、輸入鏈或命中判定，**必須**說明：
- **決定性**：同一輸入序列在不同 render FPS 下，tick index 對應的狀態是否逐位一致?用哪條斷言釘死?
- **三迴圈邊界 (ADR-2)**：input / sim / render 只透過 `SharedState` 溝通;新資料走哪個方向、由誰寫、由誰唯讀。
- **固定佈局**：新增緩衝是真 ring(消費後繞圈)還是 preallocated arena(drill 內不繞圈)?欄位固定嗎?
- **時鐘域**：所有時間戳來自 `performance.now()`;sim 內不得讀時鐘(以 tick 累加的 `age` 驅動)。
- **seeded RNG**：任何隨機性的 seed 來源與是否寫入匯出 metadata(GD-5/GD-8)。

---

## Section 3 — Risk Analysis 撰寫規範

### Risk 分級標準

| 等級 | 條件 | Task 處理要求 |
|---|---|---|
| **Low** | 有充分先例，可獨立測試，不影響共用 data flow | 標準開發流程 |
| **Med** | 跨模組影響，或依賴外部 API / 第三方服務 | 需要 integration test |
| **High** | 無先例、影響核心 data flow、涉及併發模型變更 | 必須有 Failure Mode 說明 + PoC 驗證 |

### Technical Debt Risk
明確標記哪些設計決策是「有意識的妥協」：
- 妥協原因（時程壓力、依賴限制）
- 後續處理計畫（sprint N 重構、版本 X 改善）
- 觸發重構的條件（如「當 QPS > 1000 時」）

---

## Section 4 — Task Breakdown 撰寫規範

### Task 粒度原則
- 一個 Task 的工作量：**0.5 ~ 3 天**
- 超過 3 天的 Task 必須拆解
- 少於 0.5 天的多個 Task 考慮合併

### Definition of Done 品質要求
DoD **必須**是可客觀驗證的，禁止使用主觀描述：

| 禁止 | 改為 |
|---|---|
| 「功能完成」 | 「`npm run test:ci` exit 0(N vitest + M e2e)」 |
| 「程式碼寫好」 | 「新增對抗性 fixture(恰相交/恰不相交)兩例皆綠」 |
| 「介面實作完成」 | 「介面符合 Interface Contracts 簽名,且 `validate*` 對非法輸入拋出指名欄位的錯誤」 |
| 「場景做好了」 | 「實機渲染 + 既有 drill 全程無掉 tick,draw call / 三角形數記入 `progress.md`」 |
| 「不影響決定性」 | 「同輸入序列跨場景/跨 FPS 的 sim 狀態逐位一致斷言通過(測試檔名 + 案例名)」 |

**DoD 必須是可執行或可觀察的證據**：指令 + 期望輸出、斷言檔名 + 案例名、或實機證據(截圖/數值記入 `progress.md`)。
主觀語句(「實作完成」「運作正常」「看起來沒問題」)一律不合格。

### Dependencies 標記規則
- 若 Task B 依賴 Task A，標記 `Task A`（用 Task 編號）
- 若依賴外部（API 文件、別組 PR），標記具體連結或 owner
- `None` 表示可以獨立並行開始

---

## 完整性檢查清單（Step 5 使用）

```
[ ] 每個 Functional Requirement 對應至少一個 Task
[ ] 所有 Open Questions 已標記 owner 和 deadline
[ ] High Risk task 有對應的 Failure Mode 說明
[ ] Interface contracts 有明確的 input/output 型別
[ ] Definition of Done 可被客觀驗證（非「完成實作」）
[ ] Data flow 有圖示或流程說明（非空白）
[ ] System boundary 明確列出 in scope / out of scope
[ ] 決定性契約與三迴圈邊界:若觸及 sim / SharedState / 輸入鏈 / 命中判定則必填
[ ] 硬約束衝擊表(`CLAUDE.md §4`)逐條填寫,無留白、無裸「N/A」
[ ] 每個 Task 自帶一行 conventional-commit 訊息(一 task = 一原子 commit)
[ ] Technical debt 若有妥協則標記後續處理計畫
```
