# T0 — Entry gate

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-5 ✅、WP-6 ✅、WP-7 ✅（M3） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認 M3 達成（記錄 + 匯出）、WP-5 即時狀態 + WP-6 drill 控制可用，並**逐指標對照規格 §5** 確定每個指標的輸入欄位與公式（避免誤解）。鎖 OQ-8.1~8.4。

## Steps
- [ ] 確認 WP-7 snapshot/匯出可用、WP-5 velocity/stopped + WP-6 DrillRunner.restart/load 可用。
- [ ] 逐項對照 §5 8 指標 → 輸入欄位（ticks/events）與公式，記 progress.md。
- [ ] 鎖 OQ-8.1：用 WP-7 snapshot（與匯出同源）。
- [ ] 鎖 OQ-8.2：過衝 = velocity 過零後反向量近似。
- [ ] 鎖 OQ-8.3：HUD 即時值集合。
- [ ] 鎖 OQ-8.4：結果頁 = 數值卡 + 反應時間分布小圖。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M3 達成 + 8 指標輸入/公式對照 §5 完成；否則 STOP。
- OQ-8.1~8.4 翻 ✅。

## Commit
`docs(wp-8): T0 entry gate — 對照 §5 八指標 + 鎖 OQ-8.1~8.4`
