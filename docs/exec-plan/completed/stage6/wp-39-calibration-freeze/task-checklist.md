# WP-39 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 WP-33~38 全部 T-exit;彙整 pilot-candidate 清單;開新 OQ-S6-24/25) | [T0-entry-gate.md](T0-entry-gate.md) | WP-33~38 T-exit | Low |
| ✅ | **T1** `src/pilot/pilotConfigs.ts`:近/中/遠距離、可見門檻候選、Spider Shot 角度範圍、`holdDurationMs`、`assessmentFeedbackPolicy` 候選產生器 + pilot seed roster | [T1-pilot-config-tool.md](T1-pilot-config-tool.md) | T0 | Med |
| ✅ | **T2** 凍結機制:`STAGE6_PROTOCOL_VERSION`、`DIAGNOSIS_THRESHOLDS_V1`、四協定 config 定案數值、`DECISIONS.md` 記錄 | [T2-numeric-freeze.md](T2-numeric-freeze.md) | T1 | Med |
| ✅ | **T3** `acceptance-stage-f.md` 驗收清單 F + 跨家族一致性回歸測試 | [T3-acceptance-checklist-f.md](T3-acceptance-checklist-f.md) | T2 | Med |
| ✅ | **T-exit(M16)** 驗收清單 F 全項通過;`pilot-protocol-stage6.md` 定稿;文件對帳;stage6 狀態翻 ✅ | [T-exit-gate.md](T-exit-gate.md) | T3 | — |

**T0 已於 2026-08-25 放行**:WP-33~38 的 T-exit 均已驗證 ✅;T1/T2/T3 皆為收斂既有 pilot-candidate 標記的工作,設計複雜度低。一 task = 一垂直切片 = 一原子 commit 紀律不變。**T-exit 已於 2026-08-25 完成,M16(stage6 交付)達成。**

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-39 狀態列更新,並確認 M16 驗收清單 F 全項通過。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的四條紀律

1. **T0 entry 是機械判準,不是建議**:WP-33~38 任一未 T-exit,本 WP 一律停在 T0。
2. **凍結一律升版,不得原地改語意**:`protocolVersion`/`recommendationVersion`/`DiagnosisThresholds.version` 任一凍結動作都必須是新字串,舊值保留供追溯。
3. **Pilot 資料流的唯一守門是 `mode: 'practice'`**:不新增第二套「這是 pilot 資料」的旗標欄位。
4. **凍結數值來源必須可追溯到 pilot 匯出資料的實際計算**:`DECISIONS.md` 記錄凍結決策時附上依據。
