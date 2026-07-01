# WP-4 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T0 完成，準備 T1

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-01）|
| T1 目標 entity | ⬜ 待執行 |
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
