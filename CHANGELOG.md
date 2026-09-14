# CHANGELOG

本檔以 **stage / WP / 里程碑**為單位記錄版本。逐 task 的 episodic 記錄仍在各 WP 的
`progress.md` 與 git history；**WP 狀態的現行權威是
[docs/exec-plan/README.md](docs/exec-plan/README.md)**，本檔只做版本切面的索引。

版本號語意：本專案是研究用量測工具。`0.x` 表示**量測協定與指標語意尚未對外凍結**
（`protocolVersion`、指標 registry 版本字串仍可能升版）。`1.0.0` 保留給協定與指標
registry 正式凍結、且 M13／M18 人工閘收斂的那一版。

---

## [0.1.1] — 2026-09-14

**WP-63 交付版**（tag `v0.1.1`）。`micro_flick_three_target_test_v8`（全 repo 唯一**三顆同時存活**的
drill）第一次有可宣稱的量測指標，並修掉一個會**靜默污染資料**的效度缺口。本版**不改** sim 演進、
命中判定或 spawn 分布；除 v8 的 `weaponId` 與 KI-035 的接線之外，`src/` 全為加法。

### 新增

- **`src/metrics/targetWindows.ts`** — population-aware 的 per-target 窗界原語。`buildTargetWindows()`
  對一份匯出輸出**每一顆目標**的 `[t_visible, t_kill]` 窗與其固定世界座標（窗數恆等於 `visible` 事件數，
  不丟窗不合併窗）；`aliveAt()` 回答「某時刻誰活著」。既有 `buildPeekWindows()` 的窗界是
  `[visible_i, visible_{i+1})`，那是嚴格序列單目標模型 —— v8 的下一個 `visible` 通常屬於**另一顆**，
  每顆的分析窗因此被別人的 spawn 截斷。本原語**只做窗界與候選集，零幾何**（C-D4，以符號掃描測試釘死）。
- **`src/metrics/microFlickMetrics.ts`** — v8 的四層**事件錨定**指標 + 擊殺後方向預測曲線：
  - **L0 結果層**：`killRateHz`／`shotsPerKill`／`shotAccuracy`／`killInterval` 分位數。擊殺時刻一律取
    `fire.hit === true` 的 `fire.t` —— v8 是純 hitscan，**整場 0 個 `hit` 事件**，照抄 `t_hit` 的公式會拿到空陣列。
  - **L1 幾何層**：逐發**意圖歸屬**（對開火當下存活集合逐顆算角誤差取 argmin，**不**用 `fire.targetId`／
    `fire.offsetDeg` —— 那兩者在三顆並存下由陣列順序決定）、首發重定義與 `firstShotHitRate`、
    `correctionMs` 拆成 `settlingMs` + `cadenceWaitMs`（後者 = 被武器 `cycletimeSec` 擋住的等待）。
  - **L2 免閾值微調層**：`reEntryCount`／`dwellPathRatio`／`signReversalCount`／`approachToFireMs`。
    四者無速度門檻、無平滑窗、無峰值偵測；角半徑讀 `meta.targets.hitbox` 並與 ray/sphere 命中判定**恆等**。
  - **L3 選擇策略層**：`nearest-2`／`nearest-3` 雙候選集角距、`nearestFirstRate`、`selectionCostRatio`、
    `selectionRankEntropy`、`replacementEngagedByRank`。
  - 每層皆帶 `n`、封閉詞彙表旗標與版本字串 `micro-flick-v1`；缺失一律 `undefined` + 具名旗標，不補零。
- **`docs/operational/analysis-micro-flick.md`** — v8 的採集紀律與離線分析契約（環境硬閘、品質旗標語意、
  七種合成故障型態、解讀上限）。
- **`src/loop/__tests__/wp63-v8-metrics-determinism.test.ts`** — v8 跨 render FPS 的逐位一致閘：跑**真的**
  v8（seeded `TargetManager` spawn、真 hitscan 命中、真 `DataRecorder`），以 30／60／144／240 四條幀序列
  pump 同一份輸入，再逐位比對 trace、events 與四層指標輸出。

### 修正

- **[KI-035](docs/known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md)** 🔴 → ✅
  （決策 [`BD-039`](docs/known_issue/BUGFIX-DECISIONS.md)）—— **silent data corruption**：操作員若在載入 drill
  之後才調感度或 FOV，`ticks[].dYaw`/`dPitch` 會沿用**舊 gain** 積分，而匯出的 `meta.mouseIntegration`
  以**當下**設定重算 ⇒ 兩者發散且**離線不可察覺**。修法 (a)+(b) 併行：感度／FOV 變更即時把新 gain 推進
  recorder；錄製中（`countdown`/`running`）停用兩個滑桿。`aim`、命中判定、彈道與 sim 決定性皆不受影響。
  ⚠️ **v0.1.0 及之前收的資料**，若該場 run 中途調過感度或 FOV，其 `ticks[].dYaw`/`dPitch` 不可信。

