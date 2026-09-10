# HANDOFF — 用真實資料產出 `spider-shot-v3` 教練報告

_建立於 2026-09-09。給接手的 AI agent。以下每一項「已驗證」的事實都是本檔作者實際讀取三份匯出後量到的,**不要重新猜,但歡迎覆驗**。_

> **怎麼用這份文件**：§0–§9 就是完整的 prompt。把整份貼給接手的 agent,或讓它讀這個路徑。

---

## 0. 你的任務

把 `spider-shot-v3` 的**三份真人匯出**變成一份帶真實數字的教練報告,設計規格已經凍結在:

- [`docs/algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-coach-metrics-and-charts-2026-09-09.html)
  —— **七張圖的視覺與判讀規格**(目前圖上的數字全是示例,你要換成真值)
- [`docs/algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-measurement-parameters-2026-09-09.html)
  —— **每個參數的精確運算定義**(權威;與程式碼不符時以程式碼為準)
- [`docs/algorithm/spider_shot/spider-shot-v3-performance-metrics-design-2026-09-09.html`](../../../algorithm/spider_shot/spider-shot-v3-performance-metrics-design-2026-09-09.html)
  —— 三層模型、機制指標裁決、風險 R1–R9

**你不是在重新設計指標。** 設計已定案;你的工作是計算、驗證、呈現,並在資料推翻設計假設時**明確說出來**。

---

## 1. 資料

三份 2026-09-09 的真人 run(同一位受試者、同一台機器、連續錄製):

