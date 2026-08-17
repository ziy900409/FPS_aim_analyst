# KI-008 — `fitts-v1` 門檻偏離 pre-registration + D=0 誤擋 + xcorr 空表未標 blocked(PR #39 Codex review)

> 類型:研究效度 / pre-registration 誠信 + 演算法邏輯缺陷。
> 狀態:✅ **已修(D1 + D2 + D3,2026-08-17)**。
> 來源:[PR #39](https://github.com/ziy900409/FPS_aim_analyst/pull/39)(WP-31 advanced-diagnostics)
> `chatgpt-codex-connector[bot]` inline review 三則,已於本 repo 逐條追碼證實(非 false positive)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-008。

本 KI 涵蓋 PR #39 review 抓出的**三個獨立缺陷**,皆位於 `research/`(不觸及 `src/`):

| ID | 對應 review | 症狀 | 嚴重度 |
|---|---|---|---|
| **D1** | P1 | `fitts-v1` 的 `DEFAULT_FITTS_PARAMS` 偏離 T0 凍結的 pre-registration 值(`min_samples`/`min_id_range_bits` 各減半),使 09:24 session 被誤判 `ok` 並把回歸數字端上研究向報告 | **高**——違反 C-D3(未過構念驗證的指標不得進報告)與 T0 doc 明文的「事後不得調整」規則 |
| **D2** | P2 | `fitts_samples` 的 `d_ratio` 檢定對 `min(D) <= 0`(完全置中的 spawn)算出 `+inf`,被 `not math.isfinite(d_ratio)` 誤判為「未過關」而丟棄本來有效的 session | 中——目前三份真實 fixture 皆未觸發(無 D=0 樣本),但邏輯本身錯誤,方向為假陰性(丟棄有效資料) |
| **D3** | P2 | `coach_report._xcorr_block` 對空的 `xcorr_table`(零 peek,如無 visible events 的匯出)得到 `verdict is None`,被誤判為「未 blocked」,渲染出 `n=0` 且缺口說明謊稱「所有 P2 指標皆有輸出」 | 中——目前三份真實 fixture 皆有 peek,但既有測試 `test_export_without_visible_events_produces_a_valid_empty_report` 已實際踩過這條路徑而未斷言,是真實可達的邊界情況 |

---

## 0. 症狀與證據

### D1 — `fitts-v1` 門檻偏離凍結值

[`T0-entry-gate.md` §4](../exec-plan/active/stage4/wp-31-advanced-diagnostics/T0-entry-gate.md#L60)(D-31.5,2026-08-10 拍板)凍結:

> `fitts-v1`:`min_samples`、`min_d_ratio`、`min_id_range_bits`、W 的取法 → `min_samples = 20`(pooled)、`min_d_ratio = 2.0`、`min_id_range_bits = 1.0`

而 [`fitts.py:81`](../../research/src/modules/metrics/algorithms/fitts.py#L81)(commit `74c4069`,PR #39 head)實際寫的是:

```python
DEFAULT_FITTS_PARAMS = FittsParams(min_samples=10, min_d_ratio=2.0, min_id_range_bits=0.5)
```

`min_samples` 與 `min_id_range_bits` 皆為凍結值的**一半**。後果具體且可驗證:09:24 session 的 `id_range_bits = 0.9602` 在正確門檻(1.0)下應為 `blocked-by-data`(`insufficient_id_range`),但錯誤門檻(0.5)下判 `ok`,把 `slope=60.20 ms/bit`、`r²=0.0669`、`TP=16.61 bits/s` 端進 `coach-report-v2` 的研究向區塊(`#advanced`)。

**這不是風格問題**:T0 doc 明文「事後不得依結果調整,只能升版重跑」,而本專案硬約束 C-D3 是「寧可少一個指標,不能有一個會說錯話的指標」——本案正是後者發生的實例。

### D2 — `d_ratio` 對 D=0 樣本的誤判

[`fitts.py:234-238`](../../research/src/modules/metrics/algorithms/fitts.py#L234):

```python
d_ratio = math.inf if min_d <= 0 else max_d / min_d
...
if not math.isfinite(d_ratio) or d_ratio < params.min_d_ratio:
    return _blocked(samples, n, d_ratio, id_range_bits, "insufficient_d_ratio")
```

若某 session 有一筆完全置中的 spawn(`D=0`,對應良定義的 `ID=0`)加上至少一筆 `D>0`,`min_d<=0` 使 `d_ratio=+inf`。`math.isfinite(inf)` 為 `False`,於是這個「展幅其實是最大值」的訊號被當成「展幅不足」擋下——即使 `id_range_bits` 可能完全足夠支撐回歸。三份真實 fixture 目前無 D=0 樣本,故未觸發;但邏輯本身錯誤,且未來樣本增加、置中 spawn 出現機率上升時會反覆發生。

### D3 — 空 xcorr table 未標記為 blocked

[`coach_report.py:619`](../../research/src/report/coach_report.py#L619)(修法前):

```python
blocked = verdict is not None and verdict.verdict == "blocked-by-data"
```

`reliability_gate` 對零 session 的 table 回傳空 tuple `()`(見 [coupling.py:392-395](../../research/src/modules/metrics/algorithms/coupling.py#L392)——沒有 distinct session 可迭代)。當某 export 完全沒有 `visible` events 時(`build_peek_windows` 回傳 0 個 peek),`xcorr_table` 為空、`reliability_gate` 回傳 `()`、`verdict is None`,導致 `blocked = False`。報告因此渲染出一列 `n=0` 且無 verdict 的 xcorr metric,同時「缺口說明」區塊謊稱「本 drill 的 P2 指標皆有輸出」。

**這條路徑真實可達,且既有測試已經踩過而未斷言**:`test_export_without_visible_events_produces_a_valid_empty_report`([test_coach_report.py:346](../../research/src/report/tests/test_coach_report.py#L346))用 `make_synthetic_export` 產生零 peek 的匯出,只斷言 `peekCount==0`/`peeks==[]`/有 svg,從未檢查 `advancedDiagnostics.xcorr` 的 blocked 狀態——這正是 D3 之所以帶著綠燈測試套件一起 shipped 的原因。

---

## 1. 為何不是一行修法(D1 的額外後果)

D1 的修正不只是改兩個常數:它會**改變 09:24 session 的實際判定**(`ok` → `blocked-by-data`)。這牽連:

- `research/src/modules/metrics/notebooks/t3/outputs/` 的 committed golden 產物(`fitts-verdicts.json`、`fitts-regression-summary.csv`、`fitts-side-summary.csv`、09:24 的 scatter SVG)必須重新產生,否則 `test_committed_verdicts_match_fresh_recomputation` 會抓到不一致。
- `research/src/modules/metrics/notebooks/t-exit/outputs/` 的 committed coach report HTML(09:24 那份 + 剛好也命中 gap 文字更新的 synthetic 那份)必須重新產生。
- `docs/operational/analysis-advanced-diagnostics.md` 內載明「09:24 `ok`」的判定表、收斂表、WP-32 交接段落皆需同步更正,否則文件與程式碼、golden 產物三方不一致。
- `test_coach_report.py::test_passing_p2_diagnostics_render_in_the_research_block_with_full_annotations` 原本以 09:24 作為「三個 P2 構念皆通過」的範例 fixture;修正後只剩 09:37 通過,測試的 fixture 索引與註解需同步改。

D2、D3 各自獨立(不同檔案、不互相依賴),但因同屬 PR #39 review 且皆為 `research/` 內小範圍邏輯修正,依 [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) 的先例(D1+D2 併入同一 KI 文件)一併記錄。

---

## 2. 修法(已落地)

### D1 落地

```python
# research/src/modules/metrics/algorithms/fitts.py
DEFAULT_FITTS_PARAMS = FittsParams(min_samples=20, min_d_ratio=2.0, min_id_range_bits=1.0)
```

同步修正 `coach_report.py` 兩處寫死在人類可讀缺口文字裡的舊數值(`_FITTS_GAP_REASONS`):`insufficient_n` 的 "min_samples(10)"→"(20)"、`insufficient_id_range` 的 "min_id_range_bits(0.5)"→"(1.0)"。

### D2 落地

```python
# research/src/modules/metrics/algorithms/fitts.py::_result
if math.isfinite(d_ratio) and d_ratio < params.min_d_ratio:
    return _blocked(samples, n, d_ratio, id_range_bits, "insufficient_d_ratio")
```

只在 `d_ratio` **有限且**低於門檻時才擋;`min(D)<=0` 產生的 `+inf` 視為通過此步(展幅無上限),交由 `id_range_bits` 檢定去擋「D 完全無變異」的真正退化情形。

### D3 落地

```python
# research/src/report/coach_report.py::_xcorr_block
reason = "insufficient_n" if verdict is None else verdict.reason
blocked = verdict is None or verdict.verdict == "blocked-by-data"
...
"gapReason": reason if blocked else None,
"gapText": _gap_text(_XCORR_GAP_REASONS, reason) if blocked else None,
```

`verdict is None`(空 table,零 session 可判)與 `verdict.verdict == "blocked-by-data"` 一律視為 blocked,共用 `gate-v1` 僅有的 `insufficient_n` 缺口說明——這與「有 session 但 n 不足」時的既有措辭完全一致,語意上本就是同一件事(有效樣本數不足以判定)的兩種發生方式。

### 連帶重新產生的 golden 產物

| 產物 | 變化 |
|---|---|
| `fitts-verdicts.json` | 09:24 `status/reason` 從 `ok`/`ok` 改為 `blocked-by-data`/`insufficient_id_range`;`slope`/`intercept`/`r2`/`throughput` 從數值改為 `null` |
| `fitts-regression-summary.csv` / `fitts-side-summary.csv` | 同步反映 09:24 的新判定(all/L/R 三列) |
| `fitts-scatter-counterstrafe_ad_v1-...09_24....svg` | 標題文字 `status=ok`→`status=blocked-by-data`,不再畫紅色回歸線(散點與軸不變) |
| `coach-report-counterstrafe_ad_v1-...09_24....html` | Fitts 從 `#advanced` 研究向區塊移至 `#advanced-gaps` 缺口說明 |
| `coach-report-synthetic_counterstrafe.html` | 純文字更新(`min_samples(10)`→`(20)`,判定本身不變,原本就是 `insufficient_n`) |

---

## 3. 對既有資料與判定的影響

- **不需要重新採集**:09:18/09:24/09:37 三份真實匯出的 `ticks`/`events`/`omegaSource`/`constructPresence` 完全不受影響,D1/D2/D3 皆為下游判定邏輯的修正,不改變任何一筆原始資料。
- **09:24 的 Fitts 判定改變**:從 `ok`(r²=0.0669,低解釋力但仍呈現)改為 `blocked-by-data`(`insufficient_id_range`)。**T-exit 的整體結論不變**——WP-32 交接清單原本就是「三個構念皆不建議晉升」的空清單(C-D3 上限一致),本次修正只是讓 09:24 那一列從「呈現但低效度」變成「誠實承認資料不足」,方向更保守、更符合 C-D3。
- **09:18/09:37 判定不變**:09:18 仍為 `blocked-by-data`(`insufficient_d_ratio`,門檻本身未變);09:37 仍為 `ok`(`id_range_bits=1.2536` 高於新舊兩種門檻)。
- **SPARC / xcorr(gate-v1)判定完全不受影響**:三個 bug 皆侷限於 `fitts-v1`(D1/D2)與 xcorr 空表邊界情況(D3,目前無真實 fixture 觸發)。

## 4. Open Questions

| # | 問題 | 現況 |
|---|---|---|
| **OQ-KI8-1** | D2(D=0 誤擋)目前無真實 fixture 觸發,是否需要專門採集一份含置中 spawn 的樣本來實測驗證(而非只靠合成單元測試)? | 🟡 open——目前以 `test_zero_eccentricity_sample_does_not_spuriously_block_the_ratio_gate` 直接測 `_result` 純函式覆蓋,判定邏輯本身已驗證正確;是否值得為此特地重新設計 drill/採集,留給 WP-32 或後續 Fitts 受控設計再評估(見 analysis-advanced-diagnostics.md 的 OQ-S4-19 升級路徑討論) |
| **OQ-KI8-2** | D3 的邊界情況(零 visible events)在目前三份真實 fixture 下不可達,是否需要在未來的匯出驗證層加一條「zero-peek export 仍需通過缺口說明的內容稽核」的門檻? | 🟢 現況已足夠——`test_export_without_visible_events_produces_a_valid_empty_report` 已擴充斷言涵蓋此路徑,回歸網已補齊,暫不需要額外門檻 |
