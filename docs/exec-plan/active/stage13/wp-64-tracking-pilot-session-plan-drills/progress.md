# WP-64 — Progress

> Plan：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)

## Current status

✅ **T-exit 完成（2026-09-11）。** 兩個 curated Pilot block 已可排程、可編譯、可載入，且在真 Edge 由 custom Session Plan 跑完、匯出並與 formal Tracking Pilot 路徑隔離。

- T1 新增 [`src/session/trackingPilotSchedulableDrills.ts`](../../../../../src/session/trackingPilotSchedulableDrills.ts)：family / declared weapon / runtime registry 三者**同一來源**；runtime entry 與 Controls surface filter 亦由 T2 提前落地（D-64-T1-1）。
- T2 新增 [`src/drill/drillRegistry.ts`](../../../../../src/drill/drillRegistry.ts)：**OQ-64.5 的測試 seam 已關閉**——`resolveAvailableDrill()` / `researcherControlsDrills()` 是 `main.ts` 實際呼叫的同一對函式，「載得到」與「不顯示」兩側皆被執行而非掃字串（D-64-T2-1）。
- T3 只動測試與文件（`src/` 零 diff）：`session-orchestrator.spec.ts` +2 test（DOM picker／live run），
  runbook 與 operator-manual 補上三項明文禁令。順手修掉 T1 留下的一條紅燈 e2e（picker option 36→38，T3 §3）。
- 最終 T-exit：typecheck ×2、build、全量 Vitest（3014 passed / 256 files）與 Edge（21 passed / 14.3 min）全 exit 0；三道 mutation 皆被咬住。
- ⚠️ **T2 發現**：curated block 的 primary seed 在 `targets.trackingTrajectory.seed`，`meta.rngSeed` 實為 `DEFAULT_RNG_SEED`——稽核要對 `meta.spawn.trackingTrajectory`（見下方 T2 §3）。

<details>
<summary>T0 entry gate（2026-09-10）已通過</summary>

✅ **T0 entry gate 通過（2026-09-10）；T1 可開工。**

- 編號重查：**`WP-64` / `GD-40` 維持不變**（證據見下方 T0 §1）。
- 四個 OQ 全部關閉，**全數落在 README 預設**；scope / estimate 不變（4.5–6 dev-days）。
- 選中集合凍結為 **`tracking_core_pr_pilot_v1_2deg_5dps`（seed 54012）+ `tracking_reversal_pilot_v1_high`（seed 54101）**。
- WP-62 已全數落地（含 T-exit 文件，commit `035a637`）⇒ **無平行未合併熱區**，T1 不需標 blocked-on-commit。
- 兩組 focused Vitest（238 + 66 passed）與 typecheck ×2 全 exit 0；`git diff -- src tests` 為空。

</details>

## Planning evidence

### Context read

- `CLAUDE.md` §3/§4、`CONTEXT.md`
- `docs/exec-plan/README.md`、`DECISIONS.md`
- stage13 index、WP-62 README/progress、WP-54 README/progress
- engineering-planning skill、design standards、tech spec template
- `graphify-out/GRAPH_REPORT.md`（架構社群/god nodes）與 CodeGraph structural exploration

### Repository findings

1. `FAMILY_ROSTER` 是 schedulability 的權威；picker 與 compiler 已自動消費，不需新增第二份 UI allowlist。
2. `availableDrills` 是 runtime loadability 的權威，但同時直接投影到 researcher Controls，需明確 surface policy。
3. WP-62 的 fixed-weapon guard 只涵蓋 `DECLARED_WEAPON_BY_DRILL_ID`；selected Pilot 一旦 schedulable，必須從其 config 將 `tracking_pilot_hold` 納入。
4. `loadDrillConfigDirect()` 與 formal Pilot runner 固定 `field-low`；Session Plan runtime entry 也必須 pin 同場景。
5. 所有 Pilot configs 是 `mode:'practice'`，且 exact-id history registry 排除已由專用 test 保護。
6. custom Session Plan metadata 已足以識別 ad hoc execution；新增 schema 欄位不是必要條件。

## Planning decisions

| ID | Decision | Rationale | Status |
|---|---|---|---|
| **D-64.P1** | selected Pilot configs 是「可排程的研究用 drill」，不是 Assessment 或 manifest block | family membership 只表達 scheduling reach，與 mode/history eligibility 正交 | ✅ 使用者方向已確認 |
| **D-64.P2** | 以單一 curated config registry 同時推導 family、weapon、runtime entries | 防止 picker/compiler/runtime 三邊漂移；不手寫第二份 ids | ✅ **T1 已落地**（`TRACKING_PILOT_SCHEDULABLE_DRILLS`） |
| **D-64.P3** | ad hoc path 沿用 generic SessionRunner 與既有 custom audit fields | 最小改動且保持 manifest-specific counterbalance/eligibility 邊界 | 📋 待 T2/T3 證明 |
| **D-64.P4** | 不新增 metadata execution-context 欄位 | `sessionPlanMode:'custom'` + item/rep 與 manifest session label 已可區分；避免無需求 schema 擴張 | 📋 待 T0 確認 |
| **D-64.P5** | formal Tracking Pilot 與 frozen tracking family representative 不變 | 本需求只要挑 1–2 個條件做 ad hoc 測試 | ✅ Scope freeze |

## Open Questions

| ID | Status | Owner | Deadline | Default |
|---|---|---|---|---|
| ~~OQ-64.1~~ exact selected configs | ✅ **已關閉（T0, 2026-09-10）**：`tracking_core_pr_pilot_v1_2deg_5dps`（seed 54012）+ `tracking_reversal_pilot_v1_high`（seed 54101） | 研究者／使用者 | T0 | 採預設 |
| ~~OQ-64.2~~ Controls visibility | ✅ **已關閉（T0, 2026-09-10）**：Session Plan-only | 產品 owner／研究者 | T2 | 採預設 |
| ~~OQ-64.3~~ live eligibility | ✅ **已關閉（T0, 2026-09-10）**：不做；只離線分析 | 指標 owner | T0 | 採預設 |
| ~~OQ-64.4~~ alternate seed | ✅ **已關閉（T0, 2026-09-10）**：不做；primary only | 研究者 | T0 | 採預設 |
| ~~OQ-64.5~~ `AvailableDrill` 測試 seam | ✅ **已關閉（T2, 2026-09-11）**：seam = `src/drill/drillRegistry.ts`（形狀 + 兩個投影）；roster literal 仍留 `main.ts`（D-64-T2-1） | 實作者 | T2 | — |

四項全數採 README 預設 ⇒ scope / estimate 不變，未新增 Decision Log row。詳見下方 T0 §4–§5。

## Surprises / known coordination risks

- 現行 `drillFamily.ts` 註解明說 Tracking Pilot 不可排程；T1 必須同步更新該描述，否則文件會說謊。
- `availableDrills` 並非純 runtime registry；任何新增 entry 都會自動進 Controls，除非投影時過濾。
- WP-62 仍是 active 且觸及相同檔案；其 progress 比 stage/global index 新。T0 必須先處理狀態漂移與平行修改。
- 工作樹另有未追蹤 WP-63、KI-035 與 spider-shot HTML，均屬使用者現有工作；本計畫未觸碰。

