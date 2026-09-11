# WP-63 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## 最新狀態（2026-09-10 規劃完成）

⬜ **未開工**。本檔目前只含規劃期的決策與待驗證項；T0 開工後每個 task 完成時追加。

規劃來源：2026-09-10 的設計對話（使用者指定四項計算 → 逐項稽核蒐集層 → 依 `.claude/skills/engineering-planning/SKILL.md` 落成執行計畫）。

---

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry gate | ⬜ 未開工 | — | — | — |
| T1 零散布武器宣告 | ⬜ 未開工 | — | — | — |
| T2 Mouse gain 修復 | ⬜ 未開工 | — | — | — |
| T3 窗界 primitive | ⬜ 未開工 | — | — | — |
| T4 L0 + L3 | ⬜ 未開工 | — | — | — |
| T5 L1 幾何層 | ⬜ 未開工 | — | — | — |
| T6 L2 + 方向 | ⬜ 未開工 | — | — | — |
| T7 Harness + 紀律 | ⬜ 未開工 | — | — | — |
| T-exit | ⬜ 未開工 | — | — | — |

---

## Decision Log（規劃期）

### D-63-P1 — 四項計算的蒐集層逐項判定（2026-09-10，使用者指定）

使用者指定四項計算，逐項稽核匯出與蒐集路徑後的結論：

| # | 計算 | 蒐集層 | 處置 |
|---|---|---|---|
| 1 | 擊殺後 → 下一個最近目標的距離 | ✅ 足夠 | `nearest-2` 與 `nearest-3` **都算**（使用者決定）；差值 = replacement 注意力搶奪量。FR-63.4 |
| 2 | 準心移動方向 → 預測意圖目標 | ✅ 足夠 | 用 `ticks[].dYaw`/`dPitch`（真 128 Hz），輸出逐窗長 `W` 的預測準確率曲線。FR-63.11 |
| 3 | 找尋下一個目標的時間窗口 | ❌ **原理不足** | **放棄**（使用者決定）。降級宣稱為 `post-kill-onset-latency`；且因 D-63-P2 連該量也不在本 WP 範圍 |
| 4 | 首發失手 → 微調到擊殺的時間 | ✅ 足夠 | 三個陷阱各有對策：無 `hit` 事件、`targetId` 錯、170 ms cadence 地板。FR-63.9 |

第 3 項不可行的理由（記錄以免後續重提）：視覺搜尋與決策不可觀測，**且可能發生在擊殺之前** —— v8 三顆全程可見、無 pop-in、無 cue，玩家可在打當前目標時就看好下一顆。`t_kill → t_move` 在「已預先規劃」與「未預先規劃」兩種情況下語意完全不同，而資料無法分辨。這不是閾值問題，是訊號裡沒有那個資訊（與 WP-57 抬滑鼠偵測同一類）。

### D-63-P2 — 放棄第 3 項後，整個 WP 不需要任何 movement-onset 判準（2026-09-10）

原設計對話曾討論 onset 判準（ω 門檻 + 持續毫秒 vs 滑動窗累積位移），使用者選了「ω 門檻 + 持續毫秒」。**放棄第 3 項之後這個選擇變成非必要**：

- CONTEXT.md §48 已把「瞄準移動 onset」定為既有構念 `t_detect` ⇒ 任何 v8 側的第二個判準直接踩 **C-D4**
- `t_detect` 在 v8 上另有兩個結構性障礙：[KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)（`aim` 更新率 = 顯示率）與 [KI-034](../../../../known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md)（v8 的基線窗 100% 被上一次拉槍污染）
- 而 ①②④ 與免閾值描述子**全部可以錨在事件上**（`fire.viewYaw`/`viewPitch` 是精確已知的，不需要偵測）

⇒ 換構念而非換判準。詳見 [README §2.2](README.md)。**替代方案（被否決）**：在 v8 側自訂 ω 門檻 —— 否決理由為 C-D4；先修 KI-031/034 再用 canonical `t_detect` —— 否決理由為那是兩個獨立的 bugfix WP，不該藏在指標定義 WP 裡。

### D-63-P3 — v8 改用 `usp_s_laser`（2026-09-10，使用者拍板）

使用者指定「預設使用 `usp_s_laser`」。稽核 [`weapons.ts:82`](../../../../../src/weapon/weapons.ts) 確認三項條件成立：`recoil` 全 0、`inaccuracy` 四項全 0、無 `ads` 區塊（右鍵自動失效）。

