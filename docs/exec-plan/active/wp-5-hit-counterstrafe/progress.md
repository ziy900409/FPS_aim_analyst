# WP-5 — Progress Log ★M2

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: ✅ 完成（2026-07-02）— **M2 核心玩法成立達成**

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02）— WP-3/4 exit 綠燈確認、OQ-5.1~5.4 鎖定 |
| T1 HitDetector | ✅ 完成（2026-07-02）— camera 中心射線命中 + 第一次命中即擊殺（FR-5.1，OQ-5.4）|
| T2 首發判定 | ✅ 完成（2026-07-02）— 每 peek 首發旗標，掃射不稀釋（FR-5.2，OQ-5.3）|
| T3 橫移 movement | ✅ 完成（2026-07-02）— MovementController A/D 橫移，held-based per-tick snap（FR-5.3，OQ-5.2）|
| T4 簡化急停 | ✅ 完成（2026-07-02）— 反向鍵穿越 tick 立即停止（stopped flag + vx=0）+ 開火精準 gate（accurate/residualSpeed）（FR-5.4，OQ-5.1）|
| T5 Exit gate（M2） | ✅ 完成（2026-07-02）— 99/99 綠、tsc 0、手動驗 PASS；宣告 **M2**、交棒 WP-6/7 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-5.1 停止 gate 精準判定 | ✅ grill | 布林：stopped→accurate；residualSpeed 二元 {0,±v}→結果頁分類；連續模型留階段 B |
| OQ-5.2 橫移速度 / 加速 | ✅ grill | 瞬間 snap 到 `v_strafe`(~250 u/s)、反向鍵穿越 tick 歸零（M1）；附錄 D 留階段 B |
| OQ-5.3 peek 邊界 | ✅ grill (P2) | t_visible 起點、**第一次命中=kill** 終點（未命中可補槍）；`peekTimeoutMs` 防卡；新目標可見 reset 首發 |
| OQ-5.4 命中即擊殺 | ✅ grill (P2) | **第一次命中**即 markKilled → 生成對側（spawnDelay 0）|

---

## Log

