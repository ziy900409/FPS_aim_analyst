# WP-13 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ WP-13 完成(M6 automated-green 2026-07-06;4 項手動視覺/手感驗證待使用者於瀏覽器確認)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-06 |
| T1 simStep 佈線 | ✅ 2026-07-06 |
| T2 相機/彈道合成 | ✅ 2026-07-06 |
| T3 彈孔 + overlay | ✅ 2026-07-06 |
| T-exit(M6) | ✅ 2026-07-06(automated;手動視覺 4 項 pending) |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-4 `view_recoil_tracking` CS2 值(僅視覺;先做開關 + 可調常數,預設關) | ⬜ open(不阻塞) | — |
| OQ-13.1 spread RNG 的 `DEFAULT_RNG_SEED` 值與 drill seed 分流(drill.sequence.seed 兼用 or 獨立欄) | ✅ 定案(T1) | **drill.sequence.seed 兼用**:`createSimLoop` 新增 `seed = DEFAULT_RNG_SEED` 參數,rng = `createRan1(seed)` 於閉包持有;drill restart 走**重建 loop** 重置 stream。`DEFAULT_RNG_SEED = 1`(定於 [SimLoop.ts](../../../../../src/loop/SimLoop.ts))。**T1 未改 main.ts**(不在 Touches):seed 由 `drill.sequence.seed` 注入的佈線 + 每 run 記錄入 meta 交 T2/WP-16。無需新增 DrillConfig 欄。 |
| OQ-13.2 (新) 整合 golden 容差:雙率離散化使 sim 無法位元重現 WP-10 golden(單一 64Hz 時鐘) | 🟡 已緩解(T1/T2) | 容差 0.01→**0.02°**(recoil-wiring 相位)→ harness burst 相位殘差 **0.063°**(即「奇數 tick 衰減」量級,T1 Surprises 已載),故 harness/E2E 級容差 **0.1°**。殘差為設計固有;fidelity 交 WP-15 校準評估。 |
| OQ-13.3 (新,T-exit code review) `ImpactView.#syncedSeq` 於 drill restart 不重置 | 🟢 Optional(不阻塞) | countdown(~384 tick)保證重置後首個 render frame 以 `total=0` sync 先歸零 `#syncedSeq`,實務不可達;robustness 建議加 `ImpactView.reset()` 於 `restartActiveDrill`/`loadDrillById` 呼叫(交後續)。 |

---

## Log

### 2026-07-06 — T-exit PASS(M6 宣告:automated-green;手動視覺/手感 4 項待使用者確認)

**閘門結論:`test:ci` 全綠(含首次於本機跑通的 Playwright E2E golden)→ M6 於兩層索引標記 ✅。
DoD 的手動壓槍驗證 4 項屬瀏覽器內視覺/手感確認,非自動化可自證,記為 pending(使用者選項「Flip M6 ✅, manual pending」)。**

**1. `test:ci` 三段全綠(證據):**

| 段 | 指令 | 結果 |
|---|---|---|
| typecheck | `npm run typecheck`(`tsc --noEmit`) | ✅ exit 0 |
| unit/整合 | `npm run test`(`vitest run`) | ✅ **38 files / 288 tests passed**,3.13s |
| E2E | `npx playwright test`(Edge, COOP/COEP) | ✅ **9 passed**,22.0s |

- **E2E 首次於本機跑通**(T2/T3 progress 記為未跑):`full-drill.spec.ts` 兩測皆綠——
  ① WP-9 全鏈路(COI + schema/事件/metadata + 統計=匯出);② **WP-13 recoil 分離 held-10**。
- `isolation.spec.ts` dev + preview 兩 server `crossOriginIsolated===true`(WP-9 三計時效度防線不退化)。

