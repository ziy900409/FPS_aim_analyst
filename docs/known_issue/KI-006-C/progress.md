# KI-006 / C — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-006](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-06 | 計畫 | ✅ C tech spec + T0–T3 + T-exit 產出 | 本資料夾;上游 [KI-006 §4-C](../KI-006-m14-sample-no-counterstrafe.md) / [BD-006](../BUGFIX-DECISIONS.md) |
| 2026-08-06 | 計畫拍板 | ✅ 三項設計取捨定案:**D-C1** Python registry(非引擎自我描述)· **D-C2** flag + 非零 exit(非 `load_export` 拋錯)· 選項 **B 委派** [KI-005-A / A2](../KI-005-A/A2-blocked-plan.md) | 使用者裁示;連帶關閉 OQ-C-0,並使本階段 NFR-C-1「引擎零改動」成立 |

---

## 2. 基線(T0 回填)

| 項目 | 基線值 | 實測 |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | |
| `npm run test:ci` | (T0 量測;G-5 的對照基準) | |
| `uv run pytest` | (T0 量測) | |

### 2a. 四份 fixture 的構念統計(T0 重現;T1 測試期望值的唯一來源)

| fixture | `drillId` | ticks | `vx ≠ 0` | 佔比 | `counter` | 預期判定 | 實測 |
|---|---|---:|---:|---:|---:|---|---|
| `...08_03_45.617Z` | `counterstrafe_ad_v1` | 3,507 | 0 | 0.0000 | 0 | absent | |
| `...09_39_06.031Z` | `counterstrafe_ad_v1` | 2,723 | 1,415 | 0.5196 | 24 | present | |
| `synthetic_counterstrafe.json` | `synthetic_counterstrafe_v2` | 48 | 14 | 0.2917 | 2 | present | |
| `synthetic_timeline.json` | `synthetic_timeline_v1` | 96 | 39 | 0.4062 | 3 | unknown | |

> 預期值取自 [README §2.3](README.md)(計畫階段實測)。T0 必須**獨立重現**;對不上即停。

### 2b. 消費者盤點(R-3 / FM-4)

| 項目 | 結論 |
|---|---|
| `run_pipeline` exit code 是否被 CI / npm script / 其他腳本消費 | |
| `test_run_pipeline.py` 現有案數 | |
| `QUALITY_FLAG_VOCABULARY` 現有成員數 | |
| `test_purity.py` 檢查項 | |

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
