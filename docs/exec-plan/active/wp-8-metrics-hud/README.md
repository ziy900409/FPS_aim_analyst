# WP-8 — 指標儀表板與 HUD

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-8（PLAN §5）— *指標儀表板與 HUD* |
| **里程碑** | M3 之後；通往 M4 |
| **相依** | WP-5（即時狀態）、WP-6（drill 控制）、WP-7（記錄 → 統計來源） |
| **Type** | 指標 + UI（DOM overlay，D1）：賽後統計 + 即時 HUD |
| **Module / 觸及路徑** | NEW `src/metrics/MetricsDashboard.ts`、`src/metrics/compute.ts`、`src/ui/ResultScreen.ts`、`src/ui/HUD.ts`、`src/ui/Controls.ts` |
| **必讀** | 規格 §5（8 項指標定義）· §1.4（非主觀評分）· §14（受試者內相對值方法論）· [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 3–4 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

把 WP-7 記錄的資料計算成規格 §5 的 **8 項指標**（純機械、無主觀評分），於 drill 後以結果頁呈現，並提供即時 HUD（分數、計時、命中率、velocity 指示）與重新開始/換 drill 控制。指標必須能從時間戳與座標純機械算出（§5），呈現時附受試者內相對值的提醒（§14）。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-8.1** | `MetricsDashboard` 計算 §5 全部 8 項指標（急停反應時間、速度歸零誤差、停火時序對齊、首發命中率、準心對齊偏移、切換時間、節奏穩定度、左右對稱性）。 | T1 |
| **FR-8.2** | 結果畫面（DOM）：反應時間、命中率、停止狀態、過衝（**階段 A 分類：已停止/移動中、有無反向，非 u/s**）、左右對稱。 | T2 |
| **FR-8.3** | 即時 HUD（DOM）：分數、計時、命中率、velocity 指示。 | T3 |
| **FR-8.4** | 重新開始 / 換 drill 控制。 | T4 |

### Non-functional Requirements

- **純機械計算**：每指標可由時間戳/座標確定性算出，無主觀評分（§5）。
- **UI = DOM overlay（D1）**：HUD/結果頁/控制皆純 TS + DOM，不引框架。
- **HUD 不污染量測**：HUD 只在 rAF 讀 `SharedState`/記錄更新文字，不進 sim、不每幀配置。
- **階段 A 指標分層（grill / 規格 §5 註）**：時序維度完整可量；精度維度（速度歸零誤差、過衝）二元 → **分類呈現、非 u/s**；停火時序對齊的 `t_velocity_zero` 塌縮成 `t_counter`；追蹤指標（F5）不在階段 A。

### Constraints

- 指標計算消費 WP-7 的 `ticks[]` + `events[]`（同一資料來源 = 匯出 = 統計，確保一致）。
- 左右對稱性需分別統計左/右 peek（CONTEXT 定義）。
- 結果頁呈現相對值 + 顯示延遲誤差界線提醒（§14 方法論）。

### Out of scope
- 端到端整合測試/計時效度驗證（→ WP-9）。
- 多 drill 選單的複雜 UI（階段 A 簡單切換即可）。
- 進階圖表（直方圖/散布）若超出階段 A 需求可精簡（先數值卡 + 必要圖）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-8.1** | 指標計算用記錄即時算 vs 匯出後算？ | 用 WP-7 in-memory `snapshot()`（與匯出同來源）在 drill ended 後計算，確保統計=匯出。 | T1 |
| **OQ-8.2** | 「過衝」定義？ | **階段 A 立即停止（M1）下退化成二元（grill）**：僅「有無反向」（velocity 符號是否翻轉），非連續幅度；結果頁以**分類**呈現。連續過衝幅度待階段 B physics。 | T1, T2 |
| **OQ-8.3** | HUD 呈現哪些即時值？ | 分數（擊殺數）、計時（drill 時間）、命中率（累積）、velocity 指示（停止/移動狀態條）。 | T3 |
| **OQ-8.4** | 結果頁要不要圖表？ | 階段 A：數值卡為主 + 反應時間分布小圖（為 WP-9 對照 150–250 ms 鋪路）；其餘延後。 | T2 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/metrics/compute.ts          ← NEW (8 指標純函式：吃 ticks+events → 數值)        [FR-8.1]
src/metrics/MetricsDashboard.ts ← NEW (drill ended → compute → 結果模型)            [FR-8.1]
src/ui/ResultScreen.ts          ← NEW (DOM 結果頁：卡 + 反應時間分布)               [FR-8.2]
src/ui/HUD.ts                   ← NEW (DOM 即時 HUD：分數/計時/命中率/velocity)      [FR-8.3]
src/ui/Controls.ts              ← NEW (重新開始 / 換 drill)                          [FR-8.4]
```

### Data flow

```
running：HUD（rAF）讀 SharedState（player velocity/stopped）+ recorder 累積（擊殺/命中率/計時）→ 更新文字
ended（WP-6）：MetricsDashboard.compute(recorder.snapshot()) → 8 指標 → ResultScreen 呈現
Controls：restart → DrillRunner.restart（WP-6）；換 drill → DrillLoader.load 新 config → start
```

### Interface contracts（§5 八指標）

```ts
// src/metrics/compute.ts (FR-8.1)
export interface Metrics {
  counterReactionMs: Stat;       // 急停反應時間 t_counter - t_visible
  residualSpeed: Stat;           // 速度歸零誤差；階段 A 二元 {0,±v} → 分類呈現（grill）
  fireTimingAlignmentMs: Stat;   // 停火時序；階段 A t_velocity_zero 塌縮成 t_counter（grill）
  firstShotHitRate: number;      // 首發命中率 %
  crosshairOffset: Stat;         // 準心對齊偏移
  switchTimeMs: Stat;            // 切換時間 t_next_acq - t_prev_kill
  rhythmStability: number;       // 節奏穩定度（循環時長 CV/SD）
  leftRightSymmetry: { left: Stat; right: Stat; diff: number };  // 左右對稱性
}
export interface Stat { mean: number; sd: number; n: number; values?: number[]; }
export function computeMetrics(snapshot: { ticks: TickRecord[]; events: DrillEvent[] }): Metrics;
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| 統計 ≠ 匯出 | 兩來源不同 | 統一用 `recorder.snapshot()`（OQ-8.1）；WP-9 驗證統計與匯出 JSON 對得上 |
| 主觀評分混入 | 指標含人為權重 | 全部純函式可由時間戳/座標確定算出（§5）；單元測試固定輸入→固定輸出 |
| HUD 污染量測 | HUD 進 sim/每幀配置 | HUD 只 rAF 讀值更新 DOM 文字；不寫 SharedState |
| 除以零/空樣本 | 0 valid peek | Stat n=0 → 顯示 N/A，不 NaN 外漏 |

### Concurrency model
HUD 在 rAF 讀；指標在 drill ended 後一次性計算。無 worker。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **指標與匯出資料不一致** | Med | High | 同一 `snapshot()` 來源（OQ-8.1）；WP-9 交叉驗證 |
| 指標定義誤解（§5） | Med | High | 逐指標對照 §5 定義 + CONTEXT 術語；固定輸入單元測試 |
| 過衝定義模糊 | Med | Med | OQ-8.2 以 velocity 軌跡近似；明確記文件 |
| HUD 卡頓污染 | Low | Med | rAF 讀值、無每幀配置；與 sim 解耦 |

### Technical debt
- 過衝為近似定義（OQ-8.2）；進階圖表精簡（OQ-8.4）。*Trigger*：pilot 需更精細呈現。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 M3（WP-7）+ WP-5/6；鎖 OQ-8.1~8.4；逐指標對照 §5。 | WP-5, WP-6, WP-7 | Low | Low |
| **T1** 指標計算 | [T1-compute-metrics.md](T1-compute-metrics.md) | §5 全部 8 指標純函式（FR-8.1）。 | T0 | Med | High |
| **T2** 結果頁 | [T2-result-screen.md](T2-result-screen.md) | DOM 結果頁：卡 + 反應時間分布 + 左右對稱（FR-8.2）。 | T1 | Low | Med |
| **T3** 即時 HUD | [T3-hud.md](T3-hud.md) | DOM HUD：分數/計時/命中率/velocity（FR-8.3）。 | T0 | Low | Med |
| **T4** 控制（重來/換 drill） | [T4-controls.md](T4-controls.md) | 重新開始 / 換 drill（FR-8.4）。 | T0 | Low | Low |
| **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | 8 指標顯示、HUD 即時、可循環；交棒 WP-9。 | T1–T4 | Low | Low |

### Acceptance criteria（PLAN WP-8）→ task map
- [ ] 賽後統計顯示 §5 全部 8 指標 → **T1 + T2**
- [ ] HUD 即時更新（分數/計時/命中率/velocity）→ **T3**
- [ ] 可循環使用（重來/換 drill）→ **T4**

## Assumptions
- **A1**：M3 達成（WP-7 記錄 + 匯出）；指標消費同一 snapshot。
- **A2**：8 指標皆純機械計算（§5）；過衝為 velocity 軌跡近似（OQ-8.2）。
- **A3**：UI 為 DOM overlay（D1）。
