# WP-39 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-39.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

- [x] (2026-08-25 07:50Z) **T0 entry gate** — WP-33、WP-34、WP-35、WP-36、WP-37、WP-38 的 task checklist 均確認 T-exit 為 ✅，WP-39 已放行。重新搜尋 `src/` 的 `pilot candidate|WP-39` 標記，現有候選位置為 `hold_track_v1.ts`、`spider_shot_v1.ts` 與 `diagnosisRules.ts`；沒有發現 WP-38 新增的 history candidate。既有 assessment seeds 為 hold-click `34034`、hold-track `35035`、spider-shot `36036`、counterstrafe-cued `37001`、counterstrafe-reversal `37002`，故 T1 使用自 `90000` 起的不相交 pilot roster。
- [x] (2026-08-25 07:50Z) **T1 pilot config tool** — 新增四個 deterministic practice config builders、`90000` 起的分家族 seed roster、feedback-policy 候選與 `main.ts` 的可覆寫 export policy 參數；新增 `pilotConfigs.test.ts`（5 passed）並通過完整 `npm run test:ci`（123 files / 940 Vitest tests + 21 Playwright tests）。`pilot-protocol-stage6.md` 已起稿。
- [x] (2026-08-25 07:50Z) **T2 numeric freeze** — `main.ts` 的 Assessment 匯出已改讀 `STAGE6_PROTOCOL_VERSION = '1.0.0'`，診斷改讀 `DIAGNOSIS_THRESHOLDS_V1`，舊 pilot candidate 保留；四個協定與歷史 window/minN 使用具名凍結常數。目標回歸 6 files / 22 tests、`npm run typecheck` 與完整 `npm run test:ci` 均通過。
- [x] (2026-08-25 07:50Z) **T3 acceptance F** — 新增 12 項可追溯驗收清單與跨家族 shared/exclusive event contract 回歸測試。

## Decision Log

- **D-39.1 (2026-08-25)** — (1) OQ-S6-24 在 WP-39 內收斂：保留 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 作歷史記錄，T2 新增正式版本化常數，並在 T-exit 回寫 stage6 README，而非另開 README-only task。替代方案：立即回寫上層 README；未採用，因它不改變 T1/T2 的實作決策。(2) OQ-S6-25 採單一 `holdDurationMs` 候選格，而非近/中/遠分層：現行 `counterstrafe-reversal-v1` 與 `analysis-counterstrafe.md` 只有 `500ms` 的單一協定語意，框架需求也未要求該維度分層；T1 僅掃描候選值陣列，T2 只凍結一個正式值。替代方案：距離式分層；未採用，因沒有資料或協定需求支持另一套 condition cell。
- **D-39.2 (2026-08-25)** — Hold-click 的 visibility threshold 不是 `DrillConfig` 欄位，故 `buildHoldClickPilotConfigs()` 回傳結構上仍為有效 `DrillConfig` 的 `PilotHoldClickConfig`，並在其旁保留 `visibility = { sampleCount: 9, onsetThreshold }`。替代方案：把分析門檻塞入 `DrillConfig`；未採用，因那會把離線推導參數誤增為 simulator schema，違反既有推導注入契約。
- **D-39.3 (2026-08-25)** — 本次四個 assessment 家族同步發布 `protocolVersion = '1.0.0'`，並以既有 pre-registered candidate 作為暫定正式數值；沒有已提交的人類 pilot export，因此 `DECISIONS.md` 明列此限制與後續只能升版覆蓋的規則。OQ-S6-26 選定 `minimal-end-of-block` 作預設而保留兩個型別值；OQ-S6-27 選同步發布而非分批。

## Surprises

- Hold-click 的 onset threshold 目前只由離線 `deriveVisibilityTimeline()`/`deriveHoldClickMetrics()` 注入，並非 drill schema 欄位；已用 D-39.2 的 companion 描述保持候選與可執行 practice config 同步，沒有擴張 runtime schema。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-24 | `diagnosisRules.ts` pilot-candidate 門檻未被 README §7 原始清單收錄 | ✅ closed — T2 版本化凍結，T-exit 回寫上層 README |
| OQ-S6-25 | `counterstrafe-reversal-v1` holdDurationMs 是否需要分層條件格 | ✅ closed — 單一候選格；不建立近/中/遠分層 |
| OQ-S6-26 | `assessmentFeedbackPolicy` 型別是否收斂 | ✅ closed — 預設 `minimal-end-of-block`，保留兩個既有型別值 |
| OQ-S6-27 | 四家族 `protocolVersion` 是否需同時凍結發布 | ✅ closed — 四家族同步發布 `1.0.0` |
