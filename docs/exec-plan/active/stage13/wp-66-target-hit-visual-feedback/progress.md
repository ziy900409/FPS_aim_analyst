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
