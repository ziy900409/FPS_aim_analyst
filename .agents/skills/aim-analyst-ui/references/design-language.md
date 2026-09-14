# 設計語言 — 已鎖定的視覺識別與其理由

> 本檔記錄**為什麼**是這些選擇（語意記憶），token 數值見 [`assets/tokens.css`](../assets/tokens.css)，元件作法見 [`components.md`](./components.md)。

---

## 1. 一句話方向

**暗色科學儀器（dark sports-science lab instrument）**。這是 esports 表現研究的量測報告，不是遊戲行銷頁。可信、精準、資訊密集；美感來自克制與對齊，不是特效。參考圖（Sports Science Lab 量測報告）已釘住此方向 —— 它是 brief，照走。

## 2. 調色盤（4–6 named hex）

| 角色 | hex | 由來 |
|---|---|---|
| 底 `--bg-0` | `#0f1113` | 近黑中性，襯托 canvas 與資料 |
| 面 `--bg-1` | `#16191d` | card / panel |
| 強調 `--accent` | `#e8285a` | 洋紅偏紅，參考圖品牌色 / section header / primary CTA |
| 分類 `--cat-1..4` | `#e83a6a` `#f5a623` `#3fa9f5` `#9b6dff` | 參考圖四裝置色；本專案複用為「比較條件」色 |
| 成功 / 警示 `--ok` `--warn` | `#2ecc71` `#f5a623` | Completed pill / suspect flag |

紀律：**accent 只花在一處**（brand + 主 CTA + signature 線）。其餘安靜。`--cat-*` 是資料的身份色，不拿來裝飾 chrome。

## 3. 字體（2+ role）

- **`--font-ui`**（Inter / system-ui）：chrome、標題、body。
- **`--font-mono`**（IBM Plex Mono…）：**所有量測讀值、tick index、時間戳、config**。等寬 + `tabular-nums`。
- 這個 **mono 讀值** 就是讓畫面「像儀表」的關鍵 type 處理，不是中性載體。
- 載入紀律：report surface 才載 webfont；**live HUD 一律 system-ui**（零網路、零 FOUT、不影響量測幀）。

## 4. 版面概念

**report**（參考圖）：左固定 profile sidebar（玩家 / 偏好 / Download）＋ 右捲動主區（裝置/條件 strip → tab → card grid → summary table）。資訊密集、hairline 分隔、card 圓角 12。

**live HUD**：極簡。準心精確置中（注意 `devicePixelRatio`，且**純裝飾**——指標不讀其座標）；settings panel 左上、鎖定中隱藏；prompt 邊緣、不搶中心。

## 5. Signature element —— counter-strafe 速度軌跡（the trace）

> frontend-design：「以該領域最具特徵的東西開場」。本專案最具特徵的不是泛用的 aim-speed 曲線（參考圖那條是別人的 brief），而是 **counter-strafe 的「速度歸零→開火」瞬間**。

**The trace** = 一條 velocity-vs-time 線，在按下反向鍵那刻**落到 0**，並把**首發（firstShot）**那一點精準釘在線上、標注殘餘速度分類。

- report **hero** 用大尺寸 trace；每個 peek 用 sparkline 版重複此語言。
- 線用 `--accent`；`v=0` 基準線 hairline；首發點一個 dot + 標注。
- **誠實**：階段 A 立即停止（M1）→ velocity 是純階梯函數（CONTEXT §B `MovementController`），trace 畫成 **snap-to-zero 的階梯**、讀值顯示**分類**（「已停止 / 移動中」「有無反向」），**不**畫平滑曲線、**不**標連續 u/s。trace 的形狀本身就誠實傳達「階段 A = 瞬間停」。階段 B physics 上線後同一元件自動長出真實減速曲線。

這條 trace 是整個產品被記住的那一個元素 —— 它把「counter-strafe」這個領域詞**畫**出來。

## 6. 動態

克制。report 載入可做一次**編排過的** card stagger reveal（≤200ms、ease-out、一次性），勝過散落特效。hover 微互動限 row / button。live HUD **不**跑與遊戲競爭的動畫。一律尊重 `prefers-reduced-motion`。

## 7. 反模式（別做）

- ❌ 落入 AI 預設三件套：暖奶油底 + 高反差 serif + 赤陶色；或純黑底配單一螢光綠/朱紅；或報紙式 hairline 多欄。本專案方向是**暗色儀器**，已由 brief 釘死，別漂走。
- ❌ 用 emoji 當資料圖示、漸層當裝飾、圓角不一致。
- ❌ 只靠顏色區分條件（要加 label / pre-post 填法）。
- ❌ 顯示資料撐不起的精度（階段 A 的 residual speed、對母體的因果語氣）。
- ❌ 在 live HUD 載 webfont 或跑動畫；讓準心元素參與量測。
- ❌ 為了「豐富」而加裝飾 —— Chanel 法則：出門前對鏡子拿掉一個配件。