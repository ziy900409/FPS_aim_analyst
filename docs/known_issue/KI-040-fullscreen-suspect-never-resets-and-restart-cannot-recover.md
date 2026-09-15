# KI-040 — `experimentSession.suspect` 永不復位，且「重新測試」無法把 Session Plan 的該項救回有效

> 類型：**cross-session state contamination + missing recovery path**（不是渲染失敗，也不是 WP-69 迴歸）。
> 三種後果：(a) 同一分頁內**之後每一場**匯出都被標 `meta.suspect=true`（靜默）；(b) Session Plan 的
> 該項在 Esc 之後**沒有任何操作可以救回有效**，只能 reload；(c) 若走資格閘重入，橫幅會消失但旗標仍
> 為 true ⇒ **UI 說沒事、資料說 suspect**。
> 狀態：🟡 **診斷完成 + 方向已拍板 + 執行計畫已落（2026-09-15），實作未開工**。修法計畫見 **[WP-70](../exec-plan/active/stage16/wp-70-run-scoped-condition-validity/README.md)**（stage16，T0–T6 + T-exit）。判準改為 **run 級**（「session 斷掉
> 沒關係，只要同一個 drill 沒有中斷即可」），入口採 **E2**；詳見 §6。⚠️ 此判準修改觸及 **GD-10**，
> 除 `BD-n` 外**另需一條 `GD-n` 或對 GD-10 的明帳修訂**（OQ-KI-040-4）；兩個編號皆待落帳前重查，
> 故目前**尚未開號**。
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

## 6. 修法方向（使用者 2026-09-15 拍板，實作細節待展開）

> ⚠️ **本節取代先前記錄的「維持 session 級語意」方向。** 使用者在看過「你最初要的『重測後有效』
> 與『維持 session 級』互相矛盾」這個張力之後改口，逐字答覆為：
> **「session 斷掉沒關係，只要同一個 drill 沒有中斷即可」**。以較晚、且是在知情下做出的這一版為準。

### 6.1 拍板的判準：效力單位是 **run**，不是 session

`suspect` 的 fullscreen 成分改為以「**該次 run 的錄製窗內是否發生 fullscreen 退出**」判定，
而非「本 session 是否曾經發生過」。逐條後果：

| 情境 | 現行 | 拍板後 |
|---|---|---|
| run N 錄製中掉出全螢幕 | run N 起**之後全部** suspect | 只有 **run N** suspect |
| run N 被 restart，重跑全程在全螢幕 | 仍 suspect | **乾淨** |
| run N+1 全程在全螢幕 | 仍 suspect | **乾淨**（不論前面斷過幾次） |
| drill 之間（`idle`／`ended`）掉出全螢幕 | 不算 | **不算**（KI-007 既有判準，不變） |

⇒ 這讓 fullscreen 與 Pointer Lock 的語意**對稱**：WP-69 已經把後者定為 attempt 級且可由 restart
復原（GD-46 ⑤ 覆寫 GD-41），前者現在跟上。使用者最初的訴求（「重測該項**並且有效**」）因此成立。

⚠️ **這是對 [GD-10](../exec-plan/DECISIONS.md) 的語意修改，不只是修 bug。** GD-10 現行措辭是
session 級（橫幅文案「本 session 資料標記為 suspect」即其直接產物）。因此本案除了 `BD-n`，**還需要
一條 `GD-n` 或對 GD-10 的明帳修訂**（CLAUDE.md §7：跨 WP／跨文件的決策寫全域帳本）。落帳前需重查
最大已用編號。

### 6.2 修法（依 6.1 重寫，與先前版本不同）

**修 A′（形狀已改變）**：先前寫「在 `enter()` 復位」，那是 session 級前提下的答案。在 run 級前提下
復位點必須是**每一次 run 的錄製窗開啟時**（`armed → countdown` 附近），而不是 session 進入時。
⚠️ 連帶：`experimentSession` 目前把 `suspect` 存成 session 級累加器，run 級語意下它應該**改為
per-run 計算**而非只是多一個 reset —— 這比原先估的變更大。`meta.display.gate` 維持 session 級不動。

