# Operations Runbook — History Center and 3D Replay（stage10 / M18）

> 對象：要在自己機器上啟動、備份或排除本機歷史紀錄／3D 重播故障的 operator（研究員或工程師）。本文件只描述**目前已交付的行為**（WP-48／49／50 T-exit + WP-51 T0～T4），不描述規劃中或未來 enhancement；規格全文見 [stage10 README](../exec-plan/active/stage10/README.md)。

---

## 1. 啟動與確認

### 1.1 指令

| 情境 | 指令 | 用途 |
|---|---|---|
| 開發 | `npm run dev` | Vite dev server，`http://localhost:5173/`，含 History API middleware |
| 正式 build 驗證 | `npm run build && npm run preview` | production bundle，`http://localhost:4173/`；DEV-only test hook（`window.__fpsTest`）**不會**出現在這裡 |
| 型別檢查 | `npm run typecheck` | browser + Node（`tsconfig.node.json`）兩層 |
| Stage 10 自動驗收 | `npm run test:stage10` | 見 §1.3 |

兩個 server 都在 `vite.config.ts` 設 `strictPort: true`（dev 固定 5173、preview 固定 4173）——埠被佔用時直接失敗，不會偷偷換一個埠。

### 1.2 確認 History API 已就緒

啟動後在瀏覽器或 `curl` 打：

```text
GET http://localhost:5173/api/history/health
```

回應 `{"ok":true,"data":{...}}`（`HistoryIndexReport`：`validRunCount`／`invalidFileCount`／`unsupportedFileCount`／`excludedPracticeFileCount`／`rebuiltAt` 等欄位，例如
`{"ok":true,"data":{"validRunCount":0,"invalidFileCount":0,"unsupportedFileCount":0,"excludedPracticeFileCount":0,"rebuiltAt":"2026-08-31T13:19:12.023Z"}}`，
本機 `npm run dev` 實測驗證）代表 API 已可用。若收到：

- `423 HISTORY_ROOT_LOCKED` — history root 正被另一個 process 佔用（見 §4.1）。
- `503 HISTORY_UNAVAILABLE` — repository 初始化失敗（例如 root 路徑不可寫）；其餘 app 路由仍可正常運作（History API 失敗不會拖垮整個 dev/preview server）。

`GET /api/history/*` 只接受**loopback 呼叫**（`127.0.0.1`／`::1`／`::ffff:127.0.0.1`）；非本機來源一律當作「這條路由不存在」處理（見 §5 隱私/安全）。

### 1.3 確認 resolved root 是固定的專案資料夾

正式（非測試）啟動時，history root 一律解析為：

```text
<專案根目錄>/data/session-history/
```

（`server/history/historyPlugin.ts` `resolveRoot()`：沒有顯式 `root` 選項時，用 `process.env.FPS_HISTORY_ROOT`，未設定則預設 `data/session-history`，再對 `process.cwd()` 做 `path.resolve()`。）UI／API 不接受任意路徑輸入——沒有「選擇資料夾」的功能，也沒有可從瀏覽器傳入的 root 參數。

只有測試（Playwright／`npm run test:stage10`）會覆寫 `FPS_HISTORY_ROOT` 指到 `.playwright-tmp/...` 底下的隔離資料夾；一般啟動不要手動設這個環境變數，否則會把正式紀錄寫到別的地方而不自知。

---

## 2. 資料階層與寫入規則

### 2.1 磁碟佈局

```text
data/
└── session-history/
    └── {sanitizedParticipantId}/
        └── {sanitizedDrillId}/
            └── 2026-08-27T14-32-11.321Z_assessment.json
```