**2. E2E 斷言清單確認(T-exit Step 2)——`full-drill.spec.ts` recoil-separation 測實際斷言:**
- `shotsFired=10`、`recoilIndex=10`;
- `aimPunchPitchDeg < 0` 且 `aimPunchYawDeg < 0`(Source deg:pitch 下正→上跳、yaw 左正→右漂,**上+右**);
- `rawPunchPitchDeg = aimPunchPitchDeg × 2`(`toBeCloseTo(...,9)`,**×2 視覺/彈道分離量化**);
- `|rawPunchPitchDeg − (−10.18)| ≤ 0.1` 且 `|rawPunchYawDeg − (−1.56)| ≤ 0.1`(**M5 golden 容差 0.1°**,OQ-13.2 雙率離散化殘差)。
- COI 斷言於 full-drill(`m.crossOriginIsolated===true` + `window.crossOriginIsolated`)與 isolation 兩處維持。

**3. 決定性回歸(T-exit Step 4)全綠:** `determinism.test.ts`(9)+ `tests/regression/determinism.test.ts`(15)
+ `fire-determinism.test.ts`(17)——WP-2 位置維度 + WP-11 fire 維度逐發 bit-exact,零回歸。

**4. Code review(五軸,`/code-review-and-quality`):** T1–T3 通過。
- **Correctness/Architecture**:recoil 佈線序 decay→kick 契約正確;視覺(aimPunch×1)/彈道(state.aim + rawPunch×2 + spread)
  真分離、`aimSink` 不含 punch 避免雙重計入;`adapter.punchToThreeRad` 為唯一 deg→rad + pitch 翻號點(A6);
  impact ring `seq`/`total` 同一單調計數器,`ImpactView.sync` 增量偵測自洽;彈孔單一 `InstancedMesh`(結構上 1 draw call)。
- **GC 紀律**:模組層級 scratch、`HitPointOut` out-param、typed-array ring,開火熱路徑零配置。
- **Optional 一項(非阻塞,已記 Open Questions)**:`ImpactView.#syncedSeq` 於 drill restart 不重置——
  countdown(~384 tick)保證重置後首個 render frame 先以 `total=0` sync 歸零 `#syncedSeq`,故實務不可達;
  robustness 建議加 `ImpactView.reset()` 於 restart 呼叫。

**5. 手動壓槍驗證 4 項(T-exit Step 3)—— ⬜ PENDING(需使用者於 dev server 瀏覽器內確認):**
   非自動化可自證(視覺/手感);使用者選「Flip M6 ✅, manual pending」。待確認清單(`npm run dev`,鎖定後 AK 按住 30 發):
   - ⬜ ① 鏡頭上跳可見、放開後回落;
   - ⬜ ② 彈孔分布 = 直升→之字 pattern 形狀;
   - ⬜ ③ 壓槍下拉可將彈著拉回目標(視覺≠彈道分離手感);
   - ⬜ ④ 右下 overlay `punch p/y`、`inacc`、`ammo` 數值與畫面一致;
   - ⬜(佐證)`renderer.info.render.drawcalls` 彈孔部分 = 1(結構上單一 InstancedMesh 已保證)。
   證據(截圖/錄影路徑)由使用者補記於此。

**M6 標記:** [../README.md](../README.md)(stage2 §WP 表 + M6 里程碑)、[exec-plan/README.md](../../../README.md)
WP-13 + M6 皆翻 ✅ 2026-07-06(automated)。

**Next:** M6 過 → WP-15(校準)/WP-16(指標匯出 schema v2)可展開;WP-14(movement 物理)未完不阻塞此門
(velocity gate 耦合屬 WP-14 T2)。使用者完成手動 4 項後可把上方 ⬜ 翻 ✅ 收尾。

### 2026-07-06 — T3 PASS(彈孔 InstancedMesh 環狀覆寫 + dev-only punch/inaccuracy/ammo overlay)

**DoD 達成:彈孔單 InstancedMesh(1 draw call 前提)、impacts 熱路徑零配置(並行陣列)、overlay 僅 dev、全 suite 綠。**

