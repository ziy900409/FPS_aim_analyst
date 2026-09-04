# WP-55 T7 — Operator entry point（關閉 OI-55-1）

> 上游：[T-exit](T-exit-m21-evidence-audit-handoff.md) 的 [README §6.2](README.md#62-t-exit-evidence-ledger2026-09-03) OI-55-1。
>
> **這個 task 存在的唯一理由**：T1-T5 交付了測試齊全的純函式，但 T-exit 稽核發現**五個 module 只被自己的 test 匯入** —— 研究者拿到真實 tracking `export.json` 無法在不寫新程式的情況下產出任何 artifact。M21 因此只能收成 conditional pass。本 task 補上那個入口，把 M21 收乾淨。

## Objective

新增一支 thin CLI runner，把一份或多份 tracking export JSON 轉成既有 WP-55 artifact（contact artifact / coverage / report HTML / replay contact trace HTML），輸出到 gitignored 目錄，並讓每個輸出檔可追回它的來源 export 檔。

## Non-goals（不得越界）

- **不得改動 T1-T5 任何凍結語意或 schema 版本字串**（`tracking-contact-v1`、`tracking-contact-artifact-v1`、`tracking-contact-report-v1`、`replay-contact-trace-v1`）。runner 只是 glue。
- **不得在 runner 裡重新定義 contact、epsilon、TOT、acquisition 或 blocked 語意**（C-D4：既有構念不得有第二定義）。所有數值一律來自既有 export 的純函式。
- 不新增 health/HP/damage/kill contract（FR-55-1/5）。
- 不動 sim/render/`TargetManager`/`SharedState`/live render hot path（D-55.2）。
- 不做產品 Replay overlay（OQ-55-1 已決議 offline-first，仍為 future）。

## Design

責任切分照 repo 既有 runner 慣例（`trackingGateBExtract.ts` 為純邏輯、`analyze-tracking-pilot.ts` 為 I/O 邊界）：

```text
scripts/trackingContactRunner.ts      NEW 純函式：loaded runs -> 要寫出的檔案內容 + summary。無 fs、無 process
scripts/analyze-tracking-contact.ts   NEW CLI：收檔、parse、mkdir/write、印 summary、exit code
tests/regression/tracking-contact-runner.test.ts  NEW runner 層 regression
.gitignore                            MODIFY 新增 .contact-analysis/（participant-derived 紅線）
package.json                          MODIFY 新增 analyze:contact script
```

### 輸出契約

| 檔案 | 來源 | 每份 run 或聚合 |
|---|---|---|
| `<sourceId>.contact-artifact.json` | coverage run 的 `contactArtifact`（含 blocked run） | per run |
| `<sourceId>.replay-trace.html` | `renderReplayContactTraceHtml(artifact)` | per included run |
| `tracking-contact-report.json` | `serializeTrackingContactReport(report)` | 聚合 |
| `tracking-contact-report.html` | `renderTrackingContactReportHtml(report)` | 聚合 |
| `manifest.json` | runner 自產 | 聚合；輸出檔 ↔ 來源 export 檔的對照 |

### 兩個關鍵設計決定

1. **單一推導、單一判定。** `buildTrackingContactCoverageReport(payloads, options)` 對所有 payload 只吃一份 options，因此無法逐檔帶 `exportBasename`。若 runner 另外為每檔再呼一次 `buildTrackingContactArtifact()` 並帶 basename，同一個檔可能出現兩種判定（standalone ok 但 coverage 判 `protocol-incompatible`）。故 runner **只呼 coverage 一次**，per-run artifact 直接取 `run.contactArtifact`，檔名 provenance 改由 `manifest.json` 承載。這樣不動凍結契約也不會有兩套判定。
2. **schema-rejected 檔不中止全批。** `parseExportPayload()` 回傳 `{ok:false, errors}` 而非 throw；照 `analyze-tracking-pilot.ts` 先例收進 `rejected[]` 並繼續，於 summary 與 manifest 具名列出。理由：blocked/rejected 是合法的 reason-coded 結果，不是崩潰；但也絕不能靜默丟掉（FR-55-7）。

## Steps

1. 寫 `scripts/trackingContactRunner.ts`：`buildTrackingContactRunnerOutputs(runs, options)` 回傳 `{ files: {name, content}[], manifest, summary }`；`formatTrackingContactRunnerSummary()` 產 stdout 文字。純函式、無 fs。
2. 寫 `scripts/analyze-tracking-contact.ts`：`--out`（預設 `.contact-analysis`）、`--strict-eye-origin=false` 逃生閥、檔或目錄輸入、`--` 分隔符過濾；寫檔前 `mkdirSync(recursive)`。
3. 寫 `tests/regression/tracking-contact-runner.test.ts`。
4. `.gitignore` 新增 `.contact-analysis/` 並註明 participant-derived 理由。
5. `package.json` 新增 `"analyze:contact": "vite-node scripts/analyze-tracking-contact.ts --"`。
6. 驗證（見下）。
7. `graphify update .`（本 task 有 production code 變更）。
8. 翻 OI-55-1、M21 conditional pass → pass；同步 README §6.2 / checklist / progress / stage11 master。

## Definition of Done

- [ ] `npm run analyze:contact -- <dir>` 能從真實形狀的 export 產出上表五種檔案。
- [ ] runner 不重新定義任何 contact 構念：所有數值皆取自 `buildTrackingContactCoverageReport` / `buildTrackingContactReport` / `buildReplayContactTrace` 的輸出。
- [ ] included run 產 artifact + replay trace；blocked run 仍產 artifact 且帶 closed reason code，不產假 0、不靜默跳過。
- [ ] schema-rejected 檔在 summary 與 manifest 具名，不中止其他檔。
- [ ] `manifest.json` 可從每個輸出檔追回來源 export 檔路徑與 `sourceId`。
- [ ] 輸出預設落在 gitignored 目錄；`git status --short` 在跑完 runner 後不出現 artifact。
- [ ] runner 層 regression test 綠；`npm run typecheck` exit 0；full `npm test` 綠。
- [ ] `graphify update .` 已跑。
- [ ] OI-55-1 翻掉，M21 收成 pass，四份文件（WP README/checklist/progress + stage11 master）同步。

## Commit

```text
feat(wp-55): T7 operator entry point — contact artifact CLI runner
```
