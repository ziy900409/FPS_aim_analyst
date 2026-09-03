# WP-54 — Progress / Decision Log

## Status

- **Current**：✅ T0～T5 完成（2026-09-02）；T6 **Gate A = REVISE**（2026-09-03，見 [T6-instrumentation-gate.md §10](T6-instrumentation-gate.md)）。工程面 slice 1-11 全部完成並全綠：main.ts 接線、live e2e、practice 排除、gate 帳本、分析 runner、[KI-019](../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md)（F-A1+F-A2）、run-level protocol-violation 閘門、[KI-020](../../../known_issue/KI-020-core-matrix-size-speed-manipulation-not-delivered.md)（size→hitbox、speed 交付、建構期守衛）、compatibility key 新增 `displayRefreshHz`。**唯一待辦 = 9 個 block 重跑**（三家族刺激都變了，P01 資料全部作廢）。
- **Scope state**：已正式納入 stage11（見 [../README.md](../README.md)、[../task-checklist.md](../task-checklist.md)、[../progress.md](../progress.md)）。M20 為本 WP 里程碑。
- **Dependency state**：`tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` baseline 綠燈（見下方 verification log）；OQ-54-1~OQ-54-8 全數凍結（見 §1.4 與下方 decision log）；OQ-54-9（`inputMode` 語意）為 T4 slice 2/6 新增、未與使用者確認的判斷岔路，不阻塞後續 task。

## Progress

### 2026-09-03 — T6 gate 帳本一致性修正（docs-only，無程式碼變更）

`T6-instrumentation-gate.md` 有三處敘述停在 slice 8，與 §10.4／§10.5 的現況矛盾——重跑前交給
研究者的文件必須自洽，故一併校正（不改任何 go/revise/stop 判斷本身）：

- **狀態抬頭（§0）與 §9 摘要**：原寫「已修 2 個，2 個待研究者決策（KI-019 F-A2、KI-020）」。實際
  三個缺陷加一個品質閘缺口全部已修（KI-019 F-A1+F-A2、run-level protocol-violation 閘門、KI-020
  size/speed 再參數化、KI-021 ＋ [GD-30](../../../DECISIONS.md) 的 cube→sphere），四個研究決策已
  落地並全綠。§9 另補「下一輪只缺資料」。
- **§10.3 缺陷表第 1 列**：狀態仍是 `🟡 F-A2 …待決`，但 F-A2 已於 slice 9 落地（`angularBoundsDeg
  [-8,8]→[-13,13]` + 建構期幾何守衛，medium 交付 36 次 / 1.1% 靜止）。改為已修，並把殘差
  （36 vs 宣稱 23 次）與「是否再放寬到 ±25° 留給 T7」寫進同一格，指向 KI-019 §5.3。
- **§8 版本表**：原本只有一列 `Analysis / code commit: aa240e4`，但 `aa240e4` 其實是 slice 3 的
  commit，早於本文件引用的 slice 9-12 證據，讀者會誤以為整份文件的數字都出自該版。拆成三列並各自
  標明出處與適用範圍：`aa240e4`（§2/§3 自動化 + live-run，含「203 files / 1953 tests 是當時數字」
  的但書）、`8a69fd8`（§10 的 P01 分析器版本）、`daf1472`（重跑所用的刺激 config／現行基線
  206 files / 1995 tests）。
- **驗證**：docs-only，未觸碰任何 `src/`、`tests/`、`scripts/`；新增的兩個相對連結
  （KI-021、DECISIONS.md）已確認檔案存在。**重跑要求與操作步驟（§5/§7/§10.5）一字未改。**

### 2026-09-03 — T6 slice 9-11：四個研究決策落地（KI-019 F-A2、KI-020、compatibility key）

- **使用者決策（4/4 已落地）**：①reversal 視窗放寬到 ±13°；②size = 目標角尺寸；③speed 以「提高
  頻帶 + 共用振幅」交付；④接受 60Hz 並把刷新率加進 compatibility key。
- **slice 9（KI-019 F-A2）**：`angularBoundsDeg [-8,8]→[-13,13]`（window 26° ≥ 每 leg 需求 25°），
  兩個被操弄變數維持預註冊值；`createReversal2dV1()` 加建構期幾何守衛
  （`speedMax × (intervalMax − ramp) > window` 即 fail fast，訊息帶實際數值與三個可調參數）。
  守衛立刻揭露**四個既有 fixture 用的正是同一個不一致形狀**——這正是既有測試從未抓到的原因。
  KI-019 的合成回歸 fixture 改為**合法但仍飽和**的 config（seed 13：修前 3382 legs / 15.0% 靜止 /
  **2781ms 凍結**；修後 32 legs / 1.0% / 16ms），證明那是 generator bug 而非 config artifact
  （約 5% 的 seed 在合法參數下仍會中招）。殘差誠實記錄：medium 交付 36 次 vs 宣稱約 23 次
  （設計本身的邊界截斷，KI-019 §5.3），是否再放寬到 ±25° 留給 T7。
- **slice 10（KI-020）**：
  - **size → 真的目標角尺寸**：每 cell 設 `targets.hitbox`（cube，邊長 `2·4u·tan(size/2)`：
    2.0°→0.13964u、0.5°→0.03491u）。兩個 axis calibration block 改用**至風險的 0.5°** 目標
    （那才是它們存在的理由）；reversal 兩 cell 固定 2.0°（密度是唯一操弄）。
  - **speed 真的被交付**：`frequencyBandHz [0.1,0.7]→[0.3,2.1]` + 所有 cell 共用 `±16°` 振幅
    ⇒ 實測交付 5.05 / 20.21 deg/s（比值 1.01/1.01），振幅固定 ⇒ speed 是乾淨的 4× 因子。
    **使用者最初選「放大振幅」，我實測後回報並請其改選**：20 deg/s 在原頻帶需 ±48° 振幅，目標會
    走到 ±37°、y ∈ [-1.49, 4.49]（沉到地板下、超出約 ±35° 垂直 FOV）。
  - `createBandLimited2dV1()` 加建構期速度守衛（不可交付即 fail fast，回報該 envelope 最大可交付
    速度；被抑制到近零的 off-axis 豁免）。
  - **cube 而非 sphere（記為 D-54.40）**：sphere 等向更貼合語意，但 WP-55 的 exact-hitbox contact
    derivation 只接受 box（`trackingContact.ts:147`），改 sphere 會把這批 drill 從其 coverage
    排除——實測使用者並行開發的 WP-55 T3 測試因此轉紅。cube 在 yaw/pitch 兩軸逐值正確，代價是
    對角容許角大 √2 倍。
  - **測試層根因記錄**：T1 的 `achieves approximately the configured target RMS speed` 斷言原是
    `rms > 0.5`（nominal 10），註解明寫「bound safety may have scaled speed down … not an exact
    match」——**這個容忍度正是讓「宣稱 20、交付 1.18」出貨的原因**；現改為斷言交付/宣稱 > 0.9。
- **slice 11（OQ-54-11）**：`TrackingCompatibilityKey` 新增 `displayRefreshHz`（四捨五入到整數 Hz，
  避免 59.98/60.02 拆散 cohort）與 `targetHitboxWidthU`（真正的尺寸軸）；`sizeDeg` 更名為
  `travelAmplitudeDeg`（語意本來就是振幅，KI-020 之後更不可混用）。`Meta` 不記錄目標距離，故尺寸軸
  以 source unit 表達；WP-54 內所有 block 共用 4u 視線，且 `drillId` 本身已釘住條件。
- **驗證**：`npx vitest run` **206 files / 1991 tests passed**（1 skipped file / 2 skipped tests）;
  `npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge` 1/1 passed（**以新
  config 真實跑完 practice + calibration 兩個 25 秒 block**，並斷言新的 hitbox/振幅 metadata）;
  `npx tsc --noEmit` 對所有已追蹤檔案乾淨（唯一錯誤在使用者未追蹤的 WP-55 WIP
  `trackingContactCoverage.{ts,test.ts}`，本批未觸碰）。使用者的 WP-55 T3 測試在 cube 決定後回綠。
- **slice 12（KI-021 / GD-30 / D-54.42，2026-09-03）**：兩個 pilot 家族的 hitbox 由 cube 改回
  **sphere**。前置是 [KI-021](../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)
  的推導層修復——slice 10 選 cube 並非因為 cube 較好，而是為了繞過 WP-55 的 box-only 閘門，
  而那個閘門的根因是 `trackingDerivation.isOnTarget()` 無條件跑 ray/AABB 且 `hitboxFromMeta()`
  丟掉 `shape`（違反 GD-7／CONTEXT §23）。修復後：`trackingPilotAngularSizeToEdgeU` →
  `trackingPilotAngularSizeToDiameterU`、`cubeHitbox()` → `sphereHitbox()`、兩檔皆
  `shape:'sphere'`。**直徑等於原 cube 邊長**，故 `widthU`（2.0° @4u = 0.13964u）逐位不變——
  e2e 的 `toBeCloseTo(0.13964, 4)` 斷言原封不動，只新增 `shape` 斷言。實測若少了 slice B 的閘門
  放寬，`trackingContactCoverage` 的 `includedRunCount` 會由 2 掉到 0（已實際驗證過該分支）。
- **slice 12 驗證**：`npx tsc --noEmit`（含 `-p tsconfig.node.json`）exit 0；`npx vitest run`
  **206 files / 1995 tests passed**（1 skipped file / 2 skipped tests）；
  `npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge` 1/1 passed
  （以 sphere config 真實跑完 practice + calibration 兩個 25 秒 block）。
- **下一步（交還使用者）**：**9 個 block 全部重跑**（見 gate 文件 §10.5）。**排序硬約束已滿足**：
  cube→sphere 已在重跑之前落地，故重跑資料的 on-target 語意自始一致。重跑時新增兩個觀察點：
  0.5° 目標是否真的看得見（約 3.5 px @1080p/103°FOV）、TOT 是否終於離開 100%。


### 2026-09-03 — T6 slice 5-8：真人資料回收 + 分析 + 三個刺激缺陷（Gate A = REVISE）

- **收到的資料**：使用者（P01）完成一整場 9 block manifest（session 0，2026-09-03T08:15–08:25Z，
  9 份 JSON，repo 外）。無 retry/abort。環境：`crossOriginIsolated: true`、simHz 128、
  **displayHz 60.0**、`frames.p95 ≈ 16.8ms`。
- **slice 5 — 分析 runner**（`scripts/analyze-tracking-pilot.ts`，`npx vite-node` 執行）：跑
  **既有實作**（不重寫）四層——`parseExportPayload()` → `evaluateTrackingRunEligibility()` →
  由匯出檔自己的 `meta.spawn.trackingTrajectory` 重建 `createTrackingTrajectory()` 並與記錄的
  `target_motion_change` 對表（另算交付 RMS 速度、靜止比例）→ `buildTrackingPilotEvidence()` +
  `renderTrackingPilotReportHtml()` + 對寫出的檔案做 parity 檢查。**第三層是抓到 KI-019 的工具**：
  它把「metadata 宣稱的刺激」和「那份 metadata 描述的刺激」對撞，這是既有測試沒有做過的事。
- **資料鏈路：全部成立**（見 gate 文件 §10.2）——9 份全通過 schema v2；每個 scored block
  3202–3203 valid scored ticks / 25008–25016ms ⇒ 覆蓋率 ≈100%（門檻 99.5%）；overflow/late 全 0；
  timestamp 全單調;event 對表 `mismatched=0`;`meta.session` 追溯完整、9 個 seed 互不重複;
  practice 被排除（`excludedPracticeRunCount: 1`，slice 3 的修補在真實資料上生效）;HTML/JSON
  parity 逐位相同;P0 管線（TOT/tAcquire/acqFail/RMS ε/p95 ε）無缺口。
- **slice 6 — [KI-019](../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md) F-A1 已修**：
  `tracking_reversal_pilot_v1_medium` 的目標有 **32.6% 的時間凍結在 ±8° 角落**（最長 344ms），
  排程 6644 筆 leg（high 只有 60）。根因：leg 長度取兩軸 min + 貼牆軸解出長度≈0 + sign 無條件翻面
  ⇒「兩軸同側貼牆」是吸收態。修法 room-aware 方向選擇（門檻由 config 導出）＋零長度 leg fail fast；
  medium 降到 46 legs / 1.6% 靜止，**high 逐位不變**（用該檔記錄的 60 筆事件對表驗證）。3 個回歸
  測試（修前紅/修後綠）鎖住「目標必須真的在動」——既有斷言（連續性/bounds/加速度）全都被靜止目標
  滿足，這是測試盲點而非測試被繞過。
- **slice 7 — protocol-violation 閘門**：受測者在一個 scored block 按了右鍵 ADS。guard 有記錄、
  P1 有自我封鎖（`protocol-incompatible`），但 run-level eligibility 的封閉 vocabulary 沒有
  protocol 這一項 ⇒ 操作端當時看到 **Eligible**，而 **primary RMS(ε) 照樣被聚合**。加入
  `'protocol-violation'`（scored_start 之後才算，prep 窗內不算），重跑分析後該 block 正確顯示
  `BLOCKED protocol-violation` 且不再產出 p0/p1。
- **slice 8 — [KI-020](../../../known_issue/KI-020-core-matrix-size-speed-manipulation-not-delivered.md) 診斷（未修，待研究決策）**：
  core 2×2 matrix 的**兩個自變數都沒有被交付**。(a) 5 vs 20 deg/s 實測交付 1.21 vs 1.18 deg/s
  ——`boundedSpeedScale` 靜默取 min，現行振幅/頻帶下 `boundScale` 恆較小，交付速度 ≈ 0.605 × 振幅、
  與宣稱值無關;(b)「size」被接到行程振幅、沒有任何 cell 設 `targets.hitbox` ⇒ 四個 cell 的目標
  角尺寸相同（預設 H1，約 ±7°），六個 block **TOT 全部 100.0%**、`p95 ε` 3.63° 仍算 on-target
  ⇒ TOT 不帶資訊，兩個 axis calibration block 也無法達成「判斷 0.5° 是否可辨識」的用途。
- **Gate A 結論 = REVISE**（gate 文件 §9/§10）：資料鏈路成立，但刺激不符預註冊操弄。**沒有用
  「再多找幾個 tester」掩蓋**（README §5）——這三個缺陷加人只會得到更多量錯條件的資料。
  份量（1 人 × 1 場 vs checklist 的 3-5 人 × 每條件 2 次）也未達標，但那不是判 revise 的原因。
- **交還使用者的決策**（阻塞 T6 收尾，見 gate 文件 §10.4）：KI-019 §5 的 reversal 再參數化、
  KI-020 §4.1 的 size 語意、KI-020 §4.2 的 speed 實現方式、以及 60Hz 顯示器是否可接受
  （9 份資料全帶 `suspect: true`／`validity.perfFloor: true`，因 `PERF_FLOOR_MS = 8.33` 對上
  60Hz 面板的 16.8ms；eligibility 不看 suspect，故 run 仍 eligible）。
- **驗證**：`npx vitest run`（全專案）**206 files / 1982 tests passed**（1 skipped file / 2 skipped
  tests；其中 2 個檔案/約 6 個測試來自使用者並行的 WP-55 commits）;`npx tsc --noEmit` 對所有
  **已追蹤**檔案乾淨——目前唯一的 tsc 錯誤在 `src/metrics/trackingContactCoverage.{ts,test.ts}`
  （使用者未追蹤的 WP-55 WIP，本批未觸碰）。


### 2026-09-03 — T6 slice 4/N：`T6-instrumentation-gate.md`（Gate A 帳本）+ runbook 正式章節 + graphify

- **落點（純文件 + graph，無程式碼變更）**：新檔
  [T6-instrumentation-gate.md](T6-instrumentation-gate.md)（格式比照 WP-52 的
  `T4-manual-pilot-gate.md`：「Automated evidence」+「How to reach it in the running app」+ 未勾選
  的真人項 + go/revise/stop）；`docs/operational/tracking-pilot-runbook.md` 的「現況」改寫、
  「T6 之後：正式 pilot session」佔位文字改成真正的操作步驟（含 quality abort 的處置建議）、
  harness 章節標註為保留的秒級 a11y smoke test、「遺留缺口」補上跑動中無 Abort 與 rest 秒數不入
  匯出兩條；`task-checklist.md` T6 各項改為誠實的 `[-]`（synthetic 已綠、真人待辦）並列出 4 個工程
  slice。
- **A-1/A-2 切分**：gate 文件明確把 T6 DoD 拆成「A-1 機制正確性（自動化可證）」與「A-2 真實資料可用
  性（只有真人能證）」，並寫明 **A-1 全綠不等於 Gate A 通過**——避免後續 task 誤把 358 個綠燈當成
  Gate A PASS。
- **既有測試證據彙整（不重造）**：focused run `18 files / 358 tests passed`（2026-09-03，HEAD
  `aa240e4`），逐檔對應 T6 checklist 的每個驗證項（見 gate 文件 §2 表格）。checklist 兩項
  「trajectory 連續性/bounds/event 對表/angular round-trip」與「quality flags/export metadata/
  report traceability」的 synthetic 部分**已被 T1-T4 既有測試完整覆蓋**，T6 未新造 fixture——同
  D-54.28 的判斷原則（既有證據夠用時不重造一套）。
- **順手記下的追溯缺口**：`Rest seconds` 不會寫進 pilot 匯出的 `meta`（`sessionPlanRestSeconds`
  只在 Session Plan 路徑寫入），故 gate 文件 §7 要求操作員手動記錄。列為 open question（見下方），
  不在 T6 動 schema。
- **`graphify update .`**：4051 nodes / 9599 edges / 245 communities（對照 T5 收尾 4021/9529/256）。
  `codegraph sync .`：already up to date。
- **下一步（交還使用者）**：gate 文件 §5 的操作步驟 + §7 的資料回收格式。真人資料回來後才能做
  步驟 ④（跑 `evaluateTrackingRunEligibility()`/`buildTrackingPilotEvidence()`/
  `renderTrackingPilotReportHtml()` 對表、修 defect、填 go/revise/stop）。


### 2026-09-03 — T6 slice 3/N：practice 不入 scored aggregation（FR-54-5 的實質保證）

- **落點**：`src/session/trackingPilotManifest.ts` 新增 non-throwing 的
  `isTrackingPilotPracticeDrillId()`（讀同一份 `KNOWN_BLOCK_ROLES` 單一來源，未知 drillId 回
  `false` 而非 throw——與 `trackingPilotBlockRole()` 的 fail-fast 語意分工見該函式 doc comment）；
  `src/pilot/trackingPilotEvidence.ts` 在分組前濾掉 practice payload，並新增
  `excludedPracticeRunCount`（恆存在，無則 0）；`docs/operational/analysis-tracking.md` 的
  「Evidence model」節補上這條規則。
- **為什麼需要這個 slice**：slice 2 檢查真實匯出時發現 practice block 也帶一個 `scored_start`
  （D-54.34），而 `buildTrackingPilotEvidence()` 原本只按 `meta.drillId` 分組、沒有任何 practice
  防線——T6/T7 分析者把一整份 manifest 的 9 個匯出一起餵進去（最自然的做法，也是我自己下一步 ④ 要做
  的事）就會讓 `tracking_core_pr_pilot_v1_practice` 變成一個帶 P0/P1 指標的 condition，正是
  FR-54-5 驗收句禁止的事。這是 T6 checklist「任何 defect 先最小化、補 regression fixture」的落地。
