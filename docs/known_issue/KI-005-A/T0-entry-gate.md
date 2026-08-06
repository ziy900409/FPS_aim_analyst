# T0 — Entry gate:基線量測與受影響面盤點

> 上游:[A README](README.md) · [KI-005](../KI-005-omega-render-sim-aliasing.md) · [BD-005](../BUGFIX-DECISIONS.md)
> 目標:在動任何程式碼**之前**,把「現況是什麼」量成數字。A 的最大風險是 **R-1**(`AimIntegrator` 抽取改動 render 熱路徑)與 **R-3**(啟用後所有新匯出改變形狀)——邊修邊發現等於失控。

**In scope**:量測、盤點、寫入 [progress.md](progress.md)。
**Out of scope**:任何 `src/` / `research/` 程式碼改動。

---

## Steps

### 1. 決策前提確認(讀,不改)

- [ ] [BD-005](../BUGFIX-DECISIONS.md) §2 條目存在,且「選項 A / 感度由 meta 重建 / 不做過渡期 C」三項拍板可逐條引用。
- [ ] [KI-005 §6.1](../KI-005-omega-render-sim-aliasing.md) 的 OQ-KI5-1/2/3/4 已關閉狀態仍成立;OQ-KI5-5/6 仍為未決。
- [ ] 確認 **尚未有任何程式碼改動**:`git status` 乾淨,KI-005 §狀態列「尚未動任何程式碼」仍成立。
- [ ] [README §5](README.md) 的 OQ-A-1 / OQ-A-2 已於 2026-08-06 關閉(全域開啟 · 本次不動 `recordKeyEvents`),T4 據此實作。

### 2. 基線紅綠燈(三條指令,記錄實際輸出)

```bash
npx tsc --noEmit
```

```bash
npm run test:ci
```

```bash
uv run pytest
```

逐條記下 **exit code + 檔數/案數**。KI-004 / S1 收尾時的實測基線為 vitest **88 files / 694 tests** + Playwright **19/19**、pytest **183 passed**——本次以**實際重跑值**為準(既有開發持續累積測試),記入 [progress.md §2](progress.md)。這是 G-4 / G-5 的對照基準。

### 3. §2.4 兩個缺口的行號複核(必做,計畫的前提)

