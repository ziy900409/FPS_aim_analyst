# WP-39 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-39.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

- [x] (2026-08-25 07:50Z) **T0 entry gate** — WP-33、WP-34、WP-35、WP-36、WP-37、WP-38 的 task checklist 均確認 T-exit 為 ✅，WP-39 已放行。重新搜尋 `src/` 的 `pilot candidate|WP-39` 標記，現有候選位置為 `hold_track_v1.ts`、`spider_shot_v1.ts` 與 `diagnosisRules.ts`；沒有發現 WP-38 新增的 history candidate。既有 assessment seeds 為 hold-click `34034`、hold-track `35035`、spider-shot `36036`、counterstrafe-cued `37001`、counterstrafe-reversal `37002`，故 T1 使用自 `90000` 起的不相交 pilot roster。

## Decision Log

- **D-39.1 (2026-08-25)** — (1) OQ-S6-24 在 WP-39 內收斂：保留 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 作歷史記錄，T2 新增正式版本化常數，並在 T-exit 回寫 stage6 README，而非另開 README-only task。替代方案：立即回寫上層 README；未採用，因它不改變 T1/T2 的實作決策。(2) OQ-S6-25 採單一 `holdDurationMs` 候選格，而非近/中/遠分層：現行 `counterstrafe-reversal-v1` 與 `analysis-counterstrafe.md` 只有 `500ms` 的單一協定語意，框架需求也未要求該維度分層；T1 僅掃描候選值陣列，T2 只凍結一個正式值。替代方案：距離式分層；未採用，因沒有資料或協定需求支持另一套 condition cell。

## Surprises

(尚無)

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-24 | `diagnosisRules.ts` pilot-candidate 門檻未被 README §7 原始清單收錄 | ✅ closed — T2 版本化凍結，T-exit 回寫上層 README |
| OQ-S6-25 | `counterstrafe-reversal-v1` holdDurationMs 是否需要分層條件格 | ✅ closed — 單一候選格；不建立近/中/遠分層 |
| OQ-S6-26 | `assessmentFeedbackPolicy` 型別是否收斂 | 🟡 open — 待 T2 |
| OQ-S6-27 | 四家族 `protocolVersion` 是否需同時凍結發布 | 🟡 open — 待 T2 |