| 檔案（`C:\Users\Hsin.YH.Yang\Downloads\`） | 錄製時刻 | ticks | visible | peripheral | fire |
|---|---|---:|---:|---:|---:|
| `spider-shot-v3-2026-09-09T14_42_09.086Z.json` | 14:42 | 8340 | 75 | 37 | 78 |
| `spider-shot-v3-2026-09-09T14_48_47.194Z.json` | 14:48 | 8277 | 79 | 39 | 90 |
| `spider-shot-v3-2026-09-09T14_49_57.739Z.json` | 14:49 | 8245 | 86 | 43 | 91 |

同一天同一台機器另有 5 份 `spider-shot-wide-v1` 匯出 —— **本次不要碰**,那是 WP-63 的範圍。

> ⚠️ **參與者匯出不進 repo。** 依 `.gitignore` 既有紀律(`.pilot-analysis/`、`.contact-analysis/`、
> `.spider-wide-analysis/`、`.lift-cohort-analysis/`)與 D-57.T5-8,原始 JSON 與由它推導出的產物
> **一律留在 gitignored 目錄**。只有程式碼、npm script 與 `.gitignore` 條目進版控。

### 已驗證的採集條件（三份一致）

| 欄位 | 值 | 對分析的意義 |
|---|---|---|
| `meta.drillId` | `spider-shot-v3` | exact-id 註冊,可進 registry |
| `meta.assessment.protocolVersion` | `spider-shot-v3@1.0.0` | 凍結協定 |
| `meta.simHz` / `meta.displayHz` | 128 / **240** | **KI-031 的懸崖在 240 Hz 上不該咬到**(見 G1) |
| `meta.frames.series` | ≈ 4.16 ms/frame | 與 240 Hz 相符,無掉幀跡象 |
| `meta.sensitivity` / `meta.fovDeg` | 1.4 / 75 | compatibility key 需要,兩者都在 |
| `meta.dpi` | **缺席** | ⇒ `cmPer360` 必為 `undefined`。`countsPer360` 仍可算 |
| `meta.crossOriginIsolated` | `true` | 計時精度前提成立(ADR-4) |
| `meta.suspect` | `false` | quality gate 可過 |
| `meta.validity` | `corridorExceeded/perfFloor/recorderOverflow/bufferOverflow` 全 `false` | 三份都是有效捕捉 |
| `meta.lateEventCount` | 2 | 極少,可忽略但要在品質欄位如實顯示 |
| `meta.protocolGuard.noMovement` | `true` | condition cell 建構的必要條件 |
| `meta.scene.eye` / `sceneId` | `(0, 1.6, 0)` / `spider-shot-room` | eye-frame 錨定正確 |
| `meta.targets.hitbox` | `0.27928103885148137` 三軸相等,`shape: 'sphere'` | 2.0° @ 8u,GD-7 單一來源 |
| `meta.spawn.spiderShot` | `center-peripheral-eye-stratified`,seed `260827`,`angularRadiusDegRange [10,25]`,`azimuthDegRange [0,360]`,`distanceURange [8,8]`,`grid 4×3`,`centerExemptFromTimeout true`,`targetAngularDiameterDeg 2` | **condition cell 需要的欄位全部齊備**,`buildSpiderShotV3ConditionCell()` 不會擲錯 |
| `mouseSamples` | **缺席** | 未用 `?rawMouse=1`。只有 128 Hz tick 級 `aim` + `dYaw`/`dPitch` |
| event types | 只有 `visible` / `fire` / `ads` | **沒有 `hit` 事件、`fire` 無 `shotSeq`** ⇒ hitscan 路徑,命中歸屬看 `fire.hit` + `fire.targetId` |

---

## 2. 五道必經閘（順序不可換）

### G1 — 先證明 `t_detect` 在這批資料上活著

[KI-031](../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)（🔴 未修）:
`firstSustainedDecrease()` 要求 4 個**連續**合格樣本,在 aim 更新率低於 sim 率時 100% 失效。
240 Hz 顯示**預期會過**,但已量到一件需要你解釋的事:

> 三份 run 的 `dYaw == 0 && dPitch == 0` 的 tick 佔比分別為 **38.6% / 34.6% / 35.0%**。

這些零多半是真的「手沒動」(進靶後停住、擊殺後停頓、開場 3 秒倒數 ≈ 4.6% 的 tick),
而不是 KI-031 的「沒有新資料」。**但沒有人證實過。**

**你必須做的**:對三份 run 跑 `deriveDetectionMetrics()`(canonical 預設參數),回報
`status === 'detected'` 的周邊呈現數 / 周邊呈現總數。

- 比例正常(粗略 ≥ 80%) → `switchReaction` 與 `movementTimeMs` 可用,照設計走。
- 比例是 0 或極低 → **停用**這兩類,改用 `phase-v1` 的 REC,並在報告最上方寫明原因。
  **絕對不可以默默輸出空的相位欄位** —— 那會讓報告看起來像「這位受試者沒有反應」。

順帶回報 `baselineInsufficient` 與 `anticipation` 的計數,以及 `thresholdDegPerSec` 的 p50。
[KI-034](../../../known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md) 是與 KI-031 獨立的失效模式:
500 ms baseline 窗會吃進上一次拉槍並把門檻抬高,且現有 `baselineInsufficient` 不會示警。

### G2 — `validDurationMs` 含倒數,hits/min 被系統性低估

已量到:

| | 值 |
|---|---|
| tick span(= `validDurationMs`) | 65.15 / 64.66 / 64.41 s |
| 第一個 `visible` | 一律在 `t0 + 3.00 s`（倒數 3 秒） |
| 最後一個 `visible` | `t0 + 62.71 / 62.80 / 62.36 s` |
| 協定的計分窗 | **60.0 s** |

`projectSpiderShotV2/V3` 的 `validDurationMs` 是「最後 tick − 第一 tick」,**包含 3 秒倒數與尾段 ticks**
⇒ hits/min 的分母約大 8–9% ⇒ **絕對值被低估約 8–9%**。

**你必須做的**:報告中同時給兩個值 —— registry 原值(可比、可進趨勢)與以 60.0 s 為分母的值
(教練語意正確)。並在方法欄註明差異來源。若你確認這是缺陷,依 [CLAUDE.md §3.9](../../../../CLAUDE.md)
開一份 `docs/known_issue/KI-NNN-*.md`,**不要**逕行修改 registry(那會動到凍結協定的可比性)。

### G3 — n-gate

單場每個 12 格 cell 的 n ≈ 3(37÷12)。**單場禁止**對 12 格上色或下結論。

三份 pooled 後:周邊共 **111** 次(37 × 3,見 G4)⇒ 12 格每格 ≈ 9,**達 n ≥ 8 門檻**。
但那 9 次是 **3 個不同 spawn 位置 × 3 次重複**,不是 9 個獨立條件 ⇒ 視為 clustered,不可當 i.i.d.。

單場一律只畫**兩條邊際軸**(方位 4 箱 ≈ 9/箱、幅度 3 tier ≈ 12/tier)。

### G4 — 三份 run 的刺激序列逐位相同

已實測:**三份的前 75 個呈現(zone + targetX/Y/Z 完全相同)**。run 1 的 75 個呈現就是它的全部;
run 2 / run 3 各多出 4 / 11 個(因為 60 秒內殺得更多)。

後果:

1. 三份**不是**同難度的獨立取樣,是**同一序列的三次重複**(WP-58 OQ-58.1 已入帳的契約事實)。
2. pooling 只能在**共同前綴(前 75 個呈現 / 37 個周邊)**內做;超出前綴的呈現在三份中出現次數不同,
   直接平均會讓後段條件被 run 3 主導。
3. 任何跨 run 的比較都必須把 **rep index** 當共變項(存在練習效應)。
4. 反過來說:這是一份**現成的學習曲線資料** —— 同一組刺激重複三次,適合看 rep 1→3 的變化。
   這比原設計的「本場 vs 基準」更適合這批資料,**建議把它變成報告的主軸之一**。

### G5 — 只有 3 場 ⇒ 沒有基準、沒有 MDC

教練報告設計裡的 C1(雜訊帶)與 C2(基準重心)都要求**至少 3 場相容 run 作為基準**,
而這裡總共只有 3 場 ⇒ 沒有「先前基準」可比。

**你必須做的**:C1 / C2 走**降級狀態**——

- C1:不畫雜訊帶。改顯示「建立基準中 3/3」與三場的實際值與全距,並明說**不宣告進步或退步**。
- C2:三個點都畫,不畫基準重心、不畫位移連線;等首發有效速度的等值線可以留(它是幾何,不是基準)。
- 任何地方都**不得**出現 `MDC` 這個詞 —— 真 MDC 需要多日重測。若你要畫離散帶,只能叫
  「三場全距」並標註它不是 MDC。

---

## 3. 要算什麼

### 3.1 沿用既有推導（不要重寫幾何 —— C-D4）

| 量 | 呼叫 | 陷阱 |
|---|---|---|
| 五個趨勢指標 | `DrillMetricRegistry.project(payload)` | 回傳 `status`;確認是 `'ready'` 而非 `'excluded-cohort'`／`'invalid-metric'` |
| 逐 transition 條件 | `deriveSpiderShotTransitions(payload)` | 提供 `D_deg`(`angularDistanceDeg`)、`W_deg`(`angularSizeDeg`)、`quadrant`、eye-frame `side` |
| 五類構念 | `deriveSpiderShotMetrics(payload)` | 見 3.3 的兩個陷阱 |
| 相位 REC/MR/V | `computePhaseMetrics(payload)` | `PhaseSample.side` **對 v3 無意義**(見 3.3) |
| 正規化曲線 | `computeCurveMetrics(payload)` | `curve-v1`,101 點 |
| `counts/360` | `deriveMouseThrow(payload)` | `meta.dpi` 缺席 ⇒ `cmPer360` 必為 `undefined`,如實顯示,不要填 0 |
| 追蹤樣本 / ε | `deriveTrackingSamples(payload)` | 已含 sphere 幾何(KI-021 於 2026-09-03 修復,這批資料在修後) |

`sync-v1`（`computeSyncMetrics`）**不要算** —— v3 是 `translation: 'locked'`、無 `counter` 事件,
`releaseToFireMs`／`counterHoldMs` 沒有可錨定的對象(設計文件 D4:結構性不適用)。

### 3.2 要新算的（M1–M3）

**M1 · 首發有效速度**
```
首發有效速度 = 60000 × 首發即命中的周邊呈現數 / 分母
```
分子與 `spider-v3.peripheral-first-shot-hit-rate` 的分子相同(`firstFire` 且該發 hit)。
依 G2 給兩個分母版本。這個量**不能被補槍灌水**,是報告的主結論。
同時報告「總命中速度 − 首發有效速度」的差 —— 那就是補槍依賴的大小。

**M2 · 三場全距**(不是 MDC,見 G5)。

**M3 · 邊際軸 + n-gate**(見 G3)。

### 3.3 兩個會讓數字錯掉的陷阱

1. **`deriveSpiderShotMetrics().firstShot.hit` 會高估首發命中率。**
   `buildPeekWindows()` 的 `outcome` 規則是「窗內**任一**發命中即 `'hit'`」
   ([peekWindows.ts:77](../../../../src/metrics/peekWindows.ts#L77)),而構念層直接取 `window.outcome === 'hit'`
   ([spiderShotMetrics.ts:91](../../../../src/metrics/spiderShotMetrics.ts#L91))。
   ⇒ 「首發 miss、補槍命中」會被記成首發命中。
   **歷史 projector 不受影響**(它直接驗 `firstFire`)。你自己算首發相關量時**一律用 `firstFire` + 該發的
   hit outcome**。本批資料無 `shotSeq`,所以 `fireHitOutcome()` 退化為 `fire.hit`,可直接用。

2. **`side` 有兩個不同的欄位,不要混用。**
   已實測:三份 run 的**全部 43 個周邊 `visible` 事件的 `side` 都是 `'R'`** —— 那是佔位值,不承載左右語意。
   要做左右／弱側分析,**必須**用 `deriveSpiderShotTransitions()` 的 eye-frame `side`(由抵達點相對 eye 的
   `x` 符號讀出)。並且先用 `quadrant` 篩掉 `vertical` 呈現 —— 近垂直落點的 `x` 符號可能只是浮點殘值。

---

## 4. 實作方式（照既有先例,不要自創）

**完全比照 `analyze:spider-wide` 的分工**（[scripts/analyze-spider-wide-repositioning.ts](../../../../scripts/analyze-spider-wide-repositioning.ts)
+ [scripts/spiderWideRepositioningRunner.ts](../../../../scripts/spiderWideRepositioningRunner.ts)）:

1. `scripts/spiderShotV3CoachRunner.ts` —— **純函式**:吃 `ExportPayload[]`,回傳報告資料結構。
   無檔案系統、無時鐘、無 `Math.random` ⇒ 可單元測試。
2. `scripts/analyze-spider-shot-v3.ts` —— **所有 I/O 都在這裡**:讀檔、寫報告。
3. `package.json` 加 `"analyze:spider-v3": "vite-node scripts/analyze-spider-shot-v3.ts --"`。
4. 輸出到 `.spider-v3-analysis/`(預設),並在 `.gitignore` 加一條,理由比照
   `.spider-wide-analysis/`(參與者匯出的衍生物不進版控)。
5. 為 runner 寫 `tests/regression/` 的測試,fixture 用**合成** payload(不是真人資料)。

用法:
```bash
npm run analyze:spider-v3 -- "C:/Users/Hsin.YH.Yang/Downloads/spider-shot-v3-2026-09-09T14_42_09.086Z.json" \
                             "C:/Users/Hsin.YH.Yang/Downloads/spider-shot-v3-2026-09-09T14_48_47.194Z.json" \
                             "C:/Users/Hsin.YH.Yang/Downloads/spider-shot-v3-2026-09-09T14_49_57.739Z.json"