### 2026-07-02 — T5 Exit gate ✅ **★ M2 核心玩法成立達成**
- **自動化門控全綠**：`npx vitest run` **99/99**（13 檔）——命中 8 / 首發 8 / 橫移 12 / 急停含整合 / **determinism 9/9** 回歸；`npx tsc --noEmit` **exit 0**。
- **五軸 code review（T1–T4）→ Approve**：Correctness（NDC(0,0) 最近命中 + peekId 隱式 reset + prevVx/held 急停判定 + consume→movement 順序）、Readability（zh-TW 密註、決策皆溯 OQ/ADR）、Architecture（雙迴圈邊界：sim 唯讀 camera；`MovementController.step` 唯一公開點，階段 B friction 同介面）、Security（本機瀏覽器，無外部不可信輸入面）、Performance（GC 紀律：Raycaster/Box3/Vector 模組層重用、handle/movement 綁定一次、熱路徑零配置）。**FYI**：`void firstShot/accurate/residualSpeed` 為 WP-7 emit 接縫標記，現行丟棄、有意且一致註明。
- **4 項驗收 → 證據**：命中/部位（T1 8 例 + 端到端手動）· 首發不稀釋（T2 8 例）· A/D 橫移固定步長（T3 bit-exact）· 急停 gate 開火（T4 急停組 + SimLoop 整合）。全數勾選於 [T5-exit-gate.md](T5-exit-gate.md)。
- **手動驗 PASS（使用者確認 2026-07-02，Edge/WebGPU）**：橫移 → 反向鍵急停 → 停止開火命中 → 對側生成 → 重複，端到端可跑。
- **Surprise（手動驗證發現 1）— 橫移速度佔位 1:1 過快**：sim `vStrafe=250 u/s`（canonical CS 值，**不得改**，研究效度硬約束）以 main.ts 佔位 **1:1** 疊到 world，但佔位房間僅 ~10 world unit → 250 world-u/s 每 tick 移 ~1.95u、~40ms 撞牆＝無法目視橫移/急停（讀成「加速度過快」）。*修正*：main.ts 加 **render-only `SIM_TO_WORLD=0.01`** display scale（1 world unit = 100 u），250 u/s 呈現 ~2.5 world-u/s。**只影響 render、不流入 sim/匯出資料**（雙迴圈 + 單位硬約束）；真 display scale 由 WP-6 drill config 接管（同 T1 距離 8→4 佔位修正之性質）。
- **Surprise（手動驗證發現 2）— 1-tick 急停肉眼不可視 + 過衝疑似「無急停」**：`stopped=true` 只存活 1 tick（128Hz=7.8ms），render frame ~16ms 幾乎必錯過；且**續按反向鍵次 tick 過衝 ∓v**（[README §2 data-flow line 80](README.md) 明定的階段 A 行為）使使用者見「短暫反方向位移」誤判無急停。*澄清*：急停 gate 實際有觸發（單元測試 + trace 佐證），過衝為 spec 設計；sustained 摩擦減速是階段 B（README §3 technical debt「立即停止取代真摩擦」）。*處置（使用者選「接受規格 + 加 dev debug」）*：main.ts 加 **dev-only HUD**（`import.meta.env.DEV`，production 剝除）顯示 `vx`/`急停 STOP` 閂鎖（偵測 stopped 或 vx 反向 → 綠燈保持 600ms，閂鎖時鐘用 rAF `now` 非 Date.now），使 1-tick 急停可靠可視、佐證 gate 有作用（不改 physics）。
- **Decision — display-scale / debug HUD 屬 render 佔位，不破 WP-5 sim 交付**：兩處修正皆在 main.ts render 層、`import.meta.env.DEV` 或純視覺常數，**零觸及 sim 單位/決定性/匯出資料**。故 WP-5 sim 交付（HitDetector/firstShot/MovementController/SimLoop）維持 review 綠、determinism 9/9 不動。正式 display scale → WP-6；精準度數值呈現 → WP-8。
- **交棒**：
  - **WP-6（drill 編排）**：接管 `SIM_TO_WORLD` 正式 display scale + `vStrafe`/`distance`/`peekTimeoutMs`/`spawnDelayMs` 由 `DrillConfig` 注入（`createMovementController({vStrafe})` / `createTargetManager({distance})` seam 已備）。
  - **WP-7（記錄）**：消費 fire 結果事件（`hit`/`part`/`targetId`/`accurate`/`residualSpeed`/`firstShot`/`t`）——SimLoop fire 分支已算出、現 `void` 標記接縫，WP-7 接 `DataRecorder` arena emit。
  - **WP-8（指標/HUD）**：以 `accurate`/`residualSpeed` 二元 {0,±v} 做結果頁分類呈現（取代 dev HUD 佔位）；首發命中率分子＝`firstShot && hit`。