### 變更

- **`micro_flick_three_target_test_v8` 改宣告 `weaponId: 'usp_s_laser'`**（原為 `main.ts` 的預設 `ak47`）。
  **這是效度斷代：T1 之前與之後的 v8 匯出不可混比** —— 變的不是 spawn 分布，而是**命中判定的隨機性本身**
  （`ak47` 有 seeded spread、`recoil.magnitude 25` 的 aim punch、右鍵縮 FOV；`usp_s_laser` 三者皆 0／不存在）。
  機械區分方式 = 匯出的 `meta.weaponId`；分析側**不得**以 `drillId` 合併兩批資料。
  副作用：`cycletimeSec` 0.10 → **0.17**、`magSize` 30 → **12**。
  換武器**不擾動任何 seeded 串流**（零 `inaccuracy` 讓 `sampleSpread()` 早退、rng 呼叫數 0，以 spawn trace
  逐位比對釘死）。v1–v7 與其他 drill **一行未動**。

### 決策

- **[GD-39](docs/exec-plan/DECISIONS.md)** — v8 指標一律**事件錨定**，**不得**新設第二個 movement-onset 判準
  （`t_detect` 是既有構念，C-D4；且在 v8 上受 KI-031／KI-034 雙重阻塞）；v8 換武器的斷代宣告與稽核方式；
  交付宣稱上限；以及 **⑥ parity gate 的兩側不得同源** —— 跨 FPS／跨組態的逐位比對必須來自被測物的兩次
  真實執行，兩側同源的比較永遠是綠的，守的是另一件事。

### 交付宣稱的上限（重要）

本版交付的是**可算、可重現、可稽核**的指標，**不含效度**。C-D3 構念驗證閘未過 ⇒
**WP-63 的指標一律不得進教練報告**。五項「非真人不可」逐條具名不交付：地板／天花板效應、
意圖歸屬的生態效度、免閾值描述子的漏檢率、信度／構念驗證、選擇策略常模。
另明帳**放棄**「找尋下一個目標的時間」這項宣稱：v8 三顆全程可見、無 pop-in、無 cue ⇒
搜尋可能發生在擊殺**之前**，同一個數字有兩種語意，資料無法分辨。

### 尚未納入本版

沿用 [0.1.0] 同一份清單，並扣除本版已交付的 WP-63：**WP-59**（micro flick v8 替補間距，T4／T-exit 未勾）、
**WP-61 T2**（待真人標註 cohort）、**WP-67**（`meta.opening` 匯出標記，未開工）、**WP-44** 🟡、
`active/stage14/` 草案、**M13／M18** 兩個人工閘。

### 已知問題

KI-035 已修 ⇒ [0.1.0] 列的四項效度相關 KI 剩三項，使用本版資料前仍須先讀：

- [KI-031](docs/known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) — aim 更新慢於 sim 時 sustained-tick 偵測失效。
- [KI-034](docs/known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md) — 500 ms 前刺激基線窗會吃進前一次拉槍。
- [KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md) — valid duration 含倒數時間。

> KI-031／KI-034 正是 WP-63 全面改走事件錨定的原因；兩者修復後才可補
> `movementTimeMs`／`peakOmega`（走既有 `t_detect`，不得另立判準）。

---

## [0.1.0] — 2026-09-14

**首次定版**（tag `v0.1.0`；此前 885 個 commit 無任何 tag）。涵蓋從空場景到
「可排程並執行完整選手評測 session、產出教練報告與趨勢」的全鏈路。

### 已交付範圍

