# WP-48 — Master Task Checklist

> Spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 每個 task 0.5～3 dev-days；一 task 一 commit。task 開工只讀本檔、該 task file 及其明列來源；若 CodeGraph 顯示新 blast radius，先回寫 task/progress 再改碼。

| Done | Task | Objective | Dependencies | Risk | Estimate |
|---|---|---|---|---|---|
| ✅ | **T0** Entry gate／filesystem PoC／決策凍結 | [T0-entry-gate.md](T0-entry-gate.md) | None | High | 0.5–1d |
| ⬜ | **T1** ExportPayload runtime contract | [T1-export-payload-contract.md](T1-export-payload-contract.md) | T0 | High | 1.5–2d |
| ⬜ | **T2** Filesystem repository | [T2-filesystem-repository.md](T2-filesystem-repository.md) | T1 | High | 2–3d |
| ⬜ | **T3** Node History API／Vite adapter | [T3-node-history-api.md](T3-node-history-api.md) | T2 | High | 1.5–2.5d |
| ⬜ | **T4** HistoryClient／persistence state machine | [T4-history-client.md](T4-history-client.md) | T3 | Med | 1–1.5d |
| ⬜ | **T5** Assessment-only auto-save wiring | [T5-auto-persistence-wiring.md](T5-auto-persistence-wiring.md) | T4 | High | 1.5–2.5d |
| ⬜ | **T-exit** Acceptance／handoff | [T-exit-gate.md](T-exit-gate.md) | T1～T5 | Med | 0.5–1d |

## WP-48 completion gate

- [ ] FR-48.1～11 與 NFR-48.1～8 每項均在 README §4.1 traceability matrix 有實際 test／measurement evidence。
- [ ] 至少一條 Assessment auto-save E2E，以及一條 Practice `excluded` E2E（零 POST、零歷史檔案、Result／手動匯出仍可用）。
- [ ] API restart 後由 JSON 重建並列出相同 run；不依賴 browser storage。
- [ ] Practice submission、path traversal、symlink escape、partial write、duplicate conflict、root lock、corrupt JSON、missing Participant、API unavailable 全有負向測試。
- [ ] `npm run build`、Node typecheck、Vitest、Playwright 全綠；無 unhandled rejection。
- [ ] 測試未接觸真實 `data/session-history/`；git staged names 不含任何 participant JSON。

## Task discipline

1. T0 只做 PoC／決策／基線，不混入 production API。
2. T1 parser 是唯一 unknown→`ExportPayload` trust boundary；不得留下第二個 shallow validator。
3. T2 repository 不 import DOM/Vite；T3 adapter 不複製 repository domain logic。
4. T4 client 不 import `node:*`；T5 `main.ts` 不直接呼叫 `fetch` 或組 API URL。
5. 所有 save retries 必須重用 completed run 的同一 payload，不得重新 snapshot。
