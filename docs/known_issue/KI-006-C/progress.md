# KI-006 / C — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-006](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-06 | 計畫 | ✅ C tech spec + T0–T3 + T-exit 產出 | 本資料夾;上游 [KI-006 §4-C](../KI-006-m14-sample-no-counterstrafe.md) / [BD-006](../BUGFIX-DECISIONS.md) |
| 2026-08-06 | 計畫拍板 | ✅ 三項設計取捨定案:**D-C1** Python registry(非引擎自我描述)· **D-C2** flag + 非零 exit(非 `load_export` 拋錯)· 選項 **B 委派** [KI-005-A / A2](../KI-005-A/A2-blocked-plan.md) | 使用者裁示;連帶關閉 OQ-C-0,並使本階段 NFR-C-1「引擎零改動」成立 |
| 2026-08-07 | [T1](T1-construct-registry.md) | ✅ `construct.py`(registry `construct-v1` + 家族解析 + 檢查純函式 + flag 詞彙)落地 | 新增 `research/src/modules/ingest/algorithms/construct.py` + `tests/test_construct.py`(20 案);`__init__.py` 匯出新符號;`test_purity.py` 匯入清單納入 `construct` 模組。四份 committed fixture 判定與 T0 重現值逐格相符(08:03 absent / 09:39 present / synthetic_counterstrafe present 家族=`counterstrafe` / synthetic_timeline unknown)。`uv run pytest` 195→**215 passed**,既有案期望值零改寫。`git status --short` 僅 4 個 ingest/algorithms 檔,無 `src/`、無 `run_pipeline.py` |
| 2026-08-07 | [T2](T2-pipeline-wiring.md) | ✅ `run_pipeline` 佈線:`constructPresence` 區塊 + 專屬 exit code 2 + stderr 拒絕訊息 | `run()` 於 `load_export` 後呼叫 `check_construct_presence`,寫入 `summary["constructPresence"]`(drillId/family/construct/present/paramsVersion/counterEventCount/tickCount/movingTickCount/movingTickRatio/thresholds/flags);`run()` 不提前 return,三個 artifact 照常寫出。`main()` 新增 `EXIT_CONSTRUCT_ABSENT = 2` 常數與 module docstring exit code 表(0/1/2)。實跑四份 fixture 與 spec 逐格相符:08:03 → **exit 2**,三個 artifact 仍存在,`constructPresence.present == false`、`flags == ["construct_absent:counter-strafe"]`,stderr 含 drillId/構念名/實測值/門檻值且不含「failed」字樣;09:39 → exit 0、present true;預設 `synthetic_counterstrafe.json`(`DEFAULT_EXPORT`)→ exit 0、present true、family=`counterstrafe`(FM-6 閘在預設路徑生效);`synthetic_timeline.json` → exit 0、present null、flags=`["construct_unknown"]`。`test_run_pipeline.py` 新增 7 案(既有 14 案期望值零改寫)。`uv run pytest` 215→**221 passed**。`npx tsc --noEmit` exit 0。`git diff --stat` 僅 `research/src/report/run_pipeline.py` + `research/src/report/tests/test_run_pipeline.py` 兩檔,無 `src/` 路徑 |
| 2026-08-07 | [T3](T3-docs-ledger-reconcile.md) | ✅ 文件 / 帳本對帳 + A2 前置條件回寫,零程式碼改動 | [analysis-segments.md](../../operational/analysis-segments.md):flag 表新增 **Level** 欄(既有 13 個依實際發射點標 `peek`/`segment`/兩者皆有;讀碼確認 `non_uniform_dt`/`missing_target`/`sg_fallback_short_signal`/`non_finite_replaced`/`non_finite_interpolated` 為 trace 級旗標,既寫進 peek 級 `SegmentList.flags` 也隨 `trace_flags` 傳進每個由該 trace 產出的 segment,故標「peek, segment」雙層級,非任選其一)+ 新增兩列 session 級 flag(`construct_absent:<construct>`/`construct_unknown`)+ 一段說明 `QUALITY_FLAG_VOCABULARY`(segments)與 `CONSTRUCT_FLAG_VOCABULARY`(ingest)刻意不合併之理由;Frozen parameter registry 新增 `construct-v1` 列(`min_counter_events=1`/`min_moving_tick_ratio=0.05`)並註明調整須升版;“Real-export validation” 段加註 08:03 樣本不含 counter-strafe 構念、`construct-v1` 判定 absent、「clears M14's real-data validity gate」撤回,並明記與 KI-005 為獨立第二撤回理由。[research/README.md](../../../research/README.md):fixture 表新增 `construct-v1` 判定欄(08:03 absent/exit 2、09:39 present/exit 0)、09:39 的 KI-004 警語更新為「S1 已修,歷史記錄」、Parameter registry 段補 `construct-v1` 一行。[CONTEXT.md](../../../CONTEXT.md):新增 **construct presence gate** 詞條(緊接 reliability gate 之後),互相指路 + 差異對照(問題/層級/時機/權威 四維度用連續散文表達,非 markdown 子表格,因表格 cell 不可巢狀)+ drill 家族命名慣例(`<family>_<variant>_v<n>`,合成加 `synthetic_` 前綴)一併記入。帳本對帳:[KI-006](../KI-006-m14-sample-no-counterstrafe.md) 頂部狀態改「🟡 C 已落地;B 待 A2」、§4 選項 C 標「✅ 已落地(2026-08-07)」、§6 OQ-KI6-2/OQ-KI6-3 關閉(劃線)、OQ-KI6-1/OQ-KI6-4 維持並改指向本檔 §6 B-1~B-5/B-4;[BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) §1 索引列狀態更新為「🟡 C 已落地,B 待新採樣」、BD-006 標頭改 🟡、新增「C 落地(2026-08-07)」段(四份 fixture 判定與實測值、D-C5 門檻 pre-register 理由、D-C1 取捨與 TD-3 殘餘風險、明文聲明 C 不解除任何 M14 撤回)、遺留 OQ/影響面/狀態列同步更新;[A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md) 前置條件的 KI-006 兩項改為引用本檔 §6 B-1~B-5(不重複列出),A2-T1 checklist 補「採完立即跑 construct presence gate,不合格當場重採」(B-3)並擴充 DoD;[MAP.md](../../MAP.md) §3 與 §5 索引列、[exec-plan/README.md](../../exec-plan/README.md) 頂部狀態列/§stage4 段/WP-28 列/M14 里程碑列/§4 相依圖註記共 6 處 KI-006 敘述,全數改為「C 已落地、B 待 A2、C 落地不解除撤回」的一致措辭。三條 grep 複查見下方 §2c,無矛盾殘留。`git status --short` 僅 `CONTEXT.md`/`docs/MAP.md`/`docs/exec-plan/README.md`/`docs/known_issue/BUGFIX-DECISIONS.md`/`docs/known_issue/KI-005-A/A2-blocked-plan.md`/`docs/known_issue/KI-006-C/task-checklist.md`/`docs/known_issue/KI-006-m14-sample-no-counterstrafe.md`/`docs/operational/analysis-segments.md`/`research/README.md` 九檔,零程式碼改動 |
| 2026-08-07 | [T-exit](T-exit-gate.md) | ✅ Exit gate:八道硬閘 + 14 個 FR + 6 個 NFR 逐條驗證,證據回填,零程式碼改動 | 回歸三連:`npx tsc --noEmit` exit 0;`npm run test:ci` Vitest 89 files/739 tests + Playwright 20 tests 全綠(與 T0 基線逐條相同,`git diff --stat ce47bec~1 HEAD` 17 檔零 `src/` 路徑,NFR-C-1/G-5);`TMP/TEMP=<research>/.pytest_tmp uv run pytest` **221 passed**(NFR-C-5/G-6)。實跑四份 fixture 驗證 G-1~G-4/G-7:08:03 → `EXIT=2`、`constructPresence.present=false`、`flags=["construct_absent:counter-strafe"]`、三個 artifact 仍寫出;09:39 → `EXIT=0`、`present=true`;`synthetic_counterstrafe.json`(`DEFAULT_EXPORT`)→ `EXIT=0`、`present=true`、`family="counterstrafe"`(非 unknown,FM-6 覆核);`synthetic_timeline.json` → `EXIT=0`、`present=null`、`flags=["construct_unknown"]`;四者 `paramsVersion` 皆 `"construct-v1"`。G-8 重新跑三條 grep(誤導敘述 / M14 / entry blocker),確認現況權威文件(KI-006 頂部狀態、BD-006 索引列)一致為「C 已落地、B 待新採樣」,`BUGFIX-DECISIONS.md` 命中的兩則「處置待拍板」字樣為 2026-08-06 歷史日期戳記段落(A1/S1 落地當下的忠實記錄),非現況敘述,不構成誤導。證據逐條回填 [T-exit-gate.md](T-exit-gate.md)(§1 八道硬閘 / §2 FR 覆蓋 / §3 NFR 量化,全數 ✅);同步翻 [task-checklist.md](task-checklist.md) T-exit Done ✅ 與「C 全部完成時」五項核取(皆已於 T3 落地,本次覆核無誤)。實跑產物(`.exit_gate_runs/`)為驗證期間暫存,驗證完成後已刪除,未進 git。`git status --short` 僅本檔、`T-exit-gate.md`、`task-checklist.md` 三個文件,零程式碼改動 |

