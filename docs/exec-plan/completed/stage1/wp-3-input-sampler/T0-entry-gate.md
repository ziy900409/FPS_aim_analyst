# T0 — Entry gate

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-2 exit ✅（**M1 達成**） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
確認 **M1 已達成**（決定性驗證綠燈）才採集資料——否則採來的資料無效。確認 `SharedState.input` 緩衝與 sim 消費掛點就緒。鎖 OQ-3.1/3.2/3.3。

## Steps
- [x] 確認 [WP-2 exit-gate](../wp-2-dual-loop-skeleton/T5-exit-gate.md) ✅（DONE 2026-07-01，決定性 9 tests 綠）且[頂層索引](../../README.md) §3 標記 **M1 達成（2026-07-01）**。
- [x] 確認 `SharedState.input` 欄位（[SharedState.ts:15](../../../../src/state/SharedState.ts#L15)，`InputEvent[]` 佔位）+ `SimLoop` 有 consume 掛點（[SimLoop.ts:29](../../../../src/loop/SimLoop.ts#L29) `consumeInput`，於 `simStep` line 56 呼叫）。`InputEvent` union（key/mouse/fire）已與 README 契約一致（[types.ts:18](../../../../src/state/types.ts#L18)）。
- [x] 鎖 OQ-3.1：採集層只記原始鍵碼，反向語意延 WP-5。
- [x] 鎖 OQ-3.2：**固定欄位 ring buffer**（真環狀、靜態容量、不動態 resize）。
- [x] 鎖 OQ-3.3：`event.timeStamp` 與 sim clock 同 time origin（僅 Chromium，須重驗）。
- [x] README §1 + progress.md ledger 翻 ✅；加 dated log。

## Definition of Done
- **PASS 條件**：M1 達成 + 緩衝/消費掛點就緒；否則 STOP（M1 未過不應採資料）。
- OQ-3.1/3.2/3.3 翻 ✅。

## Commit
`docs(wp-3): T0 entry gate — 確認 M1 + 鎖 OQ-3.1/3.2/3.3`
