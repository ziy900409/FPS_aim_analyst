# KI-004 / S1 — Progress log

> running log:每個 task 完成時與切片一起 stage。tech spec:[README.md](README.md) · 索引:[task-checklist.md](task-checklist.md)
> 最新在下(時序閱讀)。決策若跨計畫或偏離協議 → 同步寫 [BD-004](../BUGFIX-DECISIONS.md)。

---

## 1. Progress

| 日期 | Task | 結果 | 證據 / 備註 |
|---|---|---|---|
| 2026-08-05 | 計畫 | ✅ S1 tech spec + T0–T6 + T-exit 產出 | 本資料夾;上游 [KI-004 §5.1](../KI-004-sim-world-unit-domain-mismatch.md) / [BD-004](../BUGFIX-DECISIONS.md) K-1/K-2/K-3 |
| 2026-08-05 | 計畫修訂 | ✅ **OQ-S1-1 + OQ-S1-2 拍板前拉** → 新增 T2(匯出自我描述),T2–T5 順延編號 | 使用者裁示;R-2 / R-6 / FM-5 消除,TD-1 縮為「逐 tick eye pose」 |
| 2026-08-06 | T0 | ✅ 基線量測 + 受影響面盤點完成(§2/§3 已填) | 三條基線指令 exit 0;閘 ① 偏差重現於 scratchpad(未進 repo);見 §5 S-S1.2/S-S1.3 |
| 2026-08-06 | T1 | ✅ `SIM_TO_WORLD` 升引擎級常數 + `resolveEyeWorldBase` 單一來源 | `src/loop/constants.ts` 新增 `SIM_TO_WORLD`;`src/main.ts` import 取代 module 字面值;新檔 `src/scene/eyePose.ts`(`EyeWorldBase` / `CAMERA_STANDOFF` / `resolveEyeWorldBase` / `DEFAULT_PROCEDURAL_ROOM`);`SceneManager` 建構子改為消費該純函式,不再自行算 standoff/eyeZ。新測試 `src/scene/eyePose.test.ts`:四個已註冊場景(`placeholder-room`/`field-low`/`urban-high`/`br-field`)逐位斷言 + `SceneManager.camera.position` 與函式輸出綁定。`npx tsc --noEmit` exit 0;`npm run test:ci` vitest **659/659**(基線 651 + 新增 8 案)全綠、零既有期望值變動;Playwright edge 19/19 見 S-S1.4(單獨/全量重跑皆綠,唯 14-worker 並發下偶發 2 案逐次不同的 timeout,判定為環境並發爭用而非本次改動所致)。`git diff --stat` 僅 `constants.ts`/`main.ts`/`SceneManager.ts` 三檔,未觸及 `src/sim/`、`SharedState`、`SimLoop` |
| 2026-08-06 | T2 | ✅ `meta.simToWorld` + `meta.scene.eye` + `meta.validity` 三個 additive 區塊落地 | `src/data/metadata.ts`:`Meta`/`CollectMetaArgs` 新增三欄位;`collectMeta` 以 `requirePositiveFiniteNumber` 驗證 `simToWorld`(預設 `SIM_TO_WORLD`)、新增 `requireEyeWorldBase`(允許 0/負值)、新增 `requireValidity`。`src/main.ts`:import `resolveEyeWorldBase`,`scene.eye` 由 `resolveEyeWorldBase(activeSceneConfig)` 純函式產出(**未**讀 `sceneManager.camera.position`,`git diff` 複查通過);新增 `validity: { corridorExceeded, perfFloor, recorderOverflow, bufferOverflow }`,`suspect` 運算式**逐字未動**。`src/data/export.ts`:`buildExportPayload` 在 `meta.validity` 存在時同步把 `validity.recorderOverflow` OR 上 `snapshot.recorderOverflow`,`suspect` 組裝路徑不變。新測試:`metadata.test.ts` +8 案(scene.eye 允許 0/拒絕非 finite、simToWorld 預設值/拒絕非正數、validity 接受/拒絕、**suspect 前後逐位不變釘死案**)、`export.test.ts` +2 案(validity.recorderOverflow 同步、validity 缺席時 suspect 不變)。`docs/operational/schema.md` 補三個新欄位段落(含 `meta.validity` 新小節,明記與 `suspect` 非同一集合)。`research/fixtures/exports/synthetic_counterstrafe.json` 補 `simToWorld: 0.01` + `scene.eye`(**實測** `resolveEyeWorldBase(placeholderRoom) = {x:0,y:1.6,z:4}`,見 S-S1.5 —— 修正 T0 筆記的算術誤差)。**範圍外追加**:`research/src/modules/ingest/algorithms/synthetic.py` 的 `make_synthetic_export` 同步補上相同兩欄,理由見 Decision Log S1-D10(否則既有 `test_committed_synthetic_fixture_matches_generator` 會紅)。回歸:`tsc --noEmit` exit 0;vitest **84 files / 668 tests** 全綠(較 T1 基線 83/659 增加本 task 新案);`uv run pytest`(`--basetemp=C:\pytest-tmp`)**168 passed**;Playwright edge 19 案首輪 1 案 timeout(`input-sampler.spec.ts:103`),隔離重跑 3/3 綠 —— 同 S-S1.4 模式的環境並發 flake,非本次改動所致。`git diff --stat` 僅 8 個檔案,未觸及 `src/sim/`、`SharedState`、`SimLoop` |
| 2026-08-06 | T3 | ✅ corridor gate 改 world 域比較 + 依 K-3 脫離 `meta.suspect` | 新檔 `src/scene/corridor.ts`(具名純函式 `isOutsideCorridor(playerX, halfWidthU, simToWorld)`)+ `src/scene/corridor.test.ts`(3 案:舊 100× 過緊門檻不再誤觸發、`halfWidthU/SIM_TO_WORLD`=100 source unit 邊界翻轉、正負對稱)。`src/main.ts`:`afterTick` 改呼叫 `isOutsideCorridor`;`suspect` 組裝移除 `sharedState.validity.playerCorridorExceeded \|\|` 該行,註解改寫說明 K-3 理由。`git diff --stat` 僅 `src/main.ts`(10 行)+ 兩個新檔,未觸及 `src/sim/`、`SharedState`、`SimLoop.step`。`docs/operational/schema.md` 的 `meta.validity.corridorExceeded` 段落更新:記錄 world-domain 換算來源、T3 前後的 `suspect` OR 集合差異、pre-T3 匯出的 corridorExceeded 不可比。回歸:`tsc --noEmit` exit 0;`npm run test:ci` vitest **84 files / 671 tests** 全綠(較 T2 基線 84/668 增加本 task 3 案);Playwright edge 19 案首輪 2 案 timeout(`backend.spec.ts`、`input-sampler.spec.ts:103`),隔離重跑 4/4 綠 —— 與 S-S1.4 同一環境並發 flake 模式,非本次改動所致。見 Decision Log S1-D11(OQ-S1-4 不拆欄)、S1-D12(main.ts 無單元測試骨架的驗證取捨) |
| 2026-08-06 | T4 | 🟡 TS 側修法已落地、閘 ①/② 已綠;**尚未 commit**(README §4 偏離慣例:T4+T5 合併,待 T5 重產 parity fixture 後一起 commit) | 新檔 `src/metrics/eyeOrigin.ts`(`resolveEyeOrigin`/`eyeOriginForTick`/`aimForward`/`angularEccentricityDeg`,ε(t)/on-target 幾何的唯一 TS 實作)+ `eyeOrigin.test.ts`(17 案:三分支優先序、半 meta miss ×2、strict 拋錯 ×2、fallback 仍套用 simToWorld、eyeOriginForTick/angularEccentricityDeg 幾何案)。`trackingDerivation.ts`/`detectionDerivation.ts` 改吃 `ResolvedEyeOrigin`,刪除兩檔各自重複的 `angularEccentricityDeg`/`aimForward`(KI-004 §2.3.1 的複製已消除)。新增閘 ① `tests/golden/research/epsilon-offsetdeg-oracle.test.ts`(對 08:03/09:39 兩份真實 fixture,以顯式 `eyeBase = resolveEyeWorldBase(fieldLow)` 呼叫,argmin\|Δt\| 選 tick,篩 `aimPunchPitch/Yaw==0` 的合格 fire——兩份 fixture 各僅 N=1 合格樣本)+ 閘 ② `epsilon-closed-form-geometry.test.ts`(3 案:eyeBase.z≠0∧px≠0、+pz≠0、eyeBase.z=0 退化案,對閉式解常數 ≤1e-9 相對誤差)。`fpsTestHarness.ts` 補 `scene.eye: resolveEyeWorldBase(sceneConfig)`(鏡射 main.ts,使 harness 匯出的 `'meta'` 分支在 e2e 實際受測);修正 `aimAtActiveTargetFromPlayerOrigin` 同一類 bug(見 S-S1.7)。回歸:`tsc --noEmit` exit 0;`npm run test:ci` **87/88 檔綠、693/694 案綠**,唯一紅 = `epsilon-parity.test.ts`(README §4 明文預期,等 T5 重產 fixture 才轉綠,非本次迴歸);Playwright edge **19/19 全綠**(含 `br-tracking.spec.ts` 2 案、`full-drill.spec.ts` 的 field-low tracking_scene_v1 案)。決定性/`src/sim/`/`SharedState` 零 diff。OQ-S1-3 定案:採 `argmin\|Δt\|`(見 Decision Log S1-D15)|
| 2026-08-06 | T5 | ✅ Python `angular.py` 同步 + 閘 ② Python 版 + parity fixture 重產,**與 T4 合併為單一 commit**(README §4 偏離慣例) | `angular.py` 新增 `EyeOrigin`(frozen dataclass:`base`/`sim_to_world`/`source`)+ `resolve_eye_origin(meta, *, eye_base=None, sim_to_world=None, eye_height=None, strict=False)`,與 TS `resolveEyeOrigin` 逐條同構(explicit → meta → legacy-default;`'meta'` 成立條件 = `meta.simToWorld` 正有限 **且** `meta.scene.eye` 三分量皆有限,只拿到一半視為 miss;fallback 仍套用 `sim_to_world`;`strict=True` 落到 legacy-default 即拋 `ValueError`)。`SIM_TO_WORLD = 0.01` module 常數落為**僅 fallback 用**(C-D1 禁 import TS,TD-3)。`epsilon_deg`/`on_target` 的 `eye_height: float = 1.6` 改為 **keyword-only** `eye_origin: EyeOrigin`,**未留位置參數相容**(S1-D4);`_geometry` 改用 `eye_origin.base + (px,0,pz) × eye_origin.sim_to_world`。三處呼叫端全部更新:`run_pipeline.py::_epsilon_or_none`(`resolve_eye_origin(meta, strict=True)`,解析失敗仍回 `None`,見 Decision Log S1-D16)、`notebooks/t2/generate_epsilon_parity.py::build_parity_payload`(移除 `eye_height` 參數,改 `resolve_eye_origin(export.meta, strict=True)`,新增 `_eye_origin_to_json` 序列化,`options` 補 `eyeOrigin` 區塊)、`algorithms/tests/test_angular.py` 全面改新簽名。新增 Python 閘 ②(`test_gate_two_*` 3 案:eyeBase.z≠0∧pz=0、+pz≠0、eyeBase.z=0 退化案),與 T4 的 TS 版**逐位相同數字**(px=169.25、eyeBase=(0,1.6,4)、target=(2,1.5,-4)),對閉式解常數 ≤1e-9 相對誤差,不與 TS 對表(FM-3)。新增 `resolve_eye_origin` 專用測試 12 案,鏡射 TS `eyeOrigin.test.ts` 的分支覆蓋(explicit 優先、simToWorld 預設、meta 成立/半 meta miss ×2、legacy-default、eyeHeight 別名、strict 拋錯/不拋錯 ×2)。重產 `research/fixtures/parity/epsilon-synthetic_counterstrafe.json`:`options` 新增 `eyeOrigin: {base:{x:0,y:1.6,z:4}, simToWorld:0.01, source:'meta'}`(G-7 驗證:generator 對合成 fixture 的 T2 補欄解析出 `'meta'`,非 `'legacy-default'`);`presentations[1]` 的 `tAcquireMs` 54.6875→**39.0625**、`rmsEpsilonDeg` 1.4659→**0.4322**、`medianEpsilonDeg` 1.7031→**0.1172**、`p95EpsilonDeg` 1.7031→**0.6716**(`acquisitionFailure` 模式 `[true,false]`、`totPercent` 100.0 不變)——歸因:eyeBase.z=4 修正後,首個 on-target tick 本身前移(D2a 同時影響 on-target 判定與 ε(t) 幾何,非僅量值縮放)。連動更新 `test_parity_fixture.py::test_parity_fixture_covers_failure_and_acquisition_paths` 的硬編碼期望值(54.6875→39.0625,書面歸因見該檔內註解,FM-2)。回歸:`uv run pytest --basetemp=C:\pytest-tmp` **183 passed**(較 T0 基線 168 增加本 task 15 案:12 個 `resolve_eye_origin` + 3 個閘 ②);`npx tsc --noEmit` exit 0;`npm run test:ci` **88/88 檔、694/694 案全綠**(`epsilon-parity.test.ts` 轉綠,如 T4 筆記所預期);Playwright edge **19/19 全綠**。C-D1 複驗:`test_purity.py::test_research_python_has_no_typescript_dependencies` 通過(新增 docstring 措辭刻意避開 `.ts` 子字串,見 Decision Log S1-D17) |
| 2026-08-06 | T6 | ✅ 帳本 / 里程碑對帳 + M14 ② 重新宣告完成 | KI-004 頂部狀態/§3/§5.1/§7 OQ/§8 修改紀錄一致;[BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) §1 索引 + BD-004「S1 落地」段;[WP-28 progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md)「M14 ② 重新宣告」段(含閘 ①/② 新證據);exec-plan/README.md(頂層狀態列 + M14 里程碑行 + WP-28 行 + 相依圖註記)、stage4/README.md(頂層狀態 + WP-28 行 + M14 里程碑行 + 相依圖註記)、MAP.md(§3 導覽 + §5 KI-004 索引)三處對帳;WP-28 自身的 [T-exit-gate.md](../../exec-plan/active/stage4/wp-28-research-foundation/T-exit-gate.md)/README.md/task-checklist.md 亦同步更新(見 Decision Log S1-D18);`grep -n "M14" docs/` 複查無殘留「六項全綠 / ② 綠(未重新宣告)」字樣;`grep -rn "entry blocker" docs/` 複查敘述一致(KI-004 這條理由已解除,KI-005/KI-006 兩條仍維持,WP-30/31 entry blocker 整體未解除)。本 task 零程式碼改動,`git diff --stat` 僅 `docs/` |
| | T-exit | ⬜ | |

