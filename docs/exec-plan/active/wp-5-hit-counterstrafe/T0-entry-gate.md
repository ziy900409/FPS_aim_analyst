# T0 — Entry gate

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-3 exit ✅、WP-4 exit ✅ |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認輸入事件（WP-3）與目標/hitbox/`t_visible`（WP-4）就緒，敲定急停/首發/精準 gate 語意（OQ-5.1~5.4）——這些定義直接決定 §5 指標效度。

## Steps
- [ ] 確認 WP-3 exit ✅（fire/key 事件入緩衝、sim 消費）+ WP-4 exit ✅（hitbox + t_visible + markKilled）。
- [ ] 鎖 OQ-5.1：布林精準 gate（stopped→accurate；residualSpeed 二元 {0,±v} → 結果頁分類）。
- [ ] 鎖 OQ-5.2：瞬間 snap 到 `v_strafe`(~250 u/s)、反向鍵穿越 tick 歸零（M1）。
- [ ] 鎖 OQ-5.3：peek 起點 = t_visible；**P2 命中才推進**、`peekTimeoutMs` 防卡；新目標可見 reset 首發。
- [ ] 鎖 OQ-5.4：**第一次命中**即擊殺 → markKilled（spawnDelay 0）。
- [ ] README §1 + progress.md 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：WP-3/WP-4 綠燈 + 急停/首發語意明確；否則 STOP。
- OQ-5.1~5.4 翻 ✅。

## Commit
`docs(wp-5): T0 entry gate — 確認 WP-3/4 + 鎖 OQ-5.1~5.4`
