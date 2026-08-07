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

---

## 3. Decision Log

| # | 決策 | 理由 | 影響 |
|---|---|---|---|
| **C-D1'** | 構念宣告落 **Python registry**,不做引擎 `DrillConfig.construct` / `meta.construct` | 零引擎改動;**可回溯套用到既有匯出**(最需要被擋的正是既有 08:03);量化門檻屬研究口徑,寫進引擎會讓改門檻變成改引擎+重採資料 | 殘餘風險 = 新增 drill 不被強制宣告 → `construct_unknown` 兜底(TD-3) |
| **C-D2'** | 閘紅 = flag + `run_pipeline` 非零 exit,**不**在 `load_export` 拋錯 | 拋錯會連 08:03 作為「零輸入邊界案例」的正當用途一起擋死;C-D3 要求的是「不得進效度宣告」,不是「不得載入」 | artifacts 照常寫出(FR-C-7) |
| **C-D3'** | 選項 B 委派 [A2](../KI-005-A/A2-blocked-plan.md),本計畫只交付驗收清單([README §6](README.md)) | 兩個 KI 的採集已收斂為同一次;兩份文件各寫一半採集規格必然漂移 | T3 回寫 A2 前置條件 |

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
| OQ-C-2 n ≥ 2 session(= OQ-KI6-4) | 🟡 未決;A2-T1 前須有結論 |
| OQ-C-3 判定進 coach_report | 🟡 建議延後 |
| OQ-C-4 exit code 編號慣例 | 🟡 T2 實作時定案 |
| OQ-C-5 缺席時是否拒絕輸出 segments CSV | 🟡 建議不拒絕 |
