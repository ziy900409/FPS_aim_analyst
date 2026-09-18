# WP-70 — Progress

## Snapshot

- **Status**: ✅ **WP-70 已交付（2026-09-16, T-exit）**。T0–T6 + T-exit 全數完成。
- **分支**：`chore/agents-skills-tree`
- **規劃日期**：2026-09-15／**交付日期**：2026-09-16
- **交付判定**（[§T-exit](#t-exit-驗收閘2026-09-16)）：FR-70.1～70.11／NFR-70.1～70.6 逐條 acceptance matrix
  **無「完成但無證據」的列**；全量閘全綠且計數精確（typecheck／build exit 0、Vitest **3751 passed / 2 skipped**、
  `tests/regression` **324**＝baseline、**Edge 全套 e2e 121 passed（21.5m）**＝T5 基準）。
  canonical digest 移動 **3 筆**＝T0 預測逐筆吻合。
  ⭐ 本閘取得 FR-70.1 最強的一組 live 證據：同一次 e2e 內，被標記的 run
  `perfFloor: false / fullscreenExited: true / suspect: **true**`（suspect **純由 fullscreen 供應**）、
  下一 run `fullscreenExited: false / suspect: **false**`，**兩者皆出自實際匯出的 payload**。
- **⚠️ 帶著交付的具名邊界**（[§Tx.6](#tx6-具名邊界--不得被全綠蓋過)）：**B1 — FM-70.4 沒有 e2e 守衛**
  （限制 L1；守衛＝T4 source-scan ＋ [實機手動清單](../../../../operational/fullscreen-recovery-manual-check.md)，
  該清單 **§5 執行紀錄仍為空**，owner = 使用者／操作員）⇒ FR-70.9／NFR-70.6 在 matrix 標 🟡 **部分**，未標 ✅；
  **B2 — FM-70.1 在破效能地板的機器上不被 e2e 可靠守住**（守衛＝T1 source-scan）；
  **B3 — OQ-70.4 仍開**（owner = 使用者，不阻塞交付）。
  另有一筆 dead code 明帳並附清理觸發條件（[§Tx.9](#tx9-本閘發現的一筆-dead-code不在此就地刪明帳並給觸發條件)）。
- **Next**: 無。後續只剩 B1 的實機手動清單（由操作員在正式收案前執行）與 B3 的使用者決定。
- **來源**：[KI-040](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md) ✅ 已翻已修（2026-09-15）
- **決策**：[`GD-47`](../../../DECISIONS.md) ✅ 已落帳（2026-09-15, T6）／[`BD-040`](../../../../known_issue/BUGFIX-DECISIONS.md) ✅／GD-10 **補澄清註記、未修訂**

## Planning evidence

規劃依 `.claude/skills/engineering-planning/SKILL.md`，已讀 `CLAUDE.md` §3/§4、
`docs/exec-plan/README.md`（WP 狀態與編號）、`DECISIONS.md`（GD-10 原文、GD-15 編號規則、GD-46）、
上游 [WP-69](../../stage15/wp-69-pause-invalid-restart/README.md) 的 README/progress，
以及 `references/design_standards.md` 與 `assets/tech_spec_template.md`。

### 規劃期讀碼確認的事實（T0 須以當前行號複核，不得沿用本節行號）

| 事實 | 位置 | 對本 WP 的意義 |
|---|---|---|
| `experimentSession.suspect` 只有兩個賦值（初值 `false`、失效 `true`），無 reset | `src/display/experimentSession.ts:44,63` | 缺陷 A 的根 |
| `frames.summary.p95 > PERF_FLOOR_MS` 為 **per-run**（`frameLog` 每場 reset/freeze） | `src/main.ts:915`、`:1417`、`:1828`、`:2440` | ⭐ suspect 的兩個成分 scope 不一致，本 WP 只是對齊 |
| `pointerLockLostDuringRun` 已是 per-run，由 DOM 事件寫、`resetState()` 歸零、`meta.validity` 匯出 | `SharedState.ts:390,521,577`、`main.ts:927,1877` | ⭐ **逐字同型的先例**，T1 照抄即可 |
| `resetState()` 由 `DrillRunner.start()` 呼叫 | `src/drill/DrillRunner.ts:190` | per-run 歸零點已存在，不需新建 |
| `meta.validity` 目前**沒有** fullscreen 欄位 | `src/main.ts:919-932` | 現行 payload 無法區分 suspect 來自 fullscreen 或 perf ⇒ FR-70.2 |
| protocol 路徑未套用 `recording` 閘 | `src/main.ts:674-675` | 第二套判準（C-D4）⇒ T2 |
| `requestFullscreen` / `hideSuspectWarning` 各為 production 單一呼叫點，皆綁資格閘 | `src/main.ts:633`、`:642` | 缺陷 B/C ⇒ T3/T4 |
| `SessionRunner.start()` 非 idle/done 即 throw；否則 `enterStep(0)` | `src/session/SessionRunner.ts:220-234` | 重開資格閘救不了進行中的 plan ⇒ T4 必須解耦 |

### ⚠️ 規劃期對 KI-040 的兩處修正

1. **KI-040 §6.2 高估了變更規模。** 該節寫「`experimentSession` 應從 session 級累加器改為 per-run
   計算 —— 比原先估的變更大」。實際上 `pointerLockLostDuringRun` 已提供逐字同型的 per-run 儲存與
   歸零點，T1 照抄該 pattern 即可，`experimentSession` 只需停止供應 export 路徑。
2. **KI-040 對 GD-10 的衝擊判讀過重。** 先前記為「改動 GD-10」。逐字重讀 GD-10 ① 後：該條文把
   "session 標 suspect" 綁在**效能地板**上，而該成分實作上早已 per-run；「fullscreen 退出 ⇒ session
   級 sticky」是 WP-20 T2 的實作延伸，不在 GD-10 條文內。⇒ 預設為**補澄清註記**而非修訂 GD-10
   （見 README §0.2）。T0 須複核此判讀；若判定仍屬實質修改，改為修訂並在 `GD-47` 註明。

## Task log

| Task | 狀態 | 證據 / 決策 / 意外 |
|---|---|---|
| T0 | ✅ | 2026-09-15。production diff = 空。編號 WP-70／GD-47 確認可用；四閘 baseline 全 exit 0（Vitest **3709 passed／2 skipped**、regression **324**）；KI-040 四缺陷逐條以當前行號複核**全數仍成立**；digest 預測 **3 筆**（具名）；**OQ-70.1 實測可行 ⇒ T5 = e2e 任務**，但帶三條具名限制（L1～L3）。見 [§T0](#t0-entry-gate2026-09-15) |
| T1 | ✅ | 2026-09-15。四閘全綠（typecheck／build exit 0、Vitest **3725 passed／2 skipped**、regression **324** 與 baseline 逐數相同）；新增 **16** 個測試（`src/data/wp70-run-scoped-fullscreen.test.ts`），改動前**全 16 紅**；canonical digest **實際移動 3 筆**，與 D-70-T0-3 預測逐筆吻合、第 4 筆未出現；OQ-70.2 已關閉。見 [§T1](#t1-per-run-fullscreen-旗標2026-09-15) |
| T2 | ✅ | 2026-09-15。production diff = **一行**（+ 註解）；四閘全綠（typecheck／build exit 0、Vitest **3737 passed／2 skipped**、regression **324** 與 baseline 逐數相同）；新增 **12** 個測試（`src/display/wp70-protocol-recording-window.test.ts`），**既有測試期望值變動 = 0**（逐條理由見 §T2.4）。見 [§T2](#t2-protocol-路徑補上錄製窗判準2026-09-15) |
| T3 | done | 2026-09-15 - banner now renders from the per-run fullscreen flag, not sticky `experimentSession.suspect`; Restart/full-reset path syncs the banner after `runAttempt.restart()`. Verification: `npm.cmd run typecheck` exit 0; focused `npx.cmd vitest run src/ui/EligibilityGate.test.ts src/data/wp70-run-scoped-fullscreen.test.ts src/display/wp70-protocol-recording-window.test.ts` = **37 passed**; full `npx.cmd vitest run` = **3741 passed / 2 skipped**; `npm.cmd run build` exit 0 after rerun outside sandbox (initial Vite temp write hit EPERM); `npm.cmd run graph:update` exit 0 after rerun outside sandbox (initial graphify write hit EPERM). |
| T4 | ✅ | 2026-09-15。新增 `ConditionRecoveryScreen`，由 pause overlay restart 進入；若本 run 沒有 fullscreen invalid flag，仍走既有 `restartActiveDrill()`。恢復 click stack 內同步呼叫 `requestFullscreen()`，成功後重跑 native/fullscreen/perf 三項 gate，pass 才以 `onRecovered` 呼叫 `restartActiveDrill()`；fullscreen rejected / gate failed 均不觸發 recovery callback。驗證：`npm.cmd run typecheck` exit 0；focused `npx.cmd vitest run src/ui/ConditionRecoveryScreen.test.ts src/ui/EligibilityGate.test.ts src/display/wp70-protocol-recording-window.test.ts` = **30 passed**；full `npx.cmd vitest run` = **287 files**, **3750 passed / 2 skipped**；`npm.cmd run build` exit 0 after rerun outside sandbox（initial Vite temp write hit EPERM）；`npm.cmd run graph:update` exit 0 after rerun outside sandbox（initial graphify write hit permission denied）。見 [§T4](#t4-condition-recovery-entry-point-2026-09-15) |
| T5 | ✅ | 2026-09-15。**路徑 A**（D-70-T0-4）。新增 `tests/e2e/wp70-fullscreen-validity.spec.ts`（**2 個 test**，production diff = **空**）；`npx playwright test --project=edge --workers=1` **exit 0、121 passed**（T5 之前 119 ⇒ 淨增 2，零既有測試改動）；鏈路四段各有具名斷言，「下一 run 乾淨」以**實際匯出 payload** 為證。新增兩條具名限制 **L4／L5**（T0 只預見 L1～L3）。見 [§T5](#t5-fullscreen-效度鏈路的-e2e-防線2026-09-15) |
| T6 | ✅ | 2026-09-15。**兩個切片**：`fix(ui)` 補結 FR-70.7 的 run 級文案（T5.6 交棒 (a)，改動前該筆斷言實測轉紅；全套 **3751 passed / 2 skipped**，e2e `wp70-fullscreen-validity` **2 passed** 零改動）＋ `docs(wp-70)` 落帳與文件。`GD-47`／`BD-040` **落帳前重查編號**（最大 GD-46／BD-039，兩個標題各零命中）；GD-10 **補澄清註記、條文一字未動**；KI-040 翻 ✅ 並補 §9 修法落地實況（含「與 §6.2 初估相反且更小」）；`operator-manual.md` §0.1／§4.4／§8.3／§10／附錄五處同步且 UI 字串**逐字核對過**；`schema.md` 補 `fullscreenExited` 列＋**三構念對照表**；`pause-invalid-restart.md` 補恢復流程與 2 條現場檢查；`CONTEXT.md` 補術語；新檔 [`fullscreen-recovery-manual-check.md`](../../../../operational/fullscreen-recovery-manual-check.md)（T5.6 交棒 (b)）；舊措辭 live 命中 **0**，另修 3 處被本 WP 證偽的註解宣稱。見 [§T6](#t6-決策落帳與文件2026-09-15) |
| T-exit | ✅ | 2026-09-16。`git diff -- src tests` 為空（零 production code）。四閘＋e2e 全綠且計數精確（Vitest **3751 passed / 2 skipped**、regression **324**＝T0 baseline、**Edge 全套 121 passed（21.5m）**＝T5 基準，三者皆零漂移）；FR×11／NFR×6 acceptance matrix 每列連到**逐字測試名**，**FR-70.9／NFR-70.6 標 🟡 部分**（B1，未以全綠冒充）；blast radius 三項機械複核全清，並把 **C-D4 往下推一層**（`experimentSession.ts` 對 `drillRunner`／`phase ===` 命中 **0** ⇒ 判準算一次、傳三處、無人重算）；digest **3 筆**＝預測；取得 live payload 證據（flagged `suspect` 純由 fullscreen 供應／clean `suspect: false`）。八處狀態一致。見 [§T-exit](#t-exit-驗收閘2026-09-16) |

## Decision log

| ID | 決定 | 狀態 |
|---|---|---|
| D-70.P1 | 效力單位＝**單次 run**（產生一份 payload 的那一次），非 drill 型別、非 session plan 的一個 item | 使用者 2026-09-15 拍板（逐字：「session 斷掉沒關係，只要同一個 drill 沒有中斷即可」）；讀法見 README §6 Assumption 1 |
| D-70.P2 | 入口採 **E2**（重跑條件檢查、不重啟 plan），非 E1（暫停面板直接取鎖） | 使用者 2026-09-15 拍板 |
| D-70.P3 | KI-007 的錄製窗定義**不改**（含「暫停期間仍屬錄製窗」） | 使用者 2026-09-15 拍板（KI-040 OQ-KI-040-1） |
| D-70.P4 | T1 照抄 WP-65 T5 的 `pointerLockLostDuringRun` pattern，不重新設計 `experimentSession` | 規劃期採納（見上方修正 1） |
| D-70.P5 | GD-10 預設**補澄清而非修訂**；T0 複核 | 規劃期採納（見上方修正 2）→ **T0 複核維持，但理由改寫**（見 D-70-T0-2） |
| **D-70-T0-1** | 編號 **WP-70 / GD-47 維持**，不順延；連帶修 stage14 §3 的過期順延註記（→ `WP-71`／`WP-72`／`WP-73`） | T0 採納（見 [§T0.1](#t01-編號重查步驟-1)） |
| **D-70-T0-2** | GD-10 **補澄清註記、不修訂**——但澄清範圍必須比規劃期大：GD-10 ① 的字面是「**session** 標 suspect」且該句綁在效能地板上，而效能地板成分自實作起就是 per-run ⇒ 條文沒規定 fullscreen sticky（規劃期判讀成立），但「session」這個**用詞**本身早就與實作不符。澄清註記必須一併澄清用詞，不得只談 fullscreen | T0 採納（見 [§T0.4](#t04-gd-10-複核步驟-1-的延伸d-70p5-複核)） |
| **D-70-T0-3** | canonical digest 預測 **3 筆**移動：`09_18_05`／`09_24_18`／`09_37_24`；其餘 **5 筆逐位不變**。**第 4 筆變動即 bug，回頭修程式不准改表** | T0 採納（見 [§T0.6](#t06-canonical-digest-預測步驟-5)） |
| **D-70-T0-4** | **T5 = e2e 任務**（OQ-70.1 實測可行）。但 **FM-70.4 明確不在 e2e 涵蓋範圍**（限制 L1）：本環境下 `page.evaluate()` 自帶 user activation，錯誤實作照樣全綠 ⇒ FM-70.4 的守衛**只能**是 T4 的 source-scan ＋ 實機手動，**不得**以 T5 綠燈宣稱已守 | T0 採納（見 [§T0.7](#t07-oq-701-實測步驟-6)） |
| **D-70-T1-1** | `experimentSession.suspect` **保留、只切 export 路徑**（依 T0.8 的預設動作）。executable 讀取點由 1 歸 **0**，欄位仍是 `handleFullscreenChange()` 的去重閂。**清理觸發條件（明帳）**：T3 決定橫幅改由旗標真值驅動後，若 `onSuspect` 回呼也不再有消費者 ⇒ 由 **T3** 連同 `suspect` 欄位與 `onSuspect` 一併刪除；若 T3 結束仍保留，須在 T3 的 progress 重新說明誰在讀它 | T1 採納，關閉 OQ-70.2（見 [§T1.3](#t13-oq-702-關閉步驟-5)） |
| **D-70-T1-2** ⭐ | 新旗標的寫入**不以 `experimentSession.active` 為前提**，只看 `recording` —— 逐字沿用 `pointerLockLostDuringRun` 的同型理由。這是相對舊語意的**收緊**（研究員／一般 drill 模式錄製中退出全螢幕，過去不標、現在會標），方向與 README §3 要求「不得放寬 run 內偵測」一致；實務差異接近零（只有資格閘會進 Element fullscreen）。理由：欄位叫 `fullscreenExited` 就不該對著已發生的退出回報 `false`（FR-70.2 要 payload 自述） | T1 採納（見 [§T1.4](#t14-一處刻意的語意收緊d-70-t1-2)） |
| **D-70-T0-5** | 恢復流程**重跑三項全部**，沿用既有純函式 `runEligibilityGate()`，不另開「只驗 fullscreen＋perf」的兩項變體 —— 代價為零（同一個純函式、呼叫點讀 `screen`/`dpr`/`fullscreenElement` 三個環境訊號），且避免生出第二套資格判準（C-D4） | T0 採納，關閉 OQ-70.3（見 [§T0.8](#t08-oq-關閉與降級步驟-8)） |
| **D-70-T2-1** | T2 的修法＝**在既有 handler 內多一個 `&& recording`**（沿用同一個 const），**不**把分派抽成可測模組。抽模組曾被認真評估（能讓成對測試直接吃 production 分派），但代價是：（a）動到剛落地、正在當防線用的 T1 source-scan 測試；（b）每次事件多配置一個 sink 物件；（c）超出 T2「protocol 路徑」的範圍——`recording` 判準在 `main.ts` 另有 4 個重算點（`:1484`／`:1894`／`:1913`／`:2132`），要抽就該一起抽，那是獨立的整併工作而非本 task | T2 採納（見 [§T2.2](#t22-為什麼是一行而不是抽一個-dispatcher)） |
| **D-70-T2-2** | 成對行為測試以 **rig + parity pin 兩層**成立，並**明帳**其限制：rig 內 `onFullscreenChange()` 是 production 兩行的逐字副本 ⇒ **成對測試在改動前後皆綠**，red-before-green 的訊號由 **source-scan 承載**（改動前 12 個測試中 **2 紅**，改動後 **12 綠**）。parity 測試釘住「副本 ≡ 正本」，production 一漂移就紅（FM-70.5），成對測試的結論隨即失去授權 | T2 採納（見 [§T2.3](#t23-成對行為測試的效力與其限制明帳)） |
| **D-70-T3-1** | The suspect banner is rendered from the run-scoped truth source `sharedState.validity.fullscreenExitedDuringRun` via `renderSuspectWarning(boolean)`. `experimentSession.onSuspect` remains only a deduplicated notification hook; production no longer calls `showSuspectWarning()` / `hideSuspectWarning()` directly from `main.ts`. Alternatives considered: keep imperative show/hide in `onSuspect`/`onEnter` (rejected because it preserves the sticky-session UI bug); call `renderSuspectWarning(false)` directly in each restart caller (rejected because `resetRunPresentation()` is the existing full-restart choke point). | T3 complete; guarded by `src/ui/EligibilityGate.test.ts` source scans and DOM node-count test. |
| **D-70-T4-1** | The recovery entry intercepts only flagged fullscreen-invalid runs. `recoverActiveCondition()` preserves the WP-69 restart path for clean pauses, while flagged runs open `ConditionRecoveryScreen`; after the recovery gate passes, the only orchestrator action is the existing `restartActiveDrill()` callback. Alternatives considered: always gate every pause restart (rejected because it changes WP-69 clean-pause UX and adds unnecessary fullscreen work); reuse `EligibilityGateScreen.open()` (rejected because its `onEnter` can route to `startSessionPlan()` / `startProtocol()`, the exact FM-70.3 failure mode); add a runner method for "recover current condition" (rejected as unnecessary for T4 because full drill restart is already the documented recovery action). | T4 complete; guarded by `src/ui/ConditionRecoveryScreen.test.ts` behavior tests and source-scan guards. |
| **D-70-T5-1** | T5 走 **路徑 A**，且 fullscreen **一律由 production 控制項取得**（資格閘的「進入 fullscreen 並開始」按鈕），不用 `page.evaluate` 直呼 `requestFullscreen()` 當作進場。理由：要證的是「產品觀察得到真 fullscreen」，所以由**資格閘自己的報告**（`fullscreen: PASS — document.fullscreenElement 存在`）作證，而非測試自己讀 `fullscreenElement`。但資格閘在本環境**必然拒入**（`native` 1280×720 < 1920×1080），所以 run 仍必須由 `startSessionPlanWithoutGate()` 起始 —— 這個落差**寫在 e2e 檔頭**，不隱藏 | T5 採納（見 [§T5.2](#t52-鏈路四段與各自的具名斷言)） |
| **D-70-T5-2** ⭐ | 資格閘「拒入」的斷言**只掛 `native: FAIL`，永不掛 `perf`**。`perf` 是當下實測值，同一台機器不同時刻量到 **15.02ms（FAIL）** 與 **4.36ms（PASS）**；第一版 spec 釘了 `perf: FAIL`，在全套跑時**真的紅了**（S-70-T5-1）。`native` 在本環境**由構造保證**失敗，另以 `assertGateIsRefusableHere()` 具名前置斷言釘住這個前提，換機器時會死在有寫理由的那一行 | T5 採納（見 [§T5.4](#t54-意外與修正)） |
| **D-70-T5-3** | 第三段斷言的是 **「恢復不推進」**（T5 DoD 的原文），不是「恢復後 restart 成功」。理由：恢復閘在本環境同樣必然失敗（native），**正向 restart 路徑無法在自動化中走到**；而「失敗的恢復不得靜默前進」正是 FR-70.9／70.10 的內容，且是操作員真正會遇到的分支。正向路徑的守衛留在 T4 的 `ConditionRecoveryScreen.test.ts`（`onRecovered` → `restartActiveDrill()`） | T5 採納（見 [§T5.2](#t52-鏈路四段與各自的具名斷言)） |
| **D-70-T6-1** | `BD-040` **照取**，不順延。`KI-036` 檔頭的「尚無 `BD-040`」是 2026-09-09 當下的下一個空號、**不是保留**（依 GD-15「正式進索引才算採納」，`BD-040` 未被任何 §3 條目或 §1 索引列取用）⇒ 取用之，並**同步修好那句過期文字**（→「尚無 `BD-n`」＋具名註記）。Alternatives considered：跳到 `BD-041`（否決——會讓帳本出現一個永遠沒人解釋的空號，且沒有消除 KI-036 那句過期文字，下一個落帳的人還是會撞上同一個問題） | T6 採納（見 [§T6.1](#t61-編號重查落帳前不沿用-t0)） |
| **D-70-T6-2** | 橫幅新文案取「**本次測試**…下一次測試不受影響…暫停面板的『重新測試』」，其中「重新測試」**逐字取自** `PauseOverlay.ts` 的 `RESTART_LABEL`。Alternatives considered：① 只改「本 session」→「本次 run」（否決——`run` 是內部詞彙，操作手冊 §0.1 對操作員講的是「一次跑完的 drill」，且不回答「那我現在該做什麼」）；② 在橫幅上做一顆恢復按鈕（否決——橫幅是 `role="alert"` 的純通知，且恢復入口已在暫停面板，兩個入口＝兩套狀態機）；③ 為「橫幅字樣 ≡ `RESTART_LABEL`」加 parity 測試（否決——兩處是各自獨立的文案而非行為副本，釘死會讓任一邊的措辭調整連坐變紅；改由 operator-manual 的逐字核對承擔） | T6 採納（見 [§T3.4](#t34-補結-fr-707-的文案2026-09-15t6-第一個切片)） |
| **D-70-T6-3** | 一併修正**三處被本 WP 證偽的註解宣稱**（`experimentSession.ts` 檔頭與兩處欄位註解、`main.ts` 資格閘區塊、`main.ts` WP-58 `exit()` 區塊），comment-only、零行為改動。理由：那三處都宣稱 `experimentSession.suspect` 仍餵匯出，**T1 之後是假的**；留著等於叫下一個讀者相信缺陷 A 的認知模型。與 [BD-039](../../../../known_issue/BUGFIX-DECISIONS.md) ③ 同一類動作。Alternatives considered：留給 T-exit（否決——T-exit 的職責是驗收既有證據，不是改 production 註解）；一併刪掉 `suspect` 欄位（否決——去重閂仍承重，清理觸發條件已由 D-70-T1-1 明帳） | T6 採納（見 [§T6.8](#t68-舊措辭殘留點清理步驟-9)） |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| ~~**OQ-70.1**~~ ✅ | ~~Playwright 能否在 `--project=edge` 下可靠進入真 fullscreen 並觸發 `fullscreenchange`？~~ | T0 | — | **已關閉（2026-09-15）**：實測**可行** ⇒ T5 = e2e 任務，帶 L1～L3 三條具名限制。見 [§T0.7](#t07-oq-701-實測步驟-6) |
| ~~**OQ-70.2**~~ ✅ | ~~`experimentSession.suspect` 被切斷 export 路徑後是否仍有消費者？刪除或保留為 session 級稽核？~~ **已關閉（2026-09-15，T1）**：保留欄位、只切 export 路徑（D-70-T1-1），清理觸發條件已明帳並交棒 T3。以下為 T0 查到的事實，保留備查： | T1 | — | **已降級**（T0 把事實查完，只剩取捨）：`.suspect` 的 production **讀取點恰為 1 個**（`main.ts:914`），T1 切斷後歸 **0**；但該欄位在模組**內部仍承重**（`handleFullscreenChange` 的 `\|\| suspect` 早退＝「同一次退出只觸發一次 `onSuspect`」的去重閂）。⇒ T1 的預設動作 = **只切 export 路徑、不刪欄位**；是否連 `onSuspect`／欄位一起刪，待 T3 決定橫幅真值驅動後再回頭收。見 [§T0.8](#t08-oq-關閉與降級步驟-8) |
| ~~**OQ-70.3**~~ ✅ | ~~恢復流程要不要重驗**原生解析度**？~~ | T4 | — | **已關閉（2026-09-15）**：重跑**三項全部**（D-70-T0-5）。`runEligibilityGate()` 是純函式、呼叫時現讀三個環境訊號 ⇒ 重跑解析度的邊際成本為零，而「使用者把視窗拖到另一個螢幕」正是解析度會變的那個情況 |
| **OQ-70.4** 🟡 | 已下載的匯出檔（瀏覽器下載資料夾，repo 掃不到）是否需要操作員自查清單？`data/session-history/` 已確認零筆（KI-040 §8） | **使用者**（T6 已把判準備妥，決定權未行使） | — | **仍開，不阻塞交付**（2026-09-15，T6）。判準已寫進 [`BD-040`](../../../../known_issue/BUGFIX-DECISIONS.md)「遺留 OQ」與 [KI-040 §9.4](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)：修法**前**的 payload 其 `suspect=true` **無法歸因**（缺陷 A 的後果，只能靠操作紀錄回溯）；修法**後**的匯出可由 `meta.validity.fullscreenExited` 直接分辨。舊匯出**不回填** |

## Surprises

### S-70-T0-1 ⭐ — Playwright 的 `page.evaluate()` 自帶 user activation，差點讓 T0 得出反向錯誤的結論

OQ-70.1 的第一輪 spike（A/B）**全綠**：synthetic click → 真 fullscreen → `fullscreenchange` 觸發。
若就此收工，T0 會寫下「synthetic click 足以走通 user-activation 路徑」——**而那是錯的**。

加上控制組後翻盤：

| Spike | 做什麼 | 預期 | 實測 |
|---|---|---|---|
| C | `page.evaluate()` 內直接呼叫（**無**任何點擊） | 應被拒 | **`ok` / `fullscreenElement != null`** ❌ |
| D | `evaluate` 內 `dispatchEvent`（untrusted click） | 應被拒 | **`ok` / `fullscreenElement != null`** ❌ |
| F | 頁面自己的 `DOMContentLoaded` → `setTimeout`（Playwright 完全沒碰） | 應被拒 | **`rejected: TypeError`** ✅ |

⇒ 以排除法定位：activation 閘在本環境**確實生效**（F 為證），C/D 之所以過，是因為
**Playwright 的 `page.evaluate()` 對 CDP 帶 `userGesture: true`**。

**為什麼這條重要**：它決定 T5 能宣稱什麼。詳見 [§T0.7](#t07-oq-701-實測步驟-6) 的
限制 **L1** —— 若不知道這件事，T5 會寫一支「點按鈕 → 進 fullscreen」的 e2e 並宣稱守住了 FM-70.4，
但**把 `requestFullscreen()` 錯排到 `await` 之後的實作照樣會全綠**。那正是 [KI-040 §5](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
「修完沒有迴歸防線」的同一個坑，只是換成假綠燈的版本。

### S-70-T0-2 — 退出的 `fullscreenchange` 相對 `fullscreenElement` 轉 null 是**非同步**的

Spike E 以 `waitForFunction(() => document.fullscreenElement == null)` 為準再讀事件記錄，拿到
`["enter"]`（漏掉 exit）；Spike G 改成等**事件記錄長度**才拿到 `["enter","exit"]`。
⇒ T5 的等待條件必須掛在事件記錄上，不能掛在 `fullscreenElement`，否則會是一支間歇性假失敗的測試。

### S-70-T2-1 — `import.meta.glob` 讀不到「本檔自己」，source-scan 的自讀要走 `node:fs`

T2 的 parity pin 需要讀**測試檔自己**的原始碼。第一版沿用 T1 的 `import.meta.glob('?raw')` 寫法，對自身路徑取值回 `undefined`（Vite 的 glob 不收自身／測試檔被 include 規則濾掉），測試以
`TypeError: Cannot read properties of undefined` 失敗——是 rig 壞了，不是 production 壞了。

改用 repo 既有先例 [`src/session/drillFamily.test.ts:115`](../../../../../src/session/drillFamily.test.ts#L115)
的 `readFileSync(new URL(..., import.meta.url), 'utf8')` 後即可，並順手把同檔對 `main.ts` 的讀取
一併改為同一種寫法（一個檔案內不要兩套 source-scan 慣例）。

⇒ 給後續 task 的提醒：source-scan 讀**別的**檔用哪種都行，讀**自己**只有 `node:fs` 這條路。

---

### S-70-T5-1 ⭐ — 效能地板在同一台機器上會左右橫跳，把「環境常數」寫進斷言會得到假紅燈

T0.7 量到 `warmup p95 12.25ms`、T5 第一次單跑量到 `15.02ms`，都穩定 FAIL，於是第一版 spec 直接把
`perf:       FAIL` 當成「自動化必然拒入」的證據寫進兩處斷言。**全套跑時真的紅了**：同一台機器、相隔幾分鐘，
恢復閘那次量到 **`perf: PASS — warmup p95 4.36ms`**（機器已閒置、Edge 已暖機）。

⇒ 修法不是放寬斷言，而是**換一個由構造保證的錨點**：`native` 檢查在本環境（headless `screen` 1280×720）
不可能通過，所以「閘必拒」掛 `native: FAIL`，並加 `assertGateIsRefusableHere()` 把這個前提**寫成具名前置斷言**
（D-70-T5-2）。

**這件事同時改善了證據本身。** perf 會過的那一次，「下一 run 乾淨」量到的是
`perfFloor: false / fullscreenExited: false / suspect: **false**` —— 也就是 T5 DoD 原文要的
`suspect === false` **真的出現過**；而被標記的那一 run 是 `perfFloor: false / fullscreenExited: true /
suspect: true`，`suspect` **純粹來自 fullscreen**。兩者合起來是 FR-70.1 最強的一組 live 證據。
但它**不可被釘成常數**，所以 spec 斷言的是恆等式 `suspect === validity.perfFloor`（L4）。

### S-70-T5-2 — `document.exitFullscreen()` 不會連帶釋放 Pointer Lock（Chromium 實測）

規劃期的直覺是「退出全螢幕 ⇒ 掉鎖 ⇒ WP-69 pause」。實測**不成立**：掉出 fullscreen 後
`document.pointerLockElement` 仍指向 canvas，`drillRunner.phase` 仍是 `running`，run 會**正常跑完並匯出**。

⇒ 兩個後果，都是好的：(a) 「錄製中掉出全螢幕」這一段可以走到**真正的匯出**，`meta.validity.fullscreenExited`
因此是由 payload 作證而非只看記憶體旗標（FM-70.2 的端到端要求）；(b) 要走到 pause／恢復入口必須**另外**呼叫
`document.exitPointerLock()` —— 那正是 Esc／alt-tab 對操作員造成的**兩件事**，spec 照實分成兩個真實轉態寫，
不假裝其中一個蘊含另一個（L5）。

### S-70-T5-3 — `hit-feedback-live` 的 `@realgpu` 測試在**負載下**會紅，與 WP-70 無關（已具名排除）

T5 的第一次全套跑出現 **2 failed**，其中一筆是
`hit-feedback-live.spec.ts:531 › 換 drill …（FM-3 wiring #2 / FR-66.8）@realgpu`。因為 T4 剛改過
pause overlay 的 `onRestart`（→ `recoverActiveCondition()`），這筆必須排除「WP-70 打壞它」的可能，不能當雜訊放過。

**實測排除**（三組證據）：

| 跑法 | 結果 |
|---|---|
| WP-70 前的 baseline（`7bfeaef` 另開 worktree） | **3 passed** |
| HEAD 單跑該檔 | 1 failed（`#pause-overlay` 的「重新測試」按鈕 `isVisible()` 為真後、click 前消失，卡 180s 逾時） |
| HEAD `--repeat-each=3 -g "換 drill"` | **3 passed**（15.2s／14.3s／15.2s） |
| HEAD 全套重跑（機器淨空） | **121 passed，exit 0**，該檔全綠 |

⇒ **負載敏感的既有 flake**，非 WP-70 迴歸。兩次紅的症狀不同（一次 `視角未回到原點 6.587 > 0.2`、一次
overlay click 逾時），都落在 real-GPU 的瞄準收斂／overlay 生命週期時序上；第一次全套跑時本機**同時在跑
`vitest run`**，第二次單跑緊接在 22 分鐘全套之後。機制上也不通：該 spec 從不進 fullscreen ⇒
`fullscreenExitedDuringRun` 恆為 `false` ⇒ `recoverActiveCondition()` 與改動前逐字等價走 `restartActiveDrill()`。

⚠️ **給下一個人**：`loadScene()`（`hit-feedback-live.spec.ts:490-493`）是 check-then-act
（`if (await isVisible()) … click()`），本質上有競態。不在本 WP 範圍，但重跑全套時看到它紅，先看機器負載。

## T0 entry gate（2026-09-15）

**判定：✅ 通過，放行 T1。** `git diff -- src tests` 為空（本 task 零 production code）。
唯一落盤的非本 WP 檔案是 `docs/exec-plan/active/stage14/README.md` 的編號順延註記（見 T0.1）。

### T0.1 編號重查（步驟 1）

依 [GD-15](../../../DECISIONS.md)「正式進 §2 索引才算採納」：

| 查核 | 依據 | 結果 |
|---|---|---|
| `exec-plan/README.md` §2 目前最大採納 WP | `grep -oE 'WP-[0-9]+' … 排序取尾` | **WP-70**（即本案，`README.md:186` 已於規劃 commit `4efef1d` 入索引）；本案以外最大為 **WP-69** |
| `WP-71` 是否已被取用 | `grep -cE '^\| \*\*WP-71\*\*' docs/exec-plan/README.md` | **0** ⇒ 無人越過本案 |
| `DECISIONS.md` 已落帳最大 GD | `grep -oE 'GD-[0-9]+' … 排序取尾` | **GD-46** |
| `GD-47` 標題命中數 | `grep -c "^### GD-47 " docs/exec-plan/DECISIONS.md` | **0** ✅（`GD-44`/`45`/`46` 各為 1，作為計數法的對照） |
| stage16 資料夾命名 vs README stage 區塊 | `README.md:178`「Stage 16（`active/stage16/`…）」vs `ls docs/exec-plan/active/` | **一致** |

⇒ **WP-70 / GD-47 維持，不順延**（D-70-T0-1）。

**連帶修好一處過期註記**：`stage14/README.md` §3 最新一條順延註記（2026-09-14）寫「未採納候選為
`WP-69`／`WP-70`／`WP-71`」，但 WP-69（stage15）與 WP-70（stage16）**均已採納** ⇒ 該註記已失真。
已依該檔既有體例**追加**一條 2026-09-15 的具名註記，順延為 `WP-71`／`WP-72`／`WP-73`（不改寫舊註記，
保留歷史）。此即 [WP-69 T-exit §TE.6](../../stage15/wp-69-pause-invalid-restart/progress.md) 抓到的
「單點漏翻不會被任何測試抓到，只會被下一個 gate 抓到」同一類問題。

### T0.2 上游 exit-gate（步驟 2）

- [WP-69 progress.md](../../stage15/wp-69-pause-invalid-restart/progress.md) §Snapshot：
  ✅ 已交付（2026-09-15，T-exit），T0–T6 + T-exit 全數完成，FR-69.1～69.12／NFR-69.1～69.8 逐條具名證據。
- **focused 重跑（本 gate 實測，非引用）**：

```text
npx vitest run src/attempt src/loop/__tests__/wp69-pause-time.test.ts
Test Files  8 passed (8)
     Tests  216 passed (216)
exit 0
```

⇒ WP-69 交付未被後續 commit 破壞。**上游綠燈成立。**

### T0.3 Baseline 四閘（步驟 3）

| 閘 | exit code | 精確計數 |
|---|---:|---|
| `npm run typecheck`（`tsc --noEmit` ×2） | **0** | — |
| `npm run build` | **0** | 208 modules transformed；`dist/assets/index-tXGF1-Lm.js` 1,258.13 kB（gzip 359.78 kB） |
| `npx vitest run` | **0** | **284 passed / 1 skipped（285 files）**；**3709 passed / 2 skipped（3711 tests）** |
| `npx vitest run tests/regression` | **0** | **33 files**；**324 passed** |

⚠️ 這四個數字與 [WP-69 T-exit](../../stage15/wp-69-pause-invalid-restart/progress.md) 收尾時記錄的
**逐字相同**（3709/2、284 files、324）⇒ 兩個 WP 之間**零漂移**，本 WP 的 baseline 是乾淨的。
NFR-70.1 的「`tests/regression` 計數零漂移」以 **324** 為基準值。

### T0.4 GD-10 複核（步驟 1 的延伸，D-70.P5 複核）

逐字重讀 [GD-10](../../../DECISIONS.md) ①（未沿用 KI-040／README 的轉述）：

> ① **軟體資格閘(eligibility gate)**——session 開始自動檢查:原生解析度 ≥ 實驗最高條件
> (`screen.width × devicePixelRatio`)、fullscreen 強制、效能地板(per-frame time log 超標 →
> session 標 `suspect`/剔除);**不合格拒入,非僅記錄**。

複核結論分兩半：

1. **規劃期判讀（README §0.2 / D-70.P5）成立。** 條文把「session 標 `suspect`/剔除」寫在**效能地板**
   的括號內；GD-10 **從未**規定「錄製中退出 fullscreen ⇒ session 級 sticky suspect」。該行為出自
   WP-20 T2 的實作延伸（[`experimentSession.ts`](../../../../../src/display/experimentSession.ts) 檔頭
   docstring 自述「WP-20 T2（GD-10）」）。且 GD-10 ① 的三項檢查是**進場**判準，本 WP 一項門檻都不動。
2. **但規劃期給的理由不夠。** GD-10 ① 的字面用詞是「**session** 標 suspect」，而那一句綁定的效能地板
   成分**自實作起就是 per-run**（`frameLog.reset()` 在 `drillRunner.start()` 內，
   [main.ts:1417](../../../../../src/main.ts#L1417)）。⇒「session」這個用詞**早就**與實作不符，
   不是本 WP 才造成的。

⇒ **維持「補澄清註記」而非修訂**（D-70-T0-2），但 T6 的澄清註記**必須同時澄清用詞**——說明
`suspect` 的效力單位是 **run**，且效能地板成分向來如此；只談 fullscreen 會讓下一個讀者再踩一次同一個
歧義。**此為對 D-70.P5 的理由改寫，不是推翻。**

### T0.5 KI-040 四缺陷複核（步驟 4）

以**當前 HEAD 行號**重讀，未沿用 KI 文件行號：

| 缺陷 | 當前位置 | 複核結果 |
|---|---|---|
| **A** `experimentSession.suspect` 只有兩個賦值、無 reset | [`experimentSession.ts:44`](../../../../../src/display/experimentSession.ts#L44)（`let suspect = false`）、[`:63`](../../../../../src/display/experimentSession.ts#L63)（`suspect = true`） | ✅ **仍成立**。`exit()`（`:66-68`）只寫 `active = false`，**不碰 `suspect`** ⇒ 永不復位 |
| **B** `requestFullscreen` 為 production 單一呼叫點且綁資格閘 | [`main.ts:633`](../../../../../src/main.ts#L633) | ✅ **仍成立**。該行是 `createEligibilityGateScreen({…})`（`:625-648`）的一個 option；實際呼叫點在 [`EligibilityGate.ts:96`](../../../../../src/ui/EligibilityGate.ts#L96) 的 `attempt()` 內 ⇒ 除了「重開資格閘」以外**沒有任何路徑**能重新取得 fullscreen |
| **C** `hideSuspectWarning` 為 production 單一呼叫點 | [`main.ts:642`](../../../../../src/main.ts#L642) | ✅ **仍成立**。位在資格閘的 `onEnter` 內 ⇒ 橫幅只在「重新過閘」時才會消失（FR-70.6 的根） |
| **D** `updatePauseRuntime()` 不觸碰 `drillRunner` | [`main.ts:1339-1352`](../../../../../src/main.ts#L1339) | ✅ **仍成立**。函式體內 `grep drillRunner` 命中數 **0**（只動 `runAttempt`／`timeMapper`／`pauseOverlay`） |

**額外複核（README §0.1 的前提）**：`collectMeta()` 的 suspect 組裝在
[`main.ts:913-916`](../../../../../src/main.ts#L913)：

```ts
suspect:
  (protocolContext === undefined ? experimentSession.suspect : protocolContext.suspect) ||
  frames.summary.p95 > PERF_FLOOR_MS,
```

左成分 session 級 sticky、右成分 per-run（`frameLog` 每場 reset）⇒ **§0.1 的不對稱逐字成立。**

**另確認 FM-70.2 的風險是真的且已有現成警語**：`meta.validity` 是**逐欄手抄**而非展開
`sharedState.validity`，且 [main.ts:922-924](../../../../../src/main.ts#L922) 已有 WP-65 T5 留下的警告註解
（「新旗標必須在這裡明寫，否則會靜默漏掉整條鏈」）。T1 照抄 pattern 時**必須**連這個手抄點一起改。

**FR-70.5 的根一併確認**：[`main.ts:673-675`](../../../../../src/main.ts#L673) 算出 `recording` 後
**只**傳給 `experimentSession.handleFullscreenChange()`；下一行的
`if (!fullscreen) markProtocolFullscreenExit?.()` **完全不看 `recording`**
（`markProtocolFullscreenExit` 宣告於 `:624`、呼叫於 `:675`、賦值於 [`:2082`](../../../../../src/main.ts#L2082)
＝ `activeProtocolRunner.markCurrentConditionSuspect('fullscreen-exit')`）⇒ **第二套判準（C-D4）確實存在**，T2 的標的成立。

### T0.6 Canonical digest 預測（步驟 5）

`CANONICAL_DIGEST_BEFORE_T5`（[exportPayloadSchema.test.ts:67](../../../../../src/data/exportPayloadSchema.test.ts#L67)）
現有 **8 筆**。**未沿用 WP-69 的結論**，改以 fixture 原始檔直接數 `"validity"` 鍵：

| fixture | `"validity"` 出現次數 | T1 後預測 |
|---|---:|---|
| `counterstrafe_ad_v1-…T08_03_45.617Z.json` | 0 | 逐位不變 |
| `counterstrafe_ad_v1-…T09_39_06.031Z.json` | 0 | 逐位不變 |
| **`counterstrafe_ad_v1-…T09_18_05.631Z.json`** | **1** | **移動** |
| **`counterstrafe_ad_v1-…T09_24_18.148Z.json`** | **1** | **移動** |
| **`counterstrafe_ad_v1-…T09_37_24.351Z.json`** | **1** | **移動** |
| `synthetic_counterstrafe.json` | 0 | 逐位不變 |
| `synthetic_counterstrafe_t1_long.json` | 0 | 逐位不變 |
| `synthetic_timeline.json` | 0 | 逐位不變 |

⇒ **預測：恰 3 筆移動、5 筆逐位不變**（D-70-T0-3）。理由：`fullscreenExited` 為 required-out，
只會在**已有** `meta.validity` 父物件的 payload 上多一個鍵；缺席 `validity` 的 payload 不該長出父物件。

⚠️ 承 [D-69-T0-4](../../stage15/wp-69-pause-invalid-restart/progress.md) 的先例：
**第 4 筆變動即 bug，回頭修程式，不准改表。** 本 WP 與 WP-65／WP-69 同屬一族，三次預測應同一組 fixture。

### T0.7 OQ-70.1 實測（步驟 6）

**這是本 gate 最高價值的產出。** 丟棄式 spike 寫在 `tests/e2e/wp70-fullscreen-spike.spec.ts`，
以 `npx playwright test --project=edge wp70-fullscreen-spike` 執行，**已於本 task 內刪除**
（`git diff -- src tests` 為空為證）。**headless、未加任何 launch flag。**

| Spike | 情境 | 實測輸出 |
|---|---|---|
| **A** | dev origin 上的 stub 頁（COOP/COEP，`crossOriginIsolated === true`）＋ `page.click()` | `{"resolved":"ok","log":["enter"],"element":true,"innerH":720,"screenH":720}`；`exitFullscreen()` 後 `{"log":["enter","exit"],"element":false}` |
| **B** | **真實 app 頁面**（含其 overlay 與 COOP/COEP）＋ `locator.click({force:true})` | `{"resolved":"ok","log":["enter"],"element":true}` |
| **C**（控制組） | `page.evaluate()` 直接呼叫，**無任何點擊** | `{"outcome":"ok","element":true}` ⚠️ **本該被拒卻通過** |
| **D**（控制組） | `evaluate` 內 `dispatchEvent` untrusted click | `{"resolved":"ok","element":true}` ⚠️ **本該被拒卻通過** |
| **F**（隔離） | 頁面自己的 `DOMContentLoaded` → `setTimeout`，Playwright 完全沒碰 | `{"auto":"rejected: TypeError","log":[],"element":false}` ✅ |
| **G** | 真點擊進入 → `exitFullscreen()` 離開，**等事件記錄長度**而非等 element | `["enter","exit"]` ✅ |

**結論：可行 ⇒ T5 是 e2e 任務**（D-70-T0-4）。FR-70.1 需要的整條鏈
（真進 fullscreen → 錄製中掉出 → 觸發 `fullscreenchange`）**全部可腳本化**：進場用 `page.click()`，
「錄製中掉出」用 `page.evaluate(() => document.exitFullscreen())`（退出不需 activation）。

**但必須連同三條具名限制一起寫進 T5，否則是假綠燈：**

- **L1 ⭐ — e2e 無法守 FM-70.4。** spike C/D 證明 `page.evaluate()` 對 CDP 帶 `userGesture: true`；
  spike F 證明 activation 閘在本環境**確實生效**（頁面自發呼叫被 `TypeError` 拒絕）⇒ 兩者合起來
  定位出「是 Playwright 供給了 activation，不是閘壞了」。**後果**：把 `requestFullscreen()` 錯排到
  `await` 之後的實作，在 e2e 裡**照樣全綠**。⇒ FM-70.4 的守衛**只能**是 T4 的 source-scan
  （釘住 click handler 內**同步**呼叫）＋ 實機手動；**T5 不得宣稱涵蓋 FM-70.4**。
- **L2 — 斷言掛 `fullscreenchange`／`fullscreenElement`，不得掛視窗尺寸。** headless 下
  `innerH === screenH === 720`，進出 fullscreen **不改變任何尺寸**；尺寸斷言會因錯誤的理由通過或失敗。
- **L3 — 等待條件掛事件記錄，不掛 `fullscreenElement`。** 見 S-70-T0-2。

### T0.8 OQ 關閉與降級（步驟 8）

**OQ-70.3 → 關閉。** [`eligibilityGate.ts`](../../../../../src/display/eligibilityGate.ts) 的
`runEligibilityGate()` 是**純函式**，呼叫當下現讀 `screen` / `devicePixelRatio` /
`document.fullscreenElement` 三個環境訊號 ⇒ 重跑「原生解析度」的邊際成本為 **0**，而另開一個
「只驗 fullscreen + perf」的兩項變體反而會生出**第二套資格判準**（C-D4 風險）。
且 README 自己點出的那個情境——使用者把視窗拖到另一個螢幕——**正是**解析度會變的時候。
⇒ 恢復流程重跑三項全部（D-70-T0-5）。

**OQ-70.2 → 降級（🟡 → 🟢），事實已查完，只剩取捨留給 T1。**
`experimentSession` 全 repo 引用：`main.ts` 18、`SharedState.ts` 1（純註解）、
`tests/e2e/session-orchestrator.spec.ts` 3（純註解）、`experimentSession.test.ts` 1。
逐一分類 `main.ts` 的 18 處後：

| 成員 | production 讀寫點 | T1 後 |
|---|---|---|
| `.suspect` | **恰 1 個讀取點**（`main.ts:914`，即 export 路徑） | **歸 0** |
| `.gate` | 1（`main.ts:873` → `meta.display.gate`） | 不變 |
| `.active` | 1（`main.ts:1685`） | 不變 |
| `.enter()` / `.exit()` / `.handleFullscreenChange()` | 3 / 5 / 1 | 不變 |

⇒ **T1 的預設動作 = 只切 export 路徑、不刪欄位。** 理由：`suspect` 在模組**內部仍承重**——
`handleFullscreenChange` 的早退條件 `if (!active || !recording || present || suspect) return;`
就是「同一次退出只觸發一次 `onSuspect`」的去重閂，直接刪掉會讓橫幅回呼每次退出都重觸發。
是否連 `onSuspect` 與欄位一併刪除，**待 T3 決定橫幅真值驅動後再回頭收**；若屆時選擇保留而無人讀，
須依 README §3 明帳觸發清理的條件，不得靜默留著。

**OQ-70.4** 屬使用者、留至 T6，不阻塞 T1。

### T0.9 Blast radius（步驟 7，grep 為權威）

依 README §5：CodeGraph 對 caller 列舉不可採信（[D-68.T0-4](../../stage13/wp-68-micro-flick-v9-measurement-parity/progress.md) ＋
WP-69 T-exit 二度複現）⇒ 本節**全部以 grep 取得**，未使用 CodeGraph。

| 符號 | production | test | 分布 |
|---|---:|---:|---|
| `experimentSession` | 19 | 4 | `main.ts` 18、`SharedState.ts` 1（註解）／`session-orchestrator.spec.ts` 3（註解）、`experimentSession.test.ts` 1 |
| `handleFullscreenChange` | 4 | 11 | `experimentSession.ts` 3、`main.ts` 1／`experimentSession.test.ts` 11 |
| `markProtocolFullscreenExit` | 3 | 0 | `main.ts` 僅此一檔（宣告 `:624`、呼叫 `:675`、賦值 `:2082`） |
| `hideSuspectWarning` | 3 | 1 | `EligibilityGate.ts` 2、`main.ts` 1／`EligibilityGate.test.ts` 1 |
| `requestFullscreen` | 4 | 2 | `EligibilityGate.ts` 3、`main.ts` 1／`EligibilityGate.test.ts` 2 |
| `sharedState.validity` | 5 | 0 | `main.ts` 僅此一檔 |

⚠️ **與 README §5 規劃期數字的兩處差異**（規劃期以較粗的 grep 取得，非錯誤，但 T1 應以本表為準）：
(1) `experimentSession` 規劃期記「`main.ts` 12 處」，實測 **18 處**；
(2) 規劃期未列出 `SharedState.ts` 與 `session-orchestrator.spec.ts` 的引用——兩者皆為**註解**，
不構成程式相依，但 T1／T2 改語意時這些註解會過期，需一併更新。

### T0.10 DoD 對帳

- [x] 編號重查有具名證據（最大 WP＝WP-70／其餘最大 WP-69、最大 GD＝GD-46、`GD-47` 標題零命中）→ T0.1
- [x] WP-69 上游 gate 綠燈證據齊全，focused 重跑 **exit 0（8 files／216 tests）** → T0.2
- [x] 四閘 baseline 全數 exit 0，精確計數記入 → T0.3
- [x] KI-040 四缺陷逐條複核，**每條附當前行號** → T0.5
- [x] canonical digest 預測 **3 筆** + 具名 fixture 清單 → T0.6
- [x] **OQ-70.1 有實測結論**（非推測）：spike 指令／輸出／T5 形狀決定 → T0.7
- [x] blast radius 六個符號的 grep 計數記入 → T0.9
- [x] `git diff -- src tests` 為空（spike 已刪除）

---

## T1 per-run fullscreen 旗標（2026-09-15）

**判定：✅ 完成。** 缺陷 A 的修復點已落地：`meta.suspect` 的 fullscreen 成分不再由 session 級
sticky 的 `experimentSession.suspect` 供應，改由每場 `resetState()` 歸零的
`sharedState.validity.fullscreenExitedDuringRun` 供應，與同一個 `suspect` 運算式右半邊的 per-run
效能地板成分**對齊**（README §0.1 的不對稱消失）。

### T1.1 改動範圍（production 5 檔，逐檔一句）

| 檔案 | 改了什麼 |
|---|---|
| [`src/state/SharedState.ts`](../../../../../src/state/SharedState.ts) | `validity` 加 `fullscreenExitedDuringRun`（固定欄位、不新增配置）；`createSharedState()` 初值 `false`；`resetState()` 歸零 |
| [`src/main.ts`](../../../../../src/main.ts) | `fullscreenchange` 處理器內 `if (!fullscreen && recording)` 置真（**沿用**既有 `recording` const，不另開判準）；`collectMeta()` 的逐欄手抄加第七欄；`suspect:` 運算式移除 `experimentSession.suspect` |
| [`src/data/metadata.ts`](../../../../../src/data/metadata.ts) | `Meta['validity'].fullscreenExited`（required-out）+ args 型別（optional-in）+ `requireValidity()` 缺欄補 `false` + 併入 `collectMeta()` 的 `suspect` OR |
| [`src/data/exportPayloadSchema.ts`](../../../../../src/data/exportPayloadSchema.ts) | `parseValidity()` 的 optional-in 解析（缺席 = `false`，帶欄但非布林仍報錯） |

`schemaVersion` **維持 2**（FR-70.3）；`research/` **零改動**。

### T1.2 證據（四閘 + 測試）

| 閘 | 結果 | 對照 T0 baseline |
|---|---|---|
| `npm run typecheck` | **exit 0** | 同 |
| `npm run build` | **exit 0**，208 modules，`index-C_uagY72.js` 1,258.41 kB（gzip 359.85 kB） | baseline 1,258.13 kB ⇒ +0.28 kB（新欄位與註解） |
| `npx vitest run` | **exit 0**；**285 passed / 1 skipped（286 files）**、**3725 passed / 2 skipped（3727 tests）** | baseline 284 files／3709 tests ⇒ **+1 file、+16 tests，全部是本 task 新增的**，零既有測試淨增減 |
| `npx vitest run tests/regression` | **exit 0**；**33 files**、**324 passed** | baseline **324** ⇒ **逐數相同**，NFR-70.1 的零漂移成立 |

**DoD 的具名測試**（全部在新檔 [`src/data/wp70-run-scoped-fullscreen.test.ts`](../../../../../src/data/wp70-run-scoped-fullscreen.test.ts)）：

| DoD 要求 | 測試案例名 |
|---|---|
| **跨 run 不繼承** | `WP-70 T1 — 跨 run 不繼承（FR-70.1）` › `run N 錄製中退出全螢幕 → DrillRunner.start() 起的 run N+1 旗標為 false` ＋ `乾淨的 run N+1 匯出的 suspect 為 false（不繼承上一場的失效）` |
| **端到端 旗標 → 匯出** | `WP-70 T1 — 端到端：旗標 → 匯出（FM-70.2）` › `旗標為真 ⇒ meta.validity.fullscreenExited 與 meta.suspect 皆為真` |
| **run 內偵測未被放寬** | `WP-70 T1 — run 內的偵測未被放寬（README §3 的反方向證據）` › `同一場內置真後，drill 一路跑到 ended 仍為真` |
| **source-scan（FM-70.1）** | `WP-70 T1 — main.ts 的接線（source-scan）` › `export 路徑不再讀 experimentSession.suspect（FM-70.1）` |

⭐ **「改動前會紅」已實測，非宣稱**：測試先寫、先跑，改 production code 前
`npx vitest run src/data/wp70-run-scoped-fullscreen.test.ts` 為 **16 failed / 16**；
改完為 **16 passed**。「跨 run 不繼承」刻意用**真的** `DrillRunner.start()` 而非直接呼叫
`resetState()`——缺陷 A 的要害就是「每場的歸零點有沒有真的接上」，繞過 `DrillRunner` 會讓這條測試
在歸零點斷掉時仍然全綠。

**`Date.now` / `Math.random` 掃描**：`git diff -- src | grep '^+' | grep -cE 'Date\.now|Math\.random'`
⇒ **0**。

### T1.3 OQ-70.2 關閉（步驟 5）

依 T0.8 查好的事實執行**預設動作**：`experimentSession.suspect` **保留、只切 export 路徑**。
切斷後 `main.ts` 對 `experimentSession.suspect` 的 **executable 讀取點為 0**（剩下的 2 處命中皆為
註解；source-scan 測試先 `stripComments` 再斷言，所以那兩處不會讓測試假綠）。

**清理觸發條件（D-70-T1-1，明帳而非靜默留著）**：T3 讓橫幅改由旗標真值驅動之後，
`onSuspect` 回呼若也不再有消費者 ⇒ **由 T3 連同 `suspect` 欄位與 `onSuspect` 一併刪除**；
若 T3 結束仍選擇保留，須在 T3 的 progress 重新回答「誰在讀它」。

### T1.4 一處刻意的語意收緊（D-70-T1-2）

新旗標的寫入條件是 `!fullscreen && recording`，**不含** `experimentSession.active`。
舊來源 `experimentSession.handleFullscreenChange()` 的早退條件含 `!active`，所以**研究員模式／
一般 drill** 在錄製中退出全螢幕過去不會被標記、現在會。

- **方向是收緊不是放寬**，與 README §3「唯一該放寬的是跨 run 污染，run 內偵測不得放寬」相容。
- **理由**：FR-70.2 要求 payload 自述 suspect 來源；一個叫 `fullscreenExited` 的欄位在某些模式下
  對著**已經發生的**退出回報 `false`，是會說錯話的欄位（C-D3 的同一條精神）。
- **先例**：`pointerLockLostDuringRun` 的寫入點就刻意不以 `experimentSession.active` 為前提，
  `main.ts` 該處註解逐字寫著理由（WP-65 README §0.3 缺口 G1）。本 task 照抄該判斷。
- **實務差異接近零**：只有資格閘會呼叫 `requestFullscreen()`，沒進過 Element fullscreen 就不會有
  退出事件；F11 的瀏覽器全螢幕不觸發 `fullscreenchange`。

### T1.5 canonical digest 對帳（NFR-70.2）

**預測（D-70-T0-3）：3 筆移動、5 筆逐位不變。實測：完全吻合，第 4 筆未出現。**

| fixture | 預測 | 實測 | 新值（舊值） |
|---|---|---|---|
| `…T09_18_05.631Z.json` | 移動 | **移動** | `0fe2abf8de5fb2ed`（`be406f8793cc4c4e`） |
| `…T09_24_18.148Z.json` | 移動 | **移動** | `71df8d6e504b1f75`（`e725f627bce38982`） |
| `…T09_37_24.351Z.json` | 移動 | **移動** | `d6dfcf26053178f8`（`0e8a86413b324c2d`） |
| 其餘 5 筆 | 逐位不變 | **逐位不變** | — |

⇒ 這是**第三個** WP（WP-65 T5 / WP-69 T1 / 本案）落在同一組三筆上，materialized default 確實
只落在「本來就帶 `meta.validity` 父物件」的 payload。表已更新並補上歷代舊值，理由寫在
[`exportPayloadSchema.test.ts`](../../../../../src/data/exportPayloadSchema.test.ts) 的表頭註解。

### T1.6 C-D1 additive 相容性（README §2b 要求的 T1 檢查）

[`research/src/modules/ingest/algorithms/loader.py`](../../../../../research/src/modules/ingest/algorithms/loader.py)
的 `load_export()` 以 `meta = _mapping(_required(root, "meta", "meta"), "meta")` 取整塊 meta，
`_validate_meta()` 只檢查**必填欄位**，回傳 `meta=dict(meta)` 原樣穿透——全檔**零處**提及
`validity`，也**沒有**任何 unknown-key / `additionalProperties` 拒絕。⇒ 新欄位對 Python 側透明，
`research/` 不需任何改動（WP-69 的 `test_loader_invalid_paused.py` 對 `pauseOccurred` 已記過同一結論）。

### T1.7 既有測試期望值的變動（逐條，皆為 required-out 的機械後果）

7 個測試檔的既有斷言被動更新，**沒有一條是為了讓測試變綠而放寬主張**：

| 檔案 | 變動 | 理由 |
|---|---|---|
| `src/state/SharedState.test.ts` | 2 處 `validity` 的 `toEqual` 加第三欄；reset 測試多置真一個旗標 | 新欄位是 `validity` 物件的成員，全等比對必然要帶 |
| `src/data/metadata.test.ts`、`src/data/exportPayloadSchema.test.ts`（6 處）、`src/data/export.test.ts`、`src/history/HistoryPersistence.test.ts`、`src/metrics/microFlickMetrics.test.ts`、`src/results/ResultPresentation.test.ts` | `validity` 字面值／`toEqual` 加 `fullscreenExited: false` | required-out ⇒ 型別上構造一個 `Meta['validity']` 必須帶齊七欄（typecheck 先報，不是測試先紅） |
| `src/data/exportPayloadSchema.test.ts` digest 表 | 3 筆數值 + 表頭註解 | 見 T1.5 |

### T1.8 DoD 對帳

- [x] `npx vitest run` exit 0；新增測試數 **16** 記入 → T1.2
- [x] **跨 run 不繼承**有具名測試，且改動前實測會紅（16/16 紅 → 16/16 綠） → T1.2
- [x] **端到端旗標 → 匯出**有具名測試（不只測 SharedState） → T1.2
- [x] **run 內偵測未被放寬**有具名測試 → T1.2
- [x] source-scan 斷言 `collectMeta()` 不再讀 `experimentSession.suspect` → T1.2 / T1.3
- [x] canonical digest 實際移動 **3 筆**，與 T0 預測逐筆吻合（無第 4 筆） → T1.5
- [x] `npx vitest run tests/regression` = **324**，與 T0 baseline 逐數相同 → T1.2
- [x] 新增程式碼的 `Date.now` / `Math.random` 掃描為 **0** → T1.2
- [x] OQ-70.2 已關閉，保留 + 清理觸發條件記入 → T1.3 / D-70-T1-1

---

## T2 protocol 路徑補上錄製窗判準（2026-09-15）

**判定：✅ 完成。** FR-70.5 的第二套判準消失：`fullscreenchange` 處理器內算出的**同一個**
`recording` const，現在同時閘住三個 sink（`experimentSession.handleFullscreenChange()`、
`sharedState.validity.fullscreenExitedDuringRun`、`markProtocolFullscreenExit?.()`）。

⚠️ **方向與 T1 相反，分開記帳**：T1 是**放寬**（跨 run 不繼承上一場的失效），
T2 是**收緊**（`idle`／`ended` 退出全螢幕不再誤標 protocol condition）。兩者落在同一個 WP，
但不是「一次調整」——T1 拿掉的是跨 run 污染，T2 拿掉的是**非錄製窗**的誤判。

### T2.1 改動範圍（production 1 檔、1 行）

| 檔案 | 改了什麼 |
|---|---|
| [`src/main.ts`](../../../../../src/main.ts) | `fullscreenchange` 處理器最後一行 `if (!fullscreen)` → `if (!fullscreen && recording)`，**讀上面既有的 const**，不重算判準（C-D4）；補 4 行說明為何這行本來漏判 |

`git diff -- src/main.ts` 的 `+` 行共 5 行（1 行程式 + 4 行註解），其餘零改動。
`ProtocolRunner.ts` **未動**：`markCurrentConditionSuspect()` 本來就不該知道 drill 相位，
錄製窗是呼叫端的判準（`ProtocolRunner` 連 `DrillRunner` 都不 import）。

### T2.2 為什麼是一行，而不是抽一個 dispatcher

抽 `dispatchFullscreenChange(fullscreen, recording, sinks)` 成獨立模組曾被認真評估——好處明確：
成對行為測試可以直接吃 production 分派，不必複製（見 T2.3 的限制）。**否決**，理由三條：

1. 會動到 **T1 剛落地的 source-scan 測試**（它們逐字釘住 handler body 內的兩行）。防線落地一天
   就因為下一個 task 的方便而改寫，防線的意義會被稀釋。
2. 每次 `fullscreenchange` 多配置一個 sink 物件。非熱路徑，但本 repo 的配置紀律不該為了測試便利
   而破例。
3. **超出 T2 的範圍**。真正的整併標的不是這兩個 sink，而是 `main.ts` 內 `recording` 判準的
   **5 個站點**（T2 落地後的行號：`:673` 本處、`:1488` pointer_lock 記錄、`:1898` 掉鎖效度、
   `:1917`、`:2136` 感度鎖）。要抽就該一起抽——那是一個獨立的 C-D4 整併 task，不是「順手」。

⇒ D-70-T2-1。**這是有意識的妥協，不是遺漏**：整併機會已在此明帳，等一個真正以它為標的的 task。

### T2.3 成對行為測試的效力與其限制（明帳）

新檔 [`src/display/wp70-protocol-recording-window.test.ts`](../../../../../src/display/wp70-protocol-recording-window.test.ts)
共 **12 個測試**，兩層：

| 層 | 內容 | 改動前 | 改動後 |
|---|---|---|---|
| **行為層（成對）** | rig 以**真的** `DrillRunner`（相位由 `start()`/`tick()` 真實推進，不是手塞字串）+ **真的** `ProtocolRunner` 驅動 | 8 綠 | 8 綠 |
| **source-scan** | production 接線 4 條 | **2 紅** | 4 綠 |

⚠️ **限制必須直說**：rig 內的 `onFullscreenChange()` 是 production 兩行的**逐字副本**，
所以**成對行為測試在改動前後皆綠**——red-before-green 的訊號由 source-scan 那 2 條承載
（`npx vitest run src/display/wp70-protocol-recording-window.test.ts`：改動前 **2 failed / 10 passed**，
改動後 **12 passed**）。這與 T1「16 紅 → 16 綠」不同，不得混為一談。

副本的授權來自第 12 條 **parity pin**：它把 rig body 與 production handler 逐字比對，
production 一漂移（例如為了求綠燈把閘拿掉，FM-70.5）就紅。DoD 第 3 條允許
「source-scan **或**型別層證明」，此處採前者。

**成對結構的作用**（T2 task 檔 step 4 的原話）：若 rig 根本沒跑起來，「不標記」那半會**假綠**，
但「仍標記」那半會紅。兩半都具名、都在同一個 rig 上，缺一不可：

| 半邊 | 測試案例名 |
|---|---|
| **非錄製中不標記** | `idle（drill 之間）退出全螢幕 ⇒ 當前 condition 不被標記`、`ended（收工去抓匯出檔）退出全螢幕 ⇒ 當前 condition 不被標記`、`非錄製中的誤標不會滲進該 condition 的匯出` |
| **錄製中仍標記** | `countdown 退出全螢幕 ⇒ 當前 condition 標記為 fullscreen-exit`、`running 退出全螢幕 ⇒ 當前 condition 標記，且標記進得了匯出` |
| 方向性 | `錄製中「進入」全螢幕不是失效事件 ⇒ 不標記` |
| **C-D4 行為層** | `錄製中退出 ⇒ run 旗標與 protocol 標記同時為真`、`非錄製中退出 ⇒ 兩者同時為假` |

最後兩條是本 task 的核心主張的直接證據：**兩個 sink 不得各走各的**。

### T2.4 既有測試期望值的變動：**零**（逐條理由，FM-70.5）

T2 task 檔 step 3 要求「找出所有因此改變期望值的既有測試，逐條檢視」。實測**一條都沒有**，
這不是「沒去找」，逐條理由如下：

| 既有測試 | 為何不受影響 |
|---|---|
| [`src/display/ProtocolRunner.test.ts:88`](../../../../../src/display/ProtocolRunner.test.ts#L88)（`keeps fullscreen/perf failure as condition-level suspect…`） | 它**直接**呼叫 `runner.markCurrentConditionSuspect('fullscreen-exit')`，測的是 runner API 的語意（標記能不能進匯出），不經過 `main.ts` 的閘。T2 改的是**呼叫端要不要呼叫**，不是被呼叫端的行為 ⇒ 期望值不動是**正確**的 |
| [`src/ui/EligibilityGate.test.ts:121`](../../../../../src/ui/EligibilityGate.test.ts#L121)（`toggles the mid-session fullscreen-exit warning banner`） | 橫幅由 `experimentSession.onSuspect` 驅動，而 `handleFullscreenChange(fullscreen, recording)` **本來就**帶 `recording` 閘、T2 一個字都沒改 |
| [`src/data/wp70-run-scoped-fullscreen.test.ts`](../../../../../src/data/wp70-run-scoped-fullscreen.test.ts)（T1 的 source-scan） | 它斷言 handler body 內 `drillRunner.phase === 'countdown'` **恰出現 1 次**、且含 `if (!fullscreen && recording)`。T2 沒有新增判準運算式，只是讓第二個分支也讀那個 const ⇒ 兩條斷言都仍成立（`toMatch` 不要求唯一） |
| e2e（`br-tracking` / `full-drill` / `spray-drill` / `stage10-failure-recovery`） | 全部斷言 `meta.suspect === false`。T2 只會讓 suspect **更不容易**被設起（少一類誤判）⇒ 方向上不可能讓這些變紅 |

⇒ 沒有任何一條測試是為了配合本次改動而放寬主張（FM-70.5 的反面證據）。

### T2.5 證據（四閘）

| 閘 | 結果 | 對照 T1 |
|---|---|---|
| `npm run typecheck` | **exit 0** | 同 |
| `npm run build` | **exit 0**，`index-QtoTxbZG.js` **1,258.41 kB**（gzip 359.85 kB） | T1 為 1,258.41 kB ⇒ **逐位元組相同**（只加註解，minify 後消失） |
| `npx vitest run` | **exit 0**；**286 passed / 1 skipped（287 files）**、**3737 passed / 2 skipped（3739 tests）** | T1 為 285 files／3725 tests ⇒ **+1 file、+12 tests，全部是本 task 新增的**，既有測試淨增減為 **0** |
| `npx vitest run tests/regression` | **exit 0**；**33 files**、**324 passed** | T0 baseline **324** ⇒ **逐數相同**（DoD 第 5 條） |

**`Date.now` / `Math.random` 掃描**：`git diff -- src | grep '^+' | grep -cE 'Date\.now|Math\.random'` ⇒ **0**。
**canonical digest**：本 task 不碰 schema／匯出欄位，8 筆 digest **全數未動**（NFR-70.2 不適用於 T2）。

### T2.6 效度影響（README §3 要求 T1／T2 分別記錄）

**收緊的是誤判，不是偵測。** 被本 task 拿掉的標記，全部發生在 `idle`／`ended` ——
那兩個相位**沒有正在錄製的 payload**，把當時的退出算進「該 condition 的錄製條件失效」本來就
沒有構念上的依據（KI-007 的原始論證）。錄製窗內（`countdown`／`running`）的偵測**一格都沒放寬**，
由上表「錄製中仍標記」兩條具名測試反證。

⚠️ **對既有資料的意義**：本 WP 不回填舊匯出（README Non-goal）。修正前跑過的 protocol session，
其 condition 的 `suspect` **可能含這類誤判**，而 payload 當時沒有欄位可資辨別
（`suspectReason` 只寫 `'fullscreen-exit'`，不記相位）。⇒ 這點應併入 **T6** 的操作員說明範圍
（與 OQ-70.4 同一段），本 task 不自行擴大文件改動。

### T2.7 DoD 對帳

- [x] `npx vitest run` exit 0 → T2.5
- [x] 成對測試（錄製中標記 / 非錄製中不標記）皆具名且皆綠 → T2.3（逐案例名列表）
- [x] source-scan 證明 protocol 與 session 路徑**共用同一個** `recording` 判準值（C-D4） → T2.3 第 12 條 parity pin ＋ `protocol 與 session 路徑共用同一個 recording 判準值` 一條
- [x] 期望值變動的既有測試**逐條列在 `progress.md`** → T2.4（**零條**，附四條不受影響的理由）
- [x] `npx vitest run tests/regression` 計數與 baseline 逐數相同（**324**） → T2.5

---

## T3 banner truth-driven (2026-09-15)

**Summary**: The mid-session fullscreen warning banner is now truth-driven by the run-scoped flag `sharedState.validity.fullscreenExitedDuringRun`. The UI handle exposes `renderSuspectWarning(boolean)`, and `main.ts` syncs the banner after fullscreen changes and after the full-restart presentation reset. `experimentSession.suspect` stays sticky internally for notification de-duplication, but production UI no longer treats it as the display truth.

### T3.1 Production changes

| File | Change |
|---|---|
| [`src/ui/EligibilityGate.ts`](../../../../../src/ui/EligibilityGate.ts) | Added `renderSuspectWarning(boolean)` and routed existing `showSuspectWarning()` / `hideSuspectWarning()` through it, preserving one banner DOM node. |
| [`src/main.ts`](../../../../../src/main.ts) | Added `syncFullscreenSuspectWarning()` to render from `sharedState.validity.fullscreenExitedDuringRun`; reordered `fullscreenchange` so the run flag is set before the session notification sync; synced again in `resetRunPresentation()` for Restart/drill/scene/weapon full-reset paths. |
| [`src/ui/EligibilityGate.test.ts`](../../../../../src/ui/EligibilityGate.test.ts) | Added DOM node-count coverage and source-scan guards for run-flag rendering, fullscreenchange ordering, and full-restart sync. |

### T3.2 Verification

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | exit 0 |
| `npx.cmd vitest run src/ui/EligibilityGate.test.ts src/data/wp70-run-scoped-fullscreen.test.ts src/display/wp70-protocol-recording-window.test.ts` | exit 0; **37 passed** |
| `npx.cmd vitest run` | exit 0; **287 files**, **3741 passed / 2 skipped** |
| `npm.cmd run build` | exit 0 after rerun outside sandbox; first run failed at Vite temp-config write with `EPERM` |
| `npm.cmd run graph:update` | exit 0 after rerun outside sandbox; first run failed writing `graphify-out/.graphify_root` with permission denied |

### T3.3 DoD

- [x] `npx vitest run` exit 0.
- [x] Banner hidden for a clean run flag and visible for a flagged run flag.
- [x] Full restart path syncs the banner after the run-scoped validity reset, so the next run does not inherit the old warning.
- [x] No extra banner DOM node is created while toggling (`document.created` count pinned in `EligibilityGate.test.ts`).
- [x] Source-scan confirms production no longer directly calls `showSuspectWarning()` / `hideSuspectWarning()` from `main.ts`.

### T3.4 補結 FR-70.7 的文案（2026-09-15，T6 第一個切片）

T5.6 交棒的未結項 (a)。T3 交付了真值驅動（FR-70.6）但**沒動文案**，DoD 的「新文案不含『本 session』
字樣」因此未達成 —— 這裡補上，並保留在 UI 切片內（不與 T6 的文件切片混在同一個 commit）。

| | 舊 | 新 |
|---|---|---|
| [`EligibilityGate.ts`](../../../../../src/ui/EligibilityGate.ts) 橫幅 | `⚠ 已離開 fullscreen — 本 session 資料標記為 suspect(條件失效)。` | `⚠ 已離開 fullscreen — 本次測試標記為 suspect(條件失效)；下一次測試不受影響。暫停面板的「重新測試」可恢復條件並重跑本項。` |

新文案三件事逐條對應 T3 步驟 2：**失效範圍＝這一次測試**、**不繼承到下一次**（KI-040 缺陷 A 的正面
陳述）、**操作員的下一步**。「重新測試」逐字取自 [`PauseOverlay.ts`](../../../../../src/ui/PauseOverlay.ts)
的 `RESTART_LABEL`，不另造第二個說法（與 T4 入口一致，T3 步驟 2 的要求）。

**證據**：

| Command | Result |
|---|---|
| `npx.cmd vitest run src/ui/EligibilityGate.test.ts` | exit 0；**10 passed**（新增 1，改動前該筆**實測轉紅**：`expect(text).not.toContain('本 session')` 收到舊文案） |
| `npm.cmd run typecheck` | exit 0 |
| `npx.cmd vitest run` | exit 0；**287 files**、**3751 passed / 2 skipped**（T5 收尾 3750 ⇒ 淨增恰為新增的 1 筆） |
| `npx.cmd vitest run tests/regression` | exit 0；**324 passed**（與 T0.3 baseline 逐數相同，NFR-70.1 零漂移） |
| `npm.cmd run build` | exit 0 |
| `npx.cmd playwright test --project=edge --workers=1 wp70-fullscreen-validity` | exit 0；**2 passed**（1.8m）。T5 的 `SUSPECT_BANNER` 只釘 `'⚠ 已離開 fullscreen'` 前綴（刻意不釘錯的措辭）⇒ 改文案不動 e2e 一行 |

⚠️ 這次 e2e 跑在**夠快的機器**上（warmup p95 4.89ms），所以 L4 描述的那一支出現了：乾淨 rep 的
`meta.suspect` **實測為 `false`**（`perfFloor: false`、`fullscreenExited: false`）—— T5.3 表格中
「perf 過地板時」那一列的真實觀測，DoD 原文的 `suspect === false` 在此重現。

**未做（明帳）**：沒有為「橫幅字樣 ≡ `RESTART_LABEL`」加 parity 測試。T2 對 production 副本用了
parity pin，但那裡釘的是**行為分派的副本**（漂移會讓結論失效）；這裡兩處是各自獨立的文案，
釘死反而會讓任何一邊的措辭調整連坐變紅。⇒ 由 T6 的 operator-manual 逐字核對承擔（該節 DoD 明列）。

---

## T4 condition recovery entry point (2026-09-15)

**Summary**: Added a dedicated `ConditionRecoveryScreen` for fullscreen-invalid runs. The pause overlay restart action now opens this recovery screen only when `sharedState.validity.fullscreenExitedDuringRun` is true; clean pause restarts still use the existing WP-69 `restartActiveDrill()` path. Recovery reacquires fullscreen, reruns the same three gate checks (native / fullscreen / perf), and only then restarts the current drill.

### T4.1 Production changes

| File | Change |
|---|---|
| [`src/ui/ConditionRecoveryScreen.ts`](../../../../../src/ui/ConditionRecoveryScreen.ts) | New DOM overlay with `open({ onRecovered })`, `close()`, and `dispose()`. Its click handler calls `requestFullscreen()` before the first `await`, reruns `probeWarmupP95Ms()` + `runEligibilityGate()`, and calls `onRecovered(report)` only on pass. |
| [`src/main.ts`](../../../../../src/main.ts) | Added `conditionRecoveryScreen` and `recoverActiveCondition()`. The pause overlay restart callback now routes through recovery for flagged fullscreen-invalid runs; successful recovery calls the existing `restartActiveDrill()` and does not call session/protocol start, advance, export, or history save paths. |

### T4.2 Verification

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | exit 0 |
| `npx.cmd vitest run src/ui/ConditionRecoveryScreen.test.ts src/ui/EligibilityGate.test.ts src/display/wp70-protocol-recording-window.test.ts` | exit 0; **30 passed** |
| `npx.cmd vitest run` | exit 0; **287 files**, **3750 passed / 2 skipped** |
| `npm.cmd run build` | exit 0 after rerun outside sandbox; first run failed at Vite temp-config write with `EPERM` |
| `npm.cmd run graph:update` | exit 0 after rerun outside sandbox; first run failed writing `graphify-out/.graphify_root` with permission denied |

### T4.3 DoD

- [x] `npx vitest run` exit 0.
- [x] Rejected fullscreen request and failed gate both leave the recovery callback uncalled; by construction this means no restart / advance / export / save path runs.
- [x] Passing recovery calls `onRecovered(report)` and the production callback is `restartActiveDrill()` only.
- [x] Source-scan pins `requestFullscreen()` before the first `await` in the recovery click path (FM-70.4).
- [x] Source-scan confirms `ConditionRecoveryScreen` does not reference `startSessionPlan`, `startProtocol`, `sessionPlanRunner`, `downloadJSON`, or `historyPersistence` (FM-70.3).
- [x] Source-scan confirms `recoverActiveCondition()` does not call `sessionPlanRunner.start()`, `sessionPlanRunner.advance()`, `completeCurrentCondition()`, `downloadJSON`, or `historyPersistence.save()` (FR-70.10 / NFR-70.5).
- [x] DOM node-count test confirms open/retry reuses mounted nodes and does not create nodes during state changes (NFR-70.4).
- [x] OQ-70.3 remains closed by D-70-T0-5: recovery reruns all three checks through `runEligibilityGate()`.
- [x] FR-70.11 preserved: clean pause restart still uses the WP-69 restart path; fullscreen-invalid pause restart first performs condition recovery, then uses the same restart path.

---

## T5 fullscreen 效度鏈路的 e2e 防線（2026-09-15）

**判定：✅ 完成（路徑 A）。** KI-040 §5 點名的盲區——WP-69 的 119 條 e2e 全綠卻漏掉本 bug，因為
**每一條** Session Plan e2e 都走 `startSessionPlanWithoutGate()`、**從不進入 fullscreen**——現在有一條
真的持有、真的失去、真的重取全螢幕的 live 防線。**production diff = 空**（本 task 只加測試）。

### T5.1 改動範圍

| 檔案 | 改了什麼 |
|---|---|
| [`tests/e2e/wp70-fullscreen-validity.spec.ts`](../../../../../tests/e2e/wp70-fullscreen-validity.spec.ts)（新檔，2 tests） | 全部。檔頭記載 `startSessionPlanWithoutGate` 盲區（T5 DoD 最後一條）、fullscreen 的取得方式、以及 **L1～L5 五條具名限制** |

`git diff -- src` 為空；既有測試**零改動**（全套 119 → 121，淨增恰為新增的 2 條）。

### T5.2 鏈路四段與各自的具名斷言

| 段 | 在哪 | 具名斷言 |
|---|---|---|
| **① 真的進 fullscreen** | 兩個 test 共用 `takeRealFullscreenThroughTheGate()` | 走 production DOM 路徑（選手測試 Session → `#session-setup` → `#session-plan-setup` → `#eligibility-gate`）後點**產品自己的**「進入 fullscreen 並開始」；斷言 `fullscreenLog === ['enter']`、`document.fullscreenElement != null`、`crossOriginIsolated === true`，並讀**資格閘自己的報告**含 `fullscreen: PASS — document.fullscreenElement 存在`。⇒ 作證的是**產品**觀察到真 fullscreen，不是測試自己讀屬性 |
| **② 錄製中退出 ⇒ 該 run 標記** | test 1 | rep 1 `running` 時 `document.exitFullscreen()` → `fullscreenLog === ['enter','exit']`、`__aimDebug.state.validity.fullscreenExitedDuringRun === true`、橫幅 visible；**rep 1 跑完的實際匯出** `meta.validity.fullscreenExited === true`、`meta.suspect === true`（FM-70.2 要求的端到端，不只測記憶體旗標） |
| **③ 恢復不推進** | test 2 | 真 Pointer Lock → 掉 fullscreen → 掉鎖 → `#pause-overlay`「重新測試」**開恢復畫面而非 restart**（FR-70.8 的 flagged 分支）→ 點「重新進入 fullscreen」**真的重取 fullscreen**（`fullscreenLog === ['enter','exit','enter']`，恢復畫面自己的報告 `fullscreen: PASS`）→ 閘不過 ⇒ 畫面**留在原地**、status 為「條件仍未通過，請修正後重試。」、「重試條件檢查」可按，且 **cursor／attempt number／downloads／`#result-screen` 全無變化**（FR-70.9／70.10） |
| **④ 下一 run 乾淨** ⭐ | test 1 | rep 2 全程在 fullscreen（`running` 當下 `fullscreenElement != null`，且事件記錄此後不再出現 `exit`）；run 起始 `fullscreenExitedDuringRun === false`、橫幅自動收起；**rep 2 的實際匯出** `meta.validity.fullscreenExited === false` ——這是 KI-040 缺陷 A 的 live 反證 |

### T5.3 「下一 run 乾淨」的證據形狀（L4，NFR-70.6 的誠實邊界）

T5 DoD 原文要求斷言 `suspect === false`。實測後改為**恆等式**，理由與代價都記在這裡：

`meta.suspect` 的另一半是效能地板，**不在本檔控制範圍內**，且同一台機器會左右橫跳（S-70-T5-1）。
所以斷言寫成 FR-70.2 之後才可能的形式：

```ts
expect(cleanMeta.validity.fullscreenExited).toBe(false);          // ← 核心
expect(cleanMeta.validity).toMatchObject({ pointerLockLost: false, pauseOccurred: false, /* … */ });
expect(cleanMeta.suspect).toBe(cleanMeta.validity.perfFloor);      // ← suspect 只剩效能地板
```

**兩種環境都實際跑過，兩次都成立**：

| 全套／單跑 | 被標記的 rep 0 | 乾淨的 rep 1 |
|---|---|---|
| perf 破地板時 | `perfFloor: true, fullscreenExited: true, suspect: true` | `perfFloor: true, fullscreenExited: false, suspect: true` |
| perf 過地板時 | `perfFloor: false, fullscreenExited: true, suspect: **true**` ⇒ suspect **純由 fullscreen 供應** | `perfFloor: false, fullscreenExited: false, suspect: **false**` ⇒ DoD 原文的 `suspect === false` **真的出現** |

⚠️ **L4 的代價（明帳）**：在 perf 破地板的機器上，`meta.suspect` 本來就是 `true`，所以
**FM-70.1 不被本檔可靠守住**——若哪天 `collectMeta()` 又把 `experimentSession.suspect` OR 回去，
效能地板會把它蓋掉而本檔照樣全綠。FM-70.1 的**可靠**守衛仍是 T1 的 source-scan；本檔只在機器夠快時順帶抓到。
這一段逐字寫進 e2e 檔頭，不留在 progress 裡自說自話。

### T5.4 意外與修正

兩條 T0 未預見的限制由本 task 實測補上（e2e 檔頭已載明）：

- **L4** — `suspect === false` 不可釘成常數（S-70-T5-1，D-70-T5-2）。第一版 spec 釘了 `perf: FAIL`，
  全套跑時**真的紅了**；改掛由構造保證的 `native: FAIL` + `assertGateIsRefusableHere()` 前置斷言。
- **L5** — `document.exitFullscreen()` 不釋放 Pointer Lock（S-70-T5-2）。掉 fullscreen 與掉鎖是兩個真實轉態，
  spec 照實分開寫。

另有一筆與本 WP **無關**的既有 flake 已具名排除（S-70-T5-3：`hit-feedback-live` `@realgpu`，
baseline 3/3 綠、HEAD `--repeat-each=3` 3/3 綠、淨空全套 121/121 綠）。

### T5.5 證據（四閘 + e2e）

| Command | Result |
|---|---|
| `npx.cmd tsc --noEmit` ×2（含 `tsconfig.node.json`） | exit 0 |
| `npx.cmd vitest run` | exit 0；**287 files**、**3750 passed / 2 skipped** —— 與 T4 收尾**逐字相同**（本 task 不動單元層） |
| `npx playwright test --project=edge --workers=1 wp70-fullscreen-validity` | exit 0；**2 passed** |
| **`npx playwright test --project=edge --workers=1`（全套）** | **exit 0；121 passed（21.4m）** |

⚠️ 全套計數的**前值**：T5 之前為 **119 passed**（本 task 第一次跑全套時測得，該次另有 2 failed，逐筆處置見
S-70-T5-1／S-70-T5-3）。119 + 2 = **121**，與淨空重跑逐數吻合 ⇒ **零既有測試被改動或被本檔影響**。
WP-70 的 T0.3 baseline 未含 playwright 一閘，本節是本 WP 第一份 e2e 全套計數，後續 task 以 **121** 為基準值。

### T5.6 交棒 T6 的兩筆未結項

**不得靜默略過**——兩筆都影響 T-exit 的逐條證據：

1. ⚠️ **FR-70.7（run 級文案）實際上未達成。** [`src/ui/EligibilityGate.ts`](../../../../../src/ui/EligibilityGate.ts)
   的橫幅仍是 `⚠ 已離開 fullscreen — 本 session 資料標記為 suspect(條件失效)。`，
   而 T3 的 DoD 明列「新文案不含『本 session』字樣」。T3 交付的是**真值驅動**（FR-70.6，確實完成），
   **文案那一項沒動**。T5 的 e2e 只斷言橫幅的**顯示/隱藏**，刻意不斷言字串，以免把錯的措辭釘進迴歸防線。
   ⇒ 交 T6（或另開一個 T3 補丁切片）改文案，並同步 e2e／`docs/operational/` 的殘留措辭清單。
2. **FM-70.4 的實機手動驗證清單尚未存在。** 依 D-70-T0-4／L1，`requestFullscreen()` 是否在第一個 `await`
   **之前**同步呼叫，**e2e 永遠測不到**（Playwright 的 `page.evaluate()` 自帶 user activation）。
   目前守衛只有 T4 的 source-scan。⇒ T6 需在 `docs/operational/` 落一份**具名**手動清單
   （步驟可勾選、含瀏覽器版本欄位與預期觀察值），否則 NFR-70.6 的「實機」半邊沒有著落。

### T5.7 DoD 對帳

- [x] `npx playwright test --project=edge --workers=1` **exit 0**，計數記入（**121 passed**）→ T5.5
- [x] 路徑 A：鏈路四段（進 fullscreen／錄製中退出標記／恢復不推進／下一 run 乾淨）**各有具名斷言** → T5.2
- [x] 「下一 run 乾淨」**有證據**，且證據是**實際匯出的 payload**（非只證「會標記」）→ T5.2 ④、T5.3
- [x] `startSessionPlanWithoutGate` 的盲區記載於 **e2e 檔頭**（連同它為何仍然必要）→ T5.1
- [x] L1（FM-70.4 不在涵蓋範圍）在檔頭載明，**未以 T5 綠燈宣稱已守 FM-70.4**（D-70-T0-4）
- [x] 新增限制 L4／L5 與其實測依據入帳 → T5.3／T5.4
- [x] 非本 WP 的既有 flake 已具名排除，不當作雜訊也不當作迴歸 → S-70-T5-3
- [x] 未結項具名交棒（FR-70.7 文案、FM-70.4 手動清單）→ T5.6

---

## T6 決策落帳與文件（2026-09-15）

**判定：✅ 完成。** 兩個切片：**(1)** `fix(ui)` 補結 T5.6 交棒的 FR-70.7 文案（見 [§T3.4](#t34-補結-fr-707-的文案2026-09-15t6-第一個切片)）；
**(2)** 本切片 `docs(wp-70)` 落帳與文件。KI-040 §5 的教訓（「T6 若漏掉 `operator-manual.md`，等於這個修法對現場
操作員不存在」）是本 task 的判準來源，故 §T6.5 的逐字核對**以當前程式碼為準、不憑記憶**。

### T6.1 編號重查（落帳前，不沿用 T0）

| 查核 | 指令 | 結果 |
|---|---|---|
| `DECISIONS.md` 已落帳最大 GD | `grep -oE 'GD-[0-9]+' … 排序取尾` | **GD-46** |
| `GD-47` 標題命中數 | `grep -c "^### GD-47 " docs/exec-plan/DECISIONS.md` | **0** ✅ |
| repo 全域 `GD-47` 提及 | `grep -rn "GD-47" --include=*.md .` | 僅 WP-70 自身文件與 stage16 index 的**預約**字樣，無他案取用 |
| `BUGFIX-DECISIONS.md` 已落帳最大 BD | `grep -oE 'BD-[0-9]+' … 排序取尾` | **BD-039** |
| `BD-040` 標題命中數 | `grep -c "^### BD-040 " docs/known_issue/BUGFIX-DECISIONS.md` | **0** ✅ |

⇒ 取 **`GD-47`** / **`BD-040`**，與 T0 預約一致。

⚠️ **一處前向參照要處理**（D-70-T6-1）：`KI-036` 檔頭寫「尚無 `BD-040`」。逐字重讀後判定那是
**2026-09-09 當下的下一個空號，不是保留**——依 [GD-15](../../../DECISIONS.md)「正式進索引才算採納」，
`BD-040` 未被任何 §3 條目或 §1 索引列取用。⇒ 本案取用 `BD-040`，並**同步修好那句過期文字**
（改為「尚無 `BD-n`」＋具名註記說明 `BD-040` 已由 KI-040 取用、落帳時須重查）。
與 T0.1 修 stage14 順延註記是同一類問題：**單點漏翻不會被任何測試抓到，只會被下一個 gate 抓到**。

### T6.2 `GD-47` 落帳（步驟 1）

落在 [`DECISIONS.md`](../../../DECISIONS.md) §2 最上方（承 GD-46／45 的「最新在上」體例）。八格：
① 效力單位＝run（含「run = 產生一份 payload 的那一次」的讀法）、② **方向性明帳**、③ 與 GD-10 的關係、
④ 與 GD-46／WP-69 的關係、⑤ payload 自述、⑥ 恢復入口 E2、⑦ 編號重查、⑧ 明帳殘餘風險。

**② 是本條最容易被讀漏的一格**（README §3 要求兩個方向分別記錄），逐字寫進條文：

| 方向 | 內容 | 落在 |
|---|---|---|
| **放寬** | 唯一來源＝「上一個 run 的中斷不再污染這個 run」。run **內**的偵測一格都沒放寬 | T1 |
| **收緊 (a)** | 新旗標不以 `experimentSession.active` 為前提、只看 `recording`（D-70-T1-2）⇒ 研究員／一般 drill 模式錄製中退出全螢幕，過去不標、現在會標 | T1 |
| **收緊 (b)** | protocol 路徑補上 KI-007 錄製窗閘 ⇒ `idle`／`ended` 退出不再標記 condition | T2 |

④ 另補一句規劃期沒寫死的邊界：**對稱的是效力單位，不是後果**——`pauseOccurred` 是採納的 hard reject，
`fullscreenExited` 只是可保留資料的品質提示；本條不改 GD-46 的任何一態。

### T6.3 GD-10 的處置：補澄清註記（步驟 2）

依 [T0.4](#t04-gd-10-複核步驟-1-的延伸d-70p5-複核) 的複核結論執行 **D-70-T0-2**：在 GD-10 表格加一列
`⚠️ 澄清註記(2026-09-15, WP-70 T6 補;不修訂上列條文)`，**原「決議」列一字未動**，並在「狀態」列註明
「措辭澄清 2026-09-15，條文本身未修訂」。

註記四點，其中**第一點是 T0 才補上的範圍擴大**：

1. ⭐ **一併澄清用詞**：① 字面寫「**session** 標 suspect」，但那句綁的是效能地板，而該成分自實作起就是
   per-run ⇒「session」這個用詞**從一開始**就與實作不符，不是本 WP 才造成的。只談 fullscreen 會讓下一個
   讀者再踩一次同一個歧義。
2. 條文從未規定「fullscreen 退出 ⇒ session 級 sticky」；那是 WP-20 T2 的實作延伸。
3. **不動** ① 的三項**進場**檢查與門檻，「不合格拒入，非僅記錄」原封不動。
4. `suspect` 是品質提示，採納由 GD-46 三態與既有 gates 決定。

⇒ **選擇理由已寫在 `GD-47` ③**（T6 DoD 明列要求「選擇理由寫在 `GD-47`」）。

### T6.4 `BD-040` 落帳與 KI-040 狀態翻新（步驟 3、4）

- [`BD-040`](../../../../known_issue/BUGFIX-DECISIONS.md) 落在 §3（CLOSED）最上方，六格比照 BD-039 體例。
  **「偏離計畫」格是本條的重點**，五項具名：
  ① ⭐ **偏離 KI-040 §6.2 初估**——§6.2 估「`experimentSession` 改為 per-run 計算，比原先估的變更大」，
  實況**相反且更小**（WP-65 T5 先例 ⇒ 照抄 pattern，`experimentSession` 結構一行未改）；
  ② `experimentSession.suspect` 保留不刪（去重閂仍承重）；③ D-70-T1-2 的刻意收緊；
  ④ T2 是相反方向的收緊；⑤ T3 的文案延到 T6 才補（具名交棒、未靜默放過）。
- §1 索引列的「修復決策」與「狀態」兩欄一併翻新為 `✅ 已修（2026-09-15，WP-70 T1–T6）`，
  並連到 `BD-040`／`GD-47`／WP-70 三處。
- [KI-040](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
  檔頭狀態由 🟡 翻 ✅，並新增 **§9 修法落地實況**：四個缺陷各自的出口（A/B/C 有、D 刻意不修）、
  **§9.2 與 §6.2 初估的差**（保留 §6.2 原文不改寫，差異記在 §9 與 `BD-040`）、§9.3 三處 §6 沒預見的事、
  **§9.4 §8 的未查核範圍在修法後可分辨了**（`fullscreenExited` 直接自述；但只對修法後的匯出成立）。

**OQ 處置**（步驟 4）：

| OQ | 處置 |
|---|---|
| `OQ-KI-040-3`（e2e 盲區） | **關閉**。T5 已交付 live 防線；但**帶兩條具名邊界**寫進該列：(a) FM-70.4 e2e 永遠測不到（L1）⇒ 守衛是 source-scan ＋ 實機清單；(b) FM-70.1 在破地板機器上會被 `perfFloor` 蓋掉（L4）。⇒ 這是**關閉 + 具名遺留**，不是無條件關閉 |
| `OQ-KI-040-4`（GD-n 編號） | **關閉**。`GD-47` 落帳、GD-10 補澄清；理由寫在 `GD-47` ③ |
| `OQ-70.4`（已下載匯出的自查清單） | **仍開，owner = 使用者**。不阻塞本 WP。判準已在 `BD-040` 與 KI-040 §9.4 寫清楚：修法**前**的 payload 無法歸因、修法**後**可由 `meta.validity.fullscreenExited` 直接分辨 |

### T6.5 `operator-manual.md`：逐字核對過的 UI 字串（步驟 5）

⚠️ **T6 DoD 要求「實際 UI 字串逐字核對過（非憑記憶）」**。本節記錄核對來源與結果。

| 字串 | 來源（本 session 讀碼） |
|---|---|
| `⚠ 已離開 fullscreen — 本次測試標記為 suspect(條件失效)；下一次測試不受影響。暫停面板的「重新測試」可恢復條件並重跑本項。` | [`EligibilityGate.ts`](../../../../../src/ui/EligibilityGate.ts)（本 WP 第一個切片剛改） |
| `已暫停 — 本次已失去實驗效力` / `繼續（本次仍無效）` / `重新測試` | [`PauseOverlay.ts`](../../../../../src/ui/PauseOverlay.ts) `TITLE`／`RESUME_LABEL`／`RESTART_LABEL` |
| `恢復實驗條件` / `重新進入 fullscreen` / `取消` | [`ConditionRecoveryScreen.ts`](../../../../../src/ui/ConditionRecoveryScreen.ts) |
| `正在恢復 fullscreen 並重驗條件...` / `無法進入 fullscreen，請再按一次重試。` / `重試 fullscreen` / `條件仍未通過，請修正後重試。` / `重試條件檢查` | 同上（四個狀態字串 + 兩個重試鈕字樣） |
| `fullscreen: PASS — document.fullscreenElement 存在` | 資格閘報告（T5 e2e 實測輸出亦逐字吻合） |

**改了四處**（WP-69 T-exit 才剛把 Esc 語意補進 §4.4／§8.3，本 WP 又改了失效範圍與恢復路徑 ⇒ 必須同步）：

1. **§4.4 黃色警示條**：字串換成新文案；「中途退出 fullscreen 的規則」由一段散文改為 4 點，
   新增 ⭐「失效範圍只有那一次 run，不會傳染」與「2026-09-15 之前**不成立**」的斷代說明。
2. **§4.4 新增「掉出全螢幕之後要怎麼救回這一項」**：4 步，含三條失敗分支的**逐字**狀態文案，
   並寫明「重新測試＝重跑本項，不是接續錄製」（FR-70.11）。
3. **§8.3 故障排除**：原 1 列（舊措辭）擴為 **4 列** —— 橫幅、恢復畫面為何出現、fullscreen 被拒、閘沒過。
4. **§0.1 名詞速查**（`suspect` 補效力單位 + 新增「恢復條件」）、**§10 SOP 速查卡**（新增「掉出全螢幕了」段）、
   **附錄**（補 `pause-invalid-restart.md` 與新清單兩列）。

### T6.6 `CONTEXT.md` / `schema.md` / `pause-invalid-restart.md`（步驟 6、7、8）

- **`CONTEXT.md` §A** 新增 **run 級條件失效／恢復條件**一條，緊接 `paused-invalid attempt` 之後
  （兩者必須相鄰閱讀）。含 run 的定義、旗標鏈路、三構念區分、恢復＝restart 的語意。
- **`schema.md` §`meta.validity`**：intro 由「six／two later fields」改為 **seven／three**；新增
  `fullscreenExited` 列；新增 **三構念對照表**（各自回答什麼問題／效力單位／後果）與一段
  「`Esc` 通常三者皆真，但切視窗／`exitFullscreen()` 只觸發 fullscreen 這一項」的具體說明；
  並修正 `suspect` OR 集合的敘述（舊文只列到 `perfFloor`，實際還有 `pointerLockLost`／`pauseOccurred`，
  現再加 `fullscreenExited`，並註明 **session 級 contributor 已移除**）。
- **`pause-invalid-restart.md`**：新增「掉出全螢幕時：恢復實驗條件」一節（含 WP-69 三態 vs 本 WP 的
  **兩欄對照表**）、在「重新測試」那一列補上 flagged 分支、現場檢查清單由 5 條加到 **7 條**
  （新增「先出現恢復畫面而非直接重跑」與「下一場 `fullscreenExited: false`」兩條可勾選的現場證據）。

### T6.7 FM-70.4 實機手動清單（T5.6 交棒 (b)）

新檔 [`docs/operational/fullscreen-recovery-manual-check.md`](../../../../operational/fullscreen-recovery-manual-check.md)。
**它存在的理由寫在 §0**：`page.evaluate()` 自帶 user activation ⇒ 即使把 `requestFullscreen()` 寫在
`await` 之後，e2e 照樣全綠；source-scan 抓得到**程式碼形狀**改變，抓不到**瀏覽器行為**改變，
而後者每次 Chromium 改版都可能發生。

內容：何時要跑（4 個觸發條件，含「主版號變動後的第一次正式收案前」）、環境記錄表（含完整瀏覽器版本欄）、
**12 步可勾選流程**（步驟 7 標 ⭐ = FM-70.4 的整個實質內容）、步驟 7 失敗的判讀與處置
（明寫「**不要**改成先 await 再請求來繞過」）、§4 **這份清單不宣稱的事**、§5 執行紀錄表。

⚠️ **目前 §5 執行紀錄為空**——清單存在不等於跑過。實機執行的 owner 與時機留給 T-exit／操作員。

### T6.8 舊措辭殘留點清理（步驟 9）

T3 的 DoD 要求交一份清單給 T6，**但 T3 沒有交**（progress §T3 無此節）⇒ 本 task 自己以 grep 重建並逐條處置。

`grep -rn "本 session 資料標記為 suspect"` 命中 **11 處**，逐條處置：

| 處 | 處置 |
|---|---|
| `EligibilityGate.ts:79` | ✅ 已改（第一個切片）。剩下的命中是**新註解在解釋舊文案**，刻意保留 |
| KI-040 檔頭／§6.1／§6.2（3 處） | **保留** —— 診斷紀錄引用當時的症狀原文，改掉等於竄改病歷 |
| `DECISIONS.md` GD-47「來源」格、`BUGFIX-DECISIONS.md` BD-040「發現處」格 | **保留** —— 引用使用者回報的逐字原文 |
| WP-70 README FR-70.7／T3／T6 task 檔／progress §T3.4 §T5.6（5 處） | **保留** —— 規劃文件描述「要改掉的那個字串」，是規格不是措辭 |

⇒ **live UI／操作員文件的命中數 = 0**；其餘皆為引用，逐條有理由（DoD 的括號條款）。

另外掃到**三處不是措辭、而是被本 WP 證偽的宣稱**，一併修正（comment-only，零行為改動）：

| 處 | 原本宣稱 | 為什麼必須改 |
|---|---|---|
| [`experimentSession.ts`](../../../../../src/display/experimentSession.ts) 檔頭 + 兩處欄位註解 | 「`suspect`:OR 進匯出 meta 的 suspect」「保留 gate/suspect 供最後一次匯出讀取」 | **T1 之後是假的**。留著等於叫下一個讀者相信這個欄位還在餵匯出——那正是缺陷 A 的認知來源 |
| [`main.ts`](../../../../../src/main.ts) 資格閘區塊註解 | 「session 進行中退出 fullscreen → 標 suspect（OR 進匯出 meta）」 | 同上 |
| `main.ts` WP-58 T-exit 的 `exit()` 註解 | 「每個後續 standalone 匯出繼承該 session 的 `gate`/`suspect`」 | `suspect` 那一半已消失；`gate` 仍是 session 級且仍被繼承 ⇒ 補一句說明**這個 `exit()` 呼叫為何仍然重要**，避免下一個人誤以為它可以刪 |

⚠️ 與 [BD-039](../../../../known_issue/BUGFIX-DECISIONS.md) ③ 同一類動作：**被修復證偽的不變式宣稱必須跟著改**，
否則測試綠而註解騙人。三處皆只改註解，`git diff` 無可執行行變動。

### T6.9 證據（四閘）

| Command | Result |
|---|---|
| `npm.cmd run typecheck`（`tsc --noEmit` ×2） | exit 0 |
| `npx.cmd vitest run` | exit 0；**287 files**、**3751 passed / 2 skipped** —— 與第一個切片收尾**逐字相同**（本切片只動註解與文件） |
| `npx.cmd vitest run tests/regression` | exit 0；**324 passed**（與 T0.3 baseline 逐數相同，NFR-70.1 零漂移） |
| `npm.cmd run build` | exit 0 |
| `npm.cmd run graph:update` | exit 0（⚠️ 依 CLAUDE.md **不得**跑裸 `graphify update .`） |

### T6.10 DoD 對帳

- [x] `GD-47` 已落帳且**落帳前重查過編號**（證據 → [§T6.1](#t61-編號重查落帳前不沿用-t0)）
- [x] GD-10 的處置（**澄清**）已執行，**選擇理由寫在 `GD-47` ③** → [§T6.3](#t63-gd-10-的處置補澄清註記步驟-2)
- [x] `BD-040` 已落帳，含「偏離 KI-040 §6.2 初估」的具名說明（「偏離計畫」格 ①）→ [§T6.4](#t64-bd-040-落帳與-ki-040-狀態翻新步驟-34)
- [x] KI-040 狀態列 + BUGFIX-DECISIONS §1 索引列一致翻新（另補 KI-040 §9）
- [x] `operator-manual.md` §4.4／§8.3 已同步，且**實際 UI 字串逐字核對過**（來源逐條列於 [§T6.5](#t65-operator-manualmd逐字核對過的-ui-字串步驟-5)）
- [x] `schema.md` 有 `fullscreenExited` 條目並說明與另兩個構念的差異（三構念對照表）
- [x] 舊措辭掃描：**live UI／操作員文件命中 0**；其餘 10 處為引用，逐條有保留理由 → [§T6.8](#t68-舊措辭殘留點清理步驟-9)
- [x] `npm run graph:update` exit 0
- [x] 附加（T5.6 交棒 (b)）：FM-70.4 實機手動清單已落 `docs/operational/` → [§T6.7](#t67-fm-704-實機手動清單t56-交棒-b)

---

## T-exit 驗收閘（2026-09-16）

**判定：✅ 通過，WP-70 交付。** `git diff -- src tests` 為空（本閘零 production code、零測試改動）——
T-exit 只做**驗收**，不改行為；本閘發現的問題一律退回對應 task，不得就地補（同 D-70-T6-3 的原則）。
⚠️ 兩列標 🟡 **部分**、一筆 dead code 明帳、一條 OQ 具名遺留，**均不被「全綠」蓋過**（KI-040 §5 的教訓）。

### Tx.1 全量閘：精確計數與環境（步驟 3）

| 閘 | 命令 | 結果 | 對照 |
|---|---|---|---|
| typecheck | `npm.cmd run typecheck`（`tsc --noEmit` ×2） | **exit 0** | 同 T6.9 |
| build | `npm.cmd run build` | **exit 0**；209 modules，`index-DmIxk-in.js` **1,262.44 kB**（gzip 360.65 kB） | T0 baseline 1,258.13 kB ⇒ **+4.31 kB**（新旗標／parser／`ConditionRecoveryScreen` 197 行） |
| 單元全套 | `npx.cmd vitest run` | **exit 0**；**287 passed / 1 skipped（288 files）**、**3751 passed / 2 skipped（3753 tests）** | 與 T6.9 **逐字相同** ⇒ T6 之後零漂移 |
| 回歸 | `npx.cmd vitest run tests/regression` | **exit 0**；**33 files**、**324 passed** | T0.3 baseline **324** ⇒ **逐數相同**（NFR-70.1） |
| **Edge 全套 e2e** | `npx.cmd playwright test --project=edge --workers=1` | **exit 0**；**121 passed（21.5m）**，零 failed／零 flaky／零 skipped | T5.5 基準 **121** ⇒ **逐數相同** |

⭐ **回歸零漂移是「同一組測試」的比較，不是計數巧合**：`git diff 7bfeaef..HEAD -- tests/regression` 為**空**
（本 WP 一個回歸測試都沒加沒改）⇒ 324 = 324 是同集合、同計數、全通過。
同理 `tests/` 全 WP 只新增一檔（`wp70-fullscreen-validity.spec.ts`，+2 tests）⇒ **119 + 2 = 121**，
與本閘實測逐數吻合，**零既有 e2e 被改動或被本檔影響**。

**環境（本閘實測，未沿用前面的 task）**：

| 項 | 值 |
|---|---|
| git SHA | `fd7ddb3a859a3787b878d91aec481de1153b1c35`（branch `chore/agents-skills-tree`，工作樹 clean） |
| **瀏覽器（權威值＝測試內實測 UA）** | `Chrome/149.0.7827.55 … Edg/149.0.7827.55`，由 [E2E-1]／[E2E-2] 各自 `navigator.userAgent` 印出 |
| ⚠️ 瀏覽器（磁碟安裝值，**與上列不符**） | `C:\Program Files (x86)\Microsoft\Edge\Application\` 的目錄名與 `msedge.exe` ProductVersion 皆為 **153.0.4234.32**。兩者不一致的原因**本閘未查明** ⇒ **以實測 UA 為準**（那才是真的跑了測試的那個 runtime）；填 [實機手動清單](../../../../operational/fullscreen-recovery-manual-check.md) §2 的「瀏覽器版本」時**一律填瀏覽器自報值**，不要填檔案屬性 |
| Playwright | **1.61.1** |
| cross-origin isolation | `crossOriginIsolated === true` —— [`wp70-fullscreen-validity.spec.ts:226`](../../../../../tests/e2e/wp70-fullscreen-validity.spec.ts#L226) 在**兩個** WP-70 test 的進場路徑上都斷言，且兩份 evidence log 各自複印一次 |
| WP-70 全 WP diff | `7bfeaef..HEAD -- src tests`：**19 檔、1669 insertions / 33 deletions**；production（非 `.test.ts`）**7 檔**。`src/sim`／`HitDetector`／`TargetManager`／`research/`／`tests/regression` **皆零改動** |

#### Tx.1.1 ⭐ 本閘取得的 live payload 證據（FR-70.1 最強的一組）

[E2E-1] 的 `WP70_SESSION_EVIDENCE`（**實際匯出的兩份 payload**，非記憶體旗標）：

```jsonc
"gateDetails": "native: FAIL — 原生 1280×720 vs 需求 1920×1080 / fullscreen: PASS / perf: PASS — warmup p95 4.21ms vs 地板 8.33ms",
"fullscreenLog": ["enter","exit","enter"],
"flagged": { "repIndex": 0, "validity": { …, "pointerLockLost": false, "pauseOccurred": false, "fullscreenExited": true  }, "suspect": true  },
"clean":   { "repIndex": 1, "validity": { …, "pointerLockLost": false, "pauseOccurred": false, "fullscreenExited": false }, "suspect": false },
"downloads": ["tracking_scene_v1-…T06_51_43.844Z.json", "tracking_scene_v1-…T06_52_12.974Z.json"]
```

**本閘恰好落在 perf 過地板的那一側（4.21 ms vs 8.33 ms）**，所以 S-70-T5-1／L4 描述的有利情境成立：

- 被標記的 rep 0：`perfFloor: false` 而 `suspect: true` ⇒ **`suspect` 純由 fullscreen 供應**，
  效能地板沒有參與 —— 這同時是 FM-70.1 在本次環境下**真的被 e2e 抓住**的那一次（見 Tx.6 B2 的條件）。
- 乾淨的 rep 1：`fullscreenExited: false` 且 **`suspect: false`** ⇒ T5 DoD 原文要的字面值
  **在本閘實際出現**（L4 的恆等式斷言 `suspect === perfFloor` 因此退化為 `false === false`）。
- 兩份 payload 有**不同的檔名時戳**（06_51_43 / 06_52_12）⇒ 確為兩次獨立的 run，不是同一份被讀兩次。

[E2E-2] 的 `WP70_RECOVERY_EVIDENCE`：`fullscreenLog: ["enter","exit","enter"]`（真的重取全螢幕）、
恢復畫面自報 `fullscreen: PASS — document.fullscreenElement 存在`、`native: FAIL`（構造保證的拒入錨點，D-70-T5-2 成立）、
`cursor: {phase:"run", itemIndex:0, repIndex:0}` 不變、`attempt: 2`、**`downloads: 0`**。
### Tx.2 Blast radius 重跑（步驟 2，grep 為權威）

⚠️ 依 [D-68.T0-4](../../stage13/wp-68-micro-flick-v9-measurement-parity/progress.md) 與 WP-69 T-exit 的二度複現，
**CodeGraph 對 caller 列舉不可採信** ⇒ 本節三項全部以 comment-stripped 的機械掃描取得，未使用 CodeGraph。

| 查核（T-exit 步驟 2 原文） | 方法 | 結果 |
|---|---|---|
| `experimentSession.suspect` 不再出現在 export 路徑 | 對 `src/main.ts`／`src/data/metadata.ts`／`src/data/export.ts` 去註解後掃 `experimentSession\s*\.\s*suspect` | **0 個 executable 命中**（`main.ts` 剩 2 處、`metadata.ts` 剩 2 處**皆為註解**，且是 T6.8 刻意改寫成「已不再供應匯出」的那批） |
| fullscreen 退出判準在 session 與 protocol 兩條路徑上是**同一個值**（C-D4） | 抽出 `fullscreenchange` handler 去註解後的全文，數 `const recording =` 宣告數與讀取該 const 的 sink 數 | **宣告 1 個、sink 3 個**（run 旗標／`experimentSession.handleFullscreenChange`／`markProtocolFullscreenExit`）⇒ 一套判準、三個 sink，**無第二次重算** |
| 恢復流程對五個推進／保存／下載入口零呼叫 | 對 `ConditionRecoveryScreen.ts` 全檔 + `recoverActiveCondition()` body 去註解後逐一計數 | 七個識別字（五個 DoD 入口 + `startSessionPlan`／`startProtocol`）**兩處皆 0** |

`fullscreenchange` handler 去註解後的全文（**三個 sink 共用同一個 `recording`**，C-D4 的機械證據）：

```ts
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement != null;
  const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';
  if (!fullscreen && recording) sharedState.validity.fullscreenExitedDuringRun = true;
  experimentSession.handleFullscreenChange(fullscreen, recording);
  syncFullscreenSuspectWarning();
  if (!fullscreen && recording) markProtocolFullscreenExit?.();
});
```

`recoverActiveCondition()` 去註解後的全文（**唯一的 orchestrator 動作是既有的 `restartActiveDrill()`**，FR-70.10）：

```ts
function recoverActiveCondition(): void {
  if (!sharedState.validity.fullscreenExitedDuringRun) { restartActiveDrill(); return; }
  conditionRecoveryScreen.open({ onRecovered: () => restartActiveDrill() });
}
```

⭐ **本閘把 C-D4 的查核往下推了一層**（超出步驟 2 的字面要求）：不只 handler 內只算一次，
**消費端也沒有人自己重算**。[`experimentSession.ts`](../../../../../src/display/experimentSession.ts) 全檔對
`drillRunner` 與 `phase ===` 的命中數為 **0** —— 它是**收參數** `handleFullscreenChange(present, recording)`，
而非自行判定錄製窗。⇒ KI-007 的錄製窗判準在整條鏈上**算一次、傳三處、無人重算**，C-D4 成立於模組層而不只語句層。

### Tx.3 Acceptance matrix — FR-70.1～70.11（步驟 1）

**讀法**：「單元證據」欄是**逐字測試名**（`describe` › `it`），全部由 `npx.cmd vitest run` 一次跑完（exit 0）；
「e2e／實機」欄的 `[E2E-1]`／`[E2E-2]` 指
[`tests/e2e/wp70-fullscreen-validity.spec.ts`](../../../../../tests/e2e/wp70-fullscreen-validity.spec.ts) 的兩個 test：

- **[E2E-1]** `WP-70 T5 — fullscreen validity lifecycle` › `a run that loses fullscreen is flagged and the next run in fullscreen is clean @slow`
- **[E2E-2]** `WP-70 T5 — fullscreen validity lifecycle` › `condition recovery re-enters fullscreen without advancing the session @slow`

**空白欄 = 該面沒有那類證據，不是漏填**；每一列的「判定」只在有具名證據時才是 ✅。

| FR | 單元證據（逐字測試名） | e2e／實機 | 判定 |
|---|---|---|---|
| **FR-70.1**<br>run 級、跨 run 不繼承 | `WP-70 T1 — 跨 run 不繼承（FR-70.1）` › `run N 錄製中退出全螢幕 → DrillRunner.start() 起的 run N+1 旗標為 false`；同 describe › `乾淨的 run N+1 匯出的 suspect 為 false（不繼承上一場的失效）`。⭐ 兩者都走**真的** `DrillRunner.start()` 而非直呼 `resetState()` —— 缺陷 A 的要害正是「歸零點有沒有接上」 | **[E2E-1]** 第 ④ 段：rep 2 起始 `fullscreenExitedDuringRun === false`，且 **rep 2 的實際匯出** `meta.validity.fullscreenExited === false` | ✅ |
| **FR-70.2**<br>`meta.validity.fullscreenExited` 具名欄 | `WP-70 T1 — 端到端：旗標 → 匯出（FM-70.2）` › `旗標為真 ⇒ meta.validity.fullscreenExited 與 meta.suspect 皆為真`；同 describe › `與 pointerLockLost 是兩個構念（Esc 同時觸發，視窗切換只觸發本欄）` | **[E2E-1]** 斷言的是**匯出 payload 的欄位**（非記憶體旗標）；**[E2E-1]** 的 `suspect === validity.perfFloor` 恆等式只有在本欄存在後才寫得出來 | ✅ |
| **FR-70.3**<br>optional-in／required-out，`schemaVersion` 維持 2 | `WP-70 T1 — export payload schema round-trip（FR-70.3）` › `帶 fullscreenExited: true 的 payload 解析後保留為 true` ／ `缺席 fullscreenExited 的舊 payload 解析為 false（optional-in，schemaVersion 維持 2）` ／ `非布林的 fullscreenExited 被拒（optional-in 不等於 lenient-in）`；另 `WP-70 T1 — 端到端…` › `collectMeta 缺欄補 false（optional-in / required-out，承 D-65-3）` ／ `collectMeta 拒絕非布林的 validity.fullscreenExited` | | ✅ |
| **FR-70.4**<br>零退出路徑逐位不變 | canonical digest 表：**8 筆中恰 3 筆移動、5 筆逐位不變**（Tx.4 以 `git diff` 機械複核）；`WP-70 T1 — 端到端…` › `旗標為假且無其他失效 ⇒ 兩者皆為假（一個每場都亮的旗標等於沒有旗標）`；`tests/regression` **324 = baseline 324** | **[E2E-1]** rep 2（全程在 fullscreen）的匯出 `fullscreenExited: false`、`pointerLockLost: false`、`pauseOccurred: false` | ✅ |
| **FR-70.5**<br>protocol 路徑套用 KI-007 錄製窗 | `WP-70 T2 — 非錄製中退出全螢幕不標記 protocol condition（FR-70.5）` › `idle（drill 之間）退出全螢幕 ⇒ 當前 condition 不被標記` ／ `ended（收工去抓匯出檔）退出全螢幕 ⇒ 當前 condition 不被標記` ／ `非錄製中的誤標不會滲進該 condition 的匯出`；source-scan `WP-70 T2 — main.ts 的接線（source-scan）` › `protocol 分派套用 recording 閘（FR-70.5 的修復點）` ／ `未閘的 markProtocolFullscreenExit 分派已不存在（FM-70.5：不得為求綠燈把閘拿掉）` | | ✅ |
| **FR-70.6**<br>橫幅由真值驅動 | `renders the fullscreen-exit banner from the current run flag without creating another DOM node`；`WP-70 T3 main.ts suspect banner wiring` › `renders the banner from sharedState.validity.fullscreenExitedDuringRun` ／ `syncs after fullscreenchange updates the per-run flag` | **[E2E-1]**：rep 1 退出後橫幅 visible；rep 2 起始橫幅**自動收起**（沒有任何人呼叫 `hideSuspectWarning()`） | ✅ |
| **FR-70.7**<br>run 級文案 | `states run-scoped invalidity in the banner instead of session-scoped wording`（T6 第一個切片補結；改動前該筆實測轉紅） | T6.8 措辭掃描：**live UI／操作員文件命中 0**，其餘 10 處為引用且逐條有保留理由 | ✅ |
| **FR-70.8**<br>不重啟 plan 的恢復入口 | `createConditionRecoveryScreen` › `reruns fullscreen plus the three-check gate and calls onRecovered only after pass`；`WP-70 T4 condition recovery source guards` › `routes pause restart through recovery without advancing, completing, exporting, or saving` | **[E2E-2]** 第 ③ 段：flagged run 的「重新測試」**開恢復畫面而非直接 restart**；點「重新進入 fullscreen」**真的重取 fullscreen**（`fullscreenLog === ['enter','exit','enter']`，恢復畫面自己的報告 `fullscreen: PASS`） | ✅ |
| **FR-70.9**<br>user gesture 內請求；失敗留在原畫面、具名可重試 | `calls requestFullscreen synchronously inside the click stack before warmup awaits`；`rejected fullscreen request does not probe, recover, restart, advance, export, or save by proxy`；`failed gate shows details and does not call the recovery callback`；source guard `calls requestFullscreen before the first await in the recovery click path` | **[E2E-2]**：閘不過 ⇒ 畫面**留在原地**、`role="status"` 為「條件仍未通過，請修正後重試。」、「重試條件檢查」可按。⚠️ **user-gesture 那一半 e2e 守不住**（限制 L1）——見 Tx.6 | 🟡 **程式層 ✅／實機層未證**（見 Tx.6 B1） |
| **FR-70.10**<br>不推進 orchestrator、不改 cursor／`exports[]`、不下載 | source guards `keeps the recovery screen decoupled from session/protocol orchestrator entry points`（7 個識別字全 0）／`routes pause restart through recovery without advancing, completing, exporting, or saving`；spy：`probeWarmupP95Ms`／`runGate`／`onRecovered` `.not.toHaveBeenCalled()` | **[E2E-2]**：`readSessionCursor()` 逐位相等（`toEqual(cursorBefore)`）、`readAttemptNumber()` 不變、`readDownloads()` 長度 **0**、`#result-screen` hidden | ✅ |
| **FR-70.11**<br>「繼續本項」＝ restart 本項，文案不得暗示接續錄製 | `routes pause restart through recovery without advancing…` 釘住 `onRecovered: () => restartActiveDrill()`（唯一 orchestrator 動作＝既有的整場 restart，承 WP-69 OQ-69.4） | 措辭掃描：`src/ui/`＋`main.ts` 的 live UI 對 `繼續本項｜接續｜續錄｜繼續錄製｜恢復錄製｜從中斷處` **命中 0**；入口按鈕字面即 `PauseOverlay.ts` 的 `RESTART_LABEL = '重新測試'` | ✅ |

### Tx.4 Acceptance matrix — NFR-70.1～70.6

| NFR | 證據 | 判定 |
|---|---|---|
| **NFR-70.1**<br>跨 FPS 逐位不變、regression 零漂移 | `npx.cmd vitest run tests/regression` = **33 files / 324 passed**，與 T0.3 baseline **324 逐數相同**；其中 `決定性回歸（完整 sim）★M1 守護 — 同輸入序列、不同 render FPS → 逐 tick 狀態一致（FR-9.3）`（16 tests，含 `四種 FPS 序列的最終狀態彼此 bit-exact 相等`）。**反證面**：`git diff 7bfeaef..HEAD -- src/sim src/drill/HitDetector.ts src/drill/TargetManager.ts` = **空** | ✅ |
| **NFR-70.2**<br>digest 移動筆數事前預測 = 事後逐筆吻合 | 預測 D-70-T0-3 = **3 筆**（`09_18_05`／`09_24_18`／`09_37_24`）。**本閘以 `git diff 7bfeaef..HEAD -- src/data/exportPayloadSchema.test.ts` 機械複核整個 WP 的淨變動**：digest 表恰 **3 行 `-` / 3 行 `+`**，且正是預測的那三個檔名；其餘 5 筆**無任何 ± 行**。**第 4 筆未出現** | ✅ |
| **NFR-70.3**<br>不新增 sim／`SharedState` 熱路徑工作 | `src/state/SharedState.ts` 的全部改動＝`validity` 物件上**一個固定布林欄位** + `createSharedState()` 既有字面值加一鍵 + `resetState()` 加一行歸零。**無新配置、無 resize、無 `push`**；`src/sim` 零改動 | ✅ |
| **NFR-70.4**<br>DOM 建構期一次配置，零框架 | `open and retry reuse the existing DOM nodes`；`ConditionRecoveryScreen.ts` 全檔 197 行純 `document.createElement` + `style.cssText`，零框架 import（D1） | ✅ |
| **NFR-70.5**<br>五個入口呼叫數皆 0，由 spy 反證 | 見 FR-70.10 列。⚠️ **證據形狀明帳**：直接 `vi.fn()` spy 的是 `probeWarmupP95Ms`／`runGate`／`onRecovered`；`sessionPlanRunner.advance`／`completeCurrentCondition`／`downloadJSON`／`historyPersistence.save` 的「零呼叫」是**結構性不可達**（模組不 import、`recoverActiveCondition()` body 不含該識別字）＋ **[E2E-2]** 的可觀察後果（cursor／attempt／downloads／Result 全不動），**不是**對這四個符號各掛一個 spy | ✅（形狀已具名） |
| **NFR-70.6**<br>Chrome/Edge 實機 e2e 覆蓋完整鏈路 | `npx.cmd playwright test --project=edge --workers=1` **exit 0／121 passed（21.5m）**，其中 [E2E-1] 56.6s、[E2E-2] 7.6s；鏈路四段各有具名斷言（T5.2），且本閘的 `WP70_SESSION_EVIDENCE` 以**實際匯出 payload** 作證（Tx.1.1）。瀏覽器自報 **Edg/149.0.7827.55**、Playwright **1.61.1**、`crossOriginIsolated === true` | 🟡 **鏈路 ✅／activation 半邊未證**（見 Tx.6 B1） |

⚠️ **FR-70.1 的證據形狀（明帳，避免單列 ✅ 讀起來像單一測試涵蓋全鏈）**：單元層的兩條「跨 run 不繼承」
測試是**直接把旗標設為 true**（`state.validity.fullscreenExitedDuringRun = true`）再跑真的
`DrillRunner.start()` —— 它們證的是**歸零點確實接上**（缺陷 A 的要害），**不**驅動真的 `fullscreenchange`。
DOM 事件 → 旗標那一段由 source-scan（`fullscreenchange 處理器沿用同一個 recording 判準`）與
**[E2E-1] 的真 `document.exitFullscreen()`** 承擔。⇒ **三層合起來覆蓋整條鏈，但沒有任何單一測試橫跨全鏈**；
拆任何一層都會留下缺口。

### Tx.5 專項驗證（步驟 4）—— 兩個方向都要有證據

T-exit DoD 明文：「跨 run 不繼承、run 內未放寬 —— **兩個方向都有證據**（只證一邊不合格）」。
本 WP 同時含**放寬**（跨 run 污染消失）與**收緊**（protocol 路徑補閘、D-70-T1-2）兩個相反方向，逐一分列：

| 方向 | 主張 | 具名證據 | 判定 |
|---|---|---|---|
| **放寬（意圖之內）** | run N 標記 ⇒ run N+1 乾淨 | `run N 錄製中退出全螢幕 → DrillRunner.start() 起的 run N+1 旗標為 false`；`乾淨的 run N+1 匯出的 suspect 為 false（不繼承上一場的失效）`；**[E2E-1]** rep 2 的實際匯出 `fullscreenExited: false` | ✅ |
| **未放寬（反方向）** | 同一 run 內退出 ⇒ 仍標記，且一路帶到 `ended` | `WP-70 T1 — run 內的偵測未被放寬（README §3 的反方向證據）` › `同一場內置真後，drill 一路跑到 ended 仍為真`；**[E2E-1]** rep 1 的實際匯出 `fullscreenExited: true`、`suspect: true` | ✅ |
| **收緊 ①（T2，protocol 路徑）** | 非錄製窗退出**不再**標記 | `idle（drill 之間）退出全螢幕 ⇒ 當前 condition 不被標記`；`ended（收工去抓匯出檔）退出全螢幕 ⇒ 當前 condition 不被標記`；`非錄製中的誤標不會滲進該 condition 的匯出` | ✅ |
| **收緊 ①ʹ（成對的另一半）** | 錄製窗退出**仍**標記（收緊不得誤傷偵測） | `countdown 退出全螢幕 ⇒ 當前 condition 標記為 fullscreen-exit`；`running 退出全螢幕 ⇒ 當前 condition 標記，且標記進得了匯出`；`錄製中「進入」全螢幕不是失效事件 ⇒ 不標記` | ✅ |
| **收緊 ②（T1，D-70-T1-2）** | 新旗標**不**以 `experimentSession.active` 為前提 ⇒ 研究員／一般 drill 模式錄製中退出也會標 | `fullscreenchange 處理器沿用同一個 recording 判準，不另開第二套（C-D4）`；理由與實務差異記於 [§T1.4](#t14-一處刻意的語意收緊d-70-t1-2) | ✅ |

**T2 期望值變動的既有測試（DoD 要求逐條有理由）**：**0 條**。
[§T2.4](#t24-既有測試期望值的變動零逐條理由fm-705) 已逐條說明為何既有 protocol 測試全部不受影響
（它們都在 `running` 相位觸發退出，落在閘的**通過側**）⇒ FM-70.5「為求綠燈把閘拿掉」在本 WP 沒有發生的空間：
source-scan `未閘的 markProtocolFullscreenExit 分派已不存在` 會在有人把閘拿掉時直接轉紅。

**T1 期望值變動的既有測試**：7 檔，全部是 required-out 的**機械後果**（typecheck 先報，不是測試先紅），
逐條理由見 [§T1.7](#t17-既有測試期望值的變動逐條皆為-required-out-的機械後果)。**沒有一條是放寬主張換綠燈。**

### Tx.6 具名邊界 —— 不得被「全綠」蓋過

T-exit 的職責之一是拒絕讓機械綠燈冒充行為證據（KI-040 §5 的教訓）。以下三條**帶進交付**，
每條都有 owner 與後續處置：

| ID | 邊界 | 現有守衛 | Owner / 後續處置 |
|---|---|---|---|
| **B1** ⭐ | **FM-70.4（`requestFullscreen()` 必須在第一個 `await` 之前同步呼叫）沒有 e2e 守衛。** 限制 L1：Playwright 的 `page.evaluate()` 對 CDP 帶 `userGesture: true`（T0 spike C/D 證實通過、spike F 證實 activation 閘本身有效）⇒ **把 `requestFullscreen()` 錯排到 `await` 之後的實作在 e2e 裡照樣全綠** | ① source-scan `calls requestFullscreen before the first await in the recovery click path`（抓**程式碼形狀**）；② 行為測試 `calls requestFullscreen synchronously inside the click stack before warmup awaits`（抓 rig 內的呼叫順序） | ⚠️ ③ [`docs/operational/fullscreen-recovery-manual-check.md`](../../../../operational/fullscreen-recovery-manual-check.md) 的 **§5 執行紀錄仍為空**——清單存在不等於跑過。**Owner = 使用者／操作員**；觸發時機已寫在該檔 §1（其一為「Edge 主版號變動後的第一次正式收案前」）。本閘**不**宣稱 FM-70.4 已由實機證實 |
| **B2** | **FM-70.1（`collectMeta()` 又把 `experimentSession.suspect` OR 回去）在破效能地板的機器上不被 e2e 可靠守住。** 限制 L4：`meta.suspect` 的另一半是效能地板，同一台機器實測在 4.36～15.7 ms 之間橫跳；地板破時 `suspect` 本來就是 `true`，會蓋掉迴歸 | source-scan `export 路徑不再讀 experimentSession.suspect（FM-70.1）`（本閘另以 comment-stripped 全檔掃描獨立複核 = **0**，見 Tx.2） | 已明帳於 e2e 檔頭與 [§T5.3](#t53-下一-run-乾淨的證據形狀l4nfr-706-的誠實邊界)。**無後續動作**：source-scan 是這一條的可靠守衛，e2e 只在機器夠快時順帶抓到。⭐ **本閘就是「夠快」的那一次**（warmup p95 4.21 ms vs 地板 8.33 ms）⇒ 被標記的 rep 0 量到 `perfFloor: false` 而 `suspect: true`，FM-70.1 **在本次環境下真的被 e2e 抓住了**。但這是**環境恩賜、不是保證**，下一台機器不必然重現 ⇒ 邊界照留 |
| **B3** | **OQ-70.4 仍開**：已下載到瀏覽器下載資料夾的舊匯出（repo 掃不到）是否需要操作員自查清單 | 判準已備妥（`BD-040`「遺留 OQ」／[KI-040 §9.4](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)）：修法**前**的 `suspect=true` 無法歸因，修法**後**可由 `meta.validity.fullscreenExited` 直接分辨 | **Owner = 使用者**，決定權未行使。`data/session-history/` 已確認**零筆**（KI-040 §8）⇒ **不阻塞交付**；舊匯出**不回填**（已拍板） |

另記一筆**非本 WP** 的既有 flake，以免下一個人把它當成 WP-70 迴歸：
`hit-feedback-live.spec.ts` 的 `@realgpu` 「換 drill」在**機器負載下**會紅（S-70-T5-3 已以 baseline worktree／
`--repeat-each=3`／淨空全套三組證據排除）。根因是 `loadScene()` 的 check-then-act 競態，不在本 WP 範圍。

### Tx.7 狀態一致（步驟 5）—— DoD 的七處，外加 `BUGFIX-DECISIONS` 索引列共八處

| # | 位置 | 本閘前 | 本閘後 |
|---|---|---|---|
| 1 | [`DECISIONS.md` `GD-47`](../../../DECISIONS.md) 狀態格 | ✅ 已落地，但註明「逐條 FR／NFR acceptance matrix 由 T-exit 產出，**在它落閘前本條不得被引用為『FR-70.1～70.11 全數驗收』**」 | ✅ 已落地**且已驗收**：matrix 見本節 Tx.3／Tx.4，並帶 **B1／B2** 兩條具名邊界 |
| 2 | GD-10 處置 | 補澄清註記、條文一字未動（T6.3） | **不變**（本閘複核：澄清註記與 `GD-47` ③ 對得上，用詞澄清與 fullscreen 兩件事都在註記內） |
| 3 | [KI-040](../../../../known_issue/KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md) 檔頭狀態 | ✅ 已修，附同一句「matrix 待 T-exit」的但書 | ✅ 已修**且已驗收**（但書換成本閘的具名結論 + B1／B3 遺留） |
| 4 | [`BUGFIX-DECISIONS.md`](../../../../known_issue/BUGFIX-DECISIONS.md) §1 索引列 | ✅ 已修（…；FR／NFR acceptance matrix 待 T-exit） | ✅ 已修（…；acceptance matrix 已於 T-exit 落閘） |
| 5 | [stage16 index](../README.md) | 🟡 T0–T6 ✅，T-exit 未開 | ✅ **已交付** |
| 6 | [top index `README.md` §2](../../../README.md) | 🟡 進行中 —— T0 ✅，**T1 未開工**（自 T0 起未再更新，已嚴重過期） | ✅ **已交付（T-exit）**，含 T1–T6 的實際結論 |
| 7 | [`task-checklist.md`](task-checklist.md) | T-exit ⬜ | T-exit ✅ |
| （8） | 本檔 `progress.md` | Snapshot「T-exit is next」 | Snapshot／Task log／本節同步 |

**資料夾位置**：**留在 `active/stage16/`**，不移入 `completed/`。依既有先例——WP-69 的 T-exit 已於
2026-09-15 落閘，`stage15/` 仍在 `active/`——`CLAUDE.md` §3.5 的「視需要移入 `completed/`」在近期 stage
並未行使。此處**明帳而非靜默**：若日後要整批歸檔，stage15 與 stage16 應一起處理。

**OQ 收尾**：OQ-70.1 ✅（T0 實測，帶 L1～L3）／OQ-70.2 ✅（T1，D-70-T1-1 含清理觸發條件）／
OQ-70.3 ✅（T0，D-70-T0-5）／**OQ-70.4 🟡 仍開**（owner = 使用者，不阻塞交付，見 Tx.6 B3）。
⇒ **四條全部關閉或具名遺留（含 owner）**。

### Tx.8 DoD 對帳

- [x] FR-70.1～70.11 與 NFR-70.1～70.6 **無任何「完成」但無證據的列** —— 每列都連到逐字測試名；
      兩列標 🟡 **部分**（FR-70.9 的 user-gesture 半邊、NFR-70.6 的實機半邊）並在 Tx.6 具名 → Tx.3／Tx.4
- [x] **跨 run 不繼承、run 內未放寬兩個方向都有證據**（另含 T2 收緊的成對證據與 D-70-T1-2 的第二個收緊）→ Tx.5
- [x] T2 的收緊方向有成對證據；期望值變動的既有測試 **T2 = 0 條**（逐條理由）、**T1 = 7 檔且皆為 required-out 的機械後果** → Tx.5
- [x] 恢復入口對五個入口零呼叫有證據，**且證據形狀已具名**（spy ×3 + 結構性不可達 + e2e 可觀察後果）；
      cursor／attempt number／`exports[]`／downloads 逐位不變 → FR-70.10 列、Tx.2
- [x] canonical digest 移動 **3 筆**，與 D-70-T0-3 預測**逐筆吻合**（本閘另以 `git diff` 機械複核整個 WP 的淨變動）；
      `tests/regression` **324 = 324** 零漂移 → NFR-70.1／70.2 列
- [x] 全量驗證綠（typecheck／build／vitest／regression／Edge 全套 e2e，精確計數 + 環境記入）；
      **替代證據與未執行項逐條有 owner、原因、後續處置** → Tx.1、Tx.6
- [x] `GD-47`／GD-10 處置／KI-040／`BUGFIX-DECISIONS` 索引／stage16 index／top index／checklist／progress **八處一致** → Tx.7

### Tx.9 本閘發現的一筆 dead code（不在此就地刪，明帳並給觸發條件）

T3 把橫幅改為真值驅動後，`EligibilityGateScreenHandle` 的 **`showSuspectWarning()` / `hideSuspectWarning()`
在 production 已無任何呼叫點**：

| 符號 | production 呼叫點 | 測試內出現處 |
|---|---:|---|
| `showSuspectWarning()` | **0** | `EligibilityGate.test.ts:125`（行為測試仍走它）、`:199`（source-scan **反**斷言 `main.ts` 不得呼叫） |
| `hideSuspectWarning()` | **0** | `EligibilityGate.test.ts:127`、`:200`（同上） |

兩者現在只是 `renderSuspectWarning(true/false)` 的薄包裝。D-70-T3-1 記了「production 不再直接呼叫」，
但**沒有**記「留著還是刪掉、為什麼」——這正是 README §3「不得靜默留著」要避免的形狀。

**本閘的處置：不刪。** 理由：(a) T-exit 的職責是驗收既有證據，**不是改 production**（同 D-70-T6-3 對
「留給 T-exit」的否決理由，方向相反但同一條原則）；(b) 刪除會動到 `EligibilityGate.test.ts:199/200`
那兩條**正在當防線用**的反斷言（它們釘住「`main.ts` 不得走回命令式 show/hide」，是 FR-70.6 的守衛之一）。

**清理觸發條件（明帳）**：下一個碰 `EligibilityGate.ts` 的 WP 一併處理——把 `showSuspectWarning` /
`hideSuspectWarning` 從 handle 介面移除，並把 `:199/:200` 的反斷言改成釘 `renderSuspectWarning` 的正斷言
（反斷言的守衛價值必須先有替代，否則是拿掉防線）。與 [D-70-T1-1](#decision-log) 對 `experimentSession.suspect`
的處置同一種形狀：**保留 + 具名觸發條件**，不是靜默留著。

⚠️ 對照：`experimentSession.suspect` / `onSuspect` 的清理條件（D-70-T1-1：「若 T3 之後 `onSuspect`
也不再有消費者 ⇒ T3 一併刪」）**未被觸發**且義務已履行——`onSuspect` 仍有唯一消費者
（[`main.ts:599`](../../../../../src/main.ts#L599) `onSuspect: () => syncFullscreenSuspectWarning()`），
`suspect` 欄位仍是模組內的去重閂，D-70-T3-1 已重新回答「誰在讀它」。本閘複核通過，不另開帳。

### Tx.10 連結稽核（本閘順帶做的機械檢查）

本閘對七個被改動的文件做了 **693 個檔案連結** + progress 內 **31 個錨點**的機械解析：

| 檢查 | 結果 |
|---|---|
| progress 內部錨點 | **全數解析**。修掉一個**既有**壞錨（T4 task-log 那格的 `#t4-condition-recovery-entry-point2026-09-15`，少一個連字號）——成因是該標題用 **ASCII `( )`** 且括號前有空格（⇒ GitHub 會留下連字號），而本 WP 其他中文標題用**全形 `（ ）`**、前面沒有空格（⇒ 不留連字號）。兩種寫法在同一份文件裡混用就會踩到這個差異 |
| 本閘新增的連結 | **17 條全部解析**（693 − 676） |
| ⚠️ 既有壞連結（**非本 WP，不在此修**） | [`BUGFIX-DECISIONS.md`](../../../../known_issue/BUGFIX-DECISIONS.md) **4 條**指向 `exec-plan/active/stage4/…`（stage4 已移入 `completed/`）與 `research/out/overlay-contact-sheet.png`。**已確認在 `HEAD` 即存在**（stash 前後同樣 4 條），屬 WP-28／WP-31 的舊條目 ⇒ 依「T-exit 只驗收、不順手改別人的文件」原則**留給下一個碰 `BUGFIX-DECISIONS.md` 的 task**，此處明帳 |
