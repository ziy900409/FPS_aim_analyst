# DECISIONS — 全域決策與跨文件矛盾帳本

> 專案的**全域 episodic memory**:記跨 WP / 跨文件的決策、未解問題、文件間的不一致。
> per-WP 的決策與意外寫在各 WP 的 `progress.md`;**跨界的**(影響規格 / PLAN / 多個 WP)才寫這裡。
> 索引:[exec-plan/README.md](README.md) · 術語:[CONTEXT.md](../../CONTEXT.md) · 導航:[docs/MAP.md](../MAP.md)
> 語言:繁體中文,術語保留英文(D4)。最新在上。

---

## 1. 既有決策的權威來源(本檔不複製,只指路)

| 類別 | 出處 | 內容 |
|---|---|---|
| 架構決策 **ADR-1~9** | [規格書](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 1 WebGPU+fallback、2 雙迴圈、3 固定步長 128Hz、4 計時/cross-origin、5 Pointer Lock 原始輸入、6 目標 motion registry、7 兩個時鐘、8 peek 推進 P2、9 source unit |
| 規劃補充決策 **D1~D5** | [PLAN.md §1](../PLAN.md) | 2D UI 技術、測試框架、COOP/COEP 部署、文件語言、PLAN 顆粒度 |

> 上述為已定案的權威決策,改動須回原文件並在此記一筆變更。

---

## 2. 未解 / 待對帳項(OPEN)

> 狀態:🔴 矛盾待解 · 🟡 待決策 · ✅ 已解(移至 §3 並標日期)

> 目前無未解項。GD-1(F5 範圍)已於 2026-06-29 解決,見 §3。

---

## 3. 已解決(CLOSED)

### GD-3 ✅ 輸入消費 tick 邊界語意 — WP-2 `<` vs WP-3 契約 `<=` 矛盾(2026-07-01)

| | |
|---|---|
| **發現處** | WP-3 T0 審查:WP-2 佔位 [`SimLoop.consumeInput`](../../src/loop/SimLoop.ts)(`buf[consumed].t < tickEndMs`,嚴格 `<`、半開窗 `[tickStart,tickEnd)`)與 WP-3 契約([wp-3 README §2](active/wp-3-input-sampler/README.md) `consume` + [T4-sim-consume.md](active/wp-3-input-sampler/T4-sim-consume.md))原寫「取 `t <= untilT`」不一致。 |
| **問題** | 若 WP-3 照 `<=` 實作且以 `untilT = tickEndMs` 呼叫,`t == tickEndMs` 的事件會比 WP-2 佔位早一個 tick 被消費 → 事件落入的 tick index 位移 → **破壞 M1 已鎖的決定性回歸**(T4 「重跑 WP-2 決定性測試仍綠」在邊界事件上會紅)。 |
| **決議** | 統一為**嚴格 `<`**、半開窗 `[tickStart, untilT)`,caller 傳 `tickEndMs`。**理由**:WP-2 決定性已鎖定且 M1 綠燈(2026-07-01),改 WP-2 會破壞已證性質;故 WP-3 向 WP-2 對齊,而非反向。 |
| **對帳結果** | 已回寫 [wp-3 README §2](active/wp-3-input-sampler/README.md) interface contract + Failure modes、[T4-sim-consume.md](active/wp-3-input-sampler/T4-sim-consume.md)(Objective/In scope/Design notes/Steps/DoD 全改 `<`,並加「回歸須驗邊界未漂移成 `<=`」)。WP-2 `SimLoop.ts` 無需改(已是 `<`)。 |
| **權威來源** | [SimLoop.ts](../../src/loop/SimLoop.ts) `consumeInput`(既有 `<` 為準)、CONTEXT「輸入分桶」半開窗。 |
| **狀態** | ✅ 已解(2026-07-01;commit 待補) |

### GD-1 ✅ F5(移動目標)範圍 — 已統一 seam-in / drills-out(2026-06-29)

| | |
|---|---|
| **決議** | 階段 A **只建 F5 架構接縫**(`SimLoop` target-motion slot、`TargetManager` motion registry、`DrillConfig.targets.motion?` 選填、預設 `static` 恆等),**不交付移動目標 drill / 追蹤指標 / slide-in `t_visible`**。 |
| **對帳結果** | 已回寫:規格 §1.2(範圍修正註)+ 附錄 E(移動 drill 標延後、新增接縫驗收)、[PLAN.md](../PLAN.md) §1/§9、[README.md](README.md)、WP-4/WP-6 README。 |
| **權威來源** | [CONTEXT.md §D](../../CONTEXT.md)「F5 接縫」、規格 §1.2。 |
| **狀態** | ✅ 已解(2026-06-29;commit 待補) |

### GD-2 ✅ 規劃 grill — 一批執行期契約決策(2026-06-29)

| | |
|---|---|
| **決議** | 經 grill-with-docs 釘死一批跨 WP 執行期契約,已回寫權威文件並反映進 WP-2/3/4/5/6/7/8 README:**ADR-7** 兩個時鐘(量測 `performance.now()` / 決定性邏輯 tick index;Chromium 同源假設須重驗)、**ADR-8** peek 推進 P2(命中才推進)、**ADR-9** 正規單位 source unit;**輸入分桶**(timeStamp 落 tick 邏輯窗消費)、**輸入緩衝 = 真 ring** vs **`DataRecorder` = preallocated arena**(非環狀,`maxDrillSeconds` 300s)、**`SharedState` 兩道階段 B 跨界縫**(輸入佇列 + `RenderSnapshot`)、**移動模型 M1**(瞬間 snap、反向鍵穿越 tick 歸零)+ **指標分層**(時序可量 / 精度二元待階段 B)、**H1 單一 hitbox**、**開火 inline 評估**(sub-tick 忠實)。 |
| **權威來源** | [CONTEXT.md](../../CONTEXT.md)、[DESIGN.md](../DESIGN.md) §1、規格 ADR-7/8/9。 |
| **新增 metadata** | `unit`、`vStrafe`、`maxDrillSeconds`、`lateEventCount`、`bufferOverflow`、`recorderOverflow`、`suspect`(規格附錄 C / WP-7 `Meta`);`schema.md`(WP-7.5)產出時一併納入。 |
| **狀態** | ✅ 已解(2026-06-29;commit 待補) |

> **實作進度交叉註記(2026-07-01,WP-3 T4)**:GD-2 的兩個輸入端 metadata 於 WP-3 分兩切片落地——**`lateEventCount` 已於 T4 實作**(`SharedState.inputMeta`,[consume.ts](../../src/input/consume.ts) 依 `lastConsumedT` 低水位偵測遲到、夾進當前 tick 消費不丟棄)。**`bufferOverflow` 延後至 T4b**([wp-3 T4b](active/wp-3-input-sampler/T4b-ring-buffer-overflow.md)):T4 仍在 WP-2 佔位 **plain array** 上消費,無靜態容量故無溢位語意;溢位須待 **OQ-3.2 固定欄位 ring buffer**(靜態容量、滿升 `bufferOverflow`、不靜默丟最舊)就緒才成立。拆分理由見 [wp-3 progress D-T4.1](active/wp-3-input-sampler/progress.md)。GD-3(嚴格 `<` 邊界)已於 T4 落實並經決定性回歸(9 tests)確認未漂移成 `<=`。

> **實作進度交叉註記(2026-07-01,WP-3 T4b — GD-2 / OQ-3.2 完成)**:輸入緩衝已換成 **固定欄位真 ring**([SharedState.ts](../../src/state/SharedState.ts) `createInputRing`:packed 並行 typed-array 槽位 `type,t,a,b`、`head`/`count` 游標、靜態 `RING_CAPACITY=512`(2 的冪、`& MASK` 繞圈,**執行期不動態 resize**))。**`bufferOverflow` 落地**:容量滿時 `push*` 回 `false`、[InputSampler.ts](../../src/input/InputSampler.ts) 升 `inputMeta.bufferOverflow`、**拒收新事件、不覆寫尚未消費的最舊槽**(GD-2「不靜默丟最舊」)。code(`KeyA/KeyD/KeyW/KeyS`)編碼為小整數 enum(`KEY_CODE`/`CODE_KEY`,見 [types.ts](../../src/state/types.ts));`consume` 用寫入端 bounded insertion 保序取代 T4 的 `due.sort` scratch(GC 紀律),交付用單一重用 `InputEventView` 解碼。GD-3 嚴格 `<` + `lateEventCount` 低水位語意不變,決定性回歸(9 tests)+ T4 consume(5 tests)遷移後全綠。至此 GD-2 兩個輸入端 metadata(`lateEventCount` / `bufferOverflow`)皆就緒。

---

## 寫入慣例

- 新增條目編號 `GD-n`(global decision),最新放 §2 最上方。
- 一條目至少含:**發現處**、**問題/決策**、**理由**、**影響面**、**待辦/結論**、**狀態**。
- 解決時:更新狀態為 ✅、補日期與 commit、整條移到 §3。
- 影響到 ADR/D 決策時,回改原權威文件,並在 §1 留變更註記。