**Progress(切片,增量驗證後單一原子 commit):**
- **Slice 1** [HitDetector.ts](../../../../../src/sim/HitDetector.ts):`raycastWithRay` 加**選填** `hitPointOut?: HitPointOut`
  ——命中時就地寫最近命中 world 座標(`valid=true`)、未命中 `valid=false`。**刻意不改 `RaycastResult` 形狀**
  (既有 `toEqual({hit,targetId,part})` 等值測試零回歸);呼叫端持一份重用實例(GC 紀律)。命中點以 local scalar
  暫存最近者,不每目標配置 Vector。HitDetector.test +4(近面座標、miss valid=false、多目標取最近、無 out 行為不變)。
- **Slice 2** [SharedState.ts](../../../../../src/state/SharedState.ts):`IMPACT_CAP=64` + `ImpactRing`(x/y/z/seq
  並行 `Float64Array` + `total`/`cursor`)、`createImpactRing`/`resetImpactRing`/`pushImpact`(比照 recoil 模組
  create/reset/mutator 風格)。`pushImpact` 環狀覆寫最舊、seq 單調(1 起,0=空槽哨兵);`resetState` 原地清
  (`seq.fill(0)`,typed-array 不 realloc)。SharedState.test:reset 擴充涵蓋 impacts 重用參考 + ImpactRing describe 4 tests。
- **Slice 3** [ImpactView.ts](../../../../../src/render/ImpactView.ts)(NEW):單一 `InstancedMesh(IMPACT_CAP)`
  → **一個 draw call**;`PlaneGeometry(0.06)` + `MeshBasicMaterial`;`frustumCulled=false`。**seq 增量同步**——
  只重寫 `seq > #syncedSeq` 的槽(環狀覆寫最舊亦被涵蓋,舊槽獲更大 seq);`total` 未變即早退;`Object3D`
  scratch 重用(GC 紀律)。比照 [TargetView](../../../../../src/render/TargetView.ts) 唯讀紀律。ImpactView.test 6 tests
  (單 mesh、位置取自座標、無新彈著早退、增量累進、cap 溢位封頂+覆寫最舊、dispose)。
- **Slice 4** [SimLoop.ts](../../../../../src/loop/SimLoop.ts) + [main.ts](../../../../../src/main.ts):
  SimLoop 模組層級重用 `ballisticHitPoint`,`ballisticRaycast` 透傳給 `raycastWithRay`;`fireOneShot` 命中且
  `valid` 時 `pushImpact(state.impacts, ...)`(彈著點 = 彈道實際命中,故彈孔落在「視覺≠彈道」的**實際**著點)。
  main.ts 掛 `ImpactView`(render loop `impactView.sync` 於 targetView.sync 後)、加 dev-only recoil overlay
  (右下,`punch p/y`(視覺 aimPunch deg)、`inacc`(inaccuracyFire)、`ammo`);皆 `import.meta.env.DEV` 剝除。
  HitDetector.test simStep 整合 +2(命中→impacts 寫近面座標;miss→impacts 空)。

**驗證證據:** `npm run typecheck` exit 0;`npm run build`(tsc + vite)綠——48 modules,overlay 由 `import.meta.env.DEV`
剝除(production 無 overlay);`npm run test` → **38 files / 288 tests passed**(前 272 + T3 16:HitDetector +6、
SharedState ImpactRing +4、ImpactView +6)。零回歸。

**Decision Log:**
- **命中點走 `HitPointOut` 呼叫端重用欄位、不加進 `RaycastResult`**:既有 HitDetector.test 多處 `toEqual({hit,
  targetId,part})` 精確等值;若把 hitX/Y/Z 塞進 result 物件會全面破測。out-param 同時滿足「呼叫端重用欄位」
  (T3 spec 原文)+ 零配置 + 零回歸。Alternatives:擴 RaycastResult 並改所有等值測試(否決:破壞面大、
  且每 fire 多配置三數);回傳 Vector3(否決:配置 + 違 GC 紀律)。