---

## T0 — Entry gate（2026-09-10）

> Task：[T0-entry-gate.md](T0-entry-gate.md) · T0 結束時 HEAD = `035a637`。

### 1. 編號與落點重查（Step 1）

| 項目 | 掃描結果 | 結論 |
|---|---|---|
| **WP-64** | [`exec-plan/README.md`](../../../README.md) §2 索引最大 = **WP-63**（micro-flick v8 量測基礎層）。`WP-64` 未入 §2；唯一其他引用是 [`stage14/README.md`](../../stage14/README.md) §3 候選表，該表自我標示「**候選，未批准**」、無 WP 子資料夾、未入 §2 | ✅ **維持 WP-64**。依 [GD-15](../../DECISIONS.md)「編號歸屬以採納入 §2 索引為準，草稿之預留不構成佔用」，stage14 三個候選在採納當下應再順延為 **WP-65/66/67**（其 README 已有兩層順延註記，第三層待該 stage 採納時補） |
| **GD-40** | [`DECISIONS.md`](../../DECISIONS.md) 最大 heading = **GD-38**。`GD-39` 已由 WP-63 預留且 WP-63 本體已入 §2 索引 ⇒ 依 GD-15 佔用成立（其條目本身依 D-63-P6 延至 T-exit 才寫入） | ✅ **維持 GD-40**。全 repo 除本 WP 自身兩處外無其他 GD-40 引用 |
| **落點** | `active/stage13/` | ✅ 不變。主題不符為明帳偏離，已記於 README「落點說明」；本 task 不改寫 stage13 主敘事 |

⚠️ 規劃期本檔寫「工作樹已有**未追蹤的** WP-63/GD-39 計畫」——**該敘述於 T0 已過期**：WP-63 與 WP-64 兩份計畫皆已 commit（`f577ea7` / `9560cbf`），且 WP-63 已進 §2 索引。

### 2. CodeGraph blast radius（Step 2）

`codegraph_explore` 實測（2026-09-10，HEAD `035a637`），與 README §0.2 規劃期敘述對照：

| Symbol | 位置 | 消費者 | 覆蓋測試 |
|---|---|---|---|
| `FAMILY_ROSTER` | [`drillFamily.ts:50`](../../../../../src/session/drillFamily.ts) | 1（同檔 `buildFamilyByDrillId()`） | ⚠️ 無直接測試（經 `FAMILY_BY_DRILL_ID` 間接覆蓋） |
| `FAMILY_BY_DRILL_ID` | `drillFamily.ts:109` | **12**：`sessionProgram.ts`、`SessionPlanSetup.ts`、`data/metadata.ts`、同檔 | `drillFamily.test.ts`、`sessionProgram.test.ts`、`SessionPlanSetup.test.ts` |
| `SCHEDULABLE_DRILL_IDS` | `drillFamily.ts:115` | **4，全部在 `SessionPlanSetup.ts`** | 同上三支 |
| `DECLARED_WEAPON_BY_DRILL_ID` | `drillFamily.ts:168` | **12**：`sessionProgram.ts`、`SessionPlanSetup.ts` | `drillFamily.test.ts`、`sessionProgram.test.ts`、`wp62-session-weapon-determinism.test.ts`、`sessionProgramExport.test.ts` |
| `AvailableDrill` | [`main.ts:154`](../../../../../src/main.ts) | 2（皆在 `main.ts`） | ⚠️ **無覆蓋測試** |

**兩處對規劃期敘述的修正**：

1. README §0.1 ② / §0.2 稱 `SCHEDULABLE_DRILL_IDS` 由「picker 與 compiler」消費 —— **compiler 不讀它**。[`compileSessionProgram()`](../../../../../src/session/sessionProgram.ts) 走 `requireFamily()` → `FAMILY_BY_DRILL_ID.get()`；`SCHEDULABLE_DRILL_IDS` 的 4 個消費者全在 `SessionPlanSetup.ts`。結論不變（兩者同源於 `FAMILY_ROSTER`），但 **T1 寫測試時要打對 symbol**。
2. `AvailableDrill` **沒有任何覆蓋測試** ⇒ T2 的 surface filter（OQ-64.2）**沒有現成測試 seam** 可掛，必須自行建立可測邊界，不可假設 `main.ts` 有既有 harness。**列為 T2 的具名前置。**

### 3. WP-62 熱區對帳（Step 3）

- T0 開場 `git status --short`：12 modified + 2 untracked（含 `exec-plan/README.md`、stage13 README、`DECISIONS.md`、WP-62 三份文件）。
- **掃描進行中，平行 session 落下 commit `035a637` "docs: update stage13 planning and WP-62 exit"**（2026-09-10 16:20:59 +0200）；HEAD `5f258f0` → `035a637`，工作樹轉為**完全乾淨**。
- 該 commit **不含任何 `src/`**（14 檔全為 docs + `graphify-out/`）。WP-62 的 code 早已由 `2806c37` / `cdbc369` / `5f258f0` 落地。
- ⇒ **WP-62 T1～T-exit 全數已提交**，`drillFamily.ts` / `sessionProgram.ts` / `SessionPlanSetup.ts` / `main.ts` / `metadata.ts` 熱區**無未合併修改**。README §0.2「WP-64 T1 不得與 WP-62 未合併 task 平行開工」**條件已解除**，T1 **不需**標 blocked-on-commit。

### 4. 選中集合凍結（Step 4，OQ-64.1）

研究者核准 **README 預設**。兩個 config 的事實由 live code 快照取得（非手抄）：

| # | Exported source | drillId | Role | Primary seed | Trajectory kind | 角大小 / 密度 | `mode` | Weapon | Scene | 護欄與時序 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `buildTrackingCorePrPilotV1Cell(2, 5)` | `tracking_core_pr_pilot_v1_2deg_5dps` | core 2×2 cell（steady pursuit） | **54012** | `band-limited-2d-v1` | 2.0°（sphere ⌀ `0.13964051942574068` u）、5 deg/s、band [0.15, 1.05] Hz | `practice` | `tracking_pilot_hold` | `field-low` | `{requireFire:true, noMovement:true}`；prep 1000 ms + scored 25000 ms ⇒ `endCondition.value = 26000` |
| 2 | `trackingReversalPilotV1High` | `tracking_reversal_pilot_v1_high` | reversal cell（reactive correction） | **54101** | `reversal-2d-v1` | 3.0°（sphere ⌀ `0.20948737255349545` u）、reversal interval [300, 600] ms、speed [5, 20] deg/s | `practice` | `tracking_pilot_hold` | `field-low` | 同上 |

**選擇理由**（入帳，避免日後被誤讀為任意挑選）：

- 兩者覆蓋**兩種不同 trajectory generator** 與兩種構念（穩定追蹤 vs 反應式修正），是「一個 core + 一個 reversal」的最小有訊息量組合。
- 兩者乾跑 TOT（53.7% / 39.2%）皆落在 WP-54 凍結的 **5–80% 難度窗**內 —— 排除地板/天花板 cell。相對地 `3deg_5dps` 乾跑 86.2%，已在 WP-54 自身文件中標為最可能被判 `revise`。
- 兩者皆以 **exported builder / const** 取得，符合 README §1.5「不以陣列 index 或手寫 drill id 選取」。已驗證 `buildTrackingCorePrPilotV1Cell` 為 exported function 且 `2` 是合法 `CorePrPilotV1SizeDeg`（候選陣列 = `[3.0, 2.0]`）。

