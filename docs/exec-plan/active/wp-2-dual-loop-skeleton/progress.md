# WP-2 — Progress Log ★脊椎（M1）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中 — T3 Render 內插 ✅（2026-06-30），雙迴圈於 main.ts 接通可空跑；下一步 T4 ★M1 gate

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SharedState | ✅ 通過（2026-06-30）|
| T2 SimLoop accumulator | ✅ 通過（2026-06-30）|
| T3 Render 內插 | ✅ 通過（2026-06-30）|
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

### 2026-06-30 — T3 / Render alpha 內插 ✅ PASS — 雙迴圈於 main.ts 接通（FR-2.3）

**交付：** `NEW src/loop/RenderLoop.ts`、`src/loop/RenderLoop.test.ts`；`MODIFY src/main.ts`（換掉暫用 rAF）。

| 項目 | 內容 |
|------|------|
| `RenderLoop.ts` | `createRenderLoop(onFrame: (nowMs)=>void) → { start, stop }` 純 rAF 排程器（重複 start 不疊、stop 後 guard 擋殘留 callback）；`lerp(a,b,alpha)`。 |
| `main.ts` | 接通雙迴圈：`simLoop = createSimLoop(sharedState, realClock, SIM_HZ)`；每幀 `pump(now)` → 唯讀內插 `prev→curr` player 位置 → 套 camera 位置（朝向仍由 `CameraController`）→ render。換掉 T0 記錄的暫用 rAF（原 main.ts L89–94）。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **18 passed**（4 新 RenderLoop + 14 既有，無回歸）；`npx vite build` → **✓ built**（three chunk-size warning 為資訊性）。 |

**測試覆蓋（4）：** lerp 端點/中點 · start 後每幀帶 rAF 時間戳呼叫 onFrame · stop 後殘留 callback 不再呼叫 · 重複 start 不疊迴圈。

**Decision Log（本切片非平凡選擇）：**
- **`createRenderLoop(onFrame: (nowMs)=>void)` 純 rAF 排程器**（偏離 README §2 原 sketch `createRenderLoop(state, onFrame:(alpha)=>void)`）。*理由*：render loop 單一職責 = 排程幀；pump/內插/繪製編排放 main.ts（T3 in-scope 明文「main.ts：每幀 `simLoop.pump(now)`」），使 RenderLoop **完全不知 sim**（雙迴圈解耦最徹底）。*Alternatives*：讓 RenderLoop 吃 `pump` 並回傳 alpha → 多一層 sim 耦合，無實益，否決。**已同步更新 README §2 該行 + 註記。**
- **render 唯讀 sim 狀態**：onFrame 只**讀** `sharedState.prev/curr`，**寫** `camera.position` + render，**不寫回** `sharedState`。`pump()` 是唯一推進 sim 之處（即 sim 自身的職責，非 render 越界）。對齊 README 風險表「frame-dependent 偷渡」防線。
- **視角不內插、只內插 player 位置**：yaw/pitch 由 `CameraController` 走輸入路徑即時套用（人眼對視角延遲敏感、且視角非 sim 狀態）；只有 player 位移用 alpha 內插（FR-2.3 / T3 design note）。
- **camera 位置 = base + player 位移（佔位 1:1，sim u → world unit）**：base 取 `SceneManager` 起始 camera 位置；真 display scale 由 WP-6 drill config 定（CONTEXT 正規單位）。閒置時 player 在原點 ⇒ camera = base、僅朝向動 ⇒ **雙迴圈可空跑**成立。

**Surprises：** 首次 `Edit` main.ts 失敗——old_string 用半形逗號但原檔為全形 `，`；改抄原檔全形標點後成功。無功能影響。

**Spot-check（誠實記錄，承 WP-1 模式延到 exit）：** 「高 render FPS 下移動佔位 player 物件畫面平滑不抖」需**真鍵盤輸入驅動 player 位移**，而真鍵盤採集是 WP-3（本 WP out-of-scope）。故閒置雙迴圈（boot 無 error、render 唯讀內插路徑、camera 朝向跟手）為本 task 可驗範圍；**移動平滑度的非 headless 真人 spot-check 列入 T5 exit-gate / 待 WP-3 鍵盤接上後補驗**（不靜默放行）。內插**數學**已由 lerp 單元測試把關，**機制**正確性由 T4 決定性驗證間接覆蓋。

**Next**：T4 — 決定性驗證 ★M1 gate（同輸入序列、不同 FPS → 逐 tick 一致，FR-2.4，[T4-determinism.md](T4-determinism.md)）。**未過 STOP，不展開 WP-3+。**

### 2026-06-30 — T2 / SimLoop accumulator ✅ PASS — 固定 128 Hz + simStep 純函式（FR-2.2）

**交付：** `NEW src/loop/constants.ts`、`src/loop/clock.ts`、`src/loop/SimLoop.ts`、`src/loop/SimLoop.test.ts`。

| 項目 | 內容 |
|------|------|
| `constants.ts` | `SIM_HZ = 128`（ADR-3 常數，可改 256/384）。 |
| `clock.ts` | `interface Clock { now(): number }` + `realClock = performance.now()`（OQ-2.3）。 |
| `SimLoop.ts` | `createSimLoop(state, clock, simHz) → { pump(nowMs): {ticks, alpha} }` accumulator（夾 0.25s）；`simStep(state, dtSec, tickEndMs)` 純函式（prev←curr → 消費輸入 → 等速推進 → curr←新位置）；`consumeInput` 依 timeStamp 落 tick 窗 toggle vx（佔位）。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **14 passed**（6 新 SimLoop + 8 既有，無回歸）。 |

