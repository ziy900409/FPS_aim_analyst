# WP-19 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ T0/T1/T2/T3/T4 complete(T2 實機三檢皆綠);T5/T-exit 待開

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 SceneConfig schema | ✅ |
| T2 GLTF 管線 + field-low | ✅ code/asset/test + 實機三檢綠 |
| T3 淨空驗證器 | ✅ |
| T4 場景切換 + meta | ✅ |
| T5 urban-high + perf | ⬜ |
| T-exit(M9) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-3 場景資產選型(3 候選比 draw calls/授權/雜亂度對應) | ✅ resolved | `field-low` 採 Kenney Nature Kit v1.0(CC0)作為模組化來源;T2 以低雜亂度原創 layout 放置 <=25 個 prop,下載後實測 triangles/materials 並寫 `ATTRIBUTIONS.md`。備選:Quaternius Ultimate Nature Pack(CC0)、Poly Pizza Walk in the Woods(CC-BY)。 |
| OQ-19.1 `CLEARANCE_MARGIN_U` 起點值(計畫預設 0.5u)與玩家走廊 `halfWidthU` 預設 | ✅ resolved | `CLEARANCE_MARGIN_U = 0.5u`;`playerCorridor.halfWidthU = 1.0u`。理由:沿用 T3 常數與 `field-low` fixture,保守包住現行 counter-strafe 橫移走廊;若 T2 實測 layout 誤擋,只調 SceneConfig corridor/propBounds,不把場景知識推進 sim。 |
| OQ-19.2 meta.scene 落點確認:WP-16 已留 optional 區塊縫?(未留 → T4 與 WP-16 對帳) | ✅ resolved | WP-16 已留縫:`src/data/metadata.ts` 的 `Meta.scene?: unknown` / `CollectMetaArgs.scene?` / `collectMeta(...scene)`、`docs/operational/schema.md` `meta.scene` reserved optional、WP-16 README/T1 stage3 前置欄位。T4 只負責填值與測試。 |

---

## Log

### 2026-07-08 07:31Z — T4 場景切換 + `meta.scene` + 決定性/suspect 防線 ✅
- **切片(3 個原子 commit)**:
  1. `f47f689` `feat(wp-19): add scene switching pipeline` — `Controls` 增 scene selector(placeholder-room / field-low),scene load button 與 all-controls async disable gating;`main.ts` 改 active scene manager 可替換,切換前用 `loadDrill(activeDrillSource, nextScene)` 重跑淨空驗證,切換後 dispose 舊 scene/TargetView/ImpactView、重綁 camera、重建 SimLoop;`SceneManager` 新增 fallback-aware `createSceneManagerWithStatus`。
  2. `1d0fe1f` `feat(wp-19): export scene metadata` — `Meta.scene` 型別化為 `{sceneId, assetPackVersion, clutterTier, fallback}`;export path 從 active SceneConfig 與 loader fallback state 填值;`docs/operational/schema.md` 補 `meta.scene` 欄位。
  3. `0589135` `feat(wp-19): assert scene determinism and corridor suspect` — `SharedState.validity.playerCorridorExceeded` + `createSimLoop(..., { afterTick })` 純觀測 hook;`main.ts` 每 tick 比對 active `playerCorridor.halfWidthU` 升 `suspect`,不 clamp、不改 sim;regression 加 placeholder-room vs field-low 完整 sim bit-exact 斷言。
- **自動化驗證**:
  - `npm.cmd test -- src/render/SceneManager.test.ts src/render/sceneLoader.test.ts` → 2 files / 13 tests pass。
  - `npm.cmd test -- src/data/metadata.test.ts src/data/export.test.ts` → 2 files / 12 tests pass。
  - `npm.cmd test -- src/state/SharedState.test.ts src/loop/SimLoop.test.ts src/data/metadata.test.ts tests/regression/determinism.test.ts` → 4 files / 50 tests pass。
  - `npm.cmd test -- src/scene/architecture.test.ts` → scene boundary pass(`src/sim`/`src/state` 未 import `src/scene`)。
  - `npm.cmd test` → Vitest **47 files / 351 tests pass**。
  - `npm.cmd run build` → pass(需提升權限避開 sandbox 對 Vite/esbuild 讀 `vite.config.ts` 的上層目錄限制;僅既有 chunk-size warning)。
  - `graphify update .` → AST extraction 108/108, graph rebuilt(`825 nodes`, `1821 edges`)。