- **彈孔落在彈道實際命中點(非準心/視覺點)**:`pushImpact` 用 `ballisticRaycast` 的命中座標——即 viewAngles
  + rawPunch×2 + spread 的實際著點。故彈孔正是「視覺≠彈道」的**實際**證據(overlay + 彈孔雙證消解 QA 誤判)。
- **ImpactView 用 total 早退 + seq 判新槽**:`total` 為單調寫入數,render 端比對即知有無新彈著(O(1) 早退);
  有新彈著才掃 CAP 槽、只更新 seq 大於高水位者。full-rebuild 亦可(CAP≤64),但 seq 增量更貼 T3 spec「依 seq
  增量同步」且天然處理環狀覆寫(舊槽新 seq → 被更新)。
- **PlaneGeometry 面朝 +Z(預設)不旋轉**:玩家於 +Z 朝 −Z、目標前面法向 +Z,故彈孔面片預設朝向即面向玩家;
  階段 A 僅目標命中(牆面求交列 stretch,未實作),故不需依命中面法向定向(記 Open Question 交後續)。

**Surprises & Discoveries:**
- **既有 HitDetector 等值測試是 out-param 設計的硬約束**:`raycastWithRay` 回傳物件被 6 處 `toEqual` 精確斷言,
  這直接否決了「把命中點加進 RaycastResult」的直覺作法,反而印證 T3 spec「寫入呼叫端重用欄位」的措辭正確。

**Open Questions:** OQ-S2-4(view_recoil_tracking,不阻塞);(新,不阻塞)牆面/地板彈孔 + 依命中面法向定向彈片
——階段 A 僅目標命中、彈片恆朝 +Z 足用,牆面求交與定向為 stretch,交 T-exit 後視需要開。

**Next:** T-exit([T-exit-gate.md](T-exit-gate.md),M6 門)——真瀏覽器 E2E golden + 手動壓槍驗證
(壓 30 發彈孔沿 pattern 分布、`renderer.info.render.drawcalls` 佐證彈孔 1 draw call、視覺/彈道分離手感)。

### 2026-07-06 — T2 PASS(視覺/彈道分離:adapter 單點轉換 + rawPunch×2+spread 彈道 + setViewPunch 每幀 compose)

**DoD 達成:分離生效(miss/hit 補償測試綠)、punch 向量 + 方向斷言綠、punch 轉換收斂單點。**

**Progress(切片,增量驗證後單一原子 commit):**
- **Slice 1** [adapter.ts](../../../../../src/recoil/adapter.ts)(NEW,稽核 A6 單點):`punchToThreeRad(pitchDeg,yawDeg)`
  ——pitch 翻號(Source 下正 → three 上正)、yaw 同號(皆左正);檔頭慣例對照表。純 scalar 不倚賴 THREE
  (`RAD_PER_DEG=Math.PI/180`)。[adapter.test.ts](../../../../../src/recoil/adapter.test.ts) 6 tests(±向量對照)。
- **Slice 2** [CameraController.ts](../../../../../src/view/CameraController.ts):`setViewPunch(yawRad,pitchRad)`
  存 punch,`#applyToCamera` 改組 `q(yaw+punchYaw)·q(pitch+punchPitch)`;**punch 不受 pitch 夾角限制**
  (夾角只約束使用者視角)、**不寫回 aimSink**(state.aim = 使用者視角,彈道另加 rawPunch 避免雙重計入)。
  test +3(compose = 手組 quaternion、punch 推有效 pitch 過夾角上限、punch 不污染 aimSink)。
- **Slice 3** [SimLoop.ts](../../../../../src/loop/SimLoop.ts):`ballisticRaycast`——彈道 = `state.aim`
  + rawPunch(=aimPunch×2, adapter 轉 rad)+ `recoil.lastSpread`(`forward + x·right + y·up` 正規化)
  → `raycastWithRay(cameraWorldPos, dir)` 取代 `raycastFromCenter`。**產彈點次序重排**:sampleSpread(暫存)
  → **彈道 raycast**(用 kick 前 aimPunch) → recoilOnFire(施 kick)——本發沿 kick 前朝向出膛(對齊 CS2)。
  新測 [ballistic-compose.test.ts](../../../../../src/loop/__tests__/ballistic-compose.test.ts) 4 tests
  (punch=0 命中退化、punch≠0 原視角脫靶、補償 −rawPunch 命中、**只補償 ×1 仍脫靶 → 證彈道用 ×2**)。
