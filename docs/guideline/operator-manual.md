# 操作人員使用說明（Operator Manual）

> **對象**：實際在機器上「跑一場測試」的人——研究員、教練、施測助理。你不需要看得懂 TypeScript，但你要能安裝、啟動、帶著受測者走完一場 Session Plan、確認資料落地、並在出事時判斷是環境問題還是資料問題。
> **不是給誰的**：想知道「為什麼這樣設計」→ [規格書](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md)；想知道「接下來要做什麼」→ [exec-plan/README.md](../exec-plan/README.md)；想寫離線分析 → [analysis-segments.md](../operational/analysis-segments.md) 與 `research/`。
> 語言：繁體中文，技術術語保留英文原文（決策 D4）。畫面上的字串一律照抄軟體實際顯示的文字。

---

## 0. 先讀這一頁：本軟體的心智模型

這不是一款遊戲，是一台**量測儀器**。它做三件事：

1. 用固定 128 Hz 的 sim 迴圈跑一個**凍結的**瞄準任務（drill）。
2. 以次毫秒精度採集鍵鼠事件與逐 tick 的遊戲狀態。
3. 把整場資料匯出成 JSON／CSV，供離線分析。

因此**環境本身就是實驗條件**。fullscreen、原生解析度、frame time、滑鼠 DPI、背景程式——這些不是「效能建議」，它們決定這份資料能不能用。軟體內建三道閘（資格閘 → suspect 標記 → 品質旗標）就是為了讓「不能用的資料」被明確標出來，而不是靜靜地混進統計。

### 0.1 名詞速查

| 名詞 | 意思 | 你會在哪看到 |
|---|---|---|
| **Participant ID** | 研究者發放的受測者代號。**必填**，是所有資料的歸戶鍵 | session setup 表單 |
| **drill** | 一個凍結的任務設定（目標、時序、武器、結束條件）。例：`hold_click_v1` | Session Plan 清單、匯出檔名 |
| **family（測試家族）** | 同一種能力構念的 drill 群組。例：`hold-click`／`counterstrafe`／`spider-shot` | Session Plan 家族勾選 |
| **Session Plan** | 一整場測試的排程：哪些 drill、各跑幾輪、中間休息多久 | 「選手測試 Session」入口 |
| **Assessment / Practice** | drill 的 `mode`。**只有 Assessment 會自動存進歷史紀錄**；Practice 只能手動匯出 | Result 畫面下方 |
| **資格閘（eligibility gate）** | 進入正式 session 前的三項硬檢查（解析度／fullscreen／效能地板） | 「進入 fullscreen 並開始」畫面 |
| **suspect** | 條件在錄製途中失效（例如中途退出 fullscreen）。資料仍匯出，但標記為可疑 | 黃色警示條、`meta.suspect` |
| **run** | 一次跑完的 drill。一場 Session Plan 由多個 run 組成 | Result 畫面、歷史紀錄 |

---

## 1. 安裝

### 1.1 需求

| 項目 | 需求 | 為什麼 |
|---|---|---|
| 作業系統 | Windows 10/11 桌面版（本文以此為準） | 階段 A 鎖 Chromium 桌面 |
| 瀏覽器 | **Chrome 或 Edge 桌面版**，需支援 WebGPU | Firefox／Safari／手機瀏覽器**不支援**，不要用 |
| Node.js | **18.19+ 或 20.6+** | Vite 6 最低需求 |
| 顯示器 | 原生 ≥ **1920×1080**（Session Plan 門檻）；跑解析度／BR protocol 需 ≥ **2560×1440** | 資格閘會擋 |
| 更新率／效能 | warmup 探測的 frame time p95 需 **≤ 8.33 ms**（≈120 Hz 等效） | 資格閘的效能地板 |
| 滑鼠 | 關閉作業系統的「增強指標精確度」（滑鼠加速） | 加速會污染輸入量測 |

> 沒有安裝檔、沒有 .exe。這是一個從原始碼啟動的本機網頁應用。

### 1.2 安裝步驟

先確認 Node 版本：

```bash
node --version
```

符合上表後，在專案根目錄執行（只需做一次，或在有人更新相依套件後重跑）：

```bash
npm install
```

### 1.3 啟動

```bash
npm run dev
```

