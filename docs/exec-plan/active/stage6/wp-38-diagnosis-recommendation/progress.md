# WP-38 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-38.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-24 | WP-34/35/36/37 的 T-exit 列皆為 ✅；重讀 `src/metrics/spiderShotMetrics.ts`、`counterstrafeMetrics.ts` 完成最終介面覆核；D-38.1/D-38.2 定案。零程式碼、零測試異動。 |

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
| OQ-S6-24 | 七模式規則表優先序 | 🟡 T1 定案 — T0 確認非兩兩互斥，候選為框架表格順序(D-38.3) |
| OQ-S6-25 | `recommendationVersion` 與 `protocolVersion` 是否聯動 | 🟢 open(不阻塞開工) |
| OQ-S6-26 | speed–accuracy trade-off 各家族代表指標 | 🟡 open |
