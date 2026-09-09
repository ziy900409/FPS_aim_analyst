# WP-61 T4 —（**條件式**）判準凍結、TS 實作與 C-D5 對表

## Objective

**只有** T3 判定為 `promote` 時才執行。把通過 held-out 的判準凍結成一個**版本化純函式**，在 `src/metrics/` 建 TS 實作，並以 golden fixture 建立 Python ↔ TS 的雙實作對表（C-D5）。

> ⚠️ **開工前置檢查**：T3 的判定必須是 `promote`，且該判定的三欄對照（規則原文 → 實際值 → 判定）已在 `progress.md` 中。判定為 `not-separable` 或 `insufficient-evidence` 時，本 task **不執行** —— 直接走 T-exit 的負面結論路徑。

## Steps

1. **前置閘**：覆核 T3 判定為 `promote`，且校準集與 held-out 的差距在 T0 凍結的可接受範圍內。不滿足即停止並記錄。
2. **凍結參數**：把 T3 選定的 `gapThresholdMs`（OQ-61.7 的最終值）、`windowMs`、各層門檻寫成一組**具名 config**，附每個值的依據。版本字串（例如 `sensor-lift-v1`）一併凍結。
3. **邊界運動學 TS 實作**：`src/metrics/mouseSampleBoundaryKinematics.ts`，簽名依 README §2.3 的 `deriveGapBoundaryKinematics()`。`windowMs` **無預設值、呼叫端必填**（比照 `gapThresholdMs` 與 `RepositioningSuspicionOptions` 的紀律）。
4. **判準 TS 實作**：`src/metrics/sensorLift*.ts`（確切檔名依 T0 拍板的構念名）。純函式；參數由呼叫端或具名 config 注入，**不得**硬編未經校準的常數（FR-61.9）。
5. **合成邊界 fixture**：對抗性案例 —— 恰在門檻上／恰在門檻下、窗內樣本數恰為下限／少一個、`nBefore = 0`、gap 位於 block 首尾、lock gap。每一對都要綠。
6. **C-D5 golden parity**：以 T2 的 cohort golden 產出 Python 側輸出，commit 成 `research/fixtures/golden/` 的 parity fixture；TS 側 `promoted-*.test.ts` 斷言逐位（或在 T0 凍結的容差內）相符。**兩端任一語意變更必須同步重跑產生腳本並讓 parity 全綠；版本字串只能升版，不得原地改語意。**
7. **構念登錄**：在 [`CONTEXT.md`](../../../../../CONTEXT.md) 寫入新構念的正式定義，與既有「抬滑鼠疑慮旗標（repositioning suspicion）」**互相指名**、明列兩者的差異（訊號來源、時間粒度、可回答與不可回答的問題）。
8. **C-D3 標記**：判準的輸出必須自帶 `research_only` 的語意標記與**宣稱範圍**（OQ-61.6：本操作者 × 本硬體 × 本 drill）。`src/` 內的 importer 數必須為 **0**（比照 `deriveRepositioningSuspicion()` 的既有處置），由 boundary 測試釘死。
9. **突變驗證**：對每一個新斷言做故意突變，確認抓得到；還原用 `cp` 備份（禁 `git checkout --`）。
10. 跑全量閘並逐項歸屬差額。

## Invariants

- 純函式：不 import DOM／`three`／`node:*`／`fs`；不讀 `Date.now`／`performance.now`／`Math.random`（NFR-61.3 掃描）。
- **不修改** `deriveRepositioningSuspicion()`、`segmentByTimeGap()`、`deriveUnlockedIntervals()` 的任何一行語意。
- 命名雙向隔離：新模組對 `reposition`／`suspicion` 零命中；`spiderShotRepositioning.ts` 對新構念名零命中（F6）。
- 判準**不進教練報告**（C-D3），且 `src/` 內零 importer。
- 版本字串一旦 commit 即凍結；語意變更 ⇒ 升版 + 重跑 golden 產生腳本（C-D5）。

## Definition of Done（可驗證證據）

- [ ] 前置閘覆核紀錄：T3 判定為 `promote` 的三欄對照已引用；校準／held-out 差距在凍結範圍內。
- [ ] 凍結參數表：每個值 + 依據 + 版本字串，記入 `progress.md` 與模組 docstring。
- [ ] `deriveGapBoundaryKinematics()` 對非法輸入（`windowMs` 非正有限、三陣列不等長、gap index 越界）擲出**指名欄位**的錯誤 —— 每種各一個案例。
- [ ] 合成邊界 fixture 六類（恰上／恰下／樣本數恰為下限／少一個／`nBefore = 0`／首尾與 lock gap）全綠。
- [ ] **C-D5 parity**：`promoted-*.test.ts` 綠；golden 產生腳本的指令 + 輸出檔清單 + 雜湊記入 `progress.md`；一支測試證明「改 Python 側語意而不重跑 golden」會讓 parity 轉紅（突變驗證）。
- [ ] **純度掃描**綠：新模組零 DOM／`three`／`node:*`／`fs` import，零時鐘／隨機命中（指令 + exit code）。
- [ ] **命名雙向掃描**綠（兩個方向各一個指令 + exit code）。
- [ ] **零 importer**：`src/` 內對新判準的 import 命中數為 0；build 產物不含該模組（比照 `deriveRepositioningSuspicion()` 的既有斷言手法）。
- [ ] `CONTEXT.md` 兩個構念已互相指名，且新條目寫明宣稱範圍與 `research_only` 標記。
- [ ] 每個新斷言的突變驗證各抓到 ≥ 1 個 case；突變前後的 failed 數記入 `progress.md`。
- [ ] `npm run typecheck` ×2、全量 Vitest、`vite build`、`uv run pytest` 皆 exit 0；測試數差額逐項歸屬（含平行 session 的歸屬）。

## Commit

```text
feat(metrics): add versioned sensor-lift criterion
```
