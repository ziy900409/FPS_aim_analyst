# T-exit — A1 Exit gate:交付判定

> 上游:[A README §6](README.md) · [KI-005 §7 驗證計畫](../KI-005-omega-render-sim-aliasing.md)
> 依賴:T0–T6 全數 commit。本檔為**證據回填表**,不新增改動。

---

## 1. 硬閘(G-1 ~ G-8)

| # | 條件 | 驗證方式 | 結果 | 證據 |
|---|---|---|---|---|
| **G-1** | **刷新率不變性**:240 / 165 / 144 / 60 Hz 四種 pump 節奏下 `dYaw`/`dPitch` **逐位相同**(差 = 0);同組資料的 aim-diff ω 在修法前為紅 | `npm run test:ci` | ✅ | `src/loop/SimLoop.test.ts`:四種 pump 節奏下 `expect(run).toEqual(ref)`(無容差)通過。修法前 240 Hz 組:1 幀 tick 正規化 ω lowMean≈0.553(基線 0.550 / 預測 0.533) · 2 幀 highMean≈1.058(基線 1.108 / 預測 1.067) · 1 幀佔比 lowRatio≈11.54%(基線 12.7% / 預測 12.5%)。修法後四節奏最大逐位差 = 0(deep equal),`dYaw` CV≈1.1e-15。 |
| **G-2** | **守恆**:`\|Σ dYaw − Δaim.yaw\| ≤ 1e-12`(hip-only,含 pitch 夾角案) | `npm run test:ci` | ✅ | `src/loop/SimLoop.test.ts`:一般序列 yaw/pitch 殘差皆 `≤ 1e-12`;pitch 撞 ±`MAX_PITCH` 案 yaw/pitch 殘差亦 `≤ 1e-12`。 |
| **G-3** | opt-in 關閉時匯出 **byte-identical**;`TickRecord` 不含新 key;CSV 表頭逐位不變 | golden 逐位比對 + `git diff` | ✅ | `DataRecorder.test.ts`/`SimLoop.test.ts`:未配置 `mouseIntegration` 時 `TickRecord` 不含 `dYaw`/`dPitch` key;`export.test.ts`:無 `dYaw` snapshot 的 CSV 表頭維持既有 12 欄。`npm.cmd run test:ci` 通過；本切片前 `git diff --stat` 為空。 |
| **G-4** | 全套回歸:`npx tsc --noEmit` · `npm run test:ci` · `uv run pytest` 三條 exit 0 | 三條指令 | ✅(known env workaround) | `npx.cmd tsc --noEmit` exit 0；`npm.cmd run test:ci` exit 0(vitest **89 files / 739 tests**,Playwright **20/20**；T0 基線 88 files / 694 tests + 19 e2e)。`uv run pytest` 原生仍因 T0-S1 的外部 Temp ACL 問題在 setup 階段失敗；同一測試集用 workspace-local `--basetemp ..\codex_pytest_tmp_t_exit` 通過 **195 passed**(T0 workaround 基線 183 passed)。 |
| **G-5** | 決定性零影響:`src/sim/` · `SharedState` 演進 · `simStep` 狀態轉移零 diff;既有決定性回歸逐位綠 | `git diff --stat` + 案數對照 T0 | ✅ | T4/T5/T6 記錄:未觸及 `src/sim/`、`SharedState` 演進；`SimLoop.applyInput` mouse 分支只寫 recorder、不寫 `state`。T-exit 前 `git diff --stat` 為空；`npm.cmd run test:ci` 內含 regression/determinism golden 全綠。 |
| **G-6** | render 逐位不變:四場景 camera 每幀 quaternion + `aimSink` 相同(含 ADS 切換序列) | `npm run test:ci` + Playwright | ✅ | `src/view/CameraController.test.ts`/`src/scene/eyePose.test.ts` 逐位 quaternion + `aimSink` golden 通過；Playwright **20/20**。 |
| **G-7** | **匯出自我描述**:新匯出含 `meta.fovDeg` + `meta.mouseIntegration` + `ticks[].dYaw/dPitch`;`omega_deg_s` 對其**無需傳參**即解析出 `source == "tick-integral"` | round-trip 測試 + `uv run pytest` | ✅ | `metadata.test.ts` 驗證 `meta.fovDeg`/`meta.mouseIntegration` 與拒絕案；`export.test.ts` 驗證 JSON/CSV 保留 `dYaw`/`dPitch`；`tests/e2e/input-sampler.spec.ts` 驗證正式 app 單例 `recorder.mouseIntegration` 已啟用；Python `test_run_pipeline.py` 驗證合成 export `omegaSource == "tick-integral"` 且 legacy export 帶警示。 |
| **G-8** | 未鎖定時 `pointermove` **不入 ring**;鎖定中逐位不變 | `npm run test:ci` | ✅ | `src/input/InputSampler.test.ts` 覆蓋未鎖定不入 ring、legacy fallback、解鎖/重鎖；`tests/e2e/input-sampler.spec.ts` 覆蓋真瀏覽器未鎖定 pointermove/coalesced 子樣本不入 ring。 |

