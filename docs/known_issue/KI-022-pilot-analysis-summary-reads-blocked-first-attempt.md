# KI-022 — pilot 分析 runner 的摘要讀 `runs[0]`：重跑過的條件在主控台顯示「沒有指標」

> 狀態：✅ **已修**（2026-09-03）。決策帳本：[BD-022](BUGFIX-DECISIONS.md)。
> 發現於 WP-54 T6 第二輪真人資料（P03，9 block 重跑）的分析，見
> [T6-instrumentation-gate.md §11](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)。

---

## 1. 症狀

`npx vite-node scripts/analyze-tracking-pilot.ts -- <dir>` 對 P03 這批資料印出：

```
tracking_core_pr_pilot_v1_2deg_5dps          | n=2 eligible=1 seeds=[54010] | p0=- | p1=-
tracking_core_pr_pilot_v1_calibration_vertical | n=2 eligible=1 seeds=[54002] | p0=- | p1=-
```

兩個條件都**有一份 eligible run**（`eligible=1`），主控台卻報告沒有任何 P0/P1。八個條件裡有兩個
如此——恰好就是操作員按過 **Retry block** 的那兩個。

## 2. 根因

`scripts/analyze-tracking-pilot.ts` 的摘要迴圈取 `condition.runs[0]`。

`buildTrackingPilotEvidence()` 依 FR-54-10 是 **append-only**：blocked 的第一次 attempt 會**留在**
`condition.runs` 裡（那正是可稽核性的要求——retry 不覆蓋原 attempt），而依同一條契約，blocked run
**不帶** `p0`/`p1`（[trackingPilotEvidence.ts:88](../../src/pilot/trackingPilotEvidence.ts)：
「Present only when `quality.status === 'eligible'`」）。

於是「第一次被擋、重跑後合格」這個**正常操作流程**（block → Retry block → Continue）產生的條件，
摘要一律指向那個依契約沒有指標的 attempt。

## 3. 影響面

| | |
|---|---|
| **匯出／證據本身** | ✅ **沒有被汙染**。`tracking-pilot-evidence.json` 與 `tracking-pilot-report.html` 一直都帶著重跑那份的完整 P0/P1（實測：`2deg_5dps` 的 `rmsEpsilonDeg 0.874`、`totPercent 34.6`），JSON/HTML parity 也一直是 ok |
| **人看的那一層** | ❌ 受影響。Gate 結論是照著主控台摘要下的；摘要對「重跑過的條件」說謊，而重跑正是品質閘設計要鼓勵的行為 |
| **觸發條件** | 任何 `runs[0]` 為 blocked 的條件。P03 這批 8 個條件中有 2 個（25%） |
| **是否影響 P01/P02 舊批次的結論** | 否——那兩批的 retry 落在別的條件上，但同一個 bug 同樣會作用；重讀舊摘要時需留意 |

**這個 bug 的類別與 KI-020 同源**：工具在「該說話的地方沉默」，而沉默被讀成「沒問題」。差別是
KI-020 汙染了刺激本身，本 bug 只汙染人看的摘要——但兩者都會讓一個 gate 結論建立在錯的前提上。

## 4. 修法

摘要改取**第一個 eligible run**，沒有 eligible 時退回 `runs[0]`（讓「每次 attempt 都被擋」仍然
印得出可追溯的 run id，而不是空行——那本身就是一個發現）。

選擇邏輯抽成 `scripts/trackingPilotSummary.ts` 的純函式 `selectSummaryRun()`：runner 本體在
import 時就跑 `main()`、且吃的是一整個資料夾的 participant 匯出，單元測試兩者都給不了。

- `scripts/trackingPilotSummary.ts`（新增）：`selectSummaryRun()`
- `scripts/analyze-tracking-pilot.ts`：`const run = condition.runs[0]` → `selectSummaryRun(condition.runs)`

**不改** `buildTrackingPilotEvidence()`：append-only 的 `runs` 陣列與「blocked 不帶指標」是
FR-54-10 的正確契約,錯的是消費端的挑選。

## 5. 測試（修前紅 / 修後綠）

[tests/regression/tracking-pilot-summary-run-selection.test.ts](../../tests/regression/tracking-pilot-summary-run-selection.test.ts)
——fixture 直接取自 P03 那份真實 evidence 的兩個 run（blocked attempt + eligible retry，含真實
`runId`/`seed`/指標值）：

| 案 | 修前 | 修後 |
|---|---|---|
| 重跑條件描述的是 eligible retry | 🔴 得到 `…T11:33:16.541Z`（blocked 那份） | ✅ `…T11:33:53.445Z`、`rmsEpsilonDeg 0.874` |
| 全部 attempt 皆 blocked 時仍描述第一份 | ✅ | ✅ |
| 空條件回 `undefined` | ✅ | ✅ |

依 [BD-001](BUGFIX-DECISIONS.md) 慣例：測試在工作區證實修前為紅，但測試與修法合併為單一已驗證綠
的 commit。

## 6. DoD

- [x] 摘要對「第一次 attempt 被擋」的條件印出 eligible run 的 P0/P1。
- [x] regression fixture 取自真實 evidence，非構造值。
- [x] 不動 evidence/report 產生路徑（parity 檢查仍 ok）。
- [x] 全專案回歸：`npx vitest run` **207 files / 1998 tests passed**（1 skipped file / 2 skipped
      tests）；`npx tsc --noEmit` 與 `-p tsconfig.node.json` 皆 exit 0。
- [x] 以真實資料重跑分析，八個條件全部印出 P0/P1（見 gate §11）。
