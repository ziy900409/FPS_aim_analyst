# WP-28 — Progress Log

> Running log。每個 task 完成時補一段(Progress / Decision Log / Surprises / Open Questions),與該切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| 日期 | Task | 結果 | 證據 |
|---|---|---|---|
| 2026-08-04 | (計畫展開) | WP-28 子資料夾建立;stage4 採納(GD-19/GD-20) | [../README.md](../README.md) · [DECISIONS.md](../../../DECISIONS.md) GD-19/GD-20 |
| 2026-08-04 | T0 | ✅ entry gate PASS;Python/uv/CI/fixture 決策與 C-D1~C-D4 已落 repo | Python 3.12.10 · uv 0.9.18 · `uv run pytest`:pytest 9.1.1,0 tests,exit 0 |
| 2026-08-04 | T0 upstream | ✅ M4 / WP-16 / M11 / M12 exit-gate 複驗 | [M4](../../../completed/stage1/wp-9-integration/T5-exit-gate.md) · [WP-16](../../../completed/stage2/wp-16-metrics-export-v2/T-exit-gate.md) · [M11](../../../completed/stage5/wp-23-longrange-tracking/T-exit-gate.md) · [M12](../../../completed/stage5/wp-25-ballistics-tracer/T-exit-gate.md) |
| 2026-08-04 | T0 schema baseline | ✅ schema v2 ingest 對表面確認 | [schema.md](../../../../operational/schema.md):tick `aim`/`keys`/`ads`;events `visible`/`counter`/`ads`/`fire`/`hit`;`meta.targets.hitbox`/`meta.weapon.ads|bullet` |
| 2026-08-04 | T0 sample | 🟡 真實匯出樣本仍未取得 | **M14 ① ingest 與 ④ 分段疊圖/成功率維持阻塞**;T1 合成匯出產生器只解鎖開發,不替代真實資料證據 |
| 2026-08-04 | T1 | ✅ scaffold + schema v2 ingest + dt report + deterministic synthetic export 完成 | `uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_t1_final`:**12 passed in 0.92s** |
| 2026-08-04 | T1 fixture | ✅ committed 合成 fixture 可重生且通過 round-trip | `synthetic_counterstrafe.json`:18,193 bytes / 48 ticks / 11 events;event types=`visible,counter,ads,fire,hit`;participantId=`anonymous-synthetic` |
| 2026-08-04 | T1 real-data gate | 🟡 真實匯出 round-trip 未執行 | **M14 ① blocker 維持**;樣本到位後放 `research/fixtures/exports/` 並補跑 ingest + dt report |
| 2026-08-04 | T2 | ✅ ω(t)/ε(t)/on_target + Python↔TS ε presentation parity 閘完成 | `uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_t2_final3`:**26 passed in 1.34s**;`npm run test:ci`:tsc PASS + Vitest **82 files / 641 tests passed** + Playwright **18 passed** |
| 2026-08-04 | T2 parity | ✅ `synthetic_counterstrafe` 逐 presentation 對表 `deriveTrackingMetrics`≤1e-9 | parity 覆蓋 acquisition failure + acquired 兩路;`tAcquireMs`/TOT/RMS/median/P95/null 語意全綠;TS 生產碼零修改 |
| 2026-08-04 | T2 units | ✅ rad→deg 邊界維持單點 | `rg -n "np\\.degrees" research/src`:命中僅 `modules/kinematics/algorithms/angular.py` 兩處 |
| 2026-08-04 | T3 | ✅ SG/Butter 契約 + submovement 分段 + `seg-v1` 凍結;合成立即 DoD PASS | targeted T3:`27 passed in 2.82s`;final full `uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_t3_final`:**53 passed in 4.53s** |
| 2026-08-04 | T3 sweep | ✅ 243 組(SG window × k × floor × low/stop ratio)決定性掃參;108 組通過六情境 | selected `seg-v1`:case failures=0,max boundary error=**1 tick**;CSV 9,824 bytes;重生 SHA-256 同為 `B83C726F…77E577B` |
| 2026-08-04 | T3 engine gate | ✅ research-only 變更未破壞引擎/parity gate | `npm run test:ci`:tsc PASS + Vitest **82 files / 641 tests passed** + Playwright **18 passed** |
| 2026-08-04 | T3 real-data gate | 🟡 真實 drill 分段成功率與 ω(t) 疊圖未執行 | **M14 ④ blocker 維持**;runner 已備妥 `--real-export`，樣本到位後產 summary/segments/overlay SVG |
| 2026-08-04 | T4 | ✅ `per_segment_apply` + `summarize_with_flags` + 封閉 quality vocabulary + `peek_index` 傳遞完成 | targeted T4:**8 passed in 1.47s**;final full `uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_t4_final`:**61 passed in 4.85s** |
| 2026-08-04 | T4 engine gate | ✅ per-segment research 變更未破壞引擎/parity gate | `npm.cmd run test:ci`:tsc PASS + Vitest **82 files / 641 tests passed** + Playwright **18 passed** |
| 2026-08-04 | T-exit script | ✅ 一鍵 script `src/report/run_pipeline.py` 交付並於合成匯出跑通 | `uv run python src/report/run_pipeline.py` exit 0:48 ticks / median dt 7.8125ms / gap 0 / 2 peeks / 2 segments / `seg-v1`;產 `out/pipeline-summary.json` + `peek-quality.csv` + `peek-segments.csv` |
| 2026-08-04 | T-exit gate ⑥ | ✅ research 閘全綠 | `uv run pytest -q -p no:cacheprovider --basetemp .pytest_tmp_texit_full`:**74 passed in 5.24s**,exit 0(T4 的 61 + 一鍵 script 13) |
| 2026-08-04 | T-exit gate ② | ✅ 引擎閘 + ε parity 全綠 | `npm.cmd run test:ci` exit 0:tsc PASS + Vitest **82 files / 641 tests passed** + Playwright **18 passed**;`epsilon-parity.test.ts` 單獨重跑 1 passed,逐 presentation 覆蓋五個量 ≤1e-9 |
| 2026-08-04 | T-exit gate ③ | ✅ 合成 fixture 邊界 ≤2 tick 維持綠 | `test_known_submovement_boundaries_are_within_two_ticks`(T3 掃參實測 max error = 1 tick) |
| 2026-08-04 | T-exit docs | ✅ `analysis-segments.md` 補一鍵 script 契約 + omega index 慣例 + 三條新限制;`research/README.md` 補指令 | [analysis-segments.md](../../../../operational/analysis-segments.md) §One-command pipeline / §Known limits |
| 2026-08-04 | **T-exit M14** | 🟡 **未宣告**:②③⑥ 綠,①④⑤ 阻塞於 OQ-S4-8 | [T-exit-gate.md](T-exit-gate.md) DoD 表;**WP-30/31 不得開工**,WP-29 可依 T1 ingest + 一鍵 script 先行 |
| 2026-08-05 | T-exit real fixture | ✅ OQ-S4-8 樣本到位且符合 fixture 政策 | `counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json`:27.390625s / 3,507 ticks / 20 visible / 22 fire / `participantId=P001`;PII-like literal scan 無命中;`suspect=false`,0 late events,無 overflow,display gate PASS |
| 2026-08-05 | T-exit gate ① | ✅ 真實 ingest + dt report | `run_pipeline.py --export ...` exit 0:3,507 ticks / median=expected=7.8125ms / gaps=0 / uniform=true |
| 2026-08-05 | T-exit gate ④ | ✅ 真實分段成功率 + 疊圖報告 | `seg-v1`:19/20 peeks,success rate=**0.95**,19 segments;20 張 `real-peek-*-overlay.svg` + summary/segments CSV 產出 |
| 2026-08-05 | T-exit gate ⑤ | ✅ 全 20 張疊圖人工檢核支持保留 `seg-v1` | 19 段皆包住主要 ω burst,起訖落在合理起升/回落處;15 個 `merged_adjacent_peaks` 均為同一 noisy burst 內合併,未見跨兩個獨立 burst;peek 0 長靜止窗為 `below_floor|no_segment`;單樣本效度限制回寫 `analysis-segments.md` |
| 2026-08-05 | T-exit regression | ✅ 雙閘複驗 | `uv run pytest --basetemp .pytest_tmp_t_exit_20260805`:**74 passed in 4.52s**;`npm.cmd run test:ci`:tsc PASS + Vitest **82 files / 641 tests** + Playwright **19 passed** |
| 2026-08-05 | **T-exit M14** | ✅ **六項 DoD 全綠,M14 正式宣告** | OQ-S4-8 關閉;[T-exit-gate.md](T-exit-gate.md);**WP-30/31 entry blocker 解除** |
| 2026-08-06 | **M14 ② 重新宣告** | ✅ [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1 落地後,以閘 ①/② + 重產 parity 為證據重新宣告 ② | 見下方「M14 ② 重新宣告」段;**WP-30/31 entry blocker 因 KI-005/KI-006 仍維持** |
| 2026-08-06 | KI-005 A1 落地(見 [KI-005-A/](../../../../known_issue/KI-005-A/README.md)) | ✅ 量測儀器修法(選項 A)已落地,**不是 M14 ③④⑤ 的重新宣告** | `ticks[].dYaw/dPitch` 依事件時間戳積分上線 + `omega_deg_s` 雙 source(`tick-integral`/`aim-diff-legacy`);對帳詳見 [KI-005-A/T6](../../../../known_issue/KI-005-A/T6-docs-ledger-reconcile.md)。**M14 ③④⑤ 仍撤回**——解除需 A2(新採樣 → 複驗 → `seg-v2`,⛔ blocked)完成;**WP-30/31 entry blocker 仍維持** |
| 2026-08-07 | **M14 ③④⑤ 重新宣告**(見 [KI-005-A / A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)) | ✅ A2(T1–T4)全數完成後,以新採樣 + 複驗 + `seg-v2` 重掃 + KI-006 解除判定為證據重新宣告 ③④⑤ | 見下方「M14 ③④⑤ 重新宣告」段;**WP-30/31 entry blocker 三條理由(KI-004/KI-005/KI-006)全數解除** |

---

## 事後更正(2026-08-05)— M14 ② 撤回

排查 WP-29 的匯出資料時發現 ε(t) 的**量測原點**錯誤,詳見 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / [BD-004](../../../../known_issue/BUGFIX-DECISIONS.md)。

- **缺陷**:`trackingDerivation`/`detectionDerivation` 與移植過去的 `angular.py` 都把射線原點寫死為 `(px, eyeY, pz)`,遺漏 ① camera base offset(`field-low` 的 `eyeZ = depth/2 − standoff = 4`)② `SIM_TO_WORLD = 0.01`。
- **實測**(ground truth = 引擎自身的 `fire.offsetDeg`):08:03 偏差中位數 **12.52°**、09:39 **67.11°**;正確公式為 0.21° / 0.14°。
- **為何 T2 的 parity 閘沒抓到**:parity 是**一致性**閘,Python 忠實移植了同一個錯誤原點 → 兩側一致地錯,≤1e-9 恆綠。這是 S-28.0 當初擔心的「假綠」的另一種形態:不是 Python 與 TS 分裂,而是**兩者一起偏離構念**。
- **處置**:M14 ② 撤回,①③④⑤⑥ 維持(分段走 ω(t),只依賴 `aim`,與原點無關)。T2/T-exit 的 task 交付物本身不需重做,但 S1 落地後須**重產 parity fixture 並重新宣告 ②**。
  > ⚠️ **2026-08-06 更正**:上一句「①③④⑤⑥ 維持」中的 **③④⑤ 已撤回**,見下方「事後更正(2026-08-06)」。就本條的**量測原點**缺陷而言該推論仍正確,但 `aim` 另有獨立缺陷。
- **新增閘(S1 DoD)**:`fire.offsetDeg` 與 ε(t) 互驗(同構念、不同實作路徑、不同資料來源),以及涵蓋 `eyeZ ≠ 0 且 px ≠ 0` 的合成幾何 fixture —— 現行 T2 幾何 fixture 全為原點 `(0,·,0)` 的靜態情境,結構上看不見此 bug。

---

## 事後更正(2026-08-06)— M14 ③④⑤ 撤回

檢視 [overlay-contact-sheet.png](../../../../../research/out/overlay-contact-sheet.png) 時發現 ω(t) 主 burst 內有規律的單 tick 深凹口,追查後確認**兩個相互獨立**的缺陷,詳見 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) / [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md) 與 BD-005 / BD-006。

