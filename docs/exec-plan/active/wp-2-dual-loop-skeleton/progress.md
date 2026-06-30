# WP-2 — Progress Log ★脊椎（M1）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中 — T0 entry gate ✅（2026-06-30），決定性測試設計已鎖定；下一步 T1 — **M1 門控**

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SharedState | ⬜ 待執行 |
| T2 SimLoop accumulator | ⬜ 待執行 |
| T3 Render 內插 | ⬜ 待執行 |
| T4 決定性驗證（M1 gate） | ⬜ 待執行 |
| T5 Exit gate（宣告 M1） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-2.1 決定性佔位 sim 邏輯 | ✅ 鎖定（T0, 2026-06-30）| 等速位移 `x += vx·dt; z += vz·dt`；合成輸入（帶 `timeStamp`）落入 tick 邏輯窗 `[tickStart,tickEnd)` 時 toggle `vx`。為暴露 frame-dependent bug 的最小邏輯，熱路徑不 new 物件。Blocks T4。 |
| OQ-2.2 render FPS 變化方式 | ✅ 鎖定（T0, 2026-06-30）| 同一組合成輸入 + 同一 `pump(now)`，餵多組 frame delta 序列（穩定 60/144/240 Hz + 抖動 + 一次大 spike ~300ms）；斷言**逐 tick index 狀態**全等、**不**斷言 wall-clock（ADR-7）。Blocks T4。 |
| OQ-2.3 sim 時間源 | ✅ 鎖定（T0, 2026-06-30）| `src/loop/clock.ts` → `interface Clock { now(): number }`；`realClock = performance.now()`，測試注入合成時間；正式/測試共用 `pump(now)`。不違 ADR-4（禁 `Date.now()`）。Blocks T2/T4。 |
| OQ-2.4 階段 B worker seam | ✅ 鎖定（T0, 2026-06-30）| `simStep(state, dtSec)` 為純函式邊界（只讀寫傳入 state、不觸 DOM/global），預留階段 B Worker + `SharedArrayBuffer`；本 WP 不引入 worker。Blocks T2。 |

---

## Log

### 2026-06-30 — T0 / Entry gate ✅ PASS — 上游綠燈確認 + 決定性測試設計鎖定

**A. 上游 exit-gate 綠燈確認（read-only）：**

| 檢查項 | 證據 | 判定 |
|--------|------|------|
| WP-0 exit ✅ | [wp-0 T6](../wp-0-environment-setup/T6-exit-gate.md) Status `✅ DONE (2026-06-30)`；[頂層索引](../../README.md) §2 WP-0 ✅ | ✅ |
| WP-1 exit ✅ | [wp-1 T6](../wp-1-fps-pointerlock/T6-exit-gate.md) Status `✅ DONE (2026-06-30)`；頂層索引 §2 WP-1 ✅ | ✅ |
| `createRenderer` 可用 | [src/render/createRenderer.ts](../../../../src/render/createRenderer.ts) → `createRenderer(canvas): Promise<{ renderer, backend }>`（async + `await renderer.init()`，守 ADR-4） | ✅ |
| `CameraController` 可用（T3 內插接視角） | [src/view/CameraController.ts](../../../../src/view/CameraController.ts) → `new CameraController(camera)`、`applyDelta(dx,dy)`、`setSensitivity`、`setFov`；明示「不入 sim（雙迴圈邊界）」 | ✅ |
| Vitest 就緒（T4） | `package.json` devDeps `vitest@^2.1.0`；指令 `npx vitest run src`（WP-0/WP-1 已用） | ✅ |

**B. WP-1 繼承事項複驗（WP-1 T6 交棒給 WP-2 entry-gate 的義務）：**
- **determinism gate**：WP-1 為 N/A（視角走 render/輸入路徑，無 sim loop），**首次落在本 WP**（T4 為 M1 門控）。✅ 已承接。
- **OQ-T3.a `rawInputEnabled` spot-check**：WP-1 T6 已在非 headless Edge 桌面實測 = **`true`**，無 fallback、無可重現性 debt → WP-2 entry-gate「複驗」義務**已關閉，無 pending**。✅
- 現行 [src/main.ts](../../../../src/main.ts) L89–94 仍為**暫用單一 rAF render 靜態場景**（明寫「WP-2 才換 sim/render 雙迴圈」）——即 T2/T3 要取代的接縫。

**C. 決定性測試設計鎖定（OQ-2.1 / OQ-2.2，餵 T4；DoD 核心交付）：**

- **佔位 sim（OQ-2.1）**：`simStep(state, dtSec)` 推進等速位移 `x += vx·dt; z += vz·dt`。合成輸入事件帶 `timeStamp`，落入該 tick 邏輯窗 `[tickStart, tickEnd)` 時 toggle `vx`（如「按 D → vx=+V」「放開 → vx=0」）。這是能暴露 frame-dependent bug 的**最小**邏輯：若誤把 frame delta 當 sim dt，不同 render FPS 會算出不同位置。熱路徑不 new 物件（重用 state 欄位，鋪 WP-7）。
- **FPS 變化（OQ-2.2）**：固定一組合成輸入序列（含固定 `timeStamp`）+ 單一 `pump(now)` accumulator，餵多組 frame delta 序列：
  - 穩定 60 Hz（≈16.67ms）／144 Hz（≈6.94ms）／240 Hz（≈4.17ms）
  - 抖動序列（144 Hz 基準 ±jitter）
  - 一次大 spike（單幀 ≈300ms）→ 驗 `Math.min(delta, 0.25)` 夾住、tick 數不爆增（spiral of death 防護，README Failure modes）
- **斷言對象（呼應 NFR 兩時鐘 / ADR-7）**：記錄每個 **tick index** 後的 `{x, z, vx, vz}` 與「事件落入的 tick index」，比對所有 FPS 序列**逐 tick 全等**（浮點 exact 或 tight epsilon）。**不**斷言 wall-clock `t_visible`（本質非決定性）。
- **時間源（OQ-2.3）**：`src/loop/clock.ts` 注入式 `Clock.now()`；正式 `realClock = performance.now()`、測試注入合成時間。正式與測試共用同一 `pump(now)`，避免雙路徑分歧（README 風險表）。
- **worker seam（OQ-2.4）**：`simStep` 純函式邊界，不引 worker；預留階段 B 搬遷。

**PASS 條件達成**：camera 可用 + 決定性測試方案明確 → 不 STOP，進入 T1。

**Next**：T1 — `SharedState` 型別 + 單例（FR-2.1，[T1-shared-state.md](T1-shared-state.md)）。

### （規劃）— WP-2 計畫產出
- 依 PLAN WP-2 + 規格 ADR-2/3/4 + §4.3 accumulator 虛擬碼展開為 T0–T5。
- **M1 = 專案脊椎**：T4 決定性驗證為門控閘，未過不展開 WP-3+。
- 關鍵設計：三迴圈只經 `SharedState` 溝通；`simStep` 純函式邊界（預留階段 B worker）；`clock.ts` 注入式時間（可測 + 守 ADR-4）；render 唯讀 + prev/curr 雙快照內插。
- **Next**：WP-0/WP-1 exit 綠燈後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