- **Headless browser smoke(Chromium,dev server `127.0.0.1:5173`)**:
  - Playwright 載入 app → `#scene-select` 存在。
  - 選 `placeholder-room` + click `Load selected scene` → controls 等待後全部 enabled。
  - 選 `field-low` + click `Load selected scene` → controls 等待後全部 enabled。
  - 回傳:`{"first":"placeholder-room","second":"field-low","controls":[... disabled:false]}`。
- **Decision Log**:
  - **fallback 狀態由 `createSceneManagerWithStatus` 回報,保留既有 `createSceneManager(config): Promise<SceneManager>` API**。Alternatives Considered:直接改 `createSceneManager` 回傳 `{manager,fallback}` 會破壞現有呼叫端/測試;新增 wrapper 讓 `main.ts` 可填 `meta.scene.fallback`,舊 API 仍可用。
  - **scene 切換採「先淨空驗證、再 async 載入、最後替換 render scene」**。Alternatives Considered:先載入再驗證可讓 UI 更早顯示載入狀態,但若驗證失敗會出現畫面已換、drill 被拒的半狀態;先驗證保持 active scene/drill 原子切換。
  - **走廊逸出用 SimLoop optional `afterTick` observer,scene config 只留在 `main.ts` 組裝層**。Alternatives Considered:把 `SceneConfig` 傳入 SimLoop 或 SharedState 更直接,但會違反 GD-6 邊界;observer 只看 state 數值並設 validity flag,不讓 scene module 進 sim/state。
- **Surprises & Discoveries**:
  - `CameraController` 原本固定綁建構時 camera;scene 切換需新增 `setCamera()` 才能保留 yaw/pitch/sensitivity/punch 並套到新 camera。
  - Vite/esbuild 在 sandbox 內讀取 `vite.config.ts` 仍會觸發上層目錄 access denied;同 T2 build 經驗,提升權限重跑可通過。
- **Open Questions / 待人工**:
  - 實機可視切換(肉眼確認 placeholder 灰房間 ↔ field-low 戶外 GLTF)仍建議使用者在 Edge/Chrome 桌面版快速切 3–5 次確認;headless smoke 已覆蓋 DOM gating 與載入流程,但不替代肉眼視覺確認。

### 2026-07-08 — T2 DoD 實機三檢**全綠** → T2 ✅(使用者於 Edge 146 桌面版驗證)
- **Check 1 — field-low 實機 render(真管線,非 fallback)**:Network `GET /assets/scenes/field-low/field-low.gltf`
  → **200 OK**、`Content-Type: model/gltf+json`、`Content-Length 7408`、COOP/COEP header 齊(require-corp / same-origin),
  initiator `sceneLoader.ts:27`;內嵌 buffer `data:application/octet-stream`(648 B)一併載入。畫面天空藍 + props + 地面。
- **Check 2 — 完整 drill 無掉 tick**:匯出 JSON(`counterstrafe_ad_v1-2026-07-08T06_53_47Z.json`)tick 流分析——
  **2536 ticks / span 19.80s = 100.0% of expected**;delta histogram `{1: 2535}`(**每一步恰 1 tick**,無 2+);
  max gap 7.81ms(=1.00 tick);gaps>1.5tick = **0**;non-monotonic = 0;`recorderOverflow: false`。
  關鍵:`displayHz ~60` 而 sim 恰 128Hz 零掉 tick——固定步長 accumulator 在 GLTF 場景載入下仍完美 decouple(ADR-3)。
- **Check 3 — 壞 URL → fallback 佔位房間**:DevTools Network request blocking 規則
  `*://localhost:5173/assets/scenes/field-low/field-low.gltf` = Block(1 affected)→ reload。
  `field-low.gltf` 列紅 `(blocked)` 0B;畫面 fallback 為**灰色四面牆佔位房間**(bg `0x202428`,無天空/props),
  `placeholder-room.ts` 經 `SceneManager.ts:3` 載入;Console 印 `[sceneLoader] 場景資產載入失敗,fallback 佔位房間`。
  → 單一路徑 fallback(`loadScene` null → `createSceneManager` 重建 placeholderRoom)實測成立。
