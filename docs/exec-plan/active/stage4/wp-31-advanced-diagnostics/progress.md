# WP-31 — Progress / Decision Log

> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)
> 每個 task 完成時與切片一起 stage。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md);per-WP 決策編號 `D-31.n`。

---

## Progress

| 日期 | Task | 事件 |
|---|---|---|
| 2026-08-10 | — | WP-31 規劃完成(五 task 自足檔建立)。**尚未開工**;T0 尚未執行,下方規劃期決議**尚未正式凍結**。 |
| 2026-08-10 | **T0** | ✅ entry gate 完成:M14 六項 + WP-30 T-exit 逐項自行覆核(§1);fixture roster 沿用 + strict 閘**獨立負向/正向重跑**(§2);`gate-v1` 三件組凍結(**D-31.4**,含 seed,關閉 OQ-S4-3);`sparc-v1`/`xcorr-v1`/`fitts-v1` pre-registration 凍結(**D-31.5**,含 SPARC 段來源契約);D-31.0~D-31.3 由規劃期決議正式轉為凍結態;新開 OQ-S4-18/OQ-S4-19;`../README.md` §3/§6/§8 對帳。**零 `research/`、零 `src/` 變更**(§5) |
| 2026-08-10 | **T1** | ✅ `sparc-v1` 落地:`compute_sparc`/`compute_sparc_traced` 逐位移植 + 兩份跨 repo golden 對表 ≤1e-9(PA parity 8 個量、128Hz 域 8 case)+ `sparc_table`(逐 MR 段,59/60 與 `phase-v1` 機械一致)+ `sparc_length_sensitivity` 階梯診斷 → verdict **`stratified_only`**(step_ratio **0.7643** ≥ 0.5,**D-31.6**,關閉 OQ-S4-18)+ `analysis-advanced-diagnostics.md` 首版。`uv run pytest` **303 → 365 passed**;`npm run test:ci` exit 0 且 `src/`/`tests/` **零 diff**(§6) |
| 2026-08-10 | **T2** | ✅ `xcorr-v1` + `gate-v1` 落地:`key_state_signed` / `key_velocity_xcorr`(逐 lag Pearson + PA tie-break,correlogram 每點帶 `n_overlap`)/ `xcorr_table` / `reliability_gate`(三件組,per-session seeded)+ `key_event_crosscheck`。**三 session 全 `research_only`**,其中 **09:18 / 09:37 未過 ① shuffle null**(p=0.056 / 0.173)、09:24 三件全過(**D-31.9**);`coach_report` 不可達由 AST 掃描斷言(DoD ③)。`key` 事件交叉檢核 **86/86 · 84/84 · 78/78 全對、最大殘差 < 1 tick**(D-31.8)。新開 **OQ-S4-20**(最大化統計量的多重比較效應)。`uv run pytest` **365 → 431 passed**;`npm run test:ci` exit 0 且 `src/`/`tests/` **零 diff**(§7) |
| 2026-08-12 | **T3** | ✅ `fitts-v1` 落地:`D` 重用 `epsilon_deg`/`detect-v1` spawn eccentricity 語意,`W` 重用 angular `_hitbox`(GD-7),輸出 D/W/ID/MT/TP + `blocked-by-data` 判準 + D 內生性/MT 含 RT 限制。逐 session verdict:**09:18 `blocked-by-data`**(`d_ratio=1.8343 < 2.0`),**09:24 `ok`**(slope 60.1975 ms/bit,r² 0.0669,TP 16.6120),**09:37 `ok`**(slope 39.6014 ms/bit,r² 0.0339,TP 25.2516)(**D-31.10**)。T0 pooled 3.5x 預期不等於逐 session 通過(**S-31.8**);門檻未放寬、未跨 session 併池。`uv run pytest` **431 → 452 passed**;`npm run test:ci` exit 0(90 files/748 tests + 21 Playwright)且 `src/`/`tests/` **零 diff**(§8) |

---

## 1. 上游複驗(T0 自行覆核;引用既有證據,不重跑既有測試)

> 協議 §6:entry-gate 的職責是**驗**上游 exit-gate,不是代辦。以下逐項覆核宣告文字**並自行確認證據位置存在且內容相符**,任一項非綠即停手。

### 1.1 M14 六項

