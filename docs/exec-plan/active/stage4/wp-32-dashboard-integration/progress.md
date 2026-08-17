# WP-32 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-17 | 本檔 §0.5(上游複驗)+ §0.6(晉升清單)+ Decision Log D-32.2~D-32.4 + §0.7(fixture roster)+ Open Questions(OQ-S4-4 關閉、OQ-S4-21~24 開帳);`git diff --stat` 只含 `docs/exec-plan/active/stage4/`,`src/`/`research/` 零 diff |
| T1 TS kinematics + SG | ✅ | 2026-08-17 | `src/metrics/angularKinematics.ts` + `src/metrics/filters/savitzkyGolay.ts`;`tests/golden/research/promoted-kinematics.test.ts` 對 SG 係數表 ≤1e-12、四份 ω fixture ≤1e-9、三份真實 ω 訊號 SG smoothing ≤1e-9;legacy 08:03/09:39 strict 負向測試拋 KI-005;新增 generator drift test |
| T2 TS seg-v2 分段 | ✅ | 2026-08-17 | `src/metrics/submovement.ts` + `src/metrics/submovement.test.ts`;`tests/golden/research/promoted-segments.test.ts` 對三份 real fixture 60 peeks 的 `kind/startIdx/endIdx/flags/traceFlags` 逐位相等、`peakOmega` ≤1e-9,pooled `primary_flick=59`;synthetic golden 釘住 scipy `find_peaks` plateau 規則與 merge/flag 分支;新增 generator drift test |
| T3 phase + sync 晉升 | ✅ | 2026-08-17 | `src/metrics/peekWindows.ts` 共享窗界抽出 + Python `PeekWindow` release/flags 對齊;`src/metrics/researchMetrics.ts` 晉升 `phase-v1`/`sync-v1`;`tests/golden/research/promoted-phase-sync.test.ts` 對四份 phase fixture + 六份 sync fixture 逐 peek/row/aggregate ≤1e-9,flags/verdict exact;pooled phase non-degenerate=59、09:39 sync unflagged=13、08:03 sync n=0 blocked;`analysis-phase-curves.md` 已補 TS 晉升面與 `filter_degenerate` 分歧 |
| T4 curve 晉升 | ⬜ | — | — |
| T5 結果頁擴充 | ⬜ | — | — |
| T-exit(M15) | ⬜ | — | — |

**兩閘證據**(每 task 完成時貼原始輸出):

| Task | `uv run pytest` | `npm run test:ci` |
|---|---|---|
| T1 | `uv run pytest -q --tb=short --color=no --basetemp .pytest_tmp_t1_full` → `460 passed in 504.02s`(plain `uv run pytest` 因 Windows `%TEMP%/pytest-of-Hsin...` 權限失敗,改以 repo 內 basetemp 重跑) | `npm.cmd run test:ci` → `tsc --noEmit` + Vitest `93 passed / 763 tests` + Playwright `21 passed` |
| T2 | `uv run pytest -q --tb=short --color=no --basetemp .pytest_tmp_t2_full`(於 `research/`) → `462 passed in 553.87s (0:09:13)` | `npm.cmd run test:ci` → `tsc --noEmit` + Vitest `95 passed / 777 tests` + Playwright `21 passed`(sandbox 內首次 Vitest config 載入遇 Windows 上層目錄權限錯誤,升權重跑同指令通過) |
| T3 | `uv run pytest -q --tb=short --color=no --basetemp ../.pytest_tmp_t3_full`(於 `research/`) → `464 passed in 517.73s (0:08:37)` | `npm.cmd run test:ci` → `tsc --noEmit` + Vitest `97 passed / 793 tests` + Playwright `21 passed`(sandbox 內首次 Vitest config 載入遇 Windows 上層目錄權限錯誤;升權後首次完整跑遇 2 支 Playwright app-ready/backend timeout,重跑失敗 specs `6 passed`,再重跑完整 `test:ci` 通過) |

---

