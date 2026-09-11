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
| **WP-61** | [`wp-61-lift-off-validation/`](wp-61-lift-off-validation/README.md) | 先驗證空洞前後運動學可分性，再決定 Stage 2/3 移植與校準 | T-exit（三種合法結案：通過／不可靠分離／證據不足） | WP-60 T-exit ✅ + 高刷（≥ 120 Hz）真人標註 cohort | 9–15（T4 條件式；負面結論路徑 6.5–11） | 🟡 **T2 判定 `blocked-by-data` 2026-09-09：儀器全備，缺真人 cohort**。<br>✅ 已凍結：構念**並存**、新構念「**感測器離地／sensor lift**」、標註採 `KeyL` self-report + block 冗餘、cohort 逐份條件 `meta.displayHz === 240`、n=1 宣稱上限 `research_only`、pre-registration `sensor-lift-validation-v1`（θ = 18/30/50 ms、匹配容差 300 ms、held-out promotion gate）。<br>✅ T1 已交付：`?annotation=1` opt-in、JSON `annotation` event、CSV header 不變、四 FPS tick 全欄位 parity + 突變驗證、focused Edge E2E。<br>✅ T2 已交付儀器：`npm run analyze:lift-cohort`（三選一去向 `sufficient`／`blocked-by-data`／`annotation-channel-unusable`）、`npm run record:lift-golden`（Stage 1 golden + 逐位重現斷言）、`research/src/lift/`（候選事件表，C-D1／C-D2 掃描釘死）、Python `load_export` additive 接受 `pointer_lock`／`annotation`（先前整份拒收）。<br>⚠️ 剩餘阻塞：**cohort 尚未錄製**（硬體已就緒，儀器已落地；錄製屬使用者）。決策帳本 [GD-37](../../DECISIONS.md) |

| **WP-62** | [`wp-62-session-plan-per-item-weapon/`](wp-62-session-plan-per-item-weapon/README.md) | Session Plan 自訂 program 的每一列可事先指定武器；選擇進匯出稽核 | T-exit | WP-58 T-exit ✅（只讀不改 frozen 軌） | 8.5 | ✅ **T-exit 交付 2026-09-10**。A-62.1～A-62.7 全數具名證據；最終 gate：typecheck ×2 exit 0、`vite build` exit 0（非 sandbox；sandbox 受 Vite/esbuild config 權限限制）、全量 Vitest **2,946 passed／2 skipped**、全量 Playwright `--workers=1` **106 passed（14.4m）**。frozen live meta 鍵面 digest 三格皆 `2752c07b` 與 `f0df84d` 基準一致；意圖 `sessionPlanItems[].weaponId` vs 事實 `meta.weaponId` live 對帳通過。決策 [GD-38](../../DECISIONS.md)。⚠️ **主題不屬本 stage**（session 排程層，非原始輸入取樣），依使用者 2026-09-10 指示落於此處——見下方 §3。 |
| **WP-65** | [`wp-65-drill-arming-and-countdown/`](wp-65-drill-arming-and-countdown/README.md) | Drill 開場待命閘（點左鍵 → 3 秒倒數 → 開始）+ 時限型 drill 的 HUD `Time` 倒數 + Pointer Lock 掉鎖的效度標記 | T-exit（A-65.1～A-65.12） | 無（與 WP-60～64 全數正交、可並行） | 6.5–9 | 📋 **規劃完成、未開工（2026-09-11）**。決策草稿 GD-41（D-65-1～5，T-exit 落帳）。⚠️ **主題不屬本 stage**（drill 生命週期／受試者體驗層，非原始輸入取樣）；依使用者 2026-09-11 指示落於此處——承 WP-62／63／64 先例，見下方 §3。 |
| **WP-63** | [`wp-63-micro-flick-v8-measurement-foundation/`](wp-63-micro-flick-v8-measurement-foundation/README.md) | `micro_flick_three_target_test_v8`（三顆同時存活）的量測基礎層：per-target 窗界原語 + 四層**事件錨定**指標 + 零散布武器宣告 + [KI-035](../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) 修復 | T-exit | WP-56 T-exit ✅ · WP-60 T-exit ✅（`?rawMouse=1` 可用）；與 WP-61／62 無相依、可並行 | 12–16.5 | ⬜ **未開工（2026-09-10 規劃完成）**。決策草稿 [GD-39](../../DECISIONS.md)（T-exit 入帳）。⚠️ **主題部分不屬本 stage**：KI-035 與 rawMouse 採集紀律屬原始輸入取樣，v8 窗界與指標族更接近 [stage14 草案](../stage14/README.md)；依使用者 2026-09-10 指示落於此處——見下方 §3。 |
| **WP-64** | [`wp-64-tracking-pilot-session-plan-drills/`](wp-64-tracking-pilot-session-plan-drills/README.md) | 兩個 curated Tracking Pilot config 可由 custom Session Plan 排程、固定武器／場景並保有 ad hoc 稽核 | T-exit | WP-54 + WP-62；與 WP-60／61／63／65 無相依 | 4.5–6 | ✅ **T-exit 交付 2026-09-11**。A-64.1～A-64.9 全綠；typecheck ×2、build、Vitest 3014 passed、完整 Edge 21 passed（14.3m）。formal manifest／history 隔離不變；決策 [GD-40](../../DECISIONS.md)。⚠️ **主題不屬本 stage**，依使用者指示寄放，見下方 §3。 |

