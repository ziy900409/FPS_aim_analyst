# WP-30 — Progress / Decision Log / Surprises / Open Questions

> Spec:[README.md](README.md) · Task 索引:[task-checklist.md](task-checklist.md)
> 每個 task 完成時與切片一起 stage。Decision 編號 `D-30.n`、Surprise 編號 `S-30.n`。
> 跨 WP / 跨文件的決策入 [DECISIONS.md](../../../DECISIONS.md);修 bug 決策入 [BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md)。

## Progress

| 日期 | Task | 狀態 | 摘要 |
|---|---|---|---|
| 2026-08-07 | (規劃) | 📋 | WP-30 計畫與 task 清單建立(T0/T1/T2/T3/T-exit);規劃當下 entry blocker 未解除 |
| 2026-08-07 | (規劃) | 📋 | 使用者拍板三項規劃期決策:**D-30.1** phase 邊界複用 `seg-v2`(剩多段取法 D-30.1b 待真實資料)、**D-30.0** t_detect 獨立 task + parity 閘、**WP-30 等 A2-T4 完成後才開工** |
| 2026-08-07 | (對帳) | ✅ | [KI-005-A / A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 已落地:M14 ③④⑤ 重新宣告,KI-006 CLOSED,**entry blocker 三條理由全數解除**。WP-30 仍**未開工**——本行只更新阻塞狀態,T0 本身仍待執行(不得跳過自行覆核) |
| 2026-08-07 | **T0** | ✅ | entry gate 完成:M14 六項逐項自行覆核通過(§1 表);fixture roster 凍結 + strict 閘獨立覆核(§2);`suspect` 使用界線重立,引 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) §5 一手證詞關閉 OQ-S4-16;D-30.1b 以三份真實匯出的 segment 數分佈拍板(候選①);`phase-v1`/`curve-v1` pre-registration 骨架寫定;`../README.md` §3/§6/§8 對帳。零 `research/`/`src/` 變更 |
| 2026-08-07 | **T1** | ✅ | `research/src/modules/metrics/algorithms/detect.py` 新增 `detect_samples`/`detect_parity_payload`(逐位重現 `detectionDerivation.ts`,§4 D-30.5 逐欄核對);`tests/golden/research/detect-parity.test.ts` 對四份 fixture(合成 + 09:18/09:24/09:37)逐 presentation 相對誤差 ≤1e-9,`npm run test:ci` 90 檔 748 test 全綠;`uv run pytest` 243 passed(新增 test_detect.py 15 案例、test_detect_fixture.py、test_detect_purity.py);反 vacuous 斷言兩側皆綠(合計 23 個 `detected` 樣本 ≥ T0 門檻 10,OQ-S4-15 非 blocked-by-data);legacy(08:03/09:39)負向測試兩側皆釘死 strict 拋錯。零 `src/` 生產碼變更 |
| 2026-08-10 | **T2** | ✅ | `research/src/modules/metrics/algorithms/phase.py` 新增 `PhaseParams`/`PhaseSample`/`phase_decompose`/`phase_table`/`smooth_report_omega`(MR 逐位等於 `seg-v2` `primary_flick`,零第二套運動起點偵測);`phase-v1` 以 `notebooks/t2/sweep_phase_params.py` 雙維度掃參凍結(`cutoff_hz=12.0, butter_order=4, min_window_ticks=30`):合成六案例 0 失敗、真實 60 peeks 中 59 個(98.33%)三段皆非退化,≥90% 門檻通過;`notebooks/t2/generate_phase_report.py` 產出逐 session 分佈(不併池)+ REC-vs-`t_detect` 一致性檢查(結論:**系統性分歧**,pooled n=21,median −78.1ms,開 OQ-S4-17)+ 60 真實 + 2 合成 peek 疊圖。`docs/operational/analysis-phase-curves.md` 新建(`phase-v1` 定稿 + `curve-v1` 佔位)。`uv run pytest` 全綠(新增 test_phase.py 25 案例 + test_phase_purity.py);`npm run test:ci` 未受影響(零 TS 變更)。零 `src/` 變更、零凍結參數變更 |

---

## 0. 進場事實(2026-08-07 規劃期讀碼 + 讀資料;非 task 產出,供 T0 引用與覆核)

> 以下三段是規劃期查證的結果,**T0 必須自行覆核而非照抄**(A2-T2 的教訓:提交的產物要獨立重跑)。§1/§2 為 T0 的自行覆核結果。

### 0.1 entry blocker 現況:已於 A2-T4 解除(2026-08-07)

KI-005-A 的 A2-T1(三份新採樣)、A2-T2(四項複驗;FM-1 守恆檢查殘差 ≤ 5.6e-16,以機器精度關閉)、A2-T3(`seg-v2` 凍結,`sg_window=11 / peak_sigma_k=0.75 / peak_floor=60 / low=0.1 / stop=0.2`)、**A2-T4(M14 ③④⑤ 重新宣告 + KI-006 解除判定)皆已完成(2026-08-07)**。M14 帳本已更新為③④⑤ 重新宣告,**entry blocker 三條理由全數解除**;WP-30 T0 仍須自行覆核上游 exit-gate 的實際證據(不得只信任帳本文字)後才可開 T1。

### 0.2 fixture roster(規劃期實測)

| fixture | ticks | ω source | `meta.scene.eye` / `simToWorld` | `key` 事件 | `counter` | visible | `meta.suspect` | `validity.corridorExceeded` |
|---|---:|---|---|---:|---:|---:|---|---|
| 08:03 | 3,507 | `aim-diff-legacy` | ❌ / ❌ | 0 | 0 | 20 | false | — |
| 09:39 | 2,723 | `aim-diff-legacy` | ❌ / ❌ | 0 | 24 | 20 | true(KI-004 corridor) | — |
| **09:18** | 2,038 | `tick-integral` | ✅ `(0,1.6,4)` / 0.01 | 86 | 23 | 20(L10/R10) | **true** | true |
| **09:24** | — | `tick-integral` | ✅ / 0.01 | 84 | 25 | 20 | **true** | true |
| **09:37** | 1,904 | `tick-integral` | ✅ / 0.01 | 78 | 20 | 20 | **false** | true |
| `synthetic_counterstrafe.json` | 48 | `tick-integral` | ✅ / 0.01 | 0 | 2 | 2 | — | — |

三份新匯出的 `meta.mouseIntegration` 皆為 `tick-window-integral`(`radPerCount = 3.8397e-4`),`meta.display.refreshEstimateHz = 240`、`meta.targets.hitbox = {1,2,1}`、`meta.weapon.id = ak47`(hitscan,`bullet` 缺席)、`meta.session.participantId = P001`。