## 0.5 T0 ① 上游三個 T-exit 複驗(只引用,不重跑)

> 協議 §6:entry-gate 的職責是驗上游 exit-gate,不是代辦。以下逐項覆核既有 T-exit 文件與 progress 的證據位置,**未重跑任何上游測試**。

| 上游 | 覆核內容 | 證據位置 |
|---|---|---|
| **WP-29 T-exit** | `timeline-v1` 窗界 `[t_visible, nextVisible.t)`(末筆 +∞)+ 封閉 12 項 flags 詞彙表;`sync-v1` 三量定義(`release_to_fire_ms`/`counter_hold_ms`/`counter_to_fire_ms`)+ 凍結 `SyncParams(min_samples=10, sd_ratio_threshold=1/3, version="sync-v1")`;`compute-v1` 三個既有量(`counterReactionMs`/`fireTimingAlignmentMs`/`firstShotHitRate`)為 TS 權威、Python 對表 ≤1e-9 | [analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) L14-18(權威/版本表)、L79-98(封閉 flags)、L100-135(`sync-v1` 定義 + 凍結 `SyncParams` + 精度判準表);[wp-29 progress.md](../wp-29-coach-timeline/progress.md) T-exit 列(六指標各帶 n/flags/version/效度層級,四份範例 deterministic) |
| **WP-30 T-exit** | `phase-v1` 凍結 `cutoff_hz=12.0, butter_order=4, min_window_ticks=30`(D-30.9)+ `MR = seg-v2 primary_flick` 逐位複用(D-30.1/D-30.1b,多段取候選①)+ 封閉 6 項 flags(含 `filter_degenerate`);`curve-v1` 凍結 `points=101, min_ticks=3(D-30.11), band=iqr`;research-side `t_detect`(`detect.py`)對 TS `detectionDerivation.ts` 逐位 parity ≤1e-9(D-30.5/D-30.6);`seg-v1`/`seg-v2` 依 `mouseIntegration` 存在與否自動選版(`tick-integral` 用 `seg-v2`,`aim-diff-legacy` 用 `seg-v1`) | [analysis-phase-curves.md](../../../../operational/analysis-phase-curves.md) L64-97(`phase-v1` frozen registry)、L37-55(封閉 degenerate flags 表,含 L45 `filter_degenerate` 定義);[wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) D-30.1/D-30.1b/D-30.5/D-30.9/D-30.11;[wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) T-exit 列(`coach-report-v1`,phase/curve 帶 n/flags/version/效度層級,9 份 committed HTML deterministic) |
| **WP-31 T-exit** | 三份效度判定收斂:SPARC `stratified_only`(D-31.6,`step_ratio=0.7643 ≥ 0.5`)、xcorr `research_only`(D-31.9,三 session 全數,2/3 未過 shuffle null)、Fitts 09:18 `blocked-by-data`(`d_ratio=1.8343<2.0`)+ 09:24/09:37 `ok` 但 r² 低(D-31.10);T-exit 明文「WP-32 交接清單為空」(D-31.11) | [wp-31 progress.md](../wp-31-advanced-diagnostics/progress.md) D-31.6/D-31.9/D-31.10/D-31.11;[analysis-advanced-diagnostics.md](../../../../operational/analysis-advanced-diagnostics.md) 「T-exit — 三份判定收斂 + 報告載體契約 + WP-32 交接」章節 |
| **M14** | `seg-v1`(legacy)/`seg-v2`(tick-integral)frozen registry;單一匿名受試者、n=3 session、非母體層級的效度聲稱範圍;fixture roster(09:18/09:24/09:37 主用、09:39/08:03 因 beat aliasing + 無 eye origin 禁用於 ω/curve/phase 但仍可用於 sync) | [../README.md §4](../README.md#4-里程碑門控)(M14 六項重新宣告紀錄);[analysis-segments.md](../../../../operational/analysis-segments.md) `seg-v2` frozen registry |

**結論**:三個上游 T-exit 與 M14 逐項覆核通過,無一項需要重跑或補證據。

## 0.6 T0 ② 晉升清單(封閉七列,三進四出;關閉 OQ-S4-4)

| 晉升 | 版本 | 決議 | 理由 + 證據位置 |
|---|---|---|---|
| ✅ REC/MR/V phase | `phase-v1` | **納入** | WP-30 T-exit 已交付、對表閘綠、效度限制已記(REC-end 與 `t_detect` 系統性分歧,OQ-S4-17 研究向不阻塞晉升);[wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) T-exit 列 |
| ✅ Release-to-Click Sync | `sync-v1` | **納入** | WP-29 T-exit 已交付、精度判準已 pre-registered 並判 `sufficient`;[analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) §Pre-registered precision decision |
| ✅ L/R 101 點曲線 | `curve-v1` | **納入** | WP-30 T-exit 已交付、三份真實 session 各 L/R n=10 零排除;[wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) T3 列 |
| ❌ SPARC | `sparc-v1` | **排除** | WP-31 T1 判 `stratified_only`(D-31.6):`step_ratio=0.7643 ≥ pre-registered 0.5`,僅限同 `padded_n` bucket 內比較;結果頁單一數字無法承載該限制條件,C-D3 下不得進主表。[wp-31 progress.md D-31.6](../wp-31-advanced-diagnostics/progress.md) |
| ❌ Key-Velocity xcorr | `xcorr-v1` | **排除** | WP-31 T2 判三 session 全 `research_only`(D-31.9):09:18/09:37 未過 ① shuffle null(p=0.056/0.173),`gate-v1` 上限條款下 `coach_report` 由 AST 掃描證明不可達。[wp-31 progress.md D-31.9](../wp-31-advanced-diagnostics/progress.md) |
| ❌ Fitts | `fitts-v1` | **排除** | WP-31 T3 判定(D-31.10):09:18 `blocked-by-data`(`d_ratio=1.8343 < min_d_ratio=2.0`);09:24/09:37 `ok` 但 r² 僅 0.0669/0.0339,加上 OQ-S4-19 的 D 內生性(spawn 偏心來自上一 peek 過衝,非受控設計)與 MT 含 RT 兩項限制,結果頁單一 TP 數字會誤導教練當作可靠個人基線。[wp-31 progress.md D-31.10](../wp-31-advanced-diagnostics/progress.md) |
| ❌ `timeline-v1` 三量 | — | **無事可做** | `counterReactionMs`/`fireTimingAlignmentMs`/`firstShotHitRate` 本來就是 `compute.ts` 既有輸出,TS 已是權威,WP-29 T1 已對表 ≤1e-9;沒有東西要「晉升」。[analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) L14-16 |

**OQ-S4-4 關閉**:晉升清單封閉為上表七列(三進四出),排除項理由與證據皆為既有上游 T-exit 判定的引用,非本 WP 推定。

## 0.7 T0 ⑤ fixture roster 沿用(承 WP-31 T0,不重新談判)

| fixture | phase / curve / ω 相關對表 | sync 相關對表 |
|---|---|---|
| 09:18 / 09:24 / 09:37(tick-integral) | ✅ 主用(`strict=True`) | ✅ 可用 |
| 09:39 | ❌ 禁用(beat aliasing + 無 eye origin) | ✅ 主要真實效度樣本(13 個 unflagged Sync 列) |
| 08:03 | ❌ 禁用(同上) | ✅ 零輸入邊界案例(`n=0` 不得 crash) |
| 合成(`synthetic_counterstrafe.json`) | ✅ 演算法邊界 | ✅ 演算法邊界 |

**sync 例外的理由**:`sync-v1` 只吃 `events` 與 `ticks[].keys`,不吃 ω/`px`/`pz`,故 09:39/08:03 的 `aim-diff-legacy`/無 eye origin 禁用理由對 sync 不適用 —— 這是 [wp-29 T0 的 KI-004 使用界線決議](../wp-29-coach-timeline/progress.md)原文,界線未變、本 WP 不重新談判。

## 0.8 T2 `seg-v2` TS port 來源行號對照(2026-08-17)

> T2 要求先讀 `_candidate` / `_merge_overlapping`,並把 12 步行為對照表的 Python 實際行號入帳。以下對照 `research/src/modules/segments/algorithms/submovement.py`。

| # | Python 行為 | 行號 |
|---|---|---|
| 1 | `values.size == 0` → `empty_signal` | L185-L189 |
| 2 | `_prepare_signal`:全非有限歸零、部分非有限 `np.interp` + 首尾外側歸零 + clip | L227-L241 |
| 3 | `not np.any(clean > 0)` → `zero_motion` + `below_floor` | L191-L193 |
| 4 | `clean.size < sg_window` → 不平滑 + `sg_fallback_short_signal` | L195-L199 |
| 5 | SG 後 `np.clip(smoothed,0,None)` | L199-L200 |
| 6 | threshold = `max(mean + k*std(ddof=0), floor)` | L202-L205 |
| 7 | `find_peaks(smoothed)` 後以 `smoothed[i] >= threshold` 過濾 | L206-L207 |
| 8 | 無 peak → `below_floor` 或 `no_peak` | L208-L210 |
| 9 | `_candidate`:左右嚴格 `>` walk,邊界 inclusive,edge truncation flag | L244-L267 |
| 10 | `_merge_overlapping`:只要 `start_idx <= prior.end_idx` 即合併,flag 聯集並加 `merged_adjacent_peaks`,峰值只在 `>` 時更新 | L270-L283 |
| 11 | merged list 的第 0 段才是 `primary_flick`,其餘 `micro_adjustment` | L214-L222 |
| 12 | `flags=tuple(sorted(candidate.flags))`;trace flags 由 `SegmentList(..., flags=trace_flags)` 承載 | L220-L224 |

---

## Decision Log

> 編號 `D-32.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-32.0 — 與規劃稿的偏離:task 數 2 → 7,估時 2–3d → 4.5–5.75d(2026-08-12,規劃期)

**規劃稿**([stage4 README §6](../README.md))把 WP-32 寫成 `T0 / T1 golden parity / T2 結果頁 / T-exit` 四項、2–3d。

**偏離理由(讀碼事實,非估計)**:`grep -rniE "savgol|sg_window|submovement|primary_flick|omega" src/ --include=*.ts` 對 `src/metrics/` 零命中 —— TS 側沒有 ω(t)、沒有 Savitzky-Golay、沒有 submovement 分段。而 `phase-v1` 的 MR 邊界 = 逐 peek 窗內 `seg-v2` 的第一個 `primary_flick`(D-30.1/D-30.1b)→ **晉升 phase 必然連帶晉升整條分段鏈**(ω + SG + `seg-v2`)。把這三層折進單一「T1 golden parity」會產生一個 3 天以上、無法獨立驗證的 task,違反「一 task = 一垂直切片」。

**Alternatives considered**:
- **(a) 只晉升 sync + curves,phase 留 Python**:成本 2.5–3.5d,不需移植 SG/分段。**未採納** —— 使用者於 2026-08-12 拍板三項全晉升。
- **(b) 只晉升 sync**:成本 2–2.5d,M15 最快到,但結果頁新增價值最小。未採納,同上。
- **(c) 維持兩 task 但放大顆粒**:違反 task 粒度原則(0.5–3d)且對表失敗時無法定位是 ω、SG 還是分段出錯。未採納。

**採納**:七 task。切法依「可獨立對表的最小單位」:T1 = ω + SG(各自有 golden)、T2 = 分段(吃 T1 產物,golden 為整數 index)、T3 = phase + sync、T4 = curve、T5 = 呈現。

**估時**:0.375 + 1.125 + 1.125 + 0.875 + 0.625 + 0.625 + 0.5 ≈ 5.25 → **4.5–5.75d**。

### D-32.1 — WP-31 由「M15 選項」升為 WP-32 硬相依(2026-08-12,規劃期)

[stage4 README §5](../README.md) 原寫「WP-31 為 M15 選項:未過 reliability gate 的指標不晉升」,§3 相依欄亦寫「WP-29 + WP-30(WP-31 選項)」。但 **OQ-S4-4 的決議欄要求「WP-31 通過項納入評估」** —— 沒有三份完整判定,T0 的晉升清單就只能靠推定。

使用者於 2026-08-12 拍板:**先完成 WP-31 T3(Fitts)+ T-exit,再開 WP-32 T0**。故 WP-32 entry = WP-29 ✅ + WP-30 ✅ + **WP-31 T-exit ✅**。

**代價**:M15 延後約 0.5–1d。**換得**:晉升清單的排除理由是證據(三份判定 + `analysis-advanced-diagnostics.md` 定稿)而非推定,符合 C-D3「寧可少一個指標,不能有一個會說錯話的指標」的舉證責任方向。

### D-32.2 — 移植紀律 P1–P5 pre-registration(2026-08-17,T0 凍結)

**事後不得依對表結果調整,只能升 version 重跑**。五條:

| # | 紀律 | 理由 |
|---|---|---|
| **P1** | **parity 方向**:六個新構念(ω / SG / `seg-v2` / `phase-v1` / `sync-v1` / `curve-v1`)一律 Python 權威、TS port;閘 = committed golden + vitest,落在既有 `npm run test:ci`(engine CI 不引入 Python,OQ-S4-7 不變) | 若方向不定,對不上時會傾向改較好改的 Python,等於讓已凍結的研究層跟著 UI 走 |
| **P2** | **既有構念禁第二定義(C-D4)**:peek 窗界複用 `compute.ts`、逐 tick ε 複用 `trackingDerivation.ts`、`t_detect` 呼叫 `deriveDetectionMetrics` | `researchMetrics.ts` 是新檔,最方便的寫法就是「順手再算一次」,而那正是 C-D4 禁的 |
| **P3** | **對表容差三級**:① SG 係數表 vs Python golden ≤1e-12 ② 所有浮點量 ≤1e-9 相對誤差 ③ 整數量(segment `startIdx`/`endIdx`、`n`、flag 集合)= 逐位相等,不設容差 | 分段邊界差 1 tick = 7.8125ms,用相對容差會讓它悄悄過關 |
| **P4** | **`filter_degenerate` 為刻意的詞彙表子集**(細節見 D-32.4):TS 不移植 Butterworth → 該 flag 不可能產生。golden 比較 flags 時排除此一 flag,其餘 flag 逐 peek 相等(不是子集) | 不先凍結,T3 對表紅了會被誤判為 bug,或被用「flags 只比子集」矇混過去 |
| **P5** | **`blocked` 優於錯值**:`meta.mouseIntegration` 缺席 → `computePromotedMetrics` 回 `{status:'blocked', reason}`;禁止回退 `aim-diff-legacy` ω | 回退 = 在結果頁顯示 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) 已知錯誤的數字,比不顯示更糟 |

**Alternatives considered**:
- 「容差一律 ≤1e-9,不特別區分整數量」— 否決:分段 index 差 1 是離散事件(邊界移動一整個 tick),不是浮點捨入誤差,混在同一容差級會掩蓋真實的演算法分歧。
- 「parity 方向依指標各自決定(部分 TS 權威、部分 Python 權威)」— 否決:六個新構念在本 repo 都沒有既有 TS 實作,分開決定沒有依據可循,只會製造下一個 task 需要另外裁決的分歧點。

### D-32.3 — SG 係數策略:凍結矩陣而非重寫 scipy(2026-08-17,T0 拍板;承 S-32.2)

`sgSmooth` **不重寫 scipy**:由 Python 產出 `sg-coeffs-seg-v2.json`(interior 11 個係數 + 前/後各 5×11 的 edge 轉換矩陣,對應 `scipy.signal.savgol_filter(window_length=11, polyorder=3, mode='interp')` 的 `_fit_edges_polyfit`)→ TS 內嵌為凍結常數表(生產碼不在 runtime 讀 fixture),另以一支測試對 committed golden ≤1e-12。版本字串 `sg-seg-v2`;改動 = 升 `seg` 版號,不得原地改。

**不達標時的處置路徑(OQ-S4-21,T1 驗)**:① 若 ≤1e-9 對不上,先查是否為矩陣精度問題(以更高精度重產生係數)② 仍不行則停手入帳,提案把 edge 5 個樣本的對表容差分級為 ≤1e-6 並在 `analysis-phase-curves.md` 明文記載,**不得靜默放寬**。

**Alternatives considered**:
- 「在 TS 重寫 `np.polyfit`/`lstsq` 逐位重現 edge fitting」— 否決:`lstsq` 的數值路徑(QR/SVD 分解)在 TS 生態沒有與 numpy/LAPACK 逐位一致的實作,重寫本身就無法保證 ≤1e-9,等於把風險從「套矩陣」轉移到「重寫數值線性代數函式庫」,成本更高且風險不會消失。
- 「放寬對表容差以容納重寫誤差」— 否決:violates P3,且是先射箭後畫靶。

### D-32.4 — `filter_degenerate` 為刻意的詞彙表子集(2026-08-17,T0 拍板;承契約第 4 條)

TS 側因 D-32.3/S-32.1 不移植 Butterworth(`smooth_report_omega` 僅供報告疊圖平滑,`phase.py` docstring 明寫 "never a boundary input")→ 無法產生 `filter_degenerate` 這一個 flag。golden 對表逐 peek 比較 flags 集合時**排除此一 flag**;**其餘 flag 逐 peek 必須完全相等(不是子集,是相等)**。

**須同步更新的文件位置**:`docs/operational/analysis-phase-curves.md` 補一段「TS 晉升面的 flags 詞彙表 = Python 詞彙表 − {`filter_degenerate`};此 flag 只描述報告疊圖能否平滑,不影響任何 rec/mr/v/peak ω 數值」(T3 落地時補寫,T0 僅在此凍結決議文字)。

**Alternatives considered**:
- 「TS 也移植一個簡化版 Butterworth,湊出 `filter_degenerate`」— 否決:違反 §0.1 的減負理由(Butterworth 從不參與邊界計算,移植它只為了湊 flag 詞彙表完整,是為了對表而對表,且會引入零相位雙向濾波在 TS 重現的額外風險)。
- 「golden 比較 flags 時改用子集判定(TS ⊆ Python)」— 否決:子集判定會放過「TS 漏掉一個非 `filter_degenerate` 的真實 flag」這種 bug,必須是「排除單一已知項後逐位相等」而非泛用子集容忍。

### D-32.5 — T1 合成 anti-vacuous fixture 另立長版,不改既有 synthetic baseline(2026-08-17,T1)

T1 DoD 要求合成 ω fixture 有 ≥100 finite samples,但既有 `synthetic_counterstrafe.json` 僅 48 ticks(47 finite ω),不足以防 vacuous 對表。T1 因此新增 `research/fixtures/exports/synthetic_counterstrafe_t1_long.json`:沿用既有 deterministic `make_synthetic_export(SyntheticSpec(peek_count=6,ticks_per_peek=24))`,只服務 promoted kinematics golden,不重錄或覆寫既有 `synthetic_counterstrafe.json` baseline。

**Alternatives considered**:
- 「放寬 synthetic anti-vacuous 門檻」— 否決:會削弱 T1 DoD,且不必要。
- 「直接改既有 `synthetic_counterstrafe.json`」— 否決:會造成既有 parity/baseline 連鎖 churn,違反 T1 的封閉 scope。
- 「在 TS test 手寫長合成 ticks」— 否決:會在 TS 側引入第二份 synthetic fixture generator,不如沿用 research 已有 deterministic generator。

### D-32.6 — T2 segment golden 分 real peek 與 synthetic algorithm cases(2026-08-17,T2)

T2 golden 產生器 `research/src/modules/segments/notebooks/t2/generate_promoted_segments_golden.py` 產四份 JSON:

- 三份 real `segments-counterstrafe_*.json`:逐 peek 按 WP-30 `_dimension_two` 相同路徑切窗,`omega_deg_s(strict=True).values[1:]` 餵 `segment_submovements(..., SEG_V2_PARAMS)`,再把 segment index `+1` 映回 tick frame。對表面含 `tickRange`/`tickCount`/`indexFrame='tick'`,方便 TS test 檢查切窗沒有漂。
- 一份 `segments-synthetic_submovement_cases.json`:分成 `peakCases`(scipy `find_peaks` plateau/endpoint 規則)與 `segmentCases`(empty/non-finite/zero/below-floor/no-peak/short/truncated/merge flags)。`indexFrame='signal'`。

**採納理由**:real fixture 驗實機 60 peeks 與 anti-vacuous `primary_flick=59`;synthetic cases 驗離散 hazard,尤其 plateau midpoint 與 merge。把兩者放同一個 fake export 會增加 fixture schema 負擔,且 plateau 規則本身不是 export 語意。

**Alternatives considered**:
- 「只用 real peeks」— 否決:real data 未必覆蓋偶數/奇數 plateau 與 endpoint plateau,plateau bug 可能在 CI 綠燈下存活。
- 「把 synthetic cases 寫成 TS-only unit test,不進 Python golden」— 否決:plateau 規則要對 scipy,不是對手寫期望值;committed golden 讓規則來源可稽核。

---

## Surprises

> 編號 `S-32.n`。規劃期已知的兩項先記在此,落地時補證據。

### S-32.1 — Butterworth 不必移植(規劃期讀碼)

`phase-v1` 的 Butterworth 只出現在 `smooth_report_omega`,模組 docstring 明寫 "never a boundary input" —— 邊界全部來自 `seg-v2` 的 `primary_flick`。故 TS 晉升面**不需要** `butter_filter`/`filtfilt`(scipy `filtfilt` 的零相位雙向濾波在 TS 重現遠比 SG 困難)。

代價是 `filter_degenerate` 這一個 flag 在 TS 側無法產生 → T0 須明文凍結為「刻意的詞彙表子集」,並在 golden 對表時排除該 flag(其餘 flag 逐 peek **相等**)。

### S-32.2 — SG 的難點在 edge,不在 interior(規劃期讀碼)

`sg_filter` = `scipy.signal.savgol_filter(window_length, polyorder)`,預設 `mode='interp'`:內部是固定 FIR 卷積(可直接抄係數),但**前/後各 `(window-1)/2` 個樣本另以三次多項式擬合**(scipy `_fit_edges_polyfit` → `np.polyfit` → `lstsq`)。在 TS 重寫 lstsq 不可能可靠達 ≤1e-9。

→ 契約改為「由 Python 產出係數矩陣、TS 內嵌為凍結常數」,把問題從**重寫演算法**降為**套用矩陣**。殘餘風險記為 **OQ-S4-21**,T1 驗。

### S-32.3 — 既有合成 fixture 太短,不足 T1 anti-vacuous 門檻(2026-08-17,T1)

`synthetic_counterstrafe.json` 只有 48 ticks,扣掉 index 0 的 `NaN` 後 finite ω = 47,低於 T1 DoD 的 synthetic ≥100。處置見 D-32.5:新增 T1 專用長版合成 export,不改既有 baseline。

### S-32.4 — T2 merge synthetic 若先經 SG 可能被平滑成單峰(2026-08-17,T2)

起初沿用 `test_submovement.py` 中 32 點 tightly spaced double peak 長訊號作為 TS merge case,但在 `seg-v2` 的 `sg_window=11` 下,該訊號經 SG 後只剩單一 local maximum,因此不會產生 `merged_adjacent_peaks`。這不是 TS port bug,而是測試資料沒有踩到 T2 要驗的 merge 分支。

**Evidence**:`segments-synthetic_submovement_cases.json` 初版的 `merged_adjacent_peaks` case 產生 `flags: []`;改為 6 點短窗 fallback `(0,100,300,100,250,0)` 後,Python golden 與 TS unit test 都產生 `flags: ['merged_adjacent_peaks','sg_fallback_short_signal']`。

**處置**:synthetic segment golden 保留短窗 merge case;real fixture golden 仍照完整 `seg-v2` 路徑跑,不因此改動實機對表。

### S-32.5 — Python blocked precision 仍保留 `sample_sd_ms`(2026-08-17,T3)

T3 初版 TS `PrecisionVerdict` 在 `n < min_samples` 的 `blocked-by-data` 分支省略 `sampleSdMs`,但 Python `evaluate_release_precision` 會先在 `n >= 2`時計算 `sample_sd_ms`,再判 blocked。因此 `sync-synthetic_counterstrafe_t1_long.json` 的兩個 verdict 是 `n=6`, `sampleSdMs=0.0`, `blocked-by-data`。

**Evidence**:`tests/golden/research/promoted-phase-sync.test.ts` 初跑 11/12 passed,唯一失敗為 synthetic sync verdict `expected undefined to be defined`;修正後該測試 `12 passed`。完整 engine 閘最終 `Vitest 97 files / 793 tests` + Playwright `21 passed`。

**處置**:`src/metrics/researchMetrics.ts` 的 blocked verdict 分支保留 `sampleSdMs`(若 `n >= 2`),與 Python 權威逐欄一致。

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| ~~**OQ-S4-4**~~ | ~~晉升 dashboard 的指標清單~~ | ✅ **關閉(2026-08-17,T0,本檔 §0.6)**:晉升清單封閉為七列(三進四出)—— `phase-v1`/`sync-v1`/`curve-v1` 納入;`sparc-v1`/`xcorr-v1`/`fitts-v1` 排除(逐項理由 + 證據位置引 WP-31 T-exit D-31.6/D-31.9/D-31.10);`timeline-v1` 三量無事可做 | 使用者 | WP-32 T0 ✅ |
| ~~**OQ-S4-21**~~ | ~~scipy `savgol_filter(mode='interp')` 的 edge polyfit 以凍結矩陣重現後能否穩定達 ≤1e-9~~ | ✅ **關閉(2026-08-17,T1)**:`promoted-kinematics.test.ts` 在三份真實 fixture 的 `omega.values[1:]` 上逐點比較 `sgSmooth` vs Python `sg_filter`,含前後 edge samples,≤1e-9 通過;SG 係數表本身 ≤1e-12 通過 | 研究者 | WP-32 T1 ✅ |
| **OQ-S4-22**(新) | 結果頁單 drill n ≈ 20 peeks,phase/sync 均值是否穩定到可對選手呈現 | 🟡 open,T5 以呈現形式解(強制 n + p50 + SD,不給單一分數) | 使用者 / 研究者 | WP-32 T5 |
| **OQ-S4-23**(新) | `curve-v1` 在結果頁的縮圖形式 | 🟡 open,T5 拍板;建議與教練報告 v1 同形式(inline SVG L/R 疊圖 + IQR 帶 + `n(L)`/`n(R)`) | 使用者 | WP-32 T5 |
| **OQ-S4-24**(新) | 雙實作維護紀律是否升為硬約束 | 🟢 建議升 **C-D5**(CLAUDE.md §4)+ 候選 **GD-21**(DECISIONS.md);T-exit 落地 | 使用者 | WP-32 T-exit |
| **OQ-S4-17 / 19 / 20 / 10 / 11** | 承上游,均維持 open | 本 WP 不解;T-exit 須在 `acceptance-stage-d.md` 逐條列為「stage4 交付時的已知限制」 | 研究者 | pilot 後 |
