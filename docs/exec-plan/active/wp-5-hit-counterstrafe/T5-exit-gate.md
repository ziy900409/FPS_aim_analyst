# T5 / T-exit — Exit gate（宣告 M2）

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-5 ✅ + M2）；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 F3 整體綠燈，宣告 **M2（核心玩法成立）**：能橫移、急停、開火、命中、首發。交棒 WP-6（drill 編排）/ WP-7（記錄這些事件）。

## Steps
- [ ] `npx vitest run` 綠燈（命中/首發/橫移/急停 + WP-2/3 決定性回歸）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗（核心玩法 loop）：移動 → 反向鍵急停 → 停止開火命中目標 → 對側生成 → 重複。
- [ ] map 下方 4 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-5 ✅ + §3 標記 **M2 達成**。
- [ ] progress.md 寫 `Outcomes & Retrospective`（急停語意、首發 peek 邊界、決定性回歸）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-5 / F3 / M2）→ evidence
- [ ] Raycaster 命中判定 + 部位 → T1
- [ ] 首發判定不被掃射稀釋 → T2
- [ ] A/D 橫移正確（固定步長）→ T3
- [ ] 急停停止狀態正確 gate 開火 → T4

## Definition of Done
- 4 項驗收勾選有證據；**M2 達成**並記於頂層索引；交棒 note 指向 WP-6 / WP-7。

## Commit
`docs(wp-5): exit gate — 宣告 M2 + 驗收 map + 交棒 WP-6/7`
