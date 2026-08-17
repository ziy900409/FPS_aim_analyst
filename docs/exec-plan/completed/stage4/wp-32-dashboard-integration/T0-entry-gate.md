# T0 — entry gate(三上游複驗 + 晉升清單凍結 + 移植紀律 pre-registration;無演算法碼)

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-29 T-exit ✅ · WP-30 T-exit ✅ · **WP-31 T-exit ✅**(D-32.1) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 僅本 WP 文件(README/checklist/progress)+ [../README.md](../README.md) §3/§8;**零程式碼** |
| **狀態** | ⬜ |

## Objective

把 WP-32 的「事後不得改」前提凍結成可稽核狀態。本 task 的產出全是**判準與清單**,一行程式碼都不寫 —— 因為 T1 之後每一個 task 的 DoD 都是「對表通過」,而「對什麼表、容差多少、哪些 fixture、哪些 flag 算數」若不先凍結,後面就變成看著紅燈調容差。

## In scope

### ① 上游複驗(只引用,不重跑)

逐條記錄證據位置,**不重跑上游測試**:

| 上游 | 引用範圍 | 證據位置 |
|---|---|---|
| **WP-29 T-exit** | `timeline-v1` / `sync-v1` 凍結值(`min_samples=10`、`sd_ratio_threshold=1/3`)、`compute-v1` 對表基準五列、`analysis-peek-timeline.md` 封閉 flags | [wp-29 progress.md](../wp-29-coach-timeline/progress.md) · [analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) |
| **WP-30 T-exit** | `phase-v1`(`cutoff_hz=12.0`/`butter_order=4`/`min_window_ticks=30`)、`curve-v1`(`points=101`/`min_ticks=3`/`band='iqr'`)、research-side `t_detect` 對表、`seg-v2` 選版規則 | [wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) · [analysis-phase-curves.md](../../../../operational/analysis-phase-curves.md) |
| **WP-31 T-exit** | 三份效度判定(SPARC / xcorr / Fitts)+ `analysis-advanced-diagnostics.md` 定稿 | [wp-31 progress.md](../wp-31-advanced-diagnostics/progress.md) · [analysis-advanced-diagnostics.md](../../../../operational/analysis-advanced-diagnostics.md) |
| **M14** | `seg-v1`/`seg-v2` 凍結、單樣本效度限制、fixture roster | [../README.md §4](../README.md) |

### ② 晉升清單凍結(關閉 OQ-S4-4)

寫成**封閉清單**,T5 會以測試斷言結果頁 metric id 集合等於它:

| 晉升 | 版本 | 對表面(golden 逐量) |
|---|---|---|
| ✅ REC/MR/V phase | `phase-v1` | 逐 peek `rec_ms`/`mr_ms`/`v_ms`/`peak_omega_deg_s` + flags 集合 + drill 級 `mean/p50/sd/n` |
| ✅ Release-to-Click Sync | `sync-v1` | 逐 peek `release_to_fire_ms`/`counter_hold_ms`/`counter_to_fire_ms` + flags + 兩支 `PrecisionVerdict` 全欄 |
| ✅ L/R 101 點曲線 | `curve-v1` | ω/ε × L/R 各 101 點 `mean`/`lower`/`upper` + `n(L)`/`n(R)` |
| ❌ SPARC | `sparc-v1` | **排除** —— WP-31 T1 判 `stratified_only`(D-31.6),僅限同 `padded_n` bucket 內可比;結果頁無法承載該限制條件 |
| ❌ Key-Velocity xcorr | `xcorr-v1` | **排除** —— WP-31 T2 判三 session 全 `research_only`(D-31.9),且 `gate-v1` 上限條款下 `coach_report` 不可達 |
| ❌ Fitts | `fitts-v1` | **排除** —— 依 WP-31 T3 判定填入實際理由(`blocked-by-data` 或 `research_only`)+ OQ-S4-19 的 D 內生性限制 |
| ❌ `timeline-v1` 三量 | — | **無事可做** —— 本來就是 `compute.ts` 的既有輸出,TS 為權威,WP-29 T1 已對表;不是「晉升」 |

**排除必須逐項寫理由 + 證據位置**,不得只寫「未過 gate」。這是 C-D3 的舉證方向:排除一個指標要說得出它會怎麼說錯話。

### ③ 移植紀律五條 pre-registration(本 task 最重要的產出)

| # | 紀律 | 為什麼要先凍結 |
|---|---|---|
| **P1** | **parity 方向**:六個新構念(ω / SG / `seg-v2` / `phase-v1` / `sync-v1` / `curve-v1`)一律 **Python 權威、TS port**;閘 = committed golden + vitest,落在既有 `npm run test:ci`(engine CI 不引入 Python,OQ-S4-7 不變) | 若方向沒定,對不上時會傾向改 Python(較好改),等於讓已凍結的研究層跟著 UI 走 |
| **P2** | **既有構念禁第二定義(C-D4)**:peek 窗界複用 `compute.ts`、逐 tick ε 複用 `trackingDerivation.ts`、`t_detect` 呼叫 `deriveDetectionMetrics` | `researchMetrics.ts` 是新檔,最方便的寫法就是「順手再算一次」,而那正是 C-D4 禁的 |
| **P3** | **對表容差三級**:① SG 係數表 vs Python golden **≤1e-12** ② 所有浮點量 **≤1e-9 相對誤差** ③ **整數量(segment `startIdx`/`endIdx`、`n`、flag 集合)= 逐位相等,不設容差** | 分段邊界差 1 tick = 7.8125ms,用相對容差會讓它悄悄過關 |
| **P4** | **`filter_degenerate` 為刻意的詞彙表子集**(S-32.1):TS 不移植 Butterworth → 該 flag 不可能產生。golden 比較 flags 時**排除此一 flag**,其餘 flag 逐 peek **相等**(不是子集)。須同步寫入 `analysis-phase-curves.md` 的「TS 晉升面」段 | 不先凍結,T3 對表紅了會被誤判為 bug,或被用「flags 只比子集」矇混過去 |
| **P5** | **`blocked` 優於錯值**:`meta.mouseIntegration` 缺席 → `computePromotedMetrics` 回 `{status:'blocked', reason}`;**禁止**回退 `aim-diff-legacy` ω | 回退 = 在結果頁顯示 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) 已知錯誤的數字,比不顯示更糟 |

