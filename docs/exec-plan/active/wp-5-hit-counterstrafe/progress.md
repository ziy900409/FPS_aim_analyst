# WP-5 — Progress Log ★M2

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中（T0 ✅；達成即 M2）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02）— WP-3/4 exit 綠燈確認、OQ-5.1~5.4 鎖定 |
| T1 HitDetector | ✅ 完成（2026-07-02）— camera 中心射線命中 + 第一次命中即擊殺（FR-5.1，OQ-5.4）|
| T2 首發判定 | ✅ 完成（2026-07-02）— 每 peek 首發旗標，掃射不稀釋（FR-5.2，OQ-5.3）|
| T3 橫移 movement | ✅ 完成（2026-07-02）— MovementController A/D 橫移，held-based per-tick snap（FR-5.3，OQ-5.2）|
| T4 簡化急停 | ⬜ 待執行 |
| T5 Exit gate（M2） | ⬜ 待執行 |

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

### 2026-07-02 — T3 橫移 movement ✅
- **新增** `src/sim/MovementController.ts`：`createMovementController({vStrafe?})` → `step(state, dtSec)`。M1 snap：依 `state.held` 定 vx（僅 D→+v、僅 A→−v、皆按/皆放→0 互斥抵消），`x += vx*dtSec`。公開介面僅 `step`（階段 B friction integrator 同介面替換，附錄 D）。預設 `vStrafe=250`（OQ-5.2）。
- **狀態** `SharedState.held: {left, right}`（`left`=KeyA、`right`=KeyD）；`createSharedState` 初始 false、`resetState` 原地清零（GC 紀律）。
- **接線** `SimLoop`：`applyInput` 鍵分支改寫 `state.held`（不再直接寫 vx）；`simStep` 移除 inline `x += vx*dt`，改在 consume 後呼叫 `movement.step`；新增選填 `movement` 參數（預設模組 `defaultMovement`；`createSimLoop` 綁定自己的實例，WP-6 vStrafe seam）。移除 `PLACEHOLDER_STRAFE_SPEED`。`main.ts` 不變（controller 由 `createSimLoop` 內建）。
- **測試**：`MovementController.test.ts` 6 例（snap ±v/0、同按抵消、線性位移、**位移與 tick 切分無關**同總時間不同步數 bit-exact、放開歸零不前進、vStrafe 注入）。更新 `SimLoop.test.ts` 手動-vx 測試 → 改由 `held` 驅動（velocity 所有權移入 controller）。`vitest run src` **92/92**、`tsc --noEmit` exit 0。
- **Decision — velocity 改 held-based per-tick 推導（非 event-driven 直寫 vx）**：`applyInput` 鍵事件只更新 `state.held` 布林，velocity 由 `MovementController.step` 每 tick 從 held 推導。*理由*：①T4 counter-strafe「續按反向鍵 → 下一 tick −v」需 per-tick 讀 held（held 鍵不重發事件）；②階段 B friction integrator 亦每 tick 讀 held 算 velocity——同介面。*決定性保證不變*：同一事件序列下每 tick 的 held→vx 推導與舊 event-driven 直寫**逐 tick 等值**（keydown/keyup 落同一 tick 窗、step 在 consume 後跑），故 determinism 9/9 全綠、GROUND bit-exact 不動。*Alternatives*：①保留 event-driven 直寫 vx、`step` 只做位移積分——T4 須回頭重構、且與階段 B integrator 介面不一致；②held 存 controller 私有閉包——則 controller 需額外「收鍵事件」方法，破壞「公開點只有 step」契約，且 `resetState` 無法清。選 held 入 SharedState（可 reset、T4 直接讀、controller 保持無狀態）。
- **Decision — 同按 A+D → vx=0（互斥抵消）**：`left === right ? 0`。階段 A 簡化取捨（無 last-key-wins 佇列）；與 T4 急停「停止」語意天然一致。若日後需 last-key-wins 為階段 B 課題。
- **Surprise**：WP-2 「simStep 等速推進 x」單元測試直接設 `state.player.vx=128` 後斷言積分——velocity 所有權移入 controller 後 `step` 會以 held（全 false）覆寫 vx→0，測試失效。改為設 `state.held.right=true`、斷言 snap +250 後積分。此為 velocity 所有權遷移的必然後果、非行為回歸（determinism/整合路徑全綠佐證）。
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
