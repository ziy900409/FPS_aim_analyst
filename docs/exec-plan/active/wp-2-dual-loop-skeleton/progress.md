# WP-2 — Progress Log ★脊椎（M1）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: ✅ WP-2 完成 — **M1（專案脊椎）正式達成（2026-07-01）**；解除 STOP，WP-3 / WP-4 可並行展開

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 通過（2026-06-30）|
| T1 SharedState | ✅ 通過（2026-06-30）|
| T2 SimLoop accumulator | ✅ 通過（2026-06-30）|
| T3 Render 內插 | ✅ 通過（2026-06-30）|
| T4 決定性驗證（M1 gate） | ✅ 通過（2026-07-01）★ |
| T5 Exit gate（宣告 M1） | ✅ 通過（2026-07-01）— **M1 達成** |

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

### 2026-07-01 — T5 / Exit gate ✅ PASS — **M1（專案脊椎）正式達成**

**交付：** docs only — 翻 [頂層索引](../../README.md) §2 WP-2 → ✅、§3 里程碑 M1 → ✅ 達成；本 WP task-checklist + progress 收尾。無程式碼改動。

**整體綠燈證據（本 session 本機）：**

| 閘 | 指令 | 結果 |
|----|------|------|
| 型別 | `npx tsc --noEmit` | **exit 0** |
| 單元/整合 | `npx vitest run src` | **27 passed**（SharedState 4 · SimLoop 6 · RenderLoop 4 · determinism 9 · createRenderer 4）|
| e2e（real Edge） | `npx playwright test` | **3 passed**（dev+preview `crossOriginIsolated===true`；`renderer.backend` 端到端解析）|
| 產物 | `npx vite build` | **✓ built**（three chunk-size warning 資訊性；T4 已驗）|

**四項 WP-2/M1 驗收 → 證據：**
1. `SharedState` 三迴圈唯一溝通管道 → **T1**（型別 + 單例 + 4 tests）。
2. 雙迴圈空跑、sim 固定 128 Hz、render 解耦 → **T2+T3**（SimLoop 固定步進/spike 夾除 6 tests、RenderLoop 4 tests；e2e 真 Edge 空跑無 fatal error）。
3. render 內插高 FPS 不抖 → **T3**（lerp 內插數學單元測試；機制由 T4 間接覆蓋）。
4. **決定性驗證通過（M1 gate）** → **T4**（9 tests，逐 tick exact 一致）。

**Outcomes & Retrospective：**
- **達成什麼**：專案脊椎（ADR-2 雙迴圈 + fixed-timestep 128 Hz + `SharedState` 單一溝通管道 + 注入式 clock）就緒且**決定性可證**。後續所有量測（急停時機、首發命中）站在「與幀率無關、可重現」的地基上。
- **決定性測試涵蓋**：同一合成輸入序列（`KeyD↓@10/↑@100 · KeyA↓@150/↑@300` ms）餵穩定 **60 / 144 / 240 Hz + 抖動 144 Hz ±50%**（決定性 LCG，非 `Math.random`）；每幀以累積 tick 數對齊 per-tick ground truth，逐 tick `{x,z,vx,vz}` **bit-exact 相等**。根因：`simStep` 對第 k 個 global tick 恆以 `tickEnd=base+k·tickMs` 呼叫，與分幀方式無關。
- **spike 行為定義**（非「等價於連續」）：`Math.min(δ,0.25)` 依設計**丟棄** >0.25s 的時間 → 單一 300ms 幀夾成 **32 ticks**（不 spiral）；含多次 spike 序列**重播 bit-exact**（證明夾除為決定性、無 `Date.now()`/`Math.random()` 洩漏）。真 sim/jank 隔離（不掉 tick）待階段 B Worker（DESIGN §1）。
- **技術債（明確標記，非本 WP 修）**：
  - sim step 為佔位等速邏輯 → WP-5 換真 `MovementController`（friction/accel + 急停），介面 `simStep` 不變。
  - `SharedState.input` 仍為 plain-array 佔位 → WP-3 換真 ring buffer（槽位重用）。
  - **高 FPS 內插平滑的真人肉眼 spot-check 延至 WP-3**（需真鍵盤驅動 player 位移；本 WP e2e 僅能驗閒置空跑 + 無 fatal error）。

**Open Questions（交棒前請確認）：**
- **OQ-T5.1（測試 infra，非本 WP scope）✅ 已解決（2026-07-01，獨立 chore 切片）**：無 `vitest.config.ts` → 裸 `npx vitest run` 會誤收 Playwright 的 `tests/e2e/*.spec.ts`（Playwright `test()` 不相容 Vitest → 2 suites fail）。**解法**：於 [vite.config.ts](../../../../vite.config.ts) 加 `test.include=['src/**/*.test.ts']`（+ `/// <reference types="vitest/config" />`），並於 [package.json](../../../../package.json) 補 `test`=`vitest run`、`test:e2e`=`playwright test`。驗證：裸 `npm test` → 27 passed（只掃 5 個 src 單元 suite）、`npm run test:e2e` → 3 passed。副檔名分工固化：單元 `.test.ts`（Vitest）／e2e `.spec.ts`（Playwright）。**裸 `vitest run` 綠燈自此為 WP-3 之後穩定基準。**

**交棒 note → WP-3 / WP-4（M1 後可並行）：**
- **WP-3** `InputSampler`（F1）：接真鍵鼠高解析度時間戳採集，寫入 `SharedState.input`（換掉佔位 plain-array 為 ring buffer）；順帶補做本 WP 延後的「高 FPS 內插平滑」真人 spot-check。
- **WP-4** `TargetManager` + `t_visible`（F2）：寫入 `SharedState.targets` / `tVisible`（本 WP 已留空欄位）。
- 兩者皆以 `SharedState` 為唯一溝通管道（ADR-2）、時間戳走量測時鐘域（ADR-7 / `performance.now()`）。

