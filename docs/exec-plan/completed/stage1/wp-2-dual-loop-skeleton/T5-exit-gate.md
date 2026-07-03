# T5 / T-exit — Exit gate（宣告 M1）

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-2 ✅ + M1 達成）；docs only |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
驗證雙迴圈骨架整體綠燈、**決定性驗證通過**，正式宣告 **M1（專案脊椎）達成**，交棒 WP-3 / WP-4。

## Steps
- [x] `npx tsc --noEmit` exit 0。
- [x] `npx vitest run src` 綠燈（27/27，含 T4 的 9 個決定性測試）；e2e `npx playwright test` 3/3（real Edge）。
- [x] 手動驗：雙迴圈空跑 + console 無 fatal error → 以 e2e 自動化覆蓋（`backend.spec` 於真 Edge 載入頁面並端到端讀 `renderer.backend`、`isolation.spec` 斷言 `crossOriginIsolated===true`，皆綠）。**高 FPS 內插平滑的真人肉眼 spot-check 延至 WP-3**（需真鍵盤驅動 player 位移；承 T3/T4 記錄）。
- [x] map 下方 4 項 WP-2/M1 驗收 → 證據；勾選。
- [x] 翻 [頂層索引](../../README.md) §2 WP-2 ✅，並在 §3 里程碑標記 **M1 達成**。
- [x] progress.md 寫 `Outcomes & Retrospective`（決定性測試涵蓋的 FPS 序列、spike 行為定義）。
- [x] 記本機綠燈證據（未開 PR；本 session 無 push 指示）。

## Acceptance criteria（PLAN WP-2 / M1）→ evidence
- [x] `SharedState` 三迴圈唯一溝通管道 → T1（型別 + 單例 + 4 tests，2026-06-30）
- [x] 雙迴圈空跑、sim 固定 128 Hz、render 解耦 → T2 + T3（SimLoop 6 tests 固定步進/spike 夾除、RenderLoop 4 tests；e2e 真 Edge 空跑無 fatal error）
- [x] render 內插高 FPS 不抖 → T3（lerp 內插數學單元測試把關；機制由 T4 決定性間接覆蓋；真人平滑度 spot-check 延 WP-3）
- [x] **決定性驗證通過（M1 gate）** → T4（9 tests：60/144/240/抖動逐 tick exact 一致 + spike 夾除定義，2026-07-01）

## Definition of Done
- 4 項驗收勾選有證據；**M1 正式達成**並記於頂層索引；交棒 note 指向 WP-3 / WP-4（可並行）。
- ⚠️ 若 T4 未通過：**不得**宣告 M1、不得開 WP-3+；回 T2/T4 修正。

## Commit
`docs(wp-2): exit gate — 宣告 M1 達成 + 頂層索引狀態 + 交棒 WP-3/4`
