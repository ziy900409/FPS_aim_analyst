# WP-39 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-39.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

- [x] (2026-08-25 07:50Z) **T0 entry gate** — WP-33、WP-34、WP-35、WP-36、WP-37、WP-38 的 task checklist 均確認 T-exit 為 ✅，WP-39 已放行。重新搜尋 `src/` 的 `pilot candidate|WP-39` 標記，現有候選位置為 `hold_track_v1.ts`、`spider_shot_v1.ts` 與 `diagnosisRules.ts`；沒有發現 WP-38 新增的 history candidate。既有 assessment seeds 為 hold-click `34034`、hold-track `35035`、spider-shot `36036`、counterstrafe-cued `37001`、counterstrafe-reversal `37002`，故 T1 使用自 `90000` 起的不相交 pilot roster。
- [x] (2026-08-25 07:50Z) **T1 pilot config tool** — 新增四個 deterministic practice config builders、`90000` 起的分家族 seed roster、feedback-policy 候選與 `main.ts` 的可覆寫 export policy 參數；新增 `pilotConfigs.test.ts`（5 passed）並通過完整 `npm run test:ci`（123 files / 940 Vitest tests + 21 Playwright tests）。`pilot-protocol-stage6.md` 已起稿。
- [x] (2026-08-25 07:50Z) **T2 numeric freeze** — `main.ts` 的 Assessment 匯出已改讀 `STAGE6_PROTOCOL_VERSION = '1.0.0'`，診斷改讀 `DIAGNOSIS_THRESHOLDS_V1`，舊 pilot candidate 保留；四個協定與歷史 window/minN 使用具名凍結常數。目標回歸 6 files / 22 tests、`npm run typecheck` 與完整 `npm run test:ci` 均通過。
- [x] (2026-08-25 07:50Z) **T3 acceptance F** — 新增 12 項可追溯驗收清單與跨家族 shared/exclusive event contract 回歸測試。
- [x] (2026-08-25 10:20Z) **T-exit(M16)** — 覆核驗收清單 F 全 12 項(附證據連結,升為 F-1~F-12 對表 README §4 的 10 條條件);過程中發現並修復一筆 T2 遺留回歸:`tests/e2e/full-drill.spec.ts` 仍斷言舊 `recommendation-pilot-candidate-v1` 版本字串,未跟上 T2 把 `main.ts` 診斷讀取源換成 `DIAGNOSIS_THRESHOLDS_V1`(`recommendation-v1.0.0`)——修復後複驗單條 Playwright 測試通過,再跑完整 `npm run test:ci` 全綠(Vitest 125 files / 944 tests;Playwright 21 tests)。定稿 `acceptance-stage-f.md`(新增 §0 執行基線 + §2 已知限制 + §3 M16 判定)與 `pilot-protocol-stage6.md`(新增 §7 Freeze outcome,回填 GD-23 凍結值)。回寫 [CONTEXT.md](../../../../../CONTEXT.md) §K(pilot/凍結術語)。翻 [stage6 README](../README.md) 頂部狀態、§3 WP-39 列、§4 M16 里程碑、§7/§8 OQ 表(OQ-S6-1~6/12 標為暫定凍結、OQ-S6-24~27 收斂關閉)、§9 文件對帳清單。使用者拍板把 `completed/stage6/` 移入 `completed/stage6/`(2026-08-25),已隨本次 T-exit 一併執行,所有跨檔案路徑參照同步修正。

## Decision Log

