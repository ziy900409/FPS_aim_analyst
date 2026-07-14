# WP-26 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 entry gate PASS(2026-07-14);T1 asset PASS(2026-07-14);T2 scene online PASS(2026-07-14);T3 可開

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 br-field 資產 | ✅ |
| T2 場景上線 | ✅ |
| T3 整合 drill + protocol | ⬜ |
| T4 E2E + 驗收清單 E | ⬜ |
| T-exit(M13) | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-3 br-field 資產路線(程序化生成 vs CC0 pack) | ✅ T0 決議 | **程序化生成 CC0**。T1 以原創 procedural GLTF/貼圖/材質生成為主路線,不得使用遊戲抽取資產或復刻特定 BR 地圖。寫實目標 = 開闊麥田/丘陵/遠山地貌,但研究幾何優先於美術密度。預算:三角形總量 `< 20k`,材質 slots `<= 8`;Kenney/Quaternius 僅保留為未來白名單替換備選,若使用 CC-BY 必須逐項進 `ATTRIBUTIONS.md`。 |
| OQ-26.1 br-field 雜亂度階層定位(low?mid?新階?)與 clutterTier 值 | ✅ T0 決議 | `clutterTier: 'low'`。理由:BR field 是遠距開闊走廊測試場,雜物不能成為 tracking/ADS/projectile 構念;與 `field-low` 同層但尺度更大、front-facing long corridor 更長。若未來研究需要「BR clutter」獨立對照階,另開 GD/新 SceneConfig,本 WP 不新增 tier。 |
| OQ-26.2 protocol 條件矩陣(ADS × 彈道 × 角尺寸的組合數與對抗平衡) | 🟡 待 T3 | 預設:2(ADS on/off)× 2(hitscan/projectile)× 2(角尺寸檔)= 8 條件受試者內;實際裁剪為研究設計決策 |
| OQ-26.3 走廊長度與 display scale(遠距檔位在 br-field 的擺法) | ✅ T0 需求拍板;T1/T2 實作驗證 | 承 WP-23 OQ-23.2:`field-low` 正面 114.59u 走廊被 backdrop props 擋,br-field 必須提供 front-facing clear corridor。display scale 預設 `1`,不改 sim 單位;T1 先保留 `145u` 前向 projectile/sight corridor,hard profile clear width `>= 42u`,T2 以 clearance/perf 證據驗收。 |

---

## Log

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
