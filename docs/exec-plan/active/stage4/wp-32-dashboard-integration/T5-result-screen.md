# T5 — 結果頁 research-promoted 區塊(n / flags / version / 效度層級 + `blocked` 態)

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3(phase + sync)+ T4(curve) |
| **Risk / Cplx** | Med / Med — 演算法已在 T1–T4 釘死;風險在**接線**(結果頁拿不到 `meta` → 實機永遠 `blocked`,但 unit test 全綠) |
| **Touches** | MODIFY `src/ui/ResultScreen.ts`(+ 測試);MODIFY `src/metrics/MetricsDashboard.ts`(additive `computePromoted`);MODIFY `src/main.ts`(結果頁取得 `ExportPayload`);MODIFY `tests/e2e/full-drill.spec.ts`(統計 = 匯出 斷言擴充) |
| **狀態** | ⬜ |

## Objective

FR-D17 的呈現面:把三個晉升指標放上結果頁,**並且讓「不可信就不顯示數字」這件事是程式保證的,不是自律**。C-D3 的紅線到這裡才真正落到使用者眼前 —— 前面幾個 task 產生的是數字,這個 task 決定教練看到什麼、以及看到的東西旁邊寫著什麼限制。

## In scope

### ① 接線(本 task 的真正風險)

- `MetricsDashboard` 增 `computePromoted(payload: ExportPayload): PromotedMetrics`(**additive**;既有 `compute(snapshot)` 簽名與語意零變更)。
- [main.ts:1034](../../../../../src/main.ts) 目前是 `resultScreen.show(metricsDashboard.compute(recorder.snapshot()))`。晉升指標需要 `meta`(hitbox / eyeOrigin / `mouseIntegration`),而 `meta` 由 `collectMeta` 產生、`buildExportPayload(meta, snapshot)` 組裝([main.ts:483](../../../../../src/main.ts))。
  - 做法:結果頁顯示時取用**與匯出同一個** payload 組裝路徑,`show(metrics, promoted?)` 以 additive 參數傳入。
  - **統計 = 匯出不變式**:晉升指標與匯出**必須來自同一個 `snapshot()`**;不得為結果頁另呼叫一次 `recorder.snapshot()` 或另組一份 meta。
- `meta.mouseIntegration` 缺席 → `computePromoted` 回 `{status:'blocked', reason}`;結果頁顯示理由文字(引 KI-005),**不顯示任何數字**。

### ② 結果頁區塊(純 TS + DOM,D1;沿用 `ResultScreen.ts` 既有的 inline style + `dataset.metricId` 慣例)

新增一個 `Research-promoted diagnostics` 區塊,**與既有 8 張卡片視覺上分離**(既有卡 = `compute.ts` 的引擎指標;新區塊 = research 晉升層,兩者效度來源不同,不可混在同一格線裡)。

| 呈現 | 內容 |
|---|---|
| **Phase 卡 ×3** | REC / MR / V 各一張:`p50 ms` 為主值,detail = `mean · SD · n`;卡上標 `phase-v1` |
| **Sync 卡 ×3** | `release_to_fire` / `counter_hold` / `counter_to_fire`:同上;`release_to_fire` 與 `counter_hold` 另標 `PrecisionVerdict`(`sufficient` / `insufficient` / `blocked-by-data`)|
| **L/R 曲線圖 ×1–2** | inline SVG:ω(t)(必要)與 ε(t)(依 OQ-S4-23 拍板)的 L/R 疊圖 + IQR 帶;圖上標 `n(L)` / `n(R)`;`curve-v1` |
| **區塊頁尾** | 效度聲明一行:資料來源版本字串全列(`phase-v1` / `sync-v1` / `curve-v1` / `seg-v2` / `sg-seg-v2`)+ 單 drill 樣本限制(OQ-S4-22)|

**強制規則**(各有測試斷言):

- 每張卡必須顯示 **n**;`n = 0` → 顯示 `No samples`,**不顯示 0 或 `--` 當數值**。
- 每張卡必須顯示 **flags 計數**(被排除的 peek 數);為 0 時顯示 `0 flagged`,不省略。
- 區塊的 metric id 集合 = **T0 凍結的封閉清單**;測試斷言相等(多一個即 fail)—— 這是 C-D3 在 UI 層的機械保證。
- **`blocked` 態**:整個區塊改顯示單一說明卡(原因 + 補救指引),不顯示任何指標卡與圖。

