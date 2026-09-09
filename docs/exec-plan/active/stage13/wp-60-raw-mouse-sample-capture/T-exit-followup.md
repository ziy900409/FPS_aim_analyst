# WP-60 T-exit 後續 — 三項具名缺口的收尾計畫

> 上游：[T-exit-gate.md](T-exit-gate.md) · 執行紀錄：[progress.md](progress.md) §T-exit gate（2026-09-09）
> 前置：WP-60 已於 2026-09-09 合併進 `main`（merge commit `9015610`），worktree `wp-60-raw-mouse-t1` 的分支已落地。

---

## 0. 這份檔在解什麼

T-exit 判定為 **✅ 帶三項具名缺口**。三項**都不是實作缺口** —— 是需要「真人操作 + 真瀏覽器 + 真滑鼠」或「一個沒被占用的 port」才能取得的**經驗性讀數**。本檔把它們拆成三個可獨立執行的 task，附 paste-ready prompt。

| ID | 缺口 | 阻塞條件 | 誰能解 | 可否與他人並行 |
|---|---|---|---|---|
| **TF1** | F6 —— 瀏覽器 frame log 開／關對照（A-60.16 的另一半）| 需真人操作 + 真滑鼠 | 使用者錄，agent 算 | 可 |
| **TF2** | T3 DoD 第 9 項 —— 真人取樣的區段／間隙分布 | 同上（**與 TF1 共用同一次錄製**）| 使用者錄，agent 算 | 可 |
| **TF3** | 全量 Playwright 讀數 | port 5173／4173 必須沒有別人的 dev server | agent（需使用者同意停 server）| **否** —— 會與任何 e2e／dev server 搶 port |

> ⚠️ **TF1 與 TF2 共用同一次錄製** —— 兩者要的資料都在同一組匯出裡（見 §1.1）。**先讀完 TF1+TF2 再開始錄**，不要錄兩次。

---

## 1. TF1 + TF2 —— 一次錄製，兩個缺口

### 1.1 關鍵發現：不需要新的儀器

T-exit 覆核時確認：F6 要的三個量**已經全部在既有匯出的 `meta` 裡**，不需要寫任何探針或 harness。

| F6 要的量 | 匯出欄位 |
|---|---|
| frame time p50 / p95 / p99 | `meta.frames.summary.p50` / `.p95` / `.p99` |
| 掉 tick / 超預算 | `meta.frames.summary.overBudgetWindows`（＋ `.count`、`.overflow`）|
| 效度旗標是否翻紅 | `meta.suspect`（`frames.summary.p95 > PERF_FLOOR_MS` 時為 true）|
| 輸入鏈是否吃不消 | `meta.lateEventCount`、`meta.bufferOverflow` |
| 原始取樣本身（TF2 用）| `mouseSamples.{t0Ms,dtUs,dx,dy}` + `meta.mouseSampling` |

⇒ **錄兩份匯出（關／開）即可同時結掉 TF1 與 TF2。** 別再寫 console 探針 —— T0 R1 那次的探針重複計數就製造過一個 25% 的假缺口（見 progress.md §Run A）。

### 1.2 錄製協定（使用者操作，約 10 分鐘）

**前置**：Chrome 或 Edge 桌面版、1000 Hz 滑鼠、`crossOriginIsolated === true`（走 `npm run dev` 或 `npm run preview`，**不要** `file://`）。

1. `npm run dev`（若 5173 被占用，改 `npm run dev -- --port 5174` 並把下面的 port 一起換掉）。
2. **A 組（關閉錄製，對照）**：開 `http://localhost:5173/`，跑 **`spider-shot-wide-v1`**，**60 秒以上、連續拉槍**，結束後匯出 JSON。
3. **B 組（開啟錄製）**：開 `http://localhost:5173/?rawMouse=1`，**同一個 drill、同樣時長、同樣打法**，結束後匯出 JSON。
4. **不要中斷 Pointer Lock**（不按 Esc、不 alt-tab）—— 中斷會在原始取樣裡留下與抬滑鼠同形的空洞（FR-60.6），也會污染 A/B 的 frame time 對照。
5. 兩份 JSON 放進**任何 repo 外的資料夾**（例如桌面），把路徑給 agent。
   ⚠️ **匯出檔本身不進 repo**（D-57.T5-8）—— 只有統計摘要會寫進 `progress.md`。

