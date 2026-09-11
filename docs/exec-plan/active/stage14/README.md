# Stage 14（階段 N）— 三任務量測指標的三層契約【暫時方案】

> 上層索引：[`docs/exec-plan/README.md`](../../README.md) ← **大框架權威**
> 本檔為 stage14 的 stage 層索引。
>
> ⚠️ **本檔為暫時方案（草案），不是已批准的 WP 定義。** 建立於 2026-09-09,由「定義三個測試任務的量測指標」
> 的設計對話產出。以下 WP 邊界、估時與編號**皆為候選值**;WP 資料夾尚未建立,`task-checklist.md` 與
> `progress.md` 亦不存在。任何 task 開工前必須先把對應 WP 從本檔升格為正式 WP 文件(README + T0 entry-gate
> + task-checklist),並照 [CLAUDE.md §3](../../../../CLAUDE.md) 的執行協議走。

---

## 1. 這個 stage 在解什麼

三個測試任務要定義量測指標:

| Drill | mode | 場上目標 | 指標現況 |
|---|---|---|---|
| `spider-shot-v3` | assessment（`spider-shot-v3@1.0.0` 凍結） | 1 | ✅ 五類構念已實作並進 registry |
| `spider-shot-wide-v1` | practice（researcher-only） | 1 | ⚠️ 推導可跑但刻意不宣稱信度;時序未校準（OQ-57.4） |
| `micro_flick_three_target_test_v8` | practice（researcher-only） | **3（同時存活）** | ❌ 零實作;僅設計提案 [`docs/algorithm/micro-flick/README.md`](../../../algorithm/micro-flick/README.md) |

**已凍結的四個框架決策**（2026-09-09 設計對話,使用者拍板）:

| # | 決策 | 理由 |
|---|---|---|
| P14-1 | **先定構念,交付面後談** | 本 stage 不處理 assessment 升格、不動 `DrillMetricRegistry` 的 practice 排除政策。C-D3 信度閘留給後續 WP。 |
| P14-2 | **可比範圍 = v3 ↔ wide-v1;v8 獨立** | 兩者同屬 center-peripheral 同一套錨點、只差幅度與閾值,天然可比（承 [`analysis-spider-shot.md`](../../../operational/analysis-spider-shot.md) 的「同輩不同構念」）。v8 因多目標自由選擇,單獨一套構念。 |
| P14-3 | **v8 的 trial = 軌跡意圖歸因** | 不採 kill-to-kill 純區間,要能分離「選哪顆」與「打得多準」。代價:歸因規則必須自帶驗證與版本字串。 |
| P14-4 | **歸因驗證來源 = 合成 harness 已知意圖** | 零真人資料即可驗證規則的機械正確性。**明確不宣稱生態效度** —— 交付物必須標註「未經真人校準」,cued ground-truth 協定列為後續 WP 的前提。 |

### 為什麼需要一個新的 primitive（方案 A 的核心）

