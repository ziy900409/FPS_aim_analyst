# Stage 13（階段 M）— 原始輸入取樣與抬滑鼠偵測

> 上層索引：[`docs/exec-plan/README.md`](../../README.md) ← **大框架權威**
> 本檔為 stage13 的 stage 層索引。狀態以本檔與各 WP 的 `progress.md` 為準。

---

## 1. 這個 stage 在解什麼

WP-57 交付的抬滑鼠疑慮標註（`deriveRepositioningSuspicion()`）**只能觀測到「角速度停滯」**，因為匯出資料的最小時間粒度是 **128 Hz 的 sim tick 聚合值**（`dYaw`/`dPitch`）。它因此在原理上無法分辨三件事：

| 真實情況 | 匯出裡的樣子 |
|---|---|
| 抬起滑鼠（感測器離地，完全不回報）| `dYaw ≈ 0` |
| 手在滑鼠上刻意停頓（有生理性微顫）| `dYaw ≈ 0` |
| Pointer Lock 中途掉了（事件根本沒進 ring）| `dYaw ≈ 0` |

真人資料實測的後果：刻意停頓的停滯長度 p90 = **474 ms**，比抬滑鼠的 180–225 ms **還長** ⇒ 兩者的長尾完全重疊（WP-57 §T5-real）。這不是門檻沒調好，是**訊號裡沒有那個資訊**。

`performance_analysis` 專案的 LOD（Lift-Off Detection）管線使用 **1000 Hz 滑鼠取樣的時間間隙**（`dt > 30 ms`）作為候選訊號。2026-09-09 R2 實測顯示自然停頓也有秒級空洞，因此時間間隙不能視為感測器離地的直接證據。其 ADR-002 記載，v1 的兩個系統性偽陽為「目標捕獲時的急停」與「目標中心附近的生理性顫抖」；WP-61 需以獨立標註資料驗證 Stage 2/3 是否能改善區分。