固定啟在 `http://localhost:5173`。**埠號是固定的（`strictPort`）**：如果 5173 被占用，指令會直接失敗而不會偷偷換一個埠——這是刻意的，避免你以為在測 A 其實在測 B。看到失敗就先關掉占用 5173 的舊 process。

接著用 Chrome 或 Edge 開 `http://localhost:5173`。

### 1.4 正式 build 的驗證（可選）

```bash
npm run build
```

```bash
npm run preview
```

`preview` 固定啟在 `http://localhost:4173`，跑的是打包後的成品，**不含** dev-only 的測試掛鉤。收案前若要確認「正式版也正常」，用這條。

### 1.5 首次啟動檢查清單（每台新機器做一次）

開啟頁面後按 **F12** 打開 DevTools Console，逐項確認：

| # | 確認什麼 | 預期看到 | 不對的話 |
|---:|---|---|---|
| 1 | cross-origin isolation | `[isolation] {crossOriginIsolated: true, timerResolutionUs: ~5}` | `false` 代表計時精度不足、**量測效度受損**。dev server 會自動注入 COOP/COEP 標頭，本機出現 `false` 通常是走了錯的網址（例如經過代理）。部署到別台主機見 [deploy-headers.md](../operational/deploy-headers.md) |
| 2 | 渲染後端 | `[render backend] webgpu` | 顯示 `webgl2` 代表 fallback。若機器支援 WebGPU 卻 fallback，console 會多印一行警告（driver 太舊／旗標未開）。**一律以這行 log 為準**，不要只看 `navigator.gpu` 存不存在 |
| 3 | 歷史紀錄 API | 瀏覽器打 `http://localhost:5173/api/history/health`，回 `{"ok":true,"data":{...}}` | `423` = history root 被另一個 process 鎖住；`503` = 初始化失敗（多半是資料夾權限）。見 §8.4 |
| 4 | 主畫面四個入口都在 | 「選手測試 Session」「研究員模式」「歷史紀錄」＋淡化的「實驗 session」 | 缺按鈕代表 boot 出錯，看 console 紅字 |

---

## 2. 主畫面：四個入口

左上角是啟動器。**不要憑感覺點**——四個入口的資料語意不同：

| 入口 | 用途 | 資格閘門檻 | 誰用 |
|---|---|---|---|
| **選手測試 Session** | 正式跑一場 Session Plan（本手冊主線） | 1920×1080 | 施測人員 ← **你多半要用這個** |
| **研究員模式** | 單一 drill 調整、解析度 protocol、BR protocol、Tracking pilot | 依子項而異 | 研究員 |
| **歷史紀錄** | 瀏覽 Participant 過去的 Assessment 結果與趨勢、3D 重播 | 無 | 所有人 |
| **實驗 session**（淡化） | 尚未歸類的 legacy 入口 | 2560×1440 | 除非有人指名，否則別用 |

---

## 3. 施測前的機器準備（每場測試前）

這一節不是客套話。跳過任何一項都可能讓整場資料進不了分析。

- [ ] **關掉背景程式**：Discord／OBS／串流／防毒全盤掃描／Windows Update。這些會拉高 frame time p95，直接撞資格閘或讓資料被標 suspect。
- [ ] **顯示器設定**：設回原生解析度與最高更新率；顯示比例設 100%。
- [ ] **滑鼠**：關閉 Windows「增強指標精確度」；固定 DPI 並**記下實際數值**（等一下要填進表單）。
- [ ] **瀏覽器**：只留一個分頁；關閉會跳通知的擴充功能。
- [ ] **瀏覽器下載設定**：建議關閉「下載前詢問每個檔案的儲存位置」。每個 run 結束會自動下載一份 JSON，若每次都彈存檔對話框會打斷施測節奏。
- [ ] **記錄環境**：顯示器型號、原生解析度、更新率、瀏覽器版本、滑鼠 DPI 與遊戲內感度。這些之後在資料裡對不回來就補不回來了。

---

## 4. 用 Session Plan 跑一場測試（主線流程）

整條路徑固定是四步，中途不會跳過任何一步：

