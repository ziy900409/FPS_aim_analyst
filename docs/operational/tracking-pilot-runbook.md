# Tracking Pilot — Operator/Researcher Runbook

> WP-54 T5 deliverable（README §2.2 規劃的 NEW 檔）。對象：實際操作 tracking pilot session 的研究者/
> 操作員。上游概念文件：[analysis-tracking.md](analysis-tracking.md)（P0/P1 公式、eligibility/
> compatibility/evidence 契約）、[../exec-plan/active/stage11/wp-54-tracking-pilot/README.md](../exec-plan/active/stage11/wp-54-tracking-pilot/README.md)（需求/介面契約）。

## 現況（2026-09-03，T6 工程面完成後）

T5 交付了 manifest、researcher-only runner 與 operator screen 三個**機制**；**T6 slice 1-3 已把它們
接進 `src/main.ts` 正式 app**——真實 `DrillConfig` 走既有 clearance/TargetManager/SimLoop 載入鏈路、
真實 `ExportPayload` 由既有 `buildCurrentExportPayload()` 組裝並自動下載，入口是研究員模式的
**Tracking pilot** 按鈕。真瀏覽器 e2e（`tests/e2e/tracking-pilot-live.spec.ts`）已跑完兩個真實 25 秒
block 並對下載的 JSON 斷言追溯欄位。

**尚未完成的是真人施測**：3-5 位內部/熟練 tester、每條件至少 2 次，是
[README §4 T6](../exec-plan/active/stage11/wp-54-tracking-pilot/README.md) 的 Gate A 要求，操作步驟
與資料回收方式見 [T6-instrumentation-gate.md](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)
（該文件是 Gate A 的正式帳本；本文件是操作手冊）。

## 核心概念

### Manifest

`buildTrackingPilotManifest(participantId, sessionIndex, restSeconds)`
（`src/session/trackingPilotManifest.ts`）決定性產生 9 個 block 的順序：

1. **Practice**（`tracking_core_pr_pilot_v1_practice`）——永遠第一個，不進 scored 聚合，無 quality
   gate。
2. **Axis calibration**（horizontal、vertical，固定順序緊接在 practice 後）——診斷用途，判斷 0.5°
   目標是否可辨識，同樣有 scored window 但不是本次分析的比較條件。
3. **6 個 scored block**（4 個 core size×speed 候選 + 2 個 reversal density 候選）——依
   `participantId`/`sessionIndex` 做 counterbalance 排序（重用 WP-41 既有的
   `buildFamilyOrderForRoster()` cyclic Latin-square 輪轉，見 progress.md D-54.24），避免固定順序
   造成的疲勞/練習系統性偏誤。

`sessionIndex` 只能是 `0` 或 `1`：`0` 用每個 block 自己的 literal seed（primary），`1` 對 6 個
scored block 套用 **alternate seed family**（seed + 10000，見 D-54.25）——同一組條件換一個軌跡實現,
供 T8 的 alternate-seed equivalence 分析；practice/calibration 兩個 session 都用 primary seed（診斷
用途,重跑同一軌跡沒有分析意義）。

`generatedFromCounterbalanceCell` 只是 `` `tracking-pilot-v1:${participantId}:session-${sessionIndex}` ``
——本身就是輸入的純函式，manifest replay（同一輸入重跑）保證拿到同一份 order/seed。

**非法 manifest 一律 fail fast**（`parseTrackingPilotManifest()`）：未知 drillId、重複 block、
非 scored block 宣稱 alternate seed family、scored block 之間 seed family 不一致。

### Researcher-only runner

`createTrackingPilotRunner()`（`src/session/TrackingPilotRunner.ts`）是一個 DOM-agnostic phase state
machine（結構比照既有 `SessionRunner.ts`）：

```text
idle --start(manifest)--> running(block 0) --completeCurrentBlock()--> block-outcome
  block-outcome --advance()--> rest --(poll 倒數歸零)--> running(block N+1)
  block-outcome --retryCurrentBlock(reason)--> running(同一個 block，attempt+1)
  running --abortCurrentBlock(reason)--> rest / done
  (最後一個 block 的 advance()) --> done
```

- `completeCurrentBlock()` 匯出目前 block（`exportBlock()`），除了 practice 以外都呼叫
  `evaluateTrackingRunEligibility()` 判定 quality gate（practice 沒有 `scored_start` 事件,不判定）。