### 2026-07-02 — T4 簡化急停 + gate 開火精準 ✅
- **狀態** `SharedState.player` 加 `stopped: boolean`（急停 flag，抽象欄位）；`createSharedState` 初始 false、`resetState` 原地清（GC 紀律）。同步更新 `SharedState.test.ts` 兩處 `toEqual` player 形狀斷言。
- **MovementController.step** 加反向鍵急停：以 `prevVx = state.player.vx`（上一 tick velocity）為「當前移動方向」判定源；`counterStrafe = (prevVx>0 && held.left) || (prevVx<0 && held.right)`——移動中且反向鍵按住 → 該 tick `vx=0` + `stopped=true`（急停窗，一 tick）；否則走原 M1 snap + `stopped=false`。續按反向鍵次 tick 因 prevVx 已 0 → 反向/過衝、stopped 復 false。
- **接線** `SimLoop.applyInput` fire 分支：**在 raycast/markKilled 之前**算 `accurate = state.player.stopped`、`residualSpeed = |state.player.vx|`（反映 fire 當下＝上一 tick movement 所定 velocity；本 tick movement.step 尚未跑）。emit fire 結果事件留 WP-7，本 WP `void` 標記接縫（沿用 T2 firstShot 模式）。
- **測試**：`MovementController.test.ts` +6 例急停組（釋放同向反向鍵急停、續按過衝、A+D 同按仍急停、對稱 A→D、純放開非急停、靜止起步非急停）；`SimLoop.test.ts` +1 整合（simStep 內反向鍵 → stopped/vx，gate 來源）。`vitest run src` **99/99**、`tsc --noEmit` exit 0、determinism **9/9** 綠。
- **Decision — 用 held（非 target velocity）判反向鍵**：`counterStrafe` 條件讀 `held.left/right` 而非 net target。*理由*：A+D 同按（net target=0，互斥抵消）在「移動中」情境下反向鍵**已壓下**，語意上即 counter-strafe 應急停；若以 target 判定則 A+D 會落入 else 分支（vx=0 但 stopped=false），漏標精準窗。以 held 判定使「按下反向鍵那刻」= 急停，與 CS 手感一致。*Alternatives*：①以 prevVx 與 target 反號判定——漏 A+D 同按案例；②維持 controller 無狀態、prevVx 讀 `state.player.vx`——已採用（不需 controller 私有 state，`resetState` 天然清）。
- **Decision — accurate/residualSpeed 於 fire 處**在 movement.step 之前**讀 player 狀態**（consume→movement 順序）**：fire 事件在 consume 階段 inline 評估，此時本 tick 的 movement.step 尚未跑，故讀到的是上一 tick 末的 velocity/stopped。*理由*：velocity snap 無 accel、tick 間為階梯常數，fire 當下的有效速度＝上一 tick movement 所定值，語意正確。同 tick 內「反向鍵 keydown + fire」則 fire 見上一 tick（尚未急停）狀態——急停於 tick 邊界生效，128Hz 下 sub-tick 誤差 ~7.8ms，階段 A 可接受。連續精準度模型留階段 B。
- **Surprise**：T3 既有單元測試「held D→+v、held A→−v」原以「移動右 → 直接按 A」測 −v snap——T4 急停邏輯正確地把此情境判為 counter-strafe（vx=0 而非 −250），測試失效。修正：中間插一步「放開回靜止」再從靜止按 A 測純 −v snap（保留原「純方向 snap」意圖，反向穿越另由急停測試組覆蓋）。非行為回歸，而是 T4 語意上線的必然。
- **Next**：T5 Exit gate（M2）——橫移/急停/開火/命中/首發全綠盤點 + 端到端手動驗（含急停瞬間開火標精準），宣告 **M2 核心玩法成立**，交棒 WP-6/WP-7。

### 2026-07-02 — T3 橫移 movement ✅
- **新增** `src/sim/MovementController.ts`：`createMovementController({vStrafe?})` → `step(state, dtSec)`。M1 snap：依 `state.held` 定 vx（僅 D→+v、僅 A→−v、皆按/皆放→0 互斥抵消），`x += vx*dtSec`。公開介面僅 `step`（階段 B friction integrator 同介面替換，附錄 D）。預設 `vStrafe=250`（OQ-5.2）。
- **狀態** `SharedState.held: {left, right}`（`left`=KeyA、`right`=KeyD）；`createSharedState` 初始 false、`resetState` 原地清零（GC 紀律）。
- **接線** `SimLoop`：`applyInput` 鍵分支改寫 `state.held`（不再直接寫 vx）；`simStep` 移除 inline `x += vx*dt`，改在 consume 後呼叫 `movement.step`；新增選填 `movement` 參數（預設模組 `defaultMovement`；`createSimLoop` 綁定自己的實例，WP-6 vStrafe seam）。移除 `PLACEHOLDER_STRAFE_SPEED`。`main.ts` 不變（controller 由 `createSimLoop` 內建）。
- **測試**：`MovementController.test.ts` 6 例（snap ±v/0、同按抵消、線性位移、**位移與 tick 切分無關**同總時間不同步數 bit-exact、放開歸零不前進、vStrafe 注入）。更新 `SimLoop.test.ts` 手動-vx 測試 → 改由 `held` 驅動（velocity 所有權移入 controller）。`vitest run src` **92/92**、`tsc --noEmit` exit 0。
- **Decision — velocity 改 held-based per-tick 推導（非 event-driven 直寫 vx）**：`applyInput` 鍵事件只更新 `state.held` 布林，velocity 由 `MovementController.step` 每 tick 從 held 推導。*理由*：①T4 counter-strafe「續按反向鍵 → 下一 tick −v」需 per-tick 讀 held（held 鍵不重發事件）；②階段 B friction integrator 亦每 tick 讀 held 算 velocity——同介面。*決定性保證不變*：同一事件序列下每 tick 的 held→vx 推導與舊 event-driven 直寫**逐 tick 等值**（keydown/keyup 落同一 tick 窗、step 在 consume 後跑），故 determinism 9/9 全綠、GROUND bit-exact 不動。*Alternatives*：①保留 event-driven 直寫 vx、`step` 只做位移積分——T4 須回頭重構、且與階段 B integrator 介面不一致；②held 存 controller 私有閉包——則 controller 需額外「收鍵事件」方法，破壞「公開點只有 step」契約，且 `resetState` 無法清。選 held 入 SharedState（可 reset、T4 直接讀、controller 保持無狀態）。
- **Decision — 同按 A+D → vx=0（互斥抵消）**：`left === right ? 0`。階段 A 簡化取捨（無 last-key-wins 佇列）；與 T4 急停「停止」語意天然一致。若日後需 last-key-wins 為階段 B 課題。
- **Surprise**：WP-2 「simStep 等速推進 x」單元測試直接設 `state.player.vx=128` 後斷言積分——velocity 所有權移入 controller 後 `step` 會以 held（全 false）覆寫 vx→0，測試失效。改為設 `state.held.right=true`、斷言 snap +250 後積分。此為 velocity 所有權遷移的必然後果、非行為回歸（determinism/整合路徑全綠佐證）。
- **手動驗證 PASS（2026-07-02 使用者確認）**：瀏覽器內 A/D 可產生左右移動。
- **Next**：T4 簡化急停（依 T3）——反向鍵穿越 tick snap 0 + `stopped` flag + gate 開火精準（accurate/residualSpeed），與 firstShot 組成 fire 結果事件。