- [ ] [`InputSampler.onPointerMove`](../../../src/input/InputSampler.ts#L132) 確認**無** `isLocked()` 閘,而同檔的 `onMouseDown`(fire)與 ads 分支**有**。抄錄行號與現行程式碼片段進 progress。
- [ ] [main.ts:342](../../../src/main.ts#L342) 確認 `createDataRecorder({ simHz: SIM_HZ })` **未**傳 `recordKeyEvents`。抄錄行號進 progress。
- [ ] 確認 [`applyInput`](../../../src/loop/SimLoop.ts#L66) 的三個分支(`key` / `fire` / `ads`)中**沒有** `mouse` 分支,且 mouse 事件確實會經 [`consume`](../../../src/input/consume.ts) 交付到 `applyInput`(即事件在 ring 內、被 dequeue、只是無分支處理)。
- [ ] 確認 [`InputRing`](../../../src/state/SharedState.ts) 的 `pushMouse` 以 `Float64Array` 存 `dx`/`dy`(**無精度損失**,積分不需補償)。

> 三者任一與計畫描述不符 ⇒ **先停**,回頭修 README §2.4,不得帶著錯誤前提進 T1。

### 4. RED 基線可重現化(G-1 的紅證據)

寫一支**臨時**腳本(放 scratchpad,**不進 repo**;比照 KI-004 / S1 T0 慣例):

- [ ] **凹口偵測器**(KI-005 §3.1 口徑:`w[i] < 0.6 × min(w[i±1])` 且 `w[i±1] > 80`),對兩份真實匯出各輸出凹口數與間距分布。
  - 對照基線:08:03 → **27** 個,間距全為 8 的倍數;09:39 → **34** 個,眾數 8。
- [ ] **幀數比對**(KI-005 §3.3):以 `meta.frames.series` 重建幀時間點,計算每個 tick 窗夾到幾幀,與正規化 ω 比對。
  - 對照基線:1 幀 tick → 正規化 ω **0.550**(佔比 12.7%)、2 幀 tick → **1.108**;`corr = 0.805`。
- [ ] **對不上就先停**——代表對 fixture 或口徑的理解有誤。
- [ ] 順帶記下兩份匯出的 `meta.display.refreshEstimateHz`(預期 240)與 `meta.simHz`(預期 128),作為 T4 刷新率不變性閘的參數來源。

> ⚠️ 這兩個偵測器在 **A2-T2** 會被重新使用(對新匯出跑,期望凹口數 = 0)。腳本雖不進 repo,但其**口徑與參數**必須逐字記入 progress,使 A2 可原樣重跑。

### 5. 受影響測試清單(R-1 / R-3 的核心動作)

以**唯讀**方式盤點所有會因本次修法而變動的測試,逐條記下「現值 → 預期變動 / 預期不變 → 歸因」:

- [ ] `src/view/CameraController.test.ts`(若存在)— T1 抽取後**預期逐位不變**;有任何數值變動即代表浮點運算順序被改(R-1),立即停。
- [ ] `src/scene/` 的四場景 camera 位置測試(KI-004 / S1 T1 新增的 `eyePose.test.ts`)— **預期不變**。
- [ ] `src/data/metadata.test.ts` · `src/data/export.test.ts` — T2 新增 optional 欄位,**預期只增不改**。
- [ ] `src/state/InputRing.test.ts` · `src/input/` 的 sampler 測試 — T3 的 lock 閘會影響「未鎖定時 pointermove」的案子;盤點目前是否有這類案子、其斷言為何。
- [ ] `tests/e2e/*.spec.ts` 中會產生匯出 round-trip 的案子(`full-drill.spec.ts`、`br-tracking.spec.ts`、`input-sampler.spec.ts`)— T4 啟用後匯出多出兩欄,**逐條標註預期變動**。
- [ ] golden / 決定性回歸(`src/loop/__tests__/`、`tests/regression/`、`tests/golden/`)— **預期零變動**;若有變動即代表誤觸 sim(NFR-A-1 違反),立即停。
- [ ] Python:`test_angular.py`(`omega_deg_s` 的既有案)· `test_run_pipeline.py` · `test_parity_fixture.py` · `test_purity.py` — T5 新增 source 分支,**既有案預期不變**(舊 fixture 走 `aim-diff-legacy`)。
- [ ] 是否有 golden fixture **直接比對整個 `ticks` 陣列或整個 `meta` 物件**?若有,新增 optional 欄位會讓它們 diff ⇒ 需逐條確認是「新欄位出現」而非「既有值改變」。

### 6. `meta.suspect` / `bufferOverflow` 口徑抄錄(T3 的比對基準)

- [ ] 抄錄目前 `meta.suspect` 的完整 OR 集合([main.ts:383-385](../../../src/main.ts#L383) + [export.ts:26](../../../src/data/export.ts#L26))——本次**不得**變動任何一項(A 與 `suspect` 無關)。
- [ ] 抄錄 `sharedState.inputMeta.bufferOverflow` 的現行累加點(`InputSampler` 的六個 `push*` 失敗分支),作為 FM-8 的比對基準:T3 之後 mouse 分支只在**鎖定中**才可能累加。

---

## Definition of Done

- [ ] 三條基線指令的 **exit code 與檔數/案數**已記入 [progress.md §2](progress.md)。
- [ ] §2.4 兩個缺口(`pushMouse` 無 lock 閘、`main.ts` 未啟用 `recordKeyEvents`)已以**行號 + 程式碼片段**複核確認並抄錄。
- [ ] 凹口偵測器與幀數比對的基線數字重現成功,與 KI-005 §3.1 / §3.3 相符(容許最後一位小數差異);**口徑與參數已逐字記入 progress 供 A2 重跑**。
- [ ] 受影響測試清單完成,每條標註「預期變動 / 預期不變」,且**決定性回歸與 golden 全部標為預期不變**。
- [ ] `meta.suspect` 的 OR 集合與 `bufferOverflow` 累加點已抄錄。
- [ ] 兩份真實匯出的 `refreshEstimateHz` / `simHz` 已記錄(T4 閘的參數來源)。
- [ ] `git status` 顯示只有 `docs/known_issue/KI-005-A/` 下的文件變動,`src/` 與 `research/` 零改動。

## Commit message

```
docs(ki-005): A T0 entry gate — 基線紅綠燈 + 兩個缺口行號複核 + RED 基線可重現化 + 受影響測試盤點
```
