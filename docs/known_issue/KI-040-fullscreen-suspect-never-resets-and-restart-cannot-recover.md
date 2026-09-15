# KI-040 — `experimentSession.suspect` 永不復位，且「重新測試」無法把 Session Plan 的該項救回有效

> 類型：**cross-session state contamination + missing recovery path**（不是渲染失敗，也不是 WP-69 迴歸）。
> 三種後果：(a) 同一分頁內**之後每一場**匯出都被標 `meta.suspect=true`（靜默）；(b) Session Plan 的
> 該項在 Esc 之後**沒有任何操作可以救回有效**，只能 reload；(c) 若走資格閘重入，橫幅會消失但旗標仍
> 為 true ⇒ **UI 說沒事、資料說 suspect**。
> 狀態：🔴 **診斷完成（2026-09-15），修法待定**。使用者已定方向＝**維持 session 級語意，另補一個
> 明確的「回到 fullscreen 並繼續本項」入口**；具體修法待使用者複核本文件後拍板，故**尚未開 `BD-n`**。
> 標的：[`src/display/experimentSession.ts`](../../src/display/experimentSession.ts)（`suspect` 無復位
> 路徑）· [`src/main.ts`](../../src/main.ts)（唯一 `requestFullscreen()` 與唯一 `hideSuspectWarning()`
> 呼叫點都綁在資格閘 `onEnter`）· [`src/ui/EligibilityGate.ts`](../../src/ui/EligibilityGate.ts)（橫幅）。
> 相關：[GD-10](../exec-plan/DECISIONS.md)（fullscreen 退出 = session 級條件失效）·
> [KI-007](KI-007-suspect-flag-false-positive-post-drill-fullscreen-exit.md)（recording 窗界判準）·
> [GD-46](../exec-plan/DECISIONS.md#gd-46--wp-69-暫停後永久失去實驗效力時間戳不可信即丟棄只有整場-restart-可恢復資格2026-09-15-t-exit)／
> [WP-69](../exec-plan/active/stage15/wp-69-pause-invalid-restart/README.md)（attempt 級 pause/restart）。
> 發現脈絡：使用者 2026-09-15 以 Session Plan 實測回報「無論怎麼按『重新測試』，仍然出現『已離開
> fullscreen — 本 session 資料標記為 suspect(條件失效)』」，附兩張截圖（暫停面板、restart 後的
> armed 畫面，黃色橫幅在兩張裡都在）。

---

## 1. 症狀

操作員在 Session Plan 的某一項錄製中按下 `Esc`，接著：

| 動作 | 期望 | 實際 |
|---|---|---|
| 按 `Esc` | 解除滑鼠鎖定 | 暫停面板出現（WP-69）**且**黃色 suspect 橫幅出現 |
| 按「重新測試」 | 該項重跑且**有效** | 回到 `點擊左鍵開始`，但**橫幅還在**；重跑出來的資料仍 `suspect=true` |
| 再按幾次「重新測試」 | —— | 完全沒有變化 |

⚠️ **橫幅不是殘影**：`collectMeta()` 在 [`main.ts:914`](../../src/main.ts#L914) 直接讀
`experimentSession.suspect`，所以重跑後產生的**新** payload 真的帶 `suspect=true`。使用者的直覺
（「重測也是無效的」）是對的。

---

## 2. 根因 —— 一個按鍵、兩個層級，只有一個有出口

`Esc` 在 fullscreen ＋ Pointer Lock 同時生效時會讓兩個獨立的失效構念同時觸發（應用層無法區分是
一次按鍵解除兩者還是操作員按了兩次——這正是 [OQ-69.2](../exec-plan/active/stage15/wp-69-pause-invalid-restart/README.md)
所說的「Web API 無可靠方式區分」）：

| 觸發 | 構念 | 層級 | 擁有者 | 復原路徑 |
|---|---|---|---|---|
| Pointer Lock 遺失 | `runAttempt.validity = 'invalid-paused'` | **attempt 級** | WP-69 / GD-46 | ✅ full restart |
| Fullscreen 退出 | `experimentSession.suspect = true` | **session 級** | WP-20 / GD-10 | ❌ **不存在** |

「重新測試」是 WP-69 為 attempt 級失效造的出口。它在設計上**不可能**清掉 session 級的 suspect ——
兩者從來沒有接在一起。以下四個缺陷各自獨立成立。

### 缺陷 A —— `suspect` 在整個分頁生命期內永不復位（最嚴重，且靜默）

[`experimentSession.ts`](../../src/display/experimentSession.ts) 全檔對 `suspect` 只有兩個賦值：

```
:44   let suspect = false;    // 宣告初值
:63   suspect = true;         // handleFullscreenChange 內
```

`enter()`（[:56](../../src/display/experimentSession.ts#L56)）只設 `active` 與 `gate`，**不重設
`suspect`**；`exit()`（[:66](../../src/display/experimentSession.ts#L66)）刻意保留（docstring：
「保留 gate/suspect 供最後一次匯出讀取」）。模組沒有任何 reset API。

⇒ 一旦為 true，**同一分頁內之後的每一場**都髒：不只是重測，還包含**完全重開的新 Session Plan**、
protocol、standalone drill。這已經超出「該項無效」的範圍，是跨 session 污染。

> 📌 [WP-58 T-exit（OQ-58.7）](../exec-plan/active/stage12/wp-58-session-program-scheduler/README.md)修過**同源**問題——aborted session 讓
> `active` 留 true、「every later standalone export kept inheriting that session's `gate`/`suspect`」
> （[`main.ts:2205-2210`](../../src/main.ts#L2205) 的註解原文）。當時的修法是補 `exit()` 呼叫，
> **只治了 `active`，沒治 `suspect`**。`exit()` 依其設計本來就不清 `suspect`，所以同一條路徑上的
> 另一半今天仍然敞著。

### 缺陷 B —— 沒有任何路徑可以回到 fullscreen

全 repo 只有一個 `requestFullscreen()` 呼叫點：

```
src/main.ts:633   requestFullscreen: () => document.documentElement.requestFullscreen(),
```

且它綁在資格閘的 options 上，只有 `EligibilityGate.attempt()` 會用。
`restartActiveDrill()`（[:1908](../../src/main.ts#L1908)）＝ `drillRunner.restart()` ＋
`resetRunPresentation()` ＋ `buildSimLoop()` ＋ `drillRunner.start()`，**完全不碰 fullscreen，也不碰
`experimentSession`**。

⇒ `Esc` 之後操作員就留在視窗模式，畫面上沒有任何按鈕能把他放回全螢幕。

### 缺陷 C —— 橫幅的顯示條件與旗標真值脫鉤

`hideSuspectWarning()` 的 production 呼叫點只有一個：資格閘的
`onEnter`（[`main.ts:642`](../../src/main.ts#L642)）。這造成**雙向**錯誤：

- restart 後 `suspect` 仍 true、橫幅也不消 ⇒ 使用者看到的症狀（此處 UI 與資料**一致**，只是都錯）；
- 反過來，若真的走資格閘重入，`onEnter` 會 `hideSuspectWarning()` 但 `enter()` **不清 `suspect`**
  ⇒ **橫幅消失、資料仍 suspect**。這比目前的症狀更危險：操作員會以為條件已恢復。

### 缺陷 D —— WP-69 把缺陷觸發窗口顯著放大

WP-69 的 pause 刻意不擴充 `DrillPhase`（D-69.P1），`updatePauseRuntime()`
（[:1339](../../src/main.ts#L1339)）從不觸碰 `drillRunner` ⇒ **暫停期間 `drillRunner.phase` 仍是
`running`**。而 KI-007 的判準正是「`countdown`/`running` 才算條件失效」
（[`main.ts:672`](../../src/main.ts#L672)）。

⇒ 暫停可以持續數分鐘（操作員正在讀 overlay、決定要不要繼續），這**整段**期間任何一次離開全螢幕
都會把整個 session 標 suspect。WP-69 之前掉鎖不暫停、drill 跑到自然結束就進 `ended`，窗口短得多。
這不是 WP-69 的迴歸（行為本身沒改），但它讓一個既有缺陷變得**遠更容易踩到**。

---

## 3. 為什麼操作員現在完全卡住

資格閘是唯一的 fullscreen 入口，但在 plan 進行中重開它救不了：

1. `onEnter` → `startSessionPlan()` → `sessionPlanRunner.start(...)`；
2. `SessionRunner.start()`（[:222](../../src/session/SessionRunner.ts#L222)）在 phase 非
   `idle`/`done` 時直接 `throw new Error('SessionRunner is already active')`；
3. 被 [`main.ts:2290`](../../src/main.ts#L2290) 的 catch 接住 → 顯示「Session Plan 啟動失敗：
   SessionRunner is already active」並呼叫 `experimentSession.exit()`（session 就此結束，
   而 `suspect` 依然 true）。

就算沒 throw（例如 plan 已 `done`），`start()` 也是 `await enterStep(0)` ⇒ **整個 plan 從第一項重跑**。

> **現場唯一可靠的 workaround：重新載入分頁。** `suspect` 是 module 閉包變數且無 reset 路徑，
> 只有重新建構 `createExperimentSession()` 才會回到 `false`。

---

## 4. 影響面

| 面向 | 影響 |
|---|---|
| **既有資料** | ⚠️ 任一分頁在首次「錄製中退出 fullscreen」之後匯出的**所有** payload，`meta.suspect` 皆為 `true`。需回頭核對受影響 session 的匯出檔 |
| Sim / 命中 / 決定性 | **零影響**。`suspect` 是純觀測旗標，不進 sim、不改命中、不改 tick 演進 |
| Schema | **零影響**。`meta.suspect` 欄位語意與形狀不變 |
| WP-69 三態 | **零影響**。`pauseOccurred` / disposition 與 `suspect` 是獨立構念（FR-69.11 / GD-46 ⑤ 明訂），本 bug 不改變任何 disposition 判定 |
| History | `suspect=true` 的 assessment run **仍會存進 History**（`HistoryPersistence` 只排除 practice 與 WP-69 的 `invalid-attempt`，不排除 suspect）⇒ 污染的是 trend 的輸入品質，不是它的存取規則 |
| 效度宣稱 | 受影響 session 的資料**不應**在未標註的情況下進入分析。C-D3 的構念驗證閘與此正交 |

---

## 5. 為什麼全綠的測試沒抓到（含 WP-69 T-exit）

**每一條 WP-69 測試都在「從未進入 fullscreen」的狀態下跑。**

`tests/e2e/wp69-pause-invalid-restart.spec.ts` 的三條 orchestrator case 走
`__fpsTest.startSessionPlanWithoutGate()`（[`main.ts:1603`](../../src/main.ts#L1603)）——它呼叫
`experimentSession.enter(report)`，但**刻意跳過資格閘**，因此從不 `requestFullscreen()`。
⇒ `document.fullscreenElement` 恆為 null、`fullscreenchange` 從不觸發、`suspect` 恆為 false，
整個交互作用對這些測試**不可見**。

單元側同樣沒有防線：[`experimentSession.test.ts`](../../src/display/experimentSession.test.ts) 的
10 條測試涵蓋了「標記一次」「不重複觸發」「exit 後保留供匯出」「KI-007 窗界」，但**沒有任何一條**
斷言「`enter()` 後 `suspect` 回到 false」或「第二個 session 乾淨」。沒有測試覆蓋的行為，正是這裡
出錯的那一個。

⇒ **[WP-69 T-exit](../exec-plan/active/stage15/wp-69-pause-invalid-restart/progress.md) 的「完全交付、
無具名缺口」判定，對它所量測的範圍（FR-69.1～69.12／NFR-69.1～69.8）仍然成立**——那 20 條需求全部
是 attempt 級的 pause／time／disposition 語意，無一提及 fullscreen 或 session 級 suspect。本 bug 落在
**WP-69 需求本身沒有涵蓋的接縫**：WP-69 替 Pointer Lock 建立了「失效 → 可由 restart 復原」的語意
（GD-46 ⑤ 明確覆寫 GD-41），但 fullscreen 沒有跟著轉，兩者從此不對稱，而沒有任何一條需求負責這個
不對稱。這是**範圍缺口，不是假綠燈**——但它也說明 T-exit 那句「無具名缺口」只能約束被列舉的需求，
不能約束沒有人寫下來的交互作用。

---

## 6. 修法選項（**未定案**，待使用者複核後拍板）

使用者 2026-09-15 已定方向：**維持 session 級語意**（不把 fullscreen 退出降級為 attempt 級），
**另補一個明確的「回到 fullscreen 並繼續本項」入口**。以下按此方向展開，但細節仍待決。

### 必做且無爭議（不論最終選哪個入口設計）

**修 A**：`suspect` 必須有復位點。沒有人會主張「上一個 session 的 fullscreen 退出應該污染下一個
session」。候選落點是 `enter()`（語意最直觀：進入一個新 session ⇒ 條件重新評估一次，而 `enter()`
的前置正是剛通過的資格閘）。⚠️ 需一併確認不破壞 `exit()` 的「保留供最後一次匯出讀取」契約——
兩者不衝突（`exit()` 保留，`enter()` 才清），但要有測試釘住這個順序。

**修 C**：橫幅顯示必須由 `suspect` 真值驅動，而不是由「有沒有人呼叫 hide」驅動，否則缺陷 C 的
反向錯誤（UI 說沒事、資料說 suspect）會在修 A 之後仍然存在。

### 待決：「回到 fullscreen 並繼續本項」的入口設計

| 選項 | 作法 | 待評估的點 |
|---|---|---|
| **E1** | 暫停面板上增加第三顆鈕「回到全螢幕並繼續」，在 click user gesture 內直接 `requestFullscreen()`，成功後走既有 resume 流程 | user gesture 鏈：`requestFullscreen()` 與 `requestPointerLock()` 需在同一次 click 內先後請求，兩者都可能失敗 ⇒ 收斂路徑比 WP-69 現行的兩路再多一層 |
| **E2** | 另立一條獨立的「恢復條件」流程（重跑資格閘的 fullscreen＋perf 檢查但**不**重啟 plan），通過後才回到該項 | 較忠於 GD-10「條件要重新被證明」的原意；代價是要把 `startSessionPlan()` 與「進入 fullscreen」解耦（目前 `onEnter` 把兩件事綁死） |
| **E3** | 只做「不再污染後續」：修 A＋C，該項仍報廢，操作員手動重跑 plan | 最小；但沒有滿足使用者要的「繼續本項」 |

⚠️ **E1／E2 都必須回答同一個問題**：該項在 Esc 之前已經錄到的那段資料算什麼？WP-69 對此已有既成
答案（attempt 級：暫停中結算 ⇒ `pause-fence-unclosed` ⇒ `discarded`，見 OQ-69.4），所以「繼續本項」
實際上一定是「**restart 本項**」而非「接續錄製」——入口設計不應暗示後者。

---

## 7. 遺留 OQ

| ID | 問題 | 歸屬 |
|---|---|---|
| **OQ-KI-040-1** | 缺陷 D：WP-69 的暫停讓 `phase` 停在 `running` 數分鐘，KI-007 的 recording 窗界是否該把「paused」排除在條件失效之外？排除＝操作員可以在暫停中安全地離開全螢幕去處理事情；不排除＝維持現狀。這是 KI-007 判準的**再定義**，不宜夾帶在本 bug 的修法裡 | 待定，建議獨立處理 |
| **OQ-KI-040-2** | 受影響的既有資料要不要回溯標註？`meta.suspect=true` 本身是忠實的（條件確實失效過），但「因為上一個 session 而繼承」與「本 session 真的退出過 fullscreen」在資料上**不可分**。是否需要一個能區分兩者的欄位 | 待定 |
| **OQ-KI-040-3** | `startSessionPlanWithoutGate()` 讓全部 Session Plan e2e 在非 fullscreen 下跑 ⇒ 任何 fullscreen／資格閘相關的迴歸都不可見。是否要補一條**真的走資格閘**的 e2e？（Playwright 可否可靠取得 fullscreen 需先驗證） | 待定，屬測試基礎建設 |
