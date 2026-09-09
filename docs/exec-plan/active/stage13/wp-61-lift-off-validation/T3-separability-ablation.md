# WP-61 T3 — 可分性消融（Separability Ablation）

## Objective

在 T2 的標註事件表上，逐層量測「加了什麼資訊之後，lift 與 pause／正常急停變得多可分」，並依 T0 凍結的決策規則產出**二元判定**：進 T4，或走 FR-61.8 的負面結論。

> ⚠️ **這個 task 最可能的結果是「分不開」**（R3）。DoD 對「通過」與「不通過」給**同樣客觀**的驗收條件 —— 一份寫得清楚的負面結論，價值等於一個判準。

## Inputs to read

- [progress.md](progress.md) §Pre-registration（T0 凍結的容差、分割、指標、門檻、決策規則）與 §T2（候選事件表、資料充分性判定）。
- [README.md](README.md) §1.4（分離訊號若存在必在**邊界**的物理論證）、§2.3（`GapBoundaryKinematics` 契約）、§2.6 F4／F5。
- [WP-60 progress §PA LOD v3 parameter source copy](../wp-60-raw-mouse-sample-capture/progress.md)（十四參數 + 空間標註）。
- `performance_analysis` `docs/architecture/adr/002_lod_v3_design.md`：Stage 2（Kinematic Spike Trimming）與 Stage 3（Hover Jitter Rejection）的**原始定義**與其自承的兩個系統性偽陽。

## Steps

1. **凍結檢核**：開工第一件事是把 §Pre-registration 的數字**原文抄一份**進本 task 的紀錄，並確認自 T0 起未被改過（`git log -p` 佐證）。凍結值被改過即為協定違規，必須先入帳。
2. **Layer 1 — gap-only baseline**：只用空洞本身（`durationMs` + θ）分類。對每個 θ ∈ {18, 30, 50} 出混淆矩陣。**這是必須被超越的對照組** —— D-60.R2-1 已預告它會很差，但沒有它就無從宣稱後面幾層有增益。
3. **Layer 2 — + 邊界運動學**：實作 `research/src/lift/algorithms/` 的邊界特徵（對應 README §2.3 的 `GapBoundaryKinematics`：`speedBefore/After`、`accelEnter/Exit`、`densityBefore/After`、`tinyFractionBefore/After`、`nBefore/nAfter`）。窗長 `windowMs` 作為一個明列的掃描維度，值域與步長在本 step 開始前寫定。
4. **Layer 3 — + Stage 2 類比（Kinematic Spike Trimming）**：把 PA 的 `ACCEL_UP_THRESHOLD_PX_S2`／`ACCEL_DOWN_RATIO`／`START_SPEED_GATE_PX_S` 換算到 **counts 空間**（本專案 `unadjustedMovement: true`，`dx`／`dy` 為原始 counts）。每個常數必須記名來源檔 + 版本 + **換算依據**；**未經換算的 PA 常數不得出現在程式碼裡**（F5）。
5. **Layer 4 — + Stage 3 類比（Hover Jitter Rejection）**：同上，換算 `HOVER_WINDOW_MS`／`HOVER_VELOCITY_THRESHOLD_PX_S`／`HOVER_VARIANCE_THRESHOLD`／`DEADZONE_COUNTS`／`MIN_STROKE_POINTS`。特別註記：R2 已顯示本硬體上 pause 期間的微顫**低於感測器閾值**（§1.4），故 Stage 3 的物理前提在此**可能不成立** —— 若量到的 `tinyFraction` 兩組皆為 0，這件事本身就是結論的一部分，要寫出來。
6. **消融紀律**：只准**往上加**，不准回頭調前一層的參數。每一層的輸出必須包含：混淆矩陣、precision／recall／F1、pause 組誤報率、oneshot 組誤報率、**以及相對前一層的增益**。
7. **分割執行**：依 T0 凍結的規則做 session 隔離。**校準集**上做參數選擇；**held-out 只看一次**，且必須在校準集的參數凍結之後。兩組數字都要報（差距大即為過擬合證據，F4）。
8. **可重現性**：任何隨機性（bootstrap CI、重採樣）注入 seed 並寫入報表；同 seed 重跑必須產出逐位相同的報表（NFR-61.5）。記錄全量評估的實際耗時。
9. **繪圖與 I/O 分層**：分布圖、ROC／PR 曲線一律落 `notebooks/`；`algorithms/` 保持純函式（C-D2）。
10. **依 T0 決策規則產出二元判定**，寫進 `progress.md`：`promote`（進 T4）／`not-separable`（走 FR-61.8）／`insufficient-evidence`。**不得**在此改門檻。若真的發現契約本身有缺陷（例如容差在物理上不可能滿足），處置是**入帳具名決策 + 重新 pre-register 一輪**，不是就地調數字。

## Invariants

- Python 側**不重算 Stage 1 切段** —— 只讀 T2 產的 committed golden（F7）。
- `algorithms/` 禁 matplotlib／print／file I/O；不 import 任何 TS（C-D1／C-D2）。
- 特徵與中間量一律**中性命名**；本層不引入 T0 拍板之外的構念詞。
- held-out 在本 task 內**只被評估一次**；重評必須是一次具名的、記錄在案的重新 pre-registration。
- 任何 PA 參數的使用都帶「來源檔 + 版本 + 空間 + 換算依據」四項註記（FR-61.10）。

## Definition of Done（可驗證證據）

- [ ] §Pre-registration 的凍結值已原文覆核，且 `git log -p` 證明自 T0 起未變更（指令 + 輸出記入 `progress.md`）。
- [ ] **四層 × 每個 θ** 各有一組完整結果：混淆矩陣（TP／FP／FN／TN 四個實際整數）、precision／recall／F1、pause 誤報率、oneshot 誤報率、相對前一層的增益。缺一格即未完成。
- [ ] **校準集與 held-out 兩組數字都已報告**；兩者差距已明文評述（不得只報好的那一組）。
- [ ] Stage 2／3 的每個 PA 參數有「來源檔 + 版本 + 原空間 + 換算後值 + 換算依據」五欄表；一支測試斷言程式碼內**不存在**未換算的 PA 常數字面值（掃描指令 + exit code）。
- [ ] `uv run pytest` exit 0；C-D1／C-D2 掃描測試綠（零 TS import、`algorithms/` 零 I/O）。
- [ ] **可重現性**：同 seed 連跑兩次，報表檔的雜湊逐位相同（兩個雜湊值記入 `progress.md`）。
- [ ] 全量評估耗時已記錄。
- [ ] **二元判定已產出**（`promote` ／ `not-separable` ／ `insufficient-evidence`），且其依據是 T0 凍結的決策規則**字面條件**，附「規則原文 → 實際值 → 判定」三欄對照。
- [ ] 若判定為 `not-separable`：**漏報與誤報的具名成因**已寫出（不是「特徵不夠好」，而是哪一類事件在哪一層被錯分、其邊界運動學長什麼樣）。
- [ ] 若 Stage 3 的物理前提在本硬體上不成立（`tinyFraction` 兩組皆 0）：該事實已明文列為結論的一部分。
- [ ] `npm run typecheck` ×2、全量 Vitest、`vite build` 皆 exit 0（本 task 不動 `src/`，故三者應與 T2 基線逐位相同 —— 差額即為異常，需歸因）。

## Commit

```text
feat(research): ablate lift-off separability on annotated gaps
```
