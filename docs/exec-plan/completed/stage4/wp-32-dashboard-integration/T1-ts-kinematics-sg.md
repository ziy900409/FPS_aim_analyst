# T1 — TS 角運動學 ω(t) + Savitzky-Golay 凍結係數表 + 兩支 golden

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(紀律凍結) |
| **Risk / Cplx** | **High** / Med — 風險全在 **SG 的 edge 處理**(S-32.2 / OQ-S4-21),不在 ω |
| **Touches** | ADD `src/metrics/angularKinematics.ts` + `src/metrics/filters/savitzkyGolay.ts`(+ 各自 `.test.ts`);ADD `research/fixtures/golden/sg-coeffs-seg-v2.json` + `omega-*.json`;ADD golden 產生腳本(notebooks);ADD `tests/golden/research/promoted-kinematics.test.ts` |
| **狀態** | ⬜ |

## Objective

把 stage4 全部軌跡指標的**兩塊地基**移植到 TS,並各自獨立對表:① `omega_deg_s` 的 tick-integral 分支;② `sg_filter` 的 `seg-v2` 參數化實例。這兩塊在 T2/T3/T4 之後就沒有機會單獨驗證了 —— 一旦折進分段,對表紅了無法定位是 ω、SG 還是分段。

## In scope

### `src/metrics/angularKinematics.ts`

逐位對齊 [angular.py `omega_deg_s`](../../../../../research/src/modules/kinematics/algorithms/angular.py) 的 **tick-integral 分支**:

- 輸入 = 已依 `t` 升序排序的 ticks;輸出長度 == ticks 長度,**index 0 為 `NaN`**(契約,不是缺陷)。
- `dt_s = diff(t)/1000`;任一 `dt ≤ 0` → throw(「tick timestamps must be strictly increasing」)。
- 取 `dYaw`/`dPitch`(自 index 1 起);**兩欄必須同時存在且全為有限值**,半套(只有 `dYaw`)視為缺席 → **throw**,不得半猜。
- 中點 pitch = `pitch[i] − dPitch[i]/2`(**不是**相鄰兩 tick 的平均 —— 那是 legacy 分支)。
- `speed_rad_s = hypot(dYaw·cos(midPitch), dPitch) / dt_s`;輸出 `degrees(speed_rad_s)`。
- **不實作 `aim-diff-legacy` 分支**(P5;`seg-v1` 亦不移植,[README §1](README.md) out of scope)。

### `src/metrics/filters/savitzkyGolay.ts`

- `SG_SEG_V2: SgCoefficients` —— **凍結常數表**:`interior`(11 個)+ `leadingEdge`(5×11)+ `trailingEdge`(5×11),由 Python 產出後內嵌;帶 `version: 'sg-seg-v2'` 與出處註解(產生腳本路徑 + golden 檔名 + 產生日期)。
- `sgSmooth(values, coeffs)`:
  - 輸入契約與 [sg.py](../../../../../research/src/shared/filters/sg.py) 相同 —— 一維、全有限、長度 ≥ `window`,否則 throw(訊息對齊 Python,便於對照)。
  - interior(index `h … n−1−h`,`h=(window−1)/2`)= 以 `interior` 係數做 FIR 卷積;
  - 前 `h` 個與後 `h` 個 = 分別對前 `window` / 後 `window` 個樣本套 `leadingEdge` / `trailingEdge` 矩陣(每列一個輸出樣本)。
  - **求和順序固定並註明**(與係數表產生時的順序一致),避免浮點累加順序造成不必要的尾差。

### Python 側 golden 產生腳本(notebooks,寫檔只在 notebooks — C-D2)

- `sg-coeffs-seg-v2.json`:用 `scipy.signal.savgol_coeffs` 取 interior;edge 矩陣以「對單位向量逐一跑 `savgol_filter(mode='interp')`」的方式**萃取**(即以基底向量探測線性算子),而非重寫 scipy 內部 —— 這樣萃出來的矩陣**定義上**就等於 scipy 的實際行為,精度風險只剩浮點,不含理解錯誤。
- `omega-<fixture>.json`:三份真實(09:18/09:24/09:37,`strict=True`)+ 合成,各存**逐 tick ω 全序列**(含 index 0 的 `null`)+ `source` 欄位。體積檢查:每份 ≈ 2.7–3.5k 個 float,可接受;若超出 `research/README.md` 的 fixture 上限則改存逐 peek 窗內序列並記 progress。

