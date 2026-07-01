# WP-3 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T1+T2+T3 完成（鍵盤 + 滑鼠 coalesced + 開火）；T4 前置齊備、待執行

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ DONE (2026-07-01) |
| T1 鍵盤採集 | ✅ DONE (2026-07-01) |
| T2 滑鼠 coalesced | ✅ DONE (2026-07-01) |
| T3 開火事件 | ✅ DONE (2026-07-01) |
| T4 sim 消費 | ⬜ 待執行（T1–T3 齊備，前置解除） |
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

### 2026-07-01 — T2 滑鼠 coalesced 採集 ✅ PASS（pointermove + getCoalescedEvents 次幀採樣，FR-3.2）

**交付：** MODIFY [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（`onPointerMove` + attach/detach 掛載）、[`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（+3 coalesced tests + pointermove 合成 helper）。

| 項目 | 內容 |
|------|------|
| API | `pointermove` → `(e.getCoalescedEvents?.() ?? [e])` 逐一 `state.input.push({type:'mouse', dx:ev.movementX, dy:ev.movementY, t:ev.timeStamp})`；每個 coalesced 子事件各一筆（保留次幀解析度）。attach/detach 掛/移 `pointermove`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **40 passed**（13 InputSampler[6 鍵盤 + 4 開火 + 3 滑鼠] + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（+3） | 多子事件 pointermove → 全部樣本入緩衝、dx/dy 對應、timeStamp 遞增、無遺漏（樣本數 = 子事件數 > 1）· `getCoalescedEvents` 缺席 fallback 到 `[e]` 單筆 · detach 移除 pointermove 監聽。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T2.1｜合成 pointermove 的頂層 `movementX/Y/timeStamp` 取「最後一筆 coalesced 子樣本」的值。** *理由*：貼近瀏覽器行為（外層 pointermove 為該幀最終彙總值，coalesced 為其次幀展開）；本 task 僅消費 `getCoalescedEvents()`，故頂層值只在 fallback 路徑（舊瀏覽器單筆）被讀，取最後一筆語意一致。*Alternatives*：頂層留空 → fallback 測試會拿到 undefined，語意模糊，否決。
- **D-T2.2｜`state.input` 仍用 WP-2 佔位 array `push`（不引入 ring buffer / 排序）。** *理由*：延續 D-T1.3 / D-3b——`push` 依到達順序 append，coalesced 子事件本就按 `timeStamp` 升冪回傳，保序前提成立（GD-3/D-3b）。ring buffer（OQ-3.2）屬後續切片，Rule 0 簡單優先。
- **D-T2.3｜與 WP-1 視角互不干擾：本 task 只入緩衝、不套用視角。** WP-1 走 `pointerLock.onMove` 即時驅動 camera；量測用的 coalesced 樣本獨立入 `state.input`，兩條路徑不共用、不互相呼叫（ADR-2 三迴圈只透過 SharedState 溝通）。滑鼠不受 T3 的 `isLocked` 閘門（該閘門僅套用於 fire）。

**Surprises & Discoveries：**
- 無意外。唯一測試設施擴充：`makeFakeTarget.dispatch` 參數型別由 `Partial<KeyboardEvent & MouseEvent>` 拓為含 `PointerEvent`（納入 `getCoalescedEvents`/`movementX/Y`），非破壞性、既有 13 測試無回歸。
- **Scope note**：coalesced 樣本無條件入緩衝（未依 drill 生命週期閘門）——量測期 gating 屬 WP-6，同 T1/T3。

**Next**：T4（sim 依 `event.timeStamp` 時序消費 + ring buffer 排空，GD-3/D-3b）——T1–T3 齊備，前置解除。

### 2026-07-01 — T3 開火事件 ✅ PASS（mousedown 左鍵 + event.timeStamp，僅鎖定中，FR-3.3）

**交付：** MODIFY [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（`onMouseDown` + lock 閘門）、[`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（+4 fire tests）、[`src/main.ts`](../../../../src/main.ts)（注入 `() => pointerLock.locked`）。

| 項目 | 內容 |
|------|------|
| API | `createInputSampler(state, isLocked = () => true)`；`mousedown`（button 0 且 `isLocked()`）→ `state.input.push({type:'fire', t:event.timeStamp})`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **37 passed**（10 InputSampler[6 鍵盤 + 4 開火] + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（+4） | 鎖定中左鍵入緩衝 + 時間戳 · 未鎖定不入 · 非左鍵（右/中鍵）不入 · detach 移除 mousedown 監聽。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T3.1｜lock 閘門用注入的 `isLocked: () => boolean`（第二參數，預設 `() => true`），非在 sampler 內直讀 `document.pointerLockElement`。** *理由*：(1) 守本專案 DI 可測慣例（D-T1.1；node 測試無 `document`，注入假旗標即可驗鎖定/未鎖定兩路徑）；(2) lock 權威狀態已由 [`PointerLock.ts`](../../../../src/input/PointerLock.ts) 以 `document.pointerLockElement === canvas` 事件驅動維護（D-T2.1），sampler 直讀 global 會複製該權威、且無法引用 canvas。main 傳 `() => pointerLock.locked`。*Alternatives*：(a) sampler 直讀 `document.pointerLockElement` → 破 DI、與 PointerLock 權威重複，否決；(b) 必填參數 → 破壞既有 `createInputSampler(state)`（鍵盤測試 + 語意上鍵盤不受閘門），否決。*預設 `() => true`*：sampler 單獨/鍵盤路徑不閘門（與 T1 鍵盤無條件採集一致）；閘門僅套用於 fire。
- **D-T3.2｜開火 mousedown 掛在 `window`（沿用 T1 `attach(window)`），非 canvas。** *理由*：Pointer Lock 鎖定中滑鼠事件冒泡至 window；且與鍵盤同 target 便於單一 attach/detach 生命週期。「點擊 canvas 取鎖」的 mousedown 在鎖定完成前 `pointerLock.locked` 仍為 false（lock 為 async、由 `pointerlockchange` 確立），故取鎖點擊自然被閘門濾除，不誤判為開火。

**Surprises & Discoveries：**
- 無意外。fire 為最小切片（Low/Low）；lock 閘門的 async 時序（取鎖 mousedown 早於 locked=true）恰好使「未鎖定不採計」同時擋掉取鎖點擊，與 T3 design note 目的一致。
- **Scope note**：與 T1 同——sampler 仍無條件 `attach(window)`，drill 生命週期 gating 屬 WP-6；fire 的 lock 閘門只擋 UI/取鎖點擊，非量測期閘門。

**Next**：T2（滑鼠 `pointermove` + `getCoalescedEvents()` 次幀採樣，FR-3.2）——本 WP 唯一 Med/Med 風險項；完成後 T1–T3 齊備即可進 T4（sim 消費）。

### 2026-07-01 — T1 鍵盤採集 ✅ PASS（keydown/keyup + event.timeStamp，FR-3.1）

**交付：** NEW [`src/input/InputSampler.ts`](../../../../src/input/InputSampler.ts)（鍵盤部分）+ [`InputSampler.test.ts`](../../../../src/input/InputSampler.test.ts)（6 tests）；MODIFY [`src/main.ts`](../../../../src/main.ts)（建 sampler + `attach(window)`）。

| 項目 | 內容 |
|------|------|
| API | `createInputSampler(state) → { attach(target), detach() }`；keydown（非 repeat）/keyup 過濾 A/D/W/S → `state.input.push({type:'key',code,down,t:event.timeStamp})`。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **33 passed**（6 新 InputSampler + 27 既有，無回歸）；`npx vite build` → **✓ built**。 |
| 測試覆蓋（6） | 時間戳寫入 · A/D/W/S 過濾（無關鍵不入緩衝）· `event.repeat` 不重複 · 時間戳原樣保留 · detach 移除監聽 · attach 冪等。 |

**Decision Log（本切片非平凡選擇）：**
- **D-T1.1｜`attach` 參數型別 `HTMLElement` → `EventTarget`（偏離 README 原契約）。** *理由*：鍵盤事件實務落在 `window`/`document`，非某 HTMLElement；`EventTarget` 為 `Window`/`Document`/`HTMLElement` 共同上界，且 node 測試可注入假 target（守本專案「注入假物件」測試慣例，如 `clock.ts`）。*Alternatives*：(a) 維持 `HTMLElement` + main.ts 傳 canvas → canvas 需 focus 才收鍵盤，脆弱，否決；(b) 硬編 `window` 不收 target → 失去 DI 可測性，否決。**已同步回寫 README §2 interface contract。**
- **D-T1.2｜採集端過濾 A/D/W/S（`KeyboardEvent.code`）。** *理由*：只有移動鍵是量測所需；過濾避免打字/快捷鍵污染緩衝、守 GC 紀律（不 push 無關事件）。用 `code` 非 `key`（避 layout 差異，設計註記）。反向語意不在此處（OQ-3.1 → WP-5）。
- **D-T1.3｜`state.input` 維持 WP-2 佔位 plain array 的 `push`（本切片不換 ring buffer）。** *理由*：T1 touches 不含 `SharedState.ts`；`push` 依到達順序 append，`event.timeStamp` 近單調 ⇒ 近有序，滿足 D-3b 保序前提。ring buffer（OQ-3.2）與 D-3b 的 bounded-insertion 屬後續切片，不在 T1 過度實作（Rule 0 簡單優先）。

**Surprises & Discoveries：**
- **⚠️ 分支事故（已復原）**：實作 T1 期間工作區被切到 `wp-4-target-tvisible` 分支（疑似並行 WP-4 session 的 `git checkout`）。未提交的 T1 變更一度落在 wp-4 上。**復原**：restore 兩個 doc 檔（改動小、可重做）→ `git checkout wp-3-input-sampler`（main.ts 兩分支相同、untracked 檔隨遷移，皆乾淨）→ 於 wp-3 重驗 tsc/vitest（33 綠）+ 重貼 doc 編輯。wp-3 兩個 docs commit（T0 `ef52e66`、review `2e6df3f`）確認完好。**教訓**：並行 WP session 共用同一 worktree 會互相切換分支；跨 session 應各自 worktree（`git worktree`）隔離。
- **Scope note**：sampler 目前 `attach(window)` 無條件採集（未依 drill/pointerLock 閘門）；量測期間才採集的 gating 屬 WP-6 drill 生命週期，本切片不做（記此以免誤判為遺漏）。

**Next**：T2（滑鼠 `pointermove` + `getCoalescedEvents()`）∥ T3（開火 mousedown）——皆 append 進同一 sampler。

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
