# T5 / T-exit — Exit gate（宣告 M1）

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-2 ✅ + M1 達成）；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證雙迴圈骨架整體綠燈、**決定性驗證通過**，正式宣告 **M1（專案脊椎）達成**，交棒 WP-3 / WP-4。

## Steps
- [ ] `npx tsc --noEmit` exit 0。
- [ ] `npx vitest run` 綠燈（含 T4 決定性測試）。
- [ ] 手動驗：`npm run dev` 雙迴圈空跑、高 FPS 內插平滑、console 無 error。
- [ ] map 下方 4 項 WP-2/M1 驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-2 ✅，並在 §3 里程碑標記 **M1 達成**。
- [ ] progress.md 寫 `Outcomes & Retrospective`（決定性測試涵蓋的 FPS 序列、spike 行為定義）。
- [ ] （條件性）`gh pr create` 或記本機綠燈證據。

## Acceptance criteria（PLAN WP-2 / M1）→ evidence
- [ ] `SharedState` 三迴圈唯一溝通管道 → T1
- [ ] 雙迴圈空跑、sim 固定 128 Hz、render 解耦 → T2 + T3
- [ ] render 內插高 FPS 不抖 → T3
- [ ] **決定性驗證通過（M1 gate）** → T4

## Definition of Done
- 4 項驗收勾選有證據；**M1 正式達成**並記於頂層索引；交棒 note 指向 WP-3 / WP-4（可並行）。
- ⚠️ 若 T4 未通過：**不得**宣告 M1、不得開 WP-3+；回 T2/T4 修正。

## Commit
`docs(wp-2): exit gate — 宣告 M1 達成 + 頂層索引狀態 + 交棒 WP-3/4`
