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

`performance_analysis` 專案的 LOD（Lift-Off Detection）管線用的是完全不同的訊號：**1000 Hz 滑鼠的硬體斷流**（`dt > 30 ms` 的真實時間間隙）。那是對「感測器離地」的直接觀測，不是從運動推論。而它的 ADR-002 記載，v1 單遍點對點偵測的兩個系統性偽陽正是 **「目標捕獲時的急停」** 與 **「目標中心附近的生理性顫抖」** —— 與 FPS 這邊實測到的偽陽是同一個。

**本 stage 的目標：把那個訊號取回來。** 原料已經在收（[`InputSampler.ts:137-139`](../../../../src/input/InputSampler.ts#L137-L139) 的 `getCoalescedEvents()` 逐筆帶 `event.timeStamp`），但在 [`SimLoop.ts:96-99`](../../../../src/loop/SimLoop.ts#L96-L99) 被聚合成逐 tick 值之後就丟掉了。

---

## 2. WP 清單

| WP | 資料夾 | 一句話 | Exit gate | 相依 | 估時（d） | 狀態 |
|---|---|---|---|---|---|---|
| **WP-60** | [`wp-60-raw-mouse-sample-capture/`](wp-60-raw-mouse-sample-capture/README.md) | 原始滑鼠取樣匯出 schema + 擷取路徑 + 時間間隙原語；證明資料足以支撐 LOD 移植 | T-exit | 無（WP-57 已交付，只讀不改）| 5.5–9.5 | ⬜ 規劃完成 2026-09-08，T0 未開始 |
| **WP-61**（未規劃）| — | LOD 判準完整移植（Stage 2 Kinematic Spike／Stage 3 Hover Jitter）+ 以真人標註 cohort 校準 | — | WP-60 T-exit ✅ + 高刷真人 cohort | — | ⬜ 待 WP-60 T0 的充分性稽核結論才規劃 |

**為什麼切成兩個 WP**：WP-60 只負責「把資料取回來並證明它夠用」，不宣稱任何偵測準確度。LOD 判準的參數必須以**真人標註資料**重新推導（PA 的參數在 px/s 空間、且其 ADR 自承 F1 從未對標註資料量測過），而那批資料目前不存在 —— 見 §4。把兩者綁在同一個 WP 會讓一個純工程可驗收的切片，卡在一個等資料的研究問題上。

---

## 3. 編號分配

- **WP-60** 由本 stage 取用。stage12 已用到 WP-59（平行 session 的 micro flick v8 替補間距），依 GD-15「先採納先得」本 stage 自 WP-60 起算。
- 本 stage 預計新增 **GD-35**（原始輸入取樣的匯出邊界與 C-D4 歸屬），於 WP-60 T1 拍板時入帳 [`DECISIONS.md`](../../DECISIONS.md)。現行最高為 GD-34。

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

- **[KI-031](../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) 與本 stage 正交但相關**：KI-031 是 detection 判準在低 aim 更新率下失效；本 stage 是輸入取樣粒度不足。兩者都在 ≥ 144 Hz 機器上緩解，但**修法不同、不得混為一談**。WP-60 不修 KI-031。
- **真人資料缺口**：WP-57 §T5-real 的四份匯出依 D-57.T5-8 **不進 repo**，且錄製於 60 Hz 機器。WP-60 的 T0 充分性稽核因此**不能**用它們，必須以合成訊號 + 實機 PoC 進行。

---

## 5. 執行規則

沿用 [`CLAUDE.md §3`](../../../../CLAUDE.md) 與 [`exec-plan/README.md §5`](../../README.md)：一 task = 一垂直切片 = 一原子 commit；T0 未過不開 T1；每個 task 完成同步該 WP 的 `progress.md` 與 `task-checklist.md`。
