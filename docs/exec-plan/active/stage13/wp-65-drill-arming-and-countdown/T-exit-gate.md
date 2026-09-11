# WP-65 T-exit — 驗收閘：A-65.1～A-65.12 具名證據

## Objective

把 WP-65 的交付宣稱**逐條化為可稽核證據**。每一條 A- 必須指向指令 + 輸出、斷言檔名 + 案例名，或實機證據（截圖／錄影／數值）記於 `progress.md`。任何一條只能寫「已完成」的，視同未通過。

同時把 [GD-41](../../../DECISIONS.md) 本體落帳（規劃期只留草稿，比照 WP-63 D-63-P6 先例）。

## 驗收矩陣

| # | 宣稱 | 對應 FR/NFR | 證據要求 |
|---|---|---|---|
| **A-65.1** | drill 載入後停在待命，不 spawn、不計時、不錄有效 tick | FR-65.1 | T1 的污染反證測試案例名（5 個 Map/陣列皆空）+ T2 的實機錄影 |
| **A-65.2** | 解除待命的訊號走 `SharedState`，input 寫 / sim 唯讀 | FR-65.2 | `git diff` 顯示 `armRequested` 的唯一寫入點在 `main.ts` 的 `onChange`、唯一讀取點在 `DrillRunner.tick()` |
| **A-65.3** | 待命閘為 opt-in，舊行為逐位不變 | FR-65.3 / NFR-65.1 / NFR-65.2 | FM-1 反證案例名 + `tests/regression/` 零修改通過的 `npx vitest run tests/regression` 輸出 |
| **A-65.4** | 四條 start 路徑一致進待命，含 Session Plan 每個 block | FR-65.4 | T2 的五項實機驗證（restart／換武器／換場景／換 drill／Session Plan 2-item program） |
| **A-65.5** | arm 手勢不被記為開火 | FR-65.5 | 匯出中 `events` 的 `type === 'fire'` 筆數（未開火前提下為 0），數值記於 `progress.md` |
| **A-65.6** | 倒數可見：待命提示 + 3/2/1 | FR-65.6 | T3 三張截圖 + `DrillStartOverlay.test.ts` ≥ 9 條斷言 |
| **A-65.7** | 時限型倒數、計數型維持正計時 | FR-65.7 | `spider_shot_v3` 與 `counterstrafe_cued_v1` 各一段錄影 + HUD 測試 ≥ 7 條 |
| **A-65.8** | 待命／倒數期 Time 卡顯示起始值不閃動 | FR-65.8 | T4 實機錄影 |
| **A-65.9** | 錄製中掉鎖翻旗標，且 sim 不中斷 | FR-65.9 | ESC 中斷 run 的四項佐證（續跑／旗標 true／suspect true／Result 警示） |
| **A-65.10** | 旗標進 `meta.validity` 且併入 `suspect` | FR-65.10 | `meta` 鍵集合與 T0 基線逐字比對 + `metadata.test.ts` 案例名 + Python `load_export()` 實跑輸出 |
| **A-65.11** | Result 顯示建議重測警示 | FR-65.11 | 截圖 + `ResultScreen.test.ts` 3 條 |
| **A-65.12** | 非錄製期掉鎖不誤報 | FR-65.12 / FM-3 | **三場乾淨 run 的 `pointerLockLost` 皆 false** 的三個實測值 + 待命期／`ended` 期各一次手動掉鎖的值 |

> A-65.12 是整份驗收裡**最不能通融**的一條。一個每場都亮的效度旗標比沒有旗標更糟：研究者會學會忽略它，於是真正失效的那一場也被忽略。

## Steps

1. 逐條填寫上表的證據欄，證據本體寫入 `progress.md §T-exit`。
2. **最終全量閘**（四項皆須貼出實際輸出，非「已跑過」）：
   - `npm run typecheck` ×2 → exit code
   - `npx vitest run` → `N passed / M skipped` + 與 T0 基線的差額逐條說明
   - `npx playwright test --workers=1` → `N passed / 0 failed` + 耗時 + 執行前後 `.playwright-tmp/history-dev/` 目錄數
   - `npm run build` → exit code
3. **硬約束 diff 檢視**（README §2b 的可執行佐證）：
   - `git diff main...HEAD -- src/ | grep -n "Date.now"` → 應為空
   - `git diff main...HEAD -- src/ | grep -n "Math.random"` → 應為空
   - `git diff --stat main...HEAD -- research/` → 應為空（C-D1）
   - `git diff --stat main...HEAD -- src/display/experimentSession.ts` → 應為空（D-65-4）
   - `git diff --stat main...HEAD -- src/input/PointerLock.ts src/input/InputSampler.ts` → 應為空
4. **[GD-41](../../../DECISIONS.md) 落帳**（本體，非草稿）。至少涵蓋：
   - ① 待命閘為 `createDrillRunner` 的 opt-in option 而非全域預設（D-65-2），及其對 35 個 caller 的相容策略。
   - ② 解除待命 = 取得 Pointer Lock，且 `start()` 主動釋鎖（D-65-1），以及它為何順帶滿足「arm 不算開火」。
   - ③ `meta.validity.pointerLockLost` 的 optional-in / required-out 不對稱（D-65-3）。
   - ④ Pointer Lock 掉鎖與 fullscreen 退出為**兩個並存構念**，不合併（D-65-4）；連帶記錄 `corridorExceeded` 不併入 `suspect` 的既有不對稱為何保留。
   - ⑤ 待命期 `recorder.reset()` 的時機（D-65-5）與 `simStep` 不加相位閘的理由。
   - ⑥ **落帳前重查** `DECISIONS.md` 當下最大 GD；被平行 session 取用則依 GD-15 順延並同步全部連結。
5. **效度斷代記錄**（README §3.1-3）：本 WP 前後的資料在「開場段」不可直接混池比較。在 `progress.md` 明記，並向使用者確認是否需要 `meta` 版本標記——**若使用者要求，該標記屬新 WP，不在本 WP 夾帶**。
6. 翻狀態：本資料夾 `task-checklist.md` 全數 ✅；[stage13 README §2](../README.md) 的 WP-65 列翻 ✅ 並填入具名證據摘要；視需要把資料夾移入 `completed/`。
7. **OQ-65.4**（掉鎖是否需要即時 HUD 提示）在此結案：依實機回饋決定「不做／另開 WP」，寫明理由。

## Definition of Done

- [ ] A-65.1～A-65.12 **十二條全數**有具名證據（指令+輸出／檔名+案例名／截圖+數值），無任何一條只寫「已完成」
- [ ] A-65.12 的五個實測值（三場乾淨 + 待命期 + ended 期）逐一列出
- [ ] 四項最終全量閘的實際輸出已貼入 `progress.md §T-exit`
- [ ] 步驟 3 的五條 diff 檢視輸出已貼入（空結果也要貼，證明真的跑過）
- [ ] GD-41 本體六項已落入 `docs/exec-plan/DECISIONS.md`，且落帳前的編號重查結果已記錄
- [ ] 效度斷代已記錄，且使用者對「是否需要 `meta` 版本標記」的回覆已記錄
- [ ] `task-checklist.md` 全 ✅；[stage13 README §2](../README.md) 的 WP-65 列已翻 ✅
- [ ] OQ-65.1～65.4 四條全數結案（關閉或明確降級為非阻塞觀察項）

## Commit

```text
docs(wp-65): T-exit gate evidence for drill arming and countdown
```
