# WP-54 / T6 — Instrumentation pilot gate (`instrumentation-gate-v1`)

> WP spec：[README.md](README.md) §4 T6 · checklist：[task-checklist.md](task-checklist.md) T6 ·
> running log：[progress.md](progress.md) · 操作手冊：[../../../../operational/tracking-pilot-runbook.md](../../../../operational/tracking-pilot-runbook.md)
> Format mirrors [WP-52's T4 manual pilot gate](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)
> —— 同一個「automated evidence 證明機制；真人才能證明資料可用」的切分。
>
> **狀態：🔴 Gate A = REVISE（第二輪，2026-09-03）；等 KI-023 的速度語意拍板。** 第二輪重跑（P03，9 個 block）已收回並分析：資料鏈路第二次成立且涵蓋 retry 流程與 sphere 幾何、TOT 已離開 100%，但交付速度仍是每軸量（兩軸 cell 超交付 √2 倍）⇒ 見 §11。以下第一輪（P01）記錄保留為歷史：第一份真人資料（P01，9 個 block）已收回並分析：
> 資料鏈路（schema/覆蓋率/事件對表/追溯/報告）全部成立，但**刺激本身有三個缺陷**，其中兩個使
> 預註冊的條件矩陣沒有被真正交付。詳見 §10 結論。**三個缺陷與一個品質閘缺口全部已修**
> （[KI-019](../../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md)
> F-A1+F-A2、run-level protocol-violation 閘門、[KI-020](../../../../known_issue/KI-020-core-matrix-size-speed-manipulation-not-delivered.md)
> size/speed 再參數化、[KI-021](../../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)
> ＋ [GD-30](../../../DECISIONS.md) 的 cube→sphere），§10.4 的四個研究決策也已落地。
> **不以增加真人樣本數掩蓋**（README §5）：這三個缺陷加人只會得到更多量錯條件的資料。

---

## 1. Gate A 要證明什麼

README §4 T6 的 DoD：「synthetic truth、determinism、round-trip、3-5 tester runs 與
`instrumentation-gate-v1` evidence 全綠；go/revise/stop 明確」。拆成兩類：

| 類別 | 內容 | 誰能證明 |
|---|---|---|
| **A-1 機制正確性** | trajectory 連續性/bounds、60/120/240Hz 決定性、event 對表、angular size/speed round-trip、quality flags、export metadata、report traceability | 自動化測試（§2、§3） |
| **A-2 真實資料可用性** | 3-5 位內部/熟練 tester、每條件至少 2 次真實 run；真人資料跑完同一套分析函式後 trajectory/event/export/report 全可追溯 | 只有真人施測（§5、§6、§7） |

A-1 全綠**不代表** Gate A 通過。A-2 未做完前，本 gate 狀態一律是「未決」。

---

## 2. Automated evidence（已全綠）

一次 focused run（`npx vitest run <下表 18 個檔案>`，2026-09-03，HEAD `aa240e4`）：
**18 files / 358 tests passed**。逐檔對應 T6 checklist 的驗證項：

| T6 checklist 驗證項 | 既有測試（不重新設計一套） | tests |
|---|---|---|
| trajectory **連續性 / bounds** | `src/sim/trackingTrajectory.test.ts`（bounds dense sweep、finite-acceleration bound、position/velocity 跨 change event 連續、rest-to-rest leg 邊界零速度） | 35 |
| **60/120/240 Hz 決定性** | 同上「is a pure function of age — independent of sampling cadence」（band-limited 與 reversal 各一）＋ `tests/regression/longrange-tracking-determinism.test.ts` | 35 / 6 |
| **event 對表**（`target_motion_change` / `scored_start`） | `src/data/exportPayloadSchema.test.ts`（parse + round-trip + 每個必填欄缺失的 fail-fast）、`src/sim/TargetManager.test.ts`（prep 窗內不提早 drain）、`src/loop/SimLoop.test.ts`（recorder 收到 scored_start 與 target_motion_change） | 62 / 57 / 46 |
| **angular size/speed round-trip** | `src/drill/tracking_core_pr_pilot_v1.test.ts`（2×2 matrix 每個 (size,speed) 恰一次、scored window 契約、field-low clearance、end-to-end sim run）、`src/drill/tracking_reversal_pilot_v1.test.ts`、`src/data/metadata.test.ts` 的 `spawn.trackingTrajectory` opaque pass-through | 8 / 6 |
| **quality flags** | `src/pilot/trackingRunEligibility.test.ts`（overflow / missing target / non-monotonic timestamp / coverage floor / protocol mismatch，每個 blocked branch 各有 fixture） | 13 |
| **export metadata** | `src/pilot/trackingCompatibilityKey.test.ts`（NFR-54-7 八個 compatibility 維度） | 16 |
| **report traceability** | `src/pilot/trackingPilotEvidence.test.ts`（版本/traceability 欄位、blocked 不進 metric derivation、P1 blocked 不吃掉 P0、condition grouping/seed 統計、determinism deep-equal、practice 排除）、`src/pilot/trackingPilotReport.test.ts`（JSON/HTML parity byte-for-byte、self-contained、`<` escape） | 8 / 3 |
| P0/P1 指標真值 | `src/metrics/trackingDynamics.test.ts`（fixed lag、gain 0.7/1.0/1.3、ambiguity、reversal windows）、`src/metrics/trackingDerivation.test.ts` | 19 / 10 |
| pilot run 不進正式 history | `src/pilot/trackingPilotHistoryExclusion.test.ts` | 3 |
| manifest / runner / operator screen | `src/session/trackingPilotManifest.test.ts`、`src/session/TrackingPilotRunner.test.ts`、`src/ui/TrackingPilotOperatorScreen.test.ts` | 28 / 11 / 15 |
| **main.ts 正式接線**（T6 slice 1-2） | `src/pilot/trackingPilotSession.test.ts`（overlay 讓位/回復、drill-ended handoff、匯出下載、abort 不下載、rest poll、失敗路徑轉 status） | 12 |

全專案基線：`npx tsc --noEmit` exit 0；`npx vitest run` **203 files / 1953 tests passed**
（1 skipped file / 2 skipped tests）。

T6 未新造 synthetic truth fixture——checklist 這兩項的 synthetic 部分已由 T1-T4 既有測試完整覆蓋
（上表），T6 的增量只有「真實 app 接線」與「真人資料」兩件事（見 progress.md D-54.28 的同一判斷
原則：既有證據夠用時不重造一套）。

---

## 3. Live-run instrumentation facts（真瀏覽器實測，非 synthetic）

`tests/e2e/tracking-pilot-live.spec.ts`（T6 slice 2）在真實 app 跑完 practice + calibration 兩個
真實 25 秒 block，並對真的下載下來的 JSON 斷言。2026-09-03 實測結果（Edge/msedge channel、
WebGPU backend、`crossOriginIsolated === true`、1280×720、Windows 11）：

| 觀測 | 值 |
|---|---|
| practice block `meta.drillId` | `tracking_core_pr_pilot_v1_practice` |
| practice `meta.session` | `{participantId:'e2e-pilot', sessionLabel:'tracking-pilot-v1:e2e-pilot:session-0'}` |
| practice `meta.spawn.trackingTrajectory` | `kind:'band-limited-2d-v1'`, `seed:54000`, `yawBoundDeg:2`, `pitchBoundDeg:2`, `targetRmsSpeedDegPerSec:5` |
| practice `meta.spawn.trackingPrepMs` | absent（practice 無 prep 窗）；但仍有 **1 個** `scored_start`（見 D-54.34） |
| practice `meta.recorderOverflow` | `false` |
| calibration block `meta.spawn.trackingPrepMs` | `1000`（FR-54-5 的 1 秒置中窗） |
| calibration `scored_start` 事件數 | 1 |
| calibration ticks / events | `3714` / `2` |
| calibration eligibility | **`Eligible — scored ticks: 3203, duration: 25015.625ms`** |

scored 窗覆蓋率：`25015.625ms × 128Hz ≈ 3202` tick vs 實測 `3203` valid scored ticks ⇒ **≈100%**
（NFR-54-4 門檻 99.5%）。即真實 25 秒 block 在這台機器上沒有掉 tick、沒有 recorder overflow。

> 這些數字是**機器事實**，不是契約：spec 以 `console.log` 印出而不斷言（換機器會變），本表引用的是
> 2026-09-03 這次量測。真人施測時每個 block 的 eligibility 都會顯示在 operator 畫面上，以那次的值
> 為準。

## 4. 自動化證據證明不了什麼

- **0.5° 目標在真實顯示器上是否可辨識**（OQ-54-2 的 pixel/aliasing floor 疑慮）——需要真人眼睛；
  axis calibration 兩個 block 就是為此設計的診斷條件。
- **真人跟槍時的 quality flag 分布**：真人會轉頭、會失去 on-target、可能誤觸發 `protocol_violation`
  （no-fire/no-ADS/no-movement）。上面 §3 的 idle run 完全不會產生這些情形。
- **一整場 9 block session 的體感**：25 秒 × 9 + 休息是否過長、休息是否足夠、操作員在 quality
  abort 發生時能否即時處置。
- **P1 指標在真實資料上是否退化**：lag 是否多峰（`lag-peak-ambiguous`）、gain 是否落在合理範圍、
  drop/reacquire 是否可解讀——synthetic fixture 用的是構造出來的完美/固定 lag 訊號。

---

## 5. How to reach it in the running app（交給研究者的操作步驟）

> 前置：Chrome 或 Edge 桌面版（階段 A 鎖定）。COOP/COEP 由 dev server 提供，`crossOriginIsolated`
> 必須為 `true`（app 啟動時 console 會印 `[isolation] {crossOriginIsolated: true, …}`；若為 false
> 請停止施測並回報，量測時鐘精度不足 ⇒ 資料無效，ADR-4）。

1. `npm run dev`，瀏覽器開 `http://localhost:5173/`。**等 app 完全載入**（畫面出現「選手測試
   Session / 研究員模式 / 歷史紀錄」三個按鈕）。
2. 點 **研究員模式** → 點 **Tracking pilot**。畫面中央出現 `Tracking Pilot — Researcher Session`
   操作面板（全鍵盤可達：Tab 順序即操作順序）。
3. 填 **Participant ID**（建議 `P01`…`P05`，不要填真實姓名——匯出檔會帶這個字串）、選
   **Session index**、填 **Rest seconds**（建議 `20`）。
4. Tab 到 **Start manifest** 按 Enter。面板讓位（全螢幕遮罩自動隱藏），第一個 block（practice）
   開始 3 秒倒數後跑 25 秒。
   - 左上狀態列顯示 `Block N/9（role）：drillId`。
   - **點一下畫面中央進入 pointer lock** 後才能用滑鼠瞄準（跟槍）。
   - **scored block 禁止開火、禁止右鍵 ADS、禁止 WASD 移動**（違反會被記成
     `protocol_violation`，該 block 資料可能作廢）。practice 例外，可自由熱身。
5. block 結束時：瀏覽器**自動下載該 block 的 JSON**，操作面板自動回來並顯示
   - `Block N outcome — role: … — drillId: … — attempt N`
   - scored/calibration block 另有品質橫幅：`Eligible — scored ticks: …, duration: …ms` 或
     `Blocked — reasons: <封閉 reason code>`（**不顯示任何能力分數**，這是刻意設計）。
6. 依品質橫幅決定：
   - **Eligible** → 按 **Continue** 進入休息倒數，倒數歸零自動載入下一個 block。
   - **Blocked**（或操作員判斷這次不算，例如受測者分心/裝置異常）→ 按 **Retry block**，輸入原因後
     **Confirm**。retry **不會覆蓋**原本的匯出與紀錄（append-only，原 attempt 留在 Block log 與
     `retryLog`），只是多跑一次。
7. 重複到第 9 個 block 完成，面板顯示完成訊息。
8. **一位 tester 的完整 T6 份量 = 跑兩次 manifest**：`Session index = 0` 一次、`Session index = 1`
   一次（`1` 對 6 個 scored block 套用 alternate seed family，同條件換一個軌跡實現）。這樣每個
   scored 條件各有 2 份 run，滿足 checklist「每條件至少 2 次」，同時順便把 alternate-seed 載入路徑
   走過一次。每次 manifest ≈ 9 × (25s + 20s 休息) ≈ 7 分鐘，一位 tester ≈ 15-20 分鐘。
9. **人數：3-5 位內部/熟練 tester**（README §4 T6）。這不是 T7 的難度校準（12-20 人），也不是 T8 的
   test-retest（20-30 人、相隔 24-72 小時）——T6 只問「儀器量得對不對」。

### 已知操作限制（T6 slice 1-2 記帳）

- **block 跑動中沒有 Abort 按鈕**：操作面板在 block 進行中會讓位（否則受測者看不到目標）。要中止
  一個進行中的 block，就讓它跑完再按 **Retry block** 並填原因——資料與理由都會留檔，可稽核性不低於
  abort（見 progress.md D-54.32）。若施測時真的覺得需要跑動中中止，請回報，屬 additive 補強。
- **沒有跳過休息的按鈕**：`Rest seconds` 一旦設定就必須等倒數歸零（T5 遺留缺口）。想縮短就把
  `Rest seconds` 填小一點。
- **`Rest seconds` 不會寫進匯出**：pilot 匯出的 `meta` 沒有 rest 欄位（`sessionPlanRestSeconds`
  只在 Session Plan 路徑寫入）。請在回報時**手動記下你用的 rest 秒數**（見 §7）。

---

## 6. Gate A 逐項對帳

**工程項（自動化，已完成 ✅）**

- [x] trajectory 連續性、bounds、60/120/240Hz 決定性有測試證據（§2）。
- [x] `target_motion_change` / `scored_start` event 對表與 schema round-trip（§2）。
- [x] angular size/speed 與 trajectory version/seed 在 export metadata 中 round-trip（§2、§3）。
- [x] quality flag 每個 blocked branch 有 fixture；blocked run 不進聚合（§2）。
- [x] evidence/report traceability：JSON 決定性、HTML/JSON parity、run id 可追（§2）。
- [x] T5 的 runner/operator screen 已接進 `src/main.ts` 正式路徑，真實 `DrillConfig` 載入 + 真實
      `ExportPayload` 匯出，並有真瀏覽器 e2e（§3）。
- [x] practice block 不進 scored aggregation（T6 slice 3 修補，FR-54-5）。

**真人項（未完成 ⬜ — 只有研究者施測後才能勾選，每項需填日期與備註）**

- [ ] 3-5 位內部/熟練 tester 各完成 session 0 + session 1（每個 scored 條件 ≥ 2 份 run）。
- [ ] 每份 run 的 eligibility 已記錄（eligible / blocked + reason code），blocked 的 run 有處置說明。
- [ ] 0.5° 條件在真實顯示器上可辨識（axis calibration 兩個 block 的主觀判斷）；若不可辨識，記為
      T7 的 floor 證據，不在此偷偷淘汰條件。
- [ ] 真人資料跑過 `evaluateTrackingRunEligibility()` + `buildTrackingPilotEvidence()` +
      `renderTrackingPilotReportHtml()`，trajectory/event/export/report 四層皆可追溯。
- [ ] 出現的每個 defect 都已最小化修復 + 補 regression fixture + 重跑受影響條件（各自一個 commit）。
- [ ] 沒有真實 participant payload 被 commit 進 repo（§7）。

---

## 7. 資料回收與交還（研究者 → 分析）

1. 匯出檔會自動下載到瀏覽器預設下載資料夾，檔名形如
   `tracking_core_pr_pilot_v1_2p0deg_5dps-2026-09-03T09_12_34.567Z.json`。
2. **不要把這些 JSON commit 進 repo**（README §5 / T-exit 檢查項：無真實 participant payload 進
   git）。放在 repo 外的資料夾，或 `.playwright-tmp/` 之類已被忽略的路徑，然後把路徑告知分析端。
3. 每位 tester 附一行紀錄：**Participant ID、session index、rest seconds、瀏覽器與版本、顯示器
   解析度/刷新率、發生過的 retry/abort 理由**。（rest seconds 與 retry 理由不在匯出檔裡，只有操作員
   知道。）
4. 分析端（步驟 ④）收到檔案後會做：
   - 每份 payload 跑 `evaluateTrackingRunEligibility()`，對表 operator 畫面當時顯示的判定；
   - 全部 payload 餵 `buildTrackingPilotEvidence()`（practice 會被自動排除並計入
     `excludedPracticeRunCount`），檢查 condition/n/duration/seed/quality 可追到 run id；
   - `renderTrackingPilotReportHtml()` 產 self-contained HTML，檢查 JSON/HTML parity；
   - 對 reversal block 檢查 `target_motion_change` 事件能否還原逐 tick 軌跡（event 對表）；
   - 任何 defect → 最小修復 + regression fixture + 重跑受影響條件，各自一個 commit。

---

## 8. 版本與環境（本文件引用的證據出處）

| 項目 | 值 |
|---|---|
| §2/§3 自動化 + live-run 證據出處 | `aa240e4`（2026-09-03T09:38:52+02:00，T6 slice 3）——該次 focused run 與全專案基線 203 files / 1953 tests 是**當時**的數字 |
| §10 真人資料分析出處 | `8a69fd8`（2026-09-03T10:56:42+02:00，T6 slice 7）——P01 的 9 份 payload 以此版分析器判讀 |
| §11 第二輪分析出處 | `922672f`（2026-09-03，KI-022 修復後）——P03 的 11 份 payload 以此版分析器判讀 |
| 第二輪（P03）所用的刺激 config | `daf1472`（2026-09-03T12:44:53+02:00，slice 12）——§10.4 四個決策 + KI-021/GD-30 的 cube→sphere 全部落地；`vitest` 206 files / 1995 tests passed、`tracking-pilot-live` e2e 1/1、`tsc --noEmit` exit 0。**速度為每軸語意（G2 世代）** |
| 第三輪重跑所用的刺激 config / 現行基線 | `f191642`（2026-09-03，KI-023 Option A 落地於 `690998c` 後）——速度改 **2D 語意（G3 世代）**，交付/宣稱 1.000–1.017（§11.6）；`vitest` 207 files / 2000 tests passed（1 skipped file / 2 skipped tests）、`tsc --noEmit` 與 `-p tsconfig.node.json` 皆 exit 0、`tracking-pilot-live` e2e 1/1 |
| Protocol version | `tracking-pilot-v1`（`TRACKING_PILOT_PROTOCOL_VERSION`） |
| Metric version | `tracking-dynamics-v1`（`TRACKING_PILOT_EVIDENCE_METRIC_VERSION`） |
| Trajectory versions | `band-limited-2d-v1`、`reversal-2d-v1` |
| Export schema | v2（`SCHEMA_VERSION`） |
| Sim rate | 128 Hz fixed step |
| Block duration | 25 s scored（D-54.4）＋ 1 s prep（scored/calibration） |
| Smoothing / dynamics 預設 | `tracking-dynamics-smoothing-v1-tri3`、`lagSearchMs 0-250`、`minValidTicks 32`（D-54.21，pipeline 預設而非協定凍結） |
| §3 量測環境 | Edge（`msedge` channel）、WebGPU backend、`crossOriginIsolated: true`、`timerResolutionUs ≈ 5`、1280×720、Windows 11、Node v25.9.0 |
| 真人資料版本 | 第一輪 P01 session-0 ×9（§10）／第二輪 P03 session-0 ×11（§11）／**第三輪 P04 session-0 ×10 + P05 session-1 ×11**（§12，2026-09-03，G3 刺激）。payload 全程存放於 repo 外,`.pilot-analysis/` 僅存分析產物 |

## 10. Gate A 第一輪結論（2026-09-03，P01）：**REVISE**

### 10.1 收到的資料

| | |
|---|---|
| 受測者 / session | **P01，1 人 × 1 場**（session index 0），9 個 block 全部完成，無 retry/abort |
| 檔案 | 9 份 JSON，2026-09-03T08:15–08:25Z（repo 外；未進 git） |
| 環境 | `crossOriginIsolated: true`、`simHz` 128、**`displayHz` 60.0**、`frames.summary.p95 ≈ 16.8 ms` |
| 分析 | `npx vite-node scripts/analyze-tracking-pilot.ts -- <dir>`（T6 slice 5 交付；HEAD `8a69fd8`） |

**份量未達 checklist 要求**（3-5 位 tester、每條件至少 2 次）。但這不是本次判 revise 的原因——
即使收滿 5 人，下面 §10.3 的兩個缺陷仍會讓資料量錯條件。

### 10.2 資料鏈路：成立 ✅

真人資料上實測通過，這些是 T6 要證明的 instrumentation 事實：

- **schema**：9 份全部通過 `parseExportPayload()`（schema v2），0 拒收。
- **覆蓋率**：每個 scored block 3202–3203 valid scored ticks / 25008–25016 ms ⇒ **≈100%**
  （NFR-54-4 門檻 99.5%）；`recorderOverflow`/`bufferOverflow`/`lateEventCount` 全 0；
  timestamp 全部單調。**60 Hz 顯示器上跑 25 秒 block 沒有掉 tick。**
- **event 對表**：兩個 reversal block 的 `target_motion_change` 記錄數與由 config 重建的排程
  **逐筆相符**（`rec/sched=60/60`、`6644/6644`，`mismatched=0`）——記錄器忠實，連錯誤的刺激也
  忠實記錄下來（正是這一點讓 KI-019 被抓到）。
- **追溯**：每份 `meta.session = {participantId:'P01', sessionLabel:'tracking-pilot-v1:P01:session-0'}`、
  `meta.spawn.trackingTrajectory` 完整、9 個 seed 互不重複（54000/54001/54002/54010–54013/54100/54101）。
- **practice 排除**：`excludedPracticeRunCount: 1`，practice 未進入任何 condition 聚合（FR-54-5）。
- **report**：`buildTrackingPilotEvidence()` → `renderTrackingPilotReportHtml()` 產出的 HTML 內嵌
  JSON 與 evidence 物件**逐位相同**（parity 檢查在寫出的檔案上執行，非記憶體物件）。
- **P0 管線**：`totPercent`、`tAcquireMs`、`acquisitionFailure`、`rmsEpsilonDeg`、`p95EpsilonDeg`
  全部產出，無 `undefined` 缺口。

### 10.3 刺激本身：三個缺陷 ❌

| # | 缺陷 | 證據 | 狀態 |
|---|---|---|---|
| 1 | **reversal medium cell 排程退化**：目標 32.6% 的時間凍結在 ±8° 角落（最長 344 ms），6644 筆 leg（high 只有 60），`reversalIntervalMs` 完全沒生效 | [KI-019 §1](../../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md) | ✅ **F-A1 + F-A2 皆已修**。F-A1：room-aware 方向選擇（medium 降到 46 legs / 1.6% 靜止；high 逐位不變）。F-A2（slice 9）：`angularBoundsDeg [-8,8]→[-13,13]` + 建構期幾何守衛，medium 交付 **36 次反轉 / 1.1% 靜止**。殘差：36 次 vs 宣稱約 23 次（邊界截斷是設計本身的必然，[KI-019 §5.3](../../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md)）；medium(36) vs high(59) 密度對比方向正確且單調，是否再放寬到 ±25° 留給 T7 |
| 2 | **core matrix 的 speed 自變數完全失效**：5 vs 20 deg/s 實測交付 1.21 vs 1.18 deg/s（差 2%）；交付速度只由振幅決定，metadata 宣稱值從未被交付 | [KI-020 §1/§2.1](../../../../known_issue/KI-020-core-matrix-size-speed-manipulation-not-delivered.md) | ✅ **已修**（slice 10）：頻帶 `[0.1,0.7]→[0.3,2.1]` Hz + 所有 cell 共用振幅 ±16°，實測交付 5.05 / 20.21 deg/s；並加建構期守衛（請求速度不可交付即 fail fast） |
| 3 | **目標角尺寸從未被操弄**：「size」被實作成行程振幅，沒有 cell 設 `targets.hitbox`，四個 cell 目標一樣大（約 ±7°）；六個 block TOT 全部 100.0%，`p95 ε` 3.63° 仍算 on-target ⇒ TOT 在現行 config 下不帶資訊；兩個 axis calibration block 無法達成「判斷 0.5° 是否可辨識」的用途 | [KI-020 §2.2](../../../../known_issue/KI-020-core-matrix-size-speed-manipulation-not-delivered.md) | ✅ **已修**（slice 10）：每 cell 設 `targets.hitbox`（0.5°→0.03491u、2.0°→0.13964u @4u）；axis calibration 改用至風險的 0.5° 目標；reversal cell 固定 2.0°。**slice 12（KI-021/GD-30）把幾何由 cube 改回 sphere**，直徑不變，on-target 容許角因此等向 |

另外修掉一個**品質閘缺口**（非刺激問題）：受測者在一個 scored reversal block 按了右鍵 ADS，
`protocol_violation` 有被記錄、P1 有自我封鎖（`protocol-incompatible`），但 run-level eligibility
沒有 protocol 這個 reason code ⇒ 操作端當時看到的是 **Eligible**，而 **primary RMS(ε) 照樣被聚合**。
已加 `'protocol-violation'` 到封閉 vocabulary（T6 slice 7）；重跑分析後該 block 正確顯示
`BLOCKED protocol-violation` 且不再產出 p0/p1。

### 10.4 研究者決策（2026-09-03，全部已落地）

1. **KI-019 §5（reversal medium 再參數化）** → **放寬角度視窗至 `[-13, 13]`**，兩個被操弄變數維持
   預註冊值。落地於 slice 9，含建構期幾何守衛。殘差：medium 交付 36 次反轉 vs 宣稱約 23 次
   （源於設計本身的邊界截斷，KI-019 §5.3）；是否再放寬到 ±25° 留給 T7。
2. **KI-020 §4.1（size 的語意）** → **改成真的目標角尺寸**（每 cell 設 `targets.hitbox`）。
   落地於 slice 10（當時為 cube）。**2026-09-03 修正**：slice 10 選 cube 是為了繞過 WP-55 的
   box-only 閘門，而該限制的根因是 [KI-021](../../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)
   （on-target 離線推導忽略 `hitbox.shape`，違反 GD-7／CONTEXT §23）。KI-021 修復後，**slice 12**
   依 [GD-30](../../../DECISIONS.md) 把兩個 pilot 家族的 hitbox 改回 `shape:'sphere'`（直徑與 cube
   邊長相同，故 `widthU` 不變）。
3. **KI-020 §4.2（speed 如何交付）** → 最初選「放大振幅」，實測回報後改選 **提高頻帶
   `[0.3, 2.1]` Hz + 共用振幅 ±16°**：原方案在 20 deg/s 需 ±48° 振幅，目標會走到 ±37°、沉到地板下
   並超出垂直 FOV（KI-020 §6.1）。落地於 slice 10，含建構期速度守衛。
4. **60 Hz 顯示器** → **接受，並把刷新率加進 compatibility key**。落地於 slice 11：
   `TrackingCompatibilityKey.displayRefreshHz`（四捨五入到整數 Hz，避免 59.98/60.02 拆散 cohort）。
   `evaluateTrackingRunEligibility()` 仍不看 `suspect`——60 Hz 面板的 `perfFloor: true` 是既有
   `PERF_FLOOR_MS = 8.33`（為解析度研究設定）的必然結果，不是 tracking 量測失效。

### 10.5 下一步（工程面已就緒，等重跑資料）

§10.4 的四個決策**都已落地並全綠**（`vitest` 206 files / 1991 tests、`playwright
tracking-pilot-live` 1/1 以新 config 通過）。因此 Gate A 的下一輪只缺資料：

**前置已完成**：KI-021 + GD-30 的 cube→sphere（slice 12）**已於重跑前落地**——on-target 幾何一改，
TOT／`tAcquireMs`／drop-reacquire 語意就變，若在重跑後才改，兩批真人資料不可合併。

**全部 9 個 block 重跑**——core/calibration/reversal 三家族的刺激都變了（含 hitbox 幾何由 cube 改為 sphere）（含 high cell：視窗放寬後
它的軌跡也不同），P01 的 2026-09-03 資料全部作廢。3-5 位 tester、每人 session 0 + session 1，
操作步驟與回收格式不變（§5、§7），再重跑本文件 §10.2 的同一套檢查。

重跑時**新增兩個要看的東西**（前一輪不可能看到）：

- **0.5° 目標是否真的看得見**：兩個 axis calibration block 現在才真的用 0.5° 目標（約 3.5 個
  pixel 寬 @1080p/103° FOV）。若看不見或只能靠猜，那是 T7 要的 floor 證據——照實回報，不要放大目標。
- **TOT 是否離開 100%**：目標變小後 `totPercent` 才會有變異；若仍恆為 100%，代表 on-target 判定
  仍過寬，要回頭查 hitbox 是否真的生效。

**本次已確立的事**（重跑後不需再證）：資料鏈路、覆蓋率、事件對表、追溯、報告 parity、practice
排除、protocol-violation 閘門，以及 60 Hz 機器上 25 秒 block 不掉 tick。**未確立**：任何關於
size/speed/reversal-density 條件的結論。

## 11. Gate A 第二輪（2026-09-03，P03 重跑）

### 11.1 收到的資料

| | |
|---|---|
| 受測者 / session | **P03，1 人 × 1 場**（session index 0），9 個 block 全部完成，2 次 retry（#3 `calibration_vertical`、#6 `2deg_5dps`，皆因 `protocol_violation`）⇒ **11 份匯出** |
| 環境 | `crossOriginIsolated: true`、`simHz` 128、**`displayHz` 60.0**、每份 `suspect: true` / `validity.perfFloor: true`（OQ-54-11 已決：eligibility 刻意不看 `suspect`） |
| 分析 | `npx vite-node scripts/analyze-tracking-pilot.ts -- <dir> --out .pilot-analysis/P03`（HEAD `922672f`，含 KI-022 修復） |
| 刺激 build | `hitbox.shape: 'sphere'`、`widthU` 0.03491（0.5°）/ 0.13964（2.0°）@4u ⇒ **slice 12 的現行 config** |

**批次識別（分析前的第一件事）**：交回的檔案路徑與操作端 block log 對不上。逐份讀 `meta` 後確認
`Downloads` 內是**三位不同 participant**——P01（`hitbox box w=1`，KI-020 修復前，已作廢）、
P02（`box` 0.0349/0.1396，slice 10/11 的 **cube** build）、P03（`sphere`，現行 build）。
**32 份檔案的檔名與 `meta.drillId` 全部吻合（0 筆不符）⇒ 無匯出命名缺陷**；block log 逐筆
（含兩次 retry 落點）對應的是 **P03**。P02 因 on-target 幾何不同（cube）**不可與 P03 合併**
（§10.5 已預先聲明此不可合併性），本節只採 P03。

**份量仍未達 checklist 要求**（3-5 位 tester、每人 session 0+1、每條件 ≥ 2 份）。與 §10.1 同樣的
理由：份量不是本輪判定的依據——§11.4 的缺陷會讓再多受測者也量到錯的速度刻度。

### 11.2 資料鏈路：再次成立 ✅（且這次涵蓋 retry 流程與 sphere 幾何）

- **schema**：11/11 通過 `parseExportPayload()`，0 拒收。
- **覆蓋率**：每個 scored block **3201–3203** valid scored ticks / 25000–25016 ms ⇒ **≈100%**
  （NFR-54-4 門檻 99.5%）；overflow/late-event 全 0；timestamp 單調。
- **event 對表**：`reversal_medium` **rec/sched = 36/36**、`reversal_high` **59/59**，
  `mismatched = 0`。**這正是 KI-019 F-A2 修復後預測的數字**（KI-019 §5.3：medium 36、high 59），
  在真人資料上逐筆兌現。
- **靜止比例**：medium **1.1%**、high **1.9%**（§10.5 訂的 < 5%）⇒ KI-019 的貼牆退化確實消失
  （修前 32.6%）。
- **追溯**：`meta.session = {participantId:'P03', sessionLabel:'tracking-pilot-v1:P03:session-0'}`；
  9 個 seed 互不重複（54000/54001/54002/54010–54013/54100/54101），retry 沿用同 seed（同條件重跑
  同軌跡實現，符合設計）。
- **practice 排除**：`excludedPracticeRunCount: 1`。
- **品質閘（本輪新證據）**：兩個 `protocol_violation` block 被 run-level gate 正確判
  `BLOCKED protocol-violation`，與操作員當時畫面一致；其 retry 判 `Eligible`；**blocked run 不產出
  p0/p1，且不吃掉同條件 eligible run 的指標**（FR-54-10）。T6 slice 7 的閘門第一次在真人資料上
  被觸發並正確運作。
- **report**：JSON/HTML parity 在寫出的檔案上逐位相同。

### 11.3 §10.5 兩個新觀察點的結果

| 觀察點 | 結果 |
|---|---|
| **TOT 是否離開 100%** | ✅ **是**。八個條件 `totPercent` 落在 **0.3% – 34.6%**（0.5°/20dps 0.3%、0.5°/5dps 2.6%、2°/20dps 4.0%、2°/5dps 34.6%、calib-h 12.0%、calib-v 10.6%、reversal high 13.8% / medium 18.9%）⇒ **hitbox 真的生效**，TOT 恢復為帶資訊的指標（修前六個 block 全部 100.0%） |
| **0.5° 目標是否可辨識** | ❗ **受測者回報「幾乎看不見／只能靠猜」**（2026-09-03）。依 §10.5 的預先約定，**不放大目標**——這是 T7 難度校準要的 floor 證據，照實留檔。客觀面：0.5°/20dps 的 `tAcquireMs` 為 **3172 ms**（其餘條件 0–1555 ms）、TOT 僅 0.3%、`drops/s` 0.275（少到不是「一直掉」而是「幾乎沒上過」）。**但客觀數字被 §11.4 的 KI-023 汙染**——該 cell 實際跑在 **28.3 deg/s** 而非預註冊的 20 ⇒ **不得據此批資料把 0.5° 判為 floor**；主觀回報本身仍成立（0.5° 的可見性與速度無關），T7 應在修正後的速度下重新確認 |

### 11.4 本輪新缺陷

| # | 缺陷 | 狀態 |
|---|---|---|
| 1 | **交付速度是每軸量,兩軸 cell 超交付 √2 倍**：四個 core cell 實測 2D RMS **7.14 / 28.3 deg/s** vs 宣稱 5 / 20（141–143%，驗收帶 0.9–1.1）；單軸 calibration 交付 1.0 倍 ⇒ 宣稱同為 5 deg/s 的 block 實際差 1.41 倍。T1 測試量單軸、分析 runner 量 2D ⇒ **同一構念兩個定義**（違反 C-D4）。速度比值（4×）完好 | ✅ **已修**（[KI-023](../../../../known_issue/KI-023-target-speed-set-point-is-per-axis-not-2d.md)；研究者選定 Option A，含 reversal 家族）⇒ 見 §11.6 |
| 2 | **分析摘要描述被擋的第一次 attempt**：主控台摘要取 `condition.runs[0]`，而 evidence 依 FR-54-10 是 append-only、blocked run 依契約不帶 p0/p1 ⇒ 兩個重跑過的條件被印成 `p0=- p1=-`（8 個條件中 2 個）。evidence JSON/HTML 一直正確 | ✅ **已修**（[KI-022](../../../../known_issue/KI-022-pilot-analysis-summary-reads-blocked-first-attempt.md)，commit `922672f`）；重跑分析後八個條件全部印出 P0/P1 |

### 11.5 其他觀察（非缺陷，供 T7 決策）

- **P1 lag railing**：八個條件中 **5 個**的 `lagMs` 恰為 **250.0 ms** = `lagSearchMs 0-250` 的搜尋上界
  ⇒ 這些估計是撞到邊界而非真峰值，`status` 仍回 `'ok'`。是否放寬搜尋範圍或新增「railed」品質旗標，
  留給 T7（D-54.21 記明 smoothing/lag 參數是 pipeline 預設而非協定凍結值）。
- **velocity gain 全部 > 1**（1.032–1.445）：真人普遍過衝，與 synthetic fixture 的 0.7/1.0/1.3 分布不同。
- **reversal window 排除率**：high 59 → 評估 56（`insufficient-window-data` 3）；medium 36 → 評估 32
  （`insufficient-window-data` 3、`overlap` 1）。排除理由都是封閉 reason code，可稽核。
- **一場 session 出現 2 次 protocol violation**：操作步驟（§5 第 4 點）的「禁開火/禁 ADS/禁移動」
  在實測中被違反兩次。runbook 可能需要在 block 開始前更醒目的提示。

### 11.6 研究決策與落地（2026-09-03）

**研究者選定 [KI-023](../../../../known_issue/KI-023-target-speed-set-point-is-per-axis-not-2d.md)
Option A：`targetRmsSpeedDegPerSec` 改為交付的 2D RMS 角速度**，並回答 OQ-KI23-1「reversal 家族
一併改」。落地方式：每軸求解目標改為 `set-point / √(活躍軸數)`（活躍軸以既有的
`SUPPRESSED_AXIS_BOUND_DEG` 判定）；reversal 每軸自 `speedRangeDegPerSec / √2` 抽樣（抽樣次數不變
⇒ 同 seed 的 RNG 流結構不變）。

| drill | 交付 2D RMS / 宣稱 | 修前 | 最大行程 | 交付反轉數 |
|---|---|---|---|---|
| `practice` / `2deg_5dps` / `0p5deg_5dps`（5 deg/s） | **1.002 / 1.010 / 1.014** | 1.418 / 1.428 / 1.435 | ±2.2–2.4° | — |
| `2deg_20dps` / `0p5deg_20dps`（20 deg/s） | **1.002 / 1.000** | 1.417 / 1.414 | ±9.2–11.1°（修前 ±13–14°） | — |
| `calibration_horizontal` / `_vertical` | **1.013 / 1.017** | 1.013 / 1.017（**逐位不變**） | ±3.5–3.7° | — |
| `reversal_medium` / `_high` | 2D RMS 11.72 / 9.59（範圍 [5,20]） | 14.76 / 13.38 | ±13° | **29 / 58**（修前 36 / 59） |

**兩項副效益**：①20 deg/s cell 的行程縮到 ±9–11°，離地板與垂直 FOV 邊界更遠；
②**KI-019 §5.3 的殘差同步改善**——medium 交付反轉數 **36 → 29**（config 宣稱約 23），因為每軸速度
降 1/√2 使 leg 行程縮短、邊界截斷減輕。是否仍需放寬到 ±25° 由 T7 依此新數字再判。

**驗證**：`npx vitest run` **207 files / 2000 tests passed**（1 skipped file / 2 skipped tests）；
`npx tsc --noEmit` 與 `-p tsconfig.node.json` 皆 exit 0；
`npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge` 1/1 passed（以新 config
真實跑完 practice + calibration 兩個 25 秒 block）。修前紅已於工作區證實（2D 比值 1.4186 > 1.05、
reversal leg 的 2D 巡航 31.75 > `speedMax` 30）。

### 11.7 下一步：第三輪重跑（9 個 block）

**P03 這批（以及 P01/P02）作廢**：speed 是被操弄的自變數，其刻度改變即條件改變；三批資料屬
[analysis-tracking.md](../../../../operational/analysis-tracking.md)「刺激語意」節定義的 **G2 世代**
（每軸語意），與現行 **G3** 不可合併。

- **重跑範圍**：9 個 block 全部。core 四個 cell + practice 的軌跡改變、reversal 兩個 cell 的軌跡
  改變；**axis calibration 兩個 block 逐位不變**，但仍隨 manifest 一起跑（且 §11.3 的 0.5° 主觀
  回報需要在修正後的速度下再確認一次）。
- **份量**：3-5 位 tester、每人 session 0 + session 1（操作步驟與回收格式不變，見 §5、§7）。
- **這次要看的**：`rmsSpeed=交付/宣稱` 每個 cell 應落在 **0.9–1.1**（本輪離線量測已是 1.000–1.017，
  真人資料上應複現）；reversal `still=` < 5%；TOT 分布（本輪 0.3–34.6%，速度修正後預期整體上移）；
  以及 **0.5° 目標在 20 deg/s 修正後是否仍「只能靠猜」**。
- **不需再證**（§10.2 + §11.2 已兩次成立）：資料鏈路、覆蓋率、事件對表、追溯、報告 parity、
  practice 排除、protocol-violation 閘門與 retry 流程、60 Hz 上 25 秒 block 不掉 tick。

### 11.8 判定

依 §9 既有判準——「出現**可修的** instrumentation defect（修完重跑受影響條件即可）」——本輪
為 **🔴 REVISE**：資料鏈路第二次成立且涵蓋面更廣（retry 流程、sphere 幾何、TOT 恢復資訊量），
但 KI-023 使預註冊的速度刻度未被交付。兩個缺陷**都已修完**（KI-022 commit `922672f`、KI-023 見
§11.6），**Gate A 的下一輪同樣只缺資料**：9 個 block 第三輪重跑（§11.7）。

**這是第二次因「刺激未交付預註冊操弄」而 revise**（第一次 §10.3）。兩次的共同根因不是儀器，而是
**測試量錯了量**：KI-020 的容忍度（`rms > 0.5`）讓「宣稱 20、交付 1.18」出貨，KI-023 的單軸量法讓
「宣稱 20、交付 28.3」出貨。現在 T1 與 drill 層的斷言都改量交付的 2D 速度，且驗收帶收緊到
0.95–1.05；分析 runner 的 `stimulusCheck()` 從一開始就量對，兩次都是它揭露的——**T7 之前不應再放寬
這條帶寬**。

## 12. Gate A 第三輪（2026-09-03，P04 + P05,KI-023 後的 G3 刺激)

### 12.1 收到的資料

| 批次 | session | payload 數 | `startedAt` 範圍 (UTC) | scored seed 家族 |
|---|---|---|---|---|
| P04 | `tracking-pilot-v1:P04:session-0` | 10（9 block + 1 retry） | 12:17:32Z – 12:23:39Z | 54010–54013 / 54100–54101 |
| P05 | `tracking-pilot-v1:P05:session-1` | 11（9 block + 2 retry） | 12:24:48Z – 12:32:43Z | **64010–64013 / 64100–64101**（alternate family） |

**世代歸屬(G3)有直接證據,不只靠時間**:KI-023 的修法落在 `690998c`（12:14:03Z），兩批的
`startedAt` 都晚於它;更強的是 §12.3 的**逐位比對** —— 21/21 payload 的**錄到的目標位置**與現行程式
重建的刺激完全一致。P05 的 practice/calibration 三個 block 沿用 `54000/54001/54002` 屬設計（§5 步驟
8：alternate seed family 只套用於 6 個 scored block），非缺陷。

### 12.2 四層對帳:全部成立 ✅

- **schema(層 1)**：21/21 `parseExportPayload()` 通過,無 REJECTED。
- **eligibility(層 2)**：scored/calibration 每份 3202–3203 valid ticks / 25008–25016 ms(覆蓋率
  ≈100%)。**3 份 blocked,全部 `protocol-violation`**,每個都被 retry 且 retry 合格;append-only
  保留原 attempt。合併聚合後 **8 個 scored 條件全部 `eligible=2`** ⇒「每條件 ≥ 2 份可用 run」達標。
- **event 對表(層 3)**：reversal `rec/sched` = **58/58、29/29**(P04)與 **55/55、42/42**(P05),
  四份 `mismatched=0`。
- **evidence / report(層 4)**：`buildTrackingPilotEvidence()` 8 條件、practice 自動排除
  (`excludedPracticeRunCount` 每批 1、合併 2);`renderTrackingPilotReportHtml()` 三次
  **JSON/HTML parity ok**;condition/n/seed/quality 可追到 run id。
- **KI-022 修復在真人資料上生效**:3 個被 retry 的條件在主控台都印出指標(不再 `p0=- p1=-`)。

### 12.3 KI-023 的修正被交付了 ✅(本輪的核心問題)

| 量法 | 結果 |
|---|---|
| 分析 runner 的 `stimulusCheck()`（重建刺激的解析速度） | 每個 band-limited cell **99–102% of nominal** |
| **錄到的目標位置反推**(獨立於重建) | 交付/宣稱 **0.989–1.017**;逐位誤差 ≤ **8.9e-16 u** |

§11.7 要求的 0.9–1.1 帶寬**每個 cell 都達標**,且兩種量法一致。行程也如 §11.6 預測收到
`maxAbs ±9.2–11.1°`(修前 ±13–14°)。reversal `still=` **1.3% / 2.9% / 1.9% / 2.6%**,全部 < 5%。
TOT 由第二輪的 0.3–34.6% 上移到 **0.2–49.4%**,與速度修正後的預期一致。

> **這個「錄到的位置 vs 重建」比對不是現行 pipeline 的一部分。** `analyze-tracking-pilot.ts` 的
> `stimulusCheck()` 是用**現行程式**從 `meta.spawn.trackingTrajectory` 重建刺激再量它自己的 RMS;
> reversal 家族有 `target_motion_change` 事件可以對表,但 **band-limited 家族沒有任何事件**,因此
> pipeline 結構上無法分辨「payload 是舊世代程式錄的」。本輪改用 ticks 裡的 `tx/ty/tz`(sim 經
> `projectTrackingAngles()` 寫入)與重建值逐位相減來補這個洞(量的是「錄到的曲線 == 重建的曲線」,
> 不是新構念,不違反 C-D4)。
>
> **已升成 runner 的固定一層(layer 3b)**:使用者 2026-09-03 決定(§12.6 第 3 項),落地為
> `scripts/trackingStimulusFidelity.ts` + `tests/regression/tracking-stimulus-fidelity.test.ts`,
> 每份 run 印出 `fidelity=match|mismatch maxPosErr=… sightline=…`,mismatch 另走 stderr 警示。
> 視線幾何(`distanceU`/`centerY`)**由 payload 自身反解**而非寫死常數,故換 drill 距離會顯示出來而
> 不是被假設掉;實測 P04/P05 全部回報 `sightline=4.000u/y1.500`。
>
> **真人資料反向驗證**:把這一層套回已作廢的 P03(G2)批次,**11 份中 8 份被判 mismatch**
> (`maxPosErr` 7.2e-2 – 1.6 u),而通過的 3 份**恰好是兩個單軸 axis calibration block**——正是
> KI-023 §6 記載「單軸 calibration 逐位不變」的那些。這一層的判定獨立重現了 KI-023 的修法語意。

### 12.4 本輪未發現 instrumentation defect

**這是三輪來第一次沒有缺陷需要修**。以下四項是觀察/殘留,依既有決策歸 T7,不在本輪修:

- **N1 — reversal 交付反轉數強烈依賴 seed**:medium **29**(seed 54100)vs **42**(seed 64100),
  config 宣稱約 23(+26% / +83%)。P05 的密集排程使 **8/42(19%)個 window 落入
  `insufficient-window-data`**(P04 只有 1/29)。機制是 KI-019 §5.3 的邊界截斷;`rec/sched` 相符且
  排除都帶封閉 reason code ⇒ **儀器忠實,但同一條件跨 seed 家族的刺激可比性受影響**,是 T7 放寬
  邊界到 ±25° 的新證據。
- **N2 — P1 lag railing 惡化**:`lagMs` 恰為搜尋上界 250.0 ms 的條件由第二輪 5/8 增為
  **每批 6/8**,`status` 仍回 `'ok'`。歸 T7(D-54.21:該參數是 pipeline 預設,非協定凍結值)。
- **N3 — 5/5 的 protocol violation 都是 `kind: "ads"`**(第二輪 2 次 + 本輪 3 次,全部右鍵)。
  runbook 的事前提示不足。兩個處置方向見 §12.6。
- **N4 — velocity gain 仍普遍 > 1**:16 個條件中 15 個落在 1.00–1.43(僅 P04 的 0p5deg_20dps
  0.965)。真人普遍過衝,與 synthetic fixture 分布不同(第二輪已記錄)。

### 12.5 §6 真人項的覆蓋落差(尚未達標的部分)

| §6 真人項 | 狀態 |
|---|---|
| 每個 scored 條件 ≥ 2 份可用 run | ✅ 8/8 條件 `eligible=2` |
| 四層 traceability 無未解 defect | ✅ §12.2 |
| 每個 defect 已修 + regression fixture + 重跑 | ✅ 無 defect(N/A) |
| 無真實 participant payload 進 git | ✅ payload 全程在 repo 外;`.pilot-analysis/` 已 gitignore |
| **3–5 位 tester** | ❌ **只有 2 位**(P04、P05) |
| **每位 tester 各完成 session 0 + session 1** | ❌ P04 只有 session-0、P05 只有 session-1 |
| **0.5° 條件在修正後的速度下的主觀可辨識性** | ⬜ 待操作員回報(§11.3 在 28.3 deg/s 下的回報是「只能靠猜」,不可沿用) |
| §7 每人一行紀錄(rest 秒數、retry 理由) | ⬜ 待補(瀏覽器/顯示器已可從 meta 取得：Edge 151、3840×2160、60 Hz、`crossOriginIsolated: true`) |

### 12.6 待研究者決定(不由 agent 拍板)

1. **§6 的 tester 份量**：(a) 補 1–3 位 tester、每位跑 session 0 + 1,照 §6 原文結案;或
   (b) 以 2 位 × 各一 session(8 條件皆 2 份可用 run)結案並在帳本記錄理由。**這是預註冊份量的
   取捨,屬研究決策。**
2. **N3 的處置**：(a) 只加強 runbook 事前提示(additive、不動程式);或 (b) scored block 直接
   抑制 ADS 輸入(改輸入層可及行為 ⇒ 改變受測者能做的事,屬研究決策)。
3. ~~**§12.3 的「錄到的位置 vs 重建」比對是否升成 runner 的一層**~~ ✅ **已決(2026-09-03):升成
   固定一層 + regression fixture**,落地見 §12.3 的方框(T6 slice 17)。

### 12.7 判定

**無 instrumentation defect ⇒ 不是 REVISE;也還不能宣告 GO** —— §6 的 tester 份量與 0.5° 主觀項
(§12.5)未達標,而那是預註冊份量與刺激可辨識性的判斷,依 §12.6 第 1 項交研究者決定後才落判。
**儀器面在本輪通過了資料能檢驗的每一項**(§12.2、§12.3)。

**分析出處**:`a786e4b`(分析器自 `922672f` 起未變);刺激基線 `f191642`(KI-023 落地於 `690998c`)。
**環境**(取自 payload meta):Edge 151.0.0.0、WebGPU、`crossOriginIsolated: true`、`displayHz` 60、
native 模式 3828×1911 buffer / 3840×2160 螢幕、`fovDeg` 75、`sensitivity` 1(`cs2-0.022deg`)、
scene `field-low`。每份匯出仍帶 `suspect: true` / `validity.perfFloor: true`(60 Hz 面板撞
`PERF_FLOOR_MS`,eligibility 刻意不看,OQ-54-11 已決)。

## 9. Go / revise / stop

**🔴 REVISE（2026-09-03）。** 判準與證據見 §10。摘要：資料鏈路成立，刺激不符預註冊操弄；**三個缺陷
與一個品質閘缺口全部已修**（KI-019 F-A1+F-A2、run-level protocol-violation 閘門、KI-020 size/speed
再參數化、KI-021 ＋ GD-30 的 cube→sphere），§10.4 的四個研究決策已落地並全綠。**下一輪只缺資料**：
9 個 block 全部重跑（§10.5）後才重判 go/revise/stop。

**🔴 REVISE（第二輪，2026-09-03，P03）。** 見 §11。資料鏈路第二次成立（覆蓋率、event 對表 36/36 與 59/59、追溯、parity、practice 排除，且新涵蓋 retry 流程與 sphere 幾何）；TOT 已離開 100%（0.3–34.6%）⇒ hitbox 生效。新缺陷兩個：[KI-022](../../../../known_issue/KI-022-pilot-analysis-summary-reads-blocked-first-attempt.md) ✅ 已修；[KI-023](../../../../known_issue/KI-023-target-speed-set-point-is-per-axis-not-2d.md) ✅ 已修（交付速度是每軸量、兩軸 cell 超交付 √2 倍；研究者選定 **Option A** 改 2D 語意並含 reversal 家族，commit `690998c`，落地數字見 §11.6）。**下一輪只缺資料**：9 個 block 第三輪重跑（§11.7）。

**🟡 第三輪（2026-09-03，P04 session-0 + P05 session-1，G3 刺激）：無 defect,判定待研究者決定。**
見 §12。四層對帳全部成立(schema 21/21、覆蓋率 ≈100%、event 對表 58/58・29/29・55/55・42/42
`mismatched=0`、parity ok、8 個 scored 條件皆 `eligible=2`);**KI-023 的修正確實被交付**——交付/宣稱
每 cell 落在 0.9–1.1(重建量法 99–102%,錄到的位置反推 0.989–1.017,且 21/21 payload 與現行程式重建
的刺激**逐位一致**,誤差 ≤ 8.9e-16 u)。**三輪來第一次沒有缺陷需要修**。尚未 GO 的原因不是儀器,而是
§6 的份量:只有 2 位 tester、且各只跑一個 session,加上 0.5° 主觀可辨識性尚未在修正後的速度下回報
(§12.5)。處置選項見 §12.6(屬研究決策)。

- **Go** 的條件：§6 真人項全部勾選、每個 scored 條件 ≥ 2 份可用 run、四層 traceability 無未解
  defect ⇒ T6 PASS，可開 T7（難度校準，12-20 人）。
- **Revise**：出現可修的 instrumentation defect（修完重跑受影響條件即可）⇒ 本文件記錄 defect、修復
  commit 與重跑結果後再判。
- **Stop**：出現無法在 WP-54 範圍內修復的量測效度問題（例如真實 run 普遍 coverage < 99.5%、
  timestamp 非單調、0.5° 條件完全不可辨識且連 calibration 都無法判斷）⇒ 以 stop 結案並記錄原因。

**Gate A 失敗不得用增加真人樣本數掩蓋**（README §5 明文）：Gate A 問的是「儀器量得對不對」，不是
「樣本夠不夠」；覆蓋率/時間戳/事件對表的問題加人只會得到更多壞資料。