### 5. OQ 收斂（Step 5）

| OQ | 決議 | 對 scope 的影響 |
|---|---|---|
| **OQ-64.1** | ✅ 上表兩個 config | 解除 T1 阻塞 |
| **OQ-64.2** | ✅ **Session Plan-only**（README 預設）。`AvailableDrill` 加 optional `showInResearcherControls?: boolean`；`loadDrillById()` 搜尋完整 registry，`createControls({ drills })` 過濾 | T2 照計畫；但見 §2 修正 ② —— 無現成測試 seam |
| **OQ-64.3** | ✅ **不做 live eligibility**（README 預設）。`protocolGuard` 仍記 violation 事件供離線分析，Session Plan 不宣告 eligible/ineligible | 維持 out-of-scope，不擴 runner/export 邊界 |
| **OQ-64.4** | ✅ **只用 primary seed**（README 預設）。rep 重播同一 seed = repeated exposure，非獨立樣本 | 維持 out-of-scope |

**四項全為 README 預設 ⇒ 無偏離，不新增 Decision Log row**（本節即為關閉紀錄）。T0 Failure handling 的兩個停止條件（要求 manifest feature／核准超過兩個 config）**均未觸發**。

### 6. 預期 fixture 表（Step 6）

由 live code 產生（臨時 vitest 快照，執行後刪除；`git status --porcelain` 已驗證未殘留）。全集 = [`trackingPilotHistoryExclusion.test.ts`](../../../../../src/pilot/trackingPilotHistoryExclusion.test.ts) 的 `ALL_TRACKING_PILOT_DRILL_IDS`，該檔已釘死 length 9 且 id 唯一。

**Selected — 必須可排程（n = 2）**

1. `tracking_core_pr_pilot_v1_2deg_5dps`
2. `tracking_reversal_pilot_v1_high`

**Complement — 必須維持 unschedulable（n = 7）**

1. `tracking_core_pr_pilot_v1_practice`
2. `tracking_core_pr_pilot_v1_calibration_horizontal`
3. `tracking_core_pr_pilot_v1_calibration_vertical`
4. `tracking_core_pr_pilot_v1_3deg_5dps`
5. `tracking_core_pr_pilot_v1_3deg_14dps`
6. `tracking_core_pr_pilot_v1_2deg_14dps`
7. `tracking_reversal_pilot_v1_medium`

**T0 起始狀態（T1 紅測試基準）**：`anyPilotSchedulableNow === false` —— 九個 Pilot id **全部**不在 `FAMILY_BY_DRILL_ID` 中。T1 的紅測試必須自此狀態出發：selected 2 個轉綠、complement 7 個維持缺席。

### 7. Baseline 證據（Step 7–8）

HEAD = `035a637`；工作樹乾淨（`git status --porcelain` 空）。

| 指令 | 結果 |
|---|---|
| `npx vitest run src/session/drillFamily.test.ts src/session/sessionProgram.test.ts src/ui/SessionPlanSetup.test.ts` | ✅ **3 files / 238 passed**（`sessionProgram` 95、`drillFamily` 104、`SessionPlanSetup` 39），exit 0，1.30 s |
| `npx vitest run src/drill/tracking_core_pr_pilot_v1.test.ts src/drill/tracking_reversal_pilot_v1.test.ts src/session/trackingPilotManifest.test.ts src/session/TrackingPilotRunner.test.ts src/pilot/trackingPilotHistoryExclusion.test.ts` | ✅ **5 files / 66 passed**（manifest 28、Runner 11、historyExclusion 3、reversal 8、core 16），exit 0，1.55 s |
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0，無輸出 |
| `git diff -- src tests` | ✅ 空 —— T0 未動 production/test code |

上游測試無紅燈 ⇒ T0 Failure handling 的「上游測試紅」條件未觸發。

### 8. T0 新增的 Surprises

1. **T0 執行期間工作樹被平行 session 改變**（§3）。FM-64.10 預期的是「合併衝突」，實際發生的是**基線在掃描中途前進**。教訓：熱區對帳的 `git status` 快照**只在當下有效**，結論必須引用具體 commit hash 而非「工作樹乾淨」這種會過期的敘述。
2. **`drillFamily.ts` 的 declared-weapon 註解計數不精確**：現行文字為「The two tracking-pilot blocks also declare a weapon but are not schedulable」，但宣告 `tracking_pilot_hold` 的是**兩族共九個 config**。T1 依 README「Surprises」已要求更新該註解的可排程性敘述，**同時**要修正這個計數，否則改完仍在說謊。
3. **`AvailableDrill` 零測試覆蓋**（§2 修正 ②）——這是 README §3.1 technical debt 的具體代價，T2 需自建測試 seam。

---

## T1 — Curated scheduling contract（2026-09-10）

> Task：[T1-curated-scheduling-contract.md](T1-curated-scheduling-contract.md) · T1 起點 HEAD = `d8fe0ac`。

### 1. Blast radius（Step 1）

T0 §2 的 `codegraph_explore` 快照取於 `035a637`；`d8fe0ac` 只多一個 docs commit，**`src/` 逐位相同**，因此本 task 未重跑 impact query，改以「直接讀取全部 5 個 symbol 的消費端 + 全量 suite」覆核。實際被觸及的檔案與 T0 表格一致，僅多兩處 T0 未預期的消費者：

| 檔案 | 為何被改 | T0 是否預期 |
|---|---|---|
| `src/session/trackingPilotSchedulableDrills.ts`（new） | curated registry 本體 | ✅ |
| `src/session/drillFamily.ts` | `FAMILY_ROSTER['tracking']` + `DECLARED_WEAPON_ROSTER` 推導 | ✅ |
| `src/main.ts` | runtime entry + `AvailableDrill.showInResearcherControls` + Controls projection | ❌ **T2 的工作，被 §2 的 coherence 閘拉進來** |
| `src/session/drillFamily.test.ts` | roster 大小 36→38、tracking 11→13、weapon map 8→10、complement 負向斷言改用真實 7 個 id | ⚠️ T0 未點名「roster 大小被寫死」 |
| `src/ui/SessionPlanSetup.test.ts` / `.ts` | `offered` 長度 36→38（+ 註解文案） | ⚠️ 同上 |
| `src/session/sessionWeaponActivation.test.ts` | `DECLARED_WEAPON_BY_DRILL_ID.size` 8→10 | ❌ **T0 §2 未列出此消費者** |
| `src/session/sessionProgram.test.ts` | WP-64 compiler 斷言 | ✅ |
| `src/pilot/trackingPilotHistoryExclusion.test.ts` | 「可排程 ≠ assessment」斷言 | ✅ |

### 2. D-64-T1-1 — runtime 註冊由 T2 提前到 T1（**偏離計畫，必讀**）

