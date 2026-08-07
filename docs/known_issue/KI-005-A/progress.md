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
| 2026-08-06 | T6 | ✅ | 零程式碼改動,純文件/帳本對帳(FR-A-13/14)。`analysis-segments.md`:`omega_deg_s` 段改寫為雙 source(`tick-integral`/`aim-diff-legacy`)敘述,明記同一構念、同一數學核心,只差 delta 來源(C-D4);`seg-v1` 列加註「SG window 7 < beat 週期 8,對真實資料的適用性未經驗證,須 `seg-v2` 重掃」。`schema.md`:補 `ticks[].dYaw`/`dPitch` 兩欄(單位/語意/D-A2 夾角效果/缺席條件)+ CSV 條件表頭說明(FM-7);複查既有 T2/T3 寫入的 `meta.fovDeg`/`meta.mouseIntegration`/`bufferOverflow` 口徑段落與實作一致(已在,無需改動)。`KI-005-omega-render-sim-aliasing.md`:狀態翻「✅ 選項 A 已落地(A1);A2 待排程」;§6.2 缺口標已補;§7 驗證計畫逐項標記 1/2/3/6(A1 已交付)· 4/5(⛔ A2 blocked);新增「A1 落地後的殘餘限制」段(TD-1/TD-2/**FM-1 未證偽**);§6.1 引用段的兩個新發現(pointer-lock 閘/`main.ts` 啟用)標記已隨 T3/T4 處理。`BUGFIX-DECISIONS.md`:§1 索引 KI-005 列 → 「🟡 A1 已落地,A2 待新採樣」;BD-005 新增「A1 落地(2026-08-06)」段,含實測前後數字(240 Hz lowRatio/lowMean/highMean 三項、165/144/60 Hz 舊法 CV、新法四節奏 CV≈1.1e-15)、兩個計畫階段新發現、偏離協議(T4/T5 顆粒度)、明確未交付項(M14 ③④⑤ 未重新宣告、WP-30/31 entry blocker 未解除)。`MAP.md`/`exec-plan/README.md`/`stage4/README.md`/`WP-28 progress.md`:M14 相關敘述全數對帳為「③④⑤ 仍撤回,KI-005 A1 已落地/A2 待排程,KI-006 待拍板,解除條件均未滿足」——WP-28 progress.md 為 running log,**不改寫既有歷史列**,改以新增一列(2026-08-06 KI-005 A1 落地)+ 在既有「WP-30/31 entry blocker 現況」段落後追加一行「對帳」註記的方式處理,避免竄改 episodic memory。全文複查:未出現任何「儀器修好」被寫成「效度恢復」或「M14 已恢復」的措辭。`git diff` 只命中 `docs/` 下的檔案。 |
| 2026-08-07 | T-exit | ✅ | 八道 A1 exit gate 已回填於 [T-exit-gate.md](T-exit-gate.md):G-1/G-2/G-3/G-5/G-6/G-7/G-8 由既有 KI-005 / A 測試與文件對帳覆蓋;T-exit 現場回歸:`npx.cmd tsc --noEmit` exit 0;`npm.cmd run test:ci` exit 0(vitest **89 files / 739 tests**,Playwright **20/20**);`uv run pytest` 原生仍受 T0-S1 的外部 Temp ACL 問題阻擋,以 workspace-local `--basetemp ..\codex_pytest_tmp_t_exit` 重跑 **195 passed**。`git diff --stat` 在回填前為空;本切片只修改 `docs/known_issue/KI-005-A/T-exit-gate.md`、`progress.md`、`task-checklist.md`。A1 交付判定:✅ **量測儀器修好**;A2(新採樣/複驗/`seg-v2`)仍 blocked;M14 ③④⑤ 與 WP-30/31 entry blocker 仍未解除。 |
| 2026-08-07 | A2-T1 | ✅ | 研究者於同一台 240 Hz 機器實際執行三個 counter-strafe session(09:18/09:24/09:37,`counterstrafe_ad_v1`),提交匯出 + `construct_presence` 產物。逐項核對 DoD(見 [A2-blocked-plan.md](A2-blocked-plan.md) A2-T1):`omega_deg_s(..., strict=True)` 三份皆不拋錯、`export.omegaSource == "tick-integral"`(A1 修法生效);`counter` 事件數 23/25/20,皆 > 0;`events` 含 `type === 'key'` 86/84/78 筆(OQ-A-2/TD-5 的 `recordKeyEvents` 接線在真實採集中確認生效,非僅測試);橫移 tick 佔比 0.656/0.654/0.644,遠高於 `construct-v1` 下限 0.05、亦優於舊 09:39 樣本的 0.520。`run_pipeline` 對三份匯出**獨立重跑**(不僅信任提交的產物)皆 exit **0** 且 `constructPresence.present == true`。session 數 = 3 > 2(OQ-KI6-4 決議達標)。240 Hz(`meta.display.refreshEstimateHz`)、`meta.mouseIntegration` 皆確認存在(B-5)。**觀察 → 已確認為 bug,升級為 [KI-007](../KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md)**:09:18/09:24 兩份 `meta.suspect == true`,追碼([main.ts:410-412](../../../src/main.ts#L410-L412))確認觸發源是 `experimentSession.suspect`(GD-10)。研究者確認錄製期間**未**中途退出全螢幕,只在整個測試結束後才退。根因:`experimentSession.exit()` 只在多條件 protocol 流程呼叫,單一「實驗 session」drill 流程從未呼叫,`active` 對整頁生命週期恆 true,drill 結束後正常退出全螢幕去抓匯出檔的動作因此被誤判為條件失效。**非**走廊越界(`meta.validity.corridorExceeded` 三份皆 `true`,K-3 下純觀測、不影響效度)。**確認為誤判,不影響 09:18/09:24 作為 M14 效度證據的可信度**;修法已於同日落地(`experimentSession.handleFullscreenChange` 新增 `recording` 參數,只在 drill 錄製中才判定失效),見 [KI-007](../KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md) / BD-007。 |
| 2026-08-07 | A2-T2 | ✅ 四項複驗完成,使用者確認判讀,整體通過;③ 有確認的外部混淆因子(記錄不隱藏),詳見下方 §2e | **方法**:凹口偵測器逐字沿用 T0 §2a 記錄的公式(`w[i]<0.6×min(w[i-1],w[i+1])` 且兩鄰居 `>80`),直接呼叫既有 `research/src/modules/kinematics/algorithms/angular.py::omega_deg_s`(不重新實作演算法)取得 `w`;守恆檢查同樣直接讀匯出 `ticks[].dYaw/dPitch` 與 `ticks[].aim.{yaw,pitch}`。腳本為臨時腳本,置於 session scratchpad,未進 repo(比照 T0 慣例)。**① 凹口偵測器**:09:39 基準(legacy ω,今日重跑,作為腳本正確性 sanity check)= **34 個**,間距眾數 8(與 T0 記錄逐位相符,證明腳本一致);三份新匯出(tick-integral ω)= **3/2/2 個**,較基準降 >90%,但**非literal 0**。逐一核對:三份匯出的殘餘凹口間距皆非 8 的倍數(09:18: 3 tick 間距;09:24: 相隔 1029 tick;09:37: 4 tick 間距),且與 `vx`(橫移速度)在同一窗口內**單調變化**(無反向/急停事件重合)——非 render/sim beat 的週期性訊號,較符合真實滑鼠輸入的偶發微變異。**② `merged_adjacent_peaks` 比例**:09:39 基準(legacy ω,今日重跑)= 20/21(**95.2%**;KI-005 文件原載 15/19≈79%,今日重跑數字更高但方向相同,見下 Surprise);三份新匯出 = 12/21(57.1%)、11/19(57.9%)、13/20(65.0%)——**顯著下降**,不論對照哪個基準數字結論皆成立。**③ 未 flag 樣本數**:09:39 基準(今日重跑)`quality` 為**空字典**(0 個未 flag 樣本,全數因 `missing_target` 被排除);三份新匯出 = 9、8、7 個未 flag 樣本——方向與預期相符(上升),但**確認為混淆**:09:39 的 `meta.scene` 缺少 `eye` 欄位(2026-08-05 捕獲,早於 2026-08-06 落地的 KI-004/S1),`run_pipeline.py` 的 `resolve_eye_origin(meta, strict=True)` 對此類舊匯出正確拒絕猜測、回傳 `None`,連帶 `missing_target` flag 蓋滿所有 peek/segment([run_pipeline.py:344](../../../research/src/report/run_pipeline.py#L344) 的 docstring 明載此為 KI-004/S1 T5 的刻意設計,非本次迴歸)。**此項改善混雜了 KI-004/S1(eye origin)與 KI-005/A1(ω aliasing)兩個獨立修法的效果,無法用 09:39 單獨隔離出 A1 的貢獻**。**④ 守恆(FM-1)**:三份新匯出 `Σ dYaw` vs `Δaim.yaw`(hip-only,`ads_events=0`)殘差皆 **≤ 5.6e-16**(浮點雜訊量級,非近似相等而是機器精度內完全相等);另補測 `Σ dPitch` vs `Δaim.pitch`,殘差同樣 ≤ 7.1e-16。**FM-1 視為關閉**:coalesced mouse 樣本在真實硬體上未遺失或重複計入,修的確實是歸屬而非量值,不觸發「選項 B 提前」的升級條件。 |
| 2026-08-07 | A2-T3 | ✅ `seg-v2` 重掃、視覺覆核、凍結、佈線、全鏈重跑完成,見 §2f | `SEG_V2_PARAMS`(window=11/σ=0.75/floor=60)凍結,`seg-v1` 原地保留;`run_pipeline.py` 依 omega source 自動選版;TD-3 拍板不改;`uv run pytest` 221→228 passed(既有僅 1 案期望值改寫,預期且刻意) |
| 2026-08-07 | A2-T4 | ✅ M14 ③④⑤ 逐項重新宣告 + KI-006 解除判定完成,見 §2g | 獨立重跑 `run_pipeline` 覆核三份新匯出(`constructPresence.present==true`/`omegaSource==tick-integral`/`seg-v2` successRate 1.00·0.95·1.00,逐位與既有記錄相符);KI-006 §6 B-1~B-5 全數滿足(B-1 由使用者於本次覆核時事後口頭確認,登記 A2-S5);KI-006 轉 CLOSED;M14 ③④⑤ 重新宣告;WP-30/31 entry blocker 三條理由全數解除 |

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

### 2e. A2-T2 四項複驗明細(2026-08-07 回填)

**① 凹口偵測器**(公式逐字沿用 §2a,直接呼叫 `omega_deg_s`,不重新實作):

| 匯出 | ω source | 凹口數 | 間距 |
|---|---|---:|---|
| 09:39(今日重跑,legacy,腳本正確性 sanity check) | `aim-diff-legacy` | **34** | 眾數 **8**(與 T0 記錄逐位相符) |
| 09:18(新) | `tick-integral` | **3** | idx 626/629/631,間距 3、2(非 8 倍數) |
| 09:24(新) | `tick-integral` | **2** | idx 541/1570,相隔 1029 tick(非週期性) |
| 09:37(新) | `tick-integral` | **2** | idx 1286/1290,間距 4(非 8 倍數) |

三份新匯出的殘餘凹口與同窗口的 `ticks[].vx` 逐一核對:`vx` 在每個凹口窗口內皆**單調變化**(無鍵盤方向反轉、無急停事件重合),殘餘凹口的間距也**不是** 8 的倍數或呈現任何週期性——與 09:39 基準「間距眾數 8」的系統性訊號特徵不同。判讀:**系統性 render/sim beat 假象已消除**(降幅 >90%),殘餘的 2–3 個凹口較符合真實滑鼠輸入本身的偶發微變異(人手不可能絕對等速),而非同一根因復發。**非 literal 0**,與 A2-blocked-plan.md 原始預期的字面表述有落差,已如實記錄,不強行判讀為「完全通過」。

**② `merged_adjacent_peaks` 比例**:

| 匯出 | merged_adjacent_peaks | segmentCount | 比例 |
|---|---:|---:|---:|
| **08:03(今日重跑)** | 15 | 19 | **78.9%**(≈79%) |
| KI-005 原文件基準(2026-08-05/06 診斷時) | 15 | 19 | **78.9%**(≈79%) |
| 09:39(今日重跑,次要參照) | 20 | 21 | 95.2% |
| 09:18(新) | 12 | 21 | **57.1%** |
| 09:24(新) | 11 | 19 | **57.9%** |
| 09:37(新) | 13 | 20 | **65.0%** |

**更正(A2-T3 執行期間發現)**:A2-T2 當時誤認 KI-005 文件基準取自 09:39,實測 09:39 今日重跑為 95.2% 而非文件的 78.9%,一度記為「未解落差」(見下方 A2-S4)。A2-T3 全鏈重跑時複查發現 **08:03(非 09:39)今日重跑逐位精確重現原文件基準**:`successRate 19/20=0.95`、`merged_adjacent_peaks 15/19=78.9%(≈79%)`,兩項與 KI-005 §1 表列數字**完全一致**——原始診斷當時使用的匯出應為 08:03。A2-S4 的「不追查」處置予以撤銷,改記為已解;09:39 保留為次要參照(同為 legacy 樣本,佐證 legacy ω 在不同真實樣本上皆易觸發高比例 merge,不影響②的方向結論)。**不影響結論**:不論取哪個 legacy 基準(78.9% 或 95.2%),三份新匯出(57–65%)都顯著更低。

**③ 未 flag 樣本數**(`duration_ms`/`peak_omega_deg_s`/`mean_epsilon_deg`):

| 匯出 | n(未 flag) | n_flagged |
|---|---:|---:|
| 09:39(今日重跑) | **0**(`quality` 為空字典) | 21(全數 `missing_target`) |
| KI-005 原文件基準 | 4 | 15 |
| 09:18(新) | 9 | 12 |
| 09:24(新) | 8 | 11 |
| 09:37(新) | 7 | 13 |

09:39 今日重跑 `missing_target` 蓋滿全部 peek/segment,追碼確認為 [`run_pipeline.py:344`](../../../research/src/report/run_pipeline.py#L344) 的 `resolve_eye_origin(meta, strict=True)`——09:39 的 `meta.scene` 缺 `eye` 欄位(2026-08-05 捕獲,早於 2026-08-06 落地的 KI-004/S1),strict 模式對此類舊匯出正確拒絕猜測、回傳 `None`,docstring 明載此為 **KI-004/S1 T5(FR-S1-7)的刻意設計**,非本次迴歸、非本次新引入。**確認為混淆變數**:③ 的改善同時包含 KI-004/S1(eye origin 修復)與 KI-005/A1(ω aliasing 修復)兩者效果,無法用 09:39 單獨隔離出 A1 一項的貢獻;方向與預期相符,但不視為 A1 單獨的乾淨證據。

**④ 守恆(關閉 FM-1)**:

| 匯出 | `Σ dYaw` vs `Δaim.yaw` 殘差 | `Σ dPitch` vs `Δaim.pitch` 殘差 |
|---|---:|---:|
| 09:18 | 3.47e-16 | 7.03e-16 |
| 09:24 | 1.11e-16 | 4.44e-16 |
| 09:37 | 5.55e-17 | 3.61e-16 |

三份新匯出皆為 hip-only(`events` 中 `ads` 事件數 = 0)。殘差全數落在浮點精度雜訊量級(< 1e-15),**非近似相等,是機器精度內完全相等**。**FM-1(A1 內無法證偽的唯一假設)視為關閉**:coalesced mouse 樣本在真實硬體上與 render path 消費的總量完全一致,未遺失、未重複計入;證實選項 A 修的確實是**歸屬**(哪個 tick 拿到這段角位移)而非**量值**(總角位移多少)。**不觸發**「立即把選項 B 提前」的升級條件(A2-blocked-plan.md §A2-T2 的 ⚠️ 條款)。

**總結判讀**:④(最關鍵、FM-1 的唯一驗證點)以機器精度通過;②方向清楚顯著下降;①系統性訊號消除(降幅 >90%,殘餘訊號特徵與原根因不符)但非 literal 0;③方向相符但與 KI-004/S1 混淆,不能單獨歸功於 A1。整體判讀為**四項複驗支持 A1 修法有效**,但 ①③ 的字面表述與原始 pre-register 期望(「回傳 0」「n=4 對照」)有需要解讀的落差,已誠實記錄,不做事後降低門檻的合理化。

**① 的視覺化覆核(2026-08-07,使用者要求)**:針對「殘餘凹口是否為根因復發」畫圖覆核而非只看數字。09:39 基準圖(legacy ω)顯示典型症狀簽名——尖銳、孤立的單 tick 深凹,坐落在其餘相對平滑的 burst 波形中,與 KI-005 §1 描述的「302→17」樣態一致。三份新匯出(tick-integral ω)的圖顯示**整段 burst 皆呈細碎鋸齒狀**——不只在被偵測器標記的點,`vx`(鍵盤驅動,背景橘線)在每個放大視窗內都平滑升降,而 ω 逐 tick 鋸齒震盪貫穿整個 burst;被標記的「凹口」只是這個貫穿性鋸齒紋理偶然跨過偵測器固定門檻(`0.6×min(鄰居)`)的位置,不是獨立於背景噪訊之外的孤立異常。判讀:tick-integral 是**更高解析度**的訊號(直接讀每個 tick 窗的原始滑鼠增量),天生比「差分一個較粗、render 速率量化過的訊號」更有紋理雜訊;凹口偵測器的門檻是針對舊訊號的「平滑但週期性斷裂」特徵校準的,新訊號整體雜訊底噪略高但**不週期、不孤立**,不構成同一根因復發的證據。**使用者已看圖確認此解讀,A2-T2 整體判定為通過**。 |

**A2-T2 最終判定(2026-08-07,使用者確認)**:四項複驗**整體通過**,支持 A1(KI-005 選項 A)修法在真實硬體資料上有效。逐項結論:④ 機器精度通過(FM-1 關閉);② 顯著下降,通過;① 系統性訊號消除,視覺覆核確認殘餘為訊號雜訊底噪而非根因復發,通過;③ 方向相符但與 KI-004/S1 混淆,記錄為觀察不作為 A1 獨立證據。**不觸發**選項 B 提前的升級條件。下一步:[A2-T3](A2-blocked-plan.md#a2-t3--seg-v2-重掃與凍結) `seg-v2` 重掃與凍結。

---

## 2f. A2-T3:`seg-v2` 重掃與凍結(2026-08-07)

**方法**:沿用 `run_sweep.py` 既有的合成案例評分邏輯(6 個手寫預期邊界案例,通過條件 = 零案例失敗 + 邊界誤差 ≤2 tick),**放寬** SG window 搜尋空間至 `{5,7,9,11,13}`(seg-v1 原本受限於 beat=8 的隱性顧慮已隨 A1 落地解除);**新增**第二個評分維度——對 A2-T1 三份真實 tick-integral 匯出計算 `merged_adjacent_peaks` 比例(seg-v1 原始掃參從未能用真實資料驗證,因為當時真實匯出必然帶 aliasing)。243→放寬後 1215 組候選,135 組通過全部合成案例。

**結果**:候選集中在 `sg_window=11, peak_sigma_k=0.75` 一帶,顯著優於 seg-v1(`window=7, sigma=0.5`)。呈給使用者的兩個候選:

| 候選 | window | σ | floor | merged(三份真實匯出合計) | success rate |
|---|---:|---:|---:|---:|---:|
| A(採用) | 11 | 0.75 | 60 | **38.3%**(23/60) | **98.3%**(與 seg-v1 持平) |
| B | 11 | 0.75 | 100 | 35.1%(更低) | 93.3%(較低) |
| seg-v1(對照) | 7 | 0.5 | 80 | 60.0%(36/60) | 98.3% |

**視覺覆核(使用者要求)**:針對候選 A,畫出 9 個代表性 peek(6 個 seg-v1 判定 merged、3 個 seg-v1 判定 clean)的 seg-v1 vs 候選 A 疊圖比較。結果:**segment 起訖邊界(start_idx/end_idx)在所有檢視案例中逐位不變**,唯一改變的是 `merged_adjacent_peaks` 內部分類——window=11 讓峰值偵測不再把單一 burst 內的雜訊小波動誤判為兩個需合併的相鄰峰。此發現直接回應「window 加寬是否會模糊真實反向轉折時機」的疑慮:**不會,時機邊界不受影響**。使用者看圖後確認採用**候選 A**。

---

## 2g. A2-T4:M14 ③④⑤ 重新宣告 + KI-006 解除判定(2026-08-07)

**獨立覆核**(不信任文件裡的舊數字,重跑 `uv run python src/report/run_pipeline.py --export <fixture>`):對三份 A2-T1 新匯出(09:18/09:24/09:37)重新執行,結果逐位與 progress.md §2e/§2f 記錄相符——`constructPresence.present == true`(family=`counterstrafe`,construct=`counter-strafe`,counter 23/25/20,movingTickRatio 0.6560/0.6535/0.6444)、`omegaSource == "tick-integral"`(無 warning)、`seg-v2` 自動選版(successRate 1.00/0.95/1.00,segmentCount 21/19/20)。無數字漂移。

**KI-006 §6 B-1~B-5 逐項核對**(見 [A2-blocked-plan.md A2-T4](A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07) 完整表):B-2~B-5 皆有既有書面證據且已獨立重跑確認;**B-1**(採集前明確要求受試者執行完整 counter-strafe)在 progress.md 既有記錄中找不到「事前指示」的書面記錄——只有事後結果(`counter>0`/`vx` 非恆零)滿足 B-2/B-3。此缺口已提報使用者確認,使用者(即採集者本人)於本次覆核時確認**採集前確實口頭要求過**。記為 Surprise **A2-S5**(見下)。**B-1~B-5 全數滿足 ⇒ KI-006 自 OPEN 轉 CLOSED**。

**M14 逐項判定**:③(A2-T2 完成 + A2-T3 以同一組合成案例重驗證,證據力更紮實)、④(A2-T2 守恆閘機器精度通過 + KI-006 解除,兩條件同時滿足)、⑤(A2-T3 `seg-v2` 已重掃凍結)——**三項皆重新宣告**。**WP-30/31 entry blocker** 三條理由(KI-004/KI-005/KI-006)全數解除,entry blocker 正式解除。

**效度聲稱不擴大**:措辭沿用 WP-28 既有限制(單一匿名受試者、n=3 session、非母體層級證據);引用 A2-T2 四項複驗時如實帶出①非 literal 0(視覺覆核後判讀)、③與 KI-004/S1 混淆(不單獨作為④的證據)。

**對帳範圍**:[KI-005-A/A2-blocked-plan.md](A2-blocked-plan.md)、本檔、[task-checklist.md](task-checklist.md)、[KI-005-omega-render-sim-aliasing.md](../KI-005-omega-render-sim-aliasing.md)、[KI-006-m14-sample-no-counterstrafe.md](../KI-006-m14-sample-no-counterstrafe.md)、[BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md)(BD-005/BD-006)、[exec-plan/README.md](../../exec-plan/README.md) §3 M14 列、[stage4/README.md](../../exec-plan/active/stage4/README.md)、[wp-28/progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md)、[MAP.md](../../MAP.md)。全域複查 `grep -rn "M14"` / `grep -rn "KI-006"` 無矛盾殘留(見下)。

**回歸**:純文件任務,零程式碼改動;`npx tsc --noEmit` exit 0、`npm run test:ci` 案數與期望值不變、`uv run pytest` 228 passed 不變(僅獨立重跑三份 fixture 驗證數字,未改動任何原始碼或測試)。

**凍結**:`SEG_V2_PARAMS`(`sg_window=11, sg_poly=3, peak_sigma_k=0.75, peak_floor_deg_s=60.0, low_ratio=0.1, stop_ratio=0.2, version="seg-v2"`)新增於 `research/src/modules/segments/algorithms/submovement.py`,`DEFAULT_SEGMENT_PARAMS`(seg-v1)逐位不變、原地保留(D-28.7 不得原地調參)。

**佈線**:`run_pipeline.py::run()` 的 `params` 參數改為 `SegmentParams | None = None`;未顯式傳入時,依 `omega_deg_s(...).source` 自動選版——`tick-integral` → `seg-v2`、`aim-diff-legacy` → `seg-v1`(`DEFAULT_SEGMENT_PARAMS`)。顯式傳入 `params` 時仍以呼叫端為準(供比較用途覆寫)。`segment_submovements()` 自身的預設值不變(仍是 `DEFAULT_SEGMENT_PARAMS`/seg-v1),自動選版邏輯只存在於 `run_pipeline.py` 這一層,`algorithms/` 保持純函式無時鐘/無 I/O 紀律不變。

**TD-3(omega[0]=nan 契約)**:使用者拍板**不改**,維持 `omega[0]=nan` 兩個 source 共用同一契約。理由:雖然 tick-integral 下 `ticks[0].dYaw` 確實有真實值(`0.0`,非缺失),但下游多處(`run_pipeline.py` 的 `_OMEGA_INDEX_OFFSET` 等)已假設「index 0 恆 nan、統一位移」,改動會強迫這些呼叫點依 source 分支,換取的只是每個視窗 1 個 tick(~7.8ms)的資料,不划算。已寫入 [analysis-segments.md](../../operational/analysis-segments.md) 取代原本「待 seg-v2 時決定」的 TD-3 註記。

**全鏈重跑**(D-28.7 DoD 要求):
- 08:03(legacy)→ `seg-v1`,`successRate=0.95`、`merged=15/19≈78.9%` —— **逐位精確重現 KI-005 原文件基準**(見下方更正說明)。
- 09:39(legacy)→ `seg-v1`,`successRate=0.95`、`merged=20/21≈95.2%`(次要參照)。
- 09:18/09:24/09:37(tick-integral)→ `seg-v2`,`successRate=1.00/0.95/1.00`、`merged=6/21、8/19、9/20`(合計 38.3%)。
- `synthetic_counterstrafe.json`(預設匯出,tick-integral)→ `seg-v2`,`successRate=1.0`、`merged=0`(2 個 segment)。

**回歸**:`npx tsc --noEmit` exit 0(零 TS 改動);`npm run test:ci` Vitest 89 files/741 tests 不變 + Playwright 21/21 不變;`uv run pytest` 221→**228 passed**(+7:`test_seg_v2_selected_automatically_for_tick_integral_omega`、`test_seg_v1_selected_automatically_for_legacy_omega`、`test_explicit_params_override_the_omega_source_auto_selection`、`test_seg_v2_known_submovement_boundaries_are_within_two_ticks`×3 參數化案、`test_seg_v2_params_are_frozen_versioned_and_distinct_from_seg_v1`)。**既有測試僅一案期望值改寫**(`test_synthetic_export_produces_all_three_artifacts`:`segmentation.paramsVersion` 從 `DEFAULT_SEGMENT_PARAMS.version` 改為 `SEG_V2_PARAMS.version`,因預設合成匯出帶 dYaw/dPitch,自動選版邏輯正確選中 seg-v2;此為**預期且刻意**的行為改變,非迴歸)。`git diff --stat` 命中 `research/src/modules/segments/algorithms/{submovement,__init__}.py`、`research/src/report/run_pipeline.py`、三個測試檔、`docs/operational/analysis-segments.md`,未觸及任何 TS 原始檔、`src/sim/`、`SharedState`。

**更正(A2-T2 誤植)**:A2-T2 §2e 記錄「09:39 今日重跑 95.2% vs 文件基準 78.9%,未解落差」(A2-S4)。A2-T3 全鏈重跑複查發現 KI-005 原文件的 `successRate=0.95`/`merged_adjacent_peaks=15/19≈79%` 基準其實取自 **08:03**(`analysis-segments.md` 的 real-export validation 段本就明確記載匯出檔名為 `...T08_03_45.617Z`,A2-T2 撰寫時未交叉核對而誤用 09:39 比較)。08:03 今日重跑逐位精確重現,A2-S4 已改標關閉。

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
| **A-D10** | A2-T1 前置決策批次(2026-08-07,使用者拍板):**OQ-A-5/OQ-KI5-6** 新採樣與 KI-006 選項 B **合併為同一次採集**;**OQ-A-2/TD-5** 重新開放後決議**開啟** `recordKeyEvents`;**OQ-KI6-4**(KI-006 側)n > 2 session | 三者互相依賴,一次拍板才能一次採到位(比照 [A2-blocked-plan.md 前置條件](A2-blocked-plan.md)的設計初衷)。`recordKeyEvents` 開啟後才有 sub-tick 鍵釋放時刻,是這輪採樣要支援 KI-006 構念分析的必要欄位 | [README OQ-A-2/A-5](README.md) · [KI-006-C/progress.md §6](../KI-006-C/progress.md) · [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-005 |
| **A-D11** | TD-5 落地:`main.ts:355` 的 `createDataRecorder(...)` 加上 `recordKeyEvents: true`,不另建切換或設定項 | A-D10 已拍板為全域決議,比照 OQ-A-1(mouse 積分)/A-D5 的同一紀律——opt-in 只保 golden 逐位不變,不做「哪些 run 有 key 事件」的運行時可選,避免重蹈 `recordKeyEvents` 至今未啟用的前車之鑑 | 本行 + Surprises A2-S1 |
| **A-D12** | `seg-v2` 凍結為 `sg_window=11, peak_sigma_k=0.75, peak_floor_deg_s=60.0`(候選 A,使用者拍板 2026-08-07),而非 merged 比例更低的候選 B(`floor=100.0`) | 候選 A 的 success rate(98.3%)與 seg-v1 持平,候選 B 降至 93.3%(少偵測到幾個 flick)。使用者看過 seg-v1 vs 候選 A 的疊圖覆核後確認:segment 起訖邊界逐位不變,只有 `merged_adjacent_peaks` 內部分類改善,故優先選擇不犧牲 success rate 的候選 | [analysis-segments.md](../../operational/analysis-segments.md) Frozen parameter registry · progress.md §2f |
| **A-D13** | TD-3(`omega[0]=nan` 契約)拍板**不改**,兩個 omega source 繼續共用同一契約 | `ticks[0].dYaw` 雖為真實值(`0.0`,非缺失),但 `run_pipeline.py` 等下游已多處假設「index 0 恆 nan、統一位移」;改動需讓這些呼叫點依 source 分支,換取的只是每個視窗 1 個 tick(~7.8ms)的資料,不划算 | [analysis-segments.md](../../operational/analysis-segments.md) `omega[0]` 段落 |

---

## 5. Surprises(實作中發現、與計畫不符者)

| # | 發現 | 影響 | 處置 |
|---|---|---|---|
| **T0-S1** | 純 `uv run pytest`(無參數)在本機因 `C:\Users\Hsin.YH.Yang\AppData\Local\Temp\pytest-of-Hsin.YH.Yang` 目錄權限被拒(`PermissionError: [WinError 5]`,連 `Get-Acl` 都無權限讀取,疑為前次異常中斷或端點防護鎖定)而在 setup 階段炸出 56 個 ERROR,與程式碼無關(git status 全程乾淨)。以 `uv run pytest --basetemp=<專案內臨時目錄>` 繞過後得到 **183 passed, exit 0**,與 KI-004/S1 基線逐位相同,證實純環境問題。**未修改**該系統目錄(權限層級超出本次授權範圍),僅記錄繞過法供後續 task 需要重跑 pytest 時參考;若該目錄權限問題自行恢復,原生 `uv run pytest` 應可直接綠燈。 | 不阻塞 T0(已用 workaround 取得可信基線數字);後續 task 跑 pytest 若遇同錳訊息,套用同一 `--basetemp` 繞過即可,不代表迴歸 | 記錄,不修復系統目錄 |
| **T0-S2** | KI-005 §3.3 的幀數比對只寫「唯一自由參數 = frame log 起始錨點」,未留存原始診斷腳本、未寫明「高速平順 tick」篩選口徑與正規化分母。本次 T0 以推定口徑重現(見 §2a)得到方向一致但量值有落差的結果(`corr` 0.618–0.626 vs 文件 0.805;n=239/258 vs 307)。凹口總數(27/34)本身**精確重現**,不受此影響。 | A2-T2 若要逐位重跑幀數比對(而非僅重跑凹口計數),需先確認是否有原始診斷腳本可重建,否則本推定口徑即為權威 | 記錄為已知落差,不在 T0 範圍內解決(T0 僅需可重現的 RED 證據,凹口計數已達標) |
| **T0-S3** | T0 執行期間,`git status` 出現與本計畫無關的異動:`docs/known_issue/KI-006-m14-sample-no-counterstrafe.md`(改動)+ 新資料夾 `docs/known_issue/KI-006-C/`(8 個未追蹤檔案)。T0 開始前已確認 `git status` 乾淨(README/T0 step 1 前提成立時拍照),此為**執行期間由外部併發產生**(非本 session 建立),判斷為另一支平行進行的 KI-006 相關工作。**本次 T0 commit 僅 stage `docs/known_issue/KI-005-A/` 下的檔案,不動、不 stage KI-006-C 的任何內容**。 | 不影響 T0 本身的 DoD(§範圍界定清楚);提醒後續 task 開工前重新確認 `git status` | 保留不動,只精準 stage 本次切片檔案 |
| **T4-S1** | `src/testharness/fpsTestHarness.ts`(供 `full-drill.spec.ts`/`br-tracking.spec.ts`/`spray-drill.spec.ts` 用)自建一條與 `main.ts` live 單例**完全獨立**的 sim 管線(自己的 `createDataRecorder`/`collectMeta`/`buildExportPayload`,不驅動 rAF、不共用 `recorder`)。一開始以 `harness.feedInput([{type:'mouse',...}])` + `forceExportJSON()` 驗證 FR-A-7 的 e2e 案因此得到 `meta.mouseIntegration === undefined`——不是迴歸,是驗證了**錯的管線**。 | 若照原計畫在 `full-drill.spec.ts` 驗 FR-A-7,需一併佈線 harness(擴大 README §1.4 In-scope 之外的檔案) | 改走 `main.ts` 既有 `__aimDebug` dev-only 縫,多暴露 `recorder` 一個唯讀欄位;於 `input-sampler.spec.ts`(已在 In-scope 的 e2e 觀測管道)新增案直讀 `__aimDebug.recorder.mouseIntegration`,精準驗證「app 佈線層」而不動 harness(見 [Decision Log A-D6](#4-decision-log)) |
| **A2-S1** | 記錄 A-D10(OQ-A-2 決議「開」)的過程中發現:單純把 OQ 標成「已決」不會讓決議生效——`main.ts:355` 當時仍硬編碼未傳 `recordKeyEvents`,若不補這行,A2-T1 採到的匯出還是不會有 `key` 事件,決策與程式碼會**悄悄脫節**(TD-5 差點從「刻意妥協」漂移成「忘記接線」)。 | 決策記錄與程式碼落地必須同一批查核,不能假設「拍板 = 生效」 | 立即補 A-D11(`main.ts` 一行改動 + `input-sampler.spec.ts` 新增驗證案),不留一個「已決但未接線」的空窗期 |
| **A2-S2** | A2-T2 check①(凹口偵測器)對三份新匯出跑出 3/2/2 個殘餘凹口,**非**原始預期的 literal 0。逐一核對間距與 `vx` 窗口後判讀為真實滑鼠輸入的偶發微變異(非週期性、不與鍵盤反轉重合),而非 render/sim beat 假象復發 | A2-blocked-plan.md 的 pre-register 期望寫死「回傳 0」,面對真實(非合成)資料的雜訊時失準——合成資料可以絕對乾淨,真實人類操作不行 | 如實記錄非 0 的結果與判讀依據(§2e),不事後把門檻悄悄改成「趨近 0」;若後續要凍結一個明確的殘餘容忍度,應另開 OQ 並在下次新採樣**前**寫下 |
| **A2-S3** | A2-T2 check③ 的「未 flag 樣本數上升」與 KI-004/S1 的 `resolve_eye_origin(strict=True)` 混在一起:09:39(舊匯出,缺 `meta.scene.eye`)全數樣本因 `missing_target` 被排除,與 09:39 比較會把 KI-004/S1 的效果也算進 A1 的功勞 | 選兩個獨立 KI 都涉及的舊匯出當基準,天生無法只隔離其中一個修法的貢獻 | 誠實標記為混淆,不宣稱③單獨證明 A1;判讀改依賴①②④(尤其④,不受此混淆影響) |
| ~~A2-S4~~ | ~~check②的 09:39 今日重跑比例(95.2%)高於 KI-005 原文件記載的基準(78.9%),同一份輸入檔案理論上應逐位相同~~ | ~~原始診斷腳本與快照皆未留存,無法逆向核對~~ | **✅ 已於 A2-T3 解開(2026-08-07)**:誤認基準取自 09:39,實為 **08:03**——08:03 今日重跑逐位精確重現原文件的 `successRate=0.95`、`merged_adjacent_peaks=15/19≈79%`。非資料/程式碼問題,是本次記錄時認錯了對照的匯出檔案 |
| **A2-S5** | A2-T4 核對 [KI-006-C/README.md §6](../KI-006-C/README.md) B-1(「採集前明確要求受試者執行完整 counter-strafe」)時,發現 progress.md 對 A2-T1 的既有記錄只有**事後結果**(counter>0、`vx` 非恆零,滿足 B-2/B-3),找不到「事前指示」本身的書面記錄 | B-1 字面要求的是採集前的動作,不是事後可推導的結果;若不追問就直接判定滿足,等於用結果反推流程被走過,而非有紀錄佐證 | 提報使用者確認;使用者(即採集者本人)確認採集前確實口頭要求過。以採集者本人的第一手陳述作為 B-1 證據來源,記錄於此,供未來稽核時知悉此確認是事後補述而非採集當時的書面記錄 |

---

## 6. Open Questions(執行中新增 / 關閉)

| # | 問題 | 狀態 | Owner |
|---|---|---|---|
| ~~OQ-A-1~~ | app 啟用範圍 | ✅ 2026-08-06 關閉:**全域開** | 使用者 |
| ~~OQ-A-2~~ | 是否一併開 `recordKeyEvents` | ✅ 2026-08-06 關閉(本次否)→ **2026-08-07 A2-T1 前再拍板:開**(A-D10)。落地見 TD-5 | 使用者 → 研究者 |
| OQ-A-3 | dPitch 夾角情形是否需 quality flag | 🟡 建議先不加 | 研究者 |
| OQ-A-4 | `beat_period_ticks` 進 `meta.display.gate`(= OQ-KI5-5) | 🟡 未決,不阻塞 A1 | 使用者 |
| ~~OQ-A-5~~ | 新採樣時機與規模(= OQ-KI5-6) | ✅ 2026-08-07 關閉:合併 KI-006 選項 B 同一次採集(A-D10) → [A2-T1](A2-blocked-plan.md) | 研究者 |
| OQ-A-6 | 守恆閘在 ADS 樣本上的容差 | 🟡 A1 只宣告 hip-only exact | 實作者 → 研究者 |
