# WP-26 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 entry gate PASS(2026-07-14);T1 asset PASS(2026-07-14);T2 scene online PASS(2026-07-14);T3 drill/protocol PASS(2026-07-14);T4 E2E/acceptance PASS(2026-07-14);**T-exit 自動閘 PASS(2026-07-14);M13 保留待研究者實機手動回填**(沿 stage-C M10 先例,使用者拍板)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 br-field 資產 | ✅ |
| T2 場景上線 | ✅ |
| T3 整合 drill + protocol | ✅ |
| T4 E2E + 驗收清單 E | ✅ |
| T-exit(M13) | 🟡 自動閘 ✅ / **M13 待手動實機回填** |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-3 br-field 資產路線(程序化生成 vs CC0 pack) | ✅ T0 決議 | **程序化生成 CC0**。T1 以原創 procedural GLTF/貼圖/材質生成為主路線,不得使用遊戲抽取資產或復刻特定 BR 地圖。寫實目標 = 開闊麥田/丘陵/遠山地貌,但研究幾何優先於美術密度。預算:三角形總量 `< 20k`,材質 slots `<= 8`;Kenney/Quaternius 僅保留為未來白名單替換備選,若使用 CC-BY 必須逐項進 `ATTRIBUTIONS.md`。 |
| OQ-26.1 br-field 雜亂度階層定位(low?mid?新階?)與 clutterTier 值 | ✅ T0 決議 | `clutterTier: 'low'`。理由:BR field 是遠距開闊走廊測試場,雜物不能成為 tracking/ADS/projectile 構念;與 `field-low` 同層但尺度更大、front-facing long corridor 更長。若未來研究需要「BR clutter」獨立對照階,另開 GD/新 SceneConfig,本 WP 不新增 tier。 |
| OQ-26.2 protocol 條件矩陣(ADS × 彈道 × 角尺寸的組合數與對抗平衡) | ✅ T3 決議 | 採完整 2(ADS off/on) × 2(hitscan/projectile) × 2(角尺寸 0.5°/2.0°)= 8 條件受試者內矩陣。工程實作以 8 個 `tracking_br_v1` 變體 drillId 承載條件,protocol `conditionLabel` 明確編碼三軸;ADS 軸採 weapon profile gate + harness protocol 中 ADS-on 條件持續送 ads down/up,正式受試者仍以 hold ADS 操作記錄還原。暫不裁剪條件;若 pilot 時長過長,裁剪屬研究設計另案。 |
| OQ-26.3 走廊長度與 display scale(遠距檔位在 br-field 的擺法) | ✅ T0 需求拍板;T1/T2 實作驗證 | 承 WP-23 OQ-23.2:`field-low` 正面 114.59u 走廊被 backdrop props 擋,br-field 必須提供 front-facing clear corridor。display scale 預設 `1`,不改 sim 單位;T1 先保留 `145u` 前向 projectile/sight corridor,hard profile clear width `>= 42u`,T2 以 clearance/perf 證據驗收。 |

**T-exit 收斂(2026-07-14)**:本 WP 全部 OQ(OQ-S5-3/OQ-26.1~26.3)於 T0~T2 已定案並落地驗證,無遺留。**帶著走(backlog,非本 WP 阻塞)**:① lead 誤差晉升正式指標(OQ-S5-5,spec-only 離線;pilot 顯示構念有效再立案)② scoped inaccuracy / ADS 移動懲罰(stage5 §2.2 out-of-scope;研究需要 ADS 精度構念時觸發)③ ADS toggle 語意(OQ-S5-6 決 hold;toggle 留 config 候補)。三項均為研究設計後續,不阻塞 M13。

---

## Log

### 2026-07-14 04:30Z — T-exit 自動閘 PASS;M13 保留待手動(使用者拍板,沿 stage-C M10 先例)

- **決策(使用者拍板)**:比照 2026-07-10 stage-C M10 同一 `/code-review-and-quality` T-exit 情境——**落自動閘,里程碑保留待手動**。完成所有可自動化的 exit-gate 工作,但**不宣告 M13、不翻 WP-26/stage5「✅ 交付」**,因驗收清單 E §2 手動視覺/手感項(br-field 開闊尺度、ADS scope 手感、tracer/impact 觀感、無 frame hitch)需研究者實機互動,非互動 session 無法產生證據。

