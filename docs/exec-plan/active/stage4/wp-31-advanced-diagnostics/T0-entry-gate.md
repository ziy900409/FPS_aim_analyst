# T0 — entry gate(上游複驗 + fixture roster 沿用 + `gate-v1` 重新操作化與凍結;無演算法碼)

> Part of [WP-31 advanced-diagnostics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-30 T-exit ✅(2026-08-10)+ M14 六項 ✅(2026-08-07) |
| **Risk / Cplx** | Low / Med(凍結內容的**正確性**是本 task 的全部價值) |
| **Touches** | 僅本 WP 文件(README/checklist/progress)+ [../README.md §6/§8](../README.md) 對帳;**零程式碼** |
| **狀態** | ✅ **完成(2026-08-10)** — 覆核紀錄與凍結內容見 [progress.md §1–§5](progress.md) + Decision Log **D-31.4**(`gate-v1`)/ **D-31.5**(三份 pre-registration) |

## Objective

把 WP-31 全部「事後不得改」的前提凍結成可稽核狀態。本 task 的重點不是複驗上游(那是例行),而是**把一個算不出來的 gate 換成一個算得出來、且誠實標示其弱點的 gate**——並且在看到任何真實 xcorr / SPARC / Fitts 數值**之前**完成。

## In scope

### ① 上游複驗(只引用,不重跑;但須自行覆核證據而非只信任帳本文字)

- **M14 六項**:引用 [wp-28 progress.md](../wp-28-research-foundation/progress.md) 與 [A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07);逐項記錄「可引用範圍」與**單樣本效度限制**(單一匿名受試者 P001、n=3 session、非母體層級證據)。
- **WP-30 T-exit**:引用 [wp-30 progress.md](../wp-30-trajectory-metrics/progress.md) 與 [T-exit-gate.md](../wp-30-trajectory-metrics/T-exit-gate.md)。本 WP 對 WP-30 的相依是**實質的**:T1 的 SPARC 段來源 = `phase-v1` 的 MR 區間。須明記引用的是 `phase-v1` 的哪一條(MR = 逐 peek 窗內 `seg-v2` 第一個 `primary_flick`,D-30.1 / D-30.1b)。
- **不得引用**:任何以 08:03 / 09:39 產生的 ω/ε 結論(§0.1 roster)。

### ② fixture roster 沿用 + strict 閘(不重新開放討論)

- 抄錄 [README §0.1](README.md) 六列 roster 進 progress,逐份標「✅ 真實效度樣本 / 禁用 / 演算法邊界」。
- 記錄機械閘要求:本 WP 所有 notebook 與報告入口一律 `omega_deg_s(..., strict=True)` + `resolve_eye_origin(meta, strict=True)`;legacy 匯出**必定拋錯**(T1/T2/T3 各自以測試斷言,不靠文件自律)。
- **suspect 使用界線沿用 D-30.3**(WP-30 T0 拍板):09:18/09:24 的 `meta.suspect = true` 已由 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) §5 認定為 fullscreen false positive。本 WP **不重新拍板**,只需引用 + 確認失效條件未觸發(若出現與研究者陳述矛盾的書面/系統紀錄則須重評)。

### ③ `gate-v1` 重新操作化與凍結(**本 task 最重要的產出**)

**前提**(必須逐字寫入 progress,否則後人會以為只是換了個門檻):OQ-S4-3 的 `split-half r ≥ 0.7` 需要一個**跨單位(受試者)的變異維度**才有定義。現行樣本 = 1 受試者 × 3 session × 20 peeks,跨受試者維度 n=1 → **r 在數學上不可計算**;把 3 個 session 當 3 個單位硬算得到的是 n=3 的相關係數,不是可靠度證據。

**凍結內容(`GateThresholds`,version = `gate-v1`)**:

| # | 條件 | 操作化 | 提案凍結值 |
|---|---|---|---|
| ① | shuffle / permutation null | 逐 peek 對 `key_state` 作**循環位移**(circular shift),位移量自 `rng` 取樣且避開 0 與 ±全長;重算該 peek 的 peak strength;session 級統計量的 null 分佈由 `shuffle_iters` 次重複構成 | `shuffle_iters = 1000`、`shuffle_alpha = 0.01`(單尾,對 \|peak strength\|) |
| ② | bootstrap CI | 逐 session 對 peek 有放回重抽,計 session 級統計量(中位 \|peak strength\|)的 95% percentile CI | `bootstrap_iters = 2000`、`ci_width_max = 0.20`(r 單位) |
| ③ | 奇偶半分一致性 | 同 session 內奇數 / 偶數 peek 各算一次 session 級統計量,取 \|Δ\| | `half_agreement_within_ci = True`(\|Δ\| 須落在 ② 的 CI 寬度內) |
| — | 最小樣本 | 有效(flags 為空)peek 數 | `min_samples = 10`(逐 session);低於此 → `blocked-by-data` |
| — | 決定性 | shuffle 與 bootstrap 的 RNG | `seed = 20260810`(固定;進報告 metadata) |

**判定規則(三分支,pre-registered)**:

| 條件 | verdict |
|---|---|
| 任一 session 的有效 n < `min_samples` | **`blocked-by-data`** — 不作效度主張,開 OQ |
| n 足夠但 ①②③ 任一未過 | **`research_only`** — 不進教練報告(C-D3) |
| n 足夠且 ①②③ 全過 | **`research_only` + 「訊號非偶然且估計穩定」註記** |

**上限條款(必須逐字寫入 progress 與 `analysis-advanced-diagnostics.md`)**:此三件組**比 split-half r 弱** —— 它證明「訊號非偶然 + 估計量穩定」,**不證明個體差異可靠度**。因此在 C-D3 下,xcorr 於本樣本結構下**最高只能到 `research_only`**,`coach_report` **不可達**;要升級必須先有 ≥3 受試者的樣本,屆時另立 `gate-v2` 並重跑。

### ④ `sparc-v1` / `xcorr-v1` / `fitts-v1` pre-registration

| version | 凍結項 | 提案值 |
|---|---|---|
| `sparc-v1` | `fs_hz`;**階梯跳幅門檻** `step_ratio_threshold` | `fs_hz = 128.0`;`step_ratio_threshold = 0.5`(N=32 與 N=64 兩 bucket 的中位 SPARC 差 ÷ bucket 內 IQR 的較大者;≥ 門檻 → `stratified_only`) |
| `xcorr-v1` | `max_lag_ms`、`min_ticks`、`key_encoding` | `max_lag_ms = 250`(≈32 tick,涵蓋實測 MR 中位 250ms)、`min_ticks = 32`、`key_encoding = 'signed_ad'` |
| `fitts-v1` | `min_samples`、`min_d_ratio`、`min_id_range_bits`、W 的取法 | `min_samples = 20`(pooled)、`min_d_ratio = 2.0`、`min_id_range_bits = 1.0`;**W = 目標水平角尺寸**,由 `meta.targets.hitbox.widthU` 與 eye→target 距離推導(GD-7 單一來源,缺席時 fallback H1 `{1,2,1}`) |

**同時凍結 SPARC 的段來源契約**:SPARC 逐段單位 = `phase-v1` 的 MR 區間;`no_primary_flick` 的 peek 排除並計數。此條寫入 progress 後,T1 不得自行改 scoping。

### ⑤ OQ 對帳

- **OQ-S4-3 關閉**:記錄改寫理由(§③ 前提)、拍板時點(2026-08-10,使用者)、凍結值、上限條款;同步 [../README.md §8](../README.md)。
- **新開 OQ-S4-18**(SPARC padding 階梯)與 **OQ-S4-19**(Fitts 的 D 內生性),各填 owner / deadline / 未決影響;同步 [../README.md §8](../README.md)。
- **維持 open 者記錄現況**:OQ-S4-17(本 WP 不消費 REC 邊界)、OQ-S4-11(ADS/projectile 無真實對照)、OQ-S4-10(本 WP 不消費 `t_release`)。