```text
選手測試 Session
  → ① 實驗 session setup（受測者與硬體資料）
  → ② Session Plan（要跑什麼、跑幾輪、休息多久）
  → ③ 資格閘（三項硬檢查，不合格拒入）
  → ④ 施測（自動排程：熱身 → drill → 休息 → drill → … → 收工）
```

### 4.1 第 ① 步：實驗 session setup

點「選手測試 Session」後出現的表單，標題是 **「實驗 session setup」**。

| 欄位 | 必填 | 說明 |
|---|:--:|---|
| **Participant ID** | ✅ | 研究者發放的代號。**這是唯一必填欄位**，也是資料歸戶的鍵。用穩定、可追溯的格式（例 `P007`），不要用真名 |
| Session label | | 本場的描述性標籤，例 `pilot-day-1`。強烈建議填，日後撈資料靠它 |
| Monitor model | | 顯示器型號 |
| Native width / height | | 原生解析度（px）。表單上方會顯示「自動偵測原生解析度: W×H」供對照 |
| Panel inches | | 面板吋數 |
| Viewing distance | | 觀看距離（cm） |
| Mouse DPI | | 滑鼠 DPI。會寫進匯出 metadata |
| 不確定顯示硬體資訊 | | 受測者說不準時勾這個，**不要亂猜填數字** |

> 顯示與滑鼠欄位是**自陳資料**。不知道就留空或勾「不確定」——留空是誠實的資料，猜的數字是污染的資料。

填完按 **「下一步」**。

### 4.2 第 ② 步：Session Plan

出現標題為 **「Session Plan」** 的畫面，最上面是「模式」二選一。

#### A. 標準 Assessment（凍結協定） ← 正式收案用這個

| 控制項 | 預設 | 說明 |
|---|---|---|
| **測試家族**（checkbox 清單） | 全部勾選 | 取消勾選 = 本場不跑該家族。**可直接拖曳整列改變順序**（左側 `⋮⋮` 是拖曳把手） |
| **家族間休息秒數** | `60` | 換家族時的休息長度 |
| **在第一個家族前執行可用熱身** | 勾選 | 見下方說明 |

**關於熱身**：目前只有 counter-strafe 家族有專屬的 practice 變體。若第一個家族沒有熱身 drill，畫面會顯示 **「本家族無熱身，直接開始正式測試。」** 然後直接進正式測試——這是刻意設計，不是錯誤。

**關於家族順序**：正式協定使用 counterbalance 排序以避免疲勞／練習造成的系統性偏誤。除非施測計畫明確指定順序，否則**不要手動改**。

#### B. 自訂 program ← 練習、示範、探索用

切到這個模式後，畫面換成：

| 控制項 | 預設 | 說明 |
|---|---|---|
| **可排程 drill**（下拉選單） | — | 依家族分組。選好後按 **「加入」** |
| **執行清單** | 空 | 每一列 = 一個 drill。可設 **重複次數**（≥ 1 的整數）、用 `▲`／`▼` 或拖曳調整順序、`✕` 移除 |
| **drill 休息秒數** | `30` | 同一個 drill 換下一輪，或同家族內換 drill 時的休息 |
| **家族休息秒數** | `60` | 跨家族時的休息 |
| **程式預覽** | 自動更新 | 逐步列出實際會發生的事：`▶ drillId (2/3)` 是第 2 輪、`⏸ 30s · … → 下一個 drill` 是休息 |

**預覽就是實際會跑的東西**——它渲染的是編譯後的程式，不是另外算一遍。若預覽顯示「預覽不可用」＋紅字錯誤（例如「必須為 >= 1 的整數」、「不得為空」），**「開始 Session Plan」按鈕會被停用**，修好才能送出。

> 自訂 program **沒有**熱身勾選框：在這條路徑上，清單的第一項本身就是你的熱身。

> ⚠️ **`tracking` 群組裡的兩個 pilot block**（`tracking_core_pr_pilot_v1_2deg_5dps`、
> `tracking_reversal_pilot_v1_high`）是**接線／手感測試用**的研究 drill：每個 26 秒且不可縮短，
> 跑出來的資料**不可**當正式 tracking pilot 證據、**只有** primary seed、**重複次數不是獨立樣本**。
> 三項禁令與辨識方法見
> [tracking-pilot-runbook.md](../operational/tracking-pilot-runbook.md) 的「Session Plan 裡看到的兩個 pilot block」。