### 2026-07-02 — T2 首發判定 ✅
- **新增** `src/sim/firstShot.ts`：`firstShotGate(state, peekId)`（每 peek 首次 true、其後 false）+ `currentPeekId(state)`（第一個 `visible && alive` 目標 id = peek 錨）。
- **狀態** `SharedState.firstShotPeekId: string | null`（已計首發的 peekId；`createSharedState` 初始 `null`、`resetState` 歸零）。
- **接線** `SimLoop.applyInput` fire 分支：**先於命中判定**算 `firstShot = firstShotGate(state, currentPeekId(state))`，再 raycast/`markKilled`——命中即擊殺會撤除目標換 peek，故首發須對「fire 當下 peek」判定。未命中亦計首發（P2 可補槍）。fire 結果事件（含 firstShot）產出留 WP-7（`void firstShot` 標記接縫）。
- **測試**：`firstShot.test.ts` 8 例（gate 同 peek 三槍只首發 true、換 id 隱式 reset、旗標記憶欄位；`currentPeekId` 略過 dead/hidden、無 active→undefined；simStep 整合：連開未命中不換 peek、命中擊殺換 peek 後新 peek 又計首發）。`vitest run src` **86/86**、`tsc --noEmit` exit 0。
- **Decision — 隱式 reset（peekId 唯一）而非顯式清旗標事件**：`TargetManager.markKilled` 撤除後對側 spawn **新 id**（`nextId++`），新 peek 必帶唯一 peekId，故 `firstShotGate` 只需比對「已計 peekId ≠ 新 peekId」即自動放行首發——無需在 `t_visible` 轉換點掛顯式 reset。*Alternatives*：①TargetManager 可見轉換時清 `firstShotPeekId`——多一處耦合、且需 firstShot 反向依賴 target 生命週期事件；②每 peek 存布林 + 綁 id——等價但多欄位。選單一 peekId 記憶最小狀態、天然決定性。
- **Decision — peekId = active 目標 id 由 firstShot 模組推導**：`currentPeekId` 放 `firstShot.ts`（peek 為首發概念），caller（SimLoop）傳入 gate；README 契約 `firstShotGate(state, peekId)` 維持 peekId 顯式參數（可測、不與 target 內部耦合）。
- **Next**：T3 橫移 movement（依 T0，可與本線並行）；T4 簡化急停（依 T3）將補 accurate/residualSpeed，與 firstShot 一同組成 fire 結果。