既有分析棧有一個貫穿全棧、從未被寫下的前提:**場上只有一顆目標**。[`firstShot.ts:20-22`](../../../../src/sim/firstShot.ts#L20-L22) 把它寫得最白:

> 「階段 A 一次只一個 active 目標(counter-strafe peek 節奏),故取首個即可。」

v8 違反這個前提。後果不是報錯,而是**四個靜默錯誤**——數字看起來完全合理,但歸屬到錯的目標:

| # | 位置 | 靜默錯誤 |
|---|---|---|
| 1 | [`RingBuffer.ts:214-222`](../../../../src/data/RingBuffer.ts#L214-L222) | `recordState` 掃到第一個 `visible && alive` 就 `break` ⇒ `ticks[].tx/ty/tz` 與 `replayTargetId` 只描述三顆中的一顆,而且由陣列順序這個實作產物決定 |
| 2 | [`trackingDerivation.ts:284`](../../../../src/metrics/trackingDerivation.ts#L284) | `targetForTick()` **優先**讀 `tick.tx`。v8 的 `tx` 恆非 null ⇒ 另外兩顆的 `ε(t)` 與 `onTarget` 是對錯的目標算的 |
| 3 | [`trackingDerivation.ts:156`](../../../../src/metrics/trackingDerivation.ts#L156) · [`peekWindows.ts:47-50`](../../../../src/metrics/peekWindows.ts#L47-L50) | 窗界 `windowEnd = nextVisible.t`。v8 的下一個 `visible` 通常屬於另一顆 ⇒ 每顆的分析窗被別人的 spawn 截斷 |
| 4 | [`SimLoop.ts:421-427`](../../../../src/loop/SimLoop.ts#L421-L427) | `fire.offsetDeg` 對 `currentPeekId` 那顆算;`fire.firstShot` 也以它為鍵 ⇒ 首發角誤差恆對錯目標,且陣列首顆存活期間後續 fire 的 `firstShot` 恆 `false`（**首發語意崩壞**） |

**但蒐集層是夠的** —— 這是本 stage 不需要改 recorder 或 schema 的理由:

- [`SimLoop.ts:551-570`](../../../../src/loop/SimLoop.ts#L551-L570) `recordVisibleEvents` **逐顆**記錄,每顆都帶 `targetX/Y/Z`;
- v8 目標**靜態**（config 無 `motion`,GD-7/WP-18 契約保證逐位不變）⇒ 位置在整個存活期恆定,不需要 per-tick 位置;
- v8 無 `peekTimeoutMs`,目標只會被打掉 ⇒ 存活期 `[visible.t, 該顆命中 fire.t]` 閉合;
- `fire` 事件帶 `viewYaw`/`viewPitch` ⇒ 對任一目標的角誤差都能離線重算;
- 命中時 `fire.targetId` 被 raycast 結果覆寫（[`SimLoop.ts:445`](../../../../src/loop/SimLoop.ts#L445)）⇒ **命中歸屬正確**。

⇒ v8 缺的是**離線重建層**,不是蒐集層。

---

## 2. 方案 A — 三層契約

```
primitive 層   新增 buildTargetWindows()（per-target 窗界，population-aware）
               ＋ 重用既有 canonical：trackingDerivation / angularKinematics / eyeOrigin
                 ↓
家族構念層     spider 家族（v3 + wide）：既有五類構念，wide 加掛 validity 層
               micro-flick 家族：新增「選擇—執行」構念（歸因切段）
                 ↓
任務指標層     每個 drill 一份 spec：descriptors ＋ 排除規則 ＋ 版本字串
```

### 為什麼是「新增」而不是「改 `peekWindows`」

被否決的替代方案(記錄於此,避免後續 WP 重新提案):

| 方案 | 否決理由 |
|---|---|
| **B — v8 完全獨立管線**（自己一套窗界、自己一套幾何） | blast radius 表面上最小,但窗界邏輯會有兩套實作。只要有人在 v8 側順手重算 `on-target` 或 `ε`,就直接踩 **C-D4**（既有構念不得有第二定義）。把紅線風險藏進未來的每一次修改。 |
| **C — 改造 `buildPeekWindows` 支援並發** | `buildPeekWindows` 是 counterstrafe / peek / tracking 全家族的錨點,身上有 golden fixture 與 promoted parity 測試（**C-D5**）。為一個 practice-only drill 動已凍結協定,風險不對價。 |

**方案 A 的硬紀律**:新 primitive 只負責**窗界**（哪些 tick 屬於哪顆目標的哪一段）。`ε(t)`、`on-target`、eye origin、`ω(t)` 一律繼續呼叫既有 canonical derivation,**不得在 v8 側重寫任何幾何** —— 這是 C-D4 的落地判準,也是本 stage 每個 T-exit 的必查項。

---

## 3. WP 清單（候選,未批准）

使用者指定的處理順序:**先 v3 → 再 wide → 最後 v8**。編號依 [GD-15](../../DECISIONS.md)「先採納先得」候選為 WP-62 起算（現行最高 WP-61,stage13）。

| WP（候選） | 一句話 | 相依 | 估時（d） | 狀態 |
|---|---|---|---|---|
| **WP-62** | `spider-shot-v3` 量測參數定案:把已實作的五類構念與五個 registry 指標寫成規格權威,並處理 KI-031 造成的兩類構念空洞 | **KI-031**（見 §4） | 3–5 | 🟡 規劃中。參數文件已交付:[`spider-shot-v3-measurement-parameters-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html) |
| **WP-63** | `spider-shot-wide-v1` 效度層:`meta.dpi` 蒐集紀律、以 cm/360 為 x 軸的抬滑鼠混淆分析、與 v3 的幅度→表現斜率對照 | WP-62 · WP-61（sensor lift） | 4–6 | ⬜ 未開始 |
| **WP-64** | `micro_flick_three_target_test_v8`:`buildTargetWindows()` primitive + 三顆離線重建 + 意圖歸因規則 + 合成 harness 驗證 | WP-62（primitive 紀律定案） | 6–10 | ⬜ 未開始 |

**為什麼 v3 先行**:v3 是唯一已凍結的 assessment 協定,它的構念定義是另兩支的語彙來源。若 v8 的新 primitive 先落地,`ε`/on-target 的權威歸屬會變成事後追認。

---

## 4. 阻塞:KI-031 讓 v3 的兩類構念在真人資料上歸零

[**KI-031**](../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 狀態 🔴 **未修**。這不是本 stage 新發現的問題,但它**直接決定 WP-62 能交付什麼**:

四份真人 `spider-shot-wide-v1` 匯出（60 Hz 顯示）的 113 個周邊 presentation,`deriveDetectionMetrics()` 以 canonical 預設參數執行 ⇒ `status: 'detected'` **0 / 113**。下游:

| `deriveSpiderShotMetrics()` 欄位 | 真人資料有值 |
|---|---|
| `switchReaction.tDetectMs` / `.reactionMs` | **0 / 34** |
| `movementExecution.movementTimeMs` | **0 / 34** |
| `movementExecution.peakOmegaDegPerSec` | 34 / 34 |
| `stopControl.overshootDeg` | 8 / 34 |
| `firstShot.hit` / `.fireAngleErrorDeg` | 34 / 34 |
| `rhythm` | ✅ |

根因是 `firstSustainedDecrease()` 要求 `sustainedTicks: 4` 個**連續**合格樣本,而 60 Hz 顯示下 `aim` 約每兩個 sim tick 才更新一次 ⇒ 負值與 0 嚴格交替,連 2 連都湊不出來。KI-031 §2 的失效邊界:

- `f ≥ 128 Hz`（144 Hz 顯示）：幾乎無零樣本 ⇒ 從未在既有 fixture 上現形
- `f ≈ 120 Hz`：約 6% 零樣本 ⇒ 偶發漏檢
- `f ≈ 64 Hz`（60 Hz 顯示）：約 50% 且規則交替 ⇒ **100% 失敗**

**這是懸崖,不是漸進退化。** 對本 stage 的兩個直接後果:

1. **採集紀律**:v3 的 run 必須在 **≥ 144 Hz 顯示**的機器上錄,否則五類構念裡有兩類靜默消失。`meta.displayHz`（[`metadata.ts:154`](../../../../src/data/metadata.ts#L154),實測非自述）已足以做這道閘。
2. **WP-62 的範圍決策（待定,列為 OQ-62.1）**：是「只加資料充足性旗標、把 KI-031 當採集前提」,還是「本 stage 一併修判準」。後者是 **C-D5 雙實作**指標（TS `detectionDerivation.ts` ↔ Python `detect.py` + `research/fixtures/parity/detect-*.json` 凍結對表）,必須兩端同步 + 重跑 golden + 版本字串升版,不得原地改語意。KI-031 §5 建議的修法 (a)「連續 N 個 tick → 持續 N 毫秒」是候選,但那是一個獨立的 bugfix WP,不該藏在指標定義 WP 裡。

> **協議歸屬**:KI-031 的修復決策走 [CLAUDE.md §3.9](../../../../CLAUDE.md) —— 診斷計畫在 `KI-031-*.md`,修法決策入
> [`BUGFIX-DECISIONS.md`](../../../known_issue/BUGFIX-DECISIONS.md) 的 `BD-031`。**不**走本 stage 的 `DECISIONS.md`。

---

## 5. 蒐集面前提（非程式改動,但缺了指標就無效）

| 前提 | 出處 | 缺席的後果 |
|---|---|---|
| `meta.dpi` 必填（self-reported,瀏覽器讀不到） | [`mouseThrow.ts:38`](../../../../src/metrics/mouseThrow.ts#L38) | `cmPer360` 為 `undefined` ⇒ **wide-v1 的抬滑鼠混淆分析沒有 x 軸**,感度會以「被迫抬滑鼠」的形式偷渡成混淆因子 |
| 顯示 ≥ 144 Hz | KI-031 §2 | v3/wide 的 `switchReaction` 與 `movementTimeMs` 靜默歸零（§4） |
| `?rawMouse=1` opt-in | [`main.ts:736`](../../../../src/main.ts#L736) | 只有 128 Hz tick 級 `aim`;v8 微調段（靶徑 2.48°）與 submovement 偵測的時間解析度受限 |
| `crossOriginIsolated === true` | ADR-4 | 計時精度不足,量測資料失效 |
| practice run 不進 history | 五軸契約「Historical comparison: Excluded by default」 | wide-v1 與 v8 的匯出 JSON 必須自行保存,不會有 trend |

---

## 6. 真人資料需求（本 stage 的誠實邊界）

**不需要真人資料**:構念的運算定義、窗界原語、決定性、歸因規則的 precision/recall、單位換算、幾何同源性（GD-7）、指標對 tick rate／render FPS 的敏感度掃描、spacing exploit 檢查（WP-59 已有 harness）。

**非真人不可**(全部列為後續 WP 的前提,本 stage 不宣稱):

| # | 項目 | 為什麼合成資料辦不到 |
|---|---|---|
| 1 | 時序參數校準（wide-v1 `peekTimeoutMs = 2500` 為未校準候選值,OQ-57.4;v3 的 2.0° 與 10–25° 亦自承未經 pilot 校準） | 合成輸入不會告訴你人類的 movement time 分布落在哪,因此無法判斷 timeout 是砍掉了真實的慢 trial 還是寬到無效 |
| 2 | 信度／構念驗證（C-D3 閘） | test-retest、split-half、與外部效標的相關,定義上需要人 |
| 3 | 抬滑鼠在 wide-v1 的實際發生率與偽陽率 | `deriveRepositioningSuspicion()` 是 suspicion 旗標;閾值與偽陽率需真人標註（WP-61 的 cohort 即為此） |
| 4 | 歸因規則的生態效度（P14-4 明確延後） | 合成只證明機械正確。人類軌跡是否真有可辨識的 movement onset、有多少 trial 是「一路修正沒有明確彈道段」,只有真人資料知道 |
| 5 | 地板／天花板效應 | v8 的 60 kill 與 5°/2.6° 間距是否讓所有受試者貼天花板（hit rate ≈ 100%）⇒ 指標無鑑別力 |
| 6 | v3 ↔ wide 的幅度→表現斜率是否單調 | P14-2 的可比性宣稱本身就是一個待驗證的實證主張 |

---

## 7. 編號分配（候選）

- **WP 編號**:候選 WP-62～64。現行最高 WP-61（stage13）。依 [GD-15](../../DECISIONS.md)「先採納先得」,平行 session 若先取用則本 stage 順延,不爭號。
- **GD 編號**:本 stage 預計需要一筆全域決策（三層契約的層邊界與 C-D4 歸屬,即 §2 的硬紀律）。現行最高 **GD-37**,候選 **GD-38**。同樣不預留、不爭號 —— 實際入帳時以當下 `DECISIONS.md` 最高號 +1 為準。
- **BD 編號**:KI-031 的修法決策為 `BD-031`,由該 KI 的修復 WP 入帳,不屬本 stage。

---

## 8. 相依圖

```
KI-031（🔴 未修：detection 連續性判準在 <128 Hz aim 更新率下失效）
   │  阻塞 switchReaction / movementTimeMs 的真人可用性
   ▼
WP-62（spider-shot-v3 量測參數定案）  ← 先做
   │  產出：構念語彙權威 + primitive 層硬紀律
   ├──────────────────────────┐
   ▼                          ▼
WP-63（wide-v1 效度層）      WP-64（v8 per-target 窗界 + 歸因）
   │  需要 meta.dpi 紀律          │  需要合成 harness 已知意圖
   │  ＋ WP-61 sensor lift        │  明確不宣稱生態效度
   ▼                          ▼
（後續：cued ground-truth 校準協定 → C-D3 信度閘 → assessment 升格）
```

---

## 9. 待決問題

| OQ | 問題 | 影響 |
|---|---|---|
| OQ-62.1 | KI-031 是「加資料充足性旗標 + 採集前提」還是「本 stage 一併修判準」? | 決定 WP-62 估時（3–5 d vs +C-D5 雙實作同步）與 v3 五類構念的交付完整度 |
| OQ-62.2 | v3 的五個 registry 指標是否需要增刪（例如補 `microAdjustCount` 中位數、或補逾時率）? | 目前 descriptors 由 v2 機械 rename 而來（[`DrillMetricRegistry.ts:219-221`](../../../../src/history/DrillMetricRegistry.ts#L219-L221)）,尚未針對 v3 的 eye-frame 幾何重新選過 |
| OQ-63.1 | `meta.dpi` 缺席的 run 要 fail fast 還是降級交付? | 決定 wide-v1 效度層是硬閘還是軟旗標 |
| OQ-64.1 | 歸因規則的 movement onset 判準要用 `ω(t)` 門檻、`dε/dt` 符號,還是兩者合議? | 直接決定合成 harness 要生成哪些故障型態 |
| OQ-64.2 | v8 是否需要 `?rawMouse=1` 才能支撐歸因切段? | 決定採集紀律,以及既有 v8 匯出是否全部作廢 |

---

## 10. 文件產出

| 文件 | 狀態 |
|---|---|
| 本檔（stage14 暫時方案） | ✅ 2026-09-09 |
| [`HANDOFF-v3-real-data.md`](HANDOFF-v3-real-data.md) — 用三份真人 run 產出 v3 教練報告的接手 prompt（含五道必經閘與已驗證採集條件） | ✅ 2026-09-09 · **已執行**（§9 DoD 有一條被實測推翻,見檔頭） |
| [`progress.md`](progress.md) — stage14 的 episodic memory：三份真人 run 的實測結論、被推翻的設計假設、新開的 KI-034/035/036、偏離協議之處 | ✅ 2026-09-09 |
| [`SESSION-HANDOFF-2026-09-09.md`](SESSION-HANDOFF-2026-09-09.md) — session 交接：現況、已凍結決策、下一步優先序、平行 session 危險 | ✅ 2026-09-09 |
| [`coach-figures/`](coach-figures/README.md) — 七張圖的 SVG 產生器與渲染檢查（WP 工作資產，可搬走） | ✅ 2026-09-09 |
| [`spider-shot-v3-measurement-parameters-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html) — v3 預計計算的參數與其意涵 | ✅ 2026-09-09 |
| [`spider-shot-v3-performance-metrics-design-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-performance-metrics-design-2026-09-09.html) — v3 選手表現量化設計（三層模型／機制指標裁決／教練解讀／驗證計畫／風險） | ✅ 2026-09-09 |
| [`spider-shot-v3-coach-metrics-and-charts-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html) — v3 教練視角的指標與圖示提案（五個問題／三個新指標 M1–M3／七張圖／教練紀律） | ✅ 2026-09-09 |
| wide-v1 參數文件 | ⬜ WP-63 |
| v8 參數文件 + 歸因規則規格 | ⬜ WP-64 |
