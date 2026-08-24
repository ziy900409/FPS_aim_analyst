# WP-38 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 WP-34+35+36+37 T-exit;重新覆核 WP-36/37 最終落地介面;拍板 OQ-S6-8 兩個子決策;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-34+35+36+37 T-exit | Med |
| ⬜ | **T1** `diagnosisRules.ts`:七模式規則表 + `evaluateDiagnosis()` + `recommendationVersion` + 優先序規則 | [T1-rule-engine.md](T1-rule-engine.md) | T0 | Med |
| ⬜ | **T2** `sessionHistory.ts` 聚合 + 依 T0 候選落地的 loader + Assessment/Practice 守門 | [T2-session-history.md](T2-session-history.md) | T1 | **Med–High** |
| ⬜ | **T3** `ResultScreen` diagnosis 區塊(封閉 metric id + n/flags/version)+ 個人歷史呈現 | [T3-result-presentation.md](T3-result-presentation.md) | T2 | Med |
| ⬜ | **T-exit** 驗收:診斷帶來源/`n`/flags/版本、不相容 session 不產生結論;`analysis-diagnosis.md` 定稿;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T3 | — |

**T0 是關鍵路徑與風險集中點**(需等待 WP-36/37 進度、拍板本 WP 最大兩個未知數 OQ-S6-8/OQ-S6-23);一旦 T0 拍板完成,T1 是純函式工作、風險最低。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-38 狀態列更新,並確認 M16(WP-39)entry 條件之一(四個測試家族 WP + 本 WP)已滿足。
- 單一閘:`npm run test:ci` 全綠;若 T0 選擇 Python history 候選,另加 `uv run pytest`。

## 本 WP 特有的四條紀律

1. **T0 不得在 WP-36/37 未 T-exit 前假裝介面已定案**:引用其草案欄位時必須註明待覆核,直到覆核完成才能移除註記。
2. **規則引擎(T1)是純函式,不得反過來定義新指標推導**:只讀既有輸出,不在 `diagnosisRules.ts` 內重算任何幾何或時間差(C-D4 精神延伸)。
3. **門檻一律版本化注入,不得寫死字面常數**:`DiagnosisThresholds` 每個欄位以命名常數或 fixture 值斷言(比照 visibility-v1 `onsetThreshold` 先例)。
4. **不相容/資料不足一律短路,不進入七模式判定**:`qualityGateStatus !== 'ok'` 或歷史 `n < minN` 時回傳 `insufficient-data`,測試證明短路邏輯先於七模式判定執行。
