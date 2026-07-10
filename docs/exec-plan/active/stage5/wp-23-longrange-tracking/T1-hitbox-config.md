# T1 — hitbox config 化(單一來源 + 三消費點收斂;零破壞)

> Part of [WP-23 longrange-tracking](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(OQ-S5-4/OQ-23.1 決議) |
| **Risk / Cplx** | **High** / Med(動命中幾何——零破壞不變式與同幾何不變式是全部風險所在) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts` + `schema.ts`(`targets.hitbox?`)、`src/sim/TargetManager.ts`(HITBOX 常數 → config)、`src/sim/HitDetector.ts` / `src/render/TargetView.ts`(幾何來源)、`src/scene/clearance.ts`(`TARGET_HITBOX_U`/膨脹半徑 per-drill)、`src/metrics/trackingDerivation.ts`(options 由 meta 餵)、`src/data/metadata.ts` + `export.ts`(meta 快照)、`docs/operational/schema.md` + 測試 |
| **狀態** | ✅ PASS(2026-07-10) |

## Objective

目標 hitbox 從三處寫死常數變成 `DrillConfig.targets.hitbox?` 資料(FR-E1):
**單一來源**貫穿命中(sim)/渲染/淨空/離線推導;省略欄位的既有 drill **逐位不變**;
「命中 ⇔ on-target 同幾何」由測試釘死。

## In scope

- `DrillConfig.ts` + `schema.ts` 擴欄(additive 選填):
  `targets.hitbox?: { widthU, heightU, depthU }`;驗證(正有限、上限 sanity——
  過大 hitbox 會破壞角參數設計,上限值依 T0 決議)。
- **單一來源**(OQ-23.1 落點):預設常數 `{1,2,1}` 唯一宣告一處;`TargetManager` /
  `HitDetector` / `TargetView` / `clearance`(含 `TARGET_HITBOX_RADIUS_U` 派生的膨脹半徑)
  全部改為由 resolved config 取值;`trackingDerivation` 的 `options.hitbox` 優先讀
  `meta.targets.hitbox`、缺欄 fallback 既有 `DEFAULT_OPTIONS`(舊匯出向後相容)。
- `meta.targets` 快照含 hitbox(v2 additive)+ `schema.md` 對帳。
- **零破壞閘(DoD 首項)**:省略 `hitbox` 欄 → 全部既有測試零修改全綠
  (**先跑既有決定性/追蹤回歸再進新功能測試**,比照 WP-21 T1 模式)。
- **同幾何斷言(GD-7)**:邊緣開火 fixture——aim 打在 hitbox 邊緣內側/外側各一組,
  斷言 sim 命中結果與離線 `isOnTarget` 推導同真同假(用真匯出 round-trip 消費)。
- 小 hitbox smoke:`{0.5,1,0.5}` config 下命中/渲染/淨空/推導四端一致。

## Out of scope

- 遠距 drill config(T2)、round-trip 全鏈 fixture(T3)、頭/身分解(H1 不變)。

## Steps

- [ ] schema 擴欄 + 驗證測試(合法/非法/邊界值)。
- [ ] **既有回歸全綠**(改動前基準 → 單一來源重構後重跑,證據記 progress)。
- [ ] 三消費點 + HitDetector/TargetView 收斂到單一來源;膨脹半徑派生改 per-drill。
- [ ] meta 快照 + 推導端 meta 優先/fallback 邏輯 + schema.md 對帳。
- [ ] 同幾何邊緣 fixture + 小 hitbox smoke 測試。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 省略欄位:既有測試**零修改**全綠(逐位不變證據);同幾何邊緣 fixture 綠;
  單一來源(grep 舊常數字面值只剩一處宣告);meta 快照 + 推導 fallback 測試綠;
  schema.md 已對帳。

## Commit

`feat(wp-23): T1 hitbox config 化(單一來源貫穿命中/渲染/淨空/推導;預設零破壞)`
