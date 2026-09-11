# KI-034 — `preStimulusMs: 500` 在快速連續呈現中把前一次接戰當基線，讓 `tDetectMs` 靜默漏報並高估反應時間

> 類型：**指標正確性 / 非隨機靜默資料遺失**（production runtime 與原始匯出無缺陷；壞掉的是離線 `t_detect` 推導的 baseline 時段假設）。
> 狀態：🔴 **未修（2026-09-10 已以 3 份 240 Hz 真人匯出診斷並重現）**。尚無 `BD-034`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 標的：[`src/metrics/detectionDerivation.ts`](../../src/metrics/detectionDerivation.ts) 與
> [`research/src/modules/metrics/algorithms/detect.py`](../../research/src/modules/metrics/algorithms/detect.py)（TS/Python parity）。
> 相關：[KI-031](KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)（同一 detector 的另一個獨立缺陷：aim 更新率 × 連續 tick 判準；本 KI 是 trial 週期 × baseline 時段）。

## 1. 症狀

三份真人 `spider-shot-wide-v1` 匯出（sensitivity 1.0、240 Hz 顯示、128 Hz sim、132 個周邊呈現）以
canonical 預設 `preStimulusMs: 500`、`thresholdSdMultiplier: 3`、`sustainedTicks: 4` 推導：

| baseline 窗 | detected / peripheral | reaction 中位 | baseline SD 中位 | threshold 中位 |
|---:|---:|---:|---:|---:|
| 120 ms（診斷敏感度值） | **132 / 132** | 179.7 ms | 8.0 deg/s | 23.9 deg/s |
| 250 ms（診斷敏感度值） | **132 / 132** | 187.5 ms | 11.7 deg/s | 35.1 deg/s |
| 400 ms | 95 / 132 | 226.6 ms | 107.0 deg/s | 321.0 deg/s |
| **500 ms（預設）** | **50 / 132** | **234.4 ms** | **140.9 deg/s** | **422.7 deg/s** |
| 600 ms | 67 / 132 | 242.2 ms | 136.9 deg/s | 410.7 deg/s |

這不是「少幾筆」而已：500 ms 漏掉的 82 筆在 120 ms 敏感度分析中的 reaction 中位為 **171.9 ms**；
500 ms 原本留下的 50 筆中位為 **234.4 ms**。對原本可配對的 50 筆，120 ms 相對 500 ms 的
`reactionMs` 逐筆差中位為 **−35.2 ms**。因此漏失不是隨機的：快 trial 較容易被丟掉，留下的分布被推晚。

逐 run 結果同向：

| run | 預設 500 ms | 120 ms 敏感度分析 |
|---|---:|---:|
| `…19_51_09.849Z` | 14/43；median 257.8 ms | 43/43；median 203.1 ms |
| `…19_52_46.447Z` | 18/45；median 234.4 ms | 45/45；median 187.5 ms |
| `…19_54_04.311Z` | 18/44；median 230.5 ms | 44/44；median 171.9 ms |

## 2. 根因

TS 的 baseline 直接取 `[visible.t - preStimulusMs, visible.t)`，並對**即將出現的新目標位置**計算
`epsilon(t)`：

```ts
const baselineSamples = eccentricitySamples(
  ticks,
  visible.t - options.preStimulusMs,
  visible.t,
  spawnTarget,
  options.eyeOrigin,
  false,
);
```

這個窗沒有前一次 presentation 的 phase/terminal 邊界。`spider-shot-wide-v1` 命中後約 **12.0 ms**
就重生下一顆目標；所以 500 ms baseline 在前一次命中前仍有中位 **488.0 ms**，幾乎整窗都是前一次拉槍與煞停，
不是靜止雜訊。對新目標算出的 `|d epsilon/dt|` 因而包含完整前次動作，SD 被抬到 140.9 deg/s，
`3 × SD` threshold 被抬到 422.7 deg/s，接近本批實際 flick peak，導致 onset 找不到或被找晚。

Python parity 實作逐位相同：`detect.py` 的 `baseline_window` 也從
`t_visible - params.pre_stimulus_ms` 開始，並用 `spawn_target` 算固定目標的 baseline epsilon。

### 為什麼 `baselineInsufficient` 沒有攔住

`baselineInsufficient` 只檢查 baseline velocity 樣本數與**時間覆蓋長度**，不檢查樣本屬於靜止期還是前次接戰：

```ts
const baselineInsufficient =
  baselineVelocities.length < 2 || baselineCoverageMs + EPSILON < options.preStimulusMs;
```

在預設 500 ms 下，本批 82 個 timeout 的 `baselineInsufficient` 全為 `false`，132 個周邊呈現也全為
`false`。也就是品質欄明確回報「足夠」，錯誤結果卻以合法 `status: 'timeout'` 流出。

另需注意：120 ms 只用來做機制敏感度分析，**不是可直接晉升的修法**。本批 120 ms 雖達 132/132，
但因離散 tick 的覆蓋計算，132 筆又全被標成 `baselineInsufficient: true`；而且 120 ms 仍取自前一次
presentation 的尾段，只是碰巧以低速 settle 為主，語意上仍不是受控的 pre-stimulus resting baseline。