**若要順便加強 TF2**：再錄一份 **C 組**（`?rawMouse=1`，刻意在拉槍之間**抬起滑鼠 10 次**，每次抬起前後停 1 秒）。這會讓間隙分布同時涵蓋「連續移動」與「抬起」兩種母體 —— 但**不得**據此宣稱可分離（D-60.R2-1 已判定空洞長度分不開 lift/pause）。

### 1.3 TF1 Steps（agent，拿到兩份 JSON 之後）

1. 逐份讀 `meta.frames.summary`、`meta.suspect`、`meta.lateEventCount`、`meta.bufferOverflow`、`meta.frames.summary.count`，以及 B 組的 `meta.mouseSampling`。
2. 覆核 A/B **可比性**，不可比就說出來、不要硬比：
   - `meta.drillId` 相同、`meta.frames.summary.count` 差異 < 20%（時長相近）、`meta.displayHz`／解析度模式相同、`meta.crossOriginIsolated === true`。
   - B 組 `meta.mouseSampling.recorded > 0`（否則錄製其實沒開，整組作廢）。
3. 算 Δp50／Δp95／Δp99 與 ΔoverBudgetWindows，對照 tick 預算 **7.8125 ms**。
4. **判定**：Δp95 ≤ 0.5 ms 且 `overBudgetWindows` 未新增 ⇒ F6 通過（README §2.6 F6 的門檻）。超標則**照實記錄並開 KI**，不得調門檻。
5. 把「指令 + 實際數字」寫進 `progress.md` §T-exit gate 的 A-60.16 那一列（把 🟡 改掉），並在 §最新狀態 更新缺口清單。
6. 同步 [task-checklist.md](task-checklist.md) 的 Package DoD 第 3 項（frame-time 那一項）。

**TF1 DoD**
- [ ] A/B 可比性五項逐條覆核，不可比即停止並說明。
- [ ] Δp50/Δp95/Δp99 + ΔoverBudgetWindows 有實際數字（非「無明顯差異」）。
- [ ] A-60.16 由 🟡 翻為 ✅ 或 ❌ + 歸因；**不得**留在 🟡 而只說「已量測」。
- [ ] 匯出檔未進 repo。

**TF1 Commit**：`docs(stage13): record WP-60 F6 browser frame-time comparison`

### 1.4 TF2 Steps（agent，同一批 JSON）

1. 先跑既有的操作者報告（**它現在會用修正後的 `activeRateHz`**，D-60.X1）：
   ```powershell
   npm run analyze:spider-wide -- "<B組.json>" --out "<scratch>/raw-real"
   ```
   讀「原始取樣健康度」子表七欄，確認 `activeRateHz ≥ 500`（否則後面的間隙分布不可信，F1）。
2. 算**分布**（報告只給計數，DoD 要的是分布）。寫一支 **throwaway** script（放 scratchpad，**不進 repo**），以 `vite-node` 執行，import `src/metrics/mouseSampleGaps.ts`：
   - `deriveUnlockedIntervals(payload.events, lastSampleMs)` → `segmentByTimeGap(block, threshold, unlocked)`。
   - 門檻**做 sweep**：`18`（T0 R1 的雜訊底線）／`30`（PA prior）／`50`，三個各出一組。
   - 每組輸出：區段數、各區段樣本數的 p50/p95、間隙數、間隙長度 p10/p50/p90/max、`lockGapIndices.length`。
3. 把三組結果寫進 `progress.md`（表格），並**明文寫上限制**：
   - 這是**描述性**分布，**不**宣稱任何一個空洞是抬滑鼠（C-D3／C-D4／D-60.R2-1）；
   - 門檻仍**未校準**，sweep 只顯示敏感度，不構成選擇依據；
   - n 與錄製條件（硬體、DPI、drill、時長）要一併記，否則下一個人無從比較。
4. 把 T3 的狀態從 🟡 更新為 ✅（DoD 第 9 項補齊）並同步 `task-checklist.md`。

**TF2 DoD**
- [ ] `analyze:spider-wide` 對真人匯出實跑 exit 0，七欄有值且 `activeRateHz` 已記。
- [ ] 三個門檻各一組區段／間隙分布，含 n 與錄製條件。
- [ ] 三條限制逐條寫明（描述性／未校準／條件相依）。
- [ ] throwaway script 與匯出檔皆未進 repo。

