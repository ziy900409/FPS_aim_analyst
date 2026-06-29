# T0 — Entry gate

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-2 exit ✅（**M1 達成**） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ⬜ TODO |

## Objective
確認 **M1 已達成**（決定性驗證綠燈）才採集資料——否則採來的資料無效。確認 `SharedState.input` 緩衝與 sim 消費掛點就緒。鎖 OQ-3.1/3.2/3.3。

## Steps
- [ ] 確認 [WP-2 exit-gate](../wp-2-dual-loop-skeleton/T5-exit-gate.md) ✅ 且頂層索引標記 **M1 達成**。
- [ ] 確認 `SharedState.input` 欄位 + `SimLoop` 有 consume 掛點（WP-2 T1/T2）。
- [ ] 鎖 OQ-3.1：採集層只記原始鍵碼，反向語意延 WP-5。
- [ ] 鎖 OQ-3.2：普通陣列緩衝 + 消費清空。
- [ ] 鎖 OQ-3.3：`event.timeStamp` 與 sim clock 同基準。
- [ ] README §1 + progress.md ledger 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M1 達成 + 緩衝/消費掛點就緒；否則 STOP（M1 未過不應採資料）。
- OQ-3.1/3.2/3.3 翻 ✅。

## Commit
`docs(wp-3): T0 entry gate — 確認 M1 + 鎖 OQ-3.1/3.2/3.3`
