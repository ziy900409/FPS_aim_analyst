# WP-38 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-38.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-24 | WP-34/35/36/37 的 T-exit 列皆為 ✅；重讀 `src/metrics/spiderShotMetrics.ts`、`counterstrafeMetrics.ts` 完成最終介面覆核；D-38.1/D-38.2 定案。零程式碼、零測試異動。 |
| T1 rule engine | ✅ | 2026-08-25 | 新增純函式 `diagnosisRules.ts`，以版本化注入門檻實作七種模式、quality-gate 短路與 deterministic primary-only 優先序；新增 12 組合成測試，含七模式、重疊證據、品質短路、單家族與門檻邊界。`npm run test:ci` 通過：TypeScript、Vitest 119 files / 923 tests、Playwright 21 tests。 |
| T2 session history | ✅ | 2026-08-25 | 新增純 `sessionHistory.ts`（相容性／quality-gate 守門、最新固定窗口、中位數與 population SD）與 TS 多檔 JSON loader（只接受 `meta.assessment`）；新增 7 個合成測試，覆蓋窗口、相容性排除、metric ID 排除、`minN` 短路、目前 quality gate、Practice 排除與無效 JSON。`npm.cmd run test:ci` 通過：TypeScript、Vitest 121 files / 930 tests、Playwright 21 tests。 |
| T3 result presentation | ✅ | 2026-08-25 | `ResultScreen` 新增封閉 `DIAGNOSIS_METRIC_IDS` 六卡呈現（label/evidence/version/quality gate），每筆 evidence 顯示來源、值、`n`、flags；`insufficient-data` 僅顯示「資料不足」原因。新增純 TS `HistoryView`，以手動多檔 Assessment JSON 選取呈現相容 history 的 speed/accuracy median + population SD，沒有趨勢箭頭或持久化。`main.ts` 由同一 `buildCurrentExportPayload()` 評估診斷、保存 Assessment provenance 並供 history loader 建立 current/past `SessionSummary`。`npm.cmd run test:ci` 通過：TypeScript、Vitest 122 files / 935 tests、Playwright 21 tests。 |

## Decision Log

### D-38.1 — OQ-S6-8:單次診斷留在 TS；歷史聚合與資料載入解耦(2026-08-24,T0)

**Decision:** `diagnosisRules.ts` 與單次 session 的診斷呈現落在 TS，接入 `ResultScreen` 既有的 optional promoted-metrics render seam。`sessionHistory.ts` 保持輸入 `SessionSummary[]` 的純聚合函式；資料載入由獨立 loader 提供，不能把檔案 I/O 混進聚合或規則判定。

**Rationale:** `ResultScreen` 的 `PROMOTED_METRIC_IDS`/optional `PromotedMetrics` 已是帶來源、n、flags、version 的可擴充呈現型式；所有診斷輸入亦由 TS 指標模組產生。這讓訓練結束時可立即得到診斷，不增加 Python 依賴或第二份規則實作。

**Alternatives considered:** Python offline 診斷——未採用：需將 TS 指標／規則結果另行序列化，且破壞即時結果呈現的單一入口；不比純 TS 減少工作。

### D-38.2 — OQ-S6-23:個人歷史選純 TS 多檔匯入，不新增 Python 目錄掃描(2026-08-24,T0)

**Decision:** T2 採候選①：在 TS 新增 `<input type=file multiple>` 的獨立 history loader/view；使用者手動選擇先前 JSON exports，loader 只接受 Assessment，並交給純 `sessionHistory.ts` 的 compatibility/quality 過濾。

**Rationale:** `research/fixtures/exports/` 是受控的測試 fixture corpus，不是教練資料夾工作流；`research/src/report/run_pipeline.py` 與 `coach_report.py` 都是 one-export-in 的單檔入口。候選②沒有可直接擴充的跨檔流程，且目前 export 不保存 TS 診斷結果；它還會新增 sidecar、Python 聚合與獨立呈現需求。粗估候選① 1.25–1.75 dev-days，候選② 2.0–2.75 dev-days。

**Alternatives considered:** Python 目錄掃描——未採用：雖與 offline research layer 同向，但沒有現有多檔教練流程可接；新增跨語言的診斷輸出合約會擴大 C-D1/C-D5 風險。瀏覽器自動持久化——未採用：T0 未發現現有 localStorage/IndexedDB 契約，且跨裝置同步超出本 WP。

### D-38.3 — OQ-S6-24 初判:七模式不兩兩互斥，T1 必須凍結決定性的主／次排序(2026-08-24,T0)

**Finding:** 框架 v1 的證據鏈不是兩兩互斥。`click-timing` 與 `fire-commitment` 都可在首次進靶後開火偏晚時成立；`tracking-maintenance` 亦可和各項一次性反應／開火限制共存，`counterstrafe-braking` 可同時伴隨慢首發。因此不能以「第一個成立即結束」假設規則表天然互斥。

**T1 requirement:** 以框架表格順序作為候選 deterministic ordering，明確定義每個模式的 evidence/exclusion 與 primary/secondary 的去重規則；至少以 click-timing + fire-commitment 的合成 fixture 覆蓋同時成立案例。此 T0 僅完成初判，未凍結優先序。

### D-38.4 — OQ-S6-24 定案:框架表格順序、第一個完整證據鏈為唯一 primary(2026-08-25,T1)