- **自動閘證據(`npm run test:ci` exit 0,branch-guarded)**:

  ```
  BRANCH_BEFORE=aa HEAD=6fec1e6
  TEST_CI_EXIT=0 BRANCH_AFTER=aa HEAD=6fec1e6
  # tsc --noEmit clean
  # vitest run       77 files / 622 tests passed
  #   含 WP-26:tests/regression/br-tracking-invariants.test.ts (3)、
  #            src/scene/scenes/br-field.test.ts (6)、src/drill/tracking_br_v1.test.ts (5)
  # playwright test  18 tests passed(含 tests/e2e/br-tracking.spec.ts 2 條)
  ```

- **四項交付證據(自動可追)**:
  - **場景**(T1/T2):`br-field` 上線,GLTF 1548 tri / 8 materials / 0 textures(`<20k` / `<=8`),propBounds 與 GLTF 生成器同源;front-facing 145u 走廊、42u hard clear band 淨空 violations 0;跨場景(placeholder/field-low/urban-high/br-field)recorder snapshot 逐位一致;frame-log p95 8ms、overBudgetWindows 0。
  - **整合 drill**(T3):`tracking_br_v1` 8 變體(2 ADS × 2 ballistic × 2 角尺寸)純 config 宣告,H1 hitbox `{0.5,1,0.5}`、front-facing spawn、5°/s pingpong;`br_tracking_v1` protocol 8 條件 label 編碼三軸;bullet 欄走 M12 canonical 16-tick `{916.73,32,143.24}`。
  - **全鏈路**(T4):canonical `tracking_br_v1` E2E drill → export → `trackingMetricsFromExport()` 回算 acquisition failure 0 / TOT `>=99%` / RMS `<0.1°`,`deriveLeadError()` 產 finite lead sample;export 含 `meta.scene.br-field`、H1 hitbox、`meta.weapon.ads/bullet`、ads event+tick flag、fire row、逐 tick player/target。
  - **三不變性**(T4):①`br-field` vs scene-free baseline recorder snapshot 逐位一致;②ADS FOV display hook 驅動 vs 不驅動 sim 逐位一致(ads events/flag 仍在);③projectile 條件 stable 60/144/240Hz + jitter 144Hz ±50% 與 canonical tick frames 逐位一致。

- **驗收清單 E 狀態**:自動項 E-1~E-10 全綠(證據入口見 [docs/operational/acceptance-stage-e.md](../../../../operational/acceptance-stage-e.md) §1);§2 手動視覺/手感回填項 = **待研究者實機回填**(M13 阻塞項)。

- **五軸 code review(T1–T4 已提交碼)**:通過。config-driven 零引擎碼(`br-field` SceneConfig / 8 drill 變體 / protocol 皆宣告式);seeded RNG(seed = `26000 + 角尺寸offset + 變體offset`);hitbox 單一來源(H1 貫穿命中/淨空/離線推導);`bullet` 欄 config-gated(M12 已解鎖);`main.ts` 以 `createAppProtocolRunner` factory + `activeProtocolRunner` 泛化雙 protocol,harness 抽出共用 `runProtocol` 消 DRY;無 `Date.now`/`Math.random` 於 sim/彈道。無 blocker。

- **Surprises & discoveries(環境,非碼缺陷)**:
  1. **stale dev server 汙染首跑 e2e**:`playwright.config.ts` `reuseExistingServer: !CI`;一個 T2/T4 遺留的 5173 dev server(pre-T3/T4 bundle)被 Playwright 重用,`br-tracking.spec.ts` 報 `Unknown drill: tracking_br_v1` / `runBrTrackingProtocol is not a function`。kill stale server(5173/4173)後 fresh server 兩條 e2e 通過。碼無缺陷,純環境。
  2. **外部程序 session 中途切換 branch**:reflog 顯示 `aa → main → docs/tracer-pertick-replay-plan → wp-25-ballistics-tracer-t0 → aa`。中間一次 CI rerun 在非-`aa` branch 上執行,回報 baseline 74 files/603 tests/16 e2e(WP-26 檔缺席)——該次結果作廢。使用者要求切回後於 `aa`(HEAD 6fec1e6)重跑,branch-guard 確認 before/after 皆 `aa`,得 77/622/18。**教訓**:CI 證據必須 branch-guarded。