- **Slice 4** [main.ts](../../../../../src/main.ts):render loop `lerp(recoil.prev,curr,alpha)` × `VIEW_RECOIL_TRACKING`
  (OQ-S2-4,可調 1.0)→ adapter → `setViewPunch` 每幀重組(滑鼠靜止時 punch 衰減仍可見);`createSimLoop`
  seed 佈線 `drill.sequence.seed`(OQ-13.1);simLoop 改 `let` + `buildSimLoop()`,restart / 換 drill **重建
  loop 重置 rng stream + tickIndex**(決定性)。
- **Slice 5** [fpsTestHarness.ts](../../../../../src/testharness/fpsTestHarness.ts):彈道改走 state.aim 後,`aimAtActiveTarget`
  改寫 `state.aim = 目標方向 − rawPunch`(補償瞄準);`runCounterStrafeRound` 改 **tap-fire**(每 peek 放開扳機
  → recoil 不跨 peek 累積、亦符 counter-strafe 單點射擊);新增 `fireRecoilBurst(shots)` / `getRecoilReadout()`
  供分離漂移讀數。[full-drill.spec.ts](../../../../../tests/e2e/full-drill.spec.ts) 新增 held-10 漂移 E2E;
  新 node 整合測 [fpsTestHarness.test.ts](../../../../../src/testharness/fpsTestHarness.test.ts) 3 tests
  (①tap-fire 一輪 → ended + 20/20 首發命中 + fireCount=20;②held-10 → rawPunch=M5 向量、上+右;③決定性)。

**驗證證據:** `npm run typecheck` exit 0;`npm run test` → **37 files / 272 tests passed**(前 256 + T2 16:adapter 6
+ CameraController 3 + ballistic-compose 4 + harness 3)。零回歸(既有 250+T1 全綠)。E2E(Playwright)因需真
瀏覽器 + dev server **未於本機跑**;等價邏輯已由 node harness 整合測涵蓋(20/20 命中 = full-drill firstShotHitRate,
held-10 = 分離漂移),真 COI / 真 metadata 仍待 `npm run test:e2e` 於瀏覽器綠燈(T-exit M6 門)。

**Decision Log:**
- **彈道走 `state.aim`(使用者視角)而非 camera 朝向**:camera 已含視覺 punch(setViewPunch),彈道須用
  viewAngles + rawPunch×2 才實現「視覺 ≠ 實際」;aimSink 只記使用者視角(不含 punch),避免雙重計入。
  Alternatives:讀 camera.getWorldDirection(否決:含視覺 punch×1,彈道會少 ×1 且方向錯)。
- **產彈點次序 sampleSpread → raycast → recoilOnFire**:本發沿 kick 前朝向 + kick 前 inaccuracy 出膛(CS2);
  T1 的 spread 暫存/rng 序列位置不變(raycast 不消費 rng、不改 recoilState),T1 六測零改動。
- **harness 補償瞄準 + tap-fire**:分離後 held 連發 recoilIndex climbs → 彈道大幅上跳右漂 → 首發脫靶會誤破
  full-drill 20/20。補償(state.aim = 目標 − rawPunch,模擬壓槍)+ tap-fire(recoil 不跨 peek 累積)雙保命中,
  且 tap-fire 更貼合 counter-strafe 單點射擊。Alternatives:改寫 full-drill 斷言為容許脫靶(否決:跨 WP 動
  WP-9 exit-gate 語意);harness 內 reset recoilState 每 peek(否決:較 hack,tap-fire 為真實行為)。
