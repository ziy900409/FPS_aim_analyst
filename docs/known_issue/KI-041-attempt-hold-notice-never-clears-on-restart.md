# KI-041 — attempt-hold 通知寫進 `#protocol-status` 後**永不清除**,「重新測試」重跑期間畫面仍寫「進度停在原處」

> 類型：**operator-facing stale status**(不是渲染失敗、不是誤判)。WP-69 T5 的 hold 文案判定**正確**、
> 寫入時機**正確**,但那條狀態列**沒有任何清除路徑**,於是它活過了操作員按下的「重新測試」,
> 在新一場倒數期間繼續宣稱「測試進度停在原處,未計入本項。請按「重新測試」重跑本項。」
> 狀態：✅ **已修 + 落地(2026-09-18)** —— 使用者拍板 **A1**(見 §5.2),落地實況見 §8。決策 `BD-041`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引 · §3 `BD-041`。
> 標的：[`src/main.ts`](../../src/main.ts) 的 `setProtocolStatus()`(`:2233`)／
> `holdOrchestratorsOnAttempt()`(`:1153`)／`resetRunPresentation()`(`:1846`)。
> 上游歸屬：**WP-69 T5**(FR-69.10,`#protocol-status` 的 hold 通知是該 task 的交付物);
> **不是 WP-70 的缺陷**(範圍界定見 §3)。
> 相關：[`AttemptFinalizationGate.ts`](../../src/attempt/AttemptFinalizationGate.ts) `describeAttemptHold()`(`:161`) ·
> [KI-040](KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md) 缺陷 C(**同型**:顯示與真值脫鉤,但在另一條通道) ·
> [WP-70](../exec-plan/active/stage16/wp-70-run-scoped-condition-validity/README.md) FR-70.6(修的是**另一個**橫幅)。
> 發現脈絡：使用者 2026-09-18 以 Session Plan 實測回報並附截圖 —— 畫面同時出現「準備 1」倒數
> (新一場已開始)與作廢橫幅。

## 1. 症狀

截圖的三個區塊互相矛盾:

| 畫面元素 | 顯示 | 真相 |
|---|---|---|
| 倒數 overlay | `準備 / 1` | 新的 attempt **已經開始**(`drillRunner.phase === 'countdown'`) |
| HUD | `Score 0` · `Time 01:00.0` · `Hit rate N/A` | 同上,這一場是全新的 |
| `#protocol-status` 橫幅 | `本次紀錄已作廢(暫停區間未閉合(在暫停中結束,或暫停期間時間軸仍前進)):測試進度停在原處,未計入本項。請按「重新測試」重跑本項。` | **上一場**的判定。第一句(進度停在原處、未計入本項)仍為真;**第二句(請按「重新測試」)已經被執行過了**,操作員正在看的就是那一按的結果 |

一句話:hold 文案描述的是**已經被處理掉的**那一場,但畫面上沒有任何東西表示它過期了。

## 2. 根因

### 2.1 這條橫幅是誰

