# WP-49 — progress.md

> Running log。Spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27 / planning**：依使用者指定的 `.claude/skills/engineering-planning/SKILL.md` 完成repository-grounded WP-49 tech spec。已讀skill及bundled standards/template、AGENTS、Stage 10／WP-48、graphify report；以CodeGraph對帳HistoryView、ResultScreen、main completion、sessionHistory、CompatibilityKey、ResearcherMenu與SessionRunner。尚未寫production code、尚未開始T0。
- **2026-08-27 / scope baseline**：沿用最新Assessment-only policy。Practice不持久化、不進Participant瀏覽、run detail或trend；只保留WP-48定義的當次Result／manual export。

## Decision Log

- **D-49.P1 / navigation**：推薦使用namespaced hash route `#/history/...`，支援Back/Forward/reload，又不要求Vite新增history fallback；保留dev-only `#pattern` namespace。
- **D-49.P2 / state ownership**：單一`HistoryLibraryController`擁有route async state與cancellation；DOM views只送intent，不自行fetch。
- **D-49.P3 / exact grouping**：API、route、registry與trend皆以完整exact `drillId`為key；不得family/prefix fallback。
- **D-49.P4 / result reuse**：current Result與historical Result共用payload→presentation與read-only body；restart/save status只屬current wrapper。
- **D-49.P5 / trend semantics**：正式trend只含Assessment + quality-ok + selected compatibility cohort + matching metric id/unit + finite value；不做composite、smoothing或forecast。
- **D-49.P6 / analysis boundary**：列表先使用WP-48 compact summaries；完整payload projection在Node analysis service以cursor page + bounded concurrency執行，browser只收compact observations。
- **D-49.P7 / unknown metrics**：未註冊drill仍可用Participant/drill/run/result flow；trend顯示empty state，不throw、不發明metric。
- **D-49.P8 / replay handoff**：WP-49只保留typed optional action port；WP-50未接入前不顯示replay button。

## Blast Radius Notes

- `createHistoryView`：2個`main.ts` caller並有component tests；由人工file picker轉正式screen是cross-module change。
- `createResultScreen`：2個`main.ts` caller並有component tests；抽shared body影響current與historical presentation，T3=High。
- `buildSessionHistory`：2個caller且有domain tests；WP-49另建general trend，不直接改舊baseline函式。
- `CompatibilityKey`：9個consumers並有tests；WP-49以adapter重用，不改既有欄位/equality語意。
- `main.ts` history/result wiring無direct covering test；T5需要Playwright。

## Surprises

- 現有應用沒有general router或HomeScreen；只有launch controls／researcher menu與overlay。History入口需在composition層建立，不能假設已有SPA shell。
- 現有`historyMetricsFor()`只處理hold-click／hold-track，其他drill會throw；這正是registry與unknown-empty policy的必要性。
- WP-48 summary刻意不含metric/compatibility資料；若browser逐run載完整JSON，數百run即可產生數百MiB傳輸，因此新增compact paged analysis projection較安全。
- package目前沒有chart library；專用SVG + accessible table是最小可驗證方案。
- graphify由commit `b0fba569`建立，而目前HEAD為`3ac2f363...`；規劃以current CodeGraph/on-disk source為準，production修改後需`graphify update .`。

## Open Questions（status）

- **OQ-49.1 / initial metric roster**：Open；推薦只註冊現有明確mapping的`holdClickV1.drill.drillId`／`holdTrackV1.drill.drillId` exact ids。Owner：使用者／研究設計owner。Deadline：T0 exit。
- **OQ-49.2 / compatibility cohort UX**：Open；推薦latest eligible cohort default + selector。Owner：使用者／UI owner。Deadline：T0 exit。
- **OQ-49.3 / manual HistoryView**：Open；推薦移除人工picker，保留JSON/CSV download。Owner：使用者。Deadline：T0 exit。
- **OQ-49.4 / full trend loading**：Open；推薦page=100、漸進載入全部並顯示loaded/total。Owner：架構師／使用者。Deadline：T0 exit。
- **OQ-49.5 / corrupt-file diagnostics**：Open（承接WP-48 OQ-48.3）；推薦只顯示invalid/unsupported/excluded-Practice分類count與安全說明，不列檔名/path、不做quarantine UI。Owner：使用者／UI owner。Deadline：T0 exit。
