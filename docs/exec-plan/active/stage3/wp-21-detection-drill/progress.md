# WP-21 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中 — T3 offline derivation PASS 2026-07-09; T-exit next

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 seeded spawn | ✅ |
| T2 偵測 drill config | ✅ |
| T3 離線推導 spec + fixture | ✅ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-2 t_detect 參數起點(θ_v 倍率 / k tick;spec 標「暫定」) | ✅ resolved | θ_v = 3× 前刺激窗 500ms aim 角速度 SD;k = 4 tick(128Hz 下約 31.25ms)。T3 spec 需標「暫定,pilot 校準」並保留離線敏感度分析。 |
| OQ-21.1 `spawnArea` 幾何範圍預設(yawDegRange/distanceURange 與房間/場景/走廊的相容範圍) | ✅ resolved | `targets.spawnArea` 預設 `{ yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] }`。目標 y/hitbox 沿用 `TargetManager` 現況(`y=1.5`,1×2×1u);最遠中心 z=-4.4 時 hitbox 前緣仍在 placeholder-room 北牆 z=-5 內,橫向極值小於現行 ±2u 側槽。 |
| OQ-21.2 seeded 取樣次序定稿(計畫預設:delay → yaw → distance)+ spawn 事件位置欄落點(v2 additive) | ✅ resolved | 取樣次序固定為 `delay → yaw → distance`。位置落點為既有 `visible` event 的 additive 欄位 `targetX`/`targetY`/`targetZ`(JSON),CSV events 追加同名欄;不新增 `spawn` event type。`meta.spawn` 記 `seed`、`spawnArea`、`spawnDelayMsRange` 快照。 |

---

## Log

### 2026-07-09 08:31Z — T3 offline derivation PASS(spec + executable verifier + round-trip fixtures)

- **Spec / schema**:
  - `docs/operational/analysis-t-detect.md`:新增 t_detect / eccentricity 離線推導 spec。定義輸入 schema v2、aim/target 角距公式、`theta_v = 3 × SD(|dε/dt|)`、`k = 4 tick`、timeout / short baseline / anticipation / engagement time。
  - `docs/operational/schema.md`:補 `visible.targetX/targetY/targetZ` JSON/CSV 文件與範例，新增 Offline Derived Fields 交叉引用到 `analysis-t-detect.md`。
- **Executable verifier**:
  - `src/metrics/detectionDerivation.ts`:新增純離線 `deriveDetectionMetrics(payload)`，消費 production `ExportPayload`，輸出每個 presentation 的 `eccentricityAtSpawnDeg`、threshold、status、`tDetectMs`、baseline/anticipation flags。
  - `src/metrics/detectionDerivation.test.ts`:合成 aim fixture 經 `DataRecorder` → `buildExportPayload()` → `serializeJSON()` round-trip 後推導。四組 known onset(快/慢 × 高/低 noise)皆斷言誤差 ≤ 1 tick，並覆蓋 timeout、anticipation、首窗不足。
- **Verification**:
  - `npm.cmd test -- src/metrics/detectionDerivation.test.ts` → **1 file / 8 tests pass**。
  - `npm.cmd run typecheck` → pass。
  - `npx.cmd vitest run` → **58 files / 438 tests pass**。
- **Decision Log**:
  - **`t_detect` 回傳 sustained run 的第一個 tick，而非第 k 個確認 tick**。Alternatives Considered:回傳第 k tick 可在單 pass streaming 中更直覺；但會系統性晚 `k-1` tick，不符合「onset」語意。採第一 tick，演算法仍需觀察到 k tick 後才確認。
  - **baseline threshold 使用 `|dε/dt|` 的 SD，`dε/dt` 仍保留符號判斷下降**。Alternatives Considered:對 signed velocity 直接取 SD；但 OQ-S3-2 指向 aim angular velocity noise magnitude，使用 absolute velocity SD 更符合噪聲底估計。
  - **缺 `visible.targetX/Y/Z` 且 spawn tick 也無 target center 時 fail-fast**。Alternatives Considered:輸出 timeout 或 NaN；但這是 schema drift / 舊匯出格式，不是受試者行為，fail-fast 更能保護分析端。
