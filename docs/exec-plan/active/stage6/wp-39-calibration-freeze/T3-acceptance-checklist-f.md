# T3 — 驗收清單 F + 跨家族一致性回歸測試

> Part of [WP-39 calibration-freeze](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(凍結完成,`protocolVersion`/診斷門檻/四協定數值已定案) |
| **Risk / Cplx** | Med / Med(本 task 的新增測試是**跨** WP-34/35/36/37 匯出格式的整合測試,需要同時載入四個協定的匯出型式) |
| **Touches** | ADD `docs/operational/acceptance-stage-f.md`、`tests/regression/stage6-cross-family-consistency.test.ts` |
| **狀態** | ⬜ |

## Objective

把框架 v1 §"v1 驗收條件"的 12 項逐一對照到 WP-33~38 六個 WP 既有的測試證據,產出 `acceptance-stage-f.md`(比照 [acceptance-stage-e.md](../../../../operational/acceptance-stage-e.md) 格式:每項附判定方式與證據入口)。**本 task 真正的新增工作**是第 2 項驗收條件——「三個任務的同名事件具有一致時間語意」——這條目前**沒有任何單一測試檔案跨四個測試家族同時驗證**(每個 WP 只驗證了自己家族內部的一致性);T3 需要新增 `stage6-cross-family-consistency.test.ts`,同時載入 `hold-click-v1`/`hold-track-v1`/`spider-shot-v1`/`counterstrafe-cued-v1` 四份合成匯出,正向斷言同名事件(如 `cue`、`fire`、`t_first_visible` 一類的共同時間線構念)語意一致,反向斷言家族特有事件型別(如 `cue` 不該出現在 `spider-shot-v1` 匯出中)不互相污染。

## In scope

1. 逐一覆核 12 項驗收條件(框架 v1 §"v1 驗收條件"),對照六個 WP 既有測試證據,寫入 `acceptance-stage-f.md`。
2. 新增 `tests/regression/stage6-cross-family-consistency.test.ts`:
   - 正向:同名事件(`cue`/`fire`/`visible`/共同 timeline 欄位)跨四個家族的型別與語意一致。
   - 反向:家族特有事件型別(`cue` 僅 `counterstrafe-*`、`spiderShot` 排程欄位僅 `spider-shot-v1`)不出現在其他家族匯出中。
3. 對「Assessment 與 Practice 不共用正式 baseline」「不相容 session 不會產生進步/退步結論」兩項,交叉確認 WP-33 `checkCompatibility()`/`checkQualityGate()` 與 WP-38 `sessionHistory.ts` 的既有測試已覆蓋,若有缺口記錄並補測試。
4. 對「所有新指標先通過現有 validity/quality gate 才能進推薦規則」一項,確認 `diagnosisRules.ts` 的短路邏輯(`qualityGateStatus !== 'ok'` → `insufficient-data`)測試存在。

## Out of scope

- T-exit 的最終文件對帳與 stage6 狀態翻轉(留給 T-exit)。
- 任何協定骨架或指標推導的新功能開發(本 task 只驗證,不新增能力)。

## Steps

- [ ] 逐項覆核 12 條驗收條件,記錄證據連結。
- [ ] 新增跨家族一致性回歸測試(正向 + 反向)。
- [ ] 交叉確認 Assessment/Practice 分離與品質閘短路邏輯的既有測試覆蓋。
- [ ] `acceptance-stage-f.md` 起稿。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 12 項驗收條件逐一有判定方式 + 證據入口 | `acceptance-stage-f.md` 內容完整 |
| ② | 跨家族一致性回歸測試(正向+反向)綠 | 新增測試檔案通過 |
| ③ | 缺口(若有)已記錄並補測試 | progress.md 記錄 |
| ④ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`test(wp-39): T3 — 驗收清單 F 起稿 + 跨家族一致性回歸測試`