**副作用（明帳）**：`cycletimeSec: 0.17`（ak47 為 0.10）⇒ 最小發間隔 170 ms，補槍時間懲罰是 ak47 的 1.7 倍。這是 FR-63.9 要把 `correctionMs` 拆成 `settlingMs` + `cadenceWaitMs` 的直接理由。

**替代方案（被否決）**：保留 ak47 把散布/punch 當 covariate —— 否決理由為補槍（第 2、3 發）的誤差幾乎不可解釋，且 C-D3 信度閘會更難過；新開 v9 cued 變體 —— 否決理由為工作量最大且不是使用者要的任務。

### D-63-P4 — GD-38 ②(b) 的機制前提有誤，須入帳更正（2026-09-10）

[GD-38](../../../DECISIONS.md) ②(b) 寫「`state.weapon.ammo` 只在 `createSimLoop()` 設一次，全 repo **無 reload 路徑**」。

**實況**：[`TargetManager.ts:585`](../../../../../src/sim/TargetManager.ts) 的 `spawn()` 每次都執行 `state.weapon.ammo = state.weapon.magSize`，`spawn()` 有 3 個呼叫點（`TargetManager.ts:617, 644, 647`），涵蓋 legacy 與 population 兩條路徑 ⇒ **每次目標生成都補滿彈匣**。

GD-38 ②(b) 描述的「`magSize 12` × `cycletime 0.17` = 2.04 秒後靜默停火」只在**整段期間零 spawn** 時成立，在任何 spawn-driven drill 上都不成立。

同時 GD-38 ②(a)（counter-strafe 因果通道消失）對 v8 **不適用**：v8 是 `translation: 'locked'` ⇒ `speedRatio` 恆 0 ⇒ `inaccuracy.move` 從不參與。

⚠️ **這不推翻 GD-38 ②「不做全域 pin」的結論** —— 該結論仍成立；更正的是它引用的機制事實與適用範圍。列為 GD-39 ③ 於 T-exit 入帳。

> **⚠️ 跨 WP 影響**：GD-38 ⑥ 的 UI 文案「無 reload：彈匣打完該輪即停火」依同一機制事實為**誤導**。WP-62 T4 開工前應覆核該文案；本 WP 不代改他人 WP 的交付物，僅具名記錄。

**✅ 已提前落帳（2026-09-10）**：本條的更正已直接寫入 [`DECISIONS.md`](../../../DECISIONS.md) 的 **GD-38 ② inline 更正段**（比照該條既有的 `T0 對帳修正` 慣例），未等到本 WP 的 T-exit。理由見下方 D-63-P6 的修訂。

### D-63-P5 — 落點與編號（2026-09-10）

- **落點 = `active/stage13/`，依使用者 2026-09-10 指示**。主題部分相符（KI-035 與 rawMouse 採集紀律屬 stage13；v8 窗界與指標族更接近 stage14 草案）。承 [WP-62](../wp-62-session-plan-per-item-weapon/README.md) 的同一先例，明帳記錄。
- **編號**：規劃寫入當下 `exec-plan/README.md §2` 最大 WP 為 **WP-62**、`DECISIONS.md` 最大 GD 為 **GD-38**、`docs/known_issue/` 最大 KI 為 **KI-034** ⇒ 取用 **WP-63 / GD-39 / KI-035**。
- 依 [GD-35](../../../DECISIONS.md) ② 紀律，三個號在 T0 執行時**仍須重查**；被平行 session 取用則依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，不爭號。
- [stage14 草案](../../stage14/README.md) §3 的候選編號（GD-38 ① 已將其從 WP-62/63/64 順延為 WP-63/64/65）因本 WP 取用 WP-63 **再順延為 WP-64/65/66**。

### D-63-P6 — GD-39 於 T-exit 入帳，不在規劃期寫入（2026-09-10）

GD-37 於 T0 入帳、GD-38 於規劃期入帳、GD-36 於 T-exit 入帳 —— 三種時機都有先例。本 WP 選 **T-exit**，理由是 GD-39 需要 T0 親自複核機制事實後才有把握，且編號重查紀律要求越晚寫越不容易撞號。

**修訂（2026-09-10）——③ 拆出來提前落帳。** 原規劃把 ③（D-63-P4 的機制更正）一併留到 T-exit，代價是「在 T-exit 之前，平行 session 讀 GD-38 ②(b) 仍會被誤導」。重新評估後認定這個代價**不可接受**：

- [WP-62](../wp-62-session-plan-per-item-weapon/README.md) 的 **T4 正是建立武器選單文案的 task**，而 GD-38 ⑥ 的「無 reload」文案依同一錯誤事實而來
- WP-62 T2 完成於 **2026-09-10**（同日），T3/T4 迫近；本 WP T-exit 在 12–16.5 dev-days 之後
- ⇒ 等 T-exit 會讓誤導文案先出貨

