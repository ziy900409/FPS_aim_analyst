# 階段 G 驗收清單 G — WP-42 T-exit / M17（stage7 交付）

> M17（stage7 交付)的「選手測試流程前端優化」驗收對照。逐項對應 [stage7 README §4 里程碑門控](../exec-plan/completed/stage7/README.md#4-里程碑門控)列舉的 5 條完成條件,由 WP-40/41/42 既有測試證據 + WP-42 T-exit 新增的端到端補證覆核。
> Companion:[wp-40 progress](../exec-plan/completed/stage7/wp-40-quality-flag-visibility/progress.md) · [wp-41 progress](../exec-plan/completed/stage7/wp-41-seeded-counterbalance/progress.md) · [wp-42 progress](../exec-plan/completed/stage7/wp-42-session-orchestrator/progress.md)。

---

## 0. T-exit 執行基線(2026-08-25)

| 命令 | 結果 |
|---|---|
| `npm run test:ci`(WP-42 T1~T3 落地後的基線,新增 e2e 前) | ✅ exit 0;Vitest **130 files / 966 tests** passed;Playwright **21 tests** passed |
| 新增 [`tests/e2e/session-orchestrator.spec.ts`](../../tests/e2e/session-orchestrator.spec.ts)(見 §2 G-2 證據) | 首次執行:第一個測試以 `runCounterStrafeRound(4)` 只跑 4 peek 卻斷言 `ended`,失敗(`counterstrafe-reversal-v1`/`counterstrafe-free-v1` 的 `endCondition.value=20`,需完整 20 peek 才會 ended);改為不傳 `maxPeeks`(跑滿一輪)後複驗通過 — 修復記錄於 [wp-42 progress.md Surprises](../exec-plan/completed/stage7/wp-42-session-orchestrator/progress.md) |
| 順帶修復 [`tests/e2e/overlay-layering.spec.ts`](../../tests/e2e/overlay-layering.spec.ts) 的 `launchLabels`(WP-42 新增第 4 顆「Session Plan」啟動按鈕未被納入既有疊層回歸檢查) | ✅ 補上後複驗通過 |
| `npm run test:ci`(複驗,含新增 e2e) | ✅ exit 0;Vitest **130 files / 966 tests** passed;Playwright **23 tests** passed(+2:`session-orchestrator.spec.ts` 兩項) |

---

## 1. 清單 G 驗收項

| # | 驗收項(對應 stage7 README §4 條件) | 判定方式 | 證據入口 | 狀態 |
|---:|---|---|---|---|
| G-1 | Quality-gate 卡片對任一真實旗標即時反應,非硬編固定值 | **A**:各旗標觸發/未觸發情境的卡片內容/token 單元測試 | [`ResultScreen.test.ts`](../../src/ui/ResultScreen.test.ts)(WP-40 T1) | ✅ |
| G-2 | Session orchestrator 可無人工介入跑完「熱身 → 四家族(含休息倒數) → 收操」全流程,休息計時正確 | **A + 部分 M**(見 §1.1 說明) | 見下方 §1.1 | 🟡 見 §1.1 限定範圍 |
| G-3 | `buildFamilyOrder` 同 `participantId` 跨 `sessionIndex` 產生不同排列,且可重現 | **A**:同輸入同輸出、不同 `sessionIndex` 產生不同排列的決定性測試 | [`sessionSchedule.test.ts`](../../src/session/sessionSchedule.test.ts)(WP-41 T1) | ✅ |
| G-4 | 既有四家族決定性回歸測試零修改全綠 | **A**:`npm run test:ci` 全綠,且 WP-33~37 交付的四協定回歸測試檔案 `git diff` 為空 | §0 執行基線;`git diff --stat -- src/drill/hold_click_v1.ts src/drill/hold_track_v1.ts src/drill/spider_shot_v1.ts src/drill/counterstrafe_*.ts` 空(WP-42 只 additive 登記,未修改協定本體,見 [wp-42 README §1.1](../exec-plan/completed/stage7/wp-42-session-orchestrator/README.md#11-範圍)) | ✅ |
| G-5 | DPI 進入匯出 metadata | **A**:`Meta.dpi` additive 欄位單元測試 + session setup 表單輸入欄位 | [`metadata.test.ts`](../../src/data/metadata.test.ts)、[`SessionSetup.ts`](../../src/ui/SessionSetup.ts)(WP-40 T2) | ✅ |

### 1.1 G-2 的證據組成與範圍限定(誠實記錄,非阻塞)

G-2 由三層自動化證據共同支撐,逐層覆蓋「無人工介入」這句話的不同部分;**尚未執行的是最後一層人工手動的真原生滑鼠全場走查**,原因與既有先例一致(見下)。

| 層 | 驗證的是什麼 | 證據 |
|---|---|---|
| ① 狀態機自動推進(不需人工按「下一步」) | `SessionRunner.poll()` 在休息倒數歸零時**自動** `advance()`,不等待任何按鈕點擊;`advance()` 依序處理 warmup→family→rest→next family→done,無任何分支需要外部觸發 | [`SessionRunner.test.ts`](../../src/session/SessionRunner.test.ts)(序列/家族篩選/熱身降級)、[`SessionRunnerPoll.test.ts`](../../src/session/SessionRunnerPoll.test.ts)(rest 外無 op、到期自動前進) |
| ② 真實 DOM 接線(按鈕 → 表單 → 家族勾選/preset 選單 → eligibility gate) | main.ts 第 4 顆啟動按鈕「Session Plan」的完整點擊鏈路;FR-G9②(preset 只能選、UI 不得渲染自由數字輸入)在**真實渲染的 DOM**上直接斷言,不只是隔離元件的 unit test | [`tests/e2e/session-orchestrator.spec.ts`](../../tests/e2e/session-orchestrator.spec.ts) 第二個測試(真瀏覽器,Edge,點擊真實按鈕/填真實表單/勾選真實 checkbox) |
| ③ 新登記 drill 的建構鏈路本體(T1 §0-2 的原始風險) | `spider-shot-v1`/`counterstrafe-reversal-v1`/`counterstrafe-free-v1` 三個此前只被 unit test 用合成物件驗證過 schema、從未真正走過 `loadDrill()`→`createTargetManager()`→`createSimLoop()` 的 config,在真瀏覽器至少建構一次不拋錯;兩個 counter-strafe 變體另外跑滿一輪(20 peek)到 `ended` + 匯出 | [`tests/e2e/session-orchestrator.spec.ts`](../../tests/e2e/session-orchestrator.spec.ts) 第一個測試 |

**尚未覆蓋、刻意不在本次 T-exit 內補的部分**:①~③ 各自獨立驗證了「這一段不需要人為介入」,但**沒有**把四個家族串成一次連續的、由真人在真實硬體上戴 pointer lock、用真滑鼠瞄準/開火、實際等滿 60 秒休息倒數的單一 session 全場走查。這與既有先例([`full-drill.spec.ts` 檔頭註解](../../tests/e2e/full-drill.spec.ts)「真原生滑鼠無加速 / Pointer Lock 正向路徑 → 手動驗收(T4)」)一致:本 repo 對所有涉及 `EligibilityGate`(需要真實原生解析度/`requestFullscreen()`)的流程,一律用 `__fpsTest` 隔離管線(與 live 單例同源函式、不同實例)在 CI 驗證邏輯正確性,把「真人真滑鼠走一遍」留給 CI 之外的人工驗收,理由是 headless/CI 環境無法可靠取得原生螢幕解析度與 pointer lock 權限。§1 三層證據合起來對 G-2「無人工介入」這個**設計主張**(而非「有沒有真人看過螢幕」)給出了可稽核的機械證明;若研究者需要在正式收案前追加一次真人真硬體的完整 pilot session 走查,建議另開一個獨立的人工驗收記錄,不阻塞本 WP 的程式碼與文件交付。

---

## 2. 已知限制(隨 T-exit 一併記錄,非阻塞項)

- **G-2 真人真硬體全場走查未執行**:見 §1.1。與 WP-9(stage2)的既有先例一致,非本 WP 新增的降規格。
- **Spider Shot 家族沒有專屬的合成「擊殺一輪」round-runner**:`__fpsTest` harness 目前只有 counter-strafe/detection/tracking 三種形狀的便捷驅動器,spider-shot-v1 只驗證到「建構鏈路 → running → 首目標可見」,未驗證到 `ended`。補一個 spider-shot 專屬 round-runner 屬於協定本體(`src/drill/spider_shot_v1.ts`)的測試基礎設施,不在 WP-42(純 orchestration 層)範圍內,亦非 WP-42 新增的缺口(spider-shot-v1 此前完全沒有任何 E2E 覆蓋,即使在 stage6/WP-35 交付時也是如此)。
- **`hold-click`/`hold-track`/`spider-shot` 三家族無 Practice 變體**:D-42.2 已拍板為刻意設計(熱身直接降級為「本家族無熱身,直接開始正式測試」),非本次驗收才發現的限制,列在此處供交叉參照。

---

## 3. M17 判定

✅ **驗收清單 G 全項(G-1~G-5)通過**,其中 G-2 附帶 §1.1 的範圍限定與 §2 的已知限制(均非阻塞,理由與既有先例一致)。stage7(quality-gate 卡片動態化 + seeded counterbalance + session orchestrator)三個 WP 全數 T-exit,`npm run test:ci` 全綠(Vitest 130 files / 966 tests;Playwright 23 tests)。

**M17(stage7 交付)達成**:選手測試 SOP 的「怎麼操作一整場測試」在前端有實際支撐——quality-gate 卡片即時反應真實旗標、session 排程模組可依 `buildFamilyOrder` 的決定性順序自動跑完熱身/四家族/休息、DPI 進入一次性 metadata——不再需要人工排班 + 事後扒 JSON。§1.1/§2 的已知限制不阻塞 M17(這些是「留給人工驗收的正向路徑」與「協定本體既有的測試覆蓋缺口」,不是 WP-42 orchestration 層本身的設計缺陷)。