確認無誤後按 **「開始 Session Plan」**。

### 4.3 第 ③ 步：資格閘

出現 **「實驗 session 資格閘」** 畫面。按 **「進入 fullscreen 並開始」**（必須由真人點擊，瀏覽器才會允許進入 fullscreen），軟體會依序：請求 fullscreen → 跑一段 warmup 探測 frame time → 判定三項。

| 檢查 | Session Plan 的門檻 |
|---|---|
| 原生解析度 | ≥ **1920×1080** |
| Fullscreen | 已進入 |
| 效能地板 | warmup frame time **p95 ≤ 8.33 ms** |

全過 → 自動進入施測。任一項 `✗ FAIL` → **拒入**，畫面逐項列出 `✓ PASS`／`✗ FAIL` 與完整 details，按鈕變成「重試」。

**被擋下來怎麼辦**：不要想辦法繞過。照 §3 的清單重新整理環境（關背景程式、改回原生解析度）後按「重試」。資格閘擋住的是「這台機器現在量不準」，硬跑只會產出你事後必須丟掉的資料。

> 「實驗 session」「解析度 protocol」「BR protocol」三個入口的解析度門檻是 **2560×1440**——那些 protocol 要操弄解析度條件，FHD 面板跑 QHD 條件在統計上必然是方向性錯誤的資料。Session Plan 不操弄解析度，所以門檻不同。

### 4.4 第 ④ 步：施測

進入 fullscreen 後，排程會自動推進，**不需要人工按「下一步」**。

**受測者要做的事**：

| 操作 | 動作 |
|---|---|
| 點擊畫面 | 鎖定滑鼠視角（畫面提示：「點擊以鎖定滑鼠視角（Esc 解除）」） |
| 移動滑鼠 | 轉動視角 |
| **A / D** | 左右橫移（counter-strafe 的核心） |
| W / S | 前後移動（部分 drill 未使用） |
| **滑鼠左鍵** | 開火 |
| **滑鼠右鍵** | ADS 開鏡（部分武器有） |
| **Esc** | 解除滑鼠鎖定 |

> **開火只在滑鼠鎖定中才會被採計**——這是為了避免「點擊畫面取鎖」的那一下被誤判成一次射擊。所以受測者第一下點擊不算開火，這是正常的。

**畫面上的東西**：

- **HUD**：分數、時間、命中率、速度（給受測者看的即時回饋）
- **休息畫面**：顯示「休息中」＋倒數。**倒數歸零會自動開始下一個 drill**，不用點任何東西
- **⚠ 黃色警示條**：「已離開 fullscreen — 本 session 資料標記為 suspect(條件失效)。」

**中途退出 fullscreen 的規則**（容易誤會）：只有在 drill **實際錄製中**（倒數或進行中）退出 fullscreen 才算條件失效。drill 之間的空檔、以及已結束準備匯出時退出 fullscreen **不算**——所以「錄完正常退出全螢幕去拿匯出檔」不會被誤判。

### 4.5 每個 run 結束時會發生什麼

一個 drill 跑完，會**自動**發生下面四件事，你不用點：

1. 滑鼠鎖定自動解除
2. 出現 **「Drill Results」** 結果畫面（指標卡片 + quality-gate 旗標）
3. **自動下載一份 JSON**，檔名格式 `{drillId}-{startedAt}.json`（熱身 run **不匯出**，它是暖身不是量測）
4. 若這是 **Assessment**，自動存進本機歷史紀錄庫；若是 **Practice**，畫面顯示「Practice 不納入歷史；可手動匯出 JSON/CSV。」

然後排程自動推進到休息或下一個 drill。

**結果畫面上的注意事項**：「重新測試會清除目前畫面結果；請先匯出需要保留的資料。」

**歷史保存失敗時**：畫面會顯示 `Save to history failed: ...`。若錯誤是可重試的，會出現 **「Retry save」** 按鈕。保存失敗**不影響**當次結果畫面與手動下載——兩者都仍可用；成功重試只會建立一筆紀錄，不會重複。

### 4.6 收工

最後一個 drill 完成後，排程進入 done。此時可以安全退出 fullscreen（Esc），去確認資料（見 §5）。