- 只保存 **Assessment**；Practice 完成後**不會**呼叫保存 API、不產生任何檔案、也不會出現在 Participant 歷史裡（`HistoryPersistence.save()` 對 `payload.meta.assessment === undefined` 的 payload 直接短路成 `excluded`，從未打 API；伺服器端 `saveRun` 也會對非 assessment payload 拋 `PracticeNotArchivableError` 作第二道防線）。
- 分組**只看完全相同的 `drillId`**；不同 `drillId`（即使同屬一個 drill family）永遠是兩份獨立紀錄，UI 與 API 都不會合併。
- 寫入是「同目錄暫存檔 + atomic rename」——歷史頁不會讀到寫一半的 JSON。
- 同一個 `runId` 重送內容相同會回既有紀錄（idempotent，`existing`），內容不同會被拒絕（`409 RUN_CONFLICT`），不會靜默覆寫。

### 2.2 索引重建（restart）

History API 每次啟動都**只從磁碟 JSON 重建索引**——Participant／drill／run 清單、排序（`startedAt` 新到舊）與 run identity 完全不依賴瀏覽器記憶體或任何快取。重啟 dev/preview server 後直接打 `/api/history/participants` 或重新整理 History 頁，資料應該和重啟前一致。

### 2.3 手動下載 vs 自動歷史

這是兩條完全獨立的路徑：

- **手動下載**（JSON／CSV，`downloadJSON`／`downloadCSV`）：任何一次測試（Assessment 或 Practice）結束都可以手動點下載，存到使用者自己選的地方，與 History root 無關。
- **自動歷史**：只有 Assessment 完成後才會嘗試呼叫 `POST /api/history/runs`；Practice **永遠**不會走這條路徑。

如果向 Participant 或研究員解釋「這次的結果去哪了」，先確認是問手動下載的檔案，還是問歷史紀錄庫。

---

## 3. 備份與還原

- **備份**：先停掉 dev/preview server（避免複製到正在寫入中的暫存檔），再整個複製 `data/session-history/` 資料夾。
- **還原**：目前的 prototype **沒有** delete／import／migration 功能。要還原，先把現有的 `data/session-history/` 資料夾**改名保留**（不要直接覆蓋或刪除），再把備份資料夾複製回 `data/session-history/`，然後重新啟動 server。
- 不要在 server 執行期間直接編輯或搬動 `data/session-history/` 底下的檔案——目前沒有檔案系統監看，會造成記憶體索引與磁碟不同步，直到下次重啟才會重新對齊。

---

## 4. Troubleshooting

### 4.1 API unavailable / history root locked

| 現象 | 原因 | 處理 |
|---|---|---|
| History 畫面顯示讀取失敗，可重試 | `NETWORK_ERROR`（fetch 失敗，例如 server 未啟動或被防火牆擋）或 `STORAGE_IO`（500，寫入/讀取時的檔案系統錯誤） | 兩者皆 retryable：確認 server 是否還在跑，修復環境後點畫面上的「重試」 |
| `423 HISTORY_ROOT_LOCKED` | 另一個 dev/preview process（或未正常關閉的舊 process）仍持有同一個 history root 的 lease | 找到並關閉那個 process；不要直接刪除/移動 root 資料夾繞過鎖 |
| `503 HISTORY_UNAVAILABLE` | repository 初始化失敗（例如 root 路徑權限不足） | 檢查 `data/session-history/` 的資料夾權限；修好後重啟 server |

### 4.2 保存失敗 / 重試

Assessment 完成後若保存失敗，畫面（`[data-section="history-save-status"]`）會顯示「Save to history failed: ...」；只有 retryable 的錯誤碼（`NETWORK_ERROR`／`TIMEOUT`／`STORAGE_IO`／`HISTORY_UNAVAILABLE`／`HISTORY_ROOT_LOCKED`）才會出現「Retry save」按鈕。保存失敗**不影響**當次 Result 畫面或手動下載——兩者都仍可用。成功重試只會建立**一筆**紀錄，不會因為先前失敗而重複。

### 4.3 Corrupt / unsupported JSON

- **寫入時**：payload 未通過嚴格 schema 驗證 → `422 INVALID_EXPORT`（一般格式錯誤）或 `422 UNSUPPORTED_SCHEMA`（`schemaVersion` 不是目前支援的版本）。
- **既有磁碟檔案**：若 `data/session-history/` 底下已有損毀或不支援版本的 JSON，該檔案會被排除在正常清單之外，並計入 `/api/history/health` 回應的 `invalidFileCount`／`unsupportedFileCount`；不會讓整個 History API 掛掉，也不會混進趨勢或清單。若要修復，比對 `health` 回應的計數與資料夾內容，找出可疑檔案後參考 §3 備份／還原流程處理（prototype 沒有自動修復或刪除工具）。

