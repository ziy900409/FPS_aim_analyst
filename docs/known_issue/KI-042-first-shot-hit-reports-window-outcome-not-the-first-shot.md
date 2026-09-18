# KI-042 — `deriveSpiderShotMetrics().firstShot.hit` 報的是整窗 eventual hit,不是首發命中

> 類型：**mislabelled API surface（landmine）**。值本身算得正確,錯的是<b>欄位名與它承載的構念不符</b>;
> 與 [KI-038](KI-038-spider-v3-peripheral-side-hardcoded-collapses-lr-aggregates.md) 的 silent-zero
> 不同 —— 這裡沒有任何一個現役輸出是錯的,因為**三個消費者各自繞開了它**,而欄位本身從未修正。
> 狀態：🔴 **診斷完成（2026-09-18），修法待拍板**。尚無 `BD-042`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/metrics/spiderShotMetrics.ts:92`](../../src/metrics/spiderShotMetrics.ts#L92)
> （`hit: window.outcome === 'hit'`,置於 `firstShot` 陣列中）。
> 根因來源：[`src/metrics/peekWindows.ts:77`](../../src/metrics/peekWindows.ts#L77)（`outcome` 的定義）。
> 相關：[CLAUDE.md §4 C-D4](../../CLAUDE.md)（既有構念不得有第二定義 —— 本案是**同一構念被實作三次**）。
> 發現脈絡：2026-09-18 規劃 mouse × grip 機制層橋接時，準備把 `firstShot` 整組接進 cohort 分析，
> 逐欄核對語意時發現。

## 1. 症狀

`SpiderShotMetrics.firstShot` 的形狀是「首發」語意的（[`spiderShotMetrics.ts:23`](../../src/metrics/spiderShotMetrics.ts#L23)）：

```ts
readonly firstShot: readonly { targetId: string; hit?: boolean; fireAngleErrorDeg?: number }[];
```

但 `hit` 的實際來源是整個 peek window 的 outcome：

```ts
// spiderShotMetrics.ts:92
hit: window.outcome === 'hit',
```

而 `outcome` 在 [`peekWindows.ts:77`](../../src/metrics/peekWindows.ts#L77) 的規則是**窗內任一發命中即 `'hit'`**：

```ts
const outcome = fireTimes.length === 0 ? 'no_shot' : hitTimes.length > 0 ? 'hit' : 'timeout';
```

`hitTimes` 由 `windowHitTimes()` 收集窗內**所有** fire 的命中（含首發 miss 後的補槍）。

⇒ 「第一發打歪、第二發補中」的 trial，`firstShot.hit` 會回 `true`。

## 2. 實測分歧幅度

`data/BQC-test/DKMouse/` 的 S01–S06 cohort（`spider-shot-wide-v1`，50 個通過硬閘的 run）：

| 量 | 值 | 佔比 |
|---|---:|---:|
| 周邊呈現 | 2442 | — |
| 首發命中（讀 fire event 自身的 `hit`） | 2105 | **86.2%** |
| eventual 命中（窗內任一發） | 2418 | **99.0%** |
| **首發 miss → 後續補中** | **313** | **12.8%** |

那 313 筆就是兩個定義分歧的地方。誤差方向**恆為樂觀**：任何誤用 `firstShot.hit` 的報告，首發命中率會從 86.2% 被抬到 99.0%。

## 3. 為什麼今天沒有輸出是錯的

三個消費者**各自獨立**發現並繞開了它：

| 消費者 | 繞法 | 出處 |
|---|---|---|
| 歷史指標投影 | `w.firstFire` + `fireHitOutcome()`,註解明寫「never `PeekWindowTs.outcome`」 | [`DrillMetricRegistry.ts:171`](../../src/history/DrillMetricRegistry.ts#L171)、[`:446`](../../src/history/DrillMetricRegistry.ts#L446) |
| v3 教練報告 | 模組頂註「**首發一律走 `firstFire`**（HANDOFF §3.3 ①）」,並點名 `peekWindows.ts:77` | [`spiderShotV3CoachRunner.ts:15`](../../scripts/spiderShotV3CoachRunner.ts#L15) |
| mouse × grip 研究管線 | Python 端直接讀 fire event 的 `hit`,不經 TS | `research/src/mousegrip/algorithms/pilot.py` |

`DrillMetricRegistry.ts:190` 仍從 `spiderMetrics.firstShot` 取值,但**只取 `fireAngleErrorDeg`**,沒有碰 `hit`。

**所以這不是一個正在說錯話的指標,而是一個等著被誤用的欄位。** 它已經被踩到三次,每次都由讀原始碼的人在最後一刻攔下。第四次不一定有人攔。

## 4. 它同時是一個 C-D4 問題

繞開的代價是：**「首發命中」這個構念現在有三份實作**，且彼此不完全等價。

```
DrillMetricRegistry   fire.hit || hitShotSeqs.has(fire.shotSeq)     ← 併看 hit event
spiderShotV3CoachRunner  window.firstFire 自己的命中結果
research (Python)     fire.hit                                      ← 只讀 fire event
```

`spider-shot-wide-v1` 的匯出**不產生 `hit` 事件**（事件型別只有 `visible` / `fire` / `ads`），所以
`hitShotSeqs` 為空，三者在本 cohort 逐位相同。但這是**巧合**，不是契約：任何會發 `hit` 事件的 drill
上，第一份與第三份就會分歧。C-D4 要求既有構念只有一個定義，目前的狀態正好違反它。

`firstCompatibleFire()`（[`peekWindows.ts:168`](../../src/metrics/peekWindows.ts#L168)）另外要求
`event.firstShot === true`，Python 端只比對 `targetId` —— 這是第二個尚未對帳的差異點。

## 5. 修法選項

| | 做法 | 優點 | 代價 |
|---|---|---|---|
| **A**（建議） | `firstShot` 新增**正確**的首發命中欄位（由 `window.firstFire` 自身結果導出），既有 `hit` 改名為 `windowOutcomeHit` 或移出 `firstShot` | 名稱不再說謊；三份繞法可收斂回單一來源，解掉 §4 的 C-D4 問題 | 觸及 `SpiderShotMetrics` 介面；需同步 `spiderShotMetrics.test.ts` 與兩個消費者 |
| B | 原地把 `hit` 改成讀 `window.firstFire` | 改動最小，今天沒有消費者會壞 | **原地改語意**；同名欄位在不同 commit 代表不同東西，正是本 repo 版本字串紀律要避免的 |
| C | 直接刪除 `firstShot.hit` | 立刻消滅地雷 | 把責任推回每個消費者，§4 的三份實作會變成永久狀態 |
| D | 只在文件註明，不動程式 | 零風險 | 地雷留著；已經有三次踩到紀錄 |

**建議 A**：它是唯一同時解掉「名稱說謊」與「同一構念三份實作」的選項。落地時應讓
`DrillMetricRegistry` 與 `spiderShotV3CoachRunner` 都改讀新欄位，並刪掉各自的區域繞法，
使繞法的數量從 3 降到 0。

⚠️ 若採 A，`fireHitOutcome()` 的 `hit` 事件合併邏輯必須成為**新欄位的權威實作**（它是三者中最完整的），
Python 端隨之改讀 CSV，不再自行判定。

## 6. Definition of Done

1. 一個「首發 miss → 補槍命中」的 fixture，斷言首發命中欄位為 `false` 而 window outcome 欄位為 `true`
   ——**兩者不可相同**（最終 workflow 驗收清單第 1 條）。
2. `DrillMetricRegistry` 與 `spiderShotV3CoachRunner` 的區域繞法刪除，改讀單一來源；既有歷史指標值
   逐位不變（本 cohort 無 `hit` 事件，應為 no-op，須以測試證明而非假設）。
3. `spiderShotMetrics.test.ts` 覆蓋新舊兩個欄位的語意。
4. 本 KI 狀態翻為已落地，`BD-042` 進 [BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md)。

## 7. 對現行工作的影響

`mouse × grip` 機制層橋接（進行中）**不得**取用 `firstShot.hit`，只取 `fireAngleErrorDeg`；首發命中
維持由 Python 端讀 fire event。此約束在該切片的抽取層以測試固定，待 KI-042 落地後再收斂。