- **缺陷 1(KI-005)**:`state.aim` 由 **render path**(`CameraController.applyDelta`,~240 Hz)寫入、由 **sim path**(128 Hz)讀取 → zero-order-hold aliasing。240/128 = 1.875 幀/tick ⇒ 每 **8 tick** 有一個只夾到 1 幀位移。**角位移總量正確,錯的是歸屬到哪個 tick。**
- **決定性驗證**:以 `meta.frames.series` 重建逐幀時間、預測每 tick 夾到幾幀,再與實測 ω 比對 —— `corr = 0.805`;1 幀 tick 正規化 ω **0.550**(ZOH 模型預測 0.533)、2 幀 tick **1.108**(預測 1.067)、1 幀 tick 佔比 **12.7%**(預測 12.5%)。三項預測全中,ω 側未做任何擬合。
- **缺陷 2(KI-006)**:M14 ④/⑤ 引用的 08:03 樣本 `vx ≠ 0` 的 tick = **0**、`keys` 全程 `[]`、`counter` 事件 **0** —— 是站樁純 flick,**counter-strafe 構念從未被執行**。此事實首見於 [KI-004 §2 對照表](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md),但當時未追究其對構念效度的後果。
- **為何合成掃參沒抓到 KI-005**:`make_synthetic_export` 直接產生 `aim`/ω 序列,**完全不經 render path**,合成訊號結構上不可能含此假象。243 組掃參與 `seg-v1` 凍結值(**SG window = 7**)全在理想訊號上調出;而 beat 週期 = **8 tick**,**濾波窗短於假象週期,數學上不可能濾除** —— 這正是 `merged_adjacent_peaks` 15/19、有效產率僅 **4/19(21%)** 的直接成因。
- **處置**:**③④⑤ 撤回,①⑥ 維持**(① ingest/dt 屬 schema 與取樣層,⑥ 為 pytest 綠燈,皆不涉 aim 差分與行為內容)。**WP-30/31 entry blocker 維持**,現有三條獨立理由(KI-004 / KI-005 / KI-006)。重新宣告條件見 [T-exit-gate.md](T-exit-gate.md)。
- **架構層教訓**:BD-004 的結論是「parity 是一致性閘,無法發現兩側一起錯」;本次再加兩條同構的 —— **合成 fixture 看不見 render/sim 交界的缺陷**,以及**一致性閘與目視檢核無法發現「量錯了對象」**(疊圖不顯示 `vx`/`keys`,站樁 flick 本就會產生漂亮單峰)。

