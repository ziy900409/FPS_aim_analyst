# BoBoTest 3D 射擊訓練研究與 FPS_aim_analyst 優化建議

- 研究日期：2026-08-19（Europe/Amsterdam）
- 目標頁面：[BoBoTest FPS 瞄準在線測試](https://bobotest.com/zh/aim-trainer)
- 公開客戶端資源（建置檔名可能日後變更）：[`d0b7eb714d2018f5.js`](https://bobotest.com/_next/static/chunks/d0b7eb714d2018f5.js)
- 方法：取得伺服器 HTML（HTTP 200）、解析頁面可見文字，並定點核對公開客戶端程式中的模式參數、目標生成、輸入、遊戲迴圈、命中及計分邏輯。未登入帳號，也未評估網站其他頁面的歷史紀錄或帳號功能。

## 1. BoBoTest 已驗證功能

### 使用流程與介面

- 16:9 的 3D 訓練區，右側 360px 設定欄，場景內左上即時 HUD。
- 開始、結束本輪、重置；Pointer Lock，Esc 釋放滑鼠。
- 固定位置或可行走；可行走時支援 WASD，Shift 為 1.5 倍移速。
- 可調訓練時間、滑鼠速度、移動速度、十字／點準星，以及 X/Y 軸反轉。
- 即時回饋：得分、命中率、命中／射擊、平均／最佳反應、目前／最佳連擊、最近五次命中。

### 三種訓練模式

| 模式 | 預設參數 | 實際主要訓練內容 |
| --- | --- | --- |
| 連續圓球 | 60s、同時 1 目標、半徑約 0.58、基礎 110 分、靜止 | 目標獲取、flick、click timing |
| 多目標速射 | 45s、同時最多 5 目標、每 520ms 補生、半徑約 0.42、基礎 85 分、低速移動 | 視覺搜尋、目標切換、壓力下點射 |
| 移動追蹤 | 50s、同時最多 2 目標、每 760ms 補生、半徑約 0.48、基礎 130 分、速度 1.7u/s | 移動目標獲取；介面稱 tracking，但評分仍以點擊命中為主 |

目標的半徑另乘 0.88–1.14 隨機倍率，位置約在 x=[-7.4,7.4]、y=[1.35,5.4]、z=[-30,-12]；移動目標在固定 3D 邊界反彈。

### 命中與計分

- 從畫面中心做 Three.js raycast；每次左鍵都計一次射擊，沒打中則 miss +1 並中斷連擊。
- 命中反應時間定義為 `performance.now() - spawnedAt`。
- 單次得分約為：`round(模式基礎分 + 0.08 * max(0, 700 - 反應ms) + min(90, 8 * 連擊))`。
- 隨機生成使用 `Math.random()`，遊戲及目標運動由 `requestAnimationFrame` 推進，frame delta 上限 50ms。
- 滑鼠旋轉係數是 `0.0023 * 介面靈敏度`；程式中未觀察到 `unadjustedMovement` 原始輸入請求。

## 2. 教練觀點：值得借鑑與不宜照抄之處

### 值得借鑑

1. **低認知負擔**：模式名稱直接描述任務，開始後立即進入訓練。
2. **一眼可讀的回饋**：比分、準度、反應、連擊及最近命中同屏呈現，適合短時暖身。
3. **三種核心情境覆蓋清楚**：單目標、目標切換、移動目標；固定／可走又增加基礎情境變化。
4. **微回饋密度高**：每次命中都回報分數和反應時間，能提高投入感。

### 不宜當成量測標準

1. **「反應時間」混合了知覺、flick 距離、目標大小與動作時間**；隨機位置／距離／大小不同，不能直接比較每一球，也不能當純反應速度。
2. **tracking 名稱與量測不一致**：目標在移動，但沒有 time-on-target、RMS angular error、acquisition failure 等連續控制指標；點擊反應無法代表跟槍品質。
3. **移動射擊沒有武器準度或 counter-strafe gate**：固定與移動在命中模型上等價，無法訓練 CS2 類型的停槍同步。
4. **隨機與 rAF 造成可重現性不足**：無 seed、非固定 tick、無逐 tick/event 匯出；適合遊戲化練習，不適合嚴格前後測。
5. **總分混合多個構念**：基礎分、速度與連擊加總，且未依角距、角尺寸或模式難度正規化；高分不容易轉成可操作的技術診斷。

## 3. 與本專案的差異

本專案的核心優勢不是「再做一個簡易 Aim Lab」，而是量測效度：

- 128Hz fixed-step sim、sim clock、seeded spawn、原始輸入能力與 fallback metadata。
- Data-driven `DrillConfig`、多場景、武器／後座、靜止門檻、counter-strafe、追蹤與遠距角尺寸／角速度設計。
- 逐 tick + event schema v2 匯出；品質 flags、dt gap、suspect、版本化演算法。
- 結果頁已有 counter reaction、residual speed、fire alignment、first-shot hit、crosshair offset、switch time、rhythm、左右對稱與後座路徑。
- 追蹤推導已具 acquisition failure、tAcquire、TOT%、RMS／median／P95 epsilon；離線 coach-report-v2 另有 phase、curve 與受 gate 約束的研究指標。

目前明顯缺口主要在**產品化閉環**：玩家容易看到很多正確數字，卻還不容易回答「我最該修哪一件事、下一輪練什麼、何時算改善」。可選 drill 名稱也偏工程識別碼，對一般選手不夠直觀。

## 4. 建議優先級

### P0 — 先完成「診斷 → 處方 → 複測」閉環

在現有 Metrics／PromotedMetrics 上新增純 view-model 的 `CoachingSummary`，每輪只輸出：

1. 一個主要限制因素；
2. 一句動作提示；
3. 一個下一輪 drill 與固定參數；
4. 一個複測成功條件。

範例規則：

- residual speed 高、fire alignment 偏早 →「先完成反向制動再點擊」，處方 counter-strafe 節奏 block。
- first-shot hit 尚可但 crosshair offset 大／micro-adjustment 多 → 降低速度、維持角距，練單次乾淨 flick。
- tracking acquisition failure 高 → 先練 acquisition；已能取得但 TOT 低／RMS epsilon 高 → 練持續微調。
- 左右反應差明顯且 n 足夠 → 弱側加量，但不把差異解讀成人口常模。

紅線：只使用已通過現有 validity／quality gate 的指標；flags 不空或 n 不足時顯示「資料不足」，不硬給建議。建議規則本身需帶 `recommendationVersion`，保持可重現。

### P0 — 將工程 drill catalog 改為選手語言

保留內部 `drillId`，外層提供：訓練目標、難度、時長、需要的技巧、主要評分指標、場景／武器。首屏只給 3 個入口：

- 5 分鐘快速評估
- 10 分鐘急停首發
- 10 分鐘追蹤控制

另明確分開 `Practice` 與 `Assessment`：Practice 可顯示即時 cue、音效、連擊；Assessment 固定 seed family、隱藏會改變策略的 HUD，結束才回饋。這能吸收 BoBoTest 的易用性，同時保住本專案的量測效度。

### P1 — 先用 config-only 建立受控難度矩陣

不要先做任意 slider。先發布少量可比較的標準條件：

- Tracking：現有文件已列出 0.5°／2.0° 角尺寸 × 5°／20°/s 角速度四格，可直接成為四個標準 block。
- Flick／pop-in：固定角距 D 與角尺寸 W 的 2×2 或 3×3 設計，讓 Fitts 的 D/W 真正成為受控操弄，而不是事後從隨機目標觀察。
- Counter-strafe：固定 side、初速／peek 節奏與武器模式的條件矩陣。

每個條件保存 config、seed、scene、weapon、input/display metadata。跨次比較用同一條件；不同條件不要以單一總分硬排名。

### P1 — 做「block 間自適應」，暫不做 block 內即時自適應

依上一個 block 的結果決定下一個 block：

- acquisition failure 過高 → 放大角尺寸或降角速度；
- TOT 高且 RMS epsilon 穩定 → 小幅縮小目標或升角速度；
- first-shot hit 穩定且 offset 低 → 增加角距；
- residual speed 未過 gate → 不提升瞄準難度，先留在 movement timing。

調整需有上下限與固定階梯，並記錄決策原因。不要在同一 scored block 中每球動態改難度，否則樣本不再同質，報告與前後測難以解讀。

### P1 — 加入本機 session history 與同人基線

- 分開「評估」與「練習」資料。
- 顯示最近一次、近 5 次中位數、最好穩定區間，以及樣本數／flags。
- 僅做同一選手、同一條件、同一硬體／靈敏度的趨勢；尚無跨玩家常模時，不做百分位排名。
- 進步判定優先使用多次 session，而非單輪高分。

### P1 — 靈敏度與環境校準產品化

將現有 mouse gain、ADS、FOV 與 metadata 轉成可見的遊戲 profile：遊戲名稱、hip/ADS、FOV、cm/360、DPI、raw-input 狀態、refresh rate。開始 Assessment 前用 eligibility gate 阻擋或標記不一致設定；Practice 則可降級但清楚提示。

### P2 — 視產品定位再做多目標壓力場景

BoBoTest 的 frenzy 能增加掃視與優先序壓力，但本專案目前的 `DrillRunner`／`TargetManager` 語意以單 active target 為核心。若要支援同時多目標，應把它視為 `DrillConfig v2` 的新構念，另定義 target selection、錯誤目標、切換起訖與 despawn 規則；不要只把 `targets.length` 放寬，否則既有 switch-time／peek window 意義會被破壞。

### P2 — 遊戲化與研究分數徹底分離

可以加入 streak、徽章、每日任務與快速重來，但它們只屬 Practice。Assessment 與 coach report 保持原始、可解釋指標；若要一個遊戲分數，須明示為 engagement score，不可取代技術診斷。

## 5. 建議的第一個交付切片

不改 sim、schema 或研究演算法，先交付：

1. drill catalog 的玩家語言 metadata；
2. `Practice | Assessment` 兩種 UI 模式；
3. 結果頁的「主要限制／下一輪建議／複測條件」三張卡；
4. 追蹤結果頁直接顯示既有 tAcquire、TOT%、RMS epsilon；
5. recommendationVersion + 建議來源指標的 n／flags。

這個切片風險最低、最能放大既有研究資產，也最直接吸收 BoBoTest 的即時、易懂、可重玩的優點。
