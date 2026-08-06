# KI-005 / A — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-005](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-06 | 計畫 | ✅ A tech spec + T0–T6 + T-exit + A2 產出 | 本資料夾;上游 [KI-005 §6.1](../KI-005-omega-render-sim-aliasing.md) 拍板(選項 A / 感度由 meta 重建 / 不做過渡期 C)· 結構範本 = [KI-004 / S1](../KI-004-S1/README.md) |
| 2026-08-06 | 計畫 | ✅ **OQ-A-1 / OQ-A-2 拍板** | OQ-A-1 = **全域開啟**(不做「實驗 session 才開」);OQ-A-2 = 本次**不動** `recordKeyEvents`,登錄 TD-5,須在 A2-T1 採樣前由研究者決定 |
| 2026-08-06 | 計畫 | ✅ 查碼發現兩個缺口並納入範圍 | ① `pushMouse` 無 pointer-lock 閘(→ T3 / FR-A-8)② `main.ts` 從未啟用 `recordKeyEvents`(→ FR-A-7 的前車之鑑)。見 [README §2.4](README.md) |
| 2026-08-06 | T0 | ✅ | 基線紅綠燈記錄(§2);§2.4 兩缺口行號複核(§2b);RED 基線可重現(§2a,notch 數 27/34 精確重現);受影響測試盤點(§3);`suspect`/`bufferOverflow` 口徑抄錄(§2c) |
| 2026-08-06 | T1 | ✅ | 新增 `src/input/mouseGain.ts`(`RAD_PER_COUNT`/`MAX_PITCH`/`resolveMouseGain`/`createAimIntegrator`,12 個新測試);`CameraController` 改為消費(`#adsGain` → `#currentStep`,由 `resolveMouseGain` 於原有觸發點——`setSensitivity`/`setAdsConfig`(active 中)/`setAds`(轉場)——重算,避免逐幀/逐 mousemove 重新配置);`applyDelta` 委派 `AimIntegrator`。新增 2 個 golden 測試(hip→ADS→hip 混合序列 camera quaternion + aimSink 逐位斷言、pitch 撞夾角後 dPitch 語意)。`grep "0\.022"`/`grep "MAX_PITCH"` 僅 `mouseGain.ts` 命中定義。`npx tsc --noEmit` exit 0;`npm run test:ci` vitest **89 files/708 tests 全綠**(694 基線 + 14 新增,零既有期望值變更);Playwright 18/19 通過,`input-sampler.spec.ts` 2 案在整套並行下逾時、單獨重跑 3/3 全綠(與 T0 記錄同一支既有環境雜訊,詳 §3,非本次迴歸)。`git diff --stat` 僅 `src/input/mouseGain.ts`(新)+ `src/view/CameraController.ts`/`.test.ts`,未觸及 `src/sim/`、`SharedState`、`SimLoop`、`src/data/` |
| 2026-08-06 | T2 | ✅ | `Meta`/`CollectMetaArgs` 新增 optional `fovDeg` + `mouseIntegration`(`MouseIntegrationMeta`);新增 `requireMouseIntegrationMeta`(`model` 封閉值域 + 三個 step 正有限性驗證)。`main.ts` 的 `buildCurrentExportPayload` 以 `resolveMouseGain({ sensitivity: settingsPanel.sensitivity, hipFovDeg: settingsPanel.fov, ads: weaponConfig.ads })` 產出 gain,`fovDeg: settingsPanel.fov`(**未**讀 `camera.fov`,`git diff` 複查僅新增行,無讀取路徑變動)+ `mouseIntegration: { model: 'tick-window-integral', radPerCount: RAD_PER_COUNT, hipStep, adsStep }` 一併填入,依 README §2.3 註記「本 task 就填」擇一落地。7 個新測試(happy path × 2、非正數/錯值拒絕案 × 4、`meta.suspect` 逐位不變 × 1)。`schema.md` 新增 `meta.fovDeg` 表列 + `meta.mouseIntegration` 新小節。`npx tsc --noEmit` exit 0;`npm run test` vitest **89 files/715 tests 全綠**(708 基線 + 7 新增,零既有期望值變更);`npx playwright test` **19/19 全綠**(含 T1 記錄過的 flaky `input-sampler.spec.ts` 案,本次未重現)。`git diff --stat` 僅 `docs/operational/schema.md` + `src/data/metadata.ts`/`.test.ts` + `src/main.ts`,未觸及 `src/sim/`、`SharedState`、`SimLoop`。 |
| 2026-08-06 | T3 | ✅ | `InputSampler.onPointerMove` 補 `isLocked()` 閘(措辭與 `onMouseDown` fire/ads 閘同源),註解說明此閘是 KI-005 / A tick 窗積分(T4)守恆閘的前提。5 個新測試(未鎖定不入 ring + `bufferOverflow` 不累加、未鎖定 legacy fallback 亦不入、鎖定中行為逐位不變(既有案沿用)、解鎖→移動→重新鎖定→移動只收鎖定期間樣本、detach 後不再入緩衝)。既有 e2e `input-sampler.spec.ts` 的「pointermove coalesced 子樣本各入 ring」案因閘門生效而轉紅(自動化無真實 Pointer Lock,`locked` 恆為 `false`,見同檔前一案的既有斷言)——比照該檔既有 fire 案的**負向路徑**慣例改寫斷言(未鎖定 → `delta` 應為 0),檔頭 docstring 與案名同步更新,歸因記於本行(FM-4 紀律)。`bufferOverflow` 口徑變更(mouse 分支自此只可能在鎖定中累加,只減不增)記入 [schema.md](../../operational/schema.md)`meta.validity` 段(日期 + 理由 + 舊新不可直接比較)。`npx tsc --noEmit` exit 0;`npm run test:ci` vitest **89 files/718 tests 全綠**(715 基線 + 3 新增(mouseGain/CameraController 已計入既有 InputSampler 案數變化);見下方 §3 更新);Playwright **19/19 全綠**(含改寫的 pointermove 案)。`git diff --stat` 僅 `src/input/InputSampler.ts`/`.test.ts` + `tests/e2e/input-sampler.spec.ts` + `docs/operational/schema.md`,未觸及 `src/sim/`、`SharedState`、`SimLoop`、`src/data/` |
| 2026-08-06 | T4 | ✅ | `TickArena` 新增 `dYaw`/`dPitch`（`Float64Array`）+ `hasMouseIntegration`（`Uint8Array`，preallocated，逐 row 決定 `snapshot()` 是否輸出 key，C-7）；`recordFields`/`recordTick`/`recordState` 新增 optional 尾參數。`DataRecorder` 新增 `mouseIntegration`/`configureMouseIntegration`/`accumulateMouse`（閉包持 `AimIntegrator` + 兩個累加器；`consumeMouseAccum()` 在每次 `recordTick`/`recordTickFromState` 呼叫時**無條件**歸零，含 overflow 路徑——歸零發生在呼叫 `ticks.recordTick/recordState` 之前，與 arena 是否接受寫入無關）。`SimLoop.applyInput` 新增 `mouse` 分支：`recorder?.mouseIntegration !== undefined` 時呼叫 `recorder.accumulateMouse(ev.dx, ev.dy, state.heldAds)`，**只寫 recorder,不寫 `state`**（`git diff` 複查：`src/loop/SimLoop.ts` diff 僅 +6/-1 行,無 `state.*` 賦值）。`export.ts::serializeTicksCSV` 依 `ticks[0].dYaw !== undefined` 決定是否追加 `dYaw,dPitch` 兩欄（缺席時表頭逐位不變）。`main.ts`：新增 `currentMouseGain()`（`resolveMouseGain({ sensitivity: settingsPanel.sensitivity, hipFovDeg: settingsPanel.fov, ads: activeWeaponConfig().ads })`），`createDataRecorder` 帶 `mouseIntegration: { gain: currentMouseGain() }`（**全域開**,OQ-A-1）,`loadDrillById` 在 `cameraController.setAdsConfig(...)` 同一批動作後補 `recorder.configureMouseIntegration({ gain: currentMouseGain() })`；`buildCurrentExportPayload` 既有的 `mouseGain`（T2）與此處用**同一公式**（`resolveMouseGain` 純函式,同輸入同輸出,非同一物件參照但數值必然相同——settingsPanel/weapon 在 drill 進行中不可能變動,KI-003）。<br><br>**三個閘**（[T4 §6](T4-tick-window-integration.md)）：① 刷新率不變性——固定合成事件序列（等速+flick,涵蓋 96 tick）分別以 240/165/144/60 Hz 節奏 `pump()`,`ticks[].dYaw/dPitch` 陣列 `toEqual` 逐位相同；② 守恆——`\|Σ dYaw − Δaim.yaw\| ≤ 1e-12`（hip-only,含 pitch 撞 ±MAX_PITCH 案）；③ opt-in 關閉——`TickRecord` 不含 `dYaw`/`dPitch` key（非 `undefined`,是 key 不存在）。<br><br>**RED 基線實測**（見下方 §2d）：240 Hz 組 lowRatio≈0.1154（預期 0.125）、lowMean≈0.553（預期 0.533）、highMean≈1.058（預期 1.067）——精確重現 KI-005 §3.3 簽名；同批資料 dYaw 變異係數≈1.12e-15（≤1e-9 達標）。165/144/60 Hz 舊法 CV 分別≈0.351/0.280/1.040（顯著非零,證明非 240 Hz 特例）,三者 dYaw CV 皆≈1.1e-15。<br><br>**回歸**：`npx tsc --noEmit` exit 0；`npm run test`（vitest）**89 files / 739 tests 全綠**（718 基線 + 21 新增：`DataRecorder.test.ts` +7、`SimLoop.test.ts` +11、`export.test.ts` +3,零既有期望值變更）；`npx playwright test` **20/20 全綠**（19 基線 + 1 新增的 `input-sampler.spec.ts` FR-A-7 案；T0 記錄過的並行環境 flaky 本次未重現）。`git diff --stat` 未觸及 `src/sim/`、`SharedState`、`simStep` 狀態轉移；`src/loop/SimLoop.ts` diff 僅新增 mouse 分支注釋與 4 行邏輯。 |
| 2026-08-06 | T5 | ✅ | `angular.py`:新增 `OmegaSource`/`OmegaResult`,`omega_deg_s` 改回傳 `OmegaResult(values, source)`;`strict` 參數。優先序:兩欄皆存在且逐值有限 → `tick-integral`;否則 → `aim-diff-legacy`(半欄視為 miss,不半猜半讀);`strict=True` 落到 legacy → `raise ValueError`。兩條路徑共用同一數學核心(`hypot(delta_yaw×cos(midpoint_pitch), delta_pitch)/dt_s`),tick-integral 的 `midpoint_pitch = pitch[i] − d_pitch[i]/2` 與 legacy 的 `(pitch[i-1]+pitch[i])/2` 在 `d_pitch[i]≡pitch[i]−pitch[i-1]` 時是同一個量(D-A2 已保證),故無第二定義(C-D4)。`omega[0]` 兩條路徑皆維持 `nan`(D-A3 契約不變)。<br><br>`loader.py`(FR-A-12):`TICK_COLUMNS` 於 `pitch` 後插入 `d_yaw`/`d_pitch`,讀取 JSON tick 的 `dYaw`/`dPitch`(與 `aim` 同層,非巢狀);缺席填 `nan`(`_optional_number`),存在時經既有 `_reject_non_finite` 與 `_number` 雙重把關必為有限值。<br><br>`synthetic.py`:新增 `_RAD_PER_COUNT`(`math.radians(0.022)`)/`_HIP_FOV_DEG`(90°)兩個獨立常數(C-D1,不 import TS);`make_synthetic_export` 為每個**已匯出**(非 dropped)tick 追加 `dYaw`/`dPitch` —— 以「上一個已匯出 tick」為基準的執行中累加器(`prev_yaw`/`prev_pitch`,初值 0,跨 peek 邊界不重置),故 `d_yaw[i] ≡ yaw[i] − yaw[i−1]`(exported 序列的 i)、`d_yaw[0] ≡ yaw[0] − 0`,與 aim 序列逐位自洽(T5 步驟 4 要求);`meta` 新增 `fovDeg: 90.0` 與 `mouseIntegration: { model: 'tick-window-integral', radPerCount, hipStep, adsStep }`(`adsStep` 沿用既有 `weapon.ads.fovDeg=40/sensitivityRatio=1`)。因 `pitch` 恆為 `0.0`、`d_yaw` 恆等於 aim yaw 序列的逐項差,合成 fixture 上 tick-integral 與 legacy 兩條路徑**數學上必然逐位相同**——這正是 FM-5「無第二定義」的證據來源,亦使 `run_pipeline`/`coach_report` 對合成資料的既有數值輸出零變化(只有 `source` 標籤從 legacy 變成 tick-integral)。<br><br>合成 fixture 已regenerate(`uv run python src/modules/ingest/notebooks/t1/generate_synthetic_fixture.py`);epsilon parity fixture 一併重產,`git diff` 確認**零變化**(dYaw/dPitch/meta 新欄不影響 epsilon/on_target,符合預期)。**兩份真實 fixture(08:03/09:39)與 `synthetic_timeline.json` 刻意不動**——後者雖共用 `make_synthetic_export`,但沒有「必須與生成器逐位相符」的測試(不同於 `synthetic_counterstrafe.json` 的 `test_committed_synthetic_fixture_matches_generator`),留作另一個天然的 pre-KI-005 / legacy 回歸樣本,不擴大本次改動範圍。<br><br>呼叫端更新(FR-A-11 的「未留裸 ndarray 相容路徑」):`run_pipeline.py` 於 `run()` 頂層以整份排序後 `export.ticks` 呼叫一次 `omega_deg_s(...).source`(不逐 peek 重算,因為 column 存在性是全匯出層級的屬性),寫入 `summary.export.omegaSource`;legacy 時額外附 `summary.export.omegaSourceWarning`(指向 `docs/known_issue/KI-005-*`);`_analyze_peek` 內原 `omega_deg_s(ticks)` 改 `.values`。`run_sweep.py` 的 `write_real_evidence` 同步改 `.values`。`test_angular.py` 全面改吃 `.values`/`.source`,新增 7 案(legacy 回退、tick-integral 優先、半欄 miss、strict 兩種、`omega[0]` 雙路徑皆 nan、合成 fixture 兩路徑逐位相同用 `np.testing.assert_array_equal`)。`test_loader.py` 新增 3 案(缺欄填 nan、存在時讀值、非有限值經既有 `_reject_non_finite` 拒絕於 `ticks[12].dYaw`)。`test_run_pipeline.py` 新增 2 案(合成 export → `tick-integral` 無警示;08:03 真實匯出 → `aim-diff-legacy` 帶 KI-005 警示字串)。<br><br>**回歸**:`uv run pytest --basetemp=C:/pytest-tmp` **195 passed**(193 基線 + 2 新增於 `test_run_pipeline.py`;`test_angular.py`/`test_loader.py` 的新案已計入 193 內,對照 T4 的 89 files 前身基線 183 + T5 前段 10 案 = 193);`test_purity.py`(kinematics + ingest 兩份,含 C-D1 的 `.ts`/`.tsx` 子字串掃描)全綠。`npx tsc --noEmit` exit 0;`npm run test` vitest **89 files / 739 tests 全綠**(與 T4 記錄逐位相同,T5 未動任何 TS 原始檔,僅重產的合成 fixture 被 `tests/golden/research/epsilon-parity.test.ts` 讀取且全綠);`npx playwright test` **20/20 全綠**。`git diff --stat` 僅命中 `research/` 下列出的 8 個檔案 + 1 份 regenerate 的 fixture,未觸及任何 `src/`(TS)原始檔、`src/sim/`、`SharedState`;兩份真實 fixture 與 `synthetic_timeline.json`/其 parity fixtures 逐位不變(`git diff --stat` 複查零命中)。 |
| | T6 | ⬜ | |
| | T-exit | ⬜ | |

