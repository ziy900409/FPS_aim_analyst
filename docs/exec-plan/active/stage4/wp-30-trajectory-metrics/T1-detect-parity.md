# T1 — t_detect / eccentricity Python 推導 + 與 detectionDerivation.ts 對表閘

> Part of [WP-30 trajectory-metrics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(roster + pre-registration 凍結) |
| **Risk / Cplx** | Med / Med — 風險不在演算法,而在 **① 參數來源**(文件自稱 provisional,程式碼才是權威)與 **② 假綠**(counter-strafe drill 上若全 `timeout`,parity 會在空集合上通過) |
| **Touches** | ADD `research/src/modules/metrics/algorithms/detect.py` + tests;ADD `research/fixtures/parity/detect-*.json`;ADD `tests/golden/research/detect-parity.test.ts`;ADD `notebooks/t1/` 產生器 |
| **狀態** | ✅ 完成(2026-08-07) |

## Objective

FR-D11 的前置:讓 Python 側有一個**與 TS 權威逐位一致**的 `t_detect`,供 T2 的 REC 邊界一致性檢查使用。`t_detect` 是**既有構念**([analysis-t-detect.md](../../../operational/analysis-t-detect.md) + [detectionDerivation.ts](../../../../../src/metrics/detectionDerivation.ts)),依 C-D4 不得在 Python 側另立定義 —— 所以本 task 的交付重點是**對表閘**,不是演算法本身。

## In scope

- **參數對帳(第一步,先於寫碼)**:逐欄抄錄 [detectionDerivation.ts](../../../../../src/metrics/detectionDerivation.ts) 的 `ResolvedDetectionDerivationOptions` **實際預設值**進 progress(pre-stimulus window / `theta_v` 倍率 / sustain ticks / anticipation 下限 / eye origin 解析路徑)。
  - `analysis-t-detect.md` 自稱「provisional until pilot calibration」→ **文件與程式碼若不一致,以程式碼為權威**,差異入 [DECISIONS.md](../../../DECISIONS.md) 或回寫文件,不得靜默取其一。
- **`detect.py`**(簽名見 [README.md §5](README.md)):
  - `epsilon(t)` 一律呼叫既有 [`epsilon_deg`](../../../../../research/src/modules/kinematics/algorithms/angular.py)(rad→deg 唯一轉換點),**不重寫幾何**;eye origin 以 `resolve_eye_origin(meta, strict=True)` 解。
  - `dε/dt` 以相鄰 tick 樣本計算並歸屬到**後一個** tick(spec 明文)。
  - 前刺激基線窗取 `t_visible` 前 `pre_stimulus_ms`;窗長不足 → `baseline_insufficient = True`(不是錯誤)。
  - 偵測起點 = 連續 `sustain_ticks` 個樣本滿足 `dε/dt < -theta_v` 的**第一個** tick(非第四個確認 tick)。
  - 窗界一律取自 [`build_peek_windows`](../../../../../research/src/modules/metrics/algorithms/peek.py),**不重算**;窗內無持續下降 → `status = 'timeout'`(有效觀察結果)。
  - 目標中心缺席時以該 peek 的 `visible.targetX/Y/Z` 為 fallback(spec 明文);兩者皆缺 → flag,不猜。
- **parity 產出**:`detect_parity_payload()` → `fixtures/parity/detect-<fixture>.json`(逐 presentation:`tDetect` / `status` / `eccentricityAtSpawnDeg` / `baselineInsufficient` / `anticipation` + 來源檔名 + `version`)。**寫檔只在 notebooks/**(C-D2)。
- **對表閘(TS 側)**:`tests/golden/research/detect-parity.test.ts` —— 讀同一份匯出,就地組 `DataRecorderSnapshot` → 呼叫既有 `deriveDetectionMetrics()`,逐 presentation 對表,相對誤差 ≤ 1e-9。**零新 TS API**。
- **反 vacuous 斷言**(D-29.3 的教訓,紀律非權宜):測試自身斷言參與比對的 `status === 'detected'` 樣本數 ≥ T0 凍結的門檻;全 `timeout` 的 fixture 不得被當成「對表通過」。
- **負向案例**:legacy 匯出(08:03/09:39)輸入時,strict eye origin 解析**必定拋錯**,以測試釘死(§0.2 的機械閘)。

## Out of scope

- REC/MR/V 分解與一致性檢查(T2)。
- 101 點曲線(T3)。
- 調整 `t_detect` 的任何參數(`theta_v` 倍率 / sustain ticks / 前刺激窗)——本 task 只重現,不校準。sensitivity sweep 屬 [analysis-t-detect.md](../../../operational/analysis-t-detect.md) 的 pilot 工作,不在 stage4 scope。
- 動任何 `src/` 生產碼:本 task **只新增測試檔**。

## Steps

- [ ] 抄錄 TS 已解析預設值進 progress;與 `analysis-t-detect.md` 逐欄比對,差異入帳。
- [ ] `detect.py`:`DetectParams` / `DetectSample` / `detect_samples`(複用 `epsilon_deg` + `build_peek_windows`)。
- [ ] 單元測試:已知合成軌跡的偵測起點回收(±1 tick)、`timeout`、`baseline_insufficient`(首個 presentation)、`anticipation`(< 100ms)、目標中心缺席 fallback、窗界不外溢到下一個 presentation。
- [ ] notebooks 產生器 → `fixtures/parity/detect-*.json`(三份真實 + 合成)。
- [ ] `detect-parity.test.ts`;`npm run test:ci` 全綠。
- [ ] 反 vacuous 斷言 + legacy 匯出負向案例。
- [ ] `detected` 樣本數若低於 T0 門檻 → 輸出 `blocked-by-data` 判定並開/更新 **OQ-S4-15**,progress 記證據;**此時 T2 的一致性檢查改為「明確 blocked」而非略過**。
- [ ] 兩閘輸出貼 progress(`uv run pytest` / `npm run test:ci`)。

## Definition of Done

1. **對表閘綠**:`npm run test:ci` exit 0,`detect-parity.test.ts` 對四份 fixture(三份真實 + 合成)逐 presentation 的 `tDetect` / `eccentricityAtSpawnDeg` 相對誤差 ≤ 1e-9,`status` / `baselineInsufficient` / `anticipation` 逐位相等。
2. **反 vacuous 斷言綠**:測試斷言 `detected` 樣本數 ≥ T0 門檻;不足時測試以 `blocked-by-data` 明確失敗或跳過並在 progress 留證據,**不得**以空集合宣告通過。
3. **參數來源可稽核**:progress 含 TS 預設值逐欄抄錄 + 與文件的差異處置(回寫文件或入 DECISIONS)。
4. **負向案例綠**:legacy 匯出輸入時 strict eye origin 解析拋錯,以測試釘死。
5. **邊界單元測試綠**:Steps 第 3 點六個情境各有測試。
6. `uv run pytest` exit 0;`research/` 零 TS import(C-D1);`algorithms/` 純度測試綠(C-D2);**未動任何 `src/` 生產碼**(`git diff --stat` 證據)。

## Commit

`feat(wp-30): T1 t_detect Python 推導 + detectionDerivation.ts 對表閘(≤1e-9,含反 vacuous 斷言)`