### 4.4 Duplicate conflict

同一 `runId`（同 Participant／drill／`startedAt`）內容不同的第二次保存會得到 `409 RUN_CONFLICT`；原本已存的內容不會被覆寫。這通常代表同一次測試被送了兩次、或 `startedAt` 意外重複，需要人工確認哪一份是正確的。

### 4.5 空的 History

新環境或全新 Participant 第一次進 History 頁會看到空的 Participant／drill／run 清單——這是正常的 empty state，不是錯誤；完成至少一次 Assessment 後才會出現資料。

### 4.6 Replay partial／unsupported

3D 重播依已保存 JSON 分類成三種可見狀態（`invalid` 的資料在寫入時就已被拒絕，永遠不會進入 History 列表）：

| 狀態 | 意義 | UI |
|---|---|---|
| `full` | 可完整重建第一人稱過程 | 完整播放/seek/調速/事件導覽 |
| `partial` | 相機／玩家軌跡可播放，但至少一項能力缺失（例如缺 target lifecycle 或 scene metadata） | 播放器仍可用，但常駐一個能力缺口的說明橫幅 |
| `unsupported` | 連基本相機軌跡都不可信（例如空 ticks、非嚴格遞增時間戳，或 `drillId` 未註冊重播 profile） | 只顯示文字說明與返回鍵，沒有播放器 |

若某筆該是 `full` 的紀錄卻顯示 `partial`／`unsupported`，先看 UI 上列出的原因碼（例如 `SCENE_METADATA_MISSING`、`REPLAY_CONTRACT_MISMATCH`）——這些原因碼是決定性的（同一份 JSON 永遠得到同一個分類），不是隨機或環境相關的問題。

### 4.7 WebGPU → WebGL2 fallback

啟動時瀏覽器 console 會印一行 `[render backend] webgpu` 或 `[render backend] webgl2`。若機器支援 WebGPU（`navigator.gpu` 存在）但實際卻 fallback 成 `webgl2`，console 會多印一行警告——代表 WebGPU 初始化失敗（例如 driver 太舊或瀏覽器旗標未開），不是程式判斷錯誤。要確認實際渲染路徑，一律以這行 log 為準，不要只看 `navigator.gpu` 是否存在。

### 4.8 Scene load failure（Replay）

3D 重播載入場景資產失敗時，畫面會顯示錯誤訊息、一個「重試」按鈕與一個「返回」按鈕（三態都保證存在，不會卡住無法離開）。點重試會重新嘗試載入同一個場景；若持續失敗，用「返回」離開重播，不影響已保存的 Result 資料。

---

## 5. 隱私與安全邊界

- **無登入、無角色權限**——prototype 假設同一台機器上的所有使用者（Participant、研究員）共用同一份本機資料，不做資料隔離。
- History API **只接受 loopback 呼叫**（`127.0.0.1`／`::1`）；非本機來源的請求會被當成不存在的路由處理，不會回傳任何 History 相關資訊，也沒有 CORS wildcard。
- 瀏覽器端程式碼**不會**匯入 `node:*` 模組，因此無法繞過 API 直接碰檔案系統。
- **不要**把含真實 Participant 資料的 `data/session-history/` 底下的 JSON、螢幕截圖或 log 提交進 git；本 repo 的所有測試 fixture 一律使用 synthetic identifier。

---

## 6. 手動驗收（Chrome／Edge／GPU walkthrough）

版本化 checklist、環境需求與簽核流程見 [T5-operations-manual-release.md](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/T5-operations-manual-release.md) 與 [acceptance-stage-j.md](acceptance-stage-j.md) §4；本文件只涵蓋文字操作步驟，不重複列出簽核表格。