---

## 2. 基線(T0 回填)

| 項目 | 基線值(KI-004 §1.2) | 實測(2026-08-06) |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | ✅ exit 0 |
| `npm run test:ci` | 82 files / 641 tests + 19 e2e | ✅ **83 files / 651 tests**(vitest)+ **19/19**(playwright)全綠;檔數/案數比計畫文件略多(既有開發持續累積測試,非本次改動),已記錄為對照基準 |
| `uv run pytest` | 74 passed | ✅ **168 passed**(見 S-S1.3 環境註記) |
| 08:03 `\|ε_現行 − offsetDeg\|` | median 12.52° / max 12.73° | 見 S-S1.2(N=20 全 firstShot fire):median 12.26° / **max 12.73°**(與基線 max 完全吻合) |
| 08:03 `\|ε_正確 − offsetDeg\|` | median 0.21° | median 0.04° / max 0.23°(同組) |
| 09:39 `\|ε_現行 − offsetDeg\|` | median 67.11° / max 88.55° | median 68.10° / max 93.53°(同組) |
| 09:39 `\|ε_正確 − offsetDeg\|` | median 0.14° | median 0.03° / max 0.23°(同組) |

> 基線值取自 [KI-004 §1.2](../KI-004-sim-world-unit-domain-mismatch.md)。獨立重現詳見 S-S1.2 —— **量級與方向完全吻合**(現行公式偏差 8~93°,正確公式收斂至 <0.25°),08:03 的 max 更是逐位吻合;median 的小數點差異歸因於 tick 選取口徑尚未拍板(OQ-S1-3),不影響「bug 存在且修法有效」的診斷結論,不視為 stop 條件。