### 0.3 `suspect` 來源辨識(WP-30 必須重立使用界線)

- 三份新匯出的 `meta.validity` **只有** `corridorExceeded: true`,`perfFloor` / `recorderOverflow` / `bufferOverflow` 全為 false。
- **09:37 是反證**:`corridorExceeded: true` 但 `suspect: false` ⇒ KI-004/S1 的 NFR-S1-2b(corridor 不得單獨拉 suspect)確實生效。
- 故 09:18 / 09:24 的 `suspect: true` 另有來源;A2-T1 記為 `experimentSession.suspect`(session 中途退出 fullscreen)。該判定的 false positive 已由 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 於 commit `1d6e874` 修正,但**這三份是修法前錄的** → T0 須查清並拍板(見 OQ-S4-16)。
- **[D-29.2](../wp-29-coach-timeline/progress.md) 在本 WP 自動失效**:該決議的成立條件是「不消費 `px/pz`」,而 ε(t) 的射線原點為 `eye_origin.base + (px,0,pz) * simToWorld` → 本 WP 必然消費。T0 必須重立界線與失效條件。

---

## 1. M14 六項自行覆核(T0;只引用既有證據,不重跑既有測試)

> 協議 §6:entry-gate 的職責是**驗**上游 exit-gate,不是代辦。以下六項逐項覆核 [A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 與 [stage4/README.md M14 里程碑列](../README.md#4-里程碑門控) 的宣告文字,任一項非綠即停手。

| # | 項目 | 狀態 | 效度限制範圍 | 出處 |
|---|---|---|---|---|
| ① | 真實匯出 ingest/dt | ✅ 維持(未撤回過) | 與 aim 差分/行為內容無關 | [stage4/README.md §4](../README.md#4-里程碑門控):3,507 ticks / 7.8125ms / gap 0 |
| ② | ε(t) parity(閉式幾何 + `deriveTrackingMetrics` 對表) | ✅ 已於 2026-08-06 重新宣告 | 僅證明 Python 忠實對表 TS 既有推導,**不保證構念本身正確**(S-29.2 的既知盲區,不影響本 WP 因為本 WP 消費同一套已修正原點) | [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1 |
| ③ | 合成 fixture 邊界誤差 ≤2 tick | ✅ 已於 2026-08-07 重新宣告 | 僅證明演算法在**已知答案的合成訊號**上正確;真實資料的分段品質由④另外背書 | A2-T3:SG window 放寬至 `{5,7,9,11,13}`,135 組候選全數通過六個 pre-registered 合成案例,`seg-v2`(`window=11`)max boundary error ≤2 tick |
| ④ | 真實資料分段成功率(原判 0.95) | ✅ 已於 2026-08-07 重新宣告 | **單一匿名受試者 P001、n=3 session、同一台 240Hz 機器、同一 drill config**,非母體層級證據(比照 [KI-004-S1/README.md R-7](../../../../known_issue/KI-004-S1/README.md)) | A2-T2 守恆閘(FM-1)殘差 ≤5.6e-16/7.1e-16 機器精度通過 **且** KI-006 B-1~B-5 全數滿足(CLOSED);獨立覆核見下 §2 |
| ⑤ | 分段參數凍結(`seg-v1` → `seg-v2`) | ✅ 已於 2026-08-07 重新宣告 | 僅適用於 `tick-integral` 匯出;`seg-v1` 原地保留供 `aim-diff-legacy` 用 | [analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` frozen registry:`sg_window=11, peak_sigma_k=0.75, peak_floor_deg_s=60.0, low_ratio=0.1, stop_ratio=0.2` |
| ⑥ | `uv run pytest` 全綠 | ✅ 維持(74→228 passed) | 與 aim 差分/行為內容無關 | [stage4/README.md §4](../README.md#4-里程碑門控) |

**六項全綠,entry blocker 三條理由(KI-004/KI-005/KI-006)確認解除,T0 可續行 §2 以下。**

## 2. fixture roster 凍結 + strict 閘獨立覆核(T0 實測,非僅信任文件)

沿用 §0.2「進場事實」的表格(規劃期實測),T0 獨立重跑 `run_pipeline.py` 對六份 fixture 逐一驗證,並**額外**對 `strict=True` 閘做負向測試(規劃期未做):

```
$ uv run python -c "..."
counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json omega strict raised: ValueError omega_deg_s: this export has no ticks.d_yaw/d_pitch (pre-KI-005); omega would carry the render/sim beat-aliasing bug -- see docs/known_issue/KI-005-*
counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json eye_origin strict raised: ValueError resolve_eye_origin: this export has no meta.scene.eye / meta.simToWorld (pre-S1); please supply an explicit eye_base (see KI-004 §2.3)
counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json omega strict raised: ValueError omega_deg_s: this export has no ticks.d_yaw/d_pitch (pre-KI-005); omega would carry the render/sim beat-aliasing bug -- see docs/known_issue/KI-005-*
counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json eye_origin strict raised: ValueError resolve_eye_origin: this export has no meta.scene.eye / meta.simToWorld (pre-S1); please supply an explicit eye_base (see KI-004 §2.3)
```

08:03 / 09:39 皆在 `omega_deg_s(strict=True)` **與** `resolve_eye_origin(strict=True)` 兩處拋錯,證實禁用理由不是文件自律而是機械可驗證的。三份新匯出(09:18/09:24/09:37)與合成 fixture 皆不拋錯(已由 `run_pipeline.py` 全鏈跑通,見下方分段摘要表)。

同時獨立重跑 `run_pipeline.py` 對三份真實匯出取得的分段摘要,與 [analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` real-export validation 段落逐位吻合,交叉驗證④的證據未經竄改:

| fixture | peeks | segmented(has_primary_flick) | segments | merged_adjacent_peaks |
|---|---:|---:|---:|---:|
| 09:18 | 20 | 20/20(100%) | 21 | 6/21(28.6%) |
| 09:24 | 20 | 19/20(95%) | 19 | 8/19(42.1%) |
| 09:37 | 20 | 20/20(100%) | 20 | 9/20(45.0%) |
| **合計** | **60** | **59/60(98.3%)** | **60** | **23/60(38.3%)** |

98.3% 與 38.3% 與 `analysis-segments.md` 引用數字逐位相同(該檔案的合計陳述「success rate 98.3%」「38.3%」)。

---

## Decision Log

> 格式沿用 WP-29:每條含決策、理由(含 **Alternatives Considered** 與拒絕理由)、證據。

| # | 決策 | 理由 | 證據 |
|---|---|---|---|
| **D-30.0** | **偏離 [stage4 §6](../README.md) 的 WP-30 task 拆解**:插入 **T1 = t_detect Python 推導 + 對表閘**,原 T1(phase)/T2(101pt)順延為 T2/T3;估時 2–3d 上修為 2.5–3.25d。✅ **使用者於 2026-08-07 拍板採此案** | FR-D11 要求「REC 邊界與 t_detect 推導一致性檢查」,而 Python 側無 t_detect;`t_detect` 是**既有構念**(TS 權威 = [detectionDerivation.ts](../../../../../src/metrics/detectionDerivation.ts)),依 C-D4 不得在 Python 另立定義 → 必須有對表閘,而對表閘是獨立的垂直切片。Alternatives Considered:① 折進 phase task 且不設 parity 閘(拒絕:等於讓既有構念多一個未對表定義,正是 C-D4 要防的,且 `analysis-t-detect.md` 自稱 provisional、與程式碼可能已分歧,無閘則永遠不會發現);② 本 WP 不做一致性檢查、降級為 OQ(拒絕:FR-D11 未完整交付,REC 邊界失去唯一的外部效度檢核,且 WP-32 晉升時仍須補) | 本檔規劃期記錄;[README.md §4](README.md) 偏離說明;T0 落地時回寫 [../README.md §6](../README.md) |
| **D-30.1** | ✅ **phase 邊界複用 `seg-v2`**(2026-08-07 使用者拍板,關閉 OQ-S4-14 主體):`MR = primary_flick` 起訖、`REC = [t_visible, MR.start)`、`V = [MR.end, t_first_shot]`;**Butterworth 降為報告用平滑,不產生第二套運動起點**。此結構為定案,T2 不得改動 | 「動作何時開始」在 repo 內已有唯一權威(`seg-v2`,2026-08-07 剛以合成 + 三份真實雙維度重掃凍結);再建一套 Butterworth 偵測器必然在部分 peek 給出不同 tick,教練報告會出現分段圖與 phase 表互相矛盾而無人可仲裁 —— 正是 C-D4 要防的。且獨立偵測器須自帶參數並重跑一次雙維度掃參,等於把 A2-T3 剛做完的工作再做一次。Alternatives Considered:① 獨立 Butterworth 偵測器(拒絕:C-D4 第二定義 + 重複校參成本;FR-D11 要交付的是三段時長與一致性檢查,Butterworth 只是原論文的實作手段,非需求本身);② 兩者併行取交集(拒絕:交集為空的 peek 無處置,等於第三種定義) | [analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` frozen registry;[KI-005-A / A2-T3](../../../../known_issue/KI-005-A/A2-blocked-plan.md) 掃參證據 |
| **D-30.1b** | ✅ **T0 拍板(2026-08-07):採候選①**(第一個 `primary_flick`,現行 `seg-v2` 語意);候選②③**不採用**。**判準先寫後看**(依協議 §6 紀律):先定「多段 peek 佔比 ≤15% 就取候選①,不得為了處理邊緣案例把簡單規則複雜化」,**再**跑 `run_pipeline.py` 取三份真實匯出的逐 peek segment 數分佈:60 個真實 peek 中,**58 個(96.7%)恰有 1 個 segment**(候選①②③ 對這些 peek 完全等價,無取捨可言)、**1 個(1.7%,09:24 peek 0)為 0 segment**(below_floor,MR 取法問題不適用,由 `no_primary_flick` flag 處理)、**僅 1 個(1.7%,09:18 peek 14)有 2 個 segment**(`primary_flick`[idx 9–38, peak ω 143.6°/s] + `micro_adjustment`[idx 76–108, peak ω 126.0°/s])。多段佔比 1.7% ≪ 15% 判準 → 採候選①。**額外觀察**(非判準本身,佐證候選①②在此樣本上不衝突):唯一的多段案例中,`primary_flick` 的 peak ω(143.6)本身已高於 `micro_adjustment`(126.0),故候選②(peak ω 最大者)在此樣本上與候選①選到同一段;僅候選③(合併到最後一個 `micro_adjustment` 終點)會把 MR 終點從 171722.63ms 延後至 172269.51ms。三候選未出現「各切各的雙峰」情形,不觸發「重開獨立偵測器」的回頭條款 | 使用者 2026-08-07 指示「剩下等到真實資料再拍板」。判準門檻(15%)理由:與 `seg-v2` 的 `merged_adjacent_peaks` 改善幅度(60.0%→38.3%)量級不同源,是獨立設定的「MR 取法分歧曝險」上限,設在遠低於「多數情況」的門檻,確保只要多段是稀有事件就不為它引入額外複雜度(候選②③皆需要多讀一個 segment 欄位與排序邏輯,候選①是 `seg-v2` 既有回傳順序的第一筆,零額外程式碼)。Alternatives Considered:候選②(峰值 ω 最大,拒絕:在唯一樣本上與候選①同解,多一個排序/比較步驟卻不改變結果,徒增複雜度無實益);候選③(合併到最後一個 `micro_adjustment`,拒絕:唯一樣本顯示它會把 V 段起點延後 547ms,即把 `micro_adjustment` 的修正動作算進「主運動期」而非「驗證期」,與 D-30.1 的三段語意「MR = 主要那一下」矛盾) | `run_pipeline.py --export fixtures/exports/counterstrafe_ad_v1-2026-08-07T{09_18_05.631Z,09_24_18.148Z,09_37_24.351Z}.json`(T0 本地重跑,產物未 commit,可任何時候重現);逐 peek `segment_count`/`peek-segments.csv` 明細見本檔 §2 |
| **D-30.2** | ✅ **T0 拍板(2026-08-07):fixture roster 凍結 + `strict=True` 機械閘**。09:18/09:24/09:37 + `synthetic_counterstrafe.json` 為**唯一**可用 fixture(前三者為真實效度樣本,後者為演算法邊界 + 短窗退化案例);08:03/09:39 **全面禁用**,僅可作為「strict 閘必定拋錯」的負向測試輸入。機械化手段:WP-30 全部 notebook/測試入口一律 `omega_deg_s(..., strict=True)` 解 ω、`resolve_eye_origin(meta, strict=True)` 解 ε 射線原點;legacy 匯出當場拋 `ValueError` 而非降級輸出 aliased 曲線 | 08:03/09:39 是 `aim-diff-legacy`(無 `ticks.dYaw/dPitch`)且無 `meta.scene.eye`/`simToWorld`,ω 與 ε 兩條路都建立在已知錯誤的量測基礎上(KI-005 beat aliasing、KI-004 原點錯誤)。若靠文件自律(「請不要用這兩份」)而非程式碼機械閘,下一個 task 作者仍可能誤用——這正是 KI-005 §7.4 自我更正過的教訓(「以為重跑分析能讓假象消失」)。Alternatives Considered:僅在文件標註禁用範圍、不加程式碼閘(拒絕:S-30.1 已證明兩份舊 fixture 表面看起來仍可解析,`load_export` 不會報錯,唯有主動呼叫 `strict=True` 才會暴露問題,文件自律無法防止誤用) | T0 獨立重跑 `strict=True` 負向測試(本檔 §2):08:03/09:39 於 `omega_deg_s` 與 `resolve_eye_origin` 兩處皆確認拋 `ValueError`;09:18/09:24/09:37/`synthetic_counterstrafe.json` 皆不拋錯(`run_pipeline.py` 全鏈跑通,§2 表格) |
| **D-30.3** | ✅ **T0 拍板(2026-08-07):[D-29.2](../wp-29-coach-timeline/progress.md) 在本 WP 不適用,改採新界線**——09:18/09:24 的 `meta.suspect = true` 判定為**已確認的誤判**,可正常作為本 WP 的 ω/ε 效度證據使用,不需額外排除或降權。**失效條件**:若日後出現與研究者本人陳述矛盾的書面/系統紀錄(例如 session log 顯示這兩次錄製期間確實有 `fullscreenchange` 事件發生在 `drillRunner.phase ∈ {countdown, running}` 期間),本決議立即失效,須重新評估這兩份匯出作為效度證據的資格,並回溯檢查 WP-30 當時已產出的任何分析結論 | D-29.2 的成立條件是「不消費 `px/pz`」;ε(t) 的射線原點為 `eye_origin.base + (px,0,pz) * simToWorld`,WP-30 必然消費,故 D-29.2 自動失效(README §0.3 已載明)。新界線改為:直接查清 `suspect` 觸發源。[KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) §1/§5 已載明根因(`experimentSession.active` 在單一 session 流程下沒有 `exit()` 呼叫,drill 結束後研究者按正常流程退出全螢幕去抓檔案,與「錄製中途意外掉出」在修法前的程式碼眼中無法區分)與研究者的**第一手確認**(「三次錄製過程中皆未中途退出全螢幕,只在整個測試結束後才退出」)。此確認的證據地位比照 [A2-T4 B-1](../../../../known_issue/KI-005-A/A2-blocked-plan.md#ki-006-解除判定2026-08-07) 已接受的先例——採集者本人對「錄製當下發生了什麼」有第一手權威,即使沒有同步書面記錄。09:37 的 `suspect=false` 是反證(`corridorExceeded=true` 但 `suspect=false`,證明 corridor 與 suspect 確已於 KI-004/S1 解耦,09:18/09:24 的 `suspect=true` 另有來源而非同一機制重演)。Alternatives Considered:① 保守起見仍排除 09:18/09:24(拒絕:唯一理由撤回後仍排除等於浪費兩份通過 KI-006 construct presence gate 的合格樣本,且與 A2-T4 已接受同類第一手證詞的先例不一致,標準不能雙重);② 要求研究者提供額外書面佐證才採信(拒絕:KI-007 §1 已明載這是 F-1 修法**之前**的已知系統性 bug,即便有書面記錄也只能佐證「使用者確實在某時間點退出全螢幕」,無法區分是 drill 中還是 drill 後——書面記錄在這個 bug 存在期間不具鑑別力,要求它只是形式主義) | [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) §1(症狀)/§2(根因,commit 修法前的 `experimentSession` 無 `exit()` 呼叫路徑)/§5(對 A2-T1/A2-T2 既有資料的影響,含研究者確認文字);[A2-T4 KI-006 解除判定 B-1](../../../../known_issue/KI-005-A/A2-blocked-plan.md#ki-006-解除判定2026-08-07)(同類第一手證詞先例) |
| **D-30.4** | ✅ **T0 拍板(2026-08-07):`phase-v1`/`curve-v1` pre-registration 骨架**(詳見本檔 §3;規則與通過條件現在寫死,數值於 T2/T3 掃參/凍結,凍結後僅能升版) | 沿用 `seg-v2` 的雙維度掃參紀律(合成 + 真實),防止重演 `seg-v1` 只在合成資料上校參、凍結值在真實資料上不適用的錯誤(README §3 failure modes 表已列此風險) | 本檔 §3;[analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` 先例;[analysis-peek-timeline.md](../../../operational/analysis-peek-timeline.md) `sync-v1`(`min_samples=10`)先例 |
| **D-30.5** | ✅ **T1 參數逐欄核對(2026-08-07):`detectionDerivation.ts` 的 `DEFAULT_OPTIONS` 與 `analysis-t-detect.md` 文件敘述**完全一致**,無需入 DECISIONS 或回寫文件**:`preStimulusMs=500` / `thresholdSdMultiplier=3` / `sustainedTicks=4` / `anticipationMs=100`。Python `DetectParams` 預設值逐欄照抄,由 `test_default_params_match_ts_authoritative_defaults` 釘死 | T1 Steps 第一步要求「文件與程式碼若不一致,以程式碼為權威」;本次核對結果是兩者本就一致(文件雖自稱 provisional,但尚未偏離),故不需要決策,只需要留下核對紀錄供未來校準(analysis-t-detect.md §Sensitivity Analysis)時比對基準 | [detectionDerivation.ts](../../../../../src/metrics/detectionDerivation.ts) `DEFAULT_OPTIONS`;[analysis-t-detect.md](../../../operational/analysis-t-detect.md) `## t_detect` 段落;`research/src/modules/metrics/algorithms/tests/test_detect_fixture.py::test_default_params_match_ts_authoritative_defaults` |
| **D-30.6** | ✅ **T1 拍板:目標中心「兩者皆缺」時 Python 側用 `flags=("missing_target_position",)` 取代 TS 的 `throw`**,不算 C-D4 第二定義 | TS `targetFromVisibleOrTick` 每次只推導一個 presentation,拋錯後由呼叫端決定;Python `detect_samples` 是**批次**推導一整份匯出的所有 presentations(供 parity fixture 產生器使用),單一 presentation 資料缺陷不該讓整份匯出的推導全部中止。這不是對「目標中心缺席時怎麼辦」重新下定義——兩側對「該不該猜」給出的答案相同(不得猜),只是暴露失敗的機制不同(逐筆例外 vs 批次旗標)。三份真實 fixture 與合成 fixture 皆無此旗標出現(§4 證據) | `research/src/modules/metrics/algorithms/detect.py` `KNOWN_DETECT_FLAGS`;`test_detect.py::test_both_target_sources_missing_flags_instead_of_crashing` |
| **D-30.7** | ✅ **T2 拍板:`anchor_before_onset` 判準由 spec 字面「`t_first_shot` 早於 MR 起點」擴大為「`t_first_shot` 早於 MR 終點」**(即整個 MR 區間) | 若只檢查「早於 MR 起點」,一發在 flick 尾段、MR 起點之後但 MR 終點之前擊發的 shot 會讓 `v_ms = t_anchor - t_mr_end` 變成負值,違反 §2「不硬給負值」的一般原則。字面案例(早於起點)是這個一般原則的特例,不是唯一觸發條件。Alternatives Considered:只檢查早於起點(拒絕:會漏掉「早於終點但晚於起點」的負值 `v_ms`,與同一節「不硬給負值」的原則矛盾) | `research/src/modules/metrics/algorithms/phase.py::phase_decompose`;`test_phase.py::test_anchor_before_mr_end_nulls_all_three_durations_without_going_negative`;真實 60 peeks 中 0 例觸發(見 §6) |
| **D-30.8** | ✅ **T2 拍板:`non_uniform_dt` 在 `phase.py` 內以「本窗自身中位數間隔」局部判定,不透過 `meta.simHz` 全域比對**,與 `run_pipeline.py` 既有的「歸屬到含 gap 的那個窗」語意相容但範圍更窄 | `phase_decompose` 是純演算法函式,只收到單一 peek 的 tick 切片,沒有 `meta`,無法呼叫需要 `sim_hz` 的 `check_dt`。局部中位數比對達成同一目的(避免让 dt gap 汙染其他窗)且不需要把 `meta` 或 sim_hz 穿透進 `algorithms/` 層。Alternatives Considered:①要求呼叫端額外傳入預算好的 `uniform: bool`(拒絕:README §5 的介面契約未列此參數,且會讓每個呼叫端各自重算一次 `check_dt` 交集邏輯,無實益);②不做局部檢查,只靠呼叫端的 `run_pipeline.py` 全域報告(拒絕:`phase.py` 若完全不自我檢查,單元測試就無法獨立驗證這個退化路徑) | `research/src/modules/metrics/algorithms/phase.py::_is_locally_uniform`;`test_phase.py::test_non_uniform_dt_is_flagged_but_does_not_null_the_computed_phases`;`docs/operational/analysis-phase-curves.md` 已載明此為窄化但同義的檢查 |
| **D-30.9** | ✅ **`phase-v1` 凍結:`cutoff_hz=12.0, butter_order=4, min_window_ticks=30`**,雙維度掃參證據見 §6 | 合成六案例(3 個已知 profile × 有/無首發)0 案例失敗(MR 逐位等於 segment,屬結構性保證);真實 60 peeks 中 59 個(98.33%)三段皆非退化,通過 T0 pre-registered ≥90% 門檻,唯一例外為 09:24 已知的 `below_floor`/0-segment peek(與 D-30.1b 一致)。18 組候選(`cutoff_hz`∈{8,12,16}×`butter_order`∈{2,4}×`min_window_ticks`∈{24,30,40})全數通過兩維度——因三份真實 fixture 每個 peek 的 tick 數下限(53)遠高於候選網格的所有 `min_window_ticks`/`filtfilt` padlen 需求,平滑退化路徑在真實資料尺度上從未觸發。`min_window_ticks=30` 從這組同分候選中選出,理由是它能讓合成 fixture(24 ticks/peek)確定性觸發 `window_too_short`(S-30.3 的天然短窗案例),而不是恰好選到一個會放行它的數值 | `research/src/modules/metrics/notebooks/t2/sweep_phase_params.py`;`outputs/phase-sweep.csv`(18 列全數 `passes=True`);`docs/operational/analysis-phase-curves.md` §「Frozen phase-v1 parameter registry」 |
| **D-30.10** | ✅ **REC-end(`MR.start`)與 `t_detect` 的一致性檢查結論為「系統性分歧」,不調整 REC 定義,也不重調 `t_detect` 參數** | pooled n=21(≥ T0 門檻 10,非 vacuous)、三個 session 各自 median 偏移 −66.4/−74.2/−85.9ms,方向與量級一致,非單一極端值拉偏;−78.1ms(≈10 tick)遠大於 ±1 tick 的一致性門檻。C-D4 禁止為了對齊而重新定義既有構念——REC 的權威定義是 `seg-v2 primary_flick`(D-30.1),`t_detect` 的權威定義與參數是 TS `detectionDerivation`(T1 對表已凍結);兩者分歧是待研究的訊號,不是任一方的 bug。Alternatives Considered:①悄悄調寬 `theta_v`/`k` 讓兩者對齊(拒絕:違反 C-D4,且會在未經驗證的情況下重新校準一個已凍結、已對表的既有構念);②把 REC 邊界改成以 `t_detect` 為準(拒絕:違反 D-30.1,且會讓 REC 定義依賴一個為完全不同 drill 校準的參數) | `research/src/modules/metrics/notebooks/t2/generate_phase_report.py`;`outputs/rec-vs-detect-verdict.txt`、`outputs/rec-minus-detect.csv`;新開 OQ-S4-17(README §8) |

## 3. `phase-v1` / `curve-v1` pre-registration 骨架(T0;規則與通過條件寫死,數值留待 T2/T3 掃參凍結)

> 紀律(D-30.4):以下規則、通過條件、最小樣本數、flags 草案、version 字串**事後不得依 T2/T3 的實際掃參結果調整**——只能整組升版(`phase-v2`/`curve-v2`)重跑全鏈。已在此刻可以不看資料就決定的格式性選擇(插值法、band 型別、視窗)直接凍結;需要資料才能決定的數值(Butterworth cutoff/order、`min_window_ticks`、`min_ticks`)留給 T2/T3,但**通過門檻**現在寫死。

### 3.1 `phase-v1`

| 項目 | 內容 | 狀態 |
|---|---|---|
| 邊界規則 | `MR = seg-v2 primary_flick`(多段依 **D-30.1b** 取候選①第一個);`REC = [t_visible, MR.start)`;`V = [MR.end, t_first_shot]` | ✅ 已凍結(D-30.1/D-30.1b) |
| Butterworth 角色 | 僅報告用零相位平滑,不產生任何邊界判定;`phase.py` 不得含運動起點偵測邏輯 | ✅ 已凍結(D-30.1) |
| `cutoff_hz` / `butter_order` / `min_window_ticks` | 待 T2 掃參 | ⬜ T2 |
| **雙維度通過條件**(凍結前必須同時滿足,單一維度不得凍結) | **維度一(合成)**:六個 pre-registered 合成相位邊界案例(沿用 T3-phase 已列的已知邊界),誤差 ≤2 tick,零案例失敗。**維度二(真實)**:三份真實匯出(09:18/09:24/09:37,60 peeks)中,「三段皆非退化」(REC/MR/V 皆有值,不含 `window_too_short`/`no_primary_flick`/`no_first_shot`/`filter_degenerate`/`anchor_before_onset`)的 peek 佔比 **≥90%**。門檻理由:現行 `seg-v2` 的 `has_primary_flick` 成功率已達 98.3%(§2),REC/V 只多依賴 `t_visible`(恆有)與 `t_first_shot`(現有 fixture 的 firstShotHitRate 樣本 n=20/20,WP-29 T1 已驗),故三段同時非退化理論上限接近 segmentation 成功率;90% 留出約 8 個百分點的裕度給 `filter_degenerate`(短窗濾波退化)等 phase 特有的新退化路徑 | ✅ 通過條件已凍結;數字待 T2 產出 |
| 反 vacuous 條款 | `t_detect` 一致性檢查(`rec_minus_detect_ms`)需要 `status == 'detected'` 的樣本數 **≥10** 才可下「一致」或「系統性分歧」結論;不足一律 `blocked-by-data`(引用 OQ-S4-15),不得以空集合宣告一致 | ✅ 已凍結(沿用 `sync-v1` `min_samples=10` 同量級) |
| flags 封閉詞彙表(草案,T2 只能收斂不得擴張) | `window_too_short`、`no_primary_flick`、`no_first_shot`、`filter_degenerate`、`anchor_before_onset`、`non_uniform_dt` | ✅ 草案凍結(T2-phase-decompose.md 已列同一份清單) |
| `version` | `"phase-v1"` | ✅ |

### 3.2 `curve-v1`

| 項目 | 內容 | 狀態 |
|---|---|---|
| 窗界 | `[t_visible, t_first_shot]` | ✅ 已凍結(OQ-S4-5) |
| `points` | `101` | ✅ 已凍結 |
| 插值法 | 線性插值,正規化時間 `[0,1]` 等距 101 點;端點值 = `t0`/`t1` 樣本本身(不外插) | ✅ 本 task 凍結(格式性選擇,不需資料) |
| `band` | **IQR**(非 mean±SD) | ✅ 本 task 拍板 |
| `min_ticks` | 待 T3 依合成短窗案例(48 ticks/2 peeks)與真實資料窗長分佈決定;規則:選取後須能讓 `synthetic_counterstrafe.json` 的兩個 peek **不被此門檻誤傷排除**(它們是短窗退化的正向測試案例,不是要被 `min_ticks` 擋掉的反面案例——真正該被擋的是窗內樣本不足以支撐 101 點插值品質的病態輸入,例如 1–2 tick 的窗) | ⬜ T3 |
| 納入規則 | 沿用 D-29.5:值有限**且**整列 flags 為空才進聚合分母 `n`;被排除列仍完整輸出並計數,`n` 與圖上標示同源 | ✅ 已凍結 |
| flags 封閉詞彙表(草案) | `no_first_shot`、`window_too_short`、`missing_epsilon`、`non_uniform_dt`、`degenerate_window` | ✅ 草案凍結(T3-lr-curves.md 已列同一份清單) |
| `version` | `"curve-v1"` | ✅ |

**`band = IQR` 的理由**:三份真實匯出每 side 僅 n≈30(L/R 約各半),樣本量小且短窗退化 peek 被排除後 n 會更小;IQR(中位數 + 四分位距)對離群 peek(如短窗、雜訊尖峰)比 mean±SD 更穩健,且教練閱讀「多數 peek 落在這個範圍」比「平均值 ± 一個標準差」更直覺,不需要假設常態分布。Alternatives Considered:mean±SD(拒絕:小樣本下對離群值敏感,且會暗示常態分布假設,而動作資料未經檢驗)。

## Surprises

| # | 內容 | 影響 |
|---|---|---|
| **S-30.1** | 規劃期發現 WP-29 的三份 fixture 分工(合成 / 08:03 零輸入 / 09:39 主要效度)在 WP-30 **完全不適用** —— 兩份舊真實匯出皆為 `aim-diff-legacy` 且缺 `meta.scene.eye`,ω 與 ε 兩條路都走不通 | 真實證據整組換成 09:18/09:24/09:37;此界線寫成 strict 機械閘而非文件自律(T0) |
| **S-30.2** | 三份新匯出的 `validity.corridorExceeded` 全為 `true`,但 09:37 的 `suspect` 為 `false` —— 這正好是 KI-004/S1 解耦生效的反證,也說明 09:18/09:24 的 suspect 來自別處(KI-007 領域) | T0 的使用界線決議不能沿用 KI-004 的推理,須另立(OQ-S4-16) |
| **S-30.3** | 合成 fixture 只有 **48 ticks / 2 peeks**,而 `butter_filter` 對 `樣本數 ≤ 3*max(len(b),len(a))` 直接拋 `ValueError` → 合成資料在 phase 濾波路徑上是**必然退化**的 | 短窗退化必須是「flag + fallback」的必跑回歸案例,不能列為「已知不支援」(T2 DoD ③) |
| **S-30.4** | T0 獨立重跑 `run_pipeline.py` 取得的逐 peek `segment_count` 分佈顯示:60 個真實 peek 中 **58 個(96.7%)恰有 1 個 segment**,只有 1 個 0-segment、1 個 2-segment —— D-30.1b 原先預期的「MR 取法分歧」在此樣本上幾乎不曾發生,三個候選規則的實際差異只影響 1/60 個 peek 的 V 段起點 | 大幅簡化 D-30.1b 的拍板:候選①②③在本樣本上高度一致,採最簡單的候選①即可,不需要為稀有情境引入排序/合併邏輯;但**效度聲稱不可外推**——樣本一多、drill 涵蓋更寬動作範圍後,多段比例可能上升,屆時需重新檢視此決策 |
| **S-30.5** | T0 獨立重跑三份真實匯出的分段統計(§2),與 [analysis-segments.md](../../../operational/analysis-segments.md) `seg-v2` real-export validation 段落宣稱的 98.3% success rate / 38.3% `merged_adjacent_peaks` **逐位吻合** | 交叉驗證 A2-T3 的 exit-gate 證據未被竄改或選擇性引用,T0「不得只信任帳本文字」的覆核要求確實執行且通過 |
| **S-30.6** | T1 實測三份真實匯出 + 合成 fixture 的 `t_detect` 推導:60 個真實 peek 中 `detected`=22、`timeout`=38(+ 合成 2 peek 各 1 detected/1 timeout,合計 23 detected);`baselineInsufficient` 在三份真實匯出**全數為 0**(60/60 皆有充足前刺激基線,因為每個 peek 的前 500ms 落在上一個 peek 的尾段而非真空),只有合成 fixture 的 2 個 peek(視角開場即刺激,無前置資料)觸發 | 直接回答 OQ-S4-15:23 ≥ T0 pre-registered 門檻(≥10),T2 的 REC-vs-`t_detect` 一致性檢查**不會**是 `blocked-by-data`;同時排除了「baseline_insufficient 污染真實資料 threshold=3×SD=0」的疑慮(該退化模式只在合成邊界案例出現,不影響真實效度樣本) |
| **S-30.7** | T2 一致性檢查發現 REC-end(`seg-v2 MR.start`)系統性地**早於** `t_detect`:pooled n=21,median `rec_minus_detect_ms = t_onset - t_detect = -78.1ms`(≈10 tick),三個 session 各自 median(−66.4/−74.2/−85.9ms)同方向、同量級,非單一 session 拉偏。遠超 ±1 tick(7.8ms)的一致性門檻,不是雜訊 | 這不是任一構念的 bug——`seg-v2` 的角速度峰值閘可能在原始角速度剛越過閾值時就接受 `primary_flick` 起點,而 `detectionDerivation` 要求 eccentricity 連續下降 4 個 tick 才確認 `t_detect`,兩者測的是同一動作的不同「已經開始」判準,對 counter-strafe 這種瞬間甩動的動作可能特別容易分岔(`analysis-t-detect.md` 的參數是為較和緩的 detection pop-in drill 校準)。記為 D-30.10 決策(不調整任一定義)+ 新開 OQ-S4-17(根因待驗證) |

## Open Questions

> 本 WP 新增 OQ-S4-14/15/16;既有 OQ-S4-* 見 [../README.md §8](../README.md)。

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S4-14** | phase 邊界複用 `seg-v2` primary_flick,或獨立 Butterworth 偵測器(FR-D11 字面) | ✅ **關閉(2026-08-07,T0)**:複用 `seg-v2`(D-30.1),多段 peek 取法採候選①(D-30.1b)。三候選在真實資料上未出現「各切各的雙峰」,不觸發回頭重開獨立偵測器的條款 | 使用者 / 研究者 | WP-30 T0 |
| **OQ-S4-15** | `t_detect` 在 counter-strafe drill 上是否有足夠 `detected` 樣本支撐 REC 一致性檢查 | ✅ **關閉(2026-08-10,T2)**:pooled n=21 ≥ 門檻 10,非 `blocked-by-data`;一致性檢查已交付,結論為**系統性分歧**(見 OQ-S4-17,D-30.10) | 研究者 | WP-30 T2 |
| **OQ-S4-16** | 09:18 / 09:24 的 `suspect = true` 是否為 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 的 false positive,抑或 session 中途真的退出 fullscreen | ✅ **關閉(2026-08-07,T0)**:[KI-007 §5](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 已載研究者第一手確認為誤判(F-1 修法前的已知 bug,drill 結束後才退出全螢幕);D-30.3 已拍板使用界線與失效條件 | 使用者 / 研究者 | WP-30 T0 |
| **OQ-S4-17**(新) | REC-end(`seg-v2 MR.start`)與 `t_detect` 的系統性分歧(pooled median −78.1ms,S-30.7)根因為何——`theta_v`/`k` 對 counter-strafe 快速甩動的參數失配,或另有其他機制 | 🟡 **open**。T2 只記錄分歧、不調整任一定義(D-30.10);根因待專屬 counter-strafe 樣本的敏感度分析或其他驗證手段 | 研究者 | 待排 | 若確為參數失配,教練報告呈現 `t_detect` 相關量標時可能需要額外限制說明 |

## 4. T0 Scope 證據(DoD ⑦)

```
$ git diff --stat
 docs/exec-plan/active/stage4/README.md             |  18 ++--
 .../wp-30-trajectory-metrics/T0-entry-gate.md      |  20 ++---
 .../stage4/wp-30-trajectory-metrics/progress.md    | 100 ++++++++++++++++++---
 .../wp-30-trajectory-metrics/task-checklist.md     |   2 +-
 4 files changed, 111 insertions(+), 29 deletions(-)
```

四檔皆在 `docs/exec-plan/active/stage4/` 之下,零 `src/`、零 `research/` 變更,符合 T0-entry-gate.md 的 Touches 限制。

## 5. T1 對表閘 + 反 vacuous 證據

**新增檔案**(`git status --short`,零修改既有 `src/`;`research/src/modules/metrics/algorithms/__init__.py` 只新增 export,未改既有符號):

```
 M research/src/modules/metrics/algorithms/__init__.py
?? research/fixtures/parity/detect-counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json
?? research/fixtures/parity/detect-counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json
?? research/fixtures/parity/detect-counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json
?? research/fixtures/parity/detect-synthetic_counterstrafe.json
?? research/src/modules/metrics/algorithms/detect.py
?? research/src/modules/metrics/algorithms/tests/test_detect.py
?? research/src/modules/metrics/algorithms/tests/test_detect_fixture.py
?? research/src/modules/metrics/algorithms/tests/test_detect_purity.py
?? research/src/modules/metrics/notebooks/t1/generate_detect_parity.py
?? tests/golden/research/detect-parity.test.ts
```

**`uv run pytest`**(research,含新增 15 個 `test_detect.py` 案例 + `test_detect_fixture.py` 對表迴歸/反 vacuous/legacy 負向 + `test_detect_purity.py`):

```
243 passed in 29.18s
```

**`npm run test:ci`**(engine,含 `detect-parity.test.ts` 7 案例:4 份 fixture 逐 presentation 對表、反 vacuous 門檻、2 份 legacy 負向):

```
Test Files  90 passed (90)
     Tests  748 passed (748)
...
21 passed (32.6s)   # Playwright e2e(test:ci 的第二段)
```

**反 vacuous 證據**(S-30.6):三份真實匯出 + 合成 fixture 合計 23 個 `detected` 樣本(≥ T0 門檻 10),`test_anti_vacuous_detected_sample_count_meets_t0_threshold`(Python)與 TS 測試中「has enough detected samples」案例雙側斷言;`baselineInsufficient` 在三份真實匯出全數為 0(僅合成短窗案例觸發),見 Surprises 表 S-30.6。

**參數稽核**(D-30.5):`DetectParams` 預設值與 `detectionDerivation.ts` `DEFAULT_OPTIONS` 逐欄相同,無需決策或回寫文件。

## 6. T2 REC/MR/V phase 分解證據

**新增檔案**(`git status --short`,零修改既有 `src/` 生產碼;`algorithms/__init__.py` 只新增 export):

```
 M research/src/modules/metrics/algorithms/__init__.py
?? docs/operational/analysis-phase-curves.md
?? research/src/modules/metrics/algorithms/phase.py
?? research/src/modules/metrics/algorithms/tests/test_phase.py
?? research/src/modules/metrics/algorithms/tests/test_phase_purity.py
?? research/src/modules/metrics/notebooks/t2/sweep_phase_params.py
?? research/src/modules/metrics/notebooks/t2/generate_phase_report.py
?? research/src/modules/metrics/notebooks/t2/outputs/phase-sweep.csv
?? research/src/modules/metrics/notebooks/t2/outputs/phase-distributions.csv
?? research/src/modules/metrics/notebooks/t2/outputs/phase-quality-*.csv
?? research/src/modules/metrics/notebooks/t2/outputs/rec-minus-detect.csv
?? research/src/modules/metrics/notebooks/t2/outputs/rec-vs-detect-verdict.txt
?? research/src/modules/metrics/notebooks/t2/outputs/overlays/  (62 SVG: 60 real + 2 synthetic)
```

**`uv run pytest`**(research;含新增 25 個 `test_phase.py` 案例 + `test_phase_purity.py`):

```
269 passed in 80.50s
```

> **環境註記**:本 session 的預設 pytest 暫存目錄(`%TEMP%\pytest-of-<user>`)在此環境下 `Access is denied`(連 `icacls` 都無法讀取該目錄的 ACL),導致所有依賴 `tmp_path` fixture 的既有測試(含 T0/T1 就已存在的 `test_detect_purity.py`、`test_submovement.py` 等,與本 task 無關)在不帶參數時全部報 `ERROR`。以 `uv run pytest --basetemp=<可寫目錄>` 繞過壞掉的預設暫存目錄後,**全部 269 個測試(含既有 243 個)通過,0 失敗**。這是環境限制,不是程式碼缺陷——已用不涉及本 task 變更的既有測試（如 `test_submovement.py`）交叉驗證同一環境問題重現,證實與本次改動無關。

`npm run test:ci` 未受影響(本 task 零 TS 變更,未重跑;WP-30 README §6 執行規則的「兩個閘都要貼證據」在 T1 已滿足 TS 側,T2 未觸碰 `tests/golden/research/`)。

**`phase-v1` 雙維度掃參證據**(D-30.9):`research/src/modules/metrics/notebooks/t2/sweep_phase_params.py` 對 18 組候選(`cutoff_hz`∈{8,12,16}×`butter_order`∈{2,4}×`min_window_ticks`∈{24,30,40})逐一驗證:

- **維度一(合成,結構性保證)**:六個 pre-registered 案例(`single_flick`/`flick_plus_one_micro`/`flick_plus_three_micro` × 有/無首發)全數 0 失敗——`t_onset`/`t_mr_end` 逐位等於 `seg-v2` `primary_flick` 邊界(0 tick 誤差,強於 DoD 要求的 ≤2 tick)。
- **維度二(真實,60 peeks)**:凍結候選(`cutoff_hz=12.0, butter_order=4, min_window_ticks=30`)得 **59/60 = 98.33%** 三段皆非退化(唯一例外為 09:24 已知的 `below_floor`/0-segment peek,與 D-30.1b 一致),通過 T0 pre-registered ≥90% 門檻。18 組候選全數同分通過(因三份真實 fixture 每 peek 最小 tick 數為 53,遠高於候選網格的所有 `min_window_ticks` 與 `filtfilt` padlen 需求)。

完整候選比較表:`research/src/modules/metrics/notebooks/t2/outputs/phase-sweep.csv`。

**真實資料分佈**(逐 session,不併池,D-29.5 納入規則):見 `outputs/phase-distributions.csv`;摘要已寫入 [analysis-phase-curves.md](../../../operational/analysis-phase-curves.md)。

**REC-end vs `t_detect` 一致性檢查**(DoD ④ 要求三選一明確判定):**系統性分歧**(非 `blocked-by-data`、非「一致」)。pooled n=21(≥ T0 門檻 10),median `rec_minus_detect_ms = -78.1ms`(≈10 tick),三 session 各自 median(−66.4/−74.2/−85.9ms)同方向同量級。詳見 S-30.7、D-30.10、新開 OQ-S4-17,以及 `outputs/rec-vs-detect-verdict.txt` / `outputs/rec-minus-detect.csv`。

**疊圖覆核**(DoD ⑥):60 真實 + 2 合成 peek 疊圖全數產出於 `outputs/overlays/<fixture>/peek-<NNN>-overlay.svg`(灰=REC、藍=MR、綠=V、紅色虛線=`t_detect`)。本環境無法算染 SVG 圖片,覆核以逐 peek 記錄檔(邊界順序、非負時長、MR 涵蓋該窗區域性峰值)進行結構性/數值性複核,並直接讀取數份代表性 peek(含唯一的 `no_primary_flick` 案例:09:24 peek 0)的 SVG 座標人工核對正確性。除已知的 `no_primary_flick` 案例與上述 REC/`t_detect` 系統性分歧外,複核未發現其他異常樣本。

**合成 fixture 回歸**(S-30.3 的天然短窗案例):`synthetic_counterstrafe.json` 兩個 24-tick peek 皆確定性觸發 `window_too_short`(`min_window_ticks=30`),`generate_phase_report.py` 內建斷言釘死此行為,不算「已知不支援」。

**C-D4 無第二定義佐證**:`test_phase.py::test_known_boundaries_reproduce_seg_v2_primary_flick_exactly` 對六個案例斷言 `t_onset`/`t_mr_end` 逐位等於 `Segment.start_idx`/`end_idx` 映回的 tick 時間戳;`phase.py` 原始碼內零運動起點偵測邏輯,Butterworth 平滑僅出現在 `smooth_report_omega`(報告路徑),不影響任何邊界欄位(`test_cutoff_at_or_above_nyquist_flags_filter_degenerate_without_raising` 等測試佐證)。