- **Surprises & Discoveries**:
  - `docs/operational/schema.md` 尚未記錄 T2 已實作的 `visible.targetX/Y/Z` 欄位；T3 已補齊 JSON/CSV header、範例與 FPSci mapping。
- **Open Questions**:
  - 無新增阻塞。`theta_v` multiplier 與 `k` 仍依 OQ-S3-2 標為 provisional，留待 pilot sweep 校準。

### 2026-07-09 08:14Z — T2 detection drill PASS(pop-in config + visible position fields + meta.spawn + E2E smoke)

- **Slice 1 — detection drill config + Controls 掛線**:
  - `src/drill/detection_popin_v1.ts`:新增 `detection_popin_v1`，使用 T0 定稿 `spawnArea { yawDegRange:[-25,25], distanceURange:[3.2,4.4] }`、`sequence.seed:21021`、`spawnDelayMsRange:[800,2400]`、`count:20`、`peekTimeoutMs:1500`。
  - `src/main.ts`:`availableDrills` 新增 detection drill，Controls dropdown 可載入。
  - 驗證:`npm.cmd test -- src/drill/detection_popin_v1.test.ts src/drill/schema.test.ts` → **2 files / 25 tests pass**。
- **Slice 2 — visible event 位置欄(v2 additive)**:
  - `src/data/DataRecorder.ts`:visible event additive 欄位 `targetX`/`targetY`/`targetZ`。
  - `src/loop/SimLoop.ts`:spawn tick 的 `visible` event 寫入 active target world/source 位置；`t_visible` 語意不變。
  - `src/data/export.ts`:JSON finite check + CSV events 追加 `targetX,targetY,targetZ` 欄。
  - 驗證:`npm.cmd test -- src/data/export.test.ts src/data/DataRecorder.test.ts src/loop/SimLoop.test.ts` → **3 files / 32 tests pass**。
- **Slice 3 — `meta.spawn` snapshot**:
  - `src/data/metadata.ts`:`SpawnMeta` 擴 `spawnDelayMsRange`。
  - `src/main.ts`、`src/testharness/fpsTestHarness.ts`:匯出 `seed`、`spawnArea`、`spawnDelayMsRange`、既有 `motion`。
  - 驗證:`npm.cmd test -- src/data/metadata.test.ts src/testharness/fpsTestHarness.test.ts` → **2 files / 22 tests pass**。
- **Slice 4 — timeout 推進 + harness/E2E smoke**:
  - `src/drill/DrillRunner.ts`:`timing.peekTimeoutMs` 省略時行為不變；提供時 visible target 逾時後用同一 `TargetManager.markKilled` 推進序列並計入 targetCount。
  - `src/testharness/fpsTestHarness.ts`:新增 `runDetectionTimeoutRound()`，不開火，靠 timeout 跑完整 detection drill。
  - `tests/e2e/full-drill.spec.ts`:新增 Edge E2E detection smoke，斷言 `visible` 位置欄、唯一 presentation 數、`meta.spawn`。
  - 驗證:`npm.cmd test -- src/drill/DrillRunner.test.ts src/testharness/fpsTestHarness.test.ts src/drill/detection_popin_v1.test.ts` → **3 files / 16 tests pass**。
- **T2 完整驗證**:
  - `npm.cmd run typecheck` → pass。
  - `npx.cmd vitest run` → **57 files / 430 tests pass**。
  - Sandbox 內 `npx.cmd playwright test tests/e2e/full-drill.spec.ts --project=edge` 被 Vite/esbuild 讀取上層目錄權限擋住。
  - 提升權限重跑同一條 Playwright 命令 → **3 tests pass**(含 WP-21 detection pop-in smoke)。