⇒ ③ 已直接寫入 [`DECISIONS.md`](../../../DECISIONS.md) 的 **GD-38 ② inline 更正段**（比照該條既有的 `T0 對帳修正` 慣例：更正寫在被更正的那一格，平行 session 讀 GD-38 時一定看得到，而不是要求他們去讀另一條 GD）。

**GD-39 本體（①②④⑤）仍於 T-exit 入帳**，其 ③ 處只指回 GD-38 的更正段，**不重複入帳**。

⚠️ 這是本 WP **唯一**在規劃期就落地的帳本異動；除此之外 `DECISIONS.md` 不應有本 WP 的其他改動。

---

## Surprises & Discoveries（規劃期）

1. **v8 整場 0 個 `hit` 事件**。[`SimLoop.ts:354`](../../../../../src/loop/SimLoop.ts) 的 `hit` 事件只在 projectile 分支發射；v8（ak47 與 usp_s_laser 皆無 `bullet`）為純 hitscan。⇒ [micro-flick 設計文件](../../../../algorithm/micro-flick/README.md) 與 [`compute.ts`](../../../../../src/metrics/compute.ts) 裡所有 `t_hit` 公式在 v8 上會拿到**空陣列**且靜默回傳 0 樣本。

2. **`ticks[].aim` 與 `ticks[].dYaw`/`dPitch` 是兩條不同的資料路徑**。[`SimLoop.ts:103`](../../../../../src/loop/SimLoop.ts) 的 mouse 分支註明「**只寫 recorder，不寫 state**」⇒ `aim` 由 render thread 寫（更新率 = 顯示率，這正是 KI-031 的根因），而 `dYaw`/`dPitch` 依事件自身 `timeStamp` 分桶進 tick 窗 ⇒ **真 128 Hz，與顯示率無關**。方向預測因此建立在後者。

3. **[KI-035](../../../../known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md)：`main.ts:712-713` 的註解宣稱的不變式不成立**。`onSensitivityChange`/`onFovChange` 不呼叫 `configureMouseIntegration()`，而匯出時的 `meta.mouseIntegration` 用當下設定重算 ⇒ 「載入 drill 後才調感度」會讓兩者發散且離線不可察覺。

4. **GD-38 ②(b) 的前提有誤**（見 D-63-P4）。

5. **`SEG_V2_PARAMS` 的 `sgWindow` 單位是樣本數，不是時間**。@128 Hz 是約 78 ms 跨度，比 v8 的微調事件（30–80 ms）還長；`peakFloorDegPerSec: 60` 會讓 1°/50 ms 的修正（minimum-jerk 峰值約 38 deg/s）判 `below_floor` ⇒ `correction-free-rate` 系統性高估，且偏誤方向對玩家有利。⇒ 本 WP 走免閾值路線（T6）。

6. **v8 的 Fitts ID 跨度只有約 2 bits**（`D` 2.6–17°、`W` 2.483°@25u ⇒ ID 約 1.0–3.0）。⇒ throughput 只能作 covariate，不交付。

---

## Open Questions

| OQ | 問題 | 預設假設 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-63.1** | 既有 v8 匯出是否屬於已凍結的研究 cohort？ | 否 ⇒ T1 直接改 fixture | 研究者 | T1 開工前 |
| **OQ-63.2** | `selectionCostRatio` 貪婪基準線的起點？ | 被殺目標中心（非擊殺瞬間瞄準點） | 研究者 | T4 開工前 |
| **OQ-63.3** | `?rawMouse=1` 是否為 v8 的強制採集條件？ | 否，但預設開啟；不進本 WP 任何指標定義 | 研究者 | T7 開工前 |
| **OQ-63.4** | KI-035 修法取 (a)、(b) 或併行？ | (a)+(b) 併行 | 實作者 | T2 開工時 |
| ~~OQ-63.5~~ | ~~GD-39 ③（GD-38 ②(b) 更正）是否提前單獨入帳？~~ | ✅ **已關閉（2026-09-10）：是**，已寫入 GD-38 ② inline 更正段。理由見 D-63-P6 修訂 | — | — |

---

## 交接清單（T-exit 時填寫）

- [ ] 真人 pilot 最小規格（[README §5](README.md) 的六項非真人不可）
- [ ] `?rawMouse=1` cohort 取得後，量免閾值描述子漏檢率的方法
- [ ] KI-031／KI-034 修復後，補 `movementTimeMs`／`peakOmega` 的路徑