### ④ SG 係數策略拍板(S-32.2)

明文決議:`sgSmooth` **不重寫 scipy**,而是套用由 Python 產出的凍結係數(interior 11 個 + 前/後各 5×11 edge 矩陣),**內嵌為 TS 常數**(生產碼不在 runtime 讀 fixture),另以一支測試對 committed golden ≤1e-12。係數表版本字串 = `sg-seg-v2`;改動 = 升 `seg` 版號,不得原地改。

殘餘風險開 **OQ-S4-21**,並**預先寫好不達標時的處置**:先查矩陣精度 → 仍不行則停手入帳、提案 edge 5 樣本分級容差並明載於 `analysis-phase-curves.md`,**不得靜默放寬**。

### ⑤ fixture roster 沿用與 sync 例外(承 WP-31 T0,不重新談判)

抄入 [README §0.3](README.md) 的表:ω/SG/分段/phase/curve 的對表**只用** 09:18 / 09:24 / 09:37 + 合成(`strict=True`);sync 額外可用 09:39(主要效度樣本)與 08:03(零輸入邊界)—— 理由是 sync 不吃 ω/`px`/`pz`,WP-29 T0 的 KI-004 使用界線原文未變。

### ⑥ OQ 開帳

關閉 **OQ-S4-4**;開 **OQ-S4-21 / 22 / 23 / 24**(各填 owner + deadline + 未決影響),並在 [../README.md §8](../README.md) 同步補列。

## Out of scope

- 任何 `src/` 或 `research/` 程式碼(T1 起)。
- 調整任何上游凍結參數(`seg-v2` / `phase-v1` / `curve-v1` / `sync-v1` / `detect-v1`)。
- 決定結果頁版面(T5;OQ-S4-22/23)。

## Steps

- [ ] 引用並記錄三個上游 T-exit 的證據位置 + M14 可引用範圍(不重跑)。
- [ ] 把晉升清單七列(三進四出)逐列寫入 progress,排除項各附理由 + 證據位置。
- [ ] 把移植紀律 P1–P5 逐條寫入 progress Decision Log(`D-32.2`),明文寫「事後不得依對表結果調整,只能升 version 重跑」。
- [ ] SG 係數策略拍板寫入 Decision Log(`D-32.3`),含不達標時的處置路徑。
- [ ] `filter_degenerate` 子集決議寫入 Decision Log(`D-32.4`),含須同步更新的文件位置。
- [ ] fixture roster 表抄入 progress(含 sync 例外的理由)。
- [ ] 關閉 OQ-S4-4;開 OQ-S4-21/22/23/24;同步 [../README.md §8](../README.md)。
- [ ] 更新 [../README.md §3](../README.md) WP-32 狀態 ⬜ → 🟡,並把相依欄由「WP-31 選項」改為「WP-31 T-exit ✅」(引 D-32.1)。
- [ ] 更新 [../README.md §6](../README.md) 的 WP-32 task 表為七 task + 估時 4.5–5.75d(引 D-32.0)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 三個上游 T-exit 逐項覆核 | progress 有三段引用,各附 progress.md / `analysis-*.md` 的具體段落位置 |
| ② | **晉升清單為封閉七列**(3 進 4 出) | progress 有該表;四個排除項各有理由 + 證據位置;OQ-S4-4 標關閉 |
| ③ | **移植紀律 P1–P5 全數凍結** | Decision Log `D-32.2` 五條逐條列出,含「事後不得依對表結果調整」字樣 |
| ④ | **對表容差三級明文** | P3 三級(≤1e-12 / ≤1e-9 / 逐位相等)寫死,且指明哪些量歸哪一級 |
| ⑤ | SG 係數策略 + 不達標處置路徑 | Decision Log `D-32.3`;OQ-S4-21 已建立且含處置分支 |
| ⑥ | `filter_degenerate` 子集決議 | Decision Log `D-32.4`,含「其餘 flag 逐 peek 相等(非子集)」字樣 |
| ⑦ | fixture roster + sync 例外已記 | progress 有表;sync 例外附 WP-29 T0 KI-004 界線的引用 |
| ⑧ | OQ 對帳完成 | OQ-S4-21/22/23/24 各有 owner + deadline + 未決影響;stage4 §8 已同步 |
| ⑨ | **零程式碼變更** | `git diff --stat` 只含 `docs/exec-plan/active/stage4/`;`src/` 與 `research/` 零 diff |

## Commit

`docs(wp-32): T0 entry gate — 晉升清單凍結(OQ-S4-4 關閉,3 進 4 出)+ 移植紀律 P1–P5 + SG 係數策略 + filter_degenerate 子集決議`
