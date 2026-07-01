# WP-3 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T0 過閘（M1 已達成）；T1/T2/T3 可並行展開

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ DONE (2026-07-01) |
| T1 鍵盤採集 | ⬜ 待執行 |
| T2 滑鼠 coalesced | ⬜ 待執行 |
| T3 開火事件 | ⬜ 待執行 |
| T4 sim 消費 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-3.1 反向鍵定義 | ✅ locked T0 | 採集層只記原始鍵碼；反向語意在 WP-5 處理 |
| OQ-3.2 緩衝結構 | ✅ grill | 固定欄位 **ring buffer**（真環狀、靜態容量、不動態 resize）；溢位 `bufferOverflow` |
| OQ-3.3 時間戳對齊 | ✅ grill | 同 `performance.now()` time origin（僅 Chromium，須重驗）|

---

## Log

### 2026-07-01 — T0 Entry gate ✅（docs only, no production code）
- **PASS**：M1 已達成——[WP-2 exit-gate](../wp-2-dual-loop-skeleton/T5-exit-gate.md) ✅（DONE 2026-07-01，決定性 9 tests 綠、tsc 0、vitest 27/27、e2e 3/3），[頂層索引](../../README.md) §3 標 **M1 達成（2026-07-01）**。
- 緩衝/消費掛點就緒：`SharedState.input`（[SharedState.ts:15](../../../../src/state/SharedState.ts#L15)，`InputEvent[]` 佔位陣列，WP-3 換 ring buffer）；`SimLoop` consume 掛點（[SimLoop.ts:29](../../../../src/loop/SimLoop.ts#L29) `consumeInput`，`simStep` line 56 呼叫，已依 timeStamp 分桶消費 + `splice` 排空——佔位機制待 T4 換 ring buffer 槽位重用）。`InputEvent` union（key/mouse/fire）已與 README §2 interface 契約一致（[types.ts:18](../../../../src/state/types.ts#L18)）。
- **鎖 OQ**：OQ-3.1（只記原始鍵碼、反向語意延 WP-5）、OQ-3.2（固定欄位真環狀 ring buffer、靜態容量不動態 resize、溢位 `bufferOverflow`）、OQ-3.3（`event.timeStamp` 同 `performance.now()` time origin，僅 Chromium）——三者翻 ✅（README §1 + 上方 ledger）。
- **Surprise / note**：WP-2 佔位消費用陣列前端 `splice`（[SimLoop.ts:42](../../../../src/loop/SimLoop.ts#L42)）——WP-3 的 `consume.ts` 需改為 ring buffer 游標推進、且加入「桶內按 t 升冪排序」（現佔位假設輸入已排序，T4 需覆蓋亂序）。
- **Next**：T1（鍵盤採集）∥ T2（滑鼠 coalesced）∥ T3（開火）→ T4（sim 消費 + 排空）。