**為什麼切成兩個 WP**：WP-60 只負責「把資料取回來並證明它夠用」，不宣稱任何偵測準確度。LOD 判準的參數必須以**真人標註資料**重新推導（PA 的參數在 px/s 空間、且其 ADR 自承 F1 從未對標註資料量測過），而那批資料目前不存在 —— 見 §4。把兩者綁在同一個 WP 會讓一個純工程可驗收的切片，卡在一個等資料的研究問題上。

---

## 3. 編號分配

- **WP-60** 由本 stage 取用。stage12 已用到 WP-59（平行 session 的 micro flick v8 替補間距），依 GD-15「先採納先得」本 stage 自 WP-60 起算。
- ~~本 stage 預計新增 **GD-35**（原始輸入取樣的匯出邊界與 C-D4 歸屬）…現行最高為 GD-34。~~
  **更正（2026-09-09，WP-60 T-exit）**：規劃期預留的 `GD-35` **已被平行 session 的 WP-58 T0 取用**（stage12，同日入帳）。
  依 GD-15「先採納先得」不與之爭號 ⇒ 本 stage 實際入帳為 **[GD-36](../../DECISIONS.md)**（原始輸入取樣的匯出邊界與 C-D4 歸屬），
  於 **T-exit** 拍板（非 T1 —— T1 當時只凍結 contract，構念邊界要等 T3 的中性語彙與 R2 的負面結論都到位才有東西可入帳）。
  入帳時 `DECISIONS.md` 現行最高為 GD-35。
- **WP-62 / GD-38（2026-09-10）**：規劃時 `DECISIONS.md` 最高為 GD-37、全 repo 最高為 WP-61，故取用 **WP-62 / GD-38**。依 GD-35 ② 紀律，此二號在該 WP 的 T0 執行時**仍須重查**；被平行 session 取用則依 GD-15 順延。
  **落點偏離（明帳）**：WP-62 的主題是 session 排程層（WP-58 的延伸），**不屬本 stage 的「原始輸入取樣與抬滑鼠判準驗證」主題**；依使用者 2026-09-10 指示落於 `active/stage13/`。記於此以免後續讀者誤判為歸檔錯誤，決策同步入 [GD-38](../../DECISIONS.md) ①。
  ⇒ 本 stage 的 §1 敘事、§4 相依圖與「為什麼切成兩個 WP」**皆不涵蓋 WP-62**；它與 WP-60／61 無相依、可完全並行。