```

---

## 5. 圖表規格

七張圖的**形式、讀法、何時不畫**已凍結在教練提案 HTML,照它做。以下是產出時必須守的技術規則。

### 已驗證的調色盤（不要自己挑色）

以本文件系列實際的 surface 驗過六項檢查,light／dark 在 all-pairs pairlist 下全數 PASS:

| 角色 | Light | Dark |
|---|---|---|
| series-1（主） | `#2a78d6` | `#3987e5` |
| series-2 | `#eb6834` | `#d95926` |
| series-3 | `#1baf7a` | `#199e70` |
| series-1 弱化（強調用） | `#86b6ef` | `#184f95` |
| ink / ink-2 / muted | `#0b0b0b` / `#52514e` / `#898781` | `#ffffff` / `#c3c2b7` / `#898781` |
| gridline / baseline / band | `#e1e0d9` / `#c3c2b7` / `#f0efec` | `#2c2c2a` / `#383835` / `#383835` |
| chart surface | `#ffffff` | `#171e2d` |

**系列上限 3**(all-pairs 下第 4 個 slot 會讓 yellow 與 orange 同時在場而不過門檻)。
淺色主題的 series-3 對白底只有 2.82:1 ⇒ **relief 規則生效:所有堆疊段一律直接標值**。

改任何一個 hex 都必須重跑驗證器:
```
node <dataviz-skill>/scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light --surface "#ffffff" --pairs all
node <dataviz-skill>/scripts/validate_palette.js "#3987e5,#d95926,#199e70" --mode dark  --surface "#171e2d" --pairs all
```

