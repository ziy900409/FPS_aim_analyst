# T2 — 角運動學 ω(t)/ε(t) + ε 層雙向 parity 閘

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(ingest + 合成匯出) |
| **Risk / Cplx** | **High** / Med — 本 WP 唯一的 High risk task:ε 若與既有 TS 推導分裂,全 stage 的逐段指標都建在錯誤地基上 |
| **Touches** | ADD `research/src/modules/kinematics/algorithms/angular.py` + tests;ADD `research/fixtures/parity/*.json`;**ADD `tests/golden/research/epsilon-parity.test.ts`**(vitest,落在既有 `test:ci`) |
| **狀態** | ⬜ |

## Objective

FR-D3 + FR-D4:交付 ω(t)/ε(t)/on_target 純函式,並用**雙向 parity 閘**釘死「Python 與既有 TS 對同一構念算出同一個數」——這是 C-D4(既有構念不得有第二定義)的機械化執行,也是 M14 的核心證據。

## In scope

- **`omega_deg_s(ticks) -> np.ndarray`**:`√((Δyaw·cos(pitch))² + Δpitch²)/Δt`,rad→deg 於此處(**全 research 層唯一轉換點**),回傳長度 = len(ticks) 且 `[0] = nan`;`pitch` 取相鄰兩 tick 的中點或前一 tick(定案寫 doc + 記 Decision Log,fixture 釘死)。
- **`epsilon_deg(ticks, meta, eye_height=1.6) -> np.ndarray`** 與 **`on_target(...) -> np.ndarray[bool]`**:座標慣例、`f_aim`、`p_eye`、hitbox 來源**逐項照抄** [analysis-tracking.md](../../../../operational/analysis-tracking.md) / [analysis-t-detect.md](../../../../operational/analysis-t-detect.md):
  - `f_aim = (-sin(yaw)cos(pitch), sin(pitch), -cos(yaw)cos(pitch))`;
  - `p_eye = (px, eyeY, pz)`;`eyeY` 預設 1.6(若日後 schema 匯出顯式欄位則顯式者勝);
  - hitbox 取 `meta.targets.hitbox`,缺席 → H1 `{widthU:1, heightU:2, depthU:1}`;
  - ε = `acos(clamp(dot(unit(f_aim), unit(p_target - p_eye)), -1, 1))`,輸出 deg。
- **peek/presentation 窗界沿用 TS**:`[t_visible, nextVisible.t)`,末筆 `+inf`(與 `trackingDerivation.derivePresentation` 同義);目標中心取該 tick 的 `tx/ty/tz`,不可用時 fallback `visible.targetX/Y/Z`(與 TS 的 `targetFromVisibleOrFirstTick` 同語意)。
- **parity 產出**:`fixtures/parity/epsilon-<fixture>.json` — 逐 presentation 的 `targetId`/`tVisibleMs`/`tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg`/`acquisitionFailure` + 產生用的 `options`(eyeHeight/hitbox)+ 來源匯出檔名。
- **parity 閘(TS 側)**:`tests/golden/research/epsilon-parity.test.ts` 讀同一份 `fixtures/exports/*.json` 跑 [`deriveTrackingMetrics`](../../../../../src/metrics/trackingDerivation.ts),逐 presentation 對表 parity JSON,容差 **≤1e-9 相對誤差**(`undefined` 對 `null` 亦須一致)。**不得為對表新增任何 TS API**(只用既有公開輸出)。
- **合成幾何 fixture**(已知答案,補齊 per-tick 層):常數角速度、純 yaw、純 pitch、高 pitch 邊界(cos(pitch) 校正生效)、目標正中(ε=0)、已知偏角。

## Out of scope

- 分段/SG(T3)、flags(T4)、t_detect 完整推導(WP-30 T0 對表)、lead(既有 `analysis-lead.md`,本 stage 不重做)。
- 修改任何 TS 生產碼:**T2 只新增測試檔**;若 parity 差異被判定為 TS 側 bug 或 spec 分歧 → 停手入帳(見 DoD 第 4 項),不在本 task 直接改引擎。

## Steps

- [ ] `angular.py`:`omega_deg_s` + 合成 fixture(常數角速度/純 yaw/純 pitch/高 pitch)。
- [ ] `epsilon_deg` / `on_target` + 已知幾何 fixture(ε=0、已知偏角、hitbox 缺席 fallback)。
- [ ] presentation 窗界與 fallback 語意對照 TS 實作逐行核對,差異記 Decision Log。
- [ ] parity 產生腳本(`notebooks/` 或 `scripts/`,**不在 `algorithms/` 內寫檔**)→ `fixtures/parity/epsilon-*.json`。
- [ ] `tests/golden/research/epsilon-parity.test.ts`;`npm run test:ci` 全綠。
- [ ] `uv run pytest` 全綠;兩份輸出貼 progress。

## Definition of Done

1. ω 合成 fixture 相對誤差 ≤ **1e-6**(常數角速度/純 yaw/純 pitch/高 pitch 四情境);`[0] = nan` 斷言。
2. ε 已知幾何 fixture 綠(含 ε=0、已知偏角、`meta.targets.hitbox` 有/無兩路徑)。
3. **parity 閘綠**:`npm run test:ci` exit 0,且 `epsilon-parity.test.ts` 逐 presentation 五個量(`tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg`)+ `acquisitionFailure` 相對誤差 ≤ 1e-9。
4. 若出現不一致:**先修 Python**;若判定為 spec 分歧或 TS 側 bug → 入 [DECISIONS.md](../../../DECISIONS.md)(或 [known_issue/](../../../../known_issue/) 開 KI)並取得結論後,本 task 才可標 PASS。
5. `uv run pytest` exit 0;`research/` 零 TS import(C-D1 斷言);rad→deg 僅出現在 `angular.py`(grep 證據記 progress)。

## Commit

`feat(wp-28): T2 角運動學 ω(t)/ε(t) + ε 層雙向 parity 閘(vitest 對表 deriveTrackingMetrics ≤1e-9)`