**問題。** T1 Step 4 要求把 curated ids 併入 `FAMILY_ROSTER['tracking']`，但 `drillFamily.test.ts` 的 WP-58 invariant 2 斷言 `FAMILY_BY_DRILL_ID.size === rosterSizeFromMain()`（解析 `main.ts` 的 `availableDrills` literal）。只改 family 不改 `main.ts` ⇒ 該 invariant 必紅，而 T1 DoD 要求全量 Vitest exit 0。

**選項與取捨。**

| 選項 | 結果 |
|---|---|
| (a) 放寬 invariant，容忍「family 有、runtime 沒有」到 T2 | ❌ 這正是 **FM-64.2** 本身（picker 可選 → 開始時 `Unknown drill`），等於把失效模式寫進測試 |
| (b) T1 不碰 `FAMILY_ROSTER`，family+runtime 一起留到 T2 | ❌ T1 DoD 的 compiler weapon-mismatch／rest boundary 斷言需要 family membership，做不到 |
| (c) **T1 一併加 `main.ts` runtime entry** | ✅ 採用。invariant 的意圖（compilable ⇔ loadable）本來就要求兩者同時落地；FM-64.2 的緩解措施寫的就是「單一 curated source + runtime/family coherence test」 |

**同時提前的還有 `showInResearcherControls`。** 若只加 runtime entry 而不加 surface filter，T1→T2 之間會有一個 commit 讓兩個 Pilot block 出現在 researcher Controls 下拉——與 **OQ-64.2 已關閉的決議（Session Plan-only）矛盾**。與其留一個「已知錯」的中間狀態，不如把 optional 欄位 + 一行 filter 一起落地（合計 ~6 行 production code）。

**T2 剩下什麼。** `AvailableDrill` 的**測試 seam**（T0 §2 修正 ② 指出目前零覆蓋，本 task 只加了 source-scan 級別的斷言，尚無 `loadDrillById()` 側的行為測試）、picker DOM / 鍵盤 / a11y 測試、export round-trip 對帳、manifest 語意負向斷言、以及 clearance 真載入。T2 的 checklist 已就地標記哪三項移前。

### 3. Curated registry 契約（Step 2–4）

`TRACKING_PILOT_SCHEDULABLE_DRILLS` 於 module construction 檢查五件事，任一失敗即 throw（**不是** picker 可選後才在 activation 失敗）：長度 1–2、id 不重複、id ∈ 九個 WP-54 block、`mode === 'practice'`、`weaponId === 'tracking_pilot_hold'`。`family` 固定 `'tracking'`、`sceneId` 固定 `'field-low'`、`selectionSurface` 固定 `'session-plan-only'`。

兩個 config 皆取自 exported builder / named const（`buildTrackingCorePrPilotV1Cell(2, 5)`、`trackingReversalPilotV1High`），測試以 `toEqual`／`toBe` 對 canonical 值覆驗，seed 斷言 `[54012, 54101]` 與 T0 §4 凍結值一致。

`ALL_TRACKING_PILOT_CONFIGS`（九個）由本模組匯出作為 census；`trackingPilotHistoryExclusion.test.ts` **保留自己那份手寫清單**，兩份互相對照（`toEqual`）——刻意不合併成一份，否則就失去獨立驗證。

### 4. Mutation checks（Step 8）

| # | Mutation | 結果 |
|---|---|---|
| 1 | 移除 `FAMILY_ROSTER['tracking']` 的 curated spread | ✅ **module construction fail fast**：`Drill tracking_core_pr_pilot_v1_2deg_5dps is not schedulable, so it must not declare a weapon here`（WP-62 既有的 `buildDeclaredWeaponByDrillId` 護欄）。比「某支測試轉紅」更早、更強，但代價是 4 個 test file 全數 collect 失敗、看不到具名測試 |
| 2 | 移除 `DECLARED_WEAPON_ROSTER` 的 curated spread | ✅ **10 個具名測試轉紅**（跨 4 檔）：WP-64 的 `refuses to re-arm …` ×3、`is in the tracking family with its weapon fixed` ×2、WP-62 的 `declares in the map exactly what its config declares` ×2 等 |
| 3 | 把全部九個 block spread 進 roster（繞過長度閘） | ✅ **14 個具名測試轉紅**：WP-64 `… is neither curated nor schedulable` ×7、WP-58 roster 大小/分組、WP-62 weapon map 範圍、UI `offers every schedulable drill …` |

三道均已還原（`git diff --stat src/session/drillFamily.ts` = 16 insertions / 4 deletions，即本 task 的正常改動）。

### 5. 驗證證據（Step 9）

| 指令 | 結果 |
|---|---|
| `npx vitest run src/session/trackingPilotSchedulableDrills.test.ts src/session/drillFamily.test.ts src/session/sessionProgram.test.ts src/pilot/trackingPilotHistoryExclusion.test.ts src/session/sessionWeaponActivation.test.ts src/ui/SessionPlanSetup.test.ts` | ✅ **6 files / 291 passed**，exit 0（新增 registry 26、drillFamily 106、sessionProgram 103） |
| `npx vitest run`（全量） | ✅ **255 files / 2984 passed / 2 skipped**，exit 0，18.3 s |
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0，無輸出 |
| `npm run build` | ✅ exit 0，196 modules，1236.93 kB |
| `graphify update .` | ✅ 4859 nodes / 12016 edges / 299 communities |

`src/sim`、`SharedState`、input、hit detection、`research/` 與全部 Pilot config **值** 零 diff（本 task 只碰 registry/orchestration 與測試）。

### 6. T1 新增的 Surprises

1. **roster 大小是寫死的常數，散在三個檔**：`drillFamily.test.ts`（36 + per-family 11）、`SessionPlanSetup.test.ts`（36）、`sessionWeaponActivation.test.ts`（weapon map 8）。T0 §2 只點出 symbol 的消費者數，沒點出「這些消費者把 cardinality 寫死」——**任何往 roster 加 drill 的 WP 都要改這三處**，這比 T0 表格所暗示的更廣。
2. **`sessionWeaponActivation.test.ts` 是 T0 §2 沒列出的第 3 個 `DECLARED_WEAPON_BY_DRILL_ID` 消費者**。T0 的 CodeGraph 表記「12 consumers：`sessionProgram.ts`、`SessionPlanSetup.ts`」與四支測試，實際還有這支。教訓：impact query 的 consumer 清單對 **test** 檔覆蓋不完整，改共用 registry 時仍需一次全量 suite 兜底。
3. **doc-comment 的字面掃描會誤咬**：架構測試「本模組不得 import manifest/runner」若用 `source.toContain('TrackingPilotRunner')` 會被**解釋為何不 import 的註解**判為違規。已改為只掃 `from '…'` 的 module specifier。
4. **T0 Surprise #2 已修**：`drillFamily.ts` 原註解「The two tracking-pilot blocks also declare a weapon but are not schedulable」——數量（實為九個）與可排程性（現在兩個可排程）皆已改正。

### 7. Open Questions（T1 新增）

| ID | Question | Owner | Deadline | 現況 |
|---|---|---|---|---|
| **OQ-64.5** | `AvailableDrill` 的測試 seam 要建在哪一層？本 task 只用 `main.ts` source scan 斷言「roster 由 registry spread 而來、九個 id 都不是手寫」，尚未測到 `loadDrillById()` 的實際 resolve 行為 | 實作者 | T2 開工時 | 📋 T2 具名前置（承接 T0 §2 修正 ②） |

