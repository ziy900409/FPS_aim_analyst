# WP-46(暫用編號)— Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(覆核 §0 讀碼假設仍成立;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Low |
| ⬜ | **T1** hitbox `shape` 型別擴充 + `schema.ts` sphere 驗證 + `CLAUDE.md §4` GD-7 措辭更新 | [T1-hitbox-shape-gd7.md](T1-hitbox-shape-gd7.md) | T0 | Med |
| ⬜ | **T2** `HitDetector.ts` sphere ray-intersection 分支 | [T2-hitdetector-sphere.md](T2-hitdetector-sphere.md) | T1 | Med |
| ⬜ | **T3** `TargetView.ts` `setShape()` + `main.ts` 接線 | [T3-targetview-render.md](T3-targetview-render.md) | T1 | Low |
| ⬜ | **T4** `centerExemptFromTimeout` + `DrillRunner.ts` 邏輯 | [T4-center-timeout-exemption.md](T4-center-timeout-exemption.md) | T1 | Low-Med |
| ⬜ | **T5** `spider_shot_v2.ts` 數值更新(hitbox/timing/spiderShot/endCondition) | [T5-spider-shot-v2-config.md](T5-spider-shot-v2-config.md) | T2, T3, T4 | Low |
| ⬜ | **T-exit** 驗收;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1+T2+T3+T4+T5 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §5](../README.md) 的 WP-46 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的紀律

1. **不得修改 `src/drill/spider_shot_v1.ts`**:`spider-shot-v1` 是 WP-39 凍結校準值,本 WP 只調整 `spider-shot-v2`。
2. **不得修改 `src/metrics/spiderShotConditions.ts`/`spiderShotMetrics.ts`/`src/metrics/trackingDerivation.ts`**:三者皆不需感知 `shape` 欄位(§0 讀碼結論)。
3. **T1 完成後,先跑一次全專案既有測試矩陣全綠才能繼續**——`shape` 是新增到一個被 23 個檔案消費的既有型別,零回歸是後續所有 task 的前提。
4. **T4 的 DoD 必須同時包含「centerExemptFromTimeout 開啟時 center 不逾時」與「spider-shot-v1(未設此欄位)逾時行為逐位不變」兩個測試**,不可只驗證新行為。
5. **`docs/exec-plan/DECISIONS.md` 本 WP 不寫入**——延後理由與正式編號指派時機見 [README.md §0-3](README.md#0-讀碼對帳brainstorming-對話2026-08-26) / Constraints。
