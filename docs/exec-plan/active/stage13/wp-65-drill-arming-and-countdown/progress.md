# WP-65 — Progress

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md) · 決策 GD-41（草稿，T-exit 落帳）
>
> 每個 task 完成時追加一段（Progress / Decision Log / Surprises / Open Questions），與該切片一起 stage（協議 §3.4）。

---

## §0 規劃（2026-09-11）

**狀態**：📋 規劃完成，未開工。

計畫由 `engineering-planning` skill 產出，落點依使用者 2026-09-11 指示為 `active/stage13/`（主題不符的說明見 [README 落點說明](README.md)）。需求由使用者口述、經 `brainstorming` skill 對齊後定案。

### 規劃期發現（已寫入 README §0，此處只記推翻了什麼）

1. **需求被描述成「加上 3 秒倒數」，稽核後發現倒數早就存在，錯的是起算時機。**
   [`DrillPhase`](../../../../../src/drill/DrillRunner.ts#L27) 已有 `'countdown'`，roster 內每個 drill 的 `timing.countdownMs` 都是 `3000`。真正的缺口是兩個：
   (a) `drillRunner.start()` 在模組求值階段就被呼叫（[main.ts:1036](../../../../../src/main.ts#L1036)），而 `countdown` 自第一個 sim tick 起算 ⇒ 受試者還在看「點擊以鎖定」提示時 3 秒已走完；
   (b) 倒數**完全沒有畫面呈現**（HUD 只有四張卡）。
   ⇒ 本 WP 因此**不新增任何時間常數**，只改「何時起算」與「怎麼呈現」。原本可能寫成「新增倒數功能」的方案被推翻。

2. **「所有 drill 都倒數計時」的原始需求，在 roster 上不成立。**
   `endCondition` 兩型並存：`timeLimit`（`spider_shot_v2`／`v3` = 60 s、tracking pilot 家族）有總時長；`targetCount`（counterstrafe／detection／tracking_v1／peek-click-transfer／micro-flick，**佔 roster 大多數**）沒有。後者唯一的時間上限是 `timing.timeLimitMs = 120 000` 的後援閘，實際多在 20–40 秒結束 ⇒ 顯示「還剩 118 秒」會誤導。
   使用者 2026-09-11 據此拍板：**只有 `timeLimit` 型倒數，`targetCount` 型維持正計時**。「全部統一倒數」與「targetCount 改顯示剩餘目標數」兩個候選均被放棄。

3. **「ESC 退出全螢幕 → 標記資料有問題」的機制已存在，但在使用者描述的情境下不會觸發。**
   [main.ts:576-584](../../../../../src/main.ts#L576-L584) → [`experimentSession.handleFullscreenChange()`](../../../../../src/display/experimentSession.ts#L61) 已在 `countdown`/`running` 期間翻 `suspect`（KI-007 / WP-20 T2）。兩個缺口：
   - **G1**：`handleFullscreenChange` 首行 `if (!active …) return`，而 `active` 只由 eligibility gate 通過後的 `enter()` 設 true ⇒ 選手測試／研究員模式的一般 drill **完全不會被標記**。
   - **G2**：Chromium 在「同時 pointer-locked + fullscreen」時，單次 ESC 只解除 Pointer Lock、全螢幕保留（需長按才退）⇒ 使用者說的「按到 ESC」實機上多半只掉 lock，`fullscreenchange` 根本不派發。
   ⇒ 判準必須改掛 **Pointer Lock 遺失**，且不得以 `experimentSession.active` 為前提。原本可能寫成「沿用既有 fullscreen 機制即可」的方案被推翻。

4. **`recorder` 不看相位。** `simStep` 末端的 `recorder?.recordTickFromState()`（[SimLoop.ts:766](../../../../../src/loop/SimLoop.ts#L766)）每 tick 無條件記錄 ⇒ 待命期會持續吃 arena。容量 `300 × (128+10) + 128 = 41 528` ⇒ 約 324 秒後 `recorderOverflow` 翻 true 並污染 `meta.suspect`。這是 FM-2 與 D-65-5 存在的理由；若沒稽核到，功能會在「受試者去倒個水」時靜默壞掉。

5. **e2e 不需要新的 dev-only 旁路。** [raw-mouse-sampling.spec.ts:60-73](../../../../../tests/e2e/raw-mouse-sampling.spec.ts#L60-L73) 已證明可用「改寫 `pointerLockElement` getter + 派發真實 `pointerlockchange`」走**生產** `PointerLock` 模組驅動取鎖。原本預留的 `?autoArm=1` dev 縫因此降為 FM-4 的**後備方案**，只在 T6 spike 失敗時才啟用。

6. **`InputSampler` 不需要新增開火閘。** 取鎖那一下的 `mousedown` 發生在 `locked === false` 時，既有的 `createInputSampler(sharedState, () => pointerLock.locked)`（[main.ts:989](../../../../../src/main.ts#L989)）本來就會丟棄它 ⇒ FR-65.5 由 D-65-1 的設計選擇**天然滿足**。這是選擇「取鎖 = arm」而非「持鎖時另認一次 mousedown」的主要理由。

### 使用者拍板事項（2026-09-11）

| # | 問題 | 決定 |
|---|---|---|
| 1 | `targetCount` drill 的 Time 卡顯示什麼 | 只有 `timeLimit` drill 倒數，其餘維持正計時 |
| 2 | 錄製中掉 Pointer Lock 怎麼處理 | 退出（全螢幕／鎖定）、**本場資料註記有問題**、建議重新測試；**drill 繼續跑到自然結束**，不中斷、不作廢 |
| 3 | Session Plan 等自動連續流程 | **每個 block 都要點左鍵**（規則只有一條，不分手動／自動路徑） |

### 凍結決策（草稿，GD-41 於 T-exit 落帳）

- **D-65-1** 解除待命的訊號 = 取得 Pointer Lock；`start()` 時若仍持鎖則先 `exitPointerLock()`。統一「未持鎖」與「連續 session 仍持鎖」兩情境為單一規則，並順帶滿足 FR-65.5。
- **D-65-2** 待命閘是 `createDrillRunner()` 的 opt-in option，不是 `SharedState` 預設值翻轉。35 個 caller 中只有 `main.ts` 需要新行為；opt-in 讓其餘 34 個零修改。被推翻的替代：`armRequested` 預設 true —— `resetAll()` 會在 `start()` 內重設它，語意自相矛盾。
- **D-65-3** `meta.validity.pointerLockLost` 採 optional-in / required-out。既有四旗標皆 required，第五欄若也 required 會讓所有既存 golden／fixture payload 整份被拒（WP-61 踩過同型的坑）。
- **D-65-4** Pointer Lock 掉鎖與 fullscreen 退出是**兩個並存構念**，不合併、不取代（C-D4：既有構念不得有第二定義）。前者管「輸入是否進得來」，後者管「顯示條件是否成立」。
- **D-65-5** 解除待命當下呼叫 `recorder.reset()`，而非在 `simStep` 對相位加閘——後者會改變 `countdown` 期間的既有錄製行為，讓所有既有匯出逐位改變。

### 編號

候選 **WP-65 / GD-41**。寫入當下：`exec-plan/README.md §2` 最大 WP = WP-63；`active/stage13/` 實際最大 = WP-64（已落 code、尚未入 §2 索引）；`DECISIONS.md` 最大 GD = GD-39；GD-40 已由 WP-64 於其 T0 佔用（尚未落帳）。依 [GD-35](../../../DECISIONS.md) ② 紀律，二號**必須於 T0 重查**；被平行 session 取用則依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，不爭號。

### 規劃期 Open Questions

見 [README §1.4](README.md)。OQ-65.1～65.3 各有 README 預設值且於 T0 確認；OQ-65.4（掉鎖是否需即時 HUD 提示）為非阻塞，T-exit 依實機回饋結案。

### 已知的協議偏離（明帳）

1. **落點**：本 WP 主題屬 drill 生命週期／受試者體驗層，不屬 stage13 的原始輸入取樣主題；依使用者指示落於 `active/stage13/`，承 WP-62／63／64 先例。不改寫 stage13 §1 主敘事與 §4 相依圖。
2. **ADR-2 的既有偏離延續**：`liveFrame` 直讀 `drillRunner.phase`（[main.ts:1773](../../../../../src/main.ts#L1773)）而非走 `SharedState`，本 WP 的 `countdownRemainingMs` 沿用同一路徑。**這是延續既有偏離，不是新開的洞**；重構條件見 [README §3.2](README.md)。
