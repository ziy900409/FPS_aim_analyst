# KI-038 — `spider-shot-v3` 的周邊 `side` 寫死 `'R'`,所有左右分群聚合靜默塌成單邊

> 類型：**silent-zero defect**（合法值掩蓋整組缺席;與 [KI-031](KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 同型）。
> 狀態：🔴 **診斷完成（2026-09-09），修法待落地**。尚無 `BD-036`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/sim/TargetManager.ts:486`](../../src/sim/TargetManager.ts#L486)（`center-peripheral-eye-stratified`
> 的周邊分支）。下游：[`src/metrics/peekWindows.ts`](../../src/metrics/peekWindows.ts)（`side: visible.side`）
> → [`src/metrics/researchMetrics.ts`](../../src/metrics/researchMetrics.ts) 的 `curve-v1` 左右分群與
> `sync-v1` 的 `SyncRow.side`。
> 相關：[KI-031](KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)（同型的靜默
> 歸零）· [CLAUDE.md §4 C-D4／C-D5](../../CLAUDE.md)（`curve-v1` 是 C-D5 雙實作指標）。
> 發現脈絡：2026-09-09 產生 `spider-shot-v3` 教練報告時，實測 `computeCurveMetrics()` 的
> `aggregate.omega.left.n === 0`。

## 1. 症狀

三份 2026-09-09 真人 `spider-shot-v3` 匯出，**全部 119 個周邊 `visible` 事件的 `side` 都是 `'R'`**
（相異取值數 = 1）。後果：

| 量 | rep 1 | rep 2 | rep 3 |
|---|---:|---:|---:|
| `computeCurveMetrics().aggregate.omega.left.n` | **0** | **0** | **0** |
| `computeCurveMetrics().aggregate.omega.right.n` | 74 | 78 | 86 |

`NormalizedCurve` 的 `n: 0` 是**合法值**（語意為「這一側沒有可用樣本」），而且 `flagCounts` 只記
`no_first_shot` 這類逐窗旗標 —— **沒有任何欄位說「左側整組不存在」**。⇒ 一份「左側曲線是空的」的
輸出與一份「這位受試者從不往左打」的輸出在資料上不可分。

`sync-v1` 的 `SyncRow.side` 走同一條路（`peek.side`），只是 v3 的 `sync-v1` 本來就結構性不適用
（無 `counter` 事件），所以那一側今天沒有消費者。

## 2. 根因

`side` 由 `TargetManager` 在 spawn 時決定。**同一個函式裡的兩個分支處置不同**：

```ts
// TargetManager.ts:470-487
if (spiderShot.kind === 'center-peripheral-yawpitch') {          // spider-shot-wide-v1
  if (nextSpiderZone === 'center') {
    // `side` 在中心 zone 無意義…沿用 v1/v2 的 'R' 佔位；真實左右只由周邊 spawn 承載（FR-57.7）。
    return { side: 'R', zone: 'center', pos: … };
  }
  return sampleSpiderWidePeripheralPose(spiderShot);             // ← side: cell.side（真的 L/R）
}
if (spiderShot.kind === 'center-peripheral-eye-stratified') {    // spider-shot-v3
  if (nextSpiderZone === 'center') {
    return { side: 'R', zone: 'center', pos: … };
  }
  return { side: 'R', zone: 'peripheral', pos: sampleStratifiedPeripheralPos(spiderShot) };
  //       ^^^^^^^^^^ 周邊也寫死 'R'
}
```

`sampleSpiderWidePeripheralPose()` 的 cell 帶 `side`，所以 wide-v1 的周邊 `side` 是真的
（[`TargetManager.ts:551`](../../src/sim/TargetManager.ts#L551)）。
`sampleStratifiedPeripheralPos()` 只回 `Vec3` —— 它的 cell 是 `azimuth × cosRadius`，**沒有 side 這個
維度**，因為 v3 的方位是 `[0, 360)` 連續取樣，L/R 不是它的分層軸。呼叫端於是填了佔位值。

**這一行本身是合理的**（v3 的 spawn 確實沒有 side 分層）。缺陷在於：`side` 這個欄位的**契約**是
「這次呈現在左還是右」，而 v3 填的是佔位值，卻沒有任何機制讓下游知道它是佔位值 ——
`:472` 的註解明說「真實左右只由周邊 spawn 承載」，而 v3 的周邊 spawn 沒有承載它。

**正確的 v3 左右來源已經存在**：`deriveSpiderShotTransitions()` 的 eye-frame `side`
（[`spiderShotConditions.ts:190`](../../src/metrics/spiderShotConditions.ts#L190)，由抵達點相對 eye 的
`x` 符號讀出）。三份真人 run 用它分箱得到 L/R ≈ 18/19、19/20、21/22 —— **均衡**，與寫死的 119 個
`'R'` 形成對照。

## 3. 影響面

1. **今日無錯資料流出**：`curve-v1` 的左右曲線目前沒有進任何教練報告或研究宣稱;本次的 v3 報告已
   明文不使用它（方法欄「刻意沒算的東西」）。
2. **陷阱在於它看起來能用**。`computeCurveMetrics()` 不擲錯、不設旗標，回傳一個結構完整的
   `CurveAggregate`。任何人只要對 v3 payload 呼叫它並讀 `omega.left`，就會得到一條 n=0 的曲線 ——
   而 `normalize101` 的下游若對空曲線做平均會得到 `NaN`，若做 `n` 加權則靜默貢獻 0。
3. **`curve-v1` 是 C-D5 雙實作指標** ⇒ 任何修法若動到 `CurveRow.side` 的語意，TS 與 Python 兩端必須
   同步 + 重跑 `research/fixtures/golden/` + `promoted-*.test.ts` 全綠 + 版本字串升號。
   **但本 KI 的建議修法不碰它**（見 §4 選項 A）。
4. **`spider-shot-v1/v2` 也是佔位值**：`:490` 的第三分支同樣寫死 `'R'`。只有 `wide-v1` 是真的。
   ⇒ 這是**整個 spider 家族**的問題，不只 v3。
5. **與 [KI-033](KI-033-repositioning-flag-omits-acquisition-failures-and-undercounts-stall-start.md)
   ①、KI-031 同一族**：合法值掩蓋整組缺席、CI 全綠、只有拿真人資料去看才會現形。

## 4. 修改計畫（未落地）

**選項 A（建議）—— 讓「沒有 side 語意」在資料上看得見,不動 `curve-v1`。**

- `DrillEvent` 的 `visible.side` 改為 **optional**，`center-peripheral-eye-stratified`（與 v1/v2 的
  origin-frame 分支）的周邊與中心一律**省略**而非填 `'R'`。省略即「這支 drill 不承載左右」，與
  `spiderShotConditions.ts` 對 `x === 0` 的處置（省略而非猜測）同一慣例。
- `buildPeekWindows()` 的 `PeekWindowTs.side` 隨之 optional;`curveRows()`／`syncRow()` 在 `side`
  缺席時**不出列**（缺列 ≠ 左側為零），並在 `flagCounts` 記一筆 `no_side_channel`。
- ⚠️ **這會動到 schema 與 `curve-v1` 的輸出形狀** ⇒ C-D5 兩端同步 + golden 重跑 + 版本升號。
  成本是本 KI 三個選項裡最高的，但它是唯一讓失效**不可能再靜默**的做法。

**選項 B —— 讓 v3 的周邊 `side` 帶上 eye-frame 的真值。**
在 `sampleStratifiedPeripheralPos()` 回傳位置後由 `pos.x` 的符號填 `side`。
❌ **不建議**：那會在 sim 側建立第二套「左右」定義，而權威已經在
`deriveSpiderShotTransitions()`（C-D4 直接違反）。而且近垂直落點（實測最小 `|Δx|` = 1.06e-2 u ≈
0.076°）的符號雖非浮點殘值，卻也沒有左右負荷語意 —— 讓 sim 產生它等於把一個判讀陷阱寫進資料。

**選項 C —— 不修，只在文件與分析端標註。**
即本次落地的做法：教練報告的方位分箱一律走 `deriveSpiderShotTransitions()` 的 eye-frame `side`，
並在方法欄寫明 `curve-v1` 的左右分群對 v3 不適用;報告的 runner 另外回報
`rawSideDistinctValues`（周邊 `visible.side` 的相異取值數）讓佔位值在輸出上看得見。
成本 0、不動 C-D5。若 v3/v1/v2 從來就不需要 side-split 曲線，C 是合理終局 —— **但它不保護下一個人**。

**排序建議**：A 的成本主要在 C-D5 同步，而 [KI-032](KI-032-promoted-golden-parity-asserts-bit-equality-on-floats.md)
（golden 逐位比對在別台機器必紅）**未修之前，任何需要重跑 golden 的修法都無法在本機驗證**。
⇒ **KI-032 → 本 KI 選項 A** 是硬相依。

## 5. 遺留 OQ

- **OQ-KI36-1**：`visible.side` 對 `counterstrafe`／`peek` 家族是**真的**（那些 drill 的左右是協定
  變因）。改 optional 會讓那些路徑的型別多一層 narrowing —— 影響面需先掃過所有 `\.side` 讀取點。
- **OQ-KI36-2**：v3 的教練報告是否需要左右曲線？若答案是「不需要」，A 的價值只剩「保護下一個人」，
  應與 WP-66 的 descriptor 重選（OQ-66.2）一併評估優先序。
- **OQ-KI36-3**：`spider-shot-v1/v2` 的既有匯出全部帶 `side: 'R'`。若 A 落地，舊 payload 的
  `side` 仍在 ⇒ 需決定是「讀到就當佔位值忽略」還是「以 `schemaVersion` 分界」。
