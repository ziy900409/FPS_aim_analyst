# WP-25 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中;T0 entry gate ✅ PASS(2026-07-13);T1 tracer ✅ PASS(2026-07-13);T2 math core ✅ PASS(2026-07-14)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 tracer | ✅ |
| T2 數學核心 | ✅ |
| T3 sim 整合 | ⬜ |
| T4 指標語意 | ⬜ |
| T-exit(M12) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-2 projectile 參數域(speedU/gravityU/maxRangeU 表;與 distance 聯動)→ **GD-17** | ✅ T0 決議 | 以 WP-23 距離檔位聯動反推。canonical 0.5° distance=114.59u:8/16/32 ticks → `speedU=1833.45/916.73/458.36`, `maxRangeU=143.24`;2° sanity distance=28.65u:8/16/32 ticks → `speedU=458.37/229.18/114.59`, `maxRangeU=35.81`。重力以 target height 1u 的 0.10/0.25/0.50H 下墜反推:`gravityU=51.20/32.00/16.00`。config 驗證對到靶 <2 ticks 發 warning;`bullet` 欄 M12 前不得進任何 drill config。 |
| OQ-S5-5 lead 誤差是否進正式指標 | 🟡 待 T4 | 計畫預設:spec-only 離線推導(引擎零計算);pilot 顯示構念有效再立案晉升 |
| OQ-25.1 未命中彈的 tracer 端點(engagement plane 投影 vs maxRange 點) | ✅ T0 決議 | hitscan tracer 端點沿用 `projectMissOntoEngagementPlane` 既有交戰平面投影語意;projectile tracer 端點用子彈消滅點(`maxRangeU` 到達或未來 T2/T3 spec 定義的落地/失活點)。tracer 純視覺,不記錄。 |
| OQ-25.2 `BULLET_CAP` 容量與滿載政策 | 🟡 待 T3 | 預設:`magSize × 2`(單 peek 一匣 + 飛行殘留裕度);滿載拒發 + 旗標(比照 ring 溢位語意) |
| OQ-25.3 移動目標 × 飛行彈命中語意(swept 對本 tick 目標 AABB) | ✅ T2 決議 | `sweptHitTest` 只測 projectile segment(上一 tick bullet position → 本 tick bullet position)對「本 tick 目標 AABB」;不做目標 sub-tick path 內插。回傳 `s ∈ [0,1]` 作為後續 `t_hit` tick 內插輸入。 |

---

## Log

### 2026-07-14 — T2 projectile math core PASS

- **M11 複驗**:WP-23 T-exit 已 ✅ PASS(2026-07-10),progress 明確列出「WP-25 T2+(projectile)自此有效度地基可消費」;T2 entry 前提成立。
- **Implementation**:
  - `src/ballistics/bullet.ts`:新增 `BulletState` / `Vec3Like` / `BULLET_DT_SEC` / `spawnBullet(out,origin,dirUnit,speedU)` / `stepBullet(b,dtSec,gravityU)`。`spawnBullet` 原地重用 out;`stepBullet` 固定 1/128s,非 1/128 拋錯;採半隱式 Euler(先 `vy -= g*dt`,再位移),inactive slot 不前進。
  - `src/ballistics/sweptHit.ts`:新增 slab-method `sweptHitTest(x0,y0,z0,x1,y1,z1,aabb)`;回傳第一個 segment fraction `s` 或 `null`;平行軸 outside 拒絕,inside 保留區間,邊界相切視為 hit。
- **Decision**:OQ-25.3 定案為「飛行彈 segment vs 本 tick 目標 AABB」。Alternatives considered:對目標也做 sub-tick swept / 目標位置內插;但會把 T2 純幾何核心綁到 motion model 與 SimLoop tick sequencing,降低決定性可斷言性。T3 只需在 target motion 更新後傳入本 tick AABB。
- **Golden tests**:
  - `src/ballistics/bullet.test.ts`:spawn 重用、非法 dt、g=0 平飛 32 tick bit-exact、GD-17 16 tick 參數(`speedU=916.73`,`gravityU=32`)前 32 tick 位置/速度序列、inactive slot。
  - `src/ballistics/sweptHit.test.ts`:known hit tick + `s`、高速薄 AABB tunneling、boundary tangency、平行 zero-delta inside/outside、起點在 AABB 內、ray hit outside segment interval。