### 2a. T4 閘 ①紅→綠證據(修法前於工作區實測,DoD 要求)

> 與 S-S1.2 的差異:S-S1.2 用「全部 20 筆 firstShot fire」(未套用 `aimPunchPitch/Yaw==0` 篩選)粗量級核對;
> 下表是**實際閘 ①**的篩選口徑(`offsetDeg !== undefined && aimPunchPitch==0 && aimPunchYaw==0`),
> 兩份真實 fixture 各僅剩 **N=1** 合格 fire(即各自的第一發 firstShot,recoilIndex=0)。
> tick 選取口徑:`argmin_t |tick.t − fire.t|`(OQ-S1-3 定案,見 S1-D15)。

| fixture | N(合格 fire) | 修法前 \|ε_現行 − offsetDeg\| | 修法後 \|ε_正確 − offsetDeg\|(= 閘 ① 實測) |
|---|---|---|---|
| 08:03 | 1 | **8.19°**(> 0.5° 容差,紅) | **0.000°**(≤ 0.5°,綠) |
| 09:39 | 1 | **88.53°**(> 0.5° 容差,紅) | **0.030°**(≤ 0.5°,綠) |

修法前用「現行公式」= `dx = target.x − tick.px`(未套 `eyeBase`、未套 `SIM_TO_WORLD`,即
`trackingDerivation.ts` 修法前的字面實作);修法後 = `angularEccentricityDeg` 經
`eyeOrigin.ts` 以 `eyeBase = resolveEyeWorldBase(fieldLow) = {x:0,y:1.6,z:4}`、
`simToWorld = 0.01` 計算。腳本存於 scratchpad(未進 repo,同 S-S1.2 慣例),持久化版本 =
`tests/golden/research/epsilon-offsetdeg-oracle.test.ts`(此檔即修法後的綠測試,執行時仍會
console.log 出 median/max 供覆核)。