- **不用靜默過濾**：加 `excludedPracticeRunCount` 而不是默默少一個 condition——artifact 必須說出
  自己丟了什麼（NFR-54-5 可追溯性精神）。
- **回歸測試**：`trackingPilotEvidence.test.ts` +3（practice 被排除且計數為 1、無 practice 時為 0、
  未註冊 drillId 照常聚合不 throw）；`trackingPilotManifest.test.ts` +1（probe 對 practice/
  calibration/6 個 scored/未知 id/空字串的完整分類）。
- **驗證**：`npx tsc --noEmit` exit 0；`npx vitest run`（全專案）203 files / 1953 tests passed
  （1 skipped file / 2 skipped tests）；T4 既有的 evidence/report determinism 與 JSON/HTML parity
  測試全數未改動且仍綠（新欄位為 additive，報告端逐字嵌入同一個 evidence 物件，parity 不受影響）。


### 2026-09-03 — T6 slice 2/N：真實瀏覽器 live pilot walkthrough（抓到 3 個真 bug）

- **落點**：新檔 `tests/e2e/tracking-pilot-live.spec.ts`（1 test，~1 分鐘：practice + calibration 兩個
  真實 25s block）；修 `src/main.ts`（boot barrier）與 `src/pilot/trackingPilotSession.ts`
  （overlay restore 順序）+ 對應回歸測試。
- **與 T5 的 `tracking-pilot-operator.spec.ts` 分工**：T5 那支跑 fake-stub harness，秒級證明鍵盤可
  達性（D-54.28/D-54.33）；本支跑**真實 app**——研究員選單 → operator screen → 真實 pilot
  `DrillConfig` 走 main.ts 的 clearance/TargetManager/SimLoop → 真實三迴圈跑滿 25s → 真實
  `buildCurrentExportPayload()` → 真的下載 JSON，並直接對下載的 JSON 斷言 WP-54 追溯欄位。
  無 pointer lock、不瞄準（sim 由 `simLoop.pump()` 推進、block 以 `endCondition: timeLimit` 結束），
  測的是 instrumentation 而非人的能力。
- **抓到的 bug ①（真 bug，e2e 才抓得到）**：研究員在 app boot 視窗內按下「Tracking pilot」→ Start
  manifest 會炸 `Cannot access 'resultShown' before initialization`——main.ts 後段有 top-level
  await（dev harness / `measureDisplayHz` / replay controller），在那之前整條 drill 載入鏈路的
  module-level `let` 還在 TDZ。修法：(a) 把 `createTrackingPilotSession()` 的建構點前移到研究員選單
  之後（兩者之間沒有 await，按鈕存在時 session 必然已存在，避免 KI-013 的 `?.` 靜默 no-op 出現在一個
  主入口按鈕上）;(b) 加一個 `appBooted` boot barrier promise，`markAppBooted()` 在模組最後一行
  （`renderLoop.start()` 之後）resolve,pilot 的 `loadDrillConfig` 先 `await appBooted`——boot 視窗
  內的操作只是稍晚開始，而不是丟內部錯誤給操作員。
- **抓到的 bug ②（我自己 slice 1 的 wiring bug）**：block 跑完回到 operator screen 時,
  `syncScreenVisibility()` 的 `screen.open()` 會**重繪 idle phase**（T5 `open()` 的既有語意:
  `setStatus('')` + `renderPhase({kind:'idle'})`),把剛剛畫好的 block-outcome 面板整片清掉——操作員
  看到一片空白、沒有 Retry/Continue 可按,整場 pilot 卡死。slice 1 的單元測試只斷言 root 的
  `display`,所以漏掉。修法：onPhaseChange 改為「先同步可見性、再 renderPhase」,並只在 overlay
  確實被關起來時才 `open()`（`overlayHidden` 旗標）,另把最後一則 status 文字在 restore 後補回。
  補一條回歸測試（斷言 outcome 面板的 `display === 'grid'` 與 status 仍有內容）。
- **抓到的 bug ③（測試本身，非產品）**：`input[name="participantId"]` 在真實 app 有兩個（operator
  screen 與既有 `SessionSetup`）——spec 的 locator 一律改為以 `#tracking-pilot-operator` 為 scope。
- **量到的 instrumentation 事實（Gate A 素材，非契約）**：calibration block 真實跑完
  `ticks=3714`、`events=2`、eligibility = **`Eligible — scored ticks: 3203, duration:
  25015.625ms`**——25.0156s × 128Hz ≈ 3202 tick,scored 窗覆蓋率 ≈ 100%（門檻 99.5%）,即
  headless Edge + WebGPU 下真實 25 秒 block 沒有掉 tick。此數字由 spec `console.log` 印出而**不**
  斷言（見 spec 內註解：換機器會變,那是機器事實不是契約）。
- **驗證**：`npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge` 1/1 passed
  （1.0m）;`npx vitest run src/pilot/trackingPilotSession.test.ts` 12/12 passed;
  `npx tsc --noEmit` exit 0;`npx vitest run`（全專案）203 files / 1949 tests passed。


### 2026-09-03 — T6 slice 1/N：main.ts 正式接線（TrackingPilotRunner/OperatorScreen ↔ 真實 drill 載入/匯出）

- **落點**：新檔 `src/pilot/trackingPilotSession.ts`（`createTrackingPilotSession()`，app-level wiring
  seam）+ `src/pilot/trackingPilotSession.test.ts`（11 tests）；改 `src/main.ts`（`loadDrillById`
  抽出共用 `activateDrill()` + 新增 `loadDrillConfigDirect()`、wiring、render-loop poll、drill-ended
  handoff）、`src/ui/ResearcherMenu.ts`(+`.test.ts`)（第 4 個入口）、
  `tests/e2e/session-orchestrator.spec.ts`（研究員選單按鈕數 3→4）。
- **為什麼另開一個 wiring 模組而不是全部寫在 main.ts**：CodeGraph blast radius 對
  `loadDrillById`/`setAppMode`/`sessionPlanRunner` 一致回報「⚠️ no covering tests found」——main.ts
  本身無測試覆蓋，而「running phase 讓 operator overlay 讓位」與「drill ended → completeCurrentBlock」
  兩條規則是真的邏輯，值得被鎖住。main.ts 只留薄 adapter（同其既有 `createAppProtocolRunner()` 慣例）。
- **本 slice 刻意不動**：manifest/runner/operator screen 契約與 9 個 pilot `DrillConfig` 逐位不變
  （只驗證 wiring 本身，見任務交辦 A①）。
- **`meta.session` 承載 participant/manifest 追溯**：`onManifestStart` 讓 main.ts 把
  `{participantId, sessionLabel: generatedFromCounterbalanceCell}` 寫進既有 `sessionSetupValues`，
  於是每個 block 匯出的 `meta.session` 都能回溯到受試者與 counterbalance cell——不新增 schema 欄位
  （見 D-54.31）。
- **驗證**：`npx vitest run src/pilot/trackingPilotSession.test.ts` 11/11 passed；
  `npx tsc --noEmit` exit 0；`npx vitest run`（全專案）203 files / 1948 tests passed（1 skipped
  file / 2 skipped tests），對照 T5 收尾 202/1937 baseline，無回歸；
  `npx playwright test tests/e2e/session-orchestrator.spec.ts --project=edge` 8/8 passed（真瀏覽器
  確認 main.ts 仍正常 boot、研究員選單第 4 個入口存在、既有三條 protocol/Session Plan 路徑無回歸）。

### 2026-09-02 — T5 slice 5/5：全專案 regression + graphify + operator runbook + 收尾同步（T5 完成）

- **全專案 regression**：`npx tsc --noEmit` exit 0；`npx vitest run` 202 files / 1937 tests passed
  （2 skipped），對照 T4 收尾的 199 files/1884 tests 基準——T5 四個 slice 累計新增 3 個檔案
  （`trackingPilotManifest.ts`/`TrackingPilotRunner.ts`/`TrackingPilotOperatorScreen.ts`，各自帶
  測試檔）、53 個 tests（slice 1：27、slice 2：11、slice 3：14、slice 4：+1 a11y 回歸測試加進 slice 3
  既有檔案，無新檔案），全程無回歸；`tests/e2e/tracking-pilot-operator.spec.ts` 不計入 vitest（`.spec.ts`
  由 Playwright 收，見 `vite.config.ts` 的 `test.include` 只收 `.test.ts`），`npx playwright test
  tests/e2e/tracking-pilot-operator.spec.ts --project=edge` 1/1 passed（見 slice 4 條目）。
- **`graphify update .`**：4021 nodes / 9529 edges / 256 communities 重建（對照 T4 收尾的
  3981/9450/250）。`codegraph sync .`：已是最新（無 pending）。
- **`docs/operational/tracking-pilot-runbook.md`（README §2.2 規劃的 NEW 檔，確認仍是 T5 範圍後落
  筆）**：涵蓋 manifest/counterbalance/alternate-seed 概念、runner phase state machine 圖解、
  operator screen 各面板對照表、今天可用的 dev-only harness 操作步驟（明確標註 fake
  loadDrillConfig/exportBlock，非真實 pilot 資料）、T6 之後的正式操作步驟待補、遺留缺口（無
  skip-rest 按鈕，main.ts 整合留給 T6）——格式比照 `docs/operational/analysis-tracking.md` 的
  operational spec 慣例，但本檔是操作流程導向而非公式/契約導向。
- **文件收尾同步**：本 package `README.md` 狀態列翻新（T0-T5 完成，T6 待開工）；本 package
  `task-checklist.md` 頂層 T5 row 打勾（六個子項已在 slice 1-4 逐一打勾）；本檔（`progress.md`）
  Status 段落同步；stage11 母層 README/task-checklist/progress **未變動**——WP-54 尚未整包完成
  （T6-T8/T-exit 仍待開工），依協議只有整個 WP 完成時才翻母層狀態（同 T4 收尾時的判斷，CLAUDE.md
  §3.5）。
- **T5 總結**：5 個 slice、每片各自 atomic commit（見下方 slice 1-4 條目）。交付：`TrackingPilotBlock`
  設計 + counterbalance manifest builder + fail-fast validator（slice 1）；researcher-only runner
  phase state machine（slice 2）；keyboard-only operator screen，含一次真的 WCAG 2.5.3 a11y bug
  發現與修復（slice 3-4）；真實瀏覽器 Playwright keyboard-only walkthrough 作為本專案既定的自動化
  a11y 證據形式（slice 4）；graphify/runbook/checklist 收尾（slice 5）。刻意劃定的範圍邊界：main.ts
  正式整合與真人試跑留給 T6（README §4 明文範圍，見 D-54.27）。

### 2026-09-02 — T5 slice 4/5：operator screen keyboard-only e2e walkthrough（真實瀏覽器）+ a11y 修復

- **落點**：新檔 `src/pilot/trackingPilotOperatorHarness.ts`（dev-only mount，`tracking-pilot-harness.html`
  由 Vite dev server 原生 multi-page 支援直接服務，未改 `vite.config.ts`）+
  `tests/e2e/tracking-pilot-operator.spec.ts`（1 test，全程只用 `.focus()`/`page.keyboard.press()`，
  比照 `stage10-accessibility.spec.ts` 既有慣例——本專案已把這類真實瀏覽器 Playwright keyboard-only
  walkthrough 當作正式的自動化 a11y/keyboard 證據，不是每次都要求真人手動操作）。
- **範圍邊界（記為決策，見下方 decision log）**：harness 把 slice 2/3 交付的真實
  `createTrackingPilotRunner()`/`createTrackingPilotOperatorScreen()` 接在一起，但
  `loadDrillConfig`/`exportBlock` 用 fake stub（交替回傳 eligible/blocked，不跑 3-loop sim
  runtime）。把 runner 接進正式 app（`main.ts` 真實載入 `DrillConfig`、真實匯出 `ExportPayload`）並
  找真人跑,是 README §4 **T6**「Instrumentation pilot」明文範圍（3-5 位 tester 真實跑),不是 T5——
  本次刻意不越界重做 T6 的工作,只證明 operator screen 機制本身（鍵盤可達性、狀態一律文字化）成立。
- **開工前跑一次 e2e 立刻抓到真的 a11y bug**：`makeButton()` 對每個按鈕都疊了一個與可視文字不同的
  `aria-label`（例如可視文字「Start manifest」但 `aria-label="Build and start the tracking pilot
  manifest"`），輸入框也疊了與 wrapping `<label>` 可視文字重複的 `aria-label`——違反 WCAG 2.5.3
  Label in Name,也偏離本專案 `EligibilityGate.ts`/`SessionPlanSetup.ts` 的既有慣例（按鈕只靠
  `textContent` 當 accessible name、`title` 純粹是 tooltip；有標籤的輸入框靠 wrapping `<label>`,
  從不額外疊 `aria-label`)。修法：拿掉所有按鈕/輸入框的 `aria-label`,`reasonInput` 改用穩定的
  `name="reason"` 供測試定位（原本用 `aria-label="Reason"`,但可視標籤是動態的「Retry reason」/
  「Abort reason」,寫死的 `aria-label="Reason"` 本身就是另一個 Label-in-Name 不一致）。追加一條
  vitest 回歸測試（`TrackingPilotOperatorScreen.test.ts`「never gives a button/input a mismatched
  aria-label」）鎖住這個不變量,避免以後又疊上去。
- **e2e 覆蓋的完整路徑**：填 participantId/restSeconds（皆鍵盤輸入,`restSeconds=1` 讓 harness 的
  `setInterval(() => runner.poll(...), 100)` 驅動 rest 倒數快速跑完）→ Enter 送出 → practice block
  無 quality banner（`role==='practice'` 不判定 eligibility)→ Complete → Continue → rest（文字倒數)→
  下一個 block eligible（banner 顯示「Eligible — scored ticks: … duration: …ms」,`role="alert"`、
  `data-quality="eligible"`,全程無 RMS/lag/gain 等能力數字)→ Continue → 下一個 block blocked
  （banner 顯示 closed reason codes)→ Retry（鍵盤打理由、focus 自動移進 reason input)→ attempt 2 →
  Complete → Continue → Abort 下一個 running block（鍵盤打理由)→ block log 顯示
  「aborted (participant needs a break)」。