**Decision:** `evaluateDiagnosis()` 按框架 v1 的七列順序檢查；第一個完整證據鏈產生唯一 `primary`，並排除後續所有模式，`secondary` 保持 absent。

**Rationale:** 規則可以重疊，而「先成立即排除後續」是 T1 的明確要求。primary-only 仍符合 FR-F14「至多一主一次弱項」，且避免將相同表現重複標記為兩種訓練限制。

**Alternatives considered:** 回傳後續第一個模式作為 secondary——未採用：會違反已定義的後續模式排除資格，且增加診斷重複的風險。

### D-38.5 — pilot 前門檻為顯式候選，函式一律注入版本化集合(2026-08-25,T1)

**Decision:** 匯出 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 只供開發／pilot 前測試；`evaluateDiagnosis()` 不使用隱藏常數，呼叫端必須傳入含 version 的 `DiagnosisThresholds`。

**Rationale:** 門檻校正尚屬 WP-39 範圍。把版本與數值作為輸入，可保存原 session 產出的 recommendation version，避免新門檻追寫舊結論。

**Alternatives considered:** 將數字內嵌於每條規則——未採用：無法建立可追溯版本，也違反 T1/C-D3 門檻注入紀律。

### D-38.6 — T2 history loader 以 `meta.assessment` 作 Assessment 守門(2026-08-25,T2)

**Decision:** 多檔 loader 僅接受含 `meta.assessment` 的 export；缺席者（含 legacy export）一律視為 Practice，不會傳入 `SessionSummary` 建構器。

**Rationale:** `DrillConfig.mode` 沒有序列化到 export，且既有契約已定義缺 mode 為 Practice。`meta.assessment` 是正式 Assessment provenance 的唯一可從已匯出 JSON 驗證的訊號。

**Alternatives considered:** 依 drillId allow-list 推定 Assessment——未採用：Practice 可執行同一 drill，會將正式 baseline 的 eligibility 由設定猜測而不是已保存 provenance 決定。

### D-38.7 — 固定窗口只聚合先前 session，速度／準確度 metric ID 必須一致(2026-08-25,T2)

**Decision:** current session 只作相容性參考，不納入自己的 history baseline；選取最新的相容 prior sessions，計算 median 與 population SD。不同 speed/accuracy metric ID 不混合，視為資料不足。

**Rationale:** 這保留「目前觀測」與既有 baseline 的區分；同一 task 的不同指標不能形成可解釋的 speed–accuracy 聚合。各家族對照表已寫入 `analysis-diagnosis.md`。

**Alternatives considered:** 把 current 直接併入 baseline——未採用：會讓欲呈現的當前表現反過來影響自己的參考值；對不同 metric ID 只比較 task key——未採用：會產生沒有共同單位的中位數。

### D-38.8 — T3 以 export payload 作診斷與 history 的唯一來源(2026-08-25,T3)

**Decision:** drill 結束時先建立一次 `ExportPayload`，由該 payload 評估診斷、建立 current `SessionSummary`，並作為 ResultScreen 與 history import 的共同輸入。Assessment drill 同時在 export 寫入 `meta.assessment` provenance；Practice 不會建立正式 baseline。

**Rationale:** 避免結果頁統計、診斷、下載檔案各自從不同 recorder snapshot 讀取。T2 loader 已把 `meta.assessment` 設為唯一的 formal-history 守門，故 provenance 必須在這條既有匯出路徑落地。

**Alternatives considered:** 從即時 shared state 另建診斷/history 資料——未採用：會破壞「統計＝匯出」同源驗證，也無法讓先前匯出的 Assessment 檔案通過 T2 guard。

## Surprises

### S-38.1 — Python history 候選缺少原先假設的可讀診斷輸出(2026-08-24,T0)

`ExportPayload` 僅含 `meta`、`ticks`、`events`；`recommendationVersion` 與 `qualityGateStatus` 依 WP-33 契約也不是 export metadata。故 Python 候選不能只「讀 TS 已計算的診斷 JSON」，必須先另建 sidecar 合約；此發現已納入 D-38.2 的估時與決策。

### S-38.2 — 全量 Playwright 一次 app-ready 輪詢逾時，但單檔重跑全綠(2026-08-24,T0)

`npm run test:ci` 在 typecheck 與 Vitest **118 files / 911 tests** 通過後，僅 `tests/e2e/input-sampler.spec.ts:44` 在 `window.__aimDebug` 的 5 秒 app-ready polling 逾時（20/21）。T0 沒有 `src/` 或測試異動；立即重跑同檔 `npx.cmd playwright test tests/e2e/input-sampler.spec.ts` **5/5 通過**，故記為既有暫態 E2E 問題，不在本切片修復。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-23 | 個人歷史資料來源機制(TS 多檔上傳 vs Python 目錄掃描) | ✅ closed — 純 TS 多檔上傳(D-38.2) |
| OQ-S6-24 | 七模式規則表優先序 | ✅ closed — 框架表格順序，第一個完整證據鏈為唯一 primary(D-38.4) |
| OQ-S6-25 | `recommendationVersion` 與 `protocolVersion` 是否聯動 | 🟢 open(不阻塞開工) |
| OQ-S6-26 | speed–accuracy trade-off 各家族代表指標 | 🟡 open |
