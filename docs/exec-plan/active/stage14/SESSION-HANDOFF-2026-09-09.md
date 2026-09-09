# SESSION HANDOFF — 2026-09-09 · stage14 三任務量測指標

_給接手的 AI agent。整份貼給它,或讓它讀這個路徑。_

---

## 0. 一句話現況

使用者要為三個測試任務(`spider-shot-v3`、`spider-shot-wide-v1`、`micro_flick_three_target_test_v8`)
定義量測指標。**v3 的三份設計文件已交付並全部未 commit**;使用者已完成 v3 真人測試(三份匯出),
下一步是**用真實數字重繪教練報告**。

---

## 1. 這個 session 交付了什麼（全部未 commit）

| 檔案 | 內容 |
|---|---|
| `docs/exec-plan/active/stage14/README.md` | stage14 **暫時方案**(方案 A 三層契約)。WP-62/63/64 為候選編號,未批准 |
| `docs/exec-plan/active/stage14/HANDOFF-v3-real-data.md` | **真實資料分析的 handoff**(五道必經閘 + 已驗證採集條件)← 下一步就照這份做 |
| `docs/exec-plan/active/stage14/coach-figures/` | 圖表產生器 + README(從暫存區保存下來,可搬走) |
| `docs/algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html` | v3 **參數清冊**:每個參數的精確運算定義與意涵 |
| `docs/algorithm/spider_shot/spider-shot-v3-performance-metrics-design-2026-09-09.html` | v3 **研究設計**:三層模型、機制指標裁決、驗證計畫、風險 R1–R9 |
| `docs/algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html` | v3 **教練提案**:五個問題、新指標 M1–M3、七張圖、教練紀律 |

三份 HTML 都通過標籤平衡檢查;教練提案的七張圖通過 Playwright light/dark 幾何檢查。

---

## 2. ⚠️ 兩個一定要先知道的危險

### 2.1 這個 checkout 有平行 session 在同時工作

session 開始時 `git status` 是乾淨的。現在多出來的下列檔案**不是本 session 建的**,
是另一個 session(WP-61 sensor-lift + wide-v1)的工作:

```
M  .gitignore, package.json
M  research/src/modules/ingest/algorithms/loader.py
M  scripts/analyze-spider-wide-repositioning.ts, scripts/spiderWideRepositioningRunner.ts
M  docs/operational/spider-wide-recording-spec.md
?? docs/algorithm/spider_shot/spider-shot-wide-v1-performance-metrics-proposal-2026-09-09.html
?? research/src/lift/, research/fixtures/exports/synthetic_sensor_lift.json
?? research/fixtures/golden/lift-segments-synthetic-lift.json
?? research/src/modules/ingest/algorithms/tests/test_loader_annotation_events.py
?? scripts/analyze-lift-cohort.ts, scripts/liftCohortAudit.ts, scripts/liftManifest.ts
?? scripts/liftSegmentationGolden.ts, scripts/mouseSamplingHealth.ts
?? scripts/record-lift-segmentation-golden.ts, scripts/mouseSamplingHealth.ts
?? tests/regression/wp61-lift-cohort-audit.test.ts
?? tests/regression/wp61-lift-segmentation-golden.test.ts
```

**commit 時只 stage §1 那六條路徑。** 別用 `git add -A`。
若要改 `docs/exec-plan/README.md`、`task-checklist.md` 或 `graphify-out/` 這類共編索引檔,
同一行衝突時用 `git hash-object` + `git update-index` 只 stage 自己那幾行。

### 2.2 使用者的真人匯出不進 repo

