# KI-005 / A — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-005](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-06 | 計畫 | ✅ A tech spec + T0–T6 + T-exit + A2 產出 | 本資料夾;上游 [KI-005 §6.1](../KI-005-omega-render-sim-aliasing.md) 拍板(選項 A / 感度由 meta 重建 / 不做過渡期 C)· 結構範本 = [KI-004 / S1](../KI-004-S1/README.md) |
| 2026-08-06 | 計畫 | ✅ **OQ-A-1 / OQ-A-2 拍板** | OQ-A-1 = **全域開啟**(不做「實驗 session 才開」);OQ-A-2 = 本次**不動** `recordKeyEvents`,登錄 TD-5,須在 A2-T1 採樣前由研究者決定 |
| 2026-08-06 | 計畫 | ✅ 查碼發現兩個缺口並納入範圍 | ① `pushMouse` 無 pointer-lock 閘(→ T3 / FR-A-8)② `main.ts` 從未啟用 `recordKeyEvents`(→ FR-A-7 的前車之鑑)。見 [README §2.4](README.md) |
| | T0 | ⬜ | |
| | T1 | ⬜ | |
| | T2 | ⬜ | |
| | T3 | ⬜ | |
| | T4 | ⬜ | |
| | T5 | ⬜ | |
| | T6 | ⬜ | |
| | T-exit | ⬜ | |

---

## 2. 基線(T0 回填)

| 項目 | 對照基線 | 實測 |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | |
| `npm run test:ci` | KI-004/S1 收尾:88 files / 694 tests + 19 e2e | |
| `uv run pytest` | KI-004/S1 收尾:183 passed | |
| 08:03 凹口數(KI-005 §3.1) | **27**,間距全為 8 的倍數 | |
| 09:39 凹口數(KI-005 §3.1) | **34**,眾數 8 | |
| 1 幀 tick 正規化 ω(§3.3) | **0.550**(ZOH 預測 0.533) | |
| 2 幀 tick 正規化 ω(§3.3) | **1.108**(ZOH 預測 1.067) | |
| 1 幀 tick 佔比(§3.3) | **12.7%**(預測 12.5%) | |
| `corr(frames_in_tick, ω)` | **0.805**(n = 307) | |
| 兩份匯出的 `refreshEstimateHz` / `simHz` | 預期 240 / 128 | |

> 基線值取自 [KI-005 §3](../KI-005-omega-render-sim-aliasing.md)。**凹口偵測器與幀數比對的口徑與參數必須逐字記在下方**,使 [A2-T2](A2-blocked-plan.md) 能原樣重跑(期望回傳 0)。

### 2a. 偵測器口徑(T0 回填,A2 重跑用)

```
凹口偵測:w[i] < 0.6 × min(w[i-1], w[i+1])  且  w[i-1] > 80  且  w[i+1] > 80
幀數比對:以 meta.frames.series 重建幀時間點;tick 窗 (t − 7.8125, t] 內的幀數
         唯一自由參數 = frame log 起始錨點(frameLog.reset() 於 drill start)
正規化   :(此處填 T0 實作的正規化方式,逐字)
```

### 2b. §2.4 兩個缺口的行號複核(T0 回填)

| 缺口 | 檔案:行 | 現況片段 | 複核 |
|---|---|---|---|
| `pushMouse` 無 lock 閘 | `src/input/InputSampler.ts`:____ | | ⬜ |
| fire / ads **有** lock 閘(對照) | `src/input/InputSampler.ts`:____ | | ⬜ |
| `main.ts` 未啟用 `recordKeyEvents` | `src/main.ts`:____ | | ⬜ |
| `applyInput` 無 mouse 分支 | `src/loop/SimLoop.ts`:____ | | ⬜ |
| `InputRing` 以 Float64 存 dx/dy(無精度損失) | `src/state/SharedState.ts`:____ | | ⬜ |

### 2c. `meta.suspect` OR 集合 + `bufferOverflow` 累加點(T0 回填,T3 的比對基準)

（T0 填入;本計畫**不得**變動 `suspect` 的任何一項）

---

## 3. 受影響測試清單(T0 回填,FM-4 歸因表)

