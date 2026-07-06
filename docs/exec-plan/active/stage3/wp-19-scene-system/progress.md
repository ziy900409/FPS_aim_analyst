# WP-19 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T3 clearance validator complete; T1/T2 full scene pipeline still pending

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
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
| OQ-S3-3 場景資產選型(3 候選比 draw calls/授權/雜亂度對應) | ⬜ open | — |
| OQ-19.1 `CLEARANCE_MARGIN_U` 起點值(計畫預設 0.5u)與玩家走廊 `halfWidthU` 預設 | ⬜ open | — |
| OQ-19.2 meta.scene 落點確認:WP-16 已留 optional 區塊縫?(未留 → T4 與 WP-16 對帳) | ⬜ open | — |

---

## Log

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