---

## 5. 資料去哪了

**這是兩條完全獨立的路徑，向受測者或同事解釋前先分清楚問的是哪一條。**

### 5.1 下載檔（瀏覽器下載資料夾）

- 每個非熱身 run 結束時**自動**下載一份 JSON
- 結果畫面上也可**手動**再匯出 JSON／CSV
- 檔名：`{drillId}-{startedAt}.json`（protocol 條件會多帶 `-{序號}-{條件標籤}`）
- 位置：瀏覽器的下載資料夾，與歷史紀錄庫完全無關
- Assessment 與 Practice **都**可以手動下載

### 5.2 本機歷史紀錄庫（`data/session-history/`）

```text
data/
└── session-history/
    └── {participantId}/
        └── {drillId}/
            └── 2026-08-27T14-32-11.321Z_assessment.json
```

規則：

- **只保存 Assessment**。Practice 完成後不會呼叫保存 API、不產生檔案、也不會出現在歷史裡（前後端各一道防線）
- 分組**只看完全相同的 `drillId`**。同一家族的不同 drill 永遠是兩份獨立紀錄，UI 與 API 都不會合併
- 寫入是「暫存檔 + atomic rename」，歷史頁不會讀到寫一半的 JSON
- 同一次 run 重送、內容相同 → 回既有紀錄（idempotent）；內容不同 → 拒絕（`409 RUN_CONFLICT`），**不會靜默覆寫**
- 路徑固定為 `<專案根>/data/session-history/`。UI 與 API **不接受任意路徑輸入**，沒有「選擇資料夾」功能

> ⚠ **不要**手動設定 `FPS_HISTORY_ROOT` 環境變數。那是給自動化測試把資料導去隔離資料夾用的；一般啟動設了它，正式紀錄會被寫到別的地方而你不會知道。

### 5.3 備份與還原

- **備份**：先**停掉** dev/preview server（避免複製到寫入中的暫存檔），再整個複製 `data/session-history/` 資料夾。
- **還原**：目前沒有 delete／import／migration 功能。把現有的 `data/session-history/` **改名保留**（不要直接覆蓋或刪除），把備份複製回原位，再重啟 server。
- **server 執行期間不要直接編輯或搬動** `data/session-history/` 底下的檔案——目前沒有檔案系統監看，會造成記憶體索引與磁碟不同步，直到重啟才會對齊。

### 5.4 隱私紅線

- 本軟體**沒有登入、沒有角色權限**：同一台機器上的所有使用者共用同一份本機資料。
- History API **只接受本機（loopback）呼叫**；非本機來源一律當作「這條路由不存在」。
- **不要**把含真實 Participant 資料的 JSON、螢幕截圖或 log 提交進 git。Participant ID 請用代號，不要用真名。

---

## 6. 歷史紀錄與 3D 重播

主畫面點 **「歷史紀錄」** 進入。可瀏覽 Participant → drill → run，看過去的 Assessment 結果與趨勢，並對單筆 run 做第一人稱 3D 重播。

**新環境或新 Participant 第一次進來會是空的**——這是正常的 empty state，不是錯誤。完成至少一次 **Assessment** 後才會有資料（Practice 永遠不會出現在這裡）。

重播有三種可見狀態：

| 狀態 | 意義 | UI |
|---|---|---|
| `full` | 可完整重建第一人稱過程 | 完整播放／seek／調速／事件導覽 |
| `partial` | 相機與玩家軌跡可播放，但缺至少一項能力（例如缺 target lifecycle 或 scene metadata） | 播放器可用，常駐一個能力缺口說明橫幅 |
| `unsupported` | 連基本相機軌跡都不可信 | 只有文字說明與返回鍵 |

若某筆該是 `full` 的紀錄卻顯示 `partial`／`unsupported`，看 UI 列出的原因碼（例 `SCENE_METADATA_MISSING`、`REPLAY_CONTRACT_MISMATCH`）。**這些分類是決定性的**——同一份 JSON 永遠得到同一個結果，不是隨機或環境問題，重試不會改變它。

詳細操作與故障排除見 [history-center-replay.md](../operational/history-center-replay.md)。

---

## 7. 研究員模式（進階）

主畫面點 **「研究員模式」**，四個子入口：

