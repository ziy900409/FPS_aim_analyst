# WP-48 T-exit — Acceptance and WP-49/WP-50 Handoff

## Objective

用 README §1 的可測試需求與 §4.1 traceability matrix驗收整個 WP-48；確認 repository/API/client/completion flow 是可由 WP-49／WP-50 穩定使用的地基，而不是只在單一 demo path 可用。

## Automated gates

1. Browser TypeScript typecheck exit 0。
2. Node/server TypeScript typecheck exit 0。
3. 全 Vitest exit 0，記錄 files/tests count。
4. 全 Playwright exit 0，記錄 tests count；dev/preview roots 隔離。
5. `npm run build` exit 0；browser bundle static scan 無 `node:fs`／history root。
6. `npm run test:ci` exit 0（若 scripts 在本 WP 更新，需證明包含 Node typecheck）。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-48.1 | Practice complete | Result 與手動 JSON/CSV 匯出可用；status excluded；零 HistoryClient/API request、零 final file、零 index entry |
| A-48.2 | Assessment complete | Result 立即顯示；status saved；正確 participant/drill/time JSON 與完整 payload round-trip |
| A-48.3 | restart API | 只靠 JSON 重建相同 participants/drills/runs/load result |
| A-48.4 | duplicate same content | first=created，retry=existing，只有一 final file |
| A-48.5 | duplicate different content | 409 conflict；原檔 byte-identical |
| A-48.6 | API unavailable | Result/metrics/session flow正常；failed + retry/download；無 unhandled rejection |
| A-48.7 | missing Participant | 不寫入、不捏造 ID、明確提示 |
| A-48.8 | malicious paths/symlink | 100% rejected；root 外 sentinel byte-identical |
| A-48.9 | corrupt/unsupported files | API still healthy for valid files；counts 正確；正常 list 排除 |
| A-48.10 | 5,000 runs | warm list/cold rebuild 達 NFR-48.2/3 或按已凍結 fallback 交付 evidence |

另外以直接 `POST` Practice payload 驗證 API 回 `422 PRACTICE_NOT_ARCHIVABLE`，repository 零 mutation；A-48.1 驗證的是正常 UI short-circuit，兩層缺一不可。

## Data-safety checks

- [ ] 所有 test root resolved paths 均在 workspace test temp root；清理前再次驗證。
- [ ] `data/session-history/` 沒有測試生成 JSON。
- [ ] `git status --short`、`git diff --cached --stat`、staged names 只包含預期 code/tests/docs/config；無 participant JSON。
- [ ] `.gitignore` 確實忽略 run JSON，tracked README/placeholder 仍可追蹤。

## Architecture regression checks

- [ ] `src/sim/`、`src/state/SharedState.ts`、`src/drill/DrillRunner.ts` 無 WP-48 diff。
- [ ] live determinism/golden metrics tests 全綠；auto-save path 不在 sim tick。
- [ ] `sessionHistoryLoader` 與 Node repository 共用同一 strict parser。
- [ ] `main.ts` 不含 raw `fetch('/api/history...')`、Node import 或 path construction。
- [ ] Vite COOP/COEP dev + preview E2E 維持全綠。

## Documentation and graph

- [ ] [README.md](README.md) OQ/assumptions/status 更新為實際交付結果。
- [ ] [progress.md](progress.md) 貼完整 test/benchmark/acceptance evidence。
- [ ] [task-checklist.md](task-checklist.md) T1～T5 與 T-exit 全翻 ✅。
- [ ] 上層 [../README.md](../README.md)、[../task-checklist.md](../task-checklist.md)、[../progress.md](../progress.md) WP-48 狀態更新。
- [ ] `graphify update .` 完成；CodeGraph pending files 同步或已直接讀取確認。
- [ ] 視正式採納狀態更新 `docs/exec-plan/README.md`／`DECISIONS.md`／`docs/MAP.md`，或明記延後理由。

## Exit criteria

上述 automated gates、A-48.1～10、data safety、architecture regression 全數有客觀證據才可宣告 WP-48 完成並開放 WP-49／WP-50。任何一項 High-risk failure mode 只靠人工描述、沒有 test/measurement，T-exit 即不通過。

## Commit

```text
docs(stage10): close WP-48 local history foundation
```
