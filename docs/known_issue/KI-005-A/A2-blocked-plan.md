# Stage A2 — 新採樣、複驗、`seg-v2`(**blocked**)

> 上游:[A README §4](README.md) · [KI-005 §7.4 / §7.5](../KI-005-omega-render-sim-aliasing.md) · [KI-006](../KI-006-m14-sample-no-counterstrafe.md)
> 狀態:✅ **A2(T1–T4)全數完成(2026-08-07)**。A1(T0–T-exit)已完成;A2-T1(新採樣)/A2-T2(四項複驗)/A2-T3(`seg-v2` 重掃凍結)/A2-T4(M14 ③④⑤ 重新宣告 + KI-006 解除)依序完成,見 [progress.md](progress.md)。**M14 ③④⑤ 已重新宣告,WP-30/31 entry blocker 已解除**。

---

## 為什麼必須分成兩個 stage

KI-005 §7.4 於 2026-08-06 **自我更正**:

> 初稿寫「以 09:39 匯出重跑 `run_pipeline.py`」是**錯的**:選項 A 改變的是**記錄什麼**,既有匯出的 `ticks[].aim` 已經帶著假象**寫死在檔案裡**,重跑分析不可能讓它變乾淨。

加上 OQ-KI5-3 拍板**不做選項 C**(不回溯清洗),結論是:**A1 交付的是量測儀器的正確性,不是效度的恢復**。效度只能由修法後的新匯出恢復,而那需要真人坐下來採一份資料。

把它切成獨立 stage 而非硬塞進 A1,是為了讓 A1 的 exit gate 保持**可客觀驗證**(全部是 `npm run test:ci` / `uv run pytest` 能判的條件),不被「等人採資料」拖成無限期未完成。

---

## 前置條件(全部滿足才可開 A2-T1)