- **調試過程中抓到一個真實時序 bug（測試本身,非 production code)**：第一次跑 e2e 時在
  rest 階段「role: calibration」文字子字串斷言誤判成功——`blockText` 在 `blockPanel` 被設成
  `display:none`（rest 期間）時仍保留上一個 block 的舊 textContent（`renderPhase()` 只在 phase
  真的變成 `running` 時才覆寫文字,不會在隱藏當下清空),而上一個 calibration block 的舊文字本來就
  含「role: calibration」子字串,導致等待邏輯提早通過,實際仍在 rest,後續 `tabUntilButton('Complete
  block')` 找不到按鈕而失敗。修正：改成先 `await expect(blockText).toBeVisible()`（Playwright 會
  正確判斷祖先 `display:none` 導致不可見)才檢查文字內容——production code 未變動,純測試等待策略
  修正,记入这里供之后写类似 e2e 断言时参考（"隐藏元素的旧 textContent 会通过 substring 断言"这个坑）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/ui/TrackingPilotOperatorScreen.test.ts` 15/15
  passed（14 slice 3 既有 + 1 新 a11y 回歸測試)；`npx vitest run`（全專案）202 files / 1937 tests
  passed（2 skipped），對照 slice 3 的 202/1936，同檔案數、+1 test，無回歸；
  `npx playwright test tests/e2e/tracking-pilot-operator.spec.ts --project=edge` 1/1 passed
  （5.2s,對 `npm run dev` 這個既有 dev server 執行,未跑 preview/build 那個 webServer 分支——harness
  html 只需要 dev server 的 on-demand 解析,未改 `vite.config.ts` 的 `build.rollupOptions.input`,
  故 `vite build` 產物不含這個 harness,production bundle 不受影響)。

### 2026-09-02 — T5 slice 1-3/5：manifest/counterbalance + runner state machine + operator screen

- **T5 slice 1（`src/session/trackingPilotManifest.ts`）**：README §2.4 只給了 `TrackingPilotManifest`
  的殼,從未定義 `TrackingPilotBlock`——本 slice 設計為 `{drillId, seedFamily}`,刻意**不**存 `role`
  （role 100% 可從 `drillId` 查一個 single-source registry 推導,存了反而讓損毀/手改的 manifest 能夠
  宣稱一個與實際 drill 不符的 role,見 `trackingPilotBlockRole()`)。Counterbalance 排序**直接重用**
  WP-41 `sessionSchedule.ts` 既有的 `buildFamilyOrderForRoster()`（cyclic Latin-square 輪轉),而非另寫
  一套 shuffle——這正是任務交辦第 4 點要求「不得重新發明已有的排程/state machine 慣例」。practice + 2
  個 calibration block 固定排最前（診斷用途,不進 counterbalance),其後 6 個 scored block（4 core + 2
  reversal）依 `buildFamilyOrderForRoster(participantId, sessionIndex, 6-block roster)` 排序。
  `generatedFromCounterbalanceCell` 不試圖反推 `buildFamilyOrderForRoster()` 內部的雜湊輪轉量,而是
  直接寫成 `` `${protocolVersion}:${participantId}:session-${sessionIndex}` ``——本身就是輸入的純函式,
  已滿足「同一輸入重跑必須排出同一個 order/seed」的字面要求,不需要另外編碼排序演算法的內部狀態。
  Session 1 對 scored block 套用 alternate seed family（`+10000` offset,遠離 WP-54 自己的
  54000/54100 seed 家族與其他 WP 的既有 seed 範圍),供 T8「alternate-seed equivalence」分析；
  practice/calibration 永遠用 primary seed（診斷用途,不是資料承載的量測,重跑同一個軌跡沒有意義）。
  `parseTrackingPilotManifest()` fail-fast：未知 drillId、重複 block、非 scored block 宣稱
  `alternate`、scored block 之間 seedFamily 不一致。27 tests。
- **T5 slice 2（`src/session/TrackingPilotRunner.ts`）**：DOM-agnostic phase state machine,結構比照
  `SessionRunner.ts`（`loadDrillConfig`/`onStatus`/`onPhaseChange` 注入,transition queue 防併發)——
  T2 讀碼筆記已經排除 `ProtocolRunner.ts`（粒度是整個 drill+scene+resolution 條件切換,不是「一個
  manifest 內 practice→scored→rest」的相位語意)。Block 用 resolved `DrillConfig`（不是 drillId
  字串）載入,因為 session 1 的 scored block 可能是 `resolveTrackingPilotBlockConfig()` 產生的
  alternate-seed clone,從未在任何 `availableDrills` 之類的表格用自己的 drillId 註冊過。
  `completeCurrentBlock()` 對 practice 以外的每個 block 呼叫 `evaluateTrackingRunEligibility()`
  （practice 沒有 `scored_start` 事件,T2 既定設計)，且永不顯示能力分數——只有 closed reason codes。
  `retryCurrentBlock()`/`abortCurrentBlock()` 把新的 attempt/aborted 記錄 append 進
  `records[]`（從不覆蓋前一次嘗試),`retryCurrentBlock()` 額外把理由記進獨立的 `retryLog[]`。
  11 tests。
- **T5 slice 3（`src/ui/TrackingPilotOperatorScreen.ts`）**：純 TS DOM overlay（D1),結構比照
  `EligibilityGate.ts`/`SessionPlanSetup.ts`——每個控制項都是原生 `<button>`/`<input>`/`<select>`
  （天然 Tab 可達,無 click-only `<div>`),每個狀態都是 `textContent`（顏色僅裝飾)。本模組不持有
  `TrackingPilotRunner`,是純呈現層,由呼叫端接線（`onStartManifest`/`onCompleteBlock`/
  `onRetryBlock`/`onAbortBlock`/`onAdvance`),比照 `SessionPlanSetup` 的 `onSubmit` 接到
  `SessionRunner` 的既有慣例。`renderPhase()`/`renderRecords()` 從不顯示能力數字（RMS/TOT/lag/
  gain…),只顯示 closed `TrackingRunEligibility` reason codes（或 eligible + tick/duration
  coverage 事實)與結構狀態（block index、attempt、seed family）——這就是 NFR-54-8「不顯示即時能力
  分數」在 render 層的落地。Retry/abort 共用一個理由輸入面板,皆要求非空理由才能確認,和 runner 自己
  的驗證一致（slice 2）。測試沿用本專案既有的手刻 fake DOM 慣例（`vi.stubGlobal('document', ...)`,
  同 `SessionPlanSetup.test.ts`/`EligibilityGate.test.ts`——本專案未安裝 jsdom/happy-dom,不能假設
  真實 DOM 可用)。14 tests（第 15 test 在 slice 4 補上,見上方）。
- 三個 slice 各自 atomic commit；`npx tsc --noEmit` 與全專案 `npx vitest run` 逐 slice 皆綠燈,見上方
  slice 4 條目彙總的最終數字（202 files / 1937 tests）。

### 2026-09-02 — T4 slice 6/6：history exclusion 事實鎖定 + 全專案 regression + graphify（T4 完成）

- **落點**：新檔 `src/pilot/trackingPilotHistoryExclusion.test.ts`（3 tests）——鎖住 README §4 T4
  DoD 額外一項「practice/pilot run 被 history guard 排除」。依任務交辦第 4 點的既定結論：不新蓋
  guard 機制，只斷言既有事實——`createDrillMetricRegistry()` 的 `registrationForExactDrill()` 對
  全部 9 個 T2 pilot block drillId（1 practice + 2 calibration + 4 core matrix + 2 reversal
  density,從各自的 config module 匯入 identifier,不手打字串避免與實際 config 漂移)皆回傳
  `undefined`；`project()` 對每一個都回傳 `{status:'unregistered-drill', drillId}`（比
  `meta.assessment` 檢查更早的第一道防線,連 assessment-undefined 這條 defense-in-depth 都用不到
  就已經被擋下)。
- **全專案 regression**：`npx tsc --noEmit` exit 0；`npx vitest run` 199 files / 1884 tests
  passed（2 skipped），對照 T3 收尾基準 194 files / 1844 tests——T4 六個 slice 累計新增 5 個檔案
  （`trackingRunEligibility.ts`/`trackingCompatibilityKey.ts`/`trackingPilotEvidence.ts`/
  `trackingPilotReport.ts`/`trackingPilotHistoryExclusion.test.ts`,各自帶測試檔)、40 個 tests，
  全程無回歸；`src/metrics/trackingDynamics.ts` 的兩個新增 `export`（`adaptPayloadForScoredWindow`/
  `pickPresentation`）未影響任何既有呼叫方。
- **graphify update .**：3981 nodes / 9450 edges / 250 communities 重建（對照 T3 收尾的
  3909/9263/242）。`codegraph sync .`：daemon 已自動同步,索引已是最新（無 pending）。
- **文件收尾同步**：本 package `README.md` 狀態列翻新（T0-T4 完成,T5 待開工）；本 package
  `task-checklist.md` T4 row 打勾 + 額外補上「history guard 排除」bullet；本檔（`progress.md`）
  Status 段落同步。stage11 母層 README/task-checklist/progress **未變動**——WP-54 尚未整包完成
  （T5-T8/T-exit 仍待開工），依協議只有整個 WP 完成時才翻母層狀態，單一 task 完成不觸發（CLAUDE.md
  §3.5：「WP 完成」才翻 exec-plan/README.md 狀態，本次是 T4 完成，非 WP-54 完成）。
- **T4 總結**：6 個 slice、每片各自 atomic commit（見上方 slice 1-5 條目）。交付：closed
  `TrackingQualityReason`（8 碼）+ `evaluateTrackingRunEligibility()`（slice 1）；WP-54 專屬
  `TrackingCompatibilityKey`（8 軸，slice 2）；deterministic `TrackingPilotEvidence` JSON model +
  `buildTrackingPilotEvidence()`（slice 3，偏離 README 鎖定簽名，見 D-54.20）；self-contained HTML
  report + parity-by-construction 設計（slice 4）；benchmark（~8-23ms,遠低於 2 秒門檻,未加
  concurrency）+ operational doc 收尾（slice 5）；history exclusion 事實鎖定 + 全專案 regression +
  graphify（slice 6）。過程中兩個記入 Open Questions 但未阻塞的判斷岔路：`inputMode` 語意
  （OQ-54-9）、evidence pipeline 預設參數（D-54.21，可由 T6/T7 校準覆寫）。

### 2026-09-02 — T4 slice 5/6：benchmark + `docs/operational/analysis-tracking.md` 收尾

- **Benchmark**（checklist「對單一 30 秒 export analysis 量測耗時，若 >2 秒才記 worker spike，不要
  真的先加 concurrency」）：以一次性 throwaway 測試檔（未 commit，量測後即刪除）合成一份 1 秒 prep +
  29 秒 scored window（128Hz，3841 ticks，符合 D-54.4/FR-54-5 節奏）的匯出，跑完整
  eligibility + P0 + P1 + evidence build pipeline：冷啟動（含 JIT warmup）約 23ms、暖機後約 8ms；
  額外量測 `renderTrackingPilotReportHtml()` <1ms。遠低於 2 秒門檻，不需要 worker/thread spike，
  依 README §2.6「未量先加 concurrency 不可」的紀律，本 slice 到此為止，不動 concurrency model。
- **`docs/operational/analysis-tracking.md` 新增「Eligibility, Compatibility, and Evidence
  (WP-54 / T4)」章節**（非第三個 P-tier,明確標註區別於 P0/P1）：收錄 run-level vs metric-level 兩層
  blocked 詞彙的區別說明、8 碼 `TrackingQualityReason` 對照表（含每碼觸發條件)、`TrackingCompatibilityKey`
  8 軸對照表（含 `inputMode` 為判斷岔路的旁註)、evidence model 與 HTML report 的 parity-by-construction
  設計理由、`windowEndMs:Infinity` → JSON `null` 的意外發現與消費建議、evidence pipeline 預設參數
  一覽（含各數值的理由來源)、benchmark 結果。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/` 50/50 passed（純文件變更 + 刪除一次性
  benchmark 檔案,無 production code 異動)。

### 2026-09-02 — T4 slice 4/6：self-contained HTML report + JSON/HTML parity test

- **落點**：新檔 `src/pilot/trackingPilotReport.ts`（`renderTrackingPilotReportHtml()`）+
  `src/pilot/trackingPilotReport.test.ts`（3 tests：JSON/HTML parity 深比對、無外部 script/link
  依賴的自足性、embedded JSON 對 `<` 的跳脫防止 script 提早關閉）。`src/pilot/
  trackingPilotEvidence.ts` 追加 opt-in `options.includeTrace`/`TrackingPilotRunEvidence.trace`
  欄位（見下方 D-54.22）——slice 3 既有 5 個測試全數不改、行為逐位不變（新欄位預設 `false`）。
- **採用任務指示建議的「parity-by-construction」設計，未另尋替代方案**：canonical
  `TrackingPilotEvidence` JSON 原樣（`JSON.stringify` 後跳脫 `<` 為 `<` 防止提早關閉
  `<script>`）塞進 `<script type="application/json" id="evidence-data">`；頁面其餘渲染邏輯
  （純 vanilla JS,無 bundler、無外部 CDN script/stylesheet）只讀這個內嵌 JSON,不另外算一次
  數字。JSON/HTML parity test 因此只需要抓出這個 script 內容、`JSON.parse` 後與原始 evidence
  物件深比對——不需要 DOM/文字 scraping,parity 由單一資料來源保證。決策理由與最終選擇記入
  `docs/operational/analysis-tracking.md`（留給 slice 5 一併寫入,呼應任務指示要求)。
- **意外發現：`windowEndMs: Infinity` 在 JSON 序列化後變成 `null`**——T3 `TrackingPresentationDerivation.
  windowEndMs`（GD-7 單一來源型別,本 slice 直接重用,不重新定義)在「單一持續目標、無後續 `visible`
  事件」（WP-54 pilot block 常態）下恆為 `Infinity`；`JSON.stringify` 對 `Infinity`/`NaN` 沒有合法
  JSON 表示,一律吐 `null`（JS 標準行為,非本檔 bug）。第一次寫 parity 測試時直接拿記憶體中的
  `evidence` 物件（含 `Infinity`）與 `JSON.parse(html 裡的 script)`（含 `null`）比對必然不相等,
  修正為：測試改比對 `JSON.parse(JSON.stringify(evidence))`（= 這份 evidence 若被存成 `.json` 檔會
  變成的樣子）——這才是「parity」真正該比較的基準,因為 HTML 內嵌的本來就是這個 canonical JSON 形式,
  不是記憶體物件本身。**未修改任何 production 型別或欄位**（`windowEndMs` 維持 T3 原樣,`null` 在
  評估報告的語意上等同「一直延伸到錄製結束、無明確下一個 presentation 邊界」，與 `Infinity` 語意
  相符,只是 JSON 沒有更好的表示法）。記入 `docs/operational/analysis-tracking.md` 供未來 JSON
  artifact 消費者知悉,不視為需要修的 bug。
- **HTML 涵蓋範圍**：quality（eligible/blocked+reasons)、RMS/TOT/acquisition（p0)、lag/gain/drop/
  recovery（p1)、condition matrix（每個 condition 的 runCount/eligibleRunCount/totalDurationMs/
  seeds)、target/aim trace（ε(t) SVG polyline,讀 `run.trace`,只有 `includeTrace:true` 時才有資料,
  否則顯示「no trace recorded」，不是空白或誤導性的 0 線）。Blocked 欄位一律顯示原因字串（P0
  acquisition failure、P1 blocked reason、run quality reasons),絕不顯示 `0`。DOM 一律用
  `createElement`/`textContent` 組裝,不用 `innerHTML`（避免任何字串插值路徑成為 XSS 面,即使目前
  資料來源是自己產生的 evidence,非使用者輸入)。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/` 55/55 passed（新增 3 個 report parity
  測試,slice 3 的 5 個 evidence 測試因新增 `includeTrace` 選項而重跑仍全綠,無回歸）；`npx vitest
  run`（全專案）198 files / 1881 tests passed（2 skipped），對照 slice 3/6 的 197/1878，新增 1 個
  檔案、3 個測試，無回歸。

### 2026-09-02 — T4 slice 3/6：`TrackingPilotEvidence` JSON model + `buildTrackingPilotEvidence()`

- **落點**：新檔 `src/pilot/trackingPilotEvidence.ts`（`buildTrackingPilotEvidence()` + JSON model）
  + `src/pilot/trackingPilotEvidence.test.ts`（5 tests：eligible run 全欄位、run-level blocked 不進
  metric derivation、P1 blocked 不刪除仍有效 P0、condition 分組/seed 去重排序、deterministic 重跑）。
  `src/metrics/trackingDynamics.ts` 兩處新增 `export`（`adaptPayloadForScoredWindow`/
  `pickPresentation`，原本是 T3 private helper）——純新增 export keyword，函式本體/既有呼叫方逐位
  不變，讓 P0 evidence 沿用同一個 scored_start 窗口 adapter（D-54.13 single source），不重新實作
  一份等價邏輯。
- **偏離 README §2.4 鎖定的 `buildTrackingPilotEvidence(manifest, payloads)` 簽名**（記為
  D-54.20，見下方 decision log）：`TrackingPilotManifest`/`TrackingPilotBlock` 是 T5（Researcher
  session manifest/operator flow）尚未開工的型別，README 只給了 `TrackingPilotManifest` 的殼
  （`protocolVersion`/`participantId`/`sessionIndex`/`orderedBlocks`/`restSeconds`/
  `generatedFromCounterbalanceCell`），從未定義 `TrackingPilotBlock`。FR-54-11 要求的每一項
  （condition/n/duration/quality/seed）其實已經能從單一 `payload.meta` 完整推導——`meta.drillId`
  本身就是 condition 標籤（T2 slice 4 決策：每個 candidate 都有獨立 drillId），
  `meta.spawn.trackingTrajectory.seed` 帶出 seed——故本 slice 只吃 `payloads: readonly
  ExportPayload[]`，不吃 manifest。T5 完成後可以把 `manifest.orderedBlocks` 對應出的 payload
  陣列原樣餵進同一個函式，預期不需要重新設計簽名；但也刻意不先幫 T5 把 manifest 整合寫好
  （Rule 0.5 範圍紀律，「不要為假設性的未來需求設計」）。
- **JSON model 設計**：`conditions[].runs[]` 每筆 run 帶 `runId`（`${drillId}@${startedAt}`，
  `ExportPayload`/`Meta` 本身沒有獨立 run id 欄位,這是唯一能保證的確定性/可追溯替代）、`seed?`
  （讀 `trackingTrajectory.seed`,不是 `SpawnMeta.seed`——兩者是不同欄位,測試撰寫時第一次犯過這個
  混淆,已在 fixture 修正)、`quality`（直接重用 T4 slice 1 的 `TrackingRunEligibility` 型別)、
  `p0?`/`p1?`/`reversal?`——`p0` 直接重用 T3 `TrackingPresentationDerivation`、`p1` 直接重用 T3
  `TrackingDynamicsResult`、`reversal` 直接重用 T3 `TrackingReversalWindowsResult`,三者皆不重新定義
  欄位（GD-7 單一來源)——這三個型別各自已經滿足「blocked 時顯示 reason 字串,不輸出 0」的契約
  （T3 已經做到,見 D-54.13~17),本 slice 只是原樣掛載,不需要另建一層 wrapper 欄位。
- **run-level blocked 與 P1 blocked 兩層獨立性,各自一條 fixture 鎖住**：`quality.status==='blocked'`
  的 run **完全不呼叫** `deriveTrackingDynamics`/`deriveTrackingMetrics`/
  `deriveTrackingReversalWindows`（FR-54-10「不合格 run 仍輸出原因但不進聚合」——`不進聚合`在此實作
  即「不計算」,不是「算完再丟棄」),`p0`/`p1`/`reversal` 三欄全部省略（非 `undefined` 顯式賦值,而是
  物件 spread 條件式省略,JSON 序列化後鍵完全不存在）。反之,`quality.status==='eligible'` 時 `p0`
  與 `p1` **各自獨立計算**（分開呼叫,互不依賴對方結果),故 `never-acquire` fixture 能同時驗證
  `p0.acquisitionFailure===true`（且無 `rmsEpsilonDeg` 等數值假裝）與 `p1===
  {status:'blocked',reason:'no-acquisition'}` 共存於同一個 run——checklist 明講「P1 blocked 不刪除
  仍有效的 P0」,這條 fixture 直接鎖住。
- **evidence pipeline 預設參數是本 slice 唯一未凍結的判斷岔路**（記為 D-54.21）：`smoothingVersion`
  預設改用 `tracking-dynamics-smoothing-v1-tri3`（T3 truth-fixture 測試預設 `-none` 是為了讓合成訊號
  精確可驗,但真實 pilot 人類資料有雜訊,套用平滑更合理）；`minValidTicks:32` 不是隨意選的——恰好等於
  `lagSearchMs` 上界 250ms 在 128Hz 下的 tick 數,是能覆蓋整個搜尋範圍的最短窗口；reversal window
  四個參數（`minWindowMs`/`maxWindowMs`/`minBaselineMs`/`settlingToleranceDeg`）沿用 T3 測試本來就用
  的數值（300/500/200/0.5),未見文件另外凍結。四者皆透過 `options.dynamics`/`options.reversal`
  可覆寫,T6/T7 若校準出更好的數值可直接傳入,不需要改本檔常數。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/trackingPilotEvidence.test.ts
  src/metrics/trackingDynamics.test.ts` 24/24 passed；`npx vitest run`（全專案）197 files / 1878
  tests passed（2 skipped），對照 slice 2/6 的 196/1873，新增 1 個檔案、5 個測試，無回歸。

### 2026-09-02 — T4 slice 2/6：WP-54 專屬 compatibility key（NFR-54-7）

- **落點**：新檔 `src/pilot/trackingCompatibilityKey.ts`（`buildTrackingCompatibilityKey()`/
  `checkTrackingCompatibility()`）+ `src/pilot/trackingCompatibilityKey.test.ts`（16 tests）。
- **確認既有 `compatibilityKey.ts` 不可直接套用**（開工前依 README 交辦讀碼確認,見 CodeGraph
  探索）：`buildCompatibilityKey()` 對 `meta.assessment === undefined` 直接 `throw`；`main.ts`
  `buildCurrentExportPayload()` 只在 `activeDrillConfig.mode === 'assessment'` 時才組
  `meta.assessment`（`main.ts:722`）——而 T2 已把全部 9 個 WP-54 pilot block 定為
  `mode:'practice'`（見 T2 slice 5/6 decision）,故 WP-54 匯出的 `meta.assessment` **恆為
  `undefined`**,直接呼叫既有 `buildCompatibilityKey()` 必定 throw。其欄位集合（participantId/
  taskId/protocolVersion/gameMovementProfile/weaponId/weaponMode/sensitivityFovKey/
  targetConditionCell/assessmentFeedbackPolicy/qualityGateStatus）也和 NFR-54-7 要求的軸線
  （drill/protocol/motion/size/speed/FOV/sensitivity/input mode）不是同一組——故新開
  `TrackingCompatibilityKey` 型別,沿用該檔「pure function + `requireXxx` 逐欄驗證 +
  `checkXxx` 逐欄比對」的既有慣例風格,但不 import 其型別、不碰其 7 個既有 caller。
- **8 軸設計**：`drillId`（`meta.drillId`）、`protocolVersion`（常數
  `TRACKING_PILOT_PROTOCOL_VERSION = 'tracking-pilot-v1'`，D-54.11 已凍結，非逐 export 讀取——
  T5 manifest 尚未存在,本 WP 目前只有這一個 protocol version）、`motionKind`/`sizeDeg`/
  `speedDegPerSec`（三者皆從 `meta.spawn.trackingTrajectory` 這個 opaque unknown 解出——
  `band-limited-2d-v1` 讀 `yawBoundDeg`x`pitchBoundDeg`/`targetRmsSpeedDegPerSec`；
  `reversal-2d-v1` 讀 `angularBoundsDeg`/`speedRangeDegPerSec` 兩個 range,格式化成
  `lo..hi` 字串；未知 `kind` fail fast,同 `trackingTrajectory.ts` 紀律）、`fovDeg`/
  `sensitivity`（直接讀 `meta.fovDeg`/`meta.sensitivity`，fail fast 若缺席——WP-54 是
  post-KI-005 全新 WP,`main.ts` 一律填 `fovDeg`,缺席視為不可信匯出）、`inputMode`。