---

## 2. 基線(T0 回填)

| 項目 | 基線值 | 實測 |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | ✅ exit 0(無輸出) |
| `npm run test:ci` | (T0 量測;G-5 的對照基準) | ✅ exit 0 — Vitest **89 files / 739 tests** 全綠 + Playwright **20 tests** 全綠 |
| `uv run pytest` | (T0 量測) | ✅ exit 0 — **195 passed**(見下方 Windows 註記) |

> **Windows 註記**:直接 `uv run pytest` 遇到與 KI-004/S1 T-exit 相同的 `PermissionError: [WinError 5] Access is denied: 'AppData\Local\Temp\pytest-of-Hsin.YH.Yang'`(62 個 ERROR,非測試失敗,是 setup/teardown 階段清 tmp 目錄被 ACL 擋)。解法照抄:於 `research/` 內建立 `.pytest_tmp/`,以 `TMP=<research>/.pytest_tmp TEMP=<research>/.pytest_tmp uv run pytest` 執行 → 195 passed,0 error。**不視為紅**(T0-entry-gate.md 步驟 2 已預先註記此情境)。`.pytest_tmp/` 為執行期產物,未加入 git。

### 2a. 四份 fixture 的構念統計(T0 重現;T1 測試期望值的唯一來源)

| fixture | `drillId` | ticks | `vx ≠ 0` | 佔比 | `counter` | 預期判定 | 實測 |
|---|---|---:|---:|---:|---:|---|---|
| `...08_03_45.617Z` | `counterstrafe_ad_v1` | 3,507 | 0 | 0.0000 | 0 | absent | ✅ 逐格相符(ticks=3507, vx≠0=0, 佔比=0.0000, counter=0) |
| `...09_39_06.031Z` | `counterstrafe_ad_v1` | 2,723 | 1,415 | 0.5196 | 24 | present | ✅ 逐格相符(ticks=2723, vx≠0=1415, 佔比=0.5196, counter=24) |
| `synthetic_counterstrafe.json` | `synthetic_counterstrafe_v2` | 48 | 14 | 0.2917 | 2 | present | ✅ 逐格相符;`drillId` 確認為 **`synthetic_counterstrafe_v2`**(§2.4① 家族解析陷阱來源,已核實不以 `counterstrafe` 開頭) |
| `synthetic_timeline.json` | `synthetic_timeline_v1` | 96 | 39 | 0.4062 | 3 | unknown | ✅ 逐格相符(ticks=96, vx≠0=39, 佔比=0.4062, counter=3);家族 `timeline` 確認未註冊 |

