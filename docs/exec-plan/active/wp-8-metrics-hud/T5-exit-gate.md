# T5 / T-exit — Exit gate

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ✅ PASS（2026-07-03） |

## Objective
驗證指標儀表板 + HUD 整體綠燈、map PLAN WP-8 驗收、更新索引、交棒 WP-9（整合 + 計時效度驗證）。

## Steps
- [x] `npx vitest run` 綠燈（8 指標計算 + 固定輸入測試）。→ **24 files / 163 tests pass**（含 `compute.test.ts` 3 / `MetricsDashboard.test.ts` 1 / `ResultScreen.test.ts` 3 / `HUD.test.ts` 3）。
- [x] `npx tsc --noEmit` exit 0。
- [x] 手動驗：跑完 drill → 結果頁顯示 §5 全 8 指標；HUD 即時更新；重來/換 drill 可循環。→ 見下方證據（`npx vite build` pass + T2/T3/T4 Playwright smoke）。
- [x] map 下方 3 項驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-8 ✅。
- [x] progress.md 寫 `Outcomes & Retrospective`（指標與匯出一致性確認、過衝近似定義）。
- [x] 記本機紅綠燈證據（PR 條件性；CI 不可用時以本機證據為準）。

## Acceptance criteria（PLAN WP-8）→ evidence
- [x] 賽後統計顯示 §5 全部 8 指標 → **T1 `computeMetrics` 8 欄位 + T2 `ResultScreen` 8 卡**；`compute.test.ts` / `ResultScreen.test.ts` 綠燈。
- [x] HUD 即時更新 → **T3 `HUD.ts` rAF 讀 `SharedState` + recorder counters**；`HUD.test.ts` 綠燈。
- [x] 可循環使用（重來/換 drill）→ **T4 `Controls.ts` → `DrillRunner.restart()` / `loadDrill()`**；T4 Playwright smoke 可點且 selected drill = `counterstrafe_ad_v1`。

### Verification story（本 session）
- `npx vitest run` → 24 files / 163 tests pass（1.51s）。
- `npx tsc --noEmit` → exit 0。
- `npx vite build` → 40 modules, built，僅既有 chunk-size warning（>500 kB，非迴歸）。
- 互動式 pointer-lock 端到端未於本 session 重跑；沿用 T2/T3/T4 progress 內 Playwright smoke 證據（結果頁 8 卡、HUD 文字更新、Restart/Load 可循環）。WP-9 將做完整計時效度 + 端到端整合驗證。

### Review finding（FYI，交 WP-9 reconcile）
- **首發命中率分母**：T0 對照表記「分母用首發事件數（`firstShot` fire 數）」，但 [compute.ts:61](../../../../src/metrics/compute.ts#L61) 實作分母為 `visibleEvents.length`（可見 peek 數）。兩者僅在「有 peek 但玩家未開首發」時不同（visible 分母會把未開火 peek 計為 miss）。皆為受試者內相對值、可辯護；非 gate blocker，但屬 doc↔impl 語意偏差 → 記入 WP-9 交叉驗證時對齊統計=匯出定義。

## Definition of Done
- 3 項驗收勾選有證據；頂層索引 WP-8 ✅；交棒 note 指向 WP-9。

## Commit
`docs(wp-8): exit gate — 驗收 map + 頂層索引狀態 + 交棒 WP-9`