- **DoD 對照**:field-low 實機渲染 ✅ / 既有 drill 全程無掉 tick ✅(證據上述)/ 載入失敗 fallback 實測 ✅ /
  `ATTRIBUTIONS.md` 與資產一一對應 ✅ / repo 內無非 CC0/CC-BY 檔 ✅。**T2 = ✅**;task-checklist 翻 ✅。
- **Next**:T4(場景切換 UI + `meta.scene` 填值 + 跨場景決定性斷言;相依 T2 ✅ + T3 ✅ 已滿足)。

### 2026-07-08 — T2 追記:實機截圖回饋 → field-low 視覺調整(地面 + prop 重排)
- **來源**:使用者實機截圖(Chrome,`Time 01:07` 順跑、target 紅盒 spawn、天空藍 + props 可見)——
  **Check 1 過**(GLTF 載入非 fallback)。回報兩視覺問題:(1) props 浮在藍色虛空無地面;(2) 近 camera 的
  flank props(z∈[0,1.5],camera z~4)看起來過大 looming。二者皆呈現層,不影響 sim/淨空效度。
- **調整(只動 field-low 資產/config,不碰 sim,GD-6)**:
  - **地面平板**:生成器新增 `ground` 材質 + 一塊扁平 box(`GROUND` x[-14,14] y[-0.3,0] z[-16,8]),props 底面
    y=0 恰坐其上,給地平線、消虛空。**視覺-only、不入 `propBounds`**(水平視線 y~1.5,地面 y<=0 永不遮擋)——
    故 `field-low.props.json` 不列;淨空契約與資料源不變。
  - **prop 重排**:flank props 全推到 z<=-1(最近 z=-0.5→改為 flank 皆 z<=-0.5、多數 z<=-1.5),移除近端 crates,
    改以 flank rock/tree 沿 z 由近到遠遞退框景;維持 flank |x|>=4.5、backdrop z<=-7 淨空安全區。16 props(原 15)。
- **驗證**:GLTF 重生 headless parse OK(**17 mesh nodes = 16 props + ground / 408 verts / 204 triangles**;
  bbox min[-14,-0.3,-16] max[14,3.5,8]);`field-low × counterstrafe drill` validateClearance **仍零違規**;
  `npm.cmd test` 47 files / 346 tests 綠;`typecheck` + `build` pass。
- **仍待人工**:Check 2(export JSON 看 ticks≈128/s)、Check 3(斷 URL fallback)。視覺若仍需微調同樣只改
  `field-low.props.json` / `field-low.ts` / 生成器。

### 2026-07-07 16:48Z — T2 GLTF 管線 + field-low 場景 + ATTRIBUTIONS(code/asset/test 綠;實機待人工)
- **切片(3 個原子 commit)**:
  1. `sceneLoader.ts` + 單元測試(mock loader):`loadScene(config, loaderOverride?)` async GLTF 載入,
     成功回套 `displayScale` 的 group;`asset:null` 或任何載入/解析失敗回 `null`(fallback 契約)。
     `disposeScene(root)` traverse 釋放 geometry/material/texture 並自 parent 移除(防洩漏)。
     依賴注入 loader 使測試不必真跑 WebGPU/GLTF 解析。
  2. `SceneManager` GLTF 分支 + `createSceneManager` async 工廠 + fallback:建構子改資料驅動——
     `asset:null` 建程序化房間;`asset!==null` 只建**舞台**(camera + 光 + 背景,`proceduralRoom` 描述),
     牆/地板留給 GLTF。新增 `mountAsset()`(重覆 mount 先釋放)/`dispose()`(全場景 GPU 釋放)。
     `createSceneManager` 載入失敗遞迴 fallback 佔位房間(單一 config 路徑)。`main.ts` 改 async 工廠。
  3. field-low 資產落地:原創 CC0 GLTF(使用者選項)+ SceneConfig + ATTRIBUTIONS + 測試 + `main.ts` 預設載入。
