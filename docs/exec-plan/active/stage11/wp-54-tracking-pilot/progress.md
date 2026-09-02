# WP-54 — Progress / Decision Log

## Status

- **Current**：✅ T0、T1 完成（2026-09-02）；T2（pilot drill matrix/protocol guards）待開工。
- **Scope state**：已正式納入 stage11（見 [../README.md](../README.md)、[../task-checklist.md](../task-checklist.md)、[../progress.md](../progress.md)）。M20 為本 WP 里程碑。
- **Dependency state**：`tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` baseline 綠燈（見下方 verification log）；OQ-54-1~OQ-54-8 全數凍結（見 §1.4 與下方 decision log）。

## Progress

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

## Open Questions

全部 OQ-54-1~OQ-54-8 已於 T0（2026-09-02）凍結，詳見上方 decision log D-54.2~D-54.8 與 [README §1.4](README.md)。OQ-54-2 標記為 calibration candidate（非 hard freeze），其餘視為凍結值；後續變更一律走新 protocol/metric version + 本表新 decision row。

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

