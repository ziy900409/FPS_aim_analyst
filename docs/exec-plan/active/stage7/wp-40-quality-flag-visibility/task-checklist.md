# WP-40 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(覆核 §0 讀碼發現;拍板 §2①②③④ 四個小決策;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Low |
| ✅ | **T1** `ResultScreen.ts`:`QUALITY_FLAG_IDS` + `createQualityFlagSummary()` + `show()` additive 第 4 參數 + 兩層嚴重度 | [T1-quality-flag-card.md](T1-quality-flag-card.md) | T0 | Low |
| ✅ | **T2** `metadata.ts`/`SessionSetup.ts` additive `dpi`;`main.ts` `collectMeta` 接線 | [T2-dpi-metadata.md](T2-dpi-metadata.md) | T0(可與 T1 並行) | Low |
| ⬜ | **T-exit** 驗收 FR-G1/FR-G2;`npm run test:ci` 全綠;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1 + T2 | — |

T1/T2 檔案熱區互不重疊,可並行;T-exit 需等兩者完成才能一次性覆核 `main.ts` 彙整無衝突。一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-40 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的三條紀律

1. **不得修改 WP-38 `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary()`**:quality-flag 卡片是獨立新增的呈現單元(README §0-1/§3)。
2. **`dpi` 不得流入任何 `src/metrics/*` 計算**:純 additive 記錄欄位(README §3)。
3. **兩層嚴重度不得省略**:quality-flag 彙總必須明確產出 `overallSeverity: 'ok' | 'warn' | 'retest-recommended'`(README §2②)。