- **VIEW_RECOIL_TRACKING 常數(main.ts,預設 1.0)**:OQ-S2-4「開關 + 可調常數」;1.0=全量視覺後座,調小/0
  弱化/關閉視覺跟隨。精確 CS2 `view_recoil_tracking` 值待 WP-15 校準(open,不阻塞)。
- **DoD grep(`git grep degToRad src/loop src/view src/sim` 僅 adapter)**:字面不可滿足——adapter 落 `src/recoil`
  (非該三目錄)且以 `Math.PI/180` 非 `degToRad`;而 CameraController 既有 `RAD_PER_COUNT=degToRad(0.022)` 為
  **感度**換算(非 punch)。契約**實質**達成:punch deg→rad + pitch 翻號**只**在 `adapter.punchToThreeRad`,
  sim/view/彈道路徑無任何 ad-hoc punch 轉換(SimLoop 唯一呼叫點消費該函式,不自轉)。

**Surprises & Discoveries:**
- **harness burst 相位殘差 0.063°(> T1 recoil-wiring 的 0.0141°)。** 同為雙率離散化相位差(OQ-13.2),但
  burst 的產彈 tick parity 與 recoil-wiring golden 不同相位(harness 先跑 countdown 384 ticks 才連發),末發落
  在使殘差達「奇數 tick 衰減」量級(0.063,T1 Surprises 已枚舉)。非 bug(表/seed/kick 同源);故 harness/E2E
  級容差採 **0.1°**(目標 1%,仍遠緊於任何真實接線錯誤 >>1°)。unit 級 recoil-wiring 維持 0.02°。

**Open Questions:** OQ-S2-4(view_recoil_tracking 精確值,不阻塞,已做開關+常數)、OQ-13.2(容差/fidelity,交 WP-15)。

**Next:** T3([T3-bullet-holes-debug.md](T3-bullet-holes-debug.md),Low)——InstancedMesh 彈孔(環狀覆寫上限)
+ dev-only debug overlay(punch readout + 彈著可視化);彈道命中點來源即本 task 的 `ballisticRaycast`。

### 2026-07-06 — T1 PASS(recoil 進 simStep:64Hz 子節奏 + onFire/spread 掛線)

**接線正確性判準達成:sim 內 held 10 發 AK 重現 M5 向量;決定性 + 順序 + 回歸全綠。**

**Progress(切片):**
- **Slice A** [SharedState.ts](../../../../../src/state/SharedState.ts) + [types 註解]:新增 `recoilState: RecoilState`
  (sim 專屬,`resetState` 呼叫 `resetRecoilState` 原地歸零)+ `recoil: { prev, curr, lastSpread }`
  視覺內插快照(比照 position prev/curr)。[SharedState.test.ts](../../../../../src/state/SharedState.test.ts)
  reset 測試擴充涵蓋新欄 + 物件重用(GC 紀律)。
- **Slice B** [SimLoop.ts](../../../../../src/loop/SimLoop.ts):`simStep` 新增 `tickIndex`/`recoilRuntime`
  參數;順序 ①prev←curr(含 recoil 快照)②targets ③**偶數 tick recoilTick(1/64)** ④consume→產彈
  (`fireOneShot` 內先 `sampleSpread` 再 `recoilOnFire`)⑤movement ⑥curr←aimPunch ⑦record。
  `createSimLoop` 新增 `seed` 參數,建 `recoilRuntime = { table: generateRecoilTable(weapon.recoil),
  rng: createRan1(seed) }` + `tickIndex` 計數器。`recoilTick` **僅一處呼叫、帶常數 1/64**。
- 新測 [recoil-wiring.test.ts](../../../../../src/loop/__tests__/recoil-wiring.test.ts) 6 tests:順序
  (decay→kick forward = 手算、≠ reversed)、奇數 tick 不 decay、spread 暫存、整合 golden、決定性 ×2。

