# WP-66 — Progress

> Tech spec：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)
>
> 每個 task 完成時更新本檔（Progress / Decision Log / Surprises / Open Questions），與程式切片一起 stage（協議 §3.4）。

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 | ✅ 完成 | 2026-09-12 | 見 [§T0](#t0--entry-gate2026-09-12)。編號重查四處來源已記錄（**WP-66 / GD-42 仍可用，未順延**；stage14 §3 已補順延註記）；基線於 `9a03562` 凍結（typecheck exit 0 · Vitest **3128 passed / 2 skipped** · regression **319 passed** · build exit 0 · Playwright **112 tests / 112 passed / 0 failed**）；`meta` 鍵面 **34 鍵**、`meta.targets` **1 鍵（`hitbox`）** 已逐字記錄；OQ-66.1／66.2／66.4 使用者收斂**全數照預設**，啟用清單十個 drill id 已逐字定案；假設 #3 讀碼**確認成立**（T3 必改 `schema.ts`）。⚠️ 兩項須傳遞給後續 task：**① frame-time 基線改由 T5 同場 A/B 取得**（具名偏離 T0 DoD 第 5 條，理由見 Surprises 3）；**② 基準 commit 執行中被平行 session 推進兩次** ⇒ 後續 task 須在自己的 commit 上自備同期對照，不得引用本表絕對數。詳見 [Surprises](#surprises)。 |
| T1 | ⬜ 未開始 | — | — |
| T2 | ⬜ 未開始 | — | — |
| T3 | ⬜ 未開始 | — | — |
| T4 | ⬜ 未開始 | — | — |
| T5 | ⬜ 未開始 | — | — |
| T-exit | ⬜ 未開始 | — | — |

---

## T0 — Entry gate（2026-09-12）

> 基準 commit：**開場 `80578cf`（worktree clean）→ 收尾 `9a03562`**（平行 session 於執行中推進兩次，見 [Surprises 5](#t0-執行期新增)）。**有效基線 = `9a03562`**。
> 本 task **未修改任何 `src/` 檔案**；執行期間 worktree 一度出現的 `tests/e2e/*.spec.ts` 修改屬其他 session（已由其 `9a03562` 提交），未被本 task 觸碰或 stage。
> 以下每個數字都是**實際執行輸出**，非引用其他 WP 的記載（T0 Invariant）；凡受 commit 推進影響者皆已在 `9a03562` 上重跑並標明。

### 1. 編號重查（[GD-35](../../../DECISIONS.md) ② 紀律）

| # | 來源 | 當下最大值 |
|---|---|---|
| 1 | [`exec-plan/README.md §2`](../../../README.md) 索引 | **WP-67** |
| 2 | `ls -d docs/exec-plan/{active,completed}/*/wp-*` 實際資料夾 | **WP-67**（[`active/stage13/wp-67-export-opening-protocol-marker/`](../wp-67-export-opening-protocol-marker/README.md)） |
| 3 | [`DECISIONS.md`](../../../DECISIONS.md) **已落帳**最大 GD | **GD-41**（WP-65 T-exit） |
| 4 | 已預約、未落帳的 GD | **GD-42**（本 WP 草稿）· **GD-43**（[WP-67](../wp-67-export-opening-protocol-marker/progress.md) 草稿） |

**[stage14 §3](../../stage14/README.md) 三個候選的採納狀態**（逐一確認，T0 DoD 指名項）：

| stage14 §3 候選 | 該檔標示的編號 | 該檔標示的狀態 | 是否已入 `README.md §2` 索引／有 `wp-NN-*` 資料夾 | 結論 |
|---|---|---|---|---|
| `spider-shot-v3` 量測參數定案 | WP-66 | 🟡 規劃中 | ❌ 兩者皆無 | **未採納** |
| `spider-shot-wide-v1` 效度層 | WP-67 | ⬜ 未開始 | ❌ 兩者皆無 | **未採納** |
| `micro_flick_three_target_test_v8` | WP-68 | ⬜ 未開始（且 stage14 §3 自述「已被 WP-63 實質取代」） | ❌ 兩者皆無 | **未採納** |

⇒ 依 [GD-15](../../../DECISIONS.md)（編號歸屬以**採納入 §2 索引**為準，草稿之「候選、未批准」預留**不構成佔用**）：
**`WP-66` / `GD-42` 仍屬本 WP，無需順延**，本資料夾名與內部連結零修改。
反向影響：stage14 §3 的三個候選實際應順延為 **WP-68/69/70**（WP-66 為本 WP，WP-67 已於 `c54f2c6` 由平行 session 採納）。stage14 README §3 的編號註記已同步補一列（該檔為 stage14 所有，本 WP 只加註記、不改其敘事與表格內容）。

### 2. 基線凍結（NFR-66.2／66.7 的對照基準）

> ⚠️ **基準 commit 在本 T0 執行中被平行 session 推進兩次**（`80578cf` → `51471d0` → `9a03562`，詳見 [Surprises 5](#t0-執行期新增)）。
> **下表為唯一有效基線，全部數字取自 `9a03562`（收尾 HEAD）**。T1 起一律以本表為對照。

| 指令 | 結果（**`9a03562`**） | 耗時 |
|---|---|---|
| `npm run typecheck`（= `tsc --noEmit` ×2） | **exit 0** | — |
| `npx vitest run` | **3128 passed / 2 skipped**（260 檔：259 passed / 1 skipped） | 9.52 s |
| `npx vitest run tests/regression` | **319 passed**（32 檔全 passed） | 1.73 s |
| `npm run build`（`tsc` ×2 + `vite build`） | **exit 0**（既有 chunk-size > 500 kB warning，非新增） | — |
| `npx playwright test --workers=1` | **112 tests：112 passed / 0 failed** | 17.2 min |

**三個 commit 上的實測軌跡**（保留以證明差異全部歸因於平行 session，非本 WP）：

| 指令 | `80578cf`（開場） | `51471d0` | `9a03562`（基線） |
|---|---|---|---|
| typecheck | exit 0 | exit 0 | **exit 0** |
| `vitest run` | 3124 passed / 2 skipped | 3128 / 2 | **3128 / 2** |
| `vitest run tests/regression` | 319 passed | 319 | **319** |
| `npm run build` | exit 0 | exit 0 | **exit 0** |
| `playwright --workers=1` | （未取得可用值） | 110 tests：109 passed / **1 failed** | **112 tests：112 passed / 0 failed** |

- `3124 → 3128`（+4）＝ `51471d0`（`feat(stage12): add micro-flick v9`）新增的 `micro_flick_three_target_test_variants.test.ts` 案例。
- `110 → 112`（+2）＝ `9a03562`（`test(stage12): gate micro-flick v9 in a real browser`）新增的 e2e。
- **`tests/regression` 的 319 在三個 commit 上逐位不變** ⇒ NFR-66.2 的對照基準未受任何平行變更影響，是本 WP 最穩的一條對照線。
- `51471d0` 上那筆 **1 failed** 是 `tests/e2e/session-orchestrator.spec.ts:430` 的硬編碼 `toHaveCount(38)`（roster 加了 v9 後實際為 39），由該 commit 自己造成、與本 WP 無關；平行 session 已於 `9a03562` 修正為 `39`。⇒ **README 的 NFR-66.7（「通過數 ≥ 基線，且 `0 failed`」）維持原文可用**，判準值為 **≥ 112 passed / 0 failed**。

**`.playwright-tmp/history-dev/` participant 目錄數**：T0 開場 **0**（[e2e-history-root-accumulates] 記載的「累積上千個後 history-library spec 轉紅」風險不存在）⇒ **未清理**；三次全量 e2e 後累計 **108**。距轉紅門檻仍有數量級餘裕，**T5 開工前再數一次**即可。

**真實研究資料未被污染**：`find data/session-history -name '*.json' | wc -l` 在全部執行前後皆為 **0**；`playwright.config.ts` 的兩個 webServer 各自帶 `FPS_HISTORY_ROOT`（dev → `.playwright-tmp/history-dev`、preview → `.playwright-tmp/history-preview`），本次未出現 [e2e-port-5173-collision] 記載的既有 dev server 佔用。

### 3. 既有匯出鍵面 digest（T3「additive 不動既有鍵面」／T4「只多一欄」的唯一對照基準）

**取得方式**：以 `vite-node` 呼叫 `collectMeta()`，逐欄複製 [main.ts:775-898](../../../../../src/main.ts#L775-L898) `buildCurrentExportPayload()` 的 live-path 參數集（研究員模式：`session` + `dpi` 已填、`display` + `frames` 具備），drill 取 `trackingBrVariants[3]`（`drillId = 'tracking_br_v1'`）。
**為什麼不是手打一場**：本 session 為非互動，無法在 Pointer Lock 下真人瞄準；`window.__fpsTest` harness 走的是**與 live 單例隔離的獨立管線**（[main.ts:1146-1148](../../../../../src/main.ts#L1146) 註解），既不經 `buildCurrentExportPayload()` 也不帶 `validity`／`frames`（WP-65 T0 已踩過這個坑並記錄）。逐欄複製 live 參數集是本 commit 上可重現、可稽核、且**涵蓋 live 專屬鍵**的取法。

```
meta keys (sorted, 34) = ["backend","browser","bufferOverflow","crossOriginIsolated","display",
  "displayHz","dpi","drillId","fovDeg","frames","lateEventCount","maxDrillSeconds","mouseIntegration",
  "movementModel","recorderOverflow","replay","rngSeed","scene","schemaVersion","sensitivity",
  "sensitivityModel","session","simHz","simToWorld","spawn","startedAt","suspect","targets","unit",
  "vStrafe","validity","weapon","weaponId","weaponSeed"]

meta.targets keys (sorted, 1) = ["hitbox"]
meta.targets = {"hitbox":{"widthU":0.5,"heightU":1,"depthU":0.5,"shape":"box"}}
```

**條件鍵的缺席已逐條核對**（不是「剛好沒出現」）：`tracking_br_v1` 未宣告 `mode`（⇒ 非 `'assessment'`，無 `meta.assessment`）、未宣告 `protocolGuard`（無 `meta.protocolGuard`）、不在 `PEEK_CLICK_TRANSFER_VISIBILITY_BY_DRILL_ID`（無 `meta.visibility`）、不經 Session Plan／protocol runner（無 `sessionPlan*`／`meta.protocol`）。⇒ **T3／T4 之後這份 34 鍵集合必須逐字不變，`meta.targets` 由 1 鍵變 2 鍵（`hitbox` + `hitFeedback`）且僅限啟用清單上的 run。**

**跨 commit 複驗**：同一支腳本在 `80578cf` 與 `51471d0` 上各跑一次，**34 鍵集合與 `meta.targets` 的 1 鍵逐字相同**；收尾的 `9a03562` 只改 `tests/e2e/`，不可能動到 `collectMeta()` 的輸出 ⇒ 本節數字對三個 commit 皆成立（`src/data/metadata.ts` 與 `tracking_br_v1` 全程未被觸及）。

**型別層佐證**：`TargetsMeta` 目前恰有一個 optional 鍵（[metadata.ts:41-44](../../../../../src/data/metadata.ts#L41-L44)）⇒ `meta.targets` 的鍵面在本 commit 為定義上的定值，與上方 runtime 輸出一致。

### 4. A/B frame-time 基線（NFR-66.4）— **本 T0 未取得，具名偏離，改由 T5 同場取得**

理由與處置見 [Surprises 3](#surprises)。**不阻塞 T1**（NFR-66.4 的驗收點在 T5）。

### 5. OQ 收斂（使用者 2026-09-12 回覆）

- **OQ-66.1 — 啟用清單：照預設**。逐字清單（T4 **只能**動這十個 id，未列名者一律不啟用）：

  | # | drill id | 來源 |
  |---|---|---|
  | 1 | `tracking_br_v1` | `trackingBrVariants[3]`（`ads_on` × `projectile` × `0p5deg`） |
  | 2 | `tracking_br_v1__ads_off__hitscan__0p5deg` | `trackingBrVariants[0]` |
  | 3 | `tracking_br_v1__ads_on__hitscan__0p5deg` | `trackingBrVariants[1]` |
  | 4 | `tracking_br_v1__ads_off__projectile__0p5deg` | `trackingBrVariants[2]` |
  | 5 | `tracking_br_v1__ads_off__hitscan__2deg` | `trackingBrVariants[4]` |
  | 6 | `tracking_br_v1__ads_on__hitscan__2deg` | `trackingBrVariants[5]` |
  | 7 | `tracking_br_v1__ads_off__projectile__2deg` | `trackingBrVariants[6]` |
  | 8 | `tracking_br_v1__ads_on__projectile__2deg` | `trackingBrVariants[7]` |
  | 9 | `tracking_core_pr_pilot_v1_2deg_5dps` | `TRACKING_PILOT_SCHEDULABLE_DRILL_IDS[0]`（WP-64 策展） |
  | 10 | `tracking_reversal_pilot_v1_high` | `TRACKING_PILOT_SCHEDULABLE_DRILL_IDS[1]`（WP-64 策展） |

  **排除** `hold_track_v1`（stage6 已凍結的 assessment 協定）與其餘七個未策展的 WP-54 pilot block。
  排除理由已於 T0 逐條讀碼證實，非引用規劃期敘述：[hold_track_v1.ts:35](../../../../../src/drill/hold_track_v1.ts#L35) 宣告 `mode: 'assessment'`；該 id 不在 `ASSESSMENT_PROTOCOL_VERSION_BY_DRILL_ID`（[assessmentProtocolVersion.ts:5-8](../../../../../src/drill/assessmentProtocolVersion.ts#L5-L8)）⇒ 落回 `STAGE6_PROTOCOL_VERSION = '1.0.0'`（[protocolVersion.ts:2](../../../../../src/drill/protocolVersion.ts#L2)，該檔自述「Values only move forward by versioned release」）。⇒ 對它改視覺＝改已凍結協定，須另開升版切片（[GD-23](../../../DECISIONS.md)），不在本 WP。
  1～8 的 id 由 `trackingBrVariants` 實跑列印取得（非手抄），9～10 由 `TRACKING_PILOT_SCHEDULABLE_DRILL_IDS` 實跑列印取得 —— 守 [WP-64 README §1.5](../wp-64-tracking-pilot-session-plan-drills/README.md)「取自 exported builder／具名常數，絕不手寫 drill id」的同一紀律。

- **OQ-66.2 — `HIT_FEEDBACK_HOLD_MS`：照預設 120 ms**。
- **OQ-66.3 — 以 `emissive` 呈現：照預設（規劃期已由 D-66-P4 定案，未提交使用者重決）**。
- **OQ-66.4 — 不需要額外的 `meta` 版本標記：照預設關閉**。`meta.targets.hitFeedback` 逐 run 自述已足以分池；WP-65 T-exit 交接的 `meta` 版本標記工作已另立為 [WP-67](../wp-67-export-opening-protocol-marker/README.md)（`meta.opening`），**本 WP 不夾帶、也不因此改為相依**（兩者皆為 `meta` 的 additive 欄位，落點不同、無交會）。

⇒ 四個 OQ **全數照 README 預設收斂**，故 README §1.4 的預設敘述無需推翻。惟 T0 DoD 要求「啟用清單須寫入 README §1.4」⇒ 已於 README 新增 [§1.4a OQ 收斂結果](README.md#14a-oq-收斂結果t0-定案2026-09-12)，把上表十個 `drillId` 逐字搬過去並標明為執行權威（§1.4 原表保留為決策脈絡）。

### 6. 假設 #3 讀碼確認 — **成立，T3 必須同時改 `schema.ts`**

[`validateDrillConfig()`](../../../../../src/drill/schema.ts#L164-L196) 的 return 是**白名單重組**，`targets` 物件逐鍵列舉：

```ts
targets: {
  count, distance,
  ...(hitbox ? { hitbox } : {}),
  ...(hitboxCandidates ? { hitboxCandidates } : {}),
  ...(population ? { population } : {}),
  ...(spawnArea ? { spawnArea } : {}),
  ...(motion ? { motion } : {}),
  ...(trackingTrajectory ? { trackingTrajectory } : {}),
},
```

⇒ JSON drill 若寫了 `targets.hitFeedback` 而 `schema.ts` 未加驗證，**該欄會被靜默丟棄**（不報錯、載入成功、回饋不生效）。**T3 必須同時改 `DrillConfig.ts` 的 type 與 `schema.ts` 的驗證＋重組**，並補一條「JSON drill 設了 `hitFeedback` 確實生效」的測試，否則這個失效模式測不出來。

### 7. GD-42 草稿（本體 **T-exit 入帳**，承 D-66-P7）

D-66-1～D-66-6 見 [Decision Log](#gd-42-草稿本體-t-exit-入帳)。**D-66-4 的「啟用清單」欄位已由本 T0 填實**：即上方 §5 OQ-66.1 的十個 drill id 逐字清單；生效日期待 T4 落地時補。

---

## Decision Log

### 規劃期（2026-09-11）

| # | 決策 | 理由 |
|---|---|---|
| **D-66-P1** | 命中訊號走**獨立環形格** `targetHits`，不加在 `TargetState` | `TargetState` 是 sim 契約（44 callers）；render-only 訊號放進去會讓後續讀者以為它有 sim 語意。承 WP-25 `shotRays` 先例（README §2.3） |
| **D-66-P2** | 環形格**不帶時間戳** | 消除 sim clock ↔ wall clock 相減的結構性陷阱；render 的衰減一律以 rAF `now` 起算（README §2.2） |
| **D-66-P3** | 逐 mesh **material clone**，不用「換一顆 material」 | clone 的型別/defines 相同 ⇒ 同 WebGPU pipeline，執行期只改 uniform，避免首次命中才編 pipeline 的一次性卡頓（FM-6） |
| **D-66-P4** | 命中態以 `emissive` 呈現，不換 `color` | `MeshStandardMaterial.emissive` 預設即 `0x000000` ⇒ 未啟用時逐位不變；且保留目標原色身分（OQ-66.3） |
| **D-66-P5** | 啟用清單**逐字列名**，預設排除 `hold_track_v1` | 該 drill 屬 stage6 `protocolVersion = 1.0.0` 凍結範圍（GD-23）；改視覺＝改協定，需另開升版切片（OQ-66.1 / 風險 §3.1-2） |
| **D-66-P6** | `HIT_FEEDBACK_HOLD_MS` 預設 120 ms | 使用者語意為「命中才亮、沒中不亮」；tracking pilot 射速 ≈10 Hz（100 ms 間隔）⇒ 120 ms 使連續命中呈連續亮起、一次未命中在 ≤120 ms 內熄滅，最貼合該語意且不閃爍（OQ-66.2） |
| **D-66-P7** | GD-42 **本體於 T-exit 入帳**，規劃期只留草稿 | 承 [WP-63](../wp-63-micro-flick-v8-measurement-foundation/README.md) D-63-P6 先例：啟用清單與斷代日期要等 T0/T4 落地才有東西可入帳 |

### GD-42 草稿（本體 T-exit 入帳）

| # | 草稿內容 |
|---|---|
| **D-66-1** | 命中回饋走獨立環形格（`targetHits`），不放 `TargetState` |
| **D-66-2** | 環形格不帶時間戳，衰減一律以 render 的 rAF `now` 起算 |
| **D-66-3** | 回饋為 `DrillConfig.targets.hitFeedback?`，省略＝逐位不變且不寫 metadata |
| **D-66-4** | 啟用清單逐一列名 —— **T0（2026-09-12）已填實為十個 drill id**（`tracking_br_v1` 八 variant + `tracking_core_pr_pilot_v1_2deg_5dps` + `tracking_reversal_pilot_v1_high`，見 [§T0.5](#5-oq-收斂使用者-2026-09-12-回覆)），排除 `hold_track_v1` 等已凍結的 assessment 協定；啟用即構成**效度斷代**，由 `meta.targets.hitFeedback` 逐 run 自述。生效日期待 T4 補 |
| **D-66-5** | projectile 條件的回饋延遲（飛行時間）為已知且已接受的條件差異——使用者 2026-09-11 決定 |
| **D-66-6** | replay **先不同步**（使用者 2026-09-11 決定）；觸發補齊的條件 = replay 被用於向受試者回放 |

---

## Surprises

*（執行中填寫：與規劃假設不符的實況、讀碼後才發現的前提、被推翻的估算。）*

規劃期已知的待驗證前提：

1. **假設 #3 — ✅ T0 已確認成立**：`src/drill/schema.ts` 確實以白名單重組 config 物件（[schema.ts:164-196](../../../../../src/drill/schema.ts#L164-L196)，`targets` 逐鍵列舉）⇒ 未加入驗證的新欄位會被**靜默丟棄**而非報錯。**T3 必須同時改 `DrillConfig.ts` 的 type 與 `schema.ts` 的驗證＋重組**，並補「JSON drill 設了 `hitFeedback` 確實生效」的測試（詳見 [§T0.6](#6-假設-3-讀碼確認--成立t3-必須同時改-schemats)）。
2. **WP-65 的 e2e arm helper 已於規劃期間落版本庫**：規劃開始時 `tests/e2e/support/` 尚為 untracked，撰寫本計畫期間由 WP-65 收尾 commit（HEAD 為 `692ce6a`，`tests/e2e/support/arm.ts` 已在版本庫）。T5 的新 spec 可直接沿用該 helper；**仍須於 T5 開工時確認路徑未改**。→ T0（HEAD `80578cf`）複查：路徑未改，`armDrill()` / `armAndWaitRunning()` / `installAutoArm()` 三個 export 皆在。

### T0 執行期新增

3. **NFR-66.4 的 frame-time 基線改由 T5 同場取得（具名偏離 T0 DoD 第 5 條）**

   T0 步驟 4 要求在此凍結一組 `tracking_br_v1` 的 frame-time p95 與 over-budget window 數當對照組。**本 T0 未取得**，兩個理由：

   - **不可得**：本 session 為非互動，無法在 Pointer Lock 下真人跑一場；而 `window.__fpsTest` harness 走的是**與 live 單例隔離的獨立管線**（[main.ts:1146-1148](../../../../../src/main.ts#L1146)），它以合成 clock 手動 pump sim、**不驅動 rAF**，因此 `frameLog` 收不到任何真實 render 幀。`window.__aimDebug` 只暴露 `state` / `pointerLock` / `recorder` / `drillPhase`（[main.ts:1130-1135](../../../../../src/main.ts#L1130-L1135)），**不含 `frameLog`**；`meta.frames` 只在 live `buildCurrentExportPayload()` 中產生。⇒ 要在 T0 取得這個數字，等於先替 T5 造一套 live frame-time 擷取 e2e —— 那正是 NFR-66.4 在 T5 的工作項本身。
   - **取了也不該用**：README §3.3 已明訂量測法為「**同 drill 開／關各一場**」的 A/B（承 WP-60 F6）。跨 session 的 T0 數字與 T5 數字之間夾著開關機、驅動、熱狀態與背景負載的差異，**噪音大於 NFR-66.4 的 0.2 ms 判準**（WP-60 F6 實測 Δp95 在四次重複之間符號會翻轉，量級 ~0.005 ms）。T5 背對背的同場 A/B 是**更有效**的對照，不是退而求其次。
     另有一條使這個等價成立的前提：FR-66.8 要求 `hitFeedback` 省略時逐位不變 ⇒ T5「關」組跑的就是與今日相同的程式路徑。

   **處置**：T5 執行 NFR-66.4 時，A（關）與 B（開）必須在**同一次瀏覽器 session、同一 drill、背對背**量測，並把兩組的 `meta.frames.summary.p95` 與 `overBudgetWindows` 一併記入本檔。**本項不阻塞 T1**（驗收點在 T5）。
   先例：[WP-60 T0](../wp-60-raw-mouse-sample-capture/progress.md) 同樣把 F6 的瀏覽器 frame log 記為 BLOCKED，於 TF1/TF2 在實機補齊。

5. **基準 commit 在 T0 執行中被平行 session 推進兩次 —— 基線因此重跑三輪**

   T0 開場 HEAD = `80578cf`（worktree clean）。執行期間平行 session 連續提交：

   | 時間 | commit | 內容 | 對基線的影響 |
   |---|---|---|---|
   | 09:40:16 | `51471d0` | `feat(stage12): add micro-flick v9` —— 動 `src/main.ts`／`src/session/drillFamily.ts`，roster +1 drill | Vitest 3124 → 3128；**e2e 轉紅 1 筆**（picker option 38 → 39，`session-orchestrator.spec.ts:430` 硬編碼期望未同步） |
   | ~10:03 | `9a03562` | `test(stage12): gate micro-flick v9 in a real browser` —— 修 `toHaveCount(38 → 39)` + 新增 v9 e2e | e2e 110 → 112 tests，**轉回 0 failed** |

   期間 worktree 一度出現**非本 task 所改**的 `tests/e2e/session-orchestrator.spec.ts` 與 `tests/e2e/micro-flick-live.spec.ts`（即 `9a03562` 的在製工作）。本 task **未觸碰、未 stage** 它們（協議：只 stage 自己的切片）。

   處置：四項快檢與全量 Playwright **全部在收尾 HEAD `9a03562` 上重跑**，[§T0.2](#2-基線凍結nfr-662-667-的對照基準) 的表即該輪結果，為唯一有效基線。中間兩輪的數字一併保留在該節的軌跡表，作為「差異全部歸因於平行 session」的證據。

   **兩個必須傳給後續 task 的推論**：
   - **這個 repo 的 `main` 會在 task 執行中前進。** 本 WP 每一個宣稱「逐位不變」的 task（T1／T3／T5）都必須**在自己的 commit 上重測對照組**，不得引用本 §T0.2 的絕對數字當同期對照 —— 否則會把平行 session 的變更算到 WP-66 頭上。可靠的做法是比**同一 commit 上開／關兩組**，而不是比「今天的數字 vs T0 的數字」。
   - **`tests/regression` 是唯一在三個 commit 上逐位不變的線**（319 passed）⇒ NFR-66.2 用它當對照最穩；NFR-66.7 的 Playwright 絕對數會隨上游漂移，T5 需先重測當日基線再比。

6. **規劃期到 T0 之間，平行 session 採納了 WP-67**6. **規劃期到 T0 之間，平行 session 採納了 WP-67**：規劃期（2026-09-11）記載 `active/*/` 最大 WP = WP-65；T0 重查（2026-09-12）為 **WP-67**（`c54f2c6` 採納 `wp-67-export-opening-protocol-marker`，並預約 GD-43）。**本 WP 的 WP-66 / GD-42 未受影響**（WP-67 的 T0 已明帳確認 WP-66 由本 WP 佔用）。連帶處置：[stage14 README §3](../../stage14/README.md) 的候選編號仍停在 WP-66/67/68 且**兩號都已被取用**，已於該檔補一列 2026-09-12 順延註記（→ WP-68/69/70），避免第三個 session 再撞號。

---

## Open Questions

| OQ | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-66.1** | 哪些 drill 啟用命中回饋？ | ✅ **T0 收斂（2026-09-12）：照預設**——`tracking_br_v1` 八 variant + WP-64 兩個 curated Tracking Pilot config，排除 `hold_track_v1`。**十個 drill id 逐字清單見 [§T0.5](#5-oq-收斂使用者-2026-09-12-回覆)**，T4 只能動這份清單。 | 使用者 | T0 |
| **OQ-66.2** | `HIT_FEEDBACK_HOLD_MS` 取值 | ✅ **T0 收斂（2026-09-12）：照預設 120 ms** | 使用者 | T0 |
| **OQ-66.3** | 命中態以 `emissive` 呈現 | ✅ 規劃期已定（D-66-P4）；T0 未推翻 | 規劃者 | — |
| **OQ-66.4** | 是否需要 `meta` 層級的效度斷代版本標記 | ✅ **T0 收斂（2026-09-12）：照預設否**。`meta.targets.hitFeedback` 逐 run 自述已足以分池；WP-65 交接的版本標記工作已另立為 [WP-67](../wp-67-export-opening-protocol-marker/README.md)（`meta.opening`），本 WP **不夾帶、不改為相依**。 | 使用者 | T0 |
| **OQ-66.5** | replay 何時補上命中回饋？（技術債 §3.2；觸發條件 = replay 被用於**向受試者**回放而非研究者檢視） | ⬜ 開放（非阻塞） | 使用者 | 本 WP 之後 |
