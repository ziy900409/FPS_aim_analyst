# WP-45 — progress / decision log

## Status

- **Current**:T0 entry gate 完成，可開始 T1。
- **Scope state**:`peek-click-transfer-pilot-v1` 為 Practice/pilot-only；正式 Assessment freeze 不在本 WP。
- **Dependency state**:T3 依賴的 WP-44 T-exit 已完成(`c44270e`)；T5 依賴的 stage8 WP-43 T-exit 已完成(`61db0ba`)；HEAD(`41d3bd5`)已包含兩者，兩個 gate 皆已開放，T3/T5 不再受阻。

## Progress

### 2026-08-26 — Planning

- 由 Kovaak's `Peek and Click` 影片分析收斂為 self-motion exposure transfer test。
- 依 `engineering-planning` quality gate 建立 requirements、interfaces、failure modes、risk、task files 與可驗證 DoD。
- 依 repeated-measures 原則，明確定義 participant 為 independent replicate、peeks 為 nested trials。
- 未修改 production code；未執行 T0 baseline。

### 2026-08-26 — T0 entry gate

- **Baseline HEAD**:`41d3bd508f9e9902ebbb333223c3d47f316bf96b`（`git status --short` 乾淨，無 pending diff）。
- **CodeGraph blast radius**（`codegraph_explore`，無 staleness banner，索引為權威）：
  - `createSimLoop`（`src/loop/SimLoop.ts:683`）：24 callers（`src/testharness/fpsTestHarness.ts`、`src/main.ts`），tests 覆蓋 `recoil-wiring.test.ts`/`wp22-determinism.test.ts`/`movingTargetDeterminismFixture.ts`/`projectile-determinism.test.ts` 等 7+ 檔 → 確認 T1 為跨模組 **High risk**，符合 README §3 風險評估。
  - `fireOneShot`（`SimLoop.ts:373`）：1 caller（`ballisticRaycast`），⚠️ CodeGraph 回報 **無覆蓋測試** — 現況既有缺口，非本 WP 引入；T1 新增 occlusion gate 時須為其新增/延伸測試，不能延用「零覆蓋」現況。
  - `raycastWithRay`（`src/sim/HitDetector.ts:67`）：5 callers（`HitDetector.ts`、`SimLoop.ts`），tests：`trackingDerivation.test.ts`。
  - `deriveVisibilityTimeline`（`src/metrics/visibilityDerivation.ts:43`）：3 callers（`holdClickMetrics.ts`），tests：`visibilityDerivation.test.ts`。
  - `loadDrillById`（`src/main.ts:1019`）：由 UI `onLoadDrill` 與 `createAppProtocolRunner.applyCondition` 呼叫；scene/drill atomic load 邏輯（`installSceneLoad`/`buildSimLoop`）與 README FM-P45-1 描述一致。
  - `buildFamilyOrder`（`src/session/sessionSchedule.ts:18`）：1 caller，tests：`sessionSchedule.test.ts`；`TEST_FAMILY_IDS` 為現行四家族凍結常數，T5 versioned roster 須另建常數，不得改此常數。
- **Baseline test 指令與結果**：
  - `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/sim/HitDetector.test.ts src/loop/SimLoop.test.ts` → exit 0，3 files / 73 tests 全綠。
  - `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts` → exit 0，2 files / 15 tests 全綠。
  - 無既有紅燈，無需歸因排除。
- **WP-44 dependency gate**（T3 依賴）：`git log` 確認 T-exit 已於 `c44270e` 完成（含 T0+T1 `78116a2`、T2 `5fa0c38`、T3 `1e31bd0`），且早於本 WP 目前 HEAD `41d3bd5`。`DrillConfig.ts`/`schema.ts`/`TargetManager.ts`/`main.ts` 熱區目前無 WP-44 未合併變更。**T3 gate 開放**。
- **WP-43 dependency gate**（T5 依賴）：`git log` 確認 stage8 WP-43 T-exit 已於 `61db0ba` 完成，同樣早於目前 HEAD。**T5 gate 開放**。
- **OQ-S9-4 決議**：維持 README 既定預設 — T3 先用 spawn-anchored `3000 ms` 總 timeout，同時輸出 `cue→onset`/`onset→hit` 分段時間與 `timeout_before_onset` flag（FM-P45-5）；split timeout 是否成為第二段獨立狀態機，留待真人 pilot 後另評估。理由：此為既有 README 預設且不阻塞 T1/T2/T3 介面設計；T0 未發現需要提前拍板的新資訊。若真人 pilot 後改採 split timeout，須先新增獨立 task/interface，不得沿用本決議悄悄改 `peekTimeoutMs` 語意。
- Production code diff：空（T0 僅讀碼與跑既有測試，未修改 `src/**`）。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| **D-45.7** | OQ-S9-4：T0 維持 spawn-anchored `3000 ms` 總 timeout 預設，不提前拍板 split timeout | README 既定預設已滿足「不阻塞 T1/T2/T3」；split timeout 需要真人 pilot 資料才能判斷是否值得新增第二套狀態機 | Confirmed，T0 |
| **D-45.1** | 新任務定位為 integrated transfer test，不取代 hold-click/counterstrafe component assessments | 混合構念適合驗證技能轉移，不適合單一診斷分數 | Confirmed，T0 覆核通過 |
| **D-45.2** | 先修共用 occlusion kernel，再允許 scene-aware hit | 現況 target-only raycast 可穿牆；不修即無有效 peek task | Proposed，T1 |
| **D-45.3** | 新建 `peek-ad-corridor-v1`，不改 frozen `peek-corridor` | 避免改變 stage6 hold-click geometry/history compatibility | Proposed，T2 |
| **D-45.4** | pilot 保留 box target、AK-47、嚴格 LR、miss 補槍 | 最小化新引擎分支並對齊影片循環；正式值留給 pilot | Proposed，T3 |
| **D-45.5** | 不建立 composite score | 沿用 stage6「不同構念分層報告」紀律 | Proposed，T4 |
| **D-45.6** | Session 採 versioned roster，不改 stage6 default family list | 防止既有 participant order 全數漂移 | Proposed，T5 |

## Surprises / blockers

- None at planning time。
- T0 覆核：WP-44/WP-43 均已 T-exit 且早於本 WP 目前 HEAD，T3/T5 熱區未被同時修改，dependency gate 皆已開放，不需延後。
- CodeGraph 標記 `fireOneShot` 現況零測試覆蓋——非本 WP 引入的既有缺口，記錄供 T1 新增 occlusion gate 時一併補測試意識，不在 T0 修。

## Open Questions

- 無新增；OQ-S9-5/S9-6/S9-7 維持 README 既定 owner/deadline，不受 T0 影響。

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-26 | `git rev-parse HEAD` / `git status --short` | HEAD=`41d3bd5`；working tree 乾淨 |
| 2026-08-26 | `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/sim/HitDetector.test.ts src/loop/SimLoop.test.ts` | exit 0，3 files / 73 tests passed |
| 2026-08-26 | `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts` | exit 0，2 files / 15 tests passed |
| 2026-08-26 | `mcp__codegraph__codegraph_explore`(6 core symbols) | blast radius 記錄如上；無 staleness banner |
