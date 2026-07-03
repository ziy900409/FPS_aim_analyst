# 計時效度（Timing Validity）— 反應時間量測方法論

> WP-9 T2 / FR-9.2（規格 §9.2、§14）。同伴：[schema.md](schema.md) · 術語見 [CONTEXT.md](../../CONTEXT.md)（two-clock model、`t_visible`、急停反應時間）。
> 自動化守護：[`tests/validity/reaction-time.test.ts`](../../tests/validity/reaction-time.test.ts)。

本文說明急停反應時間（`counterReactionMs`）的量測基準、為何可信、其**已知誤差界線**，以及研究者判讀時該記住什麼。

---

## 1. 量的定義

**急停反應時間 = `t_counter − t_visible`**（[CONTEXT.md](../../CONTEXT.md)）：

- `t_visible`：目標可見瞬間，在**狀態翻轉那個 sim tick 執行當下**蓋的 `performance.now()` 時間戳。
- `t_counter`：玩家按下反向鍵（急停）事件的 `event.timeStamp`。

計算在 [`src/metrics/compute.ts`](../../src/metrics/compute.ts) 的 `buildPeekWindows`：每個 peek 窗內取第一個 `counter` 事件，`reactionMs = counter.t − visible.t`。單位為**毫秒（ms）**。

---

## 2. 為何可信（效度基礎）

### 2.1 量測時鐘域（two-clock model）

所有跨角色延遲指標（反應時間、停火時序對齊、切換時間）都在**量測時鐘** = `performance.now()` 域計算。`event.timeStamp` 與 `performance.now()` **同 time origin、可直接相減**，故：

- 反應時間是**相對差**，與 time origin 無關（可執行守護：測試 `基準為相對差` — 整體平移時間戳後反應值不變）。
- 單位一致為 ms，無秒/毫秒或 frame-count 的換算因子潛入。

⚠️ 同源可減**僅在鎖定的 Chromium（Chrome/Edge）成立**（CONTEXT §two-clock model）。若日後支援非 Chromium，此假設須重驗。

### 2.2 禁用 `Date.now()`

一律 `performance.now()`（ADR-4）。`Date.now()` 受系統時鐘校正/NTP 跳動污染，且非 monotonic → 量測失效。

### 2.3 cross-origin isolation

COOP/COEP 生效使 `crossOriginIsolated === true`，把 `performance.now()` 解析度從 100 µs 提升到 ~5 µs（ADR-4）。E2E（[full-drill.spec.ts](../../tests/e2e/full-drill.spec.ts)）在真瀏覽器斷言此旗標。

---

## 3. 兩層驗證（FR-9.2）

| 層 | 目的 | 載體 | 判準 |
|---|---|---|---|
| **確定性驗算** | 排除計算 bug：單位、基準正確 | `reaction-time.test.ts`（自動、CI） | 餵已知間隔 → `counterReactionMs` **精確等於**該間隔 |
| **分布量級 sanity** | 排除管線被破壞（誤用 frame / Date.now / 換算錯） | 實玩樣本中位數（**手動**，記於 WP-9 `progress.md`） | 中位數落文獻 **~150–250 ms** 量級 |

分布 sanity 是**量級檢查、非單值硬閾**（§14，受試者內相對值）。系統性偏離（如整體 <50 ms 或 >1 s）即示警去查計時管線——`reaction-time.test.ts` 以 `withinReactionBand` 把此判準寫成可執行邏輯。

> **手動步驟**：實玩一段 counter-strafe drill → 匯出 → 取 `counterReactionMs` 中位數，記錄於 [WP-9 progress.md](../exec-plan/active/wp-9-integration/progress.md)。此屬 OQ-9.2/9.4 的手動驗收補項（自動化難以合成真實運動-知覺反應）。

---

## 4. 已知誤差界線（研究者判讀必讀）

反應時間在量測時鐘域為**非決定性**，帶下列已知量化/延遲，判讀時應視為誤差界線而非精確值：

| 來源 | 量級 | 說明 |
|---|---|---|
| **`t_visible` tick 量化** | ≤ 1 sim tick（128 Hz ≈ 7.8 ms） | tick 在 rAF frame 開頭爆發執行，`t_visible` 蓋在該 tick 執行當下（CONTEXT `t_visible`）。 |
| **rAF frame 量化** | ≤ 1 render-frame（60 Hz ≈ 16.7 ms） | 狀態翻轉到玩家「看見」之間隔一次繪製。 |
| **顯示延遲（display latency）** | 數 ms ~ 數十 ms（面板 + 合成器 + 掃描） | 瀏覽器**本質測不到**到光子的絕對延遲（附錄 F）；屬受試者間的**系統性偏移**。 |
| **`performance.now()` 解析度** | ~5 µs（COI 生效時） | 可忽略。 |

**核心原則（§14）**：本工具量的是**受試者內相對值**（同一人多次、左 vs 右、訓練前後），上述系統性偏移在相對比較中大致抵消。**不**宜把單值當絕對人因延遲跨受試者/跨硬體比較。

---

## 5. Out of scope

- 絕對「輸入到光子」硬體延遲（瀏覽器測不到，附錄 F）。
- pilot 實驗設計、跨受試者常模（研究者職責，非工程）。