## T2 — Runtime 與 Session Plan wiring（2026-09-11）

> Task：[T2-runtime-and-session-plan-wiring.md](T2-runtime-and-session-plan-wiring.md) · T2 起點 HEAD = `ecf5f8e`。
>
> ⚠️ 比照 T0 Surprise #1：執行期間平行 session 落下 `ef6ad2d`（只新增 `.agents/` 的 verification skill，**零 `src/`**），故 code baseline 與起點逐位相同；本 task 的 commit 接在其上。

### 1. Blast radius（Step 1）

`codegraph_explore`（2026-09-11）對 `AvailableDrill` / `availableDrills` / `loadDrillById` /
`createControls` / `sessionPlanAuditFields` / `createSessionPlanSetup` 的實測，與 T0 §2 一致：

| Symbol | 消費者 | 覆蓋測試（T2 前） |
|---|---|---|
| `AvailableDrill` | 2，皆在 `main.ts` | ⚠️ 無 |
| `loadDrillById` | 2，皆在 `main.ts` | ⚠️ 無 |
| `sessionPlanAuditFields` | 1，在 `main.ts` | ⚠️ 無 |
| `createControls` | 2，皆在 `main.ts` | `Controls.test.ts` |
| `createSessionPlanSetup` | 3，皆在 `main.ts` | `SessionPlanSetup.test.ts` |

實際被改的檔案：

| 檔案 | 為何被改 |
|---|---|
| `src/drill/drillRegistry.ts`（new） | OQ-64.5 的測試 seam：`AvailableDrill` 型別 + `drillSourceFor()` + `resolveAvailableDrill()` + `researcherControlsDrills()` |
| `src/drill/drillRegistry.test.ts`（new） | 上述兩個投影的行為測試（合成 registry） |
| `src/session/trackingPilotSchedulableDrills.ts` | 新增 `TRACKING_PILOT_RUNTIME_DRILLS`（curated → roster entry 的投影） |
| `src/main.ts` | 改為 import 上述四者；roster 改 spread 投影；`loadDrillById()` / Controls 改呼叫共用投影 |
| `src/session/drillFamily.test.ts` | roster parser 的 spread 名稱；WP-58 invariant 5 需認得「預建 spread」（見 §3.2） |
| `src/session/trackingPilotSchedulableDrills.test.ts` | source-scan 升級為真 resolve 行為斷言 |
| `src/ui/SessionPlanSetup.test.ts` | picker/鍵盤/同 family 與跨 family preview |
| `src/session/sessionProgramExport.test.ts` | ad hoc export 對帳 + 負向斷言 |

### 2. D-64-T2-1 — OQ-64.5 的 seam 落在 `src/drill/drillRegistry.ts`

**問題。** T1 只能用 source scan 證明「`main.ts` 的 roster 由 curated registry spread 而來」。
`loadDrillById()` 是否真的 resolve 得到這兩個 id、Controls 下拉是否真的濾掉它們，兩者都沒被執行過
（T0 §2 修正 ②）。`main.ts` 是 top-level-await + WebGPU + DOM，Vitest 起不動。

**選項與取捨。**

| 選項 | 結果 |
|---|---|
| (a) 維持 source scan，只加更多字串斷言 | ❌ 斷言的是「文字長這樣」，不是「查得到」。FM-64.2 的失效模式恰好可以在字串正確時發生 |
| (b) 把整個 `availableDrills` literal 搬出 `main.ts` | ❌ 那 literal 綁著 ~40 個 drill module import；等於為 `main.ts` 建第二套 runtime，T2 Planned files 明文禁止 |
| (c) **只把「形狀 + 兩個投影」搬出去** | ✅ 採用。`AvailableDrill`、`drillSourceFor()`、`resolveAvailableDrill()`、`researcherControlsDrills()` 移入 `src/drill/drillRegistry.ts`；roster literal 留在 `main.ts` 原地 |

**額外一步。** curated → `AvailableDrill` 的投影也從 `main.ts` 的 inline `.map()` 移進
`trackingPilotSchedulableDrills.ts`（`TRACKING_PILOT_RUNTIME_DRILLS`），因為 T2 Step 2/3 要斷言的三件事
（`source === config` by reference、`sceneId === 'field-low'`、`showInResearcherControls === false`）
都是**物件的性質**，留在 `main.ts` 裡就只能繼續掃字串。`main.ts` 現在只剩 `...TRACKING_PILOT_RUNTIME_DRILLS,`。

**行為零變動。** 三處改寫皆是 extract，語意逐位相同（`find` + throw `Unknown drill: <id>`、
`showInResearcherControls !== false` 的 filter、`resolveSource ?? source`）。全量 suite 綠即是證據。

### 3. T2 新增的 Surprises

1. **curated block 的 primary seed 不在 `sequence.seed`，而在 `targets.trackingTrajectory.seed`。**
   `main.ts` 寫 `meta.rngSeed` 的算式是 `spiderShot?.seed ?? sequence.seed ?? DEFAULT_RNG_SEED`，
   兩個 pilot block 兩者皆無 ⇒ **`meta.rngSeed` 會是 `DEFAULT_RNG_SEED`，不是 54012/54101**。
   可稽核的刺激 seed 走 `meta.spawn.trackingTrajectory`（整個 trajectory 物件原樣帶出）。
   這**不是** WP-64 造成的缺口 —— formal pilot 路徑的 payload 形狀完全一樣 —— 但 T2 DoD 的
   「seed 與 canonical config 一致」必須對到 `meta.spawn.trackingTrajectory.seed`，
   對到 `meta.rngSeed` 會得到一個永遠為真、什麼都沒證明的斷言。已寫進 export test 的註解。
2. **WP-58 invariant 5（「每個 family representative 都 pin 了 scene」）是掃 roster literal 的字面 `sceneId`。**
   把 entry 移出 literal ⇒ 該 spread 沒有 `sceneId` 字樣 ⇒ 整個 invariant 誤判為「未 pin 的 entry」而全紅
   （8 個 family 一起倒）。修法是讓掃描認得「預建 spread」並**從物件本身**讀 `sceneId`
   （`PREBUILT_ROSTER_SPREADS`），而不是放寬斷言。教訓與 T1 Surprise #1 同一類：
   **roster 的 source-scan 測試對 literal 形狀有隱性依賴**，任何把 entry 移出 literal 的改動都會踩到。
3. **`parseExportPayload()` 回傳 discriminated union（`{ok:true,payload}` / `{ok:false,errors}`）。**
   `parsed.errors` 在成功時是 `undefined`，所以 `expect(parsed.errors).toEqual([])` 這種寫法會在
   **成功**的 round-trip 上紅掉。必須先 narrow `if (!parsed.ok) throw`。

### 4. Mutation checks