- **帶著走的決定**:見上方 OQ ledger「T-exit 收斂」——lead 晉升 / scoped inaccuracy / ADS toggle 三項移交 backlog。

- **索引處置**:本資料夾 README / stage5 README / exec-plan README §2/§3 / MAP.md 皆標「WP-26 自動閘 ✅ / M13 待手動」,**不翻「✅ 交付」**;規格書 §9 對帳項(階段 E 節 + 附錄 E-E 清單 E)沿 stage-C 先例保留 ⬜(owner 待指派,M13 正式宣告時補)。

- **M13 待辦(研究者實機)**:acceptance-stage-e.md §2 五步——(2)br-field 開闊尺度確認、(3)hold ADS 追蹤遠距小目標 scope/FOV 手感、(4)projectile tracer/impact 觀感 + 無 hitch、(5)export JSON 欄位肉眼複驗(已被 e2e 覆蓋,人工再確認)。回填後翻 WP-26/stage5 ✅ 交付 + 規格書 §9。

### 2026-07-14 02:15Z — T4 BR tracking E2E + 三不變性 + 驗收清單 E PASS

- **Slice / scope**:新增 `tests/e2e/br-tracking.spec.ts`、`tests/regression/br-tracking-invariants.test.ts`、`docs/operational/acceptance-stage-e.md`;更新 T4/task checklist/README/progress。未修改 production runtime、drill schema、SimLoop 或 render engine。
- **E2E evidence**:`tests/e2e/br-tracking.spec.ts` 在真 Edge dev/preview 路徑下驗:
  - canonical `tracking_br_v1`(ADS-on projectile 0.5deg)完整 10 presentations,export 含 `meta.scene.br-field`、H1 hitbox、`meta.weapon.ads`、`meta.weapon.bullet`、ADS event/tick flag、fire row、逐 tick player/target columns。
  - `trackingMetricsFromExport()` 對該 payload 回算 acquisition failure rate `0`,每 presentation `tAcquireMs <= 16`,TOT `>= 99%`,RMS `< 0.1deg`。
  - `deriveLeadError()` 對 projectile fire row 產生 finite lead sample。
  - BR protocol 8 條件匯出 `meta.protocol` condition index/label/display/weapon gate;另用 ADS-on hitscan 2deg smoke 驗 `fire.hit=true`。
- **Regression invariants**:`tests/regression/br-tracking-invariants.test.ts` 收編三條 T4 gate:
  1. `br-field` scene config vs scene-free baseline 對 BR hitscan condition 的 recorder snapshot/phase/ticks 逐位一致。
  2. 同 ADS input 下,驅動 CameraController ADS FOV display hook 與不驅動相比,sim recorder snapshot 逐位一致;ADS events/tick flag 仍存在。
  3. canonical BR projectile condition 在 stable 60/144/240Hz 與 jitter 144Hz ±50% frame sequences 下與 canonical tick frames 逐位一致。
- **Acceptance doc / pilot**:`docs/operational/acceptance-stage-e.md` 定稿 10 項清單 E、自動證據入口、手動 BR 視覺/ADS/tracer 回填流程,並附 `br_tracking_v1` 8 條件 pilot protocol 草案。
- **Surprises & discoveries**:回歸夾具初版只在 display-on 路徑建立 `CameraController`;該 class 建構時會接管 camera quaternion,造成 fire `offsetDeg` 與 display-off baseline 不同。修正為兩邊都採同一 controller camera 基準,只讓 display-on 額外推 ADS FOV hook。這是測試夾具差異,未暴露 runtime 缺陷。
- **Focused verification**:

  ```
  npx.cmd vitest run tests/regression/br-tracking-invariants.test.ts src/testharness/fpsTestHarness.test.ts
  # 2 files / 13 tests passed

  npm.cmd run typecheck
  # tsc --noEmit clean

  npx.cmd playwright test tests/e2e/br-tracking.spec.ts
  # sandboxed first run hit known Vite/esbuild parent-directory access denial
  # approved external rerun: 2 tests passed
  ```

