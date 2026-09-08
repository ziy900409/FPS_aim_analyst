# WP-60 T3 — 時間間隙切段原語與 Pointer Lock 消歧

## Objective

交付 `segmentByTimeGap()` —— 把原始取樣依硬體時間間隙切成區段，並把 **Pointer Lock 中斷造成的空洞排除在候選之外**。這是 PA LOD 管線的 Stage 1（也是它的**閘**：後兩階段只能在已存在的間隙上細修）。

**本 task 不宣稱偵測抬滑鼠。** 它交付的是一個中性的幾何／時序原語；判準與參數校準屬 WP-61（README §5）。

## Inputs to read

- [README.md](README.md) §2.3（`SampleGap`／`SampleSegmentation`／`segmentByTimeGap` 簽名）、§2.6 F2/F4、§3.1 R6/R7。
- T0 的實機事件率分布與抬起／停頓空洞分布（決定 `gapThresholdMs` 的可行範圍）。
- `performance_analysis` ADR-002 Stage 1 的語意與 `lod_v3_default_config.json` 的 `TIME_GAP_THRESHOLD_MS`／`GAP_CONFIRM_MS`（授權無虞，D-60.P7 —— 可直接引用為起點，但須記名來源，且 30 ms 是建立在 1 ms nominal dt 上的，本專案要以 T0 實測事件率重推）。
- `src/metrics/spiderShotRepositioning.ts`（同類離線純函式的形狀、C-D3 boundary scan 手法、「呼叫端必填門檻、不凍結預設值」的紀律）。
- WP-57 Surprises 6（負向測試要證明的是**哪一個**原因 —— 本 task 的 F2 正是同型陷阱）。

## Steps

1. 新增 `src/metrics/mouseSampleGaps.ts`，實作 README §2.3 的三個型別與 `segmentByTimeGap()`。
2. `gapThresholdMs` **呼叫端必填、不給預設值**（比照 `RepositioningSuspicionOptions.stallMinMs` 的紀律）—— T0 量到的實機事件率決定它的合理範圍，但那條件於硬體，凍成常數會說謊。
3. 依 OQ-60.3 的 `pointer_lock` 事件推導 `lockIntervals`，把與之重疊的間隙收進 `lockGapIndices`，並**排除在 `gaps` 之外**（不是標記後留著 —— 留著就會有人忘記過濾）。
4. 邊界處理：`dtUs` 為空／單筆樣本 → 回空 segmentation 而非擲錯；三個 columnar 陣列不等長 → 擲**指名欄位**的錯；`gapThresholdMs` 非正有限 → 擲錯。
5. 對抗性 fixture：**恰在門檻上**／**恰在門檻下**兩例；連續兩個間隙；間隙落在區段首／尾；整份取樣都是一個大間隙；lock 中斷恰好與真實間隙相鄰（F2 的關鍵案例）。
6. **C-D3 / C-D4 boundary scan**（比照 `spiderShotRepositioning.test.ts` 的 `codeOnly()` 剝註解手法）：
   - `src/` 內零 importer（本模組不進教練報告／診斷規則／registry）；
   - 模組原始碼零命中 `omegaDegPerSec`／`deriveDetectionMetrics`／`deriveRepositioningSuspicion` —— **證明它不是既有停滯判準的第二定義**（R6）；
   - 全 repo 零 `LOD` 縮寫命名（R7，`THREE.LOD` 衝突）。
7. NFR-60.6 純度掃描：零 DOM／`three`／`node:*`／`fs`／`Date.now`／`performance.now`／`Math.random` 命中。
8. 以 T0 錄到的（不進 repo 的）真人取樣跑一次，把區段數／間隙長度分布寫進 `progress.md` —— **數字寫入文件，檔案不入 repo**（沿用 D-57.T5-8）。

## Invariants

- 純函式：不讀時鐘、不讀隨機、無 I/O。
- **不新增第二套「抬滑鼠」構念**（R6／OQ-60.4）。型別與函式名一律用中性的時序語彙（`gap`／`segment`），不得出現 `lift`／`reposition`／`suspicion`。
- 不修改 `deriveRepositioningSuspicion()` 或任何既有 metrics。
- 不直接搬 PA 的 Go 程式碼（**技術性理由，非法律性**，D-60.P7）：那份實作綁死 px/s 空間、1 ms nominal dt 與 pandas 語意相容性，硬搬過來會把三個錯誤的前提一起帶進來。以 TS 重寫並在 `progress.md` 記名來源與差異。
- `lockGapIndices` 所指的間隙**不得**同時出現在 `gaps` 裡。

## Definition of Done

- [ ] `segmentByTimeGap()` 簽名與 README §2.3 完全一致；`npx tsc --noEmit` exit 0。
- [ ] 對抗性 fixture 六例全綠，含**恰在門檻上／下**兩例（浮點容差策略記入註解）。
- [ ] F2 案例：lock 中斷與真實間隙相鄰時，前者進 `lockGapIndices`、後者留在 `gaps`，兩者**不重疊**（一個斷言同時檢查兩邊）。
- [ ] 非法輸入四例（陣列不等長／`dtUs` 負值／`gapThresholdMs` 非正／非有限）各擲出**指名欄位**的 typed error（斷言含欄位名）。
- [ ] 空／單筆輸入回空 segmentation 而非擲錯（一個斷言）。
- [ ] C-D3 scan：`src/` 內 importer 數為 **0**。
- [ ] C-D4 scan：模組原始碼（剝註解後）對三個既有判準符號的命中數為 **0**。
- [ ] 全 repo `LOD` 縮寫命名命中數為 **0**。
- [ ] NFR-60.6 純度掃描七個 pattern 全數零命中。
- [ ] 真人取樣的區段／間隙分布寫入 `progress.md`（含 `gapThresholdMs` 取值與理由）；來源檔案未入 repo。
- [ ] 全量 Vitest 綠；typecheck ×2 與 `vite build` exit 0。

## Commit

```text
feat(metrics): segment raw mouse samples by hardware time gap
```
