# WP-41 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(覆核 §0 讀碼發現;正式拍板 FR-G7 三協定關閉 + Spider Shot 分支去留;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Med |
| ⬜ | **T1** `sessionSchedule.ts`:`TestFamilyId` + `buildFamilyOrder()`(Latin-square 輪轉)+ 決定性測試 | [T1-build-family-order.md](T1-build-family-order.md) | T0 | Low |
| ⬜ | **T2** 依 T0 判定:關閉分支只補文件;採納分支交付 Spider Shot seed 覆寫函式 | [T2-condition-schedule-scope.md](T2-condition-schedule-scope.md) | T0(可與 T1 並行) | Low~Med |
| ⬜ | **T-exit** 驗收 FR-G6 全綠 + FR-G7 判定已記錄;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1 + T2 | — |

T0 是本 WP 唯一的風險集中點(README §0 已備妥讀碼證據,但仍須正式覆核 + 拍板);T1 完全不需要等 FR-G7 判定結果,可與 T0 並行草擬。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-41 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的四條紀律

1. **禁 `Math.random()`/`Date.now()`**:`buildFamilyOrder`/任何 seed 生成函式一律決定性算術或既有 seeded RNG(README §6)。
2. **不得修改 `src/drill/*.ts` 四個協定本體**:`git diff` 對四個 drill config 檔案必須為空(README §1.1/§6)。
3. **`TestFamilyId` 不得與 `taskId`/`drillId` 混用**:`sessionSchedule.ts` 不得 import `src/drill/*.ts` 的任何 `DrillConfig` 常數(README §2①註/§6)。
4. **FR-G7 若判定關閉,不得保留死程式碼**:關閉分支的 T2 只交付文件,不新增未被消費的函式/型別(README §6)。
