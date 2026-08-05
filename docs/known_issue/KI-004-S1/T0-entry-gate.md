# T0 — Entry gate:基線量測與受影響面盤點

> 上游:[S1 README](README.md) · [KI-004](../KI-004-sim-world-unit-domain-mismatch.md) · [BD-004](../BUGFIX-DECISIONS.md)
> 目標:在動任何程式碼**之前**,把「現況是什麼」量成數字。S1 的最大風險(R-1)是修正錯值會讓一批綠測試轉紅——邊修邊發現等於失控。

**In scope**:量測、盤點、寫入 `progress.md`。**Out of scope**:任何 `src/` / `research/` 程式碼改動。

---

## Steps

### 1. 決策前提確認(讀,不改)

- [ ] [BD-004](../BUGFIX-DECISIONS.md) §2 條目存在,且 **K-1 / K-2 / K-3** 三項拍板可逐條引用。
- [ ] [KI-004 §5.1](../KI-004-sim-world-unit-domain-mismatch.md) 的 S1 六項(①~⑥)與本 S1 計畫的 T1–T5 對得上。
- [ ] 確認 **尚未有任何程式碼改動**:`git status` 乾淨,KI-004 §8「尚未修改任何程式碼」仍成立。

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

逐條記下 **exit code + 檔數/案數**(預期基線:vitest 82 files / 641 tests + 19 e2e;pytest 74 passed)。這是 G-4 / G-5 的對照基準。

### 3. 受影響測試清單(R-1 的核心動作)

以**唯讀**方式盤點所有會因「eye origin 修正」而改變數值的測試,逐條記下「現值 → 預期新值 → 歸因」:

- [ ] `src/metrics/trackingDerivation.test.ts` — 哪些案子用了非零 `px`/`pz` 或非零 target z?(全 `(0,·,0)` 原點的合成案應**不變**)
- [ ] `src/metrics/detectionDerivation.test.ts` — 同上。
- [ ] `tests/golden/research/epsilon-parity.test.ts` — 依賴 `research/fixtures/parity/epsilon-synthetic_counterstrafe.json`,T4 重產後必然變動。
- [ ] `tests/e2e/br-tracking.spec.ts` — 走 `__fpsTest.trackingMetricsFromExport()`([fpsTestHarness.ts:544](../../../src/testharness/fpsTestHarness.ts#L544) 目前**不傳 options**),場景 eye base 非零時會變動;WP-23 M11「推導誤差 ≤ 1 tick」的斷言需重新確認。
- [ ] `research/src/modules/kinematics/algorithms/tests/test_angular.py` — `epsilon_deg`/`on_target` 的簽名於 T4 破壞性變更。
- [ ] `research/src/modules/kinematics/algorithms/tests/test_parity_fixture.py` · `test_purity.py`
- [ ] 決定性回歸(`src/loop/__tests__/`、`tests/regression/`)— **預期零變動**;若有變動即代表誤觸 sim(NFR-S1-1 違反),立即停。

### 4. 偏差基線可重現化(閘 ① 的紅證據)

- [ ] 寫一支**臨時**腳本(放 scratchpad,**不進 repo**),對 [08:03 匯出](../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json) 與 [09:39 匯出](../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json) 各輸出:
  - 合格 fire 數(`offsetDeg` 存在且 `aimPunchPitch/Yaw` 皆 0)
  - `|ε_現行 − offsetDeg|` 的 median / max
  - `|ε_正確 − offsetDeg|` 的 median / max(以 `base = (0, 1.6, 4)`、`simToWorld = 0.01` 計)
- [ ] 對照 KI-004 §1.2 的實測值:08:03 → 12.52 / 12.73 vs 0.21;09:39 → 67.11 / 88.55 vs 0.14。**對不上就先停**,代表對 fixture 或口徑的理解有誤。
- [ ] 順帶記下兩份 fixture 的 `meta.scene.sceneId`(預期 `field-low`)與合格 fire 樣本數 —— 樣本數會成為閘 ① 的「非空」下限。

### 5. 前拉範圍的影響面(OQ-S1-1 / OQ-S1-2 已於 2026-08-05 拍板前拉)

T2 會動 `src/data/metadata.ts` 與 `export.ts` —— **所有匯出都會經過**的兩個檔(R-2b)。先盤點:

- [ ] `src/data/metadata.test.ts` · `src/data/export.test.ts` 的現有案數與涵蓋範圍。
- [ ] 是否有 golden / 決定性 fixture 直接比對**整個 meta 物件**?若有,新增 optional 欄位會讓它們 diff ⇒ 需逐條確認是「新欄位出現」而非「既有值改變」。
- [ ] 記下目前 `meta.suspect` 的完整 OR 集合(`main.ts:379-382` + `export.ts:26`),作為 NFR-S1-2b「只減不加」的比對基準:
  - `sharedState.validity.playerCorridorExceeded`(T3 移除)
  - session / protocol suspect
  - `frames.summary.p95 > PERF_FLOOR_MS`
  - `snapshot.recorderOverflow`(於 `buildExportPayload` OR 入)
  - **`bufferOverflow` 不在集合內** —— T2 加入 `validity` 時不得順手併入。
- [ ] 剩餘 OQ(**OQ-S1-3** 閘 ① 的 tick 選取口徑、**OQ-S1-4** `clearance.halfWidthU` 是否拆欄、**OQ-S1-5** M14 ② 證據門檻)於各自 task 開工前確認,不阻塞 T0。

---

## Definition of Done

- [ ] 三條基線指令的 **exit code 與案數**已記入 [progress.md](progress.md)。
- [ ] 受影響測試清單完成,每條標註「預期變動 / 預期不變」,且**決定性回歸全部標為預期不變**。
- [ ] 08:03 與 09:39 的偏差基線數字重現成功,與 KI-004 §1.2 相符(容許最後一位小數差異)。
- [ ] `meta.suspect` 的完整 OR 集合已抄錄於 progress(NFR-S1-2b 的比對基準),並確認 `bufferOverflow` 不在其中。
- [ ] `metadata.test.ts` / `export.test.ts` 與可能比對整個 meta 物件的 golden fixture 已盤點(R-2b)。
- [ ] `git status` 顯示只有 `docs/known_issue/KI-004-S1/` 下的文件變動,`src/` 與 `research/` 零改動。

## Commit message

```
docs(ki-004): S1 T0 entry gate — 基線紅綠燈 + 受影響測試盤點 + 偏差基線重現 + suspect OR 集合抄錄
```
