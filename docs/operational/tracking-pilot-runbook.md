# Tracking Pilot — Operator/Researcher Runbook

> WP-54 T5 deliverable（README §2.2 規劃的 NEW 檔）。對象：實際操作 tracking pilot session 的研究者/
> 操作員。上游概念文件：[analysis-tracking.md](analysis-tracking.md)（P0/P1 公式、eligibility/
> compatibility/evidence 契約）、[../exec-plan/active/stage11/wp-54-tracking-pilot/README.md](../exec-plan/active/stage11/wp-54-tracking-pilot/README.md)（需求/介面契約）。

## 現況（2026-09-02，T5 完成後）

T5 交付了 manifest、researcher-only runner 與 operator screen 這三個**機制**本身，並用一個
dev-only harness + 真實瀏覽器 Playwright spec 證明鍵盤流程可用。**尚未**接進 `src/main.ts` 正式 app
（真實 `DrillConfig` 載入、真實 `ExportPayload` 匯出），也**尚未**找真人操作過。把這個 runner 接進
正式 app 並找 3-5 位內部/熟練 tester 實際跑,是 [README §4 T6「Instrumentation pilot」](../exec-plan/active/stage11/wp-54-tracking-pilot/README.md)明文範圍——本文件先說明機制本身怎麼用（今天就能在
dev-only harness 上操作),T6 完成後這份文件會補上「如何在正式 app 內啟動一個真實 pilot session」的
章節。

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

## 如何操作（今天：dev-only harness）

T5 尚未把 runner 接進正式 app,但已經有一個可以實際互動的 harness,證明 operator screen 機制本身
可用：

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

## 如何操作（T6 之後：正式 pilot session）

待 T6 把 `createTrackingPilotRunner()`/`createTrackingPilotOperatorScreen()` 接進 `src/main.ts`
（真實 `loadDrillConfig` 透過既有 drill 載入路徑、真實 `exportBlock` 讀真實 `ExportPayload`）後，本節
會補上：如何從 app 內啟動一個真實 tracking pilot session、如何匯出 `TrackingPilotEvidence`
（`buildTrackingPilotEvidence()`，見 T4 交付）、以及操作員在 quality abort 發生時的建議處置流程。

## 遺留給後續 task 的已知缺口

- **無「跳過休息」按鈕**：`restSeconds` 一旦設定，操作員必須等倒數歸零才會進下一個 block（沒有
  skip-rest 控制）。checklist 只說「rest 略過（若允許）」是條件性要求，T5 判斷不需要——若 T6 真人
  試跑發現需要，屬於 additive 改動，不影響已交付的 phase state machine 契約。
- **main.ts 整合、真人試跑**：見上方「現況」與 T6 範圍說明。