### 標記與版面規則

- 細標記、hairline 實線格線(**格線與座標軸不得用虛線**)、資料端 4px 圓角、基線端方角。
- 堆疊段與相鄰條之間留 **2px surface 間隙**;重疊標記加 2px surface 環。
- **絕不用雙軸**。單位不同的量(如命中時間 ms 與角誤差 deg)必須換成無單位比值,或分成兩張圖。
- 圖例:≥ 2 個系列一律有;選擇性直接標籤(端點、極值),**不要每個點都標數字**。
- 每張圖都要有**表格檢視**(顏色不可是唯一資訊通道)與 hover 提示(`<title>` 即可)。
- 容器高度必須含 x 軸標籤帶,否則會出現卡片內的小捲軸。
- 深色主題:tokens 同時定義在 `@media (prefers-color-scheme: dark)` 與 `[data-theme="dark"]` 兩個 scope。

### 產出後必須做的兩件事

1. **算,不要目測**:SVG 座標用程式產生。
2. **渲染出來看**:用 repo 既有的 Playwright,對 light／dark 兩種 `colorScheme` 截圖,並檢查
   (a) `svg.getBBox()` 是否超出 `viewBox`、(b) 圖卡是否出現水平捲軸、(c) 標籤是否碰撞、
   (d) **文字說明與視覺是否一致**（本檔作者在這一步抓到「說明寫淺色=最弱、實際是實色=最弱」的矛盾）。

