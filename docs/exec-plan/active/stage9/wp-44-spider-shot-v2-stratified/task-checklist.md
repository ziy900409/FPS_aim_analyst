# WP-44(暫用編號)— Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(覆核 §0 讀碼假設仍成立;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Low |
| ✅ | **T1** `DrillConfig.ts` union 擴充 + `schema.ts` 新分支驗證 | [T1-schema-types.md](T1-schema-types.md) | T0 | Low |
| ✅ | **T2** `TargetManager.ts` 共用三角函式抽取 + 12 格洗牌佇列 | [T2-target-manager-stratified.md](T2-target-manager-stratified.md) | T1 | Med |
| ⬜ | **T3** `spider_shot_v2.ts` + `main.ts` 註冊 | [T3-drill-v2-registration.md](T3-drill-v2-registration.md) | T2 | Low |
| ⬜ | **T-exit** 驗收;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1+T2+T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §5](../README.md) 的 WP-44 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的紀律

1. **不得修改 `src/drill/spider_shot_v1.ts`**:`spider-shot-v1` 是 WP-39 凍結校準值,本 WP 只新增 `spider-shot-v2`。
2. **不得修改 `src/metrics/spiderShotConditions.ts`/`spiderShotMetrics.ts`**:v2 與 v1 共用同一套 condition-cell/五類指標推導(§0 讀碼結論)。
3. **`TargetManager.ts` 的共用三角函式抽取(T2)完成後,先跑一次既有 `TargetManager.test.ts` 全綠才能繼續**——v1 的世界座標精確斷言是唯一的回歸防線。
