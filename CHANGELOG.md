# CHANGELOG

本檔以 **stage / WP / 里程碑**為單位記錄版本。逐 task 的 episodic 記錄仍在各 WP 的
`progress.md` 與 git history；**WP 狀態的現行權威是
[docs/exec-plan/README.md](docs/exec-plan/README.md)**，本檔只做版本切面的索引。

版本號語意：本專案是研究用量測工具。`0.x` 表示**量測協定與指標語意尚未對外凍結**
（`protocolVersion`、指標 registry 版本字串仍可能升版）。`1.0.0` 保留給協定與指標
registry 正式凍結、且 M13／M18 人工閘收斂的那一版。

---

## [0.1.3] — 2026-09-18

**WP-69 + WP-70 交付版**（tag `v0.1.3`）。把「**這一場還能不能被實驗採納**」講清楚：中途暫停的 attempt
有了三態處置與**唯一出口**（WP-69），fullscreen 條件失效的效力單位從 session 收斂到 **run**、並補上不重啟
plan 的恢復入口（WP-70）。本版**不改** sim 演進、命中判定、彈道、目標演進或 spawn 分布；`schemaVersion`
維持 **2**，`meta.validity` 為**加法**。

### 驗證（Tier 2 定版閘）

| 閘 | 結果 |
|---|---|
| typecheck ×2 | ✅ exit 0 |
| Vitest | ✅ **3,758 passed / 2 skipped**（288 files） |
| `vite build` | ✅ **209 modules** |
| Tier 1 `e2e-fast`（`chromium-ci`，GitHub-hosted） | ✅ **101 passed / 1 skipped**（13.6 m） — run [35329187672](https://github.com/ziy900409/FPS_aim_analyst/actions/runs/35329187672) |
| **Tier 2 `e2e-full`（`edge`，self-hosted 真 GPU）** | ⏳ **待執行** —— 由本 tag 觸發，結論回填本節 |

Tier 2 是定版閘（[ci-tiers.md](docs/guideline/ci-tiers.md) §4）。本版的 GitHub release 先以 **draft**
發出，待 `refs/tags/v0.1.3` 的 e2e-full run 綠燈、證據回填後才 publish。
交付期間取得的**本機** Edge 證據（非 CI 留痕，效力較弱）：WP-70 T-exit 全套 **121 passed**（21.5 m）、
KI-041 的 `wp69-pause-invalid-restart.spec.ts` **4 passed** 與鄰居 `session-orchestrator.spec.ts`
**20 passed**。

### 新增

- **WP-69 — 暫停即失效 + 完整重測**（stage15）。四個新模組：
  - `src/attempt/RunAttemptController.ts` —— attempt 級 **sticky** validity：這一場一旦暫停就回不去，
    `restart()` 是**唯一**能讓 validity 走回 `eligible-candidate` 的 mutator（不是「暫停久一點才算」的門檻，
    是**有沒有發生過**）。
  - `src/loop/PausableTimeMapper.ts` —— 暫停期間 active time 凍結。**未暫停路徑是 identity**：
    30/60/144/240 FPS 下 mapped 與 unmapped trace 以 `Object.is` 逐 tick 相同（不是近似）。
  - `src/attempt/AttemptFinalizationGate.ts` —— `eligible-candidate` / `invalid-retained` / `discarded`
    **三態 → 後果矩陣**（payload／metrics／download／history／replay／advance／clears），取代此前散在五處
    的手寫 `if (suspect)`。新增第六個消費者是**讀一個欄位**，不是**再寫一條規則**（C-D4）。
  - `src/ui/PauseOverlay.ts` —— 暫停面板，兩個出口：「繼續（本次仍無效）」把這一場跑完供稽核、
    「重新測試」才產生新的 candidate。
- **`.invalid-paused` 稽核檔** —— `invalid-retained` 的**唯一**下載路徑：操作員手動按，檔名強制帶標記，
  永遠不會被誤認成正式匯出，也不進 history／趨勢／門檻判定。
- **WP-70 — run 級條件效度**（stage16）：
  - `sharedState.validity.fullscreenExitedDuringRun`（per-run，`resetState()` 每場歸零）與匯出欄位
    **`meta.validity.fullscreenExited`**（optional-in／required-out，缺席解析為 `false`）。
  - `src/ui/ConditionRecoveryScreen.ts` —— **不重啟 Session Plan／protocol** 即可重新請求 fullscreen
    並重跑 perf 探測，通過後回到**同一項**。此前全 repo 唯一的 `requestFullscreen()` 綁在資格閘，
    plan 進行中重開會撞 `SessionRunner is already active` ⇒ 只能 reload。
- **`research/` 的 spider-shot-wide 機制層** —— Track P 握法（mouse-x grip）逐 trial 抽取 → S01–S06
  cohort → 與 cohort 報告對帳，含 operator entry point 與 regression runner。`research/` 只讀匯出
  JSON/CSV，不 import 任何 TS（C-D1）。

### 修正

- **[KI-040](docs/known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
  —— `experimentSession.suspect` 一旦為 `true` 永不復位**（`BD-040`）。後果一（靜默、跨 session）：
  同一分頁內**其後每一場**匯出的 `meta.suspect` 都是 `true`；後果二：`Esc` 同時觸發 attempt 級失效
  （**有**出口）與 session 級失效（**無**出口）⇒ 操作員只能 reload；後果三：走資格閘重入時橫幅被關掉但
  旗標仍真 ⇒ **UI 說沒事、資料說 suspect**。根因不是「少一個 reset」，而是**同一個 `meta.suspect` 的兩個
  成分 scope 不一致** —— 效能地板成分自實作起就是 per-run，只有 fullscreen 成分是 session 級 sticky。
  修法把左半邊對齊右半邊。
- **[KI-041](docs/known_issue/KI-041-attempt-hold-notice-never-clears-on-restart.md)
  —— attempt-hold 文案寫進 `#protocol-status` 後永不清除**（`BD-041`）。按下「重新測試」、新一場已在倒數，
  橫幅仍寫「測試進度停在原處，未計入本項。請按「重新測試」重跑本項。」。判定與寫入時機都**正確**；
  缺的是生命終點：`setProtocolStatus()` 恆 `display:'flex'`，全檔**無任何清除者**。修法讓 hold 文案的
  壽命 = 到下一個 attempt 開始為止，並還原 orchestrator 自己的當前 step 文案（**不是**隱藏 —— 那會連
  「我在 plan 的哪一步」一起拿掉）。hold 的**記帳**（cursor 不動／pilot attempt +1／零下載）一行未放寬。
- **protocol 路徑的第二套錄製窗判準** —— `markCurrentConditionSuspect('fullscreen-exit')` 此前未套
  KI-007 的錄製窗閘，drill **之間**退出全螢幕也會標記 condition。本版讓它與 session plan 走**同一個**
  判準（C-D4）。方向與上面兩條相反：這一條是**收緊**。

### 變更

- **`meta.validity` 新增 `fullscreenExited`（required-out）** —— payload 自此可自述 `suspect` 的來源；
  此前無法區分 suspect 來自 fullscreen 或 perf floor。canonical fixture digest 的移動筆數**事前預測 3 筆、
  事後逐筆吻合**（只動帶 `meta.validity` 父物件者）。
- **`meta.suspect` 的語意收窄為 run 級** —— ⚠️ **這是判讀斷代**：本版之前的 `true` 可能只是「這個分頁稍早
  某一場斷過」，之後的 `true` 只談**這一場**。機械區分方式 = 匯出裡有沒有 `meta.validity.fullscreenExited`。
  方向是**放寬**，且放寬的**唯一**來源是「上一個 run 的中斷不再污染這個 run」——單一 run 內的偵測未被放寬。
- **suspect 橫幅改為真值驅動 + run 級文案**（舊文案「本 session 資料標記為 suspect」在新判準下是錯的）。
- 決策：**[GD-47](docs/exec-plan/DECISIONS.md)**（效力單位 = run，fullscreen 與 pointer-lock 語意對稱，
  並補恢復入口）。**GD-10 補澄清註記、條文一字未動** —— 它把「session 標 suspect」綁在效能地板上，
  而該成分本來就是 per-run，故本版不是推翻它，是修正 WP-20 T2 延伸出來的 scope 不一致。

### 交付宣稱上限

與 v0.1.2 相同 = **可算、可重現、可稽核，不含效度**。本版**不新增任何指標**，只改變「哪些場次可被採納」
與「失效如何呈現」⇒ C-D3 的構念驗證閘狀態不變，未過閘的指標仍不得進教練報告。
WP-69／70 讓不可採納的場次**更早**被擋下（`discarded` 連 payload 都不建），這對品質判讀只增不減。

### 尚未納入本版

WP-59／61 T2／67、WP-44、stage14 草案、**WP-71（僅規劃，未開工）**；M13／M18 人工閘未宣告。
Tier 2 定版閘見上表（待回填）。

### 已知問題

- **[KI-042](docs/known_issue/KI-042-first-shot-hit-reports-window-outcome-not-the-first-shot.md) 🔴 開放**
  —— `firstShot.hit` 回報的是**窗結果**而非第一發。診斷完成、未修。
- **[KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md) 仍開放**（左界含倒數，與本版無關）。
- **FM-70.4 沒有 e2e 守衛** —— Playwright 的 `page.evaluate()` 對 CDP 帶 user gesture，
  「`requestFullscreen()` 是否在第一個 `await` 之前」錯誤實作照樣全綠 ⇒ 守衛是 source-scan ＋
  [實機手動清單](docs/operational/fullscreen-recovery-manual-check.md)，該清單的**執行紀錄仍為空**
  （owner = 操作員，正式收案前執行）。
- **`#protocol-status` 沒有所有權模型**（四個來源共用單一通道，OQ-KI41-1）；
  **`wp69-orchestrator-retry.test.ts` 的 rig 手抄 `main.ts`** 兩個函式，KI-041 正是在該 rig 全綠下存活的
  （OQ-KI41-2）。兩者皆為明帳的技術債，觸發條件已寫在各自的 KI／BD 條目。

---

## [0.1.2] — 2026-09-15

**WP-68 交付版**（tag `v0.1.2`）。把 `micro_flick_three_target_test_v9`（v8 的 **60 s 計時版**姊妹 drill）
補到與 v8 同等的量測基礎層，並修掉一條**為 kill-budget drill 寫、套到計時制上就會說錯話**的計分窗定義。
本版**不改** sim 演進、命中判定或 spawn 分布；除 v9 的 `weaponId` 與 `deriveOutcome()` 的右界分流之外，
`src/` 全為加法。

### 驗證（Tier 2 定版閘）

| 閘 | 結果 |
|---|---|
| typecheck ×2 | ✅ exit 0 |
| Vitest | ✅ **3,386 passed / 2 skipped**（273 files） |
| Tier 1 `e2e-fast`（`chromium-ci`，GitHub-hosted） | ✅ **102 passed / 1 skipped** |
| **Tier 2 `e2e-full`（`edge`，self-hosted 真 GPU）** | ✅ **115 passed / 0 flaky**（9.5 m，2 workers） |

Tier 2 是定版閘（[ci-tiers.md](docs/guideline/ci-tiers.md) §4），run
[34905394937](https://github.com/ziy900409/FPS_aim_analyst/actions/runs/34905394937)：2026-09-15 08:09–08:24 Z
在 self-hosted runner（`run.cmd` 互動桌面 session）跑完，checkout 的是 `refs/tags/v0.1.2` @ `9376d5f`。
115 tests 含 5 個 `@slow` 與 7 個 `@realgpu`；`backend.spec.ts` 在 `metadata.realGpu: true` 下 passed
⇒ 量測效度環境成立（真 GPU、真 Edge、`backend === 'webgpu'` 而非 WebGL2 fallback）。
發版當下 runner 離線，job 排隊約 9.5 小時後才被撿走（§3.6 的正常情形），故本段是事後回填的結論。

### 新增

- **`src/drill/microFlickEndConditions.ts`** —— micro-flick 家族的 `drillId → endCondition` 查表。
  `endCondition` **從來沒有進過匯出 `meta`**，所以離線端無從得知這一場是 kill-budget 還是計時制，
  而兩者的計分窗右界語意不同。九支 drill 的值**一律讀自各自 module 的 config，不手抄**
  （同一 `drillId` 登記兩次在**模組建構期**拋錯）。
- **`src/loop/__tests__/wp68-v9-metrics-determinism.test.ts`** —— v9 跨 render FPS 的逐位一致閘
  （NFR-68.3），形狀與 v8 那支相同並**共用同一份 harness**。帶**自己的**非空對空前置：v9 靶比 v8 小 10%
  （角半徑 1.118° vs 1.242°），照抄 v8 的瞄準參數有讓 v9 全部失手、四層指標一起變空的風險 ⇒ 前置以
  `toBe` 釘死實測形狀（900 ticks／37 發／18 中／19 失／21 窗）。
- **`src/loop/__tests__/microFlickDeterminismHarness.ts`** —— v8／v9 共用的 determinism harness
  （由 WP-63 的 v8 版參數化抽出）。兩支 drill 因此走**同一條**程式路徑，日後「v8 綠、v9 紅」必然歸因於
  drill 本身而不是兩份各自漂移的 harness（C-D4）。
- **`src/metrics/wp68-scoringWindow.test.ts`** —— 右界分流的三條 FR 證據，含 v8 逐位不變、兩條具名退回，
  以及分子／分母必須對同一個窗的不變式。
- **兩個新的 outcome 旗標**：`scoring_window_truncated_at_last_kill`（右界截在最後一殺 —— 這條規則
  **一直都在，只是以前沒說**）與 `unknown_end_condition`（查不到結束條件 ⇒ 退回既有語意並具名）。

### 修正

- **計時制 drill 的 `killRateHz` 系統性高估** —— `validSpanMs = lastKillMs − firstVisibleMs` 是為
  **kill-budget** drill 寫的（最後一顆被打掉，drill 就結束）。套到 **`timeLimit`** drill 上，受試者在最後
  一次擊殺**之後**仍有真實的剩餘時間在打、在失手、在找靶，那段被整段排除出分母。偏誤方向與
  [KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md)（恆向低估）相反、性質相同：一個看
  起來合理、實際會說錯話的數字。**實測**：真 run **+191.25 ms**／`killRateHz` 高估 **+2.799%**；
  合成 7.7 s dry-tail 案例 **+334.8%**（前者是下界不是典型值 —— 合成受試者以固定節奏打到最後一刻）。
  修法：右界依 `endCondition` 分流，`timeLimit` 取**最後一個 tick**（匯出**自身**的事實，不需要相信 config
  宣告的 60 s 與實際錄到的長度對得上），`targetCount` 維持 `lastKillMs`。
  ⚠️ **這條只影響計時制 drill**。`targetCount` drill（含 v8）的 `validSpanMs`／`killRateHz`／
  `shotsPerKill`／`shotAccuracy` **逐位不變**，以取自 v0.1.1 世代 worktree 的**寫死常數** `Object.is` 釘死
  （期望值**不是**再跑一次實作產生的 —— 那會把回歸連同結果一起抄進測試）。
- **`shotAccuracy` 可能大於 1（本版自己的回歸，交付前由 exit gate 攔下）** —— 上一條的鐘右界若被無條件
  採用，當 tick 紀錄**截斷在最後一殺之前**（recorder 溢位可達；events 不受同一個緩衝區限制）時，`n`
  仍計全部擊殺而 `shots` 只數窗內的 ⇒ 分子與分母對不上同一個窗。實測會輸出 `shotAccuracy` **1.5**
  （機率 > 1）與 `shotsPerKill` **0.667**（發數少於擊殺數），且**零旗標**。修法：鐘的右界**只有在它至少
  涵蓋最後一次擊殺時才採用**，否則退回 `lastKillMs`（依定義自洽）並具名。**刻意不用** `max(鐘, 最後一殺)`
  —— 那會靜默把一份內部不一致的匯出補成看起來一致的樣子。回歸測試守的是**不變式**
  （`shotAccuracy <= 1`、`shotsPerKill >= 1`），不是那一個修好的數字。

### 變更

- **`micro_flick_three_target_test_v9` 改宣告 `weaponId: 'usp_s_laser'`**（原吃 `main.ts` 預設 `ak47`）
  並登記 `DECLARED_WEAPON_ROSTER`（14 → 15）⇒ 武器是**量測儀器**不是操作員可選的變項，Session Plan
  的逐列指定**不得**覆蓋它。
  **這是效度斷代：本版之前與之後的 v9 匯出不可混比** —— 變的是**命中判定的隨機性本身**（實測 v9 在
  `ak47` 下 **33/33 發帶散布、32/33 發帶 aim punch**，命中數 18 → 1，需要「擊殺→擊殺」轉移的兩層指標
  整個算不出來；只換武器一項即從 `n = 0` 回到 `n = 17`）。機械區分方式 = 匯出的 `meta.weaponId`。
  換武器**不擾動任何 seeded 串流**（spawn trace 96 snapshot 逐位相同且兩邊各實開 4 發、`sampleSpread()`
  rng 呼叫數 0 而 `ak47` 對照組 > 0）。副作用：`cycletimeSec` 0.10 → **0.17**、`magSize` 30 → **12**
  （實測跑滿 60 s 仍**零次**空倉，但真人節奏更不規律 ⇒ 列為 pilot 觀察項）。
- ⚠️ **v8 與 v9 自此在 `meta.weaponId` 上不可分**（兩者都是 `usp_s_laser`）⇒ **分析側的分池鍵從
  「`weaponId` 或 `drillId` 皆可」收窄為「必須 `meta.drillId`」**。兩者本來就不該混池：靶徑不同
  （角半徑 1.242° vs 1.118°）、計分制不同（kill-budget vs 60 s），連帶 `killRateHz`／`shotsPerKill`／
  `shotAccuracy` 三個量**在兩支 drill 上不是同一個構念**。
- `docs/operational/analysis-micro-flick.md` 補 **v9 Applicability** 節：全部環境硬閘、探針與紀律對 v9
  原樣適用，**唯一差異是計分窗右界**（附兩制對照表與實測偏誤）。

### 決策

- **[GD-45](docs/exec-plan/DECISIONS.md)** —— 儀器宣告、計分窗右界依計分制分流、v8/v9 分池鍵收窄。
  含實測差值、v8 逐位不變的硬斷言，以及一條廣義教訓：**「投影式」輸出**（先 filter 再回傳）**會讓下游的
  成員資格斷言恆真** —— 旗標詞彙表的 runtime 封閉性測試因此不可能轉紅，真正買下封閉性的是 TS 型別。

### 交付宣稱上限

與 v0.1.1 的 v8 相同 = **可算、可重現、可稽核，不含效度**。C-D3 的構念驗證閘未過 ⇒ **v9 的指標不得進
教練報告**。v9 靶徑較 v8 再縮 10% 後是否仍有鑑別力、計時制與 kill-budget 對受試者策略的影響、以及
計時制尾段 dry spell 的真實長度分布（它直接決定本版修掉的偏誤在真人資料上的實際量級），皆**非真人不可**。
v8 與 v9 應在**同一個 cohort** 內一起收，否則兩支之間的差異無法與受試者差異分離。

### 尚未納入本版

WP-59／61 T2／67、WP-44、stage14 草案；M13／M18 人工閘未宣告。

### 已知問題

- **[KI-037](docs/known_issue/KI-037-valid-duration-includes-countdown.md)** 仍開放 —— 它與本版修的是
  **不同路徑、不同界、不同消費者**：KI-037 在 `DrillMetricRegistry.validDurationMs()`（history／assessment
  投影路徑）談**左界**（倒數被計入），本版在 `deriveOutcome()` 談**右界**。本版**未碰**該檔
  （以 `git diff` 為空稽核），KI-037 有自己的 `BD` 號與修法。
- `endCondition` 仍不在匯出 schema 內，故右界經 `meta.drillId` 反查**本 build** 的 config。這回答的是
  「**這個 build** 認為該 drill 的結束條件是什麼」，不是「**錄製當下**實際跑的是什麼」——
  若日後有人改了某支 drill 的 `endCondition`，舊匯出會被新 build 以新語意重算，而匯出本身沒有欄位能揭露
  這件事。把 `endCondition` 加進 `meta` 之後應改讀匯出並移除 `unknown_end_condition` 旗標。

---

## [0.1.1] — 2026-09-14

**WP-63 交付版**（tag `v0.1.1`）。`micro_flick_three_target_test_v8`（全 repo 唯一**三顆同時存活**的
drill）第一次有可宣稱的量測指標，並修掉一個會**靜默污染資料**的效度缺口。本版**不改** sim 演進、
命中判定或 spawn 分布；除 v8 的 `weaponId` 與 KI-035 的接線之外，`src/` 全為加法。

### 驗證（Tier 2 定版閘）

| 閘 | 結果 |
|---|---|
| typecheck ×2 | ✅ exit 0 |
| Vitest | ✅ **3,351 passed / 2 skipped**（270 files） |
| Tier 1 `e2e-fast`（`chromium-ci`，GitHub-hosted） | ✅ **102 passed / 1 skipped**（10.8 m） |
| **Tier 2 `e2e-full`（`edge`，self-hosted 真 GPU）** | ✅ **115 passed / 0 flaky**（9.7 m，2 workers） |

Tier 2 是定版閘（[ci-tiers.md](docs/guideline/ci-tiers.md) §4），run
[34891175278](https://github.com/ziy900409/FPS_aim_analyst/actions/runs/34891175278)：2026-09-15 07:51–08:08 Z
在 self-hosted runner（`run.cmd` 互動桌面 session）跑完，checkout 的是 `refs/tags/v0.1.1` @ `e58232d`。
115 tests 含 5 個 `@slow` 與 7 個 `@realgpu`；`backend.spec.ts` 在 `metadata.realGpu: true` 下 passed
⇒ 量測效度環境成立（真 GPU、真 Edge、`backend === 'webgpu'` 而非 WebGL2 fallback）。
tag 於 2026-09-14 20:09 Z 推出時 runner 離線，job 排隊約 11.7 小時後才被撿走（§3.6 的正常情形），
故本段是事後回填的結論。

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