- **Zero-dependency evidence**:`Select-String -Path src/ballistics/*.ts -Pattern '^import'` 只顯示 test imports 與 `sweptHit.ts` 的 `import type { Vec3Like } from './bullet.ts'`;production ballistics 無 three/DOM/sim import。
- **Verification**:
  - `npx.cmd vitest run src/ballistics/bullet.test.ts` exit 0:1 file / **5 tests** 全綠(first slice)。
  - `npx.cmd vitest run src/ballistics/bullet.test.ts src/ballistics/sweptHit.test.ts` exit 0:2 files / **12 tests** 全綠。
  - `Select-String -Path src/ballistics/*.ts -Pattern '^import'` exit 0:production 只見 `sweptHit.ts` type-only import from `bullet.ts`;其餘為 test imports。
  - `npm.cmd run typecheck` exit 0:`tsc --noEmit` clean。
  - `npx.cmd vitest run` exit 0:Vitest **72 files / 582 tests** 全綠。
  - `graphify update .` exit 0 twice:bullet slice AST **155/155 files**,swept slice AST **157/157 files**;graphify-out rebuilt。
- **Open questions**:OQ-25.3 ✅;OQ-25.2 仍留 T3。

### 2026-07-13 — T1 tracer PASS

- **Implementation**:
  - `src/state/SharedState.ts`:新增 `ShotRayRing` / `TRACER_CAP` / `createShotRayRing` / `pushShotRay` / `resetShotRayRing`;`createSharedState` 與 `resetState` 原地管理 `shotRays`。
  - `src/loop/SimLoop.ts`:在既有 `ballisticHitPoint.valid` 分支中追加 `pushShotRay(origin→endpoint)`;endpoint 完全沿用命中點或 OQ-25.1 的 engagement-plane miss 投影,不改方向/命中/record event 語意。
  - `src/render/TracerView.ts`:新增單一 `InstancedMesh(TRACER_CAP)` tracer render view,seq 高水位增量同步,`Object3D`/向量 scratch 重用,`clear(skipSeq)` 與 `dispose()` 完整。
  - `src/ui/Controls.ts` + `src/main.ts`:新增 render 層 tracer checkbox;toggle 變更時立即清掉畫面並跳過既有 `shotRays.total`,重新啟用後只顯示新 shot;`tracerEnabled=false` 時 render loop 不呼叫 `TracerView.sync`(關閉=零同步工作),不進 SharedState/export。
- **Decision**:tracer lifetime fade 採「render-time 縮尾」而非 per-instance alpha。Alternatives considered:per-instance opacity 需要 shader/custom instance alpha 或材質拆分,會提高 render 複雜度並危及單 draw call;縮尾保留 `InstancedMesh` 單 draw call 與零配置紀律,足以滿足 FR-E7 視覺衰減。
- **Surprises & discoveries**:Three.js 對完全零縮放 instance matrix 做 `decompose` 時測試側可讀回非零 scale;expired tracer 改用 `1e-9` 極小 scale 隱藏。Evidence:`src/render/TracerView.test.ts` 的 lifetime/expired test 通過。
- **Verification**:
  - `npx.cmd vitest run src/state/SharedState.test.ts src/loop/SimLoop.test.ts src/render/TracerView.test.ts src/ui/Controls.test.ts` exit 0:4 files / **46 tests** 全綠。
  - `npm.cmd run typecheck` exit 0:`tsc --noEmit` clean。
  - 既有開火/決定性回歸:`npx.cmd vitest run src/loop/__tests__/fire-determinism.test.ts src/loop/__tests__/recoil-wiring.test.ts src/loop/__tests__/ballistic-compose.test.ts src/loop/__tests__/determinism.test.ts src/loop/SimLoop.test.ts tests/regression/determinism.test.ts tests/regression/spray-determinism.test.ts tests/regression/moving-target-determinism.test.ts tests/regression/longrange-tracking-determinism.test.ts src/sim/HitDetector.test.ts src/sim/firstShot.test.ts src/data/DataRecorder.test.ts src/data/export.test.ts` exit 0:13 files / **144 tests** 全綠。
  - `npm.cmd test` exit 0:Vitest **70 files / 570 tests** 全綠。
  - `npm.cmd run build` sandboxed run blocked by Vite/esbuild parent-directory access denial;unsandboxed rerun exit 0:`tsc --noEmit && vite build` clean,only existing chunk-size warning。
  - `npm.cmd run test:e2e` sandboxed run blocked by Vite dev server parent-directory access denial;unsandboxed rerun exit 0:Playwright **16 tests** 全綠。
  - `graphify update .` exit 0:AST re-extract **153/153 files**,graphify-out rebuilt;`codegraph_status` after edits:156 indexed files / 2188 nodes / 3165 edges。
