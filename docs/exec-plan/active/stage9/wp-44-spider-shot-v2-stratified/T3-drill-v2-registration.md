# T3 — `spider_shot_v2.ts` + `main.ts` 註冊

> Part of [WP-44](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 |
| **Risk / Cplx** | Low / Low(沿用 v1 已驗證的 `sceneId` 修法,不重踩 KI-011) |
| **Touches** | ADD `src/drill/spider_shot_v2.ts`、ADD `src/drill/spider_shot_v2.test.ts`;MODIFY `src/main.ts` |
| **狀態** | ✅ |

## Objective

新增可實際載入/執行的 `spider-shot-v2` drill config,並註冊進 `availableDrills`,讓使用者可以在啟動畫面選到它。

## Steps

- [x] `src/drill/spider_shot_v2.ts`:`drillId: 'spider-shot-v2'`,`mode: 'assessment'`,沿用 `SPIDER_SHOT_HITBOX_V1`/`centerDistanceU=8`/`distanceURange=[8,8]`;`spiderShot.kind: 'center-peripheral-stratified'`,`peripheral.angularRadiusDegRange: [10, 25]`(候選值,未經 pilot 校準,檔案註解標明,對話拍板 OQ-S9-1);`grid: { azimuthQuadrants: 4, radiusTiers: 3 }`;新 seed(不重用 v1 的 36036)。
- [x] `src/main.ts`:`availableDrills` 新增 `{ id: spiderShotV2.drillId, label: spiderShotV2.drillId, source: spiderShotV2, sceneId: 'placeholder-room' }`(沿用 KI-011 鎖定的零 propBounds 場景)。
- [x] `src/drill/spider_shot_v2.test.ts`:比照 `spider_shot_v1.test.ts`,斷言 `loadDrill(spiderShotV2)` 回傳正確的 stratified schedule 形狀。
- [x] `npx tsc --noEmit` + `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `spider-shot-v2` 可被 `loadDrill()` 成功載入,形狀符合 stratified schedule | 新測試 |
| ② | `main.ts` 註冊沿用 `sceneId: 'placeholder-room'`,不重踩 KI-011 | diff 可見 |
| ③ | 全專案測試/型別檢查綠 | `npm run test:ci`(或等價 `tsc`+`vitest`) |

## Commit

`feat(wp-44): T3 — 新增 spider-shot-v2 drill config 並註冊進 availableDrills`