**TF2 Commit**：`docs(stage13): record WP-60 real-capture segment and gap distribution`

---

## 2. TF3 —— 全量 Playwright 讀數

### 2.1 為什麼上次沒跑（不是「跳過」）

`playwright.config.ts` 是 `reuseExistingServer: !process.env.CI` + `url: http://localhost:5173/`，而 **27 支 spec 全部硬編** `http://localhost:5173/`。T-exit 當時 5173 上是**主 checkout** 的 dev server：

- `GET :5173/src/main.ts` → `rawMouse` 命中 **0** ⇒ 服務的是不含 WP-60 的程式碼；
- `GET :5173/api/history/health` → `validRunCount: 78` ⇒ 掛的是**真實** `data/session-history/`。

⇒ 跑下去會 ① 沉默地測錯的樹、② 把測試 participant 寫進真實資料。**設 `CI=1` 更糟**：`reuseExistingServer` 變 false，Vite 自動換 port，但 Playwright 的 readiness 仍打 5173，照樣連到別人的 server。

### 2.2 Steps

1. **檢查 port**（不要直接殺）：
   ```powershell
   Get-NetTCPConnection -LocalPort 5173,4173 -State Listen | ForEach-Object {
     Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" | Select-Object ProcessId, CommandLine }
   ```
   有人在 → **問使用者**能不能停（那可能是他正在用的量測入口，例如 WP-60 R1/R2 用的 5174）。**不得自行終止**。
2. 停掉之後確認 5173／4173 皆無 listener，且 `data/session-history/.history-root.lease` 沒有活的持有者。
3. 執行（**`--workers=1` 是門檻讀數的唯一合法取法**，KI-030）：
   ```powershell
   npx.cmd playwright test --workers=1
   ```
4. **逐項歸屬**每個失敗，這是本 task 的主要產出（不是「幾個綠」）：
   - **既存 [KI-027](../../../../known_issue/)**（`overlay-layering.spec.ts` 硬編 launch button 數）—— **預期紅**，非 WP-60 也非 WP-58；
   - **[KI-030](../../../../known_issue/)** —— 多 worker flake；若 `--workers=1` 下仍紅，**第一件事是完整複製 `test-results/`** 再分析；
   - **WP-58 的 spec**（`session-orchestrator.spec.ts`、`overlay-layering.spec.ts` 於 merge 後已含 WP-58 T4~T6 變更）—— 屬 stage12，歸給 WP-58；
   - **WP-60 的 spec**（`raw-mouse-sampling.spec.ts`）—— 只有這支紅才算本 WP 的回歸。
5. 跑完確認 `.playwright-tmp/history-dev` 與 `-preview` 兩個目錄都存在（證明用的是測試 root，不是真實 root）；順手數一下 `.playwright-tmp/history-dev` 的目錄數，> 數百時先清（KI 記錄：累積會讓 history-library spec 轉紅）。
6. 把「指令 + 實際 pass/fail 數 + 逐項歸屬」寫進 `progress.md` §T-exit gate 的收尾閘表（把「未執行」那一列換掉），並同步 [`../README.md`](../README.md) §2 與 [`docs/exec-plan/README.md`](../../../README.md) §2 的 WP-60 狀態列（**只改自己那幾行**）。

**TF3 DoD**
- [ ] 停 server 前已取得使用者同意（或確認本來就沒人占用）。
- [ ] `--workers=1` 的完整 pass/fail 數已記錄。
- [ ] **每一個**失敗都有歸屬（既存 KI／WP-58／WP-60），無「疑似 flake」了事。
- [ ] `.playwright-tmp/history-dev`／`-preview` 存在，真實 `data/session-history/` 未被寫入測試 fixture。
- [ ] WP-60 狀態列同步（三處）。

**TF3 Commit**：`docs(stage13): record WP-60 full Playwright attribution`

---

## 3. 不在本檔範圍

- **OQ-60.4 構念歸屬** —— 使用者／研究拍板，屬 **WP-61 T0** 的第一件事（見 [`../wp-61-lift-off-validation/README.md`](../wp-61-lift-off-validation/README.md)）。
- **OQ-60.7 長 drill 匯出體積政策** —— 觸發條件為「首次出現 > 200 s 的 `?rawMouse=1` run」，在那之前不處置。
- **抬滑鼠判準本身** —— WP-61。本檔三個 task **都不得**引入任何「這個空洞是抬滑鼠」的判斷。