| 測試 | 預期 | 現值 | 歸因 |
|---|---|---|---|
| `src/view/CameraController.test.ts` | **不變**(T1 純重構) | | 有變動 ⇒ 浮點運算順序被改(R-1),停 |
| `src/scene/eyePose.test.ts` | 不變 | | |
| `src/data/metadata.test.ts` / `export.test.ts` | 只增不改 | | T2/T4 新增 optional 欄 |
| `src/state/InputRing.test.ts` / sampler 測試 | T3 可能變動 | | lock 閘 |
| e2e 匯出 round-trip(`full-drill` / `br-tracking` / `input-sampler`) | **T4 變動** | | 新增 additive 欄(FM-4:逐條書面歸因,**不得**關掉旗標) |
| 決定性回歸 / golden | **零變動** | | 有變動 ⇒ 誤觸 sim(NFR-A-1),停 |
| Python `test_angular.py` 既有案 | 不變 | | 舊 fixture 走 `aim-diff-legacy` |
| `test_run_pipeline.py` / `test_parity_fixture.py` / `test_purity.py` | T5 可能變動 | | 合成 fixture 補欄 |

---

## 4. Decision Log

| # | 決策 | 理由 | 記於 |
|---|---|---|---|
| **A-D1** | `dYaw`/`dPitch` 記 **rad** 而非 raw counts | 拍板文字即 `sensitivity × RAD_PER_COUNT × adsGain` 累加;`meta.mouseIntegration` 記下係數 ⇒ counts 仍可反推,無資訊損失。記 counts 會讓每個消費端各自重做換算,反而是 C-D4 的風險面 | [README D-A1](README.md) |
| **A-D2** | `dPitch` **套用** ±`MAX_PITCH` 夾角 | ω(t) 的既有構念是**視角**角速度,不是手部意圖;不夾即產生第二定義,且守恆閘失效 | [README D-A2](README.md) |
| **A-D3** | `omega[0]` 契約**不改**,維持 `nan` | `analysis-segments.md` 與 D-28.12 已凍結;為一個樣本改契約會連動 `seg-v1` 與全部既有測試。登錄 TD-3,`seg-v2` 時決定 | [README D-A3](README.md) |
| **A-D4** | 積分器狀態放 `DataRecorder` 閉包,**不進 `SharedState`** | 保住「`SharedState` 演進零 diff」(NFR-A-1)與 ADR-2 三迴圈邊界;`applyInput` 已持有 `recorder` 參數,無需改簽章(比照 WP-29/T3 的 `recordKeyEvents` 模式) | [README §2.7](README.md) |
| **A-D5** | app 佈線層**啟用**(OQ-A-1 全域開) | opt-in 只保 golden 逐位不變,不是運行時可選;分兩種模式會產生「哪些 run 有 ω」的新不確定性。`recordKeyEvents` 至今未啟用即是前車之鑑 | [README §2.4 ②](README.md) |

---

## 5. Surprises(實作中發現、與計畫不符者)

| # | 發現 | 影響 | 處置 |
|---|---|---|---|

---

## 6. Open Questions(執行中新增 / 關閉)

| # | 問題 | 狀態 | Owner |
|---|---|---|---|
| ~~OQ-A-1~~ | app 啟用範圍 | ✅ 2026-08-06 關閉:**全域開** | 使用者 |
| ~~OQ-A-2~~ | 是否一併開 `recordKeyEvents` | ✅ 2026-08-06 關閉:**本次否**,登錄 TD-5 | 使用者 → 研究者 |
| OQ-A-3 | dPitch 夾角情形是否需 quality flag | 🟡 建議先不加 | 研究者 |
| OQ-A-4 | `beat_period_ticks` 進 `meta.display.gate`(= OQ-KI5-5) | 🟡 未決,不阻塞 A1 | 使用者 |
| OQ-A-5 | 新採樣時機與規模(= OQ-KI5-6) | 🟡 未決 → [A2-T1](A2-blocked-plan.md) | 研究者 |
| OQ-A-6 | 守恆閘在 ADS 樣本上的容差 | 🟡 A1 只宣告 hip-only exact | 實作者 → 研究者 |