---

## 3. 受影響測試清單(T0 回填,FM-2 歸因表)

| 測試 | 預期 | 現值 → 新值 | 歸因(D2a / D2b / 兩者 / 不變) |
|---|---|---|---|
| `src/metrics/trackingDerivation.test.ts`(9 案) | **不變** | 全部合成 fixture 的 `px=0, pz=0`,且 aim origin 手動建構為 `(0, EYE_HEIGHT, 0)`(檔內常數,z 分量 = 0);修法後 `legacy-default` 的 base 仍是 `(0, eyeHeight, 0)` z=0 —— 逐位相同 | 不變(fixture 未觸及 D2a/D2b 任一分支) |
| `src/metrics/detectionDerivation.test.ts`(8 案) | **不變** | 同上:所有 tick `px=0, pz=0`,`TARGET.z=-4` 未搭配非零 base | 不變 |
| `tests/golden/research/epsilon-parity.test.ts`(1 案) | **必變**(T5 重產) | `synthetic_counterstrafe.json` 的 `meta.scene.sceneId = 'placeholder-room'`(`eyeZ` 省略 → base.z = depth/2−standoff = 3/2−1 = **0.5**,非 0)且 `px` 範圍 [-7.8, 5.9](非 0);parity fixture 的 `options` 目前只有 `{eyeHeight:1.6, hitbox}`,未含 z offset 與 SIM_TO_WORLD 縮放 → T4 落地後此測試必紅,T5 重產 fixture 後轉綠(README §4 已定為 T4+T5 合併 commit) | **D2a + D2b 兩者皆命中**(base.z≠0 且 px≠0) |
| `tests/e2e/br-tracking.spec.ts`(2 案,經 `trackingMetricsFromExport` 呼叫 `deriveTrackingMetrics(payload)` 不傳 options,[fpsTestHarness.ts:544](../../../src/testharness/fpsTestHarness.ts#L544)) | **需重新確認**(非必然變動) | br-field 場景 `eyeZ:0`([br-field.ts:26](../../../src/scene/scenes/br-field.ts#L26))→ base.z 修法前後皆為 0,**D2a 不觸發**;但 br 協定含真實 A/D 橫移,px≠0 → **D2b 觸發**(現行公式缺 ×0.01)。斷言皆為門檻式(`tAcquireMs<=16`、`totPercent>=99`、`rmsEpsilonDeg<0.1`)而非精確值比對,且 mode 為 `'autoAim'`(sim 內部以正確 world 幾何驅動 aim,非離線推導自身），故**可能仍綠**,但數值分佈會改變,必須在 T4 落地後實跑確認,不得預先假設不變 | D2b(px 縮放) |
| `research/.../algorithms/tests/test_angular.py`(9 案) | **必變**(簽名破壞性變更) | 現行呼叫全部用位置參數形式 `epsilon_deg(ticks, meta)` / `epsilon_deg(ticks, {}, fallback_target=...)`,依賴預設 `eye_height=1.6`;T5 把第三位置參數改為 keyword-only `eye_origin`(README §2.4),呼叫端必須顯式改寫。數值上:現有 fixture 的 ticks 多為 `px=0`(見 `_ticks()` helper),故**數值本身多數不變**,但**呼叫簽名 100% 需改**,不改會直接 TypeError | 簽名變動(非 D2a/D2b 數值,是 API 破壞性變更) |
| `research/.../algorithms/tests/test_parity_fixture.py`(2 案)·`test_purity.py`(2 案) | `test_parity_fixture.py` 隨 T5 重產的 parity fixture **必變**;`test_purity.py` 為靜態 import 檢查,**不變** | | `test_parity_fixture.py` 同 epsilon-parity.test.ts 的歸因;`test_purity.py` 不變 |
| `src/data/metadata.test.ts`(24 案)· `src/data/export.test.ts`(9 案) | 增案(T2 新欄位驗證);既有案的 `suspect` 期望值**必須不變** | 目前無案測試 `simToWorld`/`scene.eye`/`validity`(T2 前尚未存在此欄位),故現有 24+9 案應逐位綠;T2 新增獨立案覆蓋三個新區塊 | 不變(既有案)+ 新增(新案) |
| 比對整個 `meta` 物件的 golden/決定性 fixture | 已盤點:**repo 內無**任何 `.test.ts` 以 `toEqual`/`toStrictEqual`/`toMatchSnapshot` 對整個 `meta` 物件斷言(全域搜尋 0 命中) | — | R-2b 風險降為低:新增 optional 欄位不會使既有測試因「物件形狀」而 diff |
| `meta.suspect` 完整 OR 集合(NFR-S1-2b 比對基準,見下) | T3 後**唯一**變化 = 移除 corridor 項 | 現行 4 項 OR → T3 後 3 項 OR | 見下方 OR 集合抄錄 |
| 決定性回歸(`src/loop/__tests__/` 8 檔、`tests/regression/` 8 檔) | **必須不變** | 本次 T0 僅量測,未改 `src/`,已全綠(83 files/651 tests 含此範圍) | 變動 = 違反 NFR-S1-1,立即停 |

**`meta.suspect` 現行 OR 集合**(逐條抄錄自 [main.ts:379-382](../../../src/main.ts#L379-L382) + [export.ts:21-26](../../../src/data/export.ts#L21-L26),作為 T3 之後「只減不加」的比對基準):

```
suspect =
  sharedState.validity.playerCorridorExceeded                                    // ← T3 移除(K-3)
  || (protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect)  // session/protocol suspect
  || frames.summary.p95 > PERF_FLOOR_MS                                          // perfFloor
  || recorderOverflow   // = meta.recorderOverflow || snapshot.recorderOverflow（export.ts:21,26）
```

確認：**`bufferOverflow` 不在此 OR 集合內**(`sharedState.inputMeta.bufferOverflow` 僅落 `meta.bufferOverflow` 欄位本身,[main.ts:375](../../../src/main.ts#L375),從未併入 `suspect` 運算)。T2 新增 `meta.validity.bufferOverflow` 時必須維持這個「不進 suspect」的現狀(NFR-S1-2b)。

---

## 4. Decision Log

| # | 決策 | 理由 | 落點 |
|---|---|---|---|
| **S1-D1** | 計畫落 `docs/known_issue/KI-004-S1/` 資料夾(而非單檔或 exec-plan WP) | 守 CLAUDE.md §9「bugfix 走 known_issue」,同時沿用 exec-plan 的「一 task 一檔、單 task context < 40%」紀律;S1 橫跨 `src/metrics` + `main.ts` + Python + fixtures + 兩道新閘,單檔會過長 | 2026-08-05 使用者拍板 |
| **S1-D2** | T4 + T5 **合併為單一 commit** | TS 修法後 `epsilon-parity.test.ts` 必紅(Python fixture 未重產),與 repo 硬規「每個 commit 綠」衝突;比照 BD-001 的 TDD 偏離慣例 | 落地時同步記 BD-004「偏離計畫」 |
| **S1-D3** | `legacy-default` fallback **仍套用 `SIM_TO_WORLD`**,只有 `base.z` 退回 0 | D2b 的因子是全域引擎常數、可知;D2a 的 `base.z` 才是 pre-S1 匯出無法還原的部分。fallback 不得原樣保留舊的錯誤行為 | [README §2.3](README.md) |
| **S1-D4** | 研究側入口(parity generator / `run_pipeline`)一律 `strict`,Python 端**不留位置參數相容** | 留著相容入口 = 留著「靜默用錯原點」的路徑,正是 D2a 的成因 | [README §2.4](README.md) · T4 |
| **S1-D5** | 閘 ② 兩側各自對**閉式解**斷言,而非互相對表 | parity 是一致性閘,無法發現兩側一起錯(BD-004 架構層結論) | T4 · T5 |
| **S1-D6** | **前拉** KI-004 §5.1 的 S2 ②③ 與 ① 的**靜態部分**進 S1(新增 T2) | 使用者拍板。D2a 的結構性根因是「匯出在數學上無法還原原點」(KI-004 §2.3)—— 只修 derivation 是把「猜」從錯的改成對的,只有讓匯出自我描述才能讓「猜」本身消失。三個純量 + 一個布林區塊,additive、不 bump `schemaVersion`。corridor 的匯出落點同時解決,`suspect` 拆除不再遺失資訊 | 2026-08-05;[README §2.3a](README.md) · T2 |
| **S1-D7** | eye base 記**靜態**(`meta.scene.eye`),**逐 tick** eye pose 留 S2 | 場景在單一 drill 內固定 ⇒ 靜態 base + `px/pz` + `simToWorld` 已足以逐 tick 還原;逐 tick 版是 GD-7 raw-over-derived 的完整形式,對還原能力零增益。**前提**:若日後允許 drill 內切換場景,靜態欄位立即失效 | TD-1 |
| **S1-D8** | `suspect` 在 S1 **只減不加**;`bufferOverflow` 進 `validity` 但**不**進 `suspect` | K-3 只授權移除 corridor。把 `bufferOverflow` 順手併入會改變舊資料的判讀口徑,屬未經授權的語意擴大 | NFR-S1-2b · T2 · T3 |
| **S1-D9** | 兩份真實 fixture(08:03 / 09:39)**刻意不補新 meta 欄位** | 它們是 pre-S1 匯出的回歸樣本;補欄會讓 `legacy-default` 相容路徑與 strict 拋錯在 CI 完全不受測 | T2 · T4 |
| **S1-D10** | T2 追加 `research/src/modules/ingest/algorithms/synthetic.py`(原不在 T2 README §「In scope」清單內) | 補 `synthetic_counterstrafe.json` 的 `simToWorld`/`scene.eye` 後,`test_synthetic.py::test_committed_synthetic_fixture_matches_generator` 對 fixture 與 `make_synthetic_export()` 做全等比較 —— 只改 fixture 不改 generator 會讓這條**既有綠測試**轉紅,違反 NFR-S1-6(回歸零紅)。兩處新增值逐位相同(`simToWorld: 0.01`、`eye: {x:0,y:1.6,z:4}`),純鏡射,不影響 T5 的 Python `angular.py` 簽名變更範圍 | T2;`uv run pytest` 168 passed 驗證 |
| **S1-D11** | OQ-S1-4:`clearance.halfWidthU` **不拆**兩個欄位 | K-3 下 corridor 已非 gate,拆欄會新增兩個需人工同步的數字(D1-Option B 的既知缺點);`isOutsideCorridor` 直接消費現有 `SceneConfig.playerCorridor.halfWidthU`,零新增欄位 | T3;OQ-S1-4(= OQ-KI4-6)關閉 |
| **S1-D12** | T3 的「suspect 語意」「只減不加」測試**不新增獨立測試案**,改為引用 T2 既有的 `metadata.test.ts` 案(L283 `accepts meta.validity as a runtime observation block distinct from suspect`、L328 `leaves meta.suspect bit-for-bit unchanged`、L609/L623/L644 的 explicit-suspect/perfFloor 案) | `main.ts` 是 bootstrap 腳本,repo 內**無**任何測試 import 它(全域搜尋確認),故「main.ts 的 suspect 組裝」本身不可單元測試;`collectMeta()` 才是可測邊界,而上述既有案已在呼叫端手動建構「不含 corridor 的 explicitSuspect + corridorExceeded:true」等價輸入,逐條覆蓋 T3 DoD 要求的不變式(corridor 不獨立觸發 suspect;session/protocol/perfFloor 各自觸發 suspect)。避免造出與既有案語意重複的第二份斷言 | T3;見 T3-corridor-observation.md DoD |
| **S1-D13** | T3 **不修改** `src/data/metadata.ts` 的 `collectMeta` 內部 `suspect: explicitSuspect \|\| bufferOverflow \|\| recorderOverflow \|\| frameFloorSuspect`(metadata.ts:219),即使它與 T3 task 檔 DoD 字面上的「`bufferOverflow` 不得併入 suspect」矛盾 | 這是 S-S1.6 已發現的**既有行為**(`bufferOverflow` 早在 collectMeta 內部就 OR 進 `suspect`,且有既有綠測試 `metadata.test.ts:5-46` 釘死此行為),與本 task 的 corridor 修法**無因果關係**、也不是 T2/T3 引入的迴歸。T3 的範圍(README §1.4 In/Out of scope)只列 `main.ts` 的 corridor 組裝,未列 `metadata.ts`;若要修正需先讓研究者/使用者拍板改變 `suspect` 既有語意(牽動舊資料判讀口徑),屬 BUGFIX-DECISIONS 層級決策,非本 task 可單方決定 | T3;NFR-S1-2b 的敘述與現狀不符處保留為已知 debt,留待 T6 帳本階段或使用者裁示是否修正措辭 |
| **S1-D14** | 修正 `fpsTestHarness.ts` 的 `aimAtActiveTargetFromPlayerOrigin`(tracking `'autoAim'` 合成瞄準),改用 `resolveEyeWorldBase(sceneConfig) + (player.x, 0, player.z) × SIM_TO_WORLD` 取代原本假設 `eye = (player.x, EYE_HEIGHT, player.z)`(隱性假設 `eyeBase.z = 0`)的公式 | S-S1.7 發現:此函式與修法前的 `angularEccentricityDeg` 犯**同一類**錯(D2a 的變體——假設 eye.z=0),兩者「一起錯」互相抵銷,故 T1–T3 皆未曝光。T4 修正 derivation 後,`field-low`/`urban-high`(`eyeBase.z=4≠0`)的 tracking round-trip 出現真實幾何落差,`acquisitionFailureRate` 由 0→1;`br-field`(`eyeBase.z=0`,顯式拍板)不受影響,因兩公式在 z=0 時退化為相同值 —— 此非本次改動引入的新缺陷,而是舊缺陷首次曝光,修正屬 T4 範圍(`fpsTestHarness.ts` 在 README §1.4 In scope 清單內) | T4;`src/testharness/fpsTestHarness.ts` |
| **S1-D15** | OQ-S1-3 定案:閘 ① 採 `argmin_t \|tick.t − fire.t\|` | 與 KI-004 §1.2 原始診斷口徑一致(S-S1.2 已核對量級/方向吻合);兩份真實 fixture 套用完整閘 ① 篩選條件(`aimPunchPitch/Yaw==0`)後各僅剩 N=1 合格 fire,以此口徑修法前 \|ε−offsetDeg\| = 8.19°(08:03)/ 88.53°(09:39),修法後降至 0.000°/0.030°(見 §2a) | T4;`epsilon-offsetdeg-oracle.test.ts`;OQ-S1-3 關閉 |
| **S1-D16** | `run_pipeline.py::_epsilon_or_none` 在 `resolve_eye_origin(meta, strict=True)` 拋錯時,**沿用既有 `missing_target` quality flag**(不新增 `missing_eye_origin` 等第二個 flag) | T5 README 明文「Out of scope:run_pipeline 的指標語意變更(只改原點,不改分段/欄位)」;新增 flag 需改 `modules/segments/algorithms/apply.py` 的封閉字彙 `QUALITY_FLAG_VOCABULARY`,該檔不在 T5 in-scope 清單。「不得靜默」以既有機制滿足:origin 無法解析時仍回 `None`(從不用猜的原點算出一個看似合理但錯的數字),呼叫端既有的 `missing_target` flag 已使該列在 CSV/summary 中可辨識為「此列 epsilon 缺失」,只是未區分缺失原因是 target 幾何還是 eye origin。兩份真實 fixture(08:03/09:39)目前不經 `run_pipeline.py` 的既有測試覆蓋此路徑(S1-D9 刻意不補欄),故此決策暫無回歸風險 | T5;`run_pipeline.py::_epsilon_or_none`;若未來需要更精確的診斷分類,留待研究者對 `QUALITY_FLAG_VOCABULARY` 拍板後另開 task |
| **S1-D17** | Python docstring 提及 TS 對應模組時,**刻意避免寫出含 `.ts` 子字串的檔名**(改用「TypeScript 的 X 型別 / X 模組」等描述性措辭) | `test_purity.py::test_research_python_has_no_typescript_dependencies` 對**任何** `ast.Constant` 字串常值(包含 docstring)做子字串比對 `.ts`/`.tsx`,不區分「import 路徑」與「純敘述性文字」;寫 `` `src/metrics/eyeOrigin.ts` `` 這類敘述會被該測試判定為「疑似 TS 依賴」而紅,即使實際上只是註解說明、無 import。屬於既有測試對「引用」與「提及」不作區分的已知過度嚴格,不在 T5 範圍內修正該測試本身 | T5;`angular.py`(`EyeOrigin` docstring);`#:` 開頭的一般 comment(非 docstring)不受影響,可自由提及檔名 |
| **S1-D18** | T6 除 tech spec §「In scope」明列的檔案外,**額外**同步更新 WP-28 自身的 [T-exit-gate.md](../../exec-plan/active/stage4/wp-28-research-foundation/T-exit-gate.md)、[README.md](../../exec-plan/active/stage4/wp-28-research-foundation/README.md)、[task-checklist.md](../../exec-plan/active/stage4/wp-28-research-foundation/task-checklist.md) 三份文件的 M14 ② 狀態行 | 這三份是 WP-28 自身對 M14 ② 撤回的**權威記錄**(尤其 `T-exit-gate.md` 是 DoD 六項證據表本身);若只更新 T6 明列清單而不更新這三份,會立即在 WP-28 資料夾內重現「同一事實有多份副本,只有部分被更新」——正是 KI-004 T6 本身要收斂的病徵。三處改動均為單行/單表格單元的狀態更新,不涉及 M14 ①③④⑤⑥ 的既有判定內容 | T6;範圍決策記於此,未另開 BUGFIX-DECISIONS 條目(屬本 S1 內部細節) |
| | *(T0 起逐條追加)* | | |

---

## 5. Surprises(執行中發現、與計畫假設不符的事)

| # | 發現 | 影響 | 處置 |
|---|---|---|---|
| **S-S1.1** | M14 ② 撤回**未傳播到所有文件**:[exec-plan/README.md:125](../../exec-plan/README.md) 仍寫「M14 ✅ 六項全綠 / entry blocker 已解除」、[MAP.md:38](../../MAP.md) 寫「②③⑥ 綠 / ①④⑤ 阻塞」,兩者互相矛盾也與 stage4/README 矛盾 | 讀到不同文件會得到相反的排程結論 | 併入 **T5** 一次收斂;寫法改為「權威在一處、其餘指路」 |
| **S-S1.2** | 用「僅 `aimPunchPitch/Yaw == 0` 的首發」過濾兩份真實 fixture 時,08:03 與 09:39 **各只剩 1 筆合格 fire**(N=1)。改用「全部 20 筆 firstShot fire」重現 KI-004 §1.2 的 median/max,量級與方向完全吻合(現行公式偏差 8~93°,正確公式 <0.25°),08:03 的 max 甚至逐位吻合(12.73° = 12.73°);但 median 有小數點差異(08:03: 12.26° vs 12.52°;09:39: 68.10°/93.53° vs 67.11°/88.55°)。腳本存於 scratchpad(不進 repo),未提交 | 差異來源疑為**tick 選取口徑**未拍板(README §5 OQ-S1-3:`argmin \|Δt\|` vs 「最近的 t ≤ fire.t」)——KI-004 原始診斷用的確切口徑未逐字記錄;差異量級遠小於「bug 存在」本身的訊噪比(~50-500×),不影響診斷結論成立 | 不阻塞 T0;**OQ-S1-3 必須在 T4 實作時定案**,定案後可用同一腳本逐位核對是否收斂到 12.52/67.11 |
| **S-S1.3** | `uv run pytest`(不帶參數)在本機環境對**預設 basetemp**(`%TEMP%\pytest-of-<user>`)拋 `PermissionError: [WinError 5] Access is denied`,10 案於 `research/src/report/tests/test_coach_report.py` 等處失敗;改用短路徑 `--basetemp=C:\pytest-tmp` 後 **168 passed**,零失敗 | 純環境問題(Windows ACL + Claude Code scratchpad 路徑過長觸及 `test_coach_report.py` 內建的 MAX_PATH 規避邏輯),與 KI-004 程式碼無關;若未來 CI/其他機器重現同樣的 basetemp 問題,`uv run pytest` 的「正常」呼叫方式需要外部處理(非本 repo 範疇) | 記錄於此供未來 session 參考;不視為受影響測試,不計入 R-1 |
| **S-S1.4** | T1 落地後 `npx playwright test --project=edge`(19 案,14 workers 並發)首輪出現 2 案 timeout(`backend.spec.ts` 未收到 `[render backend]` console log;`input-sampler.spec.ts` 的 `__aimDebug` 未就位),疑似 T1 動了 `SceneManager`/`main.ts` 造成 bootstrap 迴歸。逐一隔離重跑(`--project=edge` 單檔/單案)兩案皆綠;**不帶** `-uall`git stash 回到 T1 前基線後同一全量指令仍偶發(換了一組不同的 2 案失敗),隔離重跑同樣全綠;再重跑一次全量(T1 後)19/19 全綠 | 環境並發爭用(14 workers 同時起 dev server headless 瀏覽器 + WebGPU context),與本次改動無因果關係——每輪失敗的案子不同、隔離跑必過,且 stash 前基線同樣重現 | 不阻塞 T1;`npx tsc --noEmit` + vitest 659/659 為零 flake 的權威回歸依據,playwright 全量偶發性 flake 記錄於此供未來 session 參考,不計入 R-1 |
| **S-S1.5** | T0/計畫階段的筆記(progress.md §3 受影響測試清單、T2 README §「為什麼這一刀值得前拉」附近)寫「`synthetic_counterstrafe.json` 的 `eyeZ` 省略 → `base.z = depth/2−standoff = 3/2−1 = 0.5`」——這是**算術誤差**:`resolveEyeWorldBase` 用 `room.roomSize[1]` 當 depth,而 `placeholder-room` 的 `roomSize = [10, 10, 3]`(`[width, depth, height]`,見 `SceneManager.ts:33` 的 `const [width, depth, height] = room.roomSize`),故 depth = **10**(非 3,3 是 height),實測 `resolveEyeWorldBase(placeholderRoom) = {x:0, y:1.6, z:4}`(以 `npx tsx` 在repo 內程式化驗證,見本次 commit)| 若未發現,T2 補入 fixture 的 `eye.z` 會是錯的常數(0.5 而非 4),T4/T5 的閘 ①/② 會對到錯的原點;也代表 KI-004 §1.2/§2.3 一路沿用的「3/2-1=0.5」敘述本身有誤,需注意其他文件段落是否引用了同一錯誤值 | T2 已用實測值 `z=4` 補 fixture;若 KI-004 主檔或其他 S1 task 檔仍引用 0.5,需在遇到時一併更正(不在本次改動範圍內,故未主動搜尋改寫) |
| **S-S1.6** | progress.md §3(T0 筆記)聲稱「確認:`bufferOverflow` 不在 `suspect` 的 OR 集合內」,但 `src/data/metadata.ts` 的 `collectMeta`(修改前即存在)第 186 行(舊行號)`suspect: explicitSuspect \|\| bufferOverflow \|\| recorderOverflow \|\| frameFloorSuspect` **已經**把 `bufferOverflow` OR 進 `suspect`,且 `metadata.test.ts` 既有案(`bufferOverflow: 1` → `suspect: true`)驗證了這個行為。T0 筆記引用的「main.ts:379-382」只是傳進 `collectMeta` 的 `explicitSuspect` 引數片段,未涵蓋 `collectMeta` 內部再次 OR 的 `bufferOverflow`/`recorderOverflow` | NFR-S1-2b「`bufferOverflow` 不得併入 `suspect`」的前提敘述與現狀不符;但這是**既有行為**(非本次 T2 引入),T2 本身未改動 `suspect` 運算式(逐位不變測試已釘死),故不影響 T2 DoD。留給 T3(移除 corridor 項)或帳本階段判斷是否需要修正 NFR 敘述或視為既有 debt | 未在本次修改;記錄供 T3/T6 決策時參考,必要時應更新 BD-004 或 KI-004 §5.1 的既有敘述 |
| **S-S1.7** | T4 wiring 完成後,`npm run test:ci` 新增 2 案紅:`fpsTestHarness.test.ts` 的 `tracking_scene_v1`(field-low)與 `urban-high probe` 兩案,`acquisitionFailureRate` 由預期 `0` 變為 `1`。診斷:`fpsTestHarness.ts` 的 `aimAtActiveTargetFromPlayerOrigin`(tracking `'autoAim'` 合成瞄準的來源)本身隱含假設 `eye.z = 0`,與修法前的 `angularEccentricityDeg`(同樣假設 `eye.z=0`,只用 `tick.px/pz` 不套 `eyeBase`)剛好「一起錯」而互相抵銷,故 T1–T3 期間未曝光。修法後 derivation 改用真實 `eyeBase.z`(field-low/urban-high 皆為 4),兩者不再一致,合成瞄準的方向與「正確原點」下的目標中心不再對齊 ⇒ 追蹤全失敗。`br-field`(`eyeZ:0` 顯式拍板)未受影響,因兩公式在 `z=0` 退化為同值——與診斷完全吻合 | 確認為**既有 bug 曝光**而非新迴歸(FM-2 書面歸因)。修正 `aimAtActiveTargetFromPlayerOrigin` 使用與 `eyeOriginForTick` 同一公式(S1-D14)後,兩案回綠;`npm run test:ci` 693/694(僅 `epsilon-parity.test.ts` 如預期紅)、Playwright edge 19/19 全綠(含 `full-drill.spec.ts` 的 field-low tracking_scene_v1 e2e 案) | T4;`src/testharness/fpsTestHarness.ts`;S1-D14 |
| **S-S1.8** | [T6-ledger-m14-reconcile.md](T6-ledger-m14-reconcile.md)(寫於 2026-08-05)與 [README.md §6](README.md) 的「M14 ② 重新宣告完成 ⇒ WP-30/31 entry blocker 解除」假設,在 KI-005/KI-006 於 2026-08-06 確認後**已不成立**——entry blocker 有三條相互獨立的理由(KI-004/KI-005/KI-006),T6 只能解除 KI-004 這一條 | 若照 T6 task 檔字面執行「宣告後解除 blocker」,會產出一份**新的**跨文件矛盾(KI-004 說已解除,KI-005/KI-006 說仍阻塞)——恰好重演本 task 本身要收斂的病徵 | 所有「M14 ② 重新宣告 ⇒ entry blocker 解除」的敘述(KI-004 主文件、BD-004、WP-28 progress/README/task-checklist/T-exit-gate、exec-plan/README.md、stage4/README.md、MAP.md、S1 自身 README.md/T-exit-gate.md)一律改為「KI-004 這條理由已解除,KI-005/KI-006 兩條仍維持,entry blocker 整體未解除」;T6 task 檔本身(T6-ledger-m14-reconcile.md)保留原字面**不**回改,作為「計畫寫於缺陷發現前」的歷史記錄 |
| | *(執行中追加)* | | |

---

## 6. Open Questions(狀態隨執行更新)

| # | 問題 | Owner | Deadline | 現況 |
|---|---|---|---|---|
| ~~**OQ-S1-1**~~ | ~~是否把 `meta.simToWorld` + 靜態 eye base 從 S2 前拉進 S1?~~ | 使用者 | — | ✅ **關閉(2026-08-05)**:**前拉**,落 T2(S1-D6) |
| ~~**OQ-S1-2**~~ | ~~corridor 越界資訊在 S1 期間無匯出落點,是否可接受?~~ | 使用者 | — | ✅ **關閉(2026-08-05)**:**前拉** `meta.validity`,落 T2(S1-D6) |
| ~~**OQ-S1-3**~~ | ~~閘 ① 的 tick 選取口徑(`argmin \|Δt\|` vs `t ≤ fire.t`)~~ | 實作者 | T4 實作時 | ✅ **關閉(2026-08-06)**:採 `argmin`。見 S1-D15 / §2a |
| ~~**OQ-S1-4**~~ | ~~`clearance.halfWidthU` 是否拆成兩個欄位(= OQ-KI4-6)~~ | 實作者 | T3 實作時 | ✅ **關閉(2026-08-06)**:**不拆**(K-3 下 corridor 已非 gate,拆欄會新增兩個需人工同步的數字)。見 S1-D11 |
| ~~**OQ-S1-5**~~ | ~~M14 ② 重新宣告的證據門檻~~ | 研究者 | T6 開工前 | ✅ **關閉(2026-08-06,T6)**:採「parity 重產後綠 + 閘 ① 兩份真實 fixture 綠」為門檻,未要求研究者重新人工檢核疊圖(①③④⑤⑥ 的疊圖檢核走 ω(t),與原點無關,不受影響)。以此門檻重新宣告 ②,見 [WP-28 progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md) |
| **OQ-S1-6** | `meta.validity` 上線後,`suspect` 是否仍為研究判讀的主要旗標? | 研究者 | S3 前 | 🟡 S1 維持相容旗標;若改以 `validity` 逐項判讀,`suspect` 可於 S3 標 deprecated。不阻塞 S1 |
| **OQ-S1-7**(新) | `src/metrics/leadDerivation.ts`(`interpolateState`,[leadDerivation.ts:134-138](../../../src/metrics/leadDerivation.ts#L134))犯**同一類** D2a/D2b:`eye.x/z` 直接 `lerp(before.px, after.px, ratio)`,未套 `eyeBase` 亦未套 `SIM_TO_WORLD`。T4 README §1.4 未列此檔(out of scope),故本次**未修改**。`tests/e2e/br-tracking.spec.ts` 的 `deriveLeadError` 斷言目前為綠,純因 `br-field` 的 `eyeZ:0`(與 T4 T-S1.7 同一遮蔽模式);換到 `eyeBase.z≠0` 場景會重現同款偏差 | 實作者/使用者 | S2 或另開 KI | 🔴 未關閉——留給 S2(逐 tick eye pose 落地時)一併改用 `eyeOriginForTick`,或另開 known-issue 追蹤,取決於是否有場景使用 `leadDerivation` 且 `eyeBase.z≠0` 的既有樣本 |

> KI-004 §7 的 **OQ-KI4-2 / 5 / 6** 不在此重複,只在 T-exit 的遺留清單複查落點。
