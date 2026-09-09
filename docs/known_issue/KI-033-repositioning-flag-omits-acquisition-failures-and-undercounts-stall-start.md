# KI-033 — 抬滑鼠疑慮旗標①把 acquisition failure 併入「乾淨」、②停滯起點少算一個 tick

> 類型：**latent measurement defect**（兩項皆為**漏報**方向 ⇒ 不會產生假陽性，但會系統性低估）。
> 狀態：🔴 **診斷完成（2026-09-09），修法待落地**。尚無 `BD-033`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/metrics/spiderShotRepositioning.ts`](../../src/metrics/spiderShotRepositioning.ts)（WP-57 / T5，
> `main` 現行實作 = `f3bc045` + 真人校準 `e49cc54`）。
> 相關：[DECISIONS.md GD-37 ②](../exec-plan/DECISIONS.md)（WP-61 T0 把本函式的語意與真人校準值
> **凍結**為 sensor lift 構念的邊界前提）· [KI-031](KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)
> （同一次真人校準發現的 detection 失效，與本 KI 的 ① 高度耦合）·
> [CLAUDE.md §4 C-D3／C-D4](../../CLAUDE.md)。
> 發現脈絡：2026-09-09 審 `claude/wp-57-t5-repositioning-ue9cc2` 能否合併回 `main` 時，發現該分支是
> **同一個 task（WP-57 T5）的另一份獨立實作**（commit message 與 `f3bc045` 相同但 patch-id 不同）。
> 該分支整體**不應合併**（會退掉 `e49cc54` 的真人校準、改動 GD-37 ② 已凍結的簽章、並打破建構在現行
> 簽章上的 WP-61 `scripts/liftCohortAudit.ts`），但它對兩個判定點的處理**比 `main` 現行版本更站得住腳**。
> 該 commit 已保存為本機 tag **`archive/ki-033-wp-57-t5-alt-impl`**（→ `a0437ae`）；remote 分支已刪除。

## 1. 症狀

兩項皆無觀測失敗（旗標目前只被離線 script 消費、零 `src/` importer），但兩者都讓旗標**低估**抬滑鼠。

### ① acquisition failure 被回報成 `suspected: false`

```ts
// spiderShotRepositioning.ts:116-118
const onsetMs = onsetByTarget.get(event.targetId);
const arrivalMs = arrivalByTarget.get(event.targetId);
if (onsetMs === undefined || arrivalMs === undefined) return { targetId: event.targetId, suspected: false };
```

`arrivalMs === undefined` 意即**該次抵達整段沒有任何 `onTarget` 樣本**（acquisition failure）。現行
版本把它與「窗可推導且窗內無停滯」**輸出成同一個值** `suspected: false`。檔內註解自承這是
「無從判定」而非「已判定沒有抬滑鼠」，並要求呼叫端另去對照 canonical derivation 的
`status`／`acquisitionFailure` 才能分辨 —— 但輸出型別沒有任何欄位承載這個區別。

**方向恰好最壞**：「拉槍拉不到目標」本身就是抬滑鼠最強的行為訊號之一。現行版本把最該標的個案
歸進「乾淨」那一堆。

**與 KI-031 的耦合使其嚴重性放大**：KI-031 實測四份真人 `spider-shot-wide-v1` 匯出的
`detected = 0/113` ⇒ `onsetMs` 在真人資料上**幾乎全部 `undefined`**，本函式在真人 run 上幾乎只會
輸出 `suspected: false` 整排。旗標在真人資料上**目前等於恆偽**，而它看起來像「量過且乾淨」。

### ② 停滯區段起點／長度少算最多一個 tick 間隔

```ts
// spiderShotRepositioning.ts:155-156, 160
if (runStartMs === undefined) runStartMs = t;
runEndMs = t;
...
best = longer(best, { startMs: runStartMs, durationMs: runEndMs - runStartMs });
```

`omega[i]` 依 [`angularKinematics.ts`](../../src/metrics/angularKinematics.ts) 的契約描述的是區間
**`(ticks[i-1].t, ticks[i].t]`** 的平均角速度。現行版本以「首個合格樣本的時間戳」當區段起點，等於
把第一個合格區間的**左端整段丟掉** ⇒ 區段長度少算最多一個 tick 間隔（128 Hz 下 7.8125 ms）。
檔內註解已明示知情並自述「刻意選保守側」。

在 `stallMinMs = 150`（`e49cc54` 的真人校準值）之下這是 **~5.2% 的系統性低估**，且它**恆向漏報**
—— 不是隨機噪音，而是每一段都少算。

## 2. 根因

兩者是**同一個設計取向的兩個面**：現行實作在每個不確定處都選「回報比較不驚人的那個值」，而輸出
型別只有一個 `suspected: boolean`，沒有第三態。於是「無從判定」與「判定為乾淨」被迫共用同一個編碼。

`archive/ki-033-wp-57-t5-alt-impl`（`a0437ae`）對同兩點的處理：

```ts
// ① 缺 onset ⇒ 不出列（缺列 ≠ 乾淨）；從未 on-target ⇒ 仍出列，右界改用 presentation 結束
const windowStartMs = detection.get(event.targetId)?.tDetectMs;
const presentation = tracking.get(event.targetId);
if (windowStartMs === undefined || presentation === undefined) continue;

