# WP-31 — Progress / Decision Log

> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)
> 每個 task 完成時與切片一起 stage。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md);per-WP 決策編號 `D-31.n`。

---

## Progress

| 日期 | Task | 事件 |
|---|---|---|
| 2026-08-10 | — | WP-31 規劃完成(五 task 自足檔建立)。**尚未開工**;T0 尚未執行,下方規劃期決議**尚未正式凍結**。 |

---

## Decision Log

> ⚠️ 以下 D-31.0 ~ D-31.3 為**規劃期決議**(2026-08-10,使用者拍板)。依協議 §3,它們在 **T0 落地並 commit** 時才正式進入凍結狀態;在那之前不得被下游 task 引用為既定前提。

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

---

## Open Questions

見 [README.md §7](README.md)。本 WP 相關:**OQ-S4-3**(T0 關閉)· **OQ-S4-18**(SPARC padding 階梯,T1 判定)· **OQ-S4-19**(Fitts 的 D 內生性,pilot 後)· OQ-S4-17 / OQ-S4-11 / OQ-S4-10 維持 open 且不阻塞本 WP。