**驗證證據:** `npm run typecheck` exit 0;`npm run test` → **34 files / 256 tests passed**(前 250 + T1 6;
SharedState reset 測試就地擴充)。回歸零破壞(recoil 只寫新欄 + 消費 rng,不動 position/fire 排程/命中)。

**Decision Log:**
- **產彈點次序 = decay → sampleSpread → recoilOnFire**(對齊 CS2:spread 用本發 kick 前 inaccuracy)。
  Alternatives:kick 先於 spread(否決:CS2 首發 spread 不含本發 fire inaccuracy);spread 移 T2 取樣
  (否決:破壞 rng 序列位置決定性——序列消費必須在 sim 產彈點,T2 只消費暫存值)。
- **recoil 接線可選(`recoilRuntime` 省略即不接)**:`simStep` 直呼路徑(WP-2 決定性/單元測試)向後相容,
  punch 恆零、既有 250 測試零改動。Alternatives:無條件接(否決:直呼測試未帶 tickIndex/table,且
  `recoilTick` 對非 128Hz 節奏會誤觸)。
- **整合 golden 容差 0.01→0.02°**:見 Surprises;殘差為設計固有,0.02° = 目標 0.2%,仍攔得住真實接線錯誤。
- **OQ-13.1 定案**:`createSimLoop(seed = DEFAULT_RNG_SEED=1)`,drill.sequence.seed 兼用(見 ledger)。

**Surprises & Discoveries:**
- **雙率離散化相位差:sim 無法位元重現 WP-10 golden。** WP-10 golden([punch.test.ts](../../../../../src/recoil/punch.test.ts)
  `simulateAk47TenShot`)以**單一 64Hz 時鐘**跑,產彈於 elapsed 跨越 `k·cycletime` 的**衰減格點**
  (fire times 對齊 64Hz grid,末發 @0.90625s、58 decays)。而 sim 為 **128Hz 產彈排程 + 64Hz(偶數
  tick)衰減**:第 10 發落在**奇數** tick 115(fire tick 序列 0,12,25,38,51,63,76,89,102,115;
  parity E,E,O,E,O,O,E,O,E,O)——奇數 tick 無衰減,末發較 golden 少一次跨越衰減。實測 `rawPunchPitch
  = -10.194`(diff **0.0141°**)、`rawPunchYaw = -1.564`(diff 0.0039°)、recoilIndex=10。
  - **證明非 bug**:表 seed 223、kick 尺度、weapon 參數均與 golden 同源;殘差純為產彈排程離散化差異。
  - **排除的替代**:①奇數 tick 衰減 → **更差**(pitch diff 0.063、yaw 0.045);②末發後多跑 1 衰減 tick
    → 大幅偏離(-10.64)。偶數 tick + 末發即取樣為最接近解。
  - **硬約束鎖死**:GD-5 要求 recoil 衰減恆 1/64 步長(不得代入變動 dt),WP-11 固定產彈排程——兩者皆
    不可改,故相位差為設計固有,非可調參數。→ 容差 0.02°、記 OQ-13.2 交 WP-15 評估是否需更緊 fidelity。

**Open Questions:** OQ-S2-4(view_recoil_tracking,不阻塞)、OQ-13.2(容差/fidelity,已緩解,交 WP-15)。

**Next:** T2([T2-camera-ballistic-compose.md](T2-camera-ballistic-compose.md),High)——adapter 單點 deg→rad
+ pitch 符號翻轉、彈道方向注入(rawPunch=aimPunch×2 + `recoil.lastSpread`)、`setViewPunch` 每幀 compose;
含 main.ts seed 佈線(`drill.sequence.seed`)。

### 2026-07-06 — T0 entry gate PASS(三上游收斂驗證,docs-only)

**閘門結論:三上游全綠,無 blocker → 開放 T1。** `git diff --stat` 本 commit 不含 `src/`(僅本資料夾 docs)。

**1. 三上游 checklist 全 ✅ + exit-gate 證據連結:**