### ⑥ 上層 spec 回寫

- [../README.md §3](../README.md):WP-31 狀態 ⬜ → 🟡。
- [../README.md §6](../README.md):WP-31 task 表更新為本資料夾的五 task 版本 + 估時 2.5–3.25d,並註記偏離理由(D-31.0)。

## Out of scope

- 任何 `research/` 演算法碼與測試(T1 起)。
- 修改 `src/` 任何檔案(本 WP 全程零 TS 變更)。
- 調整任何上游凍結參數(`seg-v2` / `phase-v1` / `curve-v1` / `sync-v1` / `timeline-v1` / `compute-v1` / `detect-v1` / `construct-v1`)。
- 執行任何 shuffle / bootstrap / 回歸 —— 本 task **凍結判準,不看結果**。

## Steps

- [x] 覆核並記錄 M14 六項 + WP-30 T-exit 的實際證據(貼證據位置,不只寫「已通過」)。→ [progress.md §1](progress.md)
- [x] 抄錄 fixture roster 六列 + strict 閘要求 + D-30.3 suspect 界線引用(含失效條件)。→ [§2](progress.md)(含 T0 獨立重跑的負向/正向輸出)
- [x] 寫 `gate-v1` 前提段落:為何 split-half r 不可計算(含樣本結構 1×3×20)。→ D-31.4 前提段
- [x] 拍板並凍結 `GateThresholds` 七個欄位 + version + **seed**(`20260810`),寫入 Decision Log **D-31.4**,含「事後不得依結果調整,只能升 `gate-v2` 重跑全鏈」。
- [x] 寫上限條款(`coach_report` 於本樣本結構下不可達)並註明須由**程式碼**保證,是 T2 DoD 的一部分。→ D-31.4 上限條款
- [x] 拍板並凍結 `sparc-v1` / `xcorr-v1` / `fitts-v1` 的 pre-registration 值 + SPARC 段來源契約。→ **D-31.5**
- [x] OQ-S4-3 關閉;新開 OQ-S4-18 / OQ-S4-19;同步 [../README.md §8](../README.md)。→ [§4 對帳表](progress.md)
- [x] 回寫 [../README.md §3](../README.md) 狀態(⬜ → 🟡)與 [§6](../README.md) task 表 + 偏離註記(D-31.0)。

## Definition of Done

1. progress.md 含 **M14 六項 + WP-30 T-exit 的逐項覆核紀錄**,每項附證據位置(檔案 + 段落/commit),且明記單樣本效度限制的引用義務。
2. progress.md 含 **fixture roster 六列**(逐份用途判定)+ strict 閘要求 + D-30.3 引用與失效條件。
3. progress.md Decision Log 有一條 **`gate-v1` 凍結**,含:① split-half r 不可計算的理由(含樣本結構數字)② `GateThresholds` 七欄位值 + `version` + `seed` ③ 三分支判定規則 ④ **上限條款**(`coach_report` 不可達)⑤ 明文「事後不得調整,只能升版重跑」。
4. progress.md Decision Log 有一條 **`sparc-v1`/`xcorr-v1`/`fitts-v1` pre-registration**,含各參數值與 **SPARC 段來源 = `phase-v1` MR 區間**的契約句。
5. [../README.md §8](../README.md) 已同步:OQ-S4-3 標 ✅ 關閉(含改寫理由連結)、OQ-S4-18 / OQ-S4-19 已建立且各有 owner 與 deadline。
6. [../README.md §3](../README.md) WP-31 狀態為 🟡;[§6](../README.md) task 表已更新為五 task + 2.5–3.25d + 偏離註記。
7. `git diff --stat` 證據:本 task 僅動 `docs/exec-plan/active/stage4/`(**零 `src/`、零 `research/` 變更**)。

## Commit

`docs(wp-31): T0 entry gate — gate-v1 三件組重新操作化凍結(OQ-S4-3 關閉)+ sparc-v1/xcorr-v1/fitts-v1 pre-registration + fixture roster 沿用`