---

## 6. 產出

| 產物 | 位置 | 進版控? |
|---|---|---|
| 教練報告（真實數字,light/dark,可列印） | `.spider-v3-analysis/coach-report-spider-shot-v3-<最後一場時戳>.html` | ❌ gitignored |
| 逐 run／逐條件 CSV | `.spider-v3-analysis/*.csv` | ❌ gitignored |
| runner + I/O script + 測試 | `scripts/` + `tests/regression/` | ✅ |
| npm script、`.gitignore` 條目 | `package.json`、`.gitignore` | ✅ |
| 發現的缺陷 | `docs/known_issue/KI-NNN-*.md` + `BUGFIX-DECISIONS.md` 索引 | ✅ |
| 資料推翻設計假設之處 | 更新三份 HTML 對應段落 + 記入 stage14 `progress.md` | ✅ |

---

## 7. 報告裡必須寫的話（誠實邊界）

依 **C-D3 / GD-20**:未通過構念驗證的指標不得進教練報告。這批資料是
**單一受試者、單一機台、同一序列重複三次、同一天連續錄製**。所以報告必須明寫:

1. **n = 1 位受試者、3 場** ⇒ 只能描述這三場,**不得**宣告能力、進步或退步。
2. **沒有絕對門檻**(2.0° 與 10–25° 未經真人校準)⇒ 不出現「及格／優秀」字樣。
3. **三場是同一刺激序列的重複**,存在練習效應與序列熟悉效應 ⇒ 跨場差異不可解讀為一般化能力變化。
4. **同一天連續錄製** ⇒ 無法分離暖身、疲勞與學習;跨日重測才能。
5. **`overshootDeg` 無方向** ⇒ 不說「衝過頭」或「沒到位」,只說「進靶後逸出幅度」。
6. **`tDetectMs` 是視覺—動作代理值**,不是神經反應時間。
7. **`meta.dpi` 缺席** ⇒ 不呈現 cm/360,不要用預設 DPI 猜。
8. 若 G2 確認 hits/min 分母含倒數 ⇒ 明寫絕對值低估約 8–9%。