三份 v3 匯出在 `C:\Users\Hsin.YH.Yang\Downloads\`。依 `.gitignore` 既有紀律
(`.pilot-analysis/`、`.contact-analysis/`、`.spider-wide-analysis/`、`.lift-cohort-analysis/`)
與 D-57.T5-8:**原始 JSON 與由它推導的產物一律留在 gitignored 目錄**。

---

## 3. 已凍結的決策（使用者拍板,不要重新討論）

| # | 決策 |
|---|---|
| P14-1 | **先定構念,交付面後談**。不處理 assessment 升格、不動 registry 的 practice 排除政策 |
| P14-2 | **可比範圍 = v3 ↔ wide-v1;v8 獨立** |
| P14-3 | **v8 的 trial = 軌跡意圖歸因**(不採 kill-to-kill 純區間) |
| P14-4 | **歸因驗證 = 合成 harness 已知意圖**,明確不宣稱生態效度 |
| 方案 A | **三層契約**:新增 per-target 窗界 primitive,但 `ε`/on-target/eye origin 一律用既有 canonical derivation。方案 B(v8 獨立管線)與 C(改 `peekWindows`)已否決,理由記在 stage14 README §2 |

---

## 4. 下一步（優先序）

### ① 用真實數字重繪 v3 教練報告 ← 使用者要的就是這個

**照 [`HANDOFF-v3-real-data.md`](HANDOFF-v3-real-data.md) 執行。** 那份文件是完整的 prompt,
含三份匯出的路徑、已實測的採集條件、五道必經閘、公式、陷阱、實作先例、DoD。

四個**已實測**的關鍵事實(不要重新猜,但歡迎覆驗):

1. `displayHz = 240` ⇒ **KI-031 的懸崖不該咬到**。但零位移 tick 佔 35–39%(多半是真的手沒動),
   所以第一道閘是「先跑 `deriveDetectionMetrics()` 回報 detected 比例」,**不可默默輸出空相位**。
2. `validDurationMs`(65.15/64.66/64.41 s)**包含 3 秒倒數**,計分窗只有 60.0 s
   ⇒ **hits/min 絕對值被低估約 8–9%**。要並列兩個分母版本;確認是缺陷就開 KI,別逕改 registry。
3. **三份的前 75 個呈現逐位相同**(同 seed 260827)⇒ 不是獨立取樣,是同一序列的三次重複。
   pooling 只能在共同前綴內;pooled 12 格每格 ≈ 9 但只有 3 個相異位置 ⇒ clustered,非 i.i.d.。
   **反過來說這是現成的學習曲線資料,建議當報告主軸之一。**
4. **只有 3 場 ⇒ 沒有基準、沒有 MDC**。C1/C2 走「建立基準中 3/3」降級;
   **任何地方都不得出現「MDC」這個詞**。

兩個會讓數字直接錯掉的陷阱:

- **`side` 三份全是 `'R'`**(43/43 個周邊事件),那是佔位值。弱側分析必須用
  `deriveSpiderShotTransitions()` 的 eye-frame `side`,並先用 `quadrant` 篩掉 `vertical`。
- **`firstShot.hit` 會高估首發命中率**(窗內任一發命中即 `'hit'`)。這批無 `shotSeq`、無 `hit` 事件
  (hitscan)⇒ 用 `fire.hit` + `fire.targetId`。歷史 projector 本身不受影響。

### ② 待使用者決定:圖表產生器的正式歸屬

我已把它從暫存區保存到 `stage14/coach-figures/`(見該資料夾 README)。
使用者尚未回答要不要正式化;若要,依 C-D2 繪圖與 I/O 應落在
`research/src/modules/metrics/notebooks/` 或 `scripts/`。**在使用者答覆前不要搬。**

### ③ 尚未開始

| WP（候選） | 內容 | 狀態 |
|---|---|---|
| WP-63 | `spider-shot-wide-v1` 效度層(`meta.dpi` 紀律、cm/360 為 x 軸的抬滑鼠混淆、與 v3 的幅度斜率對照) | ⬜ 未開始。⚠️ 平行 session 已產出一份 wide-v1 提案 HTML,**先讀它再動** |
| WP-64 | v8 的 `buildTargetWindows()` primitive + 三顆離線重建 + 意圖歸因 + 合成驗證 | ⬜ 未開始 |

---

## 5. v8 的四個靜默錯誤（做 WP-64 前必讀）

既有分析棧有一個貫穿全棧、從未寫下的前提:**場上只有一顆目標**
([`firstShot.ts:20-22`](../../../../src/sim/firstShot.ts#L20-L22) 的註解寫得最白)。
v8 有三顆同時存活,後果不是報錯,而是**數字看起來合理但歸屬到錯的目標**:

| # | 位置 | 錯誤 |
|---|---|---|
| 1 | `RingBuffer.ts:214-222` | `recordState` 掃到第一個 `visible && alive` 就 `break` ⇒ `ticks[].tx/ty/tz` 只描述三顆中的一顆 |
| 2 | `trackingDerivation.ts:284` | `targetForTick()` 優先讀 `tick.tx` ⇒ 另外兩顆的 `ε`/`onTarget` 對錯目標算 |
| 3 | `trackingDerivation.ts:156` · `peekWindows.ts:47-50` | 窗界 `= nextVisible.t`,而 v8 的下一個 `visible` 通常屬於另一顆 |
| 4 | `SimLoop.ts:421-427` | `fire.offsetDeg`/`firstShot` 對 `currentPeekId` 那顆算 ⇒ 首發語意崩壞 |

**但蒐集層是夠的**:`recordVisibleEvents` 逐顆記錄且帶 `targetX/Y/Z`;v8 目標靜態
⇒ 位置整個存活期恆定;`fire` 帶 `viewYaw/viewPitch` ⇒ 角誤差可離線重算;命中時 `fire.targetId`
被 raycast 結果覆寫 ⇒ 命中歸屬正確。**v8 缺的是離線重建層,不是蒐集層。**

---

## 6. 不可違反的紅線（分析任務相關）

- **禁 `Date.now()`**,一律 `performance.now()`(ADR-4)。
- **C-D4:既有構念不得有第二定義** —— `ε(t)`、on-target、`t_detect`、`D_deg`、`W_deg` 一律呼叫既有
  canonical derivation。**不要在報告腳本裡重算幾何。**
- **C-D5:雙實作對表** —— 動到 `seg-v2`/`phase-v1`/`curve-v1`/`sync-v1`/`sg-seg-v2` 任一端,
  必須兩端同步 + 重跑 golden + `promoted-*.test.ts` 全綠 + 版本升號。**本任務不該需要動它們。**
- **不要修改凍結協定** —— `spider_shot_v3.ts` 的常數、registry 既有 descriptor 語意都不在範圍。
  M1(首發有效速度)是**新增** descriptor。
- **C-D3:未通過構念驗證的指標不得進教練報告** —— 這批資料是 n=1 位受試者、3 場、同一序列重複、
  同一天連續錄製。報告只能描述這三場,**不得宣告能力、進步或退步**。
- **`sync-v1` 對 v3 結構性不適用**(無 `counter` 事件),不要算。

---

## 7. 執行協議提醒

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit。
- 完成時更新該 WP 的 `progress.md`(Progress / Decision Log / Surprises / Open Questions)並與切片一起 stage。
- 跨 WP／跨文件的決策或矛盾 → `docs/exec-plan/DECISIONS.md`;修 bug 的決策 →
  `docs/known_issue/BUGFIX-DECISIONS.md`(`BD-n` 對應 `KI-NNN`)。
- 現行最高:**WP-61**、**GD-37**。依 GD-15「先採納先得」不預留、不爭號。
- stage14 目前**沒有** `progress.md` 與 `task-checklist.md` —— 它還是暫時方案。
  任何 task 開工前要先把對應 WP 從 README 升格為正式 WP 文件。

---

## 8. 待使用者回答的問題

1. 圖表產生器要不要正式化、放哪(§4②)。
2. 三份 v3 HTML + stage14 要不要現在 commit(目前全部未 commit,分支 `docs/wp-61-lift-off-validation-plan`
   —— 注意這個分支名是平行 session 的主題,可能需要另開分支)。
3. OQ-62.1:KI-031 是「只加資料充足性旗標 + 採集前提」還是「一併修判準」(後者是 C-D5 雙實作變更)。
4. OQ-62.2:v3 的五個 registry descriptor 是否增刪(目前是 v2 的機械 rename)。
