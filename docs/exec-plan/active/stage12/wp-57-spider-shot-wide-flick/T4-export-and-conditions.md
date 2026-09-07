# WP-57 T4 — 匯出 Metadata Round-trip 與 `side` 條件欄位

## Objective

保證離線分析能在零額外假設下重建刺激幾何（含 aspect，那是目前唯一不在匯出裡的量），並為左右分區補上 `side`。**既有 `D_deg`／`W_deg`／`quadrant`／`targetConditionCell` 一律不動。**

## Steps

1. 確認 `main.ts:741` 的既有行為：`activeDrillConfig.spiderShot` 整塊被複製進 `meta.spawn.spiderShot`（opaque `unknown`）。因此 resolved 參數只要在 resolved config 裡就會自動落匯出——本 task 要做的是**證明**而非新增管線。
2. 撰寫 metadata round-trip 測試：以 resolved config 產生匯出 → `parseExportPayload` → 斷言 `yawMagDegRange`／`pitchDegRange`／`distanceU`／`grid`／`seed`／`resolvedFrom` 五個欄位逐位還原。
3. 斷言 `meta.targets.hitbox` 與 resolved config 的 hitbox 同源（GD-7），且 `W_deg` 由它推導後與角徑候選值（2.0°）相符至數值誤差內。
4. 在 `src/metrics/spiderShotConditions.ts` 為 `SpiderShotTransition` 新增 additive optional `side?: 'L' | 'R'`：
   - 僅對 `direction === 'center-to-peripheral'` 輸出；
   - 由抵達點的 **eye-frame x 符號**推導（`x > 0 → 'R'`、`x < 0 → 'L'`；`x === 0` 時不輸出 `side` 而非猜測）；
   - eye 取自既有 `resolveEyeOrigin()`，**不新增第二套 eye 來源**。
5. 回歸斷言：對既有 v1/v2 fixture，`angularDistanceDeg`／`angularSizeDeg`／`quadrant`／`targetConditionCell`／`worldDistanceU`／`hitbox`／`seed` 的輸出**逐位不變**；新增的 `side` 在 v1/v2 payload 上因 `x` 由 azimuth 決定而可能出現，需明確測試其值與 azimuth 象限一致（不得矛盾）。
6. 撰寫 `cm/360` 離線推導的可行性測試：由 `meta.dpi` + `meta.sensitivityRatio` + `mouseGain.ts` 的 gain 模型算出 `counts/360` 與 `cm/360`，對已知輸入比對手算值。`meta.dpi` 缺席時回傳 `undefined` 而非猜測（供 T5 使用）。
7. 更新 `docs/operational/analysis-spider-shot.md`：新增 wide 變體段落，明列 eye-frame 幾何、`side` 語意、以及「v1/v2 的 `side` 恆為 `'R'` 僅為型別佔位」的差異。
8. 更新 `CONTEXT.md`：新增 `center-peripheral-yawpitch`／eye-frame 球面／`resolvedFrom`／`side` 語意四個術語條目。
9. 跑全量 metrics／export／history parser regression。

## Invariants

- `targetConditionCell` 格式固定為 `spider:d=<6 位小數>;w=<6 位小數>`，**不含 pitch、不含 side**（pitch 是干擾項，FR-57.5）。
- 不新增第二套夾角或角徑公式（C-D4）；`side` 只是既有座標的符號讀取。
- 不修改 `spiderShotMetrics.ts`。
- `meta` 不新增任何非 optional 欄位；舊 payload 解析結果不變。

## Definition of Done

- [x] resolved 參數（含 `resolvedFrom` 五欄）round-trip 逐位還原。
- [x] hitbox 單一來源與 `W_deg` 對帳綠（GD-7）——eye-frame 修正後 `W_deg` 即設計值 2.0°。
- [x] `side` 正負向測試齊全（右／左／`x === 0` 三種），且只對 center-to-peripheral 輸出。
- [x] 既有 v1/v2 fixture 的七個欄位輸出逐位不變。
- [x] `cm/360` 離線推導對已知輸入比對手算值相符；`meta.dpi` 缺席時回 `undefined`（欄位級）。
- [x] `analysis-spider-shot.md` 與 `CONTEXT.md` 已更新並自我對帳（術語與實作一致）。
- [x] 全量 metrics／export／history regression exit 0（全量 Vitest 2,373 tests、兩個 typecheck、build 皆 exit 0）。

## Commit

```text
feat(metrics): expose spider wide stimulus provenance and side label
```
