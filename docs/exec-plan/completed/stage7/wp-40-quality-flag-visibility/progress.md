# WP-40 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-40.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ✅ | 2026-08-25 | CodeGraph + `rg` 覆核 §0: `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary()`/三參數 `show()`、`Meta`/`CollectMetaArgs`/`collectMeta()`、`SessionSetupValues`、`main.ts` 的兩個 `resultScreen.show()` 與一個 `collectMeta()` 呼叫點皆與 README 一致;`src/` 尚無 `dpi`。`npm run test:ci` 綠燈(125 files / 944 tests + 21 Playwright tests)。 |
| T1 quality-flag card | ✅ | 2026-08-25 | `npx vitest run src/ui/ResultScreen.test.ts` green (16 tests); `npm run test:ci` exit 0 (125 files / 947 tests + Playwright). Added six closed `QUALITY_FLAG_IDS`, two-tier `overallSeverity`, optional `show()` input with zero rendering when absent, and both `main.ts` result-flow call sites pass export metadata flags. WP-38 diagnosis summary remains unchanged. |
| T2 dpi metadata | ✅ | 2026-08-25 | `Meta`/`CollectMetaArgs`/`collectMeta()` additive `dpi?: number`; absent DPI produces no key and supplied DPI is positive-finite validated. Session setup records optional integer self-report DPI (100–32000); `buildCurrentExportPayload()` forwards it only when supplied. Targeted Vitest: 2 files / 50 tests; `npm run test:ci`: 125 files / 950 tests + 21 Playwright tests, exit 0; `rg "\.dpi\b" src/metrics` zero matches. |
| T-exit 驗收 + 文件定稿 | ✅ | 2026-08-25 | FR-G1 逐旗標情境(late-events/buffer-overflow/recorder-overflow/corridor-exceeded/perf-floor/suspect)+ 兩層嚴重度 + `--warn` 樣式 + 未提供時零渲染,見 `src/ui/ResultScreen.test.ts`「WP-40 T1 quality-flag result section」(3 tests);FR-G2 additive `dpi`(有值/缺值/邊界拒絕)見 `src/data/metadata.test.ts`(2 tests)+ `src/ui/SessionSetup.test.ts`(2 tests)。`git diff` 對 `createDiagnosisSummary()`/`DIAGNOSIS_METRIC_IDS` 為空(D-40.1 覆核通過);`rg "\.dpi\b" src/metrics` 零命中。`npm run test:ci`:125 files / 950 tests + 21 Playwright tests,exit 0。CONTEXT.md 新增 §L;stage7 README §3 WP-40 翻 ✅、§8 §K→§L 修正並記錄 WP-41/42 續接 §M。判定 `docs/operational/*.md` 不需新文件(見 Decision Log D-40.5)。 |

## Decision Log

### D-40.1 — quality-flag 與 WP-38 診斷卡片維持獨立(2026-08-25)

- **決定**:T1 新增封閉的 quality-flag 呈現單元,不修改 `DIAGNOSIS_METRIC_IDS` 或 `createDiagnosisSummary()`。
- **依據**:`diagnosis-quality-gate-status` 仍固定呈現 `ok`,其語意是「診斷僅在 quality gate 通過後才評估」;原始匯出旗標尚未進入 `ResultScreenHandle.show()`。
- **Alternatives Considered**:將現有 WP-38 Quality gate 卡片改為匯出旗標彙總——拒絕,會混淆兩種構念並破壞既有封閉契約。

### D-40.2 — 維持兩層嚴重度(2026-08-25)

