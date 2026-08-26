# T1 — `DrillConfig.ts` union 擴充 + `schema.ts` 新分支驗證

> Part of [WP-44](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Low / Low(型別擴充 + 驗證分支,不動任何執行期取樣邏輯) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/drill/schema.test.ts` |
| **狀態** | ✅ |

## Objective

把 `SpiderShotScheduleConfig` 從單一 interface 改成 discriminated union(`center-peripheral` / `center-peripheral-stratified`),`schema.ts` 新增對應驗證分支,先把型別契約釘死——T2 的 `TargetManager` 實作才有型別可以窄化分派。

## Steps

- [x] `DrillConfig.ts`:`SpiderShotScheduleConfig` 原 interface 重新命名為 `SpiderShotCenterPeripheralConfig`(形狀逐位不變);新增 `SpiderShotStratifiedGridConfig`(`azimuthQuadrants`/`radiusTiers`)與 `SpiderShotStratifiedConfig`(承 `SpiderShotCenterPeripheralConfig` 形狀 + `grid`);`SpiderShotScheduleConfig` 改為兩者的 union;文件註解點名新 `grid` 分箱與既有 `SpiderQuadrant` 呈現層標籤是兩套不同分類。
- [x] `schema.ts`:`validateSpiderShotSchedule` 依 `spiderShot.kind` 分派兩個分支;抽出共用的 `validateSpiderPeripheral()`(`options.requireNonDegenerateRadius` 供 stratified 分支要求 `min < max`);stratified 分支新增 `grid.azimuthQuadrants`/`grid.radiusTiers` 正整數驗證。
- [x] `schema.test.ts`:新增「stratified 合法 config 保留欄位」+「stratified 拒絕退化 radius range / 非正整數 grid / 未知 kind」測試,並確認既有 39 個測試(含 v1 spiderShot 分支)零改動全綠。
- [x] `npx tsc --noEmit` 全專案型別檢查綠(確認 union 擴充沒有波及 `TargetManager.ts`/`main.ts` 既有的 `spiderShot?.seed` 等共同欄位存取)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `SpiderShotScheduleConfig` 為 union,`center-peripheral` 形狀逐位不變 | `DrillConfig.ts` diff |
| ② | `schema.ts` 兩分支驗證齊全(含負向測試) | `schema.test.ts` 新增案例全綠 |
| ③ | 既有 39 個 `schema.test.ts` 測試零改動全綠 | `npx vitest run src/drill/schema.test.ts` |
| ④ | 全專案型別檢查綠 | `npx tsc --noEmit` |

## Commit

`feat(wp-44): T0+T1 — spiderShot schedule config 擴充為 union,新增 stratified 分支型別/驗證`