- **Full CI / graph update evidence**:

  ```
  npm.cmd run test:ci
  # sandboxed first run hit known Vite/esbuild parent-directory access denial
  # approved external rerun exit 0:
  # tsc --noEmit
  # vitest run       # 77 files / 622 tests passed
  # playwright test  # 18 tests passed

  graphify update .
  # AST extraction: 168/168 files; graph rebuilt: 1215 nodes / 2899 edges / 79 communities
  ```

- **T-exit handoff**:T4 auto gates and checklist E are in place. T-exit still owns M13/stage5 declaration and researcher manual visual/ADS/tracer回填。

### 2026-07-14 02:10Z — T3 tracking_br_v1 整合 drill + BR protocol PASS

- **Slice / scope**:新增 `src/drill/tracking_br_v1.ts` + test、BR 專用 AK weapon profiles、`src/display/brTrackingProtocol.ts`;`src/main.ts` 只掛 drill 選單與 BR protocol 入口,protocol runner 改為共用 factory;`src/testharness/fpsTestHarness.ts` 加 BR protocol harness 與 projectile weapon metadata。未修改 `DrillConfig` schema、SimLoop、TargetManager、clearance 或 render engine。
- **Drill config**:`trackingBrV1` canonical id = `tracking_br_v1`,sceneId `br-field`,ADS-on + projectile + 0.5° longrange。`trackingBrVariants` 共 8 條件:ADS off/on × hitscan/projectile × angular height 0.5°/2.0°;全部使用 H1 hitbox `{0.5,1,0.5}`、front-facing spawnArea yaw `[0,0]`、5°/s pingpong motion、2000ms timed presentation。
- **Weapon gate**:新增 `ak47_br_hip_hitscan`、`ak47_br_ads_hitscan`、`ak47_br_hip_projectile`、`ak47_br_ads_projectile`;projectile 使用 WP-25/GD-17 canonical 16-tick bullet `{speedU:916.73,gravityU:32,maxRangeU:143.24}`。M12 已 PASS,`bullet` 欄使用解鎖。
- **Protocol**:`br_tracking_v1` 條件序列 8 筆,全部 `sceneId:'br-field'`,display mode `native`,condition label 形式 `br-{ads_axis}-{ballistic_axis}-{angular_axis}`。`meta.protocol` 由既有 ProtocolRunner/collectMeta 路徑生效;harness protocol 斷言 condition index/label/scene/drill 對齊。
- **Harness smoke / export evidence**:`src/testharness/fpsTestHarness.test.ts` 跑完整 BR protocol 8 條件;每條 export 都含 `meta.protocol`、`meta.scene.br-field`、H1 hitbox、weapon ADS/bullet gate、frame summary、tracking metrics。ADS-on 條件有 ads down/up events 且 tick `ads=true`;projectile 條件 export `meta.weapon.bullet` 且 `projectileOverflow=false`;tracking acquisition failure rate `0`。另以 `tracking_br_v1__ads_on__hitscan__2deg` 跑單條 BR ADS smoke:開鏡 → fire hit row → 匯出;timed-presentation tracking target 為 persistent,命中不撤除,故證據採 `fire.hit=true` 而非 `markKilled`。0.5° 遠距小目標不作 fire-hit smoke,避免 AK inaccuracy 讓 smoke 被隨機散布支配。
- **OQ-26.2 決議**:採完整 8 條件受試者內矩陣,不在 T3 工程層裁剪。Alternatives considered:先落 4 條件(固定 0.5°)或只落 hitscan-only;拒絕,因 M12 已解鎖 projectile,且 T3 目標是 stage5 BR tracking 整合條件矩陣。
- **Surprises & discoveries**:既有 harness 只把 `meta.weapon.ads` 寫入 export,未帶 `bullet`;production `main.ts` 已有 bullet metadata。T3 將 harness 補齊,使 protocol smoke 能驗 projectile 條件 export,不動 production export schema。
- **Focused verification**:

  ```
  npx.cmd vitest run src/display/ProtocolRunner.test.ts src/testharness/fpsTestHarness.test.ts src/drill/tracking_br_v1.test.ts src/weapon/WeaponConfig.test.ts
  # 4 files / 43 tests passed

  npm.cmd run typecheck
  # exit 0

  npx.cmd vitest run
  # 76 files / 619 tests passed

  graphify update .
  # AST extraction: 166/166 files; graphify-out rebuilt
  ```

