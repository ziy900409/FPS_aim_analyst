# WP-4 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T1 進行中（型別重塑前置切片完成）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-01）|
| T1 目標 entity | 🟡 進行中 — T1a 型別重塑 ✅；T1b mesh/TargetView 待執行 |
| T2 可見性 + t_visible | ⬜ 待執行 |
| T3 左右交替 | ⬜ 待執行 |
| T4 Crosshair | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-4.1 目標幾何 / hitbox | ✅ 鎖定（H1，grill） | 單一 hitbox（命中/未命中）；`part` 選填保留、頭/身延後。對齊 CONTEXT.md `HitDetector`。 |
| OQ-4.2 「可見」定義 | ✅ 鎖定 | spawn 瞬間即可見，`t_visible`=spawn tick 時間。對齊 CONTEXT.md `t_visible` 條目（狀態翻轉那個 sim tick 執行當下蓋）。 |
| OQ-4.3 交替序列驅動 | ✅ 鎖定 | 內建確定性輪替，WP-6 drill loader 接管前暫定；純函式無隨機源，不影響 WP-2 決定性契約。 |
| OQ-4.4 目標消失條件 | ✅ 鎖定 | 被標記擊殺 → 消失 → 生成對側；命中訊號延後 WP-5，本 WP 用測試/佔位觸發 `markKilled`。 |

---

## Log

### （規劃）— WP-4 計畫產出
- 依 PLAN WP-4（4.1–4.4）+ 規格 §5（`t_visible` 為反應時間起點）展開為 T0–T5。
- 關鍵：`t_visible` **必須在 sim tick 內蓋**（非 render frame），且只在可見轉換蓋一次——這是反應時間效度的把關點。
- **Next**：確認 M1 + WP-1 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。

### 2026-07-01 — T0 Entry gate ✅ DONE
- **驗證 WP-1/WP-2 exit 綠燈**：頂層索引（[../../README.md](../../README.md)）§2 WP-1 ✅（2026-06-30）、WP-2 ✅（2026-07-01）；§3 里程碑 **M1 ✅（2026-07-01）**。兩者 `T-exit-gate.md` Status 欄皆 ✅ DONE，且逐項驗收有證據（WP-1：三檢 + 真人 spot-check；WP-2：27/27 vitest + 9 個決定性測試 + e2e 3/3）。
- **驗證 SimLoop 掛點**：讀 [src/loop/SimLoop.ts](../../../../src/loop/SimLoop.ts)——`simStep(state, dtSec, tickEndMs)` 由 `pump()` 以邏輯 sim 時鐘 `simTimeMs`（累加 `tickMs`，量測時鐘域）呼叫；T2 只需在 `simStep` 內插入 `TargetManager.tick(state, tickEndMs)` 一行，時間源天然是 sim tick 內、非 render frame。讀 [src/loop/clock.ts](../../../../src/loop/clock.ts) 確認 `realClock.now() = performance.now()`，符合 CLAUDE.md §4 禁 `Date.now()` 硬約束。
- **驗證 SharedState 預留欄位**：[src/state/SharedState.ts](../../../../src/state/SharedState.ts) 已有 `targets: TargetState[]`、`tVisible: Map<string, number>`（WP-2 T1 佔位，先空），`resetState` 已含 `targets.length = 0` / `tVisible.clear()`。
- **鎖定 OQ-4.1~4.4**：逐項對照 [CONTEXT.md](../../../../CONTEXT.md) 的 `HitDetector`／`t_visible` 正規定義，與 README 既有建議解法一致，無矛盾，全數翻 ✅（見上表）。
- **Surprise**：`src/state/types.ts` 現有 `TargetState`（WP-2 佔位：`{ id, x, y, z, active }`）與本 WP README §2 的新 interface contract（`{ id, side, pos, visible, alive, hitbox, motion?, age? }`）欄位形狀不同。這是**預期落差**（README 已列 `SharedState.ts` 為 T1 的 MODIFY 路徑），但實際上 `TargetState` 定義位在 `types.ts` 而非 `SharedState.ts`——**T1 需同步修改 `src/state/types.ts`**，記入 T1 執行時的 scope 提醒，避免漏改型別檔。
- **PASS**：M1 達成 + WP-1 場景 + sim tick 可蓋戳條件成立，无 STOP 條件觸發。Next：**T1 目標 entity**（[T1-target-entity.md](T1-target-entity.md)）。

