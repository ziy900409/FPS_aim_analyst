---
name: aim-analyst-ui
description: Frontend / visual-design guidance for the FPS counter-strafe aim-analyst trainer — the in-drill HUD overlay and the post-drill measurement report (MetricsDashboard). Use when building or restyling any UI in this repo: settings panel, crosshair, drill prompts, results page, charts, tables, stat readouts, or when choosing colors, type, layout, or a chart approach. Encodes the project's locked "dark sports-science lab" identity and its vanilla TS + DOM (no-framework) constraints.
---

# Aim-Analyst UI

本專案的 frontend-design skill。延續 `/frontend-design` 的工藝原則（刻意、有觀點、反模板），但**收斂到這個 repo 已鎖定的視覺識別與硬約束**之上。任何在此 repo 寫 UI 的工作，先讀這裡。

> 撰寫語言：繁體中文 + 保留英文技術術語（決策 D4）。

## 何時用

建造或重塑此 repo 任何 UI 時：settings panel、crosshair、drill prompt（live HUD），或 MetricsDashboard / 量測報告、chart、table、stat readout（report）。選色、選字、排版、決定 chart 作法時也用。

## 與 `/frontend-design` 的關係

`/frontend-design` 是通用工藝（如何不做出模板感）。**本 skill 在它之上加兩層收斂**：

1. **方向已釘死** —— 視覺識別由 brief（參考圖：Sports Science Lab 量測報告）決定，不是每次重想。你的自由度花在「在這個識別內把東西做好」，不是另立調性。
2. **約束已釘死** —— vanilla TS + DOM overlay、無框架（D1）、研究儀器的可信度高於花俏。

`/frontend-design` 說「別落入 AI 預設三件套」；本專案的反制就是**忠實執行這套暗色儀器識別**（brief 的話永遠優先）。

## 核心張力（先內化）

這是 **esports 表現研究的量測儀器**，不是遊戲行銷頁。三條由此推導：

1. **可信 > 花俏**：精準、資訊密集、克制。美感來自對齊與 type，不是特效。
2. **誠實 > 漂亮**：UI 不得暗示資料沒有的精度（見下「誠實」）。這是研究效度硬約束，不可違反。
3. **兩個 surface、相反優先序**：
   - **live HUD**（drill 進行中）：不干擾量測、零網路、零 layout thrash。
   - **report**（drill 後）：儀器級密度與美感 —— 這才是參考圖那一面、craft 的所在。

## 已鎖定的設計 token（單一真實來源）

- 完整 token：[`assets/tokens.css`](assets/tokens.css)（暗底 `--bg-*`、洋紅 `--accent #e8285a`、四分類色、UI/mono 雙字體、4px grid、圓角、動態）。引 `var(--token)`，**勿散落 magic hex**。
- 現況範式：[`src/ui/SettingsPanel.ts`](../../../src/ui/SettingsPanel.ts) —— `createXxx()` factory 回 handle、`cssText` 行內樣式、callback 通知外部。沿用此形狀。

速記：暗中性底；**accent 只花在一處**（brand + 主 CTA + signature 線）；量測讀值一律 **mono + tabular-nums**；標籤 uppercase tracked。

## Signature element —— the trace

本產品被記住的那一個元素 = **counter-strafe 速度軌跡**：velocity-vs-time 線在反向鍵那刻**落到 0**，首發（firstShot）那點精準釘在線上。它把領域詞「counter-strafe」**畫**出來，比泛用 aim-speed 曲線更貼題。report 用大 hero、每 peek 用 sparkline。細節與誠實畫法見 [`references/design-language.md`](references/design-language.md) §5。

## 誠實呈現（研究效度硬約束）

- **residual speed 階段 A 是二元的**（CONTEXT §A）→ 以**分類**呈現（已停止/移動中、有無反向），**不**顯示誤導性連續 u/s。
- `suspect` / `bufferOverflow` / `recorderOverflow` / `lateEventCount` 旗標觸發 → 報告頁明示（`--warn`），不靜默。
- pre/post 只在受試者內相對比較有意義 —— 勿用語暗示對母體的因果。

## 工作流程

照 `/frontend-design` 的「brainstorm → plan → critique → build → critique」，但 plan 的 color/type/layout 已由本 skill 與 token 給定，所以你的 plan 應聚焦在：

1. 這個畫面的**單一任務**是什麼？最具特徵的東西先上（report 多半是 the trace）。
2. **結構即資訊**：分類色 = 條件身份（跨 chart/table 一致）；pre/post 用實心 vs hatch 冗餘編碼；每個指標標 scale-direction hint（higher/lower/consistent → good）。元件作法見 [`references/components.md`](references/components.md)。
3. **自我批判**：有沒有落回模板？有沒有只靠顏色區分？有沒有暗示假精度？有沒有在 live HUD 載字體/跑動畫？拿掉一個配件再交。

## 品質地板（不宣告，做到）

responsive、可見 keyboard focus、尊重 `prefers-reduced-motion`、色盲不只靠顏色（配 label / 填法）。

## 參考檔

- [`references/design-language.md`](references/design-language.md) —— 視覺識別、調色/字體理由、signature trace、版面、反模式。
- [`references/components.md`](references/components.md) —— vanilla DOM 元件食譜（card / stat / 分類色 / summary table / scale hint / pill / button）與兩 surface 紀律。
- [`assets/tokens.css`](assets/tokens.css) —— 可直接注入的 design token。