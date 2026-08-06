# T-exit — A1 Exit gate:交付判定

> 上游:[A README §6](README.md) · [KI-005 §7 驗證計畫](../KI-005-omega-render-sim-aliasing.md)
> 依賴:T0–T6 全數 commit。本檔為**證據回填表**,不新增改動。

---

## 1. 硬閘(G-1 ~ G-8)

| # | 條件 | 驗證方式 | 結果 | 證據 |
|---|---|---|---|---|
| **G-1** | **刷新率不變性**:240 / 165 / 144 / 60 Hz 四種 pump 節奏下 `dYaw`/`dPitch` **逐位相同**(差 = 0);同組資料的 aim-diff ω 在修法前為紅 | `npm run test:ci` | ⬜ | 修法前 240 Hz 組:1 幀 tick 正規化 ω = ____ (基線 0.550) · 2 幀 = ____ (1.108) · 1 幀佔比 = ____ % (12.7%) · 修法後四節奏最大逐位差 = ____ |
| **G-2** | **守恆**:`\|Σ dYaw − Δaim.yaw\| ≤ 1e-12`(hip-only,含 pitch 夾角案) | `npm run test:ci` | ⬜ | yaw 殘差 = ____ · pitch 殘差 = ____ · 夾角案殘差 = ____ |
| **G-3** | opt-in 關閉時匯出 **byte-identical**;`TickRecord` 不含新 key;CSV 表頭逐位不變 | golden 逐位比對 + `git diff` | ⬜ | |
| **G-4** | 全套回歸:`npx tsc --noEmit` · `npm run test:ci` · `uv run pytest` 三條 exit 0 | 三條指令 | ⬜ | vitest ____ files / ____ tests + ____ e2e(T0 基線 ____)· pytest ____ passed(T0 基線 ____) |
| **G-5** | 決定性零影響:`src/sim/` · `SharedState` 演進 · `simStep` 狀態轉移零 diff;既有決定性回歸逐位綠 | `git diff --stat` + 案數對照 T0 | ⬜ | |
| **G-6** | render 逐位不變:四場景 camera 每幀 quaternion + `aimSink` 相同(含 ADS 切換序列) | `npm run test:ci` + Playwright | ⬜ | |
| **G-7** | **匯出自我描述**:新匯出含 `meta.fovDeg` + `meta.mouseIntegration` + `ticks[].dYaw/dPitch`;`omega_deg_s` 對其**無需傳參**即解析出 `source == "tick-integral"` | round-trip 測試 + `uv run pytest` | ⬜ | |
| **G-8** | 未鎖定時 `pointermove` **不入 ring**;鎖定中逐位不變 | `npm run test:ci` | ⬜ | |

---

## 2. FR 覆蓋複查

| FR | Task | 交付證據 | 結果 |
|---|---|---|---|
| FR-A-1 tick 窗內依事件時間戳積分 | T4 | G-1 | ⬜ |
| FR-A-2 `RAD_PER_COUNT` / `MAX_PITCH` 單一來源 | T1 | `grep` 無第二份定義 | ⬜ |
| FR-A-3 gain 與角度累加單一實作 | T1 | G-6 + G-2(守恆只有共用實作才可能逐位成立) | ⬜ |
| FR-A-4 `TickRecord` optional 新欄 + opt-in 逐位不變 | T4 | G-3 | ⬜ |
| FR-A-5 `meta.fovDeg` | T2 | G-7 | ⬜ |
| FR-A-6 `meta.mouseIntegration` 自我描述 | T2 | G-7 | ⬜ |
| FR-A-7 **app 路徑已啟用** | T4 | e2e round-trip 匯出含新欄 | ⬜ |
| FR-A-8 mouse pointer-lock 閘 | T3 | G-8 | ⬜ |
| FR-A-9 守恆閘 | T4 | G-2 | ⬜ |
| FR-A-10 刷新率不變性閘 | T4 | G-1 | ⬜ |
| FR-A-11 Python 新路徑 + `source` + strict | T5 | G-7 + 兩路徑逐位相同測試 | ⬜ |
| FR-A-12 `loader` 欄位相容 | T5 | 缺欄舊匯出載入測試 | ⬜ |
| FR-A-13 ω 定義段同步 | T6 | `analysis-segments.md` / `schema.md` | ⬜ |
| FR-A-14 帳本對帳 + M14 解除條件 | T6 | KI-005 / BD-005 / MAP / exec-plan | ⬜ |

---

## 3. NFR 量化複查

| NFR | 指標 | 實測 | 結果 |
|---|---|---|---|
| NFR-A-1 | sim 決定性零影響(`src/sim/` / `SharedState` 演進 / `simStep` 零 diff) | | ⬜ |
| NFR-A-2 | opt-in 關閉時匯出 byte-identical;零既有期望值變更(新增測試除外) | | ⬜ |
| NFR-A-3 | 四場景 camera 每幀 quaternion 逐位不變 | | ⬜ |
| NFR-A-4 | 四種 pump 節奏下 `dYaw`/`dPitch` 差 = **0** | | ⬜ |
| NFR-A-5 | `\|Σ dYaw − Δaim.yaw\| ≤ 1e-12` | | ⬜ |
| NFR-A-6 | 修法前 RED 簽名重現(0.533/1.067、12.5%);修法後等速輸入 `dYaw` CV ≤ 1e-9 | | ⬜ |
| NFR-A-7 | 熱路徑零物件配置(`applyInput` mouse 分支 + `accumulateMouse`) | | ⬜ |
| NFR-A-8 | 三條指令 exit 0 | | ⬜ |

---

## 4. 交付後狀態

- [ ] KI-005 狀態 = 「✅ 選項 A 已落地(A1);**A2(新採樣 + 複驗 + `seg-v2`)待排程**」。
- [ ] **M14 ③④⑤ 仍為撤回**,解除條件已於 exec-plan / MAP 逐條寫明。
- [ ] **WP-30 / WP-31 entry blocker 仍未解除**——三條理由的現況:
  | 理由 | 出處 | 現況 |
  |---|---|---|
  | ε(t) 量測原點錯誤 | KI-004 / S1 | ✅ 已解除 |
  | ω(t) render/sim aliasing | KI-005 | 🟡 **儀器已修(A1),證據力待 A2** |
  | 樣本無 counter-strafe 構念 | KI-006 | 🔴 處置待拍板 |
- [ ] 遺留 OQ 清單(逐條有落點,不得只在 commit message):
  - ~~**OQ-A-1** / **OQ-A-2**~~ → ✅ 2026-08-06 拍板(全域開 · 本次不動 `recordKeyEvents`,後者登錄 TD-5)
  - **OQ-A-3** dPitch 夾角情形是否需 quality flag → 研究者,A2-T2 觀察後定
  - **OQ-A-4**(= OQ-KI5-5)`beat_period_ticks` 是否進 `meta.display.gate` → 使用者,可另案
  - **OQ-A-5**(= OQ-KI5-6)新採樣時機與規模 → 研究者,A2-T1
  - **OQ-A-6** 守恆閘在 ADS 樣本上的容差 → WP-24 ADS drill 進分析前
- [ ] **未交付項**(明確記錄,避免日後誤以為 A 已根治):
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