## M14 ② 重新宣告(2026-08-06)

[KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) S1 已落地(commits `43675ab`/`f6027ed`/`465f986`/`6f4b540`;決策見 [BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md) BD-004「S1 落地」段;任務拆解見 [KI-004-S1/](../../../../known_issue/KI-004-S1/README.md))。依 [KI-004-S1/T6](../../../../known_issue/KI-004-S1/T6-ledger-m14-reconcile.md) 與 OQ-S4-5(建議門檻:parity 重產後綠 + 閘 ① 兩份真實 fixture 綠),**M14 ② 重新宣告**。

**新證據**(取代 2026-08-05 撤回時的舊值):

| 項目 | 修法前 | 修法後 |
|---|---|---|
| 閘 ①(`fire.offsetDeg` oracle,08:03,N=1 合格首發) | 8.19°(> 0.5° 容差,紅) | **0.000°**(≤ 0.5°,綠) |
| 閘 ①(09:39,N=1) | 88.53°(紅) | **0.030°**(綠) |
| 閘 ②(`eyeBase.z≠0` 且 `px≠0` 閉式幾何,TS/Python 各一份) | — (該情境先前無 fixture 覆蓋) | 相對誤差 **≤1e-9** |
| `epsilon-parity.test.ts` | 機制綠但兩側一致地錯(D2a+D2b 未修正) | **重產後綠**;`options.eyeOrigin.source === 'meta'`(消費匯出自帶的 `meta.simToWorld`/`meta.scene.eye`,非 `legacy-default`) |
| 回歸 | — | `tsc --noEmit` exit 0;`npm run test:ci` **88 files / 694 tests + 19 e2e** 全綠;`uv run pytest` **183 passed**;`src/sim`/`SharedState`/`SimLoop.step` 零 diff |

