# T2 — `run_pipeline` 佈線:`constructPresence` 區塊 + 專屬 exit code

> 上游:[C README §2.5](README.md)(`main()` 行為表)· D-C2 / D-C3 · FM-2 / FM-4
> 交付:**FR-C-7 · FR-C-8 · FR-C-11(端到端半)**

**In scope**:`research/src/report/run_pipeline.py` 與其測試。
**Out of scope**:`algorithms/` 的判定邏輯(T1 已凍結)、任何文件(T3)、任何 `src/` 改動。

---

## Steps

### 0. 開工前確認

- [x] **OQ-C-4** 定案:構念缺席的 exit code 用 `2`(建議),並在 `run_pipeline` 的 module docstring 列出 exit code 表(0 / 1 / 2),讓語意不必靠讀原始碼推斷。

### 1. 判定接進 `run()`

- [x] `from modules.ingest.algorithms import check_construct_presence`(既有 import 區塊,C-D1 不變)。
- [x] 在 `load_export` 之後、`check_dt` 附近呼叫一次,結果放進 `summary["constructPresence"]`,欄位照 [README §2.5](README.md):
      `drillId` / `family` / `construct` / `present` / `paramsVersion` / `counterEventCount` / `tickCount` / `movingTickCount` / `movingTickRatio` / `thresholds` / `flags`。
- [x] `run()` 本身**不改變回傳/丟擲行為**、**不提前 return** —— 三個 artifact 一律照常寫出(FR-C-7 / D-C2)。exit code 的決定權只在 `main()`。
- [x] `movingTickRatio` 為 `nan` 時交給既有 `_json_safe` 轉 `None`(FM-2);確認 `json.dumps(..., allow_nan=False)` 不拋。
- [x] `thresholds` 序列化為 `{"minCounterEvents": ..., "minMovingTickRatio": ...}`;unknown 家族時為 `null`。

### 2. `main()` 的 exit code 與訊息

依 [README §2.5](README.md) 的行為表:

- [x] `present is True` → stdout 增一行(如 `construct        present (counter-strafe, construct-v1)`),exit **0**。
- [x] `present is None` → stdout 增一行 `construct        unknown (drill family not registered)`,exit **0**(FR-C-9:未知不阻擋)。
- [x] `present is False` → stdout 照常印完三個 artifact 路徑;**stderr** 印明確拒絕訊息,含:drill id、構念名、實測 `counter` 數與橫移佔比、門檻值、以及「此 session 不得用於 `<drillId>` 的效度宣告」;exit **2**。
- [x] schema / IO 失敗維持 exit **1**、不寫 artifact(既有行為逐字不動)。
- [x] 訊息**不得**使用「pipeline failed」措辭 —— pipeline 正常完成,被拒絕的是**用途**(FM-4)。

### 3. 測試(`research/src/report/tests/test_run_pipeline.py`,只增不改)

- [x] **08:03**:`main(["--export", <08:03>, "--out", tmp])` → 回傳 **2**;`pipeline-summary.json` / `peek-quality.csv` / `peek-segments.csv` **三個都存在**;summary 的 `constructPresence.present is False`、`flags == ["construct_absent:counter-strafe"]`;stderr 含 drillId 與門檻值。
- [x] **09:39**:→ 回傳 **0**;`constructPresence.present is True`。
- [x] **預設合成 fixture**(`synthetic_counterstrafe.json`,`DEFAULT_EXPORT`):→ 回傳 **0**;`present is True`、`family == "counterstrafe"`(閘在預設路徑上確實生效,FM-6)。
- [x] **`synthetic_timeline.json`**:→ 回傳 **0**;`present is None`(JSON 中為 `null`)、`flags == ["construct_unknown"]`。
- [x] `paramsVersion == "construct-v1"` 與完整 `thresholds` 出現在每份 summary(G-7)。
- [x] JSON 可被 `json.loads` 解析且不含 `NaN` 字面值(FM-2 / `allow_nan=False`)。
- [x] 既有案(dt 報告、segmentation、quality、flagCounts)**期望值零改寫**(NFR-C-4);僅新增斷言。

### 4. 回歸

- [x] `uv run pytest` exit 0。
- [x] 實跑三份 fixture 並記錄實際 exit code 到 [progress.md](progress.md)(G-1/G-2/G-3 的證據)。

---

## Definition of Done

- [x] 08:03 實跑 `run_pipeline` → **exit 2**,三個 artifact **仍存在**,summary 含 `constructPresence.present == false` 與 `construct_absent:counter-strafe`。
- [x] 09:39 與預設合成 fixture 實跑 → **exit 0** 且 `present == true`;合成 fixture 的 `family == "counterstrafe"`。
- [x] `synthetic_timeline` 實跑 → **exit 0** 且 `present == null` + `construct_unknown`。
- [x] `run_pipeline` 的 module docstring 含 exit code 表(0 / 1 / 2)。
- [x] stderr 訊息含 drillId、構念名、實測值、門檻值,且**不含**「failed」措辭。
- [x] `uv run pytest` exit 0;`test_run_pipeline.py` 既有案期望值零改寫,新增案數記入 progress。
- [x] `git diff --stat` 僅 `research/src/report/` 兩檔;**不含任何 `src/` 路徑**。

## Commit message

```
feat(ki-006): C T2 — run_pipeline 產出 session 級 constructPresence 並拒絕效度用途

構念缺席時以專屬 exit code 2 結束(與 schema/IO 失敗的 1 分流),但三個 artifact
照常寫出——資料仍可診斷,受限的是用途(C-D3)。家族未知回 exit 0 + construct_unknown,
避免新 drill 一上線就紅而導致閘被關掉。
```