- [x] A1 的 [T-exit-gate](T-exit-gate.md) 八道硬閘全綠。
- [x] **OQ-A-5**(= OQ-KI5-6)採樣時機與規模已定:✅ 2026-08-07 拍板,與 KI-006 選項 B **合併為同一次採集**。
- [x] **OQ-A-2 / TD-5** 決定:✅ 2026-08-07 拍板,採樣時**開啟** `recordKeyEvents`。
- [x] **`recordKeyEvents` 程式碼接線**(TD-5 落地,2026-08-07):[main.ts:355](../../src/main.ts#L355) 的 `createDataRecorder(...)` 已傳入 `recordKeyEvents: true`;`tests/e2e/input-sampler.spec.ts` 新增驗證案(`__aimDebug.recorder.recordKeyEvents === true`)。回歸:`tsc --noEmit` exit 0、`npm run test:ci` Vitest 89 files/739 tests 不變 + Playwright 21/21(新增 1 案)、`uv run pytest` 221 passed 不變。
- [x] **KI-006 的採集條件已滿足**:construct presence gate(選項 C)已落地([KI-006-C/](../KI-006-C/README.md),OQ-KI6-2/3 已關閉),B(重新採樣)的 KI-006 條件見 [KI-006-C/README.md §6](../KI-006-C/README.md) **B-1~B-5**(不在本檔重複列出)。
- [x] **OQ-KI6-4**(= [KI-006-C/README.md §6 B-4](../KI-006-C/README.md))決定:✅ 2026-08-07 拍板,**n > 2**(至少 3 個 session),嚴於原建議的 n ≥ 2。

> **兩個 KI 的重新宣告路徑收斂為同一次採集**(KI-005 §6.1 連帶結論)。採之前沒把 KI-006 的條件想清楚,就得採第二次。
>
> **決策與接線全數落地於 2026-08-07**,詳見 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-005「A2-T1 前置決策」段與 [KI-005-A/progress.md A-D10/A-D11](progress.md)。**A2-T1 唯一剩下的是研究者實際排程執行採集**,不再有任何決策性或程式碼性的阻塞。

---

## A2-T1 — 新採樣 ✅ 已完成(2026-08-07)

**執行者**:研究者(非 agent 可代勞)。

- [x] 同一台 **240 Hz** 機器(使 §3.1 的凹口偵測器與 T0 的基線可直接對照)。三份匯出 `meta.display.refreshEstimateHz == 240`。
- [x] drill 必須實際含 **counter-strafe 構念**:`vx` 非恆零、`keys` 非全空、`counter` 事件 > 0(KI-006 的撤回理由)。三份匯出 `counter` 事件數 23/25/20,橫移 tick 佔比 0.656/0.654/0.644。
- [x] 匯出必須含 `meta.mouseIntegration` + `ticks[].dYaw/dPitch`(A1 的 FR-A-7 保證)。三份皆確認存在,`omega_deg_s(strict=True)` 皆解出 `source == "tick-integral"`,不拋錯。
- [x] **`recordKeyEvents` 已開啟**(OQ-A-2/TD-5,2026-08-07 拍板)。三份匯出 `events` 分別含 86/84/78 筆 `type === 'key'`,確認接線在真實採集中生效。
- [x] 記錄採集條件:受試者、螢幕型號/刷新率、sensitivity/FOV、drill config、session 數。session 資訊見三份匯出 `meta`;**觀察**:09:18/09:24 兩份 `meta.suspect == true`(觸發源 = `experimentSession.suspect`,session 中途退出 fullscreen,非走廊越界),09:37 為 `false`,待研究者確認是否確有中途退出。
- [x] session 數 **n > 2**(至少 3 個,OQ-KI6-4 已於 2026-08-07 拍板)。實得 **3 個**(09:18/09:24/09:37)。
- [x] **採完立即**跑 construct presence gate(`run_pipeline` 消費新匯出);`constructPresence.present == false` 即**當場重採**,不得事後才發現構念缺席([KI-006-C/README.md §6 B-3](../KI-006-C/README.md))。三份皆 `present == true`。

**DoD**(全數通過,獨立重跑 `run_pipeline` 覆核,非僅信任提交的產物):新匯出通過 `load_export` 且 `omega_deg_s(..., strict=True)` **不拋錯**(即 `source == "tick-integral"`);`counter` 事件數 > 0;`events` 含至少一筆 `type === 'key'`(證明 `recordKeyEvents` 接線生效,OQ-A-2/TD-5);`run_pipeline` 對每一份新匯出 exit 0 且 `constructPresence.present == true`(KI-006-C §6 B-2/B-3);session 數 n > 2。詳細數字見 [progress.md](progress.md) 2026-08-07 A2-T1 列。

---

## A2-T2 — 四項複驗(KI-005 §7.4) ✅ 已完成(2026-08-07)

| # | 檢查 | 基線(舊匯出) | 期望 | 實測(新匯出) | 結果 |
|---|---|---|---|---|---|
| ① | 凹口偵測器(T0 的腳本,口徑逐字沿用) | 08:03 → 27 個 · 09:39 → 34 個(今日重跑),間距全為 8 的倍數 | **回傳 0** | 09:18/09:24/09:37 → **3/2/2** 個,間距非 8 倍數、與 `vx` 反轉不重合;圖示覆核(見 progress.md §2e)確認為訊號雜訊底噪,非根因復發 | 🟡→✅ 非 literal 0,視覺覆核後使用者確認接受 |
| ② | `merged_adjacent_peaks` 比例 | **15/19(79%,文件原載)** · 20/21(95.2%,今日重跑) | 顯著下降 | 09:18 12/21(57.1%)· 09:24 11/19(57.9%)· 09:37 13/20(65.0%) | ✅ 通過 |
| ③ | 未 flag 樣本數(`duration_ms`/`peak_omega_deg_s`/`mean_epsilon_deg`) | **n=4(文件原載)** · n=0(今日重跑,全數 `missing_target`) | 顯著上升 | 09:18 n=9 · 09:24 n=8 · 09:37 n=7 | 🟡 方向相符但與 KI-004/S1 混淆(09:39 缺 `meta.scene.eye`),不單獨歸功 A1 |
| ④ | **守恆(關閉 FM-1)**:`Σ dYaw` vs `aim.yaw` 淨變化(hip-only) | — | 一致 ⇒ 證明修的是**歸屬**而非量值 | 三份新匯出殘差皆 ≤ 5.6e-16(浮點雜訊量級,機器精度內完全相等);`Σ dPitch` vs `Δaim.pitch` 同步驗證,殘差 ≤ 7.1e-16 | ✅ **通過,FM-1 關閉** |

- [x] ④ 是 **A1 內無法證偽的唯一假設**(FM-1 / R-2)——**已以機器精度通過,FM-1 視為關閉**。
- [x] ⚠️ **若 ④ 不成立** ⇒ 觸發選項 B 提前——**④ 成立,不觸發**。
- [ ] ~~②③ 的「顯著」門檻應在跑之前先寫下~~ — 未提前 pre-register 數值門檻(記為流程偏離,見 progress.md A2-S2/S4);但②③方向差距夠大(57-65% vs 79-95%;n=7-9 vs 0/4),任何合理門檻皆不影響結論。

**DoD**:四項數字與對照基線已寫入 [progress.md §2e](progress.md) 與 [BD-005](../BUGFIX-DECISIONS.md);④ 結論明確**成立**,不觸發選項 B。①的字面結果非 literal 0,經波形視覺化覆核(基準 = 孤立週期性深凹 vs 新匯出 = 貫穿性細碎鋸齒紋理)後,使用者確認接受此判讀,整體視為通過。

---

## A2-T3 — `seg-v2` 重掃與凍結 ✅ 已完成(2026-08-07)

- [x] 以**修法後的新匯出**重新掃參(**不得原地調 `seg-v1`**,D-28.7)。沿用 `run_sweep.py` 既有合成案例評分邏輯,放寬 SG window 至 `{5,7,9,11,13}`,**新增**以 A2-T1 三份真實匯出的 `merged_adjacent_peaks` 比例作為第二評分維度(seg-v1 原始掃參從未能用真實資料驗證)。
- [x] 重點:SG window 不再受「beat 週期 8」的約束 ⇒ 掃參空間與 `seg-v1` 的結論確實不同——最佳候選集中在 `window=11`(seg-v1 為 7)。
- [x] 一併決定 **TD-3**:使用者拍板**不改** `omega[0]=nan` 契約(A-D13)。
- [x] 於 [analysis-segments.md](../../operational/analysis-segments.md) §Frozen parameter registry 新增 `seg-v2` 列(`sg_window=11, peak_sigma_k=0.75, peak_floor_deg_s=60.0, low_ratio=0.1, stop_ratio=0.2`),並記錄真實匯出驗證段落。
- [x] 全鏈重跑(`run_pipeline.py`,含疊圖式視覺覆核):08:03/09:39(legacy)→ `seg-v1` 不變;09:18/09:24/09:37 + `synthetic_counterstrafe.json`(tick-integral)→ `seg-v2` 自動選版。

**候選確認**:使用者要求先看 seg-v1 vs 候選 A 在真實資料上的疊圖比較,確認 segment 起訖邊界逐位不變(只有 `merged_adjacent_peaks` 內部分類改善)後,才拍板採用候選 A(`floor=60`,merged 38.3%、success rate 98.3%,與 seg-v1 持平)而非 merged 更低但 success rate 較差的候選 B(`floor=100`)。

**DoD**:`seg-v2` 已註冊 [SEG_V2_PARAMS](../../../research/src/modules/segments/algorithms/submovement.py);`seg-v1`(`DEFAULT_SEGMENT_PARAMS`)列保留、原地不變,標為「僅適用於帶 aliasing 的 pre-KI-005 匯出」;`run_pipeline.py::run()` 依 `omega_deg_s(...).source` 自動選版;全鏈重跑產物可重現(見 [progress.md §2f](progress.md))。回歸:`tsc --noEmit` exit 0、`npm run test:ci` 不變、`uv run pytest` 221→228 passed(既有僅 1 案期望值刻意改寫)。

---

## A2-T4 — M14 ③④⑤ 重新宣告 ✅ 已完成(2026-08-07)

> **三項的解除條件不同,必須逐項判**。

| 項 | 撤回理由 | 解除條件 | 阻塞 | 判定 |
|---|---|---|---|---|
| **③** 合成 fixture 邊界誤差 ≤ 2 tick | 結論成立但**證據力失效**(合成訊號不含此假象,無法保證真實資料行為) | 以新匯出跑同一閘 | A2-T2 | ✅ **重新宣告** |
| **④** 真實資料分段成功率 0.95 | ①aliasing(KI-005)②**樣本無 counter-strafe 構念**(KI-006,**獨立理由**) | 兩者**同時**滿足 | A2-T2 **且** KI-006 解除 | ✅ **重新宣告** |
| **⑤** `seg-v1` 參數凍結 | SG window 7 < beat 8,凍結值在真實資料上不適用 | `seg-v2` 於新匯出上重掃並凍結 | A2-T3 | ✅ **重新宣告** |

### 逐項判定理由

**③**:A2-T2 已完成(§DoD)。A2-T3 進一步以**同一組**合成邊界案例重掃(放寬 SG window 至 `{5,7,9,11,13}`),135 組候選全數通過全部合成案例、`seg-v2`(`window=11`)max boundary error 仍 ≤ 2 tick——證據力較 A2-T2 當下更紮實(不只是「解除條件滿足」,凍結後的參數本身也重新過了同一道閘)。**重新宣告**。

**④**:兩個獨立撤回理由(KI-005 aliasing、KI-006 構念缺席)均已解除。
- KI-005 側:A2-T2 ④(守恆閘)以機器精度通過(殘差 ≤ 5.6e-16/7.1e-16),FM-1 關閉;A2-T3 的 `seg-v2` 已凍結並在三份真實匯出上驗證(success rate 1.00/0.95/1.00,合計 98.3%,與 `seg-v1` 持平)。
- KI-006 側:見下方「**KI-006 解除判定**」——B-1~B-5 五項驗收條件全數滿足,KI-006 本身自 OPEN 轉 CLOSED。
- 兩條件同時滿足,**重新宣告**。

**⑤**:A2-T3 已完成:`seg-v2`(`sg_window=11, peak_sigma_k=0.75, peak_floor_deg_s=60.0`)於三份真實 tick-integral 匯出上重掃並凍結,`seg-v1` 原地保留(D-28.7),`run_pipeline.py` 依 omega source 自動選版。**重新宣告**。

### KI-006 解除判定(2026-08-07)

依 [KI-006-C/README.md §6](../KI-006-C/README.md) B-1~B-5 逐項核對(獨立重跑 `run_pipeline` 覆核,見 [progress.md](progress.md)):

| # | 條件 | 判定 | 證據 |
|---|---|---|---|
| B-1 | 採集前明確要求受試者執行完整 counter-strafe(而非站樁 flick) | ✅ 滿足 | 使用者(研究者本人)於 2026-08-07 A2-T4 覆核時確認:採集前確實口頭要求過。此確認**發生於事後**(採集當時未留書面記錄,登記為 Surprise A2-S5),但研究者即採集者本人,對此事實有第一手權威 |
| B-2 | 每份新匯出通過 `check_construct_presence` 且 `present == true` | ✅ 滿足 | 三份新匯出獨立重跑 `run_pipeline` 皆 `constructPresence.present == true`,family=`counterstrafe` |
| B-3 | 採完立即跑本閘,不合格即當場重採 | ✅ 滿足 | A2-T1 checklist 逐項記錄「採完立即跑」,三份皆一次通過,無需重採 |
| B-4 | session 數 n > 2(至少 3 個) | ✅ 滿足 | 實得 3 個(09:18/09:24/09:37),OQ-KI6-4 已拍板達標 |
| B-5 | 同時滿足 KI-005 A2-T1 條件(240 Hz、`meta.mouseIntegration` + `dYaw/dPitch`) | ✅ 滿足 | 三份皆 240 Hz、`omega_deg_s(strict=True)` 皆解出 `source == "tick-integral"` |

**五項全數滿足 ⇒ KI-006 自 OPEN 轉 CLOSED**。B-1 的書面記錄缺口已如實記入 Surprise(A2-S5),不影響判定本身,因確認來源是採集者本人的第一手陳述,非事後臆測或合理化。

> **效度聲稱不擴大**:重新宣告僅恢復「儀器測到的訊號真實反映了 counter-strafe 行為」這一構念效度,措辭沿用既有限制——**單一匿名受試者、n=3 session、非母體層級證據**(比照 [KI-004-S1/README.md R-7](../KI-004-S1/README.md))。引用 A2-T2 四項複驗時必須誠實帶出:①非 literal 0(視覺覆核確認非根因復發,非「回傳 0」的原始 pre-register 字面表述)、③與 KI-004/S1 混淆(方向相符但非 A1 單獨證據,不單獨作為④的支持證據)。

- [x] 重新宣告的措辭已沿用 WP-28 既有的**效度限制**(樣本數、匿名單一受試者等);未因儀器修好就擴大效度聲稱(比照 [KI-004 R-7](../KI-004-S1/README.md) 的同一紀律)。
- [x] 對帳:[exec-plan/README.md](../../exec-plan/README.md) §3 M14 列 · `stage4/README.md` · [MAP.md](../../MAP.md) · WP-28 `progress.md`。
- [x] **WP-30 / WP-31 entry blocker** 三條理由全綠,**解除**:

  | 理由 | 出處 | 解除於 |
  |---|---|---|
  | ε(t) 量測原點錯誤 | KI-004 / S1 | ✅ 已解除(2026-08-06) |
  | ω(t) render/sim aliasing | KI-005 | ✅ 已解除(A2-T2/A2-T3,2026-08-07) |
  | 樣本無 counter-strafe 構念 | KI-006 | ✅ 已解除(A2-T4,2026-08-07,KI-006 CLOSED) |

**DoD**:三項逐項判定並記錄(見上表與判定理由);WP-30/31 blocker **三條理由全數解除,entry blocker 正式解除**——WP-30/WP-31 可展開。

---

## Commit message(各 task 落地時)

```
docs(ki-005): A2-Tn — <任務摘要>
```