> 對照:早期以「全部 20 筆 firstShot fire」(未套用閘 ① 的 `aimPunchPitch/Yaw==0` 篩選)粗量級核對時,08:03/09:39 修法前偏差中位數為 12.52°/67.11°(即 KI-004 診斷階段引用的數字);閘 ① 的實際篩選口徑下兩份 fixture 各僅 N=1 合格首發,如上表。兩種口徑的方向與量級結論一致(見 [KI-004-S1/progress.md](../../../../known_issue/KI-004-S1/progress.md) S-S1.2)。

**效度限制不擴大**:本次重新宣告只恢復 ε(t) 地基的**正確性**(量測原點修正 + 兩道正確性閘上線),**不增加樣本效度**——沿用既有措辭「效度聲稱限單一匿名 counter-strafe 樣本」。

**WP-30/31 entry blocker 現況**:M14 ②③④⑤ 曾因三條**相互獨立**的理由撤回:KI-004(ε 原點)、KI-005(ω(t) render/sim aliasing)、KI-006(真實樣本無 counter-strafe 構念)。**本次重新宣告只解除 KI-004 這一條**——② 恢復。**KI-005(🟡 已定解法待落地)與 KI-006(🔴 已確認、處置待拍板)仍未落地,③④⑤ 依舊撤回,WP-30/31 entry blocker 整體維持**,尚不得展開。①⑥ 不受任何一條缺陷影響,持續維持。

> **對帳(2026-08-06,KI-005-A/T6)**:KI-005 一列現況更新為「🟡 A1(量測儀器修法)已落地,A2(新採樣)待排程」——上一段寫作時 KI-005 尚在「已定解法待落地」階段,現已完成 A1。這**不改變本段結論**:A1 交付的是儀器正確性,不是效度證據,③④⑤ 的解除仍需 A2 的新採樣 + 複驗 + `seg-v2` 重掃,KI-006 仍待拍板,**WP-30/31 entry blocker 依舊維持**。

## M14 ③④⑤ 重新宣告(2026-08-07)