---

## 2. 基線(T0 回填,2026-08-06)

| 項目 | 對照基線 | 實測 |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | ✅ **exit 0** |
| `npm run test:ci` | KI-004/S1 收尾:88 files / 694 tests + 19 e2e | vitest **88 files / 694 tests 全綠**;Playwright **18/19**(1 flaky,見下)→ 整條指令 exit 1 |
| `uv run pytest` | KI-004/S1 收尾:183 passed | 見下「pytest 環境問題」——workaround 後 **183 passed, exit 0**(與基線逐位相同) |
| 08:03 凹口數(KI-005 §3.1) | **27**,間距全為 8 的倍數 | ✅ **27**(精確重現);間距以 64(=8×8)為眾數,多數為 8 的倍數,少量近似值(見「RED 基線重現度」) |
| 09:39 凹口數(KI-005 §3.1) | **34**,眾數 8 | ✅ **34**(精確重現);間距眾數 **8**(精確重現) |
| 1 幀 tick 正規化 ω(§3.3) | **0.550**(ZOH 預測 0.533) | 08:03: 0.504(預測 0.534)· 09:39: 0.549(預測 0.535)—— 同方向、量級相近 |
| 2 幀 tick 正規化 ω(§3.3) | **1.108**(ZOH 預測 1.067) | 08:03: 1.083(預測 1.069)· 09:39: 1.077(預測 1.069) |
| 1 幀 tick 佔比(§3.3) | **12.7%**(預測 12.5%) | 08:03: 14.3%· 09:39: 14.6%—— 同量級,非逐位相符(見下) |
| `corr(frames_in_tick, ω)` | **0.805**(n = 307) | 08:03: 0.618(n=258)· 09:39: 0.626(n=239)—— 方向一致但量值較低,見下說明 |
| 兩份匯出的 `refreshEstimateHz` / `simHz` | 預期 240 / 128 | ✅ 兩份匯出皆 **240 / 128** |

