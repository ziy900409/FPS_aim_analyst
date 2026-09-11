# KI-037 — `validDurationMs` 含開場倒數與尾段 tick,主指標 hits/min 系統性低估 7–9%

> 類型：**latent measurement defect**（**恆向低估**;不影響同 cohort 內的可比性,但絕對值錯,
> 且低估幅度逐場不同 ⇒ 也是一個雜訊源）。
> 狀態：🔴 **診斷完成（2026-09-09），修法待落地**。尚無 `BD-035`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/history/DrillMetricRegistry.ts`](../../src/history/DrillMetricRegistry.ts) 的
> `validDurationMs()`（`:427-432`），經 `projectSpiderShotV2()`（`:159-167`）供 `spider-shot-v2`
> 與 `spider-shot-v3` **兩支的主指標**使用。
> 相關：[KI-036](KI-036-registry-projection-failed-hides-which-precondition-broke.md)（同一批真人 run
> 發現）· [CLAUDE.md §4 C-D3](../../CLAUDE.md)。
> 發現脈絡：2026-09-09 依
> [`HANDOFF-v3-real-data.md`](../exec-plan/active/stage14/HANDOFF-v3-real-data.md) §2 G2 對三份真人
> `spider-shot-v3` 匯出實測確認。HANDOFF 預估「約 8–9%」,實測 **7.3–8.6%**。

## 1. 症狀

```ts
// DrillMetricRegistry.ts:427-432
function validDurationMs(payload: ExportPayload): number | undefined {
  if (payload.ticks.length < 2) return undefined;
  const sorted = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const duration = sorted[sorted.length - 1].t - sorted[0].t;   // ← 最後 tick − 第一 tick
  return duration > 0 ? duration : undefined;
}
```

它是**整段錄製的 tick 跨度**，而不是協定的計分窗。`spider-shot-v3` 的
[凍結 config](../../src/drill/spider_shot_v3.ts) 是 `timing.countdownMs = 3000` +
`endCondition = { type: 'timeLimit', value: 60000 }` ⇒ tick 從倒數開始就在跑，但**倒數期間一個目標
都沒有**。

三份 2026-09-09 真人匯出實測：

| | rep 1 | rep 2 | rep 3 |
|---|---:|---:|---:|
| tick span（= `validDurationMs`） | 65.148 s | 64.656 s | 64.406 s |
| 第一個 `visible`（自 t0） | +3.000 s | +3.000 s | +3.000 s |
| 最後一個 `visible`（自 t0） | +62.711 s | +62.805 s | +62.359 s |
| 協定計分窗 | 60.0 s | 60.0 s | 60.0 s |
| **分母膨脹** | **+8.6%** | **+7.8%** | **+7.3%** |

分子（周邊命中窗數）完全落在計分窗內，分母卻多了 3 秒倒數與約 1.4–2.1 秒的尾段 tick
⇒ `spider-v3.peripheral-hits-per-minute` **恆向低估**同樣的幅度：

| | rep 1 | rep 2 | rep 3 |
|---|---:|---:|---:|
| registry 分母下 | 33.2 | 36.2 | 40.1 hits/min |
| 60.0 s 分母下 | 36.0 | 39.0 | 43.0 hits/min |

## 2. 根因

`validDurationMs` 的名字說的是「有效時長」，實作給的是「錄製時長」。這兩者在**沒有倒數的 drill 上**
恰好相等，所以它在 `spider-shot-v2` 上線時是對的 —— v2 的 `timing.countdownMs` 同樣是 3000，
**它從來就沒有對過**，只是沒人拿絕對值去對照協定值。

[量測參數文件](../algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html) §5 已經
寫了「`validDurationMs` = 最後 tick − 第一 tick（**實測時長，不是名目 60 s**）」，所以這不是文件與
實作不符，而是**這個定義本身讓主指標的絕對值沒有教練語意**。

## 3. 影響面

1. **同 cohort 內的排序不受影響**：所有 run 都帶同一個偏差方向，趨勢線的**形狀**是對的。
2. **絕對值不可對外報數**。「你一分鐘打中 33 顆」是錯的，實際是 36 顆。
3. **它同時是一個雜訊源**：低估幅度逐場 7.3–8.6%（跨度 1.3 個百分點），因為尾段 tick 的長度取決於
   最後一次呈現何時結束。⇒ 趨勢線上有一個與表現無關的 ±0.65% 抖動。這個量級遠小於本批的場間變異，
   但它會**永遠存在**，而未來的 MDC（真 test–retest）會把它算進雜訊帶。
4. **`spider-shot-v2` 同受影響** —— `projectSpiderShotV3()` 是 `projectSpiderShotV2()` 的機械 rename。
5. **不影響其他四個指標**：首發命中率、命中時間中位數、角誤差中位數、逸出中位數都沒有時間分母。

## 4. 修改計畫（未落地）

⚠️ **不得直接改 `validDurationMs()` 的語意。** `spider-shot-v2@*` 與 `spider-shot-v3@1.0.0` 都是**已
凍結協定**，既有趨勢點是用現行分母算出來的;就地改語意會讓新舊點不可比，而 `CompatibilityKey` 的十個
欄位裡**沒有一個會因此改變** ⇒ 不可比的兩組數字會被當成同一條趨勢線靜默合併。這正是本 KI 最該避免的
後果。

**選項 A（建議）—— 新增一個 descriptor，不動舊的。**

- 加 `spider-v3.peripheral-hits-per-minute-scored`（分母 = `endCondition.value`，自凍結 config 讀），
  與現行 `peripheral-hits-per-minute` **並存**。
- registry version 由 `1.0.0` 升 `1.1.0`（新增 descriptor 是相容變更，既有點不需重算）。
- 教練面顯示新的、趨勢面兩個都留，並在 descriptor 的 `label` 上把差異寫死。
- 成本低、無回溯風險、可比性完好。**代價是指標數從 5 變 6**，需先答 OQ-66.2（v3 的 descriptor 集合
  是否重選）。

**選項 B —— 把分母改成「第一個 `visible` 到最後一個 `visible` + 該窗上界」的實測計分窗。**
比 A 更貼近「實際打了多久」，而且對倒數長度不同的 drill 也成立。但它仍不等於協定的 60.0 s（尾段那次
呈現可能被時限截斷），而且它**改變既有語意** ⇒ 一樣要新 descriptor 或版本隔離，沒有比 A 省。

**選項 C —— 不修，只在文件與教練面標註低估幅度。**
即本次落地的做法:報告對每一個速率量**同時給兩個分母**並在方法欄寫明差異來源
（[`spiderShotV3CoachRunner.ts`](../../scripts/spiderShotV3CoachRunner.ts) 的 `EffectiveSpeed`）。
成本 0、不動凍結協定。若 v3 的 descriptor 集合本來就要在 WP-66 重選，C 是合理的過渡終局。

**排序建議**：本 KI 的修法應**併入 OQ-66.2 的 descriptor 重選**一起做，不單獨開 PR ——
單獨加一個 descriptor 會讓「五個指標」這個已寫進三份設計文件的說法立刻過期。

## 5. 遺留 OQ

- **OQ-KI35-1**：既有已存檔的 `spider-shot-v2` 趨勢點要不要回算？**傾向不要** —— 回算等於把歷史點的
  定義換掉，而 A 的做法是讓新舊並存、由讀者選。需研究設計 owner 拍板。
- **OQ-KI35-2**：尾段 tick 為何多出 1.4–2.1 秒且逐場不同？推測是最後一次呈現的窗在時限到達後仍走完
  ——若如此，「分母」與「最後一次呈現是否被截斷」耦合，B 選項的實測計分窗也會帶同一個抖動。
  需要看 `DrillRunner` 的收尾路徑才能確認，本次未查。
- **OQ-KI35-3**：`peekTimeoutMs = 1750` 的周邊逾時會截斷命中時間分布的右端（量測參數文件 §8 已記）。
  逾時率與本 KI 的分母問題會**同向**影響 hits/min，判讀時兩者須併看;是否要把逾時率也升成 descriptor
  一併列入 OQ-66.2。