| # | Mutation | 結果 |
|---|---|---|
| 1 | 移除 `researcherControlsDrills()` 的 `.filter(...)` | ✅ 3 個具名測試轉紅（跨 2 檔）：`offers every entry that does not opt out` / `withholds only false` / WP-64 的 `keeps the curated blocks out of the researcher Controls dropdown while staying loadable` |
| 2 | `TRACKING_PILOT_RUNTIME_DRILLS` 的 `sceneId` 改成 `'urban-high'` | ✅ 2 個具名測試轉紅（`… resolves out of the runtime registry, pinned to field-low` ×2） |
| 3 | `source: entry.config` 改成 `source: { ...entry.config }`（clone） | ✅ 同上 2 個轉紅 —— by-reference 斷言咬住 FR-64.2 |

三道均已還原。

### 5. 驗證證據（Step 10）

| 指令 | 結果 |
|---|---|
| `npx vitest run src/drill/drillRegistry.test.ts src/session/trackingPilotSchedulableDrills.test.ts src/session/drillFamily.test.ts` | ✅ **3 files / 151 passed**，exit 0 |
| `npx vitest run src/ui/SessionPlanSetup.test.ts` | ✅ **43 passed**（39 → +4） |
| `npx vitest run src/session/sessionProgramExport.test.ts` | ✅ **20 passed**（13 → +7） |
| `npx vitest run`（全量） | ✅ **256 files / 3014 passed / 2 skipped**，exit 0，20.1 s |
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0，無輸出 |
| `npm run build` | ✅ exit 0，2.24 s |
| `graphify update .` | ✅ 4869 nodes / 12052 edges / 291 communities |
| `git status --short -- src` | ✅ 只有本 task 的 6 改 + 2 新檔 |

`src/session/trackingPilotManifest.ts`、`TrackingPilotRunner.ts`、全部 Pilot config **值**、`src/sim`、
`SharedState`、input、hit detection、`research/` **零 diff**。

### 6. Step 9（activation order / ownership）的處理

T2 Step 9 要求「drill activation 必須在 sim loop 建構前套用既有 weapon precedence；不得改 WP-62 已釘死順序」。
本 task **未新增**平行斷言：`sessionWeaponActivation.test.ts`（WP-62 T3）已掃 `activateDrill()` 函式體、
斷言 `activeWeaponOverride = weaponId;` 早於 `buildSimLoop()`，且它逐一走 `DECLARED_WEAPON_BY_DRILL_ID`
——T1 之後那張 map 已含兩個 curated id，所以覆蓋自動成立。T2 改為在 registry test 斷言 curated entry
**沒有** `resolveSource` / `loadOptions`，亦即走的是與其他 module-constant entry 完全相同的 activation 路徑。

## T3 — E2E 與研究語意回歸（2026-09-11）

> Task：[T3-e2e-and-regression.md](T3-e2e-and-regression.md) · T3 起點 HEAD = `cd61721`。

### 1. E2E server / history root 對帳（Step 1）——**本 task 最先做、也最該先做的一件事**

`playwright.config.ts` 的 `reuseExistingServer: !process.env.CI` 代表「5173 上已經有人」時 Playwright
**不會**啟動自己那台（帶 `FPS_HISTORY_ROOT=.playwright-tmp/history-dev` 的）dev server。開工時 5173
確實已被佔用，三道探針的結果：

| 探針 | 結果 | 結論 |
|---|---|---|
| `Win32_Process` command line | `node …/vite/bin/vite.js`，cwd = 本 repo | 是本 checkout，不是別的 app／worktree |
| `GET /src/session/trackingPilotSchedulableDrills.ts`、`/src/drill/drillRegistry.ts` | 皆 200 | 供的是含 T1+T2 的碼，不是舊 commit |
| `GET /api/history/health` | `validRunCount: 54` | ⚠️ **對到真實 `data/session-history/`（54 筆），不是 `.playwright-tmp/history-dev`（243 筆）** |

即：那台 server 起動時沒有 `FPS_HISTORY_ROOT`，**本次 e2e 的任何 history 寫入都會落進真實研究資料
根目錄**。嘗試停掉它被環境權限攔下，故改採兩道替代保證，兩道都成立才繼續：

1. **機制**：curated block 是 `mode:'practice'`，`HistoryPersistence.save()` 對無 `meta.assessment`
   的 payload **短路成 `{kind:'excluded', reason:'practice'}` 且不發 HTTP**——所以 ad hoc run 在原理上
   碰不到任何 history root。這條已寫成新 e2e 的斷言（讀 `__fpsTest.historySaveState()`），不是推論。
2. **證據**：三個 root 於本 task 全部 e2e 前後各做一次 `FullName+Length` 快照並 deep-equal 比對。

**結果**：`data/session-history`（56 檔）、`.playwright-tmp/history-dev`（244 檔）、
`.playwright-tmp/history-preview`（368 檔）前後完全相同 ⇒ T3 DoD「history roots before/after
deep-equal」PASS。

> ⚠️ **留給下一位**：這條風險是環境性的、會復發。跑 e2e 前先打一次 `/api/history/health`，
> `validRunCount` 若等於 `data/session-history/` 的檔數，就代表 5173 上那台 server **沒有**帶
> 測試用 history root；此時要嘛停掉它讓 Playwright 自己起，要嘛確認本次要跑的 spec 全程不寫 history。

### 2. Blast radius（Step 1–2）

本 task 只碰測試與文件，`src/` 零 diff：

| 檔案 | 為何被改 |
|---|---|
| `tests/e2e/session-orchestrator.spec.ts` | +2 個 WP-64 test（DOM picker／live run）、`readExportedMeta` → `readExportedPayload`（events 也要讀）、**修一條 T1 留下的紅燈**（見 §3） |
| `docs/operational/tracking-pilot-runbook.md` | 新增「Session Plan 裡看到的兩個 pilot block」章：三項明文禁令 + 兩項「不做」 |
| `docs/guideline/operator-manual.md` | 自訂 program 段落加一則 callout，指回 runbook |

`tests/e2e/tracking-pilot-live.spec.ts` 與 `src/pilot/trackingPilotHistoryExclusion.test.ts`
**未改**：前者 expected 原則上不得放寬（T3 Failure handling），只重跑；後者 T1 已補上「可排程 ≠
assessment」的五項斷言（全九個 id + 兩個 curated 的 `unregistered-drill` projection），T3 重跑確認
仍綠，沒有再加平行斷言的理由。

### 3. T3 發現①：T1/T2 留下一條**紅燈 e2e**，六次綠燈都沒看見

`session-orchestrator.spec.ts:411` 斷言 custom picker 有 36 個 `<option>`；T1 加了兩個 curated block
之後真值是 38。**T1 與 T2 各自宣告的「全量 Vitest + typecheck ×2 + build exit 0」全都是真的**——
它們就是掃不到這裡：

- `npm run typecheck` 只涵蓋 `tsconfig.json`（`src/`）與 `tsconfig.node.json`；`tests/e2e/` 兩邊都不在。
- Vitest 不收 `tests/e2e/*.spec.ts`（Playwright 專屬）。
- 兩個 code task 都沒跑 Playwright（T1/T2 的 DoD 也沒要求）。

T1 Surprise #1 說「roster 大小寫死在**三個**檔」——實際是**四個**，第四個在 e2e，而且是唯一一個
既有 verification battery 照不到的。修法是把 36 改成 38 並就地註明來歷（不是放寬：`optgroup` 仍
釘 10，id 唯一性仍斷言）。