- **field-low 資產(原創 CC0)**:
  - 權威 prop 清單 [../../../../../src/scene/scenes/field-low.props.json](../../../../../src/scene/scenes/field-low.props.json)(15 props,canonical u 座標)。
  - 生成器 [../../../../../scripts/gen-field-low-gltf.mjs](../../../../../scripts/gen-field-low-gltf.mjs) → `public/assets/scenes/field-low/field-low.gltf`
    (原創立方體幾何,3 材質色 foliage/rock/crate,node translation+scale = prop AABB)。
  - [../../../../../src/scene/scenes/field-low.ts](../../../../../src/scene/scenes/field-low.ts):讀同一 props.json 生 `propBounds`(視覺與淨空資料不漂移),
    `displayScale:1`(與 target 渲染同 1:1 世界座標),`proceduralRoom` 僅描述舞台(camera+光+天空色)。
  - [../../../../../ATTRIBUTIONS.md](../../../../../ATTRIBUTIONS.md):field-low 逐項 = 原創 / CC0 / 2026-07-07;含重生指令。
- **負載量測(headless GLTFLoader.parse)**:15 mesh nodes / 360 verts / **180 triangles** / 3 materials;
  bbox min[-8,0,-9] max[8,3.5,1.5](= props.json,零漂移)。三角形數遠低於 T0 budget(<20k)。
  draw calls ~15(每 prop 一 node;低雜亂度可接受,若 T5 需可 instancing)。