**測試覆蓋（6）：** 固定步進 64 幀×2 = 128 ticks/s · 500ms spike 夾成 32 ticks（不 spiral）· alpha=0.5 餘量 · simStep 等速推進 + prev/curr · 輸入 timeStamp 落 tick 窗消費 · 未到期事件不提前消費。

**Decision Log（本切片非平凡選擇）：**
- **`simStep` 簽章加 `tickEndMs`**（偏離 README §2 原 sketch 的 `simStep(state, dtSec)`）。*理由*：T0 鎖定的決定性機制要求「事件以 timeStamp 落入 tick 邏輯窗 `[tickStart,tickEnd)` 消費」（CONTEXT input bucketing），而 `(state, dtSec)` 看不到 tick 時間。把邏輯時間在 loop 追蹤、以**顯式參數**傳入 → 既做到分桶又維持純函式（所有輸入顯式，比 closure 讀 mutable 時間更純，利階段 B worker 搬遷）。*Alternatives*：(a) closure 綁 mutable simTime → 較不純、export 的獨立 simStep 失去自足性，否決；(b) drain-all-per-tick 不看 timeStamp → 對 pre-filled buffer 雖仍「決定性」但**退化**、量不出「事件落第幾 tick」，無法支撐 T4 斷言，否決。**已同步更新 README §2 interface contract 該行 + 註記，避免 T3/T4 被舊簽章誤導。**
- **邏輯 sim 時鐘 `simTimeMs` 從 `clock.now()` 基準起、每 tick +`tickMs`**。事件 `.t`（量測時鐘域）與其同域 → tick k 窗恆為 `[base+(k-1)tickMs, base+k·tickMs)`，與 render FPS 無關 ⇒ 同一事件在任何 FPS 落同一 tick index（T4 決定性根）。
- **`consumeInput` 佔位用陣列前端 `splice`**。*理由*：plain-array 佔位緩衝（WP-3 換 ring buffer 槽位重用）；假設 `state.input` 已依 timeStamp 排序（T4 合成事件保證、WP-3 真排序 + 遲到/溢位）。
- **`pump` 只上夾 `Math.min(delta, 0.25)`、不下夾**：依 §4.3 sketch；假設 clock 單調（performance.now 單調）。
- **佔位橫移速度 `PLACEHOLDER_STRAFE_SPEED = 250 u/s`**（local const，非進 constants.ts）：throwaway 佔位，WP-5 `MovementController` 換真 friction/accel；不污染正式常數檔。

**Scope 邊界（未碰）：** 真 movement/急停 → WP-5；render alpha 內插接視角 → T3；決定性「同輸入不同 FPS 逐 tick 全等」完整斷言 → T4（本 task 已備妥可被注入 clock 驅動的 `pump` + timeStamp 分桶機制）。

**Next**：T3 — RenderLoop（rAF + alpha 內插接 WP-1 視角，FR-2.3，[T3-render-interpolation.md](T3-render-interpolation.md)）。

### 2026-06-30 — T1 / SharedState ✅ PASS — 三迴圈溝通管道型別 + 單例（FR-2.1）

**交付：** `NEW src/state/types.ts`、`src/state/SharedState.ts`、`src/state/SharedState.test.ts`。

| 項目 | 內容 |
|------|------|
| `types.ts` | `InputEvent` discriminated union（`key{code,down,t}` / `mouse{dx,dy,t}` / `fire{t}`）、`PlayerSnapshot{x,z}`、`TargetState{id,x,y,z,active}`。 |
| `SharedState.ts` | `interface SharedState`（input / player{vx,vz,x,z} / prev,curr / crosshair{cx,cy} / targets / tVisible）+ `createSharedState()` 工廠 + `sharedState` 單例 + `resetState(state=單例)` 原地重置。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **8 passed**（4 新 + 4 既有 createRenderer，無回歸）。 |

**Decision Log（本切片非平凡選擇）：**
- **工廠 + 單例並存**：app 用 `sharedState` 單例；另出 `createSharedState()` 取獨立實例。*理由*：T0 鎖定的決定性測試（T4）需在不同 FPS 下跑**獨立** state 比對，README 的 `createSimLoop(state, …)` 也是 DI 風格——非過度抽象，而是 T4 已明確需要的第二 use case。
- **`resetState` 原地清空、重用既有物件/陣列**（`input.length=0`、`tVisible.clear()`、欄位逐一歸零，不 reassign 新物件）。*理由*：守 CLAUDE.md §4 GC 紀律（避免 realloc 抖動）；測試斷言 `prev/player/input/targets/tVisible` 參考不變以鎖住此性質。*Alternatives*：每次 `resetState` 回傳新物件 → 會在重開 drill 時配置垃圾，與「無 GC 卡頓」NFR 相悖，否決。
- **`resetState` 預設參數 = 單例**：滿足 spec 的 `resetState()` 寫法，同時允許測試傳入自有實例。
- **單位/時鐘對齊 CONTEXT**：position/velocity 註記為 **u / u·s⁻¹**（canonical unit，非公尺）；`InputEvent.t` 註記為 `event.timeStamp`（量測時鐘域，ADR-7 two-clock）。

**Scope 邊界（未碰，留後續 WP）：** `input` 仍為 plain array 佔位（WP-3 換真 ring buffer）；`targets`/`tVisible` 先空（WP-4 寫入）；`crosshair{cx,cy}` 語意待 WP-3/WP-5 定。

**Next**：T2 — `clock.ts` + 128 Hz accumulator + `simStep` 純函式邊界（FR-2.2，[T2-sim-loop.md](T2-sim-loop.md)）。

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