- **`inputMode` 是本 slice 唯一的判斷岔路，記為 Open Question**：NFR-54-7 只列出這個欄位名稱，
  沒有進一步定義。`Meta` 裡沒有任何欄位字面叫「input mode」，也沒有 `protocolGuard`
  的匯出對應（`DrillConfig.protocolGuard` 本身不進 `meta`——T2 設計，純 sim 期 guard）。
  選擇讀 `meta.mouseIntegration?.model`（`'tick-window-integral'`，缺席時退回字串
  `'aim-diff-legacy'`）——這是 `Meta` 裡唯一真正描述「輸入如何被擷取」的軸線，且與
  research pipeline 既有的 `omega_source`（`tick-integral` vs `aim-diff-legacy`）警戒是
  同一個構念）。**未與使用者確認**，實務上 WP-54 所有真實匯出都經過 `main.ts` 固定啟用
  mouse integration，此欄位在目前資料下恆為常數，不影響 T6-T8 的真人資料 cohort 判定；若
  未來需要更精確語意（例如真的有「controller vs mouse」或「keyboard-only walkthrough」
  這種 input mode），屆時再修正,不影響已收集的 compatibility key 資料（新增欄位是
  additive，不用回溯改字串格式）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/trackingCompatibilityKey.test.ts` 16/16
  passed；`npx vitest run`（全專案）196 files / 1873 tests passed（2 skipped），對照 slice 1/6
  的 195/1857，新增 1 個檔案、16 個測試，無回歸。

### 2026-09-02 — T4 slice 1/6：closed `TrackingQualityReason` vocabulary + `evaluateTrackingRunEligibility()`

- **落點**：新檔 `src/pilot/trackingRunEligibility.ts`（README §2.4 `TrackingRunEligibility`/
  `evaluateTrackingRunEligibility()` 逐字實作）+ `src/pilot/trackingRunEligibility.test.ts`（13
  tests：eligible fixture 1 條、每個 FR-54-10 類別至少 1 條 fixture、外加「同時觸發兩個 overflow
  reason 不短路」與「prep 窗內的問題不誤判進 scored 窗」兩條邊界 fixture）。`src/pilot/` 目錄本次起用
  （WP-52 `peekClickTransferPilotEvidence.ts` 之外第二個檔案），T4 其餘檔案（compatibility key/
  evidence/report）陸續加入同目錄，而非全部塞進單一 `trackingPilotEvidence.ts`——README §2.2 只列了
  這一個檔名當落點候選，但 T4 範圍（eligibility 判定 + WP-54 專屬 compatibility key + JSON evidence
  model + 自足 HTML report）遠比 WP-52 那支 81 行的純聚合函式大，拆檔以維持單一職責、可個別測試。
- **run-level vs metric-level 雙層閉列舉（不得混用）**：本檔的 `TrackingQualityReason`（run-level，
  8 碼）與 T3 `trackingDynamics.ts` 的 `TrackingDynamicsResult.status:'blocked'` 5 碼原因是**兩個獨立
  命名空間**——刻意選了不同字串（例如 run-level 用 `missing-target-position`，metric-level 用
  `missing-target-telemetry`）避免兩層在字面上疊在一起造成「這是同一件事」的錯覺。README §2.4 已把
  兩者定義成兩個不同型別（`TrackingRunEligibility` vs `TrackingDynamicsResult`），本檔只是延續。
- **8 碼收斂設計**（FR-54-10 五大類別 → 8 個具體 reason code，一次定案、封閉列舉）：
  - overflow → `recorder-overflow`（`meta.recorderOverflow`）、`input-buffer-overflow`
    （`meta.bufferOverflow`）。
  - missing target → `missing-target-position`（scored 窗內〔`t >= scoredStartMs`〕任一 tick
    `tx`/`ty`/`tz` 為 `null`；prep 窗內的 null 不算，見 fixture「does not flag a null target position
    that only occurs inside the prep window」）。
  - timestamp → `non-monotonic-timestamps`（依 **匯出原始陣列順序**逐一比較 `ticks[i].t <=
    ticks[i-1].t`，不對輸入先 `sort()`——`trackingDerivation.ts`/`trackingDynamics.ts` 等下游消費者都會
    自己 `slice().sort()`，那是它們的權利；但這裡要抓的正是「原始寫入順序本身出了 bug」，先排序會把
    這個訊號洗掉）。
  - coverage → `insufficient-scored-coverage`（`validScoredTicks / expectedTickCount < 99.5%`，
    `expectedTickCount = round(durationMs / (1000/simHz)) + 1`；`durationMs<=0` 时视为
    `actualTickCount>0 ? 1 : 0`，避免「0 除以 0 通过」的假陽性)。
  - protocol mismatch → 拆成三個更具體的 reason，而非單一 `protocol-mismatch`：
    `missing-scored-start`（完全没有 `scored_start` 事件——代表这份匯出根本不是 WP-54 scored pilot
    run，直接短路回傳，不再检查 target-position/coverage，因为没有 scored 窗可检查）、
    `unsupported-schema-version`（`meta.schemaVersion !== 2`，defense-in-depth——`parseExportPayload`
    理论上已挡，但比照 `DrillMetricRegistry.project()` 的 defense-in-depth 惯例再挡一次）、
    `unrecognized-tracking-trajectory`（`meta.spawn.trackingTrajectory` 缺席或其 `kind` 不在
    `{band-limited-2d-v1, reversal-2d-v1}`——因为它是 opaque `unknown` pass-through〔T2 设计〕，这里只做
    浅层 `kind` 白名单检查，不深验其余栏位，深验留给 `trackingTrajectory.ts` 自己的建构期 guard）。
- **不短路,收集全部 reasons**：除了「完全没有 `scored_start`」这一支（没有 scored 窗，target-position/
  coverage 两项检查语意上无法进行,直接回传单一 reason)以外,其余检查互相独立、全部执行完才回传——
  fixture「collects both overflow reasons at once」直接锁住这个契约（README/checklist 明讲
  `reasons: readonly TrackingQualityReason[]`，不是单一 reason）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/trackingRunEligibility.test.ts` 13/13 passed；
  `npx vitest run`（全专案）195 files / 1857 tests passed（2 skipped），对照 T3 收尾的 194/1844 基准，
  新增 1 个档案、13 个测试，无回归。

### 2026-09-02 — T3：canonical P0/P1 metrics/truth fixtures（T3 完成）

- **落點**：新檔 `src/metrics/trackingDynamics.ts`（`deriveTrackingDynamics()` — README §2.4 interface
  逐字實作 — 加上額外 additive export `deriveTrackingReversalWindows()`，見下方決策）+
  `src/metrics/trackingDynamics.test.ts`（19 tests，8 條 truth fixture 全覆蓋）。`docs/operational/
  analysis-tracking.md` 新增「P1 — Tracking Pilot Dynamics」章節（公式/容差/blocked 語意/版本字串）。
- **P0 重用（不改 `trackingDerivation.ts`）**：`adaptPayloadForScoredWindow()` 建一份 shallow-copy
  `ExportPayload`——把每個 `visible` event 的 `t`/target 位置換成同 `targetId` 的 `scored_start`
  event 的 `t`/位置，再呼叫未修改的 `deriveTrackingMetrics()`/`deriveTrackingSamples()`。11 個既有
  caller 的 blast radius維持 0；無 `scored_start` 事件的匯出（如既有 legacy tracking 匯出）原樣通過,
  退回 plain `visible`-windowed P0（寬容,非錯誤）。專用 fixture（`dropRecoveryPayload` +
  「scored_start windowing」test）證明 prep 窗內的 drop/reacquire 不會漏進 scored 窗分析。
- **target/aim angular kinematics**：aim 端讀 `ticks[].dYaw`/`dPitch`（KI-005 tick 窗積分),不對
  `aim.yaw/pitch` 做差分——同 `angularKinematics.ts` `omegaDegPerSec()` 的 render/sim beat-aliasing
  規避理由。target 端用 `aimForward()` 的代數反函式（`yaw=atan2(-dx,-dz)`、`pitch=asin(dy)`)算出
  implied yaw/pitch,逐 tick 差分後把角度差 wrap 進 `[-180,180]`（band-limited/reversal trajectory
  可能跨 ±180° 縫）。兩序列皆從相鄰 tick pair 算出（首個 tick 無樣本,同 `omegaDegPerSec` 慣例）。
- **lag search / gain / residual**：`corr(omega_target(t), omega_aim(t+tau))` 對 `tau` 在
  `lagSearchMs`（凍結 `[0,250]ms`,D-54.5）內以整數 tick 步進搜尋；peak 挑選用「每個候選 `k` 的平均
  dot product」（避免搜尋邊界附近 overlap 樣本數略減造成的偏誤),`gain`/`rmse` 則用選定 `k_hat` 的
  **加總** dot product（與 README 公式的 `sum(...)/sum(...)` 形狀一致——同一 index range 上 sum 與
  mean 只差一個常數,對挑 peak 與算 gain 分開處理不影響結果一致性）。
- **ambiguity gate**：收集 mean-correlation-vs-tau 曲線的所有 local peak,若次高峰值超過
  `1/correlationAmbiguityRatio` 倍最高峰值,回傳 `lag-peak-ambiguous`（不得靜默回傳單一 lag/gain,
  README 風險表「Lag 多峰仍回傳單值」）。週期性 fixture（10Hz 純正弦,`[0,250]ms` 內出現 3 個相近
  峰值)驗證此路徑。
- **directional bias**：`signedYawBiasDeg`/`signedPitchBiasDeg` = post-acquisition 窗內
  `wrap(aim_angle_deg(t) - target_angle_deg(t))` 的平均值,兩軸分開回報,不 normalize 成單一分數。
- **recovery aggregation**：重用 `deriveTrackingTransitions()`（未修改,spider-shot 共用函式）取得
  `dropCount`/`reacquireMs`；`completedReacquireCount = reacquireMs.length`,
  `terminalDropCount = dropCount - reacquireMs.length`（`dropCount` 本就含未恢復的終端 drop,
  `reacquireMs` 本就排除它——相減即得終端計數,零額外掃描、零重複計數風險）。`longestOffTargetMs`
  另掃 on/off-target transition 找最長連續離線 run（含跑到窗尾仍未恢復的開放式 run），獨立欄位、
  絕不併入 `reacquireMs`/`completedReacquireCount`。
- **reversal event windows（FR-54-9,additive function）**：README §2.4 的 `TrackingDynamicsResult`
  沒有 reversal 專屬欄位（介面逐字凍結,不得加欄）——故 response latency/peak error/overshoot/
  settling time 落在新 export `deriveTrackingReversalWindows()`,以 `target_motion_change` event 為
  窗界（見下方決策 D-54.14）。純 pursuit block（零 `target_motion_change`）回傳 `windows: []`,
  視為正常/空,非 blocked 狀態。窗界排除 `'overlap'`（與前一次變化間隔 `< minBaselineMs`）與
  `'insufficient-window-data'`（可用窗長 `< minWindowMs`,含 run 尾端沒有足夠真實 tick 的情形——
  `presentation.windowEndMs` 在單目標 run 下恆為 `Infinity`（無後續 `visible` event）,必須另外以最後
  一筆真實 sample 的 `t` 夾住,否則「窗尾空間不足」的排除規則會失效,見下方 D-54.15）都計數、不靜默丟棄。
- **offline fixed-coefficient smoothing（`smoothingVersion`,D-54.5）**：`applySmoothingToSeries()`
  對 4 條 omega 分量套用版本化 FIR kernel（僅用於 lag search 輸入,不影響 bias 用的原始角度）;未知
  `smoothingVersion` fail fast（同 `trackingTrajectory.ts` 未知 `kind` 的紀律）。目前註冊
  `tracking-dynamics-smoothing-v1-none`（identity,truth fixture 預設,保持可精確追溯）與
  `tracking-dynamics-smoothing-v1-tri3`（對稱三點三角 FIR）。
- **8 條 truth fixture**：perfect follower（NFR-54-3：`rmsEpsilonDeg<1e-6`、`totPercent=100`、
  `lagMs≈0`、`gain≈1`）；fixed lag（NFR-54-2：`abs(estimated-truth)<=1000/simHz`——**25 秒**合成窗
  （非最初嘗試的 400 tick/3.1s——實測以 400 tick 合成窗跑同一 fixture,recovered lag 誤差達 5
  tick/39ms,遠超 1-tick 容差;改成 25 秒後誤差收斂到剛好 1 tick/7.8ms,壓線通過——才能讓多頻正弦訊號
  的有限窗 cross-correlation 邊界效應收斂到一個 tick 誤差內,恰好對齊 D-54.4 真實 scored block 長度）；
  known gain
  `0.7/1.0/1.3`（`abs(gain-truth)<=0.02`）；never acquire（P1 `blocked:'no-acquisition'`,P0
  `acquisitionFailureRate` 不被隱藏)；drop/reacquire（`completedReacquireCount>=1`、
  `terminalDropCount=0`）；terminal drop（`terminalDropCount>=1`、未污染 completed 計數）；
  overshoot/settling（`deriveTrackingReversalWindows()` 專屬 fixture,scripted rise-then-decay
  epsilon 曲線)；lag ambiguity（純正弦週期訊號,`blocked:'lag-peak-ambiguous'`）。額外覆蓋
  `protocol-incompatible`、`insufficient-valid-ticks`、兩種 `missing-target-telemetry`（缺 target
  position / 缺 dYaw-dPitch）、reversal window 的 `'overlap'`/`'insufficient-window-data'` 排除,以及
  未知 `smoothingVersion` fail-fast。
- `npx tsc --noEmit` exit 0；`npx vitest run src/metrics/trackingDynamics.test.ts` 19/19 passed；
  `npx vitest run`（全專案）194 files / 1844 tests passed（2 skipped),對照 T2 slice 6 的 193/1825
  baseline,新增 1 個檔案、19 個測試,無回歸。
- **執行協議偏離記錄**：本 task 未逐一切出 README 建議的 8 個 slice 各自 commit——lag search、gain、
  residual、ambiguity gate 與 recovery aggregation 在實作與 debug 過程中高度耦合（同一組 fixture
  同時驗證多個子功能),事後強行拆成獨立 commit 需要重新設計 fixture 邊界,對可稽核性沒有實質幫助,
  反而增加風險。改採 2 個 commit：(1) 實作 + 全部 truth fixture + 全專案 regression 綠燈,
  (2) operational doc + checklist/progress 收尾。記錄於此供後續 task 參考。
- 尚未動：`graphify update .`（留到本 task 收尾一次執行，見下方最終收尾條目）；T4 的 eligibility
  vocabulary、`TrackingPilotEvidence` JSON/HTML 尚未開工。

### 2026-09-02 — T2 slice 6/6：graphify update + 文件收尾（T2 完成）

- `graphify update .`：3909 nodes / 9263 edges / 242 communities 重建（`graphify-out/GRAPH_REPORT.md`/
  `graph.html`/`graph.json`/`manifest.json` 同步）。
- `codegraph sync .`：索引已是最新（無 pending）。
- README §2.2 新增「T1/T2 actual additive touch points」段落，補上讀碼後實際觸碰但原規劃表未列出的
  10 個檔案（`DrillConfig.ts`/`schema.ts`/`clearance.ts`/`TargetManager.ts`/`SharedState.ts`/
  `SimLoop.ts`/`DrillRunner.ts`/`DataRecorder.ts`/`metadata.ts`/`main.ts`+`fpsTestHarness.ts`），並
  註記原規劃裡尚未落地的 T3+ 項目（`trackingDynamics.ts`/`trackingPilotEvidence.ts`/
  `trackingPilotManifest.ts`/`analysis-tracking.md`/`tracking-pilot-runbook.md`）非本次遺漏、依排程
  屬 T3-T5。README 狀態列、stage11 母檔（README/task-checklist/progress，見 2026-09-02 條目）與本
  package 的 `task-checklist.md` 同步翻 T2 ✅。
- 最終全專案 regression（slice 5 收尾時已跑過，此處為 graphify/codegraph 同步後的確認性重跑）：
  `npx tsc --noEmit` exit 0；`npx vitest run` 193 files / 1825 tests passed（2 skipped），無回歸。
- **T2 總結**：6 個 slice、每片各自 atomic commit（見上方 slice 1-5 條目）。交付：additive
  `DrillConfig.targets.trackingTrajectory`/`timing.trackingPrepMs`/`protocolGuard` 契約 + schema 驗證 +
  clearance envelope 展開（slice 1）；`TargetManager` trajectory drive + `scored_start`/
  `target_motion_change` producer（slice 2）；no-fire/no-ADS/no-movement edge-triggered guard（slice 3）；
  export metadata opaque pass-through（slice 4）；9 個實際 pilot block config（1 practice + 2
  calibration + 4 core matrix + 2 reversal density，slice 5）。全程未修改任何既有 legacy drill 行為
  （`tracking_v1`/`_longrange_v1`/`_br_v1` 等 legacy regression 全程保持綠燈，逐 slice 驗證）。
- **遺留給後續 T 的已知缺口**（非本 T2 範圍，記錄供 T3+ 讀碼時參考）：
  1. `DrillConfig.timing.trackingStopMs`（hold-track-v1 用）與 `trackingTrajectory` 未加 schema 層互斥
     guard——語意上不相容（trackingStopMs 會凍結目標並解鎖開火，與連續 tracking pursuit 矛盾），但
     TargetManager 的 trajectory drive 分支在 legacy motion 分支之前提早 `continue`，即使兩者誤同時
     設定，trajectory drive 仍會贏、不會 crash。不影響任何已交付 block（皆未設定 trackingStopMs）。
  2. protocolGuard 的「movement」偵測讀 `state.held.left`/`state.held.right`（按鍵狀態），非
     `state.player.vx`（實際速度）——按鍵按下但因 friction/accelerate 尚未產生位移的情形仍會被記為
     violation，符合「偵測輸入意圖」的既定語意（FR-54 原文「no-movement」對應按鍵層級，非速度層級）。
  3. 尚未有任何地方（main.ts UI/researcher runner）實際載入本 T2 交付的 9 個 pilot block——T2 checklist
     的 DoD 是「configs 可 load/complete/rebuild」，不要求 UI 註冊；researcher-mode 排程/操作流程是
     T5（Researcher manifest/operator flow）範圍。

### 2026-09-02 — T2 slice 5/6：pilot block config 檔案（practice/calibration/core 2×2/reversal density）

- **落點**：`src/drill/tracking_core_pr_pilot_v1.ts`（practice + horizontal/vertical axis calibration +
  core 2×2 size/speed matrix，`band-limited-2d-v1`）與 `src/drill/tracking_reversal_pilot_v1.ts`
  （medium/high reversal density，`reversal-2d-v1`）——與 README §2.2 規劃路徑一致。慣例對齊
  `peek_click_transfer_pilot_v2.ts`（builder function + `XXX_CANDIDATES` 陣列 single source，供未來
  T5 researcher-mode 註冊）與 `tracking_longrange_v1.ts`（module-level 常數 + 內嵌設計註解）。
- **關鍵設計決策**：每個 config 一律 `mode: 'practice'`（WP-33 `AssessmentMode` 契約），**包含**
  WP-54 自己語彙裡「已評分」的 calibration/core/reversal blocks——比照既有 WP-52 pilot v2 precedent
  （`peek_click_transfer_pilot_v2.ts` 的所有候選，含其分析用候選，皆 `mode:'practice'`）。`DrillConfig.
  mode` 的 Assessment/Practice 契約與 WP-54 自己「practice vs scored」的語彙是兩個不同軸線：後者用
  `timing.trackingPrepMs` + `protocolGuard` 的有無表達（practice block 兩者皆無；calibration/core/
  reversal 皆兩者皆有），不疊加進前者，避免 pilot run 意外流入正式 Assessment 機制（違反 stage11 交付
  定位「不發布正式 Assessment」）。