---

## 2. FR 覆蓋複查

| FR | Task | 交付證據 | 結果 |
|---|---|---|---|
| FR-A-1 tick 窗內依事件時間戳積分 | T4 | G-1 | ✅ |
| FR-A-2 `RAD_PER_COUNT` / `MAX_PITCH` 單一來源 | T1 | production source 定義點只在 `src/input/mouseGain.ts`;tests/docs 的 literal 為驗證與歷史記錄,非 runtime 第二實作 | ✅ |
| FR-A-3 gain 與角度累加單一實作 | T1 | G-6 + G-2；`CameraController` 與 recorder 皆消費 `resolveMouseGain` / `AimIntegrator` | ✅ |
| FR-A-4 `TickRecord` optional 新欄 + opt-in 逐位不變 | T4 | G-3 | ✅ |
| FR-A-5 `meta.fovDeg` | T2 | G-7 | ✅ |
| FR-A-6 `meta.mouseIntegration` 自我描述 | T2 | G-7 | ✅ |
| FR-A-7 **app 路徑已啟用** | T4 | `tests/e2e/input-sampler.spec.ts` 直讀正式 app 單例 `__aimDebug.recorder.mouseIntegration` 已配置正有限 gain | ✅ |
| FR-A-8 mouse pointer-lock 閘 | T3 | G-8 | ✅ |
| FR-A-9 守恆閘 | T4 | G-2 | ✅ |
| FR-A-10 刷新率不變性閘 | T4 | G-1 | ✅ |
| FR-A-11 Python 新路徑 + `source` + strict | T5 | G-7 + `test_angular.py` tick-integral / legacy / strict / 半欄 miss / 兩路徑逐位相同 | ✅ |
| FR-A-12 `loader` 欄位相容 | T5 | `test_loader.py`:缺欄填 `nan`,存在時讀值,非有限值拒絕 | ✅ |
| FR-A-13 ω 定義段同步 | T6 | `analysis-segments.md` / `schema.md` | ✅ |
| FR-A-14 帳本對帳 + M14 解除條件 | T6 | KI-005 / BD-005 / MAP / exec-plan | ✅ |

---

## 3. NFR 量化複查

| NFR | 指標 | 實測 | 結果 |
|---|---|---|---|
| NFR-A-1 | sim 決定性零影響(`src/sim/` / `SharedState` 演進 / `simStep` 零 diff) | `src/sim/` 無 diff；mouse 分支只呼叫 `recorder.accumulateMouse(...)`；determinism/golden 測試全綠 | ✅ |
| NFR-A-2 | opt-in 關閉時匯出 byte-identical;零既有期望值變更(新增測試除外) | 未配置 `mouseIntegration` 時 `TickRecord` 無新 key、CSV 表頭維持 12 欄；既有 golden 全綠 | ✅ |
| NFR-A-3 | 四場景 camera 每幀 quaternion 逐位不變 | `CameraController.test.ts` + `eyePose.test.ts` 全綠 | ✅ |
| NFR-A-4 | 四種 pump 節奏下 `dYaw`/`dPitch` 差 = **0** | `toEqual` deepEqual 逐位比較通過,最大差 0 | ✅ |
| NFR-A-5 | `\|Σ dYaw − Δaim.yaw\| ≤ 1e-12` | 一般 hip-only 與 pitch 夾角案皆 `≤ 1e-12` | ✅ |
| NFR-A-6 | 修法前 RED 簽名重現(0.533/1.067、12.5%);修法後等速輸入 `dYaw` CV ≤ 1e-9 | 240 Hz lowMean≈0.553/highMean≈1.058/lowRatio≈11.54%;165/144/60 Hz 舊法 CV≈0.351/0.280/1.040;新法 `dYaw` CV≈1.1e-15 | ✅ |
| NFR-A-7 | 熱路徑零物件配置(`applyInput` mouse 分支 + `accumulateMouse`) | `applyInput` mouse 分支無物件配置；`AimIntegrator` 重用私有 `#delta` 物件；DataRecorder 只累加兩個 number | ✅ |
| NFR-A-8 | 三條指令 exit 0 | TS + `npm.cmd run test:ci` 通過；原生 `uv run pytest` 仍受外部 Temp ACL 阻擋,Python 測試本體在 known workaround 下 **195 passed** | ✅(known env workaround) |