- **Manual smoke note**:連發/漸隱/開關即時性以 `TracerView` render tests + Controls test + Playwright browser smoke 覆蓋;未做人工視覺檢視。
- **Open questions**:T1 無新增 open question。OQ-25.2/OQ-25.3 仍留 T3/T2。

### 2026-07-13 — T0 entry gate PASS

- **Baseline verification**:`npm.cmd run test:ci` exit 0(unsandboxed rerun;PowerShell `npm.ps1` execution policy 擋住 `npm run`,sandboxed `npm.cmd run test:ci` 又被 Vite/esbuild parent-directory access denial 擋,故同 WP-23 慣例核准後重跑)。結果:`tsc --noEmit` clean;Vitest **68 files / 556 tests** 全綠;Playwright **16 tests** 全綠。
- **GD-17 projectile 參數域決議**(入 [DECISIONS.md](../../../DECISIONS.md)):飛行時間以 tick 數設計,距離採 WP-23 OQ-S5-4 已拍板檔位聯動。公式:`speedU = distanceU * 128 / flightTicks`;`gravityU = 2 * (dropRatio * targetHeightU) / flightSec^2`;`maxRangeU = distanceU * 1.25`。具體表:
  - canonical 0.5° longrange(`distanceU=114.59`,target height=1u):8 ticks flat → `{ speedU:1833.45, gravityU:51.20, maxRangeU:143.24 }`;16 ticks standard → `{ speedU:916.73, gravityU:32.00, maxRangeU:143.24 }`;32 ticks heavy → `{ speedU:458.36, gravityU:16.00, maxRangeU:143.24 }`。
  - 2° sanity(`distanceU=28.65`,target height=1u):8 ticks → `{ speedU:458.37, gravityU:51.20, maxRangeU:35.81 }`;16 ticks → `{ speedU:229.18, gravityU:32.00, maxRangeU:35.81 }`;32 ticks → `{ speedU:114.59, gravityU:16.00, maxRangeU:35.81 }`。
  - 下墜比:8 ticks = 0.10H,16 ticks = 0.25H,32 ticks = 0.50H。config 驗證規則:T3 對到靶飛行時間 `< 2 ticks` 的組合發 warning(退化 hitscan);M12 前 `bullet` 欄不得進任何 drill config。
- **OQ-25.1 未命中 tracer 端點**:hitscan 沿用 `projectMissOntoEngagementPlane` 既有交戰平面投影;projectile 用消滅點(`maxRangeU` 或後續 spec 定義的失活點)。tracer 不進 export/event schema。
- **Current fire spawn seam baseline**(CodeGraph source read):
  - `simStep` 順序:`drillRunner.tick/targetManager.tick` 更新目標與 `recordVisibleEvents` → 偶數 tick `recoilTick(1/64)` decay → `consume` 前/事件前後/tick end 呼叫 `scheduleFire` → movement → `recordTickFromState`。
  - `scheduleFire` 只在 `heldFire && ammo > 0 && nextFireT <= untilMs` 時呼叫 `fireOneShot`,每發扣 ammo 並把 `nextFireT += weapon.cycletimeSec * 1000`;空匣會清 `heldFire`。
  - `fireOneShot` 產彈順序固定為:**firstShotGate/currentPeekId 先取** → velocity gate 讀 fire 當下 `vx` → `sampleSpread(state.recoilState, weapon, speedRatio, seeded rng)` 寫 `state.recoil.lastSpread` → `ballisticRaycast(camera,state,subAlpha)` → `hit = accurate && result.hit` → 非 persistent target 命中才 `targetManager.markKilled` → `pushImpact(state.impacts, ballisticHitPoint)`(命中/脫靶皆可視化) → `recorder.recordEvent({ type:'fire', ... })` → `recoilOnFire`。因此本發沿 kick 前朝向出膛,kick 只影響後續發與視覺 punch。
  - 方向合成:`ballisticRaycast` 用 `state.aim.yaw/pitch + aimPunch*2` 建 forward/right/up,再疊 `lastSpread.x/y` 正規化;hit test 走 `raycastWithRay(..., subAlpha)`。miss 時 `projectMissOntoEngagementPlane(state)` 回填 `ballisticHitPoint`。