**修 C（不變）**：橫幅顯示必須由旗標真值驅動，而非由「有沒有人呼叫 `hideSuspectWarning()`」驅動。
橫幅文案也要跟著 6.1 改寫 —— 現行的「本 session 資料標記為 suspect」在 run 級語意下是錯的。

**入口 = E2（拍板）**：另立獨立的「恢復條件」流程，重新請求 fullscreen 並重跑 perf 探測，通過後
回到該項，**不重啟 plan**。需把「進入 fullscreen」與 `startSessionPlan()` 解耦（目前 `onEnter`
綁死，且 plan 進行中重入會撞 `SessionRunner is already active`，見 §3）。perf 檢查可能失敗 ⇒
需要自己的收斂路徑。

> 📌 在 run 級語意下，E2 的**理由改變了**：它不再是「重新證明條件才能洗掉 session 旗標」（run 級
> 下旗標本來就只綁該次 run），而是「**操作員需要一條回到全螢幕的正規路徑**」，perf 重探是附帶的
> 額外保障。這不影響 E2 仍是正確選擇，但寫實作計畫時理由要寫對。

**「繼續本項」= restart 本項**：該項在 Esc 之前錄到的那段，依 WP-69 既成答案（OQ-69.4，暫停中結算
⇒ `pause-fence-unclosed` ⇒ `discarded`）不會留下 payload。入口文案不得暗示「接續錄製」。

### 6.3 其他拍板

- **OQ-KI-040-1（暫停窗界）**：**維持現狀，另案處理**。暫停中離開全螢幕仍算該 run 條件失效；不把
  KI-007 判準的再定義夾帶進本修法。（在 run 級語意下影響很小：那一次 run 本來就會被 restart 掉。）
- **既有資料**：**先查範圍再決定**。查核結果見 §8 —— 範圍為零，此項就此關閉。

---

## 7. 遺留 OQ

| ID | 問題 | 歸屬 |
|---|---|---|
| **OQ-KI-040-1** ✅ | 暫停期間離開全螢幕算不算條件失效 | **已答：維持現狀**，KI-007 判準的再定義獨立處理（§6.3） |
| **OQ-KI-040-2** ✅ | 受影響既有資料要不要回溯標註 | **已答：不需要**——查核後範圍為零（§8） |
| **OQ-KI-040-3** 🟡 | `startSessionPlanWithoutGate()` 讓全部 Session Plan e2e 在非 fullscreen 下跑 ⇒ fullscreen／資格閘相關的迴歸不可見。是否補一條**真的走資格閘**的 e2e？（Playwright 能否可靠取得 fullscreen 需先驗證） | **待定**，屬測試基礎建設。⚠️ 本 bug 的修法若沒有這條，修完仍然沒有迴歸防線 |
| **OQ-KI-040-4** 🟡 | §6.1 的判準修改觸及 GD-10，需開 `GD-n` 或明帳修訂 GD-10；編號須落帳前重查 | **待定**，屬全域決策帳本 |

---

## 8. 既有資料查核（2026-09-15）

| 位置 | 結果 |
|---|---|
| `data/session-history/`（**真正的研究 root**，D-48.P9） | **零筆已保存的 run** —— 目錄內只有 `README.md` 與 `.history-root.lease` |
| `.playwright-tmp/history-dev`／`history-preview` | 598 個參與者目錄，全部為 `e2e-*` 測試產物，非研究資料（NFR-48.6 要求測試用獨立 root，此處符合） |

⇒ **本機無受影響的研究資料**，OQ-KI-040-2 就此關閉，不需要稽核腳本或回溯標註。

⚠️ **唯一未能查核的範圍**：瀏覽器**下載資料夾**內的匯出 JSON（`downloadJSON()` 的產物）不在 repo
內，無法從這裡掃描。若你手上有先前下載的匯出檔要確認，判準是 `meta.suspect`；但**注意**在修法落地
前，「繼承自前一個 session」與「本 session 真的斷過」在 payload 上**不可分**（這正是缺陷 A 的後果），
只能靠操作紀錄回溯。本次回報的情境中該項從未完成 ⇒ 依 WP-69 三態根本不會產生 payload，與 history
root 為空一致。
