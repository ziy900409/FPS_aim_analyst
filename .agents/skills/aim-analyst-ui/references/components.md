# Component 食譜 — vanilla TS + DOM overlay

> 全部純 TS 建 DOM、引 `var(--token)`（見 [`assets/tokens.css`](../assets/tokens.css)）。**不引 React/Vue/Lit/charting lib**（D1）。
> 現況範式見 [`src/ui/SettingsPanel.ts`](../../../../src/ui/SettingsPanel.ts)：`createXxx()` factory 回 handle、`cssText` 行內樣式、callback 通知外部。沿用此形狀。

---

## 0. 兩種 surface 的紀律

| Surface | 何時 | 設計優先序 | 禁忌 |
|---|---|---|---|
| **live HUD**（drill 進行中：crosshair、settings、prompt） | 鎖定中 | 不干擾量測、零網路、零 layout thrash | 不載 webfont、不在 rAF/sim 期跑動畫、準心**只置中裝飾**（指標不讀其座標，CONTEXT §A）、解除鎖定才顯示 settings（OQ-1.3） |
| **report**（drill 後：MetricsDashboard / 量測報告） | 結束後 | 儀器級資訊密度與美感（= 參考圖那一面） | 不顯示資料撐不起的精度（見 §6） |

---

## 1. Panel / Card

卡片是報告頁的容器原子。hairline 邊、暗底、圓角 `--r-card`，標題列左標題右動作。

```ts
function makeCard(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement('section');
  root.style.cssText = [
    'background:var(--bg-1)',
    'border:1px solid var(--line)',
    'border-radius:var(--r-card)',
    'padding:var(--sp-6)',
    'display:flex',
    'flex-direction:column',
    'gap:var(--sp-4)',
  ].join(';');

  const head = document.createElement('header');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
  const h = document.createElement('h2');
  h.textContent = title;
  h.style.cssText = 'margin:0;font:600 var(--fs-h2)/1.2 var(--font-ui);color:var(--text-hi)';
  head.append(h);

  const body = document.createElement('div');
  root.append(head, body);
  return { root, body };
}
```

## 2. Stat readout（量測讀值）

儀器感的核心：**值用 mono、tabular-nums**，標籤 uppercase tracked 在上。

```
┌──────────────────────┐
│ FIRST-SHOT HIT RATE   │  ← .label
│ 73.4%                 │  ← .metric-value（mono）
│ ▲ higher → good       │  ← scale-direction hint，見 §5
└──────────────────────┘
```

## 3. 分類色 + pre/post 填法（資料 = 身份，非裝飾）

- 每個比較條件（session / 對照組 / 左右 peek）綁一個 `--cat-n`，跨 chart 與 table **一致**。
- **永不只靠顏色**：pre/post（前後測）用**填法**作冗餘編碼 —— `pre` = 實心、`post` = 斜線 hatch（對齊參考圖）。色盲也能讀。

```ts
// 斜線 hatch（post 填法），純 CSS：
el.style.background =
  'repeating-linear-gradient(45deg, var(--cat-3) 0 2px, transparent 2px 5px)';
```

## 4. Summary table（指標總表）

每列一個指標 → scale hint → 各條件的 pre/post 欄。值 mono、依條件上色。row hover `--bg-2`。

```
METRIC            DIRECTION         SESSION A          SESSION B
                                    pre     post       pre     post
Accuracy          higher → good     XX.X    XX.X       XX.X    XX.X
First-shot hit %  higher → good     ...
Counter reaction  lower  → good     ...
Rhythm CV         lower  → good     ...
L/R symmetry      consistent → good ...
```

## 5. Scale-direction hint（怎麼讀這個數字）

每個指標都標方向，否則讀者不知道高好還是低好。對齊 [CONTEXT.md](../../../../CONTEXT.md) §A：

| 指標 | 方向 |
|---|---|
| 首發命中率、accuracy | `higher → good` |
| 急停反應時間、切換時間、停火時序對齊 | `lower → good` |
| 節奏穩定度（CV / 標準差） | `lower → good` |
| 左右對稱性 | `consistent → good`（趨近 0 差異） |

## 6. 誠實呈現（研究效度硬約束）

> 規格的研究效度前提：UI **不得**暗示資料沒有的精度。

- **residual speed 階段 A 是二元的**（CONTEXT §A：velocity ∈ {0, ±v}）。結果頁以**分類**呈現（開火時「已停止／移動中」、「有無反向」），**不**顯示誤導性連續 u/s。欄位先存、階段 B physics 上線才升級成連續讀值。
- `suspect` / `bufferOverflow` / `recorderOverflow` / `lateEventCount` 等旗標若觸發 → 報告頁明示（`--warn`），不靜默。
- pre/post 只在受試者內相對比較有意義（CONTEXT §A）；勿用語暗示對母體的因果結論。

## 7. Pill / 狀態徽章

`Completed` = `--ok` 底、`--r-pill`、小字。`suspect` = `--warn`。對齊參考圖左上角狀態膠囊。

## 8. Button / CTA

primary = `--accent` 實心（如參考圖紅色 Download）；hover → `--accent-hi`；focus 必須有可見 ring（`outline:2px solid var(--accent-hi)`）。secondary = 透明 + `--line` 邊。