> 預期值取自 [README §2.3](README.md)(計畫階段實測)。T0 已**獨立重現**,四格全數相符,無需停下。重現腳本為臨時腳本(僅讀 `meta.drillId` / `ticks[].vx` / `ticks[].keys` / `events[].type`,單次掃描,無寫檔),置於 session scratchpad,**未進 repo**。

### 2b. 消費者盤點(R-3 / FM-4)

| 項目 | 結論 |
|---|---|
| `run_pipeline` exit code 是否被 CI / npm script / 其他腳本消費 | ✅ **無**。repo 內無 `.github/` workflow 目錄(無 CI)。`grep -rn run_pipeline` 對 `*.py` 命中僅 3 檔:`run_pipeline.py` 本體、`test_run_pipeline.py`、`modules/kinematics/algorithms/angular.py`(僅 docstring 提及,非呼叫)。`package.json` 無相符腳本。R-3 的風險前提(FM-4)在今日不成立,但 exit code 2 仍應保留分流設計以防未來新增消費者 |
| `test_run_pipeline.py` 現有案數 | **15 案**(`pytest --collect-only` 逐條列出;T2 只能新增,不得改寫既有期望值,NFR-C-4) |
| `QUALITY_FLAG_VOCABULARY` 現有成員數 | **14 個成員**(13 個 exact + 1 個 templated `compute_failed:<reason>`),定義於 [apply.py:21](../../../research/src/modules/segments/algorithms/apply.py#L21)。[analysis-segments.md](../../operational/analysis-segments.md) 對應表**目前無 Level 欄**(全平鋪,隱含皆為 peek/segment 級)——T1/T3 需新增 Level 欄以區隔即將加入的 session 級 flag(FR-C-10) |
| `test_purity.py` 檢查項 | `research/src/modules/ingest/algorithms/tests/test_purity.py`(construct.py 落地目錄)現存 **1 個測試函式** `test_algorithm_imports_have_no_output_plotting_or_cwd_writes`,以 subprocess 匯入 `loader`/`dt`/`synthetic`(+ `metrics.peek`/`timeline`)並斷言:① subprocess exit 0、② stdout 為空、③ `sys.modules` 不含 `matplotlib`、④ `tmp_path`(cwd)無任何檔案寫入。新模組 `construct.py` 落地後必須被納入此匯入清單並通過同一組斷言(NFR-C-3) |

### 2c. T3 誤導性敘述複查(G-8)

| grep | 範圍 | 結果 |
|---|---|---|
| `construct.{0,20}(gate\|閘).{0,40}(重新宣告\|解除\|恢復效度\|可宣告)` | `docs/` | 命中 13 個「construct presence gate」提及檔 + 2 個符合關鍵詞模式的既有句(`exec-plan/README.md`、`MAP.md`,皆為本次新寫入、明文「不解除」的否定句,非誤導claim);`KI-006-C/README.md` G-8 與 `T3-docs-ledger-reconcile.md` 步驟 6 兩處是本檢查項目自身的敘述,非誤導殘留。`docs/superpowers/specs/2026-08-06-notion-board-HANDOFF.md` 命中一則舊 handoff 快照(`KI-006-C construct presence gate \| ⬜ 未開`),屬歷史時間點快照、不在 T3 §1.4 in-scope 清單,未改動。**無**任何「construct gate 落地 ⇒ M14 ④⑤ 可重新宣告」意涵的敘述。 |
| `M14` | `docs/known_issue/`、`docs/exec-plan/README.md`、`docs/MAP.md`、`docs/operational/` | 22 個檔命中,逐一核對 ④⑤ 撤回狀態描述一致:全部載明「④⑤ 因 KI-005(ω aliasing)/KI-006(構念缺席)撤回」,KI-006 側統一措辭為「C(construct presence gate)已落地、B(重新採樣)待 A2、C 落地不解除撤回」,無檔案殘留舊版「處置待拍板」或暗示已恢復效度的字樣。 |
| `entry blocker` | `docs/`(23 個檔命中) | 三條理由的解除狀態一致:**KI-004** 已解除(S1 落地);**KI-005** 未解除(A1 儀器修法已落地,A2 複驗/重掃待排程);**KI-006** 未解除(C 構念存在性閘已落地,B 重新採樣待 A2)。`WP-28`/`WP-29` 進度檔沿用既有措辭(維持),與本次更新的 KI-006/exec-plan/MAP 措辭不衝突。 |

---

## 3. Decision Log

| # | 決策 | 理由 | 影響 |
|---|---|---|---|
| **C-D1'** | 構念宣告落 **Python registry**,不做引擎 `DrillConfig.construct` / `meta.construct` | 零引擎改動;**可回溯套用到既有匯出**(最需要被擋的正是既有 08:03);量化門檻屬研究口徑,寫進引擎會讓改門檻變成改引擎+重採資料 | 殘餘風險 = 新增 drill 不被強制宣告 → `construct_unknown` 兜底(TD-3) |
| **C-D2'** | 閘紅 = flag + `run_pipeline` 非零 exit,**不**在 `load_export` 拋錯 | 拋錯會連 08:03 作為「零輸入邊界案例」的正當用途一起擋死;C-D3 要求的是「不得進效度宣告」,不是「不得載入」 | artifacts 照常寫出(FR-C-7) |
| **C-D3'** | 選項 B 委派 [A2](../KI-005-A/A2-blocked-plan.md),本計畫只交付驗收清單([README §6](README.md)) | 兩個 KI 的採集已收斂為同一次;兩份文件各寫一半採集規格必然漂移 | T3 回寫 A2 前置條件 |
| **C-D4'** | [analysis-segments.md](../../operational/analysis-segments.md) 既有 13 個 flag 的 Level 欄不套二選一,`non_uniform_dt`/`missing_target`/`sg_fallback_short_signal`/`non_finite_replaced`/`non_finite_interpolated` 五個標為「peek, segment」雙層級 | 讀 `submovement.py`/`apply.py`/`run_pipeline.py` 原始碼確認:這五個是 trace(peek)級判定但被複寫進每個由該 trace 產出的 segment(`_candidate` 以 `trace_flags` 播種 `flags`;`_segment_metrics.compute()` 對每個 segment 附加 `non_uniform_dt`/`missing_target`)。標單一層級會誤導讀者以為某層級不會出現該 flag | 文件對帳(FR-C-10)不只是抄任務檔既定文字,對既有 13 個 flag 的分類需要查碼佐證,避免把不確定的分類寫成權威 |

---

## 4. Surprises(計畫/實作階段的意外發現)

| # | 發現 | 影響 |
|---|---|---|
| **S-C.1** | committed 合成 fixture 的 `drillId` 是 `synthetic_counterstrafe_v2`,**不以 `counterstrafe` 開頭** | 天真的 `startswith` 家族解析會讓閘在 `run_pipeline` 的**預設路徑**上失效且測試仍綠 → FR-C-3 + FM-6 專屬測試 |
| **S-C.2** | KI-006 §4-C 表列的三個家族中,`tracking_*`(目標 motion)與 `detection_*`(宣告 peek 數)的判準值**不在 `meta` 內**(`meta.targets` 僅有 `hitbox`) | 本階段只實作 `counterstrafe_*`;另兩家族誠實回 `construct_unknown`(TD-1 / OQ-C-1) |
| **S-C.3** | `synthetic_timeline_v1` 其實**含**構念(3 個 counter、40.6% 橫移),但家族未註冊 | 不得為讓它變綠而擴大家族猜測範圍——那是「靜默通過」的另一種形式。釘死為 `unknown` |

---

## 5. Open Questions(現況)

| OQ | 狀態 |
|---|---|
| ~~OQ-C-0~~ 宣告放引擎還是 Python | ✅ 關閉(2026-08-06):Python registry |
| OQ-C-1 tracking/detection 家族條件 | 🟡 未決;需 meta 補宣告值或研究者改寫條件 |
| ~~OQ-C-2~~ n ≥ 2 session(= OQ-KI6-4) | ✅ 關閉(2026-08-07):**n > 2**(至少 3 個),嚴於原建議的 n ≥ 2 |
| OQ-C-3 判定進 coach_report | 🟡 建議延後 |
| OQ-C-4 exit code 編號慣例 | 🟡 T2 實作時定案 |
| OQ-C-5 缺席時是否拒絕輸出 segments CSV | 🟡 建議不拒絕 |

---

## 6. 2026-08-07 追加:A2-T1 採樣前置決策批次

> 使用者於 T-exit 之後拍板三項與新採樣直接相關的決策,同時關閉 KI-005 側的 OQ-A-5(=OQ-KI5-6)與本檔 OQ-C-2(=OQ-KI6-4)、KI-005-A 的 OQ-A-2/TD-5。三者記在 KI-005-A/progress.md 與 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-005/BD-006,本節僅記與本檔直接相關的兩項結論供快速查閱。

| 決策 | 內容 |
|---|---|
| 採樣時機與規模(OQ-A-5/OQ-KI5-6) | 與 KI-005 A2-T1 **合併為同一次採集**,不分兩次採 |
| session 數(OQ-C-2/OQ-KI6-4) | **n > 2**(至少 3 個) |

`recordKeyEvents` 是否開啟(OQ-A-2/TD-5)屬 KI-005-A 範圍,決議為**開**,已於同日落地:`main.ts:355` 接上旗標 + `input-sampler.spec.ts` 新增驗證案(詳見 [KI-005-A/progress.md A-D10/A-D11](../KI-005-A/progress.md))。
