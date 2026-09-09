# coach-figures — spider-shot-v3 教練報告的圖表產生器

_2026-09-09 建立。從一個 session 的暫存區保存下來,避免驗證過的幾何與色票被丟掉。_

> **這是 WP 工作資產,不是 src 模組。** 放這裡是因為它只服務 stage14 的教練報告文件。
> 若後續要正式化,依專案規則繪圖與 I/O 應落在 `research/src/modules/metrics/notebooks/`
> (C-D2:`algorithms/` 禁 I/O 與繪圖),或 `scripts/`。**可以隨時搬走。**

## 三個檔案

| 檔 | 職責 |
|---|---|
| `gen_charts.py` | 產生七張圖的 inline SVG 與對應表格。**座標全部由程式計算**,不目測。輸出 JSON。 |
| `build_coach_html.py` | 把 SVG + 表格注入完整 HTML(含 CSS、深淺主題、列印樣式)。 |
| `shot.mjs` | Playwright:light/dark 兩種主題逐圖截圖,並檢查 `getBBox()` 是否超出 `viewBox`、圖卡是否出現水平捲軸。 |

## 跑法

```bash
# 1. 產圖（寫出 figs.json）
python docs/exec-plan/active/stage14/coach-figures/gen_charts.py <工作目錄>/figs.json

# 2. 組 HTML（build 腳本會讀同目錄的 figs.json，需要時改 SP 常數）
python docs/exec-plan/active/stage14/coach-figures/build_coach_html.py <輸出.html>

# 3. 渲染檢查（必須從 repo 根目錄跑，才解析得到 node_modules/playwright）
cp docs/exec-plan/active/stage14/coach-figures/shot.mjs ./.tmp-viz-shot.mjs
node ./.tmp-viz-shot.mjs <截圖輸出目錄>
rm -f ./.tmp-viz-shot.mjs
```

`build_coach_html.py` 目前用 `SP = pathlib.Path(__file__).parent` 找 `figs.json`,搬動位置時要改。

## 要換成真實數字時改哪裡

**每張圖的資料都寫死在 `gen_charts.py` 各自的函式開頭**,現值全為示例:

| 函式 | 目前的示例資料 |
|---|---|
| `c1()` | 首發有效速度 25.1、基準 25.7、MDC 帶 ±2.0 |
| `c2()` | `hist` 六場 `(呈現速率, 首發命中率)`、`cur = (38, 66.0)` |
| `c3()` | `rows` = 本場 `[168, 214, 96]`、基準 `[172, 236, 74]` |
| `c4()` | `groups` = 方位 4 箱、幅度 3 tier 的 `(名稱, 命中率, n)` |
| `c5()` | `items` = 三個指標的 `(名稱, p50, p95, 單位, 小數位)` |
| `c6()` | `pts` = trial 窗中心與滾動中位數 |
| `c7()` | `cur` 三個 tier 的 `(ID, 命中時間, 標籤)`、擬合 `cs/ci`、基準 `bs/bi` |

**接手時請把這些常數換成由 `scripts/spiderShotV3CoachRunner.ts` 算出的真值**,不要在這裡重算幾何
(C-D4:`ε`／on-target／`D_deg`／`W_deg` 只有一套定義)。詳見
[`../HANDOFF-v3-real-data.md`](../HANDOFF-v3-real-data.md)。

## 已驗證的事（不要重做,但改色就要重跑）

調色盤以本文件系列實際的 surface(淺 `#ffffff`／深 `#171e2d`)跑過 dataviz 六項檢查,
light／dark 在 `--pairs all` 下全數 PASS;淺色 series-3 對比 2.82:1 觸發 relief 規則
⇒ **所有堆疊段一律直接標值**。系列上限 3。

```
node <dataviz-skill>/scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light --surface "#ffffff" --pairs all
node <dataviz-skill>/scripts/validate_palette.js "#3987e5,#d95926,#199e70" --mode dark  --surface "#171e2d" --pairs all
```

## 渲染檢查抓到過的問題（回歸清單）

改動後請確認這四類不再出現:

1. C2 等值線畫到繪圖區外(等值線的取樣範圍必須夾在座標軸 domain 內,不可 ±6 外擴)。
2. C7 讀數框底部超出 `viewBox`(容器高度必須含 x 軸標籤帶與讀數框)。
3. C3 粗飽和色塊 + 淺色列上白字看不清(參考列改細棒 + 值標在棒下、用 ink 色)。
4. **文字說明與視覺矛盾** —— C4 曾寫「淺色 = 最弱」而實際是實色強調。
   `shot.mjs` 抓不到這一類,**必須人眼看圖**。