**本 stage 的目標：把那個訊號取回來。** 原料已經在收（[`InputSampler.ts:137-139`](../../../../src/input/InputSampler.ts#L137-L139) 的 `getCoalescedEvents()` 逐筆帶 `event.timeStamp`），但在 [`SimLoop.ts:96-99`](../../../../src/loop/SimLoop.ts#L96-L99) 被聚合成逐 tick 值之後就丟掉了。

---

## 2. WP 清單

| WP | 資料夾 | 一句話 | Exit gate | 相依 | 估時（d） | 狀態 |
|---|---|---|---|---|---|---|
| **WP-60** | [`wp-60-raw-mouse-sample-capture/`](wp-60-raw-mouse-sample-capture/README.md) | 原始滑鼠取樣匯出 schema + 擷取路徑 + 時間間隙原語；證明資料足以支撐 LOD 移植 | T-exit | 無（WP-57 已交付，只讀不改）| 5.5–9.5 | ✅ **T-exit 與 TF1～TF3 全數交付 2026-09-09**（零具名缺口）—— A-60.1～16 **15 ✅／1 ✅ 帶上界告警（OQ-60.7 匯出體積）**，無 🟡／❌；T0～T4 全 ✅。F6 實機 A/B Δp95 **−0.005 ms** 且未新增 over-budget windows；真人 B 組 `activeRateHz=708 Hz` 並完成 18／30／50 ms sweep；typecheck ×2、全量 Vitest（2614 passed）、`vite build` exit 0；全量 Playwright `--workers=1` **101 passed／0 failed（13.8m）**，WP-60 raw-mouse 2／2 passed，測試 history roots 存在且真實 history 前後未變。決策 [GD-36](../../DECISIONS.md) |
| **WP-61** | [`wp-61-lift-off-validation/`](wp-61-lift-off-validation/README.md) | 先驗證空洞前後運動學可分性，再決定 Stage 2/3 移植與校準 | T-exit（三種合法結案：通過／不可靠分離／證據不足） | WP-60 T-exit ✅ + 高刷（≥ 120 Hz）真人標註 cohort | 9–15（T4 條件式；負面結論路徑 6.5–11） | 🟡 **T0 entry gate 已完成 2026-09-09，T1 可開**。<br>✅ 已凍結：構念**並存**、新構念「**感測器離地／sensor lift**」、標註採 `KeyL` self-report + block 冗餘、cohort 逐份條件 `meta.displayHz === 240`、n=1 宣稱上限 `research_only`、pre-registration `sensor-lift-validation-v1`（θ = 18/30/50 ms、匹配容差 300 ms、held-out promotion gate）。<br>⚠️ 剩餘阻塞：**cohort 尚未錄製**（硬體已就緒，需 T1 儀器先落地）。計畫相對草案新增 **T1 標註通道儀器** —— repo 內沒有產生獨立標註的機制（D-61.P2）。決策帳本 [GD-37](../../DECISIONS.md) |

**為什麼切成兩個 WP**：WP-60 只負責「把資料取回來並證明它夠用」，不宣稱任何偵測準確度。LOD 判準的參數必須以**真人標註資料**重新推導（PA 的參數在 px/s 空間、且其 ADR 自承 F1 從未對標註資料量測過），而那批資料目前不存在 —— 見 §4。把兩者綁在同一個 WP 會讓一個純工程可驗收的切片，卡在一個等資料的研究問題上。

---

## 3. 編號分配

- **WP-60** 由本 stage 取用。stage12 已用到 WP-59（平行 session 的 micro flick v8 替補間距），依 GD-15「先採納先得」本 stage 自 WP-60 起算。
- ~~本 stage 預計新增 **GD-35**（原始輸入取樣的匯出邊界與 C-D4 歸屬）…現行最高為 GD-34。~~
  **更正（2026-09-09，WP-60 T-exit）**：規劃期預留的 `GD-35` **已被平行 session 的 WP-58 T0 取用**（stage12，同日入帳）。
  依 GD-15「先採納先得」不與之爭號 ⇒ 本 stage 實際入帳為 **[GD-36](../../DECISIONS.md)**（原始輸入取樣的匯出邊界與 C-D4 歸屬），
  於 **T-exit** 拍板（非 T1 —— T1 當時只凍結 contract，構念邊界要等 T3 的中性語彙與 R2 的負面結論都到位才有東西可入帳）。
  入帳時 `DECISIONS.md` 現行最高為 GD-35。

---

## 4. 跨 stage 相依與已知阻塞

```
WP-57（spider shot wide flick）✅ 已交付
   │  只讀不改：deriveRepositioningSuspicion / mouseThrow / spiderShotConditions
   ▼
WP-60（原始滑鼠取樣 schema）  ← 本 stage
   │
   ├── 需要：高刷（≥ 144 Hz）真人重錄 ─────┐
   │      規格已交付：docs/operational/     │
   │      spider-wide-recording-spec.md     │
   ▼                                        ▼
WP-61（LOD 判準移植 + 校準）  ←────────────┘
```

> **2026-09-09 補註（WP-61 規劃期，D-61.U3）**：上圖的「≥ 144 Hz」與 [`spider-wide-recording-spec.md`](../../../operational/spider-wide-recording-spec.md) §2.1 的「≥ 120 Hz」**不是矛盾，是兩個不同的門檻，兩者都成立**：
> - **≥ 120 Hz** ＝ 資格閘地板，依 `PERF_FLOOR_MS = 8.33`（[`src/display/constants.ts:13`](../../../../src/display/constants.ts#L13)）—— 管 `meta.suspect` 是否被 frame floor 判紅。
> - **≥ 144 Hz** ＝ [KI-031](../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 的完全緩解點（aim 更新率 ≥ 128 Hz）—— §2 的失效邊界：零樣本比例 ≈ `1 − f/128`，`f ≈ 120 Hz` 仍約 **6% 零樣本 ⇒ 偶發漏檢**，60 Hz 為懸崖（113/113 全滅）。管 `deriveDetectionMetrics()` 會不會靜默失效。
>
> ⇒ 兩個數字都**不得**被統一或改寫。WP-61 的 cohort **一律錄在 240 Hz**（同時清掉兩者），逐份可用性條件寫成 `meta.displayHz === 240`，禁止與 60 Hz 混批。

- **[KI-031](../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 與本 stage 正交但相關**：KI-031 是 detection 判準在低 aim 更新率下失效；本 stage 是輸入取樣粒度不足。兩者都在 ≥ 144 Hz 機器上緩解（KI-031 的依據見 §4 上方補註：aim ≥ 128 Hz；**120 Hz 只是「多數情況可用」，仍約 6% 零樣本**），但**修法不同、不得混為一談**。WP-60 不修 KI-031。
- **真人資料缺口**：WP-57 §T5-real 的四份匯出依 D-57.T5-8 **不進 repo**，且錄製於 60 Hz 機器。WP-60 的 T0 充分性稽核因此**不能**用它們，必須以合成訊號 + 實機 PoC 進行。

---

## 5. 執行規則

沿用 [`CLAUDE.md §3`](../../../../CLAUDE.md) 與 [`exec-plan/README.md §5`](../../README.md)：一 task = 一垂直切片 = 一原子 commit；T0 未過不開 T1；每個 task 完成同步該 WP 的 `progress.md` 與 `task-checklist.md`。