const windowEndMs = presentation.samples.find((sample) => sample.onTarget)?.t ?? presentation.windowEndMs;
```

```ts
// ② 區段起點取前一個 tick 的時間戳並夾到窗左界，對齊 omega[i] 的區間語意
function segment(ticks, firstIndex, lastIndex, windowStartMs): StallSegment {
  const startMs = Math.max(ticks[firstIndex - 1].t, windowStartMs);
  return { startMs, durationMs: ticks[lastIndex].t - startMs };
}
```

該版本以 `continue` 表達「無從判定」（缺列），用 `windowEndMs` 讓 acquisition failure 仍可被評估，
並讓區段時間與 ω 的區間定義逐格對齊。其行內論證為：「抓不到目標又長時間近零正是抬滑鼠最強的訊號，
把它排除掉會剛好漏掉最該標的個案。」

## 3. 影響面

1. **今日無錯資料流出**：旗標零 `src/` importer（由 `spiderShotRepositioning.test.ts` 的 boundary
   scan 釘死），只被 `scripts/analyze-spider-wide-repositioning.ts` 與
   `scripts/spiderWideRepositioningRunner.ts` 消費。C-D3 未被違反。
2. **WP-57 的 DoD 宣稱需要限定**：`task-checklist.md` 記「抬滑鼠疑慮旗標可用、有門檻敏感度表」，
   而敏感度表建立在**合成 cohort** 上（OQ-57.5 維持開放）。合成 cohort 的每次抵達都會 on-target
   ⇒ ① 在合成資料上**永不觸發**，這正是它沒被測出來的原因。
3. **對 WP-61 的影響是「不得靜默改」**：GD-37 ② 明文把本函式的語意與真人校準值
   （`stallMinMs=150`／`stallOmegaDegPerSec=2`）凍結為 sensor lift 構念的**邊界前提** ——
   WP-61 的 T3 可分性消融要靠「這是既有的角速度停滯標註、語意不動」來歸因。
   ⇒ **本 KI 的修法不得在 WP-61 T3 判定產出前落地**，否則消融的基線會在中途換掉。
   WP-61 task-checklist 的 DoD「`deriveRepositioningSuspicion()` 語意一行未改」是硬條件。
4. ① 與 [KI-031](KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 有共同
   根源脈絡：兩者都是「真人資料上恆退化成合法值、CI 全綠」。KI-031 修好之前，① 的修法無法在真人
   資料上驗證（`onsetMs` 幾乎全 `undefined` ⇒ 走不到 ① 那條分支）。

## 4. 修改計畫（未落地）

**排序是硬相依**：`KI-031` → 本 KI ①，且**整份等 WP-61 T3 判定產出後**才可動。

**選項 A（建議）—— 採納 archive 版的兩個判定，但保留 `main` 的簽章與真人校準值。**

- ①：`onsetMs === undefined` 改為**不出列**（`continue`），並在 doc comment 明示「缺列 = 無從判定，
  不等於乾淨」;`arrivalMs === undefined` 改為仍出列、右界取 `presentation.windowEndMs`。
  ✅ **前提已複驗**（見 §5 OQ-KI33-1）：`TrackingPresentationSamples.windowEndMs` 存在於
  [`trackingDerivation.ts:112`](../../src/metrics/trackingDerivation.ts#L112)，值為
  `nextVisible?.t ?? Infinity`（`:163`）—— 與 archive 版的假設逐字相符，無需新增欄位。
- ②：區段起點改 `Math.max(ticks[firstIndex - 1].t, windowStartMs)`、長度改
  `ticks[lastIndex].t - startMs`，並把 `i >= 1` 的顯式跳過取代對 `omega[0]` 為 `NaN` 的隱式依賴。
- **不動**：`RepositioningSuspicionOptions` 的 `detection?`／`tracking?` 獨立簽章（archive 版改成
  `extends SpiderShotMetricsOptions`，會打破 WP-61 的 `scripts/liftCohortAudit.ts`／
  `scripts/spiderWideRepositioningRunner.ts`）；`stallMinMs = 150`／`stallOmegaDegPerSec = 2`
  的真人校準值；`Suspicion` 命名語意與零 importer 邊界。
- **必須補的測試**：現行測試套（19 tests）在合成 cohort 上跑不到 ①。需新增
  「acquisition failure + 窗內長停滯 ⇒ `suspected: true`」與「缺 onset ⇒ 不出列」兩個負向案例，
  以及 ② 的「區段長度恰為 `ticks[last].t − ticks[first-1].t`」的逐位案例。

**選項 B —— 只修 ②，① 改為擴充輸出型別加第三態**（如 `verdict: 'suspected' | 'clean' | 'undeterminable'`）。
比 A 更明確,而且上游**已有現成的判別依據** ——
[`TrackingPresentationDerivation.acquisitionFailure`](../../src/metrics/trackingDerivation.ts#L69)
（doc comment 自述「acquisition failure, not missing data」）正是這個區別的既有正規來源,故第三態
不必自行判斷、不會新增第二定義（C-D4 安全）。代價是改動 GD-37 ② 凍結的輸出形狀 ⇒ 須另立 GD 並與
WP-61 對表。若 WP-61 T3 判 `promote`，這個選項會更貴。
注意 `deriveTrackingSamples()` 回的是 `TrackingPresentationSamples`（**不帶**該旗標），要取用得改走
`deriveTrackingMetrics()` 或自行以 `samples.find(onTarget) === undefined` 推導 —— 後者等於複製上游
判定，選 B 時應走前者。

**選項 C —— 不修，只在 doc comment 與 WP-57 DoD 註記限制。**
成本最低且不動已凍結語意。若 WP-61 T3 判 `not-reliably-separable` 或 `blocked-by-data` 而本旗標
不再有下游消費者，C 是合理終局。

## 5. 遺留 OQ

- ~~**OQ-KI33-1**（曾列為阻塞 ①）~~ ✅ **已結（2026-09-09，本 KI 撰寫時就地複驗）**：
  `TrackingPresentationSamples.windowEndMs` 存在於
  [`trackingDerivation.ts:112`](../../src/metrics/trackingDerivation.ts#L112)，由
  `const windowEnd = nextVisible?.t ?? Infinity`（`:163`）產生 ⇒ 最後一顆目標確為 `Infinity`，
  與 archive 版假設一致。① 無型別阻塞。
- **OQ-KI33-2**：② 的 ~5.2% 低估是否已影響 `e49cc54` 的真人校準值本身？`stallMinMs = 150` 是**用帶
  ② 的實作**量出來的 ⇒ 修好 ② 後同一批真人 run 的分離度可能落在不同門檻上。修 ② 時必須以同四份真人
  run 重跑敏感度表，不可沿用 `e49cc54` 的數字。
- **OQ-KI33-3**：本 KI 的兩項是否該等 OQ-57.5（門檻凍結）一併處置？兩者都要那四份真人 run，合併
  處理可省一次重跑；但會讓本 KI 的落地時程綁在 WP-61 的資料錄製上。