[KI-005-A / A2(T1–T4)](../../../../known_issue/KI-005-A/A2-blocked-plan.md)全數完成(新採樣、四項複驗、`seg-v2` 重掃凍結、M14 重新宣告 + KI-006 解除判定),詳見 [KI-005-A/progress.md §2g](../../../../known_issue/KI-005-A/progress.md)。

**新證據**(取代 2026-08-06 撤回時的判定):

| 項 | 撤回理由 | 解除證據 |
|---|---|---|
| **③** 合成 fixture 邊界誤差 ≤2 tick | 合成訊號不經 render path,結構上看不見 render/sim aliasing,證據力失效 | A2-T2 完成;A2-T3 以同一組合成邊界案例重驗證(放寬 SG window 至 `{5,7,9,11,13}`,135 組候選全過,max boundary error ≤ 2 tick) |
| **④** 真實資料分段成功率 0.95 | ①aliasing(KI-005)②樣本無 counter-strafe 構念(KI-006),兩條獨立理由 | KI-005 側:A2-T2 守恆閘機器精度通過(`Σ dYaw` vs `Δaim.yaw` 殘差 ≤ 5.6e-16),FM-1 關閉;A2-T3 `seg-v2` 已凍結。KI-006 側:[KI-006-C/README.md §6](../../../../known_issue/KI-006-C/README.md) B-1~B-5 驗收清單經 [A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 逐項核對全數滿足,KI-006 轉 CLOSED |
| **⑤** `seg-v1` 參數凍結 | SG window 7 < beat 8,凍結值於真實資料不適用 | A2-T3 已重掃凍結 `seg-v2`(`sg_window=11, peak_sigma_k=0.75, peak_floor_deg_s=60.0`),三份真實匯出驗證優於 `seg-v1`(success rate 1.00/0.95/1.00,合計 98.3%,與 `seg-v1` 持平) |

**效度聲稱不擴大**:本次重新宣告延續 M14 ② 重新宣告的同一紀律——沿用既有效度限制「單一匿名 counter-strafe 受試者、n=3 session、非母體層級證據」。引用 A2-T2 四項複驗時如實帶出:①非 literal 0(視覺覆核確認殘餘凹口為訊號雜訊底噪、非根因復發,非原始 pre-register 期望的「回傳 0」字面表述)、③與 KI-004/S1(`meta.scene.eye` 缺席)混淆,不單獨作為④的證據。

**WP-30/31 entry blocker 現況**:M14 ②③④⑤ 曾因三條相互獨立的理由撤回:KI-004(ε 原點)、KI-005(ω(t) render/sim aliasing)、KI-006(真實樣本無 counter-strafe 構念)。**三條理由現已全數解除**——KI-004 於 2026-08-06(S1 落地)、KI-005 與 KI-006 於 2026-08-07([A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07))。**WP-30/31 entry blocker 正式解除,可展開**。①⑥ 不受任何一條缺陷影響,持續維持。

## Decision Log

| # | 決策 | 理由 | 出處 |
|---|---|---|---|
| D-28.0 | research 層 = Python 3.12 + uv;Python 閘不進 `test:ci`,改雙向 parity/golden fixture 進 `test:ci` + 獨立 `uv run pytest` | 移植對象是 performance_analysis Python 實作(scipy 生態必要);`test:ci` 是每 stage 的引擎不變式閘,加 Python 相依會讓純引擎工作在無 uv 機器上卡住;跨語言漂移仍由 fixture 對表捕捉 | 使用者確認(2026-08-04)· GD-19 · [../README.md §2.4a](../README.md) |
| D-28.1 | committed 真實匯出 fixture 上限 = 30s(約 3840 ticks),`participantId` 匿名化,落 `research/fixtures/exports/` | 控制 repo 體積與個資暴露;長 drill 僅本機分析。Alternatives Considered:commit 完整長 drill(拒絕:repo 膨脹/個資風險)、只用合成資料(拒絕:M14 需真實效度證據) | 使用者確認(2026-08-04)· GD-19 · OQ-S4-8 |
| D-28.2 | T0 使用 `pytest-custom-exit-code` 僅抑制 `NO_TESTS_COLLECTED`,讓指定的零測試空跑為綠 | pytest 9.1.1 原生在 0 tests 回傳非零,與 T0 DoD 衝突;plugin 不抑制 collection error 或 test failure。Alternatives Considered:提前加 smoke test(拒絕:T1 tests tree out of scope)、包 shell `||`(拒絕:不再是指定的 `uv run pytest` 閘) | T0 本機驗證(2026-08-04) |
| D-28.3 | `load_export(path)` 是 `algorithms/` 唯一受 T1 明文要求的 read-only I/O boundary;其餘 algorithms 仍維持純函式,所有寫檔只在 notebook-side generator | T1 interface contract 指定 path loader 與 `algorithms/loader.py`,但 C-D2 泛稱禁 file I/O;以更具體契約限縮例外,並用 import 純度測試鎖住零副作用。Alternatives Considered:移到 adapter 目錄(拒絕:偏離已採納 interface path)、讓 algorithms 寫 fixture(拒絕:C-D2 且混合計算/輸出) | T1 contract + purity test(2026-08-04) |
| D-28.4 | T1 有實質 tests 後移除 T0 的 `pytest-custom-exit-code` | 已不再需要抑制 0-test exit;保持 dev dependency 最小。Alternatives Considered:永久保留 plugin(拒絕:無用途的測試依賴) | T1 pyproject/uv.lock(2026-08-04) |
| D-28.5 | `omega_deg_s` 的 yaw `cos(pitch)` 校正採相鄰兩 tick 的 midpoint pitch | midpoint 對離散區間兩端對稱,且在 pitch 同時改變時比固定取前一 tick 少方向性偏差;高 pitch/變 pitch fixture 鎖死。Alternatives Considered:前一 tick pitch(拒絕:非對稱且規格已允許更準確的 midpoint) | T2 angular.py + geometry fixtures(2026-08-04) |
| D-28.6 | filter 退化輸入採明確 `ValueError`;只有 `segment_submovements` 對短於 SG window 的訊號採 raw fallback 並加 `sg_fallback_short_signal` | filter 簽名沒有 flag channel，回 raw 會靜默；分段結果有可觀測 flag，可安全保留短窗分析。Alternatives Considered:兩層都拋錯(拒絕:短 peek 無法產生可聚合品質結果)、兩層都 fallback(拒絕:底層呼叫者無法辨識未濾波) | T3 filter/segment contract tests(2026-08-04) |
| D-28.7 | pre-register `seg-v1`=`SG(7,3),k=0.5,floor=80deg/s,low=0.1,stop=0.2`;真實資料若否證只能升版重跑 | w=7≈55ms 且 k/ratio 沿移植骨架；80deg/s 取候選中點，避免 60 的噪聲敏感與 100 的低幅修正漏檢；六組合成 max error=1 tick。Alternatives Considered:等真實資料後才選(拒絕:形成看資料調參)、取所有通過組 ensemble(拒絕:無單一可追溯契約) | T3 243-grid sweep(2026-08-04) |
| D-28.8 | 空分段回傳 list-compatible `SegmentList`，以 `result.flags` 承載 `zero_motion`/`below_floor`/`no_peak` | 契約要求回空 list 又要求正確 flag，普通空 list 無 Segment 可掛旗標；list subclass 保持既有迭代/equality 語意並補上 machine-readable outcome。Alternatives Considered:塞 sentinel Segment(拒絕:不再是空段)、只發 warning(拒絕:難以進 T4 聚合) | T3 empty-result tests(2026-08-04) |
| D-28.9 | `QUALITY_FLAG_VOCABULARY` 同時枚舉 T4 必要旗標與 T3 已存在的 trace/segment flags；動態失敗只允許 `compute_failed:<非空 reason>` 模板 | 若只照 T4 列出的六個 exact flags，T3 合法輸出會在逐段入口被判非法；模板保留實際失敗原因又可封閉驗證。Alternatives Considered:丟棄 T3 flags(拒絕:品質資料遺失)、接受任意字串(拒絕:無法枚舉)、每個 exception reason 都預列 exact flag(拒絕:不可行) | T4 vocabulary closure tests(2026-08-04) |
| D-28.10 | `Segment.peek_index` 採 nullable non-negative integer，`per_segment_apply` 原樣傳遞並禁止 `fn` 覆寫 | WP-29 才擁有 peek 重建；nullable default 保持 T3 呼叫相容，同時先固定 join 欄位契約。Alternatives Considered:由 T4 重建 peek(拒絕:越界)、只靠列順序(拒絕:跨表 join 脆弱)、允許 fn 產生 index(拒絕:每個指標可漂移) | T4 contract tests(2026-08-04) |
| D-28.11 | 一鍵 script 落 `research/src/report/run_pipeline.py`（report 層），不落 `algorithms/` 也不落單一模組的 `notebooks/` | C-D2 禁 `algorithms/` I/O，而此 script 是跨模組 CLI 入口；塞進任一模組的 notebooks 會把 WP-29/30/31 的共同入口埋在 segments 底下。`src/report/` 本就是 stage4 的「notebook → 輸出」層，寫檔與 print 在此合法。Alternatives Considered:`research/run_pipeline.py` 置根(拒絕:繞開四目錄制)、`segments/notebooks/t-exit/`(拒絕:跨模組入口錯置) | T-exit script(2026-08-04) |
| D-28.12 | 一鍵 script 只把 `omega[1:]` 餵給 `segment_submovements`，回報索引以 `_OMEGA_INDEX_OFFSET` 映回 tick frame | `omega[0]` 依契約為 `nan`（描述區間 `(i-1, i]`，首筆**未定義**而非缺值）。整條餵入雖被 T3 接受，卻讓每個 export 的每一段都掛 `non_finite_interpolated`，而 `summarize_with_flags` 排除任何有旗標的列 → 品質摘要恆為 `n=0`，聚合形同廢掉。切尾不製造樣本，索引映射為精確 +1（合成 fixture 的 `start_idx=1`/`end_idx=9` 前後逐位一致）。Alternatives Considered:改 T3 的 flag 行為(拒絕:動已凍結契約，須升版)、把 `omega[0]` 補 0(拒絕:對未定義樣本造值)、只在文件註明 `n=0` 屬預期(拒絕:等於交付一份無用的品質摘要) | T-exit `test_undefined_leading_omega_sample_does_not_flag_segments`(2026-08-04) |
| D-28.13 | 一鍵 script 的逐段值（`duration_ms`/`peak_omega_deg_s`/`mean_epsilon_deg`）明文標為 pipeline 診斷，不是教練報告指標 | 三者皆為既有權威量的直述（段界時間戳、`Segment.peak_omega`、權威 ε(t) 的段內均值），不新增構念；但未過構念驗證，依 C-D3/GD-20 不得進教練報告。Alternatives Considered:加段內 on-target%(拒絕:TOT 定義在 `t_acquire` 起的追蹤窗，段內版本 = 第二定義，違 C-D4)、完全不出逐段值(拒絕:`per_segment_apply` 與品質摘要就沒有可示範的載體) | T-exit script docstring + [analysis-segments.md](../../../../operational/analysis-segments.md)(2026-08-04) |
| D-28.14 | `non_uniform_dt` 只掛在**含該 gap 的 presentation 窗**，不由 export 層 dt 報告一律下掛;export 層 gap 數/清單仍完整寫入 summary | 全域下掛時，30s 真實匯出只要掉一個 tick 就讓 100% 的段帶旗標 → `summarize_with_flags` 再次回 `n=0`，與 D-28.12 同一類「聚合被廢掉」缺陷。窗界切片本就按序分割 ticks，故以 gap 的全域 tick index 落在哪個窗來歸屬是精確的，不是近似。Alternatives Considered:全域下掛(拒絕:如上)、完全不下掛只留 summary(拒絕:逐段消費者看不到自己這段不可信) | T-exit `test_dt_gap_flags_only_the_peek_that_contains_it`(2026-08-04) |
| D-28.15 | 一份匿名真實匯出的 0.95 成功率 + 20 張疊圖人工檢核足以支持 M14 保留 `seg-v1` 不調參;效度聲稱限於本樣本 | Gate 要求的是真實成功率、疊圖與 pre-registered 參數效度檢核,不是 population validation。19 個成功區段皆合理包住主要 burst,15 個 merge flag 未見跨獨立 burst;依 D-28.7 不因單樣本看結果調參。T3 evidence runner 的 leading-`nan` flag 污染只影響其 CSV flags,不影響疊圖幾何/成功率;權威 pipeline 已依 D-28.12 正確切尾 | 真實 fixture + pipeline/sweep/人工檢核(2026-08-05) |

---

## Surprises

| # | 意外 | 影響 | 處理 |
|---|---|---|---|
| S-28.0 | ε(t)/on-target/t_acquire/peek 窗界**已有 TS 權威實作**(`trackingDerivation.ts` + `analysis-tracking.md`),草稿誤認為本 stage 新推導 | 若只做單向 parity,全部逐段指標建在未對表的 ε 上,M14 綠燈是假的 | 採納時改為 **parity 雙向**,並把 ε 對表列為 T2 DoD 首項(GD-19) |
| S-28.1 | schema 沒有 `kill`/`timeout` 事件;`counter` 事件是**條件性**的(僅在反向鍵按下且 `vx` 反號時記錄) | peek outcome 與 Sync 族的缺事件是常態語意,不是資料缺失 | outcome/t_hit 改為推導(`fire.hit` / `hit` 事件);缺事件一律走 `flags`,不吞成 NaN(WP-29 T1/T2) |
| S-28.2 | pytest 9.1.1 收集 0 tests 時原生退出非零,不是 T0 文案所述的綠燈 | 若不處理,T0 無法同時滿足「不提前開 T1 tests tree」與 `uv run pytest` exit 0 | dev-only `pytest-custom-exit-code` + `--suppress-no-test-exit-code`;實測 0 tests / exit 0 |
| S-28.3 | Windows `%TEMP%/pytest-of-*` 與 escalated pytest 產物有 ACL 限制 | 首輪 3 passed / 8 setup errors,錯誤全為 `PermissionError`,非 assertion failure | 正式閘固定 workspace `--basetemp` 並停用 cacheprovider;`.pytest_*`/cache/venv 納入 `research/.gitignore` |
| S-28.4 | C-D2 泛稱 `algorithms/` 禁 I/O,但 T1 同時指定 `algorithms/loader.py:load_export(path)` | 若不記邊界,後續可能誤把此必要 read adapter 擴張成一般演算法 I/O | D-28.3 限縮為 loader call-time read-only 例外;import/其他 algorithms/所有 writes 仍受純度閘約束 |
| S-28.5 | ω combined fixture 首輪把 30° yaw + 40° pitch 誤寫成未套 midpoint-pitch 校正的 50°/s | core 首輪為 10 passed / 1 failed,若照錯誤 golden 修改演算法會違反 T2 公式 | 依 `sqrt((Δyaw·cos(midpoint pitch))²+Δpitch²)/Δt` 修正 fixture 為 48.935876°/s;重跑後 11/11 core tests PASS |
| S-28.6 | T3 的 `segment_submovements(...) -> list[Segment]` 與「零/等速回空段 + 正確 flag」同時成立時，普通 list 沒有承載 trace-level flag 的位置 | 若只回 `[]`，T4 無法區分零運動、低於 floor、連續等速無 peak | D-28.8 採 list-compatible `SegmentList.flags`;正常 Segment 仍各自保有 flags |
| S-28.7 | T4 文案列出的 vocabulary 未包含 T3 已實際產生的 `zero_motion`/`no_peak`/SG 與 non-finite flags | 若逐字只建六個 exact flags，T3→T4 的正常資料會被改寫成 compute failure | 依「新增 flag 必須加入詞彙表」將全部既有 T3 flags 納入常數與 `analysis-segments.md`，並用 closure test 鎖定 |
| S-28.8 | T3/T4 各自綠燈，但把兩者串成一鍵 pipeline 後才暴露:`omega[0]` 的契約 `nan` 會讓**每一段**掛 `non_finite_interpolated`，`summarize_with_flags` 因此排除 100% 的列 | 品質摘要恆為 `n=0`/`mean=null`，WP-29/30/31 拿到的聚合層形同廢掉;單元測試看不到,因為 T3 測試直餵合成 ω 陣列(無 leading nan),T4 測試直建 `Segment` | D-28.12 在 pipeline 側切尾 + 索引映回;新增 `test_undefined_leading_omega_sample_does_not_flag_segments` 鎖住「乾淨匯出不得整批掛旗標」 |
| S-28.9 | presentation 窗界切片邏輯已在 t2 parity generator 與 t3-sweep runner 各有一份，一鍵 script 是第三份 | 三份若漂移，ε/分段/parity 會各自對到不同 tick 窗，M14 ② 綠但下游全錯 | 一鍵 script 逐字沿用 parity generator 的 tolerance 慣例並在原始碼註明;整併留給擁有 peek 窗重建的 WP-29(記為 OQ-S4-9) |
| S-28.10 | 真實 sweep 才暴露 `run_sweep.py` 仍把 leading `omega[0]=nan` 整條餵入分段器,使 19/19 CSV rows 掛 `non_finite_interpolated` | 疊圖幾何與 19/20 成功率仍正確,但 sweep CSV flags 不可作乾淨品質證據;若不註記會與 D-28.12/operational contract 矛盾 | M14 以權威 pipeline 的乾淨品質摘要 + sweep 疊圖幾何判定;限制回寫 `analysis-segments.md`;runner 對齊併入 OQ-S4-9 的窗界實作整併 |

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| OQ-S4-8(樣本) | 真實 drill 匯出樣本(≤30s、匿名)未取得 | ✅ **關閉(2026-08-05)**:`counterstrafe_ad_v1` 27.390625s / `P001`;① ingest/dt、④ 0.95 成功率+20 疊圖、⑤ 人工檢核均完成;M14 已宣告 | 使用者 | 2026-08-05 |
| ~~OQ-S4-9~~ | ~~presentation 窗界切片有三份實作(t2 parity generator / t3-sweep runner / T-exit 一鍵 script)~~ | ✅ **關閉(2026-08-05,WP-29 T1 atomic commit)**:三者皆改用 `metrics.algorithms.peek.build_peek_windows`;三份 fixture 的窗內 tick 索引逐位一致,pipeline `dtReport`/`segmentation` 逐位不變,t3 21 列分段形狀不變且 leading-ω `non_finite_interpolated` 旗標 21→0 | WP-29 | 2026-08-05 |
| OQ-S4-2 | 分段閾值 / SG window 的 128Hz 起點數值 | ✅ `seg-v1` 已在看真實資料前 pre-register 凍結(D-28.7);2026-08-05 真實樣本 19/20 + 疊圖人工檢核支持保留(D-28.15) | 研究者 | 2026-08-05 |
