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

### 2026-07-01 — 審查驅動的文件補強（T0 後、T1 前；docs only）

對 T0 記錄的交棒發現（「WP-2 佔位用 `splice` + 假設已排序；consume 需排序 + T4 覆蓋亂序」）做一次 review，補強三處 spec 缺口。**皆為文件層決策，尚無生產碼。**

**Decision Log（本次非平凡選擇）：**

- **D-3a｜tick 邊界統一嚴格 `<`（半開窗），非 `<=`。** 原 WP-3 契約（README §2 / T4）寫「取 `t <= untilT`」與 WP-2 佔位 `consumeInput`（[SimLoop.ts:32](../../../../src/loop/SimLoop.ts#L32) `t < tickEndMs`）矛盾。*決議*：向 WP-2 對齊用 `<`。*理由*：WP-2 決定性已鎖、M1 綠燈（2026-07-01），`t == tickEndMs` 事件在 `<=` 下會早一 tick 消費 → 破壞 T4「重跑 WP-2 決定性回歸仍綠」。*Alternatives*：(a) 改 WP-2 為 `<=` → 破壞已證 M1 性質，否決；(b) consume 收 `nextTickStart` 配 `<=` → 語意繞路、易再漂移，否決。已升 **[DECISIONS.md](../../DECISIONS.md) GD-3**（跨 WP-2/WP-3）並回寫 README §2 + T4 全文。

- **D-3b｜排序責任移到採集端（保序寫入），非 consume 端每 tick 全排序。** 原 Failure modes 寫「consume 端排序」。*決議*：InputSampler 寫入時保序（`event.timeStamp` 近單調 → append 近有序；罕見亂序 bounded insertion）；consume 只游標排空。*理由*：OQ-3.2 鎖定 ring buffer 為 packed 數值槽（`type,t,a,b`），consume 端每 tick 全排序需配置 sort scratch → 違反 CLAUDE.md §4「無 GC 卡頓」，且環狀 packed 就地排序困難。深度更足。已回寫 README §2 Failure modes。

- **D-3c｜T4 scope 補「遲到事件 + `lateEventCount` + `bufferOverflow`」。** 原 T4 只提「亂序」，漏了與亂序正交的兩件事：遲到（事件晚於已關閉 tick）與溢位。二者已是 GD-2 專案級 metadata，但 T4 scope 未捕捉行為。*決議*：T4 In scope / Steps / DoD 補上；並明記**逐 tick exact 決定性只涵蓋預排序合成事件路徑**，遲到事件本質 wall-clock 相依、非決定性（不納 exact 斷言）。已回寫 [T4-sim-consume.md](T4-sim-consume.md)。

**影響面**：T1（採集端保序）、T4（consume 契約 + 遲到/溢位測試 + 邊界回歸）。無碼改動、無回歸風險（純 spec）。

**Next**：T1（鍵盤採集，須落實 D-3b 保序寫入雛形）。

### 2026-07-01 — T0 Entry gate ✅（docs only, no production code）
- **PASS**：M1 已達成——[WP-2 exit-gate](../wp-2-dual-loop-skeleton/T5-exit-gate.md) ✅（DONE 2026-07-01，決定性 9 tests 綠、tsc 0、vitest 27/27、e2e 3/3），[頂層索引](../../README.md) §3 標 **M1 達成（2026-07-01）**。
- 緩衝/消費掛點就緒：`SharedState.input`（[SharedState.ts:15](../../../../src/state/SharedState.ts#L15)，`InputEvent[]` 佔位陣列，WP-3 換 ring buffer）；`SimLoop` consume 掛點（[SimLoop.ts:29](../../../../src/loop/SimLoop.ts#L29) `consumeInput`，`simStep` line 56 呼叫，已依 timeStamp 分桶消費 + `splice` 排空——佔位機制待 T4 換 ring buffer 槽位重用）。`InputEvent` union（key/mouse/fire）已與 README §2 interface 契約一致（[types.ts:18](../../../../src/state/types.ts#L18)）。
- **鎖 OQ**：OQ-3.1（只記原始鍵碼、反向語意延 WP-5）、OQ-3.2（固定欄位真環狀 ring buffer、靜態容量不動態 resize、溢位 `bufferOverflow`）、OQ-3.3（`event.timeStamp` 同 `performance.now()` time origin，僅 Chromium）——三者翻 ✅（README §1 + 上方 ledger）。
- **Surprise / note**：WP-2 佔位消費用陣列前端 `splice`（[SimLoop.ts:42](../../../../src/loop/SimLoop.ts#L42)）——WP-3 的 `consume.ts` 需改為 ring buffer 游標推進、且加入「桶內按 t 升冪排序」（現佔位假設輸入已排序，T4 需覆蓋亂序）。
- **Next**：T1（鍵盤採集）∥ T2（滑鼠 coalesced）∥ T3（開火）→ T4（sim 消費 + 排空）。