### ③ 測試

- `ResultScreen.test.ts` 擴充:區塊存在、metric id 集合相等、n / flags / version 欄位非空、`n=0` 顯示 `No samples`、`blocked` 態只顯示說明卡。
- **E2E(關鍵)**:`tests/e2e/full-drill.spec.ts` 走完整實機路徑後,斷言 ① 結果頁晉升區塊**存在且有非空數值**(證明 `meta` 真的接上了,不是永遠 `blocked`)② 區塊顯示的統計與同一次匯出 payload 上跑 `computePromotedMetrics` 的結果一致(**統計 = 匯出**)。

## Out of scope

- 互動式篩選 / group-by(OQ-S4-6 的升級觸發條件未達;教練報告側的 `--group-by` 不搬到結果頁)。
- 跨 session / 跨 drill 聚合(stage4 §2.1)。
- WP-31 任何指標(C-D3)。
- 改動既有 8 張卡片的內容或版面。
- 驗收清單 D(T-exit)。

## Steps

- [ ] 拍板 OQ-S4-23(曲線呈現形式)與 OQ-S4-22(單 drill n 的呈現)→ 寫入 progress Decision Log。
- [ ] `MetricsDashboard.computePromoted` additive;既有 `MetricsDashboard.test.ts` 零修改確認全綠。
- [ ] `main.ts` 接線:結果頁取用與匯出同源的 payload。
- [ ] `ResultScreen.ts`:區塊 + 卡片 + inline SVG 曲線 + `blocked` 態。
- [ ] `ResultScreen.test.ts` 擴充(六項強制規則各一測試)。
- [ ] E2E 擴充(存在性 + 統計 = 匯出)。
- [ ] 手動視覺確認:實機跑一次 counter-strafe drill,截圖或逐項描述記 progress(卡片可讀性、曲線是否被 IQR 帶淹沒、`n` 是否顯眼)。
- [ ] 兩閘輸出貼 progress。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **metric id 集合 = 封閉清單** | `ResultScreen.test.ts` 斷言區塊內 `data-metric-id` 集合等於 T0 凍結清單;多一個或少一個即 fail |
| ② | **每量帶 n + flags + version** | 六張卡 + 曲線區各自斷言三個欄位非空;`n=0` 顯示 `No samples` |
| ③ | **`blocked` 態正確** | 以無 `mouseIntegration` 的 payload 渲染 → 只出現說明卡,零指標卡、零圖;說明文字含 KI-005 指引 |
| ④ | **統計 = 匯出(E2E)** | `tests/e2e/full-drill.spec.ts` 斷言結果頁晉升區塊有非空數值,且與同一次匯出 payload 的 `computePromotedMetrics` 逐量一致。**這是唯一能證明接線在實機上成立的證據**,不可用 unit test 代替 |
| ⑤ | **既有測試零修改全綠** | `MetricsDashboard.test.ts` / 既有 `ResultScreen` 相關測試 / 全部 `promoted-*.test.ts` 零修改;`npm run test:ci` exit 0 |
| ⑥ | **引擎零行為變更** | `git diff --stat` 顯示 `src/` 只動 `src/metrics/MetricsDashboard.ts`、`src/ui/ResultScreen.ts`、`src/main.ts`;`src/sim`/`src/input`/`src/loop`/`src/data` 零 diff;決定性回歸測試零重錄 |
| ⑦ | **手動視覺確認已記錄** | progress 有一段實機檢核紀錄(至少涵蓋:卡片可讀、曲線可辨、`n` 可見、`blocked` 文案可懂) |
| ⑧ | **兩個 OQ 拍板入帳** | OQ-S4-22 / OQ-S4-23 於 progress Decision Log 有結論;stage4 §8 同步 |

## Commit

`feat(wp-32): T5 結果頁 research-promoted 區塊(phase/sync/curve,帶 n/flags/version/效度層級)+ blocked 態 + 統計=匯出 E2E`
