# WP-60 T4 — 操作者可見度：取樣健康度報告

## Objective

讓操作者在**看數字之前**就知道這份 run 的原始取樣能不能信。WP-57 §T5-real 的教訓是：一份看起來正常的匯出，其指標可能整組靜默歸零（KI-031，detected 0/113 而 CI 全綠）。原始取樣多了三種新的靜默失效模式（事件率不足、溢位、Pointer Lock 中斷），本 task 把它們變成**逐份點名的 blocker**。

## Inputs to read

- [README.md](README.md) §2.6 F1/F3/F4（三種失效模式）、FR-60.8。
- `scripts/spiderWideRepositioningRunner.ts`（既有的 blocker 慣例：先印資料品質、再印數字；`assessDirectionality()` 共線時拒答的先例）。
- `scripts/analyze-spider-wide-repositioning.ts`（I/O 殼與 gitignored 輸出目錄的分工）。
- [`docs/operational/spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md) §5（報告三段結構；本 task 需同步更新該節）。
- T0 的實機事件率門檻與 T3 的 `gapThresholdMs` 取值。

## Steps

1. 在 `spiderWideRepositioningRunner.ts` 的 `SpiderWideRunSummary` additive 新增取樣健康度欄位：`sampleCount`、`observedRateHz`、`sampleOverflow`、`lockBreakCount`、`gapCountAtThreshold`、`longestGapMs`。缺 `mouseSamples` 區塊時全部 `undefined`（**不是 0** —— 缺席與零必須可分辨，比照 `RingBuffer` 的 `hasFire` 慣例）。
2. 新增 blocker 條目（沿用既有 `blockers: string[]` 形狀）：
   - 事件率 < T0 門檻 ⇒「原始取樣事件率不足，時間間隙判定不可用」；
   - `sampleOverflow` ⇒「取樣溢位，末端資料缺失」；
   - `crossOriginIsolated === false` ⇒「時間戳精度不足（F4），`dt` 判定被捨入雜訊污染」；
   - `lockBreakCount > 0` ⇒「Pointer Lock 中斷 N 次，該區間的空洞不是抬滑鼠」。
3. 報告的「資料品質」段（第一段）納入上述 blocker；「逐 run」段（第二段）加取樣欄位。**不新增第四段** —— 保持既有三段結構。
4. 缺 `mouseSamples` 的舊匯出**不得**因此變成 blocked：它只是沒有這一維資料，不是資料有問題。以既有 counterstrafe fixture 實跑證明。
5. 更新 `docs/operational/spider-wide-recording-spec.md` §2 與 §5：加一節「原始取樣的錄製前提」（開啟選項、事件率要求、Pointer Lock 不要中斷），並在 §5 的報告說明納入新欄位。
6. 更新 `tests/regression/spider-wide-repositioning-runner.test.ts`：新增取樣健康度的正負向案例，並確認既有 12 個案例**期望值零修改**（缺席即 `undefined`）。

## Invariants

- runner 維持純函式；I/O 全在 `analyze-spider-wide-repositioning.ts`。
- 不改既有 blocker 的文字與觸發條件（KI-031、DPI、suspect、母體為空、drill 不對）。
- 不改 `assessDirectionality()` 的語意 —— 取樣健康度不參與方向性可答性判斷。
- 缺 `mouseSamples` 是**合法**狀態，不是 blocker。
- 輸出仍寫 gitignored 的 `.spider-wide-analysis/`；由參與者匯出推導的產物不進 git。

## Definition of Done

- [ ] `SpiderWideRunSummary` 六個新欄位在有／無 `mouseSamples` 兩種輸入下分別為實值／`undefined`（一個斷言涵蓋兩種）。
- [ ] 四個新 blocker 各有一個觸發案例與一個不觸發案例（八個斷言）。
- [ ] 既有 counterstrafe fixture（無 `mouseSamples`）實跑：**不因缺該區塊而新增任何 blocker**（指令與輸出貼進 `progress.md`）。
- [ ] `tests/regression/spider-wide-repositioning-runner.test.ts` 既有 12 案例期望值零修改（`git diff` 可證）。
- [ ] `npm run analyze:spider-wide` 對一份含 `mouseSamples` 的樣本實跑，報告三段結構完整、取樣欄位有值（輸出貼進 `progress.md`）。
- [ ] `spider-wide-recording-spec.md` §2／§5 已更新並與實作一致（新欄位名稱逐字相符）。
- [ ] 全量 Vitest 綠；typecheck ×2 與 `vite build` exit 0。

## Commit

```text
feat(scripts): report raw sampling health per run
```