- 文字唯一來源:[`AttemptFinalizationGate.ts:161-167`](../../src/attempt/AttemptFinalizationGate.ts#L161-L167)
  的 `describeAttemptHold()`,與截圖**逐字相同**。
- 承載元素:[`main.ts:2184-2228`](../../src/main.ts#L2184-L2228) 的 `#protocol-status`
  (`position:fixed; top:104px; left:50%` ⇒ HUD 那排底下置中,與截圖位置一致)。
- 唯一寫入點:[`main.ts:1153-1164`](../../src/main.ts#L1153-L1164) `holdOrchestratorsOnAttempt()`
  的 `setProtocolStatus(notice, false)`。

### 2.2 那個元素沒有清除路徑

```ts
// main.ts:2233
function setProtocolStatus(text: string, showNext: boolean): void {
  protocolStatusText.textContent = text;
  protocolNextButton.style.display = showNext ? 'inline-flex' : 'none';
  protocolStatus.style.display = 'flex';   // ← 只會開,永遠不會關
}
```

機械枚舉(不是目視):全檔對 `protocolStatus` 只有 **6** 處參照 —— `createElement`(`:2184`)、
`id`(`:2185`)、`cssText`(`:2186`)、`append`(`:2227`)、`appendChild`(`:2228`)、
以及上面那行 `display = 'flex'`(`:2236`);`src/` 內對
`getElementById('protocol-status')`／`querySelector` 命中 **0**。

⇒ **沒有第二個寫入者,也沒有任何清除者。** 一旦寫入,那段文字活到「下一次有人呼叫
`setProtocolStatus()`」為止——而重跑期間不會有人呼叫。

### 2.3 「重新測試」實際走的路,以及它清了什麼、沒清什麼

```
PauseOverlay onRestart (main.ts:1334)
 → recoverActiveCondition()   main.ts:665   ← 無 fullscreen 退出 ⇒ 直接下一行
 → restartActiveDrill()       main.ts:1957
 → resetRunPresentation()     main.ts:1846
 → drillRunner.start(...)                    ← 新 attempt 開始
```

`resetRunPresentation()` 清了 `finalizedPlan`、`discardedNoticeView`(所以暫停面板的作廢卡片
**確實**消失了)、`pauseErrorView`、recorder、frameLog、Result,並呼叫 `syncFullscreenSuspectWarning()`
把 WP-70 的 suspect 橫幅按真值收起 —— **唯獨沒碰 `#protocol-status`**。

### 2.4 兩條抵達同一個畫面的路徑(修法必須同時處理)

| | 路徑 | hold 文案寫入時機 |
|---|---|---|
| **(i)** | drill 計時在暫停中走完 ⇒ `liveFrame()` 的 ended 分支 finalize ⇒ `discarded` ⇒ 寫入;操作員**之後**按「重新測試」 | 在**前一次**呼叫寫的 ⇒ restart 時已經在畫面上 |
| **(ii)** | 操作員在暫停中直接按「重新測試」⇒ `resetRunPresentation()` **開頭**的「未結算的暫停 attempt」分支 finalize ⇒ `discarded` ⇒ 寫入 | 在**這一次** restart 呼叫內寫的 ⇒ 寫下去的瞬間就已過期(四個 `resetRunPresentation()` 呼叫端**全部**在其後 `drillRunner.start()`,見 `:1957`／`:1968`／`:2048`／`:2090`) |

兩條路徑的終點都是「新一場在跑、橫幅在說上一場」。

### 2.5 生命週期(現況 vs 應然)

```
現況:  [hold 寫入] ──────────────────────────────────→ [下一次 setProtocolStatus()]
                  ↑重新測試  ↑新一場倒數  ↑新一場進行中   ↑重跑成功、orchestrator 前進才被蓋掉
應然:  [hold 寫入] ──→ [新 attempt 開始] = 生命終點,狀態列回到該 orchestrator 當前 step 的文案
```

## 3. 範圍界定 —— 這**不是** WP-70 的缺陷

兩條橫幅長得像、講的事情相關,但是兩個元素、兩個構念:

| | WP-70 修的那條 | 本 KI 這條 |
|---|---|---|
| 元素 | `EligibilityGate.ts` 的 `suspectBanner` | `main.ts` 的 `#protocol-status` |
| 文案 | `⚠ 已離開 fullscreen — 本次測試標記為 suspect…` | `本次紀錄已作廢(…)：測試進度停在原處…` |
| 真值來源 | `sharedState.validity.fullscreenExitedDuringRun` | `AttemptDisposition`(WP-69 三態) |
| 現況 | **已真值驅動**:`resetRunPresentation()` 每場呼叫 `syncFullscreenSuspectWarning()` | **唯寫**,無清除點 |
| 交付物 | WP-70 T3(FR-70.6/70.7) | WP-69 T5(FR-69.10) |

⇒ WP-70 的 T-exit acceptance matrix **未被證偽**,維持 ✅ 交付。但必須明帳:本缺陷與
[KI-040 缺陷 C](KI-040-fullscreen-suspect-never-resets-and-restart-cannot-recover.md)
**同型**(顯示狀態與真值脫鉤、只有寫入沒有清除),WP-70 修好了其中一條通道,另一條當時**未被列為邊界**
(WP-70 progress §Tx.6 只列 B1/B2/B3),WP-69 的 progress 也沒記。這一條是那次盤點的漏網。

## 4. 影響面

1. **三個 orchestrator 通道全中。** hold 文案寫進 `#protocol-status` 的路徑有兩條,都沒有清除點:
   - Session Plan／Protocol:`holdOrchestratorsOnAttempt()` 直接寫(`main.ts:1164`);
   - Tracking Pilot:`trackingPilotSession.handleInvalidAttempt()` →
     [`TrackingPilotRunner.retryRunningBlock()`](../../src/session/TrackingPilotRunner.ts#L314) 的
     `Block N(role)第 M 次已失效(…),請重新測試本 block。`,經 `main.ts:819` 的 `onStatus` 落在同一個元素。
2. **不影響任何資料。** 不碰 sim／命中／決定性／schema／payload／`AttemptDisposition` 三態,
   hold 文案不進任何匯出欄位。錯的只有「操作員看到什麼」。
3. **操作風險(真正的代價)**:操作員可能判讀為「重新測試沒生效」而再按一次 —— 再按一次就是再一次
   full restart(attempt +1、資料無害,但白跑一趟);或在重跑結束後回頭誤讀該項是否計入。
   在 Session Plan 正式收案時,這條假訊息與「進度真的停在原處」的畫面**長得一模一樣**,
   操作員無法從畫面分辨自己在哪一種。
4. **不會誤導到 export**:任何後續真實狀態(session 前進、protocol 下一條件、pilot 下一 block)
   都會蓋掉它 ⇒ 誤導窗口 = 從按下重新測試到重跑結束,不會永久殘留。

## 5. 修改計畫

### 5.1 三個選項

**選項 A(建議採用)—— `main.ts` 內閂鎖「最後一則 orchestrator 狀態」,新 attempt 開始時還原。**

- `setProtocolStatus()` 在**非 hold** 的呼叫時把文字記進一個 module-level 閂鎖(比照
  `discardedNoticeView` 的既有作法:閂鎖而非從相位反推);
- hold 寫入時**不**更新閂鎖 —— 單一分類點 = `holdOrchestratorsOnAttempt()`:pilot 的 hold 文字是
  在 `handleInvalidAttempt()` 內**同步**寫出的(`retryRunningBlock()` 刻意同步,見其函式註解),
  因此在 `holdOrchestratorsOnAttempt()` 前後夾一個 guard,**一個分類點就涵蓋三條通道**
  (C-D4:判準算一次、傳三處);
- `resetRunPresentation()` 末端:若目前顯示的是 hold 文案 ⇒ 還原閂鎖文字(從未寫過 ⇒ 隱藏該元素)。

為什麼閂鎖的文字**必定正確**:hold 的定義就是 orchestrator **沒有前進**。從它上一次寫狀態到這次
restart 之間,沒有發生任何 step transition ⇒ 閂鎖的那句話正是當前 step 的正確文案。
不需要重算、不需要第二個真值來源。

**選項 B —— 三個 runner 各加 `republishStatus()`,restart 後由 runner 重述自己的狀態。**
語意上更「正統」,但:`SessionRunner` 的 `measuredRunOrdinal` 是模組內部狀態
([`SessionRunner.ts:189`](../../src/session/SessionRunner.ts#L189) 的 `正式測試 N/M: family`),
`main.ts` **無法**從 `phase` 自算 ⇒ 必須動介面;pilot 同理;只有 protocol 能自算
(`protocolRunningText(activeProtocolRunner.current)`,`main.ts:2425`)。
⇒ 三個介面 + 兩個 runner 的改動,換到與 A 完全相同的可見結果。**否決**,但保留為 A 若被證偽時的後備。

**選項 C —— restart 時無條件 `display:none`。** **否決**:會把合法的
`正式測試 3/12: tracking`／`Protocol 條件 2/6: …`／`Block 2/6(scored):…` 一併抹掉,
重跑期間操作員反而失去「我在整個 plan 的哪裡」這個定位資訊 —— 用一個新缺陷換掉舊缺陷。

### 5.2 ⚠️ 必須拍板的分歧點(A1 vs A2)

§2.4 的路徑 (ii) 是 hold 文案在**同一次** `resetRunPresentation()` 呼叫內寫出的。

| | 行為 | 代價 |
|---|---|---|
| **A1(✅ 使用者 2026-09-18 拍板採納)** | 還原點放在 `resetRunPresentation()` **末端** ⇒ 路徑 (i)(ii) 一視同仁,hold 文案的生命終點 = 新 attempt 開始 | **會改動一筆既有測試的期望值**,見 §5.3 |
| **A2** | 只清除「**前一次**呼叫寫的」hold ⇒ 不動任何既有測試 | 路徑 (ii) 仍會在新一場倒數時留下過期文案 —— 截圖的症狀在該路徑下**沒被修掉** |

判準建議:hold 文案的語意是「**剛結束的那一場**的判定」,新 attempt 一開始它就沒有指涉對象 ⇒ **A1**。
路徑 (ii) 的「告知」對象本來就是按下按鈕的那個人,他不需要被告知去按他剛按過的按鈕;而 hold 的
**記帳**(cursor 不動、pilot attempt +1、零下載)三項在 A1 下**一行都不動**。

### 5.3 期望值會變動的既有測試(事前列出,不得為了綠燈改判準)

採 A1 時,[`wp69-orchestrator-retry.test.ts`](../../src/attempt/__tests__/wp69-orchestrator-retry.test.ts)
的 `paused 時直接 Restart 仍 hold 同一個 step,且不下載`(`:253-263`)其
`expect(rig.status()).toContain('重新測試')` 將改為「還原後的 step 文案」。

- **變動理由(以 FR-69.10 原文為據)**:該條 FR 要求的是「attempt 被 hold 時三個 orchestrator 有
  **唯一**一句話可說」,不是「那句話必須在 restart 之後繼續顯示」。同一測試的另外兩項斷言
  (`session.phase` 逐位不變、`sessionDownloads` 為空)才是 hold 的**記帳**契約,**必須保持不變**。
- 同檔另三筆 `toContain('重新測試')`(`:235`／`:260`／`:313`)發生在 `endDrill()` 之後、restart 之前,
  **不受影響**。
- ⚠️ 該 rig **手抄**了 `main.ts` 的 `resetRunPresentation()` 與 `holdOrchestratorsOnAttempt()`
  (`:118-124`／`:150-158`)。改 `main.ts` 必須同步改 rig,**而且 rig 綠不等於 app 綠**(見 §6)。

### 5.4 回歸防線必須落在 e2e

rig 是複本,不是被測物 —— 本 bug 在 rig 全綠的情況下存活,就是證明。**真正的紅燈**要在真實 DOM 上取得:

- 標的:[`tests/e2e/wp69-pause-invalid-restart.spec.ts:311`](../../tests/e2e/wp69-pause-invalid-restart.spec.ts#L311)
  `Session Plan holds the item on paused Restart; one clean retry advances and exports once`
  —— 它已經走完 `restartFromPause(page)` → `startRunningWithRealLock(page)`,正是症狀發生的時點。
- 新增斷言:`restartFromPause()` 之後(新 attempt 已起),`#protocol-status` 的文字
  **不含**「請按「重新測試」」,且**等於**該 step 的 session 文案(`正式測試 1/1: …`)。
- 同 spec 的 protocol(`:351`)與 pilot(`:385`)兩筆各加一條同型斷言 ⇒ 三條通道都有守衛。
- **改動前必須實測轉紅**,紅字抄進 `BD-041`。

### 5.5 步驟

1. 先寫 §5.4 的三條 e2e 斷言,`--project=edge` 跑,**確認紅**(抄下紅字)。
2. `main.ts` 實作選項 A(閂鎖 + guard + 還原),不動任何 runner 介面。
3. 同步更新 §5.3 的 rig 與該筆斷言,並在 diff 旁寫明變動理由(指回本節)。
4. 四閘:`npm run typecheck`／`npm run build`／`npx vitest run`(計數對齊當前 baseline
   **3751 passed / 2 skipped**)／`tests/regression` **324** 零漂移。
5. `--project=edge` 跑 `wp69-pause-invalid-restart.spec.ts` 全檔 + `session-orchestrator.spec.ts`
   (後者在 `:1095`／`:1176` 也讀 `#protocol-status`,是本改動的鄰居)。
6. 落帳:本檔狀態列翻 ✅、`BD-041` 寫入 [BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §3、§1 索引狀態同步;
   若最終採 A2 或 B,理由一併寫進 `BD-041`(不得靜默擇一)。

### 5.6 Definition of Done

- [x] 三條 e2e 斷言存在,且**改動前實測為紅**(紅字見 §8.1)
- [x] 重跑期間 `#protocol-status` 顯示該 orchestrator 的**當前 step 文案**,不是 hold 文案
- [x] hold 的記帳契約零變更:`session.phase` 逐位不變、`activeProtocolRunner.current` 不動、
      pilot `attempt +1` 與 audit row 仍在、零下載(e2e 既有斷言全數保留且仍綠,見 §8.3)
- [x] 四閘全綠且**計數精確**(§8.3)
- [x] §5.3 的期望值變動已逐條列出理由,且 hold 的三項記帳斷言未被放寬
- [x] 不新增 DOM node(本修復一個 `createElement` 都沒加,只改 `textContent`／`style`)
- [x] 新增程式碼對 `Date.now`／`Math.random` 的命中為 **0**

### 5.7 硬約束衝擊

| 約束 | 是否觸及 | 說明 |
|---|---|---|
| 三迴圈只透過 `SharedState` 溝通(ADR-2) | 不觸及 | 純 UI 層字串閂鎖,不寫 sim 狀態、不讀 sim 熱路徑 |
| 決定性 / sim 狀態 | 不觸及 | 一行 sim 不碰;以 `tests/regression` **324** 零漂移反證 |
| schema / export | 不觸及 | 不新增欄位;canonical fixture digest 移動筆數**預測 0**(第 1 筆變動即 bug) |
| UI = 純 TS + DOM overlay(D1) | 觸及但相容 | 不引入框架,DOM 於建構期已配置,只改 text/style |
| C-D4 既有構念不得有第二定義 | **觸及(改善)** | 「什麼是 hold 文案」的分類只在 `holdOrchestratorsOnAttempt()` 一處;**不得**在 `setProtocolStatus()` 內用字串比對猜測(那會是第二套判準,且 pilot 文案字面不同,必然分岔) |

## 6. 為何 WP-69 + WP-70 兩輪全綠都沒抓到

1. **rig 是手抄複本**:`wp69-orchestrator-retry.test.ts` 自己重寫了
   `resetRunPresentation()`／`holdOrchestratorsOnAttempt()`,`status()` 是一個區域變數 ——
   它能證明「該寫的時候有寫」,**在結構上無法**證明「該清的時候有清」,因為真實元素的
   `display` 從來不在它的觀測範圍內。(同族問題:[KI-039](KI-039-session-plan-weapon-select-value-assigned-before-options.md) 的 `FakeElement`。)
2. **沒有任何斷言看 restart 之後**:全 repo 對 `#protocol-status` 的 e2e 斷言只有兩處
   ([`session-orchestrator.spec.ts:1095`](../../tests/e2e/session-orchestrator.spec.ts#L1095) 的
   `Session Plan 完成`、`:1176`),都在**正常前進**的路上,沒有一條在 hold → restart 的路上。
3. **WP-70 盯的是另一個元素**:T3 的 DoD 明寫範圍是 `hideSuspectWarning()` 那條脫鉤(KI-040 缺陷 C),
   `#protocol-status` 不在其 blast radius 清單內。

## 7. 遺留 OQ

- **OQ-KI41-1**:`#protocol-status` 是**四個來源共用的單一通道**(session／protocol／pilot／hold)
  而沒有所有權模型 —— 誰都能覆蓋誰,且沒有 owner 能收回自己的訊息。要不要給它一個
  owner-tagged 的小 API(`setStatus(owner, text | null)`)?本次**刻意不做**(跨 WP 重構,不搭 bug
  修復的便車)。**觸發條件**:下一個需要往這條狀態列寫東西、或需要清除它的 WP。
- **OQ-KI41-2**:`wp69-orchestrator-retry.test.ts` 手抄 `main.ts` 兩個函式 —— 是否抽成可測 seam
  (讓 rig 測的是被測物而非複本)?屬 `main.ts` god-node 技術債(WP-69／WP-70 皆已在帳),同上不搭便車。
- **OQ-KI41-3**:pilot 通道還原後顯示的是 block 行(`Block 2/6(scored):…`),**不含 attempt 次數**;
  「第 2 次嘗試」的事實只留在 audit row。操作員要不要在狀態列看到它?交使用者決定(不阻塞修復)。
- **OQ-KI41-4**:A1 採納後,路徑 (ii) 中「暫停中直接換 drill／換場景／換武器」(而非重新測試)的
  操作員同樣不會看到 hold 文案。此時 orchestrator 確實 hold 了,畫面上卻只剩 step 文案。
  是否需要一個「本項尚未計入」的**持久**標記(而非一次性訊息)?這是與本 bug 相反方向的需求,
  刻意分開,不在本次範圍。

## 8. 落地實況(2026-09-18)

採 **A1**。一個切片:`fix(ui): end the attempt hold notice when the next attempt starts`。

### 8.1 先取得的紅(改動前)

`--project=edge tests/e2e/wp69-pause-invalid-restart.spec.ts -g "holds|audits"` ⇒ **3 failed**,
三條通道各一,received 逐字如下:

| 通道 | expected(該 step 自己的文案) | received(修前) |
|---|---|---|
| Session Plan | `正式測試 1/1: …` | (同 protocol 形狀,hold 文案) |
| BR Protocol | `Protocol 條件 1/8: br-ads_off-hitscan-0p5deg` | `本次紀錄已作廢（暫停區間未閉合（在暫停中結束,或暫停期間時間軸仍前進））：測試進度停在原處,未計入本項。請按「重新測試」重跑本項。` |
| Tracking Pilot | `Block 1/9（practice）：tracking_core_pr_pilot_v1_practice` | `Block 1（practice）第 1 次已失效（pause-fence-unclosed）,請重新測試本 block。` |

⚠️ 第一版 assertion 自己有瑕疵並已修正:`toHaveText` 讀 `textContent`,會把**隱藏的**「下一條件」
按鈕字面算進去,而基準值是用 `innerText()` 擷取(排除隱藏元素)⇒ 即使修好也會假紅。改為只比對內層
`#protocol-status > span`,基準與斷言同源。

單元層同樣先取得紅(暫時停用 rig 的 `clearHoldNotice()`)⇒ **3 failed**:
`expected '本次紀錄已作廢（…）：…' to be '正式測試 1/2: hold-click'`、
`expected '本次曾暫停，已失去實驗效力：…' to be '正式測試 1/2: hold-click'`、
`expected '本次紀錄已作廢（…）：…' to be undefined`。

### 8.2 落地的形狀

- [`main.ts`](../../src/main.ts):`setProtocolStatus()` 旁三個 module-level 旗標
  (`lastOrchestratorStatusText` / `lastOrchestratorStatusShowsNext` / `attemptHoldNoticeShown`)
  + 分類旗標 `writingAttemptHoldNotice`(只在 `holdOrchestratorsOnAttempt()` 的同步區間內為真,
  以 `try/finally` 包住 —— 該函式有兩條 early return,結尾賦值會漏)+ 新函式
  `clearAttemptHoldNotice()`,呼叫點**唯一**:`resetRunPresentation()` 的**最後一行**。
- `showNext` 一併閂鎖:protocol 匯出後那一句帶「下一條件」按鈕,只還原文字會把按鈕吃掉。
- runner 介面**零改動**(選項 B 被否決的理由即在此)。
- [`wp69-orchestrator-retry.test.ts`](../../src/attempt/__tests__/wp69-orchestrator-retry.test.ts)
  的手抄 rig 同步(`setStatus()` / `clearHoldNotice()` / `hold()` 的 `try/finally`)。

### 8.3 驗證(計數精確)

| 閘 | 結果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx vitest run` | **3751 passed / 2 skipped(287 files)** —— 與 WP-70 T-exit baseline **逐數相同**(本修復不新增測試檔,改為在既有三個 `paused 時直接 Restart`／`full restart 之後` 測試上**加強**斷言) |
| `npx vitest run tests/regression` | **324 passed** = baseline,零漂移 |
| Edge `wp69-pause-invalid-restart.spec.ts` | **4 passed(4.1m)**,含三條新斷言;既有 hold 記帳斷言(`heldCursor: 0`／`exportCount 0→1`／pilot `invalidAttempts` 1 筆 `pause-fence-unclosed`)全數保留且仍綠 |
| Edge `session-orchestrator.spec.ts`(鄰居,另兩處讀 `#protocol-status`) | **20 passed(13.5m)**,零改動 |

### 8.4 本次確認的一條邊界(不在此擴大範圍)

pilot 的 hold 文案會同時落在 `#protocol-status`(共用通道)與 `#tracking-pilot-status`
(operator screen 自己的狀態列,`trackingPilotSession` 內有自己的 `lastStatus`)。A1 只還原前者;
後者**刻意不動** —— 那個畫面是 audit surface,且 block 跑動期間本來就是隱藏的。
兩條狀態列因此會短暫地說不同的話,這是有意識的取捨,不是遺漏(相關:OQ-KI41-1 的所有權模型)。