- **Decision Log**:
  - **沿用既有 `visible` event，不新增 `spawn` event type**。Alternatives Considered:新增 `spawn` event 語意較直觀；但 T0/OQ-21.2 已決議 `visible.t` 是 `t_visible` 起點，追加位置欄可避免分析端處理兩個起點事件。
  - **`targetX/Y/Z` 在 TypeScript union 內保持 optional，但由 `SimLoop.recordVisibleEvents` 對新資料必填輸出**。Alternatives Considered:型別上強制 required；但既有測試 fixture/舊匯出 payload 可合法缺欄，optional 更符合 v2 additive 相容。
  - **timeout 推進重用 `TargetManager.markKilled`**。Alternatives Considered:新增 `markTimedOut` 或 timeout event；目前 targetCount 只需要「presentation consumed」語意，重用既有 remove/flip/tVisible 清理路徑可保持 side/seed 序列一致，且不擴大 public interface。
  - **detection drill 以 TS config 落在 `src/drill/detection_popin_v1.ts`**。Alternatives Considered:新增根目錄 JSON drill；但 T2 明確指定 src 檔，且 TS 常數可被 unit/harness/main 共用並受 typecheck 覆蓋。
- **Surprises & Discoveries**:
  - `timing.peekTimeoutMs` 原本只在 schema/config 中存在，`DrillRunner` 尚未實作 per-presentation timeout；若只加 detection config，未開火會卡在第一個目標。
  - Playwright/Vite 在 sandbox 內仍會遇到 esbuild 讀 `vite.config.ts` 上層目錄權限問題；提升權限後同一命令通過。
- **Open Questions**:
  - 無新增阻塞。T3 可消費 `visible.targetX/Y/Z` 與 `meta.spawn`，再接 WP-16 的逐 tick 目標/玩家位置欄做互驗。

### 2026-07-09 07:54Z — T1 seeded spawn PASS(schema + TargetManager + WP-19 clearance 對帳)

- **基準 / 零破壞證據**:
  - Sandbox 內 `npm.cmd run test -- src/drill/schema.test.ts src/sim/TargetManager.test.ts src/scene/clearance.test.ts tests/regression/determinism.test.ts src/loop/__tests__/fire-determinism.test.ts src/loop/__tests__/recoil-wiring.test.ts src/loop/__tests__/sim-clock-drift.test.ts` 被既有 Vite/esbuild config 讀取權限擋住。
  - 提升權限重跑同一組基準 → **7 files / 87 tests pass**(改動前基準)。
- **Slice 1 — schema 擴欄**:
  - `src/drill/DrillConfig.ts`:新增 `SpawnAreaConfig`、`targets.spawnArea?`、`sequence.spawnDelayMsRange?`。
  - `src/drill/schema.ts`:驗證 `yawDegRange` / `distanceURange` / `spawnDelayMsRange` tuple、range 順序與有限數;`spawnArea`、`spawnDelayMsRange` 皆需搭配 `sequence.seed`。
  - `src/drill/schema.test.ts`:合法/非法/缺 seed 併用規則覆蓋。
  - 驗證:`npm.cmd run test -- src/drill/schema.test.ts` → **1 file / 23 tests pass**。
  - Commit:`8d6908b feat(wp-21): add seeded spawn schema fields`。
- **Slice 2 — TargetManager seeded branch**:
  - `src/sim/TargetManager.ts`:只有 config 提供 `targets.spawnArea` 或 `sequence.spawnDelayMsRange` 時啟用 seeded spawn;seed-only 現行 `counterstrafe_ad_v1` 仍走舊 L/R slot 位置,保護零破壞。
  - 取樣次序鎖定為 `delay → yaw → distance`;位置為 camera-independent world polar (`x=sin(yaw)*distance`,`z=-cos(yaw)*distance`)。
  - `reset()` 重建 ran1 stream,同 seed 可重跑同序列;`spawnDelayMsRange` 以 pending due time 延後 pop-in,`t_visible` 仍由 spawn tick 蓋戳。
  - `src/sim/TargetManager.test.ts`:seed-only legacy 位置、同 seed reset 重現、不同 seed sanity、seed=12345 前五個 spawn golden(含 due time/position)。
  - 驗證:`npm.cmd run test -- src/sim/TargetManager.test.ts` → **1 file / 23 tests pass**;TargetManager regression 組 → **5 files / 65 tests pass**。
  - Commit:`a427e70 feat(wp-21): add deterministic seeded spawn`。