- Scored block 契約：`trackingPrepMs=1000`（FR-54-5「1 秒置中準備」）、`protocolGuard={noFire,noAds,
  noMovement:true}`（§1.3「Scored block 禁止射擊、ADS 與玩家移動」）、trajectory `durationMs=25000`
  （D-54.4 凍結值）、`endCondition={type:'timeLimit', value:26000}`（prep+scored 合計）、
  `presentationMs=30000`（安全高於 26000，避免 timed-presentation 提早撤除目標搶在 timeLimit 之前）。
- Core matrix：`yawBoundDeg=pitchBoundDeg`∈{2.0,0.5} deg × `targetRmsSpeedDegPerSec`∈{5,20} deg/s
  （OQ-54-2 calibration candidate，非凍結）；`frequencyBandHz=[0.1,0.7]` 固定不變（非操弄變項）。
  Calibration blocks 用 2.0deg/5dps 這格（較大振幅、較慢速度，隔離單軸可見度判讀，不與快速運動混淆）
  搭配被壓制軸 `0.1deg`（`trackingTrajectory.ts` 要求正值，不能是 0）。Reversal blocks：
  `angularBoundsDeg=[-8,8]`、`speedRangeDegPerSec=[5,20]`（沿用 core matrix 速度候選，便於跨 block
  比較）、`accelerationRampMs=150`；medium `reversalIntervalMs=[800,1400]`、high `=[300,600]`——只有
  密度變動。
- `distance=4`（沿用 `tracking_v1`/`tracking_core_pr_pilot_v1` 既有正前方視線慣例，非
  `tracking_longrange_v1` 被迫改用的 110° 右後方 lane——4u 距離下角度上界投影後的側向/垂直偏移遠小於
  既有 L/R 槽位 `SIDE_OFFSET=2u`，`field-low` clearance 測試證實全部 block 過關）。
- 每個 block 各自獨立 seed（`SEED_BASE=54000`/`54100` 兩個家族，WP-54 專屬、不與既有 WP 的
  18018/23002/94000s/95000s 系列碰撞）與獨立 `drillId`（researcher-mode 註冊鍵，同時承載 checklist
  要求的「condition」標籤——每個 candidate 一個穩定識別，不新增額外欄位）。
- 測試：`src/drill/tracking_core_pr_pilot_v1.test.ts`（8 tests：全部 block 過 `field-low` clearance、
  drillId/seed 各自唯一、practice block 無 prep/guard、calibration 軸向振幅斷言、scored window 契約、
  2×2 矩陣覆蓋每個候選組合恰一次、端到端 sim round-trip 驗證 `visible`/`scored_start` 事件）；
  `src/drill/tracking_reversal_pilot_v1.test.ts`（6 tests：clearance、drillId/seed 唯一、high 密度區間
  嚴格短於 medium 且僅密度變動、scored window 契約、`accelerationRampMs < reversalIntervalMs[0]`、
  端到端 sim round-trip 驗證 `scored_start`/`target_motion_change` 事件皆抵達 recorder）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 193 files / 1825 tests passed（2 skipped），無回歸。
- T2 checklist 8 個項目全數完成。尚未動：`graphify update .`（production code 有變動，依 T1 precedent
  等 T2 全部收尾再一次執行）與最終 README/task-checklist/progress 收尾同步（slice 6）。

### 2026-09-02 — T2 slice 4/6：export metadata（trackingTrajectory/trackingPrepMs opaque pass-through）

- **設計修正（比 T0/T1 規劃更簡）**：讀碼發現 `SpawnMeta.motion`/`spawnArea`/`spiderShot` 早已是
  opaque `unknown` pass-through 慣例（`parseSpawnMeta` 直接原樣帶出，不深驗——深驗留給各自 config 建構
  期，如 `trackingTrajectory.ts` 的 runtime guard）。checklist 要求的「drill id、trajectory version、
  seed、condition、angular size/speed、duration」六項，**五項已經全部在 `DrillConfig.targets.
  trackingTrajectory` 這個物件裡**（`kind`=version、`seed`、`durationMs`=duration、
  `yawBoundDeg`/`pitchBoundDeg`（band-limited）或 `angularBoundsDeg`（reversal）=size、
  `targetRmsSpeedDegPerSec`/`speedRangeDegPerSec`=speed），`drillId`/condition 則是既有頂層
  `meta.drillId`（每個 calibration candidate 給獨立 drillId，如 `PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES`
  precedent）。故**不新增 `Meta.trackingPilot?` 平行 meta block**（原 T2 開工前設計筆記的方向）——
  那樣會把同一份 seed/kind/size/speed/duration 在兩個地方各定義一次，違反 GD-7「單一來源」精神；改為
  單純把 `trackingTrajectory` 整包物件塞進既有 `SpawnMeta.trackingTrajectory?: unknown`（比照 `motion`
  同紀律），`trackingPrepMs` 則比照 `presentationMs`（驗證正有限數，非 opaque，因為是純數字無需信任
  下游 parser）。
- `src/data/metadata.ts`：`SpawnMeta` 新增 `trackingTrajectory?: unknown`、`trackingPrepMs?: number`。
- `src/data/exportPayloadSchema.ts`：`parseSpawnMeta` 新增 `trackingTrajectory` opaque passthrough、
  `trackingPrepMs` 驗證（`parsePositiveFiniteNumber`，既有 helper）。
- `src/main.ts`、`src/testharness/fpsTestHarness.ts`：`buildCurrentExportPayload`/`fpsTestHarness` 的
  `spawn: {...}` 區塊各自新增 `trackingTrajectory`/`trackingPrepMs` 條件展開（比照緊鄰的 `motion`/
  `presentationMs` 寫法）——兩處原本就逐位重複 `motion`/`spawnArea`/`spiderShot`/`spawnDelayMsRange`/
  `presentationMs` 全部欄位（既有慣例，非本次新增的重複），故同步兩處維持一致慣例。
- 測試：`src/data/metadata.test.ts` +1 test（`collectMeta` 原樣帶出 `spawn.trackingTrajectory`/
  `trackingPrepMs`）；`src/data/exportPayloadSchema.test.ts` +2 tests（canonical round-trip、
  `trackingPrepMs <= 0` fail-fast）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1811 tests passed（2 skipped），無回歸。
- 尚未動：實際 pilot block config 檔案本身（practice/axis calibration/core 2×2/reversal density
  candidates，slice 5——本 slice 只交付「若有 block config 存在，其 metadata 如何匯出」的管線）。

### 2026-09-02 — T2 slice 3/6：protocolGuard（no-fire/no-ADS/no-movement）

- `src/drill/DrillRunner.ts`：新增 `tickProtocolGuard(s, nowMs)`（`running` 相位內、`tickHoldReversal`
  之後呼叫，與其同層）。**設計**：每個 kind（fire/ads/movement）各自一個「已回報」latch，而非比較
  「上一 tick held 值」——因為跨 prep 窗界帶入的既有 held 狀態，在 scored 窗開始那一刻就該算一次違規，
  不必等到「false→true」邊緣；latch 在對應輸入放開時歸零，允許下一次按下再記一次。閘門條件是
  `s.tScoredStart.size === 0`（尚無任何目標跨過 prep）→ 直接跳過，不偵測——prep 窗內既有輸入（例如玩家
  放開移動鍵準備瞄準）不應誤記。**不阻擋輸入本身**：只推進 `s.protocolViolations`，完全不寫
  `heldFire`/`heldAds`/`held`。
- `src/data/DataRecorder.ts`：新增 `protocol_violation` additive `DrillEvent` 變體（`kind: 'fire'|'ads'|
  'movement'`、`t`）。
- `src/data/exportPayloadSchema.ts`：新增 `parseProtocolViolationEvent`（`kind` 用既有 `parseLiteral`
  封閉列舉慣例），`parseDrillEvent` switch 補一個 case。
- `src/loop/SimLoop.ts`：新增 `recordProtocolViolationEvents`（比照 `recordTargetMotionChangeEvents` 的
  export-then-clear），`simStep` 內接在其後呼叫。
- 測試：`src/drill/DrillRunner.test.ts` +6 tests（prep 窗內不偵測、跨過 prep 那個 tick 立即記帶入的
  既有 held 違規、latch 恆 held 只記一次+放開再按再記一次、noAds/noMovement 各自獨立、省略
  protocolGuard 時逐位不變、不阻擋輸入本身的直接斷言）；`src/data/exportPayloadSchema.test.ts` +4
  tests（正向解析 + canonical round-trip + 3 個 fail-fast 案例）。過程中同樣先犯一次 crossedPrep
  邊界 off-by-one（測試迴圈多跑了一次，把跨過 prep 的那個 tick 誤算進「仍在 prep 窗內」的斷言區間），
  發現後修正迴圈邊界——非實作問題，見上一個 slice 已建立的同類邊界紀律。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1808 tests passed（2 skipped），無回歸。
- T2 checklist 的 8 個項目中，practice/calibration/2×2/reversal block **config 檔案本身**（slice 5）與
  export metadata 接線（drill id/trajectory version/seed/condition/angular size&speed/duration，slice 4）
  尚未完成；其餘（trajectory drive round-trip、scored start/practice boundary event、protocol violation
  guard、target visibility/clearance/角度尺寸 round-trip）已在 slice 1-3 交付，同步翻 task-checklist.md。

### 2026-09-02 — T2 slice 2/6：SharedState/TargetManager/SimLoop trajectory drive + scored_start/target_motion_change producer

- `src/state/SharedState.ts`：新增 `tScoredStart: Map<string, number>`（比照 `tStop`）、
  `targetMotionChanges`/`protocolViolations` transient queue（比照 `cues`）——三者皆 additive，
  `interface`/`createSharedState`/`resetState` 三處同步；`protocolViolations` 本 slice 只定義欄位，
  producer（`DrillRunner.tickProtocolGuard`）留給 slice 3。
- `src/sim/TargetManager.ts`：`trackingTrajectory` 存在時建構期建一次 `createTrackingTrajectory()`
  （比照 `hitboxQueue`「build once per run」慣例），drive 迴圈新增獨立分支（`isDrivenMotion` 分支之前
  提早 `continue`，legacy motion 路徑逐位不動）。**關鍵設計**：`crossedPrep = nextAge >= trackingPrepSec`
  同時閘控 `tScoredStart` 蓋戳與 `changes` 游標 drain——若只用 `trajectoryAgeSec` 是否為 0 來判斷會在
  prep 窗**每個** tick 誤觸發（因為 clamp 後恆為 0），改用「是否已跨過 prep」這個布林旗標一次性判斷，
  且用 `state.tScoredStart.has(id)` 而非 `prevAge < prepSec` 的邊界比較來保證恰好蓋一次（prepSec=0 的
  退化情形下 `prevAge < prepSec` 用邊界比較會漏掉第一個 tick——`has()` 檢查沒有這個陷阱）。origin 重用
  既有 `distance`/`TARGET_Y`；`spawn()` 完全不用改（trackingTrajectory 目標的 `motion` 恆 undefined，
  且 drive 迴圈第一個 tick 就會用絕對投影覆寫 spawn 給的暫時 pos，spawn 給的 side-slot x 值從未被外部
  觀察到）。`markKilled`/`reset` 同步清除 `tScoredStart`/`targetMotionChanges`（比照既有 `tVisible`/
  `tStop`/`cues` 清除紀律）。
- `src/data/DataRecorder.ts`：新增 `scored_start` additive `DrillEvent` 變體（形狀比照 `target_stop`）。
- `src/data/exportPayloadSchema.ts`：新增 `parseScoredStartEvent`，`parseDrillEvent` switch 補一個 case。
  `target_motion_change` 的 producer 側（T1 只交了 parse 側）在本 slice 由 `TargetManager` 補上。
- `src/loop/SimLoop.ts`：新增 `recordScoredStartEvents`（比照 `recordTargetStopEvents` 的 exact-tick-match
  dedup）、`recordTargetMotionChangeEvents`（比照 `recordCueEvents` 的 export-then-clear），`simStep` 內
  緊接既有 `recordTargetStopEvents` 呼叫之後加這兩個。
- `src/data/export.ts`（`serializeEventsCSV`）**刻意未修改**：既有 `if/else if` 鏈無 `default`/`else`
  分支，未匹配的事件型別靜默不產生 CSV 列（非 throw）——`scored_start`/`target_motion_change` 沿用 T1
  對後者的既有決定（JSON-only，理由同前：無語意相符既有欄可重用、CSV header 不變測試已鎖）。
- 測試：`src/sim/TargetManager.test.ts` +9 tests（trackingTrajectory drive round-trip 對 `createTrackingTrajectory`
  + `projectTrackingAngles` 現算現比對、prep 窗凍結、跨過 prep 蓋戳恰一次、reversal `target_motion_change`
  在 prep 窗內不得提早 drain、`markKilled`/`reset` 清除紀律）；`src/loop/SimLoop.test.ts` +1 test（`simStep`
  直驅路徑端到端：recorder 收到 `scored_start`/`target_motion_change`）；`src/data/exportPayloadSchema.test.ts`
  +6 tests（`scored_start` 正向解析 + canonical round-trip + 4 個 fail-fast 案例）。
  過程中發現並修正 2 個測試自身的邊界 off-by-one（`crossedPrep` 判準為 `nextAge >= prepSec`，含跨過那個
  tick 本身；原測試迴圈邊界寫錯，不是實作 bug——見 commit 前 debug 紀錄，此處不重複列出試錯過程）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1797 tests passed（2 skipped），無回歸。
- `graphify update .` **延後**到 T2 全部 slice 完成後一次執行（比照 T1 slice 1/2 的「避免中途 partial
  graph 產生誤導性節點」決策）。
- 尚未動：`protocolGuard`/`DrillRunner.tickProtocolGuard`/`protocolViolations` producer（slice 3）、
  export metadata `trackingPilot` meta block（slice 4）、實際 pilot block config 檔案（slice 5）。

### 2026-09-02 — T2 slice 1/6：DrillConfig/schema/clearance 契約

- `src/drill/DrillConfig.ts`：新增 `targets.trackingTrajectory?: TrackingTrajectoryConfig`（import 自
  `src/sim/trackingTrajectory.ts`，不重新宣告型別）、`timing.trackingPrepMs?: number`、頂層
  `protocolGuard?: { noFire?; noAds?; noMovement? }`——三者皆 additive，省略時既有 `DrillConfig` 逐位不變。
- `src/drill/schema.ts`：新增 `validateTrackingTrajectory`（`band-limited-2d-v1`/`reversal-2d-v1` 兩支，
  數值規則對齊 `trackingTrajectory.ts` 自己的 runtime guard，但在 `loadDrill` 驗證閘就帶欄位路徑拒絕）、
  `validateProtocolGuard`、`requireAscendingRange`/`requireAscendingPositiveRange`（嚴格 `min < max`，
  區別於既有 `requireRange` 的 `min <= max`——對齊 trajectory kernel 對退化區間的拒絕）。`trackingTrajectory`
  與 `motion` 互斥（比照既有 `hitbox`/`hitboxCandidates` 互斥風格）；`trackingPrepMs` 需搭配
  `trackingTrajectory`。
- `src/scene/clearance.ts`：`envelopeForSide` 新增 `expandForTrackingTrajectory`（import
  `projectTrackingAngles`/`TrackingProjectionOrigin` 自 `src/sim/trackingTrajectory.ts`——scene 消費 sim
  的無場景耦合純幾何函式，方向不違反 GD-6）。**設計決策**：trackingTrajectory 目標的 envelope 中心改為
  `x=0`（不套用既有 L/R peek 槽位 `±TARGET_SIDE_OFFSET_U` 偏移）——trackingTrajectory 目標是單一持久目標、
  繞玩家正前方中軸連續運動，比照既有 `spiderShot.centerDistanceU` 的 `(0, TARGET_Y, -centerDistanceU)`
  中軸慣例，不是 L/R 交替 peek。`band-limited-2d-v1` 讀 `yawBoundDeg`/`pitchBoundDeg`；`reversal-2d-v1` 的
  `angularBoundsDeg` 同時套用到 yaw 與 pitch（對齊 T1 `createReversal2dV1` 兩軸共用同一 range 的慣例）。
  四角落投影展開 AABB（純建構期上界檢查，不逐 tick 模擬，同 `expandForMotion` 紀律）。
