# WP-49 T-exit — Acceptance and WP-50 Handoff

## Objective

依README FR/NFR與traceability matrix驗收完整WP-49；證明History Library在Assessment-only、navigation、result parity、trend語意與scale上皆成立，並提供WP-50穩定run-detail入口。

## Automated gates

1. Browser TypeScript typecheck exit 0。
2. Node/server TypeScript typecheck exit 0。
3. 全Vitest exit 0，記錄files/tests count。
4. 全Playwright exit 0，記錄tests count與temp roots。
5. `npm run build`、`npm run test:ci` exit 0。
6. boundary scans：History UI無`node:*`／path；server projection無DOM；metric projector無wall-clock/random/fs。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-49.1 | launch browse | History→Participant search→exact drill→run detail，全程無file picker |
| A-49.2 | saved Assessment Result | history button到正確Participant/drill；Back回同Result context |
| A-49.3 | Practice | Result無history entry；participants/drills/runs/observations零Practice |
| A-49.4 | exact grouping | 相近prefix ids分開，run各自`startedAt desc` |
| A-49.5 | current/historical parity | 同payload metrics/diagnosis/quality presentation相同；historical actions綁正確payload |
| A-49.6 | compatible trend | raw points oldest→newest、metric/unit/direction/delta正確 |
| A-49.7 | mixed cohort/quality | 不混算；selector、eligible n與排除原因正確 |
| A-49.8 | unknown metric | list/detail完整；trend明確empty、不throw |
| A-49.9 | navigation race | rapid Back/Forward/reload/selector change無stale overwrite／unhandled rejection |
| A-49.10 | API/corrupt/not-found | scoped error/retry/back可用，其他history不消失 |
| A-49.11 | 5,000 runs | summary render、projection page、concurrency/cache達NFR |
| A-49.12 | replay handoff | historical detail有typed optional port；無WP-50 handler時無假button |

## Data and research-safety checks

- [x] tests只使用resolved workspace temp roots，真實`data/session-history/`無artifact。
- [x] trend dataset逐run可追到runId、descriptor/version、compatibility cohort與quality status。
- [x] 無composite score、family merge、smoothing、forecast或未確認metric registration。
- [x] JSON仍為source of truth；刪除analysis memory cache後結果可重建。
- [x] git staged names無participant JSON、download artifact或benchmark temp data。

## Architecture regression checks

- [x] current Result與historical Result共用presentation/body，actions owner分離。
- [x] History controller是唯一fetch/state owner；views無direct HistoryClient/fetch。
- [x] `main.ts`只做composition／entry／visibility，不含trend/cohort/domain規則。
- [x] `src/sim`、`SharedState`、`DrillRunner`、metrics golden semantics無WP-49行為變更。
- [x] History active不取得Pointer Lock，不啟動/改寫live run。

## Documentation and graph

- [x] README OQ/assumptions/interfaces更新為實際交付。
- [x] progress貼test/perf/acceptance evidence，task-checklist T0～T5/T-exit全✅。
- [x] 上層Stage 10 README/checklist/progress WP-49狀態更新。
- [x] `graphify update .`完成；CodeGraph pending files同步或已直接讀取。
- [x] WP-50 handoff對`run` route、loadRun、optional replay action與return state有contract test。

## Exit Evidence（2026-08-28）

- `npm.cmd run typecheck` exit 0。
- `npm.cmd run test` exit 0：159 passed / 1 skipped test files；1426 passed / 2 skipped tests。
- `npm.cmd run build` exit 0；Vite only reports the existing chunk-size warning.
- `npm.cmd run test:ci` exit 0：same Vitest count；Playwright 51/51 passed。
- Boundary scans passed: History UI has no `fs/path/process/fetch` and no `node:*` import; server projection has no DOM/fetch; metric registry has no wall-clock/random/fs/path; history/result surfaces have no `innerHTML`.
- T4 scale evidence remains the T-exit NFR witness: cold 100-observation page 55.8ms, warm 0.6ms, full 5,000-run scan across 50 pages 1519.6ms, with concurrency capped at 4.
- T-exit test-only fix: `tests/e2e/backend.spec.ts` now waits up to 20s for the real `[render backend]` console witness so the non-history backend E2E remains stable in full parallel `test:ci`.

## Exit criteria

Automated gates、A-49.1～12、research safety與architecture regression全數有客觀證據才可宣告WP-49完成。metric/cohort、Result parity、navigation race或Practice exclusion任一High-risk項只有人工描述、沒有test/measurement，即T-exit不通過。

## Commit

```text
docs(stage10): close WP-49 history library
```