### 2026-07-01 — T1a `TargetState` 型別重塑（前置切片）✅
> T1 拆兩切片：**T1a**（本切片）先把型別重塑到最終契約、再 **T1b** 建 mesh/`TargetView`。動機見下 Decision Log。

- **改動**：MODIFY [src/state/types.ts](../../../../src/state/types.ts)——把 WP-2 佔位 `TargetState`（扁平 `{ id, x, y, z, active }`）重塑為 WP-4 README §2 契約 `{ id, side, pos, visible, alive, hitbox, motion?, age? }`；新增 `Vec3`（3D 座標，目標有高度 y，與 2D `PlayerSnapshot` 不共用）與 `TargetMotion`（F5 接縫，對齊規格附錄 G）。
- **同步修測試**：[src/state/SharedState.test.ts:44](../../../../src/state/SharedState.test.ts) 的建構字面量改用新欄位（斷言本身不變——仍是「弄髒 targets → reset 清空」）。這是 T0 Surprise 追蹤到的唯一 runtime 消費點。
- **驗證（三檢全綠）**：`npx tsc --noEmit` exit 0；`npx vitest run src` **27/27 passed**（WP-2 決定性 9 tests 無回歸）；`npx vite build` ✓ built in 1.46s。
- **blast radius 複核**：改 symbol 前以 Grep 追 `TargetState` 全域引用（GitNexus MCP 未載入，Grep 等價 upstream 追蹤）→ 僅 `SharedState.ts`（型別匯入＋陣列宣告，欄位無關）與 `SharedState.test.ts`（唯一字面量）；零 runtime 消費者，風險低，實測與預期一致。

#### Decision Log — T1 拆成 T1a（型別）+ T1b（mesh）兩切片
- **決策**：在寫 mesh/`TargetView` 之前，先獨立完成 `TargetState` 型別重塑並 commit。
- **理由**：型別若不先到位，`hitbox`（WP-5 `raycastFromCenter(camera, targets: TargetState[])` 直接依賴，見 [wp-5 README:101](../wp-5-hit-counterstrafe/README.md)）與 `motion?`/`age?`（WP-6 `DrillConfig.targets.motion` F5 接縫，[wp-6 README:92](../wp-6-drill-system/README.md)）會在下游各觸發一次破壞性型別變更；且屆時消費者已增（`TargetManager`/`TargetView`/WP-5 raycast 測試），blast radius 遠大於現在（僅 1 個測試字面量）。**現在改成本最低**。
- **Alternatives considered**：(a) 在 T1 mesh 切片裡一併改型別——否決：把型別重塑與 mesh 邏輯混在同一 commit，違反「一 task=一垂直切片」，且型別錯誤會與 mesh bug 糾纏難分。(b) 維持扁平佔位型別、到 WP-5 再改——否決：等於把破壞性變更推給下游、消費者更多時才付更高成本（見理由）。
- **具體形狀決策**：`hitbox` 採 **box**（`width/height/depth` + `part?`），非膠囊——box 對 T1 mesh（`BoxGeometry`）與 WP-5 raycast（`Box3`）都是最單純的同來源原語，且 `part?` 保留使頭/身分解向後相容。膠囊如日後需要可再加變體，不破壞現有欄位。
- **Scope 紀律**：`resetState`（[SharedState.ts:61](../../../../src/state/SharedState.ts)）用 `targets.length = 0`，欄位無關、不需改；未觸碰 T1b 的 mesh/`TargetView`（本切片 out of scope）。