| 按鈕 | 用途 | 備註 |
|---|---|---|
| **單一 Drill 調整** | 顯示 drill／場景／武器下拉選單，自由載入單一 drill | 不走資格閘。適合示範、除錯、目視檢查場景 |
| **解析度 protocol** | 受試者內解析度 × 偵測 protocol | 資格閘門檻 **2560×1440** |
| **BR protocol** | BR 跟槍 ADS × 彈道 × 角尺寸 protocol | 資格閘門檻 **2560×1440** |
| **Tracking pilot** | manifest 驅動的 researcher-only session，自帶 Participant／Session index／Rest 表單與 operator 畫面 | **不**走資格閘路徑；見 [tracking-pilot-runbook.md](../operational/tracking-pilot-runbook.md) |

「單一 Drill 調整」面板的控制項：drill 下拉（選了就載入）、`Restart`、場景下拉 + `Scene`、武器下拉 + `Weapon`、tracer 顯示開關。

> **Tracking pilot 有自己的協定世代與招募狀態**，且該協定近期換過代（受測者要做的事變了、條件標籤改過兩次、舊資料不可與新資料合併）。跑之前**務必先讀** [tracking-pilot-runbook.md](../operational/tracking-pilot-runbook.md) 開頭的「現在該做什麼」，不要照記憶操作。

---

## 8. 故障排除

### 8.1 啟動與環境

| 現象 | 原因 | 處理 |
|---|---|---|
| `npm run dev` 失敗，說埠被占用 | 5173 被另一個 process 占用（常見：上一次沒關乾淨的 dev server，或另一個 checkout／worktree 的 server） | 這是 `strictPort` 的刻意行為。找出並關閉那個 process，**不要**改埠號繞過——你會測到別人的程式 |
| console 顯示 `crossOriginIsolated === false` | COOP/COEP 標頭沒生效 | 確認網址是 `localhost:5173`（dev）或 `localhost:4173`（preview）。部署到其他主機見 [deploy-headers.md](../operational/deploy-headers.md)。**這種狀態下的資料不可用於量測** |
| console 顯示 `[render backend] webgl2` | WebGPU 初始化失敗（driver 太舊／瀏覽器旗標未開） | 更新顯卡 driver 與瀏覽器。以這行 log 為準 |
| 畫面全黑／按鈕沒反應 | boot 期間發生錯誤 | 開 console 看紅字；重新整理頁面 |

### 8.2 資格閘

| 現象 | 處理 |
|---|---|
| 「原生解析度 ✗ FAIL」 | 顯示器設回原生解析度、顯示比例設 100%。若面板本身低於門檻，這台機器不能跑這個入口 |
| 「Fullscreen ✗ FAIL」 | 必須由真人點擊「進入 fullscreen 並開始」；瀏覽器若曾拒絕過 fullscreen 權限，到網站設定裡放行 |
| 「效能地板 ✗ FAIL」 | 關背景程式、關其他分頁、停掉錄影／串流／防毒掃描，再按「重試」 |
| 反覆重試都不過 | 記錄下 details 全文，這台機器不適合收案。**不要繞過** |

### 8.3 施測中

| 現象 | 意義 | 處理 |
|---|---|---|
| 黃色警示條「已離開 fullscreen — 本 session 資料標記為 suspect」 | 錄製途中離開了 fullscreen | 該筆資料仍會匯出但標 suspect。記錄下發生在第幾個 drill，回報給分析端 |
| 受測者第一下點擊沒有射擊 | 那一下是「取得滑鼠鎖定」，刻意不採計 | 正常，向受測者說明 |
| 休息倒數卡住 | 休息由 render 迴圈驅動 | 確認分頁在前景（背景分頁會被瀏覽器降頻）。施測全程不要切換分頁 |
| 顯示「本家族無熱身，直接開始正式測試。」 | 該家族沒有 practice 變體 | 正常，刻意設計 |
| 顯示「Session Plan 啟動失敗：…」 | 受測者資料或計畫選擇遺失，或自訂 program 在預覽後又被改壞 | 回到主畫面重走 ①②③ 三步 |

### 8.4 資料與歷史