### `tests/golden/research/promoted-kinematics.test.ts`

table-driven,對每份 fixture:讀匯出 JSON + golden JSON → 呼叫 `omegaDegPerSec` → 逐點比對。另含 SG 係數表對表與退化輸入測試。

## Out of scope

- 分段(T2)、phase/sync(T3)、curve(T4)、結果頁(T5)。
- `aim-diff-legacy` ω 分支與 `seg-v1` 係數(README §1)。
- Butterworth / `smooth_report_omega`(S-32.1)。
- 動 `compute.ts` / `trackingDerivation.ts`(T3/T4 才碰)。

## Steps

- [ ] Python:寫 `sg-coeffs-seg-v2.json` 產生腳本(基底向量探測法),輸出含 `window`/`poly`/`interior`/`leadingEdge`/`trailingEdge`/`version`/`generatedBy`。
- [ ] Python:寫 `omega-*.json` 產生腳本(四份 fixture,`strict=True`)。
- [ ] TS:`savitzkyGolay.ts` + 內嵌常數表(自 golden 抄入,附出處註解)。
- [ ] TS:`savitzkyGolay.test.ts` —— 常數表 vs golden ≤1e-12;退化輸入(非有限值 / 長度 < window / 偶數 window)各拋錯。
- [ ] TS:`angularKinematics.ts`。
- [ ] TS:`angularKinematics.test.ts` —— 已知幾何合成案例(常數角速度 / 純 yaw / 純 pitch / 高 pitch)+ 契約測試(index 0 為 NaN、`dt ≤ 0` 拋錯、`dYaw` 缺 `dPitch` 拋錯)。
- [ ] TS:`promoted-kinematics.test.ts`(四份 fixture 逐點 ≤1e-9;SG 對表 ≤1e-12)。
- [ ] **交叉驗證 SG 對表**:在三份真實 fixture 的**實際 ω 訊號**(去頭後)上跑 `sgSmooth`,與 Python `sg_filter` 輸出逐點 ≤1e-9 —— 這是 OQ-S4-21 的實質判定,只比係數表不算數。
- [ ] 兩閘輸出貼 progress(`uv run pytest` / `npm run test:ci`)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **SG 係數表對表 ≤1e-12** | `savitzkyGolay.test.ts` 綠;interior + 兩個 edge 矩陣共 121 個係數逐一比對 |
| ② | **SG 在真實 ω 訊號上對表 ≤1e-9** | `promoted-kinematics.test.ts` 對三份真實 fixture 的去頭 ω 序列逐點比對(**含前後各 5 個 edge 樣本**,不得只比 interior)。此項即 **OQ-S4-21 的判定**:通過 → 於 progress 標關閉;未通過 → **停手**,依 T0 `D-32.3` 的處置路徑入帳,不得放寬容差 |
| ③ | **ω 對表 ≤1e-9** | 四份 fixture 逐 tick 比對;index 0 兩側皆為 NaN/null;`source` 皆為 `tick-integral` |
| ④ | **反 vacuous** | 每份 fixture 斷言參與比對的有限樣本數 ≥ 1000(真實)/ ≥ 100(合成),且 `max(ω) > 100 deg/s`(證明訊號非全零) |
| ⑤ | **strict 紀律有負向測試** | 以 08:03 或 09:39(無 `dYaw`/`dPitch`)為輸入 → `omegaDegPerSec` **拋錯**;測試斷言錯誤訊息含 KI-005 指引。**這是 P5 的機械證據** |
| ⑥ | **既有測試零修改全綠** | `npm run test:ci` exit 0;`git diff` 顯示 `src/` 只新增兩個檔 + 測試,既有檔零 diff |
| ⑦ | **research 閘綠** | `uv run pytest` exit 0(新增的 golden 產生腳本有對應測試或被 pipeline 覆蓋);`algorithms/` 純度測試仍綠(寫檔只在 notebooks) |
| ⑧ | **常數表可追溯** | `SG_SEG_V2` 上方註解含產生腳本路徑、golden 檔名、產生日期、`seg-v2` 參數出處([submovement.py `SEG_V2_PARAMS`](../../../../../research/src/modules/segments/algorithms/submovement.py)) |

## Commit

`feat(wp-32): T1 TS 角運動學 ω(tick-integral,strict)+ SG 凍結係數表(sg-seg-v2)+ 兩支 golden 對表(≤1e-12 / ≤1e-9)`
