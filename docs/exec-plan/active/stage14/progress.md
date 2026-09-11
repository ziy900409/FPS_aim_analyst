# stage14 — progress

> 上層索引：[stage14 README](README.md) · 大框架權威：[`docs/exec-plan/README.md`](../../README.md)
> 本檔是 stage14 的 **episodic memory**：做過什麼、量到什麼、被資料推翻了什麼、留下哪些帳。
> 最新在上。

---

## 2026-09-09 · 用三份真人 `spider-shot-v3` 匯出產出教練報告

執行 [`HANDOFF-v3-real-data.md`](HANDOFF-v3-real-data.md)。三份匯出（14:42 / 14:48 / 14:49，同一位
受試者、同一台機器、連續錄製）依 D-57.T5-8 **不進 repo**；本次在另一台機器上跑，來源路徑為
`C:\Users\User\Downloads\`（HANDOFF §1 記的是原機器的 `C:\Users\Hsin.YH.Yang\Downloads\`）。

### 交付

| 產物 | 位置 | 版控 |
|---|---|---|
| 資料層（純函式） | [`scripts/spiderShotV3CoachRunner.ts`](../../../../scripts/spiderShotV3CoachRunner.ts) | ✅ |
| 渲染層（純函式，HTML + SVG + CSV） | [`scripts/spiderShotV3CoachReport.ts`](../../../../scripts/spiderShotV3CoachReport.ts) | ✅ |
| 操作者入口（全部 I/O） | [`scripts/analyze-spider-shot-v3.ts`](../../../../scripts/analyze-spider-shot-v3.ts) | ✅ |
| 渲染檢查（light/dark、bbox、捲軸、文字碰撞） | [`scripts/check-coach-report-render.mjs`](../../../../scripts/check-coach-report-render.mjs) | ✅ |
| 回歸測試（27 個，fixture 全合成） | [`tests/regression/spider-shot-v3-coach-runner.test.ts`](../../../../tests/regression/spider-shot-v3-coach-runner.test.ts) | ✅ |
| `npm run analyze:spider-v3`、`.gitignore` 條目 | `package.json`、`.gitignore` | ✅ |
| 教練報告 HTML + 4 份 CSV/JSON | `.spider-v3-analysis/` | ❌ gitignored |

用法：

```bash
npm run analyze:spider-v3 -- <export.json | export-dir> [more...] [--out <dir>]
node scripts/check-coach-report-render.mjs <report.html> [screenshot-dir]
```

### 五道閘的實測結論

| 閘 | 結論 | 造成的降級 |
|---|---|---|
| **G1** `t_detect` 活著嗎 | 🟡 **活著但比例偏低**：canonical 預設參數下 **85/119 = 71.4%** `detected`（逐份 27/37、29/39、29/43）。KI-031 的懸崖在 240 Hz 上**沒有咬到**（60 Hz 那批是 0/113）。零位移 tick 佔 38.6%／34.6%／35.0% ——**不是**「沒有新資料」，否則 detected 會歸零。`baselineInsufficient` 0、`anticipation` 0；`thresholdDegPerSec` p50 = 64.4／83.5／97.6 deg/s ⇒ **KI-031 §2 的次要觀察成立**，500 ms baseline 窗確實吃進上一次拉槍、門檻被抬到數十 deg/s | `reactionMs`／`movementTimeMs` 只作描述、不作處方，且必須與 timeout 數並列 |
| **G2** 分母含倒數 | 🔴 **確認**：tick span 65.148／64.656／64.406 s vs 協定 60.0 s ⇒ **+8.6%／+7.8%／+7.3%**（HANDOFF 預估 8–9%，實測略低）。第一個 `visible` 一律在 t0+3.000 s | 每個速率量**同時給兩個分母**；registry 絕對值不得直接對外報數。→ **KI-037** |
| **G3** n-gate | 🟡 **邊際軸過關、12 格不過**：單場周邊 37／39／43 ⇒ 12 格每格 ≈ 3.1／3.3／3.6。方位軸每箱 8–13、幅度軸 8–18，全部 ≥ 8 | 12 格不繪製、不入結論；方位軸改用 `quadrant × side`（見「偏離協議」①） |
| **G4** 序列逐位相同 | 🔴 **確認**：共同前綴 **75 個呈現（37 個周邊）** 的 zone 與 `targetX/Y/Z` 完全相同 | pooled 一律限制在共同前綴內並標為 clustered；跨 run 差異不可解讀為一般化能力變化 |
| **G5** 沒有基準 | 🔴 **確認**：相容 run 總數 3，這 3 場**就是**建立基準的過程 | C1 不畫雜訊帶（改「建立基準中 3/3」）、C2 不畫基準重心與位移連線、**全報告禁用「MDC」作為宣稱** |

### 主要數字

| 量 | rep 1 | rep 2 | rep 3 |
|---|---:|---:|---:|
| 周邊呈現 / 首發即命中 / 周邊命中 | 37 / 35 / 36 | 39 / 33 / 39 | 43 / 42 / 43 |
| 首發命中率 | 94.6% | 84.6% | 97.7% |
| **M1 首發有效速度**（60.0 s 分母） | **35.0** | **33.0** | **42.0** |
| M1（registry 分母） | 32.2 | 30.6 | 39.1 |
| 總命中速度（60.0 s / registry） | 36.0 / 33.2 | 39.0 / 36.2 | 43.0 / 40.1 |
| **補槍依賴**（總 − M1，同分母） | 1.0 | 6.0 | 1.0 |
| 命中時間 p50 / p95 | 810 / 1021 ms | 789 / 1196 ms | 771 / 906 ms |
| 首發角誤差 p50 / p95 | 0.473 / 0.959° | 0.517 / 1.463° | 0.479 / 0.939° |
| 進靶後逸出 p50（**n**） | 2.877°（**4**） | 1.643°（**5**） | 1.832°（**4**） |
| REC / MR / V | 203 / 211 / **378** ms | 180 / 211 / **373** ms | 195 / 234 / **333** ms |
| Fitts 截距 / 斜率 / r² | 686 / 37 / 0.963 | 287 / 154 / 0.980 | 586 / 57 / 0.975 |

共同前綴（37 個周邊呈現）內的逐 rep：首發命中率 94.6% → 86.5% → 97.3%、命中時間 p50 810 → 789 → 777 ms。

### 被資料推翻的設計假設（6 項）

1. **C4 的首發命中率撞天花板。** 21 個達 n≥8 的分箱中 13 個 ≥ 90%，整體 94.6%／84.6%／97.7%。
   教練提案的 C4 示例是 50–78%，在那個區間裡「最弱的一箱」有意義；在 85–98% 裡它只是取樣雜訊。
   ⇒ C4 改以**命中時間**編碼條長、首發命中率退為直接標籤，且不上色、不下「哪裡弱」的結論。
   這正是 [README §6 第 5 項](README.md)「地板／天花板效應非真人不可」所預告的情形。
2. **C5 的「進靶後逸出」樣本不足。** 有效樣本 4／5／4（< 10）⇒ 不畫 p95。根因是**行為不是缺陷**：
   受試者多半一進靶就開槍結束該次呈現，`postAcquireOvershoot()` 因此沒有「首次進靶之後」的離靶樣本。
   ⇒ registry 的 `spider-v3.median-overshoot-deg` 在這種打法下是**由 4–5 個樣本決定的整場指標**，
   穩定性遠低於同列的其他四個。→ 入 OQ-66.2。
3. **時間預算的形狀與示例相反。** 示例 REC 168 / MR 214 / V 96（V 最短）；實測 **V 最長且長過 MR**。
   這位受試者用長確認期換高首發命中。⇒ C3 的判讀語句不能沿用「V 長 = 不敢開槍」。
4. **Fitts 斜率在三次重複之間不穩定。** 37／154／57 ms/bit，全距是平均的 **139%**，而三場的刺激
   **逐位相同** ⇒ 這個離散全是估計誤差。逐份 r² 0.963／0.980／0.975 —— **r² 高不代表斜率可信**
   （3 個 tier 中位數擬合一條線，兩個自由度）。⇒ 畫線但**不報 throughput、不比較截距與斜率**。
5. **`visible.side` 對 v3 是佔位值。** → **KI-038**。
6. **`DrillMetricRegistry.project()` 對三份都不是 `'ready'`。** → **KI-036**。
   HANDOFF §9 的 DoD 那一條是**未實跑 registry** 寫下的預期。

### 新開的帳

| # | 一句話 | 狀態 |
|---|---|---|
| [KI-036](../../../known_issue/KI-036-registry-projection-failed-hides-which-precondition-broke.md) | `projection-failed` 是單一 catch-all，遮蔽「缺 `meta.session.participantId`」這個真因；至少七類前提失敗共用一個編碼 | 🔴 待落地 |
| [KI-037](../../../known_issue/KI-037-valid-duration-includes-countdown.md) | `validDurationMs` 含倒數與尾段 tick ⇒ 主指標 hits/min 恆向低估 7.3–8.6% | 🔴 待落地，建議併入 OQ-66.2 |
| [KI-038](../../../known_issue/KI-038-spider-v3-peripheral-side-hardcoded-collapses-lr-aggregates.md) | v3 周邊 spawn 寫死 `side: 'R'` ⇒ `curve-v1` 左右分群靜默塌成單邊（`omega.left.n === 0`） | 🔴 被 KI-032 排序阻塞 |

### 偏離協議 / 偏離 HANDOFF 之處（三項，皆已在報告內原地說明）

1. **方位軸不是設計文件寫的「上／下／左／右」四箱。** canonical derivation 只輸出
   `quadrant`（`horizontal`／`vertical`／`oblique`）與 eye-frame `side`（`L`／`R`）——
   **沒有「上 vs 下」的既有構念**。在報告腳本裡自己算一個等於新增第二套幾何（HANDOFF §8 / C-D4
   明文禁止），所以改用 `quadrant × side` 的四箱。
   順帶複驗了 HANDOFF §3.3 ② 的浮點殘值疑慮：`vertical` 分箱的 `|Δx|` 最小值是 **1.06e-2 u**
   （8 u 距離下約 0.076°），殘值的量級是 1e-16 ⇒ **符號有意義，不是殘值**；但 0.076° 離垂直軸太近，
   不應把「近垂直·左／右」讀成左右負荷差異。已在報告與 C4 的說明中寫明。
2. **模組拆成三支而非 HANDOFF §4 寫的兩支。** runner（資料）+ report（渲染）+ analyze（I/O）。
   把 ~1500 行的 HTML/SVG 產生器塞進 runner 會讓「純函式資料層」這件事在檔案層級看不出來。
   兩支純函式模組都無 I/O、無時鐘、無隨機，可測性與 HANDOFF 的意圖一致。
3. **G1 落在 HANDOFF 沒有規定的中間帶。** HANDOFF §2 G1 只寫了「≥ 80% → 照設計走」與「0 或極低 →
   停用並改用 `phase-v1` 的 REC」。實測 71.4% 兩者都不是。處置：**不停用、但降級為描述性**
   （`reactionMs`／`movementTimeMs` 只描述、不作處方，且與 timeout 數並列），並照常算 `phase-v1`
   的 REC/MR/V —— 後者本來就不走 `t_detect`，兩者並列反而讓「反應」與「起手」的差異看得見。

### 驗證

- `npm run typecheck` ✅（並另以 `tsc --strict` 單獨檢查三支新 script，`scripts/` 不在既有 tsconfig 的
  `include` 內 —— 這是既有狀態，非本次引入）
- `npx vitest run` ✅ **253 passed / 1 skipped（2849 tests）**，含新增 27 個
- `node scripts/check-coach-report-render.mjs` ✅ light／dark 皆 **no layout issues**
  （bbox 未溢出 viewBox、圖卡無水平捲軸、body 無水平捲軸、圖內文字零碰撞）
- 人眼複驗七張圖的 light/dark 截圖 ✅ —— 過程中修掉兩個**真的**「文字說明與視覺不一致」：
  ① C2 的判讀句寫「rep 2 往左下」，實際是右下 ⇒ 改為由座標差產生方向詞；
  ② C4 的格線畫在條之上 ⇒ 改為格線先畫。
  同時把 C3/C4/C5/C6/C7 與結論段所有方向性、單調性、量詞（「所有」「都」）的宣稱**全部改成資料的函式**
  —— 手寫方向詞正是 ① 那個錯誤的成因,不該只修一處。
- ⚠️ **渲染檢查的文字碰撞門檻改過一次（同批落地）。** 初版取「兩軸重疊 > 1px」,結果把**教練提案 HTML
  自己的 C2/C5** 也報成碰撞。逐圖目視確認後判定為**偽陽性**：CJK 字形的 bbox 含相當寬的
  ascender/descender 留白,兩行間距 14 px 的 12/11 px 標籤 bbox 會重疊 1–3 px 而字形完全沒碰到。
  門檻改為「兩軸都重疊超過較小 box 的一半」後，本報告與教練提案 HTML 兩份都乾淨。
  （順帶一提：本報告 C5 的列高 40 → 48 是在門檻改好**之前**做的，那一改是**可讀性改善而非修 bug**。）
- `git status` 無參與者資料 ✅（原始 JSON 在 `C:\Users\User\Downloads\`，衍生物在 gitignored 的
  `.spider-v3-analysis/`）

### 環境備註

本機（另一台）沒有 Playwright 瀏覽器，`npx playwright install chromium` 後才能跑渲染檢查與
`npm run test:e2e`。這不是 repo 的變更，只是新機器的一次性安裝。

### Open Questions

- **OQ-S14.1**：G1 的 71.4% 該不該是一道**正式門檻**？本次以 80% 為「粗略門檻」（HANDOFF 的用詞）並
  在低於它時降級，但那個 80% 沒有任何實證來源。要定門檻需要知道「detected 比例多低會讓
  `reactionMs` 的分布失真」——那是 KI-031 修法的一部分，不是本次能答的。
- **OQ-S14.2**：`t_detect` 的 timeout 有 28.6%（34/119）。這些是「真的沒偵測到」還是
  `thresholdDegPerSec` 被上一次拉槍抬高後的漏檢？兩者的處置完全不同。KI-031 §2 的次要觀察在本批
  成立（門檻 p50 = 64–98 deg/s），所以**傾向後者**，但沒有證實。需要一個「baseline 窗排除前一次
  呈現的動作」的對照跑。
- **OQ-S14.3**：本批的首發命中率 85–98% ⇒ 2.0° 角徑對這位受試者**太容易**。
  這是 [README §6 第 5 項](README.md)要的答案之一，但 n = 1 ⇒ 不能據此改協定。
  要不要把「角徑掃描」列成 WP-66 的前置採集？
- **OQ-S14.4**：三份的 `lateEventCount` 是 2／4／6（HANDOFF §1 記的是三份都 2）。量很小可忽略，
  但**單調遞增**這件事沒有解釋。是連續錄製的累積效應還是巧合？