| 階段 | WP | 交付內容 | 里程碑 |
|---|---|---|---|
| A（`completed/stage1/`） | WP-0 ~ 9 | 三迴圈骨架 + `SharedState`、Pointer Lock 原始輸入、`TargetManager`／`t_visible`、`HitDetector` + 簡化 counter-strafe、資料驅動 `DrillConfig`、`DataRecorder` arena + JSON/CSV 匯出、即時 HUD | **M1–M4**（2026-07-03） |
| B（`completed/stage2/`） | WP-10 ~ 18 | CS2 後座力數學核心（彈道表 + punch + inaccuracy）、`WeaponConfig`／開火／彈匣、感度換算與射線注入、movement physics + velocity gate、軌跡校準、匯出 schema v2 + 壓槍指標、F5 移動 drill + 目標 sub-tick 命中內插 | **M5–M8**（2026-07-09） |
| C（`completed/stage3/`） | WP-19 ~ 22 | 場景系統（`SceneConfig` + GLTF 管線 + 淨空驗證 + 雜亂度階層場景）、解析度模式／fullscreen／資格閘／frame-time log、seeded spawn + pop-in 偵測 drill 與 `t_detect` 離線推導 | **M9–M10**（2026-07-10） |
| E（`completed/stage5/`） | WP-23 ~ 26 | BR 遠距跟槍模組：目標 hitbox 單一來源（含 sphere）、ADS、projectile 彈道 + render-only tracer | **M11–M12**（M13 待研究者實機手動回填，#32） |
| D（`completed/stage4/`） | WP-28 ~ 32 | 選手表現分析管線 `research/` 層（`seg-v2`／`phase-v1`／`curve-v1`／`sync-v1`）、SPARC／xcorr／Fitts 三份判定、`coach-report-v2`、golden parity 晉升進 `src/metrics/` | **M14–M15**（2026-08-17） |
| F（`completed/stage6/`） | WP-33 ~ 39 | 個人瞄準能力測試框架 v1（`protocolVersion=1.0.0` 暫定凍結） | **M16**（2026-08-25） |
| G（`completed/stage7/`） | WP-40 ~ 42 | 選手測試流程前端優化 | **M17**（2026-08-25） |
| H（`active/stage8/`） | WP-43 | session entry restructure（T-exit 完成，採納／歸檔延後） | — |
| I（`active/stage9/`） | WP-44 ~ 47 | additive drill／UI（WP-45／46／47 ✅；WP-44 🟡） | — |
| J（`active/stage10/`） | WP-48 ~ 51 | 本機 session history／3D state replay／trends；automated gate ✅ | **M18 🟡**（manual／owner 閘待收斂） |
| K（`active/stage11/`） | WP-52 ~ 55 | 正式 `peek_click_transfer_v1` assessment（WP-52／53）＋ tracking pilot 與 on-target 觀測（WP-54／55） | **M19**（2026-09-02） |
| L（`active/stage12/`） | WP-56 ~ 58 | micro flick 三靶走廊、Spider Shot 大幅度拉槍、Session Program 排程層（`compileSessionProgram()` + `SessionRunner`） | —（T-exit 即交付，2026-09-07 ~ 09-09） |
| M（`active/stage13/`） | WP-60、62 ~ 66 | 逐筆原始滑鼠取樣匯出（opt-in）、Session Plan 每列武器、tracking pilot drills 入排程、drill 待命閘 + 3 秒倒數 + Pointer Lock 效度旗標、命中視覺回饋 | —（T-exit 即交付，2026-09-09 ~ 09-12） |

### 尚未納入本版

- **WP-59**（micro flick v8 替補間距）、**WP-63**（v8 量測基礎層）、**WP-67**（`meta.opening` 匯出標記）：規劃完成、未開工。
- **WP-61**（感測器離地判準驗證）：T1 儀器已交付，T2 待真人標註 cohort。
- **WP-44**：🟡 進行中。
- **`active/stage14/`**：草案，尚未升格為正式 WP；不在本版交付範圍內。
- **M13 / M18**：兩個里程碑的人工閘（研究者實機回填、manual walkthrough／owner 收斂）尚未宣告。

### 已知問題

13 個 KI 仍為 🔴 未修，完整清單見 [`docs/known_issue/`](docs/known_issue/)。其中**直接影響量測效度**的四項需在使用本版資料前先讀：

- [KI-031](docs/known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) — aim 更新慢於 sim 時 sustained-tick 偵測失效。
- [KI-034](docs/known_issue/KI-034-prestimulus-baseline-overlaps-prior-engagement.md) — 500 ms 前刺激基線窗會吃進前一次拉槍。
- [KI-035](docs/known_issue/KI-035-mouse-gain-stale-after-sensitivity-or-fov-change.md) — 改感度／FOV 後 mouse gain 未更新（silent data corruption）。
- [KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md) — valid duration 含倒數時間。

### 授權

本版起採 **Apache-2.0**。場景資產授權與出處見 [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)；
NVlabs/FPSci（CC BY-NC-SA 4.0）的程式碼與 config 從未進入本 repo，僅參考方法學與
schema 欄位語意（[CLAUDE.md](CLAUDE.md) §4 GD-11）。