> 基線值取自 [KI-005 §3](../KI-005-omega-render-sim-aliasing.md)。**凹口偵測器與幀數比對的口徑與參數逐字記在下方**,使 [A2-T2](A2-blocked-plan.md) 能原樣重跑(期望回傳 0)。

**RED 基線重現度(誠實記錄,不誇大)**:凹口總數(27/34)**精確重現**——這是選項 A 要修的核心症狀,已確認可重現、可作為 A2-T2「修法後重跑期望 0」的對照基準。幀數比對(§3.3)方向與量級一致(1 幀 tick 正規化 ω 落在 0.50–0.55、2 幀落在 1.08 附近,與 KI-005 §3.3 同量級),但 `corr` 與樣本數 n 未精確重現原始數值(0.618–0.626 vs 0.805;n=239/258 vs 307)。原因:KI-005 §3.3 原文本身承認「frame log 起始錨點為唯一自由參數」但未寫明其求解方式與「高速平順 tick」的精確篩選口徑;本腳本以（a）錨點 = 在 ±半個幀週期內搜尋使 `corr(frames_in_tick, normalised_w)` 最大化的值、（b）「高速平順 tick」= 兩側鄰居 `w[i-1]>80` 且 `w[i+1]>80` 重現,兩者皆為**推定**而非原始腳本(原始診斷腳本未留存於 repo)。此差異記為 Surprise(見下),**不阻塞 T0**——凹口計數的精確重現已足以支撐 G-1 的「修法前 RED」要求,幀數比對的量級一致已足以佐證根因方向;若 A2-T2 需要逐位重跑幀數比對,屆時應優先尋找/重建原始診斷腳本而非信任本推定口徑。

