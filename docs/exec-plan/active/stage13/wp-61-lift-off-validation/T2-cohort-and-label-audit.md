# WP-61 T2 — Cohort 取得 ／ 標註完整性稽核 ／ 候選事件表

## Objective

把 T1 的儀器變成一批**可用**的標註資料：錄製 cohort、逐份稽核標註品質、產出 Stage 1 切段的 committed golden，並建立「候選空洞 × 標籤」的事件表。**本 task 的主要產出是一個 go／no-go 判定**，不是一份分析。

> ⚠️ **T2 的資料充分性閘未過不得開 T3。** 用一批髒標籤跑消融，得到的「分不開」無法歸因（是訊號沒有，還是標籤太髒？）——那比不跑更糟，因為它會被當成結論引用。

## Inputs to read

- [README.md](README.md) §1.2（NFR-61.7 的資料量下限）、§2.6（F2／F3）、§2.4（T0 凍結的容差與作廢規則）。
- [progress.md](progress.md) §Pre-registration（T0 凍結的**全部**數字）。
- [`docs/operational/spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md)（含 T1 新增的標註協定節）。
- [WP-60 progress §TF2](../wp-60-raw-mouse-sample-capture/progress.md)（`analyze:spider-wide` 的原始取樣健康度七欄與 `activeRateHz` 的判讀，D-60.X1）。
- [`research/README.md`](../../../../../research/README.md)（C-D1／C-D2 與 fixture 政策）。

## Steps

1. **錄製**（使用者操作）：依 T1 的協定錄製 cohort。每份 run 以 `?rawMouse=1` + 標註 flag 載入，長度 ≤ 120 s（F8），全程不中斷 Pointer Lock。至少涵蓋 T0 凍結的三種條件（lift／pause／oneshot 或其等價 block 設計）與 **≥ 2 個獨立 session**。
2. **逐份可用性覆核**（agent，硬閘 —— 不可比就作廢，不加註腳）：
   - `meta.crossOriginIsolated === true`；
   - **`meta.displayHz === 240`**（D-61.U3）。不等於即**作廢該 run** —— 顯示更新率同時改變 aim 更新率與 `meta.suspect`，混批是顯性 confound。既有 WP-57／WP-60 的 60 Hz 資料**不得**併入；
   - `meta.dpi` 有值（缺 DPI 是既有 blocker，`spider-wide-recording-spec.md` §2.3）；
   - `meta.mouseSampling.recorded > 0` 且 `overflow === false`；
   - `activeRateHz ≥ 500`（**連續期間**事件率，不是整段平均 —— D-60.X1）；
   - `pointer_lock` 事件推導出的 unlocked 區間數（> 0 即列為污染，依 T0 規則處置）。
3. **標註完整性稽核**（FR-61.11，硬閘）：對每份 run 報告標註數、與 block 設計 trial 數的差額、`down`／`up` 成對性違規數、落在 unlocked 區間內的標註數。差額 > T0 凍結上限 ⇒ **該 run 作廢**，記入 `progress.md` 並（可選）重錄。
4. **F3 檢定**（硬閘）：分別計算 lift 組與 pause 組的「標註時刻 − 最近候選空洞邊界」分布（p10／p50／p90），依 T0 凍結的規則檢定兩組**有無系統性差異**。有差異 ⇒ **宣告該標註通道不可用**，停止並走 FR-61.8 的「證據不足」路徑，**不得**續行 T3。
5. **Stage 1 切段 golden**（OQ-61.4／F7）：以 **TS** `segmentByTimeGap(block, θ, unlocked)` 對每份 run × 每個 θ ∈ {18, 30, 50} 產出切段結果，寫成 committed golden JSON 進 `research/fixtures/golden/`。內容只含 index／時間／長度等**衍生量**，不含逐筆 `dx`／`dy`（真人軌跡不進 repo，D-57.T5-8）；`participantId` 匿名化。
6. **候選事件表**（`research/src/lift/`）：Python 側讀 golden + 本機 export 的標註事件，依 T0 凍結的匹配規則產出 `(runId, sessionId, θ, gapIndex, startMs, durationMs, label ∈ {lift, pause, none}, matchedAnnotationT?)` 的長表，輸出至 `out/`（git-ignored）。**Python 不重算切段**（只讀 golden）。
7. **資料充分性判定**（本 task 的核心產出）：對照 NFR-61.7 的下限逐項報告 —— session 數、每類別事件數、每個 θ 下的可用事件數。未達 ⇒ 判 `blocked-by-data`，寫明**差多少**，停止。
8. **operator 報告擴充**（`scripts/spiderWideRepositioningRunner.ts`）：把 step 2／3 的欄位加進既有的「原始取樣健康度」子表，讓下一份 run 錄完當場就能看出可不可用。**沿用既有 blocker 慣例**：新增的閾值必須從**真實資料的形狀**倒推，不得從閾值倒推（WP-60 Surprises 9）。
9. 跑全量閘（typecheck ×2、Vitest、build、`uv run pytest`），數字逐項歸屬。

## Invariants

- **真人逐筆軌跡不進 repo**；只有匿名化的衍生量與統計摘要可 commit。
- Python 側**不 import 任何 TS**，只讀 export JSON 與 committed golden（C-D1）；`algorithms/` 內禁 plot／print／file I/O（C-D2）。
- **標籤不得由空洞生成或修正**（FR-61.3）：候選事件表的 `label` 只能來自標註事件；沒有標註匹配的候選一律 `none`，不得因為「這個空洞很長」而補標。
- 「作廢」是**丟掉整份 run**，不是丟掉不方便的事件。作廢規則在 T0 已凍結，本 task 只執行。

## Definition of Done（可驗證證據）

- [ ] 每份 run 的 step 2 六項覆核逐條有值；不可用者**具名作廢**並寫出哪一項不過（不得只寫「已排除」）。
- [ ] 標註完整性表：每份 run 的標註數／trial 差額／成對違規數／unlocked 內標註數皆有**實際數字**；作廢判定依 T0 凍結上限執行。
- [ ] **F3 檢定有實際分布數字**（兩組各 p10／p50／p90）與依 T0 規則的**二元判定**；判定為「不可用」時本 task 即停止，且該結論寫進 `progress.md` 與 T-exit。
- [ ] Stage 1 golden 已 commit：檔案清單 + 每個檔的 run／θ／事件數；一支測試斷言 TS `segmentByTimeGap()` 對該 golden 逐位重現（防止日後原語變動而 golden 靜默過期）。
- [ ] Python 側 `uv run pytest` exit 0；一支測試斷言 `research/src/lift/` **零** TS import 與零 `algorithms/` I/O（C-D1／C-D2 掃描）。
- [ ] 候選事件表已產出：每個 θ 的總候選數、各 label 的計數、匹配率，皆為實際數字。
- [ ] **資料充分性判定為明確二元**：`sufficient` 或 `blocked-by-data` + 差多少（session 數／每類事件數／哪個 θ）。判 `blocked-by-data` 時**不得**進 T3。
- [ ] operator 報告新欄位：以**兩份對照 fixture**（一份健康、一份標註殘缺）各實跑一次，輸出貼進 `progress.md`；新增 blocker 以突變驗證其偵測力（`cp` 備份還原）。
- [ ] `npm run typecheck` ×2、全量 Vitest、`vite build` 皆 exit 0，數字差額逐項歸屬。
- [ ] 錄製條件（OS／瀏覽器版本／滑鼠型號／DPI／輪詢率／顯示更新率／drill／seed／時長／commit）**逐份**記入 `progress.md` —— 缺一項，跨硬體比較就不可稽核（WP-60 TF2 的教訓：那批資料查不到滑鼠型號與 DPI）。

## Commit

```text
feat(research): ingest and audit the annotated lift-off cohort
```
