# Pause、失效與 Restart 操作規則

> WP-69 操作手冊。適用於單一 Drill、Session Plan、Resolution／BR Protocol 與 Tracking Pilot。
> Schema 欄位見 [schema.md](schema.md#metavalidity)。

## 操作員先記住三件事

1. 錄製倒數或正式執行中，只要 Pointer Lock 遺失（Esc、切到別的視窗、權限或瀏覽器回收），畫面會立即暫停，該 attempt 永久失去實驗採納資格。
2. **繼續**只是讓無效 attempt 跑完以便稽核；取回鎖後會重新跑該 drill 的完整倒數，資料資格不會恢復。
3. **重新測試**才會建立乾淨的新 attempt；drill、config、scene、weapon 與 seed 不變，Session／Protocol／Pilot 仍停在同一項。

## 畫面出現「已暫停」時

- 所有 gameplay input 已封鎖：滑鼠視角、左／右鍵、ADS、WASD 都不會進 recorder；HUD 與 sim time 凍結。
- 按 **繼續（本次仍無效）**：瀏覽器會重新要求 Pointer Lock。失敗時留在同一面板並顯示可重試訊息；成功後顯示恢復倒數，倒數完才重新接受 input。
- 按 **重新測試**：放棄這個未完成 attempt，回到「點擊左鍵開始」。這條路徑不產生下載；Tracking Pilot 會留下 attempt/reason audit。
- 切換 drill、scene 或 weapon 等同放棄 paused attempt，會依同一 finalization gate 作廢。若需要稽核檔，先 Resume 並把該 attempt 跑完。

## 收工後的三種去向

| 去向 | 代表什麼 | 操作員看見／可做什麼 | 資料用途 |
|---|---|---|---|
| `eligible-candidate` | 從未暫停，且 recording integrity 完整 | 一般 Result 與正式匯出；仍可能顯示既有 quality/suspect 警告 | 再交既有 eligibility、quality、compatibility gates；不是自動 accepted |
| `invalid-retained` | 曾暫停，但 Resume 後的時間戳與 pause fence 可證 | Result 頂端紅色警示；只能手動按 **下載稽核檔（.invalid-paused）** | 僅供稽核；不進 History、trend、threshold、replay 或 runner advance |
| `discarded` | 時間戳不連續／非 finite、pause fence 未閉合，或 paused attempt overflow | 非 Result 的「本次紀錄已作廢」面板；唯一動作是 **重新測試** | 無 payload、metrics、下載或 replay；recorder 會清空 |

### `suspect` 為什麼不同

`meta.suspect=true` 是既有的品質警告：例如效能地板或乾淨未 pause run 的 overflow。它描述「已存在的 payload 是否可疑」，不會自行決定 attempt 的去向。`pauseOccurred=true` 則是 hard reject；即使時間戳完整，也只能成為 `invalid-retained`。若時間戳不可信則直接 `discarded`，連 `meta.suspect` 可附著的 payload 都不存在。

## Session／Protocol／Tracking Pilot 重跑

- 暫停後直接 Restart 或完成一份 invalid attempt，當前 run／condition／block 不前進，正式 export 數仍不變。
- clean retry 完成後才產生恰一份正式 JSON，並依原流程前進。
- Tracking Pilot 的 audit 記錄包含 `blockIndex`、`previousAttempt`、disposition 與封閉 reason；它不佔 `records` 的正式完成槽。
- 不要用 Tracking Pilot 畫面的 **Abort block** 代替 pause Restart：Abort 是操作員主動跳過並前進，語意不同。

## 現場檢查清單

1. 暫停面板必須寫明「本次已失去實驗效力」，不能只顯示一般 lock hint。
2. Resume 失敗應仍可重試；成功後須看見完整恢復倒數。
3. 要留稽核證據時，完成 invalid attempt 後實際點擊下載鈕，確認檔名只含一次 `.invalid-paused`。
4. 若看到作廢面板，確認沒有 Result 數值與自動下載，直接 Restart。
5. clean retry 完成後確認只有一份不含 `.invalid-paused` 的正式檔，再讓流程進到下一項。