- **WP-63 / GD-39 / KI-035（2026-09-10）**：規劃寫入當下 `exec-plan/README.md §2` 最大 WP 為 **WP-62**、`DECISIONS.md` 最大 GD 為 **GD-38**、`docs/known_issue/` 最大 KI 為 **KI-034**，故取用 **WP-63 / GD-39 / KI-035**。依 GD-35 ② 紀律，三號在該 WP 的 T0 執行時**仍須重查**；被平行 session 取用則依 [GD-15](../../DECISIONS.md)「先採納先得」順延。
  **GD-39 本體（①②④⑤）於 T-exit 入帳**（非規劃期）——理由見該 WP [progress.md](wp-63-micro-flick-v8-measurement-foundation/progress.md) D-63-P6；規劃期只留草稿。
  **例外:③ 已提前單獨落帳（2026-09-10）** —— GD-38 ②(b) 的機制前提有誤（`TargetManager.spawn()` 每次生成目標都補滿彈匣），更正直接寫入 [GD-38](../../DECISIONS.md) ② 的 inline 更正段，比照該條既有的 `T0 對帳修正` 慣例。提前的理由是 [WP-62](wp-62-session-plan-per-item-weapon/README.md) T4 正在建立武器選單文案且已迫近，等到 WP-63 T-exit 會讓誤導文案先出貨。
  **落點偏離（明帳）**：WP-63 一半屬本 stage 主題（[KI-035](../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) 是 `dYaw`/`dPitch` 原始輸入積分流的效度缺口、`?rawMouse=1` 採集紀律承 WP-60），另一半（v8 窗界與指標族）主題上更接近 [stage14 草案](../stage14/README.md)；依使用者 2026-09-10 指示落於此處，承 WP-62 同一先例。
  ⇒ 本 stage 的 §1 敘事與 §4 相依圖**亦不涵蓋 WP-63**；它與 WP-61／62 無相依、可完全並行。
  ⇒ 連帶影響：[stage14 §3](../stage14/README.md) 的三個候選編號（已因 GD-38 ① 從 WP-62/63/64 順延為 WP-63/64/65）**再順延為 WP-64/65/66**。
- **WP-64 / GD-40（2026-09-11，T-exit）**：T0 重查確認 `WP-64` 與 `GD-40` 未被採納項目取用；本 WP 把兩個明確策展的 Tracking Pilot config 開放給 custom Session Plan，仍固定為 practice-only / primary-seed-only 的 ad hoc 路徑。**落點偏離（明帳）**：這是 Session Plan／研究工具層，不屬本 stage 的原始輸入取樣主題；依使用者指示落於此處，承 WP-62／63 先例。決策已入 [GD-40](../../DECISIONS.md)。
  ⇒ 本 stage 的 §1 敘事與 §4 相依圖不涵蓋 WP-64；它與 WP-60／61／63／65 無相依、可並行。
  ⇒ 連帶影響：[stage14 §3](../stage14/README.md) 的三個候選編號再順延為 **WP-65/66/67**；後續 WP-65 規劃又將其順延為 WP-66/67/68。
- **WP-65 / GD-41（2026-09-11，規劃期候選）**：寫入當下 `exec-plan/README.md §2` 最大 WP 為 **WP-63**、`active/stage13/` 實際最大為 **WP-64**（[wp-64](wp-64-tracking-pilot-session-plan-drills/README.md) 已落 code，尚未入 §2 索引）、`DECISIONS.md` 最大 GD 為 **GD-39**、**GD-40 已由 WP-64 於其 T0 佔用**（尚未落帳），故取用 **WP-65 / GD-41**。依 [GD-35](../../DECISIONS.md) ② 紀律，二號在該 WP 的 **T0 執行時仍須重查**；被平行 session 取用則依 [GD-15](../../DECISIONS.md)「先採納先得」順延，不爭號。
  **GD-41 本體於 T-exit 入帳**（規劃期只留草稿 D-65-1～D-65-5），承 WP-63 D-63-P6 先例。
  **落點偏離（明帳）**：WP-65 的主題是 drill 生命週期與受試者開場體驗（待命閘／倒數呈現／Pointer Lock 效度），**不屬本 stage 的「原始輸入取樣與抬滑鼠判準驗證」主題**；依使用者 2026-09-11 指示落於 `active/stage13/`，承 WP-62／63／64 同一先例。
  ⇒ 本 stage 的 §1 敘事與 §4 相依圖**不涵蓋 WP-65**；它與 WP-60～64 全數無相依、可完全並行。
  ⇒ 連帶影響：[stage14 §3](../stage14/README.md) 的三個候選編號**再順延為 WP-66/67/68**。

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
