# WP-54 / T6 — Instrumentation pilot gate (`instrumentation-gate-v1`)

> WP spec：[README.md](README.md) §4 T6 · checklist：[task-checklist.md](task-checklist.md) T6 ·
> running log：[progress.md](progress.md) · 操作手冊：[../../../../operational/tracking-pilot-runbook.md](../../../../operational/tracking-pilot-runbook.md)
> Format mirrors [WP-52's T4 manual pilot gate](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)
> —— 同一個「automated evidence 證明機制；真人才能證明資料可用」的切分。
>
> **狀態：🟡 Gate A 未決（awaiting real tester runs）。** 工程面（機制、接線、synthetic/determinism
> 證據）已完成並全綠；本文件 §5 是交給研究者的操作步驟，§6 的真人項目與 §8 的 go/revise/stop 必須等
> 真實 pilot 資料回來才能填。**不得**以 synthetic fixture 或自動化測試冒充真人 pilot 證據
> （README §5 執行規則）。

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
| Analysis / code commit | `aa240e4`（2026-09-03T09:38:52+02:00） |
| Protocol version | `tracking-pilot-v1`（`TRACKING_PILOT_PROTOCOL_VERSION`） |
| Metric version | `tracking-dynamics-v1`（`TRACKING_PILOT_EVIDENCE_METRIC_VERSION`） |
| Trajectory versions | `band-limited-2d-v1`、`reversal-2d-v1` |
| Export schema | v2（`SCHEMA_VERSION`） |
| Sim rate | 128 Hz fixed step |
| Block duration | 25 s scored（D-54.4）＋ 1 s prep（scored/calibration） |
| Smoothing / dynamics 預設 | `tracking-dynamics-smoothing-v1-tri3`、`lagSearchMs 0-250`、`minValidTicks 32`（D-54.21，pipeline 預設而非協定凍結） |
| §3 量測環境 | Edge（`msedge` channel）、WebGPU backend、`crossOriginIsolated: true`、`timerResolutionUs ≈ 5`、1280×720、Windows 11、Node v25.9.0 |
| 真人資料版本 | ⬜ 待填（tester 人數、日期、每人 session 數、檔案清單） |

## 9. Go / revise / stop

**🟡 未決（pending real tester runs）。**

- **Go** 的條件：§6 真人項全部勾選、每個 scored 條件 ≥ 2 份可用 run、四層 traceability 無未解
  defect ⇒ T6 PASS，可開 T7（難度校準，12-20 人）。
- **Revise**：出現可修的 instrumentation defect（修完重跑受影響條件即可）⇒ 本文件記錄 defect、修復
  commit 與重跑結果後再判。
- **Stop**：出現無法在 WP-54 範圍內修復的量測效度問題（例如真實 run 普遍 coverage < 99.5%、
  timestamp 非單調、0.5° 條件完全不可辨識且連 calibration 都無法判斷）⇒ 以 stop 結案並記錄原因。

**Gate A 失敗不得用增加真人樣本數掩蓋**（README §5 明文）：Gate A 問的是「儀器量得對不對」，不是
「樣本夠不夠」；覆蓋率/時間戳/事件對表的問題加人只會得到更多壞資料。
