# WP-4 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 T3 完成（左右交替確定性輪替）→ 下一個 T4

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-01）|
| T1 目標 entity | ✅ 完成（2026-07-02）— T1a 型別重塑 + T1b mesh/TargetView |
| T2 可見性 + t_visible | ✅ 完成（2026-07-02）— TargetManager.tick 在 sim tick 內蓋 t_visible |
| T3 左右交替 | ✅ 完成（2026-07-02）— markKilled 撤除後翻面 nextSide，確定性 L↔R |
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

### 2026-07-02 — T3 左右交替序列（確定性輪替）✅
- **改動** [src/sim/TargetManager.ts](../../../../src/sim/TargetManager.ts)：`markKilled` 在**確認撤除某目標後**翻面內部 `nextSide`（`'R'↔'L'`），下一個可見 tick 於對側 spawn 並蓋新 `t_visible`。`tick`/spawn/`reset` 邏輯不變（首側仍由 `reset(seq)` 定，預設 `'R'`）。
  - **確定性**：輪替純由內部布林翻面驅動、**無隨機源**（不用 `Math.random`）——給定首側，side 序列可完全重現，與 WP-2 決定性契約相容。
  - **守衛**：只在真的 `splice` 掉目標時才翻面 + 清 `t_visible`；擊殺不存在的 id 不推進序列（避免 WP-5 誤觸/重放時序列漂移）。
  - **單 active 目標**：`tick` 僅在無存活目標時 spawn，故「擊殺 → 下一 tick 生對側」維持 counter-strafe peek 節奏（一次一個）。
- **驗證（三檢全綠）**：`tsc --noEmit` exit 0；`vitest run src` **43/43**（新增 TargetManager T3 5 tests：嚴格交替 R→L / L→R、每次生成新 `t_visible`、決定性重跑一致、無效 id 不翻面；**WP-2 決定性 9 tests + T1/T2 既有全數無回歸**）；`vite build` ✓ 1.41s。
- **手動驗（延後 T5）**：擊殺鍵綁定屬 WP-5（命中訊號），本 WP 無佔位擊殺鍵，端到端「左右輪替出現」併入 T5 exit gate 瀏覽器驗證。

#### Decision Log — 翻面時機採「`markKilled` 確認撤除後」而非「spawn 後」
- **決策**：在 `markKilled` 成功 `splice` 後翻 `nextSide`，而非每次 `spawn` 後翻。
- **理由**：(1) 直接對應規格語意「擊殺一側 → 生成對側」，讀 code 即見因果；(2) 兩者對嚴格交替序列**等價**（R,L,R,L…），但綁在 kill 上可加「僅真撤除才翻」守衛——擊殺不存在 id（WP-5 未來可能重放/誤觸）不會偷偷推進序列，spawn-翻面無此保護點；(3) 保持 `spawn` 純為「用當前 `nextSide` 建目標」的單一職責。
- **Alternatives considered**：(a) spawn 後翻面——否決：無法區分「有效擊殺」與「無效擊殺」，且序列推進與 spawn 耦合、守衛困難。(b) 帶種子 PRNG 產生 side——否決：交替本質是確定週期序列，PRNG 是過度設計（Rule 0 簡單優先），且徒增決定性驗證負擔。


- **新增** [src/sim/TargetManager.ts](../../../../src/sim/TargetManager.ts)（NEW `src/sim/` 目錄）：`createTargetManager()` 工廠回 `tick`/`markKilled`/`reset`。
  - `tick(state, nowMs)`：① 無存活目標 → spawn 一個（T2 單目標，side 固定 'R'；spawn 即可見 OQ-4.2）；② 掃描目標，`visible && !tVisible.has(id)` → `tVisible.set(id, nowMs)`（**只蓋一次**，防重複的 design note）。
  - **時間源硬約束達成**：`nowMs` 由 `simStep` 傳入的 sim 邏輯時鐘 `simTimeMs`（累加 tickMs，量測時鐘域）——非 rAF / `Date.now()`。TargetManager 自身不讀時鐘、純函式（與 simStep Worker 搬遷紀律 OQ-2.4 相容）。
  - `markKilled`/`reset`：T2 最小可用版（撤除目標 + 清 tVisible / 清空 + seq 定首側），供 WP-5 與 T3 呼叫；side **交替**政策留 T3。
- **整合** [src/loop/SimLoop.ts](../../../../src/loop/SimLoop.ts)：`simStep` 與 `createSimLoop` 各加**選填** `targetManager?` 參數；`simStep` 在 `prev←curr` 後、`consumeInput`（WP-5 fire raycast 未來所在）**之前**呼叫 `targetManager?.tick(state, tickEndMs)`（對齊 README「命中判定之前」F5 seam）。[src/main.ts](../../../../src/main.ts) 注入 `createTargetManager()`。
- **驗證（三檢全綠）**：`tsc --noEmit` exit 0；`vitest run src` **38/38**（新增 TargetManager.test 6；**WP-2 決定性 9 tests 無回歸**——關鍵，因本切片改了 SimLoop 簽章）；`vite build` ✓ 1.74s。
- **手動驗（暫緩至 T3/T5）**：畫面現會出現單一右側目標；左右交替與擊殺循環需 T3，端到端瀏覽器驗證併入 T5 exit gate。