- **T4 handoff**:`tracking_br_v1` 與 `br_tracking_v1` 已可由 main/harness 載入。T4 可在此基礎上補 E2E、三條決定性不變性、驗收清單 E 與完整 `test:ci` gate。

### 2026-07-14 01:44Z — T2 br-field 場景上線 PASS

- **Slice / scope**:新增 `src/scene/scenes/br-field.ts` 與 `src/scene/scenes/br-field.test.ts`;`src/main.ts` 只掛 `br-field` 場景選單 entry;未修改 loader/sim/render 引擎機制。另將跨場景決定性 fixture 與 node harness probe 擴到 `br-field`。
- **SceneConfig**:`sceneId:'br-field'`,`assetPackVersion:'br-field-v1'`,`clutterTier:'low'`,`asset.url:'/assets/scenes/br-field/br-field.gltf'`,`displayScale:1`;`propBounds` 消費 T1 generated `br-field.props.json`;`playerCorridor.halfWidthU = 21` 對齊 T1 42u hard clear band。
- **Clearance evidence**:`src/scene/scenes/br-field.test.ts` 驗證:

  ```
  br-field propBounds: 62, unique AABB ids
  hard clear band: x [-21,21], z [-145,0], violations 0
  front-facing tracking_longrange_v1 canonical envelope: PASS
  hard 20deg/s longrange envelope(range x4): PASS
  intentional front-corridor-blocker: rejected and prop id named
  ```

- **Render/budget evidence**:`br-field.gltf` raw asset test shows `129` mesh nodes,`1548` triangles,`8` materials,`0` textures;triangles `<20k`,materials `<=8`。Frame-log comparison fixture records matching `field-low` vs `br-field` summary at 8ms frame deltas: p95 `8ms`,overBudgetWindows `0`,overflow `false`。
- **Cross-scene determinism**:`tests/regression/determinism.test.ts` now compares `placeholder-room / field-low / urban-high / br-field` with the same input sequence;`samples`,`DataRecorder snapshot`,`phase` all bit-exact vs placeholder。
- **Harness/export smoke**:`src/testharness/fpsTestHarness.test.ts` adds `br-field` moving-target tracking probe;export `meta.scene` contains `sceneId:'br-field'`,fallback `false`;`meta.suspect=false`;`recorderOverflow=false`;tracking acquisition failure rate `0`。
- **Manual visual smoke**:started Vite dev server at `http://127.0.0.1:5173/`,selected `br-field` in scene control,clicked `Scene`;Playwright observed `selected:"br-field"` and canvas `1280x720`。Screenshot:
  `docs/exec-plan/active/stage5/wp-26-br-scene-integration/evidence/br-field-online-smoke.png`。
- **Targeted verification**:

  ```
  npx.cmd vitest run src/scene/scenes/br-field.test.ts tests/regression/determinism.test.ts src/testharness/fpsTestHarness.test.ts
  # 3 files / 30 tests passed

  npm.cmd run typecheck
  # exit 0
  ```

- **Full CI**:`npm.cmd run test:ci` sandboxed first run hit the known Vite/esbuild parent-directory access denial (`Cannot read directory "../../../.."`);approved external rerun exit 0:

  ```
  tsc --noEmit
  vitest run      # 75 files / 610 tests passed
  playwright test # 16 tests passed
  ```

- **T3 handoff**:`br-field` is selectable and clearance-verified for front-facing longrange envelopes. `tracking_br_v1` can now consume `sceneId:'br-field'` without engine changes;T3 still owns drill/protocol condition matrix.

### 2026-07-14 01:34Z — T1 br-field 原創資產 PASS