> 教訓（跨 WP）：**任何動 `FAMILY_ROSTER` / `availableDrills` 基數的 task，DoD 必須包含一次
> `session-orchestrator.spec.ts` 的 e2e**，否則「全綠」只是四個檢查裡的三個。

### 4. T3 發現②：`field-low` 的 pin **沒有第二道防線**，只有匯出斷言咬得住

mutation M2 把 `TRACKING_PILOT_RUNTIME_DRILLS` 的 `sceneId` 改成 `'urban-high'` 後，curated block
**照樣載入、照樣跑完 26 秒、照樣匯出**——`urban-high` 的 clearance 並沒有拒絕它。也就是說 FM-64.5
（「runtime entry 未 pin `field-low`」）的真實後果不是 loud failure，而是**安靜地換掉視覺場景與遮擋
條件**，而唯一會發現的是新 e2e 的 `meta.scene.sceneId === 'field-low'`。

README §3 把 FM-64.5 的緩解寫成「descriptor 的 literal type + 真實 load E2E」——現在知道
**literal type 只擋打錯字，真正的守門人是那條匯出斷言**；T2 的 registry 單元測試（同一個 mutation
也會咬）是第二層，但它證的是「物件寫對了」，不是「跑起來真的在那個場景」。

### 5. Mutation checks

| # | Mutation | 結果 |
|---|---|---|
| 1 | `FAMILY_ROSTER['tracking']` 改 spread `ALL_TRACKING_PILOT_CONFIGS`（全九個） | ✅ DOM picker test 紅：`not.toContain("tracking_core_pr_pilot_v1_practice")` 失敗，並印出整份 45 個選項的選單 —— A-64.1 的「其餘七個缺席」不是空話 |
| 2 | `TRACKING_PILOT_RUNTIME_DRILLS.sceneId` → `'urban-high'` | ✅ live test 紅：`meta.scene?.sceneId` `expected "field-low" / received "urban-high"`（§4：block 仍跑完，只有這條咬住） |
| 3 | 移除 `DECLARED_WEAPON_ROSTER` 的 curated spread | ✅ DOM picker test 紅：預覽的 `data-step-weapon-id` 由 `tracking_pilot_hold` ×3 變 `default` ×3 —— FR-64.4 的固定研究因子在送出前就看得見 |

三道均已還原（`git status --short -- src` 事後為空）。

### 6. 新增的兩個 test 各自證什麼（Step 2–6）

| Test | 成本 | 只有真瀏覽器能證的事 |
|---|---|---|
| `curated pilot block 是 picker 裡唯一兩個 pilot 選項…` | 1.9 s | 渲染出來的 `<optgroup label="tracking">` 恰含兩個 curated id、七個 uncurated id 全數缺席（**由 `ALL_TRACKING_PILOT_CONFIGS` 推導，非手抄**）；同家族兩 drill 的 seam 是 `drill` 而非 `family`；預覽逐步顯示 `tracking_pilot_hold`；submit 走到 `#eligibility-gate` |
| `ad hoc custom program 真跑 curated pilot block…` | 1.6 min | 三次真跑（26 s 未縮短）在真 `field-low` 載入並結束；cursor `[item,rep]` 正確；三份唯一下載；`meta` 逐份對帳（plan 座標 / trajectory 物件 / hitbox / `tracking_pilot_hold` / `scene.sceneId` / 無 `assessment` / `session` 只有 `participantId`）；`scored_start` 各一次且 `trackingPrepMs` 保留；`TrackingPilotRunner` 的 block log 為空、品質橫幅不顯示；`historySaveState()` = `excluded/practice`；rep 0 與 rep 1 的 trajectory `toEqual`（FM-64.7 重複暴露） |

**eligibility gate 的處理**：DOM 軌走到 `#eligibility-gate` 為止，live 軌走既有
`startSessionPlanWithoutGate()` seam——與 WP-58 T6 同一條路，理由與證據見該 seam 的既有註解
（PERF_FLOOR_MS 是 120 Hz 地板，headless rAF ~17 ms，閘**仍然執行**並把真實的失敗報告交給
`experimentSession.enter()`，只跳過拒入）。本 task 未新增任何繞過。

### 7. Step 8（跨 render FPS 決定性）的處理

**未新增測試**。NFR-64.1 的主張是「排程化不改變刺激或 sim」，而 WP-64 從頭到尾沒有進 sim：
`src/sim`、`SharedState`、輸入鏈與命中判定零 diff（T1/T2 已證，T3 未碰 `src/`）。因此證據取既有四
pump（穩定 60/144/240 Hz + 抖動 144 Hz ±50%）suites 全綠，加上新 e2e 對「同一 config 物件被逐位帶到
匯出」的行為斷言。再寫一份「用 pilot config 跑四 pump」只會是既有 `determinism.test.ts` 的第二定義
（C-D4），不會多證任何東西。

### 8. 驗證證據（Step 10）

| 指令 | 結果 |
|---|---|
| `npx playwright test tests/e2e/session-orchestrator.spec.ts --project=edge --workers=1` | ✅ **20 passed**，13.2 min，exit 0（既有 18 項 expected 一字未改）。⚠️ 該次全量跑的是**加 3 行 `sessionPlanFamilyOrder`/rest 斷言之前**的檔；補完後針對 `-g "WP-64 T3"` 再跑一次 **2 passed，2.4 min**，其餘 18 項未受影響（本 task 只加斷言、未改既有 test） |
| `npx playwright test tests/e2e/tracking-pilot-live.spec.ts --project=edge --workers=1` | ✅ **1 passed**，2.7 min（`[WP-54 T6] calibration block — ticks=3714, events=3, quality="Blocked — reasons: insufficient-fire-hold-coverage"` —— 既有 expected 一字未改，idle run 的 verdict 照舊只印不斷言） |
| `npx vitest run src/loop/__tests__/{determinism,fire-determinism,wp22-determinism,wp62-session-weapon-determinism}.test.ts src/sim/trackingTrajectory.test.ts src/pilot/trackingPilotHistoryExclusion.test.ts` | ✅ **6 files / 85 passed**，exit 0 |
| `npx vitest run`（全量） | ✅ **256 files / 3014 passed / 2 skipped**，exit 0，17.0 s |
| `npm run typecheck`（`tsc --noEmit` ×2） | ✅ exit 0 |
| `npm run build` | ✅ exit 0，2.31 s |
| spec 自身 typecheck（`tsc --noEmit --strict … session-orchestrator.spec.ts`） | ✅ 無輸出 —— 因為 §3 的緣故，e2e spec 的型別**不在** `npm run typecheck` 涵蓋範圍，故本 task 額外手動跑一次 |
| `graphify update .` | ✅ **4870 nodes / 12055 edges / 278 communities** |
| history roots before/after | ✅ 三個 root 全 deep-equal（§1） |
| `git status --short -- src` | ✅ 空 —— T3 未動任何 production code |

瀏覽器：Playwright `edge` project（系統 Edge，`channel: 'msedge'`），單 worker。

### 9. Open Questions（T3 新增）

無。§3 的「roster 基數改動必須跑 e2e」與 §1 的 dev-server/history-root 探針屬**程序**發現，已寫在
上方與 T-exit 的交接段，不需要 owner 決策。