| 上游 | checklist | exit-gate 證據(該 WP progress) |
|---|---|---|
| **WP-10 M5** | [task-checklist.md](../wp-10-recoil-core/task-checklist.md) T0–T4 + T-exit 全 ✅ | **M5 golden 全綠 2026-07-05**:`vitest run` 30 files/208 tests(exit 0)、`src/recoil` 4 files/23 tests、typecheck pass、`Math.random` 於 `src/recoil` grep=0、`recoilTick` 呼叫點 dtSec 恆 1/64、兩份 golden fixture 在 repo。見 [wp-10 progress §Outcomes](../wp-10-recoil-core/progress.md)。 |
| **WP-11 exit** | [task-checklist.md](../wp-11-weapon-fire/task-checklist.md) T0–T3 + T-exit 全 ✅ | **連發決定性 2026-07-06**:[fire-determinism.test.ts](../../../../../src/loop/__tests__/fire-determinism.test.ts) 17 tests——60/144/240 FPS + 抖動序列下逐發 `{tick index, 排程時刻}` bit-exact;三把武器各驗;彈匣盡即停;無 `Date.now`/`Math.random` 洩漏。見 [wp-11 progress §T-exit](../wp-11-weapon-fire/progress.md)。 |
| **WP-12 exit** | [task-checklist.md](../wp-12-input-seams/task-checklist.md) T0/T1/T2 + T-exit 全 ✅ | **回歸全綠 2026-07-06**:typecheck exit 0、`vitest run` 33 files/250 tests(含 `HitDetector.test.ts` 13——raycastWithRay 等價測試、`CameraController.test.ts` 2——CS2 感度換算)。見 [wp-12 progress §T-exit](../wp-12-input-seams/progress.md)。 |

**2. 乾淨基準(接線前):** 本 branch(`wp-13-t0-entry-gate`,base=main d162f42)實跑 `npm run test` → **33 files / 250 tests passed(exit 0)**,3.07s。與 WP-12 exit 狀態一致,無回歸。

**3. 符號抽查(`codegraph_search`,全數存在且形狀正確):**

| 符號 | 位置 | signature |
|---|---|---|
| `recoilTick` | [punch.ts:67](../../../../../src/recoil/punch.ts) | `(s: RecoilState, dtSec: number): void` |
| `recoilOnFire` | [punch.ts:97](../../../../../src/recoil/punch.ts) | `(s, w: WeaponRecoilLike, table): void` |
| `sampleSpread` | [spread.ts:19](../../../../../src/recoil/spread.ts) | `(s, w, speedRatio, rng: Rng): SpreadSample` |
| `createRan1` | [rng.ts:13](../../../../../src/recoil/rng.ts) | `(seed: number): Rng` |
| `fireOneShot` | [SimLoop.ts:58](../../../../../src/loop/SimLoop.ts) | `(state, t, camera?, targetManager?, recorder?): void` |
| `SharedState.weapon` | [SharedState.ts:41](../../../../../src/state/SharedState.ts) | `{ nextFireT: number; ammo: number; magSize: number }` |
| `raycastWithRay` | [HitDetector.ts:45](../../../../../src/sim/HitDetector.ts) | `(origin: Vector3, dirNormalized: Vector3, targets): RaycastResult` |

**4. OQ-13.1 傾向已記 ledger**(drill.sequence.seed 兼用;`sequence.seed?: number` 已於 [DrillConfig.ts:29](../../../../../src/drill/DrillConfig.ts) 存在待消費,T1 定案)。

**Next:** T1([T1-simstep-recoil-wiring.md](T1-simstep-recoil-wiring.md),High risk)——tickIndex + 64Hz 子節奏 + onFire/spread 掛線 + prev/curr 快照。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;整合點承稽核 A2(punch 每幀重組)、
  A6(deg/rad + pitch 符號單點轉換)與研究計畫 Phase 2(視覺≠實際分離)。
- **M5 未過不得開工**(T0 把關);T1/T2 為 High risk,failure modes 見 README §3。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。