- **Slice / scope**:T1 只新增原創 procedural 資產與權威 props,不掛 SceneConfig、不修改 loader/drill/runtime。新增 `scripts/gen-br-field-gltf.mjs`,同步輸出 `src/scene/scenes/br-field.props.json` 與 `public/assets/scenes/br-field/br-field.gltf`。
- **Asset route / license**:沿 T0 OQ-S5-3 採程序化生成 CC0。`ATTRIBUTIONS.md` 已新增 br-field 逐項記錄;紅線自檢:無遊戲抽取資產、無 PUBG/特定 BR 地圖復刻、無 NC/付費素材。
- **Corridor self-check**:`node scripts/gen-br-field-gltf.mjs` exit 0:

  ```
  wrote ...\src\scene\scenes\br-field.props.json: 62 propBounds
  wrote ...\public\assets\scenes\br-field\br-field.gltf: 129 mesh nodes, 1548 triangles, 8 materials, 0 textures
  corridor clear: length 145u, width 42u
  ```

  生成器內建檢查所有 propBounds 對 `z in [-145,0]`、`x in [-21,21]` 的 hard clear band 零交集。
- **Budget evidence**:`node -e "...budget/corridor verify..."` exit 0:

  ```
  br-field verify: 62 propBounds, 129 nodes, 1548 triangles, 8 materials, corridor violations 0
  ```

  對 T0 預算:1548 triangles `<20k`;8 materials `<=8`;0 textures。
- **Visual smoke**:使用 Playwright 臨時 canvas viewer 讀取 GLTF nodes,輸出 top-down smoke 截圖:
  `docs/exec-plan/active/stage5/wp-26-br-scene-integration/evidence/br-field-topdown-smoke.png`。
  截圖顯示 42u x 145u 中央走廊淨空,麥田/props 在 flank。
- **Targeted verification**:

  ```
  npm.cmd run typecheck
  # exit 0

  npx.cmd vitest run src/scene/SceneConfig.test.ts src/render/sceneLoader.test.ts
  # 2 files / 12 tests passed
  ```

- **T2 handoff**:SceneConfig 可直接消費 `br-field.props.json` 的 `props` 作為 `propBounds`;建議 `sceneId:'br-field'`,`assetPackVersion:'br-field-v1'`,`clutterTier:'low'`,`asset.url:'/assets/scenes/br-field/br-field.gltf'`,`displayScale:1`。T2 仍需正式跑 clearance/perf/跨場景決定性。

### 2026-07-14 01:24Z — T0 entry gate PASS

- **Branch / scope**:建立 `aa` branch(base `main` commit `f0c2b9866797eb7493e9a6340e06402fcb6579f5`)。T0 是 docs-only;本切片不得碰 `src/` 或資產。
- **Baseline verification**:`npm.cmd run test:ci` sandboxed 首跑被已知 Vite/esbuild parent-directory access denial 擋(`Cannot read directory "../../../.."`);approved unsandboxed rerun exit 0。結果:`tsc --noEmit` clean;Vitest **74 files / 603 tests** 全綠;Playwright **16 tests** 全綠。
- **Upstream reconciliation / integration consumer list**:
  - **WP-23 / M11 ✅**([../wp-23-longrange-tracking/progress.md](../wp-23-longrange-tracking/progress.md)):hitbox config 化、`tracking_longrange_v1`、小角尺寸 round-trip、遠距決定性全綠。WP-26 消費面:小目標 H1 `{widthU:0.5,heightU:1,depthU:0.5}`;角高 0.5°/2.0°;角速度 5°/s/20°/s;distance/speed/range 表;OQ-23.2 移交「`field-low` 無 front-facing 114.59u 走廊,br-field 需補」。
  - **WP-24 ✅**([../wp-24-ads-optics/progress.md](../wp-24-ads-optics/progress.md)):ADS input/render/data 鏈完成,`WeaponConfig.ads`、CS2 式 FOV-ratio gain、scope overlay、tick `ads` flag、ads events、`meta.weapon.ads` 全綠。WP-26 消費面:T3 可用 config 宣告 ADS on/off 條件;T4 驗收需查 ads event/tick flag/export round-trip。
  - **WP-25 / M12 ✅**([../wp-25-ballistics-tracer/progress.md](../wp-25-ballistics-tracer/progress.md)):tracer、projectile math/sim integration、`hit` event、time-of-flight、lead spec-only 全綠。WP-26 消費面:M12 已過,`bullet` 欄可進 `tracking_br_v1`;hitscan 預設逐位不變仍是 T4 gate。
- **OQ-S5-3 決議**:br-field 資產路線採程序化生成 CC0。寫實目標是開闊麥田/丘陵/遠山,不是復刻 PUBG 或任何特定地圖;`ATTRIBUTIONS.md` 仍需逐項記錄自產/外部來源。預算鎖定:三角形 `< 20k`,材質 slots `<= 8`。
- **OQ-26.1 決議**:`clutterTier: 'low'`。br-field 是大尺度開闊場景,不是新雜亂度構念;保持低雜亂以保護遠距 tracking/ADS/projectile 條件的可歸因性。
- **Corridor geometry requirements for T1/T2**:

  | Profile | Angular height / speed | distanceU | 2s pingpong rangeU | Required clear corridor |
  |---|---:|---:|---:|---|
  | near sanity | 2.0° / 5°/s | 28.65 | 1.25 | front-facing sightline length `>= 30u`;clear width `>= 3u` |
  | canonical longrange | 0.5° / 5°/s | 114.59 | 5.00 | front-facing sightline length `>= 115u`;clear width `>= 12u` |
  | hard longrange | 0.5° / 20°/s | 114.59 | 20.00 | front-facing sightline length `>= 115u`;clear width `>= 42u` |
  | projectile envelope | canonical 0.5° distance + GD-17 maxRange | 143.24 maxRange | n/a | forward projectile/tracer corridor length `>= 145u`;scene geometry must not be modeled as bullet blockers |

  Widths include lateral motion envelope plus H1 target width margin;T1 should design terrain/prop placement around the hard profile,not retrofit after clearance fails. `displayScale` remains `1` unless T2 records a contrary decision.
- **驗收清單 E 草案(T4 定稿)**:
  1. `br-field` 原創/白名單資產可稽核;`ATTRIBUTIONS.md` 完整,無遊戲抽取/地圖復刻。
  2. `br-field` SceneConfig 資料化上線,`sceneId:'br-field'`,`clutterTier:'low'`,三角形 `<20k`,材質 slots `<=8`,零引擎碼。
  3. propBounds 與視覺同源;front-facing long corridor clearance 對 114.59u sightline、42u hard width、145u projectile envelope 全綠。
  4. `tracking_br_v1` 純 config 宣告 `br-field` × H1 小目標 × WP-23 motion/distance 檔位 × ADS weapon × projectile weapon。
  5. protocol 條件序列宣告 ADS on/off × hitscan/projectile × 角尺寸檔;條件切換不殘留 scene/weapon/ads/bullet state。
  6. export round-trip 含 `meta.scene`、`meta.targets.hitbox`、`meta.weapon.ads/bullet`、tick `ads`、ads/fire/hit events、tracking derivation 欄位。
  7. E2E 一鍵跑 `tracking_br_v1` 從 drill → export → offline tracking metrics,無 `NaN`/`Infinity`,小角尺寸 round-trip 誤差 `<= 1 tick`。
  8. 決定性不變性 ①:同輸入下 `br-field` vs baseline/placeholder scene 的 sim state/export core rows 逐位一致。
  9. 決定性不變性 ②/③:ADS 顯示層不改 sim 序列;hitscan weapon 在 `br-field` 下與既有 hitscan baseline 逐位一致。
  10. `npm.cmd run test:ci` exit 0,frame log/perf 證據顯示 `br-field` 負載未使 drill 進 suspect 狀態。
- **Stage5 §8 回填**:[../README.md](../README.md) OQ-S5-3 標為 ✅,並新增 OQ-26.1 clutterTier 決議列。
- **Entry gate**:PASS。T1 可開;T2+ 上游三 WP 已全綠,無 M12 fallback 需求。

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-9(寫實原創 + 白名單——**附圖 PUBG 麥田為情境參考,非復刻目標**;
  雜亂度階層才是實驗規格)、GD-6(純裝飾 + 淨空——BR 地形不進 sim、不擋彈)、
  M9 機制(場景 = 資料,零引擎碼被測試釘死)、WP-22 T2 protocol 機制(條件序列宣告式)。
- 設計要點:本 WP 是 stage5 的**整合交付閘**——BR 跟槍測試「實際可跑」的定義 =
  `tracking_br_v1` 在 br-field 一鍵執行、匯出含 ads/hit/追蹤欄、離線推導可算跟槍效率、
  三條決定性不變性全綠(驗收清單 E)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 上游驗證 + OQ-S5-3 拍板,docs-only;
  T1 資產工作可在 WP-23/24/25 進行中提前並行。