- `retryCurrentBlock(reason)`/`abortCurrentBlock(reason)` 都要求非空理由；每次呼叫都 append 一筆新
  紀錄進 `runner.records`（從不覆蓋前一次嘗試）,retry 的理由額外記進 `runner.retryLog`。
- **操作端從不讀到能力分數**——`completeCurrentBlock()` 回傳的 eligibility 只有
  `{status:'eligible', validScoredTicks, durationMs}` 或
  `{status:'blocked', reasons: TrackingQualityReason[]}`，沒有任何 RMS/TOT/lag/gain 數值。

### Operator screen

`createTrackingPilotOperatorScreen()`（`src/ui/TrackingPilotOperatorScreen.ts`）是純 TS DOM overlay
（D1），本身不持有 runner——由呼叫端把 `onStartManifest`/`onCompleteBlock`/`onRetryBlock`/
`onAbortBlock`/`onAdvance` 接到一個真正的 runner instance（比照 `SessionPlanSetup`↔`SessionRunner`
的既有接線慣例）。

| 畫面區塊 | 顯示什麼 | 何時可見 |
|---|---|---|
| Setup form | Participant ID / Session index / Rest seconds | 一直存在（不因 phase 切換而隱藏） |
| Current block panel | Block index、role（practice/calibration/scored）、drillId、attempt、seed family + Complete/Abort 按鈕 | `phase.kind === 'running'` |
| Block outcome panel | quality banner（`role="alert"`，文字為 `Eligible — scored ticks: … duration: …ms` 或 `Blocked — reasons: …`；practice 不顯示 banner）+ Retry/Continue 按鈕 | `phase.kind === 'block-outcome'` |
| Rest panel | 倒數秒數文字 | `phase.kind === 'rest'` |
| Done panel | 完成文字 | `phase.kind === 'done'` |
| Reason panel | Retry/Abort 共用一個文字輸入框 + Confirm/Cancel | 按下 Retry 或 Abort 後彈出，focus 自動移入 |
| Block log | 逐筆 `#index attempt N — drillId — completed(status)/aborted(reason)` | 一直存在 |

**沒有一個狀態只靠顏色表達**（NFR-54-8）：quality banner 用文字前綴（`Eligible`/`Blocked`）加上
`data-quality` 屬性，不是單純變色；狀態列（`aria-live="polite"`）與所有面板文字一律是
`textContent`。**每個控制項都是原生 `<button>`/`<input>`/`<select>`**，Tab 順序即操作順序，無
click-only 的 `<div>`。

## 如何操作（dev-only harness：秒級 UI/鍵盤 smoke test）

正式路徑已可用（見下一節）後，這個 harness **仍然保留**（progress.md D-54.33）：它用 fake
`loadDrillConfig`/`exportBlock`，可在**秒級**走完 9 個 block 的鍵盤/狀態流程，是 a11y 迴歸證據的
可重跑載體；正式路徑一個 block 就是 25 秒真實 sim，不適合當 a11y 閘。

1. `npm run dev`，瀏覽器開 `http://localhost:5173/tracking-pilot-harness.html`
   （`src/pilot/trackingPilotOperatorHarness.ts` 掛載，`tracking-pilot-harness.html` 由 Vite dev
   server 原生 multi-page 支援直接服務）。
2. 填 Participant ID、選 Session index（0=primary seed，1=alternate seed）、填 Rest seconds，Tab 到
   Start manifest 按 Enter。
3. 依序看到 9 個 block 的 running/block-outcome/rest 面板輪替。**注意：harness 的
   `loadDrillConfig`/`exportBlock` 是 fake stub**（交替回傳 eligible/blocked，不跑真實 3-loop sim
   runtime）——這個 harness 只用來驗證 operator screen 的鍵盤/狀態呈現機制，不是真實 pilot 資料。
4. `tests/e2e/tracking-pilot-operator.spec.ts` 是這個流程的自動化鍵盤走查（全程只用 `.focus()`/
   `page.keyboard.press()`）——比照本專案既有 `stage10-accessibility.spec.ts` 慣例，這類真實瀏覽器
   Playwright walkthrough 是本專案採認的自動化 a11y/keyboard 證據（見 progress.md D-54.28）。

## 如何操作（正式 pilot session，T6 起可用）

> 完整的施測份量、資料回收格式與 Gate A 對帳表在
> [T6-instrumentation-gate.md §5-§7](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)；
> 本節是同一條流程的操作摘要。