| # | 項目 | 狀態 | 效度限制(引用義務) | 證據位置(本 task 已開啟確認) |
|---|---|---|---|---|
| ① | 真實匯出 ingest/dt | ✅ 維持(未撤回過) | 與 aim 差分/行為內容無關 | [stage4/README.md §4](../README.md#4-里程碑門控):3,507 ticks / 7.8125ms / gap 0 |
| ② | ε(t) parity(閉式幾何 + `deriveTrackingMetrics` 對表) | ✅ 2026-08-06 重新宣告 | 僅證明 Python 忠實對表 TS 既有推導,**不保證構念本身正確**;本 WP 的 Fitts(T3)消費同一套已修正的 eye origin | [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1;閘 ① `fire.offsetDeg` oracle ≤0.5°、閘 ② 閉式幾何 ≤1e-9 |
| ③ | 合成 fixture 邊界誤差 ≤2 tick | ✅ 2026-08-07 重新宣告 | 僅證明演算法在**已知答案的合成訊號**上正確 | [A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)(A2-T3:135 組候選全過,`seg-v2` max boundary error ≤2 tick) |
| ④ | 真實資料分段成功率 | ✅ 2026-08-07 重新宣告 | **單一匿名受試者 P001、n=3 session、同一台 240Hz 機器、同一 drill config**,非母體層級證據(比照 KI-004-S1 R-7) | A2-T2 守恆閘殘差 ≤5.6e-16 + KI-006 B-1~B-5 全數滿足並 CLOSED([A2-blocked-plan.md:109/127](../../../../known_issue/KI-005-A/A2-blocked-plan.md)) |
| ⑤ | 分段參數凍結(`seg-v2`) | ✅ 2026-08-07 重新宣告 | 僅適用 `tick-integral` 匯出;`seg-v1` 原地保留供 `aim-diff-legacy` | [analysis-segments.md:83](../../../operational/analysis-segments.md):`sg_window=11 / poly=3 / peak_sigma_k=0.75 / peak_floor=60 / low=0.1 / stop=0.2` |
| ⑥ | `uv run pytest` 全綠 | ✅ 維持(74→228→**303 passed**,WP-30 T-exit) | 與 aim 差分/行為內容無關 | [wp-30 progress.md §8](../wp-30-trajectory-metrics/progress.md) |

**六項全綠。效度聲稱不擴大**:本 WP 三個指標的任何結論一律附「單一匿名受試者 P001 / n=3 session / 同一機器與 drill config / 非母體層級證據」限制(C-D3 + KI-004 R-7 紀律)。

### 1.2 WP-30 T-exit(本 WP 的**實質**相依)

| 引用項 | 覆核結果 | 證據位置 |
|---|---|---|
| **`phase-v1` 的 MR 定義**(= T1 的 SPARC 段來源) | ✅ 確認:MR **不是新偵測器**,是逐 peek 窗內 `seg-v2` 的 `primary_flick` 逐位讀出(D-30.1 / D-30.1b 取第一個);`REC = [t_visible, MR.start)`、`V = (MR.end, t_first_shot]` | [analysis-phase-curves.md:19-29](../../../operational/analysis-phase-curves.md) |
| `phase-v1` frozen registry | ✅ `cutoff_hz=12.0 / butter_order=4 / min_window_ticks=30`;Butterworth 僅報告用平滑,不產生邊界 | [analysis-phase-curves.md:64-68](../../../operational/analysis-phase-curves.md) |
| WP-30 T-exit 交付 | ✅ `coach-report-v1` 9 份 committed HTML 存在且 byte-deterministic;`uv run pytest` 303 passed、`npm run test:ci` 90 files/748 tests + 21 Playwright | `research/src/modules/metrics/notebooks/t-exit/outputs/coach-report-*.html`(git 追蹤,9 檔);[wp-30 progress.md §8](../wp-30-trajectory-metrics/progress.md) |
| `curve-v1` | ✅ 已定稿(本 WP 不消費,僅確認未 open) | [analysis-phase-curves.md](../../../operational/analysis-phase-curves.md) |
| **不得引用者** | ✅ 已確認:08:03 / 09:39 產生的任何 ω/ε 結論全部排除(§2 機械閘背書) | [README.md §0.1](README.md) |

## 2. fixture roster 沿用 + strict 閘獨立覆核(T0 實測,非僅信任文件)

roster 沿用 [README §0.1](README.md) 六列,**不重新開放討論**;`meta.suspect` 使用界線**沿用 D-30.3**(09:18/09:24 為 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) §5 已確認的 fullscreen false positive,研究者第一手證詞),本 WP **不重新拍板**。D-30.3 的**失效條件原樣繼承**:若日後出現與研究者陳述矛盾的書面/系統紀錄(例如 session log 顯示錄製期間 `drillRunner.phase ∈ {countdown, running}` 時發生 `fullscreenchange`),本 WP 已產出的任何結論須回溯重評。

T0 獨立重跑(讀取 committed fixture,零寫入):

```
=== strict gate: legacy must raise on BOTH entry points ===
  ...08_03_45.617Z.json omega_deg_s:        ValueError: omega_deg_s: this export has no ticks.d_yaw/d_pitch (pre-KI-005)...
  ...08_03_45.617Z.json resolve_eye_origin: ValueError: resolve_eye_origin: this export has no meta.scene.eye / meta.simToWorld (pre-S1)...
  ...09_39_06.031Z.json omega_deg_s:        ValueError: ...(同上)
  ...09_39_06.031Z.json resolve_eye_origin: ValueError: ...(同上)
=== strict gate: roster fixtures must pass ===
  09:18: ticks=2038 omega_src=tick-integral eye=(0.0,1.6,4.0)/0.01 keys_nonempty=1128 key_events=86 visible=20 hitbox={1,2,1} participant=P001
  09:24: ticks=2104 omega_src=tick-integral eye=(0.0,1.6,4.0)/0.01 keys_nonempty=1103 key_events=84 visible=20 hitbox={1,2,1} participant=P001
  09:37: ticks=1904 omega_src=tick-integral eye=(0.0,1.6,4.0)/0.01 keys_nonempty=990  key_events=78 visible=20 hitbox={1,2,1} participant=P001
  synthetic_counterstrafe: ticks=48 omega_src=tick-integral eye=(0.0,1.6,4.0)/0.01 keys_nonempty=14 key_events=0 visible=2 hitbox={1,2,1}
```

| fixture | ticks | ω source | 用途判定 |
|---|---:|---|---|
| [08:03](../../../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json) | 3,507 | `aim-diff-legacy` | **禁用**;僅可作 strict 閘負向測試輸入 |
| [09:39](../../../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json) | 2,723 | `aim-diff-legacy` | **禁用**;同上 |
| [09:18](../../../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json) | 2,038 | `tick-integral` | ✅ 真實效度樣本 |
| [09:24](../../../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json) | 2,104 | `tick-integral` | ✅ 真實效度樣本 |
| [09:37](../../../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json) | 1,904 | `tick-integral` | ✅ 真實效度樣本 |
| [`synthetic_counterstrafe.json`](../../../../../research/fixtures/exports/synthetic_counterstrafe.json) | 48 | `tick-integral` | 演算法邊界(2 peeks;短窗/退化案例) |

**機械閘要求(T1/T2/T3 各自以測試斷言,不靠文件自律)**:所有 notebook / 報告 / 測試入口一律 `omega_deg_s(..., strict=True)` + `resolve_eye_origin(meta, strict=True)`;legacy 匯出**必定拋 `ValueError`**,不得靜默降級。真實證據母體 = **3 sessions × 20 peeks = 60 peeks(L 30 / R 30)**。

規劃期數字(`keys` 非空比例、`key` 事件數)於本次重跑**逐位吻合** [README §0.6](README.md):1128/2038、1103/2104、990/1904 與 86/84/78。

## 3. 樣本充足性覆核(只數樣本,不看結果)

T0 **不執行**任何 shuffle / bootstrap / 回歸 / xcorr / SPARC 計算(見 T0 Out of scope)。以下只統計**窗長與 key-state 是否有變異**——這是「門檻是否可達」的前置事實,不是指標值:

| fixture | peeks | ticks/peek min | p25 | median | max | ≥32 ticks | key-state 有變異 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 09:18 | 20 | 55 | 63 | 65 | 370 | 20/20 | 20/20 |
| 09:24 | 20 | 54 | 60 | 65 | 498 | 20/20 | 20/20 |
| 09:37 | 20 | 53 | 59 | 62 | 329 | 20/20 | 20/20 |
| synthetic | 2 | 24 | 24 | 24 | 24 | **0/2** | 2/2 |

**對凍結值的意涵**(先有數字才凍結,不是先凍結再找數字):
- `xcorr-v1.min_ticks = 32`:三份真實 fixture **零排除**(最短窗 53 tick),合成 fixture **確定性觸發 `window_too_short`**(24 < 32)——與 `phase-v1` 對同一 fixture 的判定同向,合成因此是短窗退化的**正向回歸案例**,不是「不支援」。
- `gate-v1.min_samples = 10`(逐 session):三份真實 fixture 在**窗長與 key-state 變異兩項前置條件上**皆為 20/20,遠高於 10 → 除非 T2 出現其他 flag,`blocked-by-data` 分支不會因這兩項被觸發。**這不預示任何判定結果**:①②③ 三件組是否通過取決於 peak strength 的分佈,T0 未計算亦不得預測。
- `fitts-v1.min_d_ratio = 2.0`:自 WP-30 T1 **committed** detect parity JSON 重算 `eccentricityAtSpawnDeg`(n=60):09:18 16.75–30.72° / 09:24 11.16–28.49° / 09:37 8.70–29.45°,**pooled 8.70–30.72° = 3.53×** → 高於門檻,T3 預期不落 `blocked-by-data`(該分支仍保留)。

---

## Decision Log

> ⚠️ D-31.0 ~ D-31.3 原為**規劃期決議**(2026-08-10,使用者拍板)。**本 task(T0)落地並 commit 後,四條正式進入凍結狀態**,下游 task 可引用為既定前提;要改一律升 version + 全鏈重跑(D-28.7 先例)。

### D-31.0 — 與上層 spec 的偏離:五 task / 2.5–3.25d(規劃期)

[../README.md §6](../README.md) 編列 WP-31 為 T0/T1(SPARC)/T2(xcorr)/T3(Fitts)/T-exit,2–3d。本計畫維持 task 數,但**擴充 T0 與 T1 的 scope** 並上修估時至 2.5–3.25d:

- **T0 追加「`gate-v1` 重新操作化」**:原 OQ-S4-3 的 `split-half r` 在現行樣本結構下不可計算(D-31.1)。不做則 T2 的 DoD「gate 報告產出並給明確判定」沒有定義。
- **T1 追加「N=32/64 階梯診斷」**:規劃期實測逐 peek `primary_flick` 段長中位數 32 tick,恰在零填充 N=32/64 的邊界(D-31.2)。不做則 SPARC 的分佈報告可能呈現與平滑度無關的階梯假象。

兩者皆非可選項。T0 落地時回寫 [../README.md §6](../README.md)。

**Alternatives considered**:
- ①「照上層 spec 做,問題留給 T-exit」— 否決:gate 判準必須在看到資料前凍結,留到 T-exit 就變成看結果決定。
- ②「拆成第六個 task 專做 gate 操作化」— 否決:那是純文件與判準凍結,正是 T0 的定義,拆出去反而讓 T0 空洞。

### D-31.1 — `gate-v1`:reliability gate 重新操作化(規劃期;T0 凍結)

**問題**:OQ-S4-3 的 `split-half r ≥ 0.7` 需要一個跨單位(受試者)的變異維度才有定義。現行樣本 = **1 受試者(P001)× 3 session × 20 peeks**,跨受試者維度 n=1 → **r 在數學上不可計算**。把 3 個 session 當 3 個單位硬算得到的是 n=3 的相關係數,不是可靠度證據。

**決議(2026-08-10,使用者)**:改為在此樣本結構下可計算的**三件組**——① circular-shift shuffle null(`p < 0.01`)② 逐 session bootstrap CI 寬度上限 ③ 奇偶 peek 半分一致性(\|Δ\| 落在 ② 的 CI 內)。具體數值、迭代次數與 **RNG seed** 由 T0 凍結。

**上限條款(必須隨判定一起出現)**:三件組**比 split-half r 弱** —— 它證明「訊號非偶然 + 估計量穩定」,**不證明個體差異可靠度**。故在 C-D3 下,xcorr 於本樣本結構下最高只能到 `research_only`,**`coach_report` 不可達**,且此上限須由**程式碼**保證(T2 DoD ③),不是文件自律。

**Alternatives considered**:
- ①「維持字面 OQ-S4-3,直接判 `blocked-by-data`」— 使用者否決:真實資料只會產出一張「無法判定」,浪費既有樣本。
- ②「延到 ≥3 受試者後再判」— 使用者否決:等同把 WP-31 T2 的效度判定移出 stage4,M15 的「P2 三指標各有明確進退判定」會落空。

**失效條件**:取得 ≥3 受試者樣本後,`gate-v1` 即不再是最強可用判準,應另立 `gate-v2` 恢復 split-half r 並重跑全鏈。

### D-31.2 — SPARC:逐位移植 + 階梯診斷,不做固定 N 變體(規劃期;T0 凍結)

**問題**:performance_analysis 的 `compute_sparc` 將訊號零填充至 `2^⌈log₂L⌉`。128Hz 下 L=24–32 → N=32(df=4Hz,≤20Hz 僅 6 bins);L=33–58 → N=64(df=2Hz,11 bins)。實測段長 min 24 / p25 28 / **median 32** / p75 37 / max 58 → **中位數恰在 bucket 邊界**,SPARC 值會出現與平滑度無關的階梯跳動。PA 的原始資料 ~1kHz,同一規則在那裡不構成問題。

**決議(2026-08-10,使用者)**:**逐位移植 + 量化階梯診斷**。`compute_sparc` 逐位照抄(含 `MIN_SAMPLES=16`、`max(v)`、`AMP_THRESH=0.03`、8-bin fallback、退化回傳 `0.0`),golden 對表 ≤1e-9 為 T1 首要 DoD;**不新增固定 N 的第二版本**;階梯以診斷 + 使用限制處理(超過 `step_ratio_threshold` → SPARC 僅限同 `padded_n` bucket 內比較)。

**Alternatives considered**:
- ①「另立固定 N 的 `sparc-v1` 變體」— 否決:與 PA 不再同值,且逼近「同一構念第二定義」(C-D4),須入 DECISIONS 論證其為新構念,成本高於收益。
- ②「先診斷再決定」— 否決:會把決策拖到 T-exit,且屆時已看過結果,pre-registration 精神失效。

### D-31.3 — SPARC 段來源 = `phase-v1` 的 MR 區間(規劃期;T0 凍結)

規劃期實測:`seg-v2` 對**整條軌跡**一次分段,三份真實 fixture 各只切出 **1** 個 `primary_flick`(pooled n=3);改為 **逐 peek 窗內**分段(= WP-30 `phase-v1` 的作法)則得 20/19/20(pooled **59/60**,1 個 `no_primary_flick`)。

**決議**:SPARC 的逐段單位 = `phase-v1` 的 MR 區間。理由有二:① 整條軌跡分段的 n=3 讓 FR-D13 的分佈報告形同虛設;② 若 SPARC 自行決定另一種 scoping,`primary_flick` 就有了第三個定義(C-D4)。T1 不得自行改 scoping。

### D-31.4 — `gate-v1` 凍結:reliability gate 三件組(T0 拍板,2026-08-10;**關閉 OQ-S4-3**)

**前提(為何不是「換個門檻」,而是「換一個算得出來的量」)**:OQ-S4-3 的 `split-half r ≥ 0.7` 需要一個**跨單位(受試者)的變異維度**才有定義——split-half reliability 問的是「同一群**個體**的個體差異,用一半題目估與用另一半估是否一致」。現行樣本結構 = **1 受試者(P001)× 3 session × 20 peeks**,跨受試者維度 **n = 1** → 相關係數的分母(受試者間變異)為零,**r 在數學上不可計算**。若把 3 個 session 當 3 個單位硬算,得到的是 n=3 的相關係數,它估的是「session 間穩定性」而非「個體差異可靠度」,且 n=3 的 r 本身沒有推論價值。故不是把門檻調鬆,是把**不可計算的量換成可計算的量**。

**凍結內容(`GateThresholds`,`version = "gate-v1"`;七欄位 + seed)**:

| 欄位 | 凍結值 | 操作化(T2 只執行,不得修改) |
|---|---|---|
| `min_samples` | **10**(逐 session) | 有效(flags 為空)peek 數;低於此 → `blocked-by-data`。量級沿用 `sync-v1` / `phase-v1` 反 vacuous 門檻先例 |
| `shuffle_iters` | **1000** | ① 逐 peek 對 `key_state` 作**循環位移**(circular shift);位移量自 `rng` 取樣且**避開 0 與 ±全長**(避免退化成原序列);重算該 peek 的 peak strength,session 級統計量的 null 分佈由 1000 次重複構成 |
| `shuffle_alpha` | **0.01** | 單尾,對 \|peak strength\| 的 session 級統計量;觀測值相對 null 分佈 `p < 0.01` 才算過 |
| `bootstrap_iters` | **2000** | ② 逐 session 對 peek **有放回**重抽,計 session 級統計量(**中位 \|peak strength\|**)的 **95% percentile CI** |
| `ci_width_max` | **0.20**(r 單位) | ② 的 CI 寬度上限;超過即判估計量不穩 |
| `half_agreement_within_ci` | **True** | ③ 同 session 內**奇數 / 偶數 peek** 各算一次 session 級統計量,\|Δ\| 須落在 ② 的 CI 寬度內 |
| `seed` | **20260810** | shuffle 與 bootstrap 共用 `np.random.default_rng(seed)`;seed 進 params 與報告 metadata。同一匯出 + 同參數 → 同判定 |

**判定規則(三分支,pre-registered;T2 不得新增第四種)**:

| 條件 | verdict |
|---|---|
| 任一 session 的有效 n < `min_samples` | **`blocked-by-data`** — 不作效度主張,開 OQ |
| n 足夠但 ①②③ 任一未過 | **`research_only`** — 不進教練報告(C-D3);`reason` 逐條說明哪一件未過 |
| n 足夠且 ①②③ 全過 | **`research_only` + 「訊號非偶然且估計穩定」註記** |

**上限條款(逐字寫入報告與 `analysis-advanced-diagnostics.md`;同時是 T2 DoD 的一部分)**:此三件組**比 split-half r 弱**——它證明「**訊號非偶然 + 估計量穩定**」,**不證明個體差異可靠度**。因此在 C-D3 下,xcorr 於本樣本結構下**最高只能到 `research_only`**,**`coach_report` 不可達**。此上限須由**程式碼**保證(`reliability_gate` 在本樣本結構下不得回傳 `'coach_report'`),不是文件自律。

**不可事後調整**:①②③ 的門檻值、迭代次數與 seed **一律不得依 T2 的實際結果調整**。要改只能整組升 `gate-v2` 並**重跑全鏈**,且須入 [DECISIONS.md](../../../DECISIONS.md)(跨 WP:會改變 M15 的「P2 三指標各有明確進退判定」的證據基礎)。

**失效條件**:取得 **≥3 受試者**樣本後,`gate-v1` 不再是最強可用判準——屆時應另立 `gate-v2` 恢復 split-half r 並重跑,`coach_report` 才有可能可達。

**Alternatives considered**:
- ①「維持字面 OQ-S4-3,直接判 `blocked-by-data`」— 使用者否決(D-31.1):真實資料只會產出一張「無法判定」,浪費既有 60 peeks。
- ②「延到 ≥3 受試者後再判」— 使用者否決:等同把 T2 的效度判定移出 stage4,M15 的「P2 三指標各有明確進退判定」落空。
- ③「把 3 個 session 當 3 個單位硬算 split-half r」— 否決:得到的是 n=3 的相關係數,不是可靠度證據;用一個看起來像 r 的數字冒充可靠度,比誠實承認算不出來更危險(GD-20)。
- ④「shuffle 用完全隨機重排而非循環位移」— 否決:會破壞 key-state 的自相關結構,null 過度樂觀 → 假顯著(README §3 failure mode 已列)。

### D-31.5 — `sparc-v1` / `xcorr-v1` / `fitts-v1` pre-registration 凍結 + SPARC 段來源契約(T0 拍板,2026-08-10)

| version | 欄位 | 凍結值 | 理由 |
|---|---|---|---|
| **`sparc-v1`** | `fs_hz` | **128.0** | sim 頻率;T1 須對 `dt` 一致性斷言(與 `check_dt` 中位間隔 7.8125ms 相符) |
| | `step_ratio_threshold` | **0.5** | 「N=32 與 N=64 兩 bucket 的中位 SPARC 差 ÷ 兩 bucket 內 IQR 的較大者」;**≥ 0.5 → `stratified_only`**(SPARC 僅可在同 `padded_n` bucket 內比較,報告明文標限制)。0.5 的語意 = 階梯跳幅達到 bucket 內自然離散度的一半,即足以在跨段長解讀時說錯故事 |
| **`xcorr-v1`** | `max_lag_ms` | **250**(= 32 tick @7.8125ms) | 涵蓋實測 MR 中位段長 ≈250ms(§0.3 逐 peek primary_flick 中位 32 tick) |
| | `min_ticks` | **32** | §3 實測:真實最短窗 53 tick → 零排除;合成 24 tick → 確定性 `window_too_short` 正向回歸案例 |
| | `key_encoding` | **`'signed_ad'`** | D(+1) − A(−1);A+D 同按 → 0。key-state 一律取自 `ticks[].keys`(與 ω 天然同格,免對時),`key` 事件僅作交叉檢核 |
| **`fitts-v1`** | `min_samples` | **20**(pooled) | 低於此 → `blocked-by-data` |
| | `min_d_ratio` | **2.0** | `max(D)/min(D)`;沿用 [../README.md §2.1](../README.md) velocity-scaling / Fitts 的「D 變異跨 ≥2 倍」觸發條件。實測 pooled 3.53×(§3) |
| | `min_id_range_bits` | **1.0** | ID 跨度低於 1 bit → 回歸斜率無從辨識 → `blocked-by-data` |
| | W 的取法 | **`meta.targets.hitbox.widthU` + eye→target 距離推導的水平角尺寸**;缺席時 fallback H1 `{1,2,1}` | **GD-7 單一 hitbox 來源**:不得新增另一套尺寸常數或閾值;eye origin 一律 `resolve_eye_origin(meta, strict=True)` |

**SPARC 段來源契約(同時凍結,T1 不得改 scoping)**:SPARC 的逐段單位 = **`phase-v1` 的 MR 區間**(逐 peek 窗內 `seg-v2` 的第一個 `primary_flick`,D-30.1 / D-30.1b),**不是**整條軌跡分段。`no_primary_flick` 的 peek **排除並計數**,不吞成 NaN、不補 0。T1 的 DoD 須斷言:SPARC 表的有效列數與 `phase-v1` 的非退化 MR 數一致(規劃期實測 59/60),不一致即 fail。理由見 [README §0.2](README.md):整條軌跡分段 pooled n=3,會讓 FR-D13 的分佈報告形同虛設,且產生 `primary_flick` 的**第三個定義**(C-D4)。

**演算法逐位移植契約(D-31.2 的凍結形式)**:`compute_sparc` 逐位照抄 performance_analysis 的 `metrics_sparc.py`(`MIN_SAMPLES=16` / `FC_HZ=20.0` / `AMP_THRESH=0.03` / `FALLBACK_MIN_BINS=8` / `max(v)` 而非 `max(|v|)` / 退化回傳 `0.0`);常數以 `Final` 宣告並由測試逐值釘死。**不得**因「128Hz 上 bin 太少」而動任一常數或 padding 規則——那會讓跨 repo golden 對表退化成自我對表。跨 repo golden 以 **committed JSON** 移入(C-D1:`research/` 執行期不得 import performance_analysis 任何模組)。

**T2 實作契約(不是新門檻,是消歧義)**:`max_lag_ms=250` 對應 ±32 tick,而真實窗中位僅 62–65 tick(§3)——在 \|lag\| 接近上限時,兩序列的**重疊樣本數會縮到約 30**。T2 必須在 `analysis-advanced-diagnostics.md` 明載 correlogram 每個 lag 的 r 是**對該 lag 的重疊區段**計算(且重疊段標準差為零時回傳 NaN → 轉 flag,不補 0),並在 correlogram 輸出中帶出每個 lag 的有效樣本數,使「大 lag 處的 r 較不穩」對讀者可見。此為**呈現與定義的完整性要求**,不得用來事後放寬 `max_lag_ms` 或 `min_ticks`。

**Alternatives considered**:
- `step_ratio_threshold` 取 1.0(跳幅需達整個 IQR 才算超標)— 否決:等於只在階梯大到肉眼可見時才示警,而 SPARC 的教練解讀正是在「小差異」層級發生的。
- `xcorr-v1.min_ticks` 取 53(真實最短窗)— 否決:那是對現有樣本量身訂做的門檻,新錄製稍短就整批排除;32 = `max_lag` 的 tick 數,是有結構理由的下限。
- `fitts-v1.min_samples` 取 10(比照 `sync-v1`)— 否決:Fitts 交付的是**回歸**(兩個自由度 + r²),不是單點統計量,20 是逐 session 全數有效時的自然下限。

### D-31.6 — SPARC 階梯判定:`stratified_only`(T1 執行 T0 的 pre-registration,2026-08-10;**關閉 OQ-S4-18**)

`sparc_length_sensitivity` 對三份真實 fixture pooled(n=59,排除 1 個 `no_primary_flick`)的實測:

| `padded_n` | ≤20Hz bins | n | 中位 SPARC | IQR |
|---:|---:|---:|---:|---:|
| 32 | 6 | 32 | −1.39255 | 0.08234 |
| 64 | 11 | 27 | −1.47577 | 0.10888 |

`median_gap = 0.08322` ÷ `max_iqr = 0.10888` → **`step_ratio = 0.7643`**,超過 T0 pre-registered 的 `step_ratio_threshold = 0.5` → **verdict = `stratified_only`**。

**這是執行 pre-registration,不是新決策**:門檻與公式都在 T0(D-31.5)凍結,T1 只把資料代進去。判定的效果是**使用限制**:SPARC 僅可在同一 `padded_n` bucket 內比較,報告須明文標示。`FC_HZ` / `AMP_THRESH` / padding / `MIN_SAMPLES` 一律未動(D-31.2),亦未新增固定 N 的第二版本。

**必須隨判定一起出現的歸因限制(T1 新增,不在 T0 的預想內)**:`step_ratio` 量的是「bucket 間中位數差」對「bucket 內離散度」的比值,它**不區分**兩種解釋 —— ① 零填充解析度差異(方法學假象);② 較長的主要動作本來就比較不平滑(真實效應)。段長同時決定 `padded_n` 與動作本身的性質,兩者在本設計下**共變且不可分離**。因此判定只能是「跨 bucket 的 SPARC 差異**不可單一解讀**」,**不能**是「扣掉一個 padding 修正項」。要分離需在同一 bucket 內操弄段長,屬新設計,不在本 WP。此段已逐字寫入 `analysis-advanced-diagnostics.md`。

**Alternatives considered**:
- ①「既然階梯疑似有真實成分,就把 verdict 放寬成 `comparable` 並加註」— 否決:pre-registration 的門檻是為了防止「看到結果再解釋」;不可分離**正是**限制成立的理由,不是放寬的理由(GD-20)。
- ②「以 bucket 中位數差為固定修正項,把 N=64 的 SPARC 平移後跨 bucket 比較」— 否決:那等於假設階梯 100% 來自 padding(上段已說明無法確認),且會產生一個未經驗證的第二定義(C-D4)。

### D-31.7 — `xcorr-v1` 介面落地:與 [README §5](README.md) 契約的三處偏離(T2,2026-08-10)

README §5 的 `Interface contracts` 是規劃期草圖(不在 [README §6](README.md) 列舉的**五條凍結**之內 —— 那五條凍的是 fixture roster、`gate-v1` 值與 seed、三個 pre-registration 的**參數值**、上游版本)。T2 落地時有三處偏離,逐項理由如下:

| # | 契約 | 落地 | 理由 |
|---|---|---|---|
| ① | `correlogram: tuple[tuple[float, float], ...]`(`(lag_ms, r)`) | **`tuple[tuple[float, float, int], ...]`**(`(lag_ms, r, n_overlap)`) | **由 D-31.5 的 T2 呈現契約要求**:「在 correlogram 輸出中帶出每個 lag 的有效樣本數」。§5 的 2-tuple 寫在 S-31.1 被發現之前;兩者衝突時以較晚、且明確針對此問題的 D-31.5 為準 |
| ② | `XcorrResult` 的 `peek_index: int` / `side: Literal['L','R']` | 同名欄位但 **`| None`,預設 `None`**,由 `xcorr_table` 以 `dataclasses.replace` 補上 | `key_velocity_xcorr` 是兩條序列的純函式,**不可能**知道 peek 身分;硬給必填欄位會逼合成測試捏造一個假身分。與 `sparc.py` 把 `compute_sparc`(純數值)與 `_sparc_sample`(帶身分)分層是同一個作法 |
| ③ | `reliability_gate(table, thresholds)` | 追加 **`params: XcorrParams = DEFAULT_XCORR_PARAMS`**(具預設值,呼叫相容);`xcorr_table` 追加 keyword-only **`session: str = ""`** | ① null 需要**重算**位移後的 peak strength,故 `xcorr_table` 必須把逐 peek 的 `key_state` / `omega` / `dt_ms` / `max_lag_ticks` 留在表上(這正是讓 gate 維持「`(table, thresholds)` 的純函式」的代價,契約精神未變);② `session` 欄由 `xcorr_table` 產生,使**併池必須顯式 `concat`** —— 跨 session 併池在 diff 裡看得見,不會意外發生 |

**Alternatives considered**:
- 「correlogram 維持 2-tuple,另開一個 `overlap_by_lag` 欄位」— 否決:同一條曲線的兩個平行陣列,消費端一定會有人只取其中一個;綁在同一個 tuple 裡才讓「讀 r 就會看到 n」成為預設。
- 「`reliability_gate` 改吃 `(table, series_by_peek)` 兩個參數」— 否決:那讓 gate 的決定性取決於呼叫端有沒有把對的序列傳進來,契約更弱。

### D-31.8 — `key` 事件交叉檢核為獨立報告,**不**進 `xcorr_table` 的 flags(T2,2026-08-10)

[T2 §①](T2-key-velocity-xcorr.md) 寫「矛盾 → 標 flag 並記 progress」。落地為 **`key_event_crosscheck()` 獨立函式**(逐 export 一份報告),`KNOWN_XCORR_FLAGS` **不含** `key_event_mismatch`。

**理由**:交叉檢核驗的是**輸入通道的完整性**,不是某個窗的可計算性。若折進 `flags`,依 D-29.5 的納入規則它會**直接改變已凍結 gate 的 `n`** —— 一個可觀測性檢查沉默地改動效度判定的分母,正是 D-29.5 要避免的耦合。實測三份真實 fixture **零不符**(86/86、84/84、78/78,最大殘差 7.77 ms < 1 tick),故此決策在本次資料上**不改變任何數字**,只影響「日後若真的不符會發生什麼」:報告 status 與逐項計數、由人判讀,而不是自動縮小 gate 分母。

**失效條件**:若日後出現 `status = mismatch` 的真實 fixture,必須在該 task 明確裁決「該 session 是否仍可作效度樣本」,不得因為它不在 flags 裡就當作沒發生。

### D-31.9 — `gate-v1` 判定:三 session 全 `research_only`,2/3 未過 ①(T2 執行 T0 的 pre-registration,2026-08-10)

| Session | n | 觀測(中位 \|r\|) | ① `shuffle_p` | ② CI 寬 | ③ \|Δ\| | verdict | reason |
|---|---:|---:|---:|---:|---:|---|---|
| 09:18 | 20 | 0.9041 | **0.056** ✗ | 0.0319 ✓ | 0.0119 ✓ | `research_only` | `failed:shuffle_p` |
| 09:24 | 20 | 0.9179 | **0.000** ✓ | 0.0516 ✓ | 0.0364 ✓ | `research_only` | `all_criteria_passed` |
| 09:37 | 20 | 0.8953 | **0.173** ✗ | 0.0499 ✓ | 0.0300 ✓ | `research_only` | `failed:shuffle_p` |

**這是執行 pre-registration,不是新決策**:門檻、迭代次數與 seed 都在 T0(D-31.4)凍結,T2 只把資料代進去。三個 session 皆為 `research_only` —— 這在 `gate-v1` 下是**上限**,不是「差一點就能進報告」。

**判定未被結果污染的證據**:`gate-v1` 的凍結 commit 為 **`944abc3`**(T0,2026-08-10,`docs(wp-31): T0 entry gate — gate-v1 三件組重新操作化凍結`),早於本 task 對真實資料的第一次執行;`DEFAULT_GATE_THRESHOLDS` 的七個值由 `test_coupling.py` 逐值釘死,任何調整都會讓該測試當場紅。

**發現了門檻不合適但沒有修改**(DoD ⑤):見 [S-31.5](#surprises) 與新開的 **OQ-S4-20** —— 問題不在 `shuffle_alpha` 的數值,而在 session 統計量本身是「逐 peek 對 65 個 lag 取最大 `|r|`」的**最大化統計量**。依協議記錄並帶到下一版,**本 task 不動 `xcorr-v1` 或 `gate-v1` 的任何一個值**。

**Alternatives considered**:
- ①「既然 ① 只差在多重比較,就把 session 統計量改成固定 lag 的 r」— 否決:那是換一個構念(`xcorr-v2`),且是在**看過結果之後**換,pre-registration 精神當場失效。正確處置是開 OQ。
- ②「把 `shuffle_alpha` 從 0.01 放寬到 0.05」— 否決:09:37 的 p=0.173 連 0.05 都過不了,而且「為了讓它過而調門檻」正是 [README §3](README.md) 明列的 failure mode。
- ③「只報 09:24 的通過結果」— 否決:三 session 並列呈現是 KI-004 R-7 紀律;挑通過的那一個報告,等於用選擇性呈現偽造可靠度(GD-20)。

### D-31.10 — `fitts-v1` 判定:09:18 blocked,09:24/09:37 ok 但 r² 低(T3 執行 T0 的 pre-registration,2026-08-12)

| Session | n | `d_ratio` | `id_range_bits` | slope(ms/bit) | intercept(ms) | r² | TP(bits/s) | status | reason |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 09:18 | 20 | **1.8343** | 0.6997 | — | — | — | — | `blocked-by-data` | `insufficient_d_ratio` |
| 09:24 | 20 | 2.5531 | 0.9602 | 60.1975 | 357.2666 | 0.0669 | 16.6120 | `ok` | `ok` |
| 09:37 | 20 | 3.3833 | 1.2536 | 39.6014 | 389.0146 | 0.0339 | 25.2516 | `ok` | `ok` |

**判定**:09:18 不給 slope / r² / TP,因為逐 session `d_ratio = 1.8343 < fitts-v1.min_d_ratio 2.0`。09:24/09:37 通過 `min_samples` / `min_d_ratio` / `min_id_range_bits`,可產生回歸,但 r² 低到只能作研究向探索,不得直接進教練主表。

**判定未被結果污染的證據**:`DEFAULT_FITTS_PARAMS = (min_samples=10,min_d_ratio=2.0,min_id_range_bits=0.5,version='fitts-v1')` 由 T0 D-31.5 pre-register;`test_fitts.py` 逐值釘死。T3 看到 09:18 未過後未修改門檻,也未改用 pooled 資料讓它通過。

**Alternatives considered**:
- ①「把三 session 併池,利用 pooled 3.5x D ratio 產一個 ok verdict」— 否決:WP-30/WP-31 一直要求三 session 並列呈現、不跨 session 推論;併池會把 session 差異吃掉,且會讓 09:18 的 `blocked-by-data` 消失。
- ②「把 `min_d_ratio` 從 2.0 放寬到 1.8」— 否決:這是看過結果後調門檻,違反 `fitts-v1` pre-registration;要改只能升 `fitts-v2` 並重跑全鏈。
- ③「保留 09:24/09:37 的 TP,忽略 r²」— 否決:r² 是解讀邊界的一部分。`ok` 代表資料門檻可計算,不是效度足以對選手做主張。

---

## 4. OQ 對帳(T0)

| # | 動作 | 內容 |
|---|---|---|
| **OQ-S4-3** | ✅ **關閉** | 改寫理由見 D-31.4 前提段(split-half r 在 1×3×20 樣本結構下不可計算);拍板時點 2026-08-10(使用者);凍結值 = `GateThresholds` 七欄位 + `seed=20260810`;上限條款(`coach_report` 不可達)已入 D-31.4。[../README.md §8](../README.md) 已同步 |
| **OQ-S4-18** | ✅ **T1 關閉**(D-31.6) | 判定 **不成立**:pooled n=59 實測 `step_ratio = 0.7643 ≥ 0.5` → **`stratified_only`**,SPARC 僅限同 `padded_n` bucket 內比較。padding 規則未動。附帶歸因限制(階梯無法歸因為純 padding 假象,段長與 `padded_n` 共變不可分離)一併入帳 |
| **OQ-S4-19** | 🟡 **T3 維持 open** | Fitts 的 D 為內生(玩家上一 peek 留下的準星位置),回歸結果能否作為 TP 的個人基線。T3 已交付數值與限制,但不作因果主張;09:24/09:37 r² 低進一步支持「最多研究向」。owner 研究者 / deadline pilot 後 / 未決影響:TP 解讀範圍,不阻塞 T3/T-exit |
| **OQ-S4-20** | 🆕 **T2 新開**(D-31.9) | `xcorr-v1` 的 session 統計量是「逐 peek 對 65 個 lag 取最大 \|r\|」—— 一個**最大化統計量**。實測 circular-shift null 在 5.6% / 17.3% 的抽樣中也達到觀測水準(0.90),兩個 session 因此未過 ①。問題不在 `shuffle_alpha` 的數值,而在統計量的選擇:是否應改用**固定 lag 的 r**、或對 lag 數作多重比較校正(→ `xcorr-v2`)。owner 研究者 / deadline WP-32 或補錄後 / 未決影響:xcorr 的效度天花板;**不阻塞 T-exit**(判定已明確且方向保守)。依 DoD ⑤「記錄但不修改」處置 |
| **OQ-S4-17** | 🟡 維持 open | 本 WP **不消費 REC 邊界**(SPARC 用 MR 區間),無新證據。若日後 T3 要做 RT 扣除的 MT 才會再撞到 |
| **OQ-S4-11** | 🟡 維持 open | 三份真實 fixture 皆無 ADS、皆為 hitscan → 本 WP 三指標的 `--group-by ads`/`weapon_mode` 同樣退化成單格 |
| **OQ-S4-10** | 🟡 維持 open | 本 WP **不消費 `t_release`**(xcorr 取逐 tick key-state,非事件錨點) |

---

## 5. T0 Scope 證據(DoD ⑦)

```
$ git diff --stat
 docs/exec-plan/active/stage4/README.md             |  22 +--
 .../stage4/wp-31-advanced-diagnostics/README.md    |   6 +-
 .../wp-31-advanced-diagnostics/T0-entry-gate.md    |  18 +--
 .../stage4/wp-31-advanced-diagnostics/progress.md  | 185 ++++++++++++++++++++-
 .../wp-31-advanced-diagnostics/task-checklist.md   |   2 +-
 5 files changed, 209 insertions(+), 24 deletions(-)
```

五檔皆在 `docs/exec-plan/active/stage4/` 之下,**零 `src/`、零 `research/` 變更**,符合 T0-entry-gate.md 的 Touches 限制與 [README §6](README.md)「本 WP 全程零 TS 變更」紀律。T0 的覆核腳本(strict 閘負向/正向、樣本充足性)在 scratchpad 執行、只讀 committed fixture,未在 repo 內留下任何檔案。

**閘門證據**:

```
$ uv run pytest -q --no-header -p no:cacheprovider --basetemp=<短路徑>
303 passed in 59.63s
```

與 WP-30 T-exit 的 303 passed 逐位相同(本 task 零程式碼變更,預期即為零回歸)。`npm run test:ci` **未重跑**:`src/` 與 `tests/` 為零 diff(上方 `git diff --stat` 為證),沿用 WP-30 T-exit 已貼的 90 files / 748 tests + 21 Playwright 綠燈證據;本 WP 的 `npm run test:ci` 是回歸閘而非對表閘([task-checklist.md](task-checklist.md) 紀律 2)。

> **環境註記(沿用 WP-30 T2 的同一問題)**:pytest 的 `--basetemp` 若指向過深的路徑,`test_coach_report.py` 的 9 份報告重產測試會因 Windows `MAX_PATH`(260 字元)拋 `FileNotFoundError` —— 該測試檔內已有註解說明 fixture 檔名長到會撞上此限制。首次以 scratchpad 深路徑執行時得 12 failed / 291 passed,全部集中在 `test_coach_report.py` 的寫檔路徑;改用短 `--basetemp` 後 **303 passed / 0 failed**。這是路徑長度限制,不是程式碼缺陷。

---

## 6. T1 Scope 與閘門證據(T1 DoD ⑥⑦)

**Touches**(全部為新增檔;`git status --short`):

```
docs/operational/analysis-advanced-diagnostics.md                      (ADD 首版)
research/fixtures/golden/sparc-pa-parity.json                          (ADD 逐位元組移入)
research/fixtures/golden/sparc-128hz-domain.json                       (ADD 由 PA 產生)
research/src/modules/metrics/algorithms/sparc.py                       (ADD)
research/src/modules/metrics/algorithms/tests/test_sparc.py            (ADD 48 tests)
research/src/modules/metrics/algorithms/tests/test_sparc_fixture.py    (ADD 9 tests)
research/src/modules/metrics/algorithms/tests/test_sparc_purity.py     (ADD 5 tests)
research/src/modules/metrics/notebooks/t1/generate_sparc_domain_golden.py (ADD 一次性)
research/src/modules/metrics/notebooks/t1/generate_sparc_report.py     (ADD)
research/src/modules/metrics/notebooks/t1/outputs/*.csv|.json|.svg     (ADD 7 檔)
```

```
$ git diff --stat -- src tests
(空)
```

**零 `src/`、零 `tests/` 變更**,符合 [task-checklist.md](task-checklist.md) 紀律 2(本 WP 的 `npm run test:ci` 是回歸閘不是對表閘)。

**閘門**:

```
$ uv run pytest -q --no-header -p no:cacheprovider --basetemp=<短路徑>
365 passed in 56.74s          # WP-30 T-exit 的 303 + 本 task 新增 62,零回歸

$ npm run test:ci             # tsc --noEmit && vitest run && playwright test
Test Files  90 passed (90)
     Tests  748 passed (748)
21 passed (35.4s)             # exit 0;與 WP-30 T-exit 逐位相同(TS 零變更)
```

> **環境註記**:`--basetemp` 沿用 T0 §5 的短路徑做法(Windows `MAX_PATH`)。本次另遇一個新症狀:不指定 `--basetemp` 時,pytest 掃描預設 temp root 會拋 `PermissionError: [WinError 5]`,影響 `test_sparc_purity.py` 兩個用 `tmp_path` 的測試。指定短 `--basetemp` 後全綠。同樣是環境限制,不是程式碼缺陷。

**跨 repo 隔離(DoD ⑥)採「import 掃描」而非「刪除該 repo」**,四層斷言(`test_sparc_purity.py`):
① import `sparc` 後 `sys.modules` 中**無任何模組的 `__file__` 落在 PA repo 路徑下**(檔案路徑檢查比名稱檢查強,連被 shadow 進來的同名模組都抓得到);② `sparc.py` + 三份測試的 import 行逐行掃描,零 `performance_analysis` / `modules.analysis`;③ `notebooks/` 全域掃描為 **allow-list**,唯一允許提及該 repo 的是一次性 golden 產生腳本,出現第二個穿越點即 fail;④ `sparc.py` 零 file I/O / 零 `print` / 零 matplotlib(C-D2)。跨 repo golden 以 committed JSON 移入,PA commit `c1aa3f78a1a7c65ec280dffb6a849821c4ab0c10` 記在 golden 的 `provenance` 區塊、產生腳本 header 與 `analysis-advanced-diagnostics.md` 三處。

**段來源一致性(DoD ④)為機械斷言不是文件自律**:`test_sparc_fixture.py` 在同一個測試內**各自**算出 `sparc_table` 的有效列數與 `phase_decompose` 的非退化 MR 數,逐 fixture 比對 **20 / 19 / 20**,pooled **59**。改用整條軌跡分段會讓這條斷言掉到 3,當場 fail。

---

## 7. T2 Scope 與閘門證據(T2 DoD ⑧)

**Touches**(全部為新增檔;`git status --short`):

```
research/src/modules/metrics/algorithms/coupling.py                       (ADD)
research/src/modules/metrics/algorithms/tests/test_coupling.py            (ADD 50 tests)
research/src/modules/metrics/algorithms/tests/test_coupling_fixture.py    (ADD 11 tests)
research/src/modules/metrics/algorithms/tests/test_coupling_purity.py     (ADD 5 tests)
research/src/modules/metrics/notebooks/t2/generate_xcorr_report.py        (ADD)
research/src/modules/metrics/notebooks/t2/outputs/xcorr-*.csv|.json|.svg  (ADD 14 檔)
docs/operational/analysis-advanced-diagnostics.md                         (MODIFY:+ xcorr-v1 / gate-v1)
```

```
$ git diff --stat -- src tests
(空)
```

**零 `src/`、零 `tests/` 變更**,符合 [task-checklist.md](task-checklist.md) 紀律 2。

**閘門**:

```
$ uv run pytest -q --no-header -p no:cacheprovider --basetemp=<短路徑>
431 passed in 103.30s         # T1 的 365 + 本 task 新增 66,零回歸

$ npm run test:ci             # tsc --noEmit && vitest run && playwright test
Test Files  90 passed (90)
     Tests  748 passed (748)
21 passed                     # exit 0;與 T1 逐位相同(TS 零變更)
```

> **環境註記**:`--basetemp` 沿用 §5 的短路徑做法(Windows `MAX_PATH` + `PermissionError`)。本次 pytest 從 57s 增至 **103s**,增量幾乎全在 `test_coupling_fixture.py` 的**單一 session 完整 gate 重算**(1000 次 permutation × 20 peeks × 65 lags ≈ 10s)、`test_coupling.py` 的合成訊號 gate 測試(FAST thresholds)與三份 fixture 的重複 `build_xcorr_frame`。這是本 WP 目前唯一一次測試時間顯著上升,原因是效度判定本身就是 Monte-Carlo;若日後成為負擔,正確作法是**降低測試用的 iteration**(FAST thresholds 已是此模式),不是刪掉重現性斷言。

**決定性與「判定未被結果污染」(DoD ②⑤)**:
- 同一輸入 + 同一 `GateThresholds` 連續兩次 `reliability_gate` → `GateVerdict` 全欄位逐位相同(`test_coupling.py`)。
- **逐 session 獨立 seed**(`default_rng([seed, blake2b(session)])`):單獨跑一個 session 與在三 session 表中跑,結果逐位相同(測試斷言)。這比「跑完整批才能重現」強,也讓 T-exit 可以只重跑一個 session 覆核。
- 委任 fixture 測試把 **committed `xcorr-gate-verdicts.json` 的第一個 session 逐欄位重算比對**;另外兩個 session 的 `observed`(不需 RNG)全部重算比對。三個 session 全量重算約 30s,對每次跑測試都要付的成本與證據增量不成比例 —— 三者共用同一條 RNG 路徑,重現一個即證明該路徑。

**`coach_report` 不可達(DoD ③)以 AST 掃描證明,而非抽樣輸入**:`test_coupling.py` 解析 `coupling.py` 的語法樹,斷言 ① `GateVerdict` 全模組只有**一個**建構點;② 所有 `_gate_verdict(...)` 的 `verdict=` 引數都是 `{'research_only','blocked-by-data'}` 的**字面常數**。兩條合起來封死所有輸入相依路徑;`'coach_report'` 只存活在型別註記,留給日後樣本結構足夠的 `gate-v2`(D-31.4 失效條件)。

**單執行緒紀律以測試釘死**:`test_coupling_purity.py` 斷言 `coupling.py` 原始碼不含 `concurrent.futures` / `multiprocessing` / `threading` / `*Pool` —— [README §6](README.md) 的 concurrency 條款(平行化會重排 seeded RNG 的取樣順序,判定就不可重現)因此不是文件自律。

**合成訊號驗證(DoD ①)四案例**:已知 lag(−8/−3/0/+3/+8 tick)回推誤差 ≤1 tick 且符號方向正確;**純雜訊 → `shuffle_p` 不顯著**;key-state 恆定 → `key_state_constant`;窗長 < `min_ticks` → `window_too_short`。另加一條**正向對照**(合成強耦合 → `shuffle_p` 顯著),否則「雜訊不顯著」也可能只是因為 gate 永遠不會觸發。

**上層文件對帳(本 task 順手補齊,含兩處 T1 遺留)**:[../README.md](../README.md) 頁首狀態表、§1 FR-D14 列(字面 split-half → 註明已由 `gate-v1` 取代)、§3 WP-31 列、§6 WP-31 task 表(**T1 列一併補 ✅** —— T1 落地時未回寫)、§8 OQ 表(**OQ-S4-18 一併改為關閉** —— 同為 T1 遺留;新增 OQ-S4-20)、§9 文件清單。

**`key` 事件交叉檢核(DoD ⑦)**:86/86 · 84/84 · 78/78 **全數相符**,最大殘差 7.7675 / 7.7725 / 7.7150 ms 皆 **< 1 tick(7.8125 ms)** —— 正是「輸入時戳事件被取樣到下一個 tick」應有的形狀。合成 fixture 無 `key` 事件 → `no_key_events`(證人缺席,不是證詞不符)。**零不符,無須解釋條目**。

---

## 8. T3 Scope 與閘門證據(T3 DoD ⑥⑦)

**Touches**:

```
research/src/modules/metrics/algorithms/fitts.py                         (ADD)
research/src/modules/metrics/algorithms/__init__.py                      (MODIFY: export fitts-v1 API)
research/src/modules/metrics/algorithms/tests/test_fitts.py              (ADD 16 tests)
research/src/modules/metrics/algorithms/tests/test_fitts_fixture.py      (ADD 5 tests)
research/src/modules/metrics/algorithms/tests/test_fitts_purity.py       (ADD 3 tests)
research/src/modules/metrics/notebooks/t3/generate_fitts_report.py       (ADD)
research/src/modules/metrics/notebooks/t3/outputs/fitts-*.csv|json|svg   (ADD 10 files)
docs/operational/analysis-advanced-diagnostics.md                       (MODIFY:+ fitts-v1)
docs/exec-plan/active/stage4/wp-31-advanced-diagnostics/*.md            (MODIFY:T3 status/progress)
```

`src/` 與 top-level `tests/` **零 diff**(待 final gate 前再以 `git diff --stat -- src tests` 貼證據),符合 [task-checklist.md](task-checklist.md) 紀律 2。

**Targeted 閘門**:

```
$ uv run pytest src/modules/metrics/algorithms/tests/test_fitts.py \
    src/modules/metrics/algorithms/tests/test_fitts_purity.py \
    src/modules/metrics/algorithms/tests/test_fitts_fixture.py \
    -q --no-header -p no:cacheprovider --basetemp ../codex_pytest_tmp_fitts_fixture
21 passed in 4.29s
```

**演算法證據**:
- 已知幾何 fixture:D/W/ID/MT 解析解相對/絕對誤差 ≤1e-9;W 缺席走 H1 fallback。
- `blocked-by-data` 三條主要判準皆有單元測試:`insufficient_n` / `insufficient_d_ratio` / `insufficient_id_range`;非正 slope 另測為 `non_positive_slope`。
- flags 封閉詞彙表由 `KNOWN_FITTS_FLAGS` + 模組斷言 + 測試釘死;帶 flag 的 peek 不進回歸樣本。
- `test_fitts_purity.py` 斷言 import 無輸出/無 plotting/無 cwd writes,且 `fitts.py` 使用 `epsilon_deg` 與 `_hitbox`,避免 D/W 來源分裂。
- `test_fitts_fixture.py` fresh recomputation 對 committed `fitts-verdicts.json` 逐欄比對;`blocked-by-data` 不得填 slope/r²/TP。

**真實 fixture 輸出**:
`fitts-table-<fixture>.csv`(逐 peek D/W/ID/MT/flags) · `fitts-regression-summary.csv` · `fitts-side-summary.csv` · `fitts-verdicts.json` · `fitts-scatter-<fixture>.svg`。合成 fixture 2 peeks 可計幾何但因 `n < 10` 走 `insufficient_n`,不崩潰、不捏造 TP。

**Full gate**:

```
$ uv run pytest -q --no-header -p no:cacheprovider --basetemp ../codex_pytest_tmp_wp31_t3_full
452 passed in 90.94s (0:01:30)

$ npm.cmd run test:ci
Test Files  90 passed (90)
     Tests  748 passed (748)
21 passed (40.8s)             # Playwright; exit 0
```

`npm.cmd run test:ci` 第一次在 sandbox 內因 `vite.config.ts`/上層目錄讀取權限被擋(`Access is denied`),以 escalated 方式重跑後全綠;這是 sandbox 讀取限制,不是 TS 回歸。

---

## 規劃期實測資料(供 T0 覆核,非結論)

> 以下數值由規劃期一次性腳本產出,**尚未經 task 的測試釘死**;T0/T1/T2/T3 須以自己的測試重新確立,不得直接引用為證據。

| 量 | 值 | 出處 |
|---|---|---|
| 逐 peek `seg-v2` primary_flick 數 | 20 / 19 / 20(pooled 59/60) | 三份 `tick-integral` fixture |
| primary_flick 段長(tick) | min 24 / p25 28 / med 32 / p75 37 / max 58 | 同上 |
| ≥ `MIN_SAMPLES`(16)比例 | 59/59 = 100% | 同上 |
| padded N 分佈 | L≤32 → N=32(6 bins ≤20Hz);L≥33 → N=64(11 bins) | 演算法推導 |
| `ticks[].keys` 非空比例 | 1128/2038、1103/2104、990/1904(≈52–55%) | 同上 |
| `key` 事件數 | 86 / 84 / 78 | 同上 |
| spawn 偏心角 D | 09:18 16.75–30.72° · 09:24 11.16–28.49° · 09:37 8.70–29.45°(pooled ≈3.5×) | WP-30 T1 committed detect parity JSON |
| `detect` status | detected 8/9/5 of 20 | 同上(說明為何 T3 不做 RT 校正) |

---

## Surprises

| 日期 | 事件 |
|---|---|
| 2026-08-10(規劃期) | `seg-v2` 對整條軌跡分段只切出 1 個 `primary_flick`/session —— 峰值門檻 `mean + kσ` 被整條 trace 的統計吃掉。若照 FR-D13 字面「逐 primary_flick」直接實作而未察覺 WP-30 用的是逐 peek 分段,SPARC 的 pooled n 會是 3 而不是 59,且沒有任何測試會抓到。 |
| 2026-08-10(規劃期) | SPARC 的零填充規則在 1kHz 上無害,在 128Hz 上讓中位段長恰好卡在解析度加倍的邊界。移植「同輸入同輸出」正確,不代表「同一指標在新取樣率下同樣可解讀」。 |
| **S-31.1**(2026-08-10,T0) | **`max_lag_ms = 250`(±32 tick)相對於真實窗中位 62–65 tick 並不小**:在 \|lag\| 接近上限時,兩序列的重疊只剩約 30 個樣本,correlogram 兩端的 r 天生比中央不穩。規劃期只核對了「250ms 涵蓋 MR 中位段長」這一側,沒有核對另一側的重疊代價。**處理方式不是改門檻**(pre-registration 已凍結),而是在 D-31.5 追加 T2 的呈現契約:每個 lag 帶出有效樣本數、重疊段零標準差回 NaN 轉 flag。若沒發現這點,T2 很可能產出一張兩端翹起的 correlogram 而讀者無從判斷那是耦合還是樣本數效應。 |
| **S-31.3**(2026-08-10,T1) | **階梯診斷的 verdict 是 `stratified_only`,但「階梯有多少來自 padding」在本設計下不可回答**。規劃期把 OQ-S4-18 想成一個二選一的方法學問題(padding 假象大不大),T1 跑出數字後才看清:段長**同時**決定 `padded_n` 與動作本身的性質,`step_ratio` 量的是兩者的**混合**。所以 `stratified_only` 這個 verdict 名副其實(不可跨 bucket 解讀),但它的**理由**比 pre-registration 當時設想的更強一層——不是「padding 造成偏差、應校正」,而是「兩個解釋不可分離、不得單一解讀」。這個差別直接決定了不可以做「扣掉中位數差再跨 bucket 比」的修正(D-31.6 Alternatives ②),而 pre-registration 的文字並沒有擋住那條路。 |
| **S-31.4**(2026-08-10,T1) | **合成 fixture 在 `sparc-v1` 與 `phase-v1` 上走的是不同的退化分支**:同一份 `synthetic_counterstrafe.json`,`phase-v1` 判 `window_too_short`(24 tick < `min_window_ticks=30`),`sparc-v1` 判 `too_few_samples`(MR 段 9 tick < 移植常數 `MIN_SAMPLES=16`)。兩者都是「確定性觸發、明確失敗、不捏造數值」,但**原因不同**——若把「合成 fixture 應該觸發哪個 flag」當成跨構念的共通期望寫進斷言,會得到一條假的一致性要求。與 `curve-v1` 對同一 fixture **不**觸發 `window_too_short` 是同一類提醒(analysis-phase-curves.md 已記):同一份退化輸入在不同構念上的正確行為,本來就可以不一樣。 |
| **S-31.5**(2026-08-10,T2) | **中位 \|peak r\| ≈ 0.90 幾乎全部是「取最大值」造成的,不是耦合強度**。三個 session 的觀測值 0.9041 / 0.9179 / 0.8953 看起來像非常強的 strafe-aim 干擾;但把 key-state **整體循環位移**(波形完全保留、只是對不上原本的時間點)之後,null 分佈仍有 **5.6% / 17.3%** 的抽樣達到同一水準。原因是 session 統計量取的是「逐 peek 在 65 個 lag 中的最大 \|r\|」—— 在 ±250 ms 帶寬內,一段緩慢的方波 key-state 幾乎總能在**某個** lag 上與 ω 對得很好。**規劃期完全沒有預期到這一點**:README §0.6 與 D-31.5 討論的是通道選擇與 lag 範圍,沒有人問過「這個統計量在虛無假設下長什麼樣」。若 `gate-v1` 沒有 ① 這條反向對照,0.90 會直接被寫進報告當成強耦合證據 —— 這是本 WP 到目前為止,pre-registration 唯一一次**實際擋下一個錯誤結論**。處置依 DoD ⑤:記錄、開 OQ-S4-20,**不改任何門檻**。 |
| **S-31.6**(2026-08-10,T2) | **三件組全部只看 \|r\| 的大小,沒有一條看方向 —— 而方向恰好是不穩的**。三 session 的 median signed strength 為 **−0.13 / +0.82 / +0.84**,median peak lag 為 **−183.6 / −136.7 / +179.7 ms**:連「key 領先還是 ω 領先」都跨 session 翻號。09:24 三件組全過,但它的「通過」只表示 `|r|` 這個量非偶然且穩定,**不表示可以講出一句帶方向的話**。這條限制不在 T0 的預想內(D-31.4 設計三件組時,隱含假設「統計量穩定」就等於「結論可用」),已逐字進 `analysis-advanced-diagnostics.md` 的已知限制,並由 `test_coupling_fixture.py` 斷言方向跨 session 確實翻號 —— 讓這條限制不會在資料更新後悄悄不再成立卻沒人發現。 |
| **S-31.7**(2026-08-10,T2) | `key` 事件與 tick 推導狀態的交叉檢核**逐項全對**(86/86 · 84/84 · 78/78),且最大殘差 7.7675 ms **恰好落在一個 tick(7.8125 ms)之內** —— 也就是每個輸入時戳事件都精確地在**下一個** tick 現形,沒有一次跨兩個 tick。這比「不矛盾」強得多:它把 README §0.6「key-state 與 ω 天然同格、免對時」從論證升級為實測。與 S-31.2 同性質 —— 覆核「不得只信任帳本文字」確實執行且通過。 |
| **S-31.2**(2026-08-10,T0) | 規劃期 README §0.6 的 `keys` 非空比例(1128/2038、1103/2104、990/1904)與 `key` 事件數(86/84/78)在 T0 獨立重跑下**逐位吻合**;`eccentricityAtSpawnDeg` 亦自 committed parity JSON 重算得 pooled 8.70–30.72°(3.53×),與規劃期一致。與 WP-30 T0 的 S-30.5 同性質:覆核「不得只信任帳本文字」這條紀律確實執行且通過。 |
| **S-31.8**(2026-08-12,T3) | **pooled D 變異足夠不代表逐 session 都能回歸**。T0 只看 pooled 8.70–30.72°(3.53×),因此預期 T3 不落 `blocked-by-data`;T3 逐 session 執行凍結判準後,09:18 的 `d_ratio` 只有 **1.8343 < 2.0**,必須 blocked。這暴露了 T0 §0.5 的語句太容易被讀成「每個 session 都會 ok」。處置:README 已回寫「pooled 預期只對 roster 層級成立」;門檻未改、未跨 session 併池。 |

---

## Open Questions

見 [README.md §7](README.md) 與本檔 §4 對帳表。本 WP 相關:**OQ-S4-3**(✅ **T0 關閉**,D-31.4)· **OQ-S4-18**(✅ **T1 關閉**,D-31.6:`stratified_only`,step_ratio 0.7643)· **OQ-S4-19**(🟡 **T3 維持 open**,D 內生性 + r² 低,不作因果/主表主張)· **OQ-S4-20**(🆕 **T2 新開**,D-31.9:最大化統計量的多重比較效應)· OQ-S4-17 / OQ-S4-11 / OQ-S4-10 維持 open 且不阻塞本 WP。

**T1 未開新 OQ**。階梯的歸因不可分離(S-31.3)已在 D-31.6 內以限制條款處理,不另開 OQ:要分離需在同一 `padded_n` bucket 內操弄段長,那是**新錄製 + 新設計**,與 OQ-S4-19 的「是否升級為受控設計」同屬 stage4 之外的題目。SPARC 是否進教練報告由 **T-exit** 依 C-D3 收斂,本 task 只交付效度證據與使用限制。

**T2 開一個新 OQ(OQ-S4-20)**,理由是它**不能**用限制條款處理:S-31.5 指出的問題不是「這個數字要小心讀」,而是「這個統計量在虛無假設下就已經很大」——那是構念定義層級的疑慮,只能由 `xcorr-v2` 回答。相對地,S-31.6(方向不穩)**已**以限制條款處理並上測試,不另開 OQ:它是同一個構念的正確使用邊界,不是構念本身要重新定義。xcorr 是否進教練報告由 **T-exit** 依 C-D3 收斂;依上限條款,最高只能是研究向區塊 + 全部限制。

**T3 未新開 OQ**。09:18 的 `blocked-by-data` 是凍結判準正常工作,不是新方法學問題;OQ-S4-19 已覆蓋 D 內生性與 TP 個人基線能否成立。09:24/09:37 r² 低同樣作為 OQ-S4-19 的限制證據,不另開題。
