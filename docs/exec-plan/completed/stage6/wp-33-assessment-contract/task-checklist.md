# WP-33 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 M4/WP-20 exit + §0.1 讀碼對帳凍結 + §2 七項契約凍結;`analysis-assessment-contract.md` 起稿;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | M4 ✅ + WP-20 ✅ | Low |
| ✅ | **T1** `DrillConfig.mode` + `Meta.assessment` additive 型別/驗證 | [T1-metadata-extension.md](T1-metadata-extension.md) | T0 | Low |
| ✅ | **T2** 共同事件時間線型別凍結(欄位形狀,不含計算) | [T2-event-timeline-contract.md](T2-event-timeline-contract.md) | T0(可與 T1 並行) | Low |
| ✅ | **T3** `checkCompatibility()` / `checkQualityGate()` 純函式 + 單元測試 | [T3-compatibility-quality-gate.md](T3-compatibility-quality-gate.md) | T1 | Med |
| ✅ | **T-exit** `analysis-assessment-contract.md` 定稿 + 文件對帳 + WP-33 狀態收斂,開放 WP-34~37 entry | [T-exit-gate.md](T-exit-gate.md) | T2 + T3 | — |

**T2 只依賴 T0**(不需要 `AssessmentMeta` 型別)→ 可與 T1 並行;一 task 一 commit 的紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-33 狀態翻 ✅。
- **單一閘貼證據**:`npm run test:ci`(本 WP 不動 `research/`,不需要 `uv run pytest`)。

## 本 WP 特有的三條紀律

1. **零引擎邏輯**:只交付型別 + 純函式;任何讀取場景/sim/render 狀態的程式碼一律不屬於本 WP,若發現需要,回頭檢視是否越界到下游 WP 的職責。
2. **既有構念禁第二定義(C-D4)**:`gameMovementProfile` 必須引用 `meta.movementModel`;`sessionId` 必須用推導函式,不得新增儲存欄位。`recommendationVersion`/`qualityGateStatus` 不進 `Meta.assessment`。
3. **既有匯出零回溯相容成本**:`DrillConfig.mode` 與 `Meta.assessment` 皆為可省略的 additive 欄位;既有測試**零修改**全綠是機械判準。
