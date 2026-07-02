# WP-5 — Progress Log ★M2

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 執行中（T0 ✅；達成即 M2）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02）— WP-3/4 exit 綠燈確認、OQ-5.1~5.4 鎖定 |
| T1 HitDetector | ✅ 完成（2026-07-02）— camera 中心射線命中 + 第一次命中即擊殺（FR-5.1，OQ-5.4）|
| T2 首發判定 | ✅ 完成（2026-07-02）— 每 peek 首發旗標，掃射不稀釋（FR-5.2，OQ-5.3）|
| T3 橫移 movement | ⬜ 待執行 |
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