---

## 4. 交付後狀態

- [x] KI-005 狀態 = 「✅ 選項 A 已落地(A1);**A2(新採樣 + 複驗 + `seg-v2`)待排程**」。
- [x] **M14 ③④⑤ 仍為撤回**,解除條件已於 exec-plan / MAP 逐條寫明。
- [x] **WP-30 / WP-31 entry blocker 仍未解除**——三條理由的現況:
  | 理由 | 出處 | 現況 |
  |---|---|---|
  | ε(t) 量測原點錯誤 | KI-004 / S1 | ✅ 已解除 |
  | ω(t) render/sim aliasing | KI-005 | 🟡 **儀器已修(A1),證據力待 A2** |
  | 樣本無 counter-strafe 構念 | KI-006 | 🔴 處置待拍板 |
- [x] 遺留 OQ 清單(逐條有落點,不得只在 commit message):
  - ~~**OQ-A-1** / **OQ-A-2**~~ → ✅ 2026-08-06 拍板(全域開 · 本次不動 `recordKeyEvents`,後者登錄 TD-5)
  - **OQ-A-3** dPitch 夾角情形是否需 quality flag → 研究者,A2-T2 觀察後定
  - **OQ-A-4**(= OQ-KI5-5)`beat_period_ticks` 是否進 `meta.display.gate` → 使用者,可另案
  - **OQ-A-5**(= OQ-KI5-6)新採樣時機與規模 → 研究者,A2-T1
  - **OQ-A-6** 守恆閘在 ADS 樣本上的容差 → WP-24 ADS drill 進分析前
- [x] **未交付項**(明確記錄,避免日後誤以為 A 已根治):
  - **仍是 128 Hz 解析度**(TD-1)。一次 200 ms flick 僅 25 點,3–4 點寬的修正動作無法分辨 ⇒ WP-31 的 submovement / SPARC / Fitts **仍需選項 B**。
  - **ADS 切換幀的歸屬殘差**(TD-2 / FM-2):camera 的 gain 階躍量化到 render 幀,積分器量化到事件時刻。現有樣本全程未開鏡故不受影響,但 WP-24 ADS drill 進分析前必須複查。
  - **FM-1 的假設尚未證偽**:`getCoalescedEvents()` 的分量總和是否等於 dispatched event 的 `movementX/Y`——合成路徑必然相等,**真實資料上只有 A2-T2 能驗**。若不成立,選項 B 必須提前。
  - **`omega[0]` 已有值但刻意捨棄**(TD-3),待 `seg-v2` 決定。
  - **`recordKeyEvents` 仍未在 app 啟用**(TD-5),須在 A2-T1 採樣前由研究者決定。
  - **既有兩份匯出(08:03 / 09:39)的 ω(t) 仍不可用**——OQ-KI5-3 拍板不做回溯清洗;它們刻意保留為 `aim-diff-legacy` 與 strict 拋錯的回歸樣本。

---

## 5. 建議的下一步

| 優先 | 項目 | 理由 |
|---|---|---|
| 1 | **A2-T1 新採樣**(見 [A2-blocked-plan.md](A2-blocked-plan.md)) | 是本 KI **與** KI-006 的共同瓶頸;在它完成前,ω 相關的一切效度宣稱都無法恢復。且它同時關閉 FM-1 這個 A1 內無法證偽的假設 |
| 2 | **KI-006 處置拍板** | 與 A2-T1 綁在同一次採集(OQ-KI6-1 已收斂到選項 B);先拍板才能一次採到位(含 OQ-KI6-4 的 n ≥ 2、OQ-A-2 的 `recordKeyEvents`) |
| 3 | **選項 B**(raw ~1000 Hz sample stream) | 不阻塞 A2,但 WP-31 開工前必須決定;若 A2-T2 的守恆檢查失敗(FM-1),則**立即提前** |
| 4 | `beat_period_ticks` 進 gate(OQ-A-4) | A 落地後價值降為稽核舊匯出與偵測回歸;低優先,可另案 |

## Commit message

```
docs(ki-005): A1 exit gate — 八道硬閘證據回填 + 交付判定
```
