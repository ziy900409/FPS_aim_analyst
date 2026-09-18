# 恢復條件流程 — 實機手動驗證清單（FM-70.4）

> WP-70 T6 交付。**這份清單守的是自動化測試永遠守不到的那一條**，不是補充說明。
> 判準見 [`GD-47`](../exec-plan/DECISIONS.md#gd-47--wp-70-條件失效的效力單位是-run--fullscreen-與-pointer-lock-語意對稱並補上不重啟-plan-的恢復入口2026-09-15-t6) ⑧(a)
> · 操作流程見 [pause-invalid-restart.md](pause-invalid-restart.md) · 欄位見 [schema.md](schema.md#metavalidity)。

## 0. 為什麼需要人來做這件事

`ConditionRecoveryScreen` 的「重新進入 fullscreen」必須在 click 的 **user activation stack 內同步**
呼叫 `requestFullscreen()`——排到第一個 `await` 之後就會失去 activation，永遠取不到全螢幕（FM-70.4）。

**Playwright 測不到這個。** WP-70 T0 以控制組實測定位：`page.evaluate()` 對 CDP 帶
`userGesture: true`，所以**即使實作把 `requestFullscreen()` 寫在 `await` 之後，e2e 照樣全綠**
（`tests/e2e/wp70-fullscreen-validity.spec.ts` 檔頭的限制 **L1**）。

⇒ 這條失效模式的守衛只有兩道：

| 守衛 | 在哪 | 抓得到什麼 |
|---|---|---|
| source-scan | `src/ui/ConditionRecoveryScreen.test.ts` | 程式碼**形狀**改變（`requestFullscreen()` 被移到 `await` 之後） |
| **本清單** | 人 + 真瀏覽器 | 瀏覽器**行為**改變（新版 Chromium 收緊 activation 規則、政策變更、權限預設改變） |

source-scan 抓不到第二種，而第二種每次瀏覽器改版都可能發生。

## 1. 什麼時候要跑

- [ ] Chrome／Edge **主版號**變動後的第一次正式收案前
- [ ] 任何動到 `ConditionRecoveryScreen.ts`、`recoverActiveCondition()` 或 `requestFullscreen` 呼叫點的變更之後
- [ ] 換施測機器時（連同 [operator-manual §1.5](../guideline/operator-manual.md) 的首次啟動檢查一起做）
- [ ] 操作員回報「按了重新進入 fullscreen 但沒進去」時（此清單即診斷流程）

## 2. 環境記錄（每次跑都填，空白 = 沒跑）

| 欄位 | 值 |
|---|---|
| 日期 | |
| 瀏覽器與完整版本（`chrome://version`） | |
| 作業系統 | |
| 螢幕原生解析度 × `devicePixelRatio` | |
| build（`git rev-parse --short HEAD`） | |
| dev 還是 preview（5173 / 4173） | |
| 執行人 | |

## 3. 步驟與預期觀察值

> 全程開著 DevTools console。**每一步的「預期」欄若不成立就停下來記錄**，不要往下推進。

| # | 動作 | 預期觀察值 | ✓ |
|---|---|---|---|
| 1 | 開 app，console 確認 `crossOriginIsolated: true` | `true`。false ⇒ 停，這台機器的資料本來就不可用 | ☐ |
| 2 | 走「選手測試 Session」→ 填 Participant → Session Plan → 資格閘 | 出現「實驗 session 資格閘」畫面 | ☐ |
| 3 | 按 **「進入 fullscreen 並開始」** | 真的進入全螢幕；報告含 `fullscreen: PASS — document.fullscreenElement 存在` | ☐ |
| 4 | 進第一個 drill，點擊取得滑鼠鎖定，等**進入倒數或正式進行中** | HUD 出現、倒數在跑 | ☐ |
| 5 | **錄製中**按 `Esc` | ① 退出全螢幕 ② 出現黃色警示條「⚠ 已離開 fullscreen — 本次測試標記為 suspect(條件失效)；…」 ③ 掉鎖 ⇒ 出現暫停面板「已暫停 — 本次已失去實驗效力」 | ☐ |
| 6 | 暫停面板按 **「重新測試」** | 出現 **「恢復實驗條件」** 畫面（**不是**直接回到「點擊左鍵開始」）。描述列出三項門檻與當前解析度需求 | ☐ |
| 7 | ⭐ **按「重新進入 fullscreen」** | ⭐ **畫面真的進入全螢幕**（這一格就是 FM-70.4 的整個實質內容）。狀態先顯示「正在恢復 fullscreen 並重驗條件...」 | ☐ |
| 8 | 看報告 | 逐項 `PASS`／`FAIL`。全過 ⇒ 自動關閉並回到本項的「點擊左鍵開始」 | ☐ |
| 9 | **若沒全過**（例如這台機器解析度不足） | 狀態「條件仍未通過，請修正後重試。」、按鈕變「重試條件檢查」、**畫面留在原地**；下載資料夾**沒有**新檔案；排程**沒有**前進 | ☐ |
| 10 | 在步驟 7 的瀏覽器全螢幕請求上按 **「拒絕／不允許」**（若瀏覽器有問） | 狀態「無法進入 fullscreen，請再按一次重試。」、按鈕變「重試 fullscreen」、畫面留在原地 | ☐ |
| 11 | 恢復成功後把**這一場**完整跑完 | 匯出 JSON 的 `meta.validity.fullscreenExited` 為 **`false`**（全程在全螢幕） | ☐ |
| 12 | 再跑**下一場**，全程不碰 `Esc` | 黃色警示條**自動不再出現**；該場匯出 `meta.validity.fullscreenExited: false` ⇒ 「不傳染」成立 | ☐ |

### 3.1 步驟 7 失敗代表什麼

**沒有進入全螢幕**（狀態直接跳「無法進入 fullscreen」而使用者並未拒絕）= FM-70.4 復發或瀏覽器規則改變。
處置：

1. 記錄完整瀏覽器版本與 console 的全部紅字。
2. 確認 `src/ui/ConditionRecoveryScreen.ts` 的 `recover()` 內 `options.requestFullscreen()` 仍在
   **第一個 `await` 之前**呼叫（該檔的 source-scan 測試釘的就是這一點；測試綠但實機失敗 ⇒ 是瀏覽器側變了）。
3. 開 KI 並在本檔追加一列具名紀錄。**不要**改成「先 await 再請求」來繞過。

## 4. 這份清單**不**宣稱的事

- 它**不**取代 `tests/e2e/wp70-fullscreen-validity.spec.ts`：那支測的是效度鏈路（標記／不傳染／恢復不推進），
  本清單只補 e2e 結構上測不到的 user-activation 那一格。
- 它**不**驗證 `meta.suspect` 的效能地板成分——那一半同機橫跳（WP-70 S-70-T5-1），不是手動能釘的。
- 勾完**不等於**這台機器適合收案；資格閘拒入時仍以資格閘為準（[operator-manual §4.3](../guideline/operator-manual.md)）。

## 5. 執行紀錄

| 日期 | 瀏覽器版本 | 結果 | 備註 |
|---|---|---|---|
| | | | |