- **Hit handling / recording baseline**:
  - `markKilled` 掛點只在 `hit && result.targetId` 且 target 非 `persistent:true` 時執行;tracking/timed presentation target 命中不撤除。
  - 現行 `DataRecorder.recordEvent` 只有 `type:'fire'` 會增加 `fireCount`;`event.hit` 為 true 時同步增加 `hitCount`。T3 要新增 `type:'hit'` 時不得重解釋既有 fire row;`firstShot` 仍錨 shot/fire。
  - `pushImpact` 寫 `ImpactRing` typed arrays `x/y/z/seq`,`total` 單調遞增,`cursor` 環狀覆寫;熱路徑零配置。
- **ImpactRing / ImpactView pattern for T1 tracer**:
  - `createImpactRing` 預配置 `Float64Array(IMPACT_CAP)` for `x/y/z/seq` + `total/cursor`;`seq=0` 是空槽哨兵。
  - `ImpactView.sync(impacts)` render-only 讀 ring;以 `#syncedSeq` 高水位只同步新槽,`InstancedMesh(IMPACT_CAP)` 單 draw call,`Object3D` scratch 重用,無新彈著早退。T1 `ShotRayRing` / `TracerView` 應複製此 ring + seq 高水位 pattern,但欄位改成 origin/end。
- **T3 hitscan zero-break test list**:
  `src/loop/__tests__/fire-determinism.test.ts`;`src/loop/__tests__/recoil-wiring.test.ts`;`src/loop/__tests__/ballistic-compose.test.ts`;`src/loop/__tests__/determinism.test.ts`;`src/loop/SimLoop.test.ts`;`tests/regression/determinism.test.ts`;`tests/regression/spray-determinism.test.ts`;`tests/regression/moving-target-determinism.test.ts`;`tests/regression/longrange-tracking-determinism.test.ts`;`src/sim/HitDetector.test.ts`;`src/sim/firstShot.test.ts`;`src/data/DataRecorder.test.ts`;`src/data/export.test.ts`;`tests/e2e/full-drill.spec.ts`。
- **CLAUDE.md §4**:追加彈道 config-gated / hitscan 預設逐位不變、projectile 固定步長純函式、子彈永不測場景、tracer render-only 的硬約束。
- **Entry gate**:PASS。T1 可開;T2 開工前仍需複驗 **M11 ✅**(目前 WP-23 / M11 已 PASS)。本切片無 `src/` 變更。

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-6(子彈永不測場景幾何——與「純裝飾場景」本體論一致)、
  WP-10→WP-13 模式(先鎖數學 golden 再接線)、WP-11 產彈點 seam(recoil `onFire` 唯一掛點,
  tracer 寫入與 projectile spawn 掛同一點)、2026-07-10 架構評估
  (`ballisticRaycast(camera, state, subAlpha?)` @ SimLoop.ts:109、`projectMissOntoEngagementPlane` @ :152、
  ImpactRing/ImpactView pattern 為 tracer 顯示的複製模板)。
- 設計要點:**tracer 與 projectile 嚴格分離**(T1 render-only 可先交付);
  **hitscan 預設逐位不變**是 M12 門控核心——這就是使用者要的 Bullet Type
  Enabled/Disabled 開關,同時保護 stage1–3 全部 golden 資產。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-17 拍板,docs-only;
  T1 可與 WP-23/24 並行。(2026-07-13:T0 已 PASS;下一步為 T1 tracer。)
