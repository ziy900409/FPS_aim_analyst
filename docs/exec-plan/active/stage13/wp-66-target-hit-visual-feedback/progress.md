# WP-66 — Progress

> Tech spec：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)
>
> 每個 task 完成時更新本檔（Progress / Decision Log / Surprises / Open Questions），與程式切片一起 stage（協議 §3.4）。

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 | ✅ 完成 | 2026-09-12 | 見 [§T0](#t0--entry-gate2026-09-12)。編號重查四處來源已記錄（**WP-66 / GD-42 仍可用，未順延**；stage14 §3 已補順延註記）；基線於 `9a03562` 凍結（typecheck exit 0 · Vitest **3128 passed / 2 skipped** · regression **319 passed** · build exit 0 · Playwright **112 tests / 112 passed / 0 failed**）；`meta` 鍵面 **34 鍵**、`meta.targets` **1 鍵（`hitbox`）** 已逐字記錄；OQ-66.1／66.2／66.4 使用者收斂**全數照預設**，啟用清單十個 drill id 已逐字定案；假設 #3 讀碼**確認成立**（T3 必改 `schema.ts`）。⚠️ 兩項須傳遞給後續 task：**① frame-time 基線改由 T5 同場 A/B 取得**（具名偏離 T0 DoD 第 5 條，理由見 Surprises 3）；**② 基準 commit 執行中被平行 session 推進兩次** ⇒ 後續 task 須在自己的 commit 上自備同期對照，不得引用本表絕對數。詳見 [Surprises](#surprises)。 |
| T1 | ✅ 完成 | 2026-09-12 | 見 [§T1](#t1--targethitring-進-sharedstatesimloop-兩處寫入2026-09-12)。`TargetHitRing` 落 `SharedState`、`SimLoop` **只加兩行寫入**（命中路徑窮舉證明恰為兩條）；+17 tests（反證 6 條 + 決定性 1 條），regression **319 passed 逐位一致**、fixture 零修改；`src/render`／`src/drill`／`src/main.ts`／`src/data`／`research` 五者零改動；零 importer 掃描乾淨。變異注入實證反證測試會咬（非假綠燈）。⚠️ 傳遞給 T2：`trackingPilotHold.magSize = 512` ⇒ 一場約 250 次命中 **遠超 CAP 64**，`TargetView` 必須走 `seq` 高水位增量消費，不得以 `total` 當索引。|
| T2 | ✅ 完成 | 2026-09-12 | 見 [§T2](#t2--targetview-逐-mesh-material-與命中態衰減2026-09-12)。`TargetView` 改逐 mesh material clone、新增 `setHitFeedback()` 與 `sync()` 的兩個 optional 參數；+13 tests（含 FM-1／FM-2／FM-4 反證各一）；**5 個變異注入全數 RED**（其中 M-B 一度 GREEN，揪出一條真的假綠燈並改掉測試）；regression **319 passed 逐位一致**、fixture 零修改；`src/main.ts`／`src/drill/`／`src/data/`／`src/loop/`／`src/render/replay/`／`research/` **六者零改動**。⚠️ 傳遞給 T3：`setHitFeedback()` 必須在 §0.4 四處全到位，且**必須在 `drillRunner.start()` 之前**呼叫（理由見 §T2 Decision T2-b）。|
| T3 | ✅ 完成 | 2026-09-12 | 見 [§T3](#t3--targetshitfeedback-設定schemametadata-與-maints-接線2026-09-12)。`targets.hitFeedback?` 進 type + `schema.ts` 白名單、`resolveHitFeedback()` 為四條路徑的單一比較式、`meta.targets.hitFeedback` optional-in（live + harness 兩條管線同形）；**接線收斂到 `drillRunner.start()` façade 一處**（具名偏離 task file 的「四處各寫一次」，理由見 Decision T3-a）；+20 tests、**5 個變異注入全數 RED**；regression **319 passed 逐位一致**、fixture 零修改；`drills/*.json` 與全部 drill 定義**值零修改**（值變更屬 T4）；Python `load_export()` 對帶新鍵的 payload **零修改可讀**、`git diff research/` 為空。⚠️ 傳遞給 T4：啟用清單十個 id 一律改**具名常數／builder 上的 `targets.hitFeedback: 'flash'`**，且 `meta.targets` 屆時由 1 鍵變 2 鍵——只限這十個 run。|
| T4 | ✅ 完成 | 2026-09-12 | 見 [§T4](#t4--在指名的-tracking-drill-啟用命中回饋2026-09-12)。`tracking_br_v1` 家族**八格全部**啟用（`makeVariant()` 一處生效八個）；八個 id 的 `loadDrill()` 前後逐欄比對，差異**恰為** `targets.hitFeedback`（22 欄位 × 8 drill）；`meta.targets` 由 1 鍵變 2 鍵、對照組 `counterstrafe_ad_v1` 維持 1 鍵逐字不變；golden fixture 逐筆分類完成（**無一應變動、實測亦無一變動**）；regression **319 passed 逐位一致**、全量 **3181 passed**（+3 tests）、typecheck／build exit 0；**5 個變異注入全數 RED**。⚠️ **啟用清單由十個收斂為八個**：T0 列入的兩個 WP-54 pilot id 經執行期讀碼證實是 `tracking-pilot-v2` **已版本化協定**六個 scored block 中的兩個（啟用將造成協定內 2/6 混淆，且 `checkTrackingCompatibility()` 無 `hitFeedback` 軸、前後無法分池，與 KI-025 同型）；**使用者 2026-09-12 裁決選項 A：整個 WP-54 tracking-pilot 家族（九個 block）一律不啟用**，並以 census 表＋策展註冊表**兩個入口**的斷言釘死（見 [Open Questions](#open-questionst4)）。⚠️ 交接 T5：四項實機證據（命中亮／打偏不亮／燄滅／projectile 延遲）需操作人員實機，已交接 T5 同場取得，不阻塞 T5 開工。|
| T5 | ✅ 完成 | 2026-09-12 | 見 [§T5](#t5--零-importer-常駐掃描focused-live-e2eab-frame-time-與全量回歸2026-09-12)。零 importer 由一次性 grep 變成**常駐測試**（`src/data/`／`src/metrics/`／`research/` 三個 root × 七個具名符號零出現，並各自斷言掃到的檔數下限 + 一條「掃描確實會咬」反證 + 匯出事件 union 拒收）；**live e2e 三條全綠**——啟用 drill 命中亮起（`ff8a3d`）、109–119 ms 內熄滅且**熄滅時被打中的那一顆仍在場**、換 drill 兩個方向、換場景往返後仍生效、對照 drill `tracking_v1` 命中 3 發但恆不亮；**4 個變異注入全數 RED**（`main.ts` 兩條接線各一 + `src/metrics/` 符號洩漏 + 對照 drill 啟用），其中 MUT-SYNCARG（`sync()` 少傳參數的靜默退回）**沒有任何單元測試守得到**。A/B frame-time：p95 增量 **+0.025 ms ≤ 0.2 ms**、長幀（>2×p50）ON/OFF 六場皆 **0**、首次命中幀無尖峰（FM-6 ✅）。全量：typecheck ×2 exit 0 · regression **324 passed**（+5 = 本切片）· 全量 vitest **3186 passed**（+5）· build exit 0 · Playwright **115 passed / 0 failed**（基線 112 ⇒ NFR-66.7 ✅）。既有 spec **零修改**、`git diff --stat src/` 為空。⚠️ 兩項交接 T-exit：**① draw call 的「相同」判準需改寫**（`drawCalls` 在 br-field 逐幀變動 114–118，ON/OFF 無系統性差異）；**② T4 交接的四項實機證據取得三項**，「刻意打偏不亮」與「projectile 亮起延遲對 `timeOfFlightMs`」未取得。⚠️ 開跑前 5173 上有一個**指向真實研究資料 root 且已壞掉（504）**的外部 dev server，經使用者同意後停掉（詳見 §5）。 |
| T-exit | ✅ 完成 | 2026-09-12 | 見 [§T-exit](#t-exit--驗收閘a-661a-6612與-gd-42-入帳2026-09-12)。A-66.1～A-66.12 **十二條逐條具名證據全數成立**；最終 gate 全部本閘實跑：typecheck ×2 **exit 0**、全量 Vitest **3186 passed / 2 skipped**（263 檔）、regression **33 檔 / 324 passed**（其餘 319 逐位一致）、Playwright **115 passed / 0 failed**（基線 112 ⇒ NFR-66.7 ✅）、`npm run build` **exit 0**（bundle 檔名與 T5 逐字相同）。A-66.9 以**靜態全量普查**複驗：全 repo 唯一把 `hitFeedback` 賦值進 drill config 的位置是 `tracking_br_v1.ts:98`，`drills/*.json` 零命中，runtime 列印八個 id 全為 `flash`。**GD-42 已入帳**（入帳前重查：已落帳最大為 GD-41，GD-42 未被取用）。⚠️ **一項判準具名改寫**：A-66.12 的 draw call 由「相同」改為「分布無系統性差異 + `poolSize` 不變」（`drawCalls` 在 br-field 逐幀抖動 114–118，ON/OFF 範圍互相覆蓋）。⚠️ **第一輪全量 e2e 曾 2 failed**，根因為本閘平行跑 `vite-node`／python 探針導致 headed Edge 掉焦點、真實 Pointer Lock 取不到；單獨重跑該 spec **3 passed**、全量在機器獨佔下重跑 **115 passed / 0 failed** ⇒ 環境干擾而非程式，已升級為明帳紀律（跑全量 e2e 期間視為機器獨佔）。⚠️ **兩項實機證據未取得**（刻意打偏不亮的正面證據、projectile 亮起延遲對 `timeOfFlightMs`），明帳以單元層證據替代，不以「已完成」宣稱。|

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

## T1 — `TargetHitRing` 進 `SharedState`，`SimLoop` 兩處寫入（2026-09-12）

> 基準 commit：**`65350c8`**（T0 落帳）。開工與收尾 worktree 皆 clean，**本切片執行期間未被平行 session 推進**（與 T0 的情況不同）。
> 下列每個數字皆為本切片實際執行輸出。依 [T0 Surprises 5](#t0-執行期新增) 的紀律，「逐位不變」的對照**取自同一 commit 上的實測**，不引用 T0 的絕對數。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/state/SharedState.ts` | 新增 `TARGET_HIT_CAP = 64`、`TargetHitRing`、`createTargetHitRing()`、`pushTargetHit()`、`resetTargetHitRing()`；`SharedState` 增 `targetHits`；`createSharedState()` 建一份、`resetState()` 原地清空（不 realloc）。位置與註解密度逐條比照既有 `ImpactRing`／`ShotRayRing` 段落 |
| `src/loop/SimLoop.ts` | **只加兩行寫入 + 一個 import**，零判定變更（diff 全文見下方 §3） |
| `src/state/SharedState.test.ts` | +7 測試（ring 原語、同一參考、空字串 no-op、繞圈、reset 不 realloc、state 層 create/reset） |
| `src/loop/__tests__/wp66-target-hit-ring.test.ts` | **新檔**，+9 測試（hitscan 6 條 + projectile 3 條） |
| `src/loop/__tests__/wp66-hit-ring-determinism.test.ts` | **新檔**，+1 測試（4 種 render 幀序列逐位一致） |

`src/render/`、`src/drill/`、`src/main.ts`、`src/data/`、`research/` **五者零改動**（見 §3）。

### 2. `SimLoop` 產生命中的路徑窮舉（T1 步驟 3）

全檔搜 `type: 'hit'` 與 `hit` 旗標的賦值點，**命中路徑恰為兩條**，無第三條：

| # | 路徑 | 命中的權威表述 | 位置 | 本切片寫入點 |
|---|---|---|---|---|
| 1 | projectile（掃掠） | `hitIndex >= 0 && arena.accurate[i] === 1` | [SimLoop.ts:350](../../../../../src/loop/SimLoop.ts#L350) 區塊；唯一的 `type: 'hit'` 事件在 [:363](../../../../../src/loop/SimLoop.ts#L363) | [:361](../../../../../src/loop/SimLoop.ts#L361)，緊鄰 `markKilled` |
| 2 | hitscan（射線） | `hit = accurate && result.hit && blocker === undefined` | **全檔唯一**的 `hit` 賦值在 [:459](../../../../../src/loop/SimLoop.ts#L459)，消費於 `fire` 事件 [:500](../../../../../src/loop/SimLoop.ts#L500) | [:473](../../../../../src/loop/SimLoop.ts#L473)，在既有 `if (hit && result.targetId !== undefined)` 區塊**內** |

- `let hit = false`（[:411](../../../../../src/loop/SimLoop.ts#L411)）之後**只有一次**再賦值 ⇒ hitscan 側不存在第二個命中定義；速度閘與 WP-45 occlusion 因此是**繼承**的，不是本 WP 重寫的（守 GD-7 單一來源）。
- `markKilled` 在本檔的呼叫點同樣恰為這兩處（[:358](../../../../../src/loop/SimLoop.ts#L358) / [:468](../../../../../src/loop/SimLoop.ts#L468)），其餘命中為註解。**`DrillRunner` 另有 `peekTimeoutMs`／`presentationMs` 到期的 `markKilled`**——那是「目標到期撤除」而非「打中」，本切片正確地**不**為它寫入環形格（到期撤除不該亮）。
- ⚠️ 兩行寫入**刻意不放在 `pushImpact`／`pushShotRay` 旁**：那兩者脫靶也寫（README §0.1 #4）。此事已由測試釘死（見 §5 的「脫靶」條）。

### 3. 零 importer 與 diff 範圍（FR-66.12 / FM-5）

```
$ grep -rn "targetHits|TargetHitRing|pushTargetHit|TARGET_HIT_CAP|resetTargetHitRing|createTargetHitRing" \
    src/data/ src/metrics/ research/
（零命中）

$ 全 repo 提及者（5 檔，全落 state/loop）
src/state/SharedState.ts · src/state/SharedState.test.ts
src/loop/SimLoop.ts · src/loop/__tests__/wp66-target-hit-ring.test.ts
src/loop/__tests__/wp66-hit-ring-determinism.test.ts
```

`git status --short` 恰為 3 M + 2 ??（上表五檔），`src/render/`、`src/drill/`、`src/main.ts`、`src/data/`、`research/` 皆零命中 ⇒ T1 Invariant 與 DoD 的 diff 範圍條款成立。`DataRecorder`／`exportPayloadSchema`／`metadata.ts` diff 為空。

**`src/loop/SimLoop.ts` 的完整 diff = 1 個 import 改寫 + 2 段寫入（各 1 行實體 + 註解）**，無任何其他 hunk；判定式、`markKilled` 條件、事件欄位全數逐字未動。

### 4. `TARGET_HIT_CAP` 餘裕估算（T1 步驟 5 / FM-8）

**CAP 管的是「render 尚未消費的積壓量」，不是一場 run 的命中總數**——比照 `ImpactRing`／`ShotRayRing` 的環狀覆寫語意，明確**不宣稱零丟失**。

| 量 | 值 | 出處 |
|---|---|---|
| 全部啟用清單 drill 的射速上限 | **10 Hz** | `cycletimeSec = 0.1 s`（`ak47` 與 `trackingPilotHold` 同值，[weapons.ts:137](../../../../../src/weapon/weapons.ts#L137)） |
| 命中寫入率上限 | **10 筆/s**（每發至多寫一筆） | 同上 |
| CAP | 64 | 本切片 |
| **render 可停擺多久才會覆寫掉未消費的最舊命中** | **6.4 s** | 64 ÷ 10 Hz |
| 60 FPS 下每幀到達量 | ≈ 0.17 筆 | 10 ÷ 60 ⇒ 相對 CAP 有 **≈380×** 餘裕 |

⇒ 要撞到覆寫，render 必須連續停擺 **6.4 秒**；那種情境下該場 run 早已因 frame-time 而作廢，視覺瑕疵不是當下的問題。**一個完整彈匣**：`ak47` 30 發、`m4a1s` 20 發皆 < 64 ⇒ 即使 render 全程不消費，單匣連續全中也不會繞圈。

> ⚠️ **給 T2 的前提**：`trackingPilotHold.magSize = 512`（[weapons.ts:136](../../../../../src/weapon/weapons.ts#L136)，25 s scored 窗打不完的刻意裕度）⇒ **一場 tracking run 的命中總數會遠超過 64**（10 Hz × 25 s ≈ 250）。T2 的 `TargetView` 因此**必須**以 `seq` 高水位做增量消費（比照 `ImpactView`／`TracerView`），不得假設 `total ≤ TARGET_HIT_CAP` 或用 `total` 當索引。

### 5. 測試設計：反證優先，並以變異注入證明不是假綠燈

本切片釘死的不是「命中會亮」，而是**「只有命中才會亮」**——一次「沒打中卻亮」直接污染刺激。九條 `SimLoop` 測試中**六條是反證**：

| 反證 | 斷言 |
|---|---|
| 脫靶 | `impacts.total > 0` **且** `targetHits.total === 0` —— 同一條測試同時證明「彈著格不是命中訊號」 |
| occlusion blocker 擋下 | `fire.hit === false`、未撤除、彈孔停在牆面、環形格零筆 |
| 未過速度閘（hitscan） | 射線幾何對準目標但 `|vx| ≥ accuracyThreshold` ⇒ 零筆 |
| 未過速度閘（projectile，`accurate === 0`） | 彈掃過目標但零筆 |
| 逾 `maxRangeU` 消滅 | `shotRays.total > 0`（tracer 有畫）但零筆 |
| 無存活目標 | 零筆 |

**變異注入（mutation check，本切片實跑）**——反證測試最容易變成「因為別的理由而通過」，故逐一驗證它們會咬：

| 注入的變異 | 結果 |
|---|---|
| 兩處 `pushTargetHit` 同時註解掉 | **3 failed / 6 passed** —— 三條正證全紅（hitscan 命中、persistent 連續命中、projectile 命中），六條反證維持綠（正確：它們斷言的是零筆） |
| 移除 projectile 的 `&& arena.accurate[i] === 1` 速度閘 | 「未過速度閘的飛行彈 → 零筆」**轉紅** ⇒ 證明該彈**確實掃過目標**、是被閘擋下的，不是因為根本沒飛到而空過（**非 vacuous**） |

> 變異注入後已還原；還原過程本身踩了一個坑，見 §7 Surprise 1。

### 6. 驗證證據（全部為本切片實際執行輸出）

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（×2） | **exit 0 / exit 0** | 同 T0 |
| `npx vitest run tests/regression` | **exit 0** — 32 檔 / **319 passed**；`git status --short tests/` **為空**（fixture 零修改） | T0 基線 **319** ⇒ **逐位一致**，NFR-66.2 ✅ |
| `npx vitest run`（全量） | **exit 0** — Test Files **261 passed / 1 skipped (262)**；Tests **3145 passed / 2 skipped (3147)**；9.68 s | T0 = 260 檔 / 3128 tests ⇒ **+2 檔、+17 tests**，逐條對得上：SharedState +7、wp66-target-hit-ring +9（新檔）、wp66-hit-ring-determinism +1（新檔）。**零測試由綠轉紅** |
| `npm run build` | **exit 0**（既有 >500 kB chunk 警告，非本切片引入） | 同 T0 |
| 零 importer 掃描 | `src/data/`／`src/metrics/`／`research/` **零命中** | FR-66.12 ✅（T5 再以常駐測試釘一次） |

NFR-66.1（決定性）：`wp66-hit-ring-determinism.test.ts` 在 **4 種 render 幀序列**（穩定 60／144／240 Hz + 抖動 144 Hz ±50%）下，`total`／`cursor`／逐槽 `id`／逐槽 `seq` 皆逐位一致，且 `fire` 事件序列本身一併比對（避免「兩邊都壞得一樣」）。

NFR-66.3（零堆配置）：`pushTargetHit` 熱路徑無 `push`、無物件字面值、無 `new` —— 寫入的是既有 `TargetState.id` 的**參考**（由「同一參考」測試以 `toBe` 釘死），`id` 為建構期一次性 `new Array(64).fill('')`。

### 7. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T1-a** | `resetTargetHitRing()` 連 `id` 一併清回 `''`，不只清 `seq` | 既有 `resetImpactRing`／`resetShotRayRing` **只清 `seq`**（數值殘值無害，render 靠 `seq=0` 哨兵早退）。但本格殘留的是**目標身分字串**：留著它等於讓一個已結束 drill 的目標 id 可被下一場讀到，且會讓那個字串無法被 GC 回收。清 64 格字串是 per-drill 一次性成本，不在熱路徑。被推翻：逐字比照既有兩個 reset 只清 `seq` —— 一致性不值得換一個「上一場的身分還在記憶體裡」的坑 |
| **T1-b** | `pushTargetHit` 對空字串 id 為 **no-op，不拋** | 比照既有 ring 原語「不在熱路徑做驗證」的慣例；空 id 在現行 roster 不可能出現（`TargetState.id` 由 `TargetManager` 產生），防呆存在的意義是「萬一出現也只是少亮一次」，而不是讓 sim 迴圈在受試者面前崩掉 |
| **T1-c** | 決定性測試**不掛 `DrillRunner`**，改用手放的 persistent 目標 + 固定輸入 | 目的是量「命中訊號」的決定性，不是 drill 生命週期（那條已由 `wp65-arm-determinism` 與既有 `determinism.test.ts` 覆蓋）。掛 runner 會讓目標 spawn／撤除的時序混進來，失敗時無從分辨是 ring 不決定還是 spawn 不決定 |
| **T1-d** | 決定性測試的輸入序列**同時包含 A/D 橫移與連射**，刻意讓速度閘反覆翻轉 | 只射不動 ⇒ 發發命中 ⇒ 測到的是「一致地全部命中」的弱綠燈。命中與否經過速度閘、而 `vx` 由逐 tick movement 積分推進，**混合命中／脫靶的序列**才真的在考驗「寫入時機綁 sim tick 而非 render 幀」。測試內以 `some(hit)` + `some(!hit)` 斷言此前提成立 |
| **T1-e** | 環形格寫在 `markKilled` **之後**（projectile）／`markKilled` 區塊**內**（hitscan） | 兩者都必須落在既有命中條件的**同一個 if 區塊**內，才能讓「寫入條件與既有 `fire.hit`／`hit` 事件逐條相同」由結構保證，而不是靠兩份條件式維持同步。hitscan 側特別注意：寫入放在 `if (hitTarget === undefined \|\| ...persistent !== true)` 的**外面**、`if (hit && ...)` 的**裡面** —— persistent 目標命中不撤除，但**同樣要亮**（正是本 WP 的主要使用情境） |

### 8. Surprises & Discoveries（T1）

1. **變異注入的還原腳本被「前綴子字串」咬了一口 —— 差點把 hitscan 寫入點還原成 projectile 的變數。**
   兩個注入標記分別是 6 空格與 8 空格縮排的 `// MUTANT`；還原時先跑 6 空格那條 `split/join`，它**同時命中了 8 空格那行的後 6 個空格**，於是 hitscan 的寫入被還原成 `pushTargetHit(state.targetHits, target.id)` —— 而 `target` 在該 scope 根本不存在（hitscan 側叫 `hitTarget`）。
   **抓到它的是測試不是眼睛**：還原後重跑，兩條 hitscan 測試仍紅，才回頭看 diff。
   ⇒ **給後續 task 的教訓**：在這個 repo 做臨時變異注入時，標記字串必須**互不為子字串**（例如帶不同編號 `// MUTANT-A` / `// MUTANT-B`），且還原後**一律以 `git diff` 逐行複驗**，不能只看測試綠。本次最終 diff 已逐行確認 = 1 import + 2 寫入。

2. **`trackingPilotHold.magSize = 512` 使一場 tracking run 的命中總數遠超過 CAP。**
   規劃期的 FM-8 以「射速 vs CAP」論述餘裕，讀起來像「總數不會超過 64」。實際上啟用清單上的 tracking drill 一場可命中約 250 次（10 Hz × 25 s scored）。**這不影響 T1 的正確性**（CAP 管的是未消費積壓，render 每幀消費 ⇒ 積壓 ≈ 0.17 筆/幀），但**直接約束 T2 的實作**：必須走 `seq` 高水位增量消費，不得假設 `total ≤ TARGET_HIT_CAP`、不得拿 `total` 當索引。已寫入 §4 的警示框。

3. **`DrillRunner` 的到期撤除是第三個 `markKilled` 來源，但不是第三條命中路徑。**
   窮舉時一度把它算進來。`peekTimeoutMs`／`presentationMs` 到期會 `markKilled` 但**沒有任何一發子彈打中**——命中回饋正確地不為它寫入。記此一筆是因為「`markKilled` 的來源數 ≠ 命中路徑數」這件事在讀碼時會讓人多繞一圈；T5 若以 `markKilled` 為線索做掃描會數錯。

### Open Questions（T1 留給後續 task）

- **T2**：見上方 Surprise 2 —— `TargetView` 必須以 `seq` 高水位增量消費，且 `TARGET_HIT_CAP` 的繞圈語意（不宣稱零丟失）要在 render 端讀得出來，不能寫成「讀 `total` 筆」。
- **T5**：本切片的零 importer 檢查是**一次性 grep**；T5 需把它變成常駐測試（FM-5 要求的自動掃描），否則後續 WP 可能無聲把 `targetHits` 接進 `src/metrics/`。

---

## T2 — `TargetView` 逐 mesh material 與命中態衰減（2026-09-12）

> 基準 commit：**`8966924`**（worktree clean）。本切片只動 `src/render/TargetView.ts`、
> `src/render/TargetView.test.ts` 與 `CONTEXT.md`（＋本檔與 checklist）。
> 以下每個數字都是本切片的實際執行輸出。

### 1. 落地內容

| 檔 | 改動 |
|---|---|
| `src/render/TargetView.ts` | 逐 mesh `#material.clone()`（`#acquire`）；`dispose()` 逐 mesh 釋放 clone；匯出 `HIT_FEEDBACK_HOLD_MS = 120`；模組常數 `HIT_EMISSIVE = 0xff8a3d` / `NO_EMISSIVE = 0x000000`（**不匯出**）；新增 `setHitFeedback()`、`#ingestHits()`、`#paintHit()`、`#flashUntil: Map<string, number>`、`#syncedSeq`；`sync()` 加第 3／4 個 optional 參數 `hits?` / `nowMs?` |
| `src/render/TargetView.test.ts` | +13 tests（既有 13 → 26）；`meshes()` 回傳型別收斂為 `Mesh<BufferGeometry, MeshStandardMaterial>` 以便直接斷言材質 |
| `CONTEXT.md` §H | 新增三個術語條目：**`targetHits`（命中環形格）**、**命中回饋（hit feedback）**、**`TargetView` 逐 mesh material**；節標題補上 WP-66 與 `TargetView.ts` |

**零改動（`git diff --stat` 實測為空）**：`src/main.ts`、`src/drill/`、`src/data/`、`src/loop/`、
`src/render/replay/`、`research/`、`tests/`。⇒ T2 Invariant 全部成立，`ReplayTargetView` 未被觸碰。

### 2. material clone 數上界，與為何 clone 不會造成 pipeline 重編（T2 步驟 7／FM-6）

**clone 數 = `poolSize` = 歷史上單幀最多顯示的目標數**，且這個數有**結構上的硬上界**，不是靠慣例：

| 來源 | 值 | 證據 |
|---|---|---|
| 單 drill 同時在場目標數的**schema 硬上界** | **16** | `MAX_ACTIVE_TARGET_COUNT = 16`（[schema.ts:18](../../../../../src/drill/schema.ts#L18)），`targets.population.activeCount` 超過即拋錯（[schema.ts:211-213](../../../../../src/drill/schema.ts#L211-L213)） |
| 啟用清單上的 tracking 家族 | **1** | `tracking_br_v1` 無 `population` 欄 ⇒ 走 legacy 單活目標生命週期（[DrillConfig.ts:230](../../../../../src/drill/DrillConfig.ts#L230)） |
| 現行 roster 實際最大 | **3** | `micro_flick_three_target_test_v8/v9` 的 `population.activeCount: 3` |

⇒ 實務上 clone 至多 3 份、架構上至多 16 份，全部於 `#acquire()` **一次性**建立（pool 只增不減），
**熱路徑零配置**（NFR-66.3）。加上模板本身，`MeshStandardMaterial` 實例數上界 = `poolSize + 1`。

**為何不重編 pipeline**：`Material.clone()` 產生的是**同一個類別**（`MeshStandardMaterial`）、
逐欄複製自同一個模板 ⇒ 決定 shader 變體的那組輸入（material type + defines + 有無貼圖／
`vertexColors`／`flatShading` 等 program cache key）與模板**完全相同**。three 的 program cache 以這組
key 命名，因此 clone 與模板共用同一個編譯產物；執行期改的 `emissive` 是 **uniform**，不在 cache key 內。
本 WP 前的做法（整池共用一顆 material）之所以不能用，不是效能問題而是**無法逐目標上色**；
而被否決的替代方案「命中時換一顆 material 物件」才會引入新的 cache key ⇒ 首次命中當下才編譯、掉一幀（FM-6）。

> ⚠️ 這條推論的**直接量測**（`renderer.info.render.drawcalls` 與 A/B frame-time）屬 T5 實機範圍。
> 本切片能在單元層證明的是 **`poolSize` 啟用前後相同**（測試「逐 mesh 各持一份 material clone…」以
> 同目標集合分別建 feedback-on／off 兩個 view 比對 `poolSize`）⇒ **mesh 數不變 ⇒ draw call 不變**（NFR-66.5）。

### 3. 測試設計：反證優先，並以變異注入證明不是假綠燈

新增 13 條，**前三條全是反證**（本 WP 最大的風險不是「亮不起來」，是未指名的 drill 被無聲改掉視覺）：

| # | 測試 | 釘住 |
|---|---|---|
| 1 | 不帶 `hits`/`nowMs` → `emissive`/`color`/`roughness` 三屬性逐位等於本 WP 前 | FM-1（含「clone 必須保留模板建構參數」） |
| 2 | `setHitFeedback` 未啟用、**逐幀**帶 ring 且期間有命中 → 仍不亮 | FM-1 行為版 |
| 3 | 亮起 → 到期熄滅，**邊界 `nowMs === until` 當下已熄** | FR-66.5 |
| 4 | HOLD 窗內再次命中 → 重新起算，原到期時刻之後仍亮 | FR-66.5 |
| 5 | A 命中後撤除、B 佔用**同一個 mesh 物件**（以 `toBe` 斷言確實是同一槽）→ B 不亮 | **FM-2 本體** |
| 6 | 同幀 A 命中、B 未命中 → A 亮 B 不亮 | FR-66.6 |
| 7 | 本幀未用到的 pool mesh 隱藏時一併熄滅，且仍在窗內的 A 不受影響 | FM-2 第二條洩漏路徑 |
| 8 | `sync()` ×2（含過期清理那一幀）前後 ring 的 `total`／`cursor`／逐槽 `id`／逐槽 `seq` 全 `Object.is` 不變 | **FM-4** |
| 9 | 命中數 `> TARGET_HIT_CAP × 3` 使 ring 繞圈多次後仍正確亮起、且到期後不被舊槽重新點亮 | T1 Surprise 2 的警示 |
| 10 | ring 被重開 drill 清空（`total` 倒退）→ 不補亮上一場的命中 | 見 Surprise 2 |
| 11 | `setHitFeedback(false)` 立即熄滅殘留亮態，且之後 `sync()` 不再改材質 | 見 Decision T2-c |
| 12 | 逐 mesh material **不共用**（`not.toBe`）、`poolSize` 與啟用前相同、clone 保留 `color`/`roughness` | NFR-66.5 / FM-6 |
| 13 | `dispose()` 對**每個** mesh 的 clone 各呼叫一次 `dispose` | GPU 資源不洩漏 |

**變異注入（5 個，標記互不為子字串——T1 Surprise 1 的教訓）**：

| 變異 | 注入內容 | 結果 |
|---|---|---|
| **M-A** | 命中態改以 pool 槽位為鍵（`String(used - 1)`） | **RED**（8 failed / 18 passed） |
| **M-B** | 早退條件漏掉 `#hitFeedback` | **RED**（1 failed）——**修正後才 RED，見 Surprise 1** |
| **M-C** | 隱藏的 pool mesh 不熄滅（`if (!feedback)`） | **RED**（1 failed） |
| **M-D** | render 回寫 `hits.cursor = 0` 當作「已消費」 | **RED**（1 failed） |
| **M-E** | 命中不重新起算（`if (!has(id)) set(...)`） | **RED**（1 failed） |

還原後以**檔案內容逐位比對 + `git diff`** 雙重複驗（`還原逐位一致: True`），未重蹈 T1 的前綴子字串覆轍。

### 4. 驗證證據（全部為本切片實際執行輸出）

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | **exit 0 / exit 0** | 同 T0／T1 |
| `npx vitest run tests/regression` | **exit 0** — 32 檔 / **319 passed**；`git status --short tests/` **為空** | T0／T1 基線 **319** ⇒ **逐位一致**，NFR-66.2 ✅ |
| `npx vitest run`（全量） | **exit 0** — Test Files **261 passed / 1 skipped (262)**；Tests **3158 passed / 2 skipped (3160)** | 本切片開工前於 `8966924` 實測 **3145 / 2** ⇒ **+13 tests，零測試由綠轉紅**，且檔數不變（全部加在既有 `TargetView.test.ts`） |
| `npm run build` | **exit 0**（既有 >500 kB chunk 警告，非本切片引入） | 同 T0／T1 |
| `git diff --stat -- src/main.ts src/drill src/data src/loop src/render/replay research tests` | **輸出為空** | T2 DoD「六者零改動」✅ |

> 開工前基線於本 session 在 `8966924` 上**重新實測**（3145 passed / 2 skipped），未引用 T0 表的絕對數
> —— 遵守 T0 傳遞事項 ②（基準 commit 曾被平行 session 推進）。

### 5. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T2-a** | 高水位只用**一個** `#syncedSeq` 欄位，不設 `#syncedTotal` / `#syncedSeq` 兩個 | task file 步驟 4 寫的是兩個欄位名，但 `pushTargetHit` 寫入時 `seq[i] = total` ⇒ 兩者恆為**同一個數**。`ImpactView`（task file 自己指名的先例）也只用一個 `#syncedSeq`。兩個欄位只會製造「它們何時會不一致」的假問題。**屬對 task file 的具名簡化，行為無差異** |
| **T2-b** | `#syncedSeq` 以 **`-1` = 尚未與 ring 對齊**作哨兵；`setHitFeedback()` 兩個方向都設回 `-1`，下一幀只對齊高水位、**不補亮既有 backlog** | 若切換當下直接沿用舊高水位（或歸零），ring 裡既有的至多 64 筆 backlog 會在切換後那一幀**一次點亮**。這不是理論風險：目標 id 由 `TargetManager` 每場自 `t0` 重編（`nextId = 0`，[TargetManager.ts:763](../../../../../src/sim/TargetManager.ts#L763)）⇒ **上一場的 `t0` 命中會點亮這一場的 `t0`**，正是 FM-2 要防的「沒打中卻亮」。同一個哨兵順帶處理 `resetTargetHitRing()` 造成的 `total` 倒退。代價：切換後第一幀的命中不補亮（≤1 幀，與 ring「不宣稱零丟失」語意一致）。**⇒ T3 必須在 `drillRunner.start()` 之前呼叫 `setHitFeedback()`**，讓對齊那一幀落在 ring 已清空之後 |
| **T2-c** | `setHitFeedback(false)` **主動熄滅**全部 pool mesh，不只是設旗標 | task file 的 invariant 是「停用時 `sync()` 不讀 ring、不碰任何材質」。正因為之後不再碰材質，停用當下若不熄，正在亮的目標會**永久卡在亮態**——從 tracking drill 切到非 tracking drill 就會看到。被推翻：讓 `sync()` 在停用時仍跑一次歸零（那等於破壞 FM-1 的「逐位相同」早退路徑） |
| **T2-d** | 到期邊界取 `nowMs < until` 為亮（即 `nowMs === until` 當下**已熄**） | 半開區間 `[hit, hit + HOLD)` 讓「連續兩次命中間隔恰為 `HOLD_MS`」不會多亮一幀；且測試可以對邊界寫出唯一期望值，不需要 `toBeCloseTo` |
| **T2-e** | `HIT_EMISSIVE` / `NO_EMISSIVE` **不匯出**，測試以字面量逐字對照 | 承 task file 的形狀（只匯出 `HIT_FEEDBACK_HOLD_MS`）。色值是 render 內部表述，匯出等於邀請其他層讀它；測試以字面量對照反而讓「改色值」成為一個必須同時改測試的**顯式**動作 |

### 6. Surprises & Discoveries（T2）

1. **一條 FM-1 反證測試原本是假綠燈，被 M-B 當場抓到。**
   原寫法是「建一個未啟用的 view → 帶著已有命中的 ring `sync()` 一次 → 斷言不亮」。
   它**永遠會過**——因為未啟用的 view 高水位恆為 `-1`，第一幀必然走「只對齊、不補亮」分支，
   於是即使把 `#hitFeedback` 從早退條件裡拿掉（M-B），第一幀也照樣不亮。
   改成**跑滿兩幀**（第一幀對齊、幀間才寫入命中、第二幀才斷言）後 M-B 立刻 RED。
   ⇒ **教訓**：凡是被「首次呼叫要做初始化／對齊」保護的行為，單幀測試量到的是那個初始化分支、
   不是被測的開關本身。這個形狀在本 repo 會重複出現（`ImpactView`／`TracerView` 都有高水位），
   T3／T5 寫類似測試時**必須跑滿兩幀**。

2. **目標 id 跨 drill 會重複，這讓「補亮 backlog」從美觀問題升級成刺激污染問題。**
   `TargetManager.reset()` 把 `nextId` 歸零（[TargetManager.ts:763](../../../../../src/sim/TargetManager.ts#L763)）
   ⇒ 每一場的目標都從 `t0` 開始編號，**`t0` 在不同 drill 之間是同一個字串**。
   規劃期文件把命中態的鍵描述成「跟身分走而不是跟槽位走」（FR-66.6），讀起來像是身分是全域唯一的；
   實際上**身分只在單場內唯一**。這正是 T2-b 那個 `-1` 哨兵存在的理由，也是為什麼
   「重開 drill 清空 ring → 不補亮上一場的命中」需要一條專測（測試 #10）。
   ⇒ **T3／T4 注意**：任何以 `TargetState.id` 為鍵、且生命週期跨越 drill 邊界的 render 結構，
   都必須在 drill 邊界主動清空，不能假設 id 不會撞。

3. **`Material.clone()` 在 vitest 下可直接驗證「不共用」，不需要 render harness。**
   假設 #1（README §5）成立且更強：`MeshStandardMaterial.emissive` 不只可讀寫，
   `material` 的 identity 也可直接以 `not.toBe` 斷言 ⇒ FM-6 的「逐 mesh 各一份」在單元層即可釘死，
   只有 pipeline 與 frame-time 的**直接量測**需要留到 T5 實機。

### 7. Open Questions（T2 留給後續 task）

- **T3（必做，非選項）**：`setHitFeedback()` 必須在 `drillRunner.start()` **之前**呼叫（Decision T2-b）。
  §0.4 的四處 wiring 除了「有沒有到位」，還要確認**順序**；建議比照 WP-65 T2 的做法，
  把它收斂到 `main.ts` 的 `drillRunner` 包裝 `start()` 一個地方，而不是散在四個呼叫端。
- **T3**：`sync()` 目前有兩個 optional 參數，`main.ts` 的 `liveFrame` 必須**同時**傳 `hits` 與 `nowMs`
  （只傳其一會靜默退回舊行為，不會報錯）。假設 #2 已指出 `liveFrame` 持有 rAF `now`
  （`tracerView.sync(sharedState.shotRays, now)` 先例），T3 讀碼時確認即可。
- **T5**：NFR-66.5 的 `renderer.info.render.drawcalls` 與 NFR-66.4 的 A/B frame-time 皆待實機量測；
  本切片只在單元層證明了 `poolSize` 不變（§2 末的警示框）。

---

## T3 — `targets.hitFeedback?` 設定、schema、metadata 與 `main.ts` 接線（2026-09-12）

> 基準 commit：**`98d2f00`**（T2 的 graphify 索引刷新）。開工與收尾 worktree 皆 clean，**本切片執行期間未被平行 session 推進**。
> 依 [T0 Surprises 5](#t0-執行期新增) 的紀律，下列「逐位不變」的對照**全部取自同一 commit 上的實測**，不引用 T0 表的絕對數。
> 本切片**不啟用任何 drill**（值變更屬 T4）；交付後全 repo 行為與 T2 後**逐位相同**。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/drill/DrillConfig.ts` | `DrillConfig['targets']` 增 `readonly hitFeedback?: 'flash'`（註解寫明不得影響命中判定／目標推進／hitbox／任何指標，且啟用即構成效度斷代）；新增 `resolveHitFeedback(config?)` 純函式，位置與命名比照相鄰的 `resolveTargetHitbox` |
| `src/drill/schema.ts` | targets 驗證段加 `hitFeedback`、白名單重組加 `...(hitFeedback ? { hitFeedback } : {})`、新增 `requireHitFeedback()`（逐字比照 `requireHitboxShape`） |
| `src/data/metadata.ts` | `TargetsMeta` 增 `hitFeedback?: 'flash'`；`requireTargetsMeta()` optional-in 帶出 + `requireHitFeedbackMeta()` 驗證 |
| `src/data/exportPayloadSchema.ts` | `parseTargetsMeta()` additive 接受新鍵（含「只有 hitFeedback、無 hitbox」的形狀） |
| `src/main.ts` | import `resolveHitFeedback`；`drillRunner.start()` façade 內**一行**接線；`liveFrame` 的 `targetView.sync(...)` 改傳 `sharedState.targetHits` + `now`；`meta.targets` 加 optional-in 欄位；`installSceneLoad()` 加「為何刻意不在此接線」的註解 |
| `src/testharness/fpsTestHarness.ts` | `meta.targets` 同一 optional-in 形狀（見 Decision T3-b） |
| `src/drill/DrillConfig.test.ts` | **新檔**，+5 測試（`resolveHitFeedback` 四分支 + roster 現況反證） |
| `src/drill/schema.test.ts` | +8 測試（通過／省略鍵面／五種非法值／與 hitbox 併存） |
| `src/data/metadata.test.ts` | +3 測試（帶出／省略時鍵集合逐字＝T0 基線／非法值拋錯） |
| `src/data/exportPayloadSchema.test.ts` | +4 測試（round-trip 兩形狀／舊 payload 不生預設值／非法值帶欄位路徑） |

**值零修改（DoD 指名項）**：`git status --porcelain drills/` **輸出為空**；`git status --short src/drill/` 只有 `DrillConfig.ts`／`schema.ts`／兩個 test 檔 —— **沒有任何 drill 定義檔**（`tracking_br_v1.ts` 等一律未觸碰）。`research/` 的 `git diff --stat` 亦為空。

### 2. `main.ts` 接線的窮舉證據（FM-3，T3 DoD 指名項）

```
$ grep -n "targetView" src/main.ts
 350: let targetView = new TargetView(sceneManager.scene);
 351: targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape);   // WP-46
1070: // `installSceneLoad()` 重建 `targetView` 亦被涵蓋：…（註解）
1075: targetView.setHitFeedback(resolveHitFeedback(config));               // ← 本切片的唯一接線點
1454: targetView.dispose();
1465: targetView = new TargetView(sceneManager.scene);
1519: targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape);   // WP-46
1559: targetView.setShape(resolveTargetHitbox(activeDrillConfig).shape);   // WP-46
1911: targetView.sync(sharedState.targets, alpha, sharedState.targetHits, now);
```

| 行 | 情境 | 處置 | 理由 |
|---|---|---|---|
| 350 | 初始建構 | **不需處理** | 建構後的第一件事是 `drillRunner.start(activeDrillConfig)`（:1093），由 :1075 設值；中間無 render frame |
| 351 | 初始 `setShape`（WP-46） | **不需處理** | 不同關注點（幾何 vs 回饋），不夾帶 |
| 1070 | 註解 | — | 說明 `installSceneLoad()` 為何不重複接線 |
| **1075** | **`drillRunner.start()` façade** | **✅ 已處理** | **本切片的唯一接線點**，見下表 |
| 1454 | 場景重載 `dispose()` | **不需處理** | 舊 view 銷毀，`#flashUntil` 與高水位隨之消滅 |
| 1465 | 場景重載重建 view | **不需處理（已加註解）** | 兩個呼叫端都在**同一同步區塊**內走到 :1520／:1560 的 `start()`，中間不可能夾一個 render frame；且此刻 `activeDrillConfig` 仍是**舊** drill，寫在這裡讀起來是錯的 |
| 1519 | `activateDrill()` 的 `setShape` | **不需處理** | 同 351；其後 :1520 立刻 `start()` |
| 1559 | `loadSceneById()` 的 `setShape` | **不需處理** | 同 351；其後 :1560 立刻 `start()` |
| **1911** | **`liveFrame` 的 `sync()`** | **✅ 已處理** | 改傳 `sharedState.targetHits` + `now`（**必須同時傳**，只傳其一會靜默退回舊行為）。`now` 即相鄰 `tracerView.sync(sharedState.shotRays, now)` 用的同一個 rAF 值 ⇒ 假設 #2 讀碼**確認成立**，未新增時鐘來源 |

**為什麼一處等於四處**——`drillRunner.start()` 的全部呼叫端（`grep -n "drillRunner.start(" src/main.ts`，扣掉一行註解後恰五處），以及 task file §0.4 四個點的對應：

| # | `start()` 呼叫端 | 行 | 涵蓋 task file §0.4 的哪個點 |
|---|---|---|---|
| 1 | top-level 初始啟動 | 1093 | **#1 初始建構** |
| 2 | `restartActiveDrill()` | 1428 | （§0.4 未列；重開同一場，順帶重新對齊高水位） |
| 3 | `loadWeaponById()` | 1439 | **#2 換武器** |
| 4 | `activateDrill()` | 1520 | **#2 換 drill**，且在 `installSceneLoad()` 之後 ⇒ 涵蓋 **#4 場景重載重建 view** |
| 5 | `loadSceneById()` | 1560 | **#3 換場景**，同樣在 `installSceneLoad()` 之後 ⇒ 亦涵蓋 **#4** |

⇒ §0.4 的**四個點全部到位**，且多涵蓋一條（`restartActiveDrill`）。`new TargetView(...)` 全 repo 只有 :350 與 :1465 兩處，`installSceneLoad()` 全 repo 只有 :1520／:1560 兩個呼叫端，兩者之間皆無 `return`、無 `await` ⇒ 涵蓋關係是結構性的，不靠慣例。

**順序**（T2 Decision T2-b 的必做項）：`setHitFeedback()` 寫在 `activeDrillRunner.start(config)` 的**前一行**。串起來是 `setHitFeedback()`（高水位設回 `-1`）→ `start()` → `resetAll()` → `resetState()` → `resetTargetHitRing()`（`total` 歸 0）→ 下一幀 `#ingestHits` 走 `#syncedSeq < 0` 分支只對齊到 0 ⇒ **對齊那一幀確實落在 ring 已清空之後**，上一場的 backlog 不可能補亮這一場的同名 `t0`（FM-2）。

### 3. Python 相容與 `research/` 隔離（C-D1 / NFR-66.6，T3 步驟 7）

以 `fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json` 注入 `meta.targets.hitFeedback = 'flash'` 後，用**未修改的** `research/src/modules/ingest/algorithms/loader.py::load_export()` 實跑：

```
with hitFeedback   -> ticks (2038, 14)  events (150, 24)
  meta.targets     = {'hitbox': {...}, 'hitFeedback': 'flash'}
without (pre-WP66) -> ticks (2038, 14)  events (150, 24)
  meta.targets     = {'hitbox': {...}}
OK: load_export reads the new key with zero modification; tick/event frames identical
```

讀碼佐證（不只是「剛好沒爆」）：`_validate_meta()` 對 `("weapon","targets","spawn",…)` 只斷言「是 mapping」，**不列舉內部鍵**，故 `meta.targets` 的 additive 欄位天然相容。
`git diff --stat research/` **輸出為空**；注入後的 payload 落在 scratchpad，未進 repo。

### 4. 測試設計：五個變異注入全數 RED（非假綠燈）

標記互不為子字串（T1 Surprise 1 的教訓），每個變異跑滿四個 spec 檔（333 tests）後**先還原、再列印**，並以 SHA-256 逐位複驗還原：

| 變異 | 注入內容 | 結果 |
|---|---|---|
| **MUT-ALPHA** | `schema.ts` 白名單重組**拿掉** `...(hitFeedback ? { hitFeedback } : {})` —— 即 T0 假設 #3 的「靜默丟棄」失效模式本體 | **RED**（3 failed / 330 passed） |
| **MUT-BRAVO** | `requireHitFeedback` 接受任何值（不拋） | **RED**（6 failed） |
| **MUT-CHARLIE** | `requireTargetsMeta` **無條件**寫 `hitFeedback`（取得預設值） | **RED**（2 failed） |
| **MUT-DELTA** | `parseTargetsMeta` 在無 `hitbox` 時丟掉 `hitFeedback` | **RED**（1 failed） |
| **MUT-ECHO** | `resolveHitFeedback` 不看 config（恆回 `config !== undefined`） | **RED**（2 failed） |

MUT-CHARLIE 是本切片最重要的一條：`meta.targets` 的鍵集合一旦多出預設值，`exportPayloadSchema.test.ts` 的 `CANONICAL_DIGEST_BEFORE_T5` 位元組表與 metadata 的「鍵集合逐字＝T0 基線」會**同時**轉紅 ⇒ FR-66.8 的「鍵面零增減」有兩道獨立防線。

### 5. 驗證證據（全部為本切片實際執行輸出）

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | **exit 0 / exit 0** | 同 T0／T1／T2 |
| `npx vitest run tests/regression` | **exit 0** — 32 檔 / **319 passed**；`git status --short tests/` **為空** | T0／T1／T2 基線 **319** ⇒ **逐位一致**，NFR-66.2 ✅ |
| `npx vitest run`（全量） | **exit 0** — Test Files **262 passed / 1 skipped (263)**；Tests **3178 passed / 2 skipped (3180)** | T2 收尾 **3158 / 2**（261 檔）⇒ **+20 tests、+1 檔，零測試由綠轉紅**。20 = 8（schema）+ 5（DrillConfig）+ 3（metadata）+ 4（exportPayloadSchema），逐條可對帳 |
| `npm run build` | **exit 0**（既有 >500 kB chunk 警告，非本切片引入） | 同 T0／T1／T2 |
| `git status --porcelain drills/` | **為空** | T3 Invariant「drill 值零修改」✅ |
| `git diff --stat research/` | **為空** | C-D1 ✅ |

`TargetState`／`HitDetector`／命中判定路徑／`ReplayTargetView`／replay contracts 皆未出現在 `git status --short` ⇒ 四條 Invariant 成立。

### 6. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T3-a** | **接線收斂到 `drillRunner.start()` façade 一處**，不在 §0.4 的四個點各寫一次 —— **具名偏離 task file 步驟 4**，但正面回應了 [T2 Open Questions](#7-open-questionst2-留給後續-task) 的必做項 | 三個理由：**① 順序**——T2-b 要求 `setHitFeedback()` 必須在 `drillRunner.start()` **之前**，寫在 façade 內的前一行是唯一「不可能寫錯順序」的位置；散在四處則每個呼叫端都要各自維持這條時序不變式。**② 正確性**——`installSceneLoad()` 那一處若照 task file 寫，讀到的 `activeDrillConfig` 是**舊** drill（`activateDrill` 要到下一行才換），會先設錯值再被修正。**③ 先例**——WP-65 / D-65-1 已把「每場 drill 起手的跨層一次性動作」（釋鎖、`frameLog.reset()`）收斂到這同一個 façade，並在該處明帳寫下「四條路徑收斂到這一個 start()，故在這裡做 = 四條路徑一致」。本切片是同一形狀的第三個實例。step 5「不得在 `main.ts` 內重複寫四次比較式」的意圖因此被**更強地**滿足：連呼叫都只有一次。被推翻：四處各呼叫一次（留下四個要同步維護的時序不變式）；只在 `installSceneLoad()` 接線（漏掉不換場景的換 drill） |
| **T3-b** | `fpsTestHarness` 的 `meta.targets` **同步**加 optional-in 欄位（task file 未列此檔） | FR-66.10 的主張是「**啟用該設定的 run** 必須在匯出 metadata 自述」，不是「live 管線的 run」。harness 走的是與 live 單例隔離的獨立管線（[T0 §3](#3-既有匯出鍵面-digestt3additive-不動既有鍵面t4只多一欄的唯一對照基準) 已記載這件事），兩條管線的 `meta.targets` 建構式本來就是刻意平行的兩份；只改一份會讓斷代自述在 harness 產出的 payload 上**靜默缺席**。因 `hitFeedback` 在本切片對全 roster 皆為 `undefined`，加這一行對現況**逐位無差異**（全量測試 +0 red 即為證據），代價為零 |
| **T3-c** | `parseTargetsMeta` 在「有 `hitFeedback`、無 `hitbox`」時回傳 `{ hitFeedback }` 而非 `{}` | 原本的 `if (record.hitbox === undefined) return {};` 早退會把新鍵吃掉。這個形狀不是假想：T4 若有 drill 省略 `hitbox`（走 `DEFAULT_TARGET_HITBOX`）而啟用回饋，`meta.targets` 就只有新鍵一個。MUT-DELTA 專門釘住它 |
| **T3-d** | metadata 與 export parser **各自**驗證 `'flash'`，不共用一個 validator | 兩者的錯誤契約不同：`requireTargetsMeta` 走 throw（collect 期的程式錯誤），`parseTargetsMeta` 走 `errors[]` 累積（讀外部 JSON 的容錯路徑）。既有的 `requireHitboxShape` 與 `parseLiteral(['box','sphere'])` 已經是同一組並存的兩份，本切片沿用該形狀而非新造抽象 |

### 7. Surprises & Discoveries（T3）

1. **既有的 `CANONICAL_DIGEST_BEFORE_T5` 位元組表，剛好就是 FR-66.8 的第二道防線——不需要新造。**
   `exportPayloadSchema.test.ts` 已有一張 8 個 fixture 的 canonical JSON digest 表（WP-58 T5 建立、WP-65 T5 更新過三筆）。八個 fixture **全部不帶** `meta.targets.hitFeedback`，所以任何「無條件輸出／取得預設值」的寫法都會同時移動它們的位元組。MUT-CHARLIE 實測即同時咬中這張表與 metadata 的鍵集合斷言。
   ⇒ **T4 注意**：T4 啟用十個 drill 後，這張表**仍應逐位不變**（fixture 全是 `counterstrafe_ad_v1` 與 synthetic，不在啟用清單上）。若 T4 執行時這張表轉紅，那不是預期變更，是寫錯了範圍。

2. **`load_export()` 的相容性是結構性的，不是巧合。**
   `_validate_meta()` 對 `weapon`／`targets`／`spawn`／`scene`／`display`／`frames`／`session` 七個 block 只斷言「是 mapping」，**完全不列舉內部鍵**。⇒ 這七個 block 下的任何 additive 欄位對 Python 端都是零修改可讀；C-D1 的單向隔離在這個方向上有結構保證。本 WP 之後的 `meta` additive 欄位（例如 [WP-67](../wp-67-export-opening-protocol-marker/README.md) 的 `meta.opening`）**若落在這七個 block 之外**，就沒有這層保證、需各自驗證。

3. **變異注入腳本本身踩了一次「還原寫在列印之後」的坑。**
   第一版把還原放在列印之後，而列印在 cp950 終端上對 vitest 輸出的 `❯` 字元拋 `UnicodeEncodeError` ⇒ 例外跳過還原，`schema.ts` 被留在**已變異**狀態（`grep` 當場抓到、手動還原、重測）。改為 `try/finally` 先還原再列印後才穩。
   ⇒ **教訓**：變異注入的還原必須在 `finally`，且不得與任何可能拋例外的輸出／格式化共用同一條路徑。這條在本 repo 會重複出現（T1／T2 都做過變異注入，都是手寫流程）。

### 8. Open Questions（T3 留給後續 task）

- **T4**：啟用清單十個 id 的 `targets.hitFeedback: 'flash'` 必須加在**具名常數／builder** 上（`tracking_br_v1.ts` 的 `makeVariant()` 一處即涵蓋八個 variant；兩個 WP-64 pilot config 各一處），不得手抄 id 逐一 patch —— 守 [WP-64 README §1.5](../wp-64-tracking-pilot-session-plan-drills/README.md) 的同一紀律。並確認 Surprise 1：`CANONICAL_DIGEST_BEFORE_T5` 在 T4 後仍應**逐位不變**。
- **T5**：`liveFrame` 的 `sync()` 必須**同時**傳 `hits` 與 `nowMs`（只傳其一會靜默退回舊行為、不報錯）—— 這條沒有單元測試能守（`main.ts` 不在 vitest 覆蓋內），只能靠 e2e「啟用的 drill 打中會亮」與「未啟用的 drill 不亮」兩條反向覆蓋。
- **T5**：e2e 寫「切換 drill 後回饋仍生效」時，務必**跑滿兩幀**（T2 Surprise 1）——`setHitFeedback()` 之後的第一幀恆走「只對齊、不補亮」分支，單幀量到的是初始化分支而非開關本身。
---

## T4 — 在指名的 tracking drill 啟用命中回饋（2026-09-12）

> 基準 commit：**`4bf5cfe`**（T3 的 graphify 索引刷新）。開工與收尾 worktree 皆 clean，本切片執行期間未被平行 session 推進。
> 依 [T0 Surprises 5](#t0-執行期新增) 的紀律，下列「逐位一致」的對照**全部取自同一 commit 上的實測**，不引用 T0 表的絕對數。
> **本切片只啟用 T0 清單十個 id 中的八個**（`tracking_br_v1` 家族）。另外兩個的暫緩理由見 Surprises 1，**不是遺漏，是刻意停手待裁決**。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/drill/tracking_br_v1.ts` | 新增具名常數 `HIT_FEEDBACK = 'flash'`（帶效度斷代註解）；`makeVariant()` 的 `targets` 加一行 `hitFeedback: HIT_FEEDBACK` —— **一處生效八個 variant** |
| `src/drill/DrillConfig.test.ts` | T3 的 roster 反證測試由「全部 `false`」翻為「八格全部 `true`」；**新增**未列名者反證（`hold_track_v1` ＋ 四個 core pilot cell ＋ `trackingReversalPilotV1Medium` 一律 `false`） |
| `src/drill/tracking_br_v1.test.ts` | **新增** uniformity 測試：八格的 `hitFeedback` 取值集合大小必須 = 1 |

**Invariant 實測**：`git status --short` 收尾恰為上述三檔。`src/state/`、`src/loop/`、`src/render/`、`src/drill/schema.ts`、`src/data/` **零修改**（T1–T3 已落地）；`drills/` 與 `research/` 的 `git status --porcelain` 皆為空。

### 2. 為什麼寫在 `makeVariant()` 上（而非逐 variant 列舉）

不只是「少打七次字」，是**效度前提**：`hitFeedback` 必須對 2×2×2 條件矩陣的每一格**逐格相同**，否則 `ads` / `ballistic` / `angularHeight` 三個被操弄變數就與「有無回饋」共變，每一條主效果與交互作用都不再可解釋。

寫在 builder 上使「八格一致」成為**結構性**保證而非慣例。並且 [`brTrackingProtocol`](../../../../../src/display/brTrackingProtocol.ts#L10) 的 conditions 正是 `trackingBrVariants` 全部八格 ⇒ `br_tracking_v1` protocol **全條件一致**，協定內比較不受污染。這一點是本切片與暫緩的兩個 pilot id 之間的**決定性差別**（Surprises 1）。

新增的 uniformity 測試刻意斷言「取值集合大小 = 1」而非逐格比對字面量——被守住的性質是**一致性本身**。

### 3. 逐欄比對：差異恰為 `targets.hitFeedback`（T4 步驟 2 / DoD 指名項）

以 `vite-node` 在**同一 commit** 上對改動前後各跑一次 `loadDrill(variant.drill, brField)`，展平成葉欄位後逐欄集合比較：

```
OK  tracking_br_v1__ads_off__hitscan__0p5deg:    +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_on__hitscan__0p5deg:     +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_off__projectile__0p5deg: +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1:                              +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_off__hitscan__2deg:      +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_on__hitscan__2deg:       +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_off__projectile__2deg:   +['.targets.hitFeedback'] -[] ~[]
OK  tracking_br_v1__ads_on__projectile__2deg:    +['.targets.hitFeedback'] -[] ~[]

drills compared = 8; fields per drill = 22
RESULT: all eight differ EXACTLY by targets.hitFeedback='flash'
```

`hitbox` / `motion` / `spawnArea` / `timing` / `sequence.seed` / `weaponId` / `distance` 全部落在「零變更」那一側（`~[]` 為空即為證據，非逐項目視）。

### 4. 匯出 `meta` 鍵面（T4 步驟 4／步驟 5 的**可決定性部分**）

以 [main.ts:839-845](../../../../../src/main.ts#L839-L845) 的 `targets` 建構式逐行複製，呼叫 `collectMeta()`：

```
tracking_br_v1                            meta.targets keys = ["hitFeedback","hitbox"]   hitFeedback = "flash"
tracking_br_v1__ads_off__hitscan__0p5deg  meta.targets keys = ["hitFeedback","hitbox"]   hitFeedback = "flash"
counterstrafe_ad_v1  (未列名，對照組)       meta.targets keys = ["hitbox"]
  meta.targets = {"hitbox":{"widthU":1,"heightU":2,"depthU":1,"shape":"box"}}
```

⇒ 啟用者 `meta.targets` 由 **1 鍵變 2 鍵**（T3 交接的預期），未列名的對照組 **逐字維持 T0 §3 基線的 1 鍵**（FR-66.8）。

**須誠實標明的取樣差異**：本探針傳的是精簡參數集（`meta` 頂層 25 鍵），**不是** T0 §3 的完整 live 參數集（34 鍵）。頂層鍵數因此不可與 T0 表直接相比；本節主張的是 `meta.targets` **子物件**的鍵面，那部分兩者可逐字對比。頂層 34 鍵的複驗屬 T5 的全量匯出檢查。

### 5. golden fixture 逐筆分類（T4 步驟 6 / DoD 指名項）

| 類別 | 檔案 | digest 是否應變動 | 實測 |
|---|---|---|---|
| 引用 `tracking_br_v1` 的 regression | `br-tracking-invariants.test.ts`、`br-camera-anchor-invariants.test.ts`、`protocol-atomic-load.test.ts` | **否** —— 三者皆斷言 sim 不變式／camera anchor／protocol 原子載入；`grep "digest\|collectMeta\|meta\.targets\|CANONICAL"` 對三檔**皆無命中** ⇒ 不涵蓋 `meta` 鍵面 | **319 passed，逐位一致** |
| `CANONICAL_DIGEST_BEFORE_T5` 位元組表（`exportPayloadSchema.test.ts`，8 個 fixture） | 全為 `counterstrafe_ad_v1` 與 synthetic，**無一在啟用清單上** | **否**（T3 Surprise 1 的預測） | **未轉紅** ⇒ 預測成立 |
| 任何 `*.json` golden fixture 提及 `tracking_br_v1` | `grep -rl` 於 `fixtures/`、`tests/` **無命中** | 不適用 | — |

⇒ 本切片 **無任何 digest 應變動，實測亦無任何 digest 變動**。T4 DoD 的「未涉及 `meta` 鍵面的 fixture 必須零變動」以 regression 319 逐位一致滿足。

### 6. 變異注入：2 個全數 RED（非假綠燈）

還原一律置於 `try/finally`，且**先還原、再列印**，並以 SHA-256 逐位複驗還原（T3 Surprise 3 的教訓）。

| 變異 | 注入內容 | 結果 |
|---|---|---|
| **MUT-ONE** | `makeVariant()` 拿掉 `hitFeedback: HIT_FEEDBACK`（＝本切片從未發生） | **RED**（2 failed / 10 passed）——roster 測試與 uniformity 測試**各咬一次** |
| **MUT-TWO** | 只在 `0p5deg` 兩格啟用（＝條件矩陣被回饋混淆的**失效模式本體**） | **RED**（2 failed / 10 passed） |

MUT-TWO 是本切片最重要的一條：它是「程式跑得起來、八個 drill 都載得動、但研究設計已經壞掉」的那一類 bug，**只有 uniformity 測試抓得到**。還原後 SHA-256 與注入前逐位相同。

> 執行期踩到一次 cp950：`subprocess` 以文字模式讀 vitest 輸出時對 `✓` 拋 `UnicodeDecodeError`。因還原寫在 `finally`，檔案**未被留在變異狀態**（`git diff --stat` ＋ `grep -c` 當場複驗）——T3 Surprise 3 的教訓這次生效了。改為 bytes 讀取 ＋ `decode('utf-8','replace')` 後穩定。

### 7. 驗證證據（全部為本切片實際執行輸出）

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | **exit 0** | 同 T0–T3 |
| `npx vitest run tests/regression` | **32 檔 / 319 passed** | T0–T3 基線 **319** ⇒ **逐位一致**，NFR-66.2 ✅ |
| `npx vitest run`（全量） | **262 檔 passed / 1 skipped；3180 passed / 2 skipped** | T3 收尾 **3178 / 2**（262 檔）⇒ **+2 tests、+0 檔、零測試由綠轉紅**。+2 = uniformity 1 ＋ 未列名反證 1（改寫既有 roster 測試不計數） |
| `npm run build` | **exit 0**（既有 >500 kB chunk 警告，非本切片引入） | 同 T0–T3 |
| `git status --porcelain drills/` · `git diff --stat research/` | 皆為空 | T4 Invariant ✅ · C-D1 ✅ |

### 8. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T4-a** | **暫緩**啟用 `tracking_core_pr_pilot_v1_2deg_5dps` 與 `tracking_reversal_pilot_v1_high`，交付 8/10 並停手待裁決 | 兩者是 `tracking-pilot-v2`（已版本化協定）六個 scored block 中的兩個（實跑 `buildTrackingPilotManifest()` 證實）。啟用會造成**協定內 2/6 帶回饋、4/6 不帶**——這正是本切片為 br 家族刻意避免的條件混淆（§2），而 br 家族因 `brTrackingProtocol` 涵蓋全部八格而天然免疫。且 `checkTrackingCompatibility()` 的十個軸**沒有 `hitFeedback`** ⇒ 啟用前後的 run 取得**相同 cohort key**，正是 KI-025 已立案的失效模式重演。README §3.1(2) 已為 `hold_track_v1` 立下「不得靜默改視覺、須另開升版切片」的先例，本情形同型。被推翻：**① 照清單全開**（造成上述兩個效度問題，且 T0 未曾評估過 `TRACKING_PILOT_PROTOCOL_VERSION`）；**② 只改 WP-64 策展物件**（`buildTrackingCorePrPilotV1Cell(2,5)` 產生的是**新物件**，與 manifest 用的 census 物件不同——實跑 `curated core === census core object ? false` ⇒ 同一 `drillId` 會依進入路徑帶兩種刺激，比全開更糟）；**③ 自行升 `TRACKING_PILOT_PROTOCOL_VERSION`**（該常數註解明定「Bumping this is a research-visible act … may only move together with a new protocol decision row」——不是本 WP 可代為決定的事） |
| **T4-b** | `HIT_FEEDBACK` 寫成**模組具名常數**，不在 `makeVariant()` 內聯字面量 | 效度斷代的敘事（啟用日期、不可混池、為何全家族一致）需要一個掛得住的宣告點。內聯字面量會讓這段說明散在 builder 內部、或根本不寫 |
| **T4-c** | 新增「未列名者一律不啟用」的**反向**測試，而非只測已啟用者 | FR-66.11 有兩面，而只有正面有測試時，「只動清單上的 id」就只是 commit message 裡的一句話。`hold_track_v1` 是其中最重要的一格（stage6 `protocolVersion = '1.0.0'` 凍結，GD-23）；四個 core pilot cell 現在也由這條守住，正好是 T4-a 暫緩範圍的機器可讀版本 |

### 9. Surprises & Discoveries（T4）

#### 1. T0 的十個 id 中有兩個是已版本化協定的 scored block——這件事 T0 未查

T0 §5 對 `hold_track_v1` 做了完整的協定版本讀碼（`mode: 'assessment'` → 落回 `STAGE6_PROTOCOL_VERSION`），**但對兩個 WP-64 策展 pilot id 只憑「WP-64 已策展、`mode: 'practice'`」就納入**，未檢查它們是否屬於某個版本化協定。實跑結果：

```
manifest blocks = [practice, calibration_h, calibration_v,
                   3deg_5dps, 3deg_14dps, 2deg_5dps, 2deg_14dps,
                   reversal_medium, reversal_high]
manifest protoVer = tracking-pilot-v2
manifest blocks on T4 list = ['tracking_core_pr_pilot_v1_2deg_5dps',
                             'tracking_reversal_pilot_v1_high']
```

⇒ 清單上那兩個，正是 `tracking-pilot-v2` 六個 scored block（4 core matrix ＋ 2 reversal）中的兩個。三個獨立的問題：

1. **協定內條件混淆**：2/6 帶回饋、4/6 不帶。該協定的主要結果定義在 scored block 之間的比較上（`trackingPilotManifest.ts` 註解：「README §2.5 primary outcome is defined over the scored blocks only」）⇒ size／speed／reversal 三個對比全部與「有無回饋」共變。**這與本切片為 br 家族刻意避免的是同一個錯誤**（§2）。
2. **cohort key 無法分池**：`checkTrackingCompatibility()` 逐欄比十個軸，**沒有一個是 `hitFeedback`** ⇒ 啟用前與啟用後的同一 block 取得**相同**相容性鍵。`TRACKING_PILOT_PROTOCOL_VERSION` 的註解已明載這正是 KI-025 的失效模式（常數停在 `v1` 三個切片，使 G5／G6 共用同一把鍵）。
3. **同一 `drillId` 兩個物件**：`TRACKING_PILOT_SCHEDULABLE_DRILLS[0].config` 是 `buildTrackingCorePrPilotV1Cell(2,5)` 的**新物件**，與 manifest 解析用的 `TRACKING_CORE_PR_PILOT_V1_CANDIDATES[2]` **不同參考**（實測 `false`）。而 reversal 那個**是**同一參考（實測 `true`）。⇒ 「只改策展來源」會讓 `tracking_core_pr_pilot_v1_2deg_5dps` 依進入路徑（Session Plan vs 協定 runner）帶**兩種不同刺激**——比全開更難察覺。

**本切片因此停在 8/10**，不自行裁決。README §3.1(2) 對 `hold_track_v1` 已立先例：對已凍結／已版本化的協定改視覺，**必須另開升版切片，不得靜默進行**。

#### 2. `br_tracking_v1` 免疫於同一個問題，而且是結構性的免疫

[`brTrackingProtocol`](../../../../../src/display/brTrackingProtocol.ts#L10) 的 conditions 直接 `trackingBrVariants.map(...)` —— **全部八格，無子集**。所以「寫在 builder 上」與「該 protocol 全條件一致」是同一件事，不是巧合，也不需要額外測試去維持：任何未來新增的 variant 都會自動同時進入 protocol 與回饋集合。`br_tracking_v1` 亦**無** `protocolVersion` 欄位（`grep -i version` 對該檔零命中），不存在「該升版卻沒升」的問題。

⇒ 這正是兩組 id 該分開處理的結構性理由，而非「先做簡單的」。

### Open Questions（T4）

**OQ-66.6 — ✅ 已收斂（使用者 2026-09-12 裁決：選項 A，兩個都不啟用）**

T0 的 OQ-66.1 把十個 drill id 列入啟用清單。T4 執行期讀碼發現其中兩個
（`tracking_core_pr_pilot_v1_2deg_5dps`／`tracking_reversal_pilot_v1_high`）是
`tracking-pilot-v2` 這個**已版本化協定**六個 scored block 中的兩個（詳見 Surprises 1），
遂停手提交裁決。使用者選 **A**：

> **FR-66.11 的啟用清單由十個收斂為八個** —— 即 `tracking_br_v1` 家族八個 variant。
> **整個 WP-54 tracking-pilot 家族（九個 block）一律不啟用。**

| 選項 | 內容 | 裁決 |
|---|---|---|
| **A** | 兩個都不啟用，清單收斂為八個 | ✅ **採用** |
| **B** | 六個 scored block 全開 ＋ 升 `TRACKING_PILOT_PROTOCOL_VERSION` → v3 | 未採用（升版是 research-visible act，屬另一個 WP 的範圍） |
| **C** | 只開那兩個、不升版 | 未採用（協定內 2/6 混淆 ＋ cohort key 無法分池） |

**落地方式**：本裁決不是「什麼都不做」——它以測試釘死。`DrillConfig.test.ts` 新增
`OQ-66.6：整個 tracking-pilot-v2 家族排除在外`，同時斷言**兩個入口**：

- `ALL_TRACKING_PILOT_CONFIGS`（九個 block 的普查表，協定 runner 解析 manifest 用）
- `TRACKING_PILOT_SCHEDULABLE_DRILLS`（WP-64 策展註冊表，Session Plan 排程用）

兩者對 `tracking_core_pr_pilot_v1_2deg_5dps` 是**不同的物件參考**（Surprises 1 之三），
所以只守一邊會讓同一個 `drillId` 依進入路徑帶兩種刺激。

**變異注入：3 個全數 RED**（還原置於 `try/finally`，SHA-256 逐位複驗）：

| 變異 | 注入內容 | 結果 |
|---|---|---|
| **MUT-CENSUS** | `buildTrackingCorePrPilotV1Cell()` 內加 `hitFeedback` ——「天真地照 T0 清單啟用 2deg_5dps」的實際寫法 | **RED**（1 failed / 6 passed） |
| **MUT-REVERSAL** | `buildReversalCell()` 內加 `hitFeedback` | **RED**（1 failed / 6 passed） |
| **MUT-CURATED** | 只在 WP-64 策展來源物件上加（＝同一 `drillId` 兩種刺激的那個失效模式） | **RED**（1 failed / 6 passed） |

MUT-CURATED 是三者中最有價值的一條：它是唯一「census 表看起來乾淨、協定 runner 行為不變、
但 Session Plan 排程同一個 id 時刺激不同」的變異，只有策展註冊表那半條斷言抓得到。

**若日後要啟用此家族**，必須連同 `TRACKING_PILOT_PROTOCOL_VERSION` 升版一起做，並補一列
protocol decision row —— 該常數註解自述「Bumping this is a research-visible act … may only
move together with a new protocol decision row」。這屬另一個 WP。

---

**待補的 T4 DoD 項目（需操作人員實機；本 session 為非互動，無法在 Pointer Lock 下真人瞄準）**：

- `tracking_br_v1` hitscan 實機三項證據：命中亮／刻意打偏不亮／停火後 ≤ `HIT_FEEDBACK_HOLD_MS` 熄滅（截圖或錄影）
- projectile variant：亮起延遲與該場匯出 `hit` 事件 `timeOfFlightMs` 數量級相符
- 兩場 tracking 匯出 JSON 的 `meta.targets.hitFeedback === 'flash'`（**靜態鍵面已於 §4 證實**，待實機匯出複驗）
- 未啟用對照 drill 的實機「命中不亮」證據（**靜態鍵面已於 §4 證實**）

這四項與 T5 的 focused e2e／A-B frame-time 是同一場實機作業，**已交接 T5 一次取得**；本 task 不宣稱已完成，亦不阻塞 T5 開工。

---

## T5 — 零 importer 常駐掃描、focused live e2e、A/B frame-time 與全量回歸（2026-09-12）

> 基準 commit：**`c2db9e4`**（T4 的 graphify 索引刷新）。開工與收尾 worktree 皆 clean。
> 本切片 **`git diff --stat -- src/ server/ research/ drills/` 為空**（T5 Invariant：純測試與量測）。
> 依 [T0 Surprises 5](#t0-執行期新增) 的紀律，下列每一組對照數都取自**同一 commit** 上的實測。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `tests/regression/wp66-hit-feedback-isolation.test.ts` | **新檔**，+5 測試：`src/data/`／`src/metrics/`／`research/` 三個 root 對七個具名符號零出現、掃描器自身的反證、匯出事件 union 拒收命中回饋型別 |
| `tests/e2e/hit-feedback-live.spec.ts` | **新檔**，+3 測試：啟用 drill 亮起＋衰減／換 drill 兩個方向／換場景往返後仍生效；對照 drill 命中但恆不亮 |

**零 production 改動**，既有 spec **零修改**（見 §7 影響面盤點）。

### 2. 零 importer 掃描：從一次性 grep 變成常駐閘（FR-66.12 / FM-5）

T1／T2／T3 各自跑過一次 `grep`，但一次性指令守不住未來。新檔掃描**版本庫內的原始檔**
（`.venv`／`out`／`__pycache__`／`.pytest_cache` 為 gitignore 產物，逐一具名略過）：

| 掃描 root | 實際掃到檔數 | 斷言下限 | 七個符號命中數 |
|---|---|---|---|
| `src/data/` | 13 | ≥ 10 | **0** |
| `src/metrics/` | 67 | ≥ 50 | **0** |
| `research/` | 320 tracked（`src` 114 py + `fixtures` 45 + …） | ≥ 100 | **0** |

符號集合：`targetHits`／`TargetHitRing`／`pushTargetHit`／`createTargetHitRing`／`resetTargetHitRing`／
`TARGET_HIT_CAP`／`HIT_FEEDBACK_HOLD_MS`（比 task file 指名的四個多三個——同一組具名符號沒有理由只守一半）。

**每個 root 另斷言掃到的檔數下限**，避免「根本沒掃到檔案所以通過」；再加一條反證：對
`src/state/` 掃 `pushTargetHit` **必須**命中。兩者合起來讓「掃描壞掉」與「真的乾淨」在結果上可區分。

**事件 union**：以 `parseExportPayload()` 實跑斷言 `target_hit`／`hit_feedback`／`targetHits`／`flash`
四個 discriminant 一律被拒收，並以同形狀的 `hit` 事件當對照組（必須通過）⇒ 上面的拒收是被
discriminant 擋下，不是 payload 本身壞掉。

**變異注入 MUT-SCAN-METRICS**：在 `src/metrics/mouseSampleGaps.ts` 檔首插一行 `// TargetHitRing`
⇒ **RED（1 failed / 4 passed）**。還原以 SHA-256 逐位複驗（`restored identical: True`），還原置於 `finally`。

### 3. live e2e：兩條只有實機才驗得到的線

`main.ts` 不在 vitest 覆蓋內，而本 WP 有兩處接線只存在於那裡：

1. `setHitFeedback()` 是否在四條路徑都生效（FM-3）；
2. `liveFrame` 的 `targetView.sync()` 是否**同時**傳 `hits` 與 `nowMs`——只傳其一會**靜默**退回本 WP 前的
   行為、不報錯（T3 交接的 Open Question）。

#### 3a. 三項使能技術（都在本切片第一次用上）

| # | 技術 | 為什麼需要 |
|---|---|---|
| 1 | `addInitScript` 掛 `window.__THREE_DEVTOOLS__ = new EventTarget()`，接 three `Scene` 建構子派發的 `observe`（three 0.185 `three.core.js:15135`） | `TargetView` 不對外暴露 mesh，`__aimDebug` 也沒有 scene。這條讓測試**唯讀**拿到場景物件，production code 零修改（T5 Invariant） |
| 2 | 真實 trusted `canvas.click()` 取 Pointer Lock | fire 事件經 `isLocked()` 閘（`InputSampler.ts:77`），不真的鎖就一發都不進 ring。WP-65 T6 spike A 已證實本環境可取真鎖 |
| 3 | 合成 `mousemove`（派發在 **`document`** 上）驅動視角 | `PointerLock.onMove` 監聽的是 `document` 的 `mousemove`；合成 `pointermove` 走的是 recorder 那條，且 `getCoalescedEvents()` 為空 ⇒ **轉不動視角**（實測 nudge ±20/±60 後 `aim` 逐位不變） |

目標 mesh 的辨識**不依賴任何 render 內部常數**（`TARGET_COLOR`／`HIT_EMISSIVE` 皆未匯出）：取最新建立的
`Scene`，在直接子節點中找位置落在某個存活可見目標 1 u 內的 mesh。程序房場景的牆與地板同為
`MeshStandardMaterial`（實測 6 個），只有這個位置條件排得掉它們。

#### 3b. 實測證據（本切片實際輸出）

| 探測點 | taps | hits | 亮起色 | 亮起窗（ms） | 同一顆目標「仍在但已暗」取樣 | 目標 mesh 數 |
|---|---|---|---|---|---|---|
| 啟用 drill（首次） | 3 | 2 | `ff8a3d` | 2308→2418 = **110** | 6 | 1 |
| 啟用 drill（換 drill 前） | 3 | 2 | `ff8a3d` | 2322→2441 = **119** | 6 | 1 |
| **對照 drill `tracking_v1`** | 2 | **2** | — | **未亮** | 0 | 1 |
| 啟用 drill（換回之後） | 3 | 2 | `ff8a3d` | 2332→2442 = **110** | 6 | 1 |
| 啟用 drill（換場景前） | 1 | 1 | `ff8a3d` | 309→418 = **109** | 6 | 1 |
| 啟用 drill（換場景往返後） | 3 | 2 | `ff8a3d` | 2341→2454 = **113** | 6 | 1 |

亮起窗 109–119 ms，對 `HIT_FEEDBACK_HOLD_MS = 120` 的量測顆粒為取樣週期（≈ 8 ms）。
對照 drill 的四發全部 `hit: true`（`offsetDeg` 0.18–0.72），`targetHits.total` 確實增加，
而 `emissive` 全程 `000000` ⇒ **閘住的是 render，不是 sim**。

#### 3c. 變異注入：三個，全數 RED

| 變異 | 注入內容 | 結果 |
|---|---|---|
| **MUT-WIRING** | `main.ts` 的 `targetView.setHitFeedback(resolveHitFeedback(config))` 改成 `void resolveHitFeedback(config)` | **3 failed / 0 passed** |
| **MUT-SYNCARG** | `targetView.sync(targets, alpha, sharedState.targetHits, now)` → `targetView.sync(targets, alpha)`（＝T3 指出的「靜默退回」失效模式本體） | **3 failed / 0 passed** |
| **MUT-CONTROL** | 對照 drill `tracking_v1` 的 config 注入 `hitFeedback: 'flash'` | **1 failed / 2 passed**——且失敗的正是「未列名的 drill 命中後仍亮起 —— 設定閘失效」那一條 |

三者皆以 SHA-256 逐位複驗還原（`restored_identical=True`），還原置於 `finally`（T3 Surprise 3 的教訓）。
MUT-SYNCARG 是本切片最重要的一條：那條線**沒有任何單元測試守得到**。

### 4. A/B frame-time 與 draw call（NFR-66.4 / 66.5 / FM-6）

同一個 drill（`tracking_br_v1__ads_off__hitscan__2deg`）、同一個場景、同一套操作，
**開**＝現行程式碼，**關**＝暫時把 `makeVariant()` 的 `hitFeedback` 以 config-gate 方式停掉（量完即還原，
SHA-256 複驗）。每個 config 跑 4 場 18 s：**第一場為暖機、捨棄**（GLTF 上傳與 shader 首編都落在那一場）。

| config | p50（ms） | p95（ms） | p99（ms） | max（ms） | frames | > `PERF_FLOOR_MS`(8.33) | > 2×p50 | draw calls（中位／最大） |
|---|---|---|---|---|---|---|---|---|
| ON run1 | 16.425 | 19.180 | 20.450 | 20.60 | 705 | 635 (90.1 %) | **0** | 118 / 119 |
| ON run2 | 16.490 | 19.580 | 20.580 | 20.75 | 682 | 619 (90.8 %) | **0** | 116 / 118 |
| ON run3 | 16.390 | 19.565 | 20.565 | 20.63 | 669 | 600 (89.7 %) | **0** | 117 / 117 |
| OFF run1 | 16.365 | 19.585 | 20.590 | 20.62 | 645 | 581 (90.1 %) | **0** | 114 / 115 |
| OFF run2 | 16.445 | 19.540 | 20.570 | 20.71 | 725 | 660 (91.0 %) | **0** | 117 / 118 |
| OFF run3 | 15.720 | 19.530 | 20.580 | 20.65 | 819 | 561 (68.5 %) | **0** | 117 / 119 |

- **p95 增量**：ON 中位 **19.565** vs OFF 中位 **19.540** ⇒ **+0.025 ms ≤ 0.2 ms** ✅。
  ON 的最大 p95（19.580）亦不高於 OFF 的最大 p95（19.585）。
- **over-budget window 不增加** ✅：ON 的比率 89.7–90.8 % 完全落在 OFF 的 68.5–91.0 % 之內。
  ⚠️ 必須誠實標明：`PERF_FLOOR_MS = 8.33` 是 **120 Hz 底線**，而本機 rAF 穩定在 ≈ 60 Hz（p50 ≈ 16.4 ms）
  ⇒ **幾乎每一幀都「超預算」**（`main.ts:1230` 對此已有既有註記）。這個指標在本環境**不具鑑別力**，
  真正能看出卡頓的是 `> 2×p50` 的長幀數——**兩個 config 的六場全部為 0**。
- **FM-6（首次命中那一幀不得有 pipeline 重編尖峰）** ✅：ON 的首次命中幀 delta = **17.785 / 11.595 ms**，
  OFF = **5.295 / 16.845 ms**，其後一幀 ON 17.215 / 12.025、OFF 17.530 / 17.810 —— 全部 ≤ 各自的 p99（≈ 20.6 ms），
  無任何尖峰。這與 T2 §2 的推論（clone 與模板同 program cache key ⇒ 同一 pipeline）一致。
- **draw call**：⚠️ **具名偏離 DoD 的「相同」字面**。`renderer.info.render.drawCalls` 在 br-field **不是定值**
  ——它隨 camera／目標移動造成的 frustum culling 逐幀變動，六場的中位落在 **114–118**、最大 115–119，
  **ON 與 OFF 的範圍互相覆蓋、無系統性差異**。NFR-66.5 的結構性根據仍成立且更強：目標本來就各自是一個
  `Mesh`，本 WP 只是把「共用一份 material」換成「逐 mesh 各持一份 clone」，**mesh 數不變**（T2 已以
  `poolSize` 啟用前後相同的單元測試釘住）⇒ 不可能新增 draw call。

### 5. Playwright 執行環境（T5 DoD 指名項）

**埠探針 —— 開跑前 5173 上有一個「不是 Playwright 起的」dev server，而且它是壞的：**

| 檢查 | 結果 |
|---|---|
| `netstat` | `:5173` **LISTENING**（PID 39876 = `D:\git\FPS_aim_analyst\node_modules\...\vite.js`，父鏈為 VS Code 整合終端機的 `npm run dev`，**非** Playwright 的 webServer）；`:4173` 無 |
| `GET :5173/`（HTML） | 回得了本 repo 的頁面（`<title>FPS Aim Analyst — counter-strafe trainer</title>`）⇒ **是本 checkout**，不是外部 app 或別的 worktree |
| 實際載入 | 每次都 `504 (Outdated Optimize Dep)`，`__aimDebug` 永遠不出現 ⇒ 該 server 的 dep 最佳化快取已過期，**重載也救不回來** |
| `GET :5173/api/history/health` | `{"ok":false,"error":{"code":"HISTORY_ROOT_LOCKED"}}` |
| 三份 `.history-root.lease` 的 pid | **41572 / 23124 / 42364 全部已死**；帶 10:52 時戳的那一份在 **`data/session-history/`** ⇒ 該 server 指向的是**真實研究資料 root**，不是 `.playwright-tmp/` |

`playwright.config.ts` 的 `reuseExistingServer: !CI` 會直接沿用它 ⇒ 不處理的話，本 WP 的所有 live e2e 都只會看到 504，而 history 相關 spec 會對著真實資料 root 跑。
**經使用者 2026-09-12 同意後停掉該 process**（連同其 `cmd`／`npm` 父節點），讓 Playwright 自己起兩個 server 並各自帶 `FPS_HISTORY_ROOT`。停掉後 `:5173`／`:4173` 皆無 LISTENING，全量回歸由 Playwright 自行啟動。

**`.playwright-tmp/history-dev/` participant 目錄數**：全量回歸**前 108**、**後 162**。
距 [e2e-history-root-accumulates] 記載的「上千個後 history-library 轉紅」仍有數量級餘裕，**未清理**。
**真實研究資料全程未被寫入**：`find data/session-history -name '*.json' | wc -l` 在全量前後皆為 **0**。

### 6. 全量回歸（五項，全部本切片實際輸出）

| 指令 | 結果 | 對照（同一 commit `c2db9e4` 上的實測基線） |
|---|---|---|
| `npm run typecheck`（×2） | **exit 0 / exit 0** | 同 T0–T4 |
| `npx vitest run tests/regression` | **exit 0** — 33 檔 / **324 passed** | 基線 32 檔 / 319 ⇒ **+1 檔、+5 tests**，全部是本切片的隔離掃描檔；其餘 **319 逐位一致**（NFR-66.2 ✅） |
| `npx vitest run`（全量） | **exit 0** — Test Files **263 passed / 1 skipped**；Tests **3186 passed / 2 skipped** | 基線（把本切片新檔移出後於同一 commit 實測）**262 檔 / 3181 passed** ⇒ **+1 檔、+5 tests，零測試由綠轉紅** |
| `npm run build` | **exit 0** — `dist/assets/index-3FOU0U0g.js` 1 242.51 kB（gzip 353.88 kB） | 既有 >500 kB chunk 警告，非本切片引入 |
| `npx playwright test --workers=1` | **exit 0** — **115 tests：115 passed / 0 failed**；17.9 min（最慢檔 `session-orchestrator.spec.ts` 12.1 min） | T0 基線 **112 passed / 0 failed** ⇒ **+3 = 本切片新增的三條**，**NFR-66.7 ✅**（通過數 115 ≥ 112、0 failed） |

> ⚠️ `npm run typecheck` 的兩份 tsconfig `include` 分別是 `["src"]` 與 `["server"]` ⇒ **`tests/` 從未被型別檢查**
> （WP-65 T6 §8 已記載同一缺口）。本切片新增的兩個檔案，型別正確性唯一的驗證是 `vitest` 與 `playwright` 實跑。
> 本切片**不**順手補 `tsconfig.test.json`：T5 的 Invariant 是純測試層、不夾帶範圍外改動。列為 T-exit 觀察項。

### 7. 既有 e2e 影響面盤點（T5 步驟 6）

**需要修改的既有 spec 數 = 0**，與預期一致。`git status --short` 收尾恰為兩個 `??` 新檔，**沒有任何既有 spec 出現在 diff 裡**
⇒ 「沒有任何既有斷言被放寬或刪除」不是宣稱，是 diff 的直接結果。

理由：命中回饋不改 DOM、不改 HUD、不改匯出鍵面（只有啟用清單上的 run 多一個 `meta.targets.hitFeedback`，
而既有 e2e 的匯出斷言都不落在 `tracking_br_v1` 家族上——T4 §5 已逐筆分類過）。WP-65 T6 踩到的那一類
「表面上不相關、實際上先驅動了 live drill runtime」的 spec 在本 WP 不構成影響面：本 WP 不改任何相位、
不改待命閘、不改任何等待窗。

### 8. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T5-a** | 以 `__THREE_DEVTOOLS__` 取得場景，而非在 `main.ts` 加一個 dev-only 觀測縫 | T5 的 Invariant 是「不修改任何 `src/` 檔案」。three 自己就對這個全域派發 `Scene`／renderer，掛一個 `EventTarget` 即是**唯讀**的既有機制。被推翻：把 `targetView` 掛上 `__aimDebug`——那是 production 改動，且會讓「render 內部結構」變成測試相依的公開面 |
| **T5-b** | 目標 mesh 以**位置吻合某顆存活目標**辨識，不用顏色 | `TARGET_COLOR`／`HIT_EMISSIVE` 都**不匯出**（T2 Decision T2-e 刻意的）。用顏色等於在測試裡複製一份 render 內部常數；用位置測的是「這顆 mesh 代表那顆目標」這個真正要問的性質。程序房的牆與地板同為 `MeshStandardMaterial`（實測 6 個），也只有位置條件排得掉 |
| **T5-c** | 對照 drill 選 `tracking_v1`（persistent），**不是** `spider-shot-v2` | 見 Surprises 1：非 persistent 的目標命中即撤，下一幀就沒有 mesh，「命中後恆不亮」會恆真。**這不是理論風險——`spider-shot-v2` 版本的對照測試在變異注入下是全綠的假綠燈** |
| **T5-d** | 「熄滅」綁 `TargetState.id`：只認**亮起當下那一顆**仍在場時的暗取樣 | 同一個理由的第二層。若只斷言 `lit === 0`，「目標消失」與「換了下一顆」都會滿足它。綁 id 之後，`sameTargetDarkAfterLit ≥ 6` 才是真的「它還在，而且已經暗了」 |
| **T5-e** | 瞄準控制器以**時間節流**（≥16 ms 一次修正），不以「`state.aim` 有沒有變」當閘 | 見 Surprises 2：後者只要有一次修正沒被觀測到變化就**永久卡死**——實測 `corrections` 停在 1、誤差凍在 0.638°、整整 2358 圈 20 秒一發都沒打，而且它看起來完全像「這一場 drill 特別背」 |
| **T5-f** | A/B frame-time 的「關」以暫時停用 `tracking_br_v1` 的 `hitFeedback` 取得，而非拿另一個 drill當對照 | 只有同一個 drill／場景／seed 才談得上 0.2 ms 的增量。量完即還原並以 SHA-256 逐位複驗；`git diff --stat src/` 收尾為空 |
| **T5-g** | 隔離掃描守**七個**符號（task file 指名四個） | 四個與另外三個（`createTargetHitRing`／`resetTargetHitRing`／`TARGET_HIT_CAP`）是同一組具名 API，沒有理由只守一半——任何一個出現在 `src/metrics/` 都是同一條紅線 |

### 9. Surprises & Discoveries（T5）

#### 1. 對照測試原本是假綠燈，被變異注入當場抓到——而抓到它的是 T2 已經寫過的同一個教訓

第一版的對照 drill 選了 `spider-shot-v2`（中心目標在 yaw 0，首發即中）。它的「命中後 `emissive` 恆為零」
**全綠**，看起來完美。注入 `hitFeedback: 'flash'` 到該 drill 的 config ⇒ **仍然全綠**。

根因：`spider-shot-v2` 的目標**不是 `persistent`**，命中同一個 sim tick 就 `markKilled`
⇒ 下一個 render frame 已經沒有那顆 mesh，`TargetView` 連上色的機會都沒有。
「命中後不亮」在那個 drill 上是**恆真**的，與設定閘一點關係都沒有。

換成 `tracking_v1`（`timing.presentationMs` ⇒ persistent，命中不撤除）之後，同一個變異注入
**RED（1 failed / 2 passed）**，且失敗的正是對照那一條。

⇒ 這與 [T2 Surprise 1](#6-surprises--discoveriest2)（「被初始化分支保護的行為，單幀測試量到的是初始化分支」）
是同一個形狀的第三次出現：**反證測試最容易因為「別的理由」而通過**。本 repo 已經三次靠變異注入才發現，
沒有一次是靠讀測試碼發現的。

#### 2. 「等狀態變了再動作」的控制迴圈會**永久卡死**，而且失敗樣態偽裝成「這場特別背」

瞄準控制器第一版以「`state.aim` 與上次修正時不同」當節流閘（理由正當：`state.aim` 一幀才更新一次，
而取樣迴圈 8 ms 一圈，不節流會過衝）。實測失效：

```
corrections: 1, iterations: 2358, loopMs: 19895, minAimErrDeg: 0.638,
taps: 0, hits: 0, phase: "ended", lockLostAtMs: -1
```

送出第一次修正後，那個閘再也沒有打開過 —— 迴圈整整跑了 **2358 圈 / 19.9 秒**，一發都沒扣，
瞄準誤差凍在 **0.638°**。改成**時間節流**（≥16 ms 一次）後，連續三次執行全綠，且每次都是
第一發就命中（`offsetDeg` 0.09–0.29）。

**這個 bug 值得記，是因為它的外觀**：它不會拋例外、不會 timeout，只會安靜地變成「這一場都沒打中」，
而那正是本檔失敗時最合理的解釋。診斷欄位（`corrections`／`iterations`／`minAimErrDeg`／`lockLostAtMs`）
是本 task 花最久才想到要加的東西，加上去之後**一次執行就定案**。它們因此留在 `ProbeResult` 裡。

#### 3. 取得 Pointer Lock 會讓視角**跳幾度**，而且發生時機不固定

`armAndTakeRealLock()` 之後第一次量到的視角偏移（`recenter.startedDeg`）有時是 0，有時是 **6.23°**。
Chromium 在鎖定當下會送出帶位移的 `mousemove`（指標歸位），時機可能落在歸位動作**之後**。
全量回歸第一次跑就是被這個咬到：`residualAimDeg 3.31`、13 發全落空（`offsetDeg` 3.2–9.7）。
處置是讓探測**全程把準心壓在設定點**，而不是「歸位一次後假設它待在那裡」。

⇒ **任何以 Pointer Lock ＋ 合成 `mousemove` 做瞄準的 e2e 都會遇到**：鎖定不是一個瞬間事件，
它的副作用可以晚於你的下一個動作抵達。

#### 4. 合成事件的兩條路不是同一條：`mousemove` 轉視角、`pointermove` 只進 recorder

`InputSampler.onPointerMove` 讀的是 `event.getCoalescedEvents()`，而合成 `PointerEvent` 的那個
陣列是**空的** ⇒ 合成 `pointermove` 對視角與 ring **完全沒有作用**（實測 nudge ±20／±60 後 `aim` 逐位不變）。
真正驅動視角的是 `PointerLock.onMove`，它監聽的是 **`document` 上的 `mousemove`**。
往 `window` 派發也到不了（document 在冒泡路徑上更早）。這兩件事各花了一次執行才確認。

#### 5. `armDrill()` 的脈衝與「真的持有鎖」互斥，順序是承重的

WP-65 的 arm helper 送的是一個 lock→unlock **脈衝**，離開時 `PointerLock.locked` 為 `false`。
若此時瀏覽器**仍真的持著**鎖，後續的點擊不會再派發 `pointerlockchange` ⇒ `locked` 永遠停在 `false`
⇒ 開火被 `isLocked()` 閘靜默吃掉（實測 26 次扣板機、0 進 ring）。
正確順序是 **`'armed'` 相位內先 `exitPointerLock()` → 再 arm（脈衝）→ 再以真實點擊取鎖**。
釋鎖落在 `'armed'` 也才不會被記成「錄製中掉鎖」（WP-65 FR-65.12）。

#### 6. `PERF_FLOOR_MS` 在本機**不具鑑別力**，真正看得到卡頓的是「長幀數」

`PERF_FLOOR_MS = 8.33` 是 120 Hz 底線，而本機 rAF 穩定在 ≈ 60 Hz ⇒ 幾乎每一幀都「超預算」
（六場的比率 68.5–91.0 %）。NFR-66.4 的「over-budget window 數不增加」照字面仍成立（ON 落在 OFF 的範圍內），
但它證明的東西很少。真正能回答 FM-6 的是 **`> 2×p50` 的長幀數：兩個 config 六場全部為 0**，
以及首次命中那一幀的 delta（11.6–17.8 ms，全部 ≤ p99）。

### Open Questions（T5 留給 T-exit）

- **A-66 驗收時的 draw call 判準**：DoD 寫「相同」，但 `renderer.info.render.drawCalls` 在 br-field 逐幀變動
  （六場中位 114–118）。建議 T-exit 把 A-66 的該條改寫為「**ON 與 OFF 的分布無系統性差異，且目標 mesh 數不變**」
  ——後者已由 T2 的 `poolSize` 單元測試釘死，是這條 NFR 真正的結構性根據。
- **`tests/` 沒有型別檢查**（見 §6 的警示框）。WP-65 T6 已列同一觀察項；兩個 WP 都刻意不夾帶
  `tsconfig.test.json`。若 T-exit 要處理，屬獨立切片（會牽動 `test:ci`）。
- **T4 交接的四項實機證據**：本切片以 e2e 取得了其中三項的**機器可讀**版本（命中亮／未列名 drill 命中不亮／
  ≤ `HIT_FEEDBACK_HOLD_MS` 熄滅，見 §3b）。**未取得**的是：①「刻意打偏不亮」的**正面**證據
  （本檔的探測只在就位時扣板機，不刻意打偏——脫靶不亮已由 T1 的六條反證單元測試釘死）；
  ② **projectile variant 的亮起延遲與 `timeOfFlightMs` 數量級相符**（本檔只跑 hitscan variant）。
  兩者皆非阻塞項，建議 T-exit 以操作人員實機錄影補齊，或明帳記為「以單元層證據替代」。

---

## T-exit — 驗收閘（A-66.1～A-66.12）與 GD-42 入帳（2026-09-12）

> 驗收基準：**`HEAD = 7448d34`**（worktree clean），WP-66 production range = `9a03562..7448d34`
> （`9a03562` 即 [§T0.2](#2-基線凍結nfr-662-667-的對照基準) 凍結的基線 commit）。
> 本閘**未修改任何 `src/`／`tests/` 檔案**：range 內的程式碼全部由 T1–T5 落地，本節只做驗收、入帳與狀態翻轉。
> 下列每個數字皆為**本閘實際執行輸出**，非引用 T1–T5 的記載。

### 1. A-66.1～A-66.12 證據矩陣

| 驗收 | 結論 | 具名證據（本閘實跑） |
|---|---|---|
| **A-66.1** | ✅ 環形格 sim 唯寫、render 唯讀，且**未新增任何命中判定** | `git diff --stat 9a03562..HEAD -- src/sim/HitDetector.ts src/ballistics/sweptHit.ts src/sim/TargetManager.ts` **輸出為空**（`ballisticRaycast`／`targetAabb` 定義於 `SimLoop.ts`，其 diff 見右）。`SimLoop.ts` 的**完整** diff = 1 個 import 改寫 + **恰 2 行** `pushTargetHit`（[:361](../../../../../src/loop/SimLoop.ts#L361) projectile、[:473](../../../../../src/loop/SimLoop.ts#L473) hitscan），判定式／`markKilled` 條件／事件欄位逐字未動 |
| **A-66.2** | ✅ 六條「不得寫入」反證全綠 | `src/loop/__tests__/wp66-target-hit-ring.test.ts`：`脫靶 → 零筆，且 impacts.total > 0（證明彈著格不是命中訊號，FR-66.3）`／`occlusion blocker 擋下 → 零筆（WP-45 的隔牆未命中免費繼承）`／`未過速度閘（\|vx\| ≥ accuracyThreshold）→ 零筆，即使射線幾何對準目標`／`無存活目標 → 零筆`／`未過速度閘的飛行彈（accurate === 0）掃過目標 → 零筆`／`逾 maxRangeU 消滅 → 零筆`。本閘 `npx vitest run` **exit 0** |
| **A-66.3** | ✅ 跨 4 種 render FPS 逐位一致 | `src/loop/__tests__/wp66-hit-ring-determinism.test.ts`：`同一輸入序列在 4 種 render 幀序列下：total / cursor / 逐槽 id 與 seq 逐位一致`，於本閘全量 vitest 內通過 |
| **A-66.4** | ✅ 命中態跟身分走、不跟 pool 槽位走 | `src/render/TargetView.test.ts`：`FM-2:目標撤除後同一 pool 槽位被新目標取用,新目標不亮`（以 `toBe` 斷言確實是同一個 mesh 物件）＋ `本幀未用到的 pool mesh 一併熄滅(FM-2 第二條洩漏路徑)` |
| **A-66.5** | ✅ render 對 `SharedState` 零寫入 | `src/render/TargetView.test.ts`：`FM-4:sync() 對環形格零回寫(total/cursor/逐槽 id 與 seq 全數不變)`。程式面佐證：`TargetView` 的高水位是**私有** `#syncedSeq`，ring 只被讀 |
| **A-66.6** | ✅ 未啟用時逐位不變（三項齊備） | ① `FM-1 反證:不帶 hits/nowMs 時,材質三屬性與本 WP 前逐位相同` ＋ `setHitFeedback 未啟用:逐幀帶 ring 且期間有命中,仍不亮(FM-1)`；② [`metadata.test.ts:665`](../../../../../src/data/metadata.test.ts#L665) 釘死未列名 drill 的 `Object.keys(targets) === ['hitbox']`（＝[§T0.3](#3-既有匯出鍵面-digestt3additive-不動既有鍵面t4只多一欄的唯一對照基準) 基線逐字）；③ 本閘 `git diff --stat 9a03562..HEAD -- '*fixtures*' '*golden*' '*.json'` 對 fixture **零命中**（僅 `graphify-out/` 索引），`npx vitest run tests/regression` **324 passed**（= 319 基線 + T5 新檔 5） |
| **A-66.7** | ✅ 四個 wiring 點全部到位 | 本閘 `grep -n "targetView" src/main.ts` 完整輸出 **9 行**：`:350` 建構／`:351` setShape／`:1070` 註解／**`:1075` `setHitFeedback`**／`:1454` dispose／`:1465` 重建／`:1519`、`:1559` setShape／**`:1911` `sync(..., sharedState.targetHits, now)`**。**一處覆蓋四條路徑的結構性證據**：`drillRunner.start()` 的五個呼叫端（`:1093`／`:1428`／`:1439`／`:1520`／`:1560`）涵蓋 §0.4 全部四點；本閘另讀碼複驗 `installSceneLoad()` 的兩個呼叫端（`:1507`→`:1520`、`:1551`→`:1560`）之間**無 `await`、無 `return`** ⇒ 涵蓋關係是結構的、不靠慣例。e2e 兩條見 §4 的 `ok 35/36/37` |
| **A-66.8** | ✅ metadata additive、跨語言可讀 | TS：`src/data/exportPayloadSchema.test.ts` round-trip 兩形狀 + 舊 payload 不生預設值，本閘全量 vitest 綠。Python：本閘以**未修改**的 `research/src/modules/ingest/algorithms/loader.py::load_export()` 實跑 → `with hitFeedback -> ticks (2038, 14) events (150, 24)`／`without -> ticks (2038, 14) events (150, 24)`，`meta.targets` 帶新鍵為 `{'hitbox': {...}, 'hitFeedback': 'flash'}`、舊 payload 為 `{'hitbox': {...}}` **未長出預設值**。`git diff --stat 9a03562..HEAD -- research/ drills/` **輸出為空**（C-D1 ✅） |
| **A-66.9** | ✅ 啟用清單逐字等於收斂結果，且不含任何 formal assessment 協定 | 本閘**靜態全量普查**：`grep -rn "hitFeedback" src/ drills/ --include=*.ts --include=*.json`（排除 `*.test.ts`）顯示全 repo **唯一**把該欄位賦值進 drill config 的位置是 [`tracking_br_v1.ts:98`](../../../../../src/drill/tracking_br_v1.ts#L98) 的 `hitFeedback: HIT_FEEDBACK`；`drills/*.json` **零命中**。runtime 複驗（`vite-node` 實跑 `trackingBrVariants`）列印八個 id 全為 `flash`、`distinct hitFeedback values = ['flash']`（集合大小 1），與 [README §1.4a](README.md#14a-oq-收斂結果t0-定案2026-09-12) 第 1–8 列**逐字相同**。`protocolVersion` 零變更：`git diff --stat 9a03562..HEAD -- src/drill/protocolVersion.ts src/drill/assessmentProtocolVersion.ts src/display/brTrackingProtocol.ts src/pilot/protocolFreeze.test.ts …` **輸出為空** |
| **A-66.10** | ✅ 效度斷代已成明帳（三處同一句） | ① 本檔 [§T4](#t4--在指名的-tracking-drill-啟用命中回饋2026-09-12)；② [stage13 README §2](../README.md) WP-66 列；③ 本閘落帳的 **GD-42 / D-66-4**。同一句摘要：**自 2026-09-12 起 `tracking_br_v1` 家族八個 variant 全數帶命中視覺回饋；此日期之後的資料刺激與之前不同、不可混池比較；逐 run 的判別依據是 `meta.targets.hitFeedback === 'flash'`，不是收集日期。** 程式內第四個掛點：[`tracking_br_v1.ts` 的 `HIT_FEEDBACK` 常數註解](../../../../../src/drill/tracking_br_v1.ts#L27) |
| **A-66.11** | ✅ 零洩漏進資料層／指標層 | `tests/regression/wp66-hit-feedback-isolation.test.ts`：`src/data/ 對命中回饋的全部具名符號零出現`／`src/metrics/ …`／`research/ …`（七個具名符號 × 三個 root）＋ `掃描確實會咬：對一個已知存在的符號跑同一條掃描必須命中 src/state/`（反證）＋ `匯出事件 union 不含任何命中回饋事件型別（parser 層拒收）`。本閘 `npx vitest run tests/regression`：**33 檔 / 324 passed** |
| **A-66.12** | ✅ 效能無退步（draw call 判準具名改寫，見 §3） | T5 同場 A/B（六場，ON/OFF 各 3）：p95 **19.565 vs 19.540 ⇒ +0.025 ms ≤ 0.2 ms**；over-budget window ON 89.7–90.8 % 落在 OFF 68.5–91.0 % 之內（**不增加**）；首次命中幀 delta ON 17.785／11.595 ms、OFF 5.295／16.845 ms，全部 ≤ 各自 p99（≈20.6 ms）⇒ **FM-6 無 pipeline 重編尖峰**；`> 2×p50` 長幀 ON/OFF 六場**全部 0**。draw call 見 §3 |

### 2. 最終 gate（全部本閘實跑）

| Gate | 結果 | 對照 |
|---|---|---|
| `npm run typecheck` ×2 | **exit 0 / exit 0** | 同 T0–T5 |
| `npx vitest run` | **exit 0** — Test Files **263 passed / 1 skipped (264)**；Tests **3186 passed / 2 skipped (3188)**；11.46 s | T0 基線 **3128 / 2**（260 檔）⇒ **+58 tests / +3 檔**；逐條可對帳：T1 +17、T2 +13、T3 +20、T4 +2、T5 +5 = **+57**，餘 **+1** 為平行 session 落在 range 內的既有增量。**零測試由綠轉紅** |
| `npx vitest run tests/regression` | **exit 0** — **33 檔 / 324 passed** | T0 基線 **32 檔 / 319** ⇒ **+1 檔 / +5 tests**（全部為 T5 的 `wp66-hit-feedback-isolation.test.ts`）；**其餘 319 逐位一致**，NFR-66.2 ✅ |
| `npx playwright test --workers=1` | **exit 0（Playwright 自身的 exit code，非 pipeline 尾端指令的）** — **115 tests：115 passed / 0 failed**；18.4 min | T0 基線 **112 passed / 0 failed** ⇒ **+3 = T5 新增的三條**，**NFR-66.7 ✅**。⚠️ 本閘第一輪曾 **2 failed**，根因為執行環境干擾而非程式，逐條記於 §4 |
| `npm run build` | **exit 0** — 200 modules，`dist/assets/index-3FOU0U0g.js` **1 242.51 kB**（gzip 353.88 kB），2.29 s | 既有 >500 kB chunk 警告，非本 WP 引入；bundle 檔名與 T5 **逐字相同** |

**執行環境（比照 T5 §5 的埠探針）**：開跑前 `:5173`／`:4173` 皆**無** LISTENING（無外部 dev server 佔用，未重演 T5 的 504 情境），Playwright 自行啟動兩個各帶 `FPS_HISTORY_ROOT` 的 server；收尾兩埠皆已釋放。**真實研究資料全程未被寫入**：`find data/session-history -name '*.json' | wc -l` 在全部執行前後皆為 **0**。`.playwright-tmp/history-dev/` participant 目錄數 **162 → 216**（距 [e2e-history-root-accumulates] 記載的上千個門檻仍有數量級餘裕，**未清理**）。收尾 `git status --short` 為空。

### 3. 具名判準改寫：A-66.12 的 draw call 條款（承 [T5 Open Questions](#open-questionst5-留給-t-exit)）

[T-exit-gate.md](T-exit-gate.md) 的 A-66.12 原文寫 draw call「**相同**」。**本閘採納 T5 的建議改寫為**：

> **ON 與 OFF 的 draw call 分布無系統性差異，且目標 mesh 數（`poolSize`）啟用前後不變。**

理由：`renderer.info.render.drawCalls` 在 br-field **不是定值**——它隨 camera 與目標移動造成的 frustum culling 逐幀變動，T5 六場的中位落在 **114–118**、最大 115–119，**ON 與 OFF 的範圍互相覆蓋、無系統性差異**。拿「逐位相同」當判準，會讓一個本來就會抖動的量偽裝成迴歸訊號。NFR-66.5 真正的結構性根據反而更強：目標本來就各自是一個 `Mesh`，本 WP 只是把「整池共用一份 material」換成「逐 mesh 各持一份 clone」，**mesh 數不變** ⇒ 不可能新增 draw call。這一條已由 T2 的單元測試 `逐 mesh 各持一份 material clone(不共用),且 poolSize 與啟用前相同(NFR-66.5)` 釘死，是可持續回歸的證據，而非一次性量測。

### 4. 全量 e2e 的第一輪 2 failed —— 環境干擾，非程式（必記）

本閘第一次跑全量 Playwright 得到 **2 failed / 113 passed**，兩條皆在 `tests/e2e/hit-feedback-live.spec.ts`：

| 失敗 | 症狀 |
|---|---|
| `:502`（命中當下亮起，HOLD 窗內熄滅） | `命中未發生（taps=0, lastShots=[]）`、`litSamples = 0`；page snapshot 仍停在「點擊以鎖定滑鼠視角」⇒ **Pointer Lock 從未取得**，一發都沒扣 |
| `:541`（換場景後仍生效） | `armDrill` 的 `.poll(...).not.toBe('armed')` **10 s timeout**，相位始終停在 `'armed'` ⇒ 同樣是取鎖沒成 |

**根因**：該 spec 是全 115 條裡**唯一需要真實 Pointer Lock** 的（其餘走 WP-65 的合成 `armDrill()` 脈衝）。而本閘在那一輪執行期間**平行跑了 `npx vite-node`（A-66.9 的 roster 普查）與 `research/.venv` 的 python（A-66.8 的 `load_export()` 複驗）**——兩者都是秒級的 CPU 尖峰與新進程，足以讓 headed Edge 掉焦點／錯過取鎖的時序窗。

**處置與證據**：① 單獨重跑該 spec（期間不執行任何其他指令）⇒ **3 passed (1.3m)**，數值與 T5 §3b 同量級：亮起色 `ff8a3d`、亮起窗 **108／114／119／120／121 ms** 對 `HIT_FEEDBACK_HOLD_MS = 120`、對照 drill `tracking_v1` **3 taps / 3 hits / litSamples 0 / firstLitAtMs −1**、`sameTargetDarkAfterLit = 6`；② 之後**全量重跑且全程不下任何其他指令** ⇒ **115 passed / 0 failed**，該 spec 為 `ok 35/36/37`，`test-results/` 零失敗產物。上表 §2 記的是**第二輪**結果。

⇒ **給後續 task 的教訓（比本 WP 更廣）**：`hit-feedback-live.spec.ts` 這類依賴**真實** Pointer Lock 的 spec，**不能與任何其他指令同時跑**。這不是 flaky test，是一個有明確機制的環境相依。WP-65 T6 與本 WP T5 都各自繞過同族的時序脆弱性一次（T5 Surprises 3／5），本閘是第三次 ⇒ 值得升級為一條明帳紀律：**跑全量 e2e 期間應視為機器獨佔**。

### 5. 交付範圍複驗（本閘實跑）

| 檢視 | 結果 |
|---|---|
| `git diff --stat 9a03562..HEAD -- research/ drills/` | **空**（C-D1 ✅；drill 值變更只發生在 `src/drill/tracking_br_v1.ts`） |
| `git diff --name-only 9a03562..HEAD`（排除 `src/`／`tests/`／`docs/`） | 僅 `CONTEXT.md` 與 `graphify-out/`（`GRAPH_REPORT.md`／`graph.html`／`graph.json`／`manifest.json`）⇒ **無 fixture、無 golden、無 payload 變動** |
| production（非測試）改動行數 | `SharedState.ts` +71／`TargetView.ts` +120／`SimLoop.ts` +15／`main.ts` +23／`DrillConfig.ts` +26／`schema.ts` +11／`metadata.ts` +16／`exportPayloadSchema.ts` +11／`tracking_br_v1.ts` +20／`fpsTestHarness.ts` +3 ≈ **316 行**，分佈於 T1–T4 四個原子 commit（＋各自的 graphify 索引 commit），每個切片皆在可審閱範圍內 |
| `TargetState`／`ReplayTargetView`／replay contracts | 未出現在 range diff ⇒ [§2.1](README.md) 的 out-of-scope 全數成立（replay 先不同步，D-66-6） |

### 6. 讀碼複驗發現的一處註解過強（FYI，不阻塞、不改碼）

[`TargetView.#flashUntil`](../../../../../src/render/TargetView.ts#L55) 的註解寫「過期即刪 ⇒ 大小恆 ≤ 同時顯示的目標數」。**實際語意略弱於這句話**：過期刪除發生在 `#paintHit()`，而它只對**本幀可見**的目標呼叫；若某目標在亮起期間被撤除且不再可見，它的鍵會留到 drill 邊界才被清（`#ingestHits()` 的 `total` 倒退分支／`setHitFeedback()`／`dispose()` 三者皆 `clear()`）。

**為什麼不改**：① 目前啟用清單**全部**是 `persistent: true` 的單目標 tracking drill ⇒ 實際鍵數恆為 1，該命題在現行 roster 上為真；② 上界仍是「單場 run 內的相異目標 id 數」，且每場邊界必清，不構成無界成長；③ 本閘的 Invariant 是不改 `src/`，改碼會夾帶一個未被 T1–T5 測試矩陣覆蓋的行為變更。**留為觀察項**：若日後把回饋啟用到非 persistent／多目標的 drill（例如 micro-flick v8/v9 的 `population.activeCount: 3`），應同時把該註解改成「drill 邊界清空」，或在隱藏 pool mesh 的迴圈內一併刪鍵。已列入 Open Questions。

### 7. T4 交接的四項實機證據 —— 三項已取得，兩項明帳以單元層證據替代

| # | 項目 | 狀態 |
|---|---|---|
| 1 | 命中當下亮起 | ✅ live e2e（`ff8a3d`，本閘重跑複驗） |
| 2 | 停火後 ≤ `HIT_FEEDBACK_HOLD_MS` 熄滅，且熄滅時被打中的那顆仍在場 | ✅ live e2e（亮起窗 108–121 ms；`sameTargetDarkAfterLit = 6`） |
| 3 | 未列名對照 drill 命中不亮 | ✅ live e2e（`tracking_v1` 3 hits / 0 lit samples） |
| 4 | **刻意打偏不亮**的正面實機證據 | ⚠️ **未取得**，明帳**以單元層證據替代**：T1 的六條反證（脫靶／occlusion／速度閘 ×2／逾射程／無目標）在 sim 層釘死「不命中就不寫環形格」，且 T5 的 MUT-CONTROL 變異注入證明對照那條會咬。live 探測只在就位時扣板機；補這一項需操作人員實機錄影 |
| 5 | **projectile variant 亮起延遲與 `timeOfFlightMs` 數量級相符** | ⚠️ **未取得**（live e2e 只跑 hitscan variant）。這是 **D-66-5 已接受的條件差異**的實機佐證，不是正確性前提：延遲來自既有 `hit` 事件的落點時刻，而環形格寫入點就在該事件的同一個 `if` 區塊內（A-66.1）⇒「延遲等於 `timeOfFlightMs`」是結構保證。列為 Open Question 供後續實機作業補齊 |

⇒ 兩項皆**非阻塞**，且都不是「沒驗」而是「以較弱但具名的證據替代」，**不以「已完成」宣稱**。

### 8. Decision Log（T-exit）

| # | 決策 | 理由 |
|---|---|---|
| **Tx-a** | A-66.12 的 draw call 條款**具名改寫**為「分布無系統性差異 + `poolSize` 不變」 | 見 §3。原字面「相同」會把一個逐幀抖動的量當成迴歸訊號；改寫後的判準既可持續回歸（單元測試），又誠實描述量測到的東西 |
| **Tx-b** | 第一輪 2 failed **不以「flaky，重跑就好」帶過**，而是逐條記錄症狀、根因與兩段式複驗 | 「重跑就綠」是本 repo 最貴的一句話：它會把一個有明確機制的環境相依（真實 Pointer Lock 要求機器獨佔）藏起來，下一個人只會再踩一次。T5 已因同族時序脆弱性繞過兩次（Surprises 3／5），本閘是第三次 ⇒ 值得升級成明帳紀律 |
| **Tx-c** | `#flashUntil` 的註解過強**只記不改** | 本閘 Invariant 是不改 `src/`；且該命題在現行啟用清單（全 persistent 單目標）上為真、上界有界、每場邊界必清。改碼會讓 T-exit 夾帶未經測試矩陣覆蓋的行為變更 |
| **Tx-d** | GD-42 入帳前**重查**當下最大 GD | [GD-35](../../../DECISIONS.md) ② 紀律。本閘實查：`DECISIONS.md` 已落帳最大 = **GD-41**，`GD-42`／`GD-43` 在該檔**零命中**；GD-43 由 [WP-67](../wp-67-export-opening-protocol-marker/README.md) 預約中（其 README §IDs 明載）⇒ **GD-42 未被取用，不需順延** |

### 9. GD-42 入帳

草稿 D-66-1～D-66-6 補上實際結果後已寫入 [DECISIONS.md](../../../DECISIONS.md)（最新在上，置於 GD-41 之前）。入帳前的編號重查見 Tx-d。

### 10. 狀態翻轉

- [task-checklist.md](task-checklist.md)：T-exit 列翻 ✅，Package Definition of Done 十二項全部打勾。
- [stage13 README §2](../README.md)：WP-66 列翻 ✅ + 具名證據摘要；§3 的「WP-66 / GD-42 編號與落點偏離」條目補上 T-exit 落帳結果。
- [`docs/exec-plan/README.md §2`](../../../README.md)：WP-66 列由 ⬜ 翻 ✅（該列於 T0–T5 期間未被更新，本閘一次補齊）。

> ⚠️ 後兩份是多 session 共編索引：本閘**只 stage 自己那幾行**，未整檔覆蓋。

### 11. 限制（誠實界線）

- 本閘的 live e2e 以受控的合成 `mousemove` ＋ 真實 Pointer Lock 驅動瞄準，證明的是 **production wiring 在真瀏覽器成立**；它**不**代替真人受試者對「命中回饋是否改善體驗／是否改變行為」的判斷。後者正是 GD-42 D-66-4 記為**效度斷代**的原因。
- A-66.12 的 frame-time 數字取自 T5 的同場 A/B（本閘未重量測）。本閘在其後**未改動任何 `src/`**（§5 已以 diff 證明），故該組數字對 `HEAD = 7448d34` 仍然成立。
- `tests/` 仍未納入 `npm run typecheck`（兩份 tsconfig 的 `include` 分別為 `["src"]`／`["server"]`）——WP-65 T6 與本 WP T5 已各記一次，本閘**同樣不夾帶** `tsconfig.test.json`（會牽動 `test:ci`，屬獨立切片）。新增測試檔的型別正確性目前唯一的驗證是 `vitest`／`playwright` 實跑。

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
| **D-66-4** | 啟用清單逐一列名 —— **實際啟用為八個 drill id，生效 2026-09-12**：`tracking_br_v1` 家族全部八個 variant（commit `cfe2e63`）。T0 原列十個，經 **OQ-66.6**（使用者 2026-09-12 裁決 A）收斂為八：`tracking_core_pr_pilot_v1_2deg_5dps` 與 `tracking_reversal_pilot_v1_high` 是 `tracking-pilot-v2` 已版本化協定六個 scored block 中的兩個，啟用會造成協定內 2/6 混淆且 cohort key 無法分池 ⇒ **整個 WP-54 tracking-pilot 家族（九個 block）一律排除**，以測試釘死兩個入口。一律排除的還有 `hold_track_v1` 等已凍結的 assessment 協定。啟用即構成**效度斷代**，由 `meta.targets.hitFeedback` 逐 run 自述 |
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
| **OQ-66.1** | 哪些 drill 啟用命中回饋？ | ✅ **T0 收斂（2026-09-12）：照預設（十個 id）→ 經 OQ-66.6 於 T4 修訂為八個**。實際啟用 = `tracking_br_v1` 家族八個 variant；T0 原列的兩個 WP-54 curated Tracking Pilot config 經執行期讀碼證實是 `tracking-pilot-v2` 已版本化協定的 scored block，**使用者 2026-09-12 裁決排除**（選項 A）。一併排除 `hold_track_v1` 等已凍結協定。八個 id 逐字清單見 [§T4](#t4--在指名的-tracking-drill-啟用命中回饋2026-09-12)。 | 使用者 | T0（T4 修訂）|
| **OQ-66.2** | `HIT_FEEDBACK_HOLD_MS` 取值 | ✅ **T0 收斂（2026-09-12）：照預設 120 ms** | 使用者 | T0 |
| **OQ-66.3** | 命中態以 `emissive` 呈現 | ✅ 規劃期已定（D-66-P4）；T0 未推翻 | 規劃者 | — |
| **OQ-66.4** | 是否需要 `meta` 層級的效度斷代版本標記 | ✅ **T0 收斂（2026-09-12）：照預設否**。`meta.targets.hitFeedback` 逐 run 自述已足以分池；WP-65 交接的版本標記工作已另立為 [WP-67](../wp-67-export-opening-protocol-marker/README.md)（`meta.opening`），本 WP **不夾帶、不改為相依**。 | 使用者 | T0 |
| **OQ-66.5** | replay 何時補上命中回饋？（技術債 §3.2；觸發條件 = replay 被用於**向受試者**回放而非研究者檢視） | ⬜ 開放（非阻塞） | 使用者 | 本 WP 之後 |
| **OQ-66.6** | T0 清單上的兩個 WP-54 pilot id 是 `tracking-pilot-v2` 已版本化協定的 scored block，要不要啟用？ | ✅ **T4 收斂（2026-09-12）：選項 A** —— 兩個都不啟用，FR-66.11 清單由十個收斂為八個（`tracking_br_v1` 家族）；**整個 WP-54 tracking-pilot 家族（九個 block）一律排除**，以 census 表＋策展註冊表兩個入口的斷言釘死。日後若要啟用，必須連同 `TRACKING_PILOT_PROTOCOL_VERSION` 升版一起做，屬另一個 WP。詳見 [§T4 Open Questions](#open-questionst4) | 使用者 | T4 |
| **OQ-66.7** | 命中回饋若要啟用到**非 persistent／多目標**的 drill（例如 micro-flick v8/v9 的 `population.activeCount: 3`），`TargetView.#flashUntil` 的過期清理需要補強嗎？ | ⬜ **開放（非阻塞；現行啟用清單上恆為真）**。過期刪鍵只發生在 `#paintHit()`，而它只對**本幀可見**的目標呼叫 ⇒ 亮起期間被撤除的目標，其鍵會留到 drill 邊界才清（三個 `clear()` 點：`#ingestHits()` 的 `total` 倒退分支／`setHitFeedback()`／`dispose()`）。現行八個啟用 drill 全是 `persistent: true` 單目標 ⇒ 鍵數恆為 1。啟用到多目標 drill 時，應同時把該註解改為「drill 邊界清空」或在隱藏 pool mesh 的迴圈內一併刪鍵。詳見 [§T-exit.6](#6-讀碼複驗發現的一處註解過強fyi不阻塞不改碼) | 後續 WP | 啟用非 persistent drill 前 |
| **OQ-66.8** | T4 交接的兩項實機證據（**刻意打偏不亮**的正面證據、**projectile 亮起延遲與 `timeOfFlightMs` 數量級相符**）何時補齊？ | ⬜ **開放（非阻塞）**。T-exit 明帳**以單元層證據替代**：前者由 T1 的六條反證 + T5 的 MUT-CONTROL 變異注入覆蓋；後者由「環形格寫入點就在既有 `hit` 事件的同一個 `if` 區塊內」結構保證（A-66.1）。兩者皆需操作人員在實機錄影補齊，屬**實機作業**而非程式工作。詳見 [§T-exit.7](#7-t4-交接的四項實機證據--三項已取得兩項明帳以單元層證據替代) | 操作人員 | 下一次 `tracking_br_v1` 實機場次 |
| **OQ-66.9** | 全量 e2e 期間的**機器獨佔**要不要寫成工具層的硬約束（而非只靠紀律）？ | ⬜ **開放（非阻塞）**。`tests/e2e/hit-feedback-live.spec.ts` 是全 115 條裡唯一需要**真實** Pointer Lock 的 spec，與其他指令並行會靜默失敗成「這場都沒打中」。本閘第一輪即因此 2 failed（詳見 [§T-exit.4](#4-全量-e2e-的第一輪-2-failed--環境干擾非程式必記)）。WP-65 T6／本 WP T5 已各繞過同族脆弱性一次，本閘是第三次。**第四次（2026-09-12 稍晚，WP-66 後續的 `tracking_reversal_high_feedback_v1` 切片）**：全量 e2e 出現 1 failed —— `session-orchestrator.spec.ts:992`（WP-62 逐列武器實跑）拋 `Cannot read properties of undefined (reading 'sessionPlanState')`，**harness 物件消失而非斷言不符**。根因已查明且**不是本機指令**：平行 session 於 **21:44** 提交 `0d84349`（`fix(ui)`，改的是 **`src/main.ts`**）—— 正好落在該輪 e2e 執行中間，vite HMR 對 app 進入點的改動觸發 **full page reload**，`__aimDebug` 一併消失（與 [WP-65 T0 §4](../wp-65-drill-arming-and-countdown/progress.md) 記載的機制完全相同）。單獨重跑該 spec 綠、乾淨全量重跑 **115 passed / 0 failed**。⇒ **這條 OQ 的範圍因此要擴大**：不只「自己不要並行下指令」，而是**跑全量 e2e 期間整個 repo 必須靜止**——任何 session 改 `src/`（尤其 `main.ts`）都會讓依賴 `__aimDebug`／`__fpsTest` 的 spec 以「查不出原因」的樣態轉紅。這也是為什麼它不能被記成 flaky：它每次都有確切機制。 | 後續 WP | — |