- **Slice 3 — WP-19 clearance 對帳**:
  - `src/scene/clearance.ts`:若 `targets.spawnArea` 存在,以 yaw range 端點 + 90° 倍數臨界角、distance min/max 推得 polar sector 的保守 hitbox AABB;保留既有 L/R slot path 不變。
  - `src/scene/clearance.test.ts`:鎖 default spawnArea `{ yawDegRange:[-25,25], distanceURange:[3.2,4.4] }` 的 envelope 極值,並以 `spawnarea-blocker` fixture 驗證 seeded pop-in 包絡會被淨空 gate 擋下。
  - 驗證:`npm.cmd run test -- src/scene/clearance.test.ts` → **1 file / 10 tests pass**。
- **T1 完整驗證**:
  - `npm.cmd run typecheck` → pass。
  - T1 regression 組 → **7 files / 98 tests pass**。
  - `rg "Math\.random\(" src\sim src\recoil` → no matches(exit 1,無呼叫)。
  - `npx.cmd vitest run` → **56 files / 426 tests pass**。
- **Decision Log**:
  - **seed-only 不啟用 spawn 隨機化**。Alternatives Considered:任何 `sequence.seed` 都改成 seeded spawn,較貼近「seed 啟用」字面;但現行 `drills/counterstrafe_ad_v1.json` 已有 `seed:1`,若直接改會破壞既有 drill baseline。採「有 `spawnArea` 或 `spawnDelayMsRange` 才啟用」,讓 T2 detection config 明確 opt-in,同時保住舊 drill。
  - **`spawnDelayMsRange` 也需 `sequence.seed`**。Alternatives Considered:只要求 `spawnArea` 有 seed,讓 delay range 可單獨存在;但 range delay 也是隨機來源,無 seed 會違反 GD-5。若需要固定延遲,沿用既有 `timing.spawnDelayMs`。
  - **clearance 對 spawnArea 用保守 AABB,不把 scene/clearance import 進 sim**。Alternatives Considered:讓 TargetManager 匯出 spawnArea sampling helpers 給 clearance 共用;但會把驗證層與 sim runtime 綁得更緊。採兩邊同公式+測試鎖極值,維持 GD-6 邊界。
- **Surprises & Discoveries**:
  - 現行 counter-strafe drill 已帶 `sequence.seed`,所以「無 seed path」不足以保證零破壞;必須另外測 seed-only legacy path。
  - `spawnDelayMsRange:[0,0]` 仍刻意消耗一個 ran1 值,用 golden 鎖住 `delay → yaw → distance` 次序;否則固定 delay 會悄悄改變位置序列。
- **Open Questions**:
  - 無新增阻塞。T2 可新增 detection pop-in drill config 並在 spawn/visible event payload 落 `targetX/targetY/targetZ` additive 欄。

### 2026-07-09 07:35Z — T0 entry gate PASS(GD-7/8 收斂 + spawnArea/取樣次序決議 + WP-19 對帳)

- **基準驗證**:
  - `npm run test` 先被本機 PowerShell execution policy 擋在 `npm.ps1`。
  - `npm.cmd run test` 在 sandbox 內進到 Vitest,但 esbuild 讀 `vite.config.ts` 時被上層目錄權限擋住。
  - 提升權限重跑同一條 `npm.cmd run test` → Vitest **56 files / 415 tests pass**,exit 0。
- **TargetManager / seed 現況證據**:
  - `src/drill/schema.ts` 目前驗證並保留 `sequence.seed`(有限數),但不賦予 spawn 語意。
  - `src/sim/TargetManager.ts` `createTargetManager(config)` 只讀 `targets.distance`、`targets.count`、`targets.motion`、`sequence.alternation`;註解明確寫 `sequence.seed` 為未來隨機化保留、現階段不讀 seed。
  - 現行 spawn = 單 active target;位置 `{ x: ±2, y: 1.5, z: -distance }`,spawn 當 tick `visible: true/alive: true`。
  - `tick(state, nowMs)` 在無存活目標且未達 spawn 上限時補生,同 tick 對 visible 且未蓋戳目標寫 `state.tVisible.set(id, nowMs)`;`t_visible` 語意仍是 spawn tick 的 sim clock。
  - `markKilled` 只有真的移除目標才翻面並刪該 id 的 `tVisible`;`reset` 清 targets/tVisible/計數並由 `seq` 或 config 首字決定首側。
