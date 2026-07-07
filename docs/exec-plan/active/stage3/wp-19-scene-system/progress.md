# WP-19 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T0 entry gate + T3 clearance validator complete; T1/T2 full scene pipeline still pending

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 SceneConfig schema | ⬜ |
| T2 GLTF 管線 + field-low | ⬜ |
| T3 淨空驗證器 | ✅ |
| T4 場景切換 + meta | ⬜ |
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