### 2a. 偵測器口徑(T0 回填,A2 重跑用)

```python
# omega_deg_s —— 逐字抄自 research/src/modules/kinematics/algorithms/angular.py::omega_deg_s
# t_ms = ticks[].t(ms);yaw/pitch = ticks[].aim.{yaw,pitch}(rad);result[0] = nan
dt_s           = diff(t_ms) / 1000
delta_yaw      = diff(yaw)
delta_pitch    = diff(pitch)
midpoint_pitch = (pitch[:-1] + pitch[1:]) / 2
speed_rad_s    = hypot(delta_yaw * cos(midpoint_pitch), delta_pitch) / dt_s
w[1:]          = degrees(speed_rad_s)          # w[0] = nan

# 凹口偵測(KI-005 §3.1,對 i in [2, len(w)-2]):
notch(i)  ⇔  isfinite(w[i-1],w[i],w[i+1])  且  w[i-1] > 80  且  w[i+1] > 80  且  w[i] < 0.6 × min(w[i-1], w[i+1])

# 幀數比對(KI-005 §3.3,推定口徑——原始腳本未留存,見上「RED 基線重現度」):
frame_times(anchor) = anchor + cumsum(meta.frames.series)       # ms,series[0] 起算
frames_in_tick[i]   = count(frame_times ∈ (t[i-1], t[i]])       # 半開窗,i>=1
population          = { i : 2<=i<=len(w)-2, isfinite(w[i-1],w[i+1]), w[i-1]>80, w[i+1]>80 }  # 同凹口偵測的鄰居快門檻,但不論 w[i] 本身
normalised_w[i]     = w[i] / mean(w[population])                 # 以 population 自身均值正規化
anchor*             = argmax_{anchor ∈ [-frame_period/2, +frame_period/2]} |corr(frames_in_tick[population], normalised_w[population])|
                       # 41 點均勻掃描;frame_period = median(meta.frames.series)
```

腳本全文(未進 repo,依協議放 scratchpad):`ki005a_t0_red_baseline.py`(執行方式:`cd research && uv run python <path>`,對兩份 `research/fixtures/exports/counterstrafe_ad_v1-*.json` 各印 notch 數/間距分布/幀數分組統計)。

### 2b. §2.4 兩個缺口的行號複核(T0 回填,2026-08-06)