- **T1 零破壞閘沿用的既有測試清單**:
  - `src/sim/TargetManager.test.ts`:spawn 即可見、`t_visible` 只蓋一次、sim clock 時間源、`markKilled`/`reset`、嚴格左右交替、config-driven distance/count/motion、同 config 決定性。
  - `src/drill/schema.test.ts`:合法 config 保留 `seed`/timing/motion,非法欄位帶路徑錯誤。
  - `src/loop/__tests__/determinism.test.ts`:M1 fixed-step determinism、事件 tick index、large gap clamp 決定性。
  - `tests/regression/determinism.test.ts`:完整 sim + DataRecorder 跨 render FPS bit-exact、場景純裝飾跨場景 bit-exact、重播 bit-exact。
  - `src/loop/__tests__/fire-determinism.test.ts`:連發出彈 tick/排程序列與重播 bit-exact。
  - `src/loop/__tests__/recoil-wiring.test.ts`:同 seed recoil/spread bit-exact、不同 pump FPS 末態一致。
  - `src/loop/__tests__/sim-clock-drift.test.ts`:卡頓後 sim clock re-anchor 防永久漂移。
- **OQ 決議**:
  - OQ-21.1:`spawnArea` 預設 `yawDegRange [-25,25]`, `distanceURange [3.2,4.4]`。Alternatives Considered:更大距離上限(4.8u)可增加偏心度,但 placeholder-room 內 hitbox 會越過 z=-5 北牆;更窄 yaw(±15°)較保守但偏心度範圍不足。採 ±25°/3.2–4.4u,保留現行側槽等級 eccentricity 且不越過佔位房間幾何。
  - OQ-21.2:seeded stream 每 trial 固定抽樣 `delay → yaw → distance`。Alternatives Considered:先抽位置再抽 delay 較直覺,但會讓只調 delay 分佈時改變位置序列;delay 先抽符合 WP-21 README 既定契約並成為 golden 序列的一部分。
  - OQ-21.2 event 落點:沿用 `visible` event,追加 `targetX/targetY/targetZ`,不新增 `spawn` event type。Alternatives Considered:新增 `spawn` event 可語意更直,但現行 schema 已以 `visible.t` 表示 `t_visible`;新增 event 會讓分析端同時處理兩個起點事件。
  - OQ-S3-2:`t_detect` 起點維持 θ_v = 3× 前刺激窗 SD、k=4 tick;T3 spec 必須標「暫定,pilot 校準」。
- **WP-19 淨空對帳**:
  - 現行 `src/scene/clearance.ts` `deriveTargetEnvelopes(drill)` 只用 `targets.distance`、active sides(±2u)與 `targets.motion`;因 schema 尚無 `targets.spawnArea`,**尚未形式涵蓋 spawnArea 極值**。
  - 結論:WP-21 T1/T2 啟用 `targets.spawnArea` 前,必須把 spawnArea polar 極值納入 clearance target envelope(或另拆同等 gate),否則場景淨空證據只覆蓋舊左右側槽。此待辦已互記到 WP-19 progress。
- **文件同步**:`T0-entry-gate.md` 狀態/Steps、`task-checklist.md`、本 progress、stage3 `README.md` §8、`CLAUDE.md` §4 與 WP-19 progress 已回寫。`git diff --stat` 應不含 `src/`。
- **Entry-gate conclusion**:**PASS**。T1 可開始,但 T1 的 DoD 必須同時守住「無 seed 路徑逐位不變」與上述 WP-19 clearance spawnArea 對帳。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-8(pop-in 刺激 `t_visible`=spawn tick 語意不變;t_detect = 瞄準 onset
  離線推導;偏心度共變數)、GD-7(原始資料全記錄——推導輸入 = v2 逐 tick 欄)、
  GD-5(spawn 隨機化一律 seeded,重用 `createRan1`)。
- 設計要點:**零破壞不變式**(無 seed 路徑逐位不變)是 T1 的 DoD 首項;
  t_detect 推導完全離線(引擎零新計算),spec 即分析端介面。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD 收斂 + spawnArea 決議,docs-only。