- **測試/驗證**:
  - `npm.cmd test -- src/render/sceneLoader.test.ts src/render/SceneManager.test.ts src/scene/scenes/field-low.test.ts` → 綠。
  - `npm.cmd test`(全）→ Vitest **47 passed files / 346 passed tests**(T1 時 45/333;+sceneLoader 6、+field-low 3、SceneManager 重寫）。
  - `npm.cmd run typecheck` → `tsc --noEmit` pass。
  - `npm.cmd run build` → `tsc --noEmit && vite build` pass(僅既有 chunk-size warning);`dist/assets/scenes/field-low/field-low.gltf` 隨 build 靜態複製。
  - headless GLTF 解析驗證:real `GLTFLoader.parse`(polyfill `ProgressEvent`)成功解出 15 mesh。
  - `field-low × counterstrafe_ad_v1` `validateClearance` → **零違規**;`loadDrill(json, fieldLow)` 不 throw(淨空門放行)。
  - `public/assets/scenes/` 僅 `field-low.gltf`(原創 CC0)——repo 內**無非 CC0/CC-BY 檔案**(DoD)。
- **Decision Log**:
  - **field-low 採原創 CC0 生成 GLTF**(使用者於本 session 明確選定),而非 T0/OQ-S3-3 選定的 Kenney Nature Kit。
    Alternatives Considered:(a) 下載 Kenney kit 並組裝 ≤25 props——最貼近 T0,但需二進位資產下載 + 3D 場景組裝,
    本環境無法可靠執行且 T2 實機 DoD 本就須人工瀏覽器驗證;(b) 只落 config+ATTRIBUTIONS scaffold 不落二進位——
    pipeline 空轉、實機 render DoD 完全未達。採原創 CC0:GD-9 完全合規(原創=CC0、零 attribution 義務/share-alike)、
    真 GLTFLoader 端到端可跑、propBounds 與視覺同源。**寫實資產置換保留給後續**(ATTRIBUTIONS 已註記接續紀律)。
  - **GLTF 場景重用 `proceduralRoom` block 描述舞台(camera+光+背景),但不建牆/地板**。
    Alternatives Considered:新增獨立 `stage`/`camera`/`lighting` schema block 更語意清晰,但屬 T1 schema territory 且擴大切片;
    重用既有 block + `asset!==null` 時跳過 `#buildRoom`,零 schema 變更、camera 放置與 placeholder 同構(單一路徑)。
  - **field-low props 全置於淨空安全區(flank |x|>=4.5、backdrop z<=-7)**,`displayScale:1`(canonical u = world 1:1)。
    Alternatives Considered:貼近走廊擺放更「有臨場感」,但 T2 propBounds 只是資料(T3 消費)、T2 不驗淨空邏輯本體;
    保守置於安全區使 `field-low × 現行 drill` 淨空零違規、DrillLoader 不拒載,符合 T2「本 task propBounds 只是資料」範圍。
- **Surprises & Discoveries**:
  - `TargetView` 直接以 `t.pos` 世界座標放 mesh(target distance 4 → z=-4 world,**1:1 canonical u**),而 player camera 位移
    另乘 `SIM_TO_WORLD=0.01`(佔位 display scale)。故 GLTF props 須以 `displayScale:1` 授 1:1 才與 target 對齊;
    player「走廊」在淨空驗證中是 z=0 原點抽象,render camera 另有 standoff——此空間不一致為既知佔位妥協(main.ts 註),
    正式 display scale 待 WP-6 drill config。實機 camera/props 對位屬 T2 DoD 的人工瀏覽器驗證項。
  - Node headless 跑 `GLTFLoader.parse` 需 polyfill `ProgressEvent`(three.core 於解析完成派發),與 GLTF 本身合法性無關。
- **Open Questions / 待人工**:
  - T2 DoD 實機項(**須使用者在 Chrome/Edge 桌面版驗證**):(1) `npm run dev` → field-low 可見、既有 counter-strafe drill 全程無掉 tick
    (`sharedState.ticks` 監控);(2) 壞 URL / 斷網 → 自動 fallback 佔位房間成功(可暫改 `field-low.ts` asset.url 為壞路徑驗證);
    (3) `dispose()` 無殘留(場景切換於 T4 才有 UI,可先手動觀測)。驗證後把 task-checklist T2 由 🟡 翻 ✅。
  - field-low 視覺對位(props 與玩家/target 相對位置、camera standoff)如需微調:只改 `field-low.props.json` +
    `field-low.ts` `displayScale`/`proceduralRoom`,**不把場景知識推進 sim**(GD-6)。


- **Blast radius(CodeGraph)**:`SceneManager` 影響範圍為 `src/render/SceneManager.ts` + `src/main.ts` 呼叫點,local-to-render;`SceneConfig`/`validateScene` 影響 `DrillLoader`、clearance tests、harness/determinism 型別引用,屬跨模組 config contract,但不改 `src/sim` runtime。
- **實作**:
  - [../../../../../src/scene/SceneConfig.ts](../../../../../src/scene/SceneConfig.ts):保留 T3 已用的 `Vec3` AABB 形狀,補 `SceneAsset.displayScale?` 驗證與 render-only `proceduralRoom` 區塊(房間尺寸、eye height、FOV、顏色、光照),錯誤訊息維持 field-path。
  - [../../../../../src/scene/scenes/placeholder-room.ts](../../../../../src/scene/scenes/placeholder-room.ts):新增 `placeholder-room` config,`asset:null`、`propBounds:[]`、`playerCorridor.halfWidthU=1`,並用 `validateScene` 自驗。
  - [../../../../../src/render/SceneManager.ts](../../../../../src/render/SceneManager.ts):建構子改收 `SceneConfig`;`asset:null` 走 `proceduralRoom` 建出既有房間/光照/camera,GLTF asset 明確保留給 T2。
  - [../../../../../src/main.ts](../../../../../src/main.ts):啟動路徑改傳 `placeholderRoom`,佔位房間也走同一個 config 入口。
  - [../../../../../src/scene/architecture.test.ts](../../../../../src/scene/architecture.test.ts):新增架構閘,斷言 `src/sim`/`src/state` 不得 import `src/scene`。
- **測試**:
  - `npm.cmd test -- src/scene/SceneConfig.test.ts src/scene/architecture.test.ts src/render/SceneManager.test.ts src/scene/clearance.test.ts src/drill/DrillLoader.test.ts` → Vitest `5 passed` files / `24 passed` tests。
  - `npm.cmd run typecheck` → `tsc --noEmit` pass。
  - `npm.cmd test` → Vitest `45 passed` files / `333 passed` tests。
  - `npm.cmd run build` → `tsc --noEmit && vite build` pass(初次 sandbox 內 Vite config 存取被拒;提升權限重跑成功,僅既有 chunk-size warning)。
  - `graphify update .` → AST extraction `103/103 files`, graph rebuilt(`800 nodes`, `1746 edges`)。
- **Decision Log**:
  - `proceduralRoom` 採 optional render-only 區塊,而非把 placeholder 房間欄位塞進必填核心 contract。Alternatives Considered:強制所有 `asset:null` config 都帶 `proceduralRoom` 可更嚴格,但 T3/clearance 測試中的最小 SceneConfig 只需要 validator contract;本切片讓正式 placeholder 經 config 驗證,同時不擴大淨空測試 fixture 成本。
  - 保留現行 `Vec3` propBounds 形狀,不改成 stage3 README 範例 tuple。Alternatives Considered:同步切 tuple 可貼近文件範例,但已完成的 T3 clearance/DrillLoader contract 都以 `Vec3` 運作;T1 目標是 schema + placeholder 收編,不混入淨空幾何資料形狀遷移。
  - `SceneManager` 對 `asset !== null` 先 loud fail 並指向 T2。Alternatives Considered:靜默 fallback 到 placeholder 可讓任意 config 可建構,但會掩蓋 GLTF 管線尚未完成;T2 會把這條分支替換為 async loader + fallback。
- **Surprises & Discoveries**:
  - T3 已先落地 `SceneConfig` 最小 contract,因此 T1 不是從零新增 schema,而是把 contract 補完整並把 render 入口改成資料驅動。
- **Open Questions**:無新增。T2 需接手 `asset !== null` 分支與 fallback 同路徑。

### 2026-07-07 14:13Z — T0 entry gate PASS(GD-6/9 收斂 + 資產選型 + 硬約束回寫)
- **上游/M4 證據**:[../../../README.md](../../../README.md) 記錄 M4 ✅(2026-07-03),WP-19/20 上游門檻成立;[../../../completed/stage1/wp-9-integration/T5-exit-gate.md](../../../completed/stage1/wp-9-integration/T5-exit-gate.md) 宣告 M4 階段 A 交付。
- **基準驗證**:`npm.cmd test` → Vitest `43 passed` files / `326 passed` tests,exit 0。
- **GD-6 收斂證據**:
  - CodeGraph status:103 files / 1212 nodes / 2265 edges,index healthy;task context 只找到 render `SceneManager` 作為 scene 入口,未找到 sim scene 入口。
  - `rg -n "scene|SceneConfig|propBounds|clearance" src/sim src/state` → 無命中(exit 1 = no matches)。
  - `rg -n "clamp|clip|Math\.min|Math\.max" src/sim src/state` → 僅 `src/sim/MovementController.ts` 物理積分用 `Math.max/Math.min`;無場景位置 clamp/邊界 clamp。
  - 現行 `SceneManager` 註解明確宣告房間尺寸/眼高為 render 端佔位常數,不得流入 sim 或匯出資料;`src/main.ts` 的 `SIM_TO_WORLD = 0.01` 亦為 render-only display scale。
- **資產候選(OQ-S3-3;2026-07-07 查核)**:

| 候選 | 授權 | 來源 | source metadata / 量級 | 雜亂度對應 | 判定 |
|---|---|---|---|---|---|
| Kenney Nature Kit v1.0 | CC0 | https://kenney.nl/assets/nature-kit | Kenney 頁面列 `Category 3D`, `Files 330x`,tags nature/tree/rock/foliage。三角形/材質精確值待 T2 下載 GLTF 後量測;T2 budget:low-poly <=25 props、目標 <20k triangles、<=8 materials。 | `field-low` | **選定**。CC0、模組化、可做原創低雜亂 layout;授權與 repo commit 風險最低。 |
| Quaternius Ultimate Nature Pack | CC0 | https://quaternius.com/packs/ultimatenature.html | 頁面列 `Models 150`,格式 FBX/OBJ/Blend,Textured,CC0。需轉 GLTF;材質/triangles T2 量測。 | `field-low` fallback / nature prop pool | 備選。內容足,但格式轉換增加 T2 風險。 |
| Poly Pizza Walk in the Woods by Don Carson | CC-BY | https://poly.pizza/m/38m6Q1H12DU | 頁面列 small forest scene,OBJ/GLTF format,Creative Commons Attribution,顯示 38k 等 source metric。T2 仍需實測 triangles/materials 與 attribution。 | low-to-mid forest clutter | 備選/對照。GLTF 可用且補足 CC-BY 候選,但固定場景較容易碰視線走廊,且 attribution 必填。 |

- **OQ-19.1 決議**:`CLEARANCE_MARGIN_U = 0.5u`;`playerCorridor.halfWidthU = 1.0u`。Alternatives Considered:(a) halfWidth 0.5u,較不易誤擋但不能包住 T3 `field-low` fixture 與預期橫移走廊;(b) margin >0.5u,更保守但會放大誤擋與資產配置成本。採 0.5/1.0,若後續場景配置太窄,修 `propBounds`/layout 或 per-scene corridor,不改 sim。
- **OQ-19.2 決議**:WP-16 已留 `meta.scene` optional 區塊縫。Evidence:`src/data/metadata.ts` (`scene?: unknown`,collect args + spread),[../../../../operational/schema.md](../../../../operational/schema.md) `meta.scene` reserved optional,[../../../completed/stage2/wp-16-metrics-export-v2/README.md](../../../completed/stage2/wp-16-metrics-export-v2/README.md) stage3 前置欄位。
- **CLAUDE.md §4 回寫**:追加 GD-6「場景幾何永不進 sim runtime」與 GD-9「場景資產授權白名單 CC0/CC-BY;NC/遊戲抽取/付費包原始檔禁入 repo」兩條硬約束。
- **文件更新**:[task-checklist.md](task-checklist.md) T0 翻 ✅;[T0-entry-gate.md](T0-entry-gate.md) status 翻 ✅;[../README.md](../README.md) OQ-S3-3 指向本 ledger。
- **Surprises & Discoveries**:WP-19 實際歷史已有 T3 先於 T0/T1/T2 完成,且 repo 已存在 `src/scene`/`DrillLoader(scene?)`。T0 仍採 docs-only gate 補齊決策與授權紀律,不改任何 `src/`。
- **Entry-gate conclusion**:**PASS**。`git diff --stat` 不含 `src/`;T1/T2 可依本 ledger 繼續,但 T2 下載資產後必須重新量測 triangles/materials 並補 `ATTRIBUTIONS.md`。

### 2026-07-07 — T3 追記:PR #10 review 修復(waypoints NaN 靜默穿越淨空門)
- **來源**:[PR #10](https://github.com/ziy900409/FPS_aim_analyst/pull/10) Codex inline comment(P2,`clearance.ts:111`),人工逐步驗證**成立**:
  非 Vec3 waypoint 元素(如 `{x:1}`、字串)可通過 `validateDrill`(當時僅驗 `Array.isArray`)→
  `expandForMotion` 的 `center.x + undefined = NaN` 污染 envelope → `clipAxis` 的 NaN 比較使
  `segmentIntersectsAabb` 對所有線段回 false → **零 violations,`loadDrill(source, scene)` 把「未檢查」當「淨空」放行**——與驗證器保證語意相反(GD-6/OQ-6.4)。
- **修復(雙層)**:
  - [../../../../../src/drill/schema.ts](../../../../../src/drill/schema.ts) 主修:`validateMotion` 逐元素驗 waypoint 為有限數 Vec3(`requireFiniteNumber`,錯誤帶索引路徑 `targets.motion.waypoints[i].x`),並收斂為純 `{x,y,z}`;偏移相對 center 可負可零,故只驗有限、不驗正。
  - [../../../../../src/scene/clearance.ts](../../../../../src/scene/clearance.ts) 縱深:`deriveTargetEnvelopes` 內 `assertFiniteEnvelope`——envelope 任一邊界非有限即 throw,繞過 schema 的呼叫端或未來回歸也無法靜默穿門。
- **測試**(+6,全綠):schema 合法負偏移/收斂 ×1、非物件元素/缺欄位/NaN/Infinity ×3;clearance NaN envelope loud-fail ×1;DrillLoader 端到端重現 Codex 情境(malformed waypoint + scene → schema 層拒載)×1。
- **驗證**:`tsc --noEmit` pass;`npm.cmd test` → Vitest `40 passed` files / `304 passed` tests。
- **Decision Log**:
  - waypoints **形狀驗證**提前收緊,**語意深驗**(點數下限、speed 配套)仍留 WP-6.5。Alternatives Considered:(a) 全面禁載 waypoints 直到 WP-6.5——會破壞附錄 G 的 F5 接縫契約;(b) 只修 schema 不加 clearance 防線——淨空門是「保證」(GD-6),對「未檢查=放行」這類反向失效值得縱深,6 行成本。
  - 防線放 `deriveTargetEnvelopes`(而非 `validateClearance` 入口),讓 dev overlay 等直接呼叫端同樣受保護。
- **Surprises**:`clipAxis` 的 NaN 失效方向是「全綠」而非「全紅」——slab test 的 `tMin <= tMax` 對 NaN 恆 false,凡含 NaN 的軸一律判「不相交」。安全關卡若含浮點比較,NaN 路徑必須顯式測。

### 2026-07-06 — T3 clearance validator PASS
- **相依狀態**:目前工作樹尚未有完整 T1/T2 scene pipeline；本切片補上 T3 必要的 `SceneConfig` runtime contract 與純函式 validator，不改 `SceneManager`/GLTF/UI。
- **實作**:
  - [../../../../../src/scene/SceneConfig.ts](../../../../../src/scene/SceneConfig.ts):新增 `SceneConfig`/`PropBound` 型別與 `validateScene`，涵蓋 `sceneId`、`assetPackVersion`、`clutterTier`、`asset`、`propBounds min <= max`、`playerCorridor.halfWidthU`。
  - [../../../../../src/scene/clearance.ts](../../../../../src/scene/clearance.ts):新增 `validateClearance(scene, drill)`；目標包絡由現行 TargetManager 幾何常數對齊推導(`sideOffset=2`、`targetY=1.5`、`hitbox=1x2x1`)，motion `axis/range` 以保守極值擴張；玩家走廊取樣端點+中點，目標 AABB 取 8 角+中心，propBounds 膨脹 `TARGET_HITBOX_RADIUS_U + CLEARANCE_MARGIN_U(0.5u)` 後用 segment-vs-AABB slab test。
  - [../../../../../src/drill/DrillLoader.ts](../../../../../src/drill/DrillLoader.ts):`loadDrill(source, scene?)` 保持既有 `loadDrill(source)` 相容；傳入 scene 時執行 clearance gate，違規即 throw，訊息列出 prop id 與線段描述。
- **測試**:
  - [../../../../../src/scene/clearance.test.ts](../../../../../src/scene/clearance.test.ts):覆蓋靜態/移動目標包絡、恰相交紅、epsilon 間隙綠、玩家背後 prop 綠、motion 極值紅、`field-low` fixture × `counterstrafe_ad_v1` 淨空通過。
  - [../../../../../src/drill/DrillLoader.test.ts](../../../../../src/drill/DrillLoader.test.ts):新增 loader 拒載測試，錯誤訊息含 `blocking-crate`。
- **驗證**:
  - 指令:`npm.cmd test -- src/scene/SceneConfig.test.ts src/scene/clearance.test.ts src/drill/DrillLoader.test.ts src/drill/counterstrafe_ad_v1.test.ts tests/regression/determinism.test.ts` → Vitest `5 passed` test files / `33 passed` tests。
  - 指令:`npm.cmd test` → Vitest `40 passed` test files / `297 passed` tests。
  - 指令:`npm.cmd run typecheck` → `tsc --noEmit` pass。
- **Decision Log**:
  - `loadDrill` 採可選 `scene` 參數而非破壞既有簽名。Alternatives Considered:強制所有呼叫端立即傳場景可更嚴格，但 T1/T2/T4 尚未建立 scene registry/切換流程，會把 T3 擴成 UI/bootstrap 改造；可選參數讓選定場景的載入路徑先具備拒載 gate，並維持既有測試與 drill pipeline 相容。
  - T3 內建與現行 `TargetManager` 對齊的目標幾何常數。Alternatives Considered:從 `TargetManager` 匯出常數可減少重複，但會改動 sim 模組公開面；本切片保持 sim 無 scene 依賴，並用包絡單測鎖住數值對齊。
- **Surprises & Discoveries**:
  - WP-19 progress 仍標示 T0/T1/T2 未開始，且 CodeGraph/grep 均未找到 `src/scene`；T3 只能補 validator 所需的最小 SceneConfig contract，完整 placeholder-room 收編、GLTF 與 field-low 資產仍留給 T1/T2。
- **Open Questions**:
  - OQ-19.1 仍未正式 ledger 決議；T3 依計畫預設採 `CLEARANCE_MARGIN_U = 0.5u`，後續 T0 若改值需同步重跑 clearance fixtures。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T5 + T-exit)。
- 決議依據:GD-6(純裝飾 + 淨空驗證;prop-bounds 永不進 sim)、GD-9(寫實原創 + CC0/CC-BY;
  `sceneId` 中性命名、`assetPackVersion` 斷代)。
- 設計要點:佔位房間收編為 `SceneConfig`(`asset: null`)使 fallback 與正常路徑同構;
  `src/sim` 不得 import `src/scene`(GD-6 架構閘)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD 收斂驗證 + 資產選型,docs-only。