### 2026-07-02 — T1 HitDetector ✅
- **新增** `src/sim/HitDetector.ts`：`raycastFromCenter(camera, targets)` — `Raycaster.setFromCamera(NDC(0,0), camera)` → 對 active（`visible && alive`）目標由 `TargetState.hitbox` 衍生 `Box3`、`ray.intersectBox` 求交、取**最近**命中 → `{hit, targetId?, part?}`。
- **接線** `SimLoop`：`applyInput` 新增 fire 分支（camera/tm 注入時 raycast → 命中即 `markKilled`，OQ-5.4 第一次命中即擊殺）；`simStep`/`createSimLoop` 新增選填 `camera` 參數（省略則 fire no-op，決定性測試路徑不受影響）。`main.ts` 傳入 `sceneManager.camera`。
- **測試**：`HitDetector.test.ts` 8 例（正對→hit、偏移/背後→miss、多目標取最近、invisible/dead 不命中、simStep fire→markKilled 正確 id / 偏移不擊殺）。`vitest run src` **78/78**、`tsc --noEmit` exit 0。
- **Decision — camera 為 sim 選填注入（非新迴圈耦合）**：命中判定需 camera 朝向，但 camera 由 render/`CameraController` 走輸入路徑持有。選擇把 camera 以**選填參數**注入 `createSimLoop`/`simStep`，sim **唯讀** camera（不寫 render 物件），維持雙迴圈邊界（ADR-2）。*Alternatives*：①把 raycast 搬到 render 層——破壞「命中判定屬 sim」（CONTEXT）；②sim 持有 camera 副本——狀態雙源、易漂移。選注入最小耦合。
- **Decision — 手動 raycast（ray∩Box3）而非 `Raycaster.intersectObject(mesh)`**：sim 不得觸及 render mesh（TargetView 私有池，雙迴圈邊界）。改由 `TargetState.hitbox` 直接建 `Box3`，與 TargetView 的 `BoxGeometry`+scale **同來源**，判定/視覺不漂移（README failure-mode）。
- **Surprise**：`Raycaster.setFromCamera` 讀 `camera.matrixWorld`，**不**自動更新——測試須顯式 `camera.updateMatrixWorld(true)`；app 路徑由 render loop 每幀維護。已於 HitDetector doc 註明呼叫端責任。
- **Surprise（手動驗證發現）**：目標佔位距離 `DEFAULT_DISTANCE=8`（z=−8）落在佔位房間北牆（z=−5）**後方**，目標被牆遮擋、瀏覽器看不到方塊。命中邏輯正確（自動測試綠）但視覺不可驗。修正：距離 8→4（z=−4，房間內）——獨立 `fix` commit（`23b443c`），純佔位常數對齊，WP-6 drill config 之後接管。
- **手動驗證 PASS（2026-07-02 Edge/WebGPU）**：臨時 `[fire]` log 佐證端到端——對空牆 `hit:false` 不殺、對準 `hit:true` → t0→t1→…→t8 依序擊殺並生成對側、side 交替、未命中可補槍（P2）。驗畢移除 log（未 commit）。
- **Next**：T2 首發判定（依 T1）與 T3 橫移（依 T0）可並行。

### 2026-07-02 — T0 Entry gate ✅
- **上游 exit 綠燈確認**：WP-3（PR #1）、WP-4（PR #2）皆已合併入 `origin/main`（f530210）。WP-4 progress 記 F2 全綠（五軸 review Approve、`tsc` exit 0、`vitest run src` 43/43）。
- **base 銜接**：WP-5 branch rebase 到 `origin/main`，取得 `TargetManager`（`markKilled`/`t_visible`/H1 hitbox）、`TargetState`、`TargetView`、`Crosshair`、`SimLoop`（target-motion slot + 佔位 strafe velocity）。
- **就緒契約**：`SharedState.player{vx,vz,x,z}`、`tVisible: Map<id,ms>`、`targets: TargetState[]`；fire 事件型別 `{type:'fire',t}` 已在 ring（`EV_FIRE`），WP-5 在 `consume` 串流該點 inline raycast。
- **OQ-5.1~5.4 鎖定**（見上 ledger），與 CONTEXT.md `HitDetector`(H1) / `MovementController`(M1 snap) / 首發(peek 錨) / residualSpeed(階段 A 二元) 一致。
- **Surprise**：main 上 WP-4 其實已由 PR #2 合併（本機 main 曾落後）；rebase 到 `origin/main` 後 base 完整，entry gate PASS。
- **Next**：T1 HitDetector 與 T3 MovementController 可並行（皆僅依 T0）。

### （規劃）— WP-5 計畫產出
- 依 PLAN WP-5（5.1–5.4）+ 規格 §5 + F3 展開為 T0–T5。
- **M2 = 核心玩法成立**。階段 A 簡化急停（立即停止 + 布林精準 gate）；`MovementController` 介面預留階段 B friction integrator（附錄 D）。
- 首發旗標綁 peek 生命週期（t_visible→擊殺），避免掃射稀釋。
- **Next**：確認 WP-3/WP-4 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
