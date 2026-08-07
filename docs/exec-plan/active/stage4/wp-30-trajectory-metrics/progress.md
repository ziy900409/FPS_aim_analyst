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

## Open Questions

> 本 WP 新增 OQ-S4-14/15/16;既有 OQ-S4-* 見 [../README.md §8](../README.md)。

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S4-14** | phase 邊界複用 `seg-v2` primary_flick,或獨立 Butterworth 偵測器(FR-D11 字面) | ✅ **關閉(2026-08-07,T0)**:複用 `seg-v2`(D-30.1),多段 peek 取法採候選①(D-30.1b)。三候選在真實資料上未出現「各切各的雙峰」,不觸發回頭重開獨立偵測器的條款 | 使用者 / 研究者 | WP-30 T0 |
| **OQ-S4-15** | `t_detect` 在 counter-strafe drill 上是否有足夠 `detected` 樣本支撐 REC 一致性檢查 | 🟡 T1 以資料判定;不足即 `blocked-by-data`;最小樣本數已 pre-register 為 ≥10(§3.1) | 研究者 | WP-30 T1 |
| **OQ-S4-16** | 09:18 / 09:24 的 `suspect = true` 是否為 [KI-007](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 的 false positive,抑或 session 中途真的退出 fullscreen | ✅ **關閉(2026-08-07,T0)**:[KI-007 §5](../../../../known_issue/KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) 已載研究者第一手確認為誤判(F-1 修法前的已知 bug,drill 結束後才退出全螢幕);D-30.3 已拍板使用界線與失效條件 | 使用者 / 研究者 | WP-30 T0 |

## 4. Scope 證據(DoD ⑦)

```
$ git diff --stat
 docs/exec-plan/active/stage4/README.md             |  18 ++--
 .../wp-30-trajectory-metrics/T0-entry-gate.md      |  20 ++---
 .../stage4/wp-30-trajectory-metrics/progress.md    | 100 ++++++++++++++++++---
 .../wp-30-trajectory-metrics/task-checklist.md     |   2 +-
 4 files changed, 111 insertions(+), 29 deletions(-)
```

四檔皆在 `docs/exec-plan/active/stage4/` 之下,零 `src/`、零 `research/` 變更,符合 T0-entry-gate.md 的 Touches 限制。