| 現象 | 原因 | 處理 |
|---|---|---|
| History 畫面讀取失敗、可重試 | `NETWORK_ERROR`（server 沒跑／被防火牆擋）或 `STORAGE_IO` | 確認 server 還在跑，修好後點畫面上的「重試」 |
| `423 HISTORY_ROOT_LOCKED` | 另一個 dev/preview process 仍持有同一個 history root 的 lease | 關掉那個 process。**不要**刪除或搬動 root 資料夾繞過鎖 |
| `503 HISTORY_UNAVAILABLE` | repository 初始化失敗（多半是資料夾權限） | 檢查 `data/session-history/` 權限後重啟 server |
| `409 RUN_CONFLICT` | 同一 run 被送了兩次但內容不同，或 `startedAt` 意外重複 | 原有資料不會被覆寫。需人工確認哪一份正確 |
| 跑完了但歷史裡看不到 | 該 drill 是 **Practice** | Practice 永遠不進歷史。要進歷史必須是 Assessment |
| 歷史頁筆數與磁碟檔案數對不上 | 有損毀或不支援版本的 JSON 被排除 | 打 `/api/history/health` 看 `invalidFileCount`／`unsupportedFileCount`，比對資料夾內容找出可疑檔案（prototype 沒有自動修復工具） |

---

## 9. 紅線：絕對不要做的事

1. **不要繞過資格閘。** 它擋下來的每一次，都是在替你省掉一份事後必須丟掉的資料。
2. **不要用 Firefox／Safari／手機瀏覽器。** 階段 A 鎖 Chromium 桌面版，時間戳的同源假設只在 Chromium 成立。
3. **不要在 server 執行中直接改動 `data/session-history/`。**
4. **不要手動設 `FPS_HISTORY_ROOT`。**
5. **不要把不同世代的協定資料合併分析。** 協定換代時，即使畫面看起來一樣，受測者要做的事或條件標籤可能已經變了（tracking pilot 就有前例）。以匯出 JSON 的 `meta` 為準，不要以檔名或記憶為準。
6. **不要把真實 Participant 資料提交進 git。**
7. **不要在施測中切換分頁或開其他視窗。**

---

## 10. 一頁 SOP 速查卡

```text
【開機】
  npm run dev  →  Chrome/Edge 開 localhost:5173
  F12 確認：[isolation] crossOriginIsolated: true
            [render backend] webgpu

【機器準備】
  關背景程式 / 原生解析度 / 關滑鼠加速 / 只留一個分頁
  記下：顯示器型號、解析度、更新率、瀏覽器版本、滑鼠 DPI

【跑一場】
  ① 選手測試 Session
  ② 填 Participant ID（必填）+ Session label + 硬體欄位 → 下一步
  ③ Session Plan → 標準 Assessment（凍結協定）→ 確認家族與休息秒數 → 開始 Session Plan
  ④ 資格閘 → 進入 fullscreen 並開始 → 三項全 PASS
  ⑤ 受測者：點擊鎖定滑鼠 / A・D 橫移 / 左鍵開火 / Esc 解鎖
  ⑥ 排程自動推進，休息倒數歸零自動接下一個，不用按任何鍵

【收工】
  確認下載資料夾有每個 run 的 JSON
  確認「歷史紀錄」裡有本次 Participant 的 Assessment 紀錄
  記錄任何異常：suspect 警示條、保存失敗、重試次數
```

---

## 附錄：相關文件

| 想知道 | 看這裡 |
|---|---|
| 歷史紀錄／3D 重播的完整運維 | [history-center-replay.md](../operational/history-center-replay.md) |
| Tracking pilot 的協定世代與招募狀態 | [tracking-pilot-runbook.md](../operational/tracking-pilot-runbook.md) |
| 部署到非本機主機（COOP/COEP） | [deploy-headers.md](../operational/deploy-headers.md) |
| 匯出 JSON／CSV 的欄位定義 | [schema.md](../operational/schema.md) |
| 計時效度的量測與論證 | [timing-validity.md](../operational/timing-validity.md) |
| Stage6 pilot 的受測者準備流程 | [pilot-protocol-stage6.md](../operational/pilot-protocol-stage6.md) |
| 專案術語 | [../../CONTEXT.md](../../CONTEXT.md) |
| 全部文件導航 | [../MAP.md](../MAP.md) |