1. `npm run dev`，瀏覽器（Chrome/Edge 桌面版）開 `http://localhost:5173/`，**等三個啟動按鈕出現**
   （app 完成 boot；boot 期間按 Tracking pilot 不會出錯，但 manifest 會等 boot 完才真正開始）。
   確認 console 印出 `[isolation] {crossOriginIsolated: true, …}`——若為 `false` 請停止施測（計時
   精度不足，資料無效，ADR-4）。
2. **研究員模式** → **Tracking pilot** → 出現操作面板。
3. 填 Participant ID（勿填真實姓名——會寫進匯出 `meta.session.participantId`）、選 Session index
   （`0` = primary seed，`1` = alternate seed family）、填 Rest seconds（建議 20），Tab 到
   **Start manifest** 按 Enter。
4. 面板自動讓位，block 開始（3 秒倒數 + 25 秒）。點畫面中央進入 pointer lock 才能瞄準。
   **scored/calibration block 禁開火、禁 ADS、禁 WASD**（違反會記 `protocol_violation`）；
   practice 可自由熱身。

   > ⚠️ **開跑前務必口頭提醒受測者:「不要按右鍵」。** 三場真人 session 累計 **5 次
   > `protocol_violation`,5/5 全部是 `kind: "ads"`(右鍵 ADS)**——沒有一次是開火或 WASD。
   > 這是目前唯一實際發生過的違規型態,且每次都得整個 block 重跑(25 秒 + 休息)。
   > 依 OQ-54-13 的決定,程式端**刻意不阻止**右鍵(維持「記錄違規而非阻止」的設計),
   > 所以這道防線只有操作員的事前提醒。習慣性右鍵瞄準的玩家尤其要提醒。
5. block 結束 → **自動下載該 block 的 JSON** → 面板自動回來，顯示 outcome 與品質橫幅
   （`Eligible — scored ticks: …` / `Blocked — reasons: …`；practice 無橫幅）。
6. **quality abort 的建議處置**：
   - `Blocked — reasons: recorder-overflow` / `input-buffer-overflow` / `non-monotonic-timestamps`
     → **系統/裝置問題**，不是受測者問題。先排除背景負載（關掉其他分頁/錄影軟體），再
     **Retry block** 並在理由寫下觀察到的狀況。連續兩次同一 reason 就停止本場施測並回報——這是
     Gate A 該擋下的事，不該用「多跑幾次」蓋過去。
   - `Blocked — reasons: insufficient-scored-coverage` → 通常是掉幀/卡頓。同上處置。
   - `Blocked — reasons: missing-target-telemetry` / `protocol-*` → 回報，不要自行重跑掩蓋。
   - 受測者因素（分心、手滑、誤觸移動鍵）→ **Retry block**，理由寫清楚（retry 為 append-only，
     原 attempt 的匯出與理由都留檔，不會被覆蓋）。
7. 走完 9 個 block；一位 tester 的 T6 份量 = session 0 一次 + session 1 一次。
8. **產生 evidence artifact（分析端，不在 app 內）**：收齊 JSON 後把它們餵
   `buildTrackingPilotEvidence(payloads, options?)`（`src/pilot/trackingPilotEvidence.ts`）→
   `renderTrackingPilotReportHtml(evidence)`（`src/pilot/trackingPilotReport.ts`）產出 self-contained
   HTML。practice block 會被自動排除並計入 `excludedPracticeRunCount`（FR-54-5）。公式、預設參數與
   blocked 語意見 [analysis-tracking.md](analysis-tracking.md)。

## 遺留給後續 task 的已知缺口

- **無「跳過休息」按鈕**：`restSeconds` 一旦設定，操作員必須等倒數歸零才會進下一個 block（沒有
  skip-rest 控制）。checklist 只說「rest 略過（若允許）」是條件性要求，T5 判斷不需要——若 T6 真人
  試跑發現需要，屬於 additive 改動，不影響已交付的 phase state machine 契約。
- **block 跑動中沒有 Abort 按鈕**：操作面板在 `running` phase 會讓位（全視窗遮罩，否則受測者看不到
  目標），因此跑動中按不到 `Abort block`。等效處置：讓 block 跑完後按 `Retry block` 並填理由
  （append-only，資料與理由都留檔；abort 反而不留 payload）。若施測回報真的需要跑動中中止，屬
  additive 改動（見 progress.md D-54.32）。
- **`Rest seconds` 不寫進匯出**：pilot 匯出的 `meta` 沒有 rest 欄位，請操作員手動記錄使用值。
- **真人試跑**：見上方「現況」與 [T6-instrumentation-gate.md](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)。