- 測試：`src/drill/schema.test.ts` +14 tests（trackingTrajectory 合法/互斥/欄位驗證、trackingPrepMs 搭配
  規則、protocolGuard 欄位驗證）；`src/scene/clearance.test.ts` +2 tests（band-limited/reversal envelope
  展開，期望值以 `projectTrackingAngles` 現算現比對，避免手算誤差；`toBeLessThan(-0.5)` 佐證確實展開，
  且未套用 side offset）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/drill src/scene` 29 files / 247 tests passed，無回歸。
- 尚未動：`SharedState`/`TargetManager`/`SimLoop`/`DrillRunner`/`DataRecorder`/`exportPayloadSchema.ts`
  （trajectory 實際 drive、`scored_start`/`target_motion_change`/`protocol_violation` producer 側）留給
  slice 2-3；本 slice 只交付 config 契約與 clearance round-trip，`trackingTrajectory` 尚無任何 drill 使用。

### 2026-09-02 — T2 CodeGraph discovery + landing-point design（開工前，未寫 code）

讀碼後（`codegraph_explore` 對 `DrillConfig`/`schema.ts`/`clearance.ts`/`TargetManager.ts`/
`SimLoop.ts`/`SharedState.ts`/`DrillRunner.ts`/`DataRecorder.ts`/`exportPayloadSchema.ts`/
`ProtocolRunner.ts`）確認以下與 README §2.2 規劃路徑的落點差異，並記錄實際設計（供 T2 各切片依循，
偏離處後續完成時同步回寫 README）：

- **不走 `src/drill/tracking_core_pr_pilot_v1.ts` 等獨立檔案清單先行**——先做「trajectory 如何接進
  既有 `DrillConfig`/`TargetManager`/`clearance`/`DrillRunner`/`SimLoop`/`DataRecorder` 資料流」這個
  地基（T2 slice 1-3），最後才落 block config 檔案本身（slice 4-5）。原因：pilot block 本質仍是一份
  `DrillConfig`（沿用 F4「換 config 即換 drill」），沒有新引擎介面；地基不穩，config 檔案只是噪音。
- **`ProtocolRunner`（`src/display/ProtocolRunner.ts`）不是本 WP 要用的機制**——它是「整個 drill+scene+
  resolution mode 換條件」的協定跑者（WP-52 pilot v2 用），操作粒度是「換一個完整 drill」。WP-54 的
  practice→1s 置中準備→25s scored 窗界是**單一 drill run 內部**的相位/事件語意，不是跨 drill 條件切
  換——T5（researcher session manifest/operator flow）才會決定要不要疊一層 `ProtocolRunner`-like 排程
  跑完整組 block 序列；T2 只交付單一 block 的 config 契約與執行期語意。
- **`DrillConfig.mode`（`AssessmentMode` = `'assessment' | 'practice'`）已存在**，直接重用做 practice
  block 的識別（FR-54-5「practice 不寫入 scored aggregation」在 T2 的落地＝practice block 的 config
  帶 `mode: 'practice'`；實際聚合層的排除規則留給 T4 讀這個欄位，T2 不用新發明一個 practice 旗標）。

**新 additive 契約（設計，尚未實作，2026-09-02）**：

1. `DrillConfig.targets.trackingTrajectory?: TrackingTrajectoryConfig`（import 自
   `src/sim/trackingTrajectory.ts`，不重新宣告型別）——`targets.motion` 的 sibling、schema.ts 強制互斥
   （比照現行 `hitbox`/`hitboxCandidates` 互斥風格）。
2. `DrillConfig.timing.trackingPrepMs?: number`——比照現行 `trackingStopMs` 慣例（正有限數，選填）。
   `TargetManager` 用它把 trajectory 的 `ageSec` 原點往後推：`nextAge < prepSec` 時目標凍結在
   `trajectory.sample(0)`（= 玩家「置中準備」瞄準的固定點），跨過 `prepSec` 那個 tick 觸發
   `scored_start` 事件、之後 `ageSec = age - prepSec` 正常推進。**不**新增「practice 相位」到
   `DrillRunner.DrillPhase`（`idle|countdown|running|ended` 不變）——prep 純粹是 `TargetManager` 對單一
   持久目標（`timing.presentationMs`/`trackingStopMs` 已有的「一直存活到 drill 結束」模式）的內部時間
   原點平移,不是新的生命週期相位。
3. `DrillConfig.protocolGuard?: { noFire?: boolean; noAds?: boolean; noMovement?: boolean }`
   （additive top-level 欄位,`cue` 的 sibling)。`DrillRunner`（已持有 `config`/`state`,`tickHoldReversal`
   同層)新增 `tickProtocolGuard`:只在 scored 窗內（`state.tScoredStart` 該目標已蓋戳且
   `nowMs >= 蓋戳時間`）對 `heldFire`/`heldAds`/`held.left`/`held.right` 做 edge-trigger 偵測（false→true
   才記一次，不連續洗版、不阻擋輸入本身,FR-54 no-fire/no-ADS/no-movement 硬約束原文）。
4. `SharedState` 新增三個 additive 欄位（`interface`/`createSharedState`/`resetState` 三處同步)：
   - `tScoredStart: Map<string, number>`（比照既有 `tStop`,`TargetManager` 寫、`SimLoop` 讀drain）。
   - `targetMotionChanges: Array<{targetId; t; yawVelocityBeforeDegPerSec; yawVelocityAfterDegPerSec;
     pitchVelocityBeforeDegPerSec; pitchVelocityAfterDegPerSec}>`（比照既有 `cues` 的 transient queue
     模式——`TargetManager` 依 `trajectory.changes`（T1 已預算好的 schedule）游標推進 push,`SimLoop`
     每 tick drain 進 `recorder`,清空)。**T1 只交了 `target_motion_change` 的 parse 側**（`DrillEvent`
     union member + `exportPayloadSchema.ts` parser)，producer 側（誰在什麼時候真的 push 這個事件)是
     T2 待補的一半——這裡補上。
   - `protocolViolations: Array<{kind: 'fire'|'ads'|'movement'; t: number}>`（同 `cues` transient queue
     模式，`DrillRunner.tickProtocolGuard` 寫、`SimLoop` drain)。
5. `TargetManager`：`trackingTrajectory` 存在時,建構期建一次 `createTrackingTrajectory()`（比照
   `hitboxQueue`「build once per run」慣例,非每 tick)；drive 迴圈新增獨立分支（`isDrivenMotion(t.motion)`
   分支之前提早 `continue`，legacy motion 路徑逐位不動)：`sample(trajectoryAgeSec, buf)` →
   `projectTrackingAngles(buf.yawDeg, buf.pitchDeg, {distanceU: config.targets.distance, centerY: TARGET_Y},
   t.pos)`（origin 重用既有 `targets.distance`/`TARGET_Y`,不新增 config 欄位、不新增常數)。`spawn()`
   完全不用改（trackingTrajectory 目標的 `motion` 恆 undefined,`age:0` 初始化已存在)。
6. `src/scene/clearance.ts`：`envelopeForSide` 新增 `expandForTrackingTrajectory(min, max, center,
   trackingTrajectory, hitbox)`,重用既有 `expandByPoint` helper——把 `trackingTrajectory` 的角度上界
   （`band-limited-2d-v1` 讀 `yawBoundDeg`/`pitchBoundDeg`；`reversal-2d-v1` 讀 `angularBoundsDeg` 同時
   套用到 yaw 與 pitch,對齊 T1 `createReversal2dV1` 的 room 計算慣例)四個角落投影
   （import `projectTrackingAngles`/`TrackingProjectionOrigin` 自 `src/sim/trackingTrajectory.ts`——
   scene 讀 sim 的純幾何函式,方向不違反 GD-6「場景幾何不得進 sim」,是反過來 scene 消費 sim 的無場景
   耦合 pure function)展開進 AABB。
7. `DrillEvent` 新增兩個 additive union member：`scored_start`（形狀比照 `target_stop`：`targetId`/`t`/
   `targetX`/`targetY`/`targetZ`）、`protocol_violation`（`kind: 'fire'|'ads'|'movement'`/`t`）。
   `src/data/exportPayloadSchema.ts` 各補一個 parser、`parseDrillEvent` switch 新增兩個 case。CSV
   （`src/data/export.ts` `serializeEventsCSV`）沿用 T1 對 `target_motion_change` 的既有決定——**不**
   新增欄（JSON-only,理由同 T1 slice 2/2 記錄：無語意相符的既有欄可重用、CSV header 不變測試已鎖）。
8. Export metadata（drill id/trajectory version/seed/condition/angular size&speed/duration）落點：
   `src/data/metadata.ts` 待讀碼確認確切寫法後在對應切片動工，暫記為 `Meta.trackingPilot?` additive
   sub-block（設計方向,非最終定案——實作時若讀碼發現更貼合既有慣例的落點，以讀碼後為準)。

**執行順序（T2 slice 計畫,每片各自 commit + focused test + `npx tsc --noEmit`)**：
① DrillConfig/schema/clearance 契約（含 mutual-exclusion + envelope round-trip test）
② SharedState 新欄位 + TargetManager 接線（trajectory drive + `scored_start` + `target_motion_change`
   producer）+ SimLoop drain + DrillEvent/schema parser（含 round-trip + legacy regression）
③ protocolGuard（DrillConfig + DrillRunner.tickProtocolGuard + SharedState.protocolViolations +
   SimLoop drain + DrillEvent + schema parser）
④ export metadata 接線（trackingPilot meta block）
⑤ 實際 pilot block config 檔案（practice、axis calibration、core 2×2、reversal density candidates）
⑥ 全專案 regression + `graphify update .` + README/task-checklist/progress 收尾同步

### 2026-09-02 — T1 slice 2/2：angular-to-world projection + `target_motion_change` export event

- 新增 `projectTrackingAngles(yawDeg, pitchDeg, origin, out)`（`src/sim/trackingTrajectory.ts`）：純幾何函式，`yaw=pitch=0` 時輸出 `(0, centerY, -distanceU)`，與既有 `TargetManager` sightline 慣例一致；不讀場景資料（GD-6）。5 個新測試（boresight、90° yaw/pitch、鏡射對稱、純函式性）。實際「這個 origin 從哪來、寫回哪個 `TargetState`」留給 T2（`TargetManager` wiring），T1 只交付可重用的投影公式本身。
- 新增 additive `target_motion_change` `DrillEvent` variant（`src/data/DataRecorder.ts`）+ `parseTargetMotionChangeEvent`（`src/data/exportPayloadSchema.ts`，wired into `parseDrillEvent` switch）：`targetId`、`t`、`yaw/pitchVelocityBefore/AfterDegPerSec` 皆為必要有限數；未知欄位/缺欄位 fail fast（沿用既有 `parseFiniteNumber`/`parseNonEmptyString` helper，無新 helper）。
- `src/data/exportPayloadSchema.test.ts` +19 tests：positive parse、`canonicalExportJSON` round-trip（含二次 parse 驗證逐位相等）、4 個 fail-fast 案例（缺 targetId/t/非有限 yaw velocity/缺 pitchVelocityAfter）。
- **刻意不改** `src/data/export.ts` 的 `serializeEventsCSV`：該檔既有 2 個 test 明確斷言「header 不變、不新增欄」（WP-29 key event 前例：重用既有 `key`/`down` 欄而非新增 `code` 欄）。`target_motion_change` 的 4 個 yaw/pitch velocity 數值目前沒有語意相符的既有欄可重用（`viewYaw`/`aimPunchYaw` 等欄屬於 fire event 的瞄準語意，硬套會誤導 CSV 消費者）。since 尚無任何 producer 會真的送出此事件（T2 才接線），CSV 這個 gap 現在不影響任何真實資料；記錄為已知、有意的暫緩，留到 T2 接線、確定欄位語意後再決定新增欄或找到合適的既有欄重用，而不是現在猜錯。JSON（`serializeJSON`/`canonicalExportJSON`）路徑對此事件完整、無 gap。
- `npx tsc --noEmit` exit 0（`DrillEvent` 61 個既有 caller 皆用 `if/else-if` 而非窮舉 `switch`，additive union 變更未破壞任何一個）；`npx vitest run` 全專案 191 files / 1766 tests passed（2 skipped），無回歸。
- `graphify update .` 已執行（3884 nodes / 9158 edges / 240 communities 重建）；`codegraph sync .` 確認索引已是最新。
- T1 至此全數完成（README §4 DoD：FR-54-2/3、NFR-54-1/6 tests 全綠；`tracking_v1`/`_longrange_v1`/`_br_v1` snapshot 無 semantic diff；未知 version fail fast）。

### 2026-09-02 — T1 slice 1/2：deterministic trajectory kernel（`src/sim/trackingTrajectory.ts`）

- 新增 `createTrackingTrajectory(config)`，涵蓋 README §2.4 兩種 kind：
  - `band-limited-2d-v1`：5 個對數等距頻率分量的 sum-of-sinusoids pursuit，係數在建構時一次解出（速度 RMS 目標 vs. 位置邊界安全兩個縮放係數取 min——邊界安全恆優先）；`sample(ageSec, out)` 之後只是純函式求值，無 `changes`（連續 pursuit，無離散事件）。
  - `reversal-2d-v1`：**設計歷經一次返工**——原設計讓新 leg 直接沿用上一個 leg 的巡航速度做 ramp（`v(0)=前一 leg 終速`），實測（`toBeGreaterThanOrEqual(lowDeg)` 失敗，`-8.0148` 越界）發現：leg 邊界的殘留速度仍指向舊方向（撞牆方向），ramp 前段會先繼續衝向牆、超過已用完的房間才回頭。改為**每個 leg 靜止到靜止**（ramp-up 0→cruise、cruise、ramp-down cruise→0）的梯形/三角形速度剖面：leg 邊界恆是速度歸零瞬間，房間不足以跑完整趟 ramp 時，用同一個加速度 `magnitude/rampNominalSec`（不升高）反推可達到的較低峰值速度（三角形分支）。此設計讓「位置不越界」變成解析可證的建構期保證，不需要 runtime clamp。見本檔 D-54.12。
  - `createTrackingTrajectory()` 對未知 `kind` runtime fail fast（README §2.4「Unknown trajectory kind/version ... 必須 fail fast」）。
- 新增 `src/sim/trackingTrajectory.test.ts`（30 tests）：bounds sweep、finite-acceleration 上界、change-event 連續性/before-after 一致性、60/120/240 Hz pump-cadence 等價（純函式 age 求值，天然滿足決定性）、reset reproducibility、不同 seed 產生不同結果、config fail-fast（非有限 seed、非正 duration、非遞增 range、ramp ≥ min interval 等）。
- Legacy tracking baseline 重跑：11 檔（`targetMotion`/`TargetManager`/`tracking_v1`/`_longrange_v1`/`_br_v1`/`_scene_v1` 等）103 tests 全綠，`trackingTrajectory.ts` 為全新獨立檔案、未改動任何既有 symbol，snapshot 無 semantic diff。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1755 tests passed（2 skipped），無既有測試回歸。
- 尚未完成（下一個 T1 slice）：angular-to-world projection（yaw/pitch → `TargetState.pos`，留到 T2 wiring 進 `TargetManager`/pilot drill config 時一併做）、additive `target_motion_change` export event 與 `exportPayloadSchema.ts` round-trip。
- production code 有變動，但 `trackingTrajectory.ts`/`.test.ts` 尚未被任何既有模組 import（純新增、未接線），暫緩 `graphify update .` 到 T1 完整收尾（含 export event wiring）一次做，避免中途 partial graph 產生誤導性節點。

### 2026-09-02 — T0 Entry gate/scope freeze/preregistration

- **Stage scope**：使用者確認正式接受 WP-54 進入 stage11；同步更新 stage11 [README](../README.md)、[master checklist](../task-checklist.md)、[progress](../progress.md)（見該三檔 2026-09-02 條目）。
- **Repo state at T0**：HEAD `dc2a6b3abd9f79a113c73b4bb8326bd0c87e5041`（`test(wp-53): E2E acceptance for formal peek_click_transfer_v1 (T5)`）。Worktree 另有 WP-53 T-exit 遺留的 staged doc-sync 變更（`CONTEXT.md`、`docs/MAP.md`、`docs/exec-plan/README.md`、stage11 README/progress/task-checklist、wp-53 README/progress/task-checklist、`docs/operational/analysis-peek-click-transfer.md`）——與 WP-54 無關，本次未觸碰其內容，僅在同一批 stage11 master 檔案上疊加 WP-54 段落。
- **CodeGraph status**：索引健康（500 files indexed）。多個檔案（`src/metrics/trackingDerivation.ts`、`trackingTransitions.ts`、`submovement.ts`、`src/data/exportPayloadSchema.ts`、`export.ts`、`src/sim/TargetManager.ts`、`targetMotion.ts`、`src/results/ResultPresentation.ts`、`src/state/types.ts` 等）在查詢時顯示「pending sync（edited ~200ms ago）」，經 `git status --short` 對照確認皆為 0 diff（純 mtime touch，非實質變更）——本次 codegraph 讀取內容視為權威。graphify `GRAPH_REPORT.md` 最後提交時間與 HEAD 相同（2026-09-02T09:11:49+02:00），視為新鮮。
- **CodeGraph impact**（T1 前必讀，T1 實作時需重新確認 blast radius 未擴大）：
  - `TargetMotion`（`src/state/types.ts:145`）— 13 callers，含 `src/scene/clearance.ts`、`src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/sim/targetMotion.ts` 等，屬 cross-module。WP-54 新 trajectory kind 若要掛在 `TargetMotion` union 上，必須 additive（新 variant），不得改既有 variant 語意；若改走 §2.2 規劃的獨立 `trackingTrajectory.ts` 模組（不進 `TargetMotion` union），則此 blast radius 不適用，留待 T1 讀碼後定案並回寫本文件。
  - `motionOffset()`（`src/sim/targetMotion.ts:40`）— 3 callers，全在 `src/sim/TargetManager.ts` 內，屬 local-to-sim-module，非 cross-module。
  - Export schema（`src/data/exportPayloadSchema.ts` 的 `parseExportPayload`/`parseEvents`/`parseDrillEvent`；`src/data/export.ts` 的 `ExportPayload`/`buildExportPayload`/`serializeJSON`）— 新增 `target_motion_change` event 必須是 additive union member，並在 unknown event type 時 fail closed；不得改動既有 tick/event 解析路徑。
  - `deriveTrackingMetrics()`（`src/metrics/trackingDerivation.ts:117`）— 11 callers，含 `src/results/ResultPresentation.ts`、`src/metrics/holdClickMetrics.ts`、`src/testharness/fpsTestHarness.ts`；`options` 必須維持全 optional，新增行為不得改變既有呼叫方在省略 options 時的輸出。
  - `deriveTrackingTransitions()`（`src/metrics/trackingTransitions.ts:15`）— 3 callers，全在 `src/metrics/spiderShotMetrics.ts`（spider-shot 構念，與 WP-54 tracking pilot 無關但共用同一函數）——T3 若擴充此函數，必須確認 spider-shot 既有 regression 不受影響。
  - Result/history consumers：`src/history/DrillMetricRegistry.ts` 的 `REGISTRATIONS` 目前只有 `spiderShotV2` 與 `peekClickTransferV1` 兩筆註冊；`tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` **未註冊**於 `DrillMetricRegistry`/`HistoryTrend`。確認本 WP 的 pilot run 沒有既有 formal history/trend 路徑可誤入——與 §1.3 Constraints「pilot 資料不得自動進正式 Assessment history/trend」的既有事實一致，T0 不需要新增 guard 來阻擋一個原本就不存在的路徑。
- **Legacy tracking baseline（記錄用，非 gate）**：`npx vitest run` 對以下 11 個既有 tracking 相關檔案，103/103 全綠：`src/sim/targetMotion.test.ts`(12)、`src/sim/TargetManager.test.ts`(49)、`src/metrics/trackingDerivation.test.ts`(10)、`src/metrics/trackingTransitions.test.ts`(3)、`src/metrics/holdTrackWindowInvariant.test.ts`(1)、`tests/golden/research/epsilon-parity.test.ts`(1)、`tests/golden/research/promoted-curve.test.ts`(12)、`src/drill/tracking_v1.test.ts`(3)、`src/drill/tracking_longrange_v1.test.ts`(4)、`src/drill/tracking_br_v1.test.ts`(5)、`src/drill/tracking_scene_v1.test.ts`(3)。
- **Preregistration snapshot**：OQ-54-1~OQ-54-8 全數凍結（見下方 decision log D-54.1~D-54.8 與 README §1.4）；primary outcome、metric version、pilot protocol version 見 D-54.9~D-54.11。後續若需變更任一凍結值，必須以新 protocol/metric version 字串 + 本表新增 decision row 表達，不得原地覆寫本次凍結值。

### 2026-09-01 — Planning package

- 依使用者要求讀取 `.claude/skills/engineering-planning/SKILL.md`。
- 讀取原始 WP-54 proposal：[../wp-54-tracking-pilot-execution-plan.md](../wp-54-tracking-pilot-execution-plan.md)。
- 參照 WP-51 folder-style work package：[../../stage10/wp-51-m18-integration-and-acceptance/README.md](../../stage10/wp-51-m18-integration-and-acceptance/README.md) 與 [task-checklist.md](../../stage10/wp-51-m18-integration-and-acceptance/task-checklist.md)。
- 讀取 `AGENTS.md` 與 `graphify-out/GRAPH_REPORT.md`；確認 target/sim/export/metrics 屬 cross-module planning 熱區。
- 新增 WP-54 自足執行計畫、task checklist 與 progress log。
- 本次只新增 planning docs，未修改 production code，未執行 tests 或 `graphify update .`。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-54P.1 | WP-54 先以獨立 folder-style planning package 呈現，不直接改 stage11 master scope | 原始 proposal 已明確警告尚未納入 stage11；正式接受應由 T0 更新 master README/checklist/progress | Proposed |
| D-54P.2 | 保留 `tracking_v1` 作為 predictable baseline，新增 pilot-only trajectory/drill ids | 避免同一 drill id 表達不同 tracking construct 或污染既有 evidence | Proposed |
| D-54P.3 | Pilot evidence 先採 researcher HTML/JSON，不進正式 history/trend | Reliability/validity 未過 gate 前，產品化結果會製造錯誤精確感 | Proposed |
| D-54.1 | 正式接受 WP-54 進入 stage11 | 使用者於 T0 明確確認（見 verification log） | ✅ Confirmed |
| D-54.2（OQ-54-1） | Steady pursuit + reactive reversal 並列，分開報告，不合併成單一分數 | 使用者確認採用建議預設；符合 §2.5 metrics contract 已規定的分層報告原則 | ✅ Confirmed |
| D-54.3（OQ-54-2） | Core matrix `2.0/0.5 deg x 5/20 deg/s` 採為 T2 calibration candidate，非正式凍結值 | 與 README 原文一致：T7 依 floor/ceiling 證據決定 retained/revise/remove，T0 沒有真人資料可提前凍結 | ✅ Confirmed（as candidate） |
| D-54.4（OQ-54-3） | Scored block 長度 = 25 秒 | 建議預設；T7 Gate B 需檢查 time-on-task slope 是否需要調整區塊長度 | ✅ Confirmed |
| D-54.5（OQ-54-4） | Lag 搜尋範圍 `0–250 ms`；離線固定係數平滑（`smoothingVersion` 版本化）；週期性多峰回傳 `lag-peak-ambiguous`，禁止回傳單一 lag/gain 值 | 對齊 README §2.4 `TrackingDynamicsOptions`/`TrackingDynamicsResult` 既定 blocked reason 詞彙 | ✅ Confirmed |
| D-54.6（OQ-54-5） | Repeatability 最低門檻：condition-level RMS `epsilon` 的 ICC(A,1) point `>= 0.75`，95% CI 下界 `>= 0.60`，作為 M20/T8 pass-fail 依據 | 使用者確認採用建議預設 | ✅ Confirmed |
| D-54.7（OQ-54-6） | 真人招募：Gate B 12–20 人；Gate C 20–30 人，session 間隔 24–72 小時 | 建議預設；純招募/calendar 決策，不影響 T0–T5 程式範圍 | ✅ Confirmed |
| D-54.8（OQ-54-7 / OQ-54-8） | Evidence artifact 先做 researcher-only self-contained HTML + JSON，不進產品 Result UI；不做 tracking-specific SPARC，M20 後才另立提案 | 建議預設；與 stage11 「Researcher/pilot-only；不發布正式 Assessment」的交付定位一致 | ✅ Confirmed |
| D-54.9 | Primary outcome = 每 condition 合併 eligible pursuit ticks 的 `RMS(epsilon)`（deg） | 原始 WP-54 proposal 已預註冊；本次 T0 只是重申並鎖定，不重新評估 | ✅ Confirmed（承襲既有預註冊） |
| D-54.10 | Metric version = `tracking-dynamics-v1`；trajectory version = `band-limited-2d-v1`（pursuit）/ `reversal-2d-v1`（reactive） | 沿用 README §2.4 interface 命名，作為 T1/T3 實作時的版本字串來源 | ✅ Confirmed |
| D-54.11 | Pilot protocol version = `tracking-pilot-v1` | 沿用 README §2.4 `TrackingPilotManifest.protocolVersion` 命名 | ✅ Confirmed |
| D-54.12 | `reversal-2d-v1` 採「每個 leg 靜止到靜止」（v(leg start)=v(leg end)=0）的梯形/三角形速度剖面，而非「新 leg 沿用前一 leg 巡航速度做 ramp」 | 後者在 T1 test（bounds sweep）發現會越界（`-8.0148` vs `-8` 下界）——leg 邊界殘留速度仍指向舊方向，ramp 前段先繼續衝向牆才回頭；前者讓邊界安全變成解析可證的建構期保證，不需 runtime clamp，`changes` 語意改為「前一穩態巡航速度 → 本 leg 穩態巡航速度」而非「瞬時速度」（leg 邊界瞬時速度恆為 0） | ✅ Confirmed（T1 slice 1/2，2026-09-02） |
| D-54.13 | P1 對 `trackingDerivation.ts` 採 shallow-copy adapter（`adaptPayloadForScoredWindow()`）而非修改該檔 | README §2.2 只列 `trackingDerivation.test.ts` 為 MODIFY/ADD,未列實作檔——暗示實作檔應保持不動；11 個既有 caller（`ResultPresentation.ts`/`holdClickMetrics.ts` 等）與兩個 golden fixture test（`epsilon-parity`/`promoted-curve`）的 blast radius 因此維持 0 | ✅ Confirmed（T3,2026-09-02） |
| D-54.14 | Reversal event windows（response latency/peak error/overshoot/settling time,FR-54-9）落在新 export `deriveTrackingReversalWindows()`,不塞進 `TrackingDynamicsResult` | README §2.4 的 `TrackingDynamicsResult` 介面是逐字凍結契約,任務指示「copy verbatim,不重新設計」——該介面本就沒有 reversal 專屬欄位；FR-54-9/checklist/§2.5「P1 reactive」列仍要求此分析,故另開一個 additive function 滿足需求而不違反凍結契約 | ✅ Confirmed（T3,2026-09-02） |
| D-54.15 | `deriveTrackingReversalWindows()` 的「run 尾端可用窗長」改用 `min(presentation.windowEndMs, 最後一筆 sample 的 t)` 而非直接用 `presentation.windowEndMs` | 單目標 run（WP-54 pilot block 常態）沒有後續 `visible` event,`windowEndMs` 恆為 `Infinity`——若不夾住,run 尾端的 change event 會被誤判為「窗長足夠」而不觸發 `insufficient-window-data` 排除；fixture 首次執行時即抓到此 bug（`expected false to be true`,`windows[2].excluded` 未被標記為排除），修正後全綠 | ✅ Confirmed（T3,2026-09-02） |
| D-54.16 | Lag ambiguity 預設 `correlationAmbiguityRatio = 2`（次高峰需 `<=` 最高峰的一半才不算 ambiguous） | README/D-54.5 只凍結 `[0,250]ms` 搜尋範圍與「多峰必須 blocked」這個閘門本身存在,未凍結比例門檻數值；`2` 是 truth-fixture 套件用的預設值,足以清楚分辨「單一乾淨峰值」（band-limited pursuit,次高峰通常遠低於一半）與「純週期訊號」（次高峰幾乎等於最高峰,比例≈1）兩種案例,標記為 T6/T7 校準候選,非正式凍結值 | ✅ Confirmed（T3,2026-09-02,as default/candidate） |
| D-54.22 | `TrackingPilotEvidence`/`buildTrackingPilotEvidence()` 追加 opt-in `options.includeTrace`/`run.trace`（ε(t) 逐 tick 樣本序列），預設 `false` | HTML report 的「target/aim trace」要求（checklist T4）需要逐 tick 資料，但 evidence JSON 預設應保持精簡（真實 pilot run 動輒數千 tick，多數 evidence 消費者如 T6-T8 gate 不需要逐 tick），opt-in 讓 HTML report 產生時可以拿到與其餘欄位同一個 evidence 物件（parity-by-construction 前提），不需要另開一條資料路徑 | ✅ Confirmed（T4 slice 4/6，2026-09-02） |
| D-54.23 | `TrackingPilotBlock = {drillId, seedFamily}`，刻意不存 `role`；`role` 一律由 `trackingPilotBlockRole(drillId)` 查一個 single-source registry 推導 | README §2.4 從未定義 `TrackingPilotBlock`，T5 要自己設計；把 role 存進 block 會讓一份損毀/手改的 manifest 能宣稱一個與實際 drill 不符的 role，`parseTrackingPilotManifest()` 也就無法把這種不一致當非法輸入擋下（checklist「seed 家族衝突」fail-fast 要求的精神延伸） | ✅ Confirmed（T5 slice 1/5，2026-09-02） |
| D-54.24 | Counterbalance 排序重用 WP-41 `sessionSchedule.ts` 既有的 `buildFamilyOrderForRoster()`（cyclic Latin-square 輪轉），不另寫 shuffle；`generatedFromCounterbalanceCell` 寫成 `` `${protocolVersion}:${participantId}:session-${sessionIndex}` ``（純輸入的函式，不嘗試反推內部雜湊輪轉量） | 任務交辦第 4 點明文要求「不得重新發明已有的排程/state machine 慣例」；`buildFamilyOrderForRoster` 已有自己的測試覆蓋且是這個確切問題（把一組已知 id 決定性、位置平衡地排序）的既有解法。Cell 標籤本身已是輸入的純函式，滿足「同一輸入重跑必須排出同一個 order/seed」，不需要額外編碼排序演算法內部狀態 | ✅ Confirmed（T5 slice 1/5，2026-09-02） |
| D-54.25 | Session 1 對 scored block 的 alternate seed family 用 `+10000` offset（primary seed + 10000），practice/calibration 永遠用 primary seed | 供 T8「alternate-seed equivalence」分析；10000 遠離 WP-54 自己的 54000/54100 seed 家族與其他既有 WP 的 seed 範圍（18018/23002/94000s/95000s/pilot 90000s），不會與任何字面 seed 常數碰撞；practice/calibration 是診斷用途、非資料承載量測，重跑同一軌跡沒有分析意義，故不隨 session 改變 | ✅ Confirmed（T5 slice 1/5，2026-09-02） |
| D-54.26 | `TrackingPilotRunner` 的 phase state machine 結構比照 `SessionRunner.ts`（`loadDrillConfig`/`onStatus`/`onPhaseChange` 注入 + transition queue），不比照 `ProtocolRunner.ts` | T2 讀碼筆記（見上方「T2 CodeGraph discovery + landing-point design」條目）已經判定 `ProtocolRunner` 的粒度是整個 drill+scene+resolution 條件切換，WP-54 manifest 內的 practice→scored→rest 相位是單一 manifest run 內部語意，與 `SessionRunner` 的 family→rest→family 精神一致（只是排程單位從 family 換成 block）；block 用 resolved `DrillConfig`（非 drillId 字串）載入，因為 session 1 的 scored block 可能是 alternate-seed clone，未在任何 `availableDrills` 之類的表格用自己的 drillId 註冊過 | ✅ Confirmed（T5 slice 2/5，2026-09-02） |
| D-54.27 | Operator screen（`TrackingPilotOperatorScreen.ts`）+ 一個 dev-only harness（`trackingPilotOperatorHarness.ts`/`tracking-pilot-harness.html`）驗證鍵盤流程，但**不**把 runner 接進 `main.ts` 正式 app 或找真人操作；harness 的 `loadDrillConfig`/`exportBlock` 是 fake stub | README §4 T6「Instrumentation pilot」明文是「3-5 位內部/熟練 tester，每條件至少 2 次」真人真實跑的範圍——把 T5 的 runner 接進 `main.ts` 讀真實 `DrillConfig`、寫真實 `ExportPayload`，是 T6 的前置工作而非 T5 checklist 任何一項的字面要求（T5 六個 bullet 只要求 manifest/runner/操作端顯示/記錄/replay/鍵盤走查，未要求「wire into main.ts」）；T5 只需證明 operator screen 機制本身（鍵盤可達性、狀態文字化、quality abort 顯示）成立，真人真實跑留給 T6 用真正的 `main.ts` 整合路徑 | ✅ Confirmed（T5 slice 3-4/5，2026-09-02） |
| D-54.28 | T5「focused automated a11y test + 人工走查紀錄」用一支真實瀏覽器 Playwright e2e spec（`tests/e2e/tracking-pilot-operator.spec.ts`，全程 `.focus()`/`page.keyboard.press()`）滿足，不額外要求使用者親自用滑鼠/鍵盤操作一次 | 比照本專案既有 `stage10-accessibility.spec.ts`（WP-51 T4）的既定慣例——該 spec 標題本身就是「keyboard-only ... and automated accessibility gates」，本專案已把這類真實瀏覽器 keyboard-only Playwright walkthrough 當作正式的自動化 a11y/keyboard 證據；不同於 WP-52 T4 manual gate 那種需要「真實人類資料品質」判斷的場合（那裡人工走查在判斷資料是否可信，不是純 UI 可達性），operator screen 的鍵盤可達性/文字化狀態是可以窮舉斷言的機械性質，Playwright 的斷言覆蓋面不亞於一次人工操作 | ✅ Confirmed（T5 slice 4/5，2026-09-02） |
| D-54.20 | `buildTrackingPilotEvidence()` 不吃 README §2.4 鎖定簽名的 `manifest: TrackingPilotManifest` 參數，只吃 `payloads: readonly ExportPayload[]` | `TrackingPilotManifest`/`TrackingPilotBlock` 是 T5 尚未開工的型別（README 從未定義後者）；FR-54-11 要求的 condition/n/duration/quality/seed 已能從 `payload.meta`（`drillId`/`spawn.trackingTrajectory.seed`）單一來源完整推導,不需要 manifest 才能分組。同 D-54.13/14 精神：介面契約遇到尚不存在的上游型別時,以讀碼後實況為準,偏離處記帳而非空等或代造 T5 型別 | ✅ Confirmed（T4 slice 3/6，2026-09-02） |
| D-54.21 | Evidence pipeline 預設 `smoothingVersion='tracking-dynamics-smoothing-v1-tri3'`（而非 T3 truth-fixture 測試用的 `-none`）；`minValidTicks=32`、reversal window 四參數（300/500/200/0.5ms/deg）沿用 T3 測試數值,標記為 T4 pipeline 預設而非新協定凍結,全部可經 `options` 覆寫 | 真實人類 pilot 資料有雜訊,套平滑對 lag 搜尋更穩健,合成 truth fixture 才需要 `-none` 保精確；`minValidTicks=32` 恰為 `lagSearchMs` 上界 250ms@128Hz 的 tick 數,非隨意值；其餘四個 reversal 參數目前唯一可考的來源是 T3 測試本身用的值,尚無 T6/T7 校準證據前先延用 | ✅ Confirmed（T4 slice 3/6，2026-09-02，as pipeline default/candidate） |
| D-54.18 | Run-level `TrackingQualityReason`（T4）收斂為 8 個 kebab-case reason code，且刻意與 T3 `TrackingDynamicsResult` 的 5 個 metric-level blocked reason 使用不同字串（例如 `missing-target-position` vs `missing-target-telemetry`） | FR-54-10 五大類別（overflow/missing target/timestamp/coverage/protocol mismatch）需要具體、封閉、one-shot 定案的字串；兩層 blocked 語意若共用相近字面會讓消費者誤以為是同一件事，README §2.4 本就把兩者定義成不同型別（`TrackingRunEligibility` vs `TrackingDynamicsResult`） | ✅ Confirmed（T4 slice 1/6，2026-09-02） |
| D-54.19 | `T4` 新檔落在 `src/pilot/` 目錄下多個檔案（`trackingRunEligibility.ts` 起頭，compatibility key/evidence/report 陸續加入），而非全部塞進 README §2.2 規劃的單一 `trackingPilotEvidence.ts` | README §2.2 只是 T0 時期的落點候選，T4 實際範圍（run-level eligibility + WP-54 專屬 compatibility key + JSON evidence model + 自足 HTML report）遠比 WP-52 `peekClickTransferPilotEvidence.ts`（81 行純聚合）大；拆檔維持單一職責、可個別測試，同目錄慣例（`src/pilot/`）不變 | ✅ Confirmed（T4 slice 1/6，2026-09-02） |
| D-54.17 | Smoothing kernel 版本化為封閉字串表（`tracking-dynamics-smoothing-v1-none` identity / `tracking-dynamics-smoothing-v1-tri3` 對稱三點三角 FIR),未知字串 fail fast | D-54.5 要求「離線固定係數平滑,`smoothingVersion` 版本化」——用封閉 registry + fail-fast 而非允許任意係數陣列,對齊本專案既有「未知 version/kind 必須 fail fast」紀律（`trackingTrajectory.ts` 前例);truth fixture 預設用 `-none`（保持結果可精確追溯到合成訊號本身,不被平滑掩蓋),另加一個 `-tri3` 案例證明有實際套用平滑且不崩潰 | ✅ Confirmed（T3,2026-09-02） |

| D-54.29 | main.ts 新增「直接吃已解析 `DrillConfig` 物件」的載入路徑（把 `loadDrillById()` 主體抽成共用 `activateDrill()`，再加一個薄的 `loadDrillConfigDirect()`），**不**把 9 個 pilot block（更不含 session-1 的 alternate-seed 變體）預先展開成 `availableDrills` 條目 | 任務交辦第 5 點的取捨題。展開成 availableDrills 的方案有兩個硬傷：(1) alternate-seed clone 的 `meta.drillId` 與 primary 完全相同,若在下拉選單各給一條就會出現兩個同名 id（或必須捏造一個從未進 export 的假 id）,選單標籤等於在說謊;(2) D-54.26 已明文「block 用 resolved `DrillConfig` 載入,因為 alternate-seed clone 未在任何 `availableDrills` 表格註冊過」——預先展開等於推翻 T5 已凍結的載入契約。抽取 `activateDrill()` 對既有 `loadDrillById()` 行為逐位不變（唯一差異:`controls?.setSelectedDrill()` 改為僅在「有註冊 id」時呼叫,而既有呼叫端一律有 id）,pilot 路徑則沿用同一條 clearance/TargetManager/SimLoop/recorder 重建鏈路,不另開第二條載入語意。場景固定釘在 `field-low`（pilot block 的 clearance envelope 就是對 field-low 驗的,見 `tracking_core_pr_pilot_v1.test.ts`）,理由同每個綁場景的既有 availableDrills 條目 | ✅ Confirmed（T6 slice 1，2026-09-03） |
| D-54.30 | Operator screen 掛成**研究員選單第 4 個入口**（`ResearcherMenu` 的 `Tracking pilot` 按鈕），不掛成「單一 Drill 調整」下拉選單的一個 drill；且**不**走 `openSessionSetup()` 的 SessionSetup→EligibilityGate 路徑 | tracking pilot 是 manifest 驅動、自帶 participant/session/rest 表單與 9 個 block 排程的 researcher session,語意與同一選單裡的「解析度 protocol」/「BR protocol」同層,而不是一個可單獨挑來玩的 drill——WP-52 T4 之所以用下拉選單,是因為它註冊的就是「普通 drill」,沒有自己的 operator 畫面（precedent 適用範圍不同,不是被推翻）。不走 eligibility gate:該 gate 的 QHD 門檻是為「受試者內解析度操弄」的研究效度存在（GD-10）,WP-54 不操弄解析度（Session Plan 同理已改用 `SESSION_PLAN_MIN_CONDITION`）;沿用「單一 Drill 調整」那條「研究員選單直接開啟」的既有分支,不替 WP-54 發明新的 gate 需求（`crossOriginIsolated`/frame p95 等效度事實仍照既有路徑寫進 `meta`,可事後稽核） | ✅ Confirmed（T6 slice 1，2026-09-03） |
| D-54.31 | `exportBlock` 直接重用 main.ts 既有的 `buildCurrentExportPayload()`（不另開匯出組裝路徑）；participant/manifest 追溯改用既有 `meta.session = {participantId, sessionLabel}` 欄位承載,`sessionLabel` 放 `generatedFromCounterbalanceCell` | 任務交辦第 6 點明文要求重用既有 export 組裝邏輯。追溯欄位若新增 schema 欄位就會動到 `Meta`/`exportPayloadSchema` 與所有既有 reader（additive 也要付 parse/serialize/round-trip 代價）,而 `meta.session` 的語意本來就是「這份 run 屬於哪個受試者/哪一場 session」,counterbalance cell 字串本身已是 `protocolVersion:participantId:session-N` 的純函式（D-54.24）,放進 `sessionLabel` 即可完整重建 manifest。副作用記帳:`exportBlock()` 會讓同一個 block 在 drill 結束時組裝兩份 payload（既有 Result/history 路徑一份、pilot 匯出一份）——`recorder.snapshot()` 是唯讀且冪等,兩份逐位相同,且組裝落在 run 結束後的非熱路徑（T4 benchmark:單次 ~23ms 冷/~8ms 暖）,不值得為此改動 T5 的 `exportBlock` 契約 | ✅ Confirmed（T6 slice 1，2026-09-03） |
| D-54.32 | Operator overlay 在 `phase.kind === 'running'` 期間 `close()` 讓位、其餘 phase 自動 `open()`；drill 走到 `ended` 時由 main.ts 呼叫 `handleDrillEnded()` 自動 `completeCurrentBlock()`（不要求操作員在跑動中按 Complete） | `TrackingPilotOperatorScreen` 的 `overlayCss` 是 `inset:0` 全視窗 scrim（不透明度 0.82）,不讓位的話受測者根本看不到目標。極性與 main.ts 既有的 `restOverlay` 完全對稱（`SessionRunner` 的 `onPhaseChange` 在 rest 顯示、play 隱藏;pilot 的 rest 倒數本來就長在 operator screen 裡,所以極性相反）。**已知缺口（additive,不影響已交付契約）**:overlay 讓位期間操作員按不到 `Abort block`;等效處置是讓 block 跑完後在 block-outcome 面板按 `Retry block` 並填理由——retry 是 append-only、原 attempt 的 export 與理由都留在 `records`/`retryLog`,可稽核性不低於 abort（abort 反而不留 payload）。若真人試跑回報需要跑動中中止,再依 runbook「遺留缺口」條目做 additive 補強 | ✅ Confirmed（T6 slice 1，2026-09-03） |
| D-54.33 | `src/pilot/trackingPilotOperatorHarness.ts` / `tracking-pilot-harness.html` 保留為 dev-only smoke harness，不因正式接線完成而刪除 | 任務交辦第 8 點的判斷題。兩者測的不是同一件事:harness 用 fake `loadDrillConfig`/`exportBlock` 讓 `tests/e2e/tracking-pilot-operator.spec.ts` 能在**秒級**走完 9 個 block 的鍵盤/狀態流程（D-54.28 採認的 a11y 證據形式）,正式路徑一個 block 就是 25 秒真實 sim,不可能拿來當 a11y 迴歸閘。harness 從未被 `src/main.ts` import（不進 production bundle）,維護成本≈0;刪掉會直接讓 T5 的 a11y 證據失去可重跑載體 | ✅ Confirmed（T6 slice 1，2026-09-03） |

| D-54.34 | practice block 的真實匯出**確實**帶一個 `scored_start` event（`TargetManager` 在 `age >= trackingPrepSec` 就蓋 `tScoredStart`，practice 無 `trackingPrepMs` ⇒ `trackingPrepSec = 0` ⇒ 第一個 motion tick 就蓋）；判定為**不改 producer**，而把「practice 不入 scored aggregation」的保證明確落在 aggregation 端（見 D-54.36，T6 slice 3） | T6 slice 2 的真實匯出檢查發現：T2 drill 檔註解寫「practice…no scored window」,但 producer 對任何 `trackingTrajectory` drill 一律蓋戳。改 producer（只在 `trackingPrepMs !== undefined` 才蓋）會動到 `src/sim` 的決定性熱路徑與既有 T2 測試,而 producer 現行語意其實自洽（`scored_start` = trajectory age 原點,practice 的原點就是第 1 tick,可稽核不說謊）;FR-54-5 的驗收句是「practice **不寫入 scored aggregation**」——這是 aggregation 端的保證,不是「不得存在該事件」。故 producer 保持逐位不變,保證改由 D-54.36 落地。真實觀測值已寫進 `tracking-pilot-live.spec.ts` 斷言（1 個 event）與註解,不再是隱性行為 | ✅ Confirmed（T6 slice 2，2026-09-03） |
| D-54.35 | main.ts 的 tracking pilot 入口在 app boot 完成前不再靜默 no-op：建構點前移至研究員選單之後 + 新增 `appBooted` boot-barrier promise（pilot `loadDrillConfig` 先 await 它） | T6 slice 2 的真瀏覽器 walkthrough 實測到:boot 視窗內按 Start manifest 會拿到 `Cannot access 'resultShown' before initialization`（module-level `let` 仍在 TDZ）。KI-013 的 `?.` 靜默 no-op 對 `controls` 那種被動同步可以接受,對一個研究員主入口按鈕就是「按了沒反應」或更糟的內部錯誤字串。barrier 只影響 pilot 這條新路徑（既有 `loadDrillById`/protocol/Session Plan 路徑逐字不變）,且不引入輪詢或計時器 | ✅ Confirmed（T6 slice 2，2026-09-03） |

| D-54.36 | 「practice 不寫入 scored aggregation」（FR-54-5）落在 `buildTrackingPilotEvidence()`：以 `isTrackingPilotPracticeDrillId()` 按 role 濾掉 practice payload，並以 `excludedPracticeRunCount` 明示丟了幾份；**不**改 `TargetManager` 的 `scored_start` 產生條件 | 見 D-54.34：producer 端語意自洽且位於 `src/sim` 決定性熱路徑，改它要付既有 T2 測試與逐 tick 決定性的代價,而 FR-54-5 的驗收句本來就是 aggregation 端的保證。選 role-based 而非「無 scored_start」判準,因為後者對 practice 恆為假（practice 有 scored_start）;選 `KNOWN_BLOCK_ROLES` 當唯一來源而非在 evidence 端再列一份 drillId 白名單,沿用 D-54.23「role 一律由 drillId 查單一 registry 推導」的既有紀律。probe 刻意 non-throwing（與 manifest 驗證器的 fail-fast 相反）:evidence 聚合器可能收到 WP-54 registry 以外的 payload,那不是非法輸入,只是「不是 practice」 | ✅ Confirmed（T6 slice 3，2026-09-03） |

| D-54.37 | T6 的真人資料分析一律走 committed 的 `scripts/analyze-tracking-pilot.ts`（`npx vite-node`），不寫一次性腳本、也不把分析寫成測試 | T6/T7/T8 的 gate 結論必須能從同一批輸入重新產生（T8 checklist 明文要求「analysis script 版本化且可重跑」，T6 提前採用）。用既有實作跑而非重寫一套，符合 C-D4「既有構念不得有第二定義」;不放進 vitest 是因為它依賴 repo 外的 participant 資料，放進去會讓 CI 需要不存在的檔案。腳本本身輸出到 `.pilot-analysis/`（已 gitignore），participant payload 與衍生 artifact 都不進 git | ✅ Confirmed（T6 slice 5，2026-09-03） |
| D-54.38 | KI-020（core matrix 未交付 size/speed 操弄）**不由實作端自行修**，只交付診斷 + 量化證據 + 選項，並以 Gate A = revise 結案 | 兩個修法都要改動 T0 預註冊的 candidate 參數（OQ-54-2）與 README 風險表用語，屬研究決策;實作端單方面選一個，會讓 T7 的 floor/ceiling 校準建立在未經研究者確認的刺激上。配套的建構期一致性守衛（`speedScale > boundScale` 即 fail fast）刻意不先落地——現行四個 cell 會因此在載入時全部 throw，守衛必須與再參數化同批進來（同 KI-019 §5 的理由） | ✅ Confirmed（T6 slice 8，2026-09-03） |
| D-54.39 | Gate A 判 **revise** 而非 stop；並明確記錄「份量不足（1 人 × 1 場）不是判 revise 的原因」 | 三個缺陷都是可修的 instrumentation/config 問題（其中 2 個已修），不是「量測效度無法在 WP-54 範圍內補救」的 stop 條件（gate 文件 §9 的判準）。分開記錄原因是為了防止後續 task 誤讀成「再多收幾個人就能過」——README §5 明文禁止用增加樣本數掩蓋 Gate A 失敗，而這裡真正的阻塞是刺激不符預註冊操弄 | ✅ Confirmed（T6 slice 8，2026-09-03） |

| D-54.40 | ~~KI-020 的目標角尺寸用 **cube（`shape:'box'`）** 而非 sphere~~ **（2026-09-03 由 D-54.42 取代：改回 sphere，前置為 KI-021）** | sphere 在各方向等向，理論上更貼合「角尺寸」語意；但 WP-55 的 exact-hitbox contact derivation 目前只接受 box（`src/metrics/trackingContact.ts:147`），改成 sphere 會讓 WP-54 這批 drill 直接被其 coverage report 排除——實測使用者並行開發的 WP-55 T3 測試因此轉紅（`includedRunCount` 2→0）。cube 在 yaw/pitch 兩軸（tracking error 的分解軸）上逐值等於候選角尺寸，代價僅是對角方向 on-target 容許角最多大 √2 倍；不值得為此打斷另一個 WP 的進行中工作。要改用 sphere 應與 contact 側的 sphere 支援同批進行（記於 KI-020 §6.2） | ⚠️ Superseded by D-54.42（2026-09-03）——當時的取捨在「不打斷 WP-55 進行中工作」上成立，但追查後發現 box-only 限制的根因是 KI-021（實作違反 GD-7/CONTEXT.md §23），cube 只是繞過該裂縫 |
| D-54.41 | `TrackingCompatibilityKey` 的 `sizeDeg` 更名為 `travelAmplitudeDeg`，新增 `targetHitboxWidthU` 與 `displayRefreshHz` | KI-020 之後「size」與「amplitude」是兩件不同的事，舊欄位名（讀的是 `yawBoundDeg`）會讓 cohort 分析誤以為自己按尺寸分組。尺寸軸以 source unit 表達而非角度，因為 `Meta` 不記錄目標距離——WP-54 內所有 block 共用 4u 視線故為忠實代理，且 `drillId` 已釘住條件。`displayRefreshHz` 來自使用者對 OQ-54-11 的決定（接受 60Hz 但刷新率必須分開 cohort），四捨五入到整數 Hz 以免量測抖動（59.98 vs 60.02）拆散同一面板的 cohort | ✅ Confirmed（T6 slice 11，2026-09-03） |

| D-54.42 | WP-54 的 pilot 目標 hitbox **改回 `shape:'sphere'`**（取代 D-54.40 的 cube），但前置為 [KI-021](../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md) 落地，且**必須在 9-block 重跑之前**完成 | 使用者 2026-09-03 要求。sphere 讓角尺寸各方向等向，才真正符合「angular size」語意（cube 在對角方向的 on-target 容許角大 √2 倍）。**前置條件不可跳過**：`trackingDerivation.isOnTarget()` 目前是 ray/AABB 且 `hitboxFromMeta()` 丟掉 `shape`，所以現在改 config 只會讓 pilot drill 被 WP-55 的 `'invalid-hitbox'` 閘門整份排除，或（若只放寬閘門）被當成 box 靜默算出偏寬鬆的 on-target——後者比現況更糟。**排序硬約束**：on-target 幾何一改，TOT/`tAcquireMs`/drop-reacquire 語意就變；若在重跑後才改，兩批真人資料不可合併、等於再作廢一次。跨 WP 面（含 `spider-shot-v2` 這個正式 Assessment drill 也受 KI-021 影響）記於 [DECISIONS.md GD-30](../../DECISIONS.md) | ✅ Confirmed（2026-09-03 落地，T6 slice 12）——KI-021 三片依序完成後改 config：`trackingPilotAngularSizeToEdgeU`→`trackingPilotAngularSizeToDiameterU`、`cubeHitbox()`→`sphereHitbox()`、兩檔皆 `shape:'sphere'`（`widthU` 逐位不變，故 e2e 的 0.13964 斷言不動）。**已在 9-block 重跑之前落地**，排序約束滿足 |

## Open Questions

全部 OQ-54-1~OQ-54-8 已於 T0（2026-09-02）凍結，詳見上方 decision log D-54.2~D-54.8 與 [README §1.4](README.md)。OQ-54-2 標記為 calibration candidate（非 hard freeze），其餘視為凍結值；後續變更一律走新 protocol/metric version + 本表新 decision row。

- **OQ-54-9（T4 slice 2/6，未與使用者確認）**：NFR-54-7 compatibility key 的 `inputMode` 欄位語意
  未在 README/checklist 進一步定義。目前實作讀 `meta.mouseIntegration?.model`（見上方 Progress 條目
  的理由）。若之後（T5/T6+）出現真的需要區分的 input 維度（例如 keyboard-only walkthrough vs 一般
  操作、或不同滑鼠回報率的分層），需要重新檢視這個欄位是否足夠，並以新 decision row 記錄變更（additive，
  不影響已收集資料）。

- **OQ-54-10（T6 slice 4，未與使用者確認）**：pilot 匯出的 `meta` 沒有 rest 秒數欄位——
  `collectMeta` 的 `sessionPlanRestSeconds` 只在 `sessionPlanRunner.phase.kind === 'family'` 時寫入，
  tracking pilot 走的是自己的 runner。目前以「操作員手動記錄」補（gate 文件 §7）。若 T7/T8 需要把
  rest 當可分析變數（例如 time-on-task slope 分析要控制休息長度），再考慮 additive schema 欄位或
  把 pilot 的 rest 一併寫進 `meta.session`；不在 T6 動 schema。

- **OQ-54-11（T6 slice 8 提出，slice 11 已決）✅**：使用者決定「接受 60Hz，並把刷新率加進 compatibility key」（見 D-54.41）。以下為原始問題敘述——：本次 9 份真人資料全部帶 `meta.suspect: true` /
  `validity.perfFloor: true`——不是掉 tick（覆蓋率 ≈100%），而是 `PERF_FLOOR_MS = 8.33`（120Hz 級，
  GD-10 為解析度/偵測研究設定）對上 60Hz 面板的 `frames.p95 ≈ 16.8ms`。`evaluateTrackingRunEligibility()`
  目前不看 `suspect`，所以 run 仍判 eligible。待決：(a) tracking pilot 接受 60Hz（並考慮把顯示刷新率
  加進 NFR-54-7 compatibility key——目前沒有這個維度，等於不同刷新率的資料會混進同一 cohort）／
  (b) 要求 ≥120Hz 重跑。

## Verification log

| Date | Command / action | Result |
|---|---|---|
| 2026-09-01 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-09-01 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules loaded |
| 2026-09-01 | Read WP-54 proposal and WP-51 README/checklist/T files | planning format and scope source loaded |
| 2026-09-01 | Documentation edit only | no production code changed; no tests run |
| 2026-09-02 | `AskUserQuestion`：WP-54 stage scope、OQ-54-1、OQ-54-5 | 使用者確認：正式接受 WP-54 進入 stage11；OQ-54-1 = Steady+Reactive 並列；OQ-54-5 = 採用建議預設門檻 |
| 2026-09-02 | `git status --short` / `git rev-parse HEAD` | HEAD `dc2a6b3`；worktree 另有 WP-53 T-exit 遺留 staged doc-sync（與 WP-54 無關，未觸碰其內容） |
| 2026-09-02 | `mcp__codegraph__codegraph_explore`（`TargetMotion`/`motionOffset`/`TargetManager`/export schema/`deriveTrackingMetrics`/`deriveTrackingTransitions`） | blast radius 記錄於上方 Progress 段落；「pending sync」檔案經 `git status --short` 對照為 0 diff（純 mtime touch） |
| 2026-09-02 | `mcp__codegraph__codegraph_explore`（`DrillMetricRegistry`/`HistoryTrend`/`compatibilityKey`/tracking drill ids） | 確認 `tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` 未註冊於 `DrillMetricRegistry`，無既有 formal history/trend 路徑 |
| 2026-09-02 | `git log -1 --format=%cI -- graphify-out/GRAPH_REPORT.md` vs `git log -1 --format=%cI HEAD` | 兩者時間戳相同（2026-09-02T09:11:49+02:00），graphify 視為新鮮 |
| 2026-09-02 | `npx vitest run`（11 個既有 tracking 相關檔案，見上方 Progress「Legacy tracking baseline」） | 103/103 tests passed，記錄為 baseline，非 gate |
| 2026-09-02 | T1 slice 1/2：`npx vitest run src/sim/trackingTrajectory.test.ts` | 30/30 passed（首次執行 4 個 reversal 相關測試失敗，觸發 D-54.12 返工，改版後全綠） |
| 2026-09-02 | T1 slice 1/2：`npx tsc --noEmit` | exit 0 |
| 2026-09-02 | T1 slice 1/2：`npx vitest run`（全專案） | 191 files / 1755 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T1 slice 2/2：`npx vitest run src/data/exportPayloadSchema.test.ts src/sim/trackingTrajectory.test.ts` | 84/84 passed |
| 2026-09-02 | T1 slice 2/2：`npx tsc --noEmit` | exit 0（`DrillEvent` 61 callers 未受 additive union 影響） |
| 2026-09-02 | T1 slice 2/2：`npx vitest run`（全專案） | 191 files / 1766 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T1 slice 2/2：`graphify update .` / `codegraph sync .` | graph 重建（3884 nodes/9158 edges/240 communities）；codegraph 索引已最新 |
| 2026-09-02 | T3：`npx tsc --noEmit` | exit 0 |
| 2026-09-02 | T3：`npx vitest run src/metrics/trackingDynamics.test.ts` | 19/19 passed（首次執行 5 個失敗：靜態目標令 target omega 恆為 0、退化成 `lag-peak-ambiguous`；400-tick 視窗令 fixed-lag 誤差達 5 tick；`windowEndMs=Infinity` 未被真實資料夾住令 reversal-window 的 run-尾端排除失效——三者修正後全綠，詳見 D-54.15 與上方 fixture 說明） |
| 2026-09-02 | T3：`npx vitest run`（全專案） | 194 files / 1844 tests passed（2 skipped），對照 T2 slice 6 的 193/1825 baseline，無回歸 |
| 2026-09-02 | T5 slice 1/5：`npx vitest run src/session/trackingPilotManifest.test.ts` | 27/27 passed |
| 2026-09-02 | T5 slice 1/5：`npx tsc --noEmit` / `npx vitest run`（全專案） | exit 0；200 files / 1911 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T5 slice 2/5：`npx vitest run src/session/TrackingPilotRunner.test.ts` | 11/11 passed |
| 2026-09-02 | T5 slice 2/5：`npx tsc --noEmit` / `npx vitest run`（全專案） | exit 0；201 files / 1922 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T5 slice 3/5：`npx vitest run src/ui/TrackingPilotOperatorScreen.test.ts` | 14/14 passed |
| 2026-09-02 | T5 slice 3/5：`npx tsc --noEmit` / `npx vitest run`（全專案） | exit 0；202 files / 1936 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T5 slice 4/5：`npx playwright test tests/e2e/tracking-pilot-operator.spec.ts --project=edge` | 首次執行失敗（`blockText` 隱藏期間殘留上一個 block 的舊文字，substring 斷言假陽性通過等待邏輯，見上方 slice 4 條目）；改用 `toBeVisible()` 後 1/1 passed（5.2s） |
| 2026-09-02 | T5 slice 4/5：`npx vitest run src/ui/TrackingPilotOperatorScreen.test.ts` | 15/15 passed（新增 1 個 a11y 回歸測試） |
| 2026-09-02 | T5 slice 4/5：`npx tsc --noEmit` / `npx vitest run`（全專案） | exit 0；202 files / 1937 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T5 slice 5/5：`npx tsc --noEmit` / `npx vitest run`（全專案，收尾確認） | exit 0；202 files / 1937 tests passed（2 skipped），對照 T4 收尾 199/1884 baseline，無回歸 |
| 2026-09-02 | T5 slice 5/5：`graphify update .` / `codegraph sync .` | graph 重建（4021 nodes/9529 edges/256 communities，對照 T4 收尾 3981/9450/250）；codegraph 索引已最新 |