**Next**：WP-2 收官。開 **WP-3** entry-gate（先驗 WP-2 exit 綠燈——本檔即證據）。

### 2026-07-01 — T4 / 決定性驗證 ✅ PASS — ★M1 gate 綠燈（同輸入不同 FPS 逐 tick 一致，FR-2.4）

**交付：** `NEW src/loop/__tests__/determinism.test.ts`（9 tests）。無生產碼改動（純測試切片；T2 已備妥可被注入 clock 驅動的 `pump` + timeStamp 分桶）。

| 項目 | 內容 |
|------|------|
| 決定性方法 | **per-tick ground truth**：每幀恰一 tick（`pump(k·tickMs)`）建立 canonical 軌跡；再以多組 frame delta 序列驅動同一 `pump`，每幀以「累積 tick 數」為索引對齊 canonical → 達成真正**逐 tick index** 比較。 |
| 合成輸入（OQ-2.1）| `KeyD↓@10 / KeyD↑@100 / KeyA↓@150 / KeyA↑@300`（ms，量測時鐘域），toggle vx ±250 u/s；同一份餵所有序列。 |
| FPS 序列（OQ-2.2）| 穩定 60/144/240 Hz + 抖動 144 Hz ±50%（決定性 LCG，不用 `Math.random`）；全部收尾對齊 `END_MS = 64.5·tickMs`（tick 窗中段，避尾端浮點 off-by-one）。 |
| 斷言（ADR-7）| 逐 tick index 的 `{x,z,vx,vz}` **exact 相等**（本佔位數值 float 精確）；四序列最終狀態彼此 bit-exact = ground truth 第 64 tick。**不**斷言 wall-clock。 |
| 邊界 | ① 大 unclamped gap（200ms 單幀 vs 40×5ms）→ bit-exact 相同（大 gap 不夾、不發散）；② 單一 300ms spike 夾成 **32 ticks**（`Math.min(δ,0.25)·128`，不 spiral）；③ 含多次 spike 序列重播 bit-exact（夾除為決定性、無 `Date.now()`/`Math.random()` 洩漏）。 |
| 驗證 | `npx tsc --noEmit` → **exit 0**；`npx vitest run src` → **27 passed**（9 新 determinism + 18 既有，無回歸）；`npx vite build` → **✓ built**（three chunk-size warning 資訊性）。 |

**為何 exact 而非 epsilon（決定性根源）：** `simStep` 對第 k 個 global tick 恆以 `tickEnd = base + k·tickMs` 呼叫（`simTimeMs` 每 tick +tickMs；`tickMs=7.8125=125/16` float 精確、重複加總不失精度），與「分幾次餵」無關 ⇒ 事件消費點、推進步數完全一致 ⇒ 各 FPS 序列跑相同的 simStep 呼叫序列，狀態 **bit-identical**。frame delta 的浮點抖動只可能影響**尾端 tick 數**，已由「END_MS 落窗中段」化解（穩定 64 ticks）。

**Decision Log（本切片非平凡選擇）：**
- **per-tick ground truth 取代 sketch 的逐幀 `traj.push`。** *理由*：sketch 每幀 push 一筆 → 不同 FPS 幀數不同、軌跡長度不一，無法「逐 tick index」比對（與 T4 objective 明文衝突）。改以「每幀恰一 tick」建立 canonical per-tick 軌跡，其他序列每幀以累積 tick 數索引回對 → 每個 FPS 序列的**每個幀邊界**都被拿去對照 ground-truth 對應 tick，覆蓋更嚴。*Alternatives*：(a) 改 SimLoop 加 per-tick hook 錄軌跡 → 動生產碼、out-of-scope，否決；(b) 只比最終狀態 → 漏掉中途 tick 分歧，較弱，否決（本測試同時保留最終狀態 bit-exact 斷言作雙保險）。
- **不需 `applyInputsUpTo`（偏離 sketch）。** `consumeInput` 已依 `timeStamp < tickEndMs` 分桶，預載**全部**合成事件即決定性（事件落哪個 tick 由 timeStamp 決定，與餵入時機無關）。sketch 的漸進 push 是多餘的。
- **spike 夾除路徑「明確定義」而非「等價於連續」。** clamp 依設計**丟棄** >0.25s 的時間（§4.3 spiral 防護），故**不**宣稱夾除序列 = 未夾序列；改為斷言「夾成固定 32 ticks」+「重播 bit-exact」，即 T4 DoD 的「行為被明確定義並測試」。真隔離（sim 不掉 tick）待階段 B worker（DESIGN §1）。

**Surprises：** 無。數值如預期 float 精確（`250/128 = 1.953125`），exact 相等一次通過、無需退回 epsilon。

**Scope 邊界（未碰）：** 真 movement/急停 → WP-5；真鍵鼠採集 → WP-3（本測試用合成事件）。移動平滑度的非 headless 真人 spot-check 仍列 T5 / 待 WP-3（承 T3 記錄）。

**M1 狀態：** 門控閘綠燈 → **M1 可達已成立**；**正式宣告待 T5 exit-gate**（雙迴圈空跑 + 決定性綠燈 + 交棒 WP-3/WP-4）。T4 通過前的 STOP 約束（不展開 WP-3+）**於 T5 宣告後解除**。

**Next**：T5 — Exit gate，正式宣告 M1（[T5-exit-gate.md](T5-exit-gate.md)）。

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
