# WP-60 T-exit — 驗收與 WP-61 Handoff

## Objective

逐條驗收 FR-60.1～9 / NFR-60.1～7，確認本 WP 交付的是「**可用且已知其極限**的原始取樣管線」，並交出 WP-61（LOD 判準移植）開工所需的四項證據。**不得**以「實作完成」結案；每一條都要有指令、輸出或斷言檔名。

## Acceptance criteria

| ID | 條件 | 證據來源 | Blocking |
|---|---|---|---|
| **A-60.1** | 開啟錄製後，一份真實 run 的匯出含 `mouseSamples`，且樣本數 ≈ 事件率 × drill 長度 | T2 實機 | ✅ |
| **A-60.2** | **關閉**錄製時匯出與本 WP 之前逐位相同 | T1 字串比對測試 | ✅ |
| **A-60.3** | 四 FPS parity 的「開／關」兩組 sim 狀態逐位一致（NFR-60.1）| T2 | ✅ |
| **A-60.4** | 每個 tick 的 `dYaw` 等於該 tick 窗內原始樣本換算總和（FR-60.7）| T2 | ✅ |
| **A-60.5** | 錄製開啟不新增 `Array.prototype.push`（NFR-60.2）| T2 | ✅ |
| **A-60.6** | 溢位以獨立旗標呈現且不改 `meta.suspect`（FR-60.9）| T1 + T2 | ✅ |
| **A-60.7** | 缺席合法、宣稱不符擲指名欄位 typed error（FR-60.4）| T1 六格 fixture 矩陣 | ✅ |
| **A-60.8** | `segmentByTimeGap()` 對抗性 fixture（恰在門檻上／下）全綠（FR-60.5）| T3 | ✅ |
| **A-60.9** | Pointer Lock 中斷的空洞與真實間隙可分辨（FR-60.6 / F2）| T3 | ✅ |
| **A-60.10** | 60 s run 的 `mouseSamples` 序列化 ≤ 1.0 MB（NFR-60.4）| T0 PoC + T1 實測 | ✅ |
| **A-60.11** | `dt` 量化誤差 ≤ 10 µs（NFR-60.5）| T0 | ✅ |
| **A-60.12** | 新模組純度掃描全綠（NFR-60.6）| T3 | ✅ |
| **A-60.13** | C-D3 零 importer + C-D4 零既有判準符號命中（R6）| T3 | ✅ |
| **A-60.14** | 全 repo 無 `LOD` 縮寫命名（R7）| T3 | — |
| **A-60.15** | 缺 `mouseSamples` 的舊匯出不因此被判 blocked | T4 | ✅ |
| **A-60.16** | frame-time p95 開／關差值符合 T0 門檻，無新增掉 tick（F6）| T2 | ✅ |

## Steps

1. 逐條跑 A-60.1～16，把**指令 + 實際輸出**（非「已通過」）貼進 [progress.md](progress.md)。
2. 跑收尾閘：`npm run typecheck`（兩個 tsconfig）、全量 `npx vitest run`、`npx vite build`、全量 Playwright。
   - ⚠️ **`npm run test:ci` 目前 exit 1 的既存原因是 [KI-027](../../../../known_issue/)**（`overlay-layering.spec.ts` 硬編 launch button 數），非本 WP。若仍紅，**明確揭露**並歸因，不得掩蓋。
   - ⚠️ **[KI-030](../../../../known_issue/)**：全量 Playwright 在多 worker 下不可重現。以 `--workers=1` 取門檻讀數，並在重現失敗時**第一件事是複製整個 `test-results/`**。
3. 逐項歸屬全量測試數的差額（本 repo 有平行 session 在 stage12 作業，數字會涵蓋他人工作）。
4. 覆核 FR/NFR traceability（README §4.1）無遺漏。
5. 覆核 §2b 硬約束表逐條仍成立（特別是決定性、固定佈局、三迴圈邊界）。
6. 產出 §5 的 WP-61 handoff 四項。
7. 更新 [`../README.md`](../README.md) §2 的 WP-60 狀態、[`docs/exec-plan/README.md`](../../../README.md) §2 的 stage13 區塊（**只 stage 自己的行**，見 README §6 worktree 紀律）。
8. 視需要入帳 ~~**GD-35**~~ → **GD-36**（原始輸入取樣的匯出邊界與 C-D4 歸屬）到 [`DECISIONS.md`](../../../DECISIONS.md)。
   ⚠️ 規劃期預留的 `GD-35` 已被平行 session 的 WP-58 T0 取用，依 GD-15「先採納先得」順延 —— **已於 2026-09-09 以 GD-36 入帳**。

## WP-61 handoff（必須交出，否則 WP-61 不得開工）

| # | 交付物 | 來源 |
|---|---|---|
| 1 | 實機事件率分布（直方圖 + p50/p95/p99）| T0 step 3 |
| 2 | 抬起／停頓／一次到位三組的空洞長度分布 | T0 step 4；2026-09-09 摘要與限制見 [progress.md](progress.md)「T0 R2 實機結果與 WP-61 收斂」，後續見 [WP-61](../wp-61-lift-off-validation/README.md) |
| 3 | PA 的十四個 LOD 參數與語意抄本 + 「哪些需在角度空間重推」的標註（授權已無虞，D-60.P7）| T0 step 7 |
| 4 | OQ-60.4 構念歸屬結論（新判準與 `deriveRepositioningSuspicion()` 的關係）| 使用者拍板 |

**WP-61 另需但本 WP 不提供**：高刷（≥ 144 Hz）真人標註 cohort，規格見 [`spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md)。

## Definition of Done

> 執行紀錄：[progress.md](progress.md) §T-exit gate（2026-09-09）。

- [x] A-60.1～16 逐條有指令與輸出；未達成者**明確列出並歸因**，不得省略。<br>14 ✅／1 ✅ 帶上界告警（A-60.10 → OQ-60.7）／1 🟡（A-60.16 瀏覽器側 = F6），無 ❌。
- [x] 四個收尾閘的實際數字記入 `progress.md`；`test:ci` 若 exit 1，成因逐條歸屬（既存 KI vs 本 WP）。<br>typecheck ×2 / 全量 Vitest（2614 passed）/ `vite build` **exit 0**；**全量 Playwright 未執行**且已具名歸因（port 5173 被主 checkout 的 dev server 占用，服務的是不含 WP-60 的程式碼 + 真實 history root ⇒ 跑了會沉默地測錯的樹）。因此 `test:ci` 也未取讀數 —— **不宣稱通過**。
- [x] FR/NFR traceability 表逐條對帳完成。
- [x] §2b 硬約束表逐條覆核，變動處已更新。
- [x] WP-61 handoff 四項齊備。<br>①②③ ✅；④ ✅ **已由 WP-61 T0 的 D-61.U1 / GD-37 補齊**：既有 `deriveRepositioningSuspicion()` 與新構念「感測器離地 / sensor lift」並存但語意分離。
- [x] `../README.md` §2 與 `docs/exec-plan/README.md` §2 狀態已同步（只含自己的變更行）。<br>後者原**無** stage13 區塊，本 gate 新增「階段 M」整段（未動 stage12 任何一行）。
- [x] `progress.md` 的 Decision Log／Surprises／Open Questions 三節完整；未收斂的 OQ 標明 owner 與 deadline。<br>新增 D-60.X1、Surprises 9、OQ-60.7。

## Commit

```text
docs(stage13): close WP-60 raw mouse sample capture
```
