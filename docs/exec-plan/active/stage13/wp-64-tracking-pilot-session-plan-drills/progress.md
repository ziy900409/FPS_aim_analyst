# WP-64 — Progress

> Plan：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)

## Current status

✅ **T1 完成（2026-09-10）；T2 可開工。** 兩個 curated Pilot block 已可排程、可編譯、可載入。

- 新增 [`src/session/trackingPilotSchedulableDrills.ts`](../../../../../src/session/trackingPilotSchedulableDrills.ts)：family / declared weapon / runtime registry 三者**同一來源**。
- **偏離計畫（D-64-T1-1）**：`main.ts` 的 runtime entry 與 Controls surface filter 由 T2 提前到 T1 —— 理由見下方 T1 §2。
- 全量 Vitest 2984 passed / 255 files、typecheck ×2、`npm run build` 全 exit 0；三道 mutation 皆被咬住。

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
| **OQ-64.5** `AvailableDrill` 測試 seam | 📋 **T1 新增、未關閉**：runtime registry 目前只有 `main.ts` source-scan 斷言，`loadDrillById()` 行為未測 | 實作者 | T2 開工時 | — |

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

## Task log

| Task | Status | Started | Completed | Commit | Evidence |
|---|---|---|---|---|---|
| T0 | ✅ Done | 2026-09-10 | 2026-09-10 | `docs(wp-64): complete tracking pilot scheduling entry gate` | 本檔 T0 §1–§8；238 + 66 Vitest passed、typecheck ×2 exit 0、`git diff -- src tests` 空 |
| T1 | ✅ Done | 2026-09-10 | 2026-09-10 | `feat(wp-64): register curated tracking pilot session drills` | 本檔 T1 §1–§7；全量 2984 passed、typecheck ×2 + build exit 0、三道 mutation 皆被咬 |
| T2 | ⬜ Not started | — | — | — | — |
| T3 | ⬜ Not started | — | — | — | — |
| T-exit | ⬜ Not started | — | — | — | — |