寧可少一個指標,不能有一個會說錯話的指標。

---

## 8. 不可違反的紅線

- **禁 `Date.now()`** —— 一律 `performance.now()`(ADR-4)。分析腳本同樣適用。
- **C-D4:既有構念不得有第二定義** —— `ε(t)`、on-target、`t_detect`、`D_deg`、`W_deg` 一律呼叫
  既有 canonical derivation。**不要在報告腳本裡重算任何幾何。**
- **C-D5:雙實作對表** —— 若你動到 `seg-v2`／`phase-v1`／`curve-v1`／`sync-v1`／`sg-seg-v2` 任一端的
  語意或參數,必須兩端同步 + 重跑 golden 產生腳本 + `promoted-*.test.ts` 全綠 + 版本字串升號。
  **本任務不應該需要動它們** —— 如果你覺得需要,先停下來說明理由。
- **不要修改凍結協定** —— `spider_shot_v3.ts` 的任何常數、`DrillMetricRegistry` 的既有 descriptor 語意
  都不在本任務範圍。M1 是**新增** descriptor,不是改既有的。
- **參與者資料不進 repo**(§1)。
- **GD-6:場景幾何永不進 sim runtime** —— 不相關但別破壞;分析層只讀匯出。

---

## 9. 完成判準（DoD）

- [ ] G1–G5 五道閘各有一個明確的、有數字的結論寫在報告的方法欄
- [ ] `DrillMetricRegistry.project()` 對三份都回 `status: 'ready'`,五個指標值列出
- [ ] M1 首發有效速度算出,並與總命中速度並列(補槍依賴的大小)
- [ ] 七張圖全部以真值重繪;不適用的圖依「何時不畫」規則降級並說明原因
- [ ] 每張圖有表格檢視;調色盤驗證器兩模式 PASS
- [ ] Playwright light/dark 截圖檢查通過:無 bbox 溢出、無圖卡捲軸、無標籤碰撞、文字與視覺一致
- [ ] `npm run typecheck` 與 `npx vitest run` 全綠
- [ ] §7 的八條誠實邊界全部出現在報告中
- [ ] 原始 JSON 與衍生產物都在 gitignored 目錄;`git status` 沒有參與者資料
- [ ] stage14 `progress.md` 記下:實際數字、被資料推翻的設計假設、新開的 KI 編號

---

## 附錄 — 本檔作者已量到但未解釋的事

留給你,不要當成已知結論:

1. **零位移 tick 佔 35–39%**,即使在 240 Hz。多半是真的手沒動,但沒有證實。G1 會給答案。
2. **`fire` 數 (78/90/91) 大於 `visible` 數 (75/79/86)** ⇒ 存在補槍。首發命中率與總命中率的差
   就是這件事的大小,而 M1 正是為了量它而提的。
3. **run 3 的呈現數最多 (86)、run 1 最少 (75)** ⇒ 同一序列下殺得越快呈現越多。這使得
   「每場呈現速率」本身就是一個表現量(C2 的 x 軸),而不只是分母。
4. **`meta.replay` / `meta.weapon` / `meta.recoil` 相關欄位存在但本任務未檢視** —— 若報告要談彈道或
   後座力,先確認 v3 的 weapon config 實際是什麼,不要假設。