## T-exit — 驗收與交付（2026-09-11）

> Gate：[`T-exit-gate.md`](T-exit-gate.md) · code baseline HEAD = `63d3187`（後續僅提交本節與索引／decision／graph artifacts）· browser = Playwright `edge`（系統 Edge / `msedge` channel，單 worker）。

### 1. A-64.1～A-64.9 evidence

| Acceptance | 具名證據與本次命令 | 結果 |
|---|---|---|
| **A-64.1 selection precision** | `trackingPilotSchedulableDrills.test.ts`、`drillFamily.test.ts`；Edge `curated pilot block 是 picker 裡唯一兩個 pilot 選項…` | selected 2 在 `tracking` picker；其餘 7 全缺席。focused 7 files / **291 passed**，Edge case pass。 |
| **A-64.2 source / scene integrity** | `trackingPilotSchedulableDrills.test.ts` 的 canonical by-reference / `field-low` assertions；Edge live payload trajectory/hitbox/scene assertions | config identity 與 `meta.spawn.trackingTrajectory`、sphere hitbox、`field-low` 對帳通過。 |
| **A-64.3 schedule / fixed weapon** | `sessionProgram.test.ts`、`sessionWeaponActivation.test.ts`、`wp62-session-weapon-determinism.test.ts`；DOM preview | reps、`rep` / `drill` boundary 與不同 weapon override fail-fast；三個 preview steps 均為 `tracking_pilot_hold`。 |
| **A-64.4 real orchestration** | Edge `ad hoc custom program 真跑 curated pilot block…` | 三個未縮短 26 s block 依序 run/rest/done，三份唯一下載；`SessionRunner` 完成、Pilot records 為 0。 |
| **A-64.5 auditability** | `sessionProgramExport.test.ts`；同一 Edge live payload case | 每份 payload 的 custom items / itemIndex / repIndex 回指 drill，weapon / trajectory seed / scene 可稽核。 |
| **A-64.6 orchestration separation** | `trackingPilotSchedulableDrills.test.ts` 的 import boundary；`tracking-pilot-live.spec.ts` | ad hoc payload 無 manifest / eligibility 詞彙；formal manifest / alternate-seed / operator eligibility E2E 維持通過。 |
| **A-64.7 research separation** | `trackingPilotHistoryExclusion.test.ts`；Edge `historySaveState()` assertion | selected 均是 `practice`、無 assessment，history projection 是 `unregistered-drill`；live save state = `excluded/practice`。 |
| **A-64.8 regression** | `npx.cmd tsc --noEmit`、`npx.cmd tsc --noEmit -p tsconfig.node.json`、`npm.cmd run build`、`npx.cmd vitest run`、完整 Edge command | typecheck ×2 / build exit 0；Vitest **256 files / 3014 passed / 2 existing skipped**；Edge **21 passed / 14.3 min**。 |
| **A-64.9 architecture** | `git diff --name-only d8fe0ac..63d3187` path audit；`graphify update .` | sim/input/render/hitbox/Pilot config/research path 均空；graph = **4872 nodes / 12056 edges / 284 communities**。 |

### 2. Selected / unselected projection audit

| Projection | Selected (`tracking_core_pr_pilot_v1_2deg_5dps`, `tracking_reversal_pilot_v1_high`) | Other seven Pilot ids |
|---|---|---|
| Family / picker | `tracking` / offered | no family / absent |
| Runtime | resolvable, pinned `field-low` | `Unknown drill` |
| Weapon | declared `tracking_pilot_hold`; mismatch rejected | no schedulable declaration |
| History | practice / `unregistered-drill` | practice / `unregistered-drill` |

The table is exercised by `trackingPilotSchedulableDrills.test.ts`, `drillFamily.test.ts`, `sessionProgram.test.ts`, `sessionProgramExport.test.ts`, `trackingPilotHistoryExclusion.test.ts`, `sessionWeaponActivation.test.ts`, and `wp62-session-weapon-determinism.test.ts`: **7 files / 291 passed**, exit 0.

### 3. Exit matrix

| Gate | Verdict | Evidence |
|---|---|---|
| Selection precision | ✅ PASS | two selected / seven complement assertions in unit and real DOM picker |
| Runtime coherence | ✅ PASS | runtime resolve + real `field-low` export |
| Instrument integrity | ✅ PASS | canonical config / seed / hitbox identity; fixed-weapon rejection |
| Orchestration separation | ✅ PASS | SessionRunner-owned ad hoc run; formal Pilot E2E still green |
| Auditability | ✅ PASS | item/rep/custom plan plus trajectory seed/weapon/scene payload facts |
| Research separation | ✅ PASS | practice-only, no assessment, unregistered history / excluded save |
| Regression | ✅ PASS | typecheck ×2, build, Vitest and full 21-case Edge command all exit 0 |
| Architecture | ✅ PASS | hard-constraint paths zero-diff; graph refreshed |

### 4. Re-run record and limitation

The first complete Edge attempt in this exit session ended `17 passed / 4 failed`, exit 1 after the local 5173 server disappeared; every failure was `net::ERR_CONNECTION_REFUSED`, not an assertion. The clean retry above used newly created runner-owned servers and passed all **21** cases, exit 0. This is recorded as an environment interruption, not a flaky assertion.

E2E is live app wiring with synthetic input / DEV harness and does not establish human performance or hardware timing validity. The T3 root snapshots remain the file-system evidence that no history root changed; the current retry independently reasserted `excluded/practice` on the live ad hoc path.

## Task log

| Task | Status | Started | Completed | Commit | Evidence |
|---|---|---|---|---|---|
| T0 | ✅ Done | 2026-09-10 | 2026-09-10 | `docs(wp-64): complete tracking pilot scheduling entry gate` | 本檔 T0 §1–§8；238 + 66 Vitest passed、typecheck ×2 exit 0、`git diff -- src tests` 空 |
| T1 | ✅ Done | 2026-09-10 | 2026-09-10 | `feat(wp-64): register curated tracking pilot session drills` | 本檔 T1 §1–§7；全量 2984 passed、typecheck ×2 + build exit 0、三道 mutation 皆被咬 |
| T2 | ✅ Done | 2026-09-11 | 2026-09-11 | `feat(wp-64): wire pilot drills into session plans` | 本檔 T2 §1–§6；全量 3014 passed、typecheck ×2 + build exit 0、三道 mutation 皆被咬 |
| T3 | ✅ Done | 2026-09-11 | 2026-09-11 | `test(wp-64): verify ad hoc tracking pilot session plans` | 本檔 T3 §1–§9；`session-orchestrator` 20 passed（13.2 min）、`tracking-pilot-live` 1 passed、全量 3014 passed、typecheck ×2 + build exit 0、三道 mutation 皆被咬、三個 history root deep-equal |
| T-exit | ✅ Done | 2026-09-11 | 2026-09-11 | `docs(wp-64): close tracking pilot scheduling work package` | 本檔 T-exit §1–§4；typecheck ×2 + build exit 0、Vitest 3014 passed、Edge 21 passed（14.3 min）、projection / zero-diff / graph audit 全綠 |