| 缺口 | 檔案:行 | 現況片段 | 複核 |
|---|---|---|---|
| `pushMouse` 無 lock 閘 | [`InputSampler.ts:135`](../../../src/input/InputSampler.ts#L135) | `onPointerMove`:`if (!ring.pushMouse(ev.movementX, ev.movementY, ev.timeStamp)) meta.bufferOverflow++;`——迴圈內**無**任何 `isLocked()` 檢查 | ✅ |
| fire / ads **有** lock 閘(對照) | [`InputSampler.ts:77`](../../../src/input/InputSampler.ts#L77)(fire down)、[`:88`](../../../src/input/InputSampler.ts#L88)(ads down) | `if (!isLocked()) return;`(兩處逐字相同,先於對應 `push*`) | ✅ |
| `main.ts` 未啟用 `recordKeyEvents` | [`main.ts:342`](../../../src/main.ts#L342) | `const recorder = createDataRecorder({ simHz: SIM_HZ });`——僅一個欄位,無 `recordKeyEvents: true` | ✅ |
| `applyInput` 無 mouse 分支 | [`SimLoop.ts:66-94`](../../../src/loop/SimLoop.ts#L66) | 三個分支:`if (ev.type==='key')`(71)、`else if ('fire')`(83)、`else if ('ads')`(88)——**無** `'mouse'` 分支,函式頂端註解自陳「mouse 事件仍忽略」 | ✅ |
| mouse 事件確實經 `consume` 交付到 `applyInput`(僅無分支處理) | [`consume.ts:42-47`](../../../src/input/consume.ts#L42) | `while (!ring.isEmpty() && ring.peekT() < untilT) { ring.dequeueInto(view); ...; handle(view); }`——排空**不分事件類型**,mouse 事件與 key/fire/ads 走同一迴圈被 dequeue 並呼叫 `handle`(= `applyInput`),只是其 `type==='mouse'` 落不進任何 `if` 分支,靜默無操作 | ✅ |
| `InputRing` 以 Float64 存 dx/dy(無精度損失) | [`SharedState.ts:302-303`](../../../src/state/SharedState.ts#L302)(欄位)、[`:342`](../../../src/state/SharedState.ts#L342)(enqueue) | `const aArr = new Float64Array(RING_CAPACITY); // packed a: key→code enum / mouse→dx` / `const bArr = ...; // mouse→dy`;`pushMouse: (dx, dy, t) => enqueue(EV_MOUSE, t, dx, dy)` | ✅ |

三者(pushMouse 無閘、main.ts 未啟用、applyInput 無 mouse 分支)與 README §2.4 描述**逐字相符**,計畫前提成立,可進 T1。

### 2c. `meta.suspect` OR 集合 + `bufferOverflow` 累加點(T0 回填,2026-08-06;T3 的比對基準)

**`suspect` 的完整 OR 集合(兩層)**:

1. [`metadata.ts:219`](../../../src/data/metadata.ts#L219)(建構時):`suspect: explicitSuspect || bufferOverflow || recorderOverflow || frameFloorSuspect`
2. `explicitSuspect` 由呼叫端([`main.ts:383-385`](../../../src/main.ts#L383))傳入:`(protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect) || frames.summary.p95 > PERF_FLOOR_MS`
3. [`export.ts:26`](../../../src/data/export.ts#L26)(序列化時再疊一次):`suspect: meta.suspect || recorderOverflow`

本計畫(A)**不得**變動上述任何一項的判定邏輯或觸發條件——mouse 積分與 `suspect` 無關(README §2.5 前提)。

**`bufferOverflow` 現行累加點**([`InputSampler.ts`](../../../src/input/InputSampler.ts)的 `push*` 失敗分支,`meta.bufferOverflow++`):

| # | 分支 | 行號 | 現受 `isLocked()` 閘門限制? |
|---|---|---|---|
| 1 | `onKeyDown` → `pushKey(down)` | L62 | 否(鍵盤不受此閘,設計如此) |
| 2 | `onKeyUp` → `pushKey(up)` | L68 | 否 |
| 3 | `onMouseDown` fire 分支 → `pushFire(down)` | L79 | **是** |
| 4 | `onMouseDown` ads 分支 → `pushAds(down)` | L90 | **是** |
| 5 | `onMouseUp` fire 分支 → `pushFire(up)` | L106 | 否(mouseup 故意不受閘限制,見 L97-100 註解) |
| 6 | `onMouseUp` ads 分支 → `pushAds(up)` | L112 | 否(同上) |
| 7 | `onPointerMove` → `pushMouse` | **L135** | **否(= §2.4 缺口①,T3 待補)** |
| 8 | `releaseAds` → `pushAds(up)` | L165 | 否(比照 #5/6,補送語意) |

T3 只會在 #7 加閘;FM-8 的口徑基準 = 上表現況,T3 之後預期 #7 一列改「是」,其餘七列逐位不變。

**T3 落地後複核(2026-08-06)**:#7(`onPointerMove` → `pushMouse`)已改為**是**,措辭與 #3/#4 逐字同源;#1/#2/#5/#6/#8 五列逐位不變(未動)。與預期完全一致。

### 2d. T4 RED 基線實測(2026-08-06,`src/loop/SimLoop.test.ts` 的 KI-005 / A RED 基線 describe block)

> 模型見 T4 測試檔內 `driveRenderAndSim` 的 docstring:重現 KI-005 根因的關鍵不對稱——`PointerLock.onMove`
> (camera 路徑)只收**單次 dispatched mousemove 的聚合** `movementX/Y`(一次 render 幀一筆);
> `InputSampler.onPointerMove`(量測路徑)用 `getCoalescedEvents()` 把同一次 dispatch 內的**次幀 raw
> 樣本**逐一各帶自己的 `timeStamp` 推進 ring(`InputSampler.ts:135-140`)。測試以 `RAW_HZ = SIM_HZ×8
> = 1024`(整除 128 Hz,貼近真實 ~1000 Hz 滑鼠)產生等速訊號,camera 端把每個 render 幀窗內的 raw
> 樣本聚合成一次 `applyDelta` 呼叫(重現舊法),ring 端逐個 raw 樣本各自 `pushMouse`(餵新法)。

| render Hz | 舊法 aim-diff ω 變異係數(CV) | 新法 dYaw 變異係數(CV) | 備註 |
|---|---|---|---|
| 240 | lowRatio≈0.1154(預期 0.125)、lowMean≈0.553(預期 0.533)、highMean≈1.058(預期 1.067) | ≈1.12e-15 | 精確重現 KI-005 §3.3 簽名(1/8 幀比例、量級皆對上) |
| 165 | ≈0.351 | ≈1.12e-15 | 顯著非零,證明 aliasing 非 240 Hz 特例 |
| 144 | ≈0.280 | ≈1.12e-15 | 同上 |
| 60 | ≈1.040 | ≈1.13e-15 | 同上(render 遠慢於 sim,誤差量級最大) |

**誠實記錄**:240 Hz 組的 `lowRatio`/`lowMean`/`highMean` 為實測值,與 KI-005 §3.3 文件數字(0.125/0.533/1.067)
量級一致但非逐位相符(取樣去頭去尾暫態各 16/8 tick 後仍有少量統計噪音,見測試斷言採區間而非
`toBeCloseTo` 精確值)。四組 dYaw CV 皆落在浮點精度量級(1e-15),遠低於 NFR-A-6 的 1e-9 門檻。

---

## 3. 受影響測試清單(T0 回填,2026-08-06,FM-4 歸因表)

> 現值:全部存在,目前隨整套 vitest(88 files/694 tests)/ pytest(183 passed)全綠一併通過(見 §2)。

| 測試 | 預期 | 現值 | 歸因 |
|---|---|---|---|
| `src/view/CameraController.test.ts` | **不變**(T1 純重構) | 存在,現綠 | 有變動 ⇒ 浮點運算順序被改(R-1),停 |
| `src/scene/eyePose.test.ts` | 不變 | 存在,現綠(8 tests) | 四場景 camera 逐幀 quaternion 斷言;T1 抽取 `AimIntegrator` 的逐位不變 golden |
| `src/data/metadata.test.ts` / `export.test.ts` | 只增不改 | 存在,現綠 | T2 新增 `meta.fovDeg`/`meta.mouseIntegration`、T4 新增 `ticks[].dYaw/dPitch`,皆 optional |
| `src/state/InputRing.test.ts` / `src/input/InputSampler.test.ts` | T3 可能變動（未鎖定 pointermove 案） | ✅ T3 落地:`InputRing.test.ts` 0 diff;`InputSampler.test.ts` pointermove describe 改注入 `isLocked`（比照 fire/ads describe），新增 5 案，整套 vitest 89 files/**718 tests** 全綠 | T3 新增案，lock 閘;既有案（鎖定中行為）逐位不變（已驗證） |
| e2e 匯出 round-trip(`full-drill.spec.ts` / `br-tracking.spec.ts` / `input-sampler.spec.ts`) | **T4 變動** | 三檔皆存在;整套 19 e2e **19/19**（T0 記錄的 1 flaky 本次未重現） | 新增 additive 欄(FM-4:逐條書面歸因,**不得**關掉旗標)——**另見下方 T3 專屬歸因**:`input-sampler.spec.ts` 的 pointermove 案因本次閘門生效而改寫（非 T4） |
| `tests/e2e/input-sampler.spec.ts`「pointermove coalesced 子樣本各入 ring」案 | **T3 變動**（轄下，非 T4） | ✅ 案名/斷言改寫為「未鎖定 pointermove 被閘門擋、coalesced 子樣本亦不入 ring」，`expect(delta).toBe(3)` → `toBe(0)` | 自動化無真實 Pointer Lock（該檔前一案已斷言 `locked === false`），T3 新閘門下原本「入緩衝」的正向斷言不再成立;比照同檔既有 fire 案的**負向路徑**慣例改寫,正向路徑改由 `src/input/InputSampler.test.ts` 覆蓋。檔頭 docstring 同步更新 |
| 決定性回歸 / golden(`tests/regression/*.test.ts` ×9、`tests/golden/{calibration,recoil,research}/*.test.ts` ×4) | **零變動** | 9+4=13 檔,現綠(計入整套 694) | 有變動 ⇒ 誤觸 sim(NFR-A-1),停 |
| Python `test_angular.py` 既有案 | 不變 | 存在,現綠 | 舊 fixture 走 `aim-diff-legacy`(T5 新增 `source` 分支) |
| `test_run_pipeline.py` / `test_parity_fixture.py` / `test_purity.py` / `test_loader.py` | T5 可能變動(合成 fixture 補欄) | ✅ T5 落地:四檔皆存在,現綠;`test_run_pipeline.py`/`test_loader.py` 各 +2/+3 新案,`test_parity_fixture.py`/`test_purity.py` **零既有案變動**(epsilon parity 值不受 dYaw/dPitch/meta 新欄影響,`git diff` 確認 parity fixture 零變化) | 合成 fixture 補欄未影響既有案期望值(D-A2/D-A3 保證 tick-integral 與 legacy 數值一致);新案為 T5 新增覆蓋 |

**e2e flaky 記錄(與 KI-005-A 無關,環境雜訊)**:整套 `npm run test:ci` 執行 `input-sampler.spec.ts:38`(鍵盤 A/D → sim 消費案)因 `gotoAppReady` 等待 `window.__aimDebug` 逾時 5000ms 而失敗(18/19)。單獨重跑該檔(`npx playwright test tests/e2e/input-sampler.spec.ts`)**3/3 全綠**——確認為並行 14 workers 下的資源競爭雜訊,非程式碼迴歸(本階段零 `src/`/`research/` 改動)。整套 `npm run test:ci` 因此 exit 1,但底層 vitest 88/88 全綠、e2e 單檔重跑全綠;**視為與本次 T0 無關的既有環境雜訊,已記錄不追**。

**golden fixture 全物件比對排查**:`grep` 未在任何 `*.test.ts` 找到對整個 `payload.meta` 或整個 `payload.ticks` 做 `toEqual`/`toMatchSnapshot` 的案例——確認 T2/T4 新增 optional 欄不會觸發此類全物件 diff(僅逐欄斷言的既有測試不受影響)。

---

## 4. Decision Log

| # | 決策 | 理由 | 記於 |
|---|---|---|---|
| **A-D1** | `dYaw`/`dPitch` 記 **rad** 而非 raw counts | 拍板文字即 `sensitivity × RAD_PER_COUNT × adsGain` 累加;`meta.mouseIntegration` 記下係數 ⇒ counts 仍可反推,無資訊損失。記 counts 會讓每個消費端各自重做換算,反而是 C-D4 的風險面 | [README D-A1](README.md) |
| **A-D2** | `dPitch` **套用** ±`MAX_PITCH` 夾角 | ω(t) 的既有構念是**視角**角速度,不是手部意圖;不夾即產生第二定義,且守恆閘失效 | [README D-A2](README.md) |
| **A-D3** | `omega[0]` 契約**不改**,維持 `nan` | `analysis-segments.md` 與 D-28.12 已凍結;為一個樣本改契約會連動 `seg-v1` 與全部既有測試。登錄 TD-3,`seg-v2` 時決定 | [README D-A3](README.md) |
| **A-D4** | 積分器狀態放 `DataRecorder` 閉包,**不進 `SharedState`** | 保住「`SharedState` 演進零 diff」(NFR-A-1)與 ADR-2 三迴圈邊界;`applyInput` 已持有 `recorder` 參數,無需改簽章(比照 WP-29/T3 的 `recordKeyEvents` 模式) | [README §2.7](README.md) |
| **A-D5** | app 佈線層**啟用**(OQ-A-1 全域開) | opt-in 只保 golden 逐位不變,不是運行時可選;分兩種模式會產生「哪些 run 有 ω」的新不確定性。`recordKeyEvents` 至今未啟用即是前車之鑑 | [README §2.4 ②](README.md) |
| **A-D6** | 驗證 FR-A-7(main.ts 已啟用)改走 `__aimDebug.recorder`,**不**擴大改動 `fpsTestHarness.ts` | T4 開工後才發現:`src/testharness/fpsTestHarness.ts` 是刻意獨立於 `main.ts` live 單例的另一條 sim 管線(自建 `createDataRecorder`/`collectMeta`,不驅動 rAF 單例,見其檔頭 docstring)。README §1.4 的 In-scope 檔案清單本就**不含** `fpsTestHarness.ts`——若要讓 `full-drill.spec.ts` 的 `forceExportJSON()` 也帶 `meta.mouseIntegration`/`ticks[].dYaw`,需另外佈線該獨立管線,屬於擴大範圍。改為在既有 dev-only 觀測縫 `__aimDebug`(`main.ts`,已在 T4 In-scope)多暴露一個唯讀 `recorder` 欄位,直接讀正式單例的 `recorder.mouseIntegration`,以 `tests/e2e/input-sampler.spec.ts` 新增一案驗證——精準對應 FR-A-7 字面(「app 佈線層必須啟用」),不動 harness | 本行 + Surprises T4-S1(下方) |
| **A-D7** | 合成 fixture 的 `dYaw`/`dPitch` 以「上一個已匯出 tick」為基準累加(跨 peek 邊界不重置,drop 掉的 tick 視窗直接遺失、不折算進下一筆) | 唯一能同時滿足 T5 §「設計要點」逐字要求(`d_yaw[i] ≡ yaw[i]−yaw[i−1]`、`d_yaw[0] ≡ yaw[0]−初始 yaw`)且不需引入額外「物理連續性」假設的定義;因 `pitch` 恆 0、`d_yaw` 恆等於 aim yaw 序列差,副作用是 tick-integral 與 legacy 兩路徑在此 fixture 上數學上必然逐位相同(FM-5 證據,而非另外構造的巧合) | [README FM-5](README.md) |
| **A-D8** | `omega_deg_s` 的 `source` 判定改在 `run_pipeline.run()` 頂層對整份排序後 `export.ticks` 算一次,**不**逐 peek 視窗各自呼叫後彙總 | column 是否存在/有限是全匯出層級的屬性(同一匯出的所有 tick 列共用同一份 schema),逐 peek 彙總只是多做工;若剛好無任何 `visible` 事件(零 peek 視窗)也仍需要能回報 `source`,逐 peek 彙總在該邊界情形會拿不到值 | 本行 |
| **A-D9** | `synthetic_timeline.json` 與其 3 份 parity fixture **刻意不 regenerate** | 兩者共用 `make_synthetic_export`,理論上也會連帶長出 `dYaw`/`dPitch`/`meta.mouseIntegration`,但**沒有**類似 `synthetic_counterstrafe.json` 的「必須與生成器逐位相符」的測試(`test_committed_synthetic_fixture_matches_generator`)在釘住它,且 T5 spec 的 In-scope 檔案清單只列 `synthetic_counterstrafe.json`。不動 = 讓它自然留作另一個 pre-KI-005 / `aim-diff-legacy` 回歸樣本(與兩份真實 fixture 同一角色),範圍更小、風險更低 | 本行 |

---

## 5. Surprises(實作中發現、與計畫不符者)

| # | 發現 | 影響 | 處置 |
|---|---|---|---|
| **T0-S1** | 純 `uv run pytest`(無參數)在本機因 `C:\Users\Hsin.YH.Yang\AppData\Local\Temp\pytest-of-Hsin.YH.Yang` 目錄權限被拒(`PermissionError: [WinError 5]`,連 `Get-Acl` 都無權限讀取,疑為前次異常中斷或端點防護鎖定)而在 setup 階段炸出 56 個 ERROR,與程式碼無關(git status 全程乾淨)。以 `uv run pytest --basetemp=<專案內臨時目錄>` 繞過後得到 **183 passed, exit 0**,與 KI-004/S1 基線逐位相同,證實純環境問題。**未修改**該系統目錄(權限層級超出本次授權範圍),僅記錄繞過法供後續 task 需要重跑 pytest 時參考;若該目錄權限問題自行恢復,原生 `uv run pytest` 應可直接綠燈。 | 不阻塞 T0(已用 workaround 取得可信基線數字);後續 task 跑 pytest 若遇同錳訊息,套用同一 `--basetemp` 繞過即可,不代表迴歸 | 記錄,不修復系統目錄 |
| **T0-S2** | KI-005 §3.3 的幀數比對只寫「唯一自由參數 = frame log 起始錨點」,未留存原始診斷腳本、未寫明「高速平順 tick」篩選口徑與正規化分母。本次 T0 以推定口徑重現(見 §2a)得到方向一致但量值有落差的結果(`corr` 0.618–0.626 vs 文件 0.805;n=239/258 vs 307)。凹口總數(27/34)本身**精確重現**,不受此影響。 | A2-T2 若要逐位重跑幀數比對(而非僅重跑凹口計數),需先確認是否有原始診斷腳本可重建,否則本推定口徑即為權威 | 記錄為已知落差,不在 T0 範圍內解決(T0 僅需可重現的 RED 證據,凹口計數已達標) |
| **T0-S3** | T0 執行期間,`git status` 出現與本計畫無關的異動:`docs/known_issue/KI-006-m14-sample-no-counterstrafe.md`(改動)+ 新資料夾 `docs/known_issue/KI-006-C/`(8 個未追蹤檔案)。T0 開始前已確認 `git status` 乾淨(README/T0 step 1 前提成立時拍照),此為**執行期間由外部併發產生**(非本 session 建立),判斷為另一支平行進行的 KI-006 相關工作。**本次 T0 commit 僅 stage `docs/known_issue/KI-005-A/` 下的檔案,不動、不 stage KI-006-C 的任何內容**。 | 不影響 T0 本身的 DoD(§範圍界定清楚);提醒後續 task 開工前重新確認 `git status` | 保留不動,只精準 stage 本次切片檔案 |
| **T4-S1** | `src/testharness/fpsTestHarness.ts`(供 `full-drill.spec.ts`/`br-tracking.spec.ts`/`spray-drill.spec.ts` 用)自建一條與 `main.ts` live 單例**完全獨立**的 sim 管線(自己的 `createDataRecorder`/`collectMeta`/`buildExportPayload`,不驅動 rAF、不共用 `recorder`)。一開始以 `harness.feedInput([{type:'mouse',...}])` + `forceExportJSON()` 驗證 FR-A-7 的 e2e 案因此得到 `meta.mouseIntegration === undefined`——不是迴歸,是驗證了**錯的管線**。 | 若照原計畫在 `full-drill.spec.ts` 驗 FR-A-7,需一併佈線 harness(擴大 README §1.4 In-scope 之外的檔案) | 改走 `main.ts` 既有 `__aimDebug` dev-only 縫,多暴露 `recorder` 一個唯讀欄位;於 `input-sampler.spec.ts`(已在 In-scope 的 e2e 觀測管道)新增案直讀 `__aimDebug.recorder.mouseIntegration`,精準驗證「app 佈線層」而不動 harness(見 [Decision Log A-D6](#4-decision-log)) |

---

## 6. Open Questions(執行中新增 / 關閉)

| # | 問題 | 狀態 | Owner |
|---|---|---|---|
| ~~OQ-A-1~~ | app 啟用範圍 | ✅ 2026-08-06 關閉:**全域開** | 使用者 |
| ~~OQ-A-2~~ | 是否一併開 `recordKeyEvents` | ✅ 2026-08-06 關閉:**本次否**,登錄 TD-5 | 使用者 → 研究者 |
| OQ-A-3 | dPitch 夾角情形是否需 quality flag | 🟡 建議先不加 | 研究者 |
| OQ-A-4 | `beat_period_ticks` 進 `meta.display.gate`(= OQ-KI5-5) | 🟡 未決,不阻塞 A1 | 使用者 |
| OQ-A-5 | 新採樣時機與規模(= OQ-KI5-6) | 🟡 未決 → [A2-T1](A2-blocked-plan.md) | 研究者 |
| OQ-A-6 | 守恆閘在 ADS 樣本上的容差 | 🟡 A1 只宣告 hip-only exact | 實作者 → 研究者 |