## 3. 與 KI-031 的區別

兩條 KI 共享 `deriveDetectionMetrics()`、相同下游與相同 parity surface，但失效條件不同：

| | KI-031 | KI-034 |
|---|---|---|
| 失效條件 | aim 更新率低於 sim 率 | presentation 週期短於 baseline 假設，且 inter-trial quiet window 太短 |
| 機制 | 速度序列被 0 切斷，湊不出連續 `sustainedTicks` | 前次動作抬高 baseline SD 與 threshold |
| 本批 240 Hz 證據 | 500 ms 下 `sustainedTicks: 1` 仍只有 117/132 | 120 ms 下 `sustainedTicks: 1..6` **全部 132/132** |
| 修正方向 | 重新定義連續性/時間持續條件 | 重新定義 baseline 的合法時段與不足時的失敗語意 |

所以不能再把 240 Hz wide run 的 coverage 下降歸因為「KI-031 的平滑退化」。兩條修法可以排序或合併升版，
但診斷與 acceptance fixture 必須分開，否則一條修好後會誤以為另一條也消失。

## 4. 影響面

1. `deriveDetectionMetrics()` 的全部 production 消費者都可能受影響：Spider Shot 的
   `switchReaction`／`movementExecution.movementTimeMs`、Hold Click、research phase metrics、repositioning suspicion。
2. 缺失方向會**反向懲罰快表現**：cycle 越短，前次高速動作占 500 ms baseline 的比例越高；漏掉的又是較快 reaction，
   所以 coverage 與中位數會同時說錯。
3. `status: 'timeout'` 仍是合法受測結果，`baselineInsufficient: false` 又看似通過品質閘，因此 CI、schema parser
   與一般報告皆不會報錯。
4. 已發佈的 `Wide Flick 教練儀表`（artifact `f44b3482-e35d-4d60-a4a9-2dc743cf1f93`）把 240 Hz 資料的
   83.5% reaction coverage 歸因為 KI-031；其 §02、§03、W5、§07、§08 均需更正。該 artifact 的
   14:xx sensitivity 1.4 cohort 原始匯出未在本機，修訂前必須以原始檔重跑 120/250/500 ms sweep，
   不得只改敘述或把舊 86/103 當成完整分布。

## 5. 修改計畫（未落地）

這是 detector 語意變更，TS 與 Python 必須同步，`detect-v1` 不得原地換定義。

1. **先讓污染可見，不改判準**：輸出 additive、reason-coded baseline provenance/validity（至少能區分
   `short_window`、`overlaps_active_prior_presentation`、`valid_quiet_baseline`），並讓聚合端對前兩者 fail closed，
   不再把它們編成受測者 `timeout`。
2. **另立新版 baseline 契約**。候選 A（建議）是使用明示的 quiet/calibration interval 建立 session-level noise floor；
   候選 B 是只取前次 terminal event 後的 quiet interval，不足時回傳不可推導。兩者都不能以固定 120 ms 靜默替代。
3. **與 KI-031 排序後同步升版**：TS、Python、operational spec、parity fixture/golden 一起更新；分別保留
   「低 aim update rate」與「短 trial cycle」兩種 fixture，避免互相遮蔽。
4. 加一個快速連續 presentation fixture，釘住：污染 baseline 必須 reason-code；不得輸出
   `baselineInsufficient: false` + `status: timeout` 假裝是受測結果；新 baseline 契約下 reaction coverage 與已知 onset 對表。
5. 在修好前，任何非預設 `preStimulusMs` 結果只能標成**敏感度分析**，不得與 canonical cohort 混用、不得直接進教練報告（C-D3/C-D4）。

## 6. 證據與可重現性

三份來源檔保留在使用者本機 Downloads，**不複製進 repo**：

| 檔名 | SHA-256 | 周邊呈現 |
|---|---|---:|
| `spider-shot-wide-v1-2026-09-09T19_51_09.849Z.json` | `3eaaed88e162b5d59d0d61c86ed4256583e0eaa5fa39e4f74c90f031b980f6a0` | 43 |
| `spider-shot-wide-v1-2026-09-09T19_52_46.447Z.json` | `9a02b692b0202548926cfd2d4a590ff32fda703dbc76cb8590e066131bc28854` | 45 |
| `spider-shot-wide-v1-2026-09-09T19_54_04.311Z.json` | `fbdd6c8b4e3eaeddae0ae5e93e81c252707e97be0afb45a1253ce415ccd44cf1` | 44 |

共同 metadata：schema v2、`spider-shot-wide-v1`、sensitivity 1.0、FOV 75、display 240 Hz、sim 128 Hz、
`crossOriginIsolated: true`、`suspect: false`、seed 57001。

重現方式：每檔先經 `parseExportPayload()`，再對 `deriveDetectionMetrics(payload, { preStimulusMs, sustainedTicks })`
的 `zone === 'peripheral'` presentation 做上表 sweep；median 採一般排序中位數。2026-09-10 在 Node 25.9.0
以 repo 當下 `main@3a4c146` 重跑，結果如 §1–§3。