#### Decision Log — `targetManager` 以「選填參數」注入 `simStep`/`createSimLoop`
- **決策**：`simStep(state, dtSec, tickEndMs, targetManager?)` 與 `createSimLoop(..., targetManager?)` 皆將 target 系統設為**選填**依賴，而非改寫 `simStep` 為必帶。
- **理由**：(1) 向後相容——WP-2 既有 `simStep`/`createSimLoop` 測試（含 9 個決定性測試）呼叫時不帶 targetManager，簽章擴充後零改動即續綠（實測 38/38）。(2) 保留 `simStep` 的純函式邊界（OQ-2.4）：target tick 亦為 `(state, nowMs)→void` 純推進，不引入時鐘/DOM 讀取。(3) 決定性測試路徑可刻意**不注入** target，隔離 player 位移的決定性斷言、不被 target spawn 干擾。
- **Alternatives considered**：(a) 把 `TargetManager` 設為 `createSimLoop` 必帶依賴——否決：強迫所有 WP-2 決定性測試改建 targetManager，且無法單獨驗證位移決定性。(b) 於 `createRenderLoop` 的 rAF callback 內呼叫 `tick`——**嚴重否決**：直接違反 FR-4.2 與 README failure-mode「t_visible 蓋在 render frame」，時間源變幀率相依、反應時間失真。
- **時間源決策**：`t_visible` 取 `simTimeMs`（sim 邏輯時鐘）而非 `pump(nowMs)` 的 rAF 原始戳——確保「同輸入序列、不同 render FPS」下 t_visible 對應的 tick 一致（決定性契約）。測試以注入 `fixedClock(1000)` 斷言戳值 ~1007.8 且 `< 1e6`，明確排除 `Date.now()` 域。

### 2026-07-02 — T1b `TargetView`（mesh 池 + 依 state 顯示/隱藏）✅ → T1 完成
- **新增** [src/render/TargetView.ts](../../../../src/render/TargetView.ts)：渲染層唯讀元件，`sync(targets)` 依 `visible` 把顯示中目標映射到 mesh 重用池、其餘隱藏。
  - **GC 紀律**：共用一份單位 `BoxGeometry(1,1,1)` + 一份 material，以 `mesh.scale` 套各目標 `hitbox`（width/height/depth）尺寸——不每目標配置新 geometry；多出的池內 mesh `visible=false` 留用而非銷毀。
  - **hitbox=mesh 同來源**：mesh 尺寸直接由 `TargetState.hitbox` 衍生，與 WP-5 raycast（`Box3`）同來源，杜絕視覺/判定漂移（README failure-mode）。
  - **唯讀**：只讀 `SharedState.targets`、絕不寫 state（雙迴圈邊界 / README failure-mode「render 改目標狀態」）。
- **整合** [src/main.ts](../../../../src/main.ts)：render frame callback 內 `targetView.sync(sharedState.targets)`（繪製前、唯讀）。本 WP 目標序列由 T2/T3 的 `TargetManager` 寫入，故現在畫面尚無目標（sharedState.targets 為空）——這是預期。
- **驗證（自動化取代手動鉤子）**：[src/render/TargetView.test.ts](../../../../src/render/TargetView.test.ts) 5 tests——以真 `THREE.Scene`（node 下可建，無需 renderer）斷言：visible→出現且位置/尺寸取自 state、visible=false→隱藏、目標數變動時池不新建（重用）、隱藏目標不佔 slot、dispose 清場。三檢全綠：`tsc --noEmit` exit 0；`vitest run src` **32/32**（新增 5，WP-2 決定性無回歸）；`vite build` ✓ 1.28s。
- **Surprise（正向）**：`import * as THREE from 'three/webgpu'` 在 vitest 預設 node 環境可乾淨載入並建構 `Scene/Mesh/BoxGeometry`（皆純 JS 物件，GPU 資源惰性）——故 render 元件的 state→mesh 映射邏輯可**單元測試**，不必只靠瀏覽器手動驗（優於 SceneManager 當初的純手動驗）。
- **Scope 紀律**：`sync` 只 gate 於 `visible`（T1 DoD）；`alive` 撤除語意留 T3/WP-5。未碰 `TargetManager`（T2/T3）。
- **Next**：**T2 可見性 + t_visible**（[T2-visibility-tvisible.md](T2-visibility-tvisible.md)）——在 sim tick 內蓋 `t_visible`。

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