- **決定**:`suspect` 與 `recorderOverflow` 為 `retest-recommended`;`bufferOverflow`、`lateEventCount > 0`、`validity.corridorExceeded`、`validity.perfFloor` 為 `warn`;其餘為 `ok`。T1 必須產出 `overallSeverity`。
- **依據**:`recorderOverflow` 代表 recorder arena 溢位造成的真實資料遺失,獨立於 `suspect` 本身即足以判定重測;走廊越界與效能地板拆解是獨立觀測,不應因單一觀測直接宣告資料作廢。
- **T-exit 覆核修正(2026-08-25)**:本條原「依據」誤述為「`collectMeta()` 將 `recorderOverflow` 納入 `suspect` OR 聚合」——覆核 `main.ts:446-448` 確認 `suspect` 只 OR `experimentSession.suspect`(fullscreen 退出)與 `frames.summary.p95 > PERF_FLOOR_MS`,`recorderOverflow` 並未進入該聚合(`main.ts:441`/`:455` 是兩個各自獨立寫入 `Meta` 的欄位)。已更正上方「依據」文字;`recorderOverflow → retest-recommended` 的**決定本身**不受影響,原判斷理由(資料遺失)獨立成立,只是先前的支持論證引用了不存在的程式碼行為。
- **Alternatives Considered**:以任一旗標觸發重測——拒絕,會將可接受的邊界觀測過度升級;第三層以上的分類——拒絕,目前六旗標的使用決策只需警示/建議重測兩個非正常層級。

### D-40.3 — `--warn` 以具名常數對齊 token(2026-08-25)

- **決定**:T1 在 `ResultScreen.ts` 使用 `QUALITY_FLAG_WARN_COLOR = '#f5a623'`,並以註解指向 `.claude/skills/aim-analyst-ui/assets/tokens.css:29` 的 `--warn`。
- **依據**:`ResultScreen` 目前沒有載入 token stylesheet,且全頁卡片使用 inline 色碼;注入整份 `tokens.css` 會擴大為全頁視覺改版。
- **Alternatives Considered**:載入 `tokens.css` 的 CSS variable——拒絕,超出 WP-40 範圍;無來源註記地直接硬編色碼——拒絕,會形成無法追溯的第二色碼來源。

### D-40.4 — DPI 為 T2 可自行落實的 UI 防呆邊界(2026-08-25)

- **決定**:DPI 是可選自陳欄位,T2 採 `100–32000` 的表單輸入邊界;它不是科學凍結常數,不需研究者另行核准。
- **依據**:瀏覽器無法讀取外部滑鼠硬體 DPI,而 `SessionSetupValues` 已是顯示硬體自陳的既有入口;DPI 只供 metadata 記錄,不流入指標計算。
- **Alternatives Considered**:不設邊界——拒絕,會降低表單防呆;將上下界納入研究凍結參數——拒絕,它們不改變模擬或效度模型。

### D-40.5 — `docs/operational/*.md` 不新增契約文件(2026-08-25,T-exit)

- **決定**:quality-flag 兩層嚴重度分層(D-40.2)與 `dpi` 自陳欄位(D-40.4)不新增/擴充 `docs/operational/analysis-*.md`。
- **依據**:兩者皆是**呈現層/表單層**決策,不像 `analysis-diagnosis.md`/`analysis-peek-timeline.md` 那樣定義新的逐 tick 幾何或時間構念,也不涉及 Python/TS 雙實作對表(C-D5 只管束 `seg-v2`/`phase-v1`/`curve-v1`/`sync-v1`/`sg-seg-v2` 這類晉升指標);嚴重度分層的完整理由已record 在 D-40.2 + CONTEXT.md §L,足以供未來稽核,不需要獨立契約文件。
- **Alternatives Considered**:新增 `analysis-quality-flags.md` 記錄六旗標→兩層嚴重度映射——拒絕,會為一個純呈現層的 if/else 表格新增文件維護負擔,且無下游 Python 側消費者需要對齊此文件。

## Surprises

_(尚無。)_

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S7-6 | `--warn` 色值取值方式 | ✅ D-40.3:具名常數 `#f5a623` + token 來源註解;不載入 stylesheet |
| OQ-S7-7 | `dpi` 表單輸入邊界數值 | ✅ D-40.4:自陳 UI 防呆採 100–32000,非凍結常數 |
| OQ-S7-8 | CONTEXT.md 新術語章節號(§K 已被 WP-39 佔用) | ✅ T-exit 拍板:新增 **§L**;stage7 README §8 已註記 WP-41/42 續接 §M 起 |