- **D-39.1 (2026-08-25)** — (1) OQ-S6-24 在 WP-39 內收斂：保留 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 作歷史記錄，T2 新增正式版本化常數，並在 T-exit 回寫 stage6 README，而非另開 README-only task。替代方案：立即回寫上層 README；未採用，因它不改變 T1/T2 的實作決策。(2) OQ-S6-25 採單一 `holdDurationMs` 候選格，而非近/中/遠分層：現行 `counterstrafe-reversal-v1` 與 `analysis-counterstrafe.md` 只有 `500ms` 的單一協定語意，框架需求也未要求該維度分層；T1 僅掃描候選值陣列，T2 只凍結一個正式值。替代方案：距離式分層；未採用，因沒有資料或協定需求支持另一套 condition cell。
- **D-39.2 (2026-08-25)** — Hold-click 的 visibility threshold 不是 `DrillConfig` 欄位，故 `buildHoldClickPilotConfigs()` 回傳結構上仍為有效 `DrillConfig` 的 `PilotHoldClickConfig`，並在其旁保留 `visibility = { sampleCount: 9, onsetThreshold }`。替代方案：把分析門檻塞入 `DrillConfig`；未採用，因那會把離線推導參數誤增為 simulator schema，違反既有推導注入契約。
- **D-39.3 (2026-08-25)** — 本次四個 assessment 家族同步發布 `protocolVersion = '1.0.0'`，並以既有 pre-registered candidate 作為暫定正式數值；沒有已提交的人類 pilot export，因此 `DECISIONS.md` 明列此限制與後續只能升版覆蓋的規則。OQ-S6-26 選定 `minimal-end-of-block` 作預設而保留兩個型別值；OQ-S6-27 選同步發布而非分批。
- **D-39.4 (2026-08-25，T-exit)** — 規格書(`docs/規格書_...md`)**不**新增「階段 F」節：讀碼發現該檔自階段 C 起就沒有逐階段追加附錄的慣例(階段 E/BR 交付時也未新增專屬章節)，`stage6 README.md` + `acceptance-stage-f.md` 已是本階段的權威文件。替代方案：比照附錄 E-B/E-D 格式新增「附錄 E-F」；未採用，因會產生與 `acceptance-stage-f.md` 重複維護的第二份驗收敘述，增加未來對帳成本而無額外資訊量。
- **D-39.5 (2026-08-25，T-exit)** — T-exit 覆核 `npm run test:ci` 時發現 `tests/e2e/full-drill.spec.ts` 有一筆斷言仍讀取 T2 凍結前的 `recommendation-pilot-candidate-v1` 字串，屬 T2 落地時遺漏同步更新的既有測試(非本次新設計缺陷)。修復為斷言 `recommendation-v1.0.0`(即 `DIAGNOSIS_THRESHOLDS_V1.version`)。替代方案：略過該測試或放寬斷言；未採用，因會削弱這條 E2E 對「診斷版本字串確實從凍結常數讀出」的覆蓋力。

## Surprises

- Hold-click 的 onset threshold 目前只由離線 `deriveVisibilityTimeline()`/`deriveHoldClickMetrics()` 注入，並非 drill schema 欄位；已用 D-39.2 的 companion 描述保持候選與可執行 practice config 同步，沒有擴張 runtime schema。
- **T-exit 發現的回歸(2026-08-25)**：T2 progress 記錄「完整 `npm run test:ci` 均通過」，但當時的判定顯然未攔到 `tests/e2e/full-drill.spec.ts` 這條斷言舊版本字串的測試。T-exit 覆核時才被完整 `test:ci`(含 Playwright)攔到，已修復(見 D-39.5)。提醒：未來「凍結/改讀取源」類變更，務必連跑一次含 Playwright 的完整 `test:ci`，不能只憑 Vitest/typecheck 綠燈判定收斂。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-24 | `diagnosisRules.ts` pilot-candidate 門檻未被 README §7 原始清單收錄 | ✅ closed — T2 版本化凍結，T-exit 回寫上層 README |
| OQ-S6-25 | `counterstrafe-reversal-v1` holdDurationMs 是否需要分層條件格 | ✅ closed — 單一候選格；不建立近/中/遠分層 |
| OQ-S6-26 | `assessmentFeedbackPolicy` 型別是否收斂 | ✅ closed — 預設 `minimal-end-of-block`，保留兩個既有型別值 |
| OQ-S6-27 | 四家族 `protocolVersion` 是否需同時凍結發布 | ✅ closed — 四家族同步發布 `1.0.0` |
| OQ-S6-1/2/4/5/12(承 stage6 README) | 可見門檻/世界距離/Spider Shot 角度/`N=9`/baseline session 數的凍結值 | 🟡 provisionally closed(GD-23,2026-08-25) — 沿用既有 pre-registered 候選值凍結，**無真人 pilot 資料驗證**；未來資料出現須升版而非原地改，狀態已回寫 stage6 README §8 |
| OQ-S6-3 | 架槍速度/露出距離 levels | 🟡 收斂 — 併入 OQ-S6-2 距離維度，未獨立開速度軸(pilot config 產生器未提供速度候選) |

## T-exit `npm run test:ci` 全綠證據(2026-08-25 10:2x Z)

```
Test Files  125 passed (125)
     Tests  944 passed (944)
...
Running 21 tests using 14 workers
...
21 passed (30.3s)
```

修復前首次覆核曾在 Playwright `full-drill.spec.ts:150` 失敗(斷言舊 `recommendation-pilot-candidate-v1`);修復（`tests/e2e/full-drill.spec.ts` 改斷言 `recommendation-v1.0.0`，見 D-39.5）後複驗上述結果全綠